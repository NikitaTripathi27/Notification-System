import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { insertEventSchema, insertNotificationSchema } from "@shared/schema";
import { z } from "zod";

interface ConnectedClient {
  ws: WebSocket;
  userId?: number;
}

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);
  const connectedClients = new Set<ConnectedClient>();

  // WebSocket server for real-time notifications
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

  wss.on('connection', (ws) => {
    const client: ConnectedClient = { ws };
    connectedClients.add(client);

    ws.on('message', async (message) => {
      try {
        const data = JSON.parse(message.toString());
        if (data.type === 'authenticate' && data.userId) {
          client.userId = data.userId;
        }
      } catch (error) {
        console.error('WebSocket message error:', error);
      }
    });

    ws.on('close', () => {
      connectedClients.delete(client);
    });

    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
      connectedClients.delete(client);
    });
  });

  // Broadcast notification to connected clients
  function broadcastNotification(notification: any) {
    const message = JSON.stringify({
      type: 'notification',
      data: notification
    });

    connectedClients.forEach(client => {
      if (client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(message);
      }
    });
  }

  // Broadcast metrics update
  function broadcastMetrics(metrics: any) {
    const message = JSON.stringify({
      type: 'metrics',
      data: metrics
    });

    connectedClients.forEach(client => {
      if (client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(message);
      }
    });
  }

  // Event processing queue
  async function processEvents() {
    const events = await storage.getUnprocessedEvents();
    
    for (const event of events) {
      const startTime = Date.now();
      
      try {
        // Get actor details
        const actor = await storage.getUser(event.actorId);
        if (!actor) continue;

        // Create notification message based on event type
        let message = '';
        switch (event.type) {
          case 'like':
            message = `${actor.username} liked your post`;
            break;
          case 'comment':
            message = `${actor.username} commented on your post`;
            break;
          case 'share':
            message = `${actor.username} shared your post`;
            break;
          case 'follow':
            message = `${actor.username} started following you`;
            break;
          default:
            message = `${actor.username} interacted with your content`;
        }

        // Create notification
        const notification = await storage.createNotification({
          type: event.type,
          actorId: event.actorId,
          targetUserId: event.targetUserId,
          contentId: event.contentId,
          message,
        });

        const deliveryTime = Date.now() - startTime;
        await storage.markNotificationDelivered(notification.id, deliveryTime);
        await storage.markEventProcessed(event.id);

        // Broadcast to connected clients
        broadcastNotification({
          ...notification,
          actor: actor.username,
          deliveryTime,
        });

        // Update metrics
        const currentMetrics = await storage.getLatestMetrics();
        if (currentMetrics) {
          await storage.updateMetrics({
            notificationsSent: (currentMetrics.notificationsSent || 0) + 1,
            avgResponseTime: Math.round(((currentMetrics.avgResponseTime || 0) + deliveryTime) / 2),
            queueSize: Math.max(0, (currentMetrics.queueSize || 0) - 1),
          });

          const updatedMetrics = await storage.getLatestMetrics();
          broadcastMetrics(updatedMetrics);
        }

      } catch (error) {
        console.error('Error processing event:', error);
      }
    }
  }

  // Process events every 2 seconds
  setInterval(processEvents, 2000);

  // API Routes

  // Get system metrics
  app.get('/api/metrics', async (req, res) => {
    try {
      const metrics = await storage.getLatestMetrics();
      res.json(metrics);
    } catch (error) {
      res.status(500).json({ error: 'Failed to get metrics' });
    }
  });

  // Get notifications
  app.get('/api/notifications', async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const notifications = await storage.getAllNotifications(limit);
      
      // Enrich with actor usernames
      const enrichedNotifications = await Promise.all(
        notifications.map(async (notification) => {
          const actor = await storage.getUser(notification.actorId);
          return {
            ...notification,
            actor: actor?.username || 'Unknown User'
          };
        })
      );

      res.json(enrichedNotifications);
    } catch (error) {
      res.status(500).json({ error: 'Failed to get notifications' });
    }
  });

  // Create event (trigger notification)
  app.post('/api/events', async (req, res) => {
    try {
      const eventData = insertEventSchema.parse(req.body);
      const event = await storage.createEvent(eventData);

      // Update queue size immediately
      const currentMetrics = await storage.getLatestMetrics();
      if (currentMetrics) {
        await storage.updateMetrics({
          queueSize: (currentMetrics.queueSize || 0) + 1,
        });
      }

      res.json({ success: true, event });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: 'Invalid event data', details: error.errors });
      } else {
        res.status(500).json({ error: 'Failed to create event' });
      }
    }
  });

  // Get users for testing
  app.get('/api/users', async (req, res) => {
    try {
      // Return first few users for testing
      const users = [];
      for (let i = 1; i <= 4; i++) {
        const user = await storage.getUser(i);
        if (user) {
          users.push({ id: user.id, username: user.username });
        }
      }
      res.json(users);
    } catch (error) {
      res.status(500).json({ error: 'Failed to get users' });
    }
  });

  // Update metrics periodically with realistic fluctuations
  setInterval(async () => {
    const currentMetrics = await storage.getLatestMetrics();
    if (currentMetrics) {
      const variation = Math.floor(Math.random() * 20) - 10;
      await storage.updateMetrics({
        activeUsers: Math.max(10000, (currentMetrics.activeUsers || 10247) + variation),
      });
    }
  }, 10000);

  return httpServer;
}

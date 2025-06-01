import { 
  users, 
  notifications, 
  events, 
  systemMetrics,
  type User, 
  type InsertUser, 
  type Notification, 
  type InsertNotification,
  type Event,
  type InsertEvent,
  type SystemMetrics
} from "@shared/schema";
import { db } from "./db";
import { eq, desc } from "drizzle-orm";

export interface IStorage {
  // User methods
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Notification methods
  createNotification(notification: InsertNotification): Promise<Notification>;
  getNotificationsByUser(userId: number, limit?: number): Promise<Notification[]>;
  getAllNotifications(limit?: number): Promise<Notification[]>;
  markNotificationDelivered(id: number, deliveryTime: number): Promise<void>;
  
  // Event methods
  createEvent(event: InsertEvent): Promise<Event>;
  getUnprocessedEvents(): Promise<Event[]>;
  markEventProcessed(id: number): Promise<void>;
  
  // Metrics methods
  getLatestMetrics(): Promise<SystemMetrics | undefined>;
  updateMetrics(metrics: Partial<SystemMetrics>): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }

  async createNotification(insertNotification: InsertNotification): Promise<Notification> {
    const [notification] = await db
      .insert(notifications)
      .values({
        ...insertNotification,
        contentId: insertNotification.contentId || null,
      })
      .returning();
    return notification;
  }

  async getNotificationsByUser(userId: number, limit: number = 50): Promise<Notification[]> {
    return await db
      .select()
      .from(notifications)
      .where(eq(notifications.targetUserId, userId))
      .orderBy(desc(notifications.createdAt))
      .limit(limit);
  }

  async getAllNotifications(limit: number = 50): Promise<Notification[]> {
    return await db
      .select()
      .from(notifications)
      .orderBy(desc(notifications.createdAt))
      .limit(limit);
  }

  async markNotificationDelivered(id: number, deliveryTime: number): Promise<void> {
    await db
      .update(notifications)
      .set({ 
        delivered: true, 
        deliveryTime: deliveryTime 
      })
      .where(eq(notifications.id, id));
  }

  async createEvent(insertEvent: InsertEvent): Promise<Event> {
    const [event] = await db
      .insert(events)
      .values({
        ...insertEvent,
        contentId: insertEvent.contentId || null,
      })
      .returning();
    return event;
  }

  async getUnprocessedEvents(): Promise<Event[]> {
    return await db
      .select()
      .from(events)
      .where(eq(events.processed, false))
      .orderBy(events.createdAt);
  }

  async markEventProcessed(id: number): Promise<void> {
    await db
      .update(events)
      .set({ processed: true })
      .where(eq(events.id, id));
  }

  async getLatestMetrics(): Promise<SystemMetrics | undefined> {
    const [metrics] = await db
      .select()
      .from(systemMetrics)
      .orderBy(desc(systemMetrics.timestamp))
      .limit(1);
    return metrics || undefined;
  }

  async updateMetrics(updates: Partial<SystemMetrics>): Promise<void> {
    const currentMetrics = await this.getLatestMetrics();
    
    if (currentMetrics) {
      await db
        .update(systemMetrics)
        .set({
          ...updates,
          timestamp: new Date(),
        })
        .where(eq(systemMetrics.id, currentMetrics.id));
    } else {
      await db
        .insert(systemMetrics)
        .values({
          activeUsers: updates.activeUsers || 10247,
          notificationsSent: updates.notificationsSent || 156429,
          avgResponseTime: updates.avgResponseTime || 23,
          errorRate: updates.errorRate || "0.03%",
          queueSize: updates.queueSize || 42,
          timestamp: new Date(),
        });
    }
  }
}

export const storage = new DatabaseStorage();

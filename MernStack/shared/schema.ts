import { pgTable, text, serial, integer, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  type: text("type").notNull(), // 'like', 'comment', 'share', 'follow'
  actorId: integer("actor_id").notNull(),
  targetUserId: integer("target_user_id").notNull(),
  contentId: text("content_id"), // post_id, comment_id, etc.
  message: text("message").notNull(),
  delivered: boolean("delivered").default(false),
  deliveryTime: integer("delivery_time"), // milliseconds
  createdAt: timestamp("created_at").defaultNow(),
});

export const events = pgTable("events", {
  id: serial("id").primaryKey(),
  type: text("type").notNull(),
  actorId: integer("actor_id").notNull(),
  targetUserId: integer("target_user_id").notNull(),
  contentId: text("content_id"),
  processed: boolean("processed").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const systemMetrics = pgTable("system_metrics", {
  id: serial("id").primaryKey(),
  activeUsers: integer("active_users").default(0),
  notificationsSent: integer("notifications_sent").default(0),
  avgResponseTime: integer("avg_response_time").default(0),
  errorRate: text("error_rate").default("0.00%"),
  queueSize: integer("queue_size").default(0),
  timestamp: timestamp("timestamp").defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export const insertNotificationSchema = createInsertSchema(notifications).omit({
  id: true,
  delivered: true,
  deliveryTime: true,
  createdAt: true,
});

export const insertEventSchema = createInsertSchema(events).omit({
  id: true,
  processed: true,
  createdAt: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type Event = typeof events.$inferSelect;
export type InsertEvent = z.infer<typeof insertEventSchema>;
export type SystemMetrics = typeof systemMetrics.$inferSelect;

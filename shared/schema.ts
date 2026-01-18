import { pgTable, text, serial, integer, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Sessions table - for email verification and login
export const sessions = pgTable("sessions", {
  id: serial("id").primaryKey(),
  email: text("email").notNull(),
  code: text("code"), // 6-digit verification code
  sessionToken: text("session_token"), // UUID token after verification
  codeExpiresAt: timestamp("code_expires_at"),
  sessionExpiresAt: timestamp("session_expires_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertSessionSchema = createInsertSchema(sessions).omit({
  id: true,
  createdAt: true,
});
export type InsertSession = z.infer<typeof insertSessionSchema>;
export type Session = typeof sessions.$inferSelect;

// Votes table - vote submissions
export const votes = pgTable("votes", {
  id: serial("id").primaryKey(),
  email: text("email").notNull(),
  city: text("city").notNull(),
  votesClaimed: integer("votes_claimed").notNull(),
  paymentMethod: text("payment_method").notNull(), // CashApp, Venmo, SOL, ETH, BTC
  amountDue: integer("amount_due").notNull(), // in cents
  status: text("status").notNull().default("pending"), // pending, approved, rejected
  uploadToken: text("upload_token"), // unique token for upload link
  screenshotUrl: text("screenshot_url"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  approvedAt: timestamp("approved_at"),
});

export const insertVoteSchema = createInsertSchema(votes).omit({
  id: true,
  createdAt: true,
  approvedAt: true,
});
export type InsertVote = z.infer<typeof insertVoteSchema>;
export type Vote = typeof votes.$inferSelect;

// Payment methods enum
export const paymentMethods = ["CashApp", "Venmo", "SOL", "ETH", "BTC"] as const;
export type PaymentMethod = typeof paymentMethods[number];

// Leaderboard schemas (from external API - kept for backward compatibility)
export const leaderboardEntrySchema = z.object({
  rank: z.number(),
  city: z.string(),
  votes: z.number(),
});

export type LeaderboardEntry = z.infer<typeof leaderboardEntrySchema>;

export const leaderboardResponseSchema = z.object({
  entries: z.array(leaderboardEntrySchema),
  lastUpdated: z.string(),
});

export type LeaderboardResponse = z.infer<typeof leaderboardResponseSchema>;

// API request/response schemas
export const requestCodeSchema = z.object({
  email: z.string().email(),
});

export const verifyCodeSchema = z.object({
  email: z.string().email(),
  code: z.string().length(6),
});

export const submitVoteSchema = z.object({
  sessionToken: z.string(),
  city: z.string().min(1),
  votesClaimed: z.number().int().min(1),
  paymentMethod: z.enum(paymentMethods),
});

export const uploadScreenshotSchema = z.object({
  token: z.string(),
  screenshot: z.string(), // base64 data URL
});

// Admin sessions table - persisted across server restarts
export const adminSessions = pgTable("admin_sessions", {
  id: serial("id").primaryKey(),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertAdminSessionSchema = createInsertSchema(adminSessions).omit({
  id: true,
  createdAt: true,
});
export type InsertAdminSession = z.infer<typeof insertAdminSessionSchema>;
export type AdminSession = typeof adminSessions.$inferSelect;

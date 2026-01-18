// Database storage implementation using Drizzle ORM
import { sessions, votes, adminSessions, type Session, type InsertSession, type Vote, type InsertVote, type AdminSession, type InsertAdminSession } from "@shared/schema";
import { db } from "./db";
import { eq, and, gt, lt, sql } from "drizzle-orm";

export interface IStorage {
  // Session management
  createSession(data: InsertSession): Promise<Session>;
  getSessionByEmail(email: string): Promise<Session | undefined>;
  getSessionByToken(token: string): Promise<Session | undefined>;
  updateSession(id: number, data: Partial<InsertSession>): Promise<Session | undefined>;
  
  // Vote management
  createVote(data: InsertVote): Promise<Vote>;
  getVoteByUploadToken(token: string): Promise<Vote | undefined>;
  updateVote(id: number, data: Partial<InsertVote>): Promise<Vote | undefined>;
  getApprovedVotesByCity(): Promise<Array<{ city: string; votes: number }>>;
  getVotesByEmail(email: string): Promise<Vote[]>;
  getAllVotes(): Promise<Vote[]>;
  
  // Admin session management
  createAdminSession(data: InsertAdminSession): Promise<AdminSession>;
  getAdminSession(token: string): Promise<AdminSession | undefined>;
  deleteAdminSession(token: string): Promise<void>;
  cleanExpiredAdminSessions(): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  // Session methods
  async createSession(data: InsertSession): Promise<Session> {
    const [session] = await db.insert(sessions).values(data).returning();
    return session;
  }

  async getSessionByEmail(email: string): Promise<Session | undefined> {
    const [session] = await db
      .select()
      .from(sessions)
      .where(eq(sessions.email, email.toLowerCase()))
      .orderBy(sql`${sessions.createdAt} DESC`)
      .limit(1);
    return session;
  }

  async getSessionByToken(token: string): Promise<Session | undefined> {
    const [session] = await db
      .select()
      .from(sessions)
      .where(
        and(
          eq(sessions.sessionToken, token),
          gt(sessions.sessionExpiresAt, new Date())
        )
      );
    return session;
  }

  async updateSession(id: number, data: Partial<InsertSession>): Promise<Session | undefined> {
    const [session] = await db
      .update(sessions)
      .set(data)
      .where(eq(sessions.id, id))
      .returning();
    return session;
  }

  // Vote methods
  async createVote(data: InsertVote): Promise<Vote> {
    const [vote] = await db.insert(votes).values(data).returning();
    return vote;
  }

  async getVoteByUploadToken(token: string): Promise<Vote | undefined> {
    const [vote] = await db
      .select()
      .from(votes)
      .where(eq(votes.uploadToken, token));
    return vote;
  }

  async updateVote(id: number, data: Partial<InsertVote>): Promise<Vote | undefined> {
    const [vote] = await db
      .update(votes)
      .set(data)
      .where(eq(votes.id, id))
      .returning();
    return vote;
  }

  async getApprovedVotesByCity(): Promise<Array<{ city: string; votes: number }>> {
    const results = await db
      .select({
        city: votes.city,
        votes: sql<number>`SUM(${votes.votesClaimed})::int`,
      })
      .from(votes)
      .where(eq(votes.status, "approved"))
      .groupBy(votes.city)
      .orderBy(sql`SUM(${votes.votesClaimed}) DESC`);
    
    return results;
  }

  async getVotesByEmail(email: string): Promise<Vote[]> {
    return db
      .select()
      .from(votes)
      .where(eq(votes.email, email.toLowerCase()));
  }

  private isTransientError(error: any): boolean {
    const code = error?.code || error?.cause?.code;
    const msg = String(error?.message || "").toLowerCase();
    
    return (
      code === "57P01" ||
      code === "ECONNRESET" ||
      code === "ETIMEDOUT" ||
      code === "EPIPE" ||
      msg.includes("socket hang up") ||
      msg.includes("connection terminated") ||
      msg.includes("timeout") ||
      msg.includes("connection reset")
    );
  }

  async getAllVotes(): Promise<Vote[]> {
    const maxRetries = 3;
    let lastError: any;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`DatabaseStorage.getAllVotes: Attempt ${attempt}/${maxRetries}...`);
        const result = await db.select().from(votes);
        console.log("DatabaseStorage.getAllVotes: Got", result.length, "rows");
        return result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      } catch (error: any) {
        lastError = error;
        console.error(`DatabaseStorage.getAllVotes error (attempt ${attempt}):`, {
          code: error?.code,
          message: error?.message
        });
        
        if (this.isTransientError(error) && attempt < maxRetries) {
          console.log("Retrying after transient error...");
          await new Promise(r => setTimeout(r, 300 * attempt));
          continue;
        }
        break;
      }
    }
    
    throw lastError;
  }

  // Admin session methods
  async createAdminSession(data: InsertAdminSession): Promise<AdminSession> {
    const [session] = await db.insert(adminSessions).values(data).returning();
    return session;
  }

  async getAdminSession(token: string): Promise<AdminSession | undefined> {
    const maxRetries = 3;
    let lastError: any;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`DatabaseStorage.getAdminSession: Attempt ${attempt}/${maxRetries}...`);
        const [session] = await db
          .select()
          .from(adminSessions)
          .where(and(
            eq(adminSessions.token, token),
            gt(adminSessions.expiresAt, new Date())
          ));
        return session;
      } catch (error: any) {
        lastError = error;
        console.error(`getAdminSession error (attempt ${attempt}):`, {
          code: error?.code,
          message: error?.message
        });

        if (this.isTransientError(error) && attempt < maxRetries) {
          await new Promise(r => setTimeout(r, 300 * attempt));
          continue;
        }
        throw error;
      }
    }

    throw lastError;
  }

  async deleteAdminSession(token: string): Promise<void> {
    await db.delete(adminSessions).where(eq(adminSessions.token, token));
  }

  async cleanExpiredAdminSessions(): Promise<void> {
    await db.delete(adminSessions).where(lt(adminSessions.expiresAt, new Date()));
  }
}

export const storage = new DatabaseStorage();

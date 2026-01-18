import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { randomBytes, randomUUID, createHash } from "crypto";
import type { LeaderboardEntry, LeaderboardResponse } from "@shared/schema";
import { requestCodeSchema, verifyCodeSchema, submitVoteSchema, uploadScreenshotSchema } from "@shared/schema";
import { storage } from "./storage";
import { sendVerificationEmail, sendVoteApprovedEmail, sendAdminNotification } from "./resend";

// Admin session verification using database storage
async function verifyAdminAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    console.log("Auth header received:", authHeader ? `Bearer ${authHeader.slice(7, 15)}...` : "none");
    
    if (!authHeader?.startsWith("Bearer ")) {
      console.log("Auth failed: No Bearer token");
      return res.status(401).json({ error: "Unauthorized" });
    }
    
    const token = authHeader.slice(7);
    console.log("Looking up session for token:", token.slice(0, 8) + "...");
    const session = await storage.getAdminSession(token);
    console.log("Session lookup result:", session ? "found" : "not found");
    
    if (!session) {
      return res.status(401).json({ error: "Invalid or expired admin session" });
    }
    
    console.log("Auth successful, proceeding to next handler");
    next();
  } catch (error: any) {
    console.error("Admin auth verification error:", error?.message || error);
    console.error("Error stack:", error?.stack);
    return res.status(500).json({ error: "Auth verification failed", details: error?.message });
  }
}

const CITY_STANDARDIZATION: Record<string, string> = {
  "wichita": "Wichita, KS",
  "miami": "Miami, FL",
  "miami, fl": "Miami, FL",
  "chicago": "Chicago, IL",
  "chicago, il": "Chicago, IL",
  "new york": "New York, NY",
  "new york, ny": "New York, NY",
  "los angeles": "Los Angeles, CA",
  "los angeles, ca": "Los Angeles, CA",
  "san francisco": "San Francisco, CA",
  "san francisco, ca": "San Francisco, CA",
  "houston": "Houston, TX",
  "houston, tx": "Houston, TX",
  "phoenix": "Phoenix, AZ",
  "phoenix, az": "Phoenix, AZ",
  "philadelphia": "Philadelphia, PA",
  "philadelphia, pa": "Philadelphia, PA",
  "san antonio": "San Antonio, TX",
  "san antonio, tx": "San Antonio, TX",
  "san diego": "San Diego, CA",
  "san diego, ca": "San Diego, CA",
  "dallas": "Dallas, TX",
  "dallas, tx": "Dallas, TX",
  "austin": "Austin, TX",
  "austin, tx": "Austin, TX",
  "denver": "Denver, CO",
  "denver, co": "Denver, CO",
  "seattle": "Seattle, WA",
  "seattle, wa": "Seattle, WA",
  "boston": "Boston, MA",
  "boston, ma": "Boston, MA",
  "atlanta": "Atlanta, GA",
  "atlanta, ga": "Atlanta, GA",
  "portland": "Portland, OR",
  "portland, or": "Portland, OR",
  "las vegas": "Las Vegas, NV",
  "las vegas, nv": "Las Vegas, NV",
  "detroit": "Detroit, MI",
  "detroit, mi": "Detroit, MI",
  "minneapolis": "Minneapolis, MN",
  "minneapolis, mn": "Minneapolis, MN",
  "tampa": "Tampa, FL",
  "tampa, fl": "Tampa, FL",
  "orlando": "Orlando, FL",
  "orlando, fl": "Orlando, FL",
  "sacramento": "Sacramento, CA",
  "sacramento, ca": "Sacramento, CA",
  "fresno": "Fresno, CA",
  "fresno, ca": "Fresno, CA",
  "san jose": "San Jose, CA",
  "san jose, ca": "San Jose, CA",
  "oakland": "Oakland, CA",
  "oakland, ca": "Oakland, CA",
  "long beach": "Long Beach, CA",
  "long beach, ca": "Long Beach, CA",
  "bakersfield": "Bakersfield, CA",
  "bakersfield, ca": "Bakersfield, CA",
  "anaheim": "Anaheim, CA",
  "anaheim, ca": "Anaheim, CA",
};

// Map full state names to abbreviations
const STATE_ABBREVIATIONS: Record<string, string> = {
  "alabama": "AL", "alaska": "AK", "arizona": "AZ", "arkansas": "AR",
  "california": "CA", "colorado": "CO", "connecticut": "CT", "delaware": "DE",
  "florida": "FL", "georgia": "GA", "hawaii": "HI", "idaho": "ID",
  "illinois": "IL", "indiana": "IN", "iowa": "IA", "kansas": "KS",
  "kentucky": "KY", "louisiana": "LA", "maine": "ME", "maryland": "MD",
  "massachusetts": "MA", "michigan": "MI", "minnesota": "MN", "mississippi": "MS",
  "missouri": "MO", "montana": "MT", "nebraska": "NE", "nevada": "NV",
  "new hampshire": "NH", "new jersey": "NJ", "new mexico": "NM", "new york": "NY",
  "north carolina": "NC", "north dakota": "ND", "ohio": "OH", "oklahoma": "OK",
  "oregon": "OR", "pennsylvania": "PA", "rhode island": "RI", "south carolina": "SC",
  "south dakota": "SD", "tennessee": "TN", "texas": "TX", "utah": "UT",
  "vermont": "VT", "virginia": "VA", "washington": "WA", "west virginia": "WV",
  "wisconsin": "WI", "wyoming": "WY", "district of columbia": "DC"
};

function standardizeCity(city: string): string {
  // Replace periods with commas and normalize
  const cleaned = city.replace(/\./g, ",").toLowerCase().trim();
  
  if (CITY_STANDARDIZATION[cleaned]) {
    return CITY_STANDARDIZATION[cleaned];
  }
  
  // Try splitting by comma
  const parts = cleaned.split(",").map(p => p.trim()).filter(p => p.length > 0);
  if (parts.length >= 2) {
    const cityPart = parts[0];
    let statePart = parts[1];
    
    // Convert full state name to abbreviation if needed
    if (STATE_ABBREVIATIONS[statePart]) {
      statePart = STATE_ABBREVIATIONS[statePart];
    } else {
      statePart = statePart.toUpperCase();
      // If it's longer than 2 chars, try to find abbreviation
      if (statePart.length > 2) {
        const abbrev = STATE_ABBREVIATIONS[parts[1]];
        if (abbrev) statePart = abbrev;
      }
    }
    
    // Capitalize city name properly
    const capitalizedCity = cityPart
      .split(" ")
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
    
    return `${capitalizedCity}, ${statePart}`;
  }
  
  // Fallback: just capitalize each word
  return city
    .split(" ")
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

const VOTE_PRICE_USD = 5; // $5 per vote

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  // Request verification code
  app.post("/api/auth/request-code", async (req, res) => {
    try {
      const parsed = requestCodeSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid email address" });
      }
      
      const email = parsed.data.email.toLowerCase().trim();
      const code = generateCode();
      const codeExpiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
      
      // Check if session exists for this email
      const existingSession = await storage.getSessionByEmail(email);
      
      if (existingSession) {
        // Update existing session with new code
        await storage.updateSession(existingSession.id, {
          code,
          codeExpiresAt,
        });
      } else {
        // Create new session
        await storage.createSession({
          email,
          code,
          codeExpiresAt,
        });
      }
      
      // Send verification email
      const sent = await sendVerificationEmail(email, code);
      if (!sent) {
        return res.status(500).json({ error: "Failed to send verification email" });
      }
      
      res.json({ ok: true, message: "Verification code sent" });
    } catch (error) {
      console.error("Request code error:", error);
      res.status(500).json({ error: "Failed to send verification code" });
    }
  });
  
  // Verify code and create session
  app.post("/api/auth/verify-code", async (req, res) => {
    try {
      const parsed = verifyCodeSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid request" });
      }
      
      const { email, code } = parsed.data;
      const normalizedEmail = email.toLowerCase().trim();
      
      const session = await storage.getSessionByEmail(normalizedEmail);
      
      if (!session) {
        return res.status(400).json({ error: "No verification code found. Please request a new one." });
      }
      
      if (session.code !== code) {
        return res.status(400).json({ error: "Invalid verification code" });
      }
      
      if (session.codeExpiresAt && new Date(session.codeExpiresAt) < new Date()) {
        return res.status(400).json({ error: "Verification code expired. Please request a new one." });
      }
      
      // Generate session token
      const sessionToken = randomUUID();
      const sessionExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
      
      await storage.updateSession(session.id, {
        sessionToken,
        sessionExpiresAt,
        code: null, // Clear the code
      });
      
      res.json({
        ok: true,
        sessionToken,
        email: normalizedEmail,
        expiresAt: sessionExpiresAt.toISOString(),
      });
    } catch (error) {
      console.error("Verify code error:", error);
      res.status(500).json({ error: "Verification failed" });
    }
  });
  
  // Submit vote
  app.post("/api/votes/submit", async (req, res) => {
    try {
      const parsed = submitVoteSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid vote data" });
      }
      
      const { sessionToken, city, votesClaimed, paymentMethod } = parsed.data;
      
      // Verify session
      const session = await storage.getSessionByToken(sessionToken);
      if (!session) {
        return res.status(401).json({ error: "Invalid or expired session. Please log in again." });
      }
      
      // Standardize city name
      const standardizedCity = standardizeCity(city);
      
      // Calculate amount
      const amountDue = votesClaimed * VOTE_PRICE_USD * 100; // in cents
      
      // Generate upload token
      const uploadToken = randomBytes(16).toString("hex");
      
      // Create vote record
      const vote = await storage.createVote({
        email: session.email,
        city: standardizedCity,
        votesClaimed,
        paymentMethod,
        amountDue,
        status: "pending",
        uploadToken,
      });
      
      res.json({
        ok: true,
        voteId: vote.id,
        city: standardizedCity,
        votesClaimed,
        amountDue: amountDue / 100, // return in dollars
        paymentMethod,
        uploadToken,
      });
    } catch (error) {
      console.error("Submit vote error:", error);
      res.status(500).json({ error: "Failed to submit vote" });
    }
  });
  
  // Get vote by upload token (for checkout page)
  app.get("/api/votes/by-token/:token", async (req, res) => {
    try {
      const { token } = req.params;
      const vote = await storage.getVoteByUploadToken(token);
      
      if (!vote) {
        return res.status(404).json({ error: "Vote not found" });
      }
      
      res.json({
        id: vote.id,
        city: vote.city,
        votesClaimed: vote.votesClaimed,
        amountDue: vote.amountDue / 100,
        paymentMethod: vote.paymentMethod,
        status: vote.status,
        hasScreenshot: !!vote.screenshotUrl,
      });
    } catch (error) {
      console.error("Get vote error:", error);
      res.status(500).json({ error: "Failed to get vote" });
    }
  });
  
  // Upload screenshot
  app.post("/api/votes/upload-screenshot", async (req, res) => {
    try {
      const parsed = uploadScreenshotSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid upload data" });
      }
      
      const { token, screenshot } = parsed.data;
      
      const vote = await storage.getVoteByUploadToken(token);
      if (!vote) {
        return res.status(404).json({ error: "Invalid upload token" });
      }
      
      if (vote.screenshotUrl) {
        return res.status(400).json({ error: "Screenshot already uploaded" });
      }
      
      // Store the base64 screenshot directly (in production, you'd upload to cloud storage)
      await storage.updateVote(vote.id, {
        screenshotUrl: screenshot,
        status: "pending", // stays pending until manually approved
      });
      
      // Send admin notification email
      sendAdminNotification(vote.city, vote.email, vote.votesClaimed).catch(err => {
        console.error("Failed to send admin notification:", err);
      });
      
      res.json({
        ok: true,
        message: "Screenshot uploaded successfully. Your votes will be counted once verified.",
      });
    } catch (error) {
      console.error("Upload screenshot error:", error);
      res.status(500).json({ error: "Failed to upload screenshot" });
    }
  });
  
  // Get leaderboard (from database - approved votes only)
  app.get("/api/leaderboard", async (req, res) => {
    try {
      const cityVotes = await storage.getApprovedVotesByCity();
      
      const entries: LeaderboardEntry[] = cityVotes.map((cv, index) => ({
        rank: index + 1,
        city: cv.city,
        votes: cv.votes,
      }));
      
      // If no approved votes yet, show placeholder message
      if (entries.length === 0) {
        // Return empty but valid response
        return res.json({
          entries: [],
          lastUpdated: new Date().toISOString(),
          message: "No approved votes yet. Be the first to vote!",
        });
      }
      
      res.json({
        entries,
        lastUpdated: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Leaderboard error:", error);
      res.status(500).json({ error: "Failed to fetch leaderboard" });
    }
  });
  
  // Admin: Login
  app.post("/api/admin/login", async (req, res) => {
    try {
      const { password } = req.body;
      const adminPassword = process.env.ADMIN_PASSWORD;
      
      if (!adminPassword) {
        console.error("ADMIN_PASSWORD not configured");
        return res.status(500).json({ error: "Admin access not configured" });
      }
      
      if (password !== adminPassword) {
        return res.status(401).json({ error: "Invalid password" });
      }
      
      // Generate admin session token and store in database
      const token = randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
      
      await storage.createAdminSession({ token, expiresAt });
      
      // Clean up expired sessions periodically
      storage.cleanExpiredAdminSessions().catch(console.error);
      
      res.json({ ok: true, token });
    } catch (error) {
      console.error("Admin login error:", error);
      res.status(500).json({ error: "Login failed" });
    }
  });
  
  // Admin: Verify session
  app.get("/api/admin/verify", verifyAdminAuth, (req, res) => {
    res.json({ ok: true });
  });
  
  // Debug: Simple database test (temporary)
  app.get("/api/health/db", async (req, res) => {
    try {
      const { pool } = await import("./db");
      const result = await pool.query('SELECT COUNT(*) as count FROM votes');
      const sessions = await pool.query('SELECT COUNT(*) as count FROM admin_sessions');
      res.json({ 
        ok: true, 
        votesCount: result.rows[0]?.count,
        sessionsCount: sessions.rows[0]?.count,
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      res.status(500).json({ 
        ok: false, 
        error: error?.message || "Unknown error",
        code: error?.code
      });
    }
  });
  
  // Debug: Test admin votes without auth (temporary - remove after debugging)
  app.get("/api/health/votes", async (req, res) => {
    try {
      const votes = await storage.getAllVotes();
      res.json({ 
        ok: true, 
        count: votes.length,
        votes: votes.map(v => ({ id: v.id, city: v.city, status: v.status }))
      });
    } catch (error: any) {
      res.status(500).json({ 
        ok: false, 
        error: error?.message || "Unknown error"
      });
    }
  });
  
  // Debug: Test admin session lookup (temporary)
  app.get("/api/health/session/:token", async (req, res) => {
    try {
      const token = req.params.token;
      const session = await storage.getAdminSession(token);
      res.json({ 
        ok: true, 
        found: !!session,
        expiresAt: session?.expiresAt
      });
    } catch (error: any) {
      res.status(500).json({ 
        ok: false, 
        error: error?.message || "Unknown error"
      });
    }
  });
  
  // Debug: Echo headers (temporary)
  app.get("/api/health/headers", (req, res) => {
    res.json({
      authorization: req.headers.authorization || "none",
      hasBearer: req.headers.authorization?.startsWith("Bearer ") || false
    });
  });

  // Admin: List all votes (protected)
  app.get("/api/admin/votes", verifyAdminAuth, async (req, res) => {
    try {
      console.log("Fetching all votes...");
      const votes = await storage.getAllVotes();
      console.log(`Found ${votes.length} votes`);
      res.json(votes);
    } catch (error: any) {
      console.error("List votes error:", error?.message || error);
      console.error("Full error:", JSON.stringify(error, null, 2));
      res.status(500).json({ error: "Failed to list votes", details: error?.message });
    }
  });
  
  // Admin: Approve vote (protected)
  app.post("/api/admin/approve-vote/:id", verifyAdminAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid vote ID" });
      }
      
      const vote = await storage.updateVote(id, {
        status: "approved",
      });
      
      if (!vote) {
        return res.status(404).json({ error: "Vote not found" });
      }
      
      // Send thank you email (don't block on it)
      sendVoteApprovedEmail(vote.email, vote.city, vote.votesClaimed).catch(err => {
        console.error("Failed to send approval email:", err);
      });
      
      res.json({ ok: true, vote });
    } catch (error) {
      console.error("Approve vote error:", error);
      res.status(500).json({ error: "Failed to approve vote" });
    }
  });
  
  // Admin: Reject vote (protected)
  app.post("/api/admin/reject-vote/:id", verifyAdminAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid vote ID" });
      }
      
      const vote = await storage.updateVote(id, {
        status: "rejected",
      });
      
      if (!vote) {
        return res.status(404).json({ error: "Vote not found" });
      }
      
      res.json({ ok: true, vote });
    } catch (error) {
      console.error("Reject vote error:", error);
      res.status(500).json({ error: "Failed to reject vote" });
    }
  });
  
  // Admin: Normalize all city names (one-time fix)
  app.post("/api/admin/normalize-cities", verifyAdminAuth, async (req, res) => {
    try {
      const allVotes = await storage.getAllVotes();
      let updated = 0;
      
      for (const vote of allVotes) {
        const standardized = standardizeCity(vote.city);
        if (standardized !== vote.city) {
          await storage.updateVote(vote.id, { city: standardized });
          updated++;
          console.log(`Normalized: "${vote.city}" -> "${standardized}"`);
        }
      }
      
      res.json({ ok: true, updated, total: allVotes.length });
    } catch (error) {
      console.error("Normalize cities error:", error);
      res.status(500).json({ error: "Failed to normalize cities" });
    }
  });
  
  // Admin: Manually send thank you email
  app.post("/api/admin/send-thanks/:id", verifyAdminAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid vote ID" });
      }
      
      const votes = await storage.getAllVotes();
      const vote = votes.find(v => v.id === id);
      
      if (!vote) {
        return res.status(404).json({ error: "Vote not found" });
      }
      
      const sent = await sendVoteApprovedEmail(vote.email, vote.city, vote.votesClaimed);
      
      if (!sent) {
        return res.status(500).json({ error: "Failed to send email" });
      }
      
      res.json({ ok: true, email: vote.email });
    } catch (error) {
      console.error("Send thanks error:", error);
      res.status(500).json({ error: "Failed to send thank you email" });
    }
  });
  
  // Validate session
  app.get("/api/auth/validate", async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader?.startsWith("Bearer ")) {
        return res.status(401).json({ valid: false });
      }
      
      const token = authHeader.slice(7);
      const session = await storage.getSessionByToken(token);
      
      if (!session) {
        return res.status(401).json({ valid: false });
      }
      
      res.json({
        valid: true,
        email: session.email,
        expiresAt: session.sessionExpiresAt?.toISOString(),
      });
    } catch (error) {
      res.status(401).json({ valid: false });
    }
  });

  return httpServer;
}

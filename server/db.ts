import { drizzle } from "drizzle-orm/neon-serverless";
import { Pool, neonConfig } from "@neondatabase/serverless";
import ws from "ws";
import * as schema from "@shared/schema";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Configure WebSocket for Neon serverless driver
// This is required for the connection to work properly in serverless environments
neonConfig.webSocketConstructor = ws;

// Create pool with Neon's serverless driver
// This handles connection management automatically and prevents 57P01 errors
export const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
});

// Prevent "Unhandled 'error' event" crashes when Neon drops a connection (57P01 etc.)
pool.on("error", (err: any) => {
  console.error("Postgres pool error (idle client):", {
    message: err?.message,
    code: err?.code,
    severity: err?.severity,
  });
  // Do NOT throw — letting this bubble will crash the process.
});

// Test connection on startup
pool.query('SELECT 1').then(() => {
  console.log('Database connection successful (Neon serverless driver)');
}).catch((err: any) => {
  console.error('Database connection test failed:', err?.message);
});

export const db = drizzle(pool, { schema });

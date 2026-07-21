import mongoose from "mongoose";
import { env } from "./env";
import { logger } from "./logger";

/*
 * MongoDB connection (spec Part 1). Connecting is best-effort at boot: if the
 * database is unreachable the server still starts in a degraded mode so the
 * health endpoint can report it, rather than crash-looping. Data endpoints will
 * surface a clear 503 until the connection is up.
 */

let connected = false;

mongoose.set("strictQuery", true);

export async function connectDb(): Promise<boolean> {
  try {
    await mongoose.connect(env.MONGO_URI, {
      serverSelectionTimeoutMS: 4000,
      maxPoolSize: 20,
    });
    connected = true;
    logger.info("MongoDB connected");
  } catch (err) {
    connected = false;
    logger.warn("MongoDB unavailable — starting in degraded mode", { error: (err as Error).message });
  }

  mongoose.connection.on("disconnected", () => {
    connected = false;
    logger.warn("MongoDB disconnected");
  });
  mongoose.connection.on("reconnected", () => {
    connected = true;
    logger.info("MongoDB reconnected");
  });

  return connected;
}

export function isDbConnected(): boolean {
  return mongoose.connection.readyState === 1;
}

export async function disconnectDb(): Promise<void> {
  await mongoose.connection.close();
  connected = false;
}

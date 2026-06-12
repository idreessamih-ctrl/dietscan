import Redis from "ioredis";
import { config } from "../config";

export const valkey = new Redis(config.VALKEY_URL, {
  retryStrategy(times) {
    // Retry connection after a delay, up to 2000ms
    const delay = Math.min(times * 100, 2000);
    return delay;
  },
  // Ensure we don't abort immediately on connection issues
  maxRetriesPerRequest: null,
});

valkey.on("error", (error: Error) => {
  console.error("Valkey client error:", error);
});

valkey.on("connect", () => {
  console.log("Valkey client connected successfully.");
});

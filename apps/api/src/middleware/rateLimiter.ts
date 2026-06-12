import rateLimit from "express-rate-limit";
import { RedisStore, RedisReply } from "rate-limit-redis";
import { valkey } from "../lib/valkey";

// Create redis store using the Valkey client
const store = new RedisStore({
  sendCommand: async (...args: string[]) => {
    const result = await valkey.call(args[0], ...args.slice(1));
    return result as RedisReply;
  },
});

// Default: 100 requests per 15 minutes
export const defaultLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 100,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  store,
  message: {
    message: "Too many requests from this IP, please try again after 15 minutes.",
  },
});

// Auth endpoints: 20 requests per 15 minutes
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  store,
  message: {
    message: "Too many authentication requests, please try again after 15 minutes.",
  },
});

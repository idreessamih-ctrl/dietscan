import rateLimit from "express-rate-limit";
import { RedisStore, RedisReply } from "rate-limit-redis";
import { valkey } from "../lib/valkey";

// Helper to create redis store using the Valkey client
const createStore = (prefix: string) => {
  if (process.env.NODE_ENV === "test") {
    return undefined; // Use in-memory store during tests
  }
  return new RedisStore({
    prefix,
    sendCommand: async (...args: string[]) => {
      const result = await valkey.call(args[0], ...args.slice(1));
      return result as RedisReply;
    },
  });
};

// Default: 100 requests per 15 minutes
export const defaultLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10000,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  store: createStore("rl:default:"),
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
  store: createStore("rl:auth:"),
  message: {
    message: "Too many authentication requests, please try again after 15 minutes.",
  },
});

// Products lookup: 30 requests per 1 minute
export const productsLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  store: createStore("rl:products:"),
  message: {
    message: "Too many lookup requests, please try again after a minute.",
  },
});

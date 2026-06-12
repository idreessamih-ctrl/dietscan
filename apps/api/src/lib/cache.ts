import { valkey } from "./valkey";

export async function cacheGet<T>(key: string): Promise<T | null> {
  try {
    const data = await valkey.get(key);
    if (!data) return null;
    return JSON.parse(data) as T;
  } catch (err) {
    console.error(`Cache get error for key ${key}:`, err);
    return null;
  }
}

export async function cacheSet(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
  try {
    const data = JSON.stringify(value);
    if (ttlSeconds !== undefined) {
      await valkey.set(key, data, "EX", ttlSeconds);
    } else {
      await valkey.set(key, data);
    }
  } catch (err) {
    console.error(`Cache set error for key ${key}:`, err);
  }
}

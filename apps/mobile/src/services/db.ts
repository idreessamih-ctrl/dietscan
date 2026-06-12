import * as SQLite from "expo-sqlite";
import { INGREDIENTS } from "../data/ingredients";

let dbInstance: SQLite.SQLiteDatabase | null = null;
let initPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (dbInstance) return dbInstance;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const db = await SQLite.openDatabaseAsync("dietscan.db");
    
    // Configure WAL mode and create the ingredients table
    await db.execAsync(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS ingredients (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        category TEXT NOT NULL,
        banned_by TEXT NOT NULL,
        aliases TEXT NOT NULL
      );
    `);

    // Seed the database if it is empty
    const countResult = await db.getFirstAsync<{ count: number }>(
      "SELECT COUNT(*) as count FROM ingredients"
    );

    if (!countResult || countResult.count === 0) {
      console.log("[DB] Seeding ingredients database...");
      for (const ing of INGREDIENTS) {
        await db.runAsync(
          "INSERT OR IGNORE INTO ingredients (name, category, banned_by, aliases) VALUES (?, ?, ?, ?)",
          [
            ing.name,
            ing.category,
            JSON.stringify(ing.bannedBy),
            JSON.stringify(ing.aliases),
          ]
        );
      }
      console.log("[DB] Seeding completed successfully.");
    }

    dbInstance = db;
    return db;
  })();

  return initPromise;
}

export interface DbIngredient {
  name: string;
  category: string;
  bannedBy: string[];
  aliases: string[];
}

export async function getAllDbIngredients(): Promise<DbIngredient[]> {
  try {
    const db = await getDb();
    const rows = await db.getAllAsync<{
      name: string;
      category: string;
      banned_by: string;
      aliases: string;
    }>("SELECT name, category, banned_by, aliases FROM ingredients");

    return rows.map((row) => ({
      name: row.name,
      category: row.category,
      bannedBy: JSON.parse(row.banned_by) as string[],
      aliases: JSON.parse(row.aliases) as string[],
    }));
  } catch (error) {
    console.error("[DB Error] Failed to get ingredients from SQLite:", error);
    // Fallback to in-memory ingredients if database fails
    return INGREDIENTS;
  }
}

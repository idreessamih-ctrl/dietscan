import { pgTable, uuid, varchar, text, jsonb, timestamp, index } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const dietaryProtocols = pgTable(
  "dietary_protocols",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: varchar("slug", { length: 50 }).unique().notNull(),
    name: varchar("name", { length: 100 }).notNull(),
    description: text("description"),
    rulesJson: jsonb("rules_json").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_dietary_protocols_slug").on(table.slug),
  ]
);

export const educationArticles = pgTable(
  "education_articles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: varchar("slug", { length: 100 }).unique().notNull(),
    title: varchar("title", { length: 255 }).notNull(),
    content: text("content").notNull(),
    protocolTags: text("protocol_tags").array().notNull().default(sql`ARRAY[]::text[]`),
  },
  (table) => [
    index("idx_education_articles_slug").on(table.slug),
  ]
);

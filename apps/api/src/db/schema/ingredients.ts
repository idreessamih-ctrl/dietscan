import { pgTable, uuid, varchar, jsonb } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const ingredients = pgTable("ingredients", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).unique().notNull(),
  category: varchar("category", { length: 100 }).notNull(),
  bannedBy: jsonb("banned_by").notNull().default([]),
});

export const ingredientAliases = pgTable("ingredient_aliases", {
  id: uuid("id").primaryKey().defaultRandom(),
  ingredientId: uuid("ingredient_id")
    .notNull()
    .references(() => ingredients.id, { onDelete: "cascade" }),
  alias: varchar("alias", { length: 255 }).unique().notNull(),
});

export const exclusionList = pgTable("exclusion_list", {
  id: uuid("id").primaryKey().defaultRandom(),
  phrase: varchar("phrase", { length: 255 }).unique().notNull(),
  ingredientId: uuid("ingredient_id")
    .notNull()
    .references(() => ingredients.id, { onDelete: "cascade" }),
});

export const ingredientsRelations = relations(ingredients, ({ many }) => ({
  aliases: many(ingredientAliases),
  exclusions: many(exclusionList),
}));

export const ingredientAliasesRelations = relations(ingredientAliases, ({ one }) => ({
  ingredient: one(ingredients, {
    fields: [ingredientAliases.ingredientId],
    references: [ingredients.id],
  }),
}));

export const exclusionListRelations = relations(exclusionList, ({ one }) => ({
  ingredient: one(ingredients, {
    fields: [exclusionList.ingredientId],
    references: [ingredients.id],
  }),
}));

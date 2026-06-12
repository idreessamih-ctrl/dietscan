import { pgTable, uuid, varchar, timestamp, pgEnum, numeric, date, boolean, index } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { dietaryProtocols } from "./protocols";
import { products } from "./products";

export const mealTypeEnum = pgEnum("meal_type_enum", ["breakfast", "lunch", "dinner", "snack"]);

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: varchar("email", { length: 255 }).unique().notNull(),
    dietaryProtocol: varchar("dietary_protocol", { length: 50 }).references(() => dietaryProtocols.slug, { onDelete: "set null" }),
    pushToken: varchar("push_token", { length: 255 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_users_dietary_protocol").on(table.dietaryProtocol),
  ]
);

export const mealJournal = pgTable(
  "meal_journal",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    mealType: mealTypeEnum("meal_type").notNull(),
    scannedAt: timestamp("scanned_at", { withTimezone: true }).notNull().defaultNow(),
    complianceScore: numeric("compliance_score", { precision: 5, scale: 2 }).notNull(),
  },
  (table) => [
    index("idx_meal_journal_user_id").on(table.userId),
  ]
);

export const mealPlans = pgTable(
  "meal_plans",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    weekStart: date("week_start").notNull(),
    protocolSlug: varchar("protocol_slug", { length: 50 })
      .notNull()
      .references(() => dietaryProtocols.slug, { onDelete: "cascade" }),
  },
  (table) => [
    index("idx_meal_plans_user_id").on(table.userId),
    index("idx_meal_plans_protocol_slug").on(table.protocolSlug),
  ]
);

export const mealPlanEntries = pgTable(
  "meal_plan_entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    mealPlanId: uuid("meal_plan_id")
      .notNull()
      .references(() => mealPlans.id, { onDelete: "cascade" }),
    dayOfWeek: varchar("day_of_week", { length: 20 }).notNull(),
    mealType: mealTypeEnum("meal_type").notNull(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
  },
  (table) => [
    index("idx_meal_plan_entries_user_id").on(table.userId),
  ]
);

export const shoppingLists = pgTable(
  "shopping_lists",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(),
  },
  (table) => [
    index("idx_shopping_lists_user_id").on(table.userId),
  ]
);

export const shoppingListItems = pgTable("shopping_list_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  listId: uuid("list_id")
    .notNull()
    .references(() => shoppingLists.id, { onDelete: "cascade" }),
  productId: uuid("product_id")
    .notNull()
    .references(() => products.id, { onDelete: "cascade" }),
  checked: boolean("checked").notNull().default(false),
});

// Relations
export const usersRelations = relations(users, ({ one, many }) => ({
  protocol: one(dietaryProtocols, {
    fields: [users.dietaryProtocol],
    references: [dietaryProtocols.slug],
  }),
  mealJournal: many(mealJournal),
  mealPlans: many(mealPlans),
  mealPlanEntries: many(mealPlanEntries),
  shoppingLists: many(shoppingLists),
}));

export const mealJournalRelations = relations(mealJournal, ({ one }) => ({
  user: one(users, {
    fields: [mealJournal.userId],
    references: [users.id],
  }),
}));

export const mealPlansRelations = relations(mealPlans, ({ one, many }) => ({
  user: one(users, {
    fields: [mealPlans.userId],
    references: [users.id],
  }),
  protocol: one(dietaryProtocols, {
    fields: [mealPlans.protocolSlug],
    references: [dietaryProtocols.slug],
  }),
  entries: many(mealPlanEntries),
}));

export const mealPlanEntriesRelations = relations(mealPlanEntries, ({ one }) => ({
  user: one(users, {
    fields: [mealPlanEntries.userId],
    references: [users.id],
  }),
  mealPlan: one(mealPlans, {
    fields: [mealPlanEntries.mealPlanId],
    references: [mealPlans.id],
  }),
  product: one(products, {
    fields: [mealPlanEntries.productId],
    references: [products.id],
  }),
}));

export const shoppingListsRelations = relations(shoppingLists, ({ one, many }) => ({
  user: one(users, {
    fields: [shoppingLists.userId],
    references: [users.id],
  }),
  items: many(shoppingListItems),
}));

export const shoppingListItemsRelations = relations(shoppingListItems, ({ one }) => ({
  list: one(shoppingLists, {
    fields: [shoppingListItems.listId],
    references: [shoppingLists.id],
  }),
  product: one(products, {
    fields: [shoppingListItems.productId],
    references: [products.id],
  }),
}));

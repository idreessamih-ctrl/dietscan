import { pgTable, uuid, varchar, jsonb, numeric, text, timestamp, index } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { users } from "./users";

export const products = pgTable(
  "products",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    barcode: varchar("barcode", { length: 50 }).unique().notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    brand: varchar("brand", { length: 255 }),
    ingredientsJson: jsonb("ingredients_json").notNull().default([]),
    nutritionJson: jsonb("nutrition_json").default({}),
  },
  (table) => [
    index("idx_products_barcode").on(table.barcode),
  ]
);

export const affiliateRetailers = pgTable("affiliate_retailers", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  network: varchar("network", { length: 100 }).notNull(),
  baseUrl: varchar("base_url", { length: 255 }).notNull(),
  commissionRate: numeric("commission_rate", { precision: 5, scale: 2 }).notNull(),
});

export const affiliateProducts = pgTable("affiliate_products", {
  id: uuid("id").primaryKey().defaultRandom(),
  retailerId: uuid("retailer_id")
    .notNull()
    .references(() => affiliateRetailers.id, { onDelete: "cascade" }),
  productId: uuid("product_id")
    .notNull()
    .references(() => products.id, { onDelete: "cascade" }),
  affiliateUrl: text("affiliate_url").notNull(),
  price: numeric("price", { precision: 10, scale: 2 }).notNull(),
});

export const affiliateClicks = pgTable(
  "affiliate_clicks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    retailerId: uuid("retailer_id")
      .notNull()
      .references(() => affiliateRetailers.id, { onDelete: "cascade" }),
    clickId: varchar("click_id", { length: 255 }).unique().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_affiliate_clicks_user_id").on(table.userId),
    index("idx_affiliate_clicks_click_id").on(table.clickId),
  ]
);

export const affiliateConversions = pgTable("affiliate_conversions", {
  id: uuid("id").primaryKey().defaultRandom(),
  clickId: varchar("click_id", { length: 255 })
    .notNull()
    .references(() => affiliateClicks.clickId, { onDelete: "cascade" }),
  orderId: varchar("order_id", { length: 255 }).notNull(),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  commission: numeric("commission", { precision: 10, scale: 2 }).notNull(),
  status: varchar("status", { length: 50 }).notNull(),
});

// Relations
export const productsRelations = relations(products, ({ many }) => ({
  affiliateProducts: many(affiliateProducts),
  affiliateClicks: many(affiliateClicks),
}));

export const affiliateRetailersRelations = relations(affiliateRetailers, ({ many }) => ({
  affiliateProducts: many(affiliateProducts),
  affiliateClicks: many(affiliateClicks),
}));

export const affiliateProductsRelations = relations(affiliateProducts, ({ one }) => ({
  retailer: one(affiliateRetailers, {
    fields: [affiliateProducts.retailerId],
    references: [affiliateRetailers.id],
  }),
  product: one(products, {
    fields: [affiliateProducts.productId],
    references: [products.id],
  }),
}));

export const affiliateClicksRelations = relations(affiliateClicks, ({ one, many }) => ({
  user: one(users, {
    fields: [affiliateClicks.userId],
    references: [users.id],
  }),
  product: one(products, {
    fields: [affiliateClicks.productId],
    references: [products.id],
  }),
  retailer: one(affiliateRetailers, {
    fields: [affiliateClicks.retailerId],
    references: [affiliateRetailers.id],
  }),
  conversions: many(affiliateConversions),
}));

export const affiliateConversionsRelations = relations(affiliateConversions, ({ one }) => ({
  click: one(affiliateClicks, {
    fields: [affiliateConversions.clickId],
    references: [affiliateClicks.clickId],
  }),
}));

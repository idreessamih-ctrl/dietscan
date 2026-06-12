CREATE TYPE "public"."meal_type_enum" AS ENUM('breakfast', 'lunch', 'dinner', 'snack');--> statement-breakpoint
CREATE TABLE "exclusion_list" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"phrase" varchar(255) NOT NULL,
	"ingredient_id" uuid NOT NULL,
	CONSTRAINT "exclusion_list_phrase_unique" UNIQUE("phrase")
);
--> statement-breakpoint
CREATE TABLE "ingredient_aliases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ingredient_id" uuid NOT NULL,
	"alias" varchar(255) NOT NULL,
	CONSTRAINT "ingredient_aliases_alias_unique" UNIQUE("alias")
);
--> statement-breakpoint
CREATE TABLE "ingredients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"category" varchar(100) NOT NULL,
	"banned_by" jsonb DEFAULT '[]'::jsonb NOT NULL,
	CONSTRAINT "ingredients_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "affiliate_clicks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"retailer_id" uuid NOT NULL,
	"click_id" varchar(255) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "affiliate_clicks_click_id_unique" UNIQUE("click_id")
);
--> statement-breakpoint
CREATE TABLE "affiliate_conversions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"click_id" varchar(255) NOT NULL,
	"order_id" varchar(255) NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"commission" numeric(10, 2) NOT NULL,
	"status" varchar(50) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "affiliate_products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"retailer_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"affiliate_url" text NOT NULL,
	"price" numeric(10, 2) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "affiliate_retailers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"network" varchar(100) NOT NULL,
	"base_url" varchar(255) NOT NULL,
	"commission_rate" numeric(5, 2) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"barcode" varchar(50) NOT NULL,
	"name" varchar(255) NOT NULL,
	"brand" varchar(255),
	"ingredients_json" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"nutrition_json" jsonb DEFAULT '{}'::jsonb,
	CONSTRAINT "products_barcode_unique" UNIQUE("barcode")
);
--> statement-breakpoint
CREATE TABLE "dietary_protocols" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" varchar(50) NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text,
	"rules_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "dietary_protocols_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "education_articles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" varchar(100) NOT NULL,
	"title" varchar(255) NOT NULL,
	"content" text NOT NULL,
	"protocol_tags" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	CONSTRAINT "education_articles_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "scans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"protocol_slug" varchar(50) NOT NULL,
	"passed" boolean NOT NULL,
	"violations" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"scanned_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "meal_journal" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"meal_type" "meal_type_enum" NOT NULL,
	"scanned_at" timestamp with time zone DEFAULT now() NOT NULL,
	"compliance_score" numeric(5, 2) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "meal_plan_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"meal_plan_id" uuid NOT NULL,
	"day_of_week" varchar(20) NOT NULL,
	"meal_type" "meal_type_enum" NOT NULL,
	"product_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "meal_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"week_start" date NOT NULL,
	"protocol_slug" varchar(50) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shopping_list_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"list_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"checked" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shopping_lists" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"dietary_protocol" varchar(50),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "exclusion_list" ADD CONSTRAINT "exclusion_list_ingredient_id_ingredients_id_fk" FOREIGN KEY ("ingredient_id") REFERENCES "public"."ingredients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ingredient_aliases" ADD CONSTRAINT "ingredient_aliases_ingredient_id_ingredients_id_fk" FOREIGN KEY ("ingredient_id") REFERENCES "public"."ingredients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "affiliate_clicks" ADD CONSTRAINT "affiliate_clicks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "affiliate_clicks" ADD CONSTRAINT "affiliate_clicks_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "affiliate_clicks" ADD CONSTRAINT "affiliate_clicks_retailer_id_affiliate_retailers_id_fk" FOREIGN KEY ("retailer_id") REFERENCES "public"."affiliate_retailers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "affiliate_conversions" ADD CONSTRAINT "affiliate_conversions_click_id_affiliate_clicks_click_id_fk" FOREIGN KEY ("click_id") REFERENCES "public"."affiliate_clicks"("click_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "affiliate_products" ADD CONSTRAINT "affiliate_products_retailer_id_affiliate_retailers_id_fk" FOREIGN KEY ("retailer_id") REFERENCES "public"."affiliate_retailers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "affiliate_products" ADD CONSTRAINT "affiliate_products_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scans" ADD CONSTRAINT "scans_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scans" ADD CONSTRAINT "scans_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scans" ADD CONSTRAINT "scans_protocol_slug_dietary_protocols_slug_fk" FOREIGN KEY ("protocol_slug") REFERENCES "public"."dietary_protocols"("slug") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meal_journal" ADD CONSTRAINT "meal_journal_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meal_plan_entries" ADD CONSTRAINT "meal_plan_entries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meal_plan_entries" ADD CONSTRAINT "meal_plan_entries_meal_plan_id_meal_plans_id_fk" FOREIGN KEY ("meal_plan_id") REFERENCES "public"."meal_plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meal_plan_entries" ADD CONSTRAINT "meal_plan_entries_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meal_plans" ADD CONSTRAINT "meal_plans_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meal_plans" ADD CONSTRAINT "meal_plans_protocol_slug_dietary_protocols_slug_fk" FOREIGN KEY ("protocol_slug") REFERENCES "public"."dietary_protocols"("slug") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shopping_list_items" ADD CONSTRAINT "shopping_list_items_list_id_shopping_lists_id_fk" FOREIGN KEY ("list_id") REFERENCES "public"."shopping_lists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shopping_list_items" ADD CONSTRAINT "shopping_list_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shopping_lists" ADD CONSTRAINT "shopping_lists_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_dietary_protocol_dietary_protocols_slug_fk" FOREIGN KEY ("dietary_protocol") REFERENCES "public"."dietary_protocols"("slug") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_affiliate_clicks_user_id" ON "affiliate_clicks" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_affiliate_clicks_click_id" ON "affiliate_clicks" USING btree ("click_id");--> statement-breakpoint
CREATE INDEX "idx_products_barcode" ON "products" USING btree ("barcode");--> statement-breakpoint
CREATE INDEX "idx_dietary_protocols_slug" ON "dietary_protocols" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "idx_education_articles_slug" ON "education_articles" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "idx_scans_user_id" ON "scans" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_scans_protocol_slug" ON "scans" USING btree ("protocol_slug");--> statement-breakpoint
CREATE INDEX "idx_meal_journal_user_id" ON "meal_journal" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_meal_plan_entries_user_id" ON "meal_plan_entries" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_meal_plans_user_id" ON "meal_plans" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_meal_plans_protocol_slug" ON "meal_plans" USING btree ("protocol_slug");--> statement-breakpoint
CREATE INDEX "idx_shopping_lists_user_id" ON "shopping_lists" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_users_dietary_protocol" ON "users" USING btree ("dietary_protocol");
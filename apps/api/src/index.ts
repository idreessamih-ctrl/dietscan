import "./lib/sentry";
import * as Sentry from "@sentry/node";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import SuperTokens from "supertokens-node";
import Session from "supertokens-node/recipe/session";
import EmailPassword from "supertokens-node/recipe/emailpassword";
import { middleware as superTokensMiddleware, errorHandler as superTokensErrorHandler } from "supertokens-node/framework/express";
import { config } from "./config";
import { defaultLimiter } from "./middleware/rateLimiter";
import { errorHandler } from "./middleware/errorHandler";
import healthRouter from "./routes/health";
import authRouter from "./routes/auth";
import scansRouter from "./routes/scans";
import productsRouter from "./routes/products";
import searchRouter from "./routes/search";
import clicksRouter from "./routes/clicks";
import { initMeilisearch } from "./lib/meilisearch";

// Initialize SuperTokens
// Note: supertokens_core connection to the 'dietscan_auth' database is handled
// by the SuperTokens Core service (configured via POSTGRESQL_CONNECTION_URI in docker-compose)
SuperTokens.init({
  framework: "express",
  supertokens: {
    connectionURI: config.SUPERTOKENS_URI,
    apiKey: config.SUPERTOKENS_API_KEY,
  },
  appInfo: {
    appName: "DietScan",
    apiDomain: config.API_DOMAIN,
    websiteDomain: config.WEBSITE_DOMAIN,
  },
  recipeList: [
    EmailPassword.init(),
    Session.init({
      // Cookie domain config for development environment
      cookieDomain: config.NODE_ENV === "development" ? "localhost" : undefined,
    }),
  ],
});

const app = express();

// Security headers
app.use(helmet());

// CORS configuration (required for SuperTokens session management cookies)
app.use(
  cors({
    origin: config.WEBSITE_DOMAIN,
    allowedHeaders: ["content-type", ...SuperTokens.getAllCORSHeaders()],
    credentials: true,
  })
);

// Body parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Global default rate limiting
app.use(defaultLimiter);

// SuperTokens middleware (must be registered before any application routes)
app.use(superTokensMiddleware());

// Routes
app.use("/health", healthRouter);
app.use("/api/auth", authRouter);
app.use("/scans", scansRouter);
app.use("/products", productsRouter);
app.use("/search", searchRouter);
app.use("/", searchRouter);
app.use("/", clicksRouter);

// SuperTokens error handler (must be registered after all routes but before the custom error handler)
app.use(superTokensErrorHandler());

// Global custom error handler
app.use(errorHandler);

// Sentry error handler (must be LAST middleware)
Sentry.setupExpressErrorHandler(app);

app.listen(config.API_PORT, () => {
  console.log(`[API] Server is listening on port ${config.API_PORT} in ${config.NODE_ENV} mode`);
  // Initialize Meilisearch index settings asynchronously on start
  initMeilisearch().catch(err => console.error("Meilisearch initialization failed:", err));
});


#!/bin/sh
# Run drizzle migrations (idempotent — skips existing tables)
npx drizzle-kit migrate 2>/dev/null || echo "[API] Migrations skipped (tables may already exist from init SQL)"
node dist/index.js

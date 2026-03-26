#!/bin/bash
set -e

echo "==> Installing dependencies..."
pnpm install --frozen-lockfile

echo "==> Building frontend..."
NODE_ENV=production BASE_PATH=/ pnpm --filter @workspace/deal-file-manager run build

echo "==> Building API server..."
pnpm --filter @workspace/api-server run build

echo "==> Pushing database schema..."
pnpm --filter @workspace/db run push

echo "==> Done. Start with: NODE_ENV=production node artifacts/api-server/dist/index.mjs"

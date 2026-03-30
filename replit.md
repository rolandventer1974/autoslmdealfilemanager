# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Contains the **AutoSLM Deal File Manager** — a SaaS web application for car dealerships to manage deal paperwork digitally.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Frontend**: React + Vite (Tailwind CSS, shadcn/ui, React Query, Wouter)
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Application: AutoSLM Deal File Manager

A document repository SaaS for car dealerships that allows storing and tracking all deal paperwork digitally.

### Features
- **Login page** — username/password authentication via AutoSLM API
- **Dashboard** — lists all deal files with search, date filter, status filter, progress bars
- **Deal File view/create** — full customer/vehicle/deal info form + document management per file
- **Document upload** — supports PDF, JPEG, PNG, DOCX via presign upload flow
- **Manager Setup** — configure required document types per dealer
- **AutoSLM API ingest** — `POST /api/api-ingest/otp` endpoint to receive OTP from main AutoSLM system

### Demo Data
- Dealer code: `1234`
- API key for AutoSLM integration: `autoslm-api-key-demo-1234`
- 7 required document types preconfigured
- 5 sample deal files seeded

## Structure

```text
artifacts-monorepo/
├── artifacts/
│   ├── api-server/         # Express API server
│   └── deal-file-manager/  # React + Vite frontend (AutoSLM Deal File Manager)
├── lib/
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   └── db/                 # Drizzle ORM schema + DB connection
├── scripts/                # Utility scripts
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── tsconfig.json
└── package.json
```

## Database Schema

- `users` — authenticated users per dealer
- `sessions` — persistent login sessions (token, userId, expiresAt) — 30-day TTL
- `deal_files` — one record per car sale deal
- `documents` — uploaded files associated with a deal file
- `doc_types` — required document types configured per dealer
- `api_keys` — API keys for AutoSLM integration

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `PORT` | Yes | Port the API server listens on |
| `SESSION_SALT` | Recommended | Secret salt for session tokens (defaults to dev value) |
| `CORS_ORIGIN` | Production | Allowed CORS origin (e.g. `https://yourdomain.com`). Open in dev if unset |
| `NODE_ENV` | Production | Set to `production` to serve frontend static files from Express |
| `AUTOSLM_API_BASE` | Yes | AutoSLM API base URL (e.g. `https://api.autoslm.com`) |
| `AUTOSLM_ACCESS_CODE` | Yes | AutoSLM API security access code |
| `AUTOSLM_DEALER_CODE` | No | Bootstrap dealer code for AutoSLM API calls (defaults to `1011`) |

## Authentication

Login is validated against the AutoSLM ColdFusion API (`CheckLogin` method). On success the user's full profile (name, role, dealer RID, retailer name, logo URL etc.) is upserted into the local `users` table and a 30-day session token is issued. The user's `rid` from the AutoSLM response becomes their `dealerCode` for all deal file queries.

## Production Deployment (Digital Ocean / Ubuntu)

In production (`NODE_ENV=production`) the Express API server also serves the built React frontend as static files — a single process handles everything.

**Build steps:**
1. `pnpm --filter @workspace/deal-file-manager run build` — builds React frontend to `dist/`
2. `pnpm --filter @workspace/api-server run build` — compiles Express server
3. `NODE_ENV=production node dist/index.mjs` — starts the combined server

**What's production-ready:**
- Sessions stored in PostgreSQL (`sessions` table) — survive server restarts
- Security headers via `helmet`
- CORS locked to `CORS_ORIGIN` env var in production
- No HTTP caching on API responses
- Single server serves both API (`/api/*`) and frontend (`/*`)

## TypeScript & Composite Projects

Every package extends `tsconfig.base.json` which sets `composite: true`. The root `tsconfig.json` lists all packages as project references.

## Root Scripts

- `pnpm run build` — runs `typecheck` first, then recursively runs `build` in all packages that define it
- `pnpm run typecheck` — runs `tsc --build --emitDeclarationOnly` using project references

## Packages

### `artifacts/deal-file-manager` (`@workspace/deal-file-manager`)

React + Vite frontend. Routes:
- `/login` — login page
- `/` — dashboard with deal file list
- `/deal-files/new` — create new deal file
- `/deal-files/:id` — view/edit deal file + upload documents
- `/setup` — manager setup for required document types

### `artifacts/api-server` (`@workspace/api-server`)

Express 5 API server. Routes at `/api`:
- `POST /auth/login` — authenticate
- `GET /auth/me` — get current user
- `GET /deal-files` — list deal files (with search/filter)
- `POST /deal-files` — create deal file
- `GET /deal-files/:id` — get deal file with documents
- `PATCH /deal-files/:id` — update deal file
- `DELETE /deal-files/:id` — delete deal file
- `GET /deal-files/:id/documents` — list documents
- `POST /deal-files/:id/documents` — add document
- `DELETE /deal-files/:id/documents/:docId` — remove document
- `POST /upload/presign` — get presigned upload URL
- `PUT /upload/file/:filename` — upload file
- `GET /uploads/:filename` — serve uploaded file
- `GET /doc-types` — list required doc types
- `POST /doc-types` — create doc type
- `PATCH /doc-types/:id` — update doc type
- `DELETE /doc-types/:id` — delete doc type
- `POST /api-ingest/otp` — receive OTP from AutoSLM main system (requires API key)

### `lib/db` (`@workspace/db`)

Database layer using Drizzle ORM with PostgreSQL.

Production migrations: `pnpm --filter @workspace/db run push`

### `lib/api-spec` (`@workspace/api-spec`)

OpenAPI 3.1 spec. Run codegen: `pnpm --filter @workspace/api-spec run codegen`

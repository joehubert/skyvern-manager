# Skyvern Manager — Project Summary

> **This file is the canonical reference for the project's intent, architecture, and features.**
> Update it whenever a significant architectural decision changes or a new feature is added.
> It is designed to be the first file read in any new Claude Code session.

---

## Intent

Skyvern Manager is a self-hosted web application that provides utility and productivity features
for users of the [Skyvern](https://skyvern.com) cloud automation platform. It acts as a
management layer on top of the Skyvern API, enabling workflows and other Skyvern resources to be
viewed, filtered, transformed, and exported in ways the Skyvern UI does not natively support.

The application is intentionally lightweight: no database, no authentication layer, no cloud
dependencies beyond the Skyvern API itself. Config is stored as JSON files on the server
filesystem. It is designed to run locally or on a simple self-hosted server.

---

## Architecture

| Concern | Choice |
|---------|--------|
| Backend | Node.js 20+ / TypeScript / Express 4 |
| Frontend | Next.js 14 (App Router, client components where needed) |
| Styling | CSS Modules for layout; `frontend/public/styles.css` for content presentation |
| Config persistence | JSON files in `server/config/` |
| PDF export | Puppeteer (server-side) |
| Skyvern API auth | `x-api-key` header, key stored in `server/.env` as `SKYVERN_API_KEY` |

### Key Structural Conventions

- The frontend never calls the Skyvern API directly. All Skyvern communication goes through the Express backend.
- The frontend proxies all `/api/*` calls to the Express server via a Next.js rewrite, so no port is hardcoded in frontend code.
- Config files are read from disk on every request — no in-memory caching — so edits take effect immediately.
- TypeScript interfaces for shared data shapes are defined in `server/src/types/index.ts` and mirrored in `frontend/lib/types.ts`.

### Folder Structure (top level)

```
skyvern-manager/
├── server/
│   ├── .env                      # SKYVERN_API_KEY + feature env vars
│   ├── src/
│   │   ├── index.ts
│   │   ├── routes/               # Express route handlers
│   │   ├── services/             # Business logic (Skyvern client, config, filters, aggregation)
│   │   └── types/                # Shared TypeScript interfaces
│   └── config/                   # Persisted user config (JSON files)
├── frontend/
│   ├── app/                      # Next.js App Router pages
│   ├── components/               # Reusable React components (NavSidebar, etc.)
│   ├── lib/                      # API client, types, utilities
│   └── public/
│       └── styles.css            # Content presentation stylesheet (managed separately)
└── _instructions/                # Claude Code instruction files (not part of the app)
```

---

## UI Shell

Standard left-nav / right-content layout, defined once in `frontend/app/layout.tsx` and shared
across all features. The `NavSidebar` component lists all available features; the active route is
highlighted. New features add a nav entry and a new route under `frontend/app/`.

---

## Features

### Run Analytics
**Route:** `/run-analytics`
**Status:** Planned / In development

Fetches workflow runs from the Skyvern API, applies client-side filtering, and aggregates results
by workflow title into a summary table with export capability.

**Data pipeline:**
1. Fetches the eligible workflow set from `GET /v1/workflows` using a configurable filter
   (stored in `server/config/run-analytics-workflow-filter.json`).
2. Fetches workflow runs from `GET /v1/workflows/runs`, paginating and applying an early-exit
   optimisation when runs older than the cut-off timestamp are encountered.
3. Client-side filters: excludes runs by status (env var) and by workflow membership.
4. Aggregates surviving runs by `workflow_title` into summary metrics.

**User-configurable:**
- **Cut-off timestamp** — set via in-app date/time picker, persisted to
  `server/config/run-analytics-settings.json`.
- **Workflow filter** — in-app JSON editor (status, folder_id, search_key), persisted to
  `server/config/run-analytics-workflow-filter.json`.
- **Excluded statuses** — `RUN_ANALYTICS_EXCLUDE_STATUSES` env var (default: `queued,running`).
- **API page size** — `RUN_ANALYTICS_PAGE_SIZE` env var (default: `20`).

**Aggregated metrics per workflow:**
- Total run count, completed count, unsuccessful count (failed/terminated/canceled/timed_out)
- Average, max, and min run time (completed runs only; displayed as human-readable e.g. "2m 22s")

**Output:** sortable in-browser table, CSV export, and PDF export (server-side via Puppeteer).

**Key backend services:**
- `skyvernClient.ts` — typed Skyvern API HTTP client with `x-api-key` auth.
- `configLoader.ts` — disk-based JSON config reader/writer.
- `runAnalyticsService.ts` — workflow fetching, run fetching with early-exit, aggregation.

---

### Workflow Doc
**Route:** `/workflow-doc`
**Status:** Planned / In development

Fetches workflows from the Skyvern API and renders them as structured documentation.

**User-configurable:**
- **Filter Config** (`server/config/filter-config.json`) — controls which workflows are fetched.
- **Field Config** (`server/config/field-config.json`) — selects which fields appear in output.
- **HTML Template** (`server/config/doc-template.html`) — controls rendered output per workflow.

**Output options:** Live in-browser preview, export as PDF, copy HTML to clipboard.

---

## Adding a New Feature

1. Add a route entry in `NavSidebar.tsx`.
2. Create `frontend/app/<feature-name>/page.tsx`.
3. Add any new Express routes under `server/src/routes/`.
4. Add new config files to `server/config/` if the feature needs user-editable settings.
5. Update this file: add a new entry under **Features**.
6. Create a new instruction file `_instructions/0N-FEATURE-<name>.md`.

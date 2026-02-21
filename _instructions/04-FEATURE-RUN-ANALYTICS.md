# 04 — Feature: Run Analytics

> Full specification for the Run Analytics feature.
> Read 01, 02, and 03 before this file.

---

## Overview

Run Analytics fetches workflow runs from the Skyvern API, applies client-side filtering, and
aggregates results by workflow title into a summary table. Users can configure which workflows
and time window to include, and can export results to CSV or PDF.

**Route:** `/run-analytics`
**Nav label:** `Run Analytics`

---

## Environment Variables (additions to `server/.env`)

```
# Comma-separated list of run statuses to exclude from ALL results (no spaces)
# Default: queued,running
RUN_ANALYTICS_EXCLUDE_STATUSES=queued,running

# Page size used when calling the Skyvern "list workflow runs" API
# Default: 20  (Skyvern max is not documented; keep ≤ 100)
RUN_ANALYTICS_PAGE_SIZE=20
```

These are read once per request in the route handler via `process.env`.

---

## Config Files

### `server/config/run-analytics-workflow-filter.json`

Controls which workflows are fetched from Skyvern. The shape maps directly to the query
parameters accepted by `GET /v1/workflows`. Only the fields below are currently supported.

Default (empty = fetch all published workflows):
```json
{
  "status": ["published"],
  "folder_id": []
}
```

Full schema:
```ts
interface WorkflowFilterConfig {
  status?: string[];     // Skyvern workflow statuses: published | draft | auto_generated | importing | import_failed
  folder_id?: string[];  // Filter to specific folder IDs (OR logic within array)
  search_key?: string;   // Optional title/param substring search
}
```

`folder_id` is an array because a user may want runs from multiple folders. When building the
query string, append each value as a separate `folder_id` param (Skyvern accepts repeated params).

### `server/config/run-analytics-settings.json`

Persists the user's chosen cut-off timestamp. Managed via an in-app settings panel.

```json
{
  "cutoff_timestamp": "2025-01-01T00:00:00.000Z"
}
```

```ts
interface RunAnalyticsSettings {
  cutoff_timestamp: string; // ISO 8601
}
```

---

## TypeScript Interfaces

Add these to `server/src/types/index.ts` and mirror in `frontend/lib/types.ts`.

```ts
// --- Skyvern API shapes (minimal — only fields we use) ---

export interface SkyvernWorkflow {
  workflow_id: string;
  workflow_permanent_id: string;
  title: string;
  status: string;
  folder_id: string | null;
}

export interface SkyvernWorkflowRun {
  workflow_run_id: string;
  workflow_id: string;
  workflow_permanent_id: string;
  workflow_title: string | null;
  status: string;
  started_at: string | null;   // ISO 8601
  finished_at: string | null;  // ISO 8601
  queued_at: string | null;
}

// --- Config shapes ---

export interface WorkflowFilterConfig {
  status?: string[];
  folder_id?: string[];
  search_key?: string;
}

export interface RunAnalyticsSettings {
  cutoff_timestamp: string;
}

// --- Aggregated output ---

export interface WorkflowRunSummary {
  workflow_title: string;
  total_count: number;
  completed_count: number;
  unsuccessful_count: number;
  avg_run_time_seconds: number | null;  // null if no completed runs
  max_run_time_seconds: number | null;
  min_run_time_seconds: number | null;
}
```

---

## Backend Implementation

### Route File: `server/src/routes/runAnalytics.ts`

Expose four endpoints:

```
GET  /api/run-analytics/results          → fetch, filter, aggregate, return WorkflowRunSummary[]
GET  /api/run-analytics/export/pdf       → generate and stream a PDF of the current results
GET  /api/run-analytics/settings         → return RunAnalyticsSettings
PUT  /api/run-analytics/settings         → save RunAnalyticsSettings
GET  /api/run-analytics/workflow-filter  → return WorkflowFilterConfig
PUT  /api/run-analytics/workflow-filter  → save WorkflowFilterConfig
```

---

### Service: `server/src/services/runAnalyticsService.ts`

#### Step 1 — Fetch eligible workflow `permanent_id` set

```ts
async function fetchEligibleWorkflowIds(filter: WorkflowFilterConfig): Promise<Set<string>>
```

- Call `GET /v1/workflows` with the filter params, auto-paginating until all pages are exhausted.
- Pagination: start at `page=1`, increment until a page returns fewer items than `page_size` (use
  `page_size=100` for workflow fetching — it is not user-configurable).
- Collect all `workflow_permanent_id` values into a `Set<string>` and return it.
- If `filter.folder_id` is a non-empty array, pass each value as a separate `folder_id` query
  param (Skyvern accepts repeated params and ORs them).

**Skyvern API reference — GET `/v1/workflows`:**

| Param | Type | Notes |
|-------|------|-------|
| `page` | integer ≥ 1 | |
| `page_size` | integer ≥ 1 | default 10 |
| `status` | repeated enum | published \| draft \| auto_generated \| importing \| import_failed |
| `folder_id` | string or null | repeat for multiple |
| `search_key` | string or null | |

---

#### Step 2 — Fetch and filter workflow runs

```ts
async function fetchFilteredRuns(
  eligibleIds: Set<string>,
  cutoffTimestamp: string,
  excludeStatuses: string[]
): Promise<SkyvernWorkflowRun[]>
```

**Skyvern API reference — GET `/v1/workflows/runs`:**

| Param | Type | Notes |
|-------|------|-------|
| `page` | integer ≥ 1 | |
| `page_size` | integer ≥ 1 | default 10; use `RUN_ANALYTICS_PAGE_SIZE` env var |
| `status` | repeated enum | created \| queued \| running \| completed \| failed \| terminated \| canceled \| timed_out \| unknown |

Results are returned **most-recent first** (descending `queued_at`/`started_at`).

**Pagination + early-exit logic:**

1. Fetch page 1.
2. For each page received:
   a. Filter out runs whose `status` is in `excludeStatuses`.
   b. Check the **earliest** `started_at` in the raw (unfiltered) page. If it is before
      `cutoffTimestamp`, this is the **last page to process** — collect matching runs from this
      page then stop fetching.
   c. Otherwise, enqueue the next page.
3. After collecting all pages, apply remaining client-side filters:
   - Exclude runs where `started_at` < `cutoffTimestamp`.
   - Exclude runs where `workflow_permanent_id` is NOT in `eligibleIds`.
4. Return the surviving runs.

**Important:** The early-exit is an optimisation. The timestamp filter in step 3c must still be
applied because a single page may contain runs straddling the cut-off boundary.

---

#### Step 3 — Aggregate

```ts
function aggregateRuns(runs: SkyvernWorkflowRun[]): WorkflowRunSummary[]
```

Group by `workflow_title` (treat `null` as `"(Untitled)"`). For each group:

| Field | Logic |
|-------|-------|
| `total_count` | Count of all runs in the group |
| `completed_count` | Count where `status === 'completed'` |
| `unsuccessful_count` | Count where `status` is one of: `failed`, `terminated`, `canceled`, `timed_out` |
| `avg_run_time_seconds` | Mean of `(finished_at - started_at)` in seconds for completed runs; `null` if none |
| `max_run_time_seconds` | Max of the same durations; `null` if no completed runs |
| `min_run_time_seconds` | Min of the same durations; `null` if no completed runs |

Duration calculation: `(new Date(finished_at).getTime() - new Date(started_at).getTime()) / 1000`.
Only include a run in duration stats if both `started_at` and `finished_at` are non-null and
`status === 'completed'`.

Return the array sorted descending by `total_count`.

---

### Route Handler Implementation Sketch

```ts
// GET /api/run-analytics/results
router.get('/results', async (req, res) => {
  try {
    const settings = loadConfig<RunAnalyticsSettings>('run-analytics-settings.json');
    const workflowFilter = loadConfig<WorkflowFilterConfig>('run-analytics-workflow-filter.json');

    const excludeStatuses = (process.env.RUN_ANALYTICS_EXCLUDE_STATUSES ?? 'queued,running')
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);

    const eligibleIds = await fetchEligibleWorkflowIds(workflowFilter);
    const runs = await fetchFilteredRuns(eligibleIds, settings.cutoff_timestamp, excludeStatuses);
    const summaries = aggregateRuns(runs);

    res.json(summaries);
  } catch (err: any) {
    console.error('[skyvern-manager] run-analytics error:', err.message);
    res.status(500).json({ error: err.message });
  }
});
```

---

## Frontend Implementation

### Page: `frontend/app/run-analytics/page.tsx`

`'use client'` component. Layout:

```
┌─────────────────────────────────────────────────────────┐
│  Run Analytics                                 [Run]    │
│                                                          │
│  ┌─ Settings panel (collapsible) ──────────────────────┐ │
│  │  Cut-off date: [date-time picker]                   │ │
│  │  Workflow filter: [JSON textarea]       [Save]      │ │
│  └─────────────────────────────────────────────────────┘ │
│                                                          │
│  [Export CSV]  [Export PDF]                              │
│                                                          │
│  ┌─ Results table ─────────────────────────────────────┐ │
│  │  Workflow Title | Total | Completed | Unsuccessful  │ │
│  │                 | Avg   | Max       | Min           │ │
│  └─────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

**State:**
```ts
const [summaries, setSummaries]           = useState<WorkflowRunSummary[]>([]);
const [loading, setLoading]               = useState(false);
const [error, setError]                   = useState<string | null>(null);
const [settings, setSettings]             = useState<RunAnalyticsSettings | null>(null);
const [workflowFilter, setWorkflowFilter] = useState<WorkflowFilterConfig | null>(null);
const [settingsOpen, setSettingsOpen]     = useState(false);
const [sortKey, setSortKey]               = useState<keyof WorkflowRunSummary>('total_count');
const [sortDir, setSortDir]               = useState<'asc' | 'desc'>('desc');
```

**On mount:** load settings and workflow filter via `GET /api/run-analytics/settings` and
`GET /api/run-analytics/workflow-filter`.

**Run button:** calls `GET /api/run-analytics/results`, sets `summaries`.

**Settings save button:** PUTs to `/api/run-analytics/settings` and
`/api/run-analytics/workflow-filter` independently (one button saves both).

---

### Settings Panel Details

**Cut-off timestamp picker:**
- Use an HTML `<input type="datetime-local">`.
- Convert to/from ISO 8601 when reading/writing to the backend.

**Workflow filter editor:**
- A `<textarea>` pre-populated with the current `WorkflowFilterConfig` JSON (pretty-printed).
- Validate JSON on save; show an inline error if invalid.
- Display a helper comment above the textarea explaining the supported fields:
  ```
  // Supported fields: status (array), folder_id (array), search_key (string)
  // Example: { "status": ["published"], "folder_id": ["fld_abc123"] }
  ```

---

### Results Table

Columns:

| Column header | Value | Sortable |
|---------------|-------|----------|
| Workflow Title | `workflow_title` | Yes |
| Total Runs | `total_count` | Yes |
| Completed | `completed_count` | Yes |
| Unsuccessful | `unsuccessful_count` | Yes |
| Avg Run Time | formatted `avg_run_time_seconds` | Yes |
| Max Run Time | formatted `max_run_time_seconds` | Yes |
| Min Run Time | formatted `min_run_time_seconds` | Yes |

**Sorting:** clicking a column header toggles sort direction on that column; an arrow indicator
shows the active sort. Sorting is done client-side on the `summaries` array.

**Run time formatting** — implement `formatDuration(seconds: number | null): string`:
```
null          → "—"
0–59 s        → "42s"
60–3599 s     → "2m 22s"
3600+ s       → "1h 4m 12s"
```

---

### CSV Export

Button label: **Export CSV**

Generate a CSV string client-side from the current `summaries` array (after sorting) and trigger
a browser download.

CSV columns (same order as the table):
`Workflow Title,Total Runs,Completed,Unsuccessful,Avg Run Time (s),Max Run Time (s),Min Run Time (s)`

Use raw seconds for the time columns in CSV (not formatted strings), so the data is usable in
spreadsheets. Use `null` → empty string.

```ts
function exportCsv(summaries: WorkflowRunSummary[]) {
  const header = [
    'Workflow Title','Total Runs','Completed','Unsuccessful',
    'Avg Run Time (s)','Max Run Time (s)','Min Run Time (s)'
  ].join(',');

  const rows = summaries.map(s => [
    `"${s.workflow_title.replace(/"/g, '""')}"`,
    s.total_count,
    s.completed_count,
    s.unsuccessful_count,
    s.avg_run_time_seconds ?? '',
    s.max_run_time_seconds ?? '',
    s.min_run_time_seconds ?? '',
  ].join(','));

  const csv = [header, ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `run-analytics-${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
```

---

### PDF Export

**Button label:** `Export PDF`

PDF generation is **server-side** using Puppeteer. The frontend triggers it by navigating to
(or `fetch`-ing) `GET /api/run-analytics/export/pdf`, which streams back a `application/pdf`
response that the browser downloads.

#### Why server-side?

Puppeteer is already in the project architecture for the Workflow Doc feature. Keeping PDF
generation on the server means the frontend has no awareness of a rendering library, and the
PDF will look identical regardless of the user's browser or OS.

#### Backend — install dependency (if not already present)

```bash
cd server
npm install puppeteer
```

#### Backend — PDF route handler

```ts
// GET /api/run-analytics/export/pdf
router.get('/export/pdf', async (req, res) => {
  try {
    const settings      = loadConfig<RunAnalyticsSettings>('run-analytics-settings.json');
    const workflowFilter = loadConfig<WorkflowFilterConfig>('run-analytics-workflow-filter.json');
    const excludeStatuses = (process.env.RUN_ANALYTICS_EXCLUDE_STATUSES ?? 'queued,running')
      .split(',').map(s => s.trim()).filter(Boolean);

    const eligibleIds = await fetchEligibleWorkflowIds(workflowFilter);
    const runs        = await fetchFilteredRuns(eligibleIds, settings.cutoff_timestamp, excludeStatuses);
    const summaries   = aggregateRuns(runs);

    const html = buildReportHtml(summaries, settings.cutoff_timestamp);

    const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
    const page    = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdf = await page.pdf({
      format: 'A4',
      landscape: true,          // table fits better in landscape
      printBackground: true,
      margin: { top: '20mm', bottom: '20mm', left: '15mm', right: '15mm' },
    });
    await browser.close();

    const filename = `run-analytics-${new Date().toISOString().slice(0, 10)}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(Buffer.from(pdf));
  } catch (err: any) {
    console.error('[skyvern-manager] PDF export error:', err.message);
    res.status(500).json({ error: err.message });
  }
});
```

#### Backend — `buildReportHtml` helper

Define this function in `runAnalyticsService.ts` (or a new `pdfRenderer.ts` — either is fine).
It returns a self-contained HTML string that Puppeteer will render.

```ts
function formatDurationServer(seconds: number | null): string {
  if (seconds === null) return '—';
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`;
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m ${Math.round(seconds % 60)}s`;
}

export function buildReportHtml(summaries: WorkflowRunSummary[], cutoffTimestamp: string): string {
  const rows = summaries.map(s => `
    <tr>
      <td>${escapeHtml(s.workflow_title)}</td>
      <td>${s.total_count}</td>
      <td>${s.completed_count}</td>
      <td>${s.unsuccessful_count}</td>
      <td>${formatDurationServer(s.avg_run_time_seconds)}</td>
      <td>${formatDurationServer(s.max_run_time_seconds)}</td>
      <td>${formatDurationServer(s.min_run_time_seconds)}</td>
    </tr>`).join('');

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  body { font-family: Arial, sans-serif; font-size: 11px; color: #111; }
  h1   { font-size: 16px; margin-bottom: 4px; }
  p    { margin: 0 0 12px; font-size: 10px; color: #555; }
  table { width: 100%; border-collapse: collapse; }
  th   { background: #f0f0f0; text-align: left; padding: 6px 8px;
         border-bottom: 2px solid #ccc; font-size: 10px; }
  td   { padding: 5px 8px; border-bottom: 1px solid #e0e0e0; }
  tr:nth-child(even) td { background: #fafafa; }
</style>
</head>
<body>
<h1>Run Analytics</h1>
<p>Generated: ${new Date().toISOString()} &nbsp;|&nbsp; Cut-off: ${cutoffTimestamp}</p>
<table>
  <thead>
    <tr>
      <th>Workflow Title</th>
      <th>Total Runs</th>
      <th>Completed</th>
      <th>Unsuccessful</th>
      <th>Avg Run Time</th>
      <th>Max Run Time</th>
      <th>Min Run Time</th>
    </tr>
  </thead>
  <tbody>${rows}</tbody>
</table>
</body>
</html>`;
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
```

#### Frontend — Export PDF button

The simplest reliable approach is to trigger a full navigation to the PDF endpoint, which causes
the browser to download the file directly. No streaming or blob handling needed on the frontend.

```tsx
function handleExportPdf() {
  window.location.href = '/api/run-analytics/export/pdf';
}

// In JSX:
<button onClick={handleExportPdf} disabled={summaries.length === 0}>
  Export PDF
</button>
```

The button should be disabled when `summaries` is empty (no results loaded yet).

---

## Default Config Files to Create

Create these files during initial scaffold (not at runtime):

**`server/config/run-analytics-settings.json`**
```json
{
  "cutoff_timestamp": "2025-01-01T00:00:00.000Z"
}
```

**`server/config/run-analytics-workflow-filter.json`**
```json
{
  "status": ["published"],
  "folder_id": []
}
```

---

## Error Handling

- If the Skyvern API returns a non-2xx, surface the error message to the frontend via the
  `{ error: string }` response shape and display it in a red alert box above the table.
- If JSON in the workflow filter textarea is invalid, show an inline red error and do not save.
- Show a loading spinner / disabled Run button while `loading === true`.

---

## Checklist for Implementation

- [ ] `server/src/types/index.ts` — add all interfaces above
- [ ] `frontend/lib/types.ts` — mirror the same interfaces
- [ ] `server/src/services/skyvernClient.ts` — `skyvernGet` helper
- [ ] `server/src/services/configLoader.ts` — `loadConfig` / `saveConfig`
- [ ] `server/src/services/runAnalyticsService.ts` — three functions: `fetchEligibleWorkflowIds`,
      `fetchFilteredRuns`, `aggregateRuns`
- [ ] `server/src/routes/runAnalytics.ts` — six endpoints (add `/export/pdf`)
- [ ] `server/src/services/runAnalyticsService.ts` — add `buildReportHtml` + `formatDurationServer`
- [ ] `server/package.json` — ensure `puppeteer` is in dependencies
- [ ] `server/src/index.ts` — mount the router at `/api/run-analytics`
- [ ] `server/config/run-analytics-settings.json` — default file
- [ ] `server/config/run-analytics-workflow-filter.json` — default file
- [ ] `frontend/app/run-analytics/page.tsx` — full UI
- [ ] `frontend/components/NavSidebar.tsx` — add Run Analytics link
- [ ] `frontend/lib/types.ts` — mirrored interfaces
- [ ] `frontend/lib/api.ts` — `apiFetch` helper
- [ ] `frontend/next.config.js` — rewrite `/api/*` → `localhost:3001`

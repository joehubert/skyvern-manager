# 06 — Implementation Plan

Follow these steps in order. Complete and verify each step before moving to the next.

---

## Step 1 — Repository Scaffold

1. Create the root `skyvern-manager/` directory.
2. Create `skyvern-manager/server/` and `skyvern-manager/frontend/` subdirectories.
3. Create a root `.gitignore` that excludes: `node_modules/`, `.env`, `dist/`, `.next/`.
4. Create a root `README.md` with basic setup instructions (see below).

**README.md content:**
```markdown
# Skyvern Manager

## Setup

1. Copy `server/.env.example` to `server/.env` and fill in your Skyvern API key.
2. Install server dependencies: `cd server && npm install`
3. Install frontend dependencies: `cd frontend && npm install`
4. Start both: open two terminals.
   - Terminal 1: `cd server && npm run dev`
   - Terminal 2: `cd frontend && npm run dev`
5. Open http://localhost:3000
```

---

## Step 2 — Server: Init and Dependencies

In `server/`:

1. Run `npm init -y`.
2. Install production dependencies:
   ```
   npm install express dotenv axios puppeteer
   ```
3. Install dev dependencies:
   ```
   npm install -D typescript ts-node-dev @types/node @types/express
   ```
4. Create `tsconfig.json`:
   ```json
   {
     "compilerOptions": {
       "target": "ES2020",
       "module": "commonjs",
       "outDir": "dist",
       "rootDir": "src",
       "strict": true,
       "esModuleInterop": true,
       "resolveJsonModule": true
     }
   }
   ```
5. Create `server/.env.example`:
   ```env
   SKYVERN_API_KEY=your_api_key_here
   SKYVERN_BASE_URL=https://api.skyvern.com/v1
   PORT=3001
   CONFIG_DIR=./config
   ```
6. Create the `server/config/` directory.
7. Create default config files (see `03-FEATURE-WORKFLOW-DOC.md` for default values):
   - `server/config/filter-config.json`
   - `server/config/field-config.json`
   - `server/config/doc-template.html`

---

## Step 3 — Server: Core Services

Implement in this order:

### 3a. `server/src/types/index.ts`
Full TypeScript interfaces as defined in `04-DATA-MODELS.md`.

### 3b. `server/src/services/configService.ts`
- `readFilterConfig(): Promise<FilterConfig>` — reads and parses `filter-config.json`. Creates the file with defaults if missing.
- `writeFilterConfig(config: FilterConfig): Promise<void>`
- `readFieldConfig(): Promise<FieldConfig>` — reads and parses `field-config.json`. Creates with defaults if missing.
- `writeFieldConfig(config: FieldConfig): Promise<void>`
- `readTemplate(): Promise<string>` — reads `doc-template.html` as a string. Creates with default template if missing.
- `writeTemplate(template: string): Promise<void>`

Use `fs/promises` for all file operations. Resolve the config directory path using `process.env.CONFIG_DIR` with `path.resolve()`.

### 3c. `server/src/services/skyvernClient.ts`
- `fetchAllWorkflows(queryParams: Record<string, string | string[] | boolean>): Promise<RawWorkflow[]>`
- Implements the auto-pagination loop (see `02-SKYVERN-API.md`).
- Uses `axios` with the `x-api-key` header from `process.env.SKYVERN_API_KEY`.
- Serializes array query params correctly (e.g., `status=published&status=draft`).

### 3d. `server/src/services/workflowFilter.ts`
- `applyFilterConfig(workflows: RawWorkflow[], filterConfig: FilterConfig): RawWorkflow[]`
  - Handles any post-fetch filters not handled by the Skyvern API query params.
- `applyFieldConfig(workflows: RawWorkflow[], fieldConfig: FieldConfig): Record<string, unknown>[]`
  - Applies parameter-level filters, then field selection.
  - Implements the path extraction algorithm from `04-DATA-MODELS.md`.

### 3e. `server/src/services/templateRenderer.ts`
- `renderWorkflow(template: string, workflow: Record<string, unknown>): string`
- Implements the template engine from `04-DATA-MODELS.md`.
- `renderAllWorkflows(template: string, workflows: Record<string, unknown>[]): string`
  - Concatenates rendered HTML for all workflows.

---

## Step 4 — Server: Routes

### 4a. `server/src/routes/config.ts`

Mount at `/api/config`.

```
GET  /api/config/filter   → 200 { data: FilterConfig }
PUT  /api/config/filter   → body: FilterConfig JSON → 200 { ok: true }
GET  /api/config/fields   → 200 { data: FieldConfig }
PUT  /api/config/fields   → body: FieldConfig JSON → 200 { ok: true }
GET  /api/config/template → 200 plain text (Content-Type: text/plain)
PUT  /api/config/template → body: plain text → 200 { ok: true }
```

- For JSON PUT endpoints: parse the body, validate it is a plain object, write to disk.
- Return `400` with `{ error: "..." }` if body is invalid.

### 4b. `server/src/routes/workflows.ts`

Mount at `/api/workflows`.

```
GET /api/workflows → 200 shaped workflow array
```

- Read both configs.
- Map filter config to Skyvern API query params.
- Call `fetchAllWorkflows()`.
- Apply `applyFilterConfig()` (post-fetch filtering).
- Apply `applyFieldConfig()`.
- Return shaped array as JSON.

### 4c. `server/src/routes/export.ts`

Mount at `/api/export`.

```
POST /api/export/pdf → streams PDF file
```

- Read both configs and the template.
- Fetch and shape workflows (same as `/api/workflows`).
- Render all workflows using `renderAllWorkflows()`.
- Wrap in a full HTML document:
  ```html
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="UTF-8">
    <link rel="stylesheet" href="styles.css">
  </head>
  <body class="workflow-doc-preview">
    {rendered content}
  </body>
  </html>
  ```
- Use Puppeteer to generate a PDF from the HTML string (use `page.setContent()`, not a URL).
- Stream the PDF back with:
  ```
  Content-Type: application/pdf
  Content-Disposition: attachment; filename="workflow-doc.pdf"
  ```

### 4d. `server/src/index.ts`

- Load `dotenv`.
- Create Express app.
- Add `express.json()` and `express.text({ type: 'text/plain' })` middleware.
- Mount routes.
- Listen on `process.env.PORT ?? 3001`.

---

## Step 5 — Frontend: Init and Dependencies

In `frontend/`:

1. Run `npx create-next-app@latest . --typescript --app --no-src-dir --no-tailwind --import-alias "@/*"`.
2. Install additional dependencies:
   ```
   npm install
   ```
   No additional libraries needed — use native browser APIs and React.
3. Update `next.config.js` with the API proxy rewrite (see `01-ARCHITECTURE.md`).
4. Create `frontend/public/styles.css` with a header comment:
   ```css
   /*
    * Skyvern Manager — Global Stylesheet
    * This file controls the visual presentation of workflow documentation output.
    * Edit this file to style elements like .workflow-title, .param-key, etc.
    */
   ```

---

## Step 6 — Frontend: API Client

Create `frontend/lib/api.ts`:

```typescript
// All functions call /api/... (proxied to Express by Next.js)

export async function getFilterConfig(): Promise<FilterConfig> { ... }
export async function saveFilterConfig(config: FilterConfig): Promise<void> { ... }
export async function getFieldConfig(): Promise<FieldConfig> { ... }
export async function saveFieldConfig(config: FieldConfig): Promise<void> { ... }
export async function getTemplate(): Promise<string> { ... }
export async function saveTemplate(template: string): Promise<void> { ... }
export async function getWorkflows(): Promise<Record<string, unknown>[]> { ... }
export async function exportPdf(): Promise<Blob> { ... }
```

Copy the `FilterConfig` and `FieldConfig` TypeScript interfaces from `server/src/types/index.ts` into `frontend/lib/types.ts` so they can be imported on the frontend.

---

## Step 7 — Frontend: Template Renderer

Create `frontend/lib/templateRenderer.ts`.

Mirror the `renderWorkflow` and `renderAllWorkflows` functions from `server/src/services/templateRenderer.ts`. This allows the preview to render client-side without an extra API call.

---

## Step 8 — Frontend: Components

Build components in this order:

### 8a. `NavSidebar.tsx`
### 8b. `ConfigEditor.tsx`
### 8c. `DocToolbar.tsx`

### 8d. `WorkflowDocPreview.tsx`

Props:
```typescript
interface WorkflowDocPreviewProps {
  workflows: Record<string, unknown>[];
  template: string;
  isLoading: boolean;
  error: string | null;
}
```

- If `isLoading`: show a centered spinner.
- If `error`: show the error message in red.
- Otherwise: render `renderAllWorkflows(template, workflows)` into a `<div className="workflow-doc-preview">` using `dangerouslySetInnerHTML`.

---

## Step 9 — Frontend: Workflow Doc Page

Create `frontend/app/workflow-doc/page.tsx` as a client component (`'use client'`).

**State:**
```typescript
const [filterConfigStr, setFilterConfigStr] = useState('');
const [fieldConfigStr, setFieldConfigStr] = useState('');
const [templateStr, setTemplateStr] = useState('');
const [workflows, setWorkflows] = useState<Record<string, unknown>[]>([]);
const [isRefreshing, setIsRefreshing] = useState(false);
const [isSaving, setIsSaving] = useState(false);
const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
const [filterError, setFilterError] = useState<string | null>(null);
const [fieldError, setFieldError] = useState<string | null>(null);
const [previewError, setPreviewError] = useState<string | null>(null);
const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
```

**On mount:** Load all three configs from the server, then fetch workflows.

**onChange handlers:** Update the respective string state and set `hasUnsavedChanges = true`. Validate JSON for the two JSON editors and set the error state.

**handleSave:** Validate all three editors. If any JSON editor has invalid JSON, abort and show an error toast. Otherwise, save all three in sequence. On success, set `hasUnsavedChanges = false` and show a success toast.

**handleRefresh:** Fetch workflows from `GET /api/workflows`. Update `workflows` state.

**handleExportPdf:** Call `exportPdf()` from `lib/api.ts`, create an object URL, and trigger a download via a hidden `<a>` tag.

**handleCopyHtml:** Get `renderAllWorkflows(templateStr, workflows)` and write to clipboard.

---

## Step 10 — Frontend: Root Layout

Update `frontend/app/layout.tsx`:
- Import `NavSidebar`.
- Import `/styles.css` (global).
- Render: `<NavSidebar />` + `<main>{children}</main>` in a flex row that fills the viewport.

Update `frontend/app/page.tsx` to redirect to `/workflow-doc`.

---

## Step 11 — Verification Checklist

Before considering the project complete, verify:

- [ ] `server/config/` directory and all three default config files are created on first run if missing.
- [ ] `GET /api/workflows` returns shaped data using the saved filter and field configs.
- [ ] All three editors load their saved values on page load.
- [ ] Editing any editor shows the unsaved changes indicator.
- [ ] "Save Configs" saves all three and clears the unsaved indicator.
- [ ] "Refresh" re-fetches workflows and updates the preview.
- [ ] The preview renders correctly using the template.
- [ ] "Export PDF" downloads a PDF file.
- [ ] "Copy HTML" writes the rendered HTML to the clipboard.
- [ ] Invalid JSON in an editor shows an error and blocks saving.
- [ ] Skyvern API errors are surfaced to the user gracefully.
- [ ] Auto-pagination fetches all pages (test by setting `page_size=2` temporarily).

# 03 — Feature: Workflow Doc

## Overview

The Workflow Doc feature lets users:
1. Configure **which workflows to fetch** from Skyvern (filter config).
2. Configure **which fields to include** in the output, with optional parameter-level filtering (field config).
3. Define an **HTML template** that controls how each workflow entry is rendered.
4. **Preview** the rendered output live in the browser.
5. **Export as PDF** or **copy HTML to clipboard**.

---

## UI Layout (Workflow Doc page)

The page is divided into two main columns:

```
┌─────────────────┬────────────────────────────────────────────┐
│  Left Nav       │  Right Content                             │
│                 │                                            │
│  Workflow Doc   │  ┌──────────────────────────────────────┐  │
│                 │  │ TOOLBAR: [Refresh] [Export PDF]       │  │
│  (future nav    │  │          [Copy HTML]  [Save Configs]  │  │
│   items here)   │  ├───────────────┬──────────────────────┤  │
│                 │  │  Config Panel │  Preview Panel        │  │
│                 │  │               │                        │  │
│                 │  │  Filter Config│  (rendered HTML        │  │
│                 │  │  (JSON editor)│   output of all        │  │
│                 │  │               │   matching workflows)  │  │
│                 │  │  Field Config │                        │  │
│                 │  │  (JSON editor)│                        │  │
│                 │  │               │                        │  │
│                 │  │  Template     │                        │  │
│                 │  │  (HTML editor)│                        │  │
│                 │  └───────────────┴──────────────────────┘  │
└─────────────────┴────────────────────────────────────────────┘
```

- The config panel and preview panel should be horizontally split, each scrollable independently.
- The three editors in the config panel are stacked vertically with clear section headings.
- The preview panel renders a live HTML preview using `dangerouslySetInnerHTML` (the content is user-controlled server config, not untrusted third-party input).

---

## Config Panel — Three Editors

### 1. Filter Config Editor

Edits `server/config/filter-config.json`.

**Schema / example:**
```json
{
  "status": "published",
  "folder_id": ["fld_aabbccddeee"]
}
```

- `status`: string or array of strings. Valid values: `published`, `draft`, `auto_generated`, `importing`, `import_failed`.
- `folder_id`: string or array of strings (Skyvern API accepts one at a time; if array, the server fetches per folder and merges results).
- Any other top-level field recognized by the Skyvern API (see `02-SKYVERN-API.md`) is passed through as a query param.

**Default value (written to file if file does not exist):**
```json
{
  "status": "published"
}
```

---

### 2. Field Config Editor

Edits `server/config/field-config.json`.

**Schema / example:**
```json
{
  "fields": [
    "workflow_permanent_id",
    "title",
    "description",
    "workflow_definition.parameters.key",
    "workflow_definition.parameters.description",
    "workflow_definition.parameters.workflow_parameter_type",
    "webhook_callback_url"
  ],
  "filters": [
    {
      "field": "workflow_definition.parameters.parameter_type",
      "operator": "eq",
      "value": "workflow"
    }
  ]
}
```

**`fields` array:** Dot-notation paths into the workflow object. Paths that traverse into an array (e.g. `workflow_definition.parameters.key`) mean "extract this property from each element of the array."

**`filters` array:** Applied after field extraction. Each filter has:
- `field`: dot-notation path (same convention as fields).
- `operator`: `eq` | `neq` | `contains` | `startsWith`.
- `value`: the value to compare against.

Filters on array-type paths (like `workflow_definition.parameters`) filter **which array elements** are retained, not which workflows are excluded entirely.

**Default value:**
```json
{
  "fields": [
    "workflow_permanent_id",
    "title",
    "description",
    "workflow_definition.parameters.key",
    "workflow_definition.parameters.description",
    "workflow_definition.parameters.workflow_parameter_type",
    "webhook_callback_url"
  ],
  "filters": [
    {
      "field": "workflow_definition.parameters.parameter_type",
      "operator": "eq",
      "value": "workflow"
    }
  ]
}
```

---

### 3. Template Editor

Edits `server/config/doc-template.html`.

**Template syntax:** Simple `{field.path}` placeholder replacement for scalar values. For array fields (like `workflow_definition.parameters`), use a special loop syntax:

```
{{#each workflow_definition.parameters}}
  ...{key}...{description}...
{{/each}}
```

Inside a loop block, placeholders refer to properties of the current array element **without the full path prefix** — just the property name (e.g. `{key}`, `{description}`, `{workflow_parameter_type}`).

This is a minimal template engine. Implement it in `server/src/services/templateRenderer.ts`.

**Default template (write to file if not present):**
```html
<div class="workflow-entry">
  <div class="workflow-header">
    <h2 class="workflow-title">{title}</h2>
    <div class="workflow-id">{workflow_permanent_id}</div>
  </div>

  <div class="workflow-description">{description}</div>

  {{#each workflow_definition.parameters}}
  <table class="params-table">
    <thead>
      <tr>
        <th>Parameter</th>
        <th>Type</th>
        <th>Description</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td class="param-key">{key}</td>
        <td class="param-type">{workflow_parameter_type}</td>
        <td class="param-description">{description}</td>
      </tr>
    </tbody>
  </table>
  {{/each}}

  <div class="workflow-webhook">
    <span class="label">Webhook:</span>
    <span class="value">{webhook_callback_url}</span>
  </div>
</div>
<hr class="workflow-divider" />
```

---

## Backend: `/api/workflows` Route

`GET /api/workflows`

**Behavior:**
1. Read `filter-config.json` and `field-config.json` from disk.
2. Call `fetchAllWorkflows()` from `skyvernClient.ts` with mapped query params.
3. Apply `workflowFilter.ts` to the raw results using the field config.
4. Return the filtered, shaped workflow array as JSON.

**Response shape:**
```json
[
  {
    "workflow_permanent_id": "wpid_...",
    "title": "My Workflow",
    "description": "Does something useful.",
    "webhook_callback_url": "https://...",
    "workflow_definition": {
      "parameters": [
        {
          "key": "start_url",
          "workflow_parameter_type": "string",
          "description": "The URL to start on"
        }
      ]
    }
  }
]
```

Only the fields specified in `field-config.json` are included. The parameters array is already filtered by the `filters` array in the field config.

---

## Backend: `/api/config` Routes

```
GET  /api/config/filter       → returns filter-config.json content
PUT  /api/config/filter       → writes filter-config.json

GET  /api/config/fields       → returns field-config.json content
PUT  /api/config/fields       → writes field-config.json

GET  /api/config/template     → returns doc-template.html content (as plain text)
PUT  /api/config/template     → writes doc-template.html (body is plain text/html)
```

All PUT endpoints validate that the JSON is parseable (for JSON configs) before writing. Return `400` with a descriptive error if invalid.

---

## Frontend: Rendering and Export

### Live Preview

The preview panel:
1. On page load (and on each "Refresh" click), calls `GET /api/workflows` to get shaped workflow data.
2. Calls `GET /api/config/template` to get the HTML template.
3. Renders each workflow by running the template engine client-side (same logic as server-side, implemented in `frontend/lib/templateRenderer.ts`).
4. Concatenates all rendered workflow HTML strings.
5. Renders the result using `dangerouslySetInnerHTML` inside the preview panel `<div>`.

The preview panel should include the global `styles.css` so the user sees a realistic preview.

### Export as PDF

- The toolbar "Export PDF" button calls `POST /api/export/pdf`.
- The backend renders all workflows using the template (server-side), wraps the HTML in a full `<html>` document that links `styles.css`, and uses **Puppeteer** to generate a PDF.
- The PDF is streamed back to the browser with `Content-Disposition: attachment; filename="workflow-doc.pdf"`.

### Copy HTML

- The toolbar "Copy HTML" button collects the rendered HTML from the preview panel's `innerHTML` and writes it to the clipboard using `navigator.clipboard.writeText()`.

---

## Behavior Details

- **Save Configs button**: Saves all three editors' current values to the server in a single sequence of three PUT calls. Shows a success/error toast.
- **Refresh button**: Re-fetches workflows and re-renders the preview with current (saved) config.
- **Editor changes are not auto-saved**: Users must click "Save Configs" explicitly. Editors should show a visual indicator (e.g., subtle yellow border) when unsaved changes exist.
- **JSON validation**: The filter and field config editors should validate JSON on the client before allowing save, showing an inline error message if invalid.

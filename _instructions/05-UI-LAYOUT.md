# 05 — UI Layout

## Overall Shell

The app uses a fixed left sidebar + scrollable right content area layout. This shell is defined in `frontend/app/layout.tsx` and persists across all pages.

```
┌──────────────────────────────────────────────────────────┐
│ ┌─────────────┐ ┌──────────────────────────────────────┐ │
│ │             │ │                                      │ │
│ │  NavSidebar │ │  {page content}                      │ │
│ │  (fixed,    │ │  (fills remaining width, scrollable) │ │
│ │   240px)    │ │                                      │ │
│ │             │ │                                      │ │
│ └─────────────┘ └──────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────┘
```

---

## NavSidebar Component

File: `frontend/components/NavSidebar.tsx`

- App name / logo at the top: **"Skyvern Manager"**
- Navigation links below, each linking to a route:
  - **Workflow Doc** → `/workflow-doc` (active to start)
- Active link should be visually highlighted.
- Use Next.js `<Link>` with `usePathname()` to detect the active route.

---

## Workflow Doc Page Layout

File: `frontend/app/workflow-doc/page.tsx`

```
┌──────────────────────────────────────────────────────────────┐
│ Page title: "Workflow Doc"                                   │
│ Subtitle: "Generate API documentation from your workflows." │
├──────────────────────────────────────────────────────────────┤
│ TOOLBAR (horizontal row of buttons, right-aligned)           │
│  [Refresh]  [Save Configs]  [Export PDF]  [Copy HTML]        │
├──────────────────┬───────────────────────────────────────────┤
│                  │                                           │
│  CONFIG PANEL    │  PREVIEW PANEL                            │
│  (left, ~40%)    │  (right, ~60%)                            │
│                  │                                           │
│  ┌────────────┐  │  Live-rendered HTML output of all         │
│  │Filter      │  │  matching workflows, using the            │
│  │Config      │  │  current template.                        │
│  │(JSON)      │  │                                           │
│  └────────────┘  │  Rendered inside a <div> with the         │
│                  │  global stylesheet applied.               │
│  ┌────────────┐  │                                           │
│  │Field       │  │                                           │
│  │Config      │  │                                           │
│  │(JSON)      │  │                                           │
│  └────────────┘  │                                           │
│                  │                                           │
│  ┌────────────┐  │                                           │
│  │HTML        │  │                                           │
│  │Template    │  │                                           │
│  └────────────┘  │                                           │
│                  │                                           │
└──────────────────┴───────────────────────────────────────────┘
```

- Both panels should be independently scrollable (`overflow-y: auto`).
- The two-panel split and toolbar should fill the viewport height below the page title, without a page-level scrollbar.

---

## ConfigEditor Component

File: `frontend/components/ConfigEditor.tsx`

Props:
```typescript
interface ConfigEditorProps {
  label: string;          // Section heading, e.g. "Filter Config"
  value: string;          // Current JSON string value
  onChange: (val: string) => void;
  hasUnsavedChanges: boolean;
  error?: string | null;  // JSON parse error message
  language?: 'json' | 'html'; // default: 'json'
}
```

- Renders a `<label>` heading.
- Renders a `<textarea>` (or a `<pre contentEditable>` for syntax feel) for editing.
- If `hasUnsavedChanges` is true, shows a subtle yellow/amber left border on the editor.
- If `error` is non-null, shows the error message in red below the editor.
- Use a monospace font for the editor.
- Height: tall enough to show ~12–15 lines without internal scrolling; expand to content if possible.

---

## TemplateEditor Component

File: `frontend/components/TemplateEditor.tsx`

Identical to `ConfigEditor` but defaults `language` to `'html'` and uses a taller textarea (20+ lines).

---

## DocToolbar Component

File: `frontend/components/DocToolbar.tsx`

Props:
```typescript
interface DocToolbarProps {
  onRefresh: () => void;
  onSave: () => void;
  onExportPdf: () => void;
  onCopyHtml: () => void;
  isSaving: boolean;
  isRefreshing: boolean;
  hasUnsavedChanges: boolean;
}
```

- Buttons are right-aligned in a horizontal bar.
- "Save Configs" button shows a spinner when `isSaving` is true.
- "Save Configs" button is highlighted (e.g., amber) when `hasUnsavedChanges` is true.
- "Refresh" button shows a spinner when `isRefreshing` is true.

---

## Toast Notifications

Use a simple custom toast system (no external library required):
- Appears briefly (3 seconds) in the bottom-right corner.
- Green for success, red for error.
- Messages: "Config saved successfully", "Failed to save config: [error]", "Copied to clipboard", "PDF exported".

---

## Global Stylesheet

File: `frontend/public/styles.css`

This file is **managed outside the features of this project**. Do not generate its content — just ensure it is:
1. Created as an empty file (with a comment block at the top explaining its purpose).
2. Linked in the `<head>` of the exported PDF HTML document (as a relative path).
3. Imported in `frontend/app/layout.tsx` so it applies to the preview panel.

The preview panel `<div>` should have a class `workflow-doc-preview` so the stylesheet author can scope styles to it.

---

## CSS Modules

For component-level styles, use CSS Modules (`.module.css` files). Keep structural/layout styles in modules; leave semantic/content styles (like `.workflow-title`, `.param-key`) for `styles.css`.

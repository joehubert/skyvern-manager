# 01 — Architecture

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend runtime | Node.js 20+ with TypeScript |
| Backend framework | Express 4 |
| Frontend framework | Next.js 14 (App Router) |
| Styling | CSS Modules + a global `styles.css` stylesheet managed outside app features |
| PDF export | Puppeteer (server-side, via a dedicated API endpoint) |
| Config persistence | JSON files on the server filesystem |
| Template persistence | HTML file on the server filesystem |

---

## Folder Structure

```
skyvern-manager/
├── server/                        # Express backend
│   ├── src/
│   │   ├── index.ts               # Entry point, Express app setup
│   │   ├── routes/
│   │   │   ├── workflows.ts       # GET /api/workflows — fetch & filter from Skyvern
│   │   │   └── config.ts          # GET/PUT /api/config — read/write config files
│   │   ├── services/
│   │   │   ├── skyvernClient.ts   # Skyvern API HTTP client (pagination, auth)
│   │   │   ├── configService.ts   # Read/write JSON config and template files
│   │   │   └── workflowFilter.ts  # Apply filter config + field config to raw workflows
│   │   └── types/
│   │       └── index.ts           # Shared TypeScript interfaces
│   ├── config/                    # Server-side persisted config files
│   │   ├── filter-config.json     # Workflow filter config (which workflows to fetch)
│   │   ├── field-config.json      # Field selection + parameter filter config
│   │   └── doc-template.html      # HTML template for rendering each workflow
│   ├── package.json
│   ├── tsconfig.json
│   └── .env                       # Environment variables (never commit)
│
├── frontend/                      # Next.js app
│   ├── app/
│   │   ├── layout.tsx             # Root layout with left nav
│   │   ├── page.tsx               # Redirect to /workflow-doc
│   │   └── workflow-doc/
│   │       └── page.tsx           # Workflow Doc feature page
│   ├── components/
│   │   ├── NavSidebar.tsx         # Left navigation component
│   │   ├── ConfigEditor.tsx       # JSON editor panel (shared, reusable)
│   │   ├── TemplateEditor.tsx     # HTML template editor panel
│   │   ├── WorkflowDocPreview.tsx # Live preview panel
│   │   └── DocToolbar.tsx         # Export PDF / Copy buttons
│   ├── lib/
│   │   └── api.ts                 # Frontend API client (calls Express backend)
│   ├── public/
│   │   └── styles.css             # Global stylesheet (managed outside app features)
│   ├── package.json
│   └── tsconfig.json
│
├── .gitignore
└── README.md
```

---

## Environment Variables

Create `server/.env` with the following:

```env
# Skyvern API
SKYVERN_API_KEY=your_api_key_here
SKYVERN_BASE_URL=https://api.skyvern.com/v1

# Server
PORT=3001

# Paths
CONFIG_DIR=./config
```

The Next.js frontend runs on port `3000` (default). It proxies API calls to the Express server on port `3001` via `next.config.js` rewrites.

---

## next.config.js Proxy Rewrite

```js
// frontend/next.config.js
const nextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:3001/api/:path*',
      },
    ];
  },
};
module.exports = nextConfig;
```

This means the frontend always calls `/api/...` and never hardcodes the backend port.

---

## Scripts

Each package should have these scripts:

**server/package.json**
```json
{
  "scripts": {
    "dev": "ts-node-dev --respawn src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js"
  }
}
```

**frontend/package.json**
```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start"
  }
}
```

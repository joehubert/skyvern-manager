# Skyvern Manager

A self-hosted web application that provides utility and productivity features for users of the [Skyvern](https://skyvern.com) cloud automation platform. It acts as a management layer on top of the Skyvern API, enabling workflows and workflow runs to be viewed, filtered, analysed, and exported in ways the native Skyvern UI does not support.

No database or authentication layer is required. Configuration is stored as JSON files on the server filesystem and can be edited directly in the app.

---

## Setup

### 1. Configure your environment

Copy `server/.env.example` to `server/.env` and fill in your Skyvern API key:

```env
SKYVERN_API_KEY=your_api_key_here
SKYVERN_BASE_URL=https://api.skyvern.com/v1
PORT=3001
CONFIG_DIR=./config
```

### 2. Install dependencies

```bash
npm run install:all
```

This installs dependencies for both the server and frontend in one step.

### 3. Start the application

```bash
npm run dev
```

This starts both the Express backend (port `3001`) and the Next.js frontend (port `3000`) concurrently. Open [http://localhost:3000](http://localhost:3000) in your browser.

> **Alternatively**, you can start each process separately in two terminals:
> ```bash
> # Terminal 1
> cd server && npm run dev
>
> # Terminal 2
> cd frontend && npm run dev
> ```

---

## Features

### Workflow Doc — `/workflow-doc`

Fetches your Skyvern workflows and renders them as structured API documentation.

- **Filter Config** — JSON editor to control which workflows are fetched from the Skyvern API (by status, folder, search key, etc.).
- **Field Config** — JSON editor to select which workflow fields appear in the rendered output.
- **HTML Template** — editor for the per-workflow HTML template that drives the document layout and presentation.
- **Live Preview** — real-time preview panel that reflects your current config and template.
- **Export** — copy the rendered HTML to your clipboard.

---

### Run Analytics — `/run-analytics`

Fetches workflow runs from the Skyvern API, applies client-side filtering, and aggregates results into a summary metrics table.

- **Workflow Filter** — JSON editor to select which workflows are included in the analysis (by status, folder ID, etc.).
- **Cut-off Timestamp** — date/time picker that limits results to runs on or after the selected time, with an early-exit optimisation to avoid fetching unnecessary pages.
- **Excluded Statuses** — runs with statuses such as `queued` or `running` are excluded by default (configurable via env var).
- **Aggregated Metrics** — results are grouped by workflow title and show: total run count, completed count, unsuccessful count, and average / max / min run time for completed runs.
- **Export** — sortable in-browser table with CSV export.

---

### Workflow Run Explorer — `/workflow-run-explorer`

Provides a paginated, browsable table of individual workflow runs fetched directly from the Skyvern API.

- **Run Table** — displays Run ID, Workflow, Status (colour-coded badge), and Created At timestamp.
- **Inline Detail Panel** — clicking a row opens a detail panel without changing the route, showing:
  - **JSON Path Inspector** — enter a dot-notation path (e.g. `failure_reason`) to extract a specific value from the run object, with autocomplete suggestions.
  - **Raw JSON Viewer** — full run object in a scrollable, copyable block.
- **Pagination** — Previous / Next navigation; excluded-status filtering is applied client-side after each page is returned.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Node.js 20+ / TypeScript / Express 4 |
| Frontend | Next.js 14 (App Router) |
| Styling | CSS Modules + global `styles.css` |
| Config Storage | JSON files in `server/config/` |

---

## Project Structure

```
skyvern-manager/
├── server/
│   ├── src/
│   │   ├── routes/           # Express route handlers
│   │   ├── services/         # Business logic (Skyvern client, config, aggregation)
│   │   └── types/            # Shared TypeScript interfaces
│   ├── config/               # Persisted user config (JSON files)
│   └── .env                  # API key and env vars (never commit)
├── frontend/
│   ├── app/                  # Next.js App Router pages
│   ├── components/           # Shared React components (NavSidebar, etc.)
│   ├── lib/                  # API client, types, utilities
│   └── public/styles.css     # Global stylesheet
├── package.json              # Root scripts (dev, build, install:all)
└── README.md
```


## Corporate Proxy / SSL Setup (Server)

If you are running this project behind a corporate firewall (AVD/VPN) and see `AxiosError: self-signed certificate`, follow these steps in the `server` directory.

### 1. Export the Corporate Root Certificate
1.  Open Chrome/Edge and navigate to `https://skyvern.com`.
2.  Click the **Lock icon (🔒)** in the address bar $\to$ **Connection is secure** $\to$ **Certificate is valid**.
3.  Go to the **Certification Path** (or Details) tab.
4.  Select the **top-most** certificate in the hierarchy (e.g., *Zscaler*, *Fortinet*, or *Internal CA*). **Do not** select `skyvern.com`.
5.  Click **Export** (or View Certificate $\to$ Details $\to$ Copy to File).
6.  Select format: **Base-64 encoded X.509 (.CER/.PEM)**.
7.  Save the file as `corporate-ca.pem` inside the `server` folder.

### 2. Install Cross-Env
Open your terminal, navigate to the server directory, and install the helper tool:

```bash
cd server
npm install -D cross-env
```

### 3. Add the Dev Script
Open `server/package.json` and add the `dev-cert` script to the `"scripts"` section.

*Note: This assumes you placed the certificate file directly in the `server` folder.*

```json
"scripts": {
  "dev": "tsx watch src/index.ts",
  "dev-cert": "cross-env NODE_EXTRA_CA_CERTS=./corporate-ca.pem tsx watch src/index.ts"
}
```

### 4. Run the Server
Use the new command to start the server with the certificate trusted:

```bash
npm run dev-cert
```
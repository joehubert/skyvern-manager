# Skyvern Manager — Project Overview

## What You Are Building

A web application called **Skyvern Manager** that provides utility features for users of the [Skyvern](https://skyvern.com) cloud automation platform.

The app consists of:
- A **TypeScript/Node.js backend** (Express) that proxies Skyvern API calls, manages server-side config files, and serves the Next.js app.
- A **Next.js frontend** with a standard left-nav / right-content layout.

## Instruction File Index

Read these files in order before writing any code:

| File | Purpose |
|------|---------|
| `00-PROJECT-OVERVIEW.md` | This file — start here |
| `01-ARCHITECTURE.md` | Tech stack, folder structure, environment setup |
| `02-SKYVERN-API.md` | Skyvern API details, authentication, pagination |
| `03-FEATURE-WORKFLOW-DOC.md` | Full specification for the Workflow Doc feature |
| `04-DATA-MODELS.md` | TypeScript interfaces and JSON config schemas |
| `05-UI-LAYOUT.md` | Navigation structure and UI conventions |
| `06-IMPLEMENTATION-PLAN.md` | Step-by-step build order |

## Core Principles

- **One feature to start**: Workflow Doc. Build the infrastructure to support future features cleanly.
- **Config files are the source of truth** for user preferences (filter config, field config, HTML template). They live on the server as JSON/HTML files.
- **No database** is needed at this stage.
- **Keep it deployable anywhere**: no hard-coded ports or paths; use environment variables.

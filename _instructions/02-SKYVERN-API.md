# 02 — Skyvern API

## Base URL

```
https://api.skyvern.com/v1
```

## Authentication

All requests require the header:

```
x-api-key: <SKYVERN_API_KEY>
```

The key is loaded from `server/.env` and never exposed to the frontend.

---

## Get Workflows Endpoint

```
GET /v1/workflows
```

### Query Parameters

| Parameter | Type | Default | Notes |
|-----------|------|---------|-------|
| `page` | integer | 1 | 1-based page number |
| `page_size` | integer | 10 | Results per page |
| `folder_id` | string | — | Filter by folder ID |
| `status` | enum list | — | `published`, `draft`, `auto_generated`, `importing`, `import_failed` |
| `only_workflows` | boolean | false | Exclude saved tasks |
| `only_saved_tasks` | boolean | false | Exclude workflows |
| `only_templates` | boolean | false | Only return templates |
| `search_key` | string | — | Substring search across title, folder, and parameter metadata |

### Response

Returns a JSON **array** of workflow objects. See `04-DATA-MODELS.md` for the full TypeScript interface.

---

## Pagination Strategy

The `GET /v1/workflows` endpoint is paginated with `page` and `page_size` parameters.

**The app must fetch all pages automatically:**

1. Start with `page=1`, `page_size=100` (use 100 to minimize round trips).
2. If the response array length equals `page_size`, increment the page counter and fetch again.
3. Continue until a response returns fewer items than `page_size`.
4. Concatenate all results before applying the local filter and field config.

Implement this logic in `server/src/services/skyvernClient.ts` in a function called `fetchAllWorkflows(queryParams)`.

```typescript
// Pseudocode
async function fetchAllWorkflows(queryParams: SkyvernQueryParams): Promise<RawWorkflow[]> {
  const results: RawWorkflow[] = [];
  let page = 1;
  const page_size = 100;
  while (true) {
    const batch = await fetchPage({ ...queryParams, page, page_size });
    results.push(...batch);
    if (batch.length < page_size) break;
    page++;
  }
  return results;
}
```

---

## Filter Config Mapping to API Params

When the server receives a request to fetch workflows, it reads `filter-config.json` and translates supported top-level fields into Skyvern API query params **before** making the HTTP request.

Fields that map directly to API query params:
- `status` → `status` (pass as repeated query param if array)
- `folder_id` → `folder_id` (pass first value if array; Skyvern only accepts one)
- `only_workflows` → `only_workflows`
- `only_saved_tasks` → `only_saved_tasks`
- `only_templates` → `only_templates`
- `search_key` → `search_key`

Any additional fields in the filter config that are **not** supported as API query params should be applied as **client-side post-filters** in `workflowFilter.ts` after all pages are fetched.

---

## Error Handling

- On HTTP 4xx/5xx from Skyvern, the Express route should return a structured error response:
  ```json
  { "error": "Skyvern API error", "status": 422, "detail": "..." }
  ```
- Log the full Skyvern response to the server console for debugging.
- The frontend should display a user-friendly error message when the API returns an error.

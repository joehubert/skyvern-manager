import axios from 'axios';
import {
  SkyvernWorkflow,
  SkyvernWorkflowRun,
  WorkflowFilterConfig,
  WorkflowRunSummary,
  WorkflowStatusRow,
} from '../types';

function getBaseUrl(): string {
  return process.env.SKYVERN_BASE_URL ?? 'https://api.skyvern.com/v1';
}

function getApiKey(): string {
  return process.env.SKYVERN_API_KEY ?? '';
}

function serializeParams(p: Record<string, string | string[]>): string {
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(p)) {
    if (Array.isArray(value)) {
      for (const v of value) searchParams.append(key, v);
    } else {
      searchParams.append(key, value);
    }
  }
  return searchParams.toString();
}

// Step 1 — fetch eligible workflow permanent IDs based on filter config
export async function fetchEligibleWorkflowIds(
  filter: WorkflowFilterConfig
): Promise<Set<string>> {
  const PAGE_SIZE = 100;
  const ids = new Set<string>();
  let page = 1;

  while (true) {
    const params: Record<string, string | string[]> = {
      page: String(page),
      page_size: String(PAGE_SIZE),
    };

    if (filter.status && filter.status.length > 0) {
      params['status'] = filter.status;
    }
    if (filter.folder_id && filter.folder_id.length > 0) {
      params['folder_id'] = filter.folder_id;
    }
    if (filter.search_key) {
      params['search_key'] = filter.search_key;
    }

    const response = await axios.get<SkyvernWorkflow[]>(`${getBaseUrl()}/workflows`, {
      headers: { 'x-api-key': getApiKey() },
      params,
      paramsSerializer: serializeParams,
    });

    const batch = response.data;
    for (const wf of batch) {
      ids.add(wf.workflow_permanent_id);
    }

    if (batch.length < PAGE_SIZE) break;
    page++;
  }

  return ids;
}

// Step 2 — fetch workflow runs with early-exit pagination, then filter
export async function fetchFilteredRuns(
  eligibleIds: Set<string>,
  cutoffTimestamp: string,
  excludeStatuses: string[]
): Promise<SkyvernWorkflowRun[]> {
  const pageSize = parseInt(process.env.RUN_ANALYTICS_PAGE_SIZE ?? '20', 10);
  const cutoffMs = new Date(cutoffTimestamp).getTime();

  const collected: SkyvernWorkflowRun[] = [];
  let page = 1;

  while (true) {
    const params: Record<string, string | string[]> = {
      page: String(page),
      page_size: String(pageSize),
    };

    const response = await axios.get<SkyvernWorkflowRun[]>(`${getBaseUrl()}/workflows/runs`, {
      headers: { 'x-api-key': getApiKey() },
      params,
      paramsSerializer: serializeParams,
    });

    const batch = response.data;
    if (batch.length === 0) break;

    // Filter out excluded statuses for collection
    const eligible = batch.filter((r) => !excludeStatuses.includes(r.status));
    collected.push(...eligible);

    // Early-exit: find the earliest started_at in the raw page
    let isLastPage = batch.length < pageSize;
    if (!isLastPage) {
      const earliestStarted = batch
        .map((r) => (r.started_at ? new Date(r.started_at).getTime() : null))
        .filter((t): t is number => t !== null)
        .reduce((min, t) => (t < min ? t : min), Infinity);

      if (earliestStarted !== Infinity && earliestStarted < cutoffMs) {
        isLastPage = true;
      }
    }

    if (isLastPage) break;
    page++;
  }

  // Final client-side filters
  return collected.filter((r) => {
    if (!r.started_at || new Date(r.started_at).getTime() < cutoffMs) return false;
    if (!eligibleIds.has(r.workflow_permanent_id)) return false;
    return true;
  });
}

// Step 3 — aggregate runs into per-workflow summaries with per-status sub-rows
export function aggregateRuns(runs: SkyvernWorkflowRun[]): WorkflowRunSummary[] {
  const titleGroups = new Map<string, SkyvernWorkflowRun[]>();
  for (const run of runs) {
    const title = run.workflow_title ?? '(Untitled)';
    if (!titleGroups.has(title)) titleGroups.set(title, []);
    titleGroups.get(title)!.push(run);
  }

  const summaries: WorkflowRunSummary[] = [];

  for (const [workflow_title, group] of titleGroups) {
    const statusGroups = new Map<string, SkyvernWorkflowRun[]>();
    for (const run of group) {
      if (!statusGroups.has(run.status)) statusGroups.set(run.status, []);
      statusGroups.get(run.status)!.push(run);
    }

    const status_rows: WorkflowStatusRow[] = [];
    for (const [status, statusGroup] of statusGroups) {
      const durations = statusGroup
        .filter((r) => r.started_at && r.finished_at)
        .map(
          (r) =>
            (new Date(r.finished_at!).getTime() - new Date(r.started_at!).getTime()) / 1000
        );

      status_rows.push({
        status,
        count: statusGroup.length,
        avg_run_time_seconds:
          durations.length > 0
            ? durations.reduce((sum, d) => sum + d, 0) / durations.length
            : null,
        max_run_time_seconds: durations.length > 0 ? Math.max(...durations) : null,
        min_run_time_seconds: durations.length > 0 ? Math.min(...durations) : null,
      });
    }

    status_rows.sort((a, b) => b.count - a.count);

    // Use the first run's workflow_permanent_id for this group
    const workflow_permanent_id = group[0]?.workflow_permanent_id ?? '';

    summaries.push({
      workflow_title,
      workflow_permanent_id,
      total_count: group.length,
      status_rows,
    });
  }

  return summaries.sort((a, b) => b.total_count - a.total_count);
}

// PDF helpers

function formatDurationServer(seconds: number | null): string {
  if (seconds === null) return '—';
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600)
    return `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`;
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m ${Math.round(seconds % 60)}s`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function buildReportHtml(
  summaries: WorkflowRunSummary[],
  cutoffTimestamp: string
): string {
  const rows = summaries
    .map(
      (s) => `
    <tr>
      <td>${escapeHtml(s.workflow_title)}</td>
      <td>${s.total_count}</td>
      <td>${s.completed_count}</td>
      <td>${s.unsuccessful_count}</td>
      <td>${formatDurationServer(s.avg_run_time_seconds)}</td>
      <td>${formatDurationServer(s.max_run_time_seconds)}</td>
      <td>${formatDurationServer(s.min_run_time_seconds)}</td>
    </tr>`
    )
    .join('');

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

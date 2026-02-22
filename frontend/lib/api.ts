import { FilterConfig, FieldConfig, RunAnalyticsSettings, WorkflowFilterConfig, WorkflowRunSummary, WorkflowRunsResponse } from './types';

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, options);
  if (!res.ok) {
    let detail = '';
    try {
      const body = await res.json();
      detail = body.error ?? JSON.stringify(body);
    } catch {
      detail = await res.text();
    }
    throw new Error(detail || `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export async function getFilterConfig(): Promise<FilterConfig> {
  const result = await fetchJson<{ data: FilterConfig }>('/api/config/filter');
  return result.data;
}

export async function saveFilterConfig(config: FilterConfig): Promise<void> {
  await fetchJson('/api/config/filter', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  });
}

export async function getFieldConfig(): Promise<FieldConfig> {
  const result = await fetchJson<{ data: FieldConfig }>('/api/config/fields');
  return result.data;
}

export async function saveFieldConfig(config: FieldConfig): Promise<void> {
  await fetchJson('/api/config/fields', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  });
}

export async function getTemplate(): Promise<string> {
  const res = await fetch('/api/config/template');
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  return res.text();
}

export async function saveTemplate(template: string): Promise<void> {
  const res = await fetch('/api/config/template', {
    method: 'PUT',
    headers: { 'Content-Type': 'text/plain' },
    body: template,
  });
  if (!res.ok) {
    let detail = '';
    try {
      const body = await res.json();
      detail = body.error ?? JSON.stringify(body);
    } catch {
      detail = await res.text();
    }
    throw new Error(detail || `HTTP ${res.status}`);
  }
}

export async function getWorkflows(): Promise<Record<string, unknown>[]> {
  return fetchJson<Record<string, unknown>[]>('/api/workflows');
}

export async function updateWorkflowDescription(
  workflowId: string,
  description: string
): Promise<void> {
  await fetchJson(`/api/workflows/${encodeURIComponent(workflowId)}/description`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ description }),
  });
}

export async function exportPdf(): Promise<Blob> {
  const res = await fetch('/api/export/pdf', { method: 'POST' });
  if (!res.ok) {
    let detail = '';
    try {
      const body = await res.json();
      detail = body.error ?? JSON.stringify(body);
    } catch {
      detail = await res.text();
    }
    throw new Error(detail || `HTTP ${res.status}`);
  }
  return res.blob();
}

// --- Run Analytics ---

export async function getRunAnalyticsSettings(): Promise<RunAnalyticsSettings> {
  return fetchJson<RunAnalyticsSettings>('/api/run-analytics/settings');
}

export async function saveRunAnalyticsSettings(settings: RunAnalyticsSettings): Promise<void> {
  await fetchJson('/api/run-analytics/settings', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(settings),
  });
}

export async function getRunAnalyticsWorkflowFilter(): Promise<WorkflowFilterConfig> {
  return fetchJson<WorkflowFilterConfig>('/api/run-analytics/workflow-filter');
}

export async function saveRunAnalyticsWorkflowFilter(filter: WorkflowFilterConfig): Promise<void> {
  await fetchJson('/api/run-analytics/workflow-filter', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(filter),
  });
}

export async function getRunAnalyticsResults(): Promise<WorkflowRunSummary[]> {
  return fetchJson<WorkflowRunSummary[]>('/api/run-analytics/results');
}

// --- Workflow Run Explorer ---

export async function fetchWorkflowRuns(page: number): Promise<WorkflowRunsResponse> {
  const res = await fetch(`/api/workflow-runs?page=${page}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }
  return res.json();
}

export async function fetchWorkflowRun(runId: string): Promise<Record<string, unknown>> {
  const res = await fetch(`/api/workflow-runs/${encodeURIComponent(runId)}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }
  return res.json();
}

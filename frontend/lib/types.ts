export interface FilterConfig {
  status?: string | string[];
  folder_id?: string | string[];
  only_workflows?: boolean;
  only_saved_tasks?: boolean;
  only_templates?: boolean;
  search_key?: string;
  [key: string]: unknown;
}

export type FilterOperator = 'eq' | 'neq' | 'contains' | 'startsWith';

export interface FieldFilter {
  field: string;
  operator: FilterOperator;
  value: string | number | boolean;
}

export interface FieldConfig {
  fields: string[];
  filters: FieldFilter[];
}

// --- Workflow Run Explorer ---

export interface WorkflowRun {
  workflow_run_id: string;
  workflow_id: string;
  workflow_permanent_id: string | null;
  organization_id: string;
  browser_session_id: string | null;
  browser_profile_id: string | null;
  debug_session_id: string | null;
  status: string;
  extra_http_headers: Record<string, string> | null;
  proxy_location: string | null;
  webhook_callback_url: string | null;
  webhook_failure_reason: string | null;
  totp_verification_url: string | null;
  totp_identifier: string | null;
  failure_reason: string | null;
  parent_workflow_run_id: string | null;
  workflow_title: string | null;
  max_screenshot_scrolls: number | null;
  browser_address: string | null;
  run_with: string | null;
  script_run: unknown | null;
  job_id: string | null;
  depends_on_workflow_run_id: string | null;
  sequential_key: string | null;
  ai_fallback: boolean | null;
  code_gen: unknown | null;
  waiting_for_verification_code: boolean | null;
  verification_code_identifier: string | null;
  verification_code_polling_started_at: string | null;
  queued_at: string | null;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
  modified_at: string;
}

export interface WorkflowRunsResponse {
  runs: WorkflowRun[];
  page: number;
  page_size: number;
  has_more: boolean;
}

// --- Run Analytics ---

export interface WorkflowFilterConfig {
  status?: string[];
  folder_id?: string[];
  search_key?: string;
}

export interface RunAnalyticsSettings {
  cutoff_timestamp: string;
}

export interface WorkflowStatusRow {
  status: string;
  count: number;
  avg_run_time_seconds: number | null;
  max_run_time_seconds: number | null;
  min_run_time_seconds: number | null;
}

export interface WorkflowRunSummary {
  workflow_title: string;
  workflow_permanent_id: string;
  total_count: number;
  status_rows: WorkflowStatusRow[];
}

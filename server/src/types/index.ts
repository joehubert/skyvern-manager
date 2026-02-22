export interface WorkflowParameter {
  parameter_type: 'output' | 'workflow';
  key: string;
  description?: string | null;
  output_parameter_id?: string | null;
  workflow_parameter_id?: string | null;
  workflow_parameter_type?: string | null;
  workflow_id: string;
  default_value?: string | number | boolean | null;
  created_at: string;
  modified_at: string;
  deleted_at?: string | null;
}

export interface WorkflowBlock {
  label: string;
  next_block_label?: string | null;
  block_type: string;
  output_parameter?: object | null;
  continue_on_failure?: boolean;
  model?: { model_name?: string };
  disable_cache?: boolean;
  next_loop_on_failure?: boolean;
  task_type?: string;
  url?: string;
  title?: string;
  engine?: string;
  navigation_goal?: string;
  data_extraction_goal?: string | null;
  data_schema?: object | null;
  error_code_mapping?: object | null;
  max_retries?: number;
  max_steps_per_run?: number | null;
  parameters?: unknown[];
  complete_on_download?: boolean;
  download_suffix?: string | null;
  totp_verification_url?: string | null;
  totp_identifier?: string | null;
  complete_verification?: boolean;
  include_action_history_in_verification?: boolean;
  download_timeout?: number | null;
}

export interface WorkflowDefinition {
  version: number;
  parameters: WorkflowParameter[];
  blocks: WorkflowBlock[];
  finally_block_label?: string | null;
}

export interface RawWorkflow {
  workflow_id: string;
  organization_id: string;
  title: string;
  workflow_permanent_id: string;
  version: number;
  is_saved_task: boolean;
  is_template?: boolean | null;
  description?: string | null;
  workflow_definition: WorkflowDefinition;
  proxy_location?: string;
  webhook_callback_url?: string | null;
  totp_verification_url?: string | null;
  totp_identifier?: string | null;
  persist_browser_session?: boolean;
  model?: object | null;
  status: 'published' | 'draft' | 'auto_generated' | 'importing' | 'import_failed';
  max_screenshot_scrolls?: number | null;
  extra_http_headers?: Record<string, string>;
  run_with?: string | null;
  ai_fallback?: boolean;
  cache_key?: string | null;
  run_sequentially?: boolean;
  sequential_key?: string | null;
  folder_id?: string | null;
  import_error?: string | null;
  created_at: string;
  modified_at?: string;
  deleted_at?: string | null;
}

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

// --- Run Analytics: Skyvern API shapes ---

export interface SkyvernWorkflow {
  workflow_id: string;
  workflow_permanent_id: string;
  title: string;
  status: string;
  folder_id: string | null;
}

export interface SkyvernWorkflowRun {
  workflow_run_id: string;
  workflow_id: string;
  workflow_permanent_id: string;
  workflow_title: string | null;
  status: string;
  started_at: string | null;
  finished_at: string | null;
  queued_at: string | null;
}

// --- Run Analytics: Config shapes ---

export interface WorkflowFilterConfig {
  status?: string[];
  folder_id?: string[];
  search_key?: string;
}

export interface RunAnalyticsSettings {
  cutoff_timestamp: string;
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

// --- Run Analytics: Aggregated output ---

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

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

// --- Run Analytics ---

export interface WorkflowFilterConfig {
  status?: string[];
  folder_id?: string[];
  search_key?: string;
}

export interface RunAnalyticsSettings {
  cutoff_timestamp: string;
}

export interface WorkflowRunSummary {
  workflow_title: string;
  total_count: number;
  completed_count: number;
  unsuccessful_count: number;
  avg_run_time_seconds: number | null;
  max_run_time_seconds: number | null;
  min_run_time_seconds: number | null;
}

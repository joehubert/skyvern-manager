# 04 — Data Models

## TypeScript Interfaces

Place shared interfaces in `server/src/types/index.ts`.

---

### Raw Workflow (from Skyvern API)

```typescript
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
```

---

### Config File Schemas

```typescript
// server/config/filter-config.json
export interface FilterConfig {
  status?: string | string[];
  folder_id?: string | string[];
  only_workflows?: boolean;
  only_saved_tasks?: boolean;
  only_templates?: boolean;
  search_key?: string;
  [key: string]: unknown; // allows pass-through of other Skyvern query params
}

// server/config/field-config.json
export type FilterOperator = 'eq' | 'neq' | 'contains' | 'startsWith';

export interface FieldFilter {
  field: string;       // dot-notation path, e.g. "workflow_definition.parameters.parameter_type"
  operator: FilterOperator;
  value: string | number | boolean;
}

export interface FieldConfig {
  fields: string[];    // dot-notation paths to include in output
  filters: FieldFilter[];
}
```

---

### Shaped Workflow (output of workflowFilter.ts)

The shaped workflow is a plain object containing only the keys specified in `field-config.json`, with the same nested structure as the original. For example, given the default field config, a shaped workflow looks like:

```typescript
// This is illustrative — the actual type is Record<string, unknown>
// because it is dynamically constructed from the field config.
{
  workflow_permanent_id: string;
  title: string;
  description: string | null;
  webhook_callback_url: string | null;
  workflow_definition: {
    parameters: Array<{
      key: string;
      description: string | null;
      workflow_parameter_type: string | null;
    }>;
  };
}
```

Use `Record<string, unknown>` as the TypeScript type for shaped workflows throughout the codebase.

---

## workflowFilter.ts Logic

The filter service must:

1. **Apply parameter-level filters first.** For any filter whose path starts with `workflow_definition.parameters.`, filter the `parameters` array of each workflow to only include elements that match.

2. **Apply field selection.** Walk each field path in the `fields` array and extract only those values from the (now-filtered) raw workflow. Build a new plain object with the same nested key structure.

3. **Handle dot-notation path extraction** correctly:
   - `"title"` → scalar string.
   - `"workflow_definition.parameters.key"` → means include the `key` property inside each element of the `parameters` array. The resulting shaped object should have `workflow_definition.parameters` as an array of objects, each containing only the selected sub-properties.

### Path Extraction Algorithm (pseudocode)

```
For each field path in fields:
  Split by "."
  Walk the raw workflow object following the path segments.
  If a segment resolves to an array, the remaining path segments apply
    to each element of the array.
  Set the extracted value at the equivalent nested path in the output object.
  Multiple fields sharing the same array path are merged per-element
    into the same output array objects.
```

---

## templateRenderer.ts Logic

A lightweight template engine. Implement in both `server/src/services/templateRenderer.ts` and mirror as `frontend/lib/templateRenderer.ts`.

**Algorithm:**

```
function renderWorkflow(template: string, workflow: Record<string, unknown>): string:
  1. Find all {{#each <path>}} ... {{/each}} blocks.
  2. For each loop block:
     a. Resolve <path> against the workflow object to get an array.
     b. For each element in the array, render the inner block content
        by replacing {propertyName} placeholders with element[propertyName].
     c. Concatenate all rendered inner blocks.
     d. Replace the entire {{#each}}...{{/each}} block with the concatenated output.
  3. Replace remaining {field.path} placeholders by resolving the dot-notation
     path against the workflow object.
  4. Replace any unresolved placeholders with an empty string.
  5. Return the resulting HTML string.
```

Note: `{description}` inside a loop block refers to the loop element's `description`. Outside a loop, `{description}` resolves against the top-level workflow object.

import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import { FilterConfig, FieldConfig } from '../types';

const DEFAULT_FILTER_CONFIG: FilterConfig = {
  status: 'published',
};

const DEFAULT_FIELD_CONFIG: FieldConfig = {
  fields: [
    'workflow_permanent_id',
    'title',
    'description',
    'workflow_definition.parameters.key',
    'workflow_definition.parameters.description',
    'workflow_definition.parameters.workflow_parameter_type',
    'webhook_callback_url',
  ],
  filters: [
    {
      field: 'workflow_definition.parameters.parameter_type',
      operator: 'eq',
      value: 'workflow',
    },
  ],
};

const DEFAULT_TEMPLATE = `<div class="workflow-entry">
  <div class="workflow-header">
    <h2 class="workflow-title">{title}</h2>
    <div class="workflow-id">{workflow_permanent_id}</div>
  </div>

  <div class="workflow-description">{description}</div>

  {{#each workflow_definition.parameters}}
  <table class="params-table">
    <thead>
      <tr>
        <th>Parameter</th>
        <th>Type</th>
        <th>Description</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td class="param-key">{key}</td>
        <td class="param-type">{workflow_parameter_type}</td>
        <td class="param-description">{description}</td>
      </tr>
    </tbody>
  </table>
  {{/each}}

  <div class="workflow-webhook">
    <span class="label">Webhook:</span>
    <span class="value">{webhook_callback_url}</span>
  </div>
</div>
<hr class="workflow-divider" />`;

function getConfigDir(): string {
  return path.resolve(process.env.CONFIG_DIR ?? './config');
}

async function ensureFile(filePath: string, defaultContent: string): Promise<void> {
  try {
    await fs.access(filePath);
  } catch {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, defaultContent, 'utf-8');
  }
}

export async function readFilterConfig(): Promise<FilterConfig> {
  const filePath = path.join(getConfigDir(), 'filter-config.json');
  await ensureFile(filePath, JSON.stringify(DEFAULT_FILTER_CONFIG, null, 2));
  const content = await fs.readFile(filePath, 'utf-8');
  return JSON.parse(content) as FilterConfig;
}

export async function writeFilterConfig(config: FilterConfig): Promise<void> {
  const filePath = path.join(getConfigDir(), 'filter-config.json');
  await fs.writeFile(filePath, JSON.stringify(config, null, 2), 'utf-8');
}

export async function readFieldConfig(): Promise<FieldConfig> {
  const filePath = path.join(getConfigDir(), 'field-config.json');
  await ensureFile(filePath, JSON.stringify(DEFAULT_FIELD_CONFIG, null, 2));
  const content = await fs.readFile(filePath, 'utf-8');
  return JSON.parse(content) as FieldConfig;
}

export async function writeFieldConfig(config: FieldConfig): Promise<void> {
  const filePath = path.join(getConfigDir(), 'field-config.json');
  await fs.writeFile(filePath, JSON.stringify(config, null, 2), 'utf-8');
}

export async function readTemplate(): Promise<string> {
  const filePath = path.join(getConfigDir(), 'doc-template.html');
  await ensureFile(filePath, DEFAULT_TEMPLATE);
  return fs.readFile(filePath, 'utf-8');
}

export async function writeTemplate(template: string): Promise<void> {
  const filePath = path.join(getConfigDir(), 'doc-template.html');
  await fs.writeFile(filePath, template, 'utf-8');
}

export function loadConfig<T>(filename: string): T {
  const filePath = path.join(getConfigDir(), filename);
  const content = fsSync.readFileSync(filePath, 'utf-8');
  return JSON.parse(content) as T;
}

export async function saveConfig<T>(filename: string, data: T): Promise<void> {
  const filePath = path.join(getConfigDir(), filename);
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

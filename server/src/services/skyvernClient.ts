import axios from 'axios';
import { RawWorkflow, FilterConfig } from '../types';

const PAGE_SIZE = 100;

function buildQueryParams(filterConfig: FilterConfig): Record<string, string | string[]> {
  const params: Record<string, string | string[]> = {};

  if (filterConfig.status !== undefined) {
    params['status'] = filterConfig.status;
  }
  if (filterConfig.only_workflows !== undefined) {
    params['only_workflows'] = String(filterConfig.only_workflows);
  }
  if (filterConfig.only_saved_tasks !== undefined) {
    params['only_saved_tasks'] = String(filterConfig.only_saved_tasks);
  }
  if (filterConfig.only_templates !== undefined) {
    params['only_templates'] = String(filterConfig.only_templates);
  }
  if (filterConfig.search_key !== undefined) {
    params['search_key'] = filterConfig.search_key;
  }

  return params;
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

async function fetchPage(
  queryParams: Record<string, string | string[]>,
  folderId: string | undefined,
  page: number
): Promise<RawWorkflow[]> {
  const baseUrl = process.env.SKYVERN_BASE_URL ?? 'https://api.skyvern.com/v1';
  const apiKey = process.env.SKYVERN_API_KEY ?? '';

  const params: Record<string, string | string[]> = {
    ...queryParams,
    page: String(page),
    page_size: String(PAGE_SIZE),
  };
  if (folderId !== undefined) params['folder_id'] = folderId;

  const response = await axios.get<RawWorkflow[]>(`${baseUrl}/workflows`, {
    headers: { 'x-api-key': apiKey },
    params,
    paramsSerializer: serializeParams,
  });

  return response.data;
}

async function fetchAllForFolder(
  queryParams: Record<string, string | string[]>,
  folderId: string | undefined
): Promise<RawWorkflow[]> {
  const results: RawWorkflow[] = [];
  let page = 1;
  while (true) {
    const batch = await fetchPage(queryParams, folderId, page);
    results.push(...batch);
    if (batch.length < PAGE_SIZE) break;
    page++;
  }
  return results;
}

export async function fetchWorkflow(workflowPermanentId: string): Promise<RawWorkflow> {
  const baseUrl = process.env.SKYVERN_BASE_URL ?? 'https://api.skyvern.com/v1';
  const apiKey = process.env.SKYVERN_API_KEY ?? '';

  const response = await axios.get<RawWorkflow>(
    `${baseUrl}/workflows/${encodeURIComponent(workflowPermanentId)}`,
    { headers: { 'x-api-key': apiKey } }
  );
  return response.data;
}

export async function updateWorkflowDescription(
  workflowPermanentId: string,
  description: string
): Promise<RawWorkflow> {
  const current = await fetchWorkflow(workflowPermanentId);

  const baseUrl = process.env.SKYVERN_BASE_URL ?? 'https://api.skyvern.com/v1';
  const apiKey = process.env.SKYVERN_API_KEY ?? '';

  const response = await axios.post<RawWorkflow>(
    `${baseUrl}/workflows/${encodeURIComponent(workflowPermanentId)}`,
    {
      json_definition: {
        title: current.title,
        description,
        workflow_definition: {
          ...current.workflow_definition,
          // Output parameters are managed by the API and cannot be sent manually
          parameters: current.workflow_definition.parameters.filter(
            (p) => p.parameter_type !== 'output'
          ),
        },
      },
    },
    { headers: { 'x-api-key': apiKey, 'Content-Type': 'application/json' } }
  );
  return response.data;
}

export async function fetchAllWorkflows(filterConfig: FilterConfig): Promise<RawWorkflow[]> {
  const queryParams = buildQueryParams(filterConfig);

  if (filterConfig.folder_id !== undefined) {
    const folderIds = Array.isArray(filterConfig.folder_id)
      ? filterConfig.folder_id
      : [filterConfig.folder_id];
    const results = await Promise.all(
      folderIds.map((id) => fetchAllForFolder(queryParams, id))
    );
    return results.flat();
  }

  return fetchAllForFolder(queryParams, undefined);
}

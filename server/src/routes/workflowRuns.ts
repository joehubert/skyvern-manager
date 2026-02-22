import { Router } from 'express';
import axios from 'axios';
import { WorkflowRun, WorkflowRunsResponse } from '../types';

const router = Router();

function getBaseUrl(): string {
  return process.env.SKYVERN_BASE_URL ?? 'https://api.skyvern.com/v1';
}

function getApiKey(): string {
  return process.env.SKYVERN_API_KEY ?? '';
}

function getPageSize(): number {
  return parseInt(process.env.WORKFLOW_RUN_PAGE_SIZE ?? '10', 10);
}

function getExcludedStatuses(): string[] {
  return (process.env.WORKFLOW_RUN_EXCLUDED_STATUSES ?? 'queued,running')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

// GET /api/workflow-runs
router.get('/', async (req, res) => {
  const apiKey = getApiKey();
  if (!apiKey) {
    res.status(500).json({ error: 'SKYVERN_API_KEY not configured' });
    return;
  }

  try {
    const page = parseInt(String(req.query.page ?? '1'), 10) || 1;
    const pageSize = getPageSize();
    const excludedStatuses = getExcludedStatuses();

    const response = await axios.get<WorkflowRun[]>(
      `${getBaseUrl()}/workflows/runs`,
      {
        headers: { 'x-api-key': apiKey },
        params: { page, page_size: pageSize },
      }
    );

    const rawRuns = response.data;
    const has_more = rawRuns.length === pageSize;

    const filtered = rawRuns.filter(
      (run) => !excludedStatuses.includes(run.status.toLowerCase())
    );

    const result: WorkflowRunsResponse = {
      runs: filtered,
      page,
      page_size: pageSize,
      has_more,
    };

    res.json(result);
  } catch (err: unknown) {
    if (axios.isAxiosError(err) && err.response) {
      res.status(502).json({ error: 'Skyvern API error', status: err.response.status });
    } else {
      const message = err instanceof Error ? err.message : 'Unknown error';
      console.error('[skyvern-manager] workflow-runs error:', message);
      res.status(500).json({ error: message });
    }
  }
});

// GET /api/workflow-runs/:runId
// Fetches the full run detail from /v1/runs/{runId}
router.get('/:runId', async (req, res) => {
  const apiKey = getApiKey();
  if (!apiKey) {
    res.status(500).json({ error: 'SKYVERN_API_KEY not configured' });
    return;
  }

  const { runId } = req.params;

  try {
    const response = await axios.get(
      `${getBaseUrl()}/runs/${encodeURIComponent(runId)}`,
      {
        headers: { 'x-api-key': apiKey },
      }
    );
    res.json(response.data);
  } catch (err: unknown) {
    if (axios.isAxiosError(err) && err.response) {
      res.status(502).json({ error: 'Skyvern API error', status: err.response.status });
    } else {
      const message = err instanceof Error ? err.message : 'Unknown error';
      console.error('[skyvern-manager] workflow-runs/:runId error:', message);
      res.status(500).json({ error: message });
    }
  }
});

export default router;

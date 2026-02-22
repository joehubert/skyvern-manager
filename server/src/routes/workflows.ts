import { Router, Request, Response } from 'express';
import { readFilterConfig, readFieldConfig } from '../services/configService';
import { fetchAllWorkflows, updateWorkflowDescription } from '../services/skyvernClient';
import { applyFilterConfig, applyFieldConfig } from '../services/workflowFilter';

const router = Router();

router.get('/', async (_req: Request, res: Response) => {
  try {
    const filterConfig = await readFilterConfig();
    const fieldConfig = await readFieldConfig();

    let rawWorkflows;
    try {
      rawWorkflows = await fetchAllWorkflows(filterConfig);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { status?: number; data?: unknown } };
      if (axiosErr.response) {
        console.error('Skyvern API error:', axiosErr.response.status, axiosErr.response.data);
        res.status(502).json({
          error: 'Skyvern API error',
          status: axiosErr.response.status,
          detail: axiosErr.response.data,
        });
        return;
      }
      throw err;
    }

    const postFiltered = applyFilterConfig(rawWorkflows, filterConfig);
    const shaped = applyFieldConfig(postFiltered, fieldConfig);

    // Always include these fields for the edit-description UI regardless of field config
    const result = shaped.map((s, i) => {
      const raw = postFiltered[i];
      const out: Record<string, unknown> = { ...s };
      if (!('workflow_permanent_id' in out)) out.workflow_permanent_id = raw.workflow_permanent_id;
      if (!('title' in out)) out.title = raw.title;
      if (!('description' in out)) out.description = raw.description ?? null;
      return out;
    });

    res.json(result);
  } catch (err) {
    console.error('Error fetching workflows:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/:workflowId/description', async (req: Request, res: Response) => {
  const { workflowId } = req.params;
  const { description } = req.body as { description?: unknown };

  if (typeof description !== 'string') {
    res.status(400).json({ error: 'description must be a string' });
    return;
  }

  try {
    const updated = await updateWorkflowDescription(workflowId, description);
    res.json({ ok: true, description: updated.description ?? null });
  } catch (err: unknown) {
    const axiosErr = err as { response?: { status?: number; data?: unknown } };
    if (axiosErr.response) {
      console.error('Skyvern API error updating description:', axiosErr.response.status, axiosErr.response.data);
      res.status(502).json({
        error: 'Skyvern API error',
        status: axiosErr.response.status,
        detail: axiosErr.response.data,
      });
      return;
    }
    console.error('Error updating workflow description:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

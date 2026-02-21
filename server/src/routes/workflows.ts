import { Router, Request, Response } from 'express';
import { readFilterConfig, readFieldConfig } from '../services/configService';
import { fetchAllWorkflows } from '../services/skyvernClient';
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
    res.json(shaped);
  } catch (err) {
    console.error('Error fetching workflows:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

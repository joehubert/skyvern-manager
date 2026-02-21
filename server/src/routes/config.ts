import { Router, Request, Response } from 'express';
import {
  readFilterConfig,
  writeFilterConfig,
  readFieldConfig,
  writeFieldConfig,
  readTemplate,
  writeTemplate,
} from '../services/configService';

const router = Router();

router.get('/filter', async (_req: Request, res: Response) => {
  try {
    const data = await readFilterConfig();
    res.json({ data });
  } catch (err) {
    console.error('Error reading filter config:', err);
    res.status(500).json({ error: 'Failed to read filter config' });
  }
});

router.put('/filter', async (req: Request, res: Response) => {
  try {
    const body: unknown = req.body;
    if (typeof body !== 'object' || body === null || Array.isArray(body)) {
      res.status(400).json({ error: 'Request body must be a JSON object' });
      return;
    }
    await writeFilterConfig(body as Parameters<typeof writeFilterConfig>[0]);
    res.json({ ok: true });
  } catch (err) {
    console.error('Error writing filter config:', err);
    res.status(500).json({ error: 'Failed to write filter config' });
  }
});

router.get('/fields', async (_req: Request, res: Response) => {
  try {
    const data = await readFieldConfig();
    res.json({ data });
  } catch (err) {
    console.error('Error reading field config:', err);
    res.status(500).json({ error: 'Failed to read field config' });
  }
});

router.put('/fields', async (req: Request, res: Response) => {
  try {
    const body: unknown = req.body;
    if (typeof body !== 'object' || body === null || Array.isArray(body)) {
      res.status(400).json({ error: 'Request body must be a JSON object' });
      return;
    }
    const config = body as Record<string, unknown>;
    if (!Array.isArray(config['fields']) || !Array.isArray(config['filters'])) {
      res.status(400).json({ error: 'Field config must have "fields" and "filters" arrays' });
      return;
    }
    await writeFieldConfig(config as unknown as Parameters<typeof writeFieldConfig>[0]);
    res.json({ ok: true });
  } catch (err) {
    console.error('Error writing field config:', err);
    res.status(500).json({ error: 'Failed to write field config' });
  }
});

router.get('/template', async (_req: Request, res: Response) => {
  try {
    const template = await readTemplate();
    res.type('text/plain').send(template);
  } catch (err) {
    console.error('Error reading template:', err);
    res.status(500).json({ error: 'Failed to read template' });
  }
});

router.put('/template', async (req: Request, res: Response) => {
  try {
    const body: unknown = req.body;
    if (typeof body !== 'string') {
      res.status(400).json({ error: 'Request body must be plain text' });
      return;
    }
    await writeTemplate(body);
    res.json({ ok: true });
  } catch (err) {
    console.error('Error writing template:', err);
    res.status(500).json({ error: 'Failed to write template' });
  }
});

export default router;

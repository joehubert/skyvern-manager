import { Router } from 'express';
import { loadConfig, saveConfig } from '../services/configService';
import {
  fetchEligibleWorkflowIds,
  fetchFilteredRuns,
  aggregateRuns,
} from '../services/runAnalyticsService';
import { RunAnalyticsSettings, WorkflowFilterConfig } from '../types';

const router = Router();

function getExcludeStatuses(): string[] {
  return (process.env.RUN_ANALYTICS_EXCLUDE_STATUSES ?? 'queued,running')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

// GET /api/run-analytics/settings
router.get('/settings', (req, res) => {
  try {
    const settings = loadConfig<RunAnalyticsSettings>('run-analytics-settings.json');
    res.json(settings);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/run-analytics/settings
router.put('/settings', async (req, res) => {
  try {
    const settings = req.body as RunAnalyticsSettings;
    await saveConfig('run-analytics-settings.json', settings);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/run-analytics/workflow-filter
router.get('/workflow-filter', (req, res) => {
  try {
    const filter = loadConfig<WorkflowFilterConfig>('run-analytics-workflow-filter.json');
    res.json(filter);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/run-analytics/workflow-filter
router.put('/workflow-filter', async (req, res) => {
  try {
    const filter = req.body as WorkflowFilterConfig;
    await saveConfig('run-analytics-workflow-filter.json', filter);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/run-analytics/results
router.get('/results', async (req, res) => {
  try {
    const settings = loadConfig<RunAnalyticsSettings>('run-analytics-settings.json');
    const workflowFilter = loadConfig<WorkflowFilterConfig>(
      'run-analytics-workflow-filter.json'
    );
    const excludeStatuses = getExcludeStatuses();

    const eligibleIds = await fetchEligibleWorkflowIds(workflowFilter);
    const runs = await fetchFilteredRuns(
      eligibleIds,
      settings.cutoff_timestamp,
      excludeStatuses
    );
    const summaries = aggregateRuns(runs);

    res.json(summaries);
  } catch (err: any) {
    console.error('[skyvern-manager] run-analytics error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;

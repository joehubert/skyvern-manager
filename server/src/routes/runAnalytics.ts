import { Router } from 'express';
import puppeteer from 'puppeteer';
import { loadConfig, saveConfig } from '../services/configService';
import {
  fetchEligibleWorkflowIds,
  fetchFilteredRuns,
  aggregateRuns,
  buildReportHtml,
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

// GET /api/run-analytics/export/pdf
router.get('/export/pdf', async (req, res) => {
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

    const html = buildReportHtml(summaries, settings.cutoff_timestamp);

    const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdf = await page.pdf({
      format: 'A4',
      landscape: true,
      printBackground: true,
      margin: { top: '20mm', bottom: '20mm', left: '15mm', right: '15mm' },
    });
    await browser.close();

    const filename = `run-analytics-${new Date().toISOString().slice(0, 10)}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(Buffer.from(pdf));
  } catch (err: any) {
    console.error('[skyvern-manager] PDF export error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;

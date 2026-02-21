import { Router, Request, Response } from 'express';
import puppeteer from 'puppeteer';
import { readFilterConfig, readFieldConfig, readTemplate } from '../services/configService';
import { fetchAllWorkflows } from '../services/skyvernClient';
import { applyFilterConfig, applyFieldConfig } from '../services/workflowFilter';
import { renderAllWorkflows } from '../services/templateRenderer';

const router = Router();

router.post('/pdf', async (_req: Request, res: Response) => {
  try {
    const [filterConfig, fieldConfig, template] = await Promise.all([
      readFilterConfig(),
      readFieldConfig(),
      readTemplate(),
    ]);

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
    const renderedContent = renderAllWorkflows(template, shaped);

    const fullHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <link rel="stylesheet" href="styles.css">
</head>
<body class="workflow-doc-preview">
  ${renderedContent}
</body>
</html>`;

    const browser = await puppeteer.launch({
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    try {
      const page = await browser.newPage();
      await page.setContent(fullHtml, { waitUntil: 'networkidle0' });
      const pdfBuffer = await page.pdf({ format: 'A4', printBackground: true });
      await browser.close();

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename="workflow-doc.pdf"');
      res.send(Buffer.from(pdfBuffer));
    } catch (err) {
      await browser.close();
      throw err;
    }
  } catch (err) {
    console.error('Error exporting PDF:', err);
    res.status(500).json({ error: 'Failed to export PDF' });
  }
});

export default router;

import 'dotenv/config';
import express from 'express';
import configRouter from './routes/config';
import workflowsRouter from './routes/workflows';
import runAnalyticsRouter from './routes/runAnalytics';
import workflowRunsRouter from './routes/workflowRuns';

const app = express();

app.use(express.json());
app.use(express.text({ type: 'text/plain' }));

app.use('/api/config', configRouter);
app.use('/api/workflows', workflowsRouter);
app.use('/api/run-analytics', runAnalyticsRouter);
app.use('/api/workflow-runs', workflowRunsRouter);

const port = process.env.PORT ?? 3001;
app.listen(port, () => {
  console.log(`Skyvern Manager server running on port ${port}`);
});

export default app;

import 'dotenv/config';
import express from 'express';
import configRouter from './routes/config';
import workflowsRouter from './routes/workflows';
import exportRouter from './routes/export';
import runAnalyticsRouter from './routes/runAnalytics';

const app = express();

app.use(express.json());
app.use(express.text({ type: 'text/plain' }));

app.use('/api/config', configRouter);
app.use('/api/workflows', workflowsRouter);
app.use('/api/export', exportRouter);
app.use('/api/run-analytics', runAnalyticsRouter);

const port = process.env.PORT ?? 3001;
app.listen(port, () => {
  console.log(`Skyvern Manager server running on port ${port}`);
});

export default app;

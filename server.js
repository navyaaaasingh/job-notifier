require('dotenv').config();
const express = require('express');
const path = require('path');
const cron = require('node-cron');
const apiRoutes = require('./routes/api');
const broadcastRoutes = require('./routes/broadcast');
const { runPipeline } = require('./services/pipeline');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use('/api', apiRoutes);
app.use('/api/broadcast', broadcastRoutes);
app.use(express.static(path.join(__dirname, 'public')));

app.listen(PORT, () => {
  console.log(`Job Notifier running at http://localhost:${PORT}`);

  const schedule = process.env.POLL_CRON || '*/30 * * * *';
  if (cron.validate(schedule)) {
    cron.schedule(schedule, () => {
      console.log(`[cron] Running scheduled job check (${schedule})`);
      runPipeline().catch((err) => console.error('[cron] pipeline error:', err));
    });
    console.log(`Scheduled polling: "${schedule}"`);
  } else {
    console.warn(`Invalid POLL_CRON "${schedule}", scheduled polling disabled.`);
  }
});

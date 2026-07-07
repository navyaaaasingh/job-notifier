require('dotenv').config();
const express = require('express');
const path = require('path');
const cron = require('node-cron');
const fs = require('fs');
const apiRoutes = require('./routes/api');
const broadcastRoutes = require('./routes/broadcast');
const { runPipeline } = require('./services/pipeline');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use('/api', apiRoutes);
app.use('/api/broadcast', broadcastRoutes);

// TEMPORARY diagnostic route — remove once the deploy mismatch is solved.
// Shows exactly what's on disk in the running container, bypassing any
// caching/CDN/browser layer, since we don't have Shell access to check
// this directly on the free tier.
app.get('/__debug', (req, res) => {
  const publicDir = path.join(__dirname, 'public');
  let files = [];
  try {
    files = fs.readdirSync(publicDir);
  } catch (err) {
    return res.json({ error: 'Could not read public dir', detail: err.message });
  }

  const fileDetails = files.map((name) => {
    const filePath = path.join(publicDir, name);
    const stat = fs.statSync(filePath);
    let titleTag = null;
    if (name.endsWith('.html')) {
      const content = fs.readFileSync(filePath, 'utf-8');
      const match = content.match(/<title>(.*?)<\/title>/i);
      titleTag = match ? match[1] : '(no title tag found)';
    }
    return {
      name,
      sizeBytes: stat.size,
      modifiedAt: stat.mtime,
      titleTag,
    };
  });

  res.json({
    publicDirPath: publicDir,
    files: fileDetails,
    gitCommit: process.env.RENDER_GIT_COMMIT || '(not set — not on Render, or var name differs)',
  });
});

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

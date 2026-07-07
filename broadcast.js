const express = require('express');
const { fetchAdzunaJobs } = require('../services/fetchers/adzuna');
const { fetchReedJobs } = require('../services/fetchers/reed');
const { fetchJoobleJobs } = require('../services/fetchers/jooble');
const { storeJobs, getJobsByIds } = require('../services/jobCache');
const recipients = require('../services/recipients');
const { sendBroadcastToAll } = require('../services/broadcastMailer');

const router = express.Router();

/** Step 1: search Adzuna + Reed + Jooble and return normalized, deduped jobs. */
router.post('/search', async (req, res) => {
  const { keywords = '', location = '' } = req.body || {};

  try {
    const [adzuna, reed, jooble] = await Promise.all([
      fetchAdzunaJobs({ keywords, location }),
      fetchReedJobs({ keywords, location }),
      fetchJoobleJobs({ keywords, location }),
    ]);

    const all = [...adzuna, ...reed, ...jooble];
    const byId = new Map();
    for (const job of all) {
      if (job.id && job.title) byId.set(job.id, job);
    }
    const jobs = [...byId.values()];

    storeJobs(jobs); // cache so /send can resolve selected IDs later
    res.json({ jobs, count: jobs.length });
  } catch (err) {
    console.error('[broadcast/search] failed:', err.message);
    res.status(500).json({ error: 'Search failed.', detail: err.message });
  }
});

/** Step 3a: list current recipients. */
router.get('/recipients', (req, res) => {
  res.json(recipients.listRecipients());
});

/** Step 3b: add one recipient. */
router.post('/recipients', (req, res) => {
  const { email } = req.body || {};
  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: 'A valid email is required.' });
  }
  const record = recipients.addRecipient(email);
  res.json({ ok: true, recipient: record });
});

/** Step 3c: add many recipients at once (pasted list or uploaded file content, one email per line or comma-separated). */
router.post('/recipients/bulk', (req, res) => {
  const { emails } = req.body || {};
  if (!Array.isArray(emails) || emails.length === 0) {
    return res.status(400).json({ error: 'Provide a non-empty array of emails.' });
  }
  const result = recipients.addRecipients(emails);
  res.json({ ok: true, ...result, total: recipients.listRecipients().length });
});

/** Remove a recipient. */
router.delete('/recipients/:email', (req, res) => {
  recipients.removeRecipient(req.params.email);
  res.json({ ok: true });
});

/** Step 4: send the same selected job list + message to every recipient. */
router.post('/send', async (req, res) => {
  const { jobIds = [], subject = '', message = '' } = req.body || {};

  if (!Array.isArray(jobIds) || jobIds.length === 0) {
    return res.status(400).json({ error: 'Select at least one job to send.' });
  }

  const jobs = getJobsByIds(jobIds);
  if (jobs.length === 0) {
    return res.status(400).json({
      error: 'None of the selected jobs were found in cache. Please re-run the search and re-select.',
    });
  }

  const list = recipients.listRecipients();
  if (list.length === 0) {
    return res.status(400).json({ error: 'No recipients added yet.' });
  }

  try {
    const result = await sendBroadcastToAll({ recipients: list, subject, message, jobs });
    res.json({
      ok: true,
      jobsSent: jobs.length,
      recipientsTotal: list.length,
      sent: result.sent.length,
      failed: result.failed,
    });
  } catch (err) {
    console.error('[broadcast/send] failed:', err.message);
    res.status(500).json({ error: 'Send failed.', detail: err.message });
  }
});

module.exports = router;

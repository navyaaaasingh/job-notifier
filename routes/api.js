const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../services/db');
const { runPipeline } = require('../services/pipeline');

const router = express.Router();

/** Create or update a subscriber's preferences (upsert by email). */
router.post('/subscribe', async (req, res) => {
  const {
    email,
    phone,
    ntfyTopic,
    keywords = [],
    location = '',
    minSalary = null,
    channels = { email: true, sms: false, push: false },
  } = req.body || {};

  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: 'A valid email is required.' });
  }
  if (channels.sms && !phone) {
    return res.status(400).json({ error: 'Phone number is required for SMS notifications.' });
  }
  if (channels.push && !ntfyTopic) {
    return res.status(400).json({ error: 'A push topic name is required for push notifications.' });
  }

  const parsedKeywords = Array.isArray(keywords)
    ? keywords
    : String(keywords)
        .split(',')
        .map((k) => k.trim())
        .filter(Boolean);

  const existing = db.get('subscribers').find({ email }).value();
  const record = {
    id: existing?.id || uuidv4(),
    email,
    phone: phone || null,
    ntfyTopic: ntfyTopic || null,
    keywords: parsedKeywords,
    location,
    minSalary: minSalary ? Number(minSalary) : null,
    channels,
    createdAt: existing?.createdAt || new Date().toISOString(),
  };

  if (existing) {
    db.get('subscribers').find({ email }).assign(record).write();
  } else {
    db.get('subscribers').push(record).write();
  }

  res.json({ ok: true, subscriber: record });
});

/** Remove a subscriber. */
router.delete('/subscribe/:email', (req, res) => {
  db.get('subscribers').remove({ email: req.params.email }).write();
  res.json({ ok: true });
});

/** List all subscribers (for the minimal admin/demo view — no secrets exposed). */
router.get('/subscribers', (req, res) => {
  const subs = db.get('subscribers').value().map((s) => ({
    id: s.id,
    email: s.email,
    keywords: s.keywords,
    location: s.location,
    minSalary: s.minSalary,
    channels: s.channels,
  }));
  res.json(subs);
});

/** Manually trigger a fetch + match + notify cycle, and return any new matches. */
router.post('/check-now', async (req, res) => {
  try {
    const result = await runPipeline();
    res.json(result);
  } catch (err) {
    console.error('[api] check-now failed:', err);
    res.status(500).json({ error: 'Pipeline run failed.', detail: err.message });
  }
});

module.exports = router;

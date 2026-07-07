const db = require('./db');

// The 'recipients' collection is seeded by db.js's defaults() call, so no
// setup is needed here — same pattern used by 'subscribers' elsewhere.

function listRecipients() {
  return db.get('recipients').value();
}

function addRecipient(email) {
  const clean = email.trim().toLowerCase();
  if (!clean || !clean.includes('@')) return null;
  const existing = db.get('recipients').find({ email: clean }).value();
  if (existing) return existing;
  const record = { email: clean, addedAt: new Date().toISOString() };
  db.get('recipients').push(record).write();
  return record;
}

/** Add many emails at once (e.g. from a pasted or uploaded list). Skips invalid/duplicate entries. */
function addRecipients(emails) {
  const added = [];
  const skipped = [];
  for (const raw of emails) {
    const clean = String(raw).trim().toLowerCase();
    if (!clean) continue;
    if (!clean.includes('@') || !clean.includes('.')) {
      skipped.push(raw);
      continue;
    }
    const existing = db.get('recipients').find({ email: clean }).value();
    if (existing) continue; // silently skip duplicates
    added.push({ email: clean, addedAt: new Date().toISOString() });
  }
  if (added.length > 0) {
    db.get('recipients').push(...added).write();
  }
  return { added, skipped };
}

function removeRecipient(email) {
  db.get('recipients').remove({ email: email.trim().toLowerCase() }).write();
}

module.exports = { listRecipients, addRecipient, addRecipients, removeRecipient };

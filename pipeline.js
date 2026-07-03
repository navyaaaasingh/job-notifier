const db = require('./db');
const { fetchAdzunaJobs } = require('./fetchers/adzuna');
const { fetchReedJobs } = require('./fetchers/reed');
const { fetchJoobleJobs } = require('./fetchers/jooble');
const { findMatchesForSubscriber } = require('./matcher');
const { notifySubscriber } = require('./notifier');

/**
 * Build the set of distinct (keywords, location) search terms we need to
 * query the APIs for, derived from all current subscribers. This keeps API
 * usage proportional to the variety of searches people actually want,
 * rather than the number of subscribers.
 */
function collectSearchTerms(subscribers) {
  const seen = new Map();
  for (const sub of subscribers) {
    const keywords = (sub.keywords || []).join(' ');
    const key = `${keywords.toLowerCase()}|${(sub.location || '').toLowerCase()}`;
    if (!seen.has(key)) {
      seen.set(key, { keywords, location: sub.location || '' });
    }
  }
  // Always include one broad, unfiltered search as a fallback.
  if (seen.size === 0) {
    seen.set('|', { keywords: '', location: '' });
  }
  return [...seen.values()];
}

async function fetchAllJobsForTerms(terms) {
  const all = [];
  for (const term of terms) {
    const [adzuna, reed, jooble] = await Promise.all([
      fetchAdzunaJobs(term),
      fetchReedJobs(term),
      fetchJoobleJobs(term),
    ]);
    all.push(...adzuna, ...reed, ...jooble);
  }
  // Dedupe within this batch by id.
  const byId = new Map();
  for (const job of all) {
    if (job.id && job.title) byId.set(job.id, job);
  }
  return [...byId.values()];
}

/**
 * Full cycle: fetch jobs for every distinct search subscribers care about,
 * filter out ones we've already notified about, match against each
 * subscriber's preferences, and send notifications for new matches only.
 */
async function runPipeline() {
  const subscribers = db.get('subscribers').value();
  if (subscribers.length === 0) {
    console.log('[pipeline] No subscribers yet, nothing to do.');
    return { fetched: 0, newJobs: 0, notified: 0 };
  }

  const terms = collectSearchTerms(subscribers);
  const jobs = await fetchAllJobsForTerms(terms);

  const seenIds = new Set(db.get('seenJobIds').value());
  const newJobs = jobs.filter((j) => !seenIds.has(j.id));

  let notifiedCount = 0;
  for (const subscriber of subscribers) {
    const matches = findMatchesForSubscriber(newJobs, subscriber);
    if (matches.length > 0) {
      await notifySubscriber(subscriber, matches);
      notifiedCount += 1;
    }
  }

  // Mark all fetched jobs (not just new ones) as seen, and cap the stored
  // list so the file doesn't grow forever.
  const allIds = new Set([...seenIds, ...jobs.map((j) => j.id)]);
  const trimmed = [...allIds].slice(-5000);
  db.set('seenJobIds', trimmed).write();

  console.log(
    `[pipeline] fetched=${jobs.length} new=${newJobs.length} notifiedSubscribers=${notifiedCount}`
  );
  return { fetched: jobs.length, newJobs: newJobs.length, notified: notifiedCount, jobs: newJobs };
}

module.exports = { runPipeline, collectSearchTerms, fetchAllJobsForTerms };

// Simple in-memory cache: holds the most recent search results so that when
// the frontend sends back a list of selected job IDs, the server can look up
// the full job objects (title, company, url, etc.) without re-fetching.
//
// This intentionally does NOT persist to disk — search results are
// short-lived / disposable by nature. If the server restarts between
// searching and sending, the user just re-runs the search.
const cache = new Map();

function storeJobs(jobs) {
  for (const job of jobs) {
    if (job.id) cache.set(job.id, job);
  }
}

function getJobsByIds(ids) {
  return ids.map((id) => cache.get(id)).filter(Boolean);
}

module.exports = { storeJobs, getJobsByIds };

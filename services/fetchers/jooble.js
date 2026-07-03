const axios = require('axios');

/**
 * Fetch jobs from Jooble (https://jooble.org/api/about)
 * Jooble is a POST API keyed by an API key in the URL path.
 * @param {{ keywords: string, location: string }} params
 * @returns {Promise<Array>} normalized job objects
 */
async function fetchJoobleJobs({ keywords, location }) {
  const apiKey = process.env.JOOBLE_API_KEY;

  if (!apiKey) {
    console.warn('[jooble] Skipped: JOOBLE_API_KEY not set.');
    return [];
  }

  const url = `https://jooble.org/api/${apiKey}`;

  try {
    const { data } = await axios.post(url, {
      keywords: keywords || '',
      location: location || '',
    });

    return (data.jobs || []).map(normalize);
  } catch (err) {
    console.error('[jooble] fetch failed:', err.response?.status, err.message);
    return [];
  }
}

function normalize(job) {
  // Jooble doesn't give a stable numeric id in all responses, so hash the link.
  const idSource = job.id || job.link;
  return {
    id: `jooble:${idSource}`,
    source: 'jooble',
    title: (job.title || '').trim(),
    company: job.company || 'Unknown',
    location: job.location || '',
    salaryMin: null,
    salaryMax: null,
    salaryText: job.salary || null,
    description: (job.snippet || '').trim(),
    url: job.link,
    postedAt: job.updated,
  };
}

module.exports = { fetchJoobleJobs };

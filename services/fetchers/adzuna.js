const axios = require('axios');

/**
 * Fetch jobs from Adzuna (https://developer.adzuna.com/docs/search)
 * @param {{ keywords: string, location: string, page?: number }} params
 * @returns {Promise<Array>} normalized job objects
 */
async function fetchAdzunaJobs({ keywords, location, page = 1 }) {
  const appId = process.env.ADZUNA_APP_ID;
  const appKey = process.env.ADZUNA_APP_KEY;
  const country = process.env.ADZUNA_COUNTRY || 'gb';

  if (!appId || !appKey) {
    console.warn('[adzuna] Skipped: ADZUNA_APP_ID / ADZUNA_APP_KEY not set.');
    return [];
  }

  const url = `https://api.adzuna.com/v1/api/jobs/${country}/search/${page}`;

  try {
    const { data } = await axios.get(url, {
      params: {
        app_id: appId,
        app_key: appKey,
        what: keywords || undefined,
        where: location || undefined,
        results_per_page: 25,
      },
    });

    return (data.results || []).map(normalize);
  } catch (err) {
    console.error('[adzuna] fetch failed:', err.response?.status, err.response?.data?.exception || err.message);
    return [];
  }
}

function normalize(job) {
  return {
    id: `adzuna:${job.id}`,
    source: 'adzuna',
    title: job.title?.trim(),
    company: job.company?.display_name || 'Unknown',
    location: job.location?.display_name || '',
    salaryMin: job.salary_min || null,
    salaryMax: job.salary_max || null,
    description: (job.description || '').trim(),
    url: job.redirect_url,
    postedAt: job.created,
  };
}

module.exports = { fetchAdzunaJobs };

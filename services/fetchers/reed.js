const axios = require('axios');

/**
 * Fetch jobs from Reed (https://www.reed.co.uk/developers/jobseeker)
 * Auth: HTTP Basic, API key as username, blank password.
 * @param {{ keywords: string, location: string }} params
 * @returns {Promise<Array>} normalized job objects
 */
async function fetchReedJobs({ keywords, location }) {
  const apiKey = process.env.REED_API_KEY;

  if (!apiKey) {
    console.warn('[reed] Skipped: REED_API_KEY not set.');
    return [];
  }

  const url = 'https://www.reed.co.uk/api/1.0/search';

  try {
    const { data } = await axios.get(url, {
      auth: { username: apiKey, password: '' },
      params: {
        keywords: keywords || undefined,
        locationName: location || undefined,
        resultsToTake: 25,
      },
    });

    return (data.results || []).map(normalize);
  } catch (err) {
    console.error('[reed] fetch failed:', err.response?.status, err.message);
    return [];
  }
}

function normalize(job) {
  return {
    id: `reed:${job.jobId}`,
    source: 'reed',
    title: job.jobTitle?.trim(),
    company: job.employerName || 'Unknown',
    location: job.locationName || '',
    salaryMin: job.minimumSalary || null,
    salaryMax: job.maximumSalary || null,
    description: (job.jobDescription || '').trim(),
    url: job.jobUrl,
    postedAt: job.date,
  };
}

module.exports = { fetchReedJobs };

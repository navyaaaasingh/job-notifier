/**
 * Decide whether a normalized job matches a subscriber's saved preferences.
 *
 * Preferences shape:
 *   { keywords: string[], location: string, minSalary: number|null }
 */
function jobMatchesPreferences(job, prefs) {
  const haystack = `${job.title} ${job.description}`.toLowerCase();

  // Keywords: match if ANY saved keyword appears in title/description.
  // No keywords saved => don't filter on keywords.
  if (prefs.keywords && prefs.keywords.length > 0) {
    const hasKeyword = prefs.keywords.some((kw) =>
      haystack.includes(kw.toLowerCase().trim())
    );
    if (!hasKeyword) return false;
  }

  // Location: simple substring match, case-insensitive.
  if (prefs.location && prefs.location.trim()) {
    const loc = (job.location || '').toLowerCase();
    if (!loc.includes(prefs.location.toLowerCase().trim())) return false;
  }

  // Minimum salary: only enforced when the job actually reports a salary.
  if (prefs.minSalary) {
    const jobMax = job.salaryMax || job.salaryMin;
    if (jobMax && jobMax < prefs.minSalary) return false;
  }

  return true;
}

/**
 * Filter a job list against one subscriber's preferences.
 */
function findMatchesForSubscriber(jobs, subscriber) {
  return jobs.filter((job) =>
    jobMatchesPreferences(job, {
      keywords: subscriber.keywords,
      location: subscriber.location,
      minSalary: subscriber.minSalary,
    })
  );
}

module.exports = { jobMatchesPreferences, findMatchesForSubscriber };

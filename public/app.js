const form = document.getElementById('subscribe-form');
const statusEl = document.getElementById('form-status');
const checkNowBtn = document.getElementById('check-now');
const jobsList = document.getElementById('jobs-list');
const jobsMeta = document.getElementById('jobs-meta');

// Show/hide the phone + push-topic fields based on their checkboxes.
document.querySelectorAll('input[type="checkbox"]').forEach((box) => {
  const target = document.querySelector(`.conditional[data-for="${box.name}"]`);
  if (!target) return;
  const sync = () => { target.hidden = !box.checked; };
  sync();
  box.addEventListener('change', sync);
});

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const fd = new FormData(form);

  const payload = {
    email: fd.get('email'),
    phone: fd.get('phone') || null,
    ntfyTopic: fd.get('ntfyTopic') || null,
    keywords: (fd.get('keywords') || '')
      .split(',')
      .map((k) => k.trim())
      .filter(Boolean),
    location: fd.get('location') || '',
    minSalary: fd.get('minSalary') || null,
    channels: {
      email: fd.get('channelEmail') === 'on',
      sms: fd.get('channelSms') === 'on',
      push: fd.get('channelPush') === 'on',
    },
  };

  statusEl.textContent = 'Saving…';
  statusEl.className = 'form-status';

  try {
    const res = await fetch('/api/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Could not save preferences.');
    statusEl.textContent = 'Saved. We\'ll email/text/push you when something matches.';
    statusEl.className = 'form-status ok';
  } catch (err) {
    statusEl.textContent = err.message;
    statusEl.className = 'form-status err';
  }
});

function renderJobs(jobs) {
  jobsList.innerHTML = '';
  if (!jobs || jobs.length === 0) {
    jobsList.innerHTML = '<li class="empty">No new matches yet.</li>';
    return;
  }
  for (const job of jobs) {
    const li = document.createElement('li');
    li.className = 'job';
    li.innerHTML = `
      <p class="job-title"><a href="${job.url}" target="_blank" rel="noopener">${job.title}</a></p>
      <p class="job-meta"><span class="job-source">${job.source}</span>${job.company} — ${job.location || 'n/a'}</p>
    `;
    jobsList.appendChild(li);
  }
}

checkNowBtn.addEventListener('click', async () => {
  checkNowBtn.disabled = true;
  checkNowBtn.textContent = 'Checking…';
  jobsMeta.textContent = 'Fetching from Adzuna, Reed and Jooble…';
  try {
    const res = await fetch('/api/check-now', { method: 'POST' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Check failed.');
    jobsMeta.textContent = `Fetched ${data.fetched} listings · ${data.newJobs} new · notified ${data.notified} subscriber(s).`;
    renderJobs(data.jobs);
  } catch (err) {
    jobsMeta.textContent = err.message;
  } finally {
    checkNowBtn.disabled = false;
    checkNowBtn.textContent = 'Check now';
  }
});

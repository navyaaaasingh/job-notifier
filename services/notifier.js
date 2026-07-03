const nodemailer = require('nodemailer');
const axios = require('axios');

let mailTransport = null;
function getMailTransport() {
  if (mailTransport) return mailTransport;
  if (!process.env.SMTP_HOST) return null;

  mailTransport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      : undefined,
  });
  return mailTransport;
}

let twilioClient = null;
function getTwilioClient() {
  if (twilioClient) return twilioClient;
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) return null;
  twilioClient = require('twilio')(sid, token);
  return twilioClient;
}

function formatJobList(jobs) {
  return jobs
    .map((j) => `• ${j.title} — ${j.company} (${j.location || 'n/a'})\n  ${j.url}`)
    .join('\n\n');
}

/** Send an email digest of matched jobs to one subscriber. */
async function sendEmailNotification(subscriber, jobs) {
  const transport = getMailTransport();
  if (!transport) {
    console.warn('[notifier:email] SMTP not configured, skipping.');
    return false;
  }
  await transport.sendMail({
    from: process.env.SMTP_FROM || 'Job Notifier <notifier@example.com>',
    to: subscriber.email,
    subject: `${jobs.length} new job match${jobs.length === 1 ? '' : 'es'} for you`,
    text: formatJobList(jobs),
    html: `<p>We found ${jobs.length} new job(s) matching your preferences:</p><ul>${jobs
      .map(
        (j) =>
          `<li><a href="${j.url}">${j.title}</a> — ${j.company} (${j.location || 'n/a'})</li>`
      )
      .join('')}</ul>`,
  });
  return true;
}

/** Send an SMS summary via Twilio. */
async function sendSmsNotification(subscriber, jobs) {
  const client = getTwilioClient();
  if (!client || !subscriber.phone) {
    console.warn('[notifier:sms] Twilio not configured or no phone, skipping.');
    return false;
  }
  const preview = jobs
    .slice(0, 3)
    .map((j) => `${j.title} @ ${j.company}`)
    .join('; ');
  await client.messages.create({
    from: process.env.TWILIO_FROM_NUMBER,
    to: subscriber.phone,
    body: `${jobs.length} new job match(es): ${preview}${jobs.length > 3 ? '…' : ''}`,
  });
  return true;
}

/**
 * Send a push notification via ntfy.sh (no account/API key needed — each
 * subscriber just needs their own unique topic name, which acts as the
 * "channel" they subscribe to in the ntfy app or browser).
 */
async function sendPushNotification(subscriber, jobs) {
  const base = process.env.NTFY_BASE_URL || 'https://ntfy.sh';
  if (!subscriber.ntfyTopic) {
    console.warn('[notifier:push] No ntfy topic set for subscriber, skipping.');
    return false;
  }
  await axios.post(
    `${base}/${subscriber.ntfyTopic}`,
    `${jobs.length} new job match(es). Top: ${jobs[0]?.title} @ ${jobs[0]?.company}`,
    {
      headers: {
        Title: 'New job matches',
        Click: jobs[0]?.url || base,
        Priority: 'default',
      },
    }
  );
  return true;
}

/** Send whichever channels the subscriber has opted into. */
async function notifySubscriber(subscriber, jobs) {
  if (jobs.length === 0) return;
  const results = { email: false, sms: false, push: false };

  if (subscriber.channels?.email) {
    try {
      results.email = await sendEmailNotification(subscriber, jobs);
    } catch (err) {
      console.error(`[notifier:email] failed for ${subscriber.email}:`, err.message);
    }
  }
  if (subscriber.channels?.sms) {
    try {
      results.sms = await sendSmsNotification(subscriber, jobs);
    } catch (err) {
      console.error(`[notifier:sms] failed for ${subscriber.email}:`, err.message);
    }
  }
  if (subscriber.channels?.push) {
    try {
      results.push = await sendPushNotification(subscriber, jobs);
    } catch (err) {
      console.error(`[notifier:push] failed for ${subscriber.email}:`, err.message);
    }
  }
  return results;
}

module.exports = { notifySubscriber, sendEmailNotification, sendSmsNotification, sendPushNotification };

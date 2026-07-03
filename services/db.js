const path = require('path');
const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');

const file = path.join(__dirname, '..', 'data', 'db.json');
const adapter = new FileSync(file);
const db = low(adapter);

// Default shape:
// subscribers: [{ id, email, phone, ntfyTopic, keywords: [], location, minSalary,
//                  channels: { email: bool, sms: bool, push: bool }, createdAt }]
// seenJobIds: [ "adzuna:123", "reed:456", ... ]  -- dedupe across polls
db.defaults({ subscribers: [], seenJobIds: [] }).write();

module.exports = db;

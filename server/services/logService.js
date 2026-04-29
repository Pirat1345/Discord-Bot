const crypto = require('crypto');

function appendLog(db, userId, level, message) {
  const logs = db.logsByUser[userId] || [];
  logs.unshift({
    id: crypto.randomUUID(),
    user_id: userId,
    level,
    message,
    created_at: new Date().toISOString(),
  });
  db.logsByUser[userId] = logs;
}

module.exports = {
  appendLog,
};

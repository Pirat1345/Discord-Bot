const express = require('express');
const crypto = require('crypto');
const { readDb, writeDb } = require('../services/dbService');
const { requireAuth } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permissions');

const router = express.Router();

router.get('/', requireAuth, requirePermission('read'), async (req, res) => {
  const db = await readDb();
  const userId = req.session.userId;
  const limit = Math.max(1, Number(req.query.limit || 100));
  const logs = db.logsByUser[userId] || [];

  return res.json(logs.slice(0, limit));
});

router.post('/', requireAuth, requirePermission('write'), async (req, res) => {
  const db = await readDb();
  const userId = req.session.userId;
  const { level, message } = req.body || {};

  if (!level || !message) {
    return res.status(400).json({ error: 'level und message sind erforderlich.' });
  }

  const log = {
    id: crypto.randomUUID(),
    user_id: userId,
    level: String(level),
    message: String(message),
    created_at: new Date().toISOString(),
  };

  const logs = db.logsByUser[userId] || [];
  logs.unshift(log);
  db.logsByUser[userId] = logs;
  await writeDb(db);

  return res.status(201).json(log);
});

module.exports = {
  logsRoutes: router,
};

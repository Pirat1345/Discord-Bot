const express = require('express');
const { readDb, writeDb } = require('../services/dbService');
const { defaultFeatures } = require('../utils/defaults');
const { requireAuth } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permissions');

const router = express.Router();

router.get('/', requireAuth, requirePermission('read'), async (req, res) => {
  const db = await readDb();
  const userId = req.session.userId;

  if (!db.featuresByUser[userId]) {
    db.featuresByUser[userId] = defaultFeatures();
    await writeDb(db);
  }

  return res.json(db.featuresByUser[userId]);
});

router.patch('/:featureId', requireAuth, requirePermission('write'), async (req, res) => {
  const db = await readDb();
  const userId = req.session.userId;
  const featureId = req.params.featureId;
  const updates = req.body || {};

  const features = db.featuresByUser[userId] || defaultFeatures();
  const feature = features.find((f) => f.id === featureId);

  if (!feature) {
    return res.status(404).json({ error: 'Feature not found.' });
  }

  Object.assign(feature, updates, { updated_at: new Date().toISOString() });
  db.featuresByUser[userId] = features;
  await writeDb(db);

  return res.json(feature);
});

module.exports = {
  featuresRoutes: router,
};

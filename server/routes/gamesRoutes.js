const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permissions');
const { getDeals } = require('../services/gameDealsService');
const { postFreeGamesForGuild } = require('../dc-funktions/news/free-games');
const { getActiveClientForUser } = require('../services/botService');
const { readDb } = require('../services/dbService');

const router = express.Router();

// GET /api/games/deals – fetch current free game deals (Epic + Steam)
router.get('/deals', requireAuth, requirePermission('read'), async (_req, res) => {
  try {
    const data = await getDeals();
    return res.json(data);
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Unbekannter Fehler.' });
  }
});

// POST /api/games/deals/refresh – force refresh deals cache
router.post('/deals/refresh', requireAuth, requirePermission('read'), async (_req, res) => {
  try {
    const data = await getDeals(true);
    return res.json(data);
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Unbekannter Fehler.' });
  }
});

// POST /api/games/deals/post/:guildId – post deals to a guild's configured channel
router.post('/deals/post/:guildId', requireAuth, requirePermission('write'), async (req, res) => {
  const userId = req.session.userId;
  const guildId = String(req.params.guildId || '').trim();

  if (!guildId) {
    return res.status(400).json({ error: 'Ungültige Server-ID.' });
  }

  const client = getActiveClientForUser(userId);
  if (!client) {
    return res.status(400).json({ error: 'Bot ist nicht online.' });
  }

  let guild;
  try {
    guild = await client.guilds.fetch(guildId);
  } catch {
    return res.status(404).json({ error: 'Server nicht gefunden.' });
  }

  try {
    const result = await postFreeGamesForGuild({ userId, guild });
    if (!result.sent) {
      return res.status(400).json({ error: result.reason });
    }
    return res.json({ ok: true, count: result.count, channelId: result.channelId });
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Unbekannter Fehler.' });
  }
});

module.exports = {
  gamesRoutes: router,
};

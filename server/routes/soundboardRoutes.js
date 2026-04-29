const express = require('express');
const path = require('path');
const fs = require('fs');
const { requireAuth } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permissions');
const { getActiveClientForUser } = require('../services/botService');
const {
  ensureAudioDir,
  listAudioFiles,
  deleteAudioFile,
  renameAudioFile,
  joinVoiceChannelForUser,
  leaveVoiceChannelForUser,
  playSoundForUser,
  getVoiceStatus,
} = require('../dc-funktions/debug/soundboard');

const router = express.Router();

const MAX_FILE_SIZE = 8 * 1024 * 1024; // 8 MB
const ALLOWED_EXTENSIONS = ['.mp3', '.wav'];

router.get('/files', requireAuth, requirePermission('read'), (req, res) => {
  const userId = req.session.userId;
  const files = listAudioFiles(userId);

  return res.json({
    files: files.map((f) => ({
      name: f.name,
      size: f.size,
    })),
  });
});

router.post('/upload', requireAuth, requirePermission('write'), express.raw({ type: ['audio/mpeg', 'audio/wav', 'audio/wave', 'audio/x-wav', 'application/octet-stream'], limit: '8mb' }), (req, res) => {
  const userId = req.session.userId;
  const fileName = req.headers['x-file-name'];

  if (!fileName) {
    return res.status(400).json({ error: 'Dateiname fehlt (X-File-Name Header).' });
  }

  const sanitized = path.basename(String(fileName));
  const ext = path.extname(sanitized).toLowerCase();

  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return res.status(400).json({ error: 'Nur .mp3 und .wav Dateien sind erlaubt.' });
  }

  if (!req.body || req.body.length === 0) {
    return res.status(400).json({ error: 'Keine Datei empfangen.' });
  }

  if (req.body.length > MAX_FILE_SIZE) {
    return res.status(400).json({ error: 'Datei ist zu groß (max. 8 MB).' });
  }

  const dir = ensureAudioDir(userId);
  const targetPath = path.join(dir, sanitized);

  fs.writeFileSync(targetPath, req.body);

  return res.json({ ok: true, name: sanitized, size: req.body.length });
});

router.delete('/files/:fileName', requireAuth, requirePermission('write'), (req, res) => {
  const userId = req.session.userId;
  const fileName = String(req.params.fileName || '').trim();

  if (!fileName) {
    return res.status(400).json({ error: 'Dateiname fehlt.' });
  }

  try {
    deleteAudioFile(userId, fileName);
    return res.json({ ok: true });
  } catch (error) {
    return res.status(400).json({ error: error instanceof Error ? error.message : 'Datei konnte nicht gelöscht werden.' });
  }
});

router.patch('/files/:fileName', requireAuth, requirePermission('write'), (req, res) => {
  const userId = req.session.userId;
  const fileName = String(req.params.fileName || '').trim();
  const newName = String(req.body?.newName || '').trim();

  if (!fileName || !newName) {
    return res.status(400).json({ error: 'Alter und neuer Dateiname sind erforderlich.' });
  }

  try {
    renameAudioFile(userId, fileName, newName);
    return res.json({ ok: true, name: newName });
  } catch (error) {
    return res.status(400).json({ error: error instanceof Error ? error.message : 'Umbenennen fehlgeschlagen.' });
  }
});

router.get('/status', requireAuth, requirePermission('read'), (req, res) => {
  const userId = req.session.userId;
  const status = getVoiceStatus(userId);
  return res.json(status);
});

router.post('/join', requireAuth, requirePermission('use'), async (req, res) => {
  const userId = req.session.userId;
  const client = getActiveClientForUser(userId);

  if (!client) {
    return res.status(400).json({ error: 'Bot ist offline. Starte zuerst den Bot.' });
  }

  try {
    const result = await joinVoiceChannelForUser(userId, client);
    return res.json({ ok: true, ...result });
  } catch (error) {
    return res.status(400).json({ error: error instanceof Error ? error.message : 'Konnte Voice-Channel nicht beitreten.' });
  }
});

router.post('/leave', requireAuth, requirePermission('use'), (req, res) => {
  const userId = req.session.userId;
  const left = leaveVoiceChannelForUser(userId);

  return res.json({ ok: true, wasConnected: left });
});

router.post('/play/:fileName', requireAuth, requirePermission('use'), async (req, res) => {
  const userId = req.session.userId;
  const fileName = String(req.params.fileName || '').trim();

  if (!fileName) {
    return res.status(400).json({ error: 'Dateiname fehlt.' });
  }

  try {
    const result = await playSoundForUser(userId, fileName);
    return res.json({ ok: true, ...result });
  } catch (error) {
    return res.status(400).json({ error: error instanceof Error ? error.message : 'Wiedergabe fehlgeschlagen.' });
  }
});

module.exports = {
  soundboardRoutes: router,
};

const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { TOTP, Secret } = require('otpauth');
const { readDb, writeDb } = require('../services/dbService');
const {
  sanitizeUser,
  findUserById,
  findUserByUsername,
  isUsernameInUse,
} = require('../services/userService');
const { createDefaultSettings, defaultFeatures } = require('../utils/defaults');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

function establishSession(req, res, user, statusCode = 200) {
  return req.session.regenerate((regenerateError) => {
    if (regenerateError) {
      return res.status(500).json({ error: 'Session could not be created.' });
    }

    req.session.userId = user.id;

    return req.session.save((saveError) => {
      if (saveError) {
        return res.status(500).json({ error: 'Session could not be saved.' });
      }

      return res.status(statusCode).json({ user: sanitizeUser(user) });
    });
  });
}

router.get('/session', async (req, res) => {
  const db = await readDb();
  const user = findUserById(db, req.session.userId);

  if (!user) {
    return res.json({ user: null });
  }

  return res.json({ user: sanitizeUser(user) });
});

router.get('/status', async (_req, res) => {
  const db = await readDb();
  return res.json({ needs_initial_setup: db.users.length === 0 });
});

router.post('/initialize-admin', async (req, res) => {
  const { username, password } = req.body || {};
  const normalizedUsername = String(username || '').trim().toLowerCase();

  if (!normalizedUsername || String(password || '').length < 5) {
    return res
      .status(400)
      .json({ error: 'Username and password (min. 5 characters) are required.' });
  }

  const db = await readDb();

  if (db.users.length > 0) {
    return res
      .status(409)
      .json({ error: 'Initial setup has already been completed.' });
  }

  const user = {
    id: crypto.randomUUID(),
    username: normalizedUsername,
    display_name: normalizedUsername,
    avatar_file: null,
    avatar_updated_at: null,
    avatar_url: null,
    password_hash: await bcrypt.hash(String(password), 10),
    role: 'admin',
    must_change_password: false,
    created_at: new Date().toISOString(),
  };

  db.users.push(user);
  db.settingsByUser[user.id] = createDefaultSettings(user.id);
  db.featuresByUser[user.id] = defaultFeatures();
  db.logsByUser[user.id] = [];

  await writeDb(db);
  return establishSession(req, res, user, 201);
});

router.post('/signin', async (req, res) => {
  const { username, password, totpCode } = req.body || {};
  const normalizedUsername = String(username || '').trim().toLowerCase();

  if (!normalizedUsername || !password) {
    return res.status(400).json({ error: 'Please enter username and password.' });
  }

  const db = await readDb();
  const user = findUserByUsername(db, normalizedUsername);

  if (!user) {
    return res.status(401).json({ error: 'Invalid login credentials.' });
  }

  const valid = await bcrypt.compare(String(password || ''), user.password_hash);
  if (!valid) {
    return res.status(401).json({ error: 'Invalid login credentials.' });
  }

  if (user.totp_enabled && user.totp_secret) {
    if (!totpCode) {
      return res.status(403).json({ error: '2fa_required', requires_2fa: true });
    }

    const totp = new TOTP({ issuer: 'BotPanel', label: user.username, secret: Secret.fromBase32(user.totp_secret) });
    const validTotp = totp.validate({ token: String(totpCode).trim(), window: 1 }) !== null;

    if (!validTotp) {
      return res.status(401).json({ error: 'Invalid 2FA code.' });
    }
  }

  return establishSession(req, res, user);
});

router.post('/complete-initial-setup', requireAuth, async (req, res) => {
  const { username, newPassword } = req.body || {};
  const normalizedUsername = String(username || '').trim().toLowerCase();

  if (!normalizedUsername || String(newPassword || '').length < 5) {
    return res
      .status(400)
      .json({ error: 'Username and new password (min. 5 characters) are required.' });
  }

  const db = await readDb();
  const user = findUserById(db, req.session.userId);

  if (!user) {
    return res.status(401).json({ error: 'Not logged in.' });
  }

  if (isUsernameInUse(db, normalizedUsername, user.id)) {
    return res.status(409).json({ error: 'This username is already taken.' });
  }

  user.username = normalizedUsername;
  user.password_hash = await bcrypt.hash(String(newPassword), 10);
  user.must_change_password = false;

  await writeDb(db);
  return res.json({ user: sanitizeUser(user) });
});

router.post('/signout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('botpanel.sid');
    res.status(204).end();
  });
});

module.exports = {
  authRoutes: router,
};

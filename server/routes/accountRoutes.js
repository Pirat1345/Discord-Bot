const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const { TOTP, Secret } = require('otpauth');
const QRCode = require('qrcode');
const { readDb, writeDb } = require('../services/dbService');
const {
  sanitizeUser,
  findUserById,
  isUsernameInUse,
} = require('../services/userService');
const { createDefaultSettings, defaultFeatures } = require('../utils/defaults');
const { stopBotForUser } = require('../services/botService');
const { requireAuth } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permissions');
const { usersDir } = require('../config');

const router = express.Router();
const allowedRoles = new Set(['read', 'write', 'use', 'admin']);

const avatarMimeToExtension = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

function getUserDir(userId) {
  return path.join(usersDir, userId);
}

function getUserAvatarFiles(userId) {
  return ['png', 'jpg', 'jpeg', 'webp', 'gif'].map((extension) => path.join(getUserDir(userId), `avatar.${extension}`));
}

function parseImageDataUrl(dataUrl) {
  const value = String(dataUrl || '').trim();
  const match = value.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) {
    return null;
  }

  const mime = match[1].toLowerCase();
  const extension = avatarMimeToExtension[mime];
  if (!extension) {
    return null;
  }

  return {
    mime,
    extension,
    buffer: Buffer.from(match[2], 'base64'),
  };
}

async function writeAvatarFile(userId, dataUrl) {
  const parsed = parseImageDataUrl(dataUrl);
  const userDir = getUserDir(userId);

  await fsp.mkdir(userDir, { recursive: true });
  if (!parsed) {
    return null;
  }

  await Promise.all(getUserAvatarFiles(userId).map((filePath) => fsp.rm(filePath, { force: true })));

  const avatarPath = path.join(userDir, `avatar.${parsed.extension}`);
  await fsp.writeFile(avatarPath, parsed.buffer);
  return `avatar.${parsed.extension}`;
}

async function deleteAvatarFile(userId) {
  await Promise.all(getUserAvatarFiles(userId).map((filePath) => fsp.rm(filePath, { force: true })));
}

router.get('/', requireAuth, requirePermission('read'), async (req, res) => {
  const db = await readDb();
  const user = findUserById(db, req.session.userId);

  if (!user) {
    return res.status(401).json({ error: 'Nicht eingeloggt.' });
  }

  return res.json({ user: sanitizeUser(user) });
});

router.patch('/', requireAuth, requirePermission('write'), async (req, res) => {
  const { username, displayName, avatarDataUrl, currentPassword, newPassword } = req.body || {};

  const db = await readDb();
  const user = findUserById(db, req.session.userId);

  if (!user) {
    return res.status(401).json({ error: 'Nicht eingeloggt.' });
  }

  if (username !== undefined) {
    const normalizedUsername = String(username).trim().toLowerCase();

    if (!normalizedUsername) {
      return res.status(400).json({ error: 'Benutzername darf nicht leer sein.' });
    }

    if (isUsernameInUse(db, normalizedUsername, user.id)) {
      return res.status(409).json({ error: 'Dieser Benutzername ist bereits vergeben.' });
    }

    user.username = normalizedUsername;
  }

  if (displayName !== undefined) {
    const normalizedDisplayName = String(displayName).trim();

    if (!normalizedDisplayName) {
      return res.status(400).json({ error: 'Anzeigename darf nicht leer sein.' });
    }

    user.display_name = normalizedDisplayName;
  }

  if (avatarDataUrl !== undefined) {
    const normalizedAvatar = String(avatarDataUrl || '').trim();

    if (normalizedAvatar) {
      const avatarFile = await writeAvatarFile(user.id, normalizedAvatar);
      if (!avatarFile) {
        return res.status(400).json({ error: 'Avatar muss ein Bild im Data-URL-Format sein.' });
      }

      user.avatar_file = avatarFile;
      user.avatar_updated_at = new Date().toISOString();
      user.avatar_url = null;
    } else {
      await deleteAvatarFile(user.id);
      user.avatar_file = null;
      user.avatar_updated_at = null;
      user.avatar_url = null;
    }
  }

  if (newPassword !== undefined) {
    if (String(newPassword).length < 5) {
      return res
        .status(400)
        .json({ error: 'Neues Passwort muss mindestens 5 Zeichen lang sein.' });
    }

    const validCurrent = await bcrypt.compare(
      String(currentPassword || ''),
      user.password_hash
    );

    if (!validCurrent) {
      return res.status(401).json({ error: 'Aktuelles Passwort ist falsch.' });
    }

    user.password_hash = await bcrypt.hash(String(newPassword), 10);
    user.must_change_password = false;
  }

  await writeDb(db);
  return res.json({ user: sanitizeUser(user) });
});

router.get('/avatar', requireAuth, async (req, res) => {
  const db = await readDb();
  const user = findUserById(db, req.session.userId);

  if (!user) {
    return res.status(401).json({ error: 'Nicht eingeloggt.' });
  }

  if (!user.avatar_file) {
    return res.status(404).json({ error: 'Kein Profilbild vorhanden.' });
  }

  const avatarPath = path.join(getUserDir(user.id), user.avatar_file);
  if (!fs.existsSync(avatarPath)) {
    return res.status(404).json({ error: 'Kein Profilbild vorhanden.' });
  }

  return res.sendFile(avatarPath);
});

router.get('/users', requireAuth, requirePermission('admin'), async (_req, res) => {
  const db = await readDb();
  return res.json({ users: db.users.map(sanitizeUser) });
});

router.post('/users', requireAuth, requirePermission('admin'), async (req, res) => {
  const { username, password, role } = req.body || {};
  const normalizedUsername = String(username || '').trim().toLowerCase();
  const normalizedRole = String(role || '').trim().toLowerCase();

  if (!normalizedUsername || String(password || '').length < 5) {
    return res.status(400).json({ error: 'Benutzername und Passwort (mind. 5 Zeichen) sind erforderlich.' });
  }

  if (!allowedRoles.has(normalizedRole)) {
    return res.status(400).json({ error: 'Ungültige Rolle. Erlaubt: read, write, use, admin.' });
  }

  const db = await readDb();
  if (isUsernameInUse(db, normalizedUsername)) {
    return res.status(409).json({ error: 'Dieser Benutzername ist bereits vergeben.' });
  }

  const user = {
    id: crypto.randomUUID(),
    username: normalizedUsername,
    display_name: normalizedUsername,
    avatar_file: null,
    avatar_updated_at: null,
    avatar_url: null,
    password_hash: await bcrypt.hash(String(password), 10),
    role: normalizedRole,
    must_change_password: false,
    created_at: new Date().toISOString(),
  };

  db.users.push(user);
  db.settingsByUser[user.id] = createDefaultSettings(user.id);
  db.featuresByUser[user.id] = defaultFeatures();
  db.logsByUser[user.id] = [];

  await writeDb(db);
  return res.status(201).json({ user: sanitizeUser(user) });
});

router.delete('/users/:userId', requireAuth, requirePermission('admin'), async (req, res) => {
  const targetUserId = String(req.params.userId || '').trim();

  if (!targetUserId) {
    return res.status(400).json({ error: 'Ungültige Benutzer-ID.' });
  }

  const db = await readDb();
  const adminCount = db.users.filter((entry) => entry.role === 'admin').length;
  if (adminCount === 0) {
    return res.status(409).json({ error: 'Es muss mindestens ein Admin-Account existieren.' });
  }

  const targetUser = findUserById(db, targetUserId);

  if (!targetUser) {
    return res.status(404).json({ error: 'Account nicht gefunden.' });
  }

  if (targetUser.role === 'admin') {
    return res.status(403).json({ error: 'Admin-Accounts dürfen nicht gelöscht werden.' });
  }

  db.users = db.users.filter((user) => user.id !== targetUser.id);
  delete db.settingsByUser[targetUser.id];
  delete db.featuresByUser[targetUser.id];
  delete db.logsByUser[targetUser.id];
  delete db.guildConfigsByUser[targetUser.id];
  delete db.guildCacheByUser[targetUser.id];

  await writeDb(db);
  await stopBotForUser(targetUser.id);

  return res.status(204).send();
});

router.delete('/self', requireAuth, async (req, res) => {
  const db = await readDb();
  const adminCount = db.users.filter((entry) => entry.role === 'admin').length;
  if (adminCount === 0) {
    return res.status(409).json({ error: 'Es muss mindestens ein Admin-Account existieren.' });
  }

  const user = findUserById(db, req.session.userId);

  if (!user) {
    return res.status(401).json({ error: 'Nicht eingeloggt.' });
  }

  if (user.role === 'admin') {
    return res.status(403).json({ error: 'Admin-Accounts dürfen nicht gelöscht werden.' });
  }

  db.users = db.users.filter((entry) => entry.id !== user.id);
  delete db.settingsByUser[user.id];
  delete db.featuresByUser[user.id];
  delete db.logsByUser[user.id];
  delete db.guildConfigsByUser[user.id];
  delete db.guildCacheByUser[user.id];

  await writeDb(db);
  await stopBotForUser(user.id);

  req.session.destroy(() => {
    res.clearCookie('discord_bot_sid');
    return res.status(204).send();
  });
});

// ── 2FA / TOTP ───────────────────────────────────────────────

router.post('/2fa/setup', requireAuth, requirePermission('write'), async (req, res) => {
  const db = await readDb();
  const user = findUserById(db, req.session.userId);
  if (!user) return res.status(401).json({ error: 'Nicht eingeloggt.' });

  if (user.totp_enabled) {
    return res.status(400).json({ error: '2FA ist bereits aktiviert.' });
  }

  const secret = new Secret();
  user.totp_secret_pending = secret.base32;
  await writeDb(db);

  const totp = new TOTP({ issuer: 'BotPanel', label: user.username, secret });
  const otpauthUrl = totp.toString();
  const qrDataUrl = await QRCode.toDataURL(otpauthUrl);

  return res.json({ qr: qrDataUrl, secret: secret.base32 });
});

router.post('/2fa/verify', requireAuth, requirePermission('write'), async (req, res) => {
  const { code } = req.body || {};
  if (!code) return res.status(400).json({ error: 'Code erforderlich.' });

  const db = await readDb();
  const user = findUserById(db, req.session.userId);
  if (!user) return res.status(401).json({ error: 'Nicht eingeloggt.' });

  if (!user.totp_secret_pending) {
    return res.status(400).json({ error: 'Bitte zuerst 2FA einrichten.' });
  }

  const totp = new TOTP({ issuer: 'BotPanel', label: user.username, secret: Secret.fromBase32(user.totp_secret_pending) });
  const valid = totp.validate({ token: String(code).trim(), window: 1 }) !== null;

  if (!valid) {
    return res.status(400).json({ error: 'Ungültiger Code. Bitte erneut versuchen.' });
  }

  user.totp_secret = user.totp_secret_pending;
  user.totp_enabled = true;
  delete user.totp_secret_pending;
  await writeDb(db);

  return res.json({ user: sanitizeUser(user) });
});

router.post('/2fa/disable', requireAuth, requirePermission('write'), async (req, res) => {
  const { password } = req.body || {};
  if (!password) return res.status(400).json({ error: 'Passwort erforderlich.' });

  const db = await readDb();
  const user = findUserById(db, req.session.userId);
  if (!user) return res.status(401).json({ error: 'Nicht eingeloggt.' });

  const validPassword = await bcrypt.compare(String(password), user.password_hash);
  if (!validPassword) return res.status(401).json({ error: 'Passwort ist falsch.' });

  user.totp_secret = null;
  user.totp_secret_pending = null;
  user.totp_enabled = false;
  await writeDb(db);

  return res.json({ user: sanitizeUser(user) });
});

module.exports = {
  accountRoutes: router,
};

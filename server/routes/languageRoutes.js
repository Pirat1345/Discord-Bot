const express = require('express');
const fsp = require('fs/promises');
const path = require('path');
const { requireAuth } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permissions');
const { dataDir } = require('../config');

const router = express.Router();
const languagesDir = path.join(dataDir, 'general', 'languages');
const metaPath = path.join(languagesDir, '_meta.json');

async function ensureLanguagesDir() {
  await fsp.mkdir(languagesDir, { recursive: true });
}

async function readMeta() {
  await ensureLanguagesDir();
  try {
    const raw = await fsp.readFile(metaPath, 'utf8');
    return JSON.parse(raw);
  } catch {
    // Initialize with default German
    const defaultMeta = {
      languages: [{ code: 'de', name: 'Deutsch', isDefault: true }],
    };
    await fsp.writeFile(metaPath, JSON.stringify(defaultMeta, null, 2), 'utf8');
    return defaultMeta;
  }
}

async function writeMeta(meta) {
  await ensureLanguagesDir();
  await fsp.writeFile(metaPath, JSON.stringify(meta, null, 2), 'utf8');
}

// GET /api/languages — list all available languages
router.get('/', async (_req, res) => {
  const meta = await readMeta();
  return res.json({ languages: meta.languages });
});

// GET /api/languages/:code — get a language pack
router.get('/:code', async (req, res) => {
  const code = String(req.params.code || '').trim().toLowerCase();
  if (!code || !/^[a-z]{2,5}$/.test(code)) {
    return res.status(400).json({ error: 'Invalid language code.' });
  }

  const filePath = path.join(languagesDir, `${code}.json`);
  try {
    const raw = await fsp.readFile(filePath, 'utf8');
    return res.json(JSON.parse(raw));
  } catch {
    return res.status(404).json({ error: 'Language pack not found.' });
  }
});

// POST /api/languages — upload a new language pack (admin only)
router.post('/', requireAuth, requirePermission('admin'), async (req, res) => {
  const { code, name, translations } = req.body || {};

  const normalizedCode = String(code || '').trim().toLowerCase();
  const normalizedName = String(name || '').trim();

  if (!normalizedCode || !normalizedName || !translations || typeof translations !== 'object') {
    return res.status(400).json({ error: 'Code, name and translations are required.' });
  }

  if (!/^[a-z]{2,5}$/.test(normalizedCode)) {
    return res.status(400).json({ error: 'Language code must be 2-5 lowercase letters (e.g. en, fr, de).' });
  }

  await ensureLanguagesDir();

  const meta = await readMeta();
  const existing = meta.languages.find((l) => l.code === normalizedCode);

  if (existing) {
    existing.name = normalizedName;
  } else {
    meta.languages.push({ code: normalizedCode, name: normalizedName, isDefault: false });
  }

  const filePath = path.join(languagesDir, `${normalizedCode}.json`);
  await fsp.writeFile(filePath, JSON.stringify(translations, null, 2), 'utf8');
  await writeMeta(meta);

  return res.status(201).json({ language: { code: normalizedCode, name: normalizedName } });
});

// DELETE /api/languages/:code — delete a language pack (admin only)
router.delete('/:code', requireAuth, requirePermission('admin'), async (req, res) => {
  const code = String(req.params.code || '').trim().toLowerCase();
  if (!code) {
    return res.status(400).json({ error: 'Invalid language code.' });
  }

  const meta = await readMeta();
  const language = meta.languages.find((l) => l.code === code);

  if (!language) {
    return res.status(404).json({ error: 'Language pack not found.' });
  }

  if (language.isDefault) {
    return res.status(400).json({ error: 'The default language cannot be deleted.' });
  }

  if (meta.languages.length <= 1) {
    return res.status(400).json({ error: 'The last language pack cannot be deleted.' });
  }

  meta.languages = meta.languages.filter((l) => l.code !== code);

  const filePath = path.join(languagesDir, `${code}.json`);
  try {
    await fsp.rm(filePath, { force: true });
  } catch {
    // File might not exist
  }

  await writeMeta(meta);
  return res.status(204).send();
});

module.exports = {
  languageRoutes: router,
};

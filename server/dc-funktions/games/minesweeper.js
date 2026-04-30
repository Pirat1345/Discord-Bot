const { EmbedBuilder, AttachmentBuilder } = require('discord.js');
const sharp = require('sharp');
const { readDb, writeDb } = require('../../services/dbService');
const { createDefaultGuildConfig, defaultFeatures } = require('../../utils/defaults');

const FEATURE_KEY = 'minesweeper';

const BOARD_SIZE = 5;
const MINE_COUNT = 5;

// ── Colors ──────────────────────────────────────────────────────────
const COLORS = {
  bgFrom: '#0f172a',
  bgTo: '#1e293b',
  accent: '#22d3ee',
  cellHidden: '#334155',
  cellHiddenStroke: '#475569',
  cellRevealed: '#1e3a5f',
  cellRevealedStroke: '#3b82f6',
  cellMine: '#7f1d1d',
  cellMineStroke: '#ef4444',
  cellSafe: '#14532d',
  cellSafeStroke: '#22c55e',
  headerBg: '#1e293b',
  headerText: '#e2e8f0',
  coordText: '#94a3b8',
  titleText: '#ffffff',
  subtitleText: '#94a3b8',
  embedNew: 0x22d3ee,
  embedBoom: 0xef4444,
  embedSafe: 0x22c55e,
  embedWin: 0xfbbf24,
  embedInfo: 0x6366f1,
};

const NUMBER_COLORS = ['#64748b', '#3b82f6', '#22c55e', '#ef4444', '#8b5cf6', '#f59e0b', '#06b6d4', '#1e293b', '#ec4899'];

function ensureGuildConfigAndFeature(db, userId, guildId) {
  if (!db.guildConfigsByUser[userId]) {
    db.guildConfigsByUser[userId] = {};
  }

  if (!db.guildConfigsByUser[userId][guildId]) {
    db.guildConfigsByUser[userId][guildId] = createDefaultGuildConfig(userId, guildId);
  }

  const guildConfig = db.guildConfigsByUser[userId][guildId];
  if (!Array.isArray(guildConfig.features)) {
    guildConfig.features = [];
  }

  let feature = guildConfig.features.find((entry) => entry?.feature_key === FEATURE_KEY);
  if (!feature) {
    const fallback = defaultFeatures().find((entry) => entry.feature_key === FEATURE_KEY);
    if (!fallback) {
      return null;
    }
    guildConfig.features.push(fallback);
    feature = fallback;
  }

  return feature;
}

function generateBoard(size, mineCount) {
  const board = Array.from({ length: size }, () => Array(size).fill(false));
  let placed = 0;
  while (placed < mineCount) {
    const r = Math.floor(Math.random() * size);
    const c = Math.floor(Math.random() * size);
    if (!board[r][c]) {
      board[r][c] = true;
      placed++;
    }
  }
  return board;
}

function countAdjacentMines(board, row, col) {
  const size = board.length;
  let count = 0;
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const nr = row + dr;
      const nc = col + dc;
      if (nr >= 0 && nr < size && nc >= 0 && nc < size && board[nr][nc]) {
        count++;
      }
    }
  }
  return count;
}

function parseGameState(config) {
  const channelId = String(config.channelId || '').trim();
  const lastUserId = String(config.lastUserId || '').trim();
  const lastUsername = String(config.lastUsername || '').trim();
  const safeCells = Math.max(0, parseInt(String(config.safeCells || '0'), 10) || 0);
  const totalSafe = Math.max(0, parseInt(String(config.totalSafe || '0'), 10) || 0);

  let board = null;
  let revealed = null;
  try {
    board = JSON.parse(config.board || 'null');
    revealed = JSON.parse(config.revealed || 'null');
  } catch {
    board = null;
    revealed = null;
  }

  return { channelId, lastUserId, lastUsername, safeCells, totalSafe, board, revealed, allowSameUser: config.allowSameUser === 'true' };
}

function startNewGame() {
  const board = generateBoard(BOARD_SIZE, MINE_COUNT);
  const revealed = Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(false));
  const totalSafe = BOARD_SIZE * BOARD_SIZE - MINE_COUNT;

  return {
    board: JSON.stringify(board),
    revealed: JSON.stringify(revealed),
    safeCells: '0',
    totalSafe: String(totalSafe),
    lastUserId: '',
    lastUsername: '',
  };
}

function parseCoordinate(input) {
  const clean = input.toUpperCase().trim();
  if (clean.length < 2 || clean.length > 2) return null;

  const rowChar = clean[0];
  const colChar = clean[1];

  const row = rowChar.charCodeAt(0) - 'A'.charCodeAt(0);
  const col = parseInt(colChar, 10) - 1;

  if (row < 0 || row >= BOARD_SIZE || col < 0 || col >= BOARD_SIZE) return null;
  if (Number.isNaN(col)) return null;

  return { row, col };
}

function escapeXml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// ── SVG Board Rendering ─────────────────────────────────────────────
function buildBoardSvg(board, revealed, { showAll = false, highlightCell = null, title = 'Minesweeper', subtitle = '', safeCells = 0, totalSafe = 0 } = {}) {
  const cellSize = 96;
  const cellGap = 8;
  const headerHeight = 44;
  const padding = 40;
  const topArea = 100;
  const bottomArea = 56;
  const coordSize = 44;

  const gridWidth = board.length * (cellSize + cellGap) - cellGap;
  const gridHeight = board.length * (cellSize + cellGap) - cellGap;
  const totalWidth = padding * 2 + coordSize + gridWidth + 12;
  const totalHeight = topArea + headerHeight + gridHeight + bottomArea + padding;

  const gridStartX = padding + coordSize + 8;
  const gridStartY = topArea + headerHeight + 4;

  const rowLabels = ['A', 'B', 'C', 'D', 'E'];
  const colLabels = ['1', '2', '3', '4', '5'];

  let cells = '';

  // Column headers
  for (let c = 0; c < board.length; c++) {
    const x = gridStartX + c * (cellSize + cellGap) + cellSize / 2;
    const y = gridStartY - 10;
    cells += `<text x="${x}" y="${y}" fill="${COLORS.coordText}" font-size="22" font-family="Segoe UI, Arial, sans-serif" font-weight="600" text-anchor="middle">${colLabels[c]}</text>`;
  }

  // Row labels + cells
  for (let r = 0; r < board.length; r++) {
    const rowY = gridStartY + r * (cellSize + cellGap);
    cells += `<text x="${padding + coordSize / 2}" y="${rowY + cellSize / 2 + 8}" fill="${COLORS.coordText}" font-size="22" font-family="Segoe UI, Arial, sans-serif" font-weight="600" text-anchor="middle">${rowLabels[r]}</text>`;

    for (let c = 0; c < board[r].length; c++) {
      const x = gridStartX + c * (cellSize + cellGap);
      const y = rowY;
      const isHighlight = highlightCell && highlightCell.row === r && highlightCell.col === c;

      if (showAll) {
        if (board[r][c]) {
          // Mine cell
          cells += `<rect x="${x}" y="${y}" width="${cellSize}" height="${cellSize}" rx="10" fill="${COLORS.cellMine}" stroke="${COLORS.cellMineStroke}" stroke-width="2" />`;
          cells += `<text x="${x + cellSize / 2}" y="${y + cellSize / 2 + 12}" fill="#fca5a5" font-size="42" text-anchor="middle">💣</text>`;
        } else {
          cells += `<rect x="${x}" y="${y}" width="${cellSize}" height="${cellSize}" rx="10" fill="${COLORS.cellSafe}" stroke="${COLORS.cellSafeStroke}" stroke-width="2" />`;
          cells += `<text x="${x + cellSize / 2}" y="${y + cellSize / 2 + 10}" fill="#86efac" font-size="32" text-anchor="middle">✓</text>`;
        }
      } else if (revealed[r][c]) {
        const adj = countAdjacentMines(board, r, c);
        const numColor = NUMBER_COLORS[adj] || '#e2e8f0';
        const strokeColor = isHighlight ? '#fbbf24' : COLORS.cellRevealedStroke;
        const strokeWidth = isHighlight ? 3 : 2;
        cells += `<rect x="${x}" y="${y}" width="${cellSize}" height="${cellSize}" rx="10" fill="${COLORS.cellRevealed}" stroke="${strokeColor}" stroke-width="${strokeWidth}" />`;
        cells += `<text x="${x + cellSize / 2}" y="${y + cellSize / 2 + 12}" fill="${numColor}" font-size="38" font-family="Segoe UI, Arial, sans-serif" font-weight="700" text-anchor="middle">${adj}</text>`;
      } else {
        // Hidden cell
        cells += `<rect x="${x}" y="${y}" width="${cellSize}" height="${cellSize}" rx="10" fill="${COLORS.cellHidden}" stroke="${COLORS.cellHiddenStroke}" stroke-width="2" />`;
        cells += `<text x="${x + cellSize / 2}" y="${y + cellSize / 2 + 10}" fill="#64748b" font-size="26" text-anchor="middle">?</text>`;
      }
    }
  }

  // Progress bar
  const progressBarWidth = gridWidth;
  const progressBarHeight = 10;
  const progressBarX = gridStartX;
  const progressBarY = gridStartY + gridHeight + 18;
  const progressFill = totalSafe > 0 ? Math.min(1, safeCells / totalSafe) : 0;
  const progressColor = progressFill >= 1 ? '#fbbf24' : COLORS.accent;

  const progressSection = `
    <rect x="${progressBarX}" y="${progressBarY}" width="${progressBarWidth}" height="${progressBarHeight}" rx="4" fill="#1e293b" stroke="#334155" stroke-width="1" />
    <rect x="${progressBarX}" y="${progressBarY}" width="${Math.round(progressBarWidth * progressFill)}" height="${progressBarHeight}" rx="4" fill="${progressColor}" />
    <text x="${progressBarX + progressBarWidth + 12}" y="${progressBarY + 10}" fill="${COLORS.subtitleText}" font-size="15" font-family="Segoe UI, Arial, sans-serif">${safeCells}/${totalSafe}</text>
  `;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="${totalHeight}" viewBox="0 0 ${totalWidth} ${totalHeight}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${COLORS.bgFrom}" />
      <stop offset="100%" stop-color="${COLORS.bgTo}" />
    </linearGradient>
  </defs>
  <rect width="${totalWidth}" height="${totalHeight}" rx="24" fill="url(#bg)" />
  <rect x="${padding}" y="${topArea - 8}" width="${totalWidth - padding * 2}" height="3" rx="1.5" fill="${COLORS.accent}" opacity="0.5" />
  <text x="${padding}" y="46" fill="${COLORS.titleText}" font-size="34" font-family="Segoe UI, Arial, sans-serif" font-weight="700">💣  ${escapeXml(title)}</text>
  <text x="${padding}" y="76" fill="${COLORS.subtitleText}" font-size="18" font-family="Segoe UI, Arial, sans-serif">${escapeXml(subtitle)}</text>
  ${cells}
  ${progressSection}
</svg>`;
}

async function renderBoardPng(svgMarkup) {
  return sharp(Buffer.from(svgMarkup, 'utf8'))
    .png({ quality: 95, compressionLevel: 8 })
    .toBuffer();
}

async function sendBoardEmbed(channel, { title, description, color, board, revealed, showAll = false, highlightCell = null, subtitle = '', safeCells = 0, totalSafe = 0, footer = null }) {
  const svg = buildBoardSvg(board, revealed, { showAll, highlightCell, title, subtitle, safeCells, totalSafe });
  const png = await renderBoardPng(svg);
  const attachment = new AttachmentBuilder(png, { name: 'minesweeper.png' });

  const embed = new EmbedBuilder()
    .setColor(color)
    .setDescription(description)
    .setImage('attachment://minesweeper.png');

  if (footer) {
    embed.setFooter({ text: footer });
  }

  await channel.send({ embeds: [embed], files: [attachment] });
}

// ── Message Handler ─────────────────────────────────────────────────
async function handleMessageCreate({ userId, message }) {
  const guildId = String(message?.guildId || '').trim();
  if (!guildId || !message?.author || message.author.bot) {
    return;
  }

  const db = await readDb();
  const feature = ensureGuildConfigAndFeature(db, userId, guildId);
  if (!feature || !feature.enabled) {
    return;
  }

  const state = parseGameState(feature.config);
  if (!state.channelId || state.channelId !== String(message.channelId || '').trim()) {
    return;
  }

  const content = String(message.content || '').trim();

  // Only process if there's an active game
  if (!state.board || !state.revealed) {
    return;
  }

  const coord = parseCoordinate(content);
  if (!coord) {
    return;
  }

  // Check: same user can't play twice in a row (unless allowSameUser is on)
  if (!state.allowSameUser && state.lastUserId && state.lastUserId === message.author.id) {
    try {
      await message.react('⛔');
      const embed = new EmbedBuilder()
        .setColor(COLORS.embedInfo)
        .setDescription(`⛔ **${escapeXml(message.member?.displayName || message.author.username)}**, du warst gerade dran!\nWarte bis jemand anderes spielt.`);
      await message.channel.send({ embeds: [embed] });
    } catch { /* ignore */ }
    return;
  }

  const { row, col } = coord;

  // Already revealed?
  if (state.revealed[row][col]) {
    try {
      await message.react('🔄');
      const embed = new EmbedBuilder()
        .setColor(COLORS.embedInfo)
        .setDescription('🔄 This tile has already been revealed. Choose another one!');
      await message.channel.send({ embeds: [embed] });
    } catch { /* ignore */ }
    return;
  }

  // Hit a mine?
  if (state.board[row][col]) {
    const username = message.member?.displayName || message.author.username || 'Unknown';
    await message.react('💥');

    // Show the full board with the mine highlighted
    await sendBoardEmbed(message.channel, {
      title: 'BOOM!',
      subtitle: `${username} hit a mine!`,
      description: `💥 **BOOM!** ${escapeXml(username)} hit a mine on **${content.toUpperCase()}**!\nAll mines are being revealed...`,
      color: COLORS.embedBoom,
      board: state.board,
      revealed: state.revealed,
      showAll: true,
      highlightCell: { row, col },
      safeCells: state.safeCells,
      totalSafe: state.totalSafe,
      footer: '💀 Game Over',
    });

    // Start a new game
    const newState = startNewGame();
    feature.config = { ...feature.config, ...newState };
    feature.updated_at = new Date().toISOString();
    await writeDb(db);

    const newBoard = JSON.parse(newState.board);
    const newRevealed = JSON.parse(newState.revealed);

    await sendBoardEmbed(message.channel, {
      title: 'Minesweeper',
      subtitle: 'New game started!',
      description: '🔄 **New game!**\nType a coordinate (e.g. `A1`) to continue playing.',
      color: COLORS.embedNew,
      board: newBoard,
      revealed: newRevealed,
      safeCells: 0,
      totalSafe: BOARD_SIZE * BOARD_SIZE - MINE_COUNT,
    });
    return;
  }

  // Safe cell
  state.revealed[row][col] = true;
  state.safeCells++;
  state.lastUserId = message.author.id;
  state.lastUsername = String(message.member?.displayName || message.author.username || '').trim();

  feature.config = {
    ...feature.config,
    board: JSON.stringify(state.board),
    revealed: JSON.stringify(state.revealed),
    safeCells: String(state.safeCells),
    lastUserId: state.lastUserId,
    lastUsername: state.lastUsername,
  };
  feature.updated_at = new Date().toISOString();
  await writeDb(db);

  // Check for win
  if (state.safeCells >= state.totalSafe) {
    await message.react('🏆');

    await sendBoardEmbed(message.channel, {
      title: 'Won!',
      subtitle: 'All safe tiles revealed!',
      description: `🏆 **Won!** All safe tiles have been revealed!\nType \`/set game minesweeper\` to start a new game.`,
      color: COLORS.embedWin,
      board: state.board,
      revealed: state.revealed,
      highlightCell: { row, col },
      safeCells: state.safeCells,
      totalSafe: state.totalSafe,
      footer: '🎉 Congratulations!',
    });

    const newState = startNewGame();
    feature.config = { ...feature.config, ...newState };
    feature.updated_at = new Date().toISOString();
    await writeDb(db);
    return;
  }

  await message.react('🟢');
  const adj = countAdjacentMines(state.board, row, col);

  await sendBoardEmbed(message.channel, {
    title: 'Minesweeper',
    subtitle: `${state.lastUsername} revealed ${content.toUpperCase()}`,
    description: `🟢 **${escapeXml(state.lastUsername)}** revealed **${content.toUpperCase()}** — **${adj}** mine(s) nearby.`,
    color: COLORS.embedSafe,
    board: state.board,
    revealed: state.revealed,
    highlightCell: { row, col },
    safeCells: state.safeCells,
    totalSafe: state.totalSafe,
    footer: `Next player's turn!`,
  });
}

// ── Slash command handlers ──────────────────────────────────────────
async function setMinesweeperForGuild({ userId, guildId, channelId, channel }) {
  const db = await readDb();
  const feature = ensureGuildConfigAndFeature(db, userId, guildId);
  if (!feature) {
    return { changed: false };
  }

  const newState = startNewGame();
  feature.enabled = true;
  feature.config = {
    ...feature.config,
    channelId: String(channelId || '').trim(),
    ...newState,
  };
  feature.updated_at = new Date().toISOString();
  await writeDb(db);

  const board = JSON.parse(newState.board);
  const revealed = JSON.parse(newState.revealed);

  if (channel && typeof channel.send === 'function') {
    await sendBoardEmbed(channel, {
      title: 'Minesweeper',
      subtitle: 'New game started!',
      description: '💣 **New game!**\nType a coordinate (e.g. `A1`, `C3`) to reveal a tile.\nEach player can only go once in a row!',
      color: COLORS.embedNew,
      board,
      revealed,
      safeCells: 0,
      totalSafe: BOARD_SIZE * BOARD_SIZE - MINE_COUNT,
    });
  }

  return { changed: true };
}

async function resetMinesweeperForGuild({ userId, guildId }) {
  const db = await readDb();
  const feature = ensureGuildConfigAndFeature(db, userId, guildId);
  if (!feature) {
    return { changed: false };
  }

  feature.enabled = false;
  feature.config = {
    ...feature.config,
    board: '',
    revealed: '',
    safeCells: '0',
    totalSafe: '0',
    lastUserId: '',
    lastUsername: '',
  };
  feature.updated_at = new Date().toISOString();
  await writeDb(db);

  return { changed: true };
}

module.exports = {
  handleMessageCreate,
  setMinesweeperForGuild,
  resetMinesweeperForGuild,
  FEATURE_KEY,
};

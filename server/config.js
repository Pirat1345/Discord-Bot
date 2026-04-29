const path = require('path');

const dataDir = path.join(__dirname, 'data');
const usersDir = path.join(dataDir, 'user');

module.exports = {
  PORT: Number(process.env.API_PORT || 3001),
  FRONTEND_ORIGIN: process.env.FRONTEND_ORIGIN || 'http://localhost:8080',
  DISCORD_BOT_TOKEN: process.env.DISCORD_BOT_TOKEN || '',
  dataDir,
  usersDir,
  dbPath: path.join(dataDir, 'db.json'),
};

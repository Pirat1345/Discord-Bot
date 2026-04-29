const { FRONTEND_ORIGIN } = require('../config');

function corsMiddleware(req, res, next) {
  const requestOrigin = req.headers.origin;
  const isLocalhostOrigin =
    typeof requestOrigin === 'string' && /^http:\/\/localhost:\d+$/.test(requestOrigin);
  const allowOrigin = isLocalhostOrigin ? requestOrigin : FRONTEND_ORIGIN;

  res.header('Access-Control-Allow-Origin', allowOrigin);
  res.header('Vary', 'Origin');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  res.header('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }

  return next();
}

module.exports = {
  corsMiddleware,
};

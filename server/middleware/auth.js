const { readDb } = require('../services/dbService');
const { findUserById } = require('../services/userService');

function requireAuth(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Nicht eingeloggt.' });
  }

  return readDb()
    .then((db) => {
      const user = findUserById(db, req.session.userId);
      if (!user) {
        return res.status(401).json({ error: 'Nicht eingeloggt.' });
      }
      req.authUser = user;
      return next();
    })
    .catch(() => res.status(500).json({ error: 'Interner Serverfehler.' }));
}

module.exports = {
  requireAuth,
};

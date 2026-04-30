function sanitizeUser(user) {
  return {
    id: user.id,
    username: user.username,
    display_name: user.display_name || user.username,
    avatar_url: user.avatar_file
      ? `/api/account/avatar?v=${encodeURIComponent(user.avatar_updated_at || user.updated_at || user.created_at || '')}`
      : user.avatar_url || null,
    role: user.role,
    must_change_password: Boolean(user.must_change_password),
    totp_enabled: Boolean(user.totp_enabled),
    language: user.language || 'de',
    created_at: user.created_at,
  };
}

function findUserById(db, userId) {
  return db.users.find((u) => u.id === userId);
}

function findUserByUsername(db, username) {
  const normalizedUsername = String(username || '').trim().toLowerCase();
  return db.users.find((u) => String(u.username || '').toLowerCase() === normalizedUsername);
}

function isUsernameInUse(db, username, excludeUserId) {
  const normalizedUsername = String(username || '').trim().toLowerCase();
  return db.users.some(
    (u) => u.id !== excludeUserId && String(u.username || '').toLowerCase() === normalizedUsername
  );
}

module.exports = {
  sanitizeUser,
  findUserById,
  findUserByUsername,
  isUsernameInUse,
};

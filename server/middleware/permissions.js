const ROLE_PERMISSIONS = {
  read: ['read'],
  use: ['read', 'use'],
  write: ['read', 'use', 'write'],
  admin: ['read', 'use', 'write', 'admin'],
};

function hasPermission(role, permission) {
  const effectiveRole = role && ROLE_PERMISSIONS[role] ? role : 'read';
  return ROLE_PERMISSIONS[effectiveRole].includes(permission);
}

function requirePermission(permission) {
  return (req, res, next) => {
    const role = req.authUser?.role;
    if (!hasPermission(role, permission)) {
      return res.status(403).json({ error: 'No permission for this action.' });
    }
    return next();
  };
}

module.exports = {
  ROLE_PERMISSIONS,
  hasPermission,
  requirePermission,
};

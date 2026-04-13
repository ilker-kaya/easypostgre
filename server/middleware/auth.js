function requireAdminSession(sessionService) {
  return (req, res, next) => {
    const sid = req.cookies.sid || req.header('x-session-id');
    const session = sessionService.validate(sid);

    if (!session) {
      return res.status(401).json({ error: 'Unauthorized: valid admin session required.' });
    }

    req.adminSession = session;
    next();
  };
}

module.exports = { requireAdminSession };

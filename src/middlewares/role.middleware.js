module.exports = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.role || !allowedRoles.includes(req.role)) {
      return res.status(403).json({
        success: false,
        message: "Sizda bu amal uchun ruxsat yo'q",
      });
    }

    next();
  };
};

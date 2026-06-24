const jwt = require('jsonwebtoken');
require('dotenv').config();

const authenticateAdmin = (req, res, next) => {
  const token = req.cookies.admin_token;

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized. Please login again.' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.empid !== 'ADMIN001') {
      return res.status(403).json({ error: 'Access denied. Admin privileges required.' });
    }
    req.admin = decoded;
    next();
  } catch (err) {
    res.clearCookie('admin_token', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict'
    });
    return res.status(401).json({ error: 'Session expired. Please login again.' });
  }
};

module.exports = { authenticateAdmin };

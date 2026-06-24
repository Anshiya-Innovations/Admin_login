const rateLimit = require('express-rate-limit');

// Rate limiter for admin portal
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: 'Too many requests, please try again after 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false
});

// HTML escaping helper (XSS prevention)
function escapeHtml(str) {
  if (typeof str !== 'string') return str;
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Request body sanitization middleware
const sanitizeInput = (req, res, next) => {
  if (req.body) {
    for (const key in req.body) {
      if (typeof req.body[key] === 'string') {
        req.body[key] = escapeHtml(req.body[key].trim());
      }
    }
  }
  next();
};

// Validate admin login
const validateLogin = (req, res, next) => {
  const { empid, password } = req.body;

  if (!empid || typeof empid !== 'string') {
    return res.status(400).json({ error: 'Employee ID is required.' });
  }

  // Admin ID is expected to be ADMIN001 specifically
  if (empid !== 'ADMIN001') {
    return res.status(400).json({ error: 'Invalid Employee ID.' });
  }

  if (!password || typeof password !== 'string' || !password) {
    return res.status(400).json({ error: 'Password is required.' });
  }

  next();
};

// Validate employee addition by admin
const validateAddEmployee = (req, res, next) => {
  const { name, empid, password } = req.body;

  if (!name || typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 100) {
    return res.status(400).json({ error: 'Full Name must be between 2 and 100 characters.' });
  }

  if (/[<>\/;]/.test(name)) {
    return res.status(400).json({ error: 'Full Name contains invalid characters.' });
  }

  if (!empid || typeof empid !== 'string') {
    return res.status(400).json({ error: 'Employee ID is required.' });
  }

  const empIdRegex = /^EMP\d{3,}$/i;
  if (!empIdRegex.test(empid)) {
    return res.status(400).json({ error: 'Employee ID must be in format EMP001.' });
  }

  if (!password || typeof password !== 'string') {
    return res.status(400).json({ error: 'Password is required.' });
  }

  // Password rules validation: min 8 characters, 1 upper, 1 lower, 1 number, 1 special character
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters long.' });
  }
  if (!/[A-Z]/.test(password)) {
    return res.status(400).json({ error: 'Password must contain at least one uppercase letter.' });
  }
  if (!/[a-z]/.test(password)) {
    return res.status(400).json({ error: 'Password must contain at least one lowercase letter.' });
  }
  if (!/[0-9]/.test(password)) {
    return res.status(400).json({ error: 'Password must contain at least one number.' });
  }
  if (!/[^A-Za-z0-9]/.test(password)) {
    return res.status(400).json({ error: 'Password must contain at least one special character.' });
  }

  next();
};

module.exports = {
  authLimiter,
  sanitizeInput,
  validateLogin,
  validateAddEmployee
};

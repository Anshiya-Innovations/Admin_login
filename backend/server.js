const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const initDatabases = require('./dbInit');
const adminRoutes = require('./routes/adminRoutes');

require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 4000;

// Security Middlewares
app.use(helmet({
  contentSecurityPolicy: false
}));

app.use(cors({
  origin: true,
  credentials: true
}));

app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API Routes
app.use('/api/admin', adminRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled server error:', err);
  res.status(500).json({ error: 'Internal Server Error' });
});

// Initialize database and start server
initDatabases()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Access Management Server is running on port ${PORT}`);
    });
  })
  .catch(err => {
    console.error('Failed to initialize database. Server not started:', err);
  });

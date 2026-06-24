const mysql = require('mysql2/promise');
require('dotenv').config();

// Connection pool for user_portal_db
const poolPortal = mysql.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_USER_PORTAL,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Connection pool for access_management_db
const poolAccess = mysql.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_ACCESS_MGMT,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

module.exports = {
  poolPortal,
  poolAccess
};

const mysql = require('mysql2/promise');
const argon2 = require('argon2');
require('dotenv').config();

async function initDatabases() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASS
  });

  try {
    console.log('Initializing databases and tables...');

    // 1. Create databases
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${process.env.DB_USER_PORTAL}\``);
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${process.env.DB_ACCESS_MGMT}\``);

    // 2. Create tables for user_portal_db
    await connection.query(`USE \`${process.env.DB_USER_PORTAL}\``);
    
    await connection.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        employee_id VARCHAR(50) UNIQUE NOT NULL,
        full_name VARCHAR(100) NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        approval_status VARCHAR(20) DEFAULT 'Approved',
        account_status VARCHAR(20) DEFAULT 'Active',
        failed_attempts INT DEFAULT 0,
        lockout_until DATETIME NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS registration_requests (
        request_id INT AUTO_INCREMENT PRIMARY KEY,
        employee_id VARCHAR(50) UNIQUE NOT NULL,
        full_name VARCHAR(100) NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        request_status VARCHAR(20) DEFAULT 'Pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 3. Create tables for access_management_db
    await connection.query(`USE \`${process.env.DB_ACCESS_MGMT}\``);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS admin_users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        employee_id VARCHAR(50) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS employee_list (
        id INT AUTO_INCREMENT PRIMARY KEY,
        employee_id VARCHAR(50) UNIQUE NOT NULL,
        full_name VARCHAR(100) NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        status VARCHAR(20) DEFAULT 'Approved',
        approved_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS access_requests (
        request_id INT AUTO_INCREMENT PRIMARY KEY,
        employee_id VARCHAR(50) UNIQUE NOT NULL,
        full_name VARCHAR(100) NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        request_status VARCHAR(20) DEFAULT 'Pending',
        requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 4. Seed admin user if not exists
    const [admins] = await connection.query('SELECT * FROM admin_users WHERE employee_id = ?', ['ADMIN001']);
    if (admins.length === 0) {
      console.log('Seeding admin account ADMIN001...');
      const hash = await argon2.hash('Admin@001', {
        type: argon2.argon2id
      });
      await connection.query('INSERT INTO admin_users (employee_id, password_hash) VALUES (?, ?)', ['ADMIN001', hash]);
      console.log('Admin account ADMIN001 seeded successfully.');
    }

    console.log('Database initialization complete.');
  } catch (err) {
    console.error('Error initializing databases:', err);
    throw err;
  } finally {
    await connection.end();
  }
}

module.exports = initDatabases;

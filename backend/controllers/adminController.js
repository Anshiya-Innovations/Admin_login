const argon2 = require('argon2');
const jwt = require('jsonwebtoken');
const { poolPortal, poolAccess } = require('../db');
require('dotenv').config();

// Admin Login
const login = async (req, res) => {
  const { empid, password } = req.body;

  try {
    const [admins] = await poolAccess.query('SELECT * FROM admin_users WHERE employee_id = ?', [empid]);

    if (admins.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials. Only admin access allowed.' });
    }

    const admin = admins[0];

    const validPassword = await argon2.verify(admin.password_hash, password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials.' });
    }

    const token = jwt.sign(
      { empid: admin.employee_id, role: 'admin' },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.cookie('admin_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
    });

    return res.status(200).json({
      message: 'Admin logged in successfully.',
      admin: { empid: admin.employee_id }
    });
  } catch (err) {
    console.error('Admin login error:', err);
    return res.status(500).json({ error: 'Failed to process login.' });
  }
};

// Get pending access requests
const getPendingRequests = async (req, res) => {
  try {
    const [rows] = await poolAccess.query(
      'SELECT employee_id, full_name FROM access_requests WHERE request_status = "Pending"'
    );
    return res.status(200).json(rows);
  } catch (err) {
    console.error('Fetch pending requests error:', err);
    return res.status(500).json({ error: 'Failed to retrieve access requests.' });
  }
};

// Get approved employee list
const getEmployees = async (req, res) => {
  try {
    const [rows] = await poolAccess.query('SELECT employee_id, full_name FROM employee_list');
    return res.status(200).json(rows);
  } catch (err) {
    console.error('Fetch employee list error:', err);
    return res.status(500).json({ error: 'Failed to retrieve employee list.' });
  }
};

// Approve Request
const approveRequest = async (req, res) => {
  const { empid } = req.params;

  let connectionPortal;
  let connectionAccess;

  try {
    connectionPortal = await poolPortal.getConnection();
    connectionAccess = await poolAccess.getConnection();

    const [requests] = await connectionPortal.query(
      'SELECT * FROM registration_requests WHERE employee_id = ? AND request_status = "Pending"',
      [empid]
    );

    if (requests.length === 0) {
      return res.status(404).json({ error: 'Pending registration request not found.' });
    }

    const reqData = requests[0];

    await connectionPortal.beginTransaction();
    await connectionAccess.beginTransaction();

    // 1. Update status to Approved in access_requests
    await connectionAccess.query(
      'UPDATE access_requests SET request_status = "Approved" WHERE employee_id = ?',
      [empid]
    );

    // 2. Add to employee_list in access_management_db
    await connectionAccess.query(
      `INSERT INTO employee_list (employee_id, full_name, email, status, approved_at) 
       VALUES (?, ?, ?, 'Approved', CURRENT_TIMESTAMP)`,
      [empid, reqData.full_name, reqData.email]
    );

    // 3. Create active user account in user_portal_db.users
    await connectionPortal.query(
      `INSERT INTO users 
       (employee_id, full_name, email, password_hash, approval_status, account_status) 
       VALUES (?, ?, ?, ?, 'Approved', 'Active')`,
      [
        empid,
        reqData.full_name,
        reqData.email,
        reqData.password_hash
      ]
    );

    // 4. Update status in registration_requests
    await connectionPortal.query(
      'UPDATE registration_requests SET request_status = "Approved" WHERE employee_id = ?',
      [empid]
    );

    await connectionPortal.commit();
    await connectionAccess.commit();

    return res.status(200).json({ message: 'Request approved successfully.' });
  } catch (err) {
    try {
      if (connectionPortal) await connectionPortal.rollback();
    } catch (rerr) {}
    try {
      if (connectionAccess) await connectionAccess.rollback();
    } catch (rerr) {}
    console.error('Approve request error:', err);
    return res.status(500).json({ error: 'Failed to approve request.' });
  } finally {
    if (connectionPortal) connectionPortal.release();
    if (connectionAccess) connectionAccess.release();
  }
};

// Decline Request
const declineRequest = async (req, res) => {
  const { empid } = req.params;

  let connectionPortal;
  let connectionAccess;

  try {
    connectionPortal = await poolPortal.getConnection();
    connectionAccess = await poolAccess.getConnection();

    const [requests] = await connectionAccess.query(
      'SELECT * FROM access_requests WHERE employee_id = ? AND request_status = "Pending"',
      [empid]
    );

    if (requests.length === 0) {
      return res.status(404).json({ error: 'Pending access request not found.' });
    }

    await connectionPortal.beginTransaction();
    await connectionAccess.beginTransaction();

    await connectionAccess.query(
      'UPDATE access_requests SET request_status = "Declined" WHERE employee_id = ?',
      [empid]
    );

    await connectionPortal.query(
      'UPDATE registration_requests SET request_status = "Declined" WHERE employee_id = ?',
      [empid]
    );

    await connectionPortal.commit();
    await connectionAccess.commit();

    return res.status(200).json({ message: 'Request declined successfully.' });
  } catch (err) {
    try {
      if (connectionPortal) await connectionPortal.rollback();
    } catch (rerr) {}
    try {
      if (connectionAccess) await connectionAccess.rollback();
    } catch (rerr) {}
    console.error('Decline request error:', err);
    return res.status(500).json({ error: 'Failed to decline request.' });
  } finally {
    if (connectionPortal) connectionPortal.release();
    if (connectionAccess) connectionAccess.release();
  }
};

// Manually Add Employee
const addEmployee = async (req, res) => {
  const { name, empid, password } = req.body;
  const email = `${empid.toLowerCase()}@company.com`;

  let connectionPortal;
  let connectionAccess;

  try {
    connectionPortal = await poolPortal.getConnection();
    connectionAccess = await poolAccess.getConnection();

    const [exist] = await connectionAccess.query(
      'SELECT employee_id FROM employee_list WHERE employee_id = ?',
      [empid]
    );
    if (exist.length > 0) {
      return res.status(400).json({ error: 'Employee ID already exists in employee list.' });
    }

    const passwordHash = await argon2.hash(password, { type: argon2.argon2id });

    await connectionPortal.beginTransaction();
    await connectionAccess.beginTransaction();

    await connectionAccess.query(
      `INSERT INTO employee_list (employee_id, full_name, email, status, approved_at) 
       VALUES (?, ?, ?, 'Approved', CURRENT_TIMESTAMP)`,
      [empid, name, email]
    );

    await connectionPortal.query(
      `INSERT INTO users 
       (employee_id, full_name, email, password_hash, approval_status, account_status) 
       VALUES (?, ?, ?, ?, 'Approved', 'Active')`,
      [empid, name, email, passwordHash]
    );

    await connectionPortal.commit();
    await connectionAccess.commit();

    return res.status(201).json({ message: 'Employee added successfully.' });
  } catch (err) {
    try {
      if (connectionPortal) await connectionPortal.rollback();
    } catch (rerr) {}
    try {
      if (connectionAccess) await connectionAccess.rollback();
    } catch (rerr) {}
    console.error('Add employee manually error:', err);
    return res.status(500).json({ error: 'Failed to add employee manually.' });
  } finally {
    if (connectionPortal) connectionPortal.release();
    if (connectionAccess) connectionAccess.release();
  }
};

// Delete Employee
const deleteEmployee = async (req, res) => {
  const { empid } = req.params;

  let connectionPortal;
  let connectionAccess;

  try {
    connectionPortal = await poolPortal.getConnection();
    connectionAccess = await poolAccess.getConnection();

    const [exist] = await connectionAccess.query(
      'SELECT employee_id FROM employee_list WHERE employee_id = ?',
      [empid]
    );
    if (exist.length === 0) {
      return res.status(404).json({ error: 'Employee not found.' });
    }

    await connectionPortal.beginTransaction();
    await connectionAccess.beginTransaction();

    await connectionAccess.query('DELETE FROM employee_list WHERE employee_id = ?', [empid]);
    await connectionPortal.query('DELETE FROM users WHERE employee_id = ?', [empid]);

    await connectionPortal.query('DELETE FROM registration_requests WHERE employee_id = ?', [empid]);
    await connectionAccess.query('DELETE FROM access_requests WHERE employee_id = ?', [empid]);

    await connectionPortal.commit();
    await connectionAccess.commit();

    return res.status(200).json({ message: 'Employee deleted and accounts de-provisioned successfully.' });
  } catch (err) {
    try {
      if (connectionPortal) await connectionPortal.rollback();
    } catch (rerr) {}
    try {
      if (connectionAccess) await connectionAccess.rollback();
    } catch (rerr) {}
    console.error('Delete employee error:', err);
    return res.status(500).json({ error: 'Failed to delete employee.' });
  } finally {
    if (connectionPortal) connectionPortal.release();
    if (connectionAccess) connectionAccess.release();
  }
};

// Logout Admin
const logout = (req, res) => {
  res.clearCookie('admin_token', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict'
  });
  return res.status(200).json({ message: 'Admin logged out successfully.' });
};

module.exports = {
  login,
  getPendingRequests,
  getEmployees,
  approveRequest,
  declineRequest,
  addEmployee,
  deleteEmployee,
  logout
};

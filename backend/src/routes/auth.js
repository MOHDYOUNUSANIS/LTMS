import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import db from '../config/db.js';

const router = Router();

router.post('/login', async (req, res) => {
  try {
    const { supervisorCode, password } = req.body;

    if (!supervisorCode || !password) {
      return res.status(400).json({
        message: 'Supervisor ID and password are required'
      });
    }

    const [rows] = await db.execute(
      `SELECT id, supervisor_code, full_name, password_hash, role
       FROM supervisors
       WHERE supervisor_code = ? AND is_active = TRUE`,
      [supervisorCode.trim()]
    );

    if (
      !rows.length ||
      !(await bcrypt.compare(password, rows[0].password_hash))
    ) {
      return res.status(401).json({
        message: 'Invalid supervisor ID or password'
      });
    }

    const user = rows[0];

    const token = jwt.sign(
      {
        id: user.id,
        code: user.supervisor_code,
        name: user.full_name,
        role: user.role
      },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );

    return res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        code: user.supervisor_code,
        name: user.full_name,
        role: user.role
      }
    });

  } catch (error) {
    console.error('Login error:', error);

    return res.status(500).json({
      message: 'An internal server error occurred'
    });
  }
});

export default router;
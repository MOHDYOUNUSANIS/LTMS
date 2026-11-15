import { Router } from 'express';
import db from '../config/db.js';

const router = Router();

// GET: List and search companies
router.get('/', async (req, res) => {
  try {
    const search = (req.query.search || '').trim();

    const [rows] = await db.execute(
      `SELECT id, company_name, address, contact_person,
              phone, is_active, created_at
       FROM companies
       WHERE company_name LIKE ?
          OR contact_person LIKE ?
          OR phone LIKE ?
       ORDER BY company_name`,
      [`%${search}%`, `%${search}%`, `%${search}%`]
    );

    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Could not load companies' });
  }
});

// GET: Individual company details
router.get('/:id', async (req, res) => {
  try {
    const [rows] = await db.execute(
      `SELECT id, company_name, address, contact_person,
              phone, is_active, created_at
       FROM companies WHERE id = ?`,
      [req.params.id]
    );

    if (!rows.length) {
      return res.status(404).json({ message: 'Company not found' });
    }

    res.json(rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Could not load company details' });
  }
});

// POST: Create company
router.post('/', async (req, res) => {
  const { companyName, address, contactPerson, phone } = req.body;

  if (!companyName?.trim()) {
    return res.status(400).json({
      message: 'Company name is required'
    });
  }

  try {
    const [result] = await db.execute(
      `INSERT INTO companies
       (company_name, address, contact_person, phone)
       VALUES (?, ?, ?, ?)`,
      [
        companyName.trim(),
        address?.trim() || null,
        contactPerson?.trim() || null,
        phone?.trim() || null
      ]
    );

    res.status(201).json({
      id: result.insertId,
      message: 'Company created successfully'
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: 'Could not create company'
    });
  }
});

// PUT: Edit company
router.put('/:id', async (req, res) => {
  const { companyName, address, contactPerson, phone } = req.body;

  if (!companyName?.trim()) {
    return res.status(400).json({
      message: 'Company name is required'
    });
  }

  try {
    const [result] = await db.execute(
      `UPDATE companies
       SET company_name = ?,
           address = ?,
           contact_person = ?,
           phone = ?
       WHERE id = ?`,
      [
        companyName.trim(),
        address?.trim() || null,
        contactPerson?.trim() || null,
        phone?.trim() || null,
        req.params.id
      ]
    );

    if (!result.affectedRows) {
      return res.status(404).json({ message: 'Company not found' });
    }

    res.json({ message: 'Company updated successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: 'Could not update company'
    });
  }
});

// PATCH: Activate / Deactivate company
router.patch('/:id/status', async (req, res) => {
  const { isActive } = req.body;

  if (typeof isActive !== 'boolean') {
    return res.status(400).json({
      message: 'A valid company status is required'
    });
  }

  try {
    const [result] = await db.execute(
      'UPDATE companies SET is_active = ? WHERE id = ?',
      [isActive, req.params.id]
    );

    if (!result.affectedRows) {
      return res.status(404).json({ message: 'Company not found' });
    }

    res.json({
      message: `Company ${isActive ? 'activated' : 'deactivated'} successfully`
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: 'Could not update company status'
    });
  }
});

export default router;
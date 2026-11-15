import { Router } from 'express';
import db from '../config/db.js';

const router = Router();

// GET: List and search drums
router.get('/', async (req, res) => {
  try {
    const search = (req.query.search || '').trim();

    const [rows] = await db.execute(
      `SELECT d.id, d.company_id, c.company_name,
              d.drum_code, d.drum_type, d.capacity_kg,
              d.location, d.status
       FROM drums d
       JOIN companies c ON d.company_id = c.id
       WHERE d.drum_code LIKE ?
          OR d.drum_type LIKE ?
          OR c.company_name LIKE ?
       ORDER BY c.company_name, d.drum_code`,
      [`%${search}%`, `%${search}%`, `%${search}%`]
    );

    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Could not load drums' });
  }
});

// GET: Individual drum details
router.get('/:id', async (req, res) => {
  try {
    const [rows] = await db.execute(
      `SELECT d.*, c.company_name
       FROM drums d
       JOIN companies c ON d.company_id = c.id
       WHERE d.id = ?`,
      [req.params.id]
    );

    if (!rows.length) {
      return res.status(404).json({ message: 'Drum not found' });
    }

    res.json(rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Could not load drum details' });
  }
});

// POST: Register a new drum
router.post('/', async (req, res) => {
  const {
    companyId,
    drumCode,
    drumType,
    capacityKg,
    location
  } = req.body;

  if (!companyId || !drumCode?.trim()) {
    return res.status(400).json({
      message: 'Company and drum number are required'
    });
  }

  if (
    capacityKg !== undefined &&
    capacityKg !== null &&
    (!Number.isFinite(Number(capacityKg)) || Number(capacityKg) <= 0)
  ) {
    return res.status(400).json({
      message: 'Capacity must be a positive number'
    });
  }

  try {
    const [companies] = await db.execute(
      'SELECT id FROM companies WHERE id = ?',
      [companyId]
    );

    if (!companies.length) {
      return res.status(400).json({
        message: 'Selected company does not exist'
      });
    }

    const [result] = await db.execute(
      `INSERT INTO drums
       (company_id, drum_code, drum_type, capacity_kg, location)
       VALUES (?, ?, ?, ?, ?)`,
      [
        companyId,
        drumCode.trim(),
        drumType || 'WOODEN',
        capacityKg || null,
        location?.trim() || null
      ]
    );

    res.status(201).json({
      id: result.insertId,
      message: 'Drum registered successfully'
    });
  } catch (error) {
    console.error(error);

    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({
        message: 'This drum number is already registered'
      });
    }

    res.status(500).json({
      message: 'Could not register drum'
    });
  }
});

// PUT: Edit drum details
router.put('/:id', async (req, res) => {
  const {
    companyId,
    drumCode,
    drumType,
    capacityKg,
    location
  } = req.body;

  if (!companyId || !drumCode?.trim()) {
    return res.status(400).json({
      message: 'Company and drum number are required'
    });
  }

  if (
    capacityKg !== undefined &&
    capacityKg !== null &&
    (!Number.isFinite(Number(capacityKg)) || Number(capacityKg) <= 0)
  ) {
    return res.status(400).json({
      message: 'Capacity must be a positive number'
    });
  }

  try {
    const [companies] = await db.execute(
      'SELECT id FROM companies WHERE id = ?',
      [companyId]
    );

    if (!companies.length) {
      return res.status(400).json({
        message: 'Selected company does not exist'
      });
    }

    const [result] = await db.execute(
      `UPDATE drums
       SET company_id = ?,
           drum_code = ?,
           drum_type = ?,
           capacity_kg = ?,
           location = ?
       WHERE id = ?`,
      [
        companyId,
        drumCode.trim(),
        drumType || 'WOODEN',
        capacityKg || null,
        location?.trim() || null,
        req.params.id
      ]
    );

    if (!result.affectedRows) {
      const [existing] = await db.execute(
        'SELECT id FROM drums WHERE id = ?',
        [req.params.id]
      );

      if (!existing.length) {
        return res.status(404).json({ message: 'Drum not found' });
      }
    }

    res.json({ message: 'Drum updated successfully' });
  } catch (error) {
    console.error(error);

    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({
        message: 'This drum number is already registered'
      });
    }

    res.status(500).json({
      message: 'Could not update drum'
    });
  }
});

// PATCH: Update drum status
router.patch('/:id/status', async (req, res) => {
  const { status } = req.body;

  const allowedStatuses = [
    'AVAILABLE',
    'RUNNING',
    'MAINTENANCE'
  ];

  if (!allowedStatuses.includes(status)) {
    return res.status(400).json({
      message: 'Invalid drum status'
    });
  }

  try {
    const [result] = await db.execute(
      'UPDATE drums SET status = ? WHERE id = ?',
      [status, req.params.id]
    );

    if (!result.affectedRows) {
      return res.status(404).json({ message: 'Drum not found' });
    }

    res.json({
      message: `Drum status updated to ${status}`
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: 'Could not update drum status'
    });
  }
});

export default router;
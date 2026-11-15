import { Router } from 'express';
import db from '../config/db.js';

const router = Router();

// GET: List chemicals belonging to a selected company
router.get('/', async (req, res) => {
  try {
    const companyId = Number(req.query.companyId);

    if (!Number.isInteger(companyId) || companyId <= 0) {
      return res.status(400).json({
        message: 'A valid company ID is required'
      });
    }

    const [rows] = await db.execute(
      `SELECT
    id, company_id, chemical_code, chemical_name,
    category, unit, current_stock, minimum_stock,
    storage_location, supplier, is_active,
    (current_stock <= minimum_stock) AS low_stock
       FROM chemicals c
       WHERE c.company_id = ?
${req.query.includeInactive === 'true' ? '' : 'AND c.is_active = TRUE'}
       ORDER BY chemical_name`,
      [companyId]
    );

    res.json(rows);
  } catch (error) {
    console.error('Chemical list error:', error);
    res.status(500).json({ message: 'Unable to load chemicals' });
  }
});

// POST: Register a chemical with opening stock
router.post('/', async (req, res) => {
  const {
    companyId,
    chemicalCode,
    chemicalName,
    category,
    unit,
    openingStock,
    minimumStock,
    storageLocation,
    supplier
  } = req.body;

  const company = Number(companyId);
  const opening = Number(openingStock ?? 0);
  const minimum = Number(minimumStock ?? 0);
  const allowedUnits = ['KG', 'LITRE', 'PCS'];

  if (!Number.isInteger(company) || company <= 0) {
    return res.status(400).json({ message: 'Valid company is required' });
  }

  if (!chemicalCode?.trim()) {
    return res.status(400).json({ message: 'Chemical code is required' });
  }

  if (!chemicalName?.trim()) {
    return res.status(400).json({ message: 'Chemical name is required' });
  }

  if (!allowedUnits.includes(unit || 'KG')) {
    return res.status(400).json({ message: 'Invalid unit' });
  }

  if (
    !Number.isFinite(opening) ||
    !Number.isFinite(minimum) ||
    opening < 0 ||
    minimum < 0
  ) {
    return res.status(400).json({
      message: 'Stock quantities must be valid non-negative numbers'
    });
  }

  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const [companyRows] = await connection.execute(
      'SELECT id FROM companies WHERE id = ? AND is_active = TRUE',
      [company]
    );

    if (!companyRows.length) {
      await connection.rollback();
      return res.status(400).json({ message: 'Company not found or inactive' });
    }

    const [result] = await connection.execute(
      `INSERT INTO chemicals
       (company_id, chemical_code, chemical_name, category, unit,
        current_stock, minimum_stock, storage_location, supplier)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        company,
        chemicalCode.trim(),
        chemicalName.trim(),
        category?.trim() || null,
        unit || 'KG',
        opening,
        minimum,
        storageLocation?.trim() || null,
        supplier?.trim() || null
      ]
    );

    if (opening > 0) {
      await connection.execute(
        `INSERT INTO stock_movements
         (chemical_id, movement_type, quantity, reference_note, supervisor_id)
         VALUES (?, 'OPENING', ?, 'Opening stock', ?)`,
        [result.insertId, opening, req.user.id]
      );
    }

    await connection.commit();

    res.status(201).json({
      id: result.insertId,
      message: 'Chemical added successfully'
    });
  } catch (error) {
    await connection.rollback();

    console.error('Chemical creation error:', error);

    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({
        message: 'This chemical code already exists for this company'
      });
    }

    res.status(500).json({ message: 'Unable to add chemical' });
  } finally {
    connection.release();
  }
});

// POST: Receive new chemical stock
router.post('/:id/receipt', async (req, res) => {
  const chemicalId = Number(req.params.id);
  const quantity = Number(req.body.quantity);
  const referenceNote = req.body.referenceNote?.trim() || 'Stock receipt';

  if (!Number.isInteger(chemicalId) || chemicalId <= 0 ||
    !Number.isFinite(quantity) || quantity <= 0) {
    return res.status(400).json({
      message: 'Valid chemical ID and positive quantity are required'
    });
  }

  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const [chemicals] = await connection.execute(
      'SELECT id FROM chemicals WHERE id = ? AND is_active = TRUE FOR UPDATE',
      [chemicalId]
    );

    if (!chemicals.length) {
      await connection.rollback();
      return res.status(404).json({ message: 'Chemical not found' });
    }

    await connection.execute(
      'UPDATE chemicals SET current_stock = current_stock + ? WHERE id = ?',
      [quantity, chemicalId]
    );

    await connection.execute(
      `INSERT INTO stock_movements
       (chemical_id, movement_type, quantity, reference_note, supervisor_id)
       VALUES (?, 'RECEIPT', ?, ?, ?)`,
      [chemicalId, quantity, referenceNote, req.user.id]
    );

    await connection.commit();

    res.json({ message: 'Stock received successfully' });
  } catch (error) {
    await connection.rollback();
    console.error('Stock receipt error:', error);
    res.status(500).json({ message: 'Unable to receive stock' });
  } finally {
    connection.release();
  }
});


// POST: Issue chemical stock for factory use
router.post('/:id/issue', async (req, res) => {
  const chemicalId = Number(req.params.id);
  const quantity = Number(req.body.quantity);
  const referenceNote = req.body.referenceNote?.trim() || 'Stock issued';

  if (!Number.isInteger(chemicalId) || chemicalId <= 0 ||
    !Number.isFinite(quantity) || quantity <= 0) {
    return res.status(400).json({
      message: 'Valid chemical ID and positive quantity are required'
    });
  }

  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const [chemicals] = await connection.execute(
      `SELECT id, current_stock
       FROM chemicals
       WHERE id = ? AND is_active = TRUE
       FOR UPDATE`,
      [chemicalId]
    );

    if (!chemicals.length) {
      await connection.rollback();
      return res.status(404).json({ message: 'Chemical not found' });
    }

    const availableStock = Number(chemicals[0].current_stock);

    if (quantity > availableStock) {
      await connection.rollback();
      return res.status(400).json({
        message: `Insufficient stock. Available quantity: ${availableStock}`
      });
    }

    await connection.execute(
      'UPDATE chemicals SET current_stock = current_stock - ? WHERE id = ?',
      [quantity, chemicalId]
    );

    await connection.execute(
      `INSERT INTO stock_movements
       (chemical_id, movement_type, quantity, reference_note, supervisor_id)
       VALUES (?, 'ISSUE', ?, ?, ?)`,
      [chemicalId, quantity, referenceNote, req.user.id]
    );

    await connection.commit();

    res.json({ message: 'Stock issued successfully' });
  } catch (error) {
    await connection.rollback();
    console.error('Stock issue error:', error);
    res.status(500).json({ message: 'Unable to issue stock' });
  } finally {
    connection.release();
  }
});

// GET: View stock movement history for a chemical
router.get('/:id/movements', async (req, res) => {
  const chemicalId = Number(req.params.id);

  if (!Number.isInteger(chemicalId) || chemicalId <= 0) {
    return res.status(400).json({
      message: 'Valid chemical ID is required'
    });
  }

  try {
    const [chemicalRows] = await db.execute(
      `SELECT id, chemical_name, chemical_code, unit
       FROM chemicals
       WHERE id = ?`,
      [chemicalId]
    );

    if (!chemicalRows.length) {
      return res.status(404).json({
        message: 'Chemical not found'
      });
    }

    const [movements] = await db.execute(
      `SELECT
         sm.id,
         sm.movement_type,
         sm.quantity,
         sm.reference_note,
         sm.created_at,
         s.supervisor_code,
         s.full_name AS supervisor_name
       FROM stock_movements sm
       LEFT JOIN supervisors s ON s.id = sm.supervisor_id
       WHERE sm.chemical_id = ?
       ORDER BY sm.created_at DESC, sm.id DESC`,
      [chemicalId]
    );

    res.json({
      chemical: chemicalRows[0],
      movements
    });
  } catch (error) {
    console.error('Stock movement history error:', error);

    res.status(500).json({
      message: 'Unable to load stock movement history'
    });
  }
});
// POST: Return unused chemical stock to inventory
router.post('/:id/return', async (req, res) => {
  const chemicalId = Number(req.params.id);
  const quantity = Number(req.body.quantity);
  const referenceNote = req.body.referenceNote?.trim();

  if (
    !Number.isInteger(chemicalId) ||
    chemicalId <= 0 ||
    !Number.isFinite(quantity) ||
    quantity <= 0
  ) {
    return res.status(400).json({
      message: 'Valid chemical ID and positive quantity are required'
    });
  }

  if (!referenceNote) {
    return res.status(400).json({
      message: 'Return reason is required'
    });
  }

  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const [chemicals] = await connection.execute(
      `SELECT id
       FROM chemicals
       WHERE id = ? AND is_active = TRUE
       FOR UPDATE`,
      [chemicalId]
    );

    if (!chemicals.length) {
      await connection.rollback();
      return res.status(404).json({
        message: 'Chemical not found'
      });
    }

    await connection.execute(
      `UPDATE chemicals
       SET current_stock = current_stock + ?
       WHERE id = ?`,
      [quantity, chemicalId]
    );

    await connection.execute(
      `INSERT INTO stock_movements
       (chemical_id, movement_type, quantity, reference_note, supervisor_id)
       VALUES (?, 'RETURN', ?, ?, ?)`,
      [chemicalId, quantity, referenceNote, req.user.id]
    );

    await connection.commit();

    res.json({
      message: 'Chemical stock returned successfully'
    });
  } catch (error) {
    await connection.rollback();
    console.error('Stock return error:', error);

    res.status(500).json({
      message: 'Unable to return chemical stock'
    });
  } finally {
    connection.release();
  }
});
// POST: Adjust chemical stock after physical stock verification
router.post('/:id/adjustment', async (req, res) => {
  const chemicalId = Number(req.params.id);
  const actualStock = Number(req.body.actualStock);
  const referenceNote = req.body.referenceNote?.trim();

  if (
    !Number.isInteger(chemicalId) ||
    chemicalId <= 0 ||
    !Number.isFinite(actualStock) ||
    actualStock < 0
  ) {
    return res.status(400).json({
      message: 'Valid chemical ID and non-negative actual stock are required'
    });
  }

  if (!referenceNote) {
    return res.status(400).json({
      message: 'Adjustment reason is required'
    });
  }

  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const [chemicals] = await connection.execute(
      `SELECT id, current_stock
       FROM chemicals
       WHERE id = ? AND is_active = TRUE
       FOR UPDATE`,
      [chemicalId]
    );

    if (!chemicals.length) {
      await connection.rollback();
      return res.status(404).json({
        message: 'Chemical not found'
      });
    }

    const previousStock = Number(chemicals[0].current_stock);
    const difference = Number((actualStock - previousStock).toFixed(3));

    if (difference === 0) {
      await connection.rollback();
      return res.status(400).json({
        message: 'Physical stock matches recorded stock. No adjustment needed.'
      });
    }

    await connection.execute(
      `UPDATE chemicals
       SET current_stock = ?
       WHERE id = ?`,
      [actualStock, chemicalId]
    );

    await connection.execute(
      `INSERT INTO stock_movements
       (chemical_id, movement_type, quantity, reference_note, supervisor_id)
       VALUES (?, 'ADJUSTMENT', ?, ?, ?)`,
      [
        chemicalId,
        difference,
        referenceNote,
        req.user.id
      ]
    );

    await connection.commit();

    res.json({
      message: 'Stock adjusted successfully',
      previousStock,
      actualStock,
      difference
    });
  } catch (error) {
    await connection.rollback();

    console.error('Stock adjustment error:', error);

    res.status(500).json({
      message: 'Unable to adjust stock'
    });
  } finally {
    connection.release();
  }
});
// PUT: Update chemical details without changing stock
router.put('/:id', async (req, res) => {
  const chemicalId = Number(req.params.id);

  const {
    chemicalCode,
    chemicalName,
    category,
    unit,
    minimumStock,
    storageLocation,
    supplier
  } = req.body;

  const minimum = Number(minimumStock);
  const allowedUnits = ['KG', 'LITRE', 'PCS'];

  if (!Number.isInteger(chemicalId) || chemicalId <= 0) {
    return res.status(400).json({ message: 'Invalid chemical ID' });
  }

  if (!chemicalCode?.trim() || !chemicalName?.trim()) {
    return res.status(400).json({
      message: 'Chemical code and name are required'
    });
  }

  if (!allowedUnits.includes(unit)) {
    return res.status(400).json({ message: 'Invalid chemical unit' });
  }

  if (!Number.isFinite(minimum) || minimum < 0) {
    return res.status(400).json({
      message: 'Minimum stock must be a non-negative number'
    });
  }

  try {
    const [result] = await db.execute(
      `UPDATE chemicals
       SET chemical_code = ?,
           chemical_name = ?,
           category = ?,
           unit = ?,
           minimum_stock = ?,
           storage_location = ?,
           supplier = ?
       WHERE id = ? AND is_active = TRUE`,
      [
        chemicalCode.trim(),
        chemicalName.trim(),
        category?.trim() || null,
        unit,
        minimum,
        storageLocation?.trim() || null,
        supplier?.trim() || null,
        chemicalId
      ]
    );

    if (!result.affectedRows) {
      return res.status(404).json({
        message: 'Chemical not found or inactive'
      });
    }

    res.json({
      message: 'Chemical details updated successfully'
    });
  } catch (error) {
    console.error('Chemical update error:', error);

    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({
        message: 'This chemical code already exists for this company'
      });
    }

    res.status(500).json({
      message: 'Unable to update chemical details'
    });
  }
});
// PATCH: Activate or deactivate a chemical
router.patch('/:id/status', async (req, res) => {
  const chemicalId = Number(req.params.id);
  const { isActive } = req.body;

  if (!Number.isInteger(chemicalId) || chemicalId <= 0) {
    return res.status(400).json({ message: 'Invalid chemical ID' });
  }

  if (typeof isActive !== 'boolean') {
    return res.status(400).json({
      message: 'isActive must be true or false'
    });
  }

  try {
    const [result] = await db.execute(
      `UPDATE chemicals
       SET is_active = ?
       WHERE id = ?`,
      [isActive, chemicalId]
    );

    if (!result.affectedRows) {
      return res.status(404).json({
        message: 'Chemical not found'
      });
    }

    res.json({
      message: isActive
        ? 'Chemical activated successfully'
        : 'Chemical deactivated successfully'
    });
  } catch (error) {
    console.error('Chemical status update error:', error);

    res.status(500).json({
      message: 'Unable to update chemical status'
    });
  }
});

export default router;
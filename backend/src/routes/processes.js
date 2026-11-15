import express from 'express';
import pool from '../config/db.js';

const router = express.Router();

// GET: List all process templates
router.get('/', async (req, res) => {
  try {
    const [templates] = await pool.query(`
      SELECT
        pt.*,
        c.company_name,
        s.full_name AS created_by_name
      FROM process_templates pt
      LEFT JOIN companies c ON pt.company_id = c.id
      LEFT JOIN supervisors s ON pt.created_by = s.id
      ORDER BY pt.created_at DESC
    `);

    res.json(templates);
  } catch (error) {
    console.error('Fetch process templates error:', error);
    res.status(500).json({ message: 'Failed to fetch process templates' });
  }
});
// POST: Create a new process template
router.post('/', async (req, res) => {
  try {
    const {
      company_id,
      template_name,
      species,
      product_name,
      colour,
      thickness_min_mm,
      thickness_max_mm,
      reference_weight_kg,
      reference_hides_sides,
      source_document,
      notes
    } = req.body;

    // Validate required fields
    if (!company_id || !template_name?.trim()) {
      return res.status(400).json({
        message: 'Company and template name are required'
      });
    }

    // Validate company
    const [companies] = await pool.execute(
      'SELECT id FROM companies WHERE id = ? AND is_active = TRUE',
      [company_id]
    );

    if (!companies.length) {
      return res.status(400).json({
        message: 'Selected company does not exist or is inactive'
      });
    }

    // Validate thickness range
    if (
      thickness_min_mm != null &&
      thickness_max_mm != null &&
      Number(thickness_min_mm) > Number(thickness_max_mm)
    ) {
      return res.status(400).json({
        message: 'Minimum thickness cannot exceed maximum thickness'
      });
    }

    const [result] = await pool.execute(
      `INSERT INTO process_templates (
        company_id,
        template_name,
        species,
        product_name,
        colour,
        thickness_min_mm,
        thickness_max_mm,
        reference_weight_kg,
        reference_hides_sides,
        source_document,
        notes,
        created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        company_id,
        template_name.trim(),
        species || null,
        product_name || null,
        colour || null,
        thickness_min_mm ?? null,
        thickness_max_mm ?? null,
        reference_weight_kg ?? null,
        reference_hides_sides || null,
        source_document || null,
        notes || null,
        req.user.id
      ]
    );

    return res.status(201).json({
      message: 'Process template created successfully',
      templateId: result.insertId,
      verification_status: 'DRAFT'
    });

  } catch (error) {
    console.error('Create process template error:', error);

    return res.status(500).json({
      message: 'Failed to create process template'
    });
  }
});

// POST: Add a process stage to a template
router.post('/:id/steps', async (req, res) => {
  try {
    const { id } = req.params;

    const {
      stage_name,
      sequence_no,
      float_percent,
      water_percent,
      target_ph_min,
      target_ph_max,
      duration_minutes,
      instruction
    } = req.body;

    // Validate required fields
    if (!stage_name?.trim() || sequence_no == null) {
      return res.status(400).json({
        message: 'Stage name and sequence number are required'
      });
    }

    // Validate sequence number
    if (!Number.isInteger(Number(sequence_no)) || Number(sequence_no) < 1) {
      return res.status(400).json({
        message: 'Sequence number must be a positive integer'
      });
    }

    // Validate pH range
    if (
      target_ph_min != null &&
      target_ph_max != null &&
      Number(target_ph_min) > Number(target_ph_max)
    ) {
      return res.status(400).json({
        message: 'Minimum pH cannot exceed maximum pH'
      });
    }

    // Check whether the template exists
    const [templates] = await pool.execute(
      'SELECT id FROM process_templates WHERE id = ?',
      [id]
    );

    if (!templates.length) {
      return res.status(404).json({
        message: 'Process template not found'
      });
    }

    // Insert process stage
    const [result] = await pool.execute(
      `INSERT INTO process_steps (
        template_id,
        stage_name,
        sequence_no,
        float_percent,
        water_percent,
        target_ph_min,
        target_ph_max,
        duration_minutes,
        instruction
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        stage_name.trim(),
        Number(sequence_no),
        float_percent ?? null,
        water_percent ?? null,
        target_ph_min ?? null,
        target_ph_max ?? null,
        duration_minutes ?? null,
        instruction || null
      ]
    );

    return res.status(201).json({
      message: 'Process stage added successfully',
      stepId: result.insertId
    });

  } catch (error) {
    console.error('Add process stage error:', error);

    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({
        message: 'This sequence number already exists in the template'
      });
    }

    return res.status(500).json({
      message: 'Failed to add process stage'
    });
  }

});
// PUT: Edit an existing process stage
router.put('/steps/:stepId', async (req, res) => {
    const connection = await pool.getConnection();

    try {
        const { stepId } = req.params;

        const {
            stage_name,
            sequence_no,
            float_percent,
            water_percent,
            target_ph_min,
            target_ph_max,
            duration_minutes,
            instruction
        } = req.body;

        if (!stage_name?.trim() || sequence_no == null) {
            return res.status(400).json({
                message: 'Stage name and sequence number are required'
            });
        }

        if (!Number.isInteger(Number(sequence_no)) || Number(sequence_no) < 1) {
            return res.status(400).json({
                message: 'Sequence number must be a positive integer'
            });
        }

        if (
            target_ph_min != null &&
            target_ph_max != null &&
            Number(target_ph_min) > Number(target_ph_max)
        ) {
            return res.status(400).json({
                message: 'Minimum pH cannot exceed maximum pH'
            });
        }

        await connection.beginTransaction();

        const [existing] = await connection.execute(
            'SELECT template_id FROM process_steps WHERE id = ?',
            [stepId]
        );

        if (!existing.length) {
            await connection.rollback();

            return res.status(404).json({
                message: 'Process stage not found'
            });
        }

        const templateId = existing[0].template_id;

        await connection.execute(
            `UPDATE process_steps
             SET stage_name = ?,
                 sequence_no = ?,
                 float_percent = ?,
                 water_percent = ?,
                 target_ph_min = ?,
                 target_ph_max = ?,
                 duration_minutes = ?,
                 instruction = ?
             WHERE id = ?`,
            [
                stage_name.trim(),
                Number(sequence_no),
                float_percent ?? null,
                water_percent ?? null,
                target_ph_min ?? null,
                target_ph_max ?? null,
                duration_minutes ?? null,
                instruction || null,
                stepId
            ]
        );

        await connection.execute(
            `UPDATE process_templates
             SET verification_status = 'DRAFT'
             WHERE id = ?`,
            [templateId]
        );

        await connection.commit();

        return res.json({
            message: 'Process stage updated successfully. Template verification reset to DRAFT.'
        });

    } catch (error) {
        await connection.rollback();

        console.error('Update process stage error:', error);

        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({
                message: 'This sequence number already exists in the template'
            });
        }

        return res.status(500).json({
            message: 'Failed to update process stage'
        });

    } finally {
        connection.release();
    }
});
// DELETE: Remove a process stage
router.delete('/steps/:stepId', async (req, res) => {
  let connection;

  try {
    const { stepId } = req.params;

    connection = await pool.getConnection();
    await connection.beginTransaction();

    // Find the parent template
    const [steps] = await connection.execute(
      'SELECT template_id FROM process_steps WHERE id = ?',
      [stepId]
    );

    if (!steps.length) {
      await connection.rollback();

      return res.status(404).json({
        message: 'Process stage not found'
      });
    }

    const templateId = steps[0].template_id;

    // Delete the stage.
    // Its chemical mappings are deleted automatically by ON DELETE CASCADE.
    await connection.execute(
      'DELETE FROM process_steps WHERE id = ?',
      [stepId]
    );

    // Reset template verification
    await connection.execute(
      `UPDATE process_templates
       SET verification_status = 'DRAFT'
       WHERE id = ?`,
      [templateId]
    );

    await connection.commit();

    return res.json({
      message: 'Process stage deleted successfully',
      verification_status: 'DRAFT'
    });

  } catch (error) {
    if (connection) await connection.rollback();

    console.error('Delete process stage error:', error);

    return res.status(500).json({
      message: 'Failed to delete process stage'
    });

  } finally {
    if (connection) connection.release();
  }
});
// POST: Add a chemical to a process stage
router.post('/steps/:stepId/chemicals', async (req, res) => {
  try {
    const { stepId } = req.params;

    const {
      chemical_id,
      chemical_label,
      dosage_percent,
      dosage_basis,
      fixed_quantity,
      unit,
      addition_order,
      notes
    } = req.body;

    if (!chemical_label?.trim()) {
      return res.status(400).json({
        message: 'Chemical label is required'
      });
    }

    const allowedBases = [
      'PERCENT_OF_PELT_WEIGHT',
      'PERCENT_OF_FLOAT',
      'FIXED_QUANTITY'
    ];

    const allowedUnits = ['KG', 'LITRE', 'PCS'];

    const basis = dosage_basis || 'PERCENT_OF_PELT_WEIGHT';

    if (!allowedBases.includes(basis)) {
      return res.status(400).json({
        message: 'Invalid dosage basis'
      });
    }

    if (unit && !allowedUnits.includes(unit)) {
      return res.status(400).json({
        message: 'Invalid measurement unit'
      });
    }

    if (
      basis === 'FIXED_QUANTITY' &&
      (fixed_quantity == null || Number(fixed_quantity) < 0)
    ) {
      return res.status(400).json({
        message: 'A valid fixed quantity is required'
      });
    }

    if (
      basis !== 'FIXED_QUANTITY' &&
      (dosage_percent == null || Number(dosage_percent) < 0)
    ) {
      return res.status(400).json({
        message: 'A valid dosage percentage is required'
      });
    }

    const [steps] = await pool.execute(
      'SELECT id FROM process_steps WHERE id = ?',
      [stepId]
    );

    if (!steps.length) {
      return res.status(404).json({
        message: 'Process stage not found'
      });
    }

    if (chemical_id != null) {
      const [chemicals] = await pool.execute(
        `SELECT id, chemical_name, unit
         FROM chemicals
         WHERE id = ? AND is_active = TRUE`,
        [chemical_id]
      );

      if (!chemicals.length) {
        return res.status(400).json({
          message: 'Selected chemical does not exist or is inactive'
        });
      }
    }

    const [result] = await pool.execute(
      `INSERT INTO process_step_chemicals (
        process_step_id,
        chemical_id,
        chemical_label,
        dosage_percent,
        dosage_basis,
        fixed_quantity,
        unit,
        addition_order,
        notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        stepId,
        chemical_id ?? null,
        chemical_label.trim(),
        dosage_percent ?? null,
        basis,
        fixed_quantity ?? null,
        unit || 'KG',
        addition_order ?? null,
        notes || null
      ]
    );

    return res.status(201).json({
      message: 'Chemical mapping added successfully',
      mappingId: result.insertId
    });

  } catch (error) {
    console.error('Add chemical mapping error:', error);

    return res.status(500).json({
      message: 'Failed to add chemical mapping'
    });
  }
});
// PUT: Edit an existing chemical mapping
router.put('/chemicals/:mappingId', async (req, res) => {
  try {
    const { mappingId } = req.params;

    const {
      chemical_id,
      chemical_label,
      dosage_percent,
      dosage_basis,
      fixed_quantity,
      unit,
      addition_order,
      notes
    } = req.body;

    if (!chemical_label?.trim()) {
      return res.status(400).json({
        message: 'Chemical label is required'
      });
    }

    const allowedBases = [
      'PERCENT_OF_PELT_WEIGHT',
      'PERCENT_OF_FLOAT',
      'FIXED_QUANTITY'
    ];

    const allowedUnits = ['KG', 'LITRE', 'PCS'];
    const basis = dosage_basis || 'PERCENT_OF_PELT_WEIGHT';

    if (!allowedBases.includes(basis)) {
      return res.status(400).json({
        message: 'Invalid dosage basis'
      });
    }

    if (unit && !allowedUnits.includes(unit)) {
      return res.status(400).json({
        message: 'Invalid measurement unit'
      });
    }

    if (
      basis === 'FIXED_QUANTITY' &&
      (fixed_quantity == null || !Number.isFinite(Number(fixed_quantity)) || Number(fixed_quantity) < 0)
    ) {
      return res.status(400).json({
        message: 'A valid fixed quantity is required'
      });
    }

    if (
      basis !== 'FIXED_QUANTITY' &&
      (dosage_percent == null || !Number.isFinite(Number(dosage_percent)) || Number(dosage_percent) < 0)
    ) {
      return res.status(400).json({
        message: 'A valid dosage percentage is required'
      });
    }

    const [existing] = await pool.execute(
      'SELECT id FROM process_step_chemicals WHERE id = ?',
      [mappingId]
    );

    if (!existing.length) {
      return res.status(404).json({
        message: 'Chemical mapping not found'
      });
    }

    if (chemical_id != null) {
      const [chemicals] = await pool.execute(
        'SELECT id FROM chemicals WHERE id = ? AND is_active = TRUE',
        [chemical_id]
      );

      if (!chemicals.length) {
        return res.status(400).json({
          message: 'Selected chemical does not exist or is inactive'
        });
      }
    }

    await pool.execute(
      `UPDATE process_step_chemicals
       SET chemical_id = ?,
           chemical_label = ?,
           dosage_percent = ?,
           dosage_basis = ?,
           fixed_quantity = ?,
           unit = ?,
           addition_order = ?,
           notes = ?
       WHERE id = ?`,
      [
        chemical_id ?? null,
        chemical_label.trim(),
        basis === 'FIXED_QUANTITY' ? null : dosage_percent,
        basis,
        basis === 'FIXED_QUANTITY' ? fixed_quantity : null,
        unit || 'KG',
        addition_order ?? null,
        notes || null,
        mappingId
      ]
    );

    // Any recipe change requires fresh verification.
    await pool.execute(
      `UPDATE process_templates pt
       JOIN process_steps ps ON ps.template_id = pt.id
       JOIN process_step_chemicals psc ON psc.process_step_id = ps.id
       SET pt.verification_status = 'DRAFT'
       WHERE psc.id = ?`,
      [mappingId]
    );

    return res.json({
      message: 'Chemical mapping updated successfully',
      verification_status: 'DRAFT'
    });

  } catch (error) {
    console.error('Update chemical mapping error:', error);

    return res.status(500).json({
      message: 'Failed to update chemical mapping'
    });
  }
});
// DELETE: Remove a chemical mapping
router.delete('/chemicals/:mappingId', async (req, res) => {
  const connection = await pool.getConnection();

  try {
    const { mappingId } = req.params;

    await connection.beginTransaction();

    const [mappings] = await connection.execute(
      `SELECT ps.template_id
       FROM process_step_chemicals psc
       JOIN process_steps ps ON ps.id = psc.process_step_id
       WHERE psc.id = ?`,
      [mappingId]
    );

    if (!mappings.length) {
      await connection.rollback();

      return res.status(404).json({
        message: 'Chemical mapping not found'
      });
    }

    const templateId = mappings[0].template_id;

    await connection.execute(
      'DELETE FROM process_step_chemicals WHERE id = ?',
      [mappingId]
    );

    await connection.execute(
      `UPDATE process_templates
       SET verification_status = 'DRAFT'
       WHERE id = ?`,
      [templateId]
    );

    await connection.commit();

    return res.json({
      message: 'Chemical mapping deleted successfully',
      verification_status: 'DRAFT'
    });

  } catch (error) {
    await connection.rollback();

    console.error('Delete chemical mapping error:', error);

    return res.status(500).json({
      message: 'Failed to delete chemical mapping'
    });

  } finally {
    connection.release();
  }
});
// PUT: Edit an existing process template
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const {
      template_name,
      species,
      product_name,
      colour,
      thickness_min_mm,
      thickness_max_mm,
      reference_weight_kg,
      reference_hides_sides,
      source_document,
      notes
    } = req.body;

    if (!template_name?.trim()) {
      return res.status(400).json({
        message: 'Template name is required'
      });
    }

    if (
      thickness_min_mm != null &&
      thickness_max_mm != null &&
      Number(thickness_min_mm) > Number(thickness_max_mm)
    ) {
      return res.status(400).json({
        message: 'Minimum thickness cannot exceed maximum thickness'
      });
    }

    const [existing] = await pool.execute(
      'SELECT id FROM process_templates WHERE id = ?',
      [id]
    );

    if (!existing.length) {
      return res.status(404).json({
        message: 'Process template not found'
      });
    }

    await pool.execute(
      `UPDATE process_templates
       SET template_name = ?,
           species = ?,
           product_name = ?,
           colour = ?,
           thickness_min_mm = ?,
           thickness_max_mm = ?,
           reference_weight_kg = ?,
           reference_hides_sides = ?,
           source_document = ?,
           notes = ?,
           verification_status = 'DRAFT'
       WHERE id = ?`,
      [
        template_name.trim(),
        species || null,
        product_name || null,
        colour || null,
        thickness_min_mm ?? null,
        thickness_max_mm ?? null,
        reference_weight_kg ?? null,
        reference_hides_sides || null,
        source_document || null,
        notes || null,
        id
      ]
    );

    return res.json({
      message: 'Process template updated successfully',
      verification_status: 'DRAFT'
    });

  } catch (error) {
    console.error('Update process template error:', error);

    return res.status(500).json({
      message: 'Failed to update process template'
    });
  }
});
// PATCH: Update process template verification status
router.patch('/:id/verification', async (req, res) => {
  try {
    const { id } = req.params;
    const { verification_status } = req.body;

    // Only ADMIN can verify or approve templates
    if (req.user.role !== 'ADMIN') {
      return res.status(403).json({
        message: 'Only ADMIN can update verification status'
      });
    }

    const allowedTransitions = {
      DRAFT: ['CHEMIST_VERIFIED'],
      CHEMIST_VERIFIED: ['APPROVED'],
      APPROVED: ['ARCHIVED'],
      ARCHIVED: []
    };

    if (!Object.hasOwn(allowedTransitions, verification_status)) {
      return res.status(400).json({
        message: 'Invalid verification status'
      });
    }

    const [templates] = await pool.execute(
      'SELECT id, verification_status FROM process_templates WHERE id = ?',
      [id]
    );

    if (!templates.length) {
      return res.status(404).json({
        message: 'Process template not found'
      });
    }

    const currentStatus = templates[0].verification_status;

    if (!allowedTransitions[currentStatus].includes(verification_status)) {
      return res.status(400).json({
        message: `Cannot change status from ${currentStatus} to ${verification_status}`
      });
    }

    await pool.execute(
      `UPDATE process_templates
       SET verification_status = ?
       WHERE id = ?`,
      [verification_status, id]
    );

    return res.json({
      message: 'Verification status updated successfully',
      verification_status
    });

  } catch (error) {
    console.error('Verification status error:', error);

    return res.status(500).json({
      message: 'Failed to update verification status'
    });
  }
});

// GET: View one process template with stages and chemicals
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const [templates] = await pool.query(
      'SELECT * FROM process_templates WHERE id = ?',
      [id]
    );

    if (templates.length === 0) {
      return res.status(404).json({ message: 'Process template not found' });
    }

    const [steps] = await pool.query(
      'SELECT * FROM process_steps WHERE template_id = ? ORDER BY sequence_no',
      [id]
    );

    for (const step of steps) {
      const [chemicals] = await pool.query(
        `SELECT
           psc.*,
           c.chemical_name,
           c.chemical_code
         FROM process_step_chemicals psc
         LEFT JOIN chemicals c ON psc.chemical_id = c.id
         WHERE psc.process_step_id = ?
         ORDER BY psc.addition_order`,
        [step.id]
      );

      step.chemicals = chemicals;
    }

    res.json({
      ...templates[0],
      steps
    });
  } catch (error) {
    console.error('Fetch process template details error:', error);
    res.status(500).json({ message: 'Failed to fetch process template details' });
  }
});

export default router;
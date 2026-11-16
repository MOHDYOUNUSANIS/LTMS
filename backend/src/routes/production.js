import express from 'express';
import pool from '../config/db.js';

const router = express.Router();

// GET: List production batches
router.get('/', async (req, res) => {
    try {
        const [batches] = await pool.query(`
            SELECT
                pb.*,
                c.company_name,
                d.drum_code,
                pt.template_name,
                s.full_name AS supervisor_name
            FROM production_batches pb
            JOIN companies c ON pb.company_id = c.id
            JOIN drums d ON pb.drum_id = d.id
            LEFT JOIN process_templates pt ON pb.template_id = pt.id
            LEFT JOIN supervisors s ON pb.created_by = s.id
            ORDER BY pb.created_at DESC
        `);

        res.json(batches);

    } catch (error) {
        console.error('Fetch production batches error:', error);
        res.status(500).json({
            message: 'Failed to fetch production batches'
        });
    }
});


// POST: Create production batch
router.post('/', async (req, res) => {
    const connection = await pool.getConnection();

    try {
        const {
            company_id,
            drum_id,
            template_id,
            product_name,
            species,
            colour,
            hides_sides_count,
            input_weight_kg,
            thickness_min_mm,
            thickness_max_mm,
            notes
        } = req.body;

        if (
            !company_id ||
            !drum_id ||
            !product_name?.trim() ||
            !Number.isFinite(Number(input_weight_kg)) ||
            Number(input_weight_kg) <= 0
        ) {
            return res.status(400).json({
                message: 'Company, drum, product and valid batch weight are required'
            });
        }

        if (
            hides_sides_count != null &&
            (!Number.isInteger(Number(hides_sides_count)) ||
                Number(hides_sides_count) <= 0)
        ) {
            return res.status(400).json({
                message: 'Quantity must be a positive whole number'
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

        await connection.beginTransaction();

        const [companies] = await connection.execute(
            `SELECT id FROM companies
             WHERE id = ? AND is_active = TRUE`,
            [company_id]
        );

        if (!companies.length) {
            await connection.rollback();
            return res.status(400).json({
                message: 'Company does not exist or is inactive'
            });
        }

        const [drums] = await connection.execute(
            `SELECT id, capacity_kg
             FROM drums
             WHERE id = ?
             AND company_id = ?
             AND status = 'AVAILABLE'
             FOR UPDATE`,
            [drum_id, company_id]
        );

        if (!drums.length) {
            await connection.rollback();
            return res.status(400).json({
                message: 'Selected drum is unavailable or belongs to another company'
            });
        }

        if (
            drums[0].capacity_kg != null &&
            Number(input_weight_kg) > Number(drums[0].capacity_kg)
        ) {
            await connection.rollback();
            return res.status(400).json({
                message: 'Batch weight exceeds drum capacity'
            });
        }

        let template = null;

        if (template_id) {
            const [templates] = await connection.execute(
                `SELECT *
                 FROM process_templates
                 WHERE id = ?
                 AND company_id = ?
                 AND verification_status = 'APPROVED'`,
                [template_id, company_id]
            );

            if (!templates.length) {
                await connection.rollback();
                return res.status(400).json({
                    message: 'An approved process template for this company is required'
                });
            }

            template = templates[0];
        }

        const batchCode = `LTMS-${Date.now()}`;

        const [result] = await connection.execute(
            `INSERT INTO production_batches (
                company_id,
                drum_id,
                template_id,
                batch_code,
                product_name,
                species,
                colour,
                hides_sides_count,
                input_weight_kg,
                thickness_min_mm,
                thickness_max_mm,
                status,
                created_by,
                notes
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PLANNED', ?, ?)`,
            [
                company_id,
                drum_id,
                template_id || null,
                batchCode,
                product_name.trim(),
                species || template?.species || null,
                colour || template?.colour || null,
                hides_sides_count || null,
                Number(input_weight_kg),
                thickness_min_mm ?? template?.thickness_min_mm ?? null,
                thickness_max_mm ?? template?.thickness_max_mm ?? null,
                req.user.id,
                notes || null
            ]
        );

        await connection.commit();

        res.status(201).json({
            message: 'Production batch created successfully',
            batchId: result.insertId,
            batchCode,
            status: 'PLANNED'
        });

    } catch (error) {
        await connection.rollback();

        console.error('Create production batch error:', error);

        res.status(500).json({
            message: 'Failed to create production batch'
        });

    } finally {
        connection.release();
    }
});

// PATCH: Update production batch status
router.patch('/:id/status', async (req, res) => {
    const connection = await pool.getConnection();
    let transactionStarted = false;

    try {
        const { status } = req.body;
        const batchId = req.params.id;

        const allowedStatuses = [
            'IN_PROGRESS',
            'ON_HOLD',
            'COMPLETED',
            'CANCELLED'
        ];

        if (!allowedStatuses.includes(status)) {
            return res.status(400).json({
                message: 'Invalid batch status'
            });
        }

        await connection.beginTransaction();
        transactionStarted = true;

        // Lock the batch
        const [batches] = await connection.execute(
            `SELECT *
             FROM production_batches
             WHERE id = ?
             FOR UPDATE`,
            [batchId]
        );

        if (!batches.length) {
            await connection.rollback();
            transactionStarted = false;

            return res.status(404).json({
                message: 'Production batch not found'
            });
        }

        const batch = batches[0];

        // Validate allowed status transitions
        const transitions = {
            PLANNED: ['IN_PROGRESS', 'CANCELLED'],
            IN_PROGRESS: ['ON_HOLD', 'COMPLETED'],
            ON_HOLD: ['IN_PROGRESS', 'CANCELLED'],
            COMPLETED: [],
            CANCELLED: []
        };

        if (!transitions[batch.status]?.includes(status)) {
            await connection.rollback();
            transactionStarted = false;

            return res.status(400).json({
                message: `Cannot change batch status from ${batch.status} to ${status}`
            });
        }

        // Lock the associated drum
        const [drums] = await connection.execute(
            `SELECT id, status
             FROM drums
             WHERE id = ?
             FOR UPDATE`,
            [batch.drum_id]
        );

        if (!drums.length) {
            await connection.rollback();
            transactionStarted = false;

            return res.status(400).json({
                message: 'Associated drum not found'
            });
        }

        const drum = drums[0];

        // Starting a batch
        if (status === 'IN_PROGRESS' && batch.status === 'PLANNED') {

            if (drum.status !== 'AVAILABLE') {
                await connection.rollback();
                transactionStarted = false;

                return res.status(400).json({
                    message: 'Drum is not available'
                });
            }

            // Check whether another batch is already using this drum
            const [activeBatches] = await connection.execute(
                `SELECT id
                 FROM production_batches
                 WHERE drum_id = ?
                 AND id != ?
                 AND status IN ('IN_PROGRESS', 'ON_HOLD')
                 LIMIT 1`,
                [batch.drum_id, batch.id]
            );

            if (activeBatches.length) {
                await connection.rollback();
                transactionStarted = false;

                return res.status(400).json({
                    message: 'Another active batch is using this drum'
                });
            }

            await connection.execute(
                `UPDATE drums
                 SET status = 'RUNNING'
                 WHERE id = ?`,
                [batch.drum_id]
            );
        }

        // Resuming a batch
        if (status === 'IN_PROGRESS' && batch.status === 'ON_HOLD') {

            if (drum.status !== 'RUNNING') {
                await connection.rollback();
                transactionStarted = false;

                return res.status(400).json({
                    message: 'Drum is not in the expected RUNNING state'
                });
            }
        }

        // Completing or cancelling a batch
        if (status === 'COMPLETED' || status === 'CANCELLED') {

            // Release the drum only when no other active batch uses it
            const [activeBatches] = await connection.execute(
                `SELECT id
                 FROM production_batches
                 WHERE drum_id = ?
                 AND id != ?
                 AND status IN ('IN_PROGRESS', 'ON_HOLD')
                 LIMIT 1`,
                [batch.drum_id, batch.id]
            );

            if (!activeBatches.length && drum.status === 'RUNNING') {
                await connection.execute(
                    `UPDATE drums
                     SET status = 'AVAILABLE'
                     WHERE id = ?`,
                    [batch.drum_id]
                );
            }
        }

        // Update batch status and timestamps
        await connection.execute(
            `UPDATE production_batches
             SET status = ?,
                 started_at = CASE
                     WHEN ? = 'IN_PROGRESS' AND started_at IS NULL
                     THEN NOW()
                     ELSE started_at
                 END,
                 completed_at = CASE
                     WHEN ? IN ('COMPLETED', 'CANCELLED')
                     THEN NOW()
                     ELSE completed_at
                 END
             WHERE id = ?`,
            [status, status, status, batchId]
        );

        await connection.commit();
        transactionStarted = false;

        res.json({
            message: 'Batch status updated successfully',
            batchId,
            previousStatus: batch.status,
            newStatus: status
        });

    } catch (error) {
        if (transactionStarted) {
            await connection.rollback();
        }

        console.error('Update batch status error:', error);

        res.status(500).json({
            message: 'Failed to update batch status'
        });

    } finally {
        connection.release();
    }
});

export default router;
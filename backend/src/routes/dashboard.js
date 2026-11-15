import { Router } from 'express';
import db from '../config/db.js';
const router = Router();
router.get('/summary', async (_req, res) => {
  try {
    const [[companies]] = await db.query('SELECT COUNT(*) AS total FROM companies WHERE is_active=TRUE');
    const [[drums]] = await db.query("SELECT COUNT(*) AS total, SUM(status='RUNNING') AS running FROM drums");
    const [[chemicals]] = await db.query('SELECT COUNT(*) AS total FROM chemicals WHERE is_active=TRUE');
    const [[lowStock]] = await db.query('SELECT COUNT(*) AS total FROM chemicals WHERE is_active=TRUE AND current_stock <= minimum_stock');
    const [[batches]] = await db.query("SELECT COUNT(*) AS total FROM production_batches WHERE status IN ('PLANNED','IN_PROGRESS','ON_HOLD')");
    res.json({ companies: companies.total, drums: drums.total || 0, runningDrums: drums.running || 0, chemicals: chemicals.total, lowStock: lowStock.total, activeBatches: batches.total });
  } catch (e) { res.status(500).json({ message: 'Could not load dashboard', detail: e.message }); }
});
export default router;

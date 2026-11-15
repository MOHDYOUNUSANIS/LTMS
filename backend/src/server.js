import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import db from './config/db.js';
import authRoutes from './routes/auth.js';
import dashboardRoutes from './routes/dashboard.js';
import companyRoutes from './routes/companies.js';
import chemicalRoutes from './routes/chemicals.js';
import drumRoutes from './routes/drums.js';
import processRoutes from './routes/processes.js';
import { requireAuth } from './middleware/auth.js';
dotenv.config();
const app = express();
app.use(cors({ origin: process.env.FRONTEND_ORIGIN || 'http://localhost:5173' }));
app.use(express.json());
app.get('/api/health', async (_req, res) => {
  try { await db.query('SELECT 1'); res.json({ status: 'ok', database: 'connected' }); }
  catch { res.status(500).json({ status: 'error', database: 'disconnected' }); }
});
app.use('/api/auth', authRoutes);
app.use('/api/dashboard', requireAuth, dashboardRoutes);
app.use('/api/companies', requireAuth, companyRoutes);
app.use('/api/chemicals', requireAuth, chemicalRoutes);
app.use('/api/drums', requireAuth, drumRoutes);
app.use('/api/processes', requireAuth, processRoutes);
const port = process.env.PORT || 5000;
app.listen(port, () => console.log(`LTMS API running at http://localhost:${port}`));

const { Router } = require('express');
const prisma = require('../lib/prisma');
const authRoutes = require('./auth.routes');
const adminRoutes = require('./admin.routes');
const publicRoutes = require('./public.routes');

const router = Router();

// Health check con verificación real de la base: 503 si la DB no responde.
router.get('/health', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ok', db: 'up' });
  } catch {
    res.status(503).json({ status: 'error', db: 'down' });
  }
});

router.use('/auth', authRoutes);
router.use('/admin', adminRoutes);
router.use('/public', publicRoutes);

module.exports = router;

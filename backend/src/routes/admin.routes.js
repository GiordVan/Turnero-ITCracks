const { Router } = require('express');
const { body, query } = require('express-validator');
const adminController = require('../controllers/admin.controller');
const { authenticate, authenticateQuery, authorize } = require('../middleware/auth.middleware');
const validate = require('../middleware/validate.middleware');
const notificationEmitter = require('../services/notifications');

const router = Router();

// SSE — must be registered before the blanket middleware because EventSource
// cannot send custom headers, so auth comes from ?token= query param instead.
router.get('/notifications/stream', authenticateQuery, authorize('ADMIN'), (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  // Keep-alive ping every 25 s to prevent proxy timeouts
  const ping = setInterval(() => res.write(': ping\n\n'), 25000);

  const handler = (turn) => res.write(`data: ${JSON.stringify(turn)}\n\n`);
  notificationEmitter.on('new-turn', handler);

  req.on('close', () => {
    clearInterval(ping);
    notificationEmitter.off('new-turn', handler);
  });
});

router.use(authenticate, authorize('ADMIN'));

// Config
router.get('/config', adminController.getConfig);
router.put(
  '/config',
  [
    body('turnDuration').optional().isInt({ min: 5, max: 480 }),
    body('workingDays').optional().isArray({ min: 1 }),
    body('workingDays.*').optional().isInt({ min: 0, max: 6 }),
  ],
  validate,
  adminController.updateConfig,
);

// Work bands
router.get('/work-bands', adminController.listWorkBands);
router.post(
  '/work-bands',
  [
    body('startTime').matches(/^\d{2}:\d{2}$/),
    body('endTime').matches(/^\d{2}:\d{2}$/),
    body('label').optional().isString().trim(),
    body('sortOrder').optional().isInt({ min: 0 }),
  ],
  validate,
  adminController.createWorkBand,
);
router.put(
  '/work-bands/:id',
  [
    body('startTime').optional().matches(/^\d{2}:\d{2}$/),
    body('endTime').optional().matches(/^\d{2}:\d{2}$/),
    body('label').optional().isString().trim(),
    body('isActive').optional().isBoolean(),
  ],
  validate,
  adminController.updateWorkBand,
);
router.delete('/work-bands/:id', adminController.deleteWorkBand);

// Daily turns
router.get(
  '/turns',
  [query('date').optional().isDate()],
  validate,
  adminController.getDailyTurns,
);

router.get('/notifications', adminController.getNotifications);

// Analytics / dashboard de conversión
router.get('/analytics', adminController.getAnalytics);

module.exports = router;

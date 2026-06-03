const { Router } = require('express');
const { body, query, param } = require('express-validator');
const publicController = require('../controllers/public.controller');
const validate = require('../middleware/validate.middleware');

const router = Router();

router.get('/config', publicController.getPublicConfig);

router.get('/professionals', publicController.listProfessionals);

router.get(
  '/available-slots',
  [query('date').isDate(), query('professionalId').isString().notEmpty()],
  validate,
  publicController.getAvailableSlots,
);

router.post(
  '/turns',
  [
    body('customerName').isString().trim().notEmpty(),
    body('email').isEmail().normalizeEmail(),
    body('scheduledDate').isDate(),
    body('scheduledTime').matches(/^\d{2}:\d{2}$/),
    body('professionalId').isString().notEmpty(),
  ],
  validate,
  publicController.createTurn,
);

router.get(
  '/my-turns',
  [query('email').isEmail().normalizeEmail()],
  validate,
  publicController.getMyTurns,
);

router.patch(
  '/turns/:id/cancel',
  [param('id').isString().notEmpty()],
  validate,
  publicController.cancelTurn,
);

module.exports = router;

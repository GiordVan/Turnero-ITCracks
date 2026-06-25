const publicService = require('../services/public.service');
const depositService = require('../services/deposit.service');

const getPublicConfig = async (req, res, next) => {
  try {
    res.json(await publicService.getPublicConfig());
  } catch (e) { next(e); }
};

const listProfessionals = async (req, res, next) => {
  try {
    res.json(await publicService.listProfessionals());
  } catch (e) { next(e); }
};

const getAvailableSlots = async (req, res, next) => {
  try {
    res.json(await publicService.getAvailableSlots(req.query.date, req.query.professionalId));
  } catch (e) { next(e); }
};

const createTurn = async (req, res, next) => {
  try {
    res.status(201).json(await publicService.createTurn(req.body));
  } catch (e) { next(e); }
};

const getMyTurns = async (req, res, next) => {
  try {
    res.json(await publicService.getMyTurns(req.query.email));
  } catch (e) { next(e); }
};

const cancelTurn = async (req, res, next) => {
  try {
    res.json(await publicService.cancelTurn(req.params.id, req.body.email));
  } catch (e) { next(e); }
};

const createDeposit = async (req, res, next) => {
  try {
    res.status(201).json(await depositService.createDeposit(req.params.id, req.body.email));
  } catch (e) { next(e); }
};

const confirmDeposit = async (req, res, next) => {
  try {
    const payment = await depositService.confirmDeposit(req.params.id, req.body.email);
    depositService
      .notifyConfirmation(payment.turnId)
      .catch((e) => console.error('[deposit] confirmacion WhatsApp no enviada:', e.message));
    res.json(payment);
  } catch (e) { next(e); }
};

module.exports = { getPublicConfig, listProfessionals, getAvailableSlots, createTurn, getMyTurns, cancelTurn, createDeposit, confirmDeposit };

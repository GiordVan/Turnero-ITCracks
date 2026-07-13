const publicService = require('../services/public.service');
const depositService = require('../services/deposit.service');
const manageToken = require('../lib/manageToken');
const config = require('../config');

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
    const turn = await publicService.createTurn(req.body);
    // Token de gestión (F0): se entrega en la respuesta para poder cancelar/pagar
    // sin exponer datos por email. No se persiste ni se registra en logs.
    const token = manageToken.sign(turn.id, { expiresAt: manageToken.expiryForTurn(turn) });
    res.status(201).json({ ...turn, manageToken: token });
  } catch (e) { next(e); }
};

const getMyTurns = async (req, res, next) => {
  try {
    if (!config.features.publicMyTurns) {
      return res.status(410).json({
        message:
          'La consulta de turnos por email está deshabilitada temporalmente por seguridad. Usá el enlace de gestión de tu reserva.',
      });
    }
    res.json(await publicService.getMyTurns(req.query.email));
  } catch (e) { next(e); }
};

const cancelTurn = async (req, res, next) => {
  try {
    res.json(await publicService.cancelTurn(req.params.id, req.body.token));
  } catch (e) { next(e); }
};

const createDeposit = async (req, res, next) => {
  try {
    res.status(201).json(await depositService.createDeposit(req.params.id, req.body.token));
  } catch (e) { next(e); }
};

const confirmDeposit = async (req, res, next) => {
  try {
    const payment = await depositService.confirmDeposit(req.params.id, req.body.token);
    depositService
      .notifyConfirmation(payment.turnId)
      .catch((e) => console.error('[deposit] confirmacion WhatsApp no enviada:', e.message));
    res.json(payment);
  } catch (e) { next(e); }
};

module.exports = { getPublicConfig, listProfessionals, getAvailableSlots, createTurn, getMyTurns, cancelTurn, createDeposit, confirmDeposit };

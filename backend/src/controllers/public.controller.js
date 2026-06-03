const publicService = require('../services/public.service');

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
    res.json(await publicService.cancelTurn(req.params.id));
  } catch (e) { next(e); }
};

module.exports = { getPublicConfig, listProfessionals, getAvailableSlots, createTurn, getMyTurns, cancelTurn };

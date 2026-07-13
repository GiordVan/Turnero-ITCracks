const adminService = require('../services/admin.service');
const analyticsService = require('../services/analytics.service');

const getConfig = async (req, res, next) => {
  try {
    res.json(await adminService.getConfig());
  } catch (e) {
    next(e);
  }
};

const updateConfig = async (req, res, next) => {
  try {
    res.json(await adminService.updateConfig(req.body));
  } catch (e) {
    next(e);
  }
};

const listWorkBands = async (req, res, next) => {
  try {
    res.json(await adminService.listWorkBands());
  } catch (e) {
    next(e);
  }
};

const createWorkBand = async (req, res, next) => {
  try {
    res.status(201).json(await adminService.createWorkBand(req.body));
  } catch (e) {
    next(e);
  }
};

const updateWorkBand = async (req, res, next) => {
  try {
    res.json(await adminService.updateWorkBand(req.params.id, req.body));
  } catch (e) {
    next(e);
  }
};

const deleteWorkBand = async (req, res, next) => {
  try {
    await adminService.deleteWorkBand(req.params.id);
    res.status(204).end();
  } catch (e) {
    next(e);
  }
};

const getDailyTurns = async (req, res, next) => {
  try {
    res.json(await adminService.getDailyTurns(req.query.date));
  } catch (e) {
    next(e);
  }
};

const getNotifications = async (req, res, next) => {
  try {
    res.json(await adminService.listNotifications());
  } catch (e) {
    next(e);
  }
};

const getAnalytics = async (req, res, next) => {
  try {
    res.json(await analyticsService.getDashboard());
  } catch (e) {
    next(e);
  }
};

module.exports = {
  getConfig,
  updateConfig,
  listWorkBands,
  createWorkBand,
  updateWorkBand,
  deleteWorkBand,
  getDailyTurns,
  getNotifications,
  getAnalytics,
};

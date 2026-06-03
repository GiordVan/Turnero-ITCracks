const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const config = require('./config');
const routes = require('./routes');
const reminders = require('./services/reminders');
const { errorHandler, notFound } = require('./middleware/error.middleware');

const app = express();

app.use(helmet());
app.use(cors({ origin: config.cors.origin, credentials: true }));
app.use(morgan(config.nodeEnv === 'development' ? 'dev' : 'combined'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api', routes);

// En producción (Railway, 1 servicio) el backend sirve el build del frontend.
// Mismo origen → el '/api' relativo del front funciona sin CORS.
if (config.nodeEnv === 'production') {
  const distPath = path.join(__dirname, '../../frontend/dist');
  app.use(express.static(distPath));
  // SPA fallback: cualquier GET que no sea /api devuelve index.html.
  // Usamos middleware sin patrón para evitar el wildcard de path-to-regexp en Express 5.
  app.use((req, res, next) => {
    if (req.method !== 'GET' || req.path.startsWith('/api')) return next();
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

app.use(notFound);
app.use(errorHandler);

app.listen(config.port, () => {
  console.log(`Server running on port ${config.port} [${config.nodeEnv}]`);
  reminders.start();
});

module.exports = app;

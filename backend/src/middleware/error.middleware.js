const config = require('../config');

const notFound = (req, res, next) => {
  const error = new Error(`Not found: ${req.originalUrl}`);
  error.statusCode = 404;
  next(error);
};

const errorHandler = (err, req, res, _next) => {
  const statusCode = err.statusCode || 500;

  // Errores del servidor (5xx): NO exponer detalles internos (mensajes de Prisma,
  // stacks, etc.) al cliente. Se loguean completos del lado del servidor.
  // Errores intencionales (4xx con statusCode explícito): el mensaje es seguro.
  const isServerError = statusCode >= 500;
  if (isServerError) {
    console.error('[error]', err);
  }
  const message = isServerError ? 'Internal Server Error' : err.message || 'Error';

  res.status(statusCode).json({
    message,
    ...(config.nodeEnv === 'development' && { stack: err.stack }),
  });
};

module.exports = { notFound, errorHandler };

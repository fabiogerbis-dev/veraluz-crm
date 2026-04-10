function errorHandler(error, req, res, next) {
  if (res.headersSent) {
    return next(error);
  }

  const status = error.status || 500;
  const message = error.message || "Erro interno no servidor.";

  if (status >= 500) {
    console.error(`[ERROR] ${req.method} ${req.originalUrl} → ${status}: ${message}`);
    console.error(error.stack || error);
  }

  return res.status(status).json({
    message,
    details: process.env.NODE_ENV === "development" ? error.stack : undefined,
  });
}

module.exports = errorHandler;

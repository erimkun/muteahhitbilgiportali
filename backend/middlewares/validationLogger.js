const client = require('prom-client');
const logger = require('../utils/logger');

// Create a counter metric for validation failures
const validationFailures = new client.Counter({
  name: 'app_validation_failures_total',
  help: 'Total number of validation failures'
});

function validationLogger(req, res, next) {
  const errors = req.validationErrors || null;
  if (errors && errors.length) {
    validationFailures.inc(errors.length);
    logger.warn(`Validation failed on ${req.method} ${req.originalUrl}: ${errors.map(e => `${e.param}:${e.msg}`).join(', ')}`);
  }
  next();
}

module.exports = { validationLogger, promClient: client };

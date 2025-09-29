const { validationResult } = require('express-validator');
const { validationLogger } = require('./validationLogger');

// Central request validation error handler
function handleValidationErrors(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const details = errors.array().map(err => ({ field: err.param || err.path, message: err.msg }));
    // Attach to req for downstream logging/metrics
    req.validationErrors = details;
    // Run the logger/metrics middleware then return response
    validationLogger(req, res, () => {});
    return res.status(400).json({
      error: 'Validation failed',
      details
    });
  }
  next();
}

module.exports = { handleValidationErrors };

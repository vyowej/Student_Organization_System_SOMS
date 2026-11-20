/**
 * Shared Backend Validation Utilities (backend/utils.js)
 */

/**
 * Parses a positive finite integer ID or returns null when invalid.
 */
function resolvePositiveInt(value) {
  const num = Number(value);
  return Number.isInteger(num) && num > 0 ? num : null;
}

module.exports = {
  resolvePositiveInt,
};

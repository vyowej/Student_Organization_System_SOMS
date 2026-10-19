/**
 * Email Validation Helpers
 *
 * Validates general email syntax and Western Mindanao State University
 * institutional email addresses (`@wmsu.edu.ph`).
 */
export function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export function isWmsuEmail(email) {
  return isValidEmail(email.trim()) && /^[^\s@]+@wmsu\.edu\.ph$/i.test(email.trim())
}

export function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export function isWmsuEmail(email) {
  return isValidEmail(email.trim()) && /^[^\s@]+@wmsu\.edu\.ph$/i.test(email.trim())
}

/**
 * Person Name & Greeting Formatting Utilities
 *
 * Formats user names consistently across UNIDOS portals (`Last, First Middle`
 * for rosters/tables and `First` for conversational greetings).
 */
export function formatDisplayName(person = {}) {
  person ??= {}
  const lastName = person.lastName?.trim() || person.last_name?.trim()
  const firstName = person.firstName?.trim() || person.first_name?.trim()
  const middleName = person.middleName?.trim() || person.middle_name?.trim()
  const suffix = person.suffix?.trim()
  if (lastName && firstName) {
    return `${lastName}, ${firstName}${middleName ? ` ${middleName}` : ''}${suffix ? ` ${suffix}` : ''}`
  }
  const fallback = person.displayName?.trim() || person.name?.trim() || person.studentName?.trim() || ''
  if (fallback && suffix && !fallback.includes(suffix)) {
    return `${fallback} ${suffix}`
  }
  return fallback
}

// Short, sentence-friendly name ("Juan") for greetings. formatDisplayName() returns
// "Last, First", which reads wrongly inside a sentence.
export function formatGreetingName(person = {}) {
  person ??= {}
  const firstName = person.firstName?.trim()
  if (firstName) return firstName
  const full = formatDisplayName(person)
  if (!full) return ''
  // Fallback for records that only have a combined "Last, First Middle" string.
  if (full.includes(',')) return full.split(',')[1].trim().split(/\s+/)[0] ?? full
  return full.split(/\s+/)[0]
}

export function getTimeGreeting(date = new Date()) {
  const hour = date.getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

/**
 * Email Validation Helpers
 */
export function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export function isWmsuEmail(email) {
  return isValidEmail(email.trim()) && /^[^\s@]+@wmsu\.edu\.ph$/i.test(email.trim())
}

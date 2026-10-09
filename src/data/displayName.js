export function formatDisplayName(person = {}) {
  person ??= {}
  const lastName = person.lastName?.trim()
  const firstName = person.firstName?.trim()
  const middleName = person.middleName?.trim()
  if (lastName && firstName) {
    return `${lastName}, ${firstName}${middleName ? ` ${middleName}` : ''}`
  }
  return person.displayName?.trim() || person.name?.trim() || person.studentName?.trim() || ''
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

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

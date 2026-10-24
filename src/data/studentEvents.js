export const eventCategories = [
  'All',
  'Academic',
  'Student Council',
  'Socio-Civic',
  'Cultural',
  'Sports & Recreation',
  'Religious',
  'Special Interest',
  'Other',
]

export const studentEvents = []

export const initialStudentRegistrations = []

export const studentNotifications = []

export function isEventAlmostFull(event) {
  if (!event) return false
  const capacity = Number(event.capacity ?? event.max_participants ?? 0)
  const registered = Number(event.registeredCount ?? event.registered_count ?? 0)
  if (capacity <= 0) return false
  return registered / capacity >= 0.8 && registered < capacity
}

export function getEventRegistrationState(event, registration) {
  if (registration && registration.status !== 'CANCELLED') {
    return 'REGISTERED'
  }
  if (!event) return 'REGISTRATION CLOSED'
  if (event.status === 'COMPLETED' || event.status === 'ARCHIVED') {
    return 'EVENT COMPLETED'
  }
  if (event.status === 'CANCELLED' || event.registrationStatus === 'CLOSED') {
    return 'REGISTRATION CLOSED'
  }
  const capacity = Number(event.capacity ?? event.max_participants ?? 0)
  const registered = Number(event.registeredCount ?? event.registered_count ?? 0)
  if (capacity > 0 && registered >= capacity) {
    return 'EVENT FULL'
  }
  return 'NOT REGISTERED'
}

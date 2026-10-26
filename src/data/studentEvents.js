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

export const organizationCategories = [
  'All',
  'Academic',
  'Technology',
  'Leadership',
  'Student Council',
  'Socio-Civic',
  'Cultural',
  'Sports & Recreation',
  'Sports',
  'Religious',
  'Special Interest',
  'Publication',
  'Other',
]

export const studentEvents = []
export const studentOrganizations = []

export function getOrganizationEvents(organization, officerEvents = []) {
  if (!organization) return []
  const fromOfficerEvents = officerEvents
    .filter(
      (ev) =>
        String(ev.organizationId ?? ev.organization_id) === String(organization.id) &&
        ['PUBLISHED', 'APPROVED'].includes(ev.status),
    )
    .map((ev) => ({
      id: ev.id,
      title: ev.title,
      date: ev.date,
      time: ev.startTime && ev.endTime ? `${ev.startTime} - ${ev.endTime}` : ev.startTime || 'TBA',
      location: ev.location || 'TBA',
      status: ev.status,
    }))

  if (fromOfficerEvents.length > 0) return fromOfficerEvents
  return (organization.upcomingEvents ?? []).map((ev) => ({
    id: ev.id,
    title: ev.title,
    date: ev.date,
    time: ev.time || 'TBA',
    location: ev.venue || ev.location || 'TBA',
    status: ev.status || 'PUBLISHED',
  }))
}

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

function formatEventDisplayDate(dateString) {
  if (!dateString) return 'TBA'
  const parsed = new Date(dateString.includes('T') ? dateString : `${dateString}T00:00:00`)

  if (Number.isNaN(parsed.getTime())) {
    return dateString
  }

  return parsed.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function officerEventToStudentEvent(event) {
  if (!event) return null
  const dateLabel = formatEventDisplayDate(event.date || event.start_date)
  const startTime = event.startTime || ''
  const endTime = event.endTime || ''
  const timeRange = startTime && endTime ? `${startTime} - ${endTime}` : startTime || event.time || 'Schedule TBA'
  const capacity = Number(event.capacity ?? event.max_participants ?? 100)
  const registeredCount = Number(event.registeredCount ?? event.registered_count ?? 0)

  return {
    ...event,
    id: event.id,
    title: event.title,
    organizationId: event.organizationId ?? event.organization_id,
    organizationName: event.organizationName ?? event.organization_name ?? event.organization ?? 'Student Organization',
    organization: event.organizationName ?? event.organization_name ?? event.organization ?? 'Student Organization',
    category: event.category || 'Academic',
    color: event.color || 'crimson',
    status: event.status || 'PUBLISHED',
    registrationStatus: ['PUBLISHED', 'APPROVED'].includes(event.status) ? 'OPEN' : 'CLOSED',
    date: dateLabel,
    rawDate: event.date || event.start_date,
    time: timeRange,
    location: event.location || event.venue || 'TBA',
    venue: event.location || event.venue || 'TBA',
    capacity,
    registeredCount,
    registrationDeadline: dateLabel,
    description: event.description || event.summary || '',
  }
}

export function findStudentEvent(eventId, officerEvents = [], fallbackEvents = []) {
  const matchedOfficer = (officerEvents || []).find((item) => String(item.id) === String(eventId))
  if (matchedOfficer) return officerEventToStudentEvent(matchedOfficer)
  const matchedStudent = (fallbackEvents || []).find((item) => String(item.id) === String(eventId))
  if (matchedStudent) return officerEventToStudentEvent(matchedStudent)
  return null
}

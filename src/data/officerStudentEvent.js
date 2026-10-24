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

export function toStudentDiscoverableEvent(event, organizations = []) {
  const organization = organizations.find(
    (item) => String(item.id) === String(event.organizationId ?? event.organization_id),
  )
  const base = officerEventToStudentEvent(event)
  return {
    ...base,
    organization: base.organizationName || organization?.name || 'Student Organization',
    category: event.category ?? organization?.category ?? 'Academic',
    college: organization?.college ?? 'University-Wide',
    audience: 'Open to eligible students',
    summary: base.description,
    agenda: event.agenda ?? [],
    requirements: event.requirements ?? [
      'Valid student ID and active Event Pass QR code.',
    ],
    contactEmail: organization?.contactEmail ?? organization?.adviserEmail ?? '',
    coordinator: event.submittedBy ?? event.created_by_name ?? 'Organization Officer',
  }
}

export function findStudentEvent(eventId, officerEvents = [], studentEvents = []) {
  const matchedOfficer = (officerEvents || []).find((item) => String(item.id) === String(eventId))
  if (matchedOfficer) return officerEventToStudentEvent(matchedOfficer)
  const matchedStudent = (studentEvents || []).find((item) => String(item.id) === String(eventId))
  if (matchedStudent) return officerEventToStudentEvent(matchedStudent)
  return null
}

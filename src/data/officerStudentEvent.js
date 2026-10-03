export function officerEventToStudentEvent(event) {
  return {
    ...event,
    organizationName: event.organizationName ?? 'WMSU Computer Society',
    category: event.category || 'Organization Activity',
    startTime: event.startTime || event.time || 'Time to be confirmed',
    endTime: event.endTime || '',
    time: event.time || event.startTime || 'Time to be confirmed',
    location: event.location || event.venue || 'Venue to be confirmed',
    capacity: Number(event.capacity) || 100,
    registeredCount: Number(event.registrations) || 0,
    registrationDeadline: event.registrationDeadline ?? event.date,
    registrationStatus: event.registrationStatus ?? 'OPEN',
    color: event.color ?? 'blue',
  }
}

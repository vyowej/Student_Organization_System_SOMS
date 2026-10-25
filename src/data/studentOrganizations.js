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
  'Other',
]

export const orgTypeEnumToLabel = {
  STUDENT_COUNCIL: 'Student Council',
  ACADEMIC: 'Academic',
  RELIGIOUS: 'Religious',
  CULTURAL: 'Cultural',
  SPORTS_RECREATION: 'Sports & Recreation',
  SOCIO_CIVIC: 'Socio-Civic',
  SPECIAL_INTEREST: 'Special Interest',
  OTHER: 'Other',
}

export const orgLabelToTypeEnum = {
  'Student Council': 'STUDENT_COUNCIL',
  Academic: 'ACADEMIC',
  Religious: 'RELIGIOUS',
  Cultural: 'CULTURAL',
  'Sports & Recreation': 'SPORTS_RECREATION',
  Sports: 'SPORTS_RECREATION',
  'Socio-Civic': 'SOCIO_CIVIC',
  'Special Interest': 'SPECIAL_INTEREST',
  Other: 'OTHER',
}

export const orgScopeOptions = ['UNIVERSITY', 'COLLEGE', 'DEPARTMENT']

export const studentOrganizations = []

export const initialStudentMemberships = []

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

/**
 * Organization Officer Portal Constants (`src/data/officerPortal.js`)
 *
 * All fake officer organization, members, membership requests, events, and
 * activity logs have been removed. Data is loaded dynamically from PostgreSQL
 * via `/api/*`.
 */

export const officerOrganization = {}

export const officerActivity = []

export const officerMembers = []

export const officerMembershipRequests = []

export const officerEvents = []

export const officerPositions = [
  'President',
  'Vice President',
  'Secretary',
  'Treasurer',
  'Auditor',
  'PIO',
  'Committee Head',
  'General Member',
]

export const OFFICER_POSITIONS = [
  'President',
  'Vice President',
  'Secretary',
  'Treasurer',
  'Auditor',
  'Public Relations Officer',
  'Other Officer Position',
]

export const ALL_POSITIONS = [
  ...OFFICER_POSITIONS,
  'General Member',
]

export function isOfficerPosition(position) {
  if (!position) return false
  const p = String(position).trim().toUpperCase().replace(/[\s_-]+/g, '_')
  if (p === 'MEMBER' || p === 'GENERAL_MEMBER') return false
  const officerSet = new Set([
    'PRESIDENT',
    'VICE_PRESIDENT',
    'SECRETARY',
    'TREASURER',
    'AUDITOR',
    'PRO',
    'PUBLIC_RELATIONS_OFFICER',
    'OTHER',
    'OTHER_OFFICER',
    'OTHER_OFFICER_POSITION',
    'COMMITTEE_HEAD',
  ])
  return officerSet.has(p) || (p !== '' && p !== 'MEMBER' && p !== 'GENERAL_MEMBER')
}

export function formatPositionLabel(position, customTitle) {
  if (customTitle && String(customTitle).trim()) return String(customTitle).trim()
  const raw = String(position || '').trim().toUpperCase()
  const map = {
    PRESIDENT: 'President',
    VICE_PRESIDENT: 'Vice President',
    SECRETARY: 'Secretary',
    TREASURER: 'Treasurer',
    AUDITOR: 'Auditor',
    PRO: 'Public Relations Officer',
    PUBLIC_RELATIONS_OFFICER: 'Public Relations Officer',
    OTHER_OFFICER: 'Other Officer Position',
    OTHER: 'Other Officer Position',
    MEMBER: 'General Member',
  }
  return map[raw] || position || 'General Member'
}

export const officerEventStatuses = {
  DRAFT: { label: 'Draft', tone: 'neutral' },
  PENDING: { label: 'Submitted', tone: 'warning' },
  SUBMITTED: { label: 'Submitted', tone: 'warning' },
  UNDER_REVIEW: { label: 'Under Review', tone: 'warning' },
  APPROVED: { label: 'Approved', tone: 'success' },
  PUBLISHED: { label: 'Published', tone: 'success' },
  RETURNED_FOR_REVISION: { label: 'Returned for Revision', tone: 'danger' },
  RETURNED: { label: 'Returned for Revision', tone: 'danger' },
  REJECTED: { label: 'Rejected', tone: 'danger' },
  ONGOING: { label: 'Ongoing', tone: 'crimson' },
  COMPLETED: { label: 'Completed', tone: 'neutral' },
  CANCELLED: { label: 'Cancelled', tone: 'danger' },
  ARCHIVED: { label: 'Archived', tone: 'neutral' },
}

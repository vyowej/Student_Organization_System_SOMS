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

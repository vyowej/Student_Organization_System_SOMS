export const dashboardByRole = {
  OFFICER: '/officer/dashboard',
  ADVISER: '/adviser/dashboard',
  ADMIN: '/admin/dashboard',
}

export const officerPages = [
  { path: 'dashboard', title: 'Officer Dashboard', description: 'An overview of your organization’s activity and requests.', to: '/officer/dashboard' },
  { path: 'organization', title: 'Organization Profile', description: 'Manage the profile and public information for your organization.', to: '/officer/organization' },
  { path: 'members', title: 'Officers & Committees', description: 'Manage officer hierarchy, committee assignments, demotions, and removals.', to: '/officer/members' },
  { path: 'membership-requests', title: 'Officer Applications', description: 'Review applicants and COR documents for officer & committee roles.', to: '/officer/membership-requests' },
  { path: 'events', title: 'Events', description: 'Manage event proposals and your organization’s activities.', to: '/officer/events' },
  { path: 'attendance', title: 'Attendance', description: 'Record and review check-ins for your organization’s events.', to: '/officer/attendance' },
  { path: 'events/create', title: 'Create Event Proposal', description: 'Prepare an event proposal and compliance upload for review.', to: '/officer/events/create' },
  { path: 'announcements', title: 'Announcements', description: 'Prepare updates for your organization’s officers and committees.', to: '/officer/announcements' },
  { path: 'documents', title: 'Documents', description: 'View organizational documents and submission statuses.', to: '/officer/documents' },
  { path: 'reports', title: 'Activity Reports', description: 'Review activity records and accomplishment reports.', to: '/officer/reports' },
  { path: 'settings', title: 'Organization Settings', description: 'Review organization preferences and account settings.', to: '/officer/settings' },
]

export const adviserPages = [
  { path: 'dashboard', title: 'Adviser Dashboard', description: 'An overview of organizations and items awaiting your review.', to: '/adviser/dashboard' },
  { path: 'organizations', title: 'My Organizations', description: 'View student organizations assigned to you and prepare adviser accounts.', to: '/adviser/organizations' },
  { path: 'approvals', title: 'Approvals', description: 'Review proposals, compliance files, and reports submitted by organizations.', to: '/adviser/approvals' },
  { path: 'events', title: 'Events', description: 'Review the schedule of activities for your organizations.', to: '/adviser/events' },
  { path: 'reports', title: 'Activity Reports', description: 'Review submitted accomplishment reports.', to: '/adviser/reports' },
]

export const adminPages = [
  { path: 'dashboard', title: 'Admin Dashboard', description: 'Global overview of organizations, officers, advisers, and pending work.', to: '/admin/dashboard' },
  { path: 'users', title: 'Users & Advisers', description: 'Manage global accounts and pre-generate faculty adviser accounts.', to: '/admin/users' },
  { path: 'organizations', title: 'Organizations', description: 'Manage accredited organizations, advisers, and institutional standing.', to: '/admin/organizations' },
  { path: 'organization-applications', title: 'Organization Applications', description: 'Review organizations applying for accreditation.', to: '/admin/organization-applications' },
  { path: 'events', title: 'Campus Events', description: 'View and oversee events across the university.', to: '/admin/events' },
  { path: 'approvals', title: 'Approval Center', description: 'Global approval center across all workflows and submissions.', to: '/admin/approvals' },
  { path: 'documents', title: 'Documents', description: 'Review organizational and event compliance documents.', to: '/admin/documents' },
  { path: 'reports', title: 'Reports', description: 'Review administrative summaries and organization reports.', to: '/admin/reports' },
  { path: 'analytics', title: 'Analytics', description: 'Explore monthly interval analytics, participation metrics, and data exports.', to: '/admin/analytics' },
  { path: 'audit-logs', title: 'Audit Logs', description: 'Review the history of important system actions.', to: '/admin/audit-logs' },
  { path: 'settings', title: 'System Settings', description: 'Review system configuration and category settings.', to: '/admin/settings' },
]

export const roleNavigation = {
  'Organization Officer': {
    pages: officerPages.filter((page) => page.path !== 'events/create'),
    home: '/officer/dashboard',
    notifications: '/officer/announcements',
    profile: '/officer/organization',
  },
  'Organization Adviser': {
    pages: adviserPages,
    home: '/adviser/dashboard',
    notifications: '/adviser/approvals',
    profile: '/adviser/organizations',
  },
  'Student Affairs Admin': {
    pages: adminPages,
    home: '/admin/dashboard',
    notifications: '/admin/approvals',
    profile: '/admin/settings',
  },
}

export const officerPositions = [
  'President',
  'Vice President',
  'Secretary',
  'Treasurer',
  'Auditor',
  'Public Information Officer (PIO)',
  'Committee Chairperson',
  'Committee Member',
]

export const officerEventStatuses = {
  DRAFT: { label: 'DRAFT', tone: 'neutral' },
  SUBMITTED: { label: 'SUBMITTED', tone: 'warning' },
  UNDER_REVIEW: { label: 'UNDER REVIEW', tone: 'warning' },
  APPROVED: { label: 'APPROVED', tone: 'success' },
  REJECTED: { label: 'REJECTED', tone: 'danger' },
  RETURNED: { label: 'RETURNED', tone: 'warning' },
  PUBLISHED: { label: 'PUBLISHED', tone: 'success' },
  ONGOING: { label: 'ONGOING', tone: 'crimson' },
  COMPLETED: { label: 'COMPLETED', tone: 'neutral' },
  CANCELLED: { label: 'CANCELLED', tone: 'danger' },
  ARCHIVED: { label: 'ARCHIVED', tone: 'neutral' },
}

export const adminPrograms = [
  'All',
  'BS in Computer Science',
  'BS in Information Technology',
  'BS in Civil Engineering',
  'BS in Nursing',
  'BS in Accountancy',
  'BA in Communication',
  'BS in Biology',
  'Bachelor of Secondary Education',
]

export const adminYears = ['All', '1st Year', '2nd Year', '3rd Year', '4th Year', '5th Year']

export const adminDefaultSettings = {
  academicYear: '2026–2027',
  semester: 'Second Semester',
  organizationCategories: [
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
  ],
  notifications: {
    organizationApplications: true,
    eventApprovals: true,
    documentReviews: true,
    securityAlerts: true,
  },
}

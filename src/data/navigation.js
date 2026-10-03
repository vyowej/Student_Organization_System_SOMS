export const studentPages = [
  { path: 'dashboard', title: 'Student Dashboard', description: 'Your overview of organizations, events, and campus updates.', to: '/student/dashboard' },
  { path: 'organizations', title: 'Organizations', description: 'Discover active student organizations at WMSU.', to: '/student/organizations' },
  { path: 'organizations/:id', title: 'Organization Profile', description: 'Review an organization profile and its membership information.', to: '/student/organizations' },
  { path: 'my-organizations', title: 'My Organizations', description: 'View your organization memberships and application statuses.', to: '/student/my-organizations' },
  { path: 'events', title: 'Events', description: 'Browse upcoming activities from across the university.', to: '/student/events' },
  { path: 'events/:id', title: 'Event Details', description: 'Review event information and registration details.', to: '/student/events' },
  { path: 'registrations', title: 'My Registrations', description: 'View the events you have registered for.', to: '/student/registrations' },
  { path: 'attendance', title: 'Attendance', description: 'Review your event attendance history.', to: '/student/attendance' },
  { path: 'notifications', title: 'Notifications', description: 'Stay informed about your memberships and campus activities.', to: '/student/notifications' },
  { path: 'profile', title: 'My Profile', description: 'View your student profile and academic details.', to: '/student/profile' },
]

export const officerPages = [
  { path: 'dashboard', title: 'Officer Dashboard', description: 'An overview of your organization’s activity and requests.', to: '/officer/dashboard' },
  { path: 'organization', title: 'Organization Profile', description: 'Manage the profile and public information for your organization.', to: '/officer/organization' },
  { path: 'members', title: 'Members', description: 'View and manage your organization’s member roster.', to: '/officer/members' },
  { path: 'membership-requests', title: 'Membership Requests', description: 'Review students applying to join your organization.', to: '/officer/membership-requests' },
  { path: 'events', title: 'Events', description: 'Manage event proposals and your organization’s activities.', to: '/officer/events' },
  { path: 'events/create', title: 'Create Event Proposal', description: 'Prepare an event proposal for review and approval.', to: '/officer/events/create' },
  { path: 'announcements', title: 'Announcements', description: 'Prepare updates for your organization’s members.', to: '/officer/announcements' },
  { path: 'documents', title: 'Documents', description: 'View organizational documents and submission statuses.', to: '/officer/documents' },
  { path: 'reports', title: 'Activity Reports', description: 'Review activity records and accomplishment reports.', to: '/officer/reports' },
  { path: 'settings', title: 'Organization Settings', description: 'Review organization preferences and account settings.', to: '/officer/settings' },
]

export const adviserPages = [
  { path: 'dashboard', title: 'Adviser Dashboard', description: 'An overview of organizations and items awaiting your review.', to: '/adviser/dashboard' },
  { path: 'organizations', title: 'My Organizations', description: 'View the student organizations assigned to you.', to: '/adviser/organizations' },
  { path: 'approvals', title: 'Approvals', description: 'Review proposals and reports submitted by assigned organizations.', to: '/adviser/approvals' },
  { path: 'events', title: 'Events', description: 'Review the schedule of activities for your organizations.', to: '/adviser/events' },
  { path: 'reports', title: 'Activity Reports', description: 'Review submitted accomplishment reports.', to: '/adviser/reports' },
]

export const adminPages = [
  { path: 'dashboard', title: 'Admin Dashboard', description: 'A campus-wide overview of organizations, students, and pending work.', to: '/admin/dashboard' },
  { path: 'users', title: 'Users', description: 'Review system user accounts and their access roles.', to: '/admin/users' },
  { path: 'students', title: 'Students', description: 'Review student directory records and account statuses.', to: '/admin/students' },
  { path: 'organizations', title: 'Organizations', description: 'Review accredited organizations and institutional standing.', to: '/admin/organizations' },
  { path: 'organization-applications', title: 'Organization Applications', description: 'Review organizations applying for accreditation.', to: '/admin/organization-applications' },
  { path: 'events', title: 'Campus Events', description: 'View and oversee events across the university.', to: '/admin/events' },
  { path: 'approvals', title: 'Approval Center', description: 'Review pending requests across system workflows.', to: '/admin/approvals' },
  { path: 'documents', title: 'Documents', description: 'Review organizational and event compliance documents.', to: '/admin/documents' },
  { path: 'reports', title: 'Reports', description: 'Review administrative summaries and organization reports.', to: '/admin/reports' },
  { path: 'analytics', title: 'Analytics', description: 'Explore high-level activity and participation summaries.', to: '/admin/analytics' },
  { path: 'audit-logs', title: 'Audit Logs', description: 'Review the history of important system actions.', to: '/admin/audit-logs' },
  { path: 'settings', title: 'System Settings', description: 'Review system configuration and role settings.', to: '/admin/settings' },
]

export const roleNavigation = {
  Student: { pages: studentPages.filter((page) => !page.path.includes(':')), home: '/student/dashboard', notifications: '/student/notifications', profile: '/student/profile' },
  'Organization Officer': { pages: officerPages.filter((page) => page.path !== 'events/create'), home: '/officer/dashboard', notifications: '/officer/announcements', profile: '/officer/organization' },
  'Organization Adviser': { pages: adviserPages, home: '/adviser/dashboard', notifications: '/adviser/approvals', profile: '/adviser/organizations' },
  'Student Affairs Admin': { pages: adminPages, home: '/admin/dashboard', notifications: '/admin/approvals', profile: '/admin/settings' },
}

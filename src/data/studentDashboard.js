export const studentDashboardSummary = {
  studentName: '',
  studentProgram: '',
  semesterLabel: '',
  organizationsJoined: 0,
  eventsRegistered: 0,
  attendanceCompleted: 0,
  certificatesEarned: 0,
}

export const studentDashboardMetrics = []

export const studentDashboardSchedule = []

export const studentDashboardOrganizations = []

export const studentDashboardEvents = []

export const studentDashboardAnnouncements = []

export const studentDashboardNotifications = []

export const studentDashboardActions = [
  {
    title: 'Browse Organizations',
    description: 'Explore accredited student organizations and apply for membership.',
    to: '/student/organizations',
  },
  {
    title: 'Explore Events',
    description: 'View published campus events and register online.',
    to: '/student/events',
  },
  {
    title: 'Open Event Pass',
    description: 'Present your student QR event pass for attendance check-in.',
    to: '/student/event-pass',
  },
  {
    title: 'Check Notifications',
    description: 'Review updates on membership applications, events, and announcements.',
    to: '/student/notifications',
  },
]

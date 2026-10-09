import { upcomingEvents } from './landingPage.js'

export const studentDashboardMetrics = [
  { label: 'My Organizations', value: '3', icon: 'organization', tone: 'crimson' },
  { label: 'Upcoming Events', value: '2', icon: 'calendar', tone: 'blue' },
  { label: 'Active Registrations', value: '2', icon: 'ticket', tone: 'gold' },
  { label: 'Attendance', value: '8', icon: 'check', tone: 'green' },
]

export const studentDashboardOrganizations = [
  { id: 'computer-society', name: 'WMSU Computer Society', initials: 'CS', role: 'Active Member', tone: 'blue' },
  { id: 'student-council', name: 'Supreme Student Council', initials: 'SSC', role: 'Committee Volunteer', tone: 'rose' },
  { id: 'computer-science-society', name: 'Computer Science Society', initials: 'CSS', role: 'Active Member', tone: 'sage' },
]

export const studentDashboardEvents = [
  upcomingEvents.find((event) => event.id === 'student-leadership-summit'),
  upcomingEvents.find((event) => event.id === 'campus-cultural-festival'),
].filter(Boolean)

export const studentDashboardNotifications = [
  {
    id: 'computer-society-approved',
    type: 'Membership',
    message: 'Your membership application to Computer Society was approved.',
    time: 'Today · 9:42 AM',
    unread: true,
    icon: 'organization',
  },
  {
    id: 'leadership-summit-confirmed',
    type: 'Registration',
    message: 'Student Leadership Summit registration is confirmed.',
    time: 'Yesterday · 3:18 PM',
    unread: true,
    icon: 'calendar',
  },
  {
    id: 'hackathon-approved',
    type: 'Event update',
    message: 'Event proposal “WMSU Hackathon 2026” has been approved.',
    time: 'October 1 · 11:05 AM',
    unread: false,
    icon: 'check',
  },
]

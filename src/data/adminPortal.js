import { adviserProfile } from './adviserPortal.js'
import { studentOrganizations } from './studentOrganizations.js'
import { officerOrganization } from './officerPortal.js'

export const initialAdminOrganizations = studentOrganizations.map((organization) => ({
  ...organization,
  announcements: (organization.announcements ?? []).map((announcement, index) => ({
    id: `${organization.id}-announcement-${index + 1}`,
    title: announcement.title,
    content: announcement.description || 'Official update shared with organization members.',
    postedBy: 'Santos, Maria',
    datePosted: announcement.date,
    lastUpdated: announcement.date,
    status: 'PUBLISHED',
  })),
  college: ['Technology', 'Academic'].includes(organization.category) ? 'College of Computing Studies' : 'College of Arts and Sciences',
  status: 'ACTIVE',
  accreditationStatus: 'ACCREDITED',
  memberCount: organization.id === officerOrganization.id ? officerOrganization.activeMembers : organization.activeMembers,
  suspensionReason: '',
}))

export const initialOrganizationApplications = [
  {
    id: 'application-junior-marketers-2026',
    organizationId: 'junior-marketers',
    name: 'Junior Marketers Association',
    acronym: 'JMA',
    category: 'Academic',
    mission: 'To develop creative, ethical marketing professionals through peer learning and practical campus projects.',
    vision: 'A recognized community of student marketers building meaningful connections between WMSU and local communities.',
    adviser: adviserProfile.name,
    adviserApproved: true,
    proposedOfficers: [
      { name: 'Rhea Mendoza', position: 'President' },
      { name: 'Mark Villanueva', position: 'Vice President' },
      { name: 'Faith Salazar', position: 'Secretary' },
    ],
    documents: ['JMA-Constitution-Bylaws.pdf', 'Proposed-Officer-Roster.pdf'],
    submittedBy: 'Rhea Mendoza',
    submittedDate: 'October 2, 2026',
    status: 'PENDING',
    description: 'Application for recognition as a student academic organization.',
  },
  {
    id: 'application-eco-advocates-2026',
    organizationId: 'eco-advocates',
    name: 'WMSU Eco Advocates',
    acronym: 'WEA',
    category: 'Socio-Civic',
    mission: 'To promote environmental stewardship and sustainable campus practices.',
    vision: 'A greener campus supported by student-led environmental action.',
    adviser: 'Dr. Marissa A. Villanueva',
    adviserApproved: false,
    proposedOfficers: [
      { name: 'Janine Mercado', position: 'President' },
      { name: 'Ibrahim Macaraeg', position: 'Secretary' },
    ],
    documents: ['WEA-Constitution.pdf', 'Campus-Greening-Plan.pdf'],
    submittedBy: 'Janine Mercado',
    submittedDate: 'October 1, 2026',
    status: 'PENDING',
    description: 'A new student organization application awaiting required adviser review.',
  },
]

export const initialAdminUsers = [
  { id: 'admin-root', firstName: 'John', middleName: '', lastName: 'Garcia', name: 'Garcia, John', userId: 'WMSU-ADMIN-0001', email: 'admin@unidos.test', role: 'Student Affairs Admin', status: 'ACTIVE', organization: 'Student Affairs Office', lastActivity: 'Today · 8:30 AM' },
  { id: 'adviser-ana-reyes', firstName: 'Ana', middleName: '', lastName: 'Reyes', name: 'Reyes, Ana', userId: 'WMSU-EMP-0314', email: 'adviser@unidos.test', role: 'Faculty Adviser', status: 'ACTIVE', organization: officerOrganization.name, lastActivity: 'Today · 9:10 AM' },
  { id: 'officer-maria-santos', firstName: 'Maria', middleName: '', lastName: 'Santos', name: 'Santos, Maria', userId: 'WMSU-OFFICER-0142', email: 'officer@unidos.test', role: 'Organization Officer', status: 'ACTIVE', organization: officerOrganization.name, lastActivity: 'Today · 10:15 AM' },
  { id: 'student-juan-dela-cruz', firstName: 'Juan', middleName: '', lastName: 'Dela Cruz', name: 'Dela Cruz, Juan', userId: 'WMSU-2026-0142', email: 'student@unidos.test', role: 'Student', status: 'ACTIVE', organization: 'Supreme Student Council', lastActivity: 'Yesterday · 4:20 PM', program: 'BSCS', yearLevel: '2nd Year' },
  { id: 'student-elena-cruz', firstName: 'Elena', middleName: '', lastName: 'Cruz', name: 'Cruz, Elena', userId: '2026-00123', email: 'elena.cruz@student.wmsu.edu.ph', role: 'Student', status: 'ACTIVE', organization: officerOrganization.name, lastActivity: 'Today · 9:42 AM', program: 'BSCS', yearLevel: '1st Year' },
  { id: 'student-john-flores', firstName: 'John', middleName: '', lastName: 'Flores', name: 'Flores, John', userId: '2026-00145', email: 'john.flores@student.wmsu.edu.ph', role: 'Student', status: 'ACTIVE', organization: officerOrganization.name, lastActivity: 'Yesterday · 2:05 PM', program: 'BSCS', yearLevel: '3rd Year' },
  { id: 'student-angela-reyes', firstName: 'Angela', middleName: '', lastName: 'Reyes', name: 'Reyes, Angela', userId: '2026-00178', email: 'angela.reyes@student.wmsu.edu.ph', role: 'Student', status: 'ACTIVE', organization: officerOrganization.name, lastActivity: 'September 30 · 1:30 PM', program: 'BSIT', yearLevel: '2nd Year' },
  { id: 'student-renzo-lim', firstName: 'Renzo', middleName: '', lastName: 'Lim', name: 'Lim, Renzo', userId: '2026-00252', email: 'renzo.lim@student.wmsu.edu.ph', role: 'Student', status: 'INACTIVE', organization: 'Computer Science Society', lastActivity: 'September 20 · 11:10 AM', program: 'BSCS', yearLevel: '4th Year' },
]

export const initialAdminAuditLogs = [
  { id: 'audit-seed-1', timestamp: 'October 3, 2026 · 9:10 AM', actor: adviserProfile.name, action: 'EVENT_ADVISER_APPROVED', entityType: 'EVENT', entityId: 'wcs-technology-workshop', description: 'Technology Innovation Workshop was approved by the adviser and awaits Student Affairs review.' },
  { id: 'audit-seed-2', timestamp: 'October 2, 2026 · 2:25 PM', actor: 'Santos, Maria', action: 'EVENT_SUBMITTED', entityType: 'EVENT', entityId: 'wcs-technology-workshop', description: 'Technology Innovation Workshop was submitted for adviser review.' },
  { id: 'audit-seed-3', timestamp: 'October 1, 2026 · 3:25 PM', actor: 'Santos, Maria', action: 'DOCUMENT_SUBMITTED', entityType: 'DOCUMENT', entityId: 'wcs-document-constitution', description: 'Updated Constitution & By-Laws document was submitted.' },
]

export const initialAdminNotifications = [
  { id: 'admin-notice-applications', message: 'New organization accreditation applications require review.', createdAt: 'Today · 9:10 AM', read: false },
]

export const initialAdminSettings = {
  academicYear: '2026–2027',
  semester: 'First Semester',
  organizationCategories: ['Academic', 'Socio-Civic', 'Cultural', 'Sports'],
  notifications: {
    newApplications: true,
    eventReviews: true,
    documentReviews: true,
    accomplishmentReports: true,
  },
}

export const adminPrograms = ['All Programs', 'BSCS', 'BSIT', 'BSBA', 'BSED', 'BSA', 'BSHM']
export const adminYears = ['All Years', '1st Year', '2nd Year', '3rd Year', '4th Year']

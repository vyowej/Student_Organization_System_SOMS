/**
 * Student Affairs Admin Portal Constants (`src/data/adminPortal.js`)
 *
 * All fake admin users, organizations, applications, audit logs, and analytics
 * datasets have been removed. Data is fetched live from the PostgreSQL database
 * via `/api/*`.
 */

export const adminDefaultSettings = {
  academicYear: '2025-2026',
  semester: 'Second Semester',
  allowOrganizationApplications: true,
  requireAdviserApproval: true,
  maintenanceMode: false,
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

export const adminPrograms = [
  'All Programs',
  'BS Computer Science',
  'BS Information Technology',
  'BS Nursing',
  'BS Civil Engineering',
  'BS Accountancy',
  'BS Psychology',
  'BS Biology',
  'BS Secondary Education',
]

export const adminYears = [
  'All Years',
  '1st Year',
  '2nd Year',
  '3rd Year',
  '4th Year',
  '5th Year',
]

export const adminRoleOptions = ['STUDENT', 'OFFICER', 'ADVISER', 'ADMIN']
export const adminStatusOptions = ['ACTIVE', 'INACTIVE', 'SUSPENDED']
export const adminAccreditationOptions = ['PENDING', 'ACCREDITED', 'RENEWAL_REQUIRED', 'SUSPENDED', 'REVOKED']
export const adminScopeOptions = ['UNIVERSITY', 'COLLEGE', 'DEPARTMENT']
export const adminCategoryOptions = [
  'ACADEMIC',
  'TECHNOLOGY',
  'LEADERSHIP',
  'STUDENT_COUNCIL',
  'SOCIO_CIVIC',
  'CULTURAL',
  'SPORTS_RECREATION',
  'SPORTS',
  'RELIGIOUS',
  'SPECIAL_INTEREST',
  'PUBLICATION',
  'OTHER',
]

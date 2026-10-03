export const mockAuthUsers = [
  {
    id: 'auth-student',
    firstName: 'Juan',
    middleName: '',
    lastName: 'Dela Cruz',
    email: 'student@unidos.test',
    password: 'student123',
    role: 'STUDENT',
    status: 'ACTIVE',
    studentId: 'WMSU-2026-0142',
    organizationId: null,
  },
  {
    id: 'auth-officer',
    firstName: 'Maria',
    middleName: '',
    lastName: 'Santos',
    email: 'officer@unidos.test',
    password: 'officer123',
    role: 'OFFICER',
    status: 'ACTIVE',
    studentId: 'WMSU-OFFICER-0142',
    organizationId: 'computer-society',
  },
  {
    id: 'auth-adviser',
    firstName: 'Ana',
    middleName: '',
    lastName: 'Reyes',
    email: 'adviser@unidos.test',
    password: 'adviser123',
    role: 'ADVISER',
    status: 'ACTIVE',
    organizationId: 'computer-society',
  },
  {
    id: 'auth-admin',
    firstName: 'John',
    middleName: '',
    lastName: 'Garcia',
    email: 'admin@unidos.test',
    password: 'admin123',
    role: 'ADMIN',
    status: 'ACTIVE',
  },
]

export const authSessionKey = 'unidos-auth-session'
export const registeredUsersKey = 'unidos-registered-mock-users'

export const dashboardByRole = {
  STUDENT: '/student/dashboard',
  OFFICER: '/officer/dashboard',
  ADVISER: '/adviser/dashboard',
  ADMIN: '/admin/dashboard',
}

export const layoutRoleByAuthRole = {
  STUDENT: 'Student',
  OFFICER: 'Organization Officer',
  ADVISER: 'Organization Adviser',
  ADMIN: 'Student Affairs Admin',
}

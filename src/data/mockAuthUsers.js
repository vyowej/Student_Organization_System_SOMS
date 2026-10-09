import { initialOfficerMembers } from './officerPortal.js'
import { studentOrganizations } from './studentOrganizations.js'

function getOrganizationRoles(studentId) {
  const assignments = initialOfficerMembers.filter((member) => (
    member.studentId === studentId
    && member.status === 'ACTIVE'
    && member.position !== 'General Member'
  ))
  return assignments.reduce((roles, member) => {
    const organization = studentOrganizations.find((item) => item.id === member.organizationId)
    if (!organization) return roles
    const existing = roles.find((role) => role.organizationId === member.organizationId)
    if (existing) existing.positions.push(member.position)
    else roles.push({
      organizationId: member.organizationId,
      organizationName: organization.name,
      positions: [member.position],
    })
    return roles
  }, [])
}

const studentOfficerRoles = getOrganizationRoles('WMSU-2026-0142')

export const mockAuthUsers = [
  {
    id: 'auth-student',
    firstName: 'Juan',
    middleName: '',
    lastName: 'Dela Cruz',
    email: 'student@wmsu.edu.ph',
    password: 'student123',
    role: 'STUDENT',
    roles: ['STUDENT', ...(studentOfficerRoles.length ? ['OFFICER'] : [])],
    organizationRoles: studentOfficerRoles,
    status: 'ACTIVE',
    studentId: 'WMSU-2026-0142',
    program: 'BSCS',
    yearLevel: '2nd Year',
  },
  {
    id: 'auth-adviser',
    firstName: 'Ana',
    middleName: '',
    lastName: 'Reyes',
    email: 'adviser@wmsu.edu.ph',
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
    email: 'admin@wmsu.edu.ph',
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

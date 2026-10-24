/**
 * Authentication Context Provider (`src/context/AuthContext.jsx`)
 *
 * Manages the active user session by authenticating directly against the
 * Express + PostgreSQL backend (`/api/users/login`, `/api/users/register`,
 * `/api/users/:id`). All mock user accounts and fake credentials have been removed.
 */
import { createContext, useCallback, useEffect, useMemo, useState } from 'react'

const AuthContext = createContext(null)

const SESSION_STORAGE_KEY = 'unidos-auth-user-id-v2'

function formatPositionLabel(position, customTitle) {
  if (customTitle) return customTitle
  const map = {
    PRESIDENT: 'President',
    VICE_PRESIDENT: 'Vice President',
    SECRETARY: 'Secretary',
    TREASURER: 'Treasurer',
    AUDITOR: 'Auditor',
    PUBLIC_RELATIONS_OFFICER: 'PIO',
    MEMBER: 'General Member',
    OTHER: 'Committee Head',
  }
  return map[position] || position || 'General Member'
}

function mapUserRow(row) {
  if (!row) return null
  const primaryRole = row.role || 'STUDENT'
  const memberships = Array.isArray(row.memberships) ? row.memberships : []
  const advisedOrganizations = Array.isArray(row.advised_organizations) ? row.advised_organizations : []
  const officerMemberships = memberships.filter(
    (m) => m.position && m.position !== 'MEMBER' && (!m.status || m.status === 'ACTIVE')
  )
  const roles = new Set([primaryRole])
  if (primaryRole === 'OFFICER' || row.student_id) roles.add('STUDENT')
  if (officerMemberships.length > 0) roles.add('OFFICER')

  const defaultOrgId =
    officerMemberships[0]?.organization_id ||
    memberships[0]?.organization_id ||
    advisedOrganizations[0]?.organization_id ||
    null

  const organizationRoles = officerMemberships.map((m) => ({
    organizationId: m.organization_id,
    organizationName: m.organization_name,
    acronym: m.acronym,
    position: formatPositionLabel(m.position, m.custom_title),
  }))

  return {
    id: row.user_id,
    userId: row.user_id,
    studentRecordId: row.student_id || null,
    adviserRecordId: row.adviser_id || null,
    studentId: row.student_number || row.employee_number || `USER-${row.user_id}`,
    firstName: row.first_name || '',
    middleName: row.middle_name || '',
    lastName: row.last_name || '',
    email: row.email || '',
    role: primaryRole,
    roles: Array.from(roles),
    status: row.status || 'ACTIVE',
    yearLevel: row.year_level ? `${row.year_level}${row.year_level === 1 ? 'st' : row.year_level === 2 ? 'nd' : row.year_level === 3 ? 'rd' : 'th'} Year` : '',
    yearLevelNumber: row.year_level || null,
    programId: row.program_id || null,
    program: row.program_name || '',
    programCode: row.program_code || '',
    departmentId: row.department_id || row.adviser_department_id || null,
    department: row.department_name || row.adviser_department_name || '',
    collegeId: row.college_id || row.adviser_college_id || null,
    college: row.college_name || '',
    organizationId: defaultOrgId,
    organizationRoles,
    memberships,
    advisedOrganizations,
  }
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)

  const refreshCurrentUser = useCallback(async (userIdToFetch) => {
    const targetId = userIdToFetch ?? currentUser?.userId
    if (!targetId) {
      setAuthLoading(false)
      return null
    }
    try {
      const response = await fetch(`/api/users/${targetId}`)
      if (!response.ok) {
        sessionStorage.removeItem(SESSION_STORAGE_KEY)
        setCurrentUser(null)
        setAuthLoading(false)
        return null
      }
      const data = await response.json()
      const mapped = mapUserRow(data)
      setCurrentUser((prev) => {
        if (!prev) return mapped
        return {
          ...mapped,
          role: mapped.roles.includes(prev.role) ? prev.role : mapped.role,
          organizationId: prev.organizationId ?? mapped.organizationId,
        }
      })
      setAuthLoading(false)
      return mapped
    } catch {
      setAuthLoading(false)
      return null
    }
  }, [currentUser?.userId])

  useEffect(() => {
    const savedId = sessionStorage.getItem(SESSION_STORAGE_KEY)
    if (savedId) {
      refreshCurrentUser(savedId)
    } else {
      setAuthLoading(false)
    }
  }, [refreshCurrentUser])

  const login = useCallback(async (identifier, password) => {
    try {
      const response = await fetch('/api/users/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, password }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        return {
          ok: false,
          error: payload.error || 'Invalid credentials or account not found.',
        }
      }
      const mapped = mapUserRow(payload)
      sessionStorage.setItem(SESSION_STORAGE_KEY, String(mapped.userId))
      setCurrentUser(mapped)
      return { ok: true, user: mapped }
    } catch {
      return {
        ok: false,
        error: 'Unable to reach the backend server. Please verify the API and PostgreSQL database are running.',
      }
    }
  }, [])

  const registerStudent = useCallback(async (registrationPayload) => {
    try {
      const response = await fetch('/api/users/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(registrationPayload),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        return {
          ok: false,
          error: payload.error || 'Unable to register student account.',
        }
      }
      const mapped = mapUserRow(payload)
      return { ok: true, user: mapped }
    } catch {
      return {
        ok: false,
        error: 'Unable to reach the backend server. Please verify the API and PostgreSQL database are running.',
      }
    }
  }, [])

  const logout = useCallback(() => {
    sessionStorage.removeItem(SESSION_STORAGE_KEY)
    setCurrentUser(null)
  }, [])

  const setActiveRole = useCallback((nextRole, organizationId) => {
    let switched = false
    setCurrentUser((prev) => {
      if (!prev) return prev
      const allowed = prev.roles || [prev.role]
      if (!allowed.includes(nextRole)) return prev
      switched = true
      return {
        ...prev,
        role: nextRole,
        organizationId: organizationId !== undefined ? organizationId : prev.organizationId,
      }
    })
    return switched || Boolean(currentUser)
  }, [currentUser])

  const value = useMemo(() => ({
    currentUser,
    authLoading,
    login,
    logout,
    registerStudent,
    refreshCurrentUser,
    switchRole: setActiveRole,
    setActiveRole,
  }), [currentUser, authLoading, login, logout, registerStudent, refreshCurrentUser, setActiveRole])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export default AuthContext

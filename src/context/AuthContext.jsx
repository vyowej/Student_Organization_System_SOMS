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
    PUBLIC_INFORMATION_OFFICER: 'PIO',
    PRO: 'PIO',
    PIO: 'PIO',
    MEMBER: 'General Member',
    OTHER: 'Committee Head',
    OTHER_OFFICER: 'Committee Head',
  }
  const posUpper = String(position || '').toUpperCase().replace(/[\s.-]+/g, '_')
  return map[position] || map[posUpper] || position || 'General Member'
}

function mapUserRow(row) {
  if (!row) return null
  const primaryRole = row.role || 'STUDENT'
  const memberships = Array.isArray(row.memberships) ? row.memberships : []
  const advisedOrganizations = Array.isArray(row.advised_organizations)
    ? row.advised_organizations
    : Array.isArray(row.advisedOrganizations)
      ? row.advisedOrganizations
      : []

  const activeMemberships = memberships.filter(
    (m) => !m.status || m.status === 'ACTIVE'
  )
  const rawRoles = Array.isArray(row.roles) ? row.roles : [primaryRole]
  const roles = new Set(rawRoles)

  const defaultOrgId =
    row.organizationId ||
    activeMemberships[0]?.organization_id ||
    activeMemberships[0]?.organizationId ||
    memberships[0]?.organization_id ||
    memberships[0]?.organizationId ||
    advisedOrganizations[0]?.organization_id ||
    advisedOrganizations[0]?.organizationId ||
    null

  const hasActiveOrg =
    activeMemberships.length > 0 ||
    (Array.isArray(row.organizationRoles) && row.organizationRoles.length > 0) ||
    Boolean(defaultOrgId)

  // Every student organization officer or student account has the STUDENT capability
  if (primaryRole === 'OFFICER' || row.role === 'OFFICER' || row.student_id || row.studentDbId || row.studentRecordId || row.student_number || row.studentNumber) {
    roles.add('STUDENT')
  }

  if (primaryRole === 'OFFICER' || row.role === 'OFFICER' || hasActiveOrg) {
    roles.add('STUDENT')
    roles.add('OFFICER')
  } else if (primaryRole !== 'OFFICER' && row.role !== 'OFFICER') {
    roles.delete('OFFICER')
  }

  // An officer account without an active organization workspace can enter the student portal,
  // but not the organization portal. Their active working role is STUDENT until an organization is active.
  const resolvedRole = (hasActiveOrg && (primaryRole === 'OFFICER' || row.role === 'OFFICER') && primaryRole !== 'ADMIN' && primaryRole !== 'ADVISER')
    ? 'OFFICER'
    : ((primaryRole === 'OFFICER' || row.role === 'OFFICER') && !hasActiveOrg)
      ? 'STUDENT'
      : (row.role === 'STUDENT' || primaryRole === 'STUDENT')
        ? 'STUDENT'
        : primaryRole

  const organizationRoles = Array.isArray(row.organizationRoles) && row.organizationRoles.length > 0
    ? row.organizationRoles
    : activeMemberships.map((m) => ({
        organizationId: m.organization_id || m.organizationId,
        organizationName: m.organization_name || m.organizationName,
        acronym: m.acronym || m.organizationAcronym,
        position: formatPositionLabel(m.position, m.custom_title || m.customTitle),
      }))

  const resolvedDbId = row.user_id ?? row.id ?? row.userId
  const resolvedStudentNumber =
    row.studentId ||
    row.student_number ||
    row.studentNumber ||
    row.employeeNumber ||
    row.employee_number ||
    (resolvedDbId ? `USER-${resolvedDbId}` : 'USER')

  return {
    id: resolvedDbId,
    userId: resolvedDbId,
    dbUserId: row.id ?? row.user_id,
    studentRecordId: row.studentRecordId ?? row.studentDbId ?? row.student_db_id ?? row.student_id ?? null,
    studentDbId: row.studentDbId ?? row.student_db_id ?? row.student_id ?? null,
    adviserRecordId: row.adviserRecordId ?? row.adviserDbId ?? row.adviser_db_id ?? row.adviser_id ?? null,
    adviserDbId: row.adviserDbId ?? row.adviser_db_id ?? row.adviser_id ?? null,
    studentId: resolvedStudentNumber,
    studentNumber: resolvedStudentNumber,
    firstName: row.firstName || row.first_name || '',
    middleName: row.middleName || row.middle_name || '',
    lastName: row.lastName || row.last_name || '',
    suffix: row.suffix || '',
    name: row.name || row.displayName || `${row.lastName || row.last_name || ''}, ${row.firstName || row.first_name || ''}${row.middleName || row.middle_name ? ` ${row.middleName || row.middle_name}` : ''}${row.suffix ? ` ${row.suffix}` : ''}`.replace(/^,\s*/, ''),
    displayName: row.displayName || `${row.lastName || row.last_name || ''}, ${row.firstName || row.first_name || ''}${row.middleName || row.middle_name ? ` ${row.middleName || row.middle_name}` : ''}${row.suffix ? ` ${row.suffix}` : ''}`.replace(/^,\s*/, ''),
    email: row.email || '',
    role: resolvedRole,
    roles: Array.from(roles),
    status: row.status || 'ACTIVE',
    yearLevel: row.yearLevel || (row.year_level ? `${row.year_level}${row.year_level === 1 ? 'st' : row.year_level === 2 ? 'nd' : row.year_level === 3 ? 'rd' : 'th'} Year` : ''),
    yearLevelNumber: row.yearLevelNumber || row.year_level || null,
    programId: row.programId || row.program_id || null,
    program: row.program || row.program_name || row.program_acronym || '',
    programCode: row.programCode || row.program_code || '',
    departmentId: row.departmentId || row.department_id || null,
    department: row.department || row.department_name || '',
    collegeId: row.collegeId || row.college_id || null,
    college: row.college || row.college_name || '',
    organizationId: defaultOrgId,
    organizationName: row.organizationName || null,
    organizationRoles,
    memberships,
    advisedOrganizations,
  }
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)

  const refreshCurrentUser = useCallback(async (userIdToFetch) => {
    const targetId = userIdToFetch ?? currentUser?.id ?? currentUser?.userId
    if (!targetId || targetId === 'undefined' || targetId === 'null') {
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
  }, [currentUser?.id, currentUser?.userId])

  useEffect(() => {
    const savedId = sessionStorage.getItem(SESSION_STORAGE_KEY)
    if (savedId && savedId !== 'undefined' && savedId !== 'null') {
      refreshCurrentUser(savedId)
    } else {
      setAuthLoading(false)
    }
  }, [refreshCurrentUser])

  const login = useCallback(async (identifier, password) => {
    try {
      const trimmed = String(identifier || '').trim()
      const response = await fetch('/api/users/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier: trimmed,
          email: trimmed,
          password,
        }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        return {
          ok: false,
          error: payload.error || 'Invalid credentials or account not found.',
        }
      }
      const mapped = mapUserRow(payload)
      if (mapped?.id) {
        sessionStorage.setItem(SESSION_STORAGE_KEY, String(mapped.id))
      }
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
      if (mapped?.id) {
        sessionStorage.setItem(SESSION_STORAGE_KEY, String(mapped.id))
      }
      setCurrentUser(mapped)
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
    if (!currentUser) return false
    const allowed = currentUser.roles || [currentUser.role]
    if (!allowed.includes(nextRole)) return false
    if (nextRole === 'OFFICER') {
      const targetOrg = organizationId || currentUser.organizationId || currentUser.organizationRoles?.[0]?.organizationId
      if (!targetOrg) return false
      setCurrentUser((prev) => {
        if (!prev) return prev
        return {
          ...prev,
          role: 'OFFICER',
          organizationId: targetOrg,
        }
      })
      return true
    }
    setCurrentUser((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        role: nextRole,
        organizationId: organizationId !== undefined ? organizationId : prev.organizationId,
      }
    })
    return true
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

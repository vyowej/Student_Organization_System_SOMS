import { createContext, useCallback, useEffect, useMemo, useState } from 'react'
import { authSessionKey, mockAuthUsers, registeredUsersKey } from '../data/mockAuthUsers.js'
import { formatDisplayName } from '../data/displayName.js'

const AuthContext = createContext(null)

// Frontend mock authentication only; implement real authentication and authorization on the backend before deployment.
function addNameParts(user) {
  if (user.lastName && user.firstName) return user
  const fullName = (user.name ?? user.displayName ?? '').trim()
  if (fullName.includes(',')) {
    const [lastName, ...givenParts] = fullName.split(',')
    const [firstName = '', ...middleName] = givenParts.join(' ').trim().split(/\s+/).filter(Boolean)
    return { ...user, lastName: lastName.trim(), firstName, middleName: middleName.join(' ') }
  }
  const words = fullName.split(/\s+/).filter(Boolean)
  if (words.length < 2) return { ...user, firstName: words[0] ?? '', middleName: '', lastName: '' }
  return {
    ...user,
    firstName: words[0],
    middleName: words.slice(1, -1).join(' '),
    lastName: words.at(-1),
  }
}

function safeUser(user) {
  const { password: _password, ...publicUser } = user
  const displayName = formatDisplayName(publicUser)
  return { ...publicUser, displayName, name: displayName }
}

function readRegisteredUsers() {
  try {
    const users = JSON.parse(window.localStorage.getItem(registeredUsersKey) ?? '[]')
    return Array.isArray(users) ? users.map(addNameParts) : []
  } catch (error) {
    console.error('Unable to restore local UNIDOS mock accounts.', error)
    window.localStorage.removeItem(registeredUsersKey)
    return []
  }
}

function readStoredSession() {
  const stored = window.localStorage.getItem(authSessionKey)
    ?? window.sessionStorage.getItem(authSessionKey)
  if (!stored) return null
  try {
    const parsed = JSON.parse(stored)
    if (!parsed || typeof parsed.id !== 'string' || !['STUDENT', 'OFFICER', 'ADVISER', 'ADMIN'].includes(parsed.role)) return null
    const mockUser = mockAuthUsers.find((user) => user.id === parsed.id || user.email === parsed.email)
    const normalizedUser = mockUser
      ? {
          ...parsed,
          ...mockUser,
          role: parsed.role,
          status: parsed.status ?? mockUser.status,
          organizationId: parsed.organizationId ?? mockUser.organizationId,
        }
      : addNameParts(parsed)
    return safeUser(normalizedUser)
  } catch (error) {
    console.error('Unable to restore the UNIDOS mock authentication session.', error)
    window.localStorage.removeItem(authSessionKey)
    window.sessionStorage.removeItem(authSessionKey)
    return null
  }
}

export function AuthProvider({ children }) {
  const [registeredUsers, setRegisteredUsers] = useState(readRegisteredUsers)
  const [accessOverrides, setAccessOverrides] = useState(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem('unidos-auth-access-overrides') ?? '{}')
      return saved && typeof saved === 'object' && !Array.isArray(saved) ? saved : {}
    } catch (error) {
      console.error('Unable to restore UNIDOS mock account access settings.', error)
      window.localStorage.removeItem('unidos-auth-access-overrides')
      return {}
    }
  })
  const [currentUser, setCurrentUser] = useState(readStoredSession)

  useEffect(() => {
    window.localStorage.setItem(registeredUsersKey, JSON.stringify(registeredUsers))
  }, [registeredUsers])

  useEffect(() => {
    window.localStorage.setItem('unidos-auth-access-overrides', JSON.stringify(accessOverrides))
  }, [accessOverrides])

  const login = useCallback((identifier, password, rememberMe = false) => {
    const normalizedIdentifier = identifier.trim().toLowerCase()
    const sourceUser = [...mockAuthUsers, ...registeredUsers].find((candidate) => (
      candidate.email.toLowerCase() === normalizedIdentifier
      || candidate.studentId?.toLowerCase() === normalizedIdentifier
    ))
    if (!sourceUser) return { ok: false, error: 'No account was found for that email or student ID.' }
    const user = { ...sourceUser, ...accessOverrides[sourceUser.email.toLowerCase()] }
    if (user.status === 'INACTIVE') return { ok: false, error: 'This account is inactive. Contact Student Affairs for help.' }
    if (user.status === 'SUSPENDED') return { ok: false, error: 'This account is suspended. Contact Student Affairs for help.' }
    if (user.status !== 'ACTIVE') return { ok: false, error: 'This account is not available for sign in.' }
    if (user.password !== password) return { ok: false, error: 'The password is incorrect.' }

    const sessionUser = safeUser(addNameParts(user))
    window.localStorage.removeItem(authSessionKey)
    window.sessionStorage.removeItem(authSessionKey)
    const storage = rememberMe ? window.localStorage : window.sessionStorage
    storage.setItem(authSessionKey, JSON.stringify(sessionUser))
    setCurrentUser(sessionUser)
    return { ok: true, user: sessionUser }
  }, [accessOverrides, registeredUsers])

  const logout = useCallback(() => {
    window.localStorage.removeItem(authSessionKey)
    window.sessionStorage.removeItem(authSessionKey)
    setCurrentUser(null)
  }, [])

  const registerStudent = useCallback((student) => {
    const email = student.email.trim().toLowerCase()
    const studentId = student.studentId.trim().toLowerCase()
    const exists = [...mockAuthUsers, ...registeredUsers].some((user) => (
      user.email.toLowerCase() === email || user.studentId?.toLowerCase() === studentId
    ))
    if (exists) return { ok: false, error: 'An account with this email or student ID already exists.' }
    const newUser = {
      id: `registered-${Date.now()}`,
      lastName: student.lastName.trim(),
      firstName: student.firstName.trim(),
      middleName: student.middleName.trim(),
      email,
      studentId: student.studentId.trim(),
      password: student.password,
      program: student.program,
      yearLevel: student.yearLevel,
      role: 'STUDENT',
      status: 'ACTIVE',
      organizationId: null,
    }
    setRegisteredUsers((users) => [...users, newUser])
    return { ok: true, user: safeUser(newUser) }
  }, [registeredUsers])

  const updateMockUserAccess = useCallback((email, changes) => {
    const normalizedEmail = email.trim().toLowerCase()
    const validRoles = ['STUDENT', 'OFFICER', 'ADVISER', 'ADMIN']
    const validStatuses = ['ACTIVE', 'INACTIVE', 'SUSPENDED']
    const role = changes.role
    const status = changes.status
    if ((role !== undefined && !validRoles.includes(role))
      || (status !== undefined && !validStatuses.includes(status))) return false
    if (![...mockAuthUsers, ...registeredUsers].some((user) => user.email.toLowerCase() === normalizedEmail)) return true
    setAccessOverrides((overrides) => ({
      ...overrides,
      [normalizedEmail]: {
        ...overrides[normalizedEmail],
        ...(role ? { role, ...(['OFFICER', 'ADVISER'].includes(role) ? { organizationId: 'computer-society' } : {}) } : {}),
        ...(status ? { status } : {}),
      },
    }))
    return true
  }, [registeredUsers])

  const value = useMemo(() => ({
    currentUser,
    isAuthenticated: Boolean(currentUser),
    role: currentUser?.role ?? null,
    login,
    logout,
    registerStudent,
    updateMockUserAccess,
  }), [currentUser, login, logout, registerStudent, updateMockUserAccess])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export default AuthContext

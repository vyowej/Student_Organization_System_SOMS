import { useEffect, useState } from 'react'
import { initialStudentMemberships, studentOrganizations } from '../data/studentOrganizations.js'
import {
  initialOfficerEvents,
  initialOfficerMembers,
  initialOfficerMembershipRequests,
  officerOrganization,
} from '../data/officerPortal.js'
import { initialAdviserActivity, initialAdviserDocuments, initialAdviserReports } from '../data/adviserPortal.js'
import {
  initialAdminAuditLogs,
  initialAdminNotifications,
  initialAdminOrganizations,
  initialAdminSettings,
  initialAdminUsers,
  initialOrganizationApplications,
} from '../data/adminPortal.js'
import PortalDataContext from './PortalData.js'
import { useAuth } from './useAuth.js'
import { formatDisplayName } from '../data/displayName.js'

const exclusiveOfficerPositions = ['President', 'Vice President', 'Secretary', 'Treasurer', 'Auditor', 'PIO']
const officerStudentId = 'WMSU-OFFICER-0142'
const membershipSessionKey = 'unidos-membership-state'

function normalizeLegacyDemoNames(value, parentKey = '') {
  if (Array.isArray(value)) return value.map((item) => normalizeLegacyDemoNames(item, parentKey))
  if (!value || typeof value !== 'object') return value

  const normalized = Object.fromEntries(Object.entries(value).map(([key, item]) => [key, normalizeLegacyDemoNames(item, key)]))
  const email = typeof value.email === 'string' ? value.email.toLowerCase() : ''
  const id = typeof value.id === 'string' ? value.id : ''
  const userId = typeof value.userId === 'string' ? value.userId : ''
  const studentId = typeof value.studentId === 'string' ? value.studentId : ''
  const demoPerson = email === 'student@unidos.test' || userId === 'WMSU-2026-0142'
    ? { firstName: 'Juan', middleName: '', lastName: 'Dela Cruz', name: 'Dela Cruz, Juan', displayName: 'Dela Cruz, Juan', email: 'student@unidos.test' }
    : email === 'officer@unidos.test' || userId === 'WMSU-OFFICER-0142' || studentId === officerStudentId || id === 'wcs-member-president'
      ? { firstName: 'Maria', middleName: '', lastName: 'Santos', name: 'Santos, Maria', displayName: 'Santos, Maria', studentName: 'Santos, Maria', email: email === 'officer@unidos.test' || userId === 'WMSU-OFFICER-0142' ? 'officer@unidos.test' : 'maria.santos@wmsu.edu.ph' }
      : studentId === '2026-00123' || userId === '2026-00123'
        ? { firstName: 'Elena', middleName: '', lastName: 'Cruz', name: 'Cruz, Elena', displayName: 'Cruz, Elena', studentName: 'Cruz, Elena', email: 'elena.cruz@student.wmsu.edu.ph' }
      : email === 'adviser@unidos.test' || userId === 'WMSU-EMP-0314'
        ? { firstName: 'Ana', middleName: '', lastName: 'Reyes', name: 'Reyes, Ana', displayName: 'Reyes, Ana', email: 'adviser@unidos.test' }
        : email === 'admin@unidos.test' || userId === 'WMSU-ADMIN-0001' || id === 'admin-root'
          ? { firstName: 'John', middleName: '', lastName: 'Garcia', name: 'Garcia, John', displayName: 'Garcia, John', email: 'admin@unidos.test' }
          : null
  const submittedByOfficer = ['officerEvents', 'adviserDocuments', 'adviserReports'].includes(parentKey)
  const legacyAuditActor = parentKey === 'adminAuditLogs' && ['audit-seed-2', 'audit-seed-3'].includes(id)
  return {
    ...normalized,
    ...(demoPerson ?? {}),
    ...(id === 'computer-society' ? {
      adviser: 'Reyes, Ana',
      announcements: (value.announcements ?? []).map((announcement, index) => ({
        ...announcement,
        id: announcement.id ?? `computer-society-announcement-${index + 1}`,
        content: announcement.content ?? announcement.description ?? 'Official update shared with organization members.',
        postedBy: announcement.postedBy ?? 'Santos, Maria',
        datePosted: announcement.datePosted ?? announcement.date ?? currentDate(),
        lastUpdated: announcement.lastUpdated ?? announcement.datePosted ?? announcement.date ?? currentDate(),
        status: announcement.status ?? 'PUBLISHED',
      })),
    } : {}),
    ...(submittedByOfficer && 'submittedBy' in value ? { submittedBy: 'Santos, Maria' } : {}),
    ...(legacyAuditActor || ['DOCUMENT_SUBMITTED', 'ORGANIZATION_PROFILE_UPDATED'].includes(value.action) ? { actor: 'Santos, Maria' } : {}),
    ...(parentKey === 'adviserDocuments' && value.processedBy ? { processedBy: 'Reyes, Ana' } : {}),
  }
}

function readMembershipSession() {
  const savedState = window.sessionStorage.getItem(membershipSessionKey)
  if (!savedState) return null

  try {
    const parsedState = JSON.parse(savedState)
    if (
      !Array.isArray(parsedState.studentMemberships)
      || !Array.isArray(parsedState.officerMembershipRequests)
      || !Array.isArray(parsedState.officerMembers)
      || !Number.isFinite(parsedState.officerMemberCount)
      || (parsedState.officerEvents !== undefined && !Array.isArray(parsedState.officerEvents))
      || (parsedState.adviserDocuments !== undefined && !Array.isArray(parsedState.adviserDocuments))
      || (parsedState.adviserReports !== undefined && !Array.isArray(parsedState.adviserReports))
      || (parsedState.adviserActivity !== undefined && !Array.isArray(parsedState.adviserActivity))
      || (parsedState.officerNotifications !== undefined && !Array.isArray(parsedState.officerNotifications))
      || (parsedState.adminOrganizations !== undefined && !Array.isArray(parsedState.adminOrganizations))
      || (parsedState.organizationApplications !== undefined && !Array.isArray(parsedState.organizationApplications))
      || (parsedState.adminUsers !== undefined && !Array.isArray(parsedState.adminUsers))
      || (parsedState.adminAuditLogs !== undefined && !Array.isArray(parsedState.adminAuditLogs))
      || (parsedState.adminNotifications !== undefined && !Array.isArray(parsedState.adminNotifications))
      || (parsedState.studentNotifications !== undefined && !Array.isArray(parsedState.studentNotifications))
      || (parsedState.adminSettings !== undefined && (typeof parsedState.adminSettings !== 'object' || parsedState.adminSettings === null))
      || (parsedState.organizationChangeRequests !== undefined && !Array.isArray(parsedState.organizationChangeRequests))
    ) {
      throw new Error('Saved membership state has an invalid structure.')
    }
    return normalizeLegacyDemoNames(parsedState)
  } catch (error) {
    console.error('Unable to restore UNIDOS membership session state.', error)
    window.sessionStorage.removeItem(membershipSessionKey)
    return null
  }
}

function currentDate() {
  return new Intl.DateTimeFormat('en-US', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date())
}

function currentDateTime() {
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date())
}

export function PortalDataProvider({ children }) {
  const { currentUser, updateMockUserAccess } = useAuth()
  const [initialMembershipState] = useState(readMembershipSession)
  const [studentMemberships, setStudentMemberships] = useState(initialMembershipState?.studentMemberships ?? initialStudentMemberships)
  const [officerMembershipRequests, setOfficerMembershipRequests] = useState(initialMembershipState?.officerMembershipRequests ?? initialOfficerMembershipRequests)
  const [officerMembers, setOfficerMembers] = useState(initialMembershipState?.officerMembers ?? initialOfficerMembers)
  const [officerMemberCount, setOfficerMemberCount] = useState(initialMembershipState?.officerMemberCount ?? officerOrganization.activeMembers)
  const [officerEvents, setOfficerEvents] = useState(initialMembershipState?.officerEvents ?? initialOfficerEvents)
  const [adviserDocuments, setAdviserDocuments] = useState(initialMembershipState?.adviserDocuments ?? initialAdviserDocuments)
  const [adviserReports, setAdviserReports] = useState(initialMembershipState?.adviserReports ?? initialAdviserReports)
  const [adviserActivity, setAdviserActivity] = useState(initialMembershipState?.adviserActivity ?? initialAdviserActivity)
  const [officerNotifications, setOfficerNotifications] = useState(initialMembershipState?.officerNotifications ?? [])
  const [adminOrganizations, setAdminOrganizations] = useState(initialMembershipState?.adminOrganizations ?? initialAdminOrganizations)
  const [organizationChangeRequests, setOrganizationChangeRequests] = useState(initialMembershipState?.organizationChangeRequests ?? [])
  const [organizationApplications, setOrganizationApplications] = useState(initialMembershipState?.organizationApplications ?? initialOrganizationApplications)
  const [adminUsers, setAdminUsers] = useState(initialMembershipState?.adminUsers ?? initialAdminUsers)
  const [adminAuditLogs, setAdminAuditLogs] = useState(initialMembershipState?.adminAuditLogs ?? initialAdminAuditLogs)
  const [adminSettings, setAdminSettings] = useState(initialMembershipState?.adminSettings ?? initialAdminSettings)
  const [studentNotifications, setStudentNotifications] = useState(initialMembershipState?.studentNotifications ?? [])
  const [adminNotifications, setAdminNotifications] = useState(initialMembershipState?.adminNotifications ?? initialAdminNotifications)

  useEffect(() => {
    window.sessionStorage.setItem(membershipSessionKey, JSON.stringify({
      studentMemberships,
      officerMembershipRequests,
      officerMembers,
      officerMemberCount,
      officerEvents,
      adviserDocuments,
      adviserReports,
      adviserActivity,
      officerNotifications,
      adminOrganizations,
      organizationChangeRequests,
      organizationApplications,
      adminUsers,
      adminAuditLogs,
      adminSettings,
      studentNotifications,
      adminNotifications,
    }))
  }, [studentMemberships, officerMembershipRequests, officerMembers, officerMemberCount, officerEvents, adviserDocuments, adviserReports, adviserActivity, officerNotifications, adminOrganizations, organizationChangeRequests, organizationApplications, adminUsers, adminAuditLogs, adminSettings, studentNotifications, adminNotifications])

  function appendAudit(action, entityType, entityId, description) {
    const timestamp = new Intl.DateTimeFormat('en-US', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date())
    setAdminAuditLogs((logs) => [{
      id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      timestamp,
      actor: formatDisplayName(currentUser) || 'Garcia, John',
      action,
      entityType,
      entityId,
      description,
    }, ...logs])
  }

  function addStudentNotification(message) {
    const createdAt = new Intl.DateTimeFormat('en-US', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date())
    setStudentNotifications((notifications) => [
      { id: `student-notification-${Date.now()}`, message, createdAt, read: false },
      ...notifications,
    ])
  }

  function markStudentNotificationRead(id) {
    setStudentNotifications((notifications) => notifications.map((notification) => (
      notification.id === id ? { ...notification, read: true } : notification
    )))
  }

  function markAdminNotificationRead(id) {
    setAdminNotifications((notifications) => notifications.map((notification) => (
      notification.id === id ? { ...notification, read: true } : notification
    )))
  }

  function addAdminNotification(message) {
    const createdAt = new Intl.DateTimeFormat('en-US', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date())
    setAdminNotifications((notifications) => [
      { id: `admin-notification-${Date.now()}`, message, createdAt, read: false },
      ...notifications,
    ])
  }

  function addOfficerNotification(message) {
    const createdAt = new Intl.DateTimeFormat('en-US', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date())
    setOfficerNotifications((notifications) => [
      { id: `officer-notification-${Date.now()}`, message, createdAt, read: false },
      ...notifications,
    ])
  }

  function addAdviserActivity(message) {
    const time = new Intl.DateTimeFormat('en-US', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date())
    setAdviserActivity((activity) => [{ id: `adviser-activity-${Date.now()}`, message, time }, ...activity])
  }

  function saveOfficerEvent(event, status) {
    if (currentUser?.role !== 'OFFICER' || currentUser.organizationId !== officerOrganization.id) return false
    const proposal = {
      ...event,
      id: event.id ?? `wcs-event-${Date.now()}`,
      organizationId: officerOrganization.id,
      organizationName: officerOrganization.name,
      submittedBy: formatDisplayName(currentUser) || 'Organization Officer',
      submittedDate: currentDate(),
      status,
      revisionNote: '',
      adviser: null,
      adviserDecisionDate: null,
    }
    setOfficerEvents((events) => {
      const exists = events.some((item) => item.id === proposal.id)
      return exists
        ? events.map((item) => item.id === proposal.id ? proposal : item)
        : [proposal, ...events]
    })
    if (status === 'SUBMITTED') addAdviserActivity(`${proposal.title} event proposal was submitted for adviser review.`)
  }

  function reviewAdviserRequest(type, id, decision, comment = '') {
    if (currentUser?.role !== 'ADVISER' || currentUser.organizationId !== officerOrganization.id) return false
    const revisionNote = comment.trim()
    if (!['APPROVED', 'RETURNED', 'REJECTED'].includes(decision)) return false
    if ((decision === 'RETURNED' || decision === 'REJECTED') && !revisionNote) return false

    const decisionDate = currentDate()
    if (type === 'EVENT') {
      const event = officerEvents.find((item) => item.id === id && item.organizationId === officerOrganization.id)
      if (!event || !['SUBMITTED', 'UNDER_REVIEW'].includes(event.status)) return false
      const eventStatus = decision === 'RETURNED'
        ? 'RETURNED_FOR_REVISION'
        : decision
      setOfficerEvents((events) => events.map((item) => item.id === id
        ? { ...item, status: eventStatus, revisionNote: decision === 'APPROVED' ? '' : revisionNote, adviser: adminOrganizations.find((organization) => organization.id === item.organizationId)?.adviser ?? officerOrganization.adviser, adviserDecisionDate: decisionDate }
        : item))
      addAdviserActivity(`${event.title} proposal was ${decision.toLowerCase()} by the adviser.`)
      addOfficerNotification(decision === 'APPROVED'
        ? `Your event proposal "${event.title}" was approved by your adviser and is awaiting Student Affairs review.`
        : decision === 'RETURNED'
          ? `Your event proposal "${event.title}" was returned for revision: ${revisionNote}`
          : `Your event proposal "${event.title}" was rejected: ${revisionNote}`)
      if (decision === 'APPROVED') addAdminNotification(`New event proposal "${event.title}" requires final approval.`)
      return true
    }

    if (type === 'DOCUMENT') {
      const document = adviserDocuments.find((item) => item.id === id && item.organizationId === officerOrganization.id)
      if (!document || document.status !== 'PENDING') return false
      setAdviserDocuments((documents) => documents.map((item) => item.id === id
        ? { ...item, status: decision, decisionDate, decisionReason: decision === 'APPROVED' ? '' : revisionNote, processedBy: formatDisplayName(currentUser) }
        : item))
      addAdviserActivity(`${document.title} was ${decision.toLowerCase()} by the adviser.`)
      addOfficerNotification(decision === 'APPROVED'
        ? `Your document "${document.title}" was approved by your adviser.`
        : `Your document "${document.title}" was ${decision.toLowerCase()}: ${revisionNote}`)
      if (decision === 'APPROVED' && document.adminReviewRequired) addAdminNotification(`Document "${document.title}" requires Student Affairs review.`)
      return true
    }

    return false
  }

  function reviewAccomplishmentReport(id, decision, comment = '') {
    if (currentUser?.role !== 'ADVISER' || currentUser.organizationId !== officerOrganization.id) return false
    const revisionNote = comment.trim()
    if (!['VERIFIED', 'RETURNED'].includes(decision) || (decision === 'RETURNED' && !revisionNote)) return false
    const report = adviserReports.find((item) => item.id === id && item.organizationId === officerOrganization.id)
    if (!report || !['PENDING_VERIFICATION', 'RETURNED'].includes(report.status)) return false
    const decisionDate = currentDate()
    setAdviserReports((reports) => reports.map((item) => item.id === id
      ? {
        ...item,
        status: decision,
        decisionDate,
        revisionNote: decision === 'RETURNED' ? revisionNote : '',
        verifiedBy: decision === 'VERIFIED' ? formatDisplayName(currentUser) : null,
      }
      : item))
    addAdviserActivity(`${report.eventTitle} accomplishment report was ${decision.toLowerCase()}.`)
    addOfficerNotification(decision === 'VERIFIED'
      ? `Your accomplishment report for "${report.eventTitle}" was verified by your adviser.`
      : `Your accomplishment report for "${report.eventTitle}" was returned for revision: ${revisionNote}`)
    return true
  }

  function updateAdminOrganizationStatus(id, status, reason = '') {
    if (currentUser?.role !== 'ADMIN') return false
    if (!['ACTIVE', 'INACTIVE', 'SUSPENDED'].includes(status)) return false
    const organization = adminOrganizations.find((item) => item.id === id)
    if (!organization || organization.status === status) return false
    if (status === 'SUSPENDED' && !reason.trim()) return false
    setAdminOrganizations((organizations) => organizations.map((item) => item.id === id
      ? { ...item, status, suspensionReason: status === 'SUSPENDED' ? reason.trim() : '' }
      : item))
    appendAudit(status === 'SUSPENDED' ? 'ORGANIZATION_SUSPENDED' : 'ORGANIZATION_REACTIVATED', 'ORGANIZATION', id, status === 'SUSPENDED'
      ? `${organization.name} was suspended. Reason: ${reason.trim()}`
      : `${organization.name} was reactivated.`)
    addOfficerNotification(`${organization.name} organization status changed to ${status}${status === 'SUSPENDED' ? `: ${reason.trim()}` : ''}.`)
    return true
  }

  function updateAdminOrganization(id, changes) {
    if (currentUser?.role !== 'ADMIN') return false
    const organization = adminOrganizations.find((item) => item.id === id)
    if (!organization) return false
    const allowedChanges = Object.fromEntries(
      ['name', 'acronym', 'category', 'adviser'].filter((key) => typeof changes[key] === 'string')
        .map((key) => [key, changes[key].trim()]),
    )
    if (!Object.values(allowedChanges).every(Boolean)) return false
    setAdminOrganizations((organizations) => organizations.map((item) => item.id === id ? { ...item, ...allowedChanges } : item))
    appendAudit('ORGANIZATION_UPDATED', 'ORGANIZATION', id, `${organization.name} organization profile was updated.`)
    return true
  }

  function updateOfficerOrganizationProfile(changes) {
    if (currentUser?.role !== 'OFFICER' || currentUser.organizationId !== officerOrganization.id) return false
    const allowedFields = ['name', 'acronym', 'category', 'mission', 'vision']
    const updates = Object.fromEntries(allowedFields
      .filter((key) => typeof changes[key] === 'string')
      .map((key) => [key, changes[key].trim()]))
    if (allowedFields.some((key) => !updates[key])) return false
    const organization = adminOrganizations.find((item) => item.id === currentUser.organizationId)
    if (!organization) return false
    setAdminOrganizations((organizations) => organizations.map((item) => item.id === organization.id
      ? { ...item, ...updates }
      : item))
    appendAudit('ORGANIZATION_PROFILE_UPDATED', 'ORGANIZATION', organization.id, `${updates.name} profile information was updated by an organization officer.`)
    return true
  }

  function updateOfficerOrganizationContact(changes) {
    if (currentUser?.role !== 'OFFICER' || currentUser.organizationId !== officerOrganization.id) return false
    const allowedFields = ['officialEmail', 'contactNumber', 'socialMedia']
    const updates = Object.fromEntries(allowedFields
      .filter((key) => typeof changes[key] === 'string')
      .map((key) => [key, changes[key].trim()]))
    if (Object.keys(updates).length !== allowedFields.length) return false
    const organization = adminOrganizations.find((item) => item.id === currentUser.organizationId)
    if (!organization) return false
    setAdminOrganizations((organizations) => organizations.map((item) => item.id === organization.id
      ? { ...item, ...updates }
      : item))
    appendAudit('ORGANIZATION_CONTACT_UPDATED', 'ORGANIZATION', organization.id, `${organization.name} contact information was updated.`)
    return true
  }

  function updateOfficerOrganizationLogo(logo) {
    if (currentUser?.role !== 'OFFICER' || currentUser.organizationId !== officerOrganization.id) return false
    if (logo !== null && (typeof logo !== 'string' || !logo.startsWith('data:image/'))) return false
    const organization = adminOrganizations.find((item) => item.id === currentUser.organizationId)
    if (!organization) return false
    setAdminOrganizations((organizations) => organizations.map((item) => item.id === organization.id
      ? { ...item, logo }
      : item))
    appendAudit(logo ? 'ORGANIZATION_LOGO_UPDATED' : 'ORGANIZATION_LOGO_REMOVED', 'ORGANIZATION', organization.id, `${organization.name} organization logo was ${logo ? 'updated' : 'removed'}.`)
    return true
  }

  function saveOfficerNotificationPreferences(preferences) {
    if (currentUser?.role !== 'OFFICER' || currentUser.organizationId !== officerOrganization.id) return false
    const keys = ['membershipRequests', 'eventUpdates', 'documentUpdates', 'adviserApprovalUpdates', 'studentAnnouncements']
    if (!keys.every((key) => typeof preferences[key] === 'boolean')) return false
    const organization = adminOrganizations.find((item) => item.id === currentUser.organizationId)
    if (!organization) return false
    setAdminOrganizations((organizations) => organizations.map((item) => item.id === organization.id
      ? { ...item, notificationPreferences: { ...preferences } }
      : item))
    appendAudit('ORGANIZATION_NOTIFICATION_PREFERENCES_UPDATED', 'ORGANIZATION', organization.id, `${organization.name} notification preferences were updated.`)
    return true
  }

  function submitOfficerOrganizationRequest(type, reason) {
    if (currentUser?.role !== 'OFFICER' || currentUser.organizationId !== officerOrganization.id) return false
    if (!['ADVISER_CHANGE', 'DEACTIVATION'].includes(type) || !reason?.trim()) return false
    const organization = adminOrganizations.find((item) => item.id === currentUser.organizationId)
    if (!organization) return false
    const request = {
      id: `org-request-${Date.now()}`,
      organizationId: organization.id,
      organizationName: organization.name,
      type,
      reason: reason.trim(),
      status: 'PENDING',
      submittedBy: formatDisplayName(currentUser),
      submittedAt: currentDateTime(),
    }
    setOrganizationChangeRequests((requests) => [request, ...requests])
    appendAudit(type === 'ADVISER_CHANGE' ? 'ADVISER_CHANGE_REQUESTED' : 'ORGANIZATION_DEACTIVATION_REQUESTED', 'ORGANIZATION_REQUEST', organization.id, `${organization.name}: ${type === 'ADVISER_CHANGE' ? 'Faculty adviser change' : 'Organization deactivation'} requested by ${request.submittedBy}.`)
    addAdminNotification(`${organization.name} submitted a ${type === 'ADVISER_CHANGE' ? 'faculty adviser change' : 'deactivation'} request for Student Affairs review.`)
    return true
  }

  function addOfficerDocument({ title, type, fileName }) {
    if (currentUser?.role !== 'OFFICER' || currentUser.organizationId !== officerOrganization.id) return false
    const organization = adminOrganizations.find((item) => item.id === currentUser.organizationId)
    if (!organization || !title.trim() || !type.trim() || !fileName.trim()) return false
    const submittedDate = currentDate()
    setAdviserDocuments((documents) => [...documents, {
      id: `wcs-document-${Date.now()}`,
      organizationId: organization.id,
      organizationName: organization.name,
      title: title.trim(),
      type: type.trim(),
      submittedBy: formatDisplayName(currentUser),
      submittedDate,
      status: 'PENDING',
      description: `${title.trim()} submitted for adviser review.`,
      supportingDocuments: [fileName.trim()],
    }])
    appendAudit('DOCUMENT_SUBMITTED', 'DOCUMENT', organization.id, `${title.trim()} was uploaded by ${formatDisplayName(currentUser)}.`)
    addAdviserActivity(`${title.trim()} document was submitted for adviser review.`)
    return true
  }

  function saveOfficerAnnouncement({ id, title, content, status }) {
    if (currentUser?.role !== 'OFFICER' || currentUser.organizationId !== officerOrganization.id) return false
    if (!title?.trim() || !content?.trim() || !['DRAFT', 'PUBLISHED'].includes(status)) return false
    const organization = adminOrganizations.find((item) => item.id === currentUser.organizationId)
    if (!organization) return false
    const now = currentDateTime()
    const announcements = organization.announcements ?? []
    const existing = id ? announcements.find((item) => item.id === id) : null
    const announcement = {
      id: existing?.id ?? `announcement-${Date.now()}`,
      title: title.trim(),
      content: content.trim(),
      postedBy: existing?.postedBy ?? formatDisplayName(currentUser),
      datePosted: existing?.datePosted ?? now,
      lastUpdated: now,
      status,
    }
    setAdminOrganizations((organizations) => organizations.map((item) => item.id === organization.id
      ? { ...item, announcements: existing
        ? (item.announcements ?? []).map((current) => current.id === existing.id ? announcement : current)
        : [announcement, ...(item.announcements ?? [])] }
      : item))
    const publishingDraft = existing?.status !== 'PUBLISHED' && status === 'PUBLISHED'
    const action = publishingDraft
      ? 'ANNOUNCEMENT_PUBLISHED'
      : existing ? 'ANNOUNCEMENT_UPDATED' : status === 'PUBLISHED' ? 'ANNOUNCEMENT_PUBLISHED' : 'ANNOUNCEMENT_DRAFT_CREATED'
    const activityMessage = publishingDraft || (!existing && status === 'PUBLISHED')
      ? `${formatDisplayName(currentUser)} published an announcement.`
      : existing
        ? `${formatDisplayName(currentUser)} updated an announcement.`
        : `${formatDisplayName(currentUser)} saved an announcement draft.`
    appendAudit(action, 'ANNOUNCEMENT', organization.id, `${organization.name}: ${activityMessage} ${announcement.title} (record ${announcement.id}).`)
    setAdviserActivity((activity) => [{
      id: `announcement-activity-${Date.now()}`,
      message: activityMessage,
      time: now,
    }, ...activity])
    if ((!existing || existing.status !== 'PUBLISHED') && status === 'PUBLISHED') {
      addStudentNotification(`${organization.name} posted a new announcement: ${announcement.title}`)
    }
    return true
  }

  function archiveOfficerAnnouncement(id) {
    if (currentUser?.role !== 'OFFICER' || currentUser.organizationId !== officerOrganization.id) return false
    const organization = adminOrganizations.find((item) => item.id === currentUser.organizationId)
    const announcement = organization?.announcements?.find((item) => item.id === id)
    if (!announcement || announcement.status === 'ARCHIVED') return false
    const now = currentDateTime()
    setAdminOrganizations((organizations) => organizations.map((item) => item.id === organization.id
      ? { ...item, announcements: item.announcements.map((current) => current.id === id ? { ...current, status: 'ARCHIVED', lastUpdated: now } : current) }
      : item))
    const activityMessage = `${formatDisplayName(currentUser)} archived an announcement.`
    appendAudit('ANNOUNCEMENT_ARCHIVED', 'ANNOUNCEMENT', organization.id, `${organization.name}: ${activityMessage} ${announcement.title} (record ${id}).`)
    setAdviserActivity((activity) => [{ id: `announcement-activity-${Date.now()}`, message: activityMessage, time: now }, ...activity])
    return true
  }

  function deleteOfficerAnnouncement(id) {
    if (currentUser?.role !== 'OFFICER' || currentUser.organizationId !== officerOrganization.id) return false
    const organization = adminOrganizations.find((item) => item.id === currentUser.organizationId)
    const announcement = organization?.announcements?.find((item) => item.id === id)
    if (!announcement) return false
    const now = currentDateTime()
    setAdminOrganizations((organizations) => organizations.map((item) => item.id === organization.id
      ? { ...item, announcements: item.announcements.filter((current) => current.id !== id) }
      : item))
    const activityMessage = `${formatDisplayName(currentUser)} deleted an announcement.`
    appendAudit('ANNOUNCEMENT_DELETED', 'ANNOUNCEMENT', organization.id, `${organization.name}: ${activityMessage} ${announcement.title} (record ${id}).`)
    setAdviserActivity((activity) => [{ id: `announcement-activity-${Date.now()}`, message: activityMessage, time: now }, ...activity])
    return true
  }

  function reviewOrganizationApplication(id, decision, comment = '') {
    if (currentUser?.role !== 'ADMIN') return false
    if (!['APPROVED', 'RETURNED', 'REJECTED'].includes(decision)) return false
    const reason = comment.trim()
    if ((decision === 'RETURNED' || decision === 'REJECTED') && !reason) return false
    const application = organizationApplications.find((item) => item.id === id && item.status === 'PENDING')
    if (!application) return false
    if (decision === 'APPROVED' && !application.adviserApproved) return false
    const decisionDate = currentDate()
    setOrganizationApplications((applications) => applications.map((item) => item.id === id
      ? { ...item, status: decision, decisionDate, decisionReason: decision === 'APPROVED' ? '' : reason, processedBy: formatDisplayName(currentUser) }
      : item))
    if (decision === 'APPROVED') {
      setAdminOrganizations((organizations) => {
        const approvedOrganization = {
          id: application.organizationId,
          name: application.name,
          acronym: application.acronym,
          category: application.category,
          college: ['Technology', 'Academic'].includes(application.category) ? 'College of Computing Studies' : 'College of Arts and Sciences',
          adviser: application.adviser,
          mission: application.mission,
          vision: application.vision,
          description: application.description,
          color: 'blue',
          status: 'ACTIVE',
          accreditationStatus: 'ACCREDITED',
          memberCount: application.proposedOfficers.length,
          activeMembers: application.proposedOfficers.length,
          officers: application.proposedOfficers.map((officer) => ({ ...officer })),
          announcements: [],
          documents: application.documents,
          eventIds: [],
          suspensionReason: '',
        }
        return organizations.some((item) => item.id === application.organizationId)
          ? organizations.map((item) => item.id === application.organizationId ? { ...item, ...approvedOrganization } : item)
          : [...organizations, approvedOrganization]
      })
      addStudentNotification(`${application.name} is now an accredited WMSU organization.`)
      addOfficerNotification(`${application.name} organization accreditation was approved by Student Affairs.`)
    } else {
      addOfficerNotification(decision === 'RETURNED'
        ? `${application.name} accreditation was returned for revision: ${reason}`
        : `${application.name} accreditation was rejected: ${reason}`)
    }
    appendAudit(`ORGANIZATION_${decision}`, 'ORGANIZATION_APPLICATION', id, `${application.name} application ${decision.toLowerCase()}${reason ? `: ${reason}` : ''}.`)
    return true
  }

  function reviewAdminEvent(id, decision, comment = '') {
    if (currentUser?.role !== 'ADMIN') return false
    if (!['APPROVED', 'RETURNED', 'REJECTED'].includes(decision)) return false
    const reason = comment.trim()
    if ((decision === 'RETURNED' || decision === 'REJECTED') && !reason) return false
    const event = officerEvents.find((item) => item.id === id && item.organizationId === officerOrganization.id)
    if (!event || event.status !== 'APPROVED' || !event.adviserDecisionDate || !event.adviser) return false
    if (event.adminApprovedAt) return false
    const decisionDate = currentDate()
    const nextStatus = decision === 'RETURNED' ? 'RETURNED_FOR_REVISION' : decision
    setOfficerEvents((events) => events.map((item) => item.id === id
      ? {
        ...item,
        status: nextStatus,
        adminApprovedAt: decision === 'APPROVED' ? decisionDate : null,
        adminDecisionDate: decisionDate,
        adminDecisionReason: decision === 'APPROVED' ? '' : reason,
        adminProcessedBy: formatDisplayName(currentUser),
        revisionNote: decision === 'APPROVED' ? '' : reason,
      }
      : item))
    appendAudit(`EVENT_${decision}`, 'EVENT', id, `${event.title} was ${decision.toLowerCase()} by Student Affairs.${reason ? ` ${reason}` : ''}`)
    if (decision === 'APPROVED') {
      addOfficerNotification(`Your event "${event.title}" was approved by Student Affairs. It is ready for publication.`)
    } else {
      addOfficerNotification(`Your event "${event.title}" was ${decision === 'RETURNED' ? 'returned for revision' : 'rejected'} by Student Affairs: ${reason}`)
    }
    return true
  }

  function publishAdminEvent(id) {
    if (currentUser?.role !== 'ADMIN') return false
    const event = officerEvents.find((item) => item.id === id && item.organizationId === officerOrganization.id)
    if (!event || event.status !== 'APPROVED' || !event.adviserDecisionDate || !event.adminApprovedAt) return false
    const publishedDate = currentDate()
    setOfficerEvents((events) => events.map((item) => item.id === id
      ? { ...item, status: 'PUBLISHED', publishedDate, registrationStatus: 'OPEN' }
      : item))
    appendAudit('EVENT_PUBLISHED', 'EVENT', id, `${event.title} was published for student registration.`)
    addOfficerNotification(`Your event "${event.title}" was published by Student Affairs and is now visible to students.`)
    addStudentNotification(`Registration is now open for ${event.title}.`)
    return true
  }

  function reviewAdminDocument(id, decision, comment = '') {
    if (currentUser?.role !== 'ADMIN') return false
    if (!['APPROVED', 'RETURNED', 'REJECTED'].includes(decision)) return false
    const reason = comment.trim()
    if ((decision === 'RETURNED' || decision === 'REJECTED') && !reason) return false
    const document = adviserDocuments.find((item) => item.id === id && item.organizationId === officerOrganization.id)
    if (!document || !document.adminReviewRequired || document.status !== 'APPROVED') return false
    const decisionDate = currentDate()
    setAdviserDocuments((documents) => documents.map((item) => item.id === id
      ? { ...item, status: decision, adminDecisionDate: decisionDate, adminDecisionReason: decision === 'APPROVED' ? '' : reason, adminProcessedBy: formatDisplayName(currentUser) }
      : item))
    appendAudit(`DOCUMENT_${decision}`, 'DOCUMENT', id, `${document.title} was ${decision.toLowerCase()} by Student Affairs.${reason ? ` ${reason}` : ''}`)
    addOfficerNotification(decision === 'APPROVED'
      ? `Your document "${document.title}" was approved by Student Affairs.`
      : `Your document "${document.title}" was ${decision === 'RETURNED' ? 'returned for revision' : 'rejected'}: ${reason}`)
    return true
  }

  function updateAdminUser(id, changes) {
    if (currentUser?.role !== 'ADMIN') return { ok: false, reason: 'Only Student Affairs administrators may update user accounts.' }
    const user = adminUsers.find((item) => item.id === id)
    if (!user) return { ok: false, reason: 'User not found.' }
    const roleChanged = changes.role !== undefined && changes.role !== user.role
    const statusChanged = changes.status !== undefined && changes.status !== user.status
    if (user.id === 'admin-root' && (roleChanged || statusChanged)) {
      return { ok: false, reason: 'Your own administrator account cannot be changed from this screen.' }
    }
    const activeAdmins = adminUsers.filter((item) => item.role === 'Student Affairs Admin' && item.status === 'ACTIVE')
    if (user.role === 'Student Affairs Admin' && activeAdmins.length <= 1
      && ((roleChanged && changes.role !== 'Student Affairs Admin') || (statusChanged && changes.status !== 'ACTIVE'))) {
      return { ok: false, reason: 'The final active system administrator cannot be deactivated or reassigned.' }
    }
    if (changes.role && !['Student', 'Organization Officer', 'Faculty Adviser', 'Student Affairs Admin'].includes(changes.role)) {
      return { ok: false, reason: 'Choose a valid system role.' }
    }
    if (changes.status && !['ACTIVE', 'INACTIVE', 'SUSPENDED'].includes(changes.status)) {
      return { ok: false, reason: 'Choose a valid account status.' }
    }
    const authRoles = {
      Student: 'STUDENT',
      'Organization Officer': 'OFFICER',
      'Faculty Adviser': 'ADVISER',
      'Student Affairs Admin': 'ADMIN',
    }
    if (!updateMockUserAccess(user.email, {
      ...(changes.role ? { role: authRoles[changes.role] } : {}),
      ...(changes.status ? { status: changes.status } : {}),
    })) return { ok: false, reason: 'The mock account access change could not be saved.' }
    setAdminUsers((users) => users.map((item) => item.id === id ? { ...item, ...changes } : item))
    const action = roleChanged ? 'USER_ROLE_CHANGED' : statusChanged ? `USER_${changes.status}` : 'USER_UPDATED'
    appendAudit(action, 'USER', id, `${user.name} updated${roleChanged ? ` to role ${changes.role}` : ''}${statusChanged ? ` to status ${changes.status}` : ''}.`)
    return { ok: true }
  }

  function saveAdminSettings(settings) {
    if (currentUser?.role !== 'ADMIN') return false
    setAdminSettings((current) => ({ ...current, ...settings, notifications: { ...current.notifications, ...settings.notifications } }))
    appendAudit('SYSTEM_SETTINGS_UPDATED', 'SYSTEM', 'unidos-settings', 'Academic and notification settings were updated.')
  }

  function addRegisteredStudent(student) {
    if (!student?.studentId || !student?.email || !student?.lastName || !student?.firstName) return false
    if (adminUsers.some((user) => user.userId === student.studentId || user.email === student.email)) return false
    setAdminUsers((users) => [{
      id: student.studentId,
      lastName: student.lastName,
      firstName: student.firstName,
      middleName: student.middleName ?? '',
      name: formatDisplayName(student),
      userId: student.studentId,
      email: student.email,
      role: 'Student',
      status: 'ACTIVE',
      organization: '—',
      lastActivity: `Registered · ${currentDate()}`,
      program: student.program,
      yearLevel: student.yearLevel,
    }, ...users])
    return true
  }

  function submitMembershipApplication(organizationId) {
    if (currentUser?.role !== 'STUDENT') return false
    const organization = adminOrganizations.find((item) => item.id === organizationId)
      ?? studentOrganizations.find((item) => item.id === organizationId)
    if (!organization) return false

    const studentId = currentUser.studentId ?? currentUser.id
    const exists = studentMemberships.some((membership) => (
      membership.studentId === studentId
      && membership.organizationId === organizationId
      && ['PENDING', 'ACTIVE', 'SUSPENDED'].includes(membership.status)
    ))
    if (exists) return false

    const applicationDate = currentDate()
    if (organizationId === officerOrganization.id) {
      const request = {
        id: `wcs-request-${studentId}-${Date.now()}`,
        organizationId,
        organizationName: officerOrganization.name,
        ...currentUser,
        firstName: currentUser.firstName,
        middleName: currentUser.middleName ?? '',
        lastName: currentUser.lastName,
        studentName: formatDisplayName(currentUser),
        studentId,
        program: 'BSCS',
        position: 'Applicant',
        applicationDate,
        message: 'I would like to join the Computer Society to participate in programming activities and workshops.',
        status: 'PENDING',
        decisionDate: null,
        decisionReason: '',
        processedBy: null,
      }
      setOfficerMembershipRequests((requests) => [...requests, request])
    } else {
      const request = {
        id: `request-${organizationId}-${studentId}-${Date.now()}`,
        organizationId,
        organizationName: organization.name,
        ...currentUser,
        firstName: currentUser.firstName,
        middleName: currentUser.middleName ?? '',
        lastName: currentUser.lastName,
        studentName: formatDisplayName(currentUser),
        studentId,
        program: 'BSCS',
        position: 'Applicant',
        applicationDate,
        status: 'PENDING',
        decisionDate: null,
        decisionReason: '',
        processedBy: null,
      }
      setOfficerMembershipRequests((requests) => [...requests, request])
    }
    setStudentMemberships((memberships) => [
      ...memberships.filter((membership) => membership.organizationId !== organizationId),
      {
        studentId,
        organizationId,
        status: 'PENDING',
        position: 'Applicant',
        applicationDate,
        approvedDate: null,
        decisionReason: '',
      },
    ])
    return true
  }

  function approveOfficerMembershipRequest(requestId) {
    if (currentUser?.role !== 'OFFICER' || currentUser.organizationId !== officerOrganization.id) return false
    const request = officerMembershipRequests.find((item) => (
      item.id === requestId
      && item.organizationId === officerOrganization.id
      && item.status === 'PENDING'
      && item.studentId !== (currentUser.studentId ?? officerStudentId)
    ))
    if (!request) return false

    const decisionDate = currentDate()
    setOfficerMembershipRequests((requests) => requests.map((item) => (
      item.id === requestId
        ? { ...item, status: 'APPROVED', decisionDate, decisionReason: '', processedBy: formatDisplayName(currentUser) }
        : item
    )))
    setOfficerMembers((members) => {
      const existing = members.find((member) => (
        member.organizationId === officerOrganization.id && member.studentId === request.studentId
      ))
      if (existing) {
        return members.map((member) => member.id === existing.id
          ? {
            ...member,
            position: 'General Member',
            status: 'ACTIVE',
            dateJoined: decisionDate,
            history: [...member.history, { date: decisionDate, action: 'Membership approved as General Member' }],
          }
          : member)
      }
      return [...members, {
        id: `wcs-member-${request.studentId}`,
        organizationId: officerOrganization.id,
        firstName: request.firstName ?? '',
        middleName: request.middleName ?? '',
        lastName: request.lastName ?? '',
        studentName: request.studentName,
        studentId: request.studentId,
        program: request.program,
        email: `${request.studentName.toLowerCase().replace(/\s+/g, '.')}@wmsu.edu.ph`,
        position: 'General Member',
        status: 'ACTIVE',
        dateJoined: decisionDate,
        history: [{ date: decisionDate, action: 'Membership approved as General Member' }],
      }]
    })
    setStudentMemberships((memberships) => {
      const membership = {
        studentId: request.studentId,
        organizationId: request.organizationId,
        status: 'ACTIVE',
        position: 'General Member',
        applicationDate: request.applicationDate,
        approvedDate: decisionDate,
        decisionReason: '',
      }
      const existing = memberships.some((item) => (
        item.studentId === request.studentId && item.organizationId === request.organizationId
      ))
      return existing
        ? memberships.map((item) => item.studentId === request.studentId && item.organizationId === request.organizationId ? membership : item)
        : [...memberships, membership]
    })
    setOfficerMemberCount((count) => count + 1)
    return true
  }

  function rejectOfficerMembershipRequest(requestId, reason) {
    if (currentUser?.role !== 'OFFICER' || currentUser.organizationId !== officerOrganization.id) return false
    const request = officerMembershipRequests.find((item) => (
      item.id === requestId
      && item.organizationId === officerOrganization.id
      && item.status === 'PENDING'
      && item.studentId !== (currentUser.studentId ?? officerStudentId)
    ))
    if (!request) return false

    const decisionDate = currentDate()
    const decisionReason = reason.trim()
    setOfficerMembershipRequests((requests) => requests.map((item) => (
      item.id === requestId
        ? { ...item, status: 'REJECTED', decisionDate, decisionReason, processedBy: formatDisplayName(currentUser) }
        : item
    )))
    setStudentMemberships((memberships) => {
      const membership = {
        studentId: request.studentId,
        organizationId: request.organizationId,
        status: 'REJECTED',
        position: 'Applicant',
        applicationDate: request.applicationDate,
        approvedDate: null,
        decisionReason,
      }
      const existing = memberships.some((item) => (
        item.studentId === request.studentId && item.organizationId === request.organizationId
      ))
      return existing
        ? memberships.map((item) => item.studentId === request.studentId && item.organizationId === request.organizationId ? membership : item)
        : [...memberships, membership]
    })
    return true
  }

  function updateOfficerMemberStatus(memberId, status) {
    if (currentUser?.role !== 'OFFICER' || currentUser.organizationId !== officerOrganization.id) return false
    const member = officerMembers.find((item) => (
      item.id === memberId && item.organizationId === officerOrganization.id
    ))
    if (!member || !['ACTIVE', 'SUSPENDED', 'INACTIVE'].includes(status) || member.status === status) return false

    const wasActive = member.status === 'ACTIVE'
    const willBeActive = status === 'ACTIVE'
    const date = currentDate()
    const position = wasActive && !willBeActive && exclusiveOfficerPositions.includes(member.position)
      ? 'General Member'
      : member.position
    setOfficerMembers((members) => members.map((item) => item.id === memberId
      ? {
        ...item,
        position,
        status,
        history: [...item.history, {
          date,
          action: position !== member.position
            ? `Membership status changed to ${status}; position released to General Member`
            : `Membership status changed to ${status}`,
        }],
      }
      : item))
    if (wasActive !== willBeActive) setOfficerMemberCount((count) => count + (willBeActive ? 1 : -1))
    setStudentMemberships((memberships) => {
      const existing = memberships.some((item) => item.studentId === member.studentId && item.organizationId === member.organizationId)
      const updated = memberships.map((item) => (
        item.studentId === member.studentId && item.organizationId === member.organizationId
          ? { ...item, status, position }
          : item
      ))
      return existing
        ? updated
        : [...updated, {
          studentId: member.studentId,
          organizationId: member.organizationId,
          status,
          position,
          applicationDate: member.dateJoined,
          approvedDate: member.dateJoined,
          decisionReason: '',
        }]
    })
    return true
  }

  function assignOfficerPosition(memberId, position) {
    if (currentUser?.role !== 'OFFICER' || currentUser.organizationId !== officerOrganization.id) return { ok: false, reason: 'Only officers of the assigned organization may assign positions.' }
    const member = officerMembers.find((item) => (
      item.id === memberId
      && item.organizationId === officerOrganization.id
      && item.status === 'ACTIVE'
    ))
    if (!member) return { ok: false, reason: 'Only active members of WMSU Computer Society can hold an officer position.' }
    if (!['President', 'Vice President', 'Secretary', 'Treasurer', 'Auditor', 'PIO', 'Committee Head', 'General Member'].includes(position)) {
      return { ok: false, reason: 'Choose a valid organization position.' }
    }

    let displacedMember = null
    if (exclusiveOfficerPositions.includes(position)) {
      const assigned = officerMembers.find((item) => (
        item.organizationId === officerOrganization.id
        && item.status === 'ACTIVE'
        && item.position === position
        && item.id !== memberId
      ))
      if (assigned) {
        displacedMember = assigned
        setOfficerMembers((members) => members.map((item) => item.id === assigned.id
          ? {
            ...item,
            position: 'General Member',
            history: [...item.history, { date: currentDate(), action: `Position changed from ${position} to General Member` }],
          }
          : item))
      }
    }

    const date = currentDate()
    setOfficerMembers((members) => members.map((item) => {
      if (item.id === memberId) {
        return {
          ...item,
          position,
          history: [...item.history, { date, action: `Position changed from ${member.position} to ${position}` }],
        }
      }
      if (displacedMember && item.id === displacedMember.id) {
        return {
          ...item,
          position: 'General Member',
          history: [...item.history, { date, action: `Position changed from ${position} to General Member` }],
        }
      }
      return item
    }))
    setStudentMemberships((memberships) => {
      const synchronized = [
        { member, position },
        ...(displacedMember ? [{ member: displacedMember, position: 'General Member' }] : []),
      ]
      return synchronized.reduce((currentMemberships, update) => {
        const hasMembership = currentMemberships.some((item) => (
          item.studentId === update.member.studentId && item.organizationId === update.member.organizationId
        ))
        const updated = currentMemberships.map((item) => (
          item.studentId === update.member.studentId && item.organizationId === update.member.organizationId
            ? { ...item, position: update.position }
            : item
        ))
        return hasMembership
          ? updated
          : [...updated, {
            studentId: update.member.studentId,
            organizationId: update.member.organizationId,
            status: update.member.status,
            position: update.position,
            applicationDate: update.member.dateJoined,
            approvedDate: update.member.dateJoined,
            decisionReason: '',
          }]
      }, memberships)
    })
    return { ok: true }
  }

  const value = {
    adminAuditLogs,
    adminNotifications,
    adminOrganizations,
    adminSettings,
    adminUsers,
    addRegisteredStudent,
    markAdminNotificationRead,
    markStudentNotificationRead,
    adviserActivity,
    adviserDocuments: adviserDocuments.filter((document) => document.organizationId === officerOrganization.id),
    adviserReports: adviserReports.filter((report) => report.organizationId === officerOrganization.id),
    appendAudit,
    organizationApplications,
    officerNotifications,
    assignOfficerPosition,
    approveOfficerMembershipRequest,
    officerMemberCount,
    officerMembers: officerMembers.filter((member) => member.organizationId === officerOrganization.id),
    officerMembershipRequests: officerMembershipRequests.filter((request) => request.organizationId === officerOrganization.id),
    officerEvents: officerEvents.filter((event) => event.organizationId === officerOrganization.id),
    rejectOfficerMembershipRequest,
    reviewAccomplishmentReport,
    reviewAdminDocument,
    reviewAdminEvent,
    reviewOrganizationApplication,
    reviewAdviserRequest,
    publishAdminEvent,
    saveAdminSettings,
    saveOfficerEvent,
    studentNotifications,
    studentMemberships,
    submitMembershipApplication,
    updateAdminOrganizationStatus,
    updateAdminOrganization,
    updateOfficerOrganizationProfile,
    updateOfficerOrganizationContact,
    updateOfficerOrganizationLogo,
    saveOfficerNotificationPreferences,
    submitOfficerOrganizationRequest,
    organizationChangeRequests,
    addOfficerDocument,
    saveOfficerAnnouncement,
    archiveOfficerAnnouncement,
    deleteOfficerAnnouncement,
    updateAdminUser,
    updateOfficerMemberStatus,
  }

  return <PortalDataContext.Provider value={value}>{children}</PortalDataContext.Provider>
}

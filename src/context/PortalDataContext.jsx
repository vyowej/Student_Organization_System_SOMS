/**
 * Shared Portal Data Context (`src/context/PortalDataContext.jsx`)
 *
 * Synchronizes Student, Officer, Adviser, and Admin portals with the PostgreSQL
 * database (`database/student_org_db.sql`) via Express REST API endpoints (`/api/*`).
 * All hardcoded fake data arrays and localStorage mock databases have been removed.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import PortalDataContext from './PortalData.js'
import { useAuth } from './useAuth.js'
import { adminDefaultSettings } from '../data/adminPortal.js'

function formatDisplayDate(isoValue) {
  if (!isoValue) return ''
  const parsed = new Date(isoValue)
  if (Number.isNaN(parsed.getTime())) return String(isoValue)
  return parsed.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

function formatDisplayTime(isoValue) {
  if (!isoValue) return ''
  const parsed = new Date(isoValue)
  if (Number.isNaN(parsed.getTime())) return ''
  return parsed.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  })
}

function formatDisplayDateTime(isoValue) {
  if (!isoValue) return ''
  const parsed = new Date(isoValue)
  if (Number.isNaN(parsed.getTime())) return String(isoValue)
  return `${formatDisplayDate(isoValue)}, ${formatDisplayTime(isoValue)}`
}

function formatOrgCategoryLabel(orgType) {
  if (!orgType) return 'Academic'
  const map = {
    ACADEMIC: 'Academic',
    STUDENT_COUNCIL: 'Student Council',
    NON_ACADEMIC: 'Leadership',
    LEADERSHIP: 'Leadership',
    TECHNOLOGY: 'Technology',
    SOCIO_CIVIC: 'Socio-Civic',
    RELIGIOUS: 'Religious',
    SPORTS: 'Sports',
    SPORTS_RECREATION: 'Sports & Recreation',
    CULTURAL: 'Cultural',
    SPECIAL_INTEREST: 'Special Interest',
    PUBLICATION: 'Publication',
    FRATERNITY_SORORITY: 'Fraternity / Sorority',
    OTHER: 'Other',
  }
  return map[String(orgType).toUpperCase()] || orgType
}

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

function formatRoleLabel(role) {
  const map = {
    STUDENT: 'Student',
    OFFICER: 'Organization Officer',
    ADVISER: 'Faculty Adviser',
    ADMIN: 'Student Affairs Admin',
  }
  return map[String(role || '').toUpperCase()] || role || 'Student'
}

function normalizeAnnouncement(a) {
  const annId = a.announcement_id ?? a.id
  return {
    id: annId,
    announcementId: annId,
    organizationId: a.organization_id,
    organizationName: a.organization_name || 'Organization',
    title: a.title,
    description: a.content,
    content: a.content,
    date: formatDisplayDate(a.published_at || a.created_at),
    datePosted: a.published_at || a.created_at,
    lastUpdated: a.updated_at || a.published_at || a.created_at,
    isPinned: Boolean(a.is_pinned),
    status: a.published_at ? 'PUBLISHED' : 'DRAFT',
    postedBy: a.first_name
      ? `${a.last_name}, ${a.first_name}`
      : a.author_first_name
        ? `${a.author_last_name}, ${a.author_first_name}`
        : 'Organization Officer',
  }
}

function normalizeOrganization(row, allMembers = [], allAnnouncements = [], allDocuments = []) {
  const orgId = row.organization_id ?? row.id
  const orgMembers = allMembers.filter((m) => String(m.organization_id) === String(orgId) && m.status === 'ACTIVE')
  const officers = orgMembers
    .filter((m) => m.position && m.position !== 'MEMBER')
    .map((m) => ({
      id: m.membership_id ?? m.id,
      studentId: m.student_number || String(m.student_id),
      firstName: m.first_name,
      middleName: m.middle_name || '',
      lastName: m.last_name,
      suffix: m.suffix || '',
      name: `${m.last_name}, ${m.first_name}${m.suffix ? ` ${m.suffix}` : ''}`,
      position: formatPositionLabel(m.position, m.custom_title),
      rawPosition: m.position,
      status: m.status || 'ACTIVE',
    }))

  const orgAnnouncements = allAnnouncements
    .filter((a) => String(a.organization_id) === String(orgId))
    .map(normalizeAnnouncement)

  const orgDocs = allDocuments
    .filter((d) => String(d.organization_id) === String(orgId) && d.status === 'APPROVED')
    .map((d) => d.title)

  const adviserName = row.adviser_name || (row.adviser_last_name && row.adviser_first_name
    ? `${row.adviser_last_name}, ${row.adviser_first_name}${row.adviser_suffix ? ` ${row.adviser_suffix}` : ''}`
    : row.adviser_first_name
      ? row.adviser_first_name
      : 'Unassigned')

  const activeCount = Number(row.member_count ?? orgMembers.length ?? 0)

  return {
    id: orgId,
    organizationId: orgId,
    name: row.name,
    acronym: row.acronym || row.name?.slice(0, 4)?.toUpperCase() || 'ORG',
    category: row.category || formatOrgCategoryLabel(row.org_type || row.type),
    orgType: row.org_type || row.type,
    scope: row.scope,
    collegeId: row.college_id,
    college: row.college_name || 'University-wide',
    collegeCode: row.college_code || row.college_acronym || '',
    departmentId: row.department_id,
    department: row.department_name || '',
    departmentCode: row.department_code || row.department_acronym || '',
    description: row.description || row.mission || 'Official WMSU student organization.',
    mission: row.mission || 'Not provided.',
    vision: row.vision || 'Not provided.',
    logo: row.logo || '',
    adviserId: row.current_adviser_id || row.adviser_id || null,
    adviser: adviserName,
    adviserStatus: (row.current_adviser_id || row.adviser_id || (adviserName && adviserName !== 'Unassigned')) ? 'ACTIVE' : 'UNASSIGNED',
    status: row.status || 'ACTIVE',
    accreditationStatus: row.accreditation_status || row.status || 'PENDING',
    memberCount: activeCount,
    activeMembers: activeCount,
    upcomingEventsCount: Number(row.upcoming_events_count ?? 0),
    establishedDate: formatDisplayDate(row.established_date || row.created_at),
    createdAt: row.created_at,
    officers,
    announcements: orgAnnouncements,
    documents: orgDocs,
  }
}

function normalizeEvent(row) {
  const evtId = row.event_id ?? row.id
  const startDt = row.start_datetime ?? row.start_date
  const endDt = row.end_datetime ?? row.end_date
  const startTime = formatDisplayTime(startDt)
  const endTime = formatDisplayTime(endDt)
  const timeRange = startTime && endTime ? `${startTime} – ${endTime}` : startTime || 'TBA'
  const rawStatus = row.status || 'SUBMITTED'
  const mappedStatus = rawStatus === 'PENDING' ? 'SUBMITTED' : rawStatus

  return {
    id: evtId,
    eventId: evtId,
    organizationId: row.organization_id,
    organizationName: row.organization_name || 'Campus Organization',
    organizationAcronym: row.organization_acronym || '',
    title: row.title,
    description: row.description || '',
    venue: row.venue || 'WMSU Campus',
    location: row.venue || 'WMSU Campus',
    startDatetime: startDt,
    endDatetime: endDt,
    date: formatDisplayDate(startDt),
    submittedDate: formatDisplayDate(row.created_at),
    startTime,
    endTime,
    time: timeRange,
    category: row.event_type || 'Academic',
    eventType: row.event_type || 'Academic',
    capacity: Number(row.max_participants ?? row.capacity ?? 100),
    registeredCount: Number(row.registered_count ?? 0),
    registrations: Number(row.registered_count ?? 0),
    attendedCount: Number(row.attended_count ?? 0),
    attendance: Number(row.attended_count ?? 0),
    status: (row.is_published && rawStatus === 'APPROVED') || rawStatus === 'PUBLISHED' ? 'PUBLISHED' : mappedStatus,
    rawStatus,
    isPublished: Boolean(row.is_published || rawStatus === 'PUBLISHED'),
    adviserDecisionDate: row.approved_by || row.adviser_approved_by ? formatDisplayDate(row.adviser_approved_at || row.updated_at || row.created_at) : null,
    adminApprovedAt: rawStatus === 'PUBLISHED' || row.admin_approved_by ? formatDisplayDate(row.admin_approved_at || row.updated_at || row.created_at) : null,
    createdBy: row.created_by,
    approvedBy: row.approved_by || row.adviser_approved_by,
    createdAt: row.created_at,
    supportingDocuments: [],
  }
}

function normalizeMember(row) {
  const memId = row.membership_id ?? row.id
  const joinedFormatted = formatDisplayDate(row.joined_at || row.created_at)
  const positionLabel = formatPositionLabel(row.position, row.custom_title)
  return {
    id: memId,
    membershipId: memId,
    organizationId: row.organization_id,
    organizationName: row.organization_name || '',
    acronym: row.acronym || row.organization_acronym || '',
    studentRecordId: row.student_id,
    studentId: row.student_number || String(row.student_id),
    userId: row.user_id,
    firstName: row.first_name || '',
    middleName: row.middle_name || '',
    lastName: row.last_name || '',
    suffix: row.suffix || '',
    name: `${row.last_name || ''}, ${row.first_name || ''}${row.suffix ? ` ${row.suffix}` : ''}`.replace(/^,\s*/, ''),
    email: row.email || '',
    program: row.program_name || row.program_code || row.program_acronym || '',
    yearLevel: row.year_level ? `${row.year_level}${row.year_level === 1 ? 'st' : row.year_level === 2 ? 'nd' : row.year_level === 3 ? 'rd' : 'th'} Year` : '',
    position: positionLabel,
    rawPosition: row.position || 'MEMBER',
    customTitle: row.custom_title || '',
    termStart: row.term_start,
    termEnd: row.term_end,
    status: row.status || 'ACTIVE',
    joinedDate: joinedFormatted,
    dateJoined: joinedFormatted,
    approvedDate: joinedFormatted,
    history: [
      {
        date: joinedFormatted || 'Recorded',
        action: `Joined as ${positionLabel}`,
      },
    ],
  }
}

function normalizeApplication(row) {
  const appId = row.application_id ?? row.id
  return {
    id: appId,
    applicationId: appId,
    organizationId: row.organization_id,
    organizationName: row.organization_name || '',
    acronym: row.acronym || row.organization_acronym || '',
    studentRecordId: row.student_id ?? row.applicant_id,
    studentId: row.student_number || String(row.student_id ?? row.applicant_id),
    firstName: row.first_name || '',
    middleName: row.middle_name || '',
    lastName: row.last_name || '',
    suffix: row.suffix || '',
    name: `${row.last_name || ''}, ${row.first_name || ''}${row.suffix ? ` ${row.suffix}` : ''}`.replace(/^,\s*/, ''),
    email: row.email || '',
    program: row.program_name || row.program_code || row.program_acronym || '',
    yearLevel: row.year_level ? `${row.year_level}${row.year_level === 1 ? 'st' : row.year_level === 2 ? 'nd' : row.year_level === 3 ? 'rd' : 'th'} Year` : '',
    desiredRole: row.desired_role || 'Member',
    message: row.reason || row.remarks || 'Membership application submitted via UNIDOS portal.',
    reason: row.reason || row.remarks || '',
    status: row.status || 'PENDING',
    applicationDate: formatDisplayDate(row.applied_at),
    appliedAt: row.applied_at,
    decisionDate: row.reviewed_at ? formatDisplayDate(row.reviewed_at) : '',
    reviewedAt: row.reviewed_at,
    processedBy: row.reviewer_first_name ? `${row.reviewer_last_name}, ${row.reviewer_first_name}` : '',
  }
}

function normalizeRegistration(row) {
  const regId = row.registration_id ?? row.id
  const attendanceStatus = row.attendance_id || row.status === 'ATTENDED'
    ? (row.attendance_status === 'LATE' ? 'ATTENDED' : row.attendance_status || 'ATTENDED')
    : 'PENDING'

  return {
    id: `REG-${regId}`,
    registrationId: regId,
    eventId: row.event_id,
    eventTitle: row.event_title || '',
    organizationId: row.organization_id,
    organizationName: row.organization_name || '',
    studentRecordId: row.student_id,
    studentId: row.student_number || String(row.student_id),
    firstName: row.first_name || '',
    lastName: row.last_name || '',
    suffix: row.suffix || '',
    status: row.status || 'REGISTERED',
    registrationDate: formatDisplayDate(row.registered_at),
    registeredAt: row.registered_at,
    attendanceStatus,
    checkInTime: row.time_in ? formatDisplayTime(row.time_in) : null,
    checkInDate: row.time_in ? formatDisplayDate(row.time_in) : null,
  }
}

function extractAdviserRemarks(raw) {
  if (!raw) return ''
  let current = raw
  while (typeof current === 'string' && current.trim().startsWith('{') && current.trim().endsWith('}')) {
    try {
      const parsed = JSON.parse(current.trim())
      if (parsed && typeof parsed === 'object') {
        current = parsed.adviserRemarks ?? parsed.remarks ?? parsed.comment ?? ''
      } else {
        break
      }
    } catch {
      break
    }
  }
  return typeof current === 'string' ? current.trim() : ''
}

function normalizeDocument(row) {
  const docId = row.document_id ?? row.id
  const docType = row.doc_type ?? row.type ?? 'OTHER'
  return {
    id: docId,
    documentId: docId,
    organizationId: row.organization_id,
    organizationName: row.organization_name || '',
    acronym: row.organization_acronym || '',
    title: row.title,
    type: docType,
    docType,
    fileUrl: row.file_url || '',
    academicYear: row.academic_year || '',
    semester: row.semester || '',
    status: row.status || 'PENDING',
    submittedDate: formatDisplayDate(row.created_at),
    submittedBy: row.uploader_first_name
      ? `${row.uploader_last_name}, ${row.uploader_first_name}`
      : 'Organization Officer',
    processedBy: row.reviewer_first_name
      ? `${row.reviewer_last_name}, ${row.reviewer_first_name}`
      : '',
    decisionReason: (row.reviewed_at || row.reviewed_by) ? extractAdviserRemarks(row.review_remarks) : '',
    revisionNote: (row.reviewed_at || row.reviewed_by || row.status === 'REJECTED') ? extractAdviserRemarks(row.review_remarks) : '',
    reviewRemarks: row.review_remarks || '',
    reviewedAt: row.reviewed_at ? formatDisplayDate(row.reviewed_at) : '',
    adminReviewRequired: ['CONSTITUTION', 'BYLAWS', 'ACCREDITATION_FORM', 'FINANCIAL_REPORT', 'EVENT_REPORT', 'FINANCIAL', 'REPORT'].includes(docType),
  }
}

function normalizeUser(row) {
  const resolvedId = row.user_id ?? row.id
  const suffix = row.suffix ? ` ${row.suffix}` : ''
  const middle = (row.middle_name || row.middleName) ? ` ${row.middle_name || row.middleName}` : ''
  const fullName = `${row.last_name || ''}, ${row.first_name || ''}${middle}${suffix}`.replace(/^,\s*/, '')
  return {
    id: resolvedId,
    userId: row.student_number || row.employee_number || String(resolvedId),
    dbUserId: resolvedId,
    studentRecordId: row.student_id ?? row.studentDbId ?? row.student_db_id ?? null,
    studentDbId: row.student_db_id ?? row.studentDbId ?? row.student_id ?? null,
    adviserRecordId: row.adviser_id ?? row.adviserDbId ?? null,
    studentNumber: row.student_number || '',
    employeeNumber: row.employee_number || '',
    firstName: row.first_name || row.firstName || '',
    middleName: row.middle_name || row.middleName || '',
    lastName: row.last_name || row.lastName || '',
    suffix: row.suffix || '',
    name: row.name || fullName,
    displayName: row.displayName || fullName,
    email: row.email || '',
    role: formatRoleLabel(row.role),
    rawRole: row.role || 'STUDENT',
    status: row.status || 'ACTIVE',
    programId: row.program_id ?? row.programId ?? null,
    program: row.program || row.program_name || row.adviser_department_name || '—',
    programCode: row.program_code || row.programAcronym || '',
    departmentId: row.department_id ?? row.departmentId ?? row.adviser_department_id ?? null,
    department: row.department || row.department_name || row.adviser_department_name || '—',
    collegeId: row.college_id ?? row.collegeId ?? row.adviser_college_id ?? null,
    college: row.college || row.college_name || '—',
    yearLevel: row.yearLevel || (row.year_level ? `${row.year_level}${row.year_level === 1 ? 'st' : row.year_level === 2 ? 'nd' : row.year_level === 3 ? 'rd' : 'th'} Year` : '—'),
    organization: row.organization || '—',
    lastActivity: formatDisplayDate(row.updated_at || row.created_at),
    createdAt: formatDisplayDate(row.created_at),
  }
}

function normalizeNotification(row) {
  const notifId = row.notification_id ?? row.id
  const isRead = Boolean(row.is_read ?? row.read_at)
  const rawType = String(row.type || 'SYSTEM').toUpperCase()

  let displayType = 'Update'
  let icon = 'bell'
  if (rawType.includes('CONFIRMATION')) {
    displayType = 'Confirmation'
    icon = 'check-circle'
  } else if (rawType.includes('EVENT_REGISTRATION') || rawType === 'REGISTRATION') {
    displayType = 'Registration'
    icon = 'ticket'
  } else if (rawType.includes('ATTENDANCE')) {
    displayType = 'Attendance'
    icon = 'check-circle'
  } else if (rawType.includes('EVENT_REVIEW')) {
    displayType = 'Event Review'
    icon = 'calendar'
  } else if (rawType.includes('EVENT')) {
    displayType = 'Event'
    icon = 'calendar'
  } else if (rawType.includes('ANNOUNCEMENT')) {
    displayType = 'Announcement'
    icon = 'announcement'
  } else if (rawType.includes('DOCUMENT_REVIEW')) {
    displayType = 'Document Review'
    icon = 'document'
  } else if (rawType.includes('DOCUMENT')) {
    displayType = 'Document'
    icon = 'document'
  } else if (rawType.includes('ADVISER')) {
    displayType = 'Adviser'
    icon = 'adviser'
  } else if (rawType.includes('ORGANIZATION')) {
    displayType = 'Organization'
    icon = 'organization'
  } else if (rawType.includes('MEMBERSHIP') || rawType.includes('APPLICATION')) {
    displayType = 'Membership'
    icon = 'organization'
  } else if (rawType.includes('APPROVAL') || rawType.includes('PROPOSAL') || rawType.includes('CHANGE_REQUEST')) {
    displayType = 'Approval'
    icon = 'check'
  }

  return {
    id: notifId,
    notificationId: notifId,
    userId: row.user_id,
    title: row.title,
    message: row.message,
    type: displayType,
    rawType,
    icon,
    read: isRead,
    unread: !isRead,
    createdAt: formatDisplayDate(row.created_at),
    time: formatDisplayDate(row.created_at),
  }
}

function isNotificationAllowedByPreferences(n, prefs) {
  if (!prefs) return true
  const rawType = String(n.rawType || n.type || '').toUpperCase()
  const title = String(n.title || '').toLowerCase()
  const message = String(n.message || n.text || '').toLowerCase()

  // 1. Membership Requests
  const isMembership =
    rawType.includes('MEMBERSHIP') ||
    rawType.includes('APPLICATION') ||
    title.includes('membership') ||
    title.includes('application') ||
    title.includes('member') ||
    message.includes('application') ||
    message.includes('member request') ||
    message.includes('joined')
  if (isMembership && prefs.membershipRequests === false) return false

  // 2. Adviser Approval Updates
  const isAdviserApproval =
    rawType.includes('APPROVAL') ||
    rawType.includes('REVIEW') ||
    title.includes('verified') ||
    title.includes('approved') ||
    title.includes('returned') ||
    title.includes('rejected') ||
    message.includes('adviser')
  if (isAdviserApproval && prefs.adviserApprovalUpdates === false) return false

  // 3. Document Updates
  const isDocument =
    rawType.includes('DOCUMENT') ||
    rawType.includes('REPORT') ||
    title.includes('document') ||
    title.includes('report') ||
    message.includes('document') ||
    message.includes('report')
  if (isDocument && prefs.documentUpdates === false) return false

  // 4. Student Announcements
  const isAnnouncement =
    rawType.includes('ANNOUNCEMENT') ||
    title.includes('announcement') ||
    message.includes('announcement')
  if (isAnnouncement && prefs.studentAnnouncements === false) return false

  // 5. Event Updates
  const isEvent =
    rawType.includes('EVENT') ||
    rawType.includes('REGISTRATION') ||
    rawType.includes('ATTENDANCE') ||
    title.includes('event') ||
    message.includes('event')
  if (isEvent && prefs.eventUpdates === false) return false

  return true
}

function isAdminNotificationAllowedByPreferences(n, prefs) {
  if (!prefs) return true
  const rawType = String(n.rawType || n.type || '').toUpperCase()
  const title = String(n.title || '').toLowerCase()
  const message = String(n.message || n.text || '').toLowerCase()

  // 1. Organization Applications & Changes
  const isOrgApp =
    rawType.includes('ORGANIZATION') ||
    rawType.includes('ACCREDITATION') ||
    rawType.includes('CHANGE_REQUEST') ||
    title.includes('organization application') ||
    title.includes('accreditation') ||
    title.includes('adviser change') ||
    message.includes('accreditation application') ||
    message.includes('change faculty adviser')
  if (isOrgApp && prefs.organizationApplications === false) return false

  // 2. Event Approvals & Endorsements
  const isEvent =
    rawType.includes('EVENT') ||
    rawType.includes('REGISTRATION') ||
    rawType.includes('ATTENDANCE') ||
    title.includes('event') ||
    message.includes('event proposal') ||
    message.includes('event approval') ||
    message.includes('endorsed event')
  if (isEvent && prefs.eventApprovals === false) return false

  // 3. Document Reviews & Compliance Reports
  const isDoc =
    rawType.includes('DOCUMENT') ||
    rawType.includes('REPORT') ||
    title.includes('document') ||
    title.includes('report') ||
    title.includes('accomplishment') ||
    message.includes('document') ||
    message.includes('accomplishment report') ||
    message.includes('compliance accomplishment')
  if (isDoc && prefs.documentReviews === false) return false

  // 4. Security Alerts & User/System Audit Notices
  const isSecurity =
    rawType.includes('SECURITY') ||
    rawType.includes('ALERT') ||
    rawType.includes('AUDIT') ||
    rawType.includes('SUSPENSION') ||
    rawType.includes('DEACTIVATION') ||
    rawType.includes('USER') ||
    title.includes('security') ||
    title.includes('alert') ||
    title.includes('suspension') ||
    title.includes('deactivation') ||
    title.includes('account suspended') ||
    title.includes('account deactivated') ||
    title.includes('password') ||
    title.includes('role') ||
    title.includes('permission') ||
    message.includes('security alert') ||
    message.includes('suspended') ||
    message.includes('deactivated') ||
    message.includes('password reset')
  if (isSecurity && prefs.securityAlerts === false) return false

  return true
}

function normalizeAuditLog(row) {
  const logId = row.log_id ?? row.id
  const entityType = row.entity_type ?? row.entity ?? 'SYSTEM'
  const actorName = row.actor_name
    || (row.first_name ? `${row.last_name}, ${row.first_name}${row.suffix ? ` ${row.suffix}` : ''}` : '')
    || row.metadata?.actor_name
    || (row.user_id ? `User #${row.user_id}` : 'System')
  const metadata = row.metadata || row.details || {}
  const description = metadata.description
    || metadata.notes
    || metadata.reason
    || `${String(row.action || '').replaceAll('_', ' ')} on ${entityType}${row.entity_id ? ` #${row.entity_id}` : ''}`
  return {
    id: logId,
    logId,
    userId: row.user_id,
    actor: actorName,
    actorEmail: row.email || metadata.email || '',
    role: row.role || metadata.role || (row.user_id ? 'User' : 'System'),
    action: row.action,
    entityType,
    entityId: row.entity_id || '—',
    description,
    metadata,
    details: metadata,
    ipAddress: row.ip_address || metadata.ip_address || '127.0.0.1',
    timestamp: formatDisplayDateTime(row.created_at),
    date: formatDisplayDate(row.created_at),
    time: formatDisplayTime(row.created_at),
    createdAt: row.created_at,
  }
}

export function PortalDataProvider({ children }) {
  const { currentUser, refreshCurrentUser } = useAuth()

  const [rawOrganizations, setRawOrganizations] = useState([])
  const [rawEvents, setRawEvents] = useState([])
  const [rawMembers, setRawMembers] = useState([])
  const [rawApplications, setRawApplications] = useState([])
  const [rawRegistrations, setRawRegistrations] = useState([])
  const [rawDocuments, setRawDocuments] = useState([])
  const [rawAnnouncements, setRawAnnouncements] = useState([])
  const [rawUsers, setRawUsers] = useState([])
  const [rawNotifications, setRawNotifications] = useState([])
  const [rawAuditLogs, setRawAuditLogs] = useState([])
  const [rawAdvisers, setRawAdvisers] = useState([])
  const [rawAdviserChangeRequests, setRawAdviserChangeRequests] = useState([])
  const [academicHierarchy, setAcademicHierarchy] = useState({
    colleges: [],
    departments: [],
    programs: [],
  })
  const [adminSettings, setAdminSettings] = useState(() => {
    try {
      const saved = typeof window !== 'undefined' ? localStorage.getItem('soms_admin_settings') : null
      if (saved) {
        const parsed = JSON.parse(saved)
        return {
          ...adminDefaultSettings,
          ...parsed,
          organizationCategories: Array.isArray(parsed?.organizationCategories) && parsed.organizationCategories.length > 0
            ? parsed.organizationCategories
            : adminDefaultSettings.organizationCategories,
          notifications: {
            ...adminDefaultSettings.notifications,
            ...(parsed?.notifications || {}),
          },
        }
      }
    } catch {
      // ignore
    }
    return adminDefaultSettings
  })
  const [officerNotificationPreferences, setOfficerNotificationPreferences] = useState(() => {
    try {
      if (typeof window !== 'undefined') {
        const activeOrgId = currentUser?.organizationId || 'default'
        const saved = localStorage.getItem(`soms_officer_notification_preferences_${activeOrgId}`) || localStorage.getItem('soms_officer_notification_preferences')
        if (saved) return JSON.parse(saved)
      }
    } catch {
      // ignore
    }
    return {
      membershipRequests: true,
      eventUpdates: true,
      documentUpdates: true,
      adviserApprovalUpdates: true,
      studentAnnouncements: true,
    }
  })

  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        const activeOrgId = currentUser?.organizationId || 'default'
        const saved = localStorage.getItem(`soms_officer_notification_preferences_${activeOrgId}`) || localStorage.getItem('soms_officer_notification_preferences')
        if (saved) setOfficerNotificationPreferences(JSON.parse(saved))
      }
    } catch {
      // ignore
    }
  }, [currentUser?.organizationId])

  const [loading, setLoading] = useState(true)

  const refreshPortalData = useCallback(async () => {
    try {
      const activeUserId = currentUser?.dbUserId ?? currentUser?.id ?? currentUser?.userId
      const notifsUrl = activeUserId ? `/api/notifications?user_id=${activeUserId}` : '/api/notifications'

      const [
        orgsRes,
        eventsRes,
        membersRes,
        appsRes,
        regsRes,
        docsRes,
        annRes,
        usersRes,
        notifsRes,
        logsRes,
        advisersRes,
        adviserReqRes,
        hierarchyRes,
      ] = await Promise.all([
        fetch('/api/organizations?all=true').catch(() => null),
        fetch('/api/events?all=true').catch(() => null),
        fetch('/api/members').catch(() => null),
        fetch('/api/members/applications').catch(() => null),
        fetch('/api/attendance/registrations').catch(() => null),
        fetch('/api/documents').catch(() => null),
        fetch('/api/announcements').catch(() => null),
        fetch('/api/users').catch(() => null),
        fetch(notifsUrl).catch(() => null),
        fetch('/api/audit-logs').catch(() => null),
        fetch('/api/advisers').catch(() => null),
        fetch('/api/advisers/requests').catch(() => null),
        fetch('/api/academic/hierarchy').catch(() => null),
      ])

      if (orgsRes?.ok) setRawOrganizations(await orgsRes.json())
      if (eventsRes?.ok) setRawEvents(await eventsRes.json())
      if (membersRes?.ok) setRawMembers(await membersRes.json())
      if (appsRes?.ok) setRawApplications(await appsRes.json())
      if (regsRes?.ok) setRawRegistrations(await regsRes.json())
      if (docsRes?.ok) setRawDocuments(await docsRes.json())
      if (annRes?.ok) setRawAnnouncements(await annRes.json())
      if (usersRes?.ok) setRawUsers(await usersRes.json())
      if (notifsRes?.ok) setRawNotifications(await notifsRes.json())
      if (logsRes?.ok) setRawAuditLogs(await logsRes.json())
      if (advisersRes?.ok) setRawAdvisers(await advisersRes.json())
      if (adviserReqRes?.ok) setRawAdviserChangeRequests(await adviserReqRes.json())
      if (hierarchyRes?.ok) setAcademicHierarchy(await hierarchyRes.json())
    } finally {
      setLoading(false)
    }
  }, [currentUser?.id, currentUser?.dbUserId, currentUser?.userId])

  useEffect(() => {
    refreshPortalData()
  }, [refreshPortalData])

  // Derived normalized lists reflecting every database table
  const adminOrganizations = useMemo(
    () => rawOrganizations.map((org) => ({
      ...normalizeOrganization(org, rawMembers, rawAnnouncements, rawDocuments),
      notificationPreferences: officerNotificationPreferences,
    })),
    [rawOrganizations, rawMembers, rawAnnouncements, rawDocuments, officerNotificationPreferences]
  )

  const studentOrganizations = useMemo(
    () => adminOrganizations.filter((org) => org.status === 'ACTIVE'),
    [adminOrganizations]
  )

  const officerAnnouncements = useMemo(
    () => rawAnnouncements.map(normalizeAnnouncement),
    [rawAnnouncements]
  )

  const officerEvents = useMemo(
    () => rawEvents.map(normalizeEvent),
    [rawEvents]
  )

  const officerMembers = useMemo(
    () => rawMembers.map(normalizeMember),
    [rawMembers]
  )

  const officerMemberCount = useMemo(() => {
    const activeOrgId = currentUser?.organizationId || adminOrganizations[0]?.id
    if (!activeOrgId) return officerMembers.filter((m) => m.status === 'ACTIVE').length
    return officerMembers.filter(
      (m) => m.status === 'ACTIVE' && String(m.organizationId) === String(activeOrgId)
    ).length
  }, [officerMembers, currentUser?.organizationId, adminOrganizations])

  const officerMembershipRequests = useMemo(
    () => rawApplications.map(normalizeApplication),
    [rawApplications]
  )

  const studentMemberships = useMemo(() => {
    const activeEntries = officerMembers.map((m) => ({
      id: `MEM-${m.id}`,
      membershipId: m.membershipId,
      organizationId: m.organizationId,
      organizationName: m.organizationName,
      studentId: m.studentId,
      studentRecordId: m.studentRecordId,
      studentDbId: m.studentRecordId,
      userId: m.userId,
      position: m.position,
      status: m.status,
      approvedDate: m.approvedDate,
      applicationDate: m.joinedDate,
      dateJoined: m.dateJoined,
    }))
    const pendingEntries = officerMembershipRequests
      .filter((app) => app.status === 'PENDING')
      .map((app) => ({
        id: `APP-${app.id}`,
        applicationId: app.applicationId,
        organizationId: app.organizationId,
        organizationName: app.organizationName,
        studentId: app.studentId,
        studentRecordId: app.studentRecordId,
        studentDbId: app.studentRecordId,
        userId: app.userId,
        position: app.desiredRole || 'General Member',
        status: 'PENDING',
        applicationDate: app.applicationDate,
      }))
    return [...activeEntries, ...pendingEntries]
  }, [officerMembers, officerMembershipRequests])

  const getMembershipForOrganization = useCallback(
    (organizationId) =>
      studentMemberships.find(
        (m) =>
          String(m.organizationId) === String(organizationId) &&
          ((currentUser?.studentRecordId && String(m.studentRecordId) === String(currentUser.studentRecordId)) ||
            (currentUser?.studentDbId && String(m.studentDbId) === String(currentUser.studentDbId)) ||
            (currentUser?.userId && String(m.userId) === String(currentUser.userId)) ||
            (currentUser?.id && String(m.userId) === String(currentUser.id)) ||
            (currentUser?.studentId && String(m.studentId).toLowerCase() === String(currentUser.studentId).toLowerCase()))
      ) || null,
    [studentMemberships, currentUser]
  )

  const studentRegistrations = useMemo(
    () => rawRegistrations.map(normalizeRegistration),
    [rawRegistrations]
  )

  const adviserDocuments = useMemo(
    () => rawDocuments.map(normalizeDocument),
    [rawDocuments]
  )

  const adviserReports = useMemo(
    () =>
      adviserDocuments
        .filter((d) =>
          ['REPORT', 'EVENT_REPORT', 'FINANCIAL_REPORT', 'ACCOMPLISHMENT_REPORT'].includes(d.docType) ||
          d.title?.toLowerCase().includes('report') ||
          d.title?.toLowerCase().includes('accomplishment')
        )
        .map((d) => {
          let metadata = {}
          if (d.reviewRemarks) {
            if (typeof d.reviewRemarks === 'object') {
              metadata = d.reviewRemarks
            } else {
              try {
                const trimmed = String(d.reviewRemarks).trim()
                if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
                  metadata = JSON.parse(trimmed)
                }
              } catch {
                metadata = {}
              }
            }
          }

          let attendanceCount = 0
          if (metadata.attendance !== undefined && metadata.attendance !== null && metadata.attendance !== '') {
            const num = Number(String(metadata.attendance).replace(/\D+/g, ''))
            if (Number.isFinite(num)) attendanceCount = num
          }
          if (!attendanceCount && d.reviewRemarks && typeof d.reviewRemarks === 'string' && /attendees?:\s*(\d+)/i.test(d.reviewRemarks)) {
            const match = d.reviewRemarks.match(/attendees?:\s*(\d+)/i)
            if (match) attendanceCount = parseInt(match[1], 10)
          }

          // Match associated event from officerEvents to populate venue, time, registration stats
          const matchedEvent = officerEvents.find((e) =>
            (metadata.eventId && String(e.id) === String(metadata.eventId)) ||
            (metadata.event_id && String(e.id) === String(metadata.event_id)) ||
            (e.title && d.title?.toLowerCase().includes(e.title.toLowerCase())) ||
            (e.title && d.title?.toLowerCase().startsWith(e.title.toLowerCase().slice(0, 15)))
          )

          const parsedEventDate = metadata.eventDate || matchedEvent?.date || d.submittedDate
          const registered = Number(metadata.registeredCount || metadata.registered || matchedEvent?.registeredCount || matchedEvent?.capacity || 0)
          const actualAttendees = attendanceCount || matchedEvent?.attendedCount || matchedEvent?.attendance || 0

          return {
            id: d.id,
            documentId: d.documentId,
            organizationId: d.organizationId,
            organizationName: d.organizationName,
            eventTitle: d.title,
            title: d.title,
            eventDate: parsedEventDate,
            date: parsedEventDate,
            time: metadata.time || matchedEvent?.time || 'Not provided',
            venue: metadata.venue || matchedEvent?.venue || matchedEvent?.location || 'Not provided',
            location: metadata.venue || matchedEvent?.location || matchedEvent?.venue || 'Not provided',
            submittedDate: d.submittedDate,
            submissionDate: d.submittedDate,
            submittedBy: d.submittedBy,
            attendance: actualAttendees,
            actualAttendees: actualAttendees,
            registered: registered > 0 ? registered : null,
            registeredCount: registered > 0 ? registered : null,
            noShows: registered > actualAttendees ? registered - actualAttendees : (registered > 0 ? 0 : null),
            turnoutRate: registered > 0 ? `${((actualAttendees / registered) * 100).toFixed(1)}%` : null,
            status:
              d.status === 'APPROVED'
                ? 'VERIFIED'
                : d.status === 'REJECTED'
                  ? 'RETURNED'
                  : 'PENDING_VERIFICATION',
            verifiedBy: d.processedBy,
            decisionDate: d.reviewedAt,
            revisionNote: (d.status === 'REJECTED' || Boolean(d.reviewedAt))
              ? (metadata.adviserRemarks || (typeof d.reviewRemarks === 'string' && !d.reviewRemarks.trim().startsWith('{') ? d.reviewRemarks.trim() : ''))
              : '',
            supportingDocuments: d.fileUrl ? [d.fileUrl] : [],
            // Accomplishment Narrative fields for AdviserReviewDialog & Officer details view
            objectives: metadata.objectives || '',
            activitiesConducted: metadata.activitiesConducted || metadata.activities || '',
            activities: metadata.activitiesConducted || metadata.activities || '',
            results: metadata.results || metadata.summary || '',
            outcomes: metadata.results || metadata.summary || '',
            problemsEncountered: metadata.problemsEncountered || metadata.problems || '',
            problems: metadata.problemsEncountered || metadata.problems || '',
            recommendations: metadata.recommendations || '',
            description: metadata.summary || metadata.results || metadata.objectives || matchedEvent?.description || '',
          }
        }),
    [adviserDocuments, officerEvents]
  )

  const adminUsers = useMemo(
    () => rawUsers.map(normalizeUser),
    [rawUsers]
  )

  const notifications = useMemo(
    () => rawNotifications.map(normalizeNotification),
    [rawNotifications]
  )

  const officerNotifications = useMemo(
    () => notifications.filter((n) => isNotificationAllowedByPreferences(n, officerNotificationPreferences)),
    [notifications, officerNotificationPreferences]
  )

  const adminNotifications = useMemo(
    () => notifications.filter((n) => isAdminNotificationAllowedByPreferences(n, adminSettings?.notifications)),
    [notifications, adminSettings?.notifications]
  )

  const adminAuditLogs = useMemo(
    () => rawAuditLogs.map(normalizeAuditLog),
    [rawAuditLogs]
  )

  const organizationApplications = useMemo(
    () =>
      adminOrganizations
        .filter((org) => org.accreditationStatus === 'PENDING' || org.status === 'PENDING')
        .map((org) => ({
          id: org.id,
          organizationId: org.id,
          name: org.name,
          acronym: org.acronym,
          category: org.category,
          scope: org.scope,
          college: org.college,
          department: org.department,
          adviser: org.adviser,
          submittedBy: org.officers[0]?.name || 'Organization Representative',
          submittedDate: org.establishedDate,
          status: org.accreditationStatus === 'ACCREDITED' ? 'APPROVED' : org.accreditationStatus,
          mission: org.mission,
          vision: org.vision,
          proposedOfficers: org.officers,
          documents: org.documents,
        })),
    [adminOrganizations]
  )

  const captureUndo = useCallback(() => () => {}, [])

  // --- API Action Handlers ---

  const submitMembershipRequest = useCallback(async (orgParam, payload = {}) => {
    const orgId = typeof orgParam === 'object' && orgParam !== null
      ? (orgParam.id ?? orgParam.organizationId ?? orgParam.organization_id)
      : orgParam

    if (!orgId) {
      return { ok: false, error: 'Invalid organization.' }
    }

    const studentId = payload.studentRecordId
      || payload.student_id
      || currentUser?.studentRecordId
      || currentUser?.studentDbId
      || currentUser?.student_id
      || null

    const userId = currentUser?.user_id || currentUser?.id || null

    if (!studentId && !userId) {
      return { ok: false, error: 'You must be signed in as a student to apply.' }
    }

    try {
      const response = await fetch('/api/members/applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organization_id: Number(orgId),
          student_id: studentId,
          user_id: userId,
          desired_role: payload.desiredRole || 'Member',
          reason: payload.message || payload.reason || 'Applied via Student Portal',
        }),
      })

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}))
        return { ok: false, error: errData.error || 'Unable to submit membership application.' }
      }

      await refreshPortalData()
      return { ok: true }
    } catch (err) {
      return { ok: false, error: err.message || 'Network error submitting application.' }
    }
  }, [currentUser, refreshPortalData])

  const approveOfficerMembershipRequest = useCallback(async (applicationId, position = 'MEMBER', customTitle = null) => {
    const response = await fetch(`/api/members/applications/${applicationId}/review`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: 'APPROVED',
        reviewed_by: currentUser?.userId || currentUser?.id || null,
        position,
        custom_title: customTitle,
      }),
    })
    if (!response.ok) {
      const err = await response.json().catch(() => ({}))
      return { ok: false, error: err.error || 'Unable to approve membership request.' }
    }
    await refreshPortalData()
    await refreshCurrentUser()
    return { ok: true }
  }, [currentUser, refreshPortalData, refreshCurrentUser])

  const rejectOfficerMembershipRequest = useCallback(async (applicationId, reason = '') => {
    const response = await fetch(`/api/members/applications/${applicationId}/review`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: 'REJECTED',
        reviewed_by: currentUser?.userId || currentUser?.id || null,
        review_remarks: reason,
        reason,
      }),
    })
    if (!response.ok) return false
    await refreshPortalData()
    await refreshCurrentUser()
    return true
  }, [currentUser, refreshPortalData, refreshCurrentUser])

  const assignOfficerPosition = useCallback(async (membershipId, nextPosition, customTitle = '') => {
    try {
      const response = await fetch(`/api/members/${membershipId}/position`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          position: nextPosition,
          custom_title: customTitle,
        }),
      })
      if (!response.ok) {
        const err = await response.json().catch(() => ({}))
        return { ok: false, reason: err.error || 'Unable to assign officer position.' }
      }
      await refreshPortalData()
      await refreshCurrentUser()
      return { ok: true }
    } catch {
      return { ok: false, reason: 'Network error while updating member position.' }
    }
  }, [refreshPortalData, refreshCurrentUser])

  const updateOfficerMemberStatus = useCallback(async (membershipId, nextStatus) => {
    const response = await fetch(`/api/members/${membershipId}/position`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: nextStatus,
      }),
    })
    if (!response.ok) return false
    await refreshPortalData()
    return true
  }, [refreshPortalData])

  const registerForEvent = useCallback(async (eventId) => {
    const studentId = currentUser?.studentRecordId || currentUser?.studentDbId || currentUser?.student_id || currentUser?.id
    if (!studentId) return false
    const response = await fetch('/api/attendance/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event_id: eventId,
        student_id: studentId,
        user_id: currentUser?.dbUserId || currentUser?.id || currentUser?.userId,
      }),
    })
    if (!response.ok) return false
    await refreshPortalData()
    await refreshCurrentUser()
    return true
  }, [currentUser, refreshPortalData, refreshCurrentUser])

  const cancelEventRegistration = useCallback(async (registrationOrEventId) => {
    const reg = studentRegistrations.find(
      (r) =>
        String(r.id) === String(registrationOrEventId) ||
        String(r.registrationId) === String(registrationOrEventId) ||
        (String(r.eventId) === String(registrationOrEventId) &&
          String(r.studentId) === String(currentUser?.studentId))
    )
    if (!reg) return false
    const response = await fetch(`/api/attendance/registrations/${reg.registrationId}/cancel`, {
      method: 'PUT',
    })
    if (!response.ok) return false
    await refreshPortalData()
    return true
  }, [studentRegistrations, currentUser?.studentId, refreshPortalData])

  const checkInStudent = useCallback(async (eventId, registrationCodeOrStudentId) => {
    const code = String(registrationCodeOrStudentId || '').trim()
    if (!code) return { ok: false, message: 'Enter a student registration code or Employee/Student ID.' }

    const matchedReg = studentRegistrations.find(
      (r) =>
        String(r.eventId) === String(eventId) &&
        (String(r.id).toUpperCase() === code.toUpperCase() ||
          String(r.studentId).toUpperCase() === code.toUpperCase() ||
          `UNIDOS-${String(r.id).toUpperCase()}` === code.toUpperCase())
    )

    const response = await fetch('/api/attendance/check-in', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event_id: eventId,
        student_id: matchedReg?.studentRecordId || undefined,
        student_number: matchedReg?.studentId || code,
        recorded_by: currentUser?.userId || null,
        status: 'PRESENT',
      }),
    })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) {
      return { ok: false, message: payload.error || 'Unable to record attendance for this code.' }
    }
    await refreshPortalData()
    return {
      ok: true,
      message: `Attendance recorded for ${matchedReg?.studentId || code}.`,
      data: payload,
    }
  }, [studentRegistrations, currentUser?.userId, refreshPortalData])

  const getEventAttendanceCode = useCallback(async (eventId) => {
    if (!eventId) return null
    try {
      const res = await fetch(`/api/attendance/event/${eventId}/code`)
      if (!res.ok) return null
      return await res.json()
    } catch {
      return null
    }
  }, [])

  const generateEventAttendanceCode = useCallback(async (eventId, action = 'generate', active) => {
    if (!eventId) return null
    try {
      const res = await fetch(`/api/attendance/event/${eventId}/code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, active }),
      })
      if (!res.ok) return null
      return await res.json()
    } catch {
      return null
    }
  }, [])

  const attendWithEventCode = useCallback(async ({ eventId, code }) => {
    const cleanCode = String(code || '').trim()
    if (!eventId || !cleanCode) {
      return { ok: false, message: 'Please provide both an event and the attendance code.' }
    }
    try {
      const res = await fetch('/api/attendance/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_id: eventId,
          code: cleanCode,
          student_id: currentUser?.studentRecordId || currentUser?.studentId,
          student_number: currentUser?.studentId,
          user_id: currentUser?.userId,
        }),
      })
      const payload = await res.json().catch(() => ({}))
      if (!res.ok) {
        return { ok: false, message: payload.error || 'Failed to verify attendance code.' }
      }
      await refreshPortalData()
      return {
        ok: true,
        alreadyCheckedIn: Boolean(payload.alreadyCheckedIn),
        message: payload.message || 'Attendance recorded successfully!',
        data: payload,
      }
    } catch (err) {
      return { ok: false, message: err.message || 'Network error while recording attendance.' }
    }
  }, [currentUser, refreshPortalData])

  const toggleStudentAttendance = useCallback(async ({ eventId, studentId, status }) => {
    if (!eventId || !studentId) return { ok: false, message: 'Missing event or student ID.' }
    try {
      const res = await fetch('/api/attendance/manual-toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_id: eventId,
          student_id: studentId,
          status,
          recorded_by: currentUser?.userId || null,
        }),
      })
      const payload = await res.json().catch(() => ({}))
      if (!res.ok) {
        return { ok: false, message: payload.error || 'Unable to update attendance.' }
      }
      await refreshPortalData()
      return { ok: true, message: payload.message || 'Attendance updated.', data: payload }
    } catch (err) {
      return { ok: false, message: err.message || 'Network error.' }
    }
  }, [currentUser?.userId, refreshPortalData])

  const saveOfficerEvent = useCallback(async (eventPayload, statusOverride) => {
    const orgId = eventPayload.organizationId || currentUser?.organizationId || adminOrganizations[0]?.id
    if (!orgId) return null

    const rawDate = eventPayload.startDatetime || eventPayload.date || new Date().toISOString()
    const parsedDate = new Date(rawDate)
    const baseIsoDate = Number.isNaN(parsedDate.getTime())
      ? new Date().toISOString().slice(0, 10)
      : parsedDate.toISOString().slice(0, 10)

    const startIso = eventPayload.startTime && /^\d{2}:\d{2}/.test(eventPayload.startTime)
      ? `${baseIsoDate}T${eventPayload.startTime}:00`
      : (Number.isNaN(parsedDate.getTime()) ? new Date().toISOString() : parsedDate.toISOString())

    const endIso = eventPayload.endTime && /^\d{2}:\d{2}/.test(eventPayload.endTime)
      ? `${baseIsoDate}T${eventPayload.endTime}:00`
      : startIso

    const targetStatus = statusOverride || eventPayload.status || 'PENDING'
    const dbStatus = ['SUBMITTED', 'UNDER_REVIEW', 'DRAFT'].includes(targetStatus) ? 'PENDING' : targetStatus

    const isUpdate = Boolean(eventPayload.id || eventPayload.eventId)
    const url = isUpdate ? `/api/events/${eventPayload.id || eventPayload.eventId}` : '/api/events'
    const method = isUpdate ? 'PUT' : 'POST'

    const response = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        organization_id: orgId,
        title: eventPayload.title,
        description: eventPayload.description,
        venue: eventPayload.location || eventPayload.venue,
        location: eventPayload.location || eventPayload.venue,
        start_date: startIso,
        start_datetime: startIso,
        end_date: endIso,
        end_datetime: endIso,
        event_type: eventPayload.category || eventPayload.eventType || 'Academic',
        category: eventPayload.category || eventPayload.eventType || 'Academic',
        status: dbStatus,
        max_participants: Number(eventPayload.capacity || 100),
        capacity: Number(eventPayload.capacity || 100),
        created_by: currentUser?.dbUserId || currentUser?.id || currentUser?.userId || null,
      }),
    })
    if (!response.ok) return null
    const saved = await response.json()
    await refreshPortalData()
    return normalizeEvent(saved)
  }, [currentUser?.organizationId, currentUser?.userId, currentUser?.dbUserId, currentUser?.id, adminOrganizations, refreshPortalData])

  const reviewAdviserRequest = useCallback(async (kindOrId, idOrStatus, decisionOrReason = '', commentMaybe = '') => {
    // Support both 4-arg (kind, id, decision, comment) and 3-arg (id, status, reason)
    let kind = 'EVENT'
    let itemId = kindOrId
    let nextStatus = idOrStatus
    if (['EVENT', 'DOCUMENT'].includes(String(kindOrId).toUpperCase()) && commentMaybe !== undefined && decisionOrReason !== '') {
      kind = String(kindOrId).toUpperCase()
      itemId = idOrStatus
      nextStatus = decisionOrReason
    } else if (['EVENT', 'DOCUMENT'].includes(String(kindOrId).toUpperCase())) {
      kind = String(kindOrId).toUpperCase()
      itemId = idOrStatus
      nextStatus = decisionOrReason
    }

    if (kind === 'DOCUMENT') {
      const docStatus = nextStatus === 'RETURNED' ? 'REJECTED' : nextStatus
      const response = await fetch(`/api/documents/${itemId}/review`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: docStatus,
          reviewed_by: currentUser?.dbUserId || currentUser?.id || null,
          review_remarks: commentMaybe || decisionOrReason || '',
        }),
      })
      if (!response.ok) return false
      await refreshPortalData()
      return true
    }

    const dbStatus = ['RETURNED', 'RETURNED_FOR_REVISION'].includes(nextStatus)
      ? 'CANCELLED'
      : nextStatus === 'APPROVED'
        ? 'APPROVED'
        : 'REJECTED'

    const response = await fetch(`/api/events/${itemId}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: dbStatus,
        approved_by: currentUser?.dbUserId || currentUser?.id || null,
      }),
    })
    if (!response.ok) return false
    await refreshPortalData()
    await refreshCurrentUser()
    return true
  }, [currentUser, refreshPortalData, refreshCurrentUser])

  const reviewAccomplishmentReport = useCallback(async (reportId, decision, comment = '') => {
    const docStatus = decision === 'VERIFIED' || decision === 'APPROVED' ? 'APPROVED' : 'REJECTED'
    const response = await fetch(`/api/documents/${reportId}/review`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: docStatus,
        reviewed_by: currentUser?.dbUserId || currentUser?.id || null,
        review_remarks: comment.trim(),
      }),
    })
    if (!response.ok) return false
    await refreshPortalData()
    await refreshCurrentUser()
    return true
  }, [currentUser, refreshPortalData, refreshCurrentUser])

  const reviewAdminEvent = useCallback(async (eventId, decision) => {
    const dbStatus = decision === 'APPROVED' ? 'APPROVED' : decision === 'RETURNED' ? 'PENDING' : 'REJECTED'
    const response = await fetch(`/api/events/${eventId}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: dbStatus,
        approved_by: currentUser?.dbUserId || currentUser?.id || null,
        is_published: decision === 'APPROVED' ? false : undefined,
      }),
    })
    if (!response.ok) return false
    await refreshPortalData()
    await refreshCurrentUser()
    return true
  }, [currentUser, refreshPortalData, refreshCurrentUser])

  const publishAdminEvent = useCallback(async (eventId) => {
    const response = await fetch(`/api/events/${eventId}/publish`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        approved_by: currentUser?.dbUserId || currentUser?.id || null,
      }),
    })
    if (!response.ok) return false
    await refreshPortalData()
    await refreshCurrentUser()
    return true
  }, [currentUser, refreshPortalData, refreshCurrentUser])

  const saveOfficerAnnouncement = useCallback(async (announcementPayload) => {
    const orgId = announcementPayload.organizationId || currentUser?.organizationId || adminOrganizations[0]?.id
    if (!orgId) return false
    const isUpdate = Boolean(announcementPayload.id || announcementPayload.announcementId)
    const url = isUpdate
      ? `/api/announcements/${announcementPayload.id || announcementPayload.announcementId}`
      : '/api/announcements'
    const method = isUpdate ? 'PUT' : 'POST'

    const response = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        organization_id: orgId,
        title: announcementPayload.title,
        content: announcementPayload.content || announcementPayload.description,
        is_pinned: Boolean(announcementPayload.isPinned),
        published_at: announcementPayload.status === 'DRAFT' ? null : new Date().toISOString(),
        created_by: currentUser?.dbUserId || currentUser?.id || currentUser?.userId || null,
      }),
    })
    if (!response.ok) return false
    await refreshPortalData()
    return true
  }, [currentUser?.organizationId, currentUser?.userId, currentUser?.dbUserId, currentUser?.id, adminOrganizations, refreshPortalData])

  const archiveOfficerAnnouncement = useCallback(async (announcementId) => {
    const existing = rawAnnouncements.find((a) => String(a.announcement_id) === String(announcementId))
    if (!existing) return false
    const response = await fetch(`/api/announcements/${announcementId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: existing.title,
        content: existing.content,
        is_pinned: false,
      }),
    })
    if (!response.ok) return false
    await refreshPortalData()
    return true
  }, [rawAnnouncements, refreshPortalData])

  const deleteOfficerAnnouncement = useCallback(async (announcementId) => {
    const response = await fetch(`/api/announcements/${announcementId}`, {
      method: 'DELETE',
    })
    if (!response.ok) return false
    await refreshPortalData()
    return true
  }, [refreshPortalData])

  const addOfficerDocument = useCallback(async (docPayload) => {
    const orgId = docPayload.organizationId || currentUser?.organizationId || adminOrganizations[0]?.id
    if (!orgId) return false

    // =========================================================================
    // [GOOGLE DRIVE API PLACEHOLDER - FRONTEND DOCUMENT / IMAGE UPLOAD]
    // Insert Google Drive API client upload call here if uploading directly from
    // client or via `/api/documents` multipart upload to Google Drive folder,
    // then pass the returned Google Drive `webViewLink` / `webContentLink` as `file_url`.
    //
    //   ...
    //
    // =========================================================================

    const response = await fetch('/api/documents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        organization_id: orgId,
        title: docPayload.title,
        doc_type: docPayload.type || docPayload.docType || 'OTHER',
        file_url: docPayload.fileUrl || docPayload.fileName || '/uploads/pending-google-drive-link',
        academic_year: docPayload.academicYear || adminSettings.academicYear,
        semester: docPayload.semester || adminSettings.semester,
        uploaded_by: currentUser?.dbUserId || currentUser?.id || null,
        review_remarks: null,
      }),
    })
    if (!response.ok) return false
    await refreshPortalData()
    return true
  }, [currentUser?.organizationId, currentUser?.dbUserId, currentUser?.id, adminOrganizations, adminSettings, refreshPortalData])

  const addOfficerAccomplishmentReport = useCallback(async (reportPayload) => {
    const orgId = reportPayload.organizationId || currentUser?.organizationId || adminOrganizations[0]?.id
    if (!orgId || !reportPayload.title) return false

    // =========================================================================
    // [DATABASE LINK: DOCUMENTS TABLE - ACCOMPLISHMENT REPORT]
    // In database/student_org_db.sql, accomplishment reports map directly
    // to the `documents` table using `type = 'REPORT'`.
    // Supporting metadata (attendees count, activity date, highlights)
    // is stored in `review_remarks` or title.
    // If a dedicated accomplishment_reports table is added in the database schema,
    // this comment marks the exact endpoint integration point.
    // =========================================================================

    const resolvedTitle = reportPayload.title.trim()
    const metadata = {
      eventId: reportPayload.eventId || null,
      venue: (reportPayload.venue || '').trim(),
      time: (reportPayload.time || '').trim(),
      registeredCount: reportPayload.registeredCount !== undefined && reportPayload.registeredCount !== null ? Number(reportPayload.registeredCount) : null,
      attendance: reportPayload.attendance !== undefined && reportPayload.attendance !== null && reportPayload.attendance !== '' ? Number(reportPayload.attendance) : null,
      eventDate: reportPayload.eventDate || new Date().toISOString().slice(0, 10),
      objectives: (reportPayload.objectives || '').trim(),
      activitiesConducted: (reportPayload.activitiesConducted || reportPayload.activities || '').trim(),
      results: (reportPayload.results || reportPayload.summary || '').trim(),
      problemsEncountered: (reportPayload.problemsEncountered || reportPayload.problems || '').trim(),
      recommendations: (reportPayload.recommendations || '').trim(),
      summary: (reportPayload.summary || reportPayload.results || reportPayload.objectives || '').trim(),
      adviserRemarks: '',
    }
    const remarksJson = JSON.stringify(metadata)

    // =========================================================================
    // [GOOGLE DRIVE API PLACEHOLDER — REPORT ATTACHMENT UPLOAD]
    // Insert Google Drive API multipart upload here to upload report PDF/images
    // and assign the generated Google Drive webViewLink to `file_url`.
    // =========================================================================
    const fileUrl = reportPayload.fileUrl || reportPayload.fileName
      ? `/reports/${encodeURIComponent(reportPayload.fileName || resolvedTitle)}`
      : `/reports/${encodeURIComponent(resolvedTitle)}.pdf`

    const response = await fetch('/api/documents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        organization_id: orgId,
        title: resolvedTitle,
        type: 'REPORT',
        file_url: fileUrl,
        academic_year: reportPayload.academicYear || adminSettings.academicYear,
        semester: reportPayload.semester || adminSettings.semester,
        uploaded_by: currentUser?.dbUserId || currentUser?.id || null,
        review_remarks: remarksJson,
        ...metadata,
      }),
    })

    if (!response.ok) return false
    await refreshPortalData()
    return true
  }, [currentUser?.organizationId, currentUser?.dbUserId, currentUser?.id, adminOrganizations, adminSettings, refreshPortalData])

  const reviewAdviserDocument = useCallback(async (documentId, status, remarks = '') => {
    const response = await fetch(`/api/documents/${documentId}/review`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status,
        reviewed_by: currentUser?.dbUserId || currentUser?.id || null,
        review_remarks: remarks,
      }),
    })
    if (!response.ok) return false
    await refreshPortalData()
    await refreshCurrentUser()
    return true
  }, [currentUser, refreshPortalData, refreshCurrentUser])

  const updateOfficerOrganizationProfile = useCallback(async (orgUpdates) => {
    const orgId = orgUpdates.id || orgUpdates.organizationId || currentUser?.organizationId || adminOrganizations[0]?.id
    if (!orgId) return false
    const currentOrg = rawOrganizations.find((o) => String(o.organization_id) === String(orgId))
    if (!currentOrg) return false

    // =========================================================================
    // [GOOGLE DRIVE API PLACEHOLDER - ORGANIZATION LOGO IMAGE]
    // Insert Google Drive API image upload call here so `orgUpdates.logo` stores
    // the Google Drive image link (`https://drive.google.com/uc?id=...`).
    //
    //   ...
    //
    // =========================================================================

    const response = await fetch(`/api/organizations/${orgId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: orgUpdates.name ?? currentOrg.name,
        acronym: orgUpdates.acronym ?? currentOrg.acronym,
        org_type: orgUpdates.category || orgUpdates.orgType || currentOrg.org_type,
        scope: orgUpdates.scope ?? currentOrg.scope,
        college_id: orgUpdates.collegeId ?? currentOrg.college_id,
        department_id: orgUpdates.departmentId ?? currentOrg.department_id,
        description: orgUpdates.description ?? currentOrg.description,
        mission: orgUpdates.mission ?? currentOrg.mission,
        vision: orgUpdates.vision ?? currentOrg.vision,
        logo: orgUpdates.logo !== undefined ? orgUpdates.logo : currentOrg.logo,
        status: orgUpdates.status ?? currentOrg.status,
        accreditation_status: orgUpdates.accreditationStatus ?? currentOrg.accreditation_status,
        approved_by: currentUser?.dbUserId || currentUser?.id || null,
      }),
    })
    if (!response.ok) return false
    await refreshPortalData()
    return true
  }, [currentUser?.organizationId, currentUser?.dbUserId, currentUser?.id, adminOrganizations, rawOrganizations, refreshPortalData])

  const updateOfficerOrganizationLogo = useCallback(async (logoData) => {
    return updateOfficerOrganizationProfile({ logo: logoData })
  }, [updateOfficerOrganizationProfile])

  const updateOfficerOrganizationContact = useCallback(async (contactValues) => {
    const orgId = currentUser?.organizationId || adminOrganizations[0]?.id
    if (!orgId) return false
    const currentOrg = rawOrganizations.find((o) => String(o.organization_id) === String(orgId))
    if (!currentOrg) return false
    const contactSummary = [
      contactValues.officialEmail ? `Email: ${contactValues.officialEmail}` : '',
      contactValues.contactNumber ? `Phone: ${contactValues.contactNumber}` : '',
      contactValues.socialMedia ? `Page: ${contactValues.socialMedia}` : '',
    ].filter(Boolean).join(' | ')
    return updateOfficerOrganizationProfile({
      description: contactSummary || currentOrg.description,
    })
  }, [currentUser?.organizationId, adminOrganizations, rawOrganizations, updateOfficerOrganizationProfile])

  const saveOfficerNotificationPreferences = useCallback((newPrefs) => {
    if (!newPrefs || typeof newPrefs !== 'object') return false
    try {
      if (typeof window !== 'undefined') {
        const activeOrgId = currentUser?.organizationId || 'default'
        localStorage.setItem(`soms_officer_notification_preferences_${activeOrgId}`, JSON.stringify(newPrefs))
        localStorage.setItem('soms_officer_notification_preferences', JSON.stringify(newPrefs))
      }
      setOfficerNotificationPreferences(newPrefs)
      return true
    } catch {
      return false
    }
  }, [currentUser?.organizationId])

  const submitOfficerOrganizationRequest = useCallback(async (requestType, reason, requestedAdviserId) => {
    const orgId = currentUser?.organizationId || adminOrganizations[0]?.id
    if (!orgId || !reason?.trim()) return false

    if (requestType === 'ADVISER_CHANGE') {
      const targetAdviserId = requestedAdviserId || rawAdvisers[0]?.adviser_id
      if (!targetAdviserId) return false
      const response = await fetch('/api/advisers/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organization_id: orgId,
          requested_by: currentUser?.dbUserId || currentUser?.id || null,
          proposed_adviser_id: targetAdviserId,
          reason: reason.trim(),
        }),
      })
      if (!response.ok) return false
      await refreshPortalData()
      return true
    }

    await fetch('/api/audit-logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: currentUser?.dbUserId || currentUser?.id || null,
        action: `REQUEST_${requestType}`,
        entity_type: 'organizations',
        entity_id: orgId,
      }),
    }).catch(() => null)
    await refreshPortalData()
    return true
  }, [currentUser?.organizationId, currentUser?.dbUserId, currentUser?.id, adminOrganizations, rawAdvisers, refreshPortalData])

  const updateAdminOrganizationStatus = useCallback(async (organizationId, nextStatus) => {
    const response = await fetch(`/api/organizations/${organizationId}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: nextStatus,
        accreditation_status: nextStatus === 'ACTIVE' ? 'ACCREDITED' : undefined,
      }),
    })
    if (!response.ok) return false
    await refreshPortalData()
    return true
  }, [refreshPortalData])

  const updateAdminOrganization = useCallback(async (organizationId, changes) => {
    if (!changes?.name || !changes?.acronym) return false
    return updateOfficerOrganizationProfile({
      id: organizationId,
      name: changes.name,
      acronym: changes.acronym,
      category: changes.category,
    })
  }, [updateOfficerOrganizationProfile])

  const createAdminOrganization = useCallback(async (orgData) => {
    if (!orgData?.name?.trim()) return { ok: false, error: 'Organization name is required.' }
    try {
      const response = await fetch('/api/organizations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: orgData.name.trim(),
          acronym: orgData.acronym?.trim() || null,
          description: orgData.description?.trim() || null,
          category: orgData.category || 'Academic',
          scope: orgData.scope || 'UNIVERSITY',
          college_id: orgData.college_id ? Number(orgData.college_id) : null,
          department_id: orgData.department_id ? Number(orgData.department_id) : null,
          adviser_id: orgData.adviser_id ? Number(orgData.adviser_id) : null,
          status: orgData.status || 'ACTIVE',
          created_by: currentUser?.userId || null,
        }),
      })
      if (!response.ok) {
        const err = await response.json().catch(() => ({}))
        return { ok: false, error: err.error || 'Failed to create organization.' }
      }
      await refreshPortalData()
      return { ok: true }
    } catch (err) {
      return { ok: false, error: err.message || 'Network error creating organization.' }
    }
  }, [currentUser, refreshPortalData])

  const reviewOrganizationApplication = useCallback(async (organizationId, decision) => {
    const nextAccStatus = decision === 'APPROVED' ? 'ACCREDITED' : decision === 'REJECTED' ? 'REVOKED' : 'PENDING'
    const nextStatus = decision === 'APPROVED' ? 'ACTIVE' : decision === 'REJECTED' ? 'INACTIVE' : 'PENDING'
    const response = await fetch(`/api/organizations/${organizationId}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: nextStatus,
        accreditation_status: nextAccStatus,
      }),
    })
    if (!response.ok) return false
    await refreshPortalData()
    return true
  }, [refreshPortalData])

  const updateAdminUser = useCallback(async (userId, updates) => {
    const roleMap = {
      Student: 'STUDENT',
      'Organization Officer': 'OFFICER',
      'Faculty Adviser': 'ADVISER',
      'Student Affairs Admin': 'ADMIN',
    }
    const targetUser = rawUsers.find(
      (u) => String(u.id) === String(userId) || String(u.user_id) === String(userId) || String(u.student_number) === String(userId)
    )
    const dbId = targetUser?.id || targetUser?.user_id || userId
    const response = await fetch(`/api/users/${dbId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        first_name: updates.firstName,
        middle_name: updates.middleName,
        last_name: updates.lastName,
        suffix: updates.suffix,
        email: updates.email,
        role: roleMap[updates.role] || updates.rawRole || updates.role,
        status: updates.status,
      }),
    })
    if (!response.ok) {
      const err = await response.json().catch(() => ({}))
      return { ok: false, reason: err.error || 'Unable to update user account.' }
    }
    await refreshPortalData()
    return { ok: true }
  }, [rawUsers, refreshPortalData])

  const submitAdviserChangeRequest = useCallback(async (payload) => {
    const response = await fetch('/api/advisers/requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        organization_id: payload.organizationId || currentUser?.organizationId,
        requested_by: currentUser?.userId,
        current_adviser_id: payload.currentAdviserId || null,
        requested_adviser_id: payload.requestedAdviserId,
        reason: payload.reason,
      }),
    })
    if (!response.ok) return false
    await refreshPortalData()
    return true
  }, [currentUser?.organizationId, currentUser?.userId, refreshPortalData])

  const reviewAdviserChangeRequest = useCallback(async (requestId, status, reviewRemarks = '') => {
    const response = await fetch(`/api/advisers/requests/${requestId}/review`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status,
        reviewed_by: currentUser?.userId || null,
        review_remarks: reviewRemarks,
      }),
    })
    if (!response.ok) return false
    await refreshPortalData()
    await refreshCurrentUser()
    return true
  }, [currentUser, refreshPortalData, refreshCurrentUser])

  const assignOrganizationAdviser = useCallback(async (payload) => {
    const response = await fetch('/api/advisers/assign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        organization_id: payload.organizationId,
        adviser_id: payload.adviserId,
        term_start: payload.termStart,
        term_end: payload.termEnd,
      }),
    })
    if (!response.ok) return false
    await refreshPortalData()
    return true
  }, [refreshPortalData])

  const createAcademicCollege = useCallback(async (payload) => {
    const response = await fetch('/api/academic/colleges', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!response.ok) return false
    await refreshPortalData()
    return true
  }, [refreshPortalData])

  const createAcademicDepartment = useCallback(async (payload) => {
    const response = await fetch('/api/academic/departments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!response.ok) return false
    await refreshPortalData()
    return true
  }, [refreshPortalData])

  const createAcademicProgram = useCallback(async (payload) => {
    const response = await fetch('/api/academic/programs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!response.ok) return false
    await refreshPortalData()
    return true
  }, [refreshPortalData])

  const markNotificationRead = useCallback(async (notificationId) => {
    const id = typeof notificationId === 'object' ? notificationId?.id : notificationId
    if (!id) return false
    const response = await fetch(`/api/notifications/${id}/read`, {
      method: 'PUT',
    })
    if (!response.ok) return false
    await refreshPortalData()
    return true
  }, [refreshPortalData])

  const markAllNotificationsRead = useCallback(async () => {
    const targetUserId = currentUser?.dbUserId ?? currentUser?.id ?? currentUser?.userId
    if (!targetUserId) return false
    const response = await fetch(`/api/notifications/user/${targetUserId}/read-all`, {
      method: 'PUT',
    })
    if (!response.ok) return false
    await refreshPortalData()
    await refreshCurrentUser()
    return true
  }, [currentUser, refreshPortalData, refreshCurrentUser])

  const saveAdminSettings = useCallback((nextSettings) => {
    setAdminSettings((prev) => {
      const updated = { ...prev, ...nextSettings }
      try {
        if (typeof window !== 'undefined') {
          localStorage.setItem('soms_admin_settings', JSON.stringify(updated))
        }
      } catch {
        // ignore
      }
      return updated
    })
    return true
  }, [])

  const refreshAuditLogs = useCallback(async () => {
    try {
      const res = await fetch('/api/audit-logs')
      if (res.ok) {
        const logs = await res.json()
        setRawAuditLogs(logs)
        return logs
      }
    } catch (err) {
      console.warn('Failed to refresh audit logs', err)
    }
    return []
  }, [])

  const recordAuditLog = useCallback(async ({ action, entity, entityType, entityId, metadata, details, ipAddress }) => {
    try {
      const res = await fetch('/api/audit-logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: currentUser?.dbUserId || currentUser?.id || null,
          action,
          entity: entity || entityType || 'SYSTEM',
          entity_id: entityId || null,
          metadata: metadata || details || {},
          ip_address: ipAddress || '127.0.0.1',
        }),
      })
      if (res.ok) {
        const newLog = await res.json()
        setRawAuditLogs((prev) => [newLog, ...prev])
        return true
      }
    } catch (err) {
      console.warn('Failed to record audit log', err)
    }
    return false
  }, [currentUser])

  const value = useMemo(() => ({
    loading,
    refreshPortalData,
    refreshAuditLogs,
    recordAuditLog,
    captureUndo,
    appendAudit: captureUndo,
    adminOrganizations,
    studentOrganizations,
    organizationApplications,
    officerAnnouncements,
    officerEvents,
    officerMembers,
    officerMemberCount,
    officerMembershipRequests,
    studentMemberships,
    studentRegistrations,
    adviserDocuments,
    adviserReports,
    adviserActivity: notifications.length > 0
      ? notifications.map((n) => ({
          id: n.id,
          description: n.message,
          message: n.message,
          timestamp: n.createdAt,
          time: n.time,
        })).concat(adminAuditLogs)
      : adminAuditLogs,
    adminUsers,
    adminAuditLogs,
    adminSettings,
    academicHierarchy,
    academicColleges: academicHierarchy.colleges || [],
    academicDepartments: academicHierarchy.departments || [],
    academicPrograms: academicHierarchy.programs || [],
    advisers: rawAdvisers,
    adviserChangeRequests: rawAdviserChangeRequests,
    organizationChangeRequests: rawAdviserChangeRequests,
    studentNotifications: notifications,
    officerNotifications,
    adviserNotifications: notifications,
    adminNotifications,
    officerNotificationPreferences,
    readNotificationIds: notifications.filter((n) => n.read).map((n) => n.id),
    // Actions
    getMembershipForOrganization,
    submitMembershipRequest,
    submitMembershipApplication: submitMembershipRequest,
    approveOfficerMembershipRequest,
    rejectOfficerMembershipRequest,
    assignOfficerPosition,
    updateOfficerMemberStatus,
    registerForEvent,
    registerStudentForEvent: registerForEvent,
    cancelEventRegistration,
    cancelStudentRegistration: cancelEventRegistration,
    cancelRegistration: cancelEventRegistration,
    checkInStudent,
    addRegisteredStudent: checkInStudent,
    getEventAttendanceCode,
    generateEventAttendanceCode,
    attendWithEventCode,
    toggleStudentAttendance,
    saveOfficerEvent,
    reviewAdviserRequest,
    reviewAccomplishmentReport,
    reviewAdminEvent,
    publishAdminEvent,
    saveOfficerAnnouncement,
    archiveOfficerAnnouncement,
    deleteOfficerAnnouncement,
    uploadOfficerDocument: addOfficerDocument,
    addOfficerDocument,
    addOfficerAccomplishmentReport,
    submitAccomplishmentReport: addOfficerAccomplishmentReport,
    reviewAdviserDocument,
    reviewAdminDocument: reviewAdviserDocument,
    updateOfficerOrganizationProfile,
    updateOfficerOrganizationLogo,
    updateOfficerOrganizationContact,
    saveOfficerNotificationPreferences,
    submitOfficerOrganizationRequest,
    updateAdminOrganizationStatus,
    updateAdminOrganization,
    createAdminOrganization,
    createOrganization: createAdminOrganization,
    reviewOrganizationApplication,
    updateAdminUser,
    updateUserAccount: updateAdminUser,
    submitAdviserChangeRequest,
    reviewAdviserChangeRequest,
    assignOrganizationAdviser,
    createAcademicCollege,
    createAcademicDepartment,
    createAcademicProgram,
    markNotificationRead,
    markStudentNotificationRead: markNotificationRead,
    markAdminNotificationRead: markNotificationRead,
    markAllNotificationsRead,
    markAllStudentNotificationsRead: markAllNotificationsRead,
    markAllAdviserNotificationsRead: markAllNotificationsRead,
    markAllAdminNotificationsRead: markAllNotificationsRead,
    saveAdminSettings,
    updateAdminSettings: saveAdminSettings,
  }), [
    loading,
    refreshPortalData,
    captureUndo,
    adminOrganizations,
    studentOrganizations,
    organizationApplications,
    officerAnnouncements,
    officerEvents,
    officerMembers,
    officerMemberCount,
    officerMembershipRequests,
    studentMemberships,
    studentRegistrations,
    adviserDocuments,
    adviserReports,
    adminAuditLogs,
    adminUsers,
    adminSettings,
    academicHierarchy,
    rawAdvisers,
    rawAdviserChangeRequests,
    notifications,
    officerNotifications,
    adminNotifications,
    officerNotificationPreferences,
    getMembershipForOrganization,
    submitMembershipRequest,
    approveOfficerMembershipRequest,
    rejectOfficerMembershipRequest,
    assignOfficerPosition,
    updateOfficerMemberStatus,
    registerForEvent,
    cancelEventRegistration,
    checkInStudent,
    getEventAttendanceCode,
    generateEventAttendanceCode,
    attendWithEventCode,
    toggleStudentAttendance,
    saveOfficerEvent,
    reviewAdviserRequest,
    reviewAccomplishmentReport,
    reviewAdminEvent,
    publishAdminEvent,
    saveOfficerAnnouncement,
    archiveOfficerAnnouncement,
    deleteOfficerAnnouncement,
    addOfficerDocument,
    addOfficerAccomplishmentReport,
    reviewAdviserDocument,
    updateOfficerOrganizationProfile,
    updateOfficerOrganizationLogo,
    updateOfficerOrganizationContact,
    saveOfficerNotificationPreferences,
    submitOfficerOrganizationRequest,
    updateAdminOrganizationStatus,
    updateAdminOrganization,
    createAdminOrganization,
    reviewOrganizationApplication,
    updateAdminUser,
    submitAdviserChangeRequest,
    reviewAdviserChangeRequest,
    assignOrganizationAdviser,
    createAcademicCollege,
    createAcademicDepartment,
    createAcademicProgram,
    markNotificationRead,
    markAllNotificationsRead,
    saveAdminSettings,
    refreshAuditLogs,
    recordAuditLog,
  ])

  return <PortalDataContext.Provider value={value}>{children}</PortalDataContext.Provider>
}

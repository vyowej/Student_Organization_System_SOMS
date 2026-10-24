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

function formatOrgCategoryLabel(orgType) {
  if (!orgType) return 'Academic'
  const map = {
    ACADEMIC: 'Academic',
    NON_ACADEMIC: 'Leadership',
    SOCIO_CIVIC: 'Socio-Civic',
    RELIGIOUS: 'Religious',
    SPORTS: 'Sports',
    CULTURAL: 'Cultural',
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
    MEMBER: 'General Member',
    OTHER: 'Committee Head',
  }
  return map[position] || position || 'General Member'
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
  return {
    id: a.announcement_id,
    announcementId: a.announcement_id,
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
    postedBy: a.first_name ? `${a.last_name}, ${a.first_name}` : 'Organization Officer',
  }
}

function normalizeOrganization(row, allMembers = [], allAnnouncements = [], allDocuments = []) {
  const orgMembers = allMembers.filter((m) => String(m.organization_id) === String(row.organization_id) && m.status === 'ACTIVE')
  const officers = orgMembers
    .filter((m) => m.position && m.position !== 'MEMBER')
    .map((m) => ({
      id: m.membership_id,
      studentId: m.student_number || String(m.student_id),
      firstName: m.first_name,
      middleName: m.middle_name || '',
      lastName: m.last_name,
      name: `${m.last_name}, ${m.first_name}`,
      position: formatPositionLabel(m.position, m.custom_title),
      rawPosition: m.position,
      status: m.status || 'ACTIVE',
    }))

  const orgAnnouncements = allAnnouncements
    .filter((a) => String(a.organization_id) === String(row.organization_id))
    .map(normalizeAnnouncement)

  const orgDocs = allDocuments
    .filter((d) => String(d.organization_id) === String(row.organization_id) && d.status === 'APPROVED')
    .map((d) => d.title)

  const adviserName = row.adviser_first_name
    ? `${row.adviser_last_name}, ${row.adviser_first_name}`
    : 'Unassigned'

  const activeCount = Number(row.member_count ?? orgMembers.length ?? 0)

  return {
    id: row.organization_id,
    organizationId: row.organization_id,
    name: row.name,
    acronym: row.acronym || row.name?.slice(0, 4)?.toUpperCase() || 'ORG',
    category: formatOrgCategoryLabel(row.org_type),
    orgType: row.org_type,
    scope: row.scope,
    collegeId: row.college_id,
    college: row.college_name || 'University-wide',
    collegeCode: row.college_code || '',
    departmentId: row.department_id,
    department: row.department_name || '',
    departmentCode: row.department_code || '',
    description: row.description || row.mission || 'Official WMSU student organization.',
    mission: row.mission || 'Not provided.',
    vision: row.vision || 'Not provided.',
    logo: row.logo || '',
    adviserId: row.adviser_id || null,
    adviser: adviserName,
    adviserStatus: row.adviser_id ? 'ACTIVE' : 'UNASSIGNED',
    status: row.status || 'ACTIVE',
    accreditationStatus: row.accreditation_status || 'PENDING',
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
  const startTime = formatDisplayTime(row.start_datetime)
  const endTime = formatDisplayTime(row.end_datetime)
  const timeRange = startTime && endTime ? `${startTime} – ${endTime}` : startTime || 'TBA'
  const rawStatus = row.status || 'PENDING'
  const mappedStatus = rawStatus === 'PENDING' ? 'SUBMITTED' : rawStatus

  return {
    id: row.event_id,
    eventId: row.event_id,
    organizationId: row.organization_id,
    organizationName: row.organization_name || 'Campus Organization',
    organizationAcronym: row.organization_acronym || '',
    title: row.title,
    description: row.description || '',
    venue: row.venue || 'WMSU Campus',
    location: row.venue || 'WMSU Campus',
    startDatetime: row.start_datetime,
    endDatetime: row.end_datetime,
    date: formatDisplayDate(row.start_datetime),
    submittedDate: formatDisplayDate(row.created_at),
    startTime,
    endTime,
    time: timeRange,
    category: row.event_type || 'Academic',
    eventType: row.event_type || 'Academic',
    capacity: Number(row.max_participants ?? 100),
    registeredCount: Number(row.registered_count ?? 0),
    registrations: Number(row.registered_count ?? 0),
    attendedCount: Number(row.attended_count ?? 0),
    attendance: Number(row.attended_count ?? 0),
    status: row.is_published && rawStatus === 'APPROVED' ? 'PUBLISHED' : mappedStatus,
    rawStatus,
    isPublished: Boolean(row.is_published),
    adviserDecisionDate: row.approved_by ? formatDisplayDate(row.updated_at || row.created_at) : null,
    adminApprovedAt: row.is_published ? formatDisplayDate(row.updated_at || row.created_at) : (row.approved_by ? formatDisplayDate(row.updated_at || row.created_at) : null),
    createdBy: row.created_by,
    approvedBy: row.approved_by,
    createdAt: row.created_at,
    supportingDocuments: [],
  }
}

function normalizeMember(row) {
  const joinedFormatted = formatDisplayDate(row.joined_at || row.created_at)
  const positionLabel = formatPositionLabel(row.position, row.custom_title)
  return {
    id: row.membership_id,
    membershipId: row.membership_id,
    organizationId: row.organization_id,
    organizationName: row.organization_name || '',
    acronym: row.acronym || '',
    studentRecordId: row.student_id,
    studentId: row.student_number || String(row.student_id),
    userId: row.user_id,
    firstName: row.first_name || '',
    middleName: row.middle_name || '',
    lastName: row.last_name || '',
    name: `${row.last_name || ''}, ${row.first_name || ''}`.replace(/^,\s*/, ''),
    email: row.email || '',
    program: row.program_name || row.program_code || '',
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
  return {
    id: row.application_id,
    applicationId: row.application_id,
    organizationId: row.organization_id,
    organizationName: row.organization_name || '',
    acronym: row.acronym || '',
    studentRecordId: row.student_id,
    studentId: row.student_number || String(row.student_id),
    firstName: row.first_name || '',
    middleName: row.middle_name || '',
    lastName: row.last_name || '',
    name: `${row.last_name || ''}, ${row.first_name || ''}`.replace(/^,\s*/, ''),
    email: row.email || '',
    program: row.program_name || row.program_code || '',
    yearLevel: row.year_level ? `${row.year_level}${row.year_level === 1 ? 'st' : row.year_level === 2 ? 'nd' : row.year_level === 3 ? 'rd' : 'th'} Year` : '',
    desiredRole: row.desired_role || 'Member',
    message: row.reason || 'Membership application submitted via UNIDOS portal.',
    reason: row.reason || '',
    status: row.status || 'PENDING',
    applicationDate: formatDisplayDate(row.applied_at),
    appliedAt: row.applied_at,
    decisionDate: row.reviewed_at ? formatDisplayDate(row.reviewed_at) : '',
    reviewedAt: row.reviewed_at,
    processedBy: row.reviewer_first_name ? `${row.reviewer_last_name}, ${row.reviewer_first_name}` : '',
  }
}

function normalizeRegistration(row) {
  const attendanceStatus = row.attendance_id
    ? (row.attendance_status === 'LATE' ? 'ATTENDED' : row.attendance_status || 'ATTENDED')
    : 'PENDING'

  return {
    id: `REG-${row.registration_id}`,
    registrationId: row.registration_id,
    eventId: row.event_id,
    eventTitle: row.event_title || '',
    organizationId: row.organization_id,
    organizationName: row.organization_name || '',
    studentRecordId: row.student_id,
    studentId: row.student_number || String(row.student_id),
    firstName: row.first_name || '',
    lastName: row.last_name || '',
    status: row.status || 'REGISTERED',
    registrationDate: formatDisplayDate(row.registered_at),
    registeredAt: row.registered_at,
    attendanceStatus,
    checkInTime: row.time_in ? formatDisplayTime(row.time_in) : null,
    checkInDate: row.time_in ? formatDisplayDate(row.time_in) : null,
  }
}

function normalizeDocument(row) {
  return {
    id: row.document_id,
    documentId: row.document_id,
    organizationId: row.organization_id,
    organizationName: row.organization_name || '',
    acronym: row.organization_acronym || '',
    title: row.title,
    type: row.doc_type || 'OTHER',
    docType: row.doc_type || 'OTHER',
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
    decisionReason: row.review_remarks || '',
    revisionNote: row.review_remarks || '',
    reviewRemarks: row.review_remarks || '',
    reviewedAt: row.reviewed_at ? formatDisplayDate(row.reviewed_at) : '',
    adminReviewRequired: ['CONSTITUTION', 'BYLAWS', 'ACCREDITATION_FORM', 'FINANCIAL_REPORT', 'EVENT_REPORT'].includes(row.doc_type),
  }
}

function normalizeUser(row) {
  const fullName = `${row.last_name || ''}, ${row.first_name || ''}`.replace(/^,\s*/, '')
  return {
    id: row.user_id,
    userId: row.student_number || row.employee_number || String(row.user_id),
    dbUserId: row.user_id,
    studentRecordId: row.student_id || null,
    adviserRecordId: row.adviser_id || null,
    studentNumber: row.student_number || '',
    employeeNumber: row.employee_number || '',
    firstName: row.first_name || '',
    middleName: row.middle_name || '',
    lastName: row.last_name || '',
    name: fullName,
    email: row.email || '',
    role: formatRoleLabel(row.role),
    rawRole: row.role || 'STUDENT',
    status: row.status || 'ACTIVE',
    programId: row.program_id || null,
    program: row.program_name || row.adviser_department_name || '—',
    programCode: row.program_code || '',
    departmentId: row.department_id || row.adviser_department_id || null,
    department: row.department_name || row.adviser_department_name || '—',
    collegeId: row.college_id || row.adviser_college_id || null,
    college: row.college_name || '—',
    yearLevel: row.year_level ? `${row.year_level}${row.year_level === 1 ? 'st' : row.year_level === 2 ? 'nd' : row.year_level === 3 ? 'rd' : 'th'} Year` : '—',
    organization: '—',
    lastActivity: formatDisplayDate(row.updated_at || row.created_at),
    createdAt: formatDisplayDate(row.created_at),
  }
}

function normalizeNotification(row) {
  return {
    id: row.notification_id,
    notificationId: row.notification_id,
    userId: row.user_id,
    title: row.title,
    message: row.message,
    type: row.title || 'Update',
    read: Boolean(row.is_read),
    unread: !row.is_read,
    createdAt: formatDisplayDate(row.created_at),
    time: formatDisplayDate(row.created_at),
  }
}

function normalizeAuditLog(row) {
  return {
    id: row.log_id,
    logId: row.log_id,
    userId: row.user_id,
    actor: row.first_name ? `${row.last_name}, ${row.first_name}` : 'System',
    role: row.role || 'SYSTEM',
    action: row.action,
    entityType: row.entity_type || 'SYSTEM',
    entityId: row.entity_id || '—',
    description: `${row.action} on ${row.entity_type || 'record'}${row.entity_id ? ` #${row.entity_id}` : ''}`,
    ipAddress: row.ip_address || '',
    timestamp: formatDisplayDate(row.created_at),
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
  const [adminSettings, setAdminSettings] = useState(adminDefaultSettings)
  const [loading, setLoading] = useState(true)

  const refreshPortalData = useCallback(async () => {
    try {
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
        fetch('/api/organizations').catch(() => null),
        fetch('/api/events').catch(() => null),
        fetch('/api/members').catch(() => null),
        fetch('/api/members/applications').catch(() => null),
        fetch('/api/attendance/registrations').catch(() => null),
        fetch('/api/documents').catch(() => null),
        fetch('/api/announcements').catch(() => null),
        fetch('/api/users').catch(() => null),
        fetch(currentUser?.userId ? `/api/notifications?user_id=${currentUser.userId}` : '/api/notifications').catch(() => null),
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
  }, [currentUser?.userId])

  useEffect(() => {
    refreshPortalData()
  }, [refreshPortalData])

  // Derived normalized lists reflecting every database table
  const adminOrganizations = useMemo(
    () => rawOrganizations.map((org) => normalizeOrganization(org, rawMembers, rawAnnouncements, rawDocuments)),
    [rawOrganizations, rawMembers, rawAnnouncements, rawDocuments]
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
        .filter((d) => d.docType === 'EVENT_REPORT' || d.docType === 'FINANCIAL_REPORT')
        .map((d) => ({
          id: d.id,
          documentId: d.documentId,
          organizationId: d.organizationId,
          organizationName: d.organizationName,
          eventTitle: d.title,
          title: d.title,
          eventDate: d.submittedDate,
          submittedDate: d.submittedDate,
          submittedBy: d.submittedBy,
          attendance: 0,
          status:
            d.status === 'APPROVED'
              ? 'VERIFIED'
              : d.status === 'REJECTED'
                ? 'RETURNED'
                : 'PENDING_VERIFICATION',
          verifiedBy: d.processedBy,
          decisionDate: d.reviewedAt,
          revisionNote: d.reviewRemarks,
          supportingDocuments: d.fileUrl ? [d.fileUrl] : [],
        })),
    [adviserDocuments]
  )

  const adminUsers = useMemo(
    () => rawUsers.map(normalizeUser),
    [rawUsers]
  )

  const notifications = useMemo(
    () => rawNotifications.map(normalizeNotification),
    [rawNotifications]
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

  const submitMembershipRequest = useCallback(async (organizationId, payload = {}) => {
    const studentId = payload.studentRecordId || currentUser?.studentRecordId
    if (!studentId) return false
    const response = await fetch('/api/members/applications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        organization_id: organizationId,
        student_id: studentId,
        desired_role: payload.desiredRole || 'Member',
        reason: payload.message || payload.reason || 'Applied via Student Portal',
      }),
    })
    if (!response.ok) return false
    await refreshPortalData()
    return true
  }, [currentUser?.studentRecordId, refreshPortalData])

  const approveOfficerMembershipRequest = useCallback(async (applicationId) => {
    const response = await fetch(`/api/members/applications/${applicationId}/review`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: 'APPROVED',
        reviewed_by: currentUser?.userId || null,
      }),
    })
    if (!response.ok) return false
    await refreshPortalData()
    return true
  }, [currentUser, refreshPortalData])

  const rejectOfficerMembershipRequest = useCallback(async (applicationId, reason = '') => {
    const response = await fetch(`/api/members/applications/${applicationId}/review`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: 'REJECTED',
        reviewed_by: currentUser?.userId || null,
        reason,
      }),
    })
    if (!response.ok) return false
    await refreshPortalData()
    return true
  }, [currentUser, refreshPortalData])

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
    const studentId = currentUser?.studentRecordId
    if (!studentId) return false
    const response = await fetch('/api/attendance/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event_id: eventId,
        student_id: studentId,
      }),
    })
    if (!response.ok) return false
    await refreshPortalData()
    return true
  }, [currentUser?.studentRecordId, refreshPortalData])

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
    if (!code) return { ok: false, message: 'Enter a student registration code or student ID.' }

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
        start_datetime: startIso,
        end_datetime: endIso,
        event_type: eventPayload.category || eventPayload.eventType || 'Academic',
        status: dbStatus,
        max_participants: Number(eventPayload.capacity || 100),
        created_by: currentUser?.userId || null,
      }),
    })
    if (!response.ok) return null
    const saved = await response.json()
    await refreshPortalData()
    return normalizeEvent(saved)
  }, [currentUser?.organizationId, currentUser?.userId, adminOrganizations, refreshPortalData])

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
          reviewed_by: currentUser?.userId || null,
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
        approved_by: currentUser?.userId || null,
      }),
    })
    if (!response.ok) return false
    await refreshPortalData()
    return true
  }, [currentUser, refreshPortalData])

  const reviewAccomplishmentReport = useCallback(async (reportId, decision, comment = '') => {
    const docStatus = decision === 'VERIFIED' || decision === 'APPROVED' ? 'APPROVED' : 'REJECTED'
    const response = await fetch(`/api/documents/${reportId}/review`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: docStatus,
        reviewed_by: currentUser?.userId || null,
        review_remarks: comment,
      }),
    })
    if (!response.ok) return false
    await refreshPortalData()
    return true
  }, [currentUser, refreshPortalData])

  const reviewAdminEvent = useCallback(async (eventId, decision) => {
    const dbStatus = decision === 'APPROVED' ? 'APPROVED' : decision === 'RETURNED' ? 'PENDING' : 'REJECTED'
    const response = await fetch(`/api/events/${eventId}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: dbStatus,
        approved_by: currentUser?.userId || null,
        is_published: decision === 'APPROVED' ? false : undefined,
      }),
    })
    if (!response.ok) return false
    await refreshPortalData()
    return true
  }, [currentUser, refreshPortalData])

  const publishAdminEvent = useCallback(async (eventId) => {
    const response = await fetch(`/api/events/${eventId}/publish`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        approved_by: currentUser?.userId || null,
      }),
    })
    if (!response.ok) return false
    await refreshPortalData()
    return true
  }, [currentUser, refreshPortalData])

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
        created_by: currentUser?.userId || null,
      }),
    })
    if (!response.ok) return false
    await refreshPortalData()
    return true
  }, [currentUser?.organizationId, currentUser?.userId, adminOrganizations, refreshPortalData])

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
        uploaded_by: currentUser?.userId || null,
      }),
    })
    if (!response.ok) return false
    await refreshPortalData()
    return true
  }, [currentUser?.organizationId, currentUser?.userId, adminOrganizations, adminSettings, refreshPortalData])

  const reviewAdviserDocument = useCallback(async (documentId, status, remarks = '') => {
    const response = await fetch(`/api/documents/${documentId}/review`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status,
        reviewed_by: currentUser?.userId || null,
        review_remarks: remarks,
      }),
    })
    if (!response.ok) return false
    await refreshPortalData()
    return true
  }, [currentUser, refreshPortalData])

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
      }),
    })
    if (!response.ok) return false
    await refreshPortalData()
    return true
  }, [currentUser?.organizationId, adminOrganizations, rawOrganizations, refreshPortalData])

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

  const saveOfficerNotificationPreferences = useCallback(() => {
    return true
  }, [])

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
          requested_by: currentUser?.userId,
          current_adviser_id: adminOrganizations.find((o) => String(o.id) === String(orgId))?.adviserId || null,
          requested_adviser_id: targetAdviserId,
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
        user_id: currentUser?.userId || null,
        action: `REQUEST_${requestType}`,
        entity_type: 'organizations',
        entity_id: orgId,
      }),
    }).catch(() => null)
    await refreshPortalData()
    return true
  }, [currentUser?.organizationId, currentUser?.userId, adminOrganizations, rawAdvisers, refreshPortalData])

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
      (u) => String(u.user_id) === String(userId) || String(u.student_number) === String(userId)
    )
    const dbId = targetUser?.user_id || userId
    const response = await fetch(`/api/users/${dbId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        first_name: updates.firstName,
        middle_name: updates.middleName,
        last_name: updates.lastName,
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
    return true
  }, [currentUser, refreshPortalData])

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
    if (!currentUser?.userId) return false
    const response = await fetch(`/api/notifications/user/${currentUser.userId}/read-all`, {
      method: 'PUT',
    })
    if (!response.ok) return false
    await refreshPortalData()
    return true
  }, [currentUser, refreshPortalData])

  const saveAdminSettings = useCallback((nextSettings) => {
    setAdminSettings((prev) => ({ ...prev, ...nextSettings }))
    return true
  }, [])

  const value = useMemo(() => ({
    loading,
    refreshPortalData,
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
    adviserActivity: adminAuditLogs,
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
    officerNotifications: notifications,
    adviserNotifications: notifications,
    adminNotifications: notifications,
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
    reviewAdviserDocument,
    reviewAdminDocument: reviewAdviserDocument,
    updateOfficerOrganizationProfile,
    updateOfficerOrganizationLogo,
    updateOfficerOrganizationContact,
    saveOfficerNotificationPreferences,
    submitOfficerOrganizationRequest,
    updateAdminOrganizationStatus,
    updateAdminOrganization,
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
    getMembershipForOrganization,
    submitMembershipRequest,
    approveOfficerMembershipRequest,
    rejectOfficerMembershipRequest,
    assignOfficerPosition,
    updateOfficerMemberStatus,
    registerForEvent,
    cancelEventRegistration,
    checkInStudent,
    saveOfficerEvent,
    reviewAdviserRequest,
    reviewAccomplishmentReport,
    reviewAdminEvent,
    publishAdminEvent,
    saveOfficerAnnouncement,
    archiveOfficerAnnouncement,
    deleteOfficerAnnouncement,
    addOfficerDocument,
    reviewAdviserDocument,
    updateOfficerOrganizationProfile,
    updateOfficerOrganizationLogo,
    updateOfficerOrganizationContact,
    saveOfficerNotificationPreferences,
    submitOfficerOrganizationRequest,
    updateAdminOrganizationStatus,
    updateAdminOrganization,
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
  ])

  return <PortalDataContext.Provider value={value}>{children}</PortalDataContext.Provider>
}

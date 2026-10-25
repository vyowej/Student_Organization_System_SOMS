import { useEffect, useMemo, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import Badge from '../components/ui/Badge.jsx'
import Card from '../components/ui/Card.jsx'
import ConfirmDialog from '../components/ui/ConfirmDialog.jsx'
import EmptyState from '../components/ui/EmptyState.jsx'
import Icon from '../components/ui/Icon.jsx'
import Modal from '../components/ui/Modal.jsx'
import PageHeader from '../components/layout/PageHeader.jsx'
import SearchBar, { matchesQuery } from '../components/ui/SearchBar.jsx'
import { undoAction, useToast } from '../components/ui/useToast.js'

export default function OfficerAttendancePage() {
  const {
    adminOrganizations = [],
    adminUsers = [],
    captureUndo,
    checkInStudent,
    currentUser,
    generateEventAttendanceCode,
    getEventAttendanceCode,
    officerEvents = [],
    studentRegistrations = [],
    toggleStudentAttendance,
  } = useOutletContext()

  const orgId = currentUser?.organizationId || adminOrganizations[0]?.id
  const organization =
    adminOrganizations?.find((item) => String(item.id) === String(orgId)) ||
    adminOrganizations[0] || { name: 'Your Organization', acronym: 'ORG' }

  const events = officerEvents.filter(
    (event) =>
      (!organization.id || String(event.organizationId) === String(organization.id)) &&
      ['PUBLISHED', 'COMPLETED', 'ARCHIVED', 'APPROVED', 'ONGOING'].includes(event.status)
  )

  const [selectedEventId, setSelectedEventId] = useState(() => events[0]?.id ?? '')
  const [registrationCode, setRegistrationCode] = useState('')
  const { showToast } = useToast()
  const [feedback, setFeedback] = useState(null)
  const [confirmCheckInOpen, setConfirmCheckInOpen] = useState(false)
  const [rosterSearch, setRosterSearch] = useState('')
  const [rosterFilter, setRosterFilter] = useState('ALL')
  const [sessionCodeData, setSessionCodeData] = useState(null)
  const [isRegeneratingCode, setIsRegeneratingCode] = useState(false)
  const [isProjectorOpen, setIsProjectorOpen] = useState(false)
  const [copyFeedback, setCopyFeedback] = useState(false)

  const activeEventId = selectedEventId || events[0]?.id || ''
  const selectedEvent = events.find((event) => String(event.id) === String(activeEventId))

  // Fetch or generate event session code whenever selected event changes
  useEffect(() => {
    let mounted = true
    if (activeEventId && getEventAttendanceCode) {
      getEventAttendanceCode(activeEventId).then((data) => {
        if (mounted && data) {
          setSessionCodeData(data)
        }
      })
    }
    return () => {
      mounted = false
    }
  }, [activeEventId, getEventAttendanceCode])

  const attendees = useMemo(() => {
    return studentRegistrations
      .filter((registration) => String(registration.eventId) === String(activeEventId) && registration.status !== 'CANCELLED')
      .map((registration) => {
        const student = adminUsers.find(
          (user) =>
            String(user.userId) === String(registration.studentId) ||
            String(user.studentRecordId) === String(registration.studentRecordId) ||
            String(user.studentId) === String(registration.studentId)
        )
        return {
          ...registration,
          studentName:
            student?.name ||
            `${registration.lastName || ''}, ${registration.firstName || ''}`.replace(/^,\s*/, '') ||
            registration.studentName ||
            registration.studentId,
          studentNumber: student?.studentId || registration.studentId || registration.studentNumber || '—',
          program: student?.program || registration.programAcronym || registration.program || 'WMSU',
        }
      })
      .sort((a, b) => a.studentName.localeCompare(b.studentName))
  }, [adminUsers, activeEventId, studentRegistrations])

  const checkedInCount = attendees.filter((attendee) => attendee.attendanceStatus === 'ATTENDED').length
  const attendanceRate = attendees.length ? Math.round((checkedInCount / attendees.length) * 100) : 0

  const filteredAttendees = useMemo(() => {
    return attendees
      .filter((attendee) => {
        if (rosterFilter === 'ATTENDED') return attendee.attendanceStatus === 'ATTENDED'
        if (rosterFilter === 'PENDING') return attendee.attendanceStatus !== 'ATTENDED'
        return true
      })
      .filter((attendee) =>
        matchesQuery(
          rosterSearch,
          attendee.studentName,
          attendee.studentNumber,
          attendee.studentId,
          attendee.id,
          attendee.program
        )
      )
  }, [attendees, rosterFilter, rosterSearch])

  // Station check-in form
  function handleCheckIn(event) {
    event.preventDefault()
    if (registrationCode.trim()) setConfirmCheckInOpen(true)
  }

  async function confirmCheckIn() {
    setConfirmCheckInOpen(false)
    const undo = captureUndo()
    const result = await checkInStudent(activeEventId, registrationCode)
    setFeedback({ ...result, id: Date.now() })
    if (result?.ok) {
      setRegistrationCode('')
      showToast(`Attendance recorded for ${registrationCode.trim()}.`, 'success', undoAction(undo))
    }
  }

  // Quick check-in toggle from roster row
  async function handleQuickToggle(attendee, newStatus) {
    if (!toggleStudentAttendance) return
    const res = await toggleStudentAttendance({
      eventId: activeEventId,
      studentId: attendee.studentRecordId || attendee.studentId,
      status: newStatus,
    })
    if (res?.ok) {
      showToast(
        newStatus === 'ATTENDED'
          ? `Checked in ${attendee.studentName}!`
          : `Reset attendance for ${attendee.studentName} to pending.`,
        'success'
      )
    } else {
      showToast(res?.message || 'Failed to update attendance', 'danger')
    }
  }

  // Regenerate random attendance code
  async function handleRegenerateCode() {
    if (!generateEventAttendanceCode || !activeEventId) return
    setIsRegeneratingCode(true)
    const res = await generateEventAttendanceCode(activeEventId, 'generate')
    if (res) {
      setSessionCodeData(res)
      showToast(`New random attendance code generated: ${res.code}`, 'success')
    }
    setIsRegeneratingCode(false)
  }

  // Toggle session active / paused
  async function handleToggleSession() {
    if (!generateEventAttendanceCode || !activeEventId) return
    const nextActive = !sessionCodeData?.active
    const res = await generateEventAttendanceCode(activeEventId, 'toggle', nextActive)
    if (res) {
      setSessionCodeData(res)
      showToast(
        nextActive
          ? 'Attendance session is now OPEN. Students can check in.'
          : 'Attendance session PAUSED. Code submissions blocked.',
        'info'
      )
    }
  }

  // Copy code to clipboard
  function handleCopyCode() {
    if (!sessionCodeData?.code) return
    navigator.clipboard.writeText(sessionCodeData.code)
    setCopyFeedback(true)
    showToast(`Copied code "${sessionCodeData.code}" to clipboard!`, 'success')
    setTimeout(() => setCopyFeedback(false), 2000)
  }

  // Export roster to CSV
  function handleExportCSV() {
    if (!attendees.length) {
      showToast('No registrations to export.', 'warning')
      return
    }
    const headers = ['Student ID', 'Student Name', 'Program', 'Attendance Status', 'Check-In Time', 'Method']
    const rows = attendees.map((a) => [
      `"${a.studentNumber || a.studentId || ''}"`,
      `"${(a.studentName || '').replace(/"/g, '""')}"`,
      `"${(a.program || '').replace(/"/g, '""')}"`,
      `"${a.attendanceStatus || 'PENDING'}"`,
      `"${a.checkInTime || '—'}"`,
      `"${a.checkInMethod || (a.attendanceStatus === 'ATTENDED' ? 'MANUAL' : '—')}"`,
    ])
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n')
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute(
      'download',
      `Attendance_${(selectedEvent?.title || 'Event').replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().slice(0, 10)}.csv`
    )
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    showToast('Attendance roster exported to CSV successfully.', 'success')
  }

  function getInitials(name = '') {
    return (
      name
        .split(/[ ,]+/)
        .map((part) => part[0])
        .filter(Boolean)
        .slice(0, 2)
        .join('')
        .toUpperCase() || 'S'
    )
  }

  return (
    <div className="officer-attendance-page">
      <PageHeader
        description={`Manage event check-in sessions, broadcast random attendance codes to attendees, and monitor live turnout for ${organization.name}.`}
        eyebrow={organization.name}
        title="Event Attendance Station"
      />

      {events.length ? (
        <>
          {/* Top KPI Metrics Cards */}
          <div className="officer-stats-grid">
            <Card className="officer-stat-card">
              <div className="officer-stat-icon tone-crimson">
                <Icon name="members" size={18} />
              </div>
              <div>
                <span className="stat-value">{attendees.length}</span>
                <span className="stat-label">Total Registered</span>
              </div>
            </Card>

            <Card className="officer-stat-card">
              <div className="officer-stat-icon tone-green">
                <Icon name="check-circle" size={18} />
              </div>
              <div>
                <span className="stat-value">{checkedInCount}</span>
                <span className="stat-label">Checked In</span>
              </div>
            </Card>

            <Card className="officer-stat-card">
              <div className="officer-stat-icon tone-gold">
                <Icon name="clock" size={18} />
              </div>
              <div>
                <span className="stat-value">{attendees.length - checkedInCount}</span>
                <span className="stat-label">Pending Arrival</span>
              </div>
            </Card>

            <Card className="officer-stat-card">
              <div className="officer-stat-icon tone-blue">
                <Icon name="reports" size={18} />
              </div>
              <div>
                <span className="stat-value">{attendanceRate}%</span>
                <span className="stat-label">Turnout Rate</span>
              </div>
            </Card>
          </div>

          {/* Turnout Visual Progress Bar */}
          <div className="attendance-progress-container">
            <div className="attendance-progress-header">
              <span>Turnout Progress</span>
              <strong>{checkedInCount} of {attendees.length} checked in ({attendanceRate}%)</strong>
            </div>
            <div className="attendance-progress-track">
              <div
                className="attendance-progress-fill"
                style={{ width: `${Math.min(attendanceRate, 100)}%` }}
              />
            </div>
          </div>

          {/* Card: Live Attendance Code Broadcast Station */}
          <Card className="officer-page-card attendance-station-card">
            <div className="officer-page-card-heading">
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <h2>Live Attendance Code Station</h2>
                  <span className={`attendance-live-badge ${sessionCodeData?.active ? 'is-active' : 'is-paused'}`}>
                    <span className="live-dot" />
                    {sessionCodeData?.active ? 'SESSION ACTIVE' : 'SESSION PAUSED'}
                  </span>
                </div>
                <p>Broadcast this randomly generated code on your event projector or announce it to students for instant self-attendance.</p>
              </div>
            </div>

            <div className="attendance-code-broadcast-grid">
              {/* Event Selector & Live Code Pill */}
              <div className="attendance-code-left">
                <label className="form-field" htmlFor="attendance-event">
                  <span>Selected Event</span>
                  <select
                    id="attendance-event"
                    onChange={(event) => {
                      setSelectedEventId(event.target.value)
                      setFeedback(null)
                    }}
                    value={activeEventId}
                  >
                    {events.map((event) => (
                      <option key={event.id} value={event.id}>
                        {event.title} · {event.date || 'Campus Event'}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="attendance-code-display-box">
                  <span className="attendance-code-label">EVENT ATTENDANCE CODE</span>
                  <div className="attendance-code-pill">
                    <span className="attendance-code-text">
                      {sessionCodeData?.code || 'WMSU-....'}
                    </span>
                    <button
                      className="button button-ghost button-sm"
                      onClick={handleCopyCode}
                      title="Copy code to clipboard"
                      type="button"
                    >
                      <Icon name="check-circle" size={14} />
                      {copyFeedback ? 'Copied!' : 'Copy Code'}
                    </button>
                  </div>
                  <small className="attendance-code-hint">
                    Students can enter this code in their <strong>UNIDOS Student Portal → Attendance History</strong> to record their attendance.
                  </small>
                </div>
              </div>

              {/* Code Controls & Actions */}
              <div className="attendance-code-actions-panel">
                <span className="form-field-label">Code Management</span>
                <div className="attendance-code-btn-group">
                  <button
                    className="button button-secondary"
                    disabled={isRegeneratingCode}
                    onClick={handleRegenerateCode}
                    type="button"
                  >
                    <Icon name="archive" size={14} />
                    {isRegeneratingCode ? 'Generating…' : 'Generate New Code'}
                  </button>

                  <button
                    className={`button ${sessionCodeData?.active ? 'button-danger-outline' : 'button-secondary'}`}
                    onClick={handleToggleSession}
                    type="button"
                  >
                    {sessionCodeData?.active ? (
                      <>
                        <Icon name="slash" size={14} /> Pause Session
                      </>
                    ) : (
                      <>
                        <Icon name="check-circle" size={14} /> Resume Session
                      </>
                    )}
                  </button>

                  <button
                    className="button button-primary attendance-projector-btn"
                    onClick={() => setIsProjectorOpen(true)}
                    type="button"
                  >
                    <Icon name="external-link" size={14} /> Projector View
                  </button>
                </div>

                <div className="attendance-session-meta">
                  <span>Created: {sessionCodeData?.created_at ? new Date(sessionCodeData.created_at).toLocaleTimeString() : 'Active'}</span>
                  <span>Method: Self Check-In / Code</span>
                </div>
              </div>
            </div>

            {/* Manual Check-in Station for Desk / Scan */}
            <div className="attendance-manual-divider">
              <span>OR ENTER INDIVIDUAL STUDENT CODE</span>
            </div>

            <form className="officer-attendance-checkin" onSubmit={handleCheckIn}>
              <label className="form-field" htmlFor="registration-code" style={{ flex: 1 }}>
                <span>Scan QR or Enter Student Number / Registration ID</span>
                <input
                  autoComplete="off"
                  id="registration-code"
                  onChange={(event) => setRegistrationCode(event.target.value)}
                  placeholder="e.g. 2024-00123 or REG-1"
                  required
                  value={registrationCode}
                />
              </label>
              <button
                className="button button-primary"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                type="submit"
              >
                <Icon name="check-circle" size={16} />
                Record Attendance
              </button>
            </form>

            {feedback && (
              <p
                aria-live="polite"
                className={`attendance-feedback${feedback.ok ? ' is-success' : ' is-error'}`}
                key={feedback.id}
                role="status"
              >
                {feedback.message}
              </p>
            )}
          </Card>

          {/* Card: Registration Roster with Filters & Quick Check-in */}
          <Card className="officer-page-card officer-attendance-roster">
            <div className="officer-page-card-heading">
              <div>
                <h2>Event Registration Roster</h2>
                <p>Live attendees and check-in records for <strong>{selectedEvent?.title}</strong>.</p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Badge tone="crimson">{checkedInCount} of {attendees.length} checked in</Badge>
                <button
                  className="button button-secondary button-sm"
                  onClick={handleExportCSV}
                  title="Export attendance sheet as CSV"
                  type="button"
                >
                  <Icon name="documents" size={14} /> Export CSV
                </button>
              </div>
            </div>

            {/* Roster Filter Tabs */}
            <div className="attendance-roster-toolbar">
              <div className="attendance-filter-pills" role="tablist">
                <button
                  className={`attendance-filter-pill ${rosterFilter === 'ALL' ? 'is-active' : ''}`}
                  onClick={() => setRosterFilter('ALL')}
                  type="button"
                >
                  All Registered <span className="pill-count">{attendees.length}</span>
                </button>
                <button
                  className={`attendance-filter-pill ${rosterFilter === 'ATTENDED' ? 'is-active' : ''}`}
                  onClick={() => setRosterFilter('ATTENDED')}
                  type="button"
                >
                  Checked In <span className="pill-count is-green">{checkedInCount}</span>
                </button>
                <button
                  className={`attendance-filter-pill ${rosterFilter === 'PENDING' ? 'is-active' : ''}`}
                  onClick={() => setRosterFilter('PENDING')}
                  type="button"
                >
                  Pending Arrival <span className="pill-count is-amber">{attendees.length - checkedInCount}</span>
                </button>
              </div>

              <div style={{ flex: 1, minWidth: '220px' }}>
                <SearchBar
                  label="Search registration records"
                  onChange={setRosterSearch}
                  placeholder="Search by student name, ID or code…"
                  value={rosterSearch}
                />
              </div>
            </div>

            {/* Attendee List */}
            {filteredAttendees.length ? (
              <div className="officer-attendance-list">
                {filteredAttendees.map((attendee) => {
                  const isAttended = attendee.attendanceStatus === 'ATTENDED'
                  return (
                    <article className="officer-attendance-row" key={attendee.id}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', minWidth: 0 }}>
                        <span aria-hidden="true" className="officer-person-avatar">
                          {getInitials(attendee.studentName)}
                        </span>
                        <div className="officer-attendee-identity">
                          <strong>{attendee.studentName}</strong>
                          <span>
                            {attendee.studentNumber} · {attendee.program} · Code: <code>{attendee.id}</code>
                          </span>
                        </div>
                      </div>

                      <div className="officer-attendee-status-group">
                        <div className="officer-attendee-status">
                          <Badge tone={isAttended ? 'success' : 'warning'}>
                            {isAttended ? 'ATTENDED' : 'PENDING'}
                          </Badge>
                          {attendee.checkInTime && (
                            <span className="officer-checkin-time">
                              {attendee.checkInTime} · {attendee.checkInMethod || 'Self Check-in'}
                            </span>
                          )}
                        </div>

                        {/* Quick Check-in / Reset Toggle Button */}
                        <div className="attendance-row-actions">
                          {isAttended ? (
                            <button
                              className="button button-ghost button-sm attendance-reset-btn"
                              onClick={() => handleQuickToggle(attendee, 'REGISTERED')}
                              title="Reset attendance status to pending"
                              type="button"
                            >
                              Reset
                            </button>
                          ) : (
                            <button
                              className="button button-primary button-sm attendance-quick-checkin-btn"
                              onClick={() => handleQuickToggle(attendee, 'ATTENDED')}
                              type="button"
                            >
                              <Icon name="check-circle" size={13} /> Check In
                            </button>
                          )}
                        </div>
                      </div>
                    </article>
                  )
                })}
              </div>
            ) : (
              <EmptyState
                description={
                  rosterSearch
                    ? 'No registered students match your search criteria.'
                    : rosterFilter === 'ATTENDED'
                    ? 'No students have checked in yet.'
                    : rosterFilter === 'PENDING'
                    ? 'All registered students have already checked in!'
                    : 'Students who register for this event will appear here.'
                }
                title={rosterSearch ? 'No matching records' : 'No attendees in this view'}
              />
            )}
          </Card>
        </>
      ) : (
        <EmptyState
          description="Attendance check-in becomes available when an event is approved and published."
          title="No events ready for attendance"
        />
      )}

      {/* Confirmation Dialog for Manual Station Code */}
      <ConfirmDialog
        confirmLabel="Record attendance"
        message={`Are you sure you want to record attendance for code "${registrationCode.trim()}" at "${selectedEvent?.title ?? 'this event'}"?`}
        onCancel={() => setConfirmCheckInOpen(false)}
        onConfirm={confirmCheckIn}
        open={confirmCheckInOpen}
        title="Confirm attendance check-in"
      />

      {/* Projector / Presentation Mode Modal */}
      <Modal
        onClose={() => setIsProjectorOpen(false)}
        open={isProjectorOpen}
        size="lg"
        title="Auditorium Presentation Mode"
      >
        <div className="attendance-projector-view">
          <div className="projector-header">
            <span className="projector-kicker">WMSU EVENT ATTENDANCE SESSION</span>
            <h2 className="projector-event-title">{selectedEvent?.title}</h2>
            <div className="projector-event-meta">
              <span>{selectedEvent?.date || 'Today'}</span>
              <span>•</span>
              <span>{selectedEvent?.location || 'Campus Venue'}</span>
              <span>•</span>
              <span>{organization.name}</span>
            </div>
          </div>

          <div className="projector-code-hero">
            <span className="projector-code-sub">ENTER THIS CODE IN YOUR STUDENT PORTAL:</span>
            <div className="projector-code-box">
              <span className="projector-code-value">{sessionCodeData?.code || 'WMSU-....'}</span>
            </div>
            <div className="projector-status-pill">
              <span className="live-dot" />
              <span>LIVE ATTENDANCE SESSION</span>
              <span>•</span>
              <strong>{checkedInCount} of {attendees.length} Students Checked In</strong>
            </div>
          </div>

          <div className="projector-instructions">
            <div className="projector-step">
              <span className="step-num">1</span>
              <div>
                <strong>Open UNIDOS</strong>
                <p>Log in at your student portal on your mobile phone or laptop.</p>
              </div>
            </div>
            <div className="projector-step">
              <span className="step-num">2</span>
              <div>
                <strong>Go to Attendance</strong>
                <p>Click on <strong>Attendance History</strong> in the navigation menu.</p>
              </div>
            </div>
            <div className="projector-step">
              <span className="step-num">3</span>
              <div>
                <strong>Enter Code</strong>
                <p>Type <code>{sessionCodeData?.code || 'WMSU-....'}</code> and submit to confirm your presence.</p>
              </div>
            </div>
          </div>

          <div className="projector-actions">
            <button className="button button-secondary" onClick={handleCopyCode} type="button">
              <Icon name="check-circle" size={16} /> {copyFeedback ? 'Code Copied!' : 'Copy Code'}
            </button>
            <button className="button button-primary" onClick={() => setIsProjectorOpen(false)} type="button">
              Close Projector View
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

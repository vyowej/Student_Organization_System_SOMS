import { useMemo, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import Badge from '../components/ui/Badge.jsx'
import Card from '../components/ui/Card.jsx'
import { undoAction, useToast } from '../components/ui/useToast.js'
import ConfirmDialog from '../components/ui/ConfirmDialog.jsx'
import EmptyState from '../components/ui/EmptyState.jsx'
import Icon from '../components/ui/Icon.jsx'
import PageHeader from '../components/layout/PageHeader.jsx'
import SearchBar, { matchesQuery } from '../components/ui/SearchBar.jsx'

export default function OfficerAttendancePage() {
  const { adminOrganizations, adminUsers, captureUndo, checkInStudent, currentUser, officerEvents, studentRegistrations } = useOutletContext()
  const orgId = currentUser?.organizationId || 'wmsu-cs'
  const organization = adminOrganizations?.find((item) => item.id === orgId) || { name: 'WMSU Computer Society', acronym: 'CS' }
  const events = officerEvents.filter((event) => ['PUBLISHED', 'COMPLETED', 'ARCHIVED', 'APPROVED', 'ONGOING'].includes(event.status))
  const [selectedEventId, setSelectedEventId] = useState(() => events[0]?.id ?? '')
  const [registrationCode, setRegistrationCode] = useState('')
  const { showToast } = useToast()
  const [feedback, setFeedback] = useState(null)
  const [confirmCheckInOpen, setConfirmCheckInOpen] = useState(false)
  const [rosterSearch, setRosterSearch] = useState('')
  const selectedEvent = events.find((event) => event.id === selectedEventId)

  const attendees = useMemo(() => studentRegistrations
    .filter((registration) => registration.eventId === selectedEventId && registration.status === 'REGISTERED')
    .map((registration) => {
      const student = adminUsers.find((user) => user.userId === registration.studentId)
      return {
        ...registration,
        studentName: student?.name ?? registration.studentId,
      }
    })
    .sort((a, b) => a.studentName.localeCompare(b.studentName)), [adminUsers, selectedEventId, studentRegistrations])

  function handleCheckIn(event) {
    event.preventDefault()
    if (registrationCode.trim()) setConfirmCheckInOpen(true)
  }

  function confirmCheckIn() {
    setConfirmCheckInOpen(false)
    const undo = captureUndo()
    const result = checkInStudent(selectedEventId, registrationCode)
    setFeedback({ ...result, id: Date.now() })
    if (result.ok) {
      setRegistrationCode('')
      showToast(`Attendance recorded for ${registrationCode.trim()}.`, 'success', undoAction(undo))
    }
  }

  const visibleAttendees = attendees.filter((attendee) => matchesQuery(rosterSearch, attendee.studentName, attendee.studentId, attendee.id))
  const checkedInCount = attendees.filter((attendee) => attendee.attendanceStatus === 'ATTENDED').length
  const attendanceRate = attendees.length ? Math.round((checkedInCount / attendees.length) * 100) : 0

  function getInitials(name = '') {
    return name.split(/[ ,]+/).map((part) => part[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() || 'S'
  }

  return (
    <div className="officer-attendance-page">
      <PageHeader
        description={`Record event attendance using the registration code shown on each student's digital pass for ${organization.name}.`}
        eyebrow={organization.name}
        title="Event Attendance"
      />

      {events.length ? (
        <>
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

          <Card className="officer-page-card officer-attendance-controls">
            <div className="officer-page-card-heading">
              <div>
                <h2>Check-in Station</h2>
                <p>Select the active event and scan or type student registration codes.</p>
              </div>
            </div>

            <div className="officer-attendance-grid-form">
              <label className="form-field" htmlFor="attendance-event">
                <span>Select Event</span>
                <select
                  id="attendance-event"
                  onChange={(event) => {
                    setSelectedEventId(event.target.value)
                    setFeedback(null)
                  }}
                  value={selectedEventId}
                >
                  {events.map((event) => <option key={event.id} value={event.id}>{event.title} · {event.date}</option>)}
                </select>
              </label>

              <form className="officer-attendance-checkin" onSubmit={handleCheckIn}>
                <label className="form-field" htmlFor="registration-code">
                  <span>Student Registration Code</span>
                  <input
                    autoComplete="off"
                    id="registration-code"
                    onChange={(event) => setRegistrationCode(event.target.value)}
                    placeholder="e.g. UNIDOS-REG-1006"
                    required
                    value={registrationCode}
                  />
                </label>
                <button className="button button-primary" type="submit" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                  <svg aria-hidden="true" fill="none" height="16" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" viewBox="0 0 24 24" width="16">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  Record Attendance
                </button>
              </form>
            </div>

            {feedback && (
              <p aria-live="polite" className={`attendance-feedback${feedback.ok ? ' is-success' : ' is-error'}`} key={feedback.id} role="status">
                {feedback.message}
              </p>
            )}
            <p className="attendance-checkin-help">The code must belong to a registered student for the selected event. Duplicate check-ins are blocked.</p>
          </Card>

          <Card className="officer-page-card officer-attendance-roster">
            <div className="officer-page-card-heading">
              <div>
                <h2>Registration Roster</h2>
                <p>Student registration records for {selectedEvent?.title}.</p>
              </div>
              <Badge tone="crimson">{checkedInCount} of {attendees.length} checked in</Badge>
            </div>
            <SearchBar label="Search registration records" onChange={setRosterSearch} placeholder="Search by student name, ID or registration code…" value={rosterSearch} />
            {visibleAttendees.length ? (
              <div className="officer-attendance-list">
                {visibleAttendees.map((attendee) => (
                  <article className="officer-attendance-row" key={attendee.id}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span aria-hidden="true" className="officer-person-avatar">
                        {getInitials(attendee.studentName)}
                      </span>
                      <div className="officer-attendee-identity">
                        <strong>{attendee.studentName}</strong>
                        <span>{attendee.studentId} · Code: <code>{attendee.id}</code></span>
                      </div>
                    </div>
                    <div className="officer-attendee-status">
                      <Badge tone={attendee.attendanceStatus === 'ATTENDED' ? 'success' : attendee.attendanceStatus === 'ABSENT' ? 'danger' : 'warning'}>
                        {attendee.attendanceStatus}
                      </Badge>
                      {attendee.checkInTime && <span className="officer-checkin-time">Checked in {attendee.checkInTime}</span>}
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <EmptyState description={rosterSearch ? 'No registrations match your search.' : 'Students who register for this event will appear here.'} title={rosterSearch ? 'No matching records' : 'No registrations yet'} />
            )}
          </Card>
        </>
      ) : (
        <EmptyState description="Attendance check-in becomes available when an event is approved and published." title="No events ready for attendance" />
      )}
      <ConfirmDialog
        confirmLabel="Record attendance"
        message={`Are you sure you want to record attendance for code ${registrationCode.trim()} at “${selectedEvent?.title ?? 'this event'}”? Check-ins cannot be undone here.`}
        onCancel={() => setConfirmCheckInOpen(false)}
        onConfirm={confirmCheckIn}
      />
    </div>
  )
}

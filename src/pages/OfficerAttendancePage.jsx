import { useMemo, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import Badge from '../components/ui/Badge.jsx'
import Card from '../components/ui/Card.jsx'
import { undoAction, useToast } from '../components/ui/useToast.js'
import ConfirmDialog from '../components/ui/ConfirmDialog.jsx'
import EmptyState from '../components/ui/EmptyState.jsx'
import PageHeader from '../components/layout/PageHeader.jsx'
import SearchBar, { matchesQuery } from '../components/ui/SearchBar.jsx'

export default function OfficerAttendancePage() {
  const { adminUsers, captureUndo, checkInStudent, officerEvents, studentRegistrations } = useOutletContext()
  const events = officerEvents.filter((event) => ['PUBLISHED', 'COMPLETED', 'ARCHIVED'].includes(event.status))
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

  return (
    <div className="officer-attendance-page">
      <PageHeader
        description="Record event attendance using the registration code shown on each student's digital pass."
        eyebrow="WMSU COMPUTER SOCIETY"
        title="Event Attendance"
      />

      {events.length ? (
        <>
          <Card className="officer-attendance-controls">
            <label className="form-field" htmlFor="attendance-event">
              <span>Event</span>
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
            {selectedEvent && (
              <div className="officer-attendance-summary" aria-live="polite">
                <span>{selectedEvent.date}</span>
                <strong>{checkedInCount} of {attendees.length} recorded registrations checked in</strong>
              </div>
            )}
            <form className="officer-attendance-checkin" onSubmit={handleCheckIn}>
              <label className="form-field" htmlFor="registration-code">
                <span>Registration code</span>
                <input
                  autoComplete="off"
                  id="registration-code"
                  onChange={(event) => setRegistrationCode(event.target.value)}
                  placeholder="e.g. UNIDOS-REG-1006"
                  required
                  value={registrationCode}
                />
              </label>
              <button className="button button-primary" type="submit">Record attendance</button>
            </form>
            {feedback && (
              <p aria-live="polite" className={`attendance-feedback${feedback.ok ? ' is-success' : ' is-error'}`} key={feedback.id} role="status">
                {feedback.message}
              </p>
            )}
            <p className="attendance-checkin-help">The code must belong to a registered student for the selected event. Duplicate check-ins are blocked.</p>
          </Card>

          <Card className="officer-attendance-roster">
            <div className="adviser-panel-heading">
              <div><h2>Registration records</h2><p>Student-level records available in this preview for {selectedEvent?.title}.</p></div>
            </div>
            <SearchBar label="Search registration records" onChange={setRosterSearch} placeholder="Search by student name, ID or registration code…" value={rosterSearch} />
            {visibleAttendees.length ? (
              <div className="officer-attendance-list">
                {visibleAttendees.map((attendee) => (
                  <article className="officer-attendance-row" key={attendee.id}>
                    <div className="officer-attendee-identity">
                      <strong>{attendee.studentName}</strong>
                      <span>{attendee.studentId} · {attendee.id}</span>
                    </div>
                    <div className="officer-attendee-status">
                      <Badge tone={attendee.attendanceStatus === 'ATTENDED' ? 'success' : attendee.attendanceStatus === 'ABSENT' ? 'danger' : 'warning'}>
                        {attendee.attendanceStatus}
                      </Badge>
                      {attendee.checkInTime && <span>Checked in {attendee.checkInTime}</span>}
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
        open={confirmCheckInOpen}
        title="Record attendance?"
      />
    </div>
  )
}

import { useState } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import Badge from '../components/ui/Badge.jsx'
import Card from '../components/ui/Card.jsx'
import EmptyState from '../components/ui/EmptyState.jsx'
import Icon from '../components/ui/Icon.jsx'
import PageHeader from '../components/layout/PageHeader.jsx'
import SearchBar, { matchesQuery } from '../components/ui/SearchBar.jsx'
import Table from '../components/ui/Table.jsx'
import { useToast } from '../components/ui/useToast.js'
import { findStudentEvent, studentEvents } from '../data/studentEvents.js'

const attendanceTone = {
  ATTENDED: 'success',
  ABSENT: 'danger',
  PENDING: 'warning',
}

const sections = [
  { status: 'ATTENDED', title: 'Attended Events', empty: 'Events you have confirmed attendance for will appear here.' },
  { status: 'PENDING', title: 'Upcoming & Pending Check-In', empty: 'Upcoming registered events waiting for attendance will appear here.' },
  { status: 'ABSENT', title: 'Missed Events', empty: 'Events you registered for but did not attend will appear here.' },
]

export default function StudentAttendancePage() {
  const [search, setSearch] = useState('')
  const { attendWithEventCode, officerEvents = [], studentRegistrations = [] } = useOutletContext()
  const { showToast } = useToast()

  const attendanceRecords = studentRegistrations
    .filter((registration) => registration.status !== 'CANCELLED')
    .map((registration) => ({
      ...registration,
      event: findStudentEvent(registration.eventId, officerEvents, studentEvents),
    }))
    .filter((registration) => registration.event)
    .sort((a, b) => new Date(b.event.date) - new Date(a.event.date))

  // Find events where the student can check in (pending attendance)
  const pendingRegistrations = attendanceRecords.filter((r) => r.attendanceStatus !== 'ATTENDED')

  const [inputEventId, setInputEventId] = useState(() => pendingRegistrations[0]?.eventId || attendanceRecords[0]?.eventId || '')
  const [inputCode, setInputCode] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [feedback, setFeedback] = useState(null)

  const attendedCount = attendanceRecords.filter((record) => record.attendanceStatus === 'ATTENDED').length
  const completedAttendanceCount = attendanceRecords.filter(
    (record) => record.attendanceStatus === 'ATTENDED' || record.attendanceStatus === 'ABSENT'
  ).length
  const attendanceRate = completedAttendanceCount
    ? Math.round((attendedCount / completedAttendanceCount) * 100)
    : 0

  const visibleRecords = attendanceRecords.filter((record) =>
    matchesQuery(search, record.event.title, record.event.organizationName, record.event.date, record.event.location)
  )

  // Handle self-attendance code submission
  async function handleAttendWithCode(event) {
    event.preventDefault()
    if (!inputEventId) {
      setFeedback({ ok: false, message: 'Please select an event to check in for.' })
      return
    }
    if (!inputCode.trim()) {
      setFeedback({ ok: false, message: 'Please enter the attendance code provided by the organizer.' })
      return
    }

    setIsSubmitting(true)
    setFeedback(null)

    const result = await attendWithEventCode({
      eventId: inputEventId,
      code: inputCode.trim(),
    })

    setIsSubmitting(false)

    if (result?.ok) {
      const targetEvent = attendanceRecords.find((r) => String(r.eventId) === String(inputEventId))?.event
      setInputCode('')
      setFeedback({
        ok: true,
        message: result.message || 'Attendance confirmed successfully!',
        eventTitle: targetEvent?.title || result.data?.event_title,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      })
      showToast(result.message || 'Attendance verified!', 'success')
    } else {
      setFeedback({
        ok: false,
        message: result?.message || 'Invalid attendance code. Please check the code announced by your organizer.',
      })
    }
  }

  const columns = [
    {
      key: 'event',
      label: 'Event',
      render: (_, row) => (
        <div style={{ display: 'grid', gap: '2px' }}>
          <Link className="attendance-event-link" to={`/student/events/${row.event.id}`}>
            {row.event.title}
          </Link>
          <span style={{ fontSize: '11px', color: '#77717a' }}>{row.event.organizationName}</span>
        </div>
      ),
    },
    { key: 'date', label: 'Date & Venue', render: (_, row) => `${row.event.date} · ${row.event.location || 'Campus'}` },
    {
      key: 'status',
      label: 'Status',
      render: (_, row) => (
        <Badge tone={attendanceTone[row.attendanceStatus] || 'neutral'}>
          {row.attendanceStatus || 'PENDING'}
        </Badge>
      ),
    },
    {
      key: 'checkIn',
      label: 'Check-In Verification',
      render: (_, row) => (
        <div style={{ display: 'grid', gap: '2px' }}>
          <span>{row.checkInTime || '—'}</span>
          {row.checkInMethod && (
            <span style={{ fontSize: '11px', color: '#888' }}>
              via {row.checkInMethod === 'SELF_CHECKIN' ? 'Self-Check In' : row.checkInMethod}
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'pass',
      label: 'Digital Pass',
      render: (_, row) => (
        <Link className="button button-ghost button-sm" to={`/student/registrations/${row.id}/pass`}>
          View Pass
        </Link>
      ),
    },
  ]

  return (
    <div className="student-attendance-page">
      <PageHeader
        description="Verify your attendance at campus events using organizer-provided codes and review your complete participation history."
        eyebrow="UNIDOS STUDENT PORTAL"
        title="Event Attendance & History"
      >
        <section aria-label="Attendance summary" className="attendance-summary">
          <article>
            <span className="stat-label">Events Attended</span>
            <strong className="stat-value">{attendedCount}</strong>
          </article>
          <article>
            <span className="stat-label">Total Registered</span>
            <strong className="stat-value">{attendanceRecords.length}</strong>
          </article>
          <article>
            <span className="stat-label">Turnout Rate</span>
            <strong className="stat-value">{attendanceRate}%</strong>
          </article>
        </section>
      </PageHeader>

      {/* Hero: Self Attendance Check-In with Code */}
      <Card className="student-self-checkin-card">
        <div className="self-checkin-header">
          <div className="self-checkin-icon">
            <Icon name="check-circle" size={24} />
          </div>
          <div>
            <h2>Self Attendance Check-In</h2>
            <p>Enter the random attendance code displayed on the screen or announced by the event organizer.</p>
          </div>
        </div>

        <form className="student-checkin-form" onSubmit={handleAttendWithCode}>
          <label className="form-field" htmlFor="self-checkin-event" style={{ flex: 1.2 }}>
            <span>Select Event</span>
            <select
              id="self-checkin-event"
              onChange={(e) => {
                setInputEventId(e.target.value)
                setFeedback(null)
              }}
              value={inputEventId}
            >
              {pendingRegistrations.length > 0 ? (
                pendingRegistrations.map((r) => (
                  <option key={r.eventId} value={r.eventId}>
                    {r.event.title} · {r.event.date}
                  </option>
                ))
              ) : attendanceRecords.length > 0 ? (
                attendanceRecords.map((r) => (
                  <option key={r.eventId} value={r.eventId}>
                    {r.event.title} ({r.attendanceStatus})
                  </option>
                ))
              ) : (
                <option value="">No registered events</option>
              )}
            </select>
          </label>

          <label className="form-field" htmlFor="self-checkin-code" style={{ flex: 1 }}>
            <span>Attendance Code</span>
            <input
              autoCapitalize="characters"
              autoComplete="off"
              id="self-checkin-code"
              maxLength={12}
              onChange={(e) => setInputCode(e.target.value.toUpperCase())}
              placeholder="e.g. WMSU-8X2M"
              required
              spellCheck="false"
              style={{
                fontFamily: 'monospace',
                fontSize: '15px',
                fontWeight: '700',
                letterSpacing: '1px',
                textTransform: 'uppercase',
              }}
              value={inputCode}
            />
          </label>

          <button
            className="button button-primary self-checkin-submit"
            disabled={isSubmitting || !inputEventId}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
            type="submit"
          >
            <Icon name="check-circle" size={16} />
            {isSubmitting ? 'Checking In…' : 'Confirm Attendance'}
          </button>
        </form>

        {feedback && (
          <div
            aria-live="polite"
            className={`self-checkin-feedback ${feedback.ok ? 'is-success' : 'is-error'}`}
            role="status"
          >
            <Icon name={feedback.ok ? 'check-circle' : 'slash'} size={18} />
            <div>
              <strong>{feedback.message}</strong>
              {feedback.ok && feedback.eventTitle && (
                <span style={{ display: 'block', fontSize: '12px', marginTop: '2px' }}>
                  Confirmed for <strong>{feedback.eventTitle}</strong> at {feedback.time}. Status is now marked PRESENT.
                </span>
              )}
            </div>
          </div>
        )}

        <small className="self-checkin-help">
          <Icon name="clock" size={13} style={{ display: 'inline-block', verticalAlign: '-2px', marginRight: '4px' }} />
          Codes are temporary and unique to each session. Your digital event pass will update immediately upon confirmation.
        </small>
      </Card>

      {/* Search & Records */}
      <SearchBar
        label="Search attendance records"
        onChange={setSearch}
        placeholder="Search by event, organization, date or venue…"
        resultText={search ? `${visibleRecords.length} of ${attendanceRecords.length} records` : ''}
        sticky
        value={search}
      />

      {attendanceRecords.length === 0 ? (
        <EmptyState
          description="Attendance records will appear here after you register for events."
          title="No attendance records"
        />
      ) : (
        sections.map((section) => {
          const rows = visibleRecords.filter((record) => record.attendanceStatus === section.status)
          const headingId = `attendance-${section.status.toLowerCase()}-title`
          return (
            <section aria-labelledby={headingId} className="attendance-records" key={section.status}>
              <div className="attendance-records-heading">
                <h2 id={headingId}>{section.title}</h2>
                <Badge tone={attendanceTone[section.status]}>{rows.length}</Badge>
                {section.status === 'ATTENDED' && (
                  <Link to="/student/registrations">
                    View My Registrations <Icon name="arrow-right" size={13} />
                  </Link>
                )}
              </div>
              {rows.length ? (
                <Table columns={columns} getRowKey={(row) => row.id} rows={rows} />
              ) : (
                <EmptyState
                  description={search ? 'No records in this table match your search.' : section.empty}
                  title={`No ${section.title.toLowerCase()}`}
                />
              )}
            </section>
          )
        })
      )}
    </div>
  )
}

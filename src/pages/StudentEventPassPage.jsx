import { useState } from 'react'
import { Link, useOutletContext, useParams } from 'react-router-dom'
import Badge from '../components/ui/Badge.jsx'
import Card from '../components/ui/Card.jsx'
import Icon from '../components/ui/Icon.jsx'
import PageHeader from '../components/layout/PageHeader.jsx'
import { formatDisplayName } from '../data/displayName.js'
import { findStudentEvent, studentEvents } from '../data/studentEvents.js'
import { useToast } from '../components/ui/useToast.js'
import WmsuLogo from '../components/ui/WmsuLogo.jsx'

export default function StudentEventPassPage() {
  const { registrationId } = useParams()
  const { attendWithEventCode, currentUser, officerEvents = [], studentRegistrations = [] } = useOutletContext()
  const { showToast } = useToast()

  const registration =
    studentRegistrations.find((item) => String(item.id) === String(registrationId)) ??
    studentRegistrations.find((item) => item.status !== 'CANCELLED')
  const event = registration && findStudentEvent(registration.eventId, officerEvents, studentEvents)

  const [code, setCode] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [feedback, setFeedback] = useState(null)

  if (!registration || !event || registration.status === 'CANCELLED') {
    return (
      <div className="student-event-pass-page">
        <PageHeader eyebrow="UNIDOS STUDENT PORTAL" title="Event Pass Unavailable" />
        <Card className="event-pass-unavailable">
          <p>Register for a published campus event to view your digital event pass.</p>
          <Link className="button button-primary" to="/student/registrations">
            Back to My Registrations
          </Link>
        </Card>
      </div>
    )
  }

  const isAttended = registration.attendanceStatus === 'ATTENDED'

  async function handlePassCheckIn(e) {
    e.preventDefault()
    if (!code.trim()) return
    setIsSubmitting(true)
    setFeedback(null)

    const res = await attendWithEventCode?.({
      eventId: event.id,
      code: code.trim(),
    })

    setIsSubmitting(false)
    if (res?.ok) {
      setCode('')
      setFeedback({ ok: true, message: res.message })
      showToast(res.message || 'Attendance recorded successfully!', 'success')
    } else {
      setFeedback({ ok: false, message: res?.message || 'Invalid attendance code.' })
    }
  }

  return (
    <div className="student-event-pass-page">
      <PageHeader
        description="Keep this digital pass available when you attend the event. You can also self-check in using the code announced by organizers."
        eyebrow="UNIDOS STUDENT PORTAL · DIGITAL PASS"
        title="Event Pass"
      />
      <Card className="student-event-pass">
        <div className="event-pass-brand">
          <WmsuLogo className="event-pass-seal" />
          <span>
            <strong>UNIDOS</strong>
            <small>Student Organization Management System</small>
          </span>
        </div>

        <div className="event-pass-heading">
          <span>EVENT PASS</span>
          <Badge tone={isAttended ? 'success' : registration.attendanceStatus === 'ABSENT' ? 'danger' : 'warning'}>
            {isAttended ? 'ATTENDED / VERIFIED' : registration.attendanceStatus || 'PENDING'}
          </Badge>
        </div>

        <h2>{event.title}</h2>

        <div className="event-pass-facts">
          <div>
            <span>Student</span>
            <strong>{formatDisplayName(currentUser)}</strong>
          </div>
          <div>
            <span>Student ID</span>
            <strong>{currentUser?.studentId || registration.studentId}</strong>
          </div>
          <div>
            <span>Date</span>
            <strong>{event.date}</strong>
          </div>
          <div>
            <span>Time</span>
            <strong>{event.time}</strong>
          </div>
          <div>
            <span>Location</span>
            <strong>{event.location}</strong>
          </div>
          <div className="event-pass-registration-code">
            <span>Pass QR / Code</span>
            <strong>{registration.qrCodeValue || `REG-${registration.id}`}</strong>
          </div>
          {registration.checkInTime && (
            <div>
              <span>Checked in</span>
              <strong>{registration.checkInTime}</strong>
            </div>
          )}
        </div>

        {/* In-Pass Code Check-In Widget */}
        {!isAttended ? (
          <div className="event-pass-checkin-box">
            <span className="pass-box-title">
              <Icon name="check-circle" size={14} /> Self Check-In with Event Code
            </span>
            <p>If the speaker or organizer displayed an event attendance code, enter it below to confirm attendance now.</p>
            <form className="pass-checkin-form" onSubmit={handlePassCheckIn}>
              <input
                autoCapitalize="characters"
                autoComplete="off"
                maxLength={12}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="e.g. WMSU-8X2M"
                required
                style={{
                  fontFamily: 'monospace',
                  fontWeight: '700',
                  letterSpacing: '1px',
                  textTransform: 'uppercase',
                }}
                value={code}
              />
              <button className="button button-primary button-sm" disabled={isSubmitting} type="submit">
                {isSubmitting ? 'Verifying…' : 'Check In'}
              </button>
            </form>
            {feedback && (
              <span className={`pass-feedback ${feedback.ok ? 'is-success' : 'is-error'}`}>
                {feedback.message}
              </span>
            )}
          </div>
        ) : (
          <div className="event-pass-verified-stamp">
            <Icon name="check-circle" size={20} />
            <span>ATTENDANCE VERIFIED & RECORDED</span>
          </div>
        )}

        <div className="event-pass-footer">
          <span>Show this pass code to the event organizer, or self-check in using the event code.</span>
          <Link to="/student/attendance">Go to Attendance History</Link>
        </div>
      </Card>
    </div>
  )
}

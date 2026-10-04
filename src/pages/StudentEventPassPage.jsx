import { Link, useParams } from 'react-router-dom'
import Badge from '../components/ui/Badge.jsx'
import Card from '../components/ui/Card.jsx'
import PageHeader from '../components/layout/PageHeader.jsx'
import { formatDisplayName } from '../data/displayName.js'
import { useOutletContext } from 'react-router-dom'
import { studentEvents } from '../data/studentEvents.js'
import { findStudentEvent } from '../data/officerStudentEvent.js'

export default function StudentEventPassPage() {
  const { registrationId } = useParams()
  const { currentUser, officerEvents, studentRegistrations } = useOutletContext()
  const registration = studentRegistrations.find((item) => item.id === registrationId)
  const event = registration && findStudentEvent(registration.eventId, officerEvents, studentEvents)

  if (!registration || !event || registration.status === 'CANCELLED') {
    return (
      <div className="student-event-pass-page">
        <PageHeader eyebrow="UNIDOS STUDENT PORTAL" title="Event Pass Unavailable" />
        <Card className="event-pass-unavailable">
          <p>This event pass is not available for the selected registration.</p>
          <Link className="button button-primary" to="/student/registrations">Back to My Registrations</Link>
        </Card>
      </div>
    )
  }

  return (
    <div className="student-event-pass-page">
      <PageHeader
        description="Keep this digital pass available when you attend the event."
        eyebrow="UNIDOS STUDENT PORTAL · DIGITAL PASS"
        title="Event Pass"
      />
      <Card className="student-event-pass">
        <div className="event-pass-brand">
          <span aria-hidden="true" className="event-pass-seal">WMSU</span>
          <span><strong>UNIDOS</strong><small>Student Organization Management System</small></span>
        </div>
        <div className="event-pass-heading">
          <span>EVENT PASS</span>
          <Badge tone={registration.attendanceStatus === 'ATTENDED' ? 'success' : registration.attendanceStatus === 'ABSENT' ? 'danger' : 'warning'}>
            {registration.attendanceStatus}
          </Badge>
        </div>
        <h2>{event.title}</h2>
        <div className="event-pass-facts">
          <div><span>Student</span><strong>{formatDisplayName(currentUser)}</strong></div>
          <div><span>Date</span><strong>{event.date}</strong></div>
          <div><span>Time</span><strong>{event.time}</strong></div>
          <div><span>Location</span><strong>{event.location}</strong></div>
          <div className="event-pass-registration-code"><span>Registration code</span><strong>{registration.id}</strong></div>
          {registration.checkInTime && <div><span>Checked in</span><strong>{registration.checkInTime}</strong></div>}
        </div>
        <div className="event-pass-footer">
          <span>Show this registration code to the event organizer for attendance check-in.</span>
          <Link to="/student/registrations">Back to My Registrations</Link>
        </div>
      </Card>
    </div>
  )
}

import { Link, useOutletContext } from 'react-router-dom'
import Badge from '../components/ui/Badge.jsx'
import EmptyState from '../components/ui/EmptyState.jsx'
import PageHeader from '../components/layout/PageHeader.jsx'
import Table from '../components/ui/Table.jsx'
import { studentEvents } from '../data/studentEvents.js'
import { findStudentEvent } from '../data/officerStudentEvent.js'

const attendanceTone = {
  ATTENDED: 'success',
  ABSENT: 'danger',
  PENDING: 'warning',
}

export default function StudentAttendancePage() {
  const { officerEvents, studentRegistrations } = useOutletContext()
  const attendanceRecords = studentRegistrations
    .filter((registration) => registration.status !== 'CANCELLED')
    .map((registration) => ({
      ...registration,
      event: findStudentEvent(registration.eventId, officerEvents, studentEvents),
    }))
    .filter((registration) => registration.event)
    .sort((a, b) => new Date(b.event.date) - new Date(a.event.date))

  const attendedCount = attendanceRecords.filter((record) => record.attendanceStatus === 'ATTENDED').length
  const completedAttendanceCount = attendanceRecords.filter((record) => (
    record.attendanceStatus === 'ATTENDED' || record.attendanceStatus === 'ABSENT'
  )).length
  const attendanceRate = completedAttendanceCount
    ? Math.round((attendedCount / completedAttendanceCount) * 100)
    : 0

  const columns = [
    {
      key: 'event',
      label: 'Event',
      render: (_, row) => <Link className="attendance-event-link" to={`/student/events/${row.event.id}`}>{row.event.title}</Link>,
    },
    { key: 'date', label: 'Date', render: (_, row) => row.event.date },
    { key: 'organization', label: 'Organization', render: (_, row) => row.event.organizationName },
    {
      key: 'attendance',
      label: 'Attendance',
      render: (_, row) => <Badge tone={attendanceTone[row.attendanceStatus]}>{row.attendanceStatus}</Badge>,
    },
    { key: 'checkIn', label: 'Check-in time', render: (_, row) => row.checkInTime ?? '—' },
  ]

  return (
    <div className="student-attendance-page">
      <PageHeader
        description="Review your event participation and attendance history."
        eyebrow="UNIDOS STUDENT PORTAL"
        title="Attendance History"
      />

      <section aria-label="Attendance summary" className="attendance-summary">
        <article><span>Total Events Attended</span><strong>{attendedCount}</strong></article>
        <article><span>Total Events Registered</span><strong>{attendanceRecords.length}</strong></article>
        <article><span>Attendance Rate</span><strong>{attendanceRate}%</strong></article>
      </section>

      <section aria-labelledby="attendance-records-title" className="attendance-records">
        <div className="attendance-records-heading">
          <h2 id="attendance-records-title">Event Attendance</h2>
          <Link to="/student/registrations">View My Registrations →</Link>
        </div>
        {attendanceRecords.length ? (
          <Table columns={columns} getRowKey={(row) => row.id} rows={attendanceRecords} />
        ) : (
          <EmptyState description="Attendance records will appear here after you register for events." title="No attendance records" />
        )}
      </section>
    </div>
  )
}

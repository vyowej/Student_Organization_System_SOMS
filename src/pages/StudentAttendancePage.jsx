import { useState } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import Badge from '../components/ui/Badge.jsx'
import EmptyState from '../components/ui/EmptyState.jsx'
import PageHeader from '../components/layout/PageHeader.jsx'
import SearchBar, { matchesQuery } from '../components/ui/SearchBar.jsx'
import Table from '../components/ui/Table.jsx'
import { studentEvents } from '../data/studentEvents.js'
import { findStudentEvent } from '../data/officerStudentEvent.js'

const attendanceTone = {
  ATTENDED: 'success',
  ABSENT: 'danger',
  PENDING: 'warning',
}

const sections = [
  { status: 'ATTENDED', title: 'Attended', empty: 'Events you checked in to will appear here.' },
  { status: 'PENDING', title: 'Pending', empty: 'Upcoming or not-yet-recorded events will appear here.' },
  { status: 'ABSENT', title: 'Absent', empty: 'Events you registered for but missed will appear here.' },
]

export default function StudentAttendancePage() {
  const [search, setSearch] = useState('')
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

  const visibleRecords = attendanceRecords.filter((record) => matchesQuery(
    search, record.event.title, record.event.organizationName, record.event.date, record.event.location,
  ))

  const columns = [
    {
      key: 'event',
      label: 'Event',
      render: (_, row) => <Link className="attendance-event-link" to={`/student/events/${row.event.id}`}>{row.event.title}</Link>,
    },
    { key: 'date', label: 'Date', render: (_, row) => row.event.date },
    { key: 'organization', label: 'Organization', render: (_, row) => row.event.organizationName },
    { key: 'checkIn', label: 'Check-in time', render: (_, row) => row.checkInTime ?? '—' },
  ]

  return (
    <div className="student-attendance-page">
      <PageHeader
        description="Review your event participation and attendance history."
        eyebrow="UNIDOS STUDENT PORTAL"
        title="Attendance History"
      >
        <section aria-label="Attendance summary" className="attendance-summary">
          <article><span className="stat-label">Total Events Attended</span><strong className="stat-value">{attendedCount}</strong></article>
          <article><span className="stat-label">Total Events Registered</span><strong className="stat-value">{attendanceRecords.length}</strong></article>
          <article><span className="stat-label">Attendance Rate</span><strong className="stat-value">{attendanceRate}%</strong></article>
        </section>
      </PageHeader>

      <SearchBar
        label="Search attendance records"
        onChange={setSearch}
        placeholder="Search by event, organization, date or venue…"
        resultText={search ? `${visibleRecords.length} of ${attendanceRecords.length} records` : ''}
        sticky
        value={search}
      />

      {attendanceRecords.length === 0 ? (
        <EmptyState description="Attendance records will appear here after you register for events." title="No attendance records" />
      ) : (
        sections.map((section) => {
          const rows = visibleRecords.filter((record) => record.attendanceStatus === section.status)
          const headingId = `attendance-${section.status.toLowerCase()}-title`
          return (
            <section aria-labelledby={headingId} className="attendance-records" key={section.status}>
              <div className="attendance-records-heading">
                <h2 id={headingId}>{section.title}</h2>
                <Badge tone={attendanceTone[section.status]}>{rows.length}</Badge>
                {section.status === 'ATTENDED' && <Link to="/student/registrations">View My Registrations →</Link>}
              </div>
              {rows.length ? (
                <Table columns={columns} getRowKey={(row) => row.id} rows={rows} />
              ) : (
                <EmptyState
                  description={search ? 'No records in this table match your search.' : section.empty}
                  title={`No ${section.title.toLowerCase()} events`}
                />
              )}
            </section>
          )
        })
      )}
    </div>
  )
}

/**
 * Student Portal Dashboard Page (`/student/dashboard`)
 *
 * Displays personalized greetings, organization membership counts, upcoming
 * campus events, and recent membership/event updates for the signed-in student.
 */
import { useMemo, useState } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import { formatGreetingName, getTimeGreeting } from '../data/displayName.js'
import Badge from '../components/ui/Badge.jsx'
import EmptyState from '../components/ui/EmptyState.jsx'
import Icon from '../components/ui/Icon.jsx'
import { officerEventToStudentEvent } from '../data/studentEvents.js'

function StudentWelcomeMark() {
  const [logoFailed, setLogoFailed] = useState(false)

  return (
    <div aria-hidden="true" className="student-welcome-mark">
      {logoFailed
        ? <span className="student-welcome-mark-fallback">UNIDOS</span>
        : <img alt="" onError={() => setLogoFailed(true)} src="/Unidos.png" />}
    </div>
  )
}

function SectionHeading({ id, title, to, linkLabel }) {
  return (
    <div className="student-dashboard-section-heading">
      <h2 id={id}>{title}</h2>
      <Link to={to}>{linkLabel}<Icon name="arrow" /></Link>
    </div>
  )
}

export default function StudentDashboardPage() {
  const {
    currentUser,
    studentOrganizations = [],
    studentMemberships = [],
    officerEvents = [],
    studentRegistrations = [],
    officerAnnouncements = [],
  } = useOutletContext()

  const myMemberships = useMemo(
    () =>
      studentMemberships.filter(
        (m) =>
          (currentUser?.studentDbId && String(m.studentDbId) === String(currentUser.studentDbId)) ||
          (currentUser?.id && String(m.userId) === String(currentUser.id)) ||
          (currentUser?.studentId && String(m.studentId).toLowerCase() === String(currentUser.studentId).toLowerCase()),
      ),
    [studentMemberships, currentUser],
  )

  const activeMemberships = myMemberships.filter((m) => m.status === 'ACTIVE')
  const pendingApplications = myMemberships.filter((m) => m.status === 'PENDING')
  const activeRegs = studentRegistrations.filter((r) => r.status !== 'CANCELLED')
  const attendedCount = studentRegistrations.filter((r) => r.attendanceStatus === 'ATTENDED').length

  const metrics = [
    { label: 'Joined Organizations', value: activeMemberships.length, tone: 'crimson' },
    { label: 'Pending Applications', value: pendingApplications.length, tone: 'gold' },
    { label: 'Registered Events', value: activeRegs.length, tone: 'emerald' },
    { label: 'Events Attended', value: attendedCount, tone: 'blue' },
  ]

  const myOrgCards = useMemo(
    () =>
      activeMemberships.map((m, idx) => {
        const org = studentOrganizations.find((o) => String(o.id) === String(m.organizationId))
        return {
          id: m.organizationId,
          name: org?.name || m.organizationName || 'Student Organization',
          initials: (org?.acronym || m.organizationName || 'ORG').slice(0, 3).toUpperCase(),
          role: m.role || m.position || 'Member',
          tone: ['crimson', 'gold', 'emerald', 'blue'][idx % 4],
        }
      }),
    [activeMemberships, studentOrganizations],
  )

  const upcomingEvents = useMemo(
    () =>
      officerEvents
        .filter((e) => ['PUBLISHED', 'APPROVED'].includes(e.status))
        .slice(0, 4)
        .map(officerEventToStudentEvent),
    [officerEvents],
  )

  const recentAnnouncements = useMemo(
    () =>
      (officerAnnouncements || [])
        .filter((a) => a.status === 'PUBLISHED' || !a.status)
        .slice(0, 4),
    [officerAnnouncements],
  )

  return (
    <div className="student-dashboard">
      <div className="page-hero page-hero-student">
        <section aria-labelledby="student-welcome-title" className="student-welcome dashboard-enter">
          <div>
            <span className="student-dashboard-eyebrow">UNIDOS Student Portal</span>
            <h1 id="student-welcome-title">{getTimeGreeting()}, {formatGreetingName(currentUser)}!</h1>
            <p>Stay connected with your organizations, events, and campus activities.</p>
          </div>
          <StudentWelcomeMark />
        </section>

        <section aria-label="Your activity overview" className="student-metrics">
          {metrics.map((metric, index) => (
            <article className={`student-metric metric-${metric.tone}`} key={metric.label} style={{ '--metric-index': index }}>
              <span className="stat-label">{metric.label}</span>
              <strong aria-label={`${metric.value} ${metric.label}`} className="stat-value">{metric.value}</strong>
            </article>
          ))}
        </section>
      </div>

      <div className="student-dashboard-columns">
        <section aria-labelledby="quick-actions-title" className="student-dashboard-panel student-quick-actions-panel">
          <div className="student-dashboard-section-heading">
            <div>
              <h2 id="quick-actions-title">Quick Actions</h2>
              <span className="student-section-subhead">Frequent student portal destinations & shortcuts</span>
            </div>
          </div>
          <div className="student-quick-actions-grid">
            <Link className="student-quick-action-card" to="/student/organizations">
              <span className="quick-action-icon"><Icon name="organization" /></span>
              <div className="quick-action-info">
                <span className="quick-action-title">Explore Organizations</span>
                <span className="quick-action-desc">Discover recognized student clubs & societies</span>
              </div>
              <span className="quick-action-arrow-wrap"><Icon className="quick-action-arrow" name="arrow" /></span>
            </Link>

            <Link className="student-quick-action-card" to="/student/events">
              <span className="quick-action-icon"><Icon name="calendar" /></span>
              <div className="quick-action-info">
                <span className="quick-action-title">Browse Events</span>
                <span className="quick-action-desc">Find upcoming summits, workshops & campus activities</span>
              </div>
              <span className="quick-action-arrow-wrap"><Icon className="quick-action-arrow" name="arrow" /></span>
            </Link>

            <Link className="student-quick-action-card" to="/student/registrations">
              <span className="quick-action-icon"><Icon name="ticket" /></span>
              <div className="quick-action-info">
                <span className="quick-action-title">My Registrations</span>
                <span className="quick-action-desc">View registered events, passes & attendance</span>
              </div>
              <span className="quick-action-arrow-wrap"><Icon className="quick-action-arrow" name="arrow" /></span>
            </Link>
          </div>
        </section>

        <section aria-labelledby="my-organizations-title" className="student-dashboard-panel">
          <SectionHeading id="my-organizations-title" linkLabel="View all organizations" title="My Organizations" to="/student/my-organizations" />
          {myOrgCards.length > 0 ? (
            <div className="student-organization-list">
              {myOrgCards.map((organization) => (
                <Link
                  aria-label={`${organization.name}, ${organization.role}`}
                  className="student-organization-card"
                  key={organization.id}
                  to={`/student/organizations/${organization.id}`}
                >
                  <div aria-hidden="true" className={`student-organization-avatar avatar-${organization.tone}`}>
                    {organization.initials}
                  </div>
                  <div className="student-organization-copy">
                    <h3>{organization.name}</h3>
                    <span>{organization.role}</span>
                  </div>
                  <span aria-hidden="true" className="student-card-link"><Icon name="arrow" /></span>
                </Link>
              ))}
            </div>
          ) : (
            <EmptyState
              description="Join an accredited organization to see it listed here."
              title="No active memberships yet"
            />
          )}
        </section>

        <section aria-labelledby="upcoming-events-title" className="student-dashboard-panel">
          <SectionHeading id="upcoming-events-title" linkLabel="View all events" title="Upcoming Events" to="/student/events" />
          {upcomingEvents.length > 0 ? (
            <div className="student-event-list">
              {upcomingEvents.map((event) => (
                <Link
                  aria-label={`View event: ${event.title}`}
                  className="student-event-card"
                  key={event.id}
                  to={`/student/events/${event.id}`}
                >
                  <div aria-hidden="true" className="student-event-date">
                    <span>{event.date.split(' ')[0]?.slice(0, 3) || 'EVT'}</span>
                    <strong>{event.date.match(/\d+/)?.[0] || '•'}</strong>
                  </div>
                  <div className="student-event-copy">
                    <div className="student-event-title-line">
                      <h3>{event.title}</h3>
                      <Badge tone="success">{event.status}</Badge>
                    </div>
                    <p>{event.organization}</p>
                    <span>{event.time} <i aria-hidden="true">·</i> {event.location}</span>
                  </div>
                  <span aria-hidden="true" className="student-event-arrow"><Icon name="arrow" /></span>
                </Link>
              ))}
            </div>
          ) : (
            <EmptyState
              description="Published campus events will appear here."
              title="No upcoming events"
            />
          )}
        </section>

        <section aria-labelledby="recent-announcements-title" className="student-dashboard-panel">
          <SectionHeading id="recent-announcements-title" linkLabel="Explore organizations" title="Latest Announcements" to="/student/organizations" />
          {recentAnnouncements.length > 0 ? (
            <div className="student-event-list">
              {recentAnnouncements.map((announcement) => (
                <Link
                  aria-label={`View announcement from ${announcement.organizationName}`}
                  className="student-event-card"
                  key={announcement.id}
                  to={`/student/organizations/${announcement.organizationId}`}
                >
                  <div aria-hidden="true" className="student-event-date" style={{ background: 'var(--color-crimson, #9e1b32)', color: '#fff' }}>
                    <Icon name="bell" size={16} />
                    <small style={{ fontSize: '10px' }}>UPDATE</small>
                  </div>
                  <div className="student-event-copy">
                    <div className="student-event-title-line">
                      <h3>{announcement.title}</h3>
                      <Badge tone="crimson">{announcement.organizationName || 'Organization'}</Badge>
                    </div>
                    <p style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {announcement.content || announcement.description}
                    </p>
                    <span>{announcement.date || 'Recently'} <i aria-hidden="true">·</i> Posted by {announcement.postedBy}</span>
                  </div>
                  <span aria-hidden="true" className="student-event-arrow"><Icon name="arrow" /></span>
                </Link>
              ))}
            </div>
          ) : (
            <EmptyState
              description="Announcements published by student organizations will appear here."
              title="No announcements yet"
            />
          )}
        </section>
      </div>
    </div>
  )
}

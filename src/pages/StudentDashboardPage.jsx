import { useEffect, useState } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import { formatDisplayName } from '../data/displayName.js'
import Badge from '../components/ui/Badge.jsx'
import {
  studentDashboardEvents,
  studentDashboardMetrics,
  studentDashboardNotifications,
  studentDashboardOrganizations,
} from '../data/studentDashboard.js'

const iconPaths = {
  organization: <><path d="M3 21h18" /><path d="M5 21V7l7-4 7 4v14" /><path d="M9 21v-5h6v5" /><path d="M9 9h.01M15 9h.01" /></>,
  calendar: <><rect height="17" rx="2" width="18" x="3" y="5" /><path d="M16 3v4M8 3v4M3 11h18" /><path d="m9 16 2 2 4-4" /></>,
  ticket: <><path d="M3 8a2 2 0 0 0 0 4v5h18v-5a2 2 0 0 1 0-4V3H3z" /><path d="M13 3v2M13 9v2M13 15v2" /></>,
  check: <><circle cx="12" cy="12" r="9" /><path d="m8 12 2.5 2.5L16 9" /></>,
  bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" /><path d="M10 21h4" /></>,
  arrow: <><path d="M5 12h14M13 6l6 6-6 6" /></>,
}

function Icon({ name, className = '' }) {
  return (
    <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 24 24">
      {iconPaths[name]}
    </svg>
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
  const { currentUser, markNotificationRead, readNotificationIds } = useOutletContext()
  const [metricCounts, setMetricCounts] = useState(() => {
    const reducedMotion = typeof window !== 'undefined'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    return studentDashboardMetrics.map((metric) => reducedMotion ? Number(metric.value) : 0)
  })
  useEffect(() => {
    const targets = studentDashboardMetrics.map((metric) => Number(metric.value))
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined

    let frameId
    const duration = 900
    const startTime = performance.now()

    function updateCounts(now) {
      const progress = Math.min((now - startTime) / duration, 1)
      const easedProgress = 1 - ((1 - progress) ** 3)
      setMetricCounts(targets.map((target) => Math.round(target * easedProgress)))
      if (progress < 1) frameId = requestAnimationFrame(updateCounts)
    }

    frameId = requestAnimationFrame(updateCounts)
    return () => cancelAnimationFrame(frameId)
  }, [])

  return (
    <div className="student-dashboard">
      <section aria-labelledby="student-welcome-title" className="student-welcome dashboard-enter">
        <div>
          <span className="student-dashboard-eyebrow">UNIDOS Student Portal</span>
          <h1 id="student-welcome-title">Good morning, {formatDisplayName(currentUser)}!</h1>
          <p>Stay connected with your organizations, events, and campus activities.</p>
        </div>
        <div aria-hidden="true" className="student-welcome-mark">W</div>
      </section>

      <section aria-label="Your activity overview" className="student-metrics">
        {studentDashboardMetrics.map((metric, index) => (
          <article className={`student-metric metric-${metric.tone}`} key={metric.label} style={{ '--metric-index': index }}>
            <div className="student-metric-icon"><Icon name={metric.icon} /></div>
            <div>
              <strong aria-label={`${metric.value} ${metric.label}`}>{metricCounts[index]}</strong>
              <span>{metric.label}</span>
            </div>
          </article>
        ))}
      </section>

      <div className="student-dashboard-columns">
        <section aria-labelledby="my-organizations-title" className="student-dashboard-panel">
          <SectionHeading id="my-organizations-title" linkLabel="View all organizations" title="My Organizations" to="/student/my-organizations" />
          <div className="student-organization-list">
            {studentDashboardOrganizations.map((organization) => (
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
        </section>

        <section aria-labelledby="upcoming-events-title" className="student-dashboard-panel">
          <SectionHeading id="upcoming-events-title" linkLabel="View all events" title="Upcoming Events" to="/student/events" />
          <div className="student-event-list">
            {studentDashboardEvents.map((event) => (
              <Link
                aria-label={`View event: ${event.title}`}
                className="student-event-card"
                key={event.id}
                to={`/student/events/${event.id}`}
              >
                <div aria-hidden="true" className="student-event-date">
                  <span>{event.date.split(' ')[0].slice(0, 3)}</span>
                  <strong>{event.date.match(/\d+/)?.[0]}</strong>
                </div>
                <div className="student-event-copy">
                  <div className="student-event-title-line">
                    <h3>{event.title}</h3>
                    <Badge tone={event.status === 'Almost Full' ? 'warning' : 'success'}>{event.status}</Badge>
                  </div>
                  <p>{event.organization}</p>
                  <span>{event.time} <i aria-hidden="true">·</i> {event.location}</span>
                </div>
                <span aria-hidden="true" className="student-event-arrow"><Icon name="arrow" /></span>
              </Link>
            ))}
          </div>
        </section>
      </div>

      <div className="student-dashboard-lower">
        <section aria-labelledby="recent-notifications-title" className="student-dashboard-panel">
          <SectionHeading id="recent-notifications-title" linkLabel="View all notifications" title="Recent Notifications" to="/student/notifications" />
          <div className="student-notification-list">
            {studentDashboardNotifications.map((notification) => (
              <Link
                className={`student-notification${notification.unread && !readNotificationIds.includes(notification.id) ? ' is-unread' : ''}`}
                key={notification.id}
                onClick={() => markNotificationRead(notification.id)}
                to="/student/notifications"
              >
                <span className="student-notification-icon"><Icon name={notification.icon} /></span>
                <span className="student-notification-copy">
                  <span className="student-notification-meta">
                    <strong>{notification.type}</strong>
                    {notification.unread && !readNotificationIds.includes(notification.id) && <span className="student-unread-label">New</span>}
                  </span>
                  <span>{notification.message}</span>
                  <small>{notification.time}</small>
                </span>
                {notification.unread && !readNotificationIds.includes(notification.id) && <span aria-label="Unread" className="student-unread-dot" />}
              </Link>
            ))}
          </div>
        </section>

        <section aria-labelledby="quick-actions-title" className="student-dashboard-panel student-quick-actions">
          <div className="student-dashboard-section-heading">
            <h2 id="quick-actions-title">Quick Actions</h2>
          </div>
          <Link to="/student/organizations"><span className="quick-action-icon"><Icon name="organization" /></span><span>Explore Organizations</span><Icon className="quick-action-arrow" name="arrow" /></Link>
          <Link to="/student/events"><span className="quick-action-icon"><Icon name="calendar" /></span><span>Browse Events</span><Icon className="quick-action-arrow" name="arrow" /></Link>
          <Link to="/student/registrations"><span className="quick-action-icon"><Icon name="ticket" /></span><span>My Registrations</span><Icon className="quick-action-arrow" name="arrow" /></Link>
        </section>
      </div>
    </div>
  )
}

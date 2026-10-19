/**
 * Student Portal Dashboard Page (`/student/dashboard`)
 *
 * Displays personalized greetings, organization membership counts, upcoming
 * campus events, and recent membership/event updates for the signed-in student.
 */
import { useEffect, useState } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import { formatGreetingName, getTimeGreeting } from '../data/displayName.js'
import Badge from '../components/ui/Badge.jsx'
import Icon from '../components/ui/Icon.jsx'
import {
  studentDashboardEvents,
  studentDashboardMetrics,
  studentDashboardOrganizations,
} from '../data/studentDashboard.js'

function SectionHeading({ id, title, to, linkLabel }) {
  return (
    <div className="student-dashboard-section-heading">
      <h2 id={id}>{title}</h2>
      <Link to={to}>{linkLabel}<Icon name="arrow" /></Link>
    </div>
  )
}

export default function StudentDashboardPage() {
  const { currentUser } = useOutletContext()
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
      <div className="page-hero page-hero-student">
        <section aria-labelledby="student-welcome-title" className="student-welcome dashboard-enter">
          <div>
            <span className="student-dashboard-eyebrow">UNIDOS Student Portal</span>
            <h1 id="student-welcome-title">{getTimeGreeting()}, {formatGreetingName(currentUser)}!</h1>
            <p>Stay connected with your organizations, events, and campus activities.</p>
          </div>
          <div aria-hidden="true" className="student-welcome-mark">W</div>
        </section>

        <section aria-label="Your activity overview" className="student-metrics">
          {studentDashboardMetrics.map((metric, index) => (
            <article className={`student-metric metric-${metric.tone}`} key={metric.label} style={{ '--metric-index': index }}>
              <span className="stat-label">{metric.label}</span>
              <strong aria-label={`${metric.value} ${metric.label}`} className="stat-value">{metricCounts[index]}</strong>
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
    </div>
  )
}

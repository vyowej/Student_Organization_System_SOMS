import { Link } from 'react-router-dom'
import Badge from '../ui/Badge.jsx'

export function LeaderCard({ leader }) {
  return (
    <article className="leader-card">
      <div aria-hidden="true" className={`portrait-placeholder portrait-${leader.color}`}>
        <span>{leader.initials}</span>
        <i />
      </div>
      <div className="leader-copy">
        <h3>{leader.name}</h3>
        <p>{leader.position}</p>
        <span>{leader.organization}</span>
      </div>
    </article>
  )
}

export function OrganizationCard({ organization }) {
  return (
    <article className="organization-card">
      <div aria-label={`${organization.acronym} logo`} className={`organization-emblem emblem-${organization.color}`} role="img">
        {organization.initials}
      </div>
      <div className="organization-card-copy">
        <div className="organization-meta">
          <Badge tone="crimson">{organization.category}</Badge>
          <span className="organization-acronym">{organization.acronym}</span>
        </div>
        <h3>{organization.name}</h3>
        <p>{organization.description}</p>
      </div>
      <Link className="button button-secondary organization-view" to={`/student/organizations/${organization.id}`}>
        View Organization <span aria-hidden="true">→</span>
      </Link>
    </article>
  )
}

export function EventCard({ event }) {
  const badgeTone = event.status === 'Registration Open'
    ? 'success'
    : event.status === 'Almost Full'
      ? 'warning'
      : 'neutral'
  const [month, day] = event.date.replace(',', '').split(' ').slice(0, 2)

  return (
    <article className="event-card">
      <div aria-hidden="true" className={`event-date-art event-${event.color}`}>
        <span>{month.slice(0, 3)}</span>
        <strong>{day}</strong>
        <i aria-hidden="true" />
      </div>
      <div className="event-card-content">
        <div className="event-card-topline">
          <Badge tone={badgeTone}>{event.status}</Badge>
        </div>
        <h3>{event.title}</h3>
        <p className="event-organization">{event.organization}</p>
        <Badge className="event-category">{event.category}</Badge>
        <div className="event-details">
          <span><b aria-hidden="true">◷</b>{event.time}</span>
          <span><b aria-hidden="true">⌖</b>{event.location}</span>
        </div>
        <Link className="event-view-link" to={`/student/events/${event.id}`}>
          View Event <span aria-hidden="true">→</span>
        </Link>
      </div>
    </article>
  )
}

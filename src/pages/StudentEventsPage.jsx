import { useMemo, useState } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import Badge from '../components/ui/Badge.jsx'
import EmptyState from '../components/ui/EmptyState.jsx'
import PageHeader from '../components/layout/PageHeader.jsx'
import { eventCategories, getEventRegistrationState, isEventAlmostFull, studentEvents } from '../data/studentEvents.js'
import { officerEventToStudentEvent } from '../data/officerStudentEvent.js'

const eventStatusFilters = ['All', 'Upcoming', 'Registration Open', 'Almost Full']

function EventStatusBadge({ event, registration }) {
  const state = getEventRegistrationState(event, registration)
  const label = state === 'REGISTERED' ? 'REGISTERED'
    : state === 'EVENT FULL' ? 'EVENT FULL'
      : state === 'REGISTRATION CLOSED' ? 'REGISTRATION CLOSED'
        : isEventAlmostFull(event) ? 'ALMOST FULL'
          : 'REGISTRATION OPEN'
  const tone = state === 'REGISTERED' ? 'success'
    : state === 'EVENT FULL' || state === 'REGISTRATION CLOSED' ? 'neutral'
      : isEventAlmostFull(event) ? 'warning'
        : 'success'

  return <Badge className="event-state-badge" tone={tone}>{label}</Badge>
}

function EventDate({ date }) {
  const [month, day, year] = date.replace(',', '').split(' ')
  return (
    <div aria-label={date} className="campus-event-date">
      <span>{month.slice(0, 3)}</span>
      <strong>{day}</strong>
      <small>{year}</small>
    </div>
  )
}

export default function StudentEventsPage() {
  const { officerEvents, studentRegistrations, eventRegisteredCounts } = useOutletContext()
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('All')
  const [statusFilter, setStatusFilter] = useState('All')

  const visibleEvents = useMemo(() => {
    const query = search.trim().toLowerCase()
    const publishedOfficerEvents = officerEvents
      .filter((event) => event.status === 'PUBLISHED')
      .map(officerEventToStudentEvent)
    return [...studentEvents, ...publishedOfficerEvents]
      .filter((event) => event.status === 'PUBLISHED')
      .map((event) => ({
        ...event,
        registeredCount: eventRegisteredCounts[event.id] ?? event.registeredCount,
      }))
      .filter((event) => {
        const registration = studentRegistrations.find((item) => (
          item.eventId === event.id && item.status === 'REGISTERED'
        ))
        const matchesCategory = category === 'All' || event.category === category
        const searchableText = `${event.title} ${event.organizationName} ${event.category} ${event.location} ${event.description}`.toLowerCase()
        const matchesSearch = !query || searchableText.includes(query)
        const registrationState = getEventRegistrationState(event, registration)
        const matchesStatus = statusFilter === 'All'
          || (statusFilter === 'Upcoming' && event.status === 'PUBLISHED')
          || (statusFilter === 'Registration Open' && registrationState === 'NOT REGISTERED' && !isEventAlmostFull(event))
          || (statusFilter === 'Almost Full' && isEventAlmostFull(event) && registrationState !== 'EVENT FULL')
        return matchesCategory && matchesSearch && matchesStatus
      })
  }, [category, eventRegisteredCounts, officerEvents, search, statusFilter, studentRegistrations])

  return (
    <div className="student-events-page">
      <PageHeader
        description="Discover upcoming activities, programs, and events organized by WMSU student organizations."
        eyebrow="UNIDOS STUDENT PORTAL"
        title="Campus Events"
      />

      <div className="event-directory-controls">
        <label className="organization-search event-search">
          <span aria-hidden="true">⌕</span>
          <input
            aria-label="Search events"
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search events..."
            type="search"
            value={search}
          />
        </label>
        <div aria-label="Filter events by category" className="organization-category-filters" role="group">
          {eventCategories.map((item) => (
            <button
              aria-pressed={category === item}
              className={`organization-category-filter${category === item ? ' is-active' : ''}`}
              key={item}
              onClick={() => setCategory(item)}
              type="button"
            >
              {item}
            </button>
          ))}
        </div>
        <div aria-label="Filter events by registration status" className="event-status-filters" role="group">
          {eventStatusFilters.map((item) => (
            <button
              aria-pressed={statusFilter === item}
              className={`event-status-filter${statusFilter === item ? ' is-active' : ''}`}
              key={item}
              onClick={() => setStatusFilter(item)}
              type="button"
            >
              {item}
            </button>
          ))}
        </div>
      </div>

      <p aria-live="polite" className="organization-results-label">
        {visibleEvents.length} {visibleEvents.length === 1 ? 'event' : 'events'}
      </p>

      {visibleEvents.length ? (
        <div className="campus-event-grid">
          {visibleEvents.map((event, index) => {
            const registration = studentRegistrations.find((item) => (
              item.eventId === event.id && item.status === 'REGISTERED'
            ))
            return (
              <article className="campus-event-card" key={event.id} style={{ '--event-index': index }}>
                <Link aria-label={`View event: ${event.title}`} className={`campus-event-card-link event-${event.color}`} to={`/student/events/${event.id}`}>
                  <div className="campus-event-card-top">
                    <EventDate date={event.date} />
                    <Badge tone="crimson">{event.category}</Badge>
                  </div>
                  <div className="campus-event-card-content">
                    <EventStatusBadge event={event} registration={registration} />
                    <h2>{event.title}</h2>
                    <p className="campus-event-organization">{event.organizationName}</p>
                    <div className="campus-event-facts">
                      <span><b aria-hidden="true">◷</b>{event.time}</span>
                      <span><b aria-hidden="true">⌖</b>{event.location}</span>
                    </div>
                    <div className="campus-event-availability">
                      <span>Availability</span>
                      <strong>
                        {event.capacity - event.registeredCount > 0
                          ? `${event.capacity - event.registeredCount} slots available`
                          : 'No slots available'}
                      </strong>
                    </div>
                    <span className="button button-secondary campus-event-view-button">
                      View Event <span aria-hidden="true">→</span>
                    </span>
                  </div>
                </Link>
              </article>
            )
          })}
        </div>
      ) : (
        <EmptyState
          description="Try changing your search or filters to find more campus events."
          title="No events found"
        />
      )}
    </div>
  )
}

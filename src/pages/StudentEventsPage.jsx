import { useMemo, useState } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import Badge from '../components/ui/Badge.jsx'
import EmptyState from '../components/ui/EmptyState.jsx'
import FilterSelect from '../components/ui/FilterSelect.jsx'
import Icon from '../components/ui/Icon.jsx'
import PageHeader from '../components/layout/PageHeader.jsx'
import { eventCategories, getEventRegistrationState, isEventAlmostFull, officerEventToStudentEvent, studentEvents } from '../data/studentEvents.js'

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
  const [month, day, year] = String(date || 'TBA • •').replace(',', '').split(' ')
  return (
    <div aria-label={date} className="campus-event-date">
      <span>{(month || 'TBA').slice(0, 3)}</span>
      <strong>{day || '•'}</strong>
      <small>{year || ''}</small>
    </div>
  )
}

export default function StudentEventsPage() {
  const { officerEvents = [], studentRegistrations = [], eventRegisteredCounts = {} } = useOutletContext()
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('All')
  const [statusFilter, setStatusFilter] = useState('All')

  const visibleEvents = useMemo(() => {
    const query = search.trim().toLowerCase()
    const publishedOfficerEvents = officerEvents
      .filter((event) => event.status === 'PUBLISHED')
      .map(officerEventToStudentEvent)
    return [...studentEvents, ...publishedOfficerEvents]
      .filter((event) => event && event.status === 'PUBLISHED')
      .map((event) => ({
        ...event,
        registeredCount: eventRegisteredCounts[event.id] ?? event.registeredCount ?? 0,
      }))
      .filter((event) => {
        const registration = studentRegistrations.find((item) => (
          String(item.eventId) === String(event.id) && item.status !== 'CANCELLED'
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

      <div className="directory-toolbar">
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
        <FilterSelect label="Category" onChange={setCategory} options={eventCategories} value={category} />
        <FilterSelect label="Status" onChange={setStatusFilter} options={eventStatusFilters} value={statusFilter} />
        {(category !== 'All' || statusFilter !== 'All' || search) && (
          <button className="directory-toolbar-reset" onClick={() => { setCategory('All'); setStatusFilter('All'); setSearch('') }} type="button">Clear</button>
        )}
      </div>

      <p aria-live="polite" className="organization-results-label">
        {visibleEvents.length} {visibleEvents.length === 1 ? 'event' : 'events'}
      </p>

      {visibleEvents.length ? (
        <div className="campus-event-grid">
          {visibleEvents.map((event, index) => {
            const registration = studentRegistrations.find((item) => (
              String(item.eventId) === String(event.id) && item.status !== 'CANCELLED'
            ))
            return (
              <article className="campus-event-card" key={event.id} style={{ '--event-index': index }}>
                <Link aria-label={`View event: ${event.title}`} className={`campus-event-card-link event-${event.color || 'crimson'}`} to={`/student/events/${event.id}`}>
                  <div className="campus-event-card-top">
                    <EventDate date={event.date} />
                    <Badge tone="crimson">{event.category}</Badge>
                  </div>
                  <div className="campus-event-card-content">
                    <EventStatusBadge event={event} registration={registration} />
                    <h2>{event.title}</h2>
                    <p className="campus-event-organization">{event.organizationName}</p>
                    <div className="campus-event-facts">
                      <span><Icon name="clock" size={13} style={{ display: 'inline-block', verticalAlign: '-1px', marginRight: '4px' }} />{event.time}</span>
                      <span><Icon name="location" size={13} style={{ display: 'inline-block', verticalAlign: '-1px', marginRight: '4px' }} />{event.location}</span>
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
                      View Event <Icon name="arrow-right" size={13} />
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

import { useMemo, useState } from 'react'
import { Link, useParams, useOutletContext } from 'react-router-dom'
import Badge from '../components/ui/Badge.jsx'
import Card from '../components/ui/Card.jsx'
import EmptyState from '../components/ui/EmptyState.jsx'
import Modal from '../components/ui/Modal.jsx'
import PageHeader from '../components/layout/PageHeader.jsx'
import SearchBar, { matchesQuery } from '../components/ui/SearchBar.jsx'
import { adviserAssignedOrganizations } from '../data/adviserPortal.js'
import { formatDisplayName } from '../data/displayName.js'

function adviserInitials(name = '') {
  const words = name.replace(/^(dr|prof|engr|mr|ms|mrs|atty)\.?\s+/i, '').split(/\s+/).filter(Boolean)
  return words.slice(0, 2).map((word) => word[0]).join('').toUpperCase() || 'FA'
}

const weekDays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const calendarStatusClass = {
  DRAFT: 'is-neutral',
  SUBMITTED: 'is-warning',
  UNDER_REVIEW: 'is-warning',
  APPROVED: 'is-success',
  PUBLISHED: 'is-success',
  RETURNED_FOR_REVISION: 'is-danger',
  REJECTED: 'is-danger',
  ONGOING: 'is-crimson',
  COMPLETED: 'is-neutral',
  ARCHIVED: 'is-neutral',
}

function eventDateKey(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function CalendarOfEvents({ events, organizationName }) {
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), 1)
  })
  const [today] = useState(() => eventDateKey(new Date()))
  const [selectedDate, setSelectedDate] = useState(today)
  const [selectedEvent, setSelectedEvent] = useState(null)
  const eventsByDate = useMemo(() => events.reduce((groups, event) => {
    const key = eventDateKey(event.date)
    if (key) groups[key] = [...(groups[key] ?? []), event]
    return groups
  }, {}), [events])
  const calendarDays = useMemo(() => {
    const first = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1)
    const daysInMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 0).getDate()
    return Array.from({ length: 42 }, (_, index) => {
      const day = index - first.getDay() + 1
      return day > 0 && day <= daysInMonth ? new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), day) : null
    })
  }, [calendarMonth])
  const selectedEvents = eventsByDate[selectedDate] ?? []
  const selectedDateLabel = new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(`${selectedDate}T00:00:00`))

  function changeMonth(offset) {
    setCalendarMonth((current) => new Date(current.getFullYear(), current.getMonth() + offset, 1))
  }

  return (
    <div className="adviser-calendar" aria-label={`${organizationName} Calendar of Events`}>
      <div className="adviser-calendar-toolbar">
        <div className="adviser-calendar-heading">
          <h3>{new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(calendarMonth)}</h3>
          <span>{events.length} event{events.length === 1 ? '' : 's'}</span>
        </div>
        <div className="adviser-calendar-controls">
          <button aria-label="Previous month" className="button button-secondary" onClick={() => changeMonth(-1)} type="button">‹</button>
          <button className="button button-secondary" onClick={() => {
            const now = new Date()
            setCalendarMonth(new Date(now.getFullYear(), now.getMonth(), 1))
            setSelectedDate(eventDateKey(now))
          }} type="button">Today</button>
          <button aria-label="Next month" className="button button-secondary" onClick={() => changeMonth(1)} type="button">›</button>
        </div>
      </div>
      <div className="adviser-calendar-grid">
        {weekDays.map((day) => <div className="adviser-calendar-weekday" key={day}>{day.slice(0, 3)}</div>)}
        {calendarDays.map((day, index) => {
          const key = day ? eventDateKey(day) : `empty-${index}`
          const dayEvents = eventsByDate[key] ?? []
          return (
            <div className={`adviser-calendar-day${day ? '' : ' is-outside'}${key === selectedDate ? ' is-selected' : ''}`} key={key}>
              {day && <>
                <button aria-label={`Select ${day.toDateString()}`} className={`adviser-calendar-date${key === today ? ' is-today' : ''}`} onClick={() => setSelectedDate(key)} type="button">{day.getDate()}</button>
                <div className="adviser-calendar-events">
                  {dayEvents.slice(0, 3).map((event) => <button className={`adviser-calendar-event ${calendarStatusClass[event.status] ?? 'is-neutral'}`} key={event.id} onClick={() => setSelectedEvent(event)} title={event.title} type="button">{event.title}</button>)}
                  {dayEvents.length > 3 && <button className="adviser-calendar-more" onClick={() => setSelectedDate(key)} type="button">+{dayEvents.length - 3} more</button>}
                </div>
              </>}
            </div>
          )
        })}
      </div>
      <section className="adviser-selected-date" aria-live="polite">
        <div className="adviser-selected-date-heading">
          <div><span className="adviser-muted-label">Selected date</span><h4>{selectedDateLabel}</h4></div>
          <span>{selectedEvents.length} event{selectedEvents.length === 1 ? '' : 's'}</span>
        </div>
        {selectedEvents.length ? <div className="adviser-selected-events">
          {selectedEvents.map((event) => <button className="adviser-selected-event" key={event.id} onClick={() => setSelectedEvent(event)} type="button">
            <span className={`adviser-event-status-dot ${calendarStatusClass[event.status] ?? 'is-neutral'}`} />
            <span><strong>{event.title}</strong><small>{event.time || event.startTime || 'Time to be confirmed'} · {event.location || event.venue || 'Venue to be confirmed'}</small></span>
            <Badge tone={calendarStatusClass[event.status] === 'is-success' ? 'success' : calendarStatusClass[event.status] === 'is-danger' ? 'danger' : 'warning'}>{event.status.replaceAll('_', ' ')}</Badge>
          </button>)}
        </div> : <p className="adviser-calendar-empty">No events are scheduled for this date.</p>}
      </section>
      <Modal onClose={() => setSelectedEvent(null)} open={Boolean(selectedEvent)} title="Event Details">
        {selectedEvent && <div className="adviser-calendar-event-dialog">
          <div className="adviser-review-summary">
            <div><span className="adviser-muted-label">{organizationName}</span><h3>{selectedEvent.title}</h3></div>
            <Badge tone={calendarStatusClass[selectedEvent.status] === 'is-success' ? 'success' : calendarStatusClass[selectedEvent.status] === 'is-danger' ? 'danger' : 'warning'}>{selectedEvent.status.replaceAll('_', ' ')}</Badge>
          </div>
          <dl className="adviser-review-facts">
            <div><dt>Organization</dt><dd>{organizationName}</dd></div>
            <div><dt>Date</dt><dd>{selectedEvent.date}</dd></div>
            <div><dt>Time</dt><dd>{selectedEvent.time || selectedEvent.startTime || 'Not provided'}</dd></div>
            <div><dt>Venue</dt><dd>{selectedEvent.location || selectedEvent.venue || 'Not provided'}</dd></div>
            <div><dt>Approval status</dt><dd>{selectedEvent.status.replaceAll('_', ' ')}</dd></div>
          </dl>
          <section><h4>Description</h4><p>{selectedEvent.description || 'No description was provided.'}</p></section>
        </div>}
      </Modal>
    </div>
  )
}

export function AdviserOrganizationsPage() {
  const { adminOrganizations, officerEvents, officerMemberCount } = useOutletContext()
  const [search, setSearch] = useState('')
  const assigned = adviserAssignedOrganizations
    .map((item) => ({ ...item, ...adminOrganizations.find((entry) => entry.id === item.id) }))
    .filter((item) => matchesQuery(search, item.name, item.acronym, item.category, item.adviser))

  return (
    <div className="adviser-page">
      <PageHeader
        description="View the organizations assigned to you and their current activities."
        eyebrow="UNIDOS · FACULTY ADVISER"
        title="My Organizations"
      />
      <SearchBar label="Search organizations" onChange={setSearch} placeholder="Search by name, acronym or category…" value={search} />
      {assigned.length === 0 && <EmptyState description="No assigned organizations match your search." title="No organizations found" />}
      <div className="adviser-organization-grid">
        {assigned.map((organization) => {
          const events = officerEvents.filter((event) => event.organizationId === organization.id)
          return (
            <Card className="adviser-organization-card" key={organization.id}>
              <div className="adviser-org-card-top">
                <span className="adviser-org-logo">{organization.acronym}</span>
                <Badge tone="success">{organization.status}</Badge>
              </div>
              <span className="adviser-muted-label">{organization.category}</span>
              <h2>{organization.name}</h2>
              <p className="adviser-org-acronym">{organization.acronym}</p>
              <div className="adviser-org-adviser">
                <span aria-hidden="true">{adviserInitials(organization.adviser)}</span>
                <div><small>Faculty adviser</small><strong>{organization.adviser}</strong></div>
              </div>
              <div className="adviser-org-facts">
                <span><strong>{officerMemberCount}</strong> Members</span>
                <span><strong>{events.filter((event) => ['APPROVED', 'PUBLISHED'].includes(event.status)).length}</strong> Upcoming events</span>
              </div>
              <Link className="button button-primary" to={`/adviser/organizations/${organization.id}`}>View Organization</Link>
            </Card>
          )
        })}
      </div>
    </div>
  )
}

export function AdviserOrganizationDetailsPage() {
  const { id } = useParams()
  const { adminOrganizations, adviserActivity, adviserDocuments, officerEvents, officerMemberCount, officerMembers } = useOutletContext()
  const assignedOrganization = adviserAssignedOrganizations.find((item) => item.id === id)
  const organization = assignedOrganization
    ? { ...assignedOrganization, ...adminOrganizations.find((item) => item.id === id) }
    : null

  if (!organization) {
    return (
      <div className="adviser-page">
        <PageHeader eyebrow="UNIDOS · FACULTY ADVISER" title="Organization not found" />
        <EmptyState description="This organization is not assigned to your adviser account." title="No access to organization" />
      </div>
    )
  }

  const members = officerMembers.filter((member) => member.organizationId === id && member.status === 'ACTIVE')
  const officers = members.filter((member) => member.position !== 'General Member')
  const generalMembers = members.filter((member) => member.position === 'General Member')
  const events = officerEvents.filter((event) => event.organizationId === id)
  const documents = adviserDocuments.filter((document) => document.organizationId === id)

  return (
    <div className="adviser-page">
      <PageHeader
        description={`${organization.acronym} · ${organization.category} · ${organization.status}`}
        eyebrow="MY ORGANIZATIONS"
        title={organization.name}
      />
      <Card className="adviser-profile-card">
        <span className="adviser-org-logo">{organization.acronym}</span>
        <div>
          <Badge tone="success">{organization.status}</Badge>
          <p>{organization.name} is assigned to you for faculty guidance and proposal review.</p>
        </div>
        <div className="adviser-profile-meta">
          <span className="adviser-profile-count"><strong>{officerMemberCount}</strong> active members</span>
          <div className="adviser-org-adviser">
            <span aria-hidden="true">{adviserInitials(organization.adviser)}</span>
            <div><small>Faculty adviser</small><strong>{organization.adviser}</strong></div>
          </div>
        </div>
      </Card>
      <section aria-label="Mission and vision" className="adviser-purpose-grid">
        <Card className="adviser-purpose-card"><h2>Mission</h2><p>{organization.mission}</p></Card>
        <Card className="adviser-purpose-card"><h2>Vision</h2><p>{organization.vision}</p></Card>
      </section>
      <div className="adviser-detail-grid">
        <Card className="adviser-panel adviser-detail-wide">
          <h2>Officers</h2>
          {officers.length ? <div className="adviser-people-list">{officers.map((member) => <div key={member.id}><strong>{formatDisplayName(member)}</strong><Badge tone="crimson">{member.position}</Badge></div>)}</div> : <p>No active officers are recorded.</p>}
        </Card>
        <Card className="adviser-panel adviser-detail-wide">
          <h2>General Members</h2>
          {generalMembers.length ? <div className="adviser-people-list">{generalMembers.map((member) => <div key={member.id}><strong>{formatDisplayName(member)}</strong><span>{member.studentId} · {member.program}</span></div>)}</div> : <p>No active general members are recorded.</p>}
          <small>{generalMembers.length} visible members of {officerMemberCount} active members</small>
        </Card>
        <Card className="adviser-panel">
          <h2>Official Documents</h2>
          <ul className="adviser-simple-list">
            {organization.documents.map((name) => <li key={name}>{name} <Badge tone="success">On file</Badge></li>)}
            {documents.map((document) => <li key={document.id}>{document.title} <Badge tone={document.status === 'APPROVED' ? 'success' : document.status === 'PENDING' ? 'warning' : 'neutral'}>{document.status}</Badge></li>)}
          </ul>
        </Card>
        <Card className="adviser-panel adviser-detail-wide">
          <h2>Calendar of Events</h2>
          {events.length ? <CalendarOfEvents events={events} organizationName={organization.name} /> : <p>No events have been submitted.</p>}
        </Card>
        <Card className="adviser-panel">
          <h2>Announcements</h2>
          <ul className="adviser-simple-list">{(organization.announcements ?? []).filter((announcement) => !announcement.status || announcement.status === 'PUBLISHED').map((announcement) => <li key={announcement.id ?? announcement.title}><span>{announcement.title}<small>{announcement.datePosted ?? announcement.date}</small></span></li>)}</ul>
        </Card>
        <Card className="adviser-panel">
          <h2>Activity Log</h2>
          <ul className="adviser-simple-list">{adviserActivity.slice(0, 4).map((activity) => <li key={activity.id}><span>{activity.message}<small>{activity.time}</small></span></li>)}</ul>
        </Card>
      </div>
      <Link className="button button-secondary adviser-back-link" to="/adviser/organizations">Back to My Organizations</Link>
    </div>
  )
}

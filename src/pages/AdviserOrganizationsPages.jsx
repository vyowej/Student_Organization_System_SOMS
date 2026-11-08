import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams, useOutletContext } from 'react-router-dom'
import Badge from '../components/ui/Badge.jsx'
import Button from '../components/ui/Button.jsx'
import Card from '../components/ui/Card.jsx'
import EmptyState from '../components/ui/EmptyState.jsx'
import Icon from '../components/ui/Icon.jsx'
import Modal from '../components/ui/Modal.jsx'
import PageHeader from '../components/layout/PageHeader.jsx'
import SearchBar, { matchesQuery } from '../components/ui/SearchBar.jsx'
import { formatDisplayName, isValidEmail } from '../data/displayName.js'
import {
  OFFICER_HIERARCHY,
  ORGANIZATION_COMMITTEES,
  getDemotionOptions,
  getHierarchyEntry,
} from '../data/officerHierarchy.js'
import { useToast } from '../components/ui/useToast.js'

function adviserInitials(name = '') {
  const words = name.replace(/^(dr|prof|engr|mr|ms|mrs|atty|asso)\.?\s+/gi, '').split(/\s+/).filter(Boolean)
  return words.slice(0, 2).map((word) => word[0]).join('').toUpperCase() || 'FA'
}

const weekDays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const calendarStatusClass = {
  DRAFT: 'is-neutral',
  PENDING: 'is-warning',
  SUBMITTED: 'is-warning',
  UNDER_REVIEW: 'is-warning',
  APPROVED: 'is-success',
  PUBLISHED: 'is-success',
  RETURNED: 'is-danger',
  RETURNED_FOR_REVISION: 'is-danger',
  CANCELLED: 'is-danger',
  REJECTED: 'is-danger',
  ONGOING: 'is-crimson',
  COMPLETED: 'is-neutral',
  ARCHIVED: 'is-neutral',
}

function eventDateKey(value) {
  if (!value) return ''
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed
    const localIsoMatch = trimmed.match(/^(\d{4}-\d{2}-\d{2})T/)
    if (localIsoMatch && !trimmed.endsWith('Z') && !/[+-]\d{2}:?\d{2}$/.test(trimmed)) {
      return localIsoMatch[1]
    }
  }
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function getEventPrimaryDateKey(event) {
  if (!event) return ''
  return (
    eventDateKey(event.startDatetime) ||
    eventDateKey(event.start_date) ||
    eventDateKey(event.date) ||
    eventDateKey(event.submittedDate) ||
    eventDateKey(event.createdAt) ||
    ''
  )
}

function getEventDateKeys(event) {
  const startKey = getEventPrimaryDateKey(event)
  if (!startKey) return []
  const endRaw = event.endDatetime || event.end_date
  const endKey = endRaw ? eventDateKey(endRaw) : ''
  if (!endKey || endKey <= startKey) return [startKey]

  const startDt = new Date(`${startKey}T00:00:00`)
  const endDt = new Date(`${endKey}T00:00:00`)
  const diffDays = Math.round((endDt.getTime() - startDt.getTime()) / (1000 * 60 * 60 * 24))
  if (Number.isNaN(diffDays) || diffDays <= 0 || diffDays > 14) return [startKey]

  const keys = []
  for (let i = 0; i <= diffDays; i += 1) {
    const d = new Date(startDt.getFullYear(), startDt.getMonth(), startDt.getDate() + i)
    keys.push(eventDateKey(d))
  }
  return keys
}

export function CalendarOfEvents({ events = [], organizationName = 'Organization' }) {
  const [today] = useState(() => eventDateKey(new Date()))
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), 1)
  })
  const [selectedDate, setSelectedDate] = useState(today)
  const [selectedEvent, setSelectedEvent] = useState(null)
  const initializedEventsSigRef = useRef('')

  const eventsByDate = useMemo(() => {
    return events.reduce((groups, event) => {
      const keys = getEventDateKeys(event)
      keys.forEach((key) => {
        if (key) {
          const existing = groups[key] ?? []
          if (!existing.some((item) => String(item.id) === String(event.id))) {
            groups[key] = [...existing, event]
          }
        }
      })
      return groups
    }, {})
  }, [events])

  const sortedEventDates = useMemo(() => Object.keys(eventsByDate).sort(), [eventsByDate])

  useEffect(() => {
    if (!sortedEventDates.length) return
    const sig = sortedEventDates.join(',') + ':' + events.length
    if (initializedEventsSigRef.current === sig) return
    initializedEventsSigRef.current = sig

    const currentMonthPrefix = `${calendarMonth.getFullYear()}-${String(calendarMonth.getMonth() + 1).padStart(2, '0')}-`
    const monthEventDates = sortedEventDates.filter((d) => d.startsWith(currentMonthPrefix))

    if (monthEventDates.length > 0) {
      if (!eventsByDate[selectedDate]?.length) {
        const upcomingInMonth = monthEventDates.find((d) => d >= today) || monthEventDates[0]
        setSelectedDate(upcomingInMonth)
      }
    } else {
      const targetKey = sortedEventDates.find((d) => d >= today) || sortedEventDates[sortedEventDates.length - 1]
      if (targetKey) {
        const [yearStr, monthStr] = targetKey.split('-')
        setCalendarMonth(new Date(Number(yearStr), Number(monthStr) - 1, 1))
        setSelectedDate(targetKey)
      }
    }
  }, [sortedEventDates, events.length, calendarMonth, eventsByDate, selectedDate, today])

  const calendarDays = useMemo(() => {
    const first = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1)
    const daysInMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 0).getDate()
    return Array.from({ length: 42 }, (_, index) => {
      const day = index - first.getDay() + 1
      return day > 0 && day <= daysInMonth ? new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), day) : null
    })
  }, [calendarMonth])

  const currentMonthPrefix = `${calendarMonth.getFullYear()}-${String(calendarMonth.getMonth() + 1).padStart(2, '0')}-`
  const monthEventsCount = useMemo(() => {
    const seen = new Set()
    Object.entries(eventsByDate).forEach(([key, list]) => {
      if (key.startsWith(currentMonthPrefix)) {
        list.forEach((ev) => seen.add(String(ev.id)))
      }
    })
    return seen.size
  }, [eventsByDate, currentMonthPrefix])

  const selectedEvents = eventsByDate[selectedDate] ?? []
  const selectedDateLabel = useMemo(() => {
    const d = new Date(`${selectedDate}T00:00:00`)
    if (Number.isNaN(d.getTime())) return selectedDate
    return new Intl.DateTimeFormat('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    }).format(d)
  }, [selectedDate])

  function changeMonth(offset) {
    setCalendarMonth((current) => new Date(current.getFullYear(), current.getMonth() + offset, 1))
  }

  function jumpToEvent(event) {
    const key = getEventPrimaryDateKey(event)
    if (!key) return
    const [yearStr, monthStr] = key.split('-')
    setCalendarMonth(new Date(Number(yearStr), Number(monthStr) - 1, 1))
    setSelectedDate(key)
  }

  const monthLabel = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(calendarMonth)
  const shortMonthLabel = new Intl.DateTimeFormat('en-US', { month: 'short' }).format(calendarMonth)

  return (
    <div aria-label={`${organizationName} Calendar of Events`} className="adviser-calendar">
      <div className="adviser-calendar-toolbar">
        <div className="adviser-calendar-heading">
          <h3>{monthLabel}</h3>
          <span>
            {monthEventsCount === events.length
              ? `${events.length} event${events.length === 1 ? '' : 's'}`
              : `${monthEventsCount} in ${shortMonthLabel} · ${events.length} total`}
          </span>
        </div>
        <div className="adviser-calendar-controls">
          <button aria-label="Previous month" className="button button-secondary" onClick={() => changeMonth(-1)} type="button">‹</button>
          <button
            className="button button-secondary"
            onClick={() => {
              const now = new Date()
              setCalendarMonth(new Date(now.getFullYear(), now.getMonth(), 1))
              setSelectedDate(eventDateKey(now))
            }}
            type="button"
          >
            Today
          </button>
          <button aria-label="Next month" className="button button-secondary" onClick={() => changeMonth(1)} type="button">›</button>
        </div>
      </div>

      {events.length > 0 && (
        <div aria-label="Jump to scheduled events" className="adviser-calendar-quickjump">
          <span className="adviser-muted-label">Events:</span>
          {events.map((event) => {
            const key = getEventPrimaryDateKey(event)
            const isSelected = key === selectedDate
            return (
              <button
                className={`adviser-calendar-jump-chip ${calendarStatusClass[event.status] ?? 'is-neutral'}${isSelected ? ' is-active' : ''}`}
                key={event.id}
                onClick={() => jumpToEvent(event)}
                title={`Jump to ${event.title} (${event.date || key})`}
                type="button"
              >
                <span className={`adviser-event-status-dot ${calendarStatusClass[event.status] ?? 'is-neutral'}`} />
                <strong>{event.title}</strong>
                <small>{event.date || key}</small>
              </button>
            )
          })}
        </div>
      )}

      <div className="adviser-calendar-grid">
        {weekDays.map((day) => <div className="adviser-calendar-weekday" key={day}>{day.slice(0, 3)}</div>)}
        {calendarDays.map((day, index) => {
          const key = day ? eventDateKey(day) : `empty-${index}`
          const dayEvents = eventsByDate[key] ?? []
          return (
            <div
              className={`adviser-calendar-day${day ? '' : ' is-outside'}${key === selectedDate ? ' is-selected' : ''}${dayEvents.length ? ' has-events' : ''}`}
              key={key}
              onClick={() => {
                if (day) setSelectedDate(key)
              }}
            >
              {day && (
                <>
                  <div className="adviser-calendar-day-top">
                    <button
                      aria-label={`Select ${day.toDateString()}`}
                      className={`adviser-calendar-date${key === today ? ' is-today' : ''}${dayEvents.length && key !== today ? ' has-event-dot' : ''}`}
                      onClick={(e) => {
                        e.stopPropagation()
                        setSelectedDate(key)
                      }}
                      type="button"
                    >
                      {day.getDate()}
                    </button>
                    {dayEvents.length > 0 && (
                      <span className="adviser-calendar-day-badge">
                        {dayEvents.length} {dayEvents.length === 1 ? 'event' : 'events'}
                      </span>
                    )}
                  </div>
                  <div className="adviser-calendar-events">
                    {dayEvents.slice(0, 3).map((event) => (
                      <button
                        className={`adviser-calendar-event ${calendarStatusClass[event.status] ?? 'is-neutral'}`}
                        key={event.id}
                        onClick={(e) => {
                          e.stopPropagation()
                          setSelectedDate(key)
                          setSelectedEvent(event)
                        }}
                        title={`${event.title} — ${event.time || event.startTime || 'Time TBA'} (${(event.status || 'SUBMITTED').replaceAll('_', ' ')})`}
                        type="button"
                      >
                        <span className="adviser-calendar-event-title">{event.title}</span>
                        {(event.startTime || event.time) && (
                          <small className="adviser-calendar-event-time">{event.startTime || event.time}</small>
                        )}
                      </button>
                    ))}
                    {dayEvents.length > 3 && (
                      <button
                        className="adviser-calendar-more"
                        onClick={(e) => {
                          e.stopPropagation()
                          setSelectedDate(key)
                        }}
                        type="button"
                      >
                        +{dayEvents.length - 3} more
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          )
        })}
      </div>

      <section aria-live="polite" className="adviser-selected-date">
        <div className="adviser-selected-date-heading">
          <div>
            <span className="adviser-muted-label">Selected date</span>
            <h4>{selectedDateLabel}</h4>
          </div>
          <span>{selectedEvents.length} event{selectedEvents.length === 1 ? '' : 's'}</span>
        </div>
        {selectedEvents.length ? (
          <div className="adviser-selected-events">
            {selectedEvents.map((event) => (
              <button
                className="adviser-selected-event"
                key={event.id}
                onClick={() => setSelectedEvent(event)}
                type="button"
              >
                <span className={`adviser-event-status-dot ${calendarStatusClass[event.status] ?? 'is-neutral'}`} />
                <span>
                  <strong>{event.title}</strong>
                  <small>
                    {event.organizationName && event.organizationName !== organizationName ? `${event.organizationName} · ` : ''}
                    {event.time || event.startTime || 'Time to be confirmed'} · {event.location || event.venue || 'Venue to be confirmed'}
                  </small>
                </span>
                <Badge
                  tone={
                    calendarStatusClass[event.status] === 'is-success'
                      ? 'success'
                      : calendarStatusClass[event.status] === 'is-danger'
                        ? 'danger'
                        : 'warning'
                  }
                >
                  {(event.status || 'SUBMITTED').replaceAll('_', ' ')}
                </Badge>
              </button>
            ))}
          </div>
        ) : (
          <p className="adviser-calendar-empty">No events are scheduled for this date.</p>
        )}
      </section>

      <Modal
        onClose={() => setSelectedEvent(null)}
        open={Boolean(selectedEvent)}
        size="md"
        status={selectedEvent?.status}
        title="Event Details"
      >
        {selectedEvent && (
          <div className="adviser-calendar-event-dialog">
            <div className="adviser-review-summary">
              <div>
                <span className="adviser-muted-label">{selectedEvent.organizationName || organizationName}</span>
                <h3>{selectedEvent.title}</h3>
              </div>
              <Badge
                tone={
                  calendarStatusClass[selectedEvent.status] === 'is-success'
                    ? 'success'
                    : calendarStatusClass[selectedEvent.status] === 'is-danger'
                      ? 'danger'
                      : 'warning'
                }
              >
                {(selectedEvent.status || 'SUBMITTED').replaceAll('_', ' ')}
              </Badge>
            </div>
            <dl className="adviser-review-facts">
              <div><dt>Organization</dt><dd>{selectedEvent.organizationName || organizationName}</dd></div>
              <div><dt>Date</dt><dd>{selectedEvent.date}</dd></div>
              <div><dt>Time</dt><dd>{selectedEvent.time || selectedEvent.startTime || 'Not provided'}</dd></div>
              <div><dt>Venue</dt><dd>{selectedEvent.location || selectedEvent.venue || 'Not provided'}</dd></div>
              <div><dt>Participant Limit</dt><dd>{selectedEvent.registrations ?? 0} / {selectedEvent.capacity ?? 100}</dd></div>
              <div><dt>Compliance File</dt><dd>{selectedEvent.complianceFileName || selectedEvent.supportingDocuments?.[0] || 'None attached'}</dd></div>
              <div><dt>Approval Status</dt><dd>{(selectedEvent.status || 'SUBMITTED').replaceAll('_', ' ')}</dd></div>
            </dl>
            <section>
              <h4>Description</h4>
              <p>{selectedEvent.description || 'No description was provided.'}</p>
            </section>
          </div>
        )}
      </Modal>
    </div>
  )
}

export function AdviserOrganizationsPage() {
  const {
    academicDepartments = [],
    adminOrganizations = [],
    createAdviserAccount,
    currentUser,
    officerEvents = [],
    pregenerateMissingAdvisers,
  } = useOutletContext()
  const { showToast } = useToast()
  const [search, setSearch] = useState('')
  const [showAllCampus, setShowAllCampus] = useState(Boolean(currentUser?.isGlobalAdmin))
  const [prepareOpen, setPrepareOpen] = useState(false)
  const [preparingBatch, setPreparingBatch] = useState(false)
  const [prepareSaving, setPrepareSaving] = useState(false)
  const [prepareError, setPrepareError] = useState('')
  const [prepareForm, setPrepareForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    employeeNumber: '',
    password: 'adviser123',
    departmentId: '',
    organizationId: '',
  })

  const canManageAdvisers = Boolean(
    currentUser?.isCoordinator ||
    currentUser?.isGlobalAdmin ||
    currentUser?.role === 'ADMIN'
  )

  const assignedOrgs = adminOrganizations.filter((org) => {
    if (currentUser?.adviserRecordId && String(org.adviserId) === String(currentUser.adviserRecordId)) return true
    if (currentUser?.id && String(org.adviserUserId) === String(currentUser.id)) return true
    if (currentUser?.email && org.adviserEmail && String(org.adviserEmail).toLowerCase() === String(currentUser.email).toLowerCase()) return true
    if (currentUser?.advisedOrganizations?.some((a) => String(a.organization_id) === String(org.id) || String(a.organizationId) === String(org.id))) return true
    return false
  })

  const baseOrgs = canManageAdvisers && showAllCampus ? adminOrganizations : assignedOrgs
  const assigned = baseOrgs.filter((item) =>
    matchesQuery(search, item.name, item.acronym, item.category, item.adviser)
  )

  async function handlePrepareAdviser(event) {
    event.preventDefault()
    setPrepareError('')
    if (!prepareForm.firstName.trim() || !prepareForm.lastName.trim() || !prepareForm.email.trim()) {
      setPrepareError('Enter the faculty adviser’s First Name, Last Name, and WMSU Email.')
      return
    }
    if (!isValidEmail(prepareForm.email.trim())) {
      setPrepareError('Enter a valid email address.')
      return
    }
    setPrepareSaving(true)
    const res = await createAdviserAccount(prepareForm)
    setPrepareSaving(false)
    if (!res?.ok) {
      setPrepareError(res?.error || 'Unable to prepare adviser account.')
      return
    }
    showToast(
      `Prepared adviser account for ${prepareForm.firstName} ${prepareForm.lastName} (${prepareForm.email}).`,
      'success'
    )
    setPrepareOpen(false)
    setPrepareForm({
      firstName: '',
      lastName: '',
      email: '',
      employeeNumber: '',
      password: 'adviser123',
      departmentId: '',
      organizationId: '',
    })
  }

  async function handleBatchPregenerate() {
    setPreparingBatch(true)
    const res = await pregenerateMissingAdvisers()
    setPreparingBatch(false)
    if (!res?.ok) {
      showToast(res?.error || 'Unable to pre-generate adviser accounts.', 'error')
      return
    }
    showToast(
      res.createdCount > 0
        ? `Prepared ${res.createdCount} missing organization adviser account(s).`
        : 'All organizations already have prepared adviser accounts assigned.',
      'success'
    )
  }

  return (
    <div className="adviser-page">
      <PageHeader
        actions={
          canManageAdvisers ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              <Button
                onClick={() => setShowAllCampus((prev) => !prev)}
                variant="secondary"
              >
                {showAllCampus ? `My Assigned (${assignedOrgs.length})` : `All Campus Orgs (${adminOrganizations.length})`}
              </Button>
              <Button
                disabled={preparingBatch}
                onClick={handleBatchPregenerate}
                variant="outline"
              >
                {preparingBatch ? 'Checking…' : 'Ensure All Adviser Accounts'}
              </Button>
              <Button onClick={() => { setPrepareError(''); setPrepareOpen(true) }} variant="primary">
                <Icon name="plus" size={16} /> Prepare Adviser Account
              </Button>
            </div>
          ) : null
        }
        description={
          canManageAdvisers
            ? 'Coordinator & Admin Access: View organizations and prepare faculty adviser accounts beforehand.'
            : 'View the organizations assigned to you and their current activities.'
        }
        eyebrow={currentUser?.isCoordinator ? 'UNIDOS · COORDINATOR & ADVISER' : 'UNIDOS · FACULTY ADVISER'}
        title={showAllCampus && canManageAdvisers ? 'Campus Organizations & Advisers' : 'My Organizations'}
      />

      <SearchBar
        label="Search organizations"
        onChange={setSearch}
        placeholder="Search by name, acronym, category, or adviser…"
        value={search}
      />
      {assigned.length === 0 && (
        <EmptyState description="No organizations match your search." title="No organizations found" />
      )}
      <div className="adviser-organization-grid">
        {assigned.map((organization) => {
          const events = officerEvents.filter((event) => String(event.organizationId) === String(organization.id))
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
                <div>
                  <small>Prepared Faculty Adviser</small>
                  <strong>{organization.adviser}</strong>
                  {organization.adviserEmail && (
                    <small style={{ display: 'block', color: '#6d6570' }}>{organization.adviserEmail}</small>
                  )}
                </div>
              </div>
              <div className="adviser-org-facts">
                <span><strong>{organization.memberCount ?? 0}</strong> Officers</span>
                <span><strong>{events.filter((event) => ['APPROVED', 'PUBLISHED'].includes(event.status)).length}</strong> Upcoming events</span>
              </div>
              <Link className="button button-primary" to={`/adviser/organizations/${organization.id}`}>
                View Organization
              </Link>
            </Card>
          )
        })}
      </div>

      <Modal
        onClose={() => setPrepareOpen(false)}
        open={prepareOpen}
        size="md"
        title="Prepare Faculty Adviser Account"
      >
        <form className="admin-settings-form" onSubmit={handlePrepareAdviser}>
          <p style={{ margin: 0, fontSize: '13px', color: '#5c5560' }}>
            Pre-generate a Faculty Adviser account and optionally link it directly to an organization so the adviser can sign in immediately.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label className="admin-field-label" htmlFor="adv-prep-first">
                First Name <span className="required-asterisk">*</span>
              </label>
              <input
                className="input"
                id="adv-prep-first"
                onChange={(e) => setPrepareForm((p) => ({ ...p, firstName: e.target.value }))}
                placeholder="e.g., Marjorie"
                required
                type="text"
                value={prepareForm.firstName}
              />
            </div>
            <div>
              <label className="admin-field-label" htmlFor="adv-prep-last">
                Last Name <span className="required-asterisk">*</span>
              </label>
              <input
                className="input"
                id="adv-prep-last"
                onChange={(e) => setPrepareForm((p) => ({ ...p, lastName: e.target.value }))}
                placeholder="e.g., Rojas"
                required
                type="text"
                value={prepareForm.lastName}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '12px' }}>
            <div>
              <label className="admin-field-label" htmlFor="adv-prep-email">
                Official WMSU Email <span className="required-asterisk">*</span>
              </label>
              <input
                className="input"
                id="adv-prep-email"
                onChange={(e) => setPrepareForm((p) => ({ ...p, email: e.target.value }))}
                placeholder="faculty.name@wmsu.edu.ph"
                required
                type="email"
                value={prepareForm.email}
              />
            </div>
            <div>
              <label className="admin-field-label" htmlFor="adv-prep-emp">
                Employee Number
              </label>
              <input
                className="input"
                id="adv-prep-emp"
                onChange={(e) => setPrepareForm((p) => ({ ...p, employeeNumber: e.target.value }))}
                placeholder="e.g., EMP-2026-101"
                type="text"
                value={prepareForm.employeeNumber}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label className="admin-field-label" htmlFor="adv-prep-dept">
                Department (optional)
              </label>
              <select
                className="input"
                id="adv-prep-dept"
                onChange={(e) => setPrepareForm((p) => ({ ...p, departmentId: e.target.value }))}
                value={prepareForm.departmentId}
              >
                <option value="">Select department…</option>
                {academicDepartments.map((dept) => (
                  <option key={dept.id} value={dept.id}>{dept.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="admin-field-label" htmlFor="adv-prep-pwd">
                Initial Password <span className="required-asterisk">*</span>
              </label>
              <input
                className="input"
                id="adv-prep-pwd"
                onChange={(e) => setPrepareForm((p) => ({ ...p, password: e.target.value }))}
                required
                type="text"
                value={prepareForm.password}
              />
            </div>
          </div>

          <div>
            <label className="admin-field-label" htmlFor="adv-prep-org">
              Assign to Organization (optional)
            </label>
            <select
              className="input"
              id="adv-prep-org"
              onChange={(e) => setPrepareForm((p) => ({ ...p, organizationId: e.target.value }))}
              value={prepareForm.organizationId}
            >
              <option value="">Assign later / keep in prepared pool…</option>
              {adminOrganizations.map((org) => (
                <option key={org.id} value={org.id}>
                  {org.acronym ? `${org.acronym} — ${org.name}` : org.name} (Current: {org.adviser || 'Unassigned'})
                </option>
              ))}
            </select>
          </div>

          {prepareError && <p className="auth-error" role="alert">{prepareError}</p>}

          <div className="officer-modal-actions">
            <Button onClick={() => setPrepareOpen(false)} type="button" variant="secondary">Cancel</Button>
            <Button disabled={prepareSaving} type="submit" variant="primary">
              {prepareSaving ? 'Preparing Account…' : 'Create & Prepare Adviser'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

export function AdviserOrganizationDetailsPage() {
  const { id } = useParams()
  const {
    adminOrganizations = [],
    adviserActivity = [],
    adviserDocuments = [],
    assignOfficerPosition,
    demoteOfficerMember,
    officerEvents = [],
    officerMembers = [],
    removeOfficerMember,
  } = useOutletContext()
  const { showToast } = useToast()

  const [positionModalMember, setPositionModalMember] = useState(null)
  const [selectedPosition, setSelectedPosition] = useState('OTHER_OFFICER')
  const [selectedCommittee, setSelectedCommittee] = useState('Programs & Events Committee')
  const [customTitle, setCustomTitle] = useState('')
  const [savingPosition, setSavingPosition] = useState(false)

  const [demoteTarget, setDemoteTarget] = useState(null)
  const [demotePosition, setDemotePosition] = useState('MEMBER')
  const [demoteCommittee, setDemoteCommittee] = useState('General Operations Committee')

  const [removeTarget, setRemoveTarget] = useState(null)

  const organization = adminOrganizations.find((item) => String(item.id) === String(id))

  if (!organization) {
    return (
      <div className="adviser-page">
        <PageHeader eyebrow="UNIDOS · FACULTY ADVISER" title="Organization not found" />
        <EmptyState description="This organization could not be located." title="No access to organization" />
      </div>
    )
  }

  const members = officerMembers
    .filter((member) => String(member.organizationId) === String(id) && member.status === 'ACTIVE')
    .sort((a, b) => getHierarchyEntry(a.rawPosition || a.position).rank - getHierarchyEntry(b.rawPosition || b.position).rank)
  const events = officerEvents.filter((event) => String(event.organizationId) === String(id))
  const documents = adviserDocuments.filter((document) => String(document.organizationId) === String(id))

  const existingPresident = members.find(
    (m) =>
      getHierarchyEntry(m.rawPosition || m.position).code === 'PRESIDENT' &&
      (!positionModalMember ||
        (String(m.id) !== String(positionModalMember.id) &&
          String(m.membershipId) !== String(positionModalMember.membershipId)))
  )

  return (
    <div className="adviser-page">
      <PageHeader
        description={`${organization.acronym} · ${organization.category} · ${organization.status}`}
        eyebrow="ORGANIZATION GOVERNANCE"
        title={organization.name}
      />
      <Card className="adviser-profile-card">
        <span className="adviser-org-logo">{organization.acronym}</span>
        <div>
          <Badge tone="success">{organization.status}</Badge>
          <p>{organization.name} is under faculty guidance, officer hierarchy oversight, and compliance review.</p>
        </div>
        <div className="adviser-profile-meta">
          <span className="adviser-profile-count"><strong>{members.length}</strong> active officers</span>
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
          <h2>Officer Hierarchy &amp; Committees</h2>
          {members.length ? (
            <div className="adviser-people-list">
              {members.map((member) => {
                const entry = getHierarchyEntry(member.rawPosition || member.position)
                const isLowestRank = entry.rank >= OFFICER_HIERARCHY[OFFICER_HIERARCHY.length - 1].rank
                return (
                  <div
                    key={member.id}
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '10px',
                      padding: '10px 0',
                      borderBottom: '1px solid #f0edf0',
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <strong>{formatDisplayName(member)}</strong>
                        <Badge tone={entry.rank <= 2 ? 'crimson' : 'info'}>
                          Rank {entry.rank} · {member.customTitle || entry.title}
                        </Badge>
                      </div>
                      <small style={{ color: '#6d6570' }}>
                        ID: {member.studentId} · Committee: <strong>{member.committee || entry.defaultCommittee}</strong>
                      </small>
                    </div>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      <Button
                        onClick={() => {
                          setPositionModalMember(member)
                          setSelectedPosition(entry.code)
                          setSelectedCommittee(member.committee || entry.defaultCommittee)
                          setCustomTitle(member.customTitle || '')
                        }}
                        variant="secondary"
                      >
                        Role &amp; Committee
                      </Button>
                      <Button
                        disabled={isLowestRank}
                        onClick={() => {
                          const opts = getDemotionOptions(entry.code)
                          const next = opts[0]
                          setDemoteTarget(member)
                          setDemotePosition(next.code)
                          setDemoteCommittee(next.defaultCommittee)
                        }}
                        variant="outline"
                      >
                        Demote
                      </Button>
                      <Button onClick={() => setRemoveTarget(member)} variant="danger">
                        Remove
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <p>No active officers are recorded for this organization.</p>
          )}
        </Card>

        <Card className="adviser-panel">
          <h2>Official Documents</h2>
          <ul className="adviser-simple-list">
            {(organization.documents ?? []).map((name) => <li key={name}>{name} <Badge tone="success">On file</Badge></li>)}
            {documents.map((document) => (
              <li key={document.id}>
                {document.title}{' '}
                <Badge tone={document.status === 'APPROVED' ? 'success' : document.status === 'PENDING' ? 'warning' : 'neutral'}>
                  {document.status}
                </Badge>
              </li>
            ))}
          </ul>
        </Card>

        <Card className="adviser-panel adviser-detail-wide">
          <h2>Calendar of Events</h2>
          <CalendarOfEvents events={events} organizationName={organization.name} />
        </Card>

        <Card className="adviser-panel">
          <h2>Announcements</h2>
          <ul className="adviser-simple-list">
            {(organization.announcements ?? [])
              .filter((announcement) => !announcement.status || announcement.status === 'PUBLISHED')
              .map((announcement) => (
                <li key={announcement.id ?? announcement.title}>
                  <span>{announcement.title}<small>{announcement.datePosted ?? announcement.date}</small></span>
                </li>
              ))}
          </ul>
        </Card>

        <Card className="adviser-panel">
          <h2>Activity Log</h2>
          <ul className="adviser-simple-list">
            {adviserActivity.slice(0, 4).map((activity) => (
              <li key={activity.id}>
                <span>{activity.description || activity.message}<small>{activity.timestamp || activity.time}</small></span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Link className="button button-secondary adviser-back-link" to="/adviser/organizations">
        Back to Organizations
      </Link>

      {/* Update Role & Committee Modal */}
      <Modal
        onClose={() => setPositionModalMember(null)}
        open={Boolean(positionModalMember)}
        size="md"
        title="Manage Officer Role & Committee"
        tone="info"
      >
        {positionModalMember && (
          <div style={{ display: 'grid', gap: '14px', padding: '4px' }}>
            <div>
              <p style={{ margin: '0 0 4px', fontSize: '13px', color: '#6d6570' }}>Officer</p>
              <h3 style={{ margin: 0, fontSize: '16px' }}>{formatDisplayName(positionModalMember)}</h3>
              <span style={{ fontSize: '13px', color: '#6d6570' }}>
                {positionModalMember.studentId} · Current: <b>{positionModalMember.position}</b>
              </span>
            </div>

            <label style={{ display: 'grid', gap: '6px', fontSize: '14px', fontWeight: 600 }}>
              Officer Hierarchy Position
              <select
                className="input"
                onChange={(e) => {
                  const code = e.target.value
                  setSelectedPosition(code)
                  setSelectedCommittee(getHierarchyEntry(code).defaultCommittee)
                }}
                value={selectedPosition}
              >
                {OFFICER_HIERARCHY.map((role) => (
                  <option key={role.code} value={role.code}>
                    Rank {role.rank}: {role.title}
                    {role.code === 'PRESIDENT' && existingPresident ? ` (Currently: ${formatDisplayName(existingPresident)})` : ''}
                  </option>
                ))}
              </select>
            </label>

            <label style={{ display: 'grid', gap: '6px', fontSize: '14px', fontWeight: 600 }}>
              Assigned Standing Committee
              <select
                className="input"
                onChange={(e) => setSelectedCommittee(e.target.value)}
                value={selectedCommittee}
              >
                {ORGANIZATION_COMMITTEES.map((committee) => (
                  <option key={committee} value={committee}>{committee}</option>
                ))}
              </select>
            </label>

            {selectedPosition === 'OTHER_OFFICER' && (
              <label style={{ display: 'grid', gap: '6px', fontSize: '14px', fontWeight: 600 }}>
                Specific Chairperson Title (optional)
                <input
                  className="input"
                  onChange={(e) => setCustomTitle(e.target.value)}
                  placeholder="e.g. Programs & Events Chairperson"
                  type="text"
                  value={customTitle}
                />
              </label>
            )}

            <div className="officer-modal-actions">
              <Button disabled={savingPosition} onClick={() => setPositionModalMember(null)} variant="secondary">
                Cancel
              </Button>
              <Button
                disabled={savingPosition}
                onClick={async () => {
                  setSavingPosition(true)
                  const targetMemId = positionModalMember.membershipId || positionModalMember.id
                  const res = await assignOfficerPosition(
                    targetMemId,
                    selectedPosition,
                    selectedPosition === 'OTHER_OFFICER' ? customTitle : '',
                    selectedCommittee
                  )
                  setSavingPosition(false)
                  if (res?.ok !== false) {
                    showToast('Officer role and committee updated.', 'success')
                    setPositionModalMember(null)
                  } else {
                    showToast(res?.reason || 'Failed to update officer role.', 'error')
                  }
                }}
                variant="primary"
              >
                {savingPosition ? 'Saving…' : 'Save Role & Committee'}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Demote Modal */}
      <Modal
        onClose={() => setDemoteTarget(null)}
        open={Boolean(demoteTarget)}
        size="md"
        title="Demote Officer"
        tone="warning"
      >
        {demoteTarget && (
          <div style={{ display: 'grid', gap: '12px' }}>
            <p style={{ margin: 0 }}>
              Select a lower rank and committee for <strong>{formatDisplayName(demoteTarget)}</strong>:
            </p>
            <label style={{ display: 'grid', gap: '6px', fontSize: '14px', fontWeight: 600 }}>
              Lower Hierarchy Rank
              <select
                className="input"
                onChange={(e) => {
                  const code = e.target.value
                  setDemotePosition(code)
                  setDemoteCommittee(getHierarchyEntry(code).defaultCommittee)
                }}
                value={demotePosition}
              >
                {getDemotionOptions(demoteTarget.rawPosition || demoteTarget.position).map((role) => (
                  <option key={role.code} value={role.code}>
                    Rank {role.rank}: {role.title}
                  </option>
                ))}
              </select>
            </label>
            <label style={{ display: 'grid', gap: '6px', fontSize: '14px', fontWeight: 600 }}>
              Reassigned Committee
              <select
                className="input"
                onChange={(e) => setDemoteCommittee(e.target.value)}
                value={demoteCommittee}
              >
                {ORGANIZATION_COMMITTEES.map((committee) => (
                  <option key={committee} value={committee}>{committee}</option>
                ))}
              </select>
            </label>
            <div className="officer-modal-actions">
              <Button onClick={() => setDemoteTarget(null)} variant="secondary">Cancel</Button>
              <Button
                onClick={async () => {
                  const res = await demoteOfficerMember(
                    demoteTarget.membershipId || demoteTarget.id,
                    demotePosition,
                    demoteCommittee
                  )
                  if (res?.ok !== false) {
                    showToast(`${formatDisplayName(demoteTarget)} demoted.`, 'success')
                    setDemoteTarget(null)
                  } else {
                    showToast(res?.reason || 'Unable to demote officer.', 'error')
                  }
                }}
                variant="primary"
              >
                Confirm Demotion
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Remove Modal */}
      <Modal
        onClose={() => setRemoveTarget(null)}
        open={Boolean(removeTarget)}
        size="sm"
        title="Remove Officer"
        tone="danger"
      >
        {removeTarget && (
          <>
            <p>
              Remove <strong>{formatDisplayName(removeTarget)}</strong> from <b>{organization.name}</b>?
            </p>
            <div className="officer-modal-actions">
              <Button onClick={() => setRemoveTarget(null)} variant="secondary">Cancel</Button>
              <Button
                onClick={async () => {
                  const res = await removeOfficerMember(removeTarget.membershipId || removeTarget.id)
                  if (res?.ok !== false) {
                    showToast(`${formatDisplayName(removeTarget)} removed from ${organization.name}.`, 'success')
                    setRemoveTarget(null)
                  } else {
                    showToast(res?.reason || 'Unable to remove officer.', 'error')
                  }
                }}
                variant="danger"
              >
                Remove Officer
              </Button>
            </div>
          </>
        )}
      </Modal>
    </div>
  )
}

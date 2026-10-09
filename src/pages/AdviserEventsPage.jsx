import { useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import AdviserReviewDialog from '../components/adviser/AdviserReviewDialog.jsx'
import Badge from '../components/ui/Badge.jsx'
import Button from '../components/ui/Button.jsx'
import Card from '../components/ui/Card.jsx'
import EmptyState from '../components/ui/EmptyState.jsx'
import PageHeader from '../components/layout/PageHeader.jsx'
import SearchBar, { matchesQuery } from '../components/ui/SearchBar.jsx'
import { undoAction, useToast } from '../components/ui/useToast.js'

const filters = ['All', 'Pending Review', 'Approved', 'Returned', 'Rejected', 'Upcoming', 'Completed']
const eventTone = { DRAFT: 'neutral', SUBMITTED: 'warning', UNDER_REVIEW: 'warning', APPROVED: 'success', PUBLISHED: 'success', RETURNED_FOR_REVISION: 'danger', REJECTED: 'danger', ONGOING: 'crimson', COMPLETED: 'neutral', ARCHIVED: 'neutral' }

function matchesEventFilter(event, filter) {
  if (filter === 'All') return true
  if (filter === 'Pending Review') return ['SUBMITTED', 'UNDER_REVIEW'].includes(event.status)
  if (filter === 'Approved') return ['APPROVED', 'PUBLISHED'].includes(event.status)
  if (filter === 'Returned') return event.status === 'RETURNED_FOR_REVISION'
  if (filter === 'Rejected') return event.status === 'REJECTED'
  if (filter === 'Upcoming') return ['APPROVED', 'PUBLISHED', 'ONGOING'].includes(event.status)
  return ['COMPLETED', 'ARCHIVED'].includes(event.status)
}

export default function AdviserEventsPage() {
  const { captureUndo, officerEvents, reviewAdviserRequest } = useOutletContext()
  const { showToast } = useToast()
  const [filter, setFilter] = useState('All')
  const [selected, setSelected] = useState(null)
  const [search, setSearch] = useState('')
  const visibleEvents = officerEvents
    .filter((event) => matchesEventFilter(event, filter))
    .filter((event) => matchesQuery(search, event.title, event.organizationName, event.date, event.location, event.category))

  function decide(decision, comment) {
    if (!selected) return
    const undo = captureUndo()
    const saved = reviewAdviserRequest('EVENT', selected.id, decision, comment)
    if (saved) showToast(decision === 'APPROVED'
      ? `${selected.title} approved for Student Affairs review.`
      : decision === 'RETURNED'
        ? `${selected.title} returned to the officer for revision.`
        : `${selected.title} proposal rejected.`, 'success', undoAction(undo))
    else showToast('The event decision could not be saved.', 'error')
  }

  return (
    <>
      <PageHeader
        description="Review activities for assigned organizations. Adviser approval does not publish an event; Student Affairs must complete the next review."
        eyebrow="UNIDOS · FACULTY ADVISER"
        title="Organization Events"
      />
      <SearchBar label="Search events" onChange={setSearch} placeholder="Search events by title, organization or date…" value={search} />
      <Card className="adviser-panel">
        <div className="adviser-filter-row" aria-label="Filter adviser events" role="group">
          {filters.map((item) => <button aria-pressed={filter === item} className={filter === item ? 'is-active' : ''} key={item} onClick={() => setFilter(item)} type="button">{item}<span>{officerEvents.filter((event) => matchesEventFilter(event, item)).length}</span></button>)}
        </div>
        {visibleEvents.length ? (
          <div className="adviser-event-list">
            {visibleEvents.map((event) => (
              <article className="adviser-event-card" key={event.id}>
                <div className="adviser-event-main">
                  <span className="adviser-muted-label">{event.organizationName ?? 'WMSU Computer Society'} · {event.category ?? 'Organization Activity'}</span>
                  <h2>{event.title}</h2>
                  <p>{event.date} · {event.time || event.startTime || 'Time to be confirmed'} · {event.location || event.venue || 'Venue to be confirmed'}</p>
                  <small>{event.registrations ?? 0} registrations · Capacity {event.capacity ?? 'Not specified'}</small>
                </div>
                <Badge tone={eventTone[event.status] ?? 'neutral'}>{event.status.replaceAll('_', ' ')}</Badge>
                <Button onClick={() => setSelected({ ...event, organizationName: event.organizationName ?? 'WMSU Computer Society', submittedDate: event.submittedDate ?? 'October 2, 2026', type: 'EVENT' })} variant="secondary">View Details</Button>
              </article>
            ))}
          </div>
        ) : <EmptyState description="No organization events match this filter." title="No events found" />}
      </Card>
      <AdviserReviewDialog item={selected} key={selected?.id ?? 'closed'} onClose={() => setSelected(null)} onDecision={decide} />
    </>
  )
}

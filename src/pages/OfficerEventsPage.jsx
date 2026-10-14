import { useMemo, useState } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import Badge from '../components/ui/Badge.jsx'
import Card from '../components/ui/Card.jsx'
import EmptyState from '../components/ui/EmptyState.jsx'
import PageHeader from '../components/layout/PageHeader.jsx'
import SearchBar, { matchesQuery } from '../components/ui/SearchBar.jsx'
import Table from '../components/ui/Table.jsx'
import { officerEventStatuses } from '../data/officerPortal.js'

export default function OfficerEventsPage() {
  const { adminOrganizations, currentUser, officerEvents } = useOutletContext()
  const orgId = currentUser?.organizationId || 'wmsu-cs'
  const organization = adminOrganizations?.find((item) => item.id === orgId) || { name: 'WMSU Computer Society', acronym: 'CS' }
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')

  const counts = useMemo(() => {
    const total = officerEvents.length
    const published = officerEvents.filter((e) => ['PUBLISHED', 'APPROVED', 'ONGOING'].includes(e.status)).length
    const inReview = officerEvents.filter((e) => ['SUBMITTED', 'PENDING', 'UNDER_REVIEW'].includes(e.status)).length
    const returned = officerEvents.filter((e) => ['RETURNED', 'RETURNED_FOR_REVISION'].includes(e.status)).length
    return { total, published, inReview, returned }
  }, [officerEvents])

  const visibleEvents = useMemo(() => {
    return officerEvents
      .filter((event) => {
        if (statusFilter === 'PUBLISHED') return ['PUBLISHED', 'APPROVED', 'ONGOING'].includes(event.status)
        if (statusFilter === 'IN_REVIEW') return ['SUBMITTED', 'PENDING', 'UNDER_REVIEW'].includes(event.status)
        if (statusFilter === 'RETURNED') return ['RETURNED', 'RETURNED_FOR_REVISION'].includes(event.status)
        if (statusFilter === 'DRAFT') return event.status === 'DRAFT'
        return true
      })
      .filter((event) => matchesQuery(search, event.title, event.date, event.status, event.location, event.venue))
  }, [officerEvents, search, statusFilter])

  const columns = [
    {
      key: 'title',
      label: 'Event',
      render: (_, event) => (
        <div className="officer-event-table-cell">
          <strong>{event.title}</strong>
          <small>{event.location || event.venue || 'Campus venue'}</small>
        </div>
      ),
    },
    { key: 'date', label: 'Date & Time', render: (_, event) => <span>{event.date} {event.time ? `· ${event.time}` : ''}</span> },
    {
      key: 'status',
      label: 'Proposal status',
      render: (status) => (
        <Badge tone={officerEventStatuses[status]?.tone ?? (status === 'RETURNED_FOR_REVISION' ? 'danger' : 'neutral')}>
          {officerEventStatuses[status]?.label ?? status.replaceAll('_', ' ')}
        </Badge>
      ),
    },
    {
      key: 'registrations',
      label: 'Registrations',
      render: (_, event) => (
        <span>{event.registrations ?? 0} {event.capacity ? `/ ${event.capacity}` : ''}</span>
      ),
    },
    {
      key: 'actions',
      label: 'Officer actions',
      render: (_, event) => event.status === 'RETURNED_FOR_REVISION' ? (
        <Link className="button button-secondary" to={`/officer/events/create?edit=${encodeURIComponent(event.id)}`}>
          Edit and resubmit
        </Link>
      ) : (
        <span className="officer-readonly-label">Adviser reviewed</span>
      ),
    },
  ]

  return (
    <div className="officer-page">
      <PageHeader
        description={`Create proposals, submit them for review, and update proposals returned by your adviser for ${organization.name}.`}
        eyebrow={organization.name}
        title="Organization Events"
      />

      <div className="officer-stats-grid">
        <Card className="officer-stat-card">
          <div className="officer-stat-icon tone-crimson">
            <svg aria-hidden="true" fill="none" height="18" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="18">
              <rect height="18" rx="2" ry="2" width="18" x="3" y="4" />
              <line x1="16" x2="16" y1="2" y2="6" />
              <line x1="8" x2="8" y1="2" y2="6" />
              <line x1="3" x2="21" y1="10" y2="10" />
            </svg>
          </div>
          <div>
            <span className="stat-value">{counts.total}</span>
            <span className="stat-label">Total Events</span>
          </div>
        </Card>

        <Card className="officer-stat-card">
          <div className="officer-stat-icon tone-green">
            <svg aria-hidden="true" fill="none" height="18" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="18">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
          </div>
          <div>
            <span className="stat-value">{counts.published}</span>
            <span className="stat-label">Approved & Published</span>
          </div>
        </Card>

        <Card className="officer-stat-card">
          <div className="officer-stat-icon tone-gold">
            <svg aria-hidden="true" fill="none" height="18" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="18">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          </div>
          <div>
            <span className="stat-value">{counts.inReview}</span>
            <span className="stat-label">Under Review</span>
          </div>
        </Card>

        <Card className="officer-stat-card">
          <div className="officer-stat-icon tone-danger">
            <svg aria-hidden="true" fill="none" height="18" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="18">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" x2="12" y1="8" y2="12" />
              <line x1="12" x2="12.01" y1="16" y2="16" />
            </svg>
          </div>
          <div>
            <span className="stat-value">{counts.returned}</span>
            <span className="stat-label">Returned for Revision</span>
          </div>
        </Card>
      </div>

      <div className="officer-announcements-toolbar" style={{ marginTop: '12px', marginBottom: '4px' }}>
        <div className="officer-request-tabs" role="group" aria-label="Filter events by status">
          {[
            { key: 'ALL', label: 'All', count: counts.total },
            { key: 'PUBLISHED', label: 'Approved', count: counts.published },
            { key: 'IN_REVIEW', label: 'In Review', count: counts.inReview },
            { key: 'RETURNED', label: 'Returned', count: counts.returned },
          ].map((tab) => (
            <button
              aria-pressed={statusFilter === tab.key}
              className={statusFilter === tab.key ? 'is-selected' : ''}
              key={tab.key}
              onClick={() => setStatusFilter(tab.key)}
              type="button"
            >
              {tab.label} <span>{tab.count}</span>
            </button>
          ))}
        </div>
        <Link className="button button-primary" to="/officer/events/create" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
          <svg aria-hidden="true" fill="none" height="15" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" viewBox="0 0 24 24" width="15">
            <line x1="12" x2="12" y1="5" y2="19" />
            <line x1="5" x2="19" y1="12" y2="12" />
          </svg>
          Create Event
        </Link>
      </div>

      <SearchBar label="Search events" onChange={setSearch} placeholder="Search events by title, date, venue, or status…" value={search} />

      <Card className="officer-page-card">
        <div className="officer-page-card-heading">
          <div>
            <h2>Organization Events</h2>
            <p>Showing events belonging to {organization.name}.</p>
          </div>
        </div>

        {visibleEvents.length ? (
          <Table useDataTable columns={columns} rows={visibleEvents} />
        ) : (
          <EmptyState
            title="No events match your search"
            description={search ? 'Try another search keyword or clear the status filter.' : 'No event proposals have been created yet.'}
          />
        )}
        <p className="officer-permission-note">Event proposals cannot be approved by an organization officer. Approval is reserved for the Organization Adviser and Student Affairs Admin.</p>
      </Card>
    </div>
  )
}

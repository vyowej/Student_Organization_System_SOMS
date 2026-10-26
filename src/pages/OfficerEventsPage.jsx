import { useMemo, useState } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import Badge from '../components/ui/Badge.jsx'
import Card from '../components/ui/Card.jsx'
import EmptyState from '../components/ui/EmptyState.jsx'
import Icon from '../components/ui/Icon.jsx'
import PageHeader from '../components/layout/PageHeader.jsx'
import SearchBar, { matchesQuery } from '../components/ui/SearchBar.jsx'
import Table from '../components/ui/Table.jsx'
import { officerEventStatuses } from '../data/navigation.js'

export default function OfficerEventsPage() {
  const { adminOrganizations = [], currentUser, officerEvents = [] } = useOutletContext()
  const orgId = currentUser?.organizationId || adminOrganizations[0]?.id
  const organization = adminOrganizations?.find((item) => String(item.id) === String(orgId)) || adminOrganizations[0] || { name: 'Your Organization', acronym: 'ORG' }
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')

  const orgEvents = useMemo(
    () => officerEvents.filter((e) => !organization.id || String(e.organizationId) === String(organization.id)),
    [officerEvents, organization.id]
  )

  const counts = useMemo(() => {
    const total = orgEvents.length
    const published = orgEvents.filter((e) => ['PUBLISHED', 'APPROVED', 'ONGOING'].includes(e.status)).length
    const inReview = orgEvents.filter((e) => ['SUBMITTED', 'PENDING', 'UNDER_REVIEW'].includes(e.status)).length
    const returned = orgEvents.filter((e) => ['RETURNED', 'RETURNED_FOR_REVISION', 'CANCELLED'].includes(e.status)).length
    return { total, published, inReview, returned }
  }, [orgEvents])

  const visibleEvents = useMemo(() => {
    return orgEvents
      .filter((event) => {
        if (statusFilter === 'PUBLISHED') return ['PUBLISHED', 'APPROVED', 'ONGOING'].includes(event.status)
        if (statusFilter === 'IN_REVIEW') return ['SUBMITTED', 'PENDING', 'UNDER_REVIEW'].includes(event.status)
        if (statusFilter === 'RETURNED') return ['RETURNED', 'RETURNED_FOR_REVISION', 'CANCELLED'].includes(event.status)
        if (statusFilter === 'DRAFT') return event.status === 'DRAFT'
        return true
      })
      .filter((event) => matchesQuery(search, event.title, event.date, event.status, event.location, event.venue))
  }, [orgEvents, search, statusFilter])

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
      render: (_, event) => ['RETURNED_FOR_REVISION', 'CANCELLED', 'DRAFT'].includes(event.status) ? (
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
            <Icon name="event" size={18} />
          </div>
          <div>
            <span className="stat-value">{counts.total}</span>
            <span className="stat-label">Total Events</span>
          </div>
        </Card>

        <Card className="officer-stat-card">
          <div className="officer-stat-icon tone-green">
            <Icon name="check-circle" size={18} />
          </div>
          <div>
            <span className="stat-value">{counts.published}</span>
            <span className="stat-label">Approved & Published</span>
          </div>
        </Card>

        <Card className="officer-stat-card">
          <div className="officer-stat-icon tone-gold">
            <Icon name="clock" size={18} />
          </div>
          <div>
            <span className="stat-value">{counts.inReview}</span>
            <span className="stat-label">Under Review</span>
          </div>
        </Card>

        <Card className="officer-stat-card">
          <div className="officer-stat-icon tone-danger">
            <Icon name="alert-circle" size={18} />
          </div>
          <div>
            <span className="stat-value">{counts.returned}</span>
            <span className="stat-label">Returned for Revision</span>
          </div>
        </Card>
      </div>

      <div className="officer-toolbar-tabs-row officer-announcements-toolbar">
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
        <Link className="button button-primary" to="/officer/events/create">
          <Icon name="plus" size={15} strokeWidth={2.2} />
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

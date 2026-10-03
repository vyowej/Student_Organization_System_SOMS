import { Link, useOutletContext } from 'react-router-dom'
import Badge from '../components/ui/Badge.jsx'
import Card from '../components/ui/Card.jsx'
import PageHeader from '../components/layout/PageHeader.jsx'
import Table from '../components/ui/Table.jsx'
import { officerEventStatuses } from '../data/officerPortal.js'

export default function OfficerEventsPage() {
  const { officerEvents } = useOutletContext()
  const columns = [
    { key: 'title', label: 'Event' },
    { key: 'date', label: 'Date' },
    { key: 'status', label: 'Proposal status', render: (status) => <Badge tone={officerEventStatuses[status]?.tone ?? 'neutral'}>{officerEventStatuses[status]?.label ?? status}</Badge> },
    { key: 'registrations', label: 'Registrations' },
    {
      key: 'actions',
      label: 'Officer actions',
      render: (_, event) => event.status === 'RETURNED_FOR_REVISION'
        ? <Link className="button button-secondary" to={`/officer/events/create?edit=${encodeURIComponent(event.id)}`}>Edit and resubmit</Link>
        : <span className="officer-readonly-label">Approval handled by adviser / Student Affairs</span>,
    },
  ]

  return (
    <>
      <PageHeader
        description="Create proposals, submit them for review, and update proposals returned by your adviser."
        eyebrow="WMSU Computer Society"
        title="Events"
      />
      <Card className="officer-page-card">
        <div className="officer-page-card-heading">
          <div><h2>Organization events</h2><p>Only events belonging to WMSU Computer Society are shown.</p></div>
          <Link className="button button-primary" to="/officer/events/create">Create Event</Link>
        </div>
        <Table columns={columns} rows={officerEvents} />
        <p className="officer-permission-note">Event proposals cannot be approved by an organization officer. Approval is reserved for the Organization Adviser and Student Affairs Admin.</p>
      </Card>
    </>
  )
}

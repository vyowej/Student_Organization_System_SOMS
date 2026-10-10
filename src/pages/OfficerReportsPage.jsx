import { useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import Badge from '../components/ui/Badge.jsx'
import Card from '../components/ui/Card.jsx'
import EmptyState from '../components/ui/EmptyState.jsx'
import PageHeader from '../components/layout/PageHeader.jsx'
import SearchBar, { matchesQuery } from '../components/ui/SearchBar.jsx'

const statusTone = { PENDING_VERIFICATION: 'warning', VERIFIED: 'success', RETURNED: 'danger' }

export default function OfficerReportsPage() {
  const { adviserReports } = useOutletContext()
  const [search, setSearch] = useState('')
  const reports = adviserReports.filter((report) => matchesQuery(search, report.eventTitle, report.status, report.eventDate, report.submittedDate))

  return (
    <div className="officer-page">
      <PageHeader
        description="View adviser verification decisions and feedback for your activity reports."
        eyebrow="WMSU COMPUTER SOCIETY"
        title="Activity Reports"
      />
      <SearchBar label="Search reports" onChange={setSearch} placeholder="Search reports by event or status…" value={search} />
      <Card className="adviser-panel">
        <div className="adviser-panel-heading"><div><h2>Accomplishment Reports</h2><p>Adviser verification is reflected here immediately.</p></div></div>
        {reports.length ? <div className="adviser-report-list">
          {reports.map((report) => (
            <article className="adviser-report-card" key={report.id}>
              <div><span className="adviser-muted-label">{report.organizationName}</span><h2>{report.eventTitle}</h2><p>Event {report.eventDate} · Attendance {report.attendance} · Submitted {report.submittedDate}</p>
                {report.revisionNote && <small>Adviser revision comments: {report.revisionNote}</small>}
                {report.verifiedBy && <small>Verified by {report.verifiedBy} on {report.decisionDate}</small>}
              </div>
              <Badge tone={statusTone[report.status] ?? 'neutral'}>{report.status.replaceAll('_', ' ')}</Badge>
              <span className="adviser-readonly-status">{report.status === 'RETURNED' ? 'Please revise and resubmit the report.' : 'Report status'}</span>
            </article>
          ))}
        </div> : <EmptyState description={search ? 'No reports match your search.' : 'Completed activities and submitted reports will be shown here.'} title="No activity reports" />}
      </Card>
    </div>
  )
}

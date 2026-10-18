import { useMemo, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import Badge from '../components/ui/Badge.jsx'
import Card from '../components/ui/Card.jsx'
import EmptyState from '../components/ui/EmptyState.jsx'
import Icon from '../components/ui/Icon.jsx'
import PageHeader from '../components/layout/PageHeader.jsx'
import SearchBar, { matchesQuery } from '../components/ui/SearchBar.jsx'

const statusTone = {
  PENDING_VERIFICATION: 'warning',
  VERIFIED: 'success',
  RETURNED: 'danger',
}

export default function OfficerReportsPage() {
  const { adminOrganizations, adviserReports, currentUser } = useOutletContext()
  const orgId = currentUser?.organizationId || 'wmsu-cs'
  const organization = adminOrganizations?.find((item) => item.id === orgId) || { name: 'WMSU Computer Society', acronym: 'CS' }

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')

  const counts = useMemo(() => {
    const total = adviserReports.length
    const verified = adviserReports.filter((r) => r.status === 'VERIFIED').length
    const pending = adviserReports.filter((r) => r.status === 'PENDING_VERIFICATION').length
    const returned = adviserReports.filter((r) => r.status === 'RETURNED').length
    return { total, verified, pending, returned }
  }, [adviserReports])

  const visibleReports = useMemo(() => {
    return adviserReports
      .filter((report) => {
        if (statusFilter === 'VERIFIED') return report.status === 'VERIFIED'
        if (statusFilter === 'PENDING_VERIFICATION') return report.status === 'PENDING_VERIFICATION'
        if (statusFilter === 'RETURNED') return report.status === 'RETURNED'
        return true
      })
      .filter((report) => matchesQuery(search, report.eventTitle, report.status, report.eventDate, report.submittedDate, report.organizationName))
  }, [adviserReports, search, statusFilter])

  return (
    <div className="officer-page">
      <PageHeader
        description={`Review adviser verification decisions, accomplishment reports, and feedback for ${organization.name}.`}
        eyebrow={organization.name}
        title="Activity & Accomplishment Reports"
      />

      <div className="officer-stats-grid">
        <Card className="officer-stat-card">
          <div className="officer-stat-icon tone-crimson">
            <Icon name="document" size={18} />
          </div>
          <div>
            <span className="stat-value">{counts.total}</span>
            <span className="stat-label">Total Reports</span>
          </div>
        </Card>

        <Card className="officer-stat-card">
          <div className="officer-stat-icon tone-green">
            <Icon name="check-circle" size={18} />
          </div>
          <div>
            <span className="stat-value">{counts.verified}</span>
            <span className="stat-label">Verified & Approved</span>
          </div>
        </Card>

        <Card className="officer-stat-card">
          <div className="officer-stat-icon tone-gold">
            <Icon name="clock" size={18} />
          </div>
          <div>
            <span className="stat-value">{counts.pending}</span>
            <span className="stat-label">Pending Verification</span>
          </div>
        </Card>

        <Card className="officer-stat-card">
          <div className="officer-stat-icon tone-danger">
            <Icon name="alert-circle" size={18} />
          </div>
          <div>
            <span className="stat-value">{counts.returned}</span>
            <span className="stat-label">Revision Needed</span>
          </div>
        </Card>
      </div>

      <div className="officer-toolbar-tabs-row officer-announcements-toolbar">
        <div className="officer-request-tabs" role="group" aria-label="Filter reports by status">
          {[
            { key: 'ALL', label: 'All', count: counts.total },
            { key: 'VERIFIED', label: 'Verified', count: counts.verified },
            { key: 'PENDING_VERIFICATION', label: 'Pending', count: counts.pending },
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
      </div>

      <SearchBar label="Search reports" onChange={setSearch} placeholder="Search reports by event title, date, or status…" value={search} />

      <Card className="officer-page-card">
        <div className="officer-page-card-heading">
          <div>
            <h2>Accomplishment Reports</h2>
            <p>Adviser verification decisions and feedback for {organization.name}.</p>
          </div>
        </div>

        {visibleReports.length ? (
          <div className="officer-report-list">
            {visibleReports.map((report) => (
              <article className="officer-report-card" key={report.id}>
                <div className="officer-report-icon-wrap">
                  <Icon name="document" size={20} />
                </div>
                <div className="officer-report-main">
                  <div className="officer-report-header">
                    <span className="officer-report-org-label">{report.organizationName || organization.name}</span>
                    <Badge tone={statusTone[report.status] ?? 'neutral'}>{report.status.replaceAll('_', ' ')}</Badge>
                  </div>
                  <h3>{report.eventTitle}</h3>
                  <div className="officer-report-meta-row">
                    <span>Event Date: <strong>{report.eventDate}</strong></span>
                    <span>Attendance: <strong>{report.attendance ?? 0} students</strong></span>
                    <span>Submitted: <strong>{report.submittedDate}</strong></span>
                  </div>
                  {report.revisionNote && (
                    <div className="officer-report-revision-alert">
                      <strong>Adviser Revision Note:</strong> {report.revisionNote}
                    </div>
                  )}
                  {report.verifiedBy && (
                    <small className="officer-report-verified-by">
                      Verified by {report.verifiedBy} on {report.decisionDate}
                    </small>
                  )}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState
            description={search ? 'No reports match your search query.' : 'Completed activities and submitted reports will appear here.'}
            title={search ? 'No matching reports' : 'No activity reports yet'}
          />
        )}
      </Card>
    </div>
  )
}

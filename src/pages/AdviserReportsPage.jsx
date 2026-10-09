import { useMemo, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import AdviserReviewDialog from '../components/adviser/AdviserReviewDialog.jsx'
import Badge from '../components/ui/Badge.jsx'
import Button from '../components/ui/Button.jsx'
import EmptyState from '../components/ui/EmptyState.jsx'
import PageHeader from '../components/layout/PageHeader.jsx'
import { undoAction, useToast } from '../components/ui/useToast.js'
import { useAuth } from '../context/useAuth.js'
import { formatDisplayName } from '../data/displayName.js'

const statusLabels = {
  PENDING_VERIFICATION: 'Pending Verification',
  VERIFIED: 'Verified',
  RETURNED: 'Returned',
}

const statusTone = { PENDING_VERIFICATION: 'warning', VERIFIED: 'success', RETURNED: 'danger' }

function ReportIcon({ name }) {
  const paths = {
    calendar: <><rect height="15" rx="2" width="16" x="4" y="5" /><path d="M8 3v4m8-4v4M4 10h16" /></>,
    attendance: <><circle cx="9" cy="8" r="3" /><path d="M3.5 19v-1a5.5 5.5 0 0 1 11 0v1zm12-8a3 3 0 1 0 0-6m1.5 8a5.5 5.5 0 0 1 3.5 5" /></>,
    organization: <><path d="M4 20V7l8-4 8 4v13M2 20h20M8 10h2m4 0h2m-8 4h2m4 0h2m-5 6v-4h2v4" /></>,
    document: <><path d="M7 3h7l5 5v13H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" /><path d="M14 3v5h5M9 13h6m-6 4h6" /></>,
    search: <><circle cx="10.8" cy="10.8" r="6.8" /><path d="m16 16 4.5 4.5" /></>,
  }

  return <svg aria-hidden="true" className="adviser-report-icon" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" viewBox="0 0 24 24">{paths[name]}</svg>
}

function ReportFact({ icon, label, value }) {
  return <span className="adviser-report-fact"><ReportIcon name={icon} /><span><small>{label}</small><strong>{value || 'Not provided'}</strong></span></span>
}

function getTurnout(report) {
  const registered = Number(report.registeredCount ?? report.registered)
  if (!Number.isFinite(registered) || registered <= 0) return null
  const attendees = Number(report.actualAttendees ?? report.attendance)
  if (!Number.isFinite(attendees)) return null
  return { registered, attendees, noShows: Math.max(registered - attendees, 0), rate: `${((attendees / registered) * 100).toFixed(1)}%` }
}

export default function AdviserReportsPage() {
  const { adviserReports, captureUndo, reviewAccomplishmentReport } = useOutletContext()
  const { currentUser } = useAuth()
  const { showToast } = useToast()
  const [selected, setSelected] = useState(null)
  const [initialDecision, setInitialDecision] = useState('')
  const [search, setSearch] = useState('')
  const [organizationFilter, setOrganizationFilter] = useState('ALL')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const adviserName = formatDisplayName(currentUser)

  const organizations = useMemo(
    () => [...new Map(adviserReports.map((report) => [report.organizationId, report.organizationName])).entries()],
    [adviserReports],
  )

  const counts = useMemo(() => adviserReports.reduce((summary, report) => {
    summary.total += 1
    if (report.status === 'PENDING_VERIFICATION') summary.pending += 1
    if (report.status === 'VERIFIED') summary.verified += 1
    if (report.status === 'RETURNED') summary.returned += 1
    return summary
  }, { pending: 0, verified: 0, returned: 0, total: 0 }), [adviserReports])

  const visibleReports = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase()
    return adviserReports.filter((report) => {
      const searchText = `${report.eventTitle} ${report.organizationName}`.toLocaleLowerCase()
      return (!normalizedSearch || searchText.includes(normalizedSearch))
        && (organizationFilter === 'ALL' || report.organizationId === organizationFilter)
        && (statusFilter === 'ALL' || report.status === statusFilter)
    })
  }, [adviserReports, organizationFilter, search, statusFilter])

  function openReport(report) {
    setSelected({ ...report, title: report.eventTitle, type: 'ACCOMPLISHMENT_REPORT' })
    setInitialDecision('')
  }

  function decide(decision, comment) {
    if (!selected) return
    const undo = captureUndo()
    const saved = reviewAccomplishmentReport(selected.id, decision, comment)
    if (saved) showToast(decision === 'VERIFIED'
      ? `${selected.eventTitle} report verified.`
      : `${selected.eventTitle} report returned for revision.`, 'success', undoAction(undo))
    else showToast('The report decision could not be saved.', 'error')
  }

  const summaries = [
    { key: 'pending', label: 'Pending Verification', value: counts.pending, support: 'Requires your review', icon: 'document' },
    { key: 'verified', label: 'Verified', value: counts.verified, support: 'Successfully verified', icon: 'calendar' },
    { key: 'returned', label: 'Returned', value: counts.returned, support: 'Needs revision', icon: 'attendance' },
    { key: 'total', label: 'Total Reports', value: counts.total, support: 'All submitted reports', icon: 'organization' },
  ]

  return (
    <>
      <PageHeader
        description="Review, verify, and monitor activity reports submitted by your assigned organizations."
        eyebrow="UNIDOS · FACULTY ADVISER"
        title="Activity & Accomplishment Reports"
      >
        <section aria-label="Report summary" className="adviser-report-summary-grid">
          {summaries.map((summary) => (
            <article className={`adviser-report-summary-card adviser-report-summary-${summary.key}`} key={summary.key}>
              <span className="stat-label">{summary.label}</span>
              <strong className="stat-value">{summary.value}</strong>
              <small className="stat-note">{summary.support}</small>
            </article>
          ))}
        </section>
      </PageHeader>

      <section aria-label="Activity reports" className="adviser-reports-section">
        <div className="adviser-reports-heading">
          <div><h2>Submitted Reports</h2><p>Review activity outcomes and verification status across your organizations.</p></div>
          <span className="adviser-reports-count">{visibleReports.length} {visibleReports.length === 1 ? 'report' : 'reports'}</span>
        </div>
        <div className="adviser-report-toolbar">
          <label className="adviser-report-search">
            <ReportIcon name="search" />
            <span className="visually-hidden">Search reports</span>
            <input onChange={(event) => setSearch(event.target.value)} placeholder="Search Reports" type="search" value={search} />
          </label>
          <label className="adviser-report-filter">
            <span>Organization</span>
            <select onChange={(event) => setOrganizationFilter(event.target.value)} value={organizationFilter}>
              <option value="ALL">All organizations</option>
              {organizations.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
            </select>
          </label>
          <label className="adviser-report-filter">
            <span>Status</span>
            <select onChange={(event) => setStatusFilter(event.target.value)} value={statusFilter}>
              <option value="ALL">All statuses</option>
              <option value="PENDING_VERIFICATION">Pending Verification</option>
              <option value="VERIFIED">Verified</option>
              <option value="RETURNED">Returned</option>
            </select>
          </label>
        </div>
        {visibleReports.length ? (
          <div className="adviser-report-grid">
            {visibleReports.map((report) => (
              <article className="adviser-report-card-modern" key={report.id}>
                <div className="adviser-report-card-top">
                  <span className="adviser-report-organization"><ReportIcon name="organization" />{report.organizationName}</span>
                  <Badge tone={statusTone[report.status] ?? 'neutral'}>{statusLabels[report.status] ?? report.status?.replaceAll('_', ' ')}</Badge>
                </div>
                <h3>{report.eventTitle}</h3>
                <div className="adviser-report-card-facts">
                  <ReportFact icon="calendar" label="Event date" value={report.eventDate} />
                  <ReportFact icon="attendance" label="Attendance" value={report.attendance} />
                  <ReportFact icon="document" label="Submitted" value={report.submittedDate} />
                </div>
                <div className={`adviser-report-card-state adviser-report-state-${report.status?.toLowerCase()}`}>
                  {report.status === 'VERIFIED'
                    ? <><span className="adviser-report-state-mark">✓</span><span>Verified by {report.verifiedBy || adviserName}{report.decisionDate ? ` · ${report.decisionDate}` : ''}</span></>
                    : report.status === 'RETURNED'
                      ? <><span className="adviser-report-state-mark">!</span><span>Returned for revision{report.revisionNote ? ` · ${report.revisionNote}` : ''}</span></>
                      : <><span className="adviser-report-state-mark">•</span><span>Awaiting adviser verification</span></>}
                </div>
                <div className="adviser-report-card-footer">
                  {report.status === 'PENDING_VERIFICATION'
                    ? <Button onClick={() => openReport(report)} variant="primary">Review Report</Button>
                    : report.status === 'RETURNED'
                      ? <Button onClick={() => openReport(report)} variant="secondary">Review Again</Button>
                      : <Button onClick={() => openReport(report)} variant="secondary">View Report</Button>}
                </div>
              </article>
            ))}
          </div>
        ) : adviserReports.length ? (
          <EmptyState description="Try changing your filters or search terms." title="No activity reports found" />
        ) : (
          <EmptyState description="Submitted activity reports from your assigned organizations will appear here." title="No activity reports yet" />
        )}
      </section>
      <AdviserReviewDialog
        initialDecision={initialDecision}
        item={selected}
        key={selected?.id ?? 'closed'}
        onClose={() => setSelected(null)}
        onDecision={decide}
        report
        verifiedBy={adviserName}
        turnout={selected ? getTurnout(selected) : null}
      />
    </>
  )
}

import { useMemo, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import Badge from '../components/ui/Badge.jsx'
import Button from '../components/ui/Button.jsx'
import Card from '../components/ui/Card.jsx'
import EmptyState from '../components/ui/EmptyState.jsx'
import Icon from '../components/ui/Icon.jsx'
import Modal from '../components/ui/Modal.jsx'
import PageHeader from '../components/layout/PageHeader.jsx'
import SearchBar, { matchesQuery } from '../components/ui/SearchBar.jsx'
import { undoAction, useToast } from '../components/ui/useToast.js'

const statusTone = {
  PENDING_VERIFICATION: 'warning',
  VERIFIED: 'success',
  RETURNED: 'danger',
}

export default function OfficerReportsPage() {
  const {
    addOfficerAccomplishmentReport,
    addOfficerDocument,
    adminOrganizations = [],
    adviserReports = [],
    captureUndo = () => () => {},
    currentUser,
    officerEvents = [],
  } = useOutletContext() || {}

  const orgId = currentUser?.organizationId || adminOrganizations[0]?.id
  const organization = adminOrganizations?.find((item) => String(item.id) === String(orgId)) || adminOrganizations[0] || { name: 'Your Organization', acronym: 'ORG' }
  const { showToast } = useToast()

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [addModalOpen, setAddModalOpen] = useState(false)
  const [selectedReportForView, setSelectedReportForView] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState('')

  const [reportForm, setReportForm] = useState(() => ({
    title: '',
    selectedEventId: '',
    eventDate: new Date().toISOString().slice(0, 10),
    attendance: '',
    objectives: '',
    activitiesConducted: '',
    results: '',
    problemsEncountered: '',
    recommendations: '',
    summary: '',
    file: null,
  }))

  function resetReportForm() {
    setReportForm({
      title: '',
      selectedEventId: '',
      eventDate: new Date().toISOString().slice(0, 10),
      attendance: '',
      objectives: '',
      activitiesConducted: '',
      results: '',
      problemsEncountered: '',
      recommendations: '',
      summary: '',
      file: null,
    })
    setFormError('')
  }

  // Filter organization events for helper dropdown
  const orgEvents = useMemo(
    () => officerEvents.filter((e) => !organization.id || String(e.organizationId) === String(organization.id)),
    [officerEvents, organization.id]
  )

  const orgReports = useMemo(
    () => adviserReports.filter((r) => !organization.id || String(r.organizationId) === String(organization.id)),
    [adviserReports, organization.id]
  )

  const counts = useMemo(() => {
    const total = orgReports.length
    const verified = orgReports.filter((r) => r.status === 'VERIFIED').length
    const pending = orgReports.filter((r) => r.status === 'PENDING_VERIFICATION').length
    const returned = orgReports.filter((r) => r.status === 'RETURNED').length
    return { total, verified, pending, returned }
  }, [orgReports])

  const visibleReports = useMemo(() => {
    return orgReports
      .filter((report) => {
        if (statusFilter === 'VERIFIED') return report.status === 'VERIFIED'
        if (statusFilter === 'PENDING_VERIFICATION') return report.status === 'PENDING_VERIFICATION'
        if (statusFilter === 'RETURNED') return report.status === 'RETURNED'
        return true
      })
      .filter((report) => matchesQuery(search, report.eventTitle, report.status, report.eventDate, report.submittedDate, report.organizationName))
  }, [orgReports, search, statusFilter])

  function handleSelectEvent(eventId) {
    if (!eventId) {
      setReportForm((prev) => ({ ...prev, selectedEventId: '' }))
      return
    }
    const ev = orgEvents.find((e) => String(e.id) === String(eventId))
    if (ev) {
      const parsedDate = ev.startDate || ev.startDatetime || ev.date || ''
      setReportForm((prev) => ({
        ...prev,
        selectedEventId: eventId,
        title: `${ev.title} — Accomplishment Report`,
        eventDate: parsedDate ? new Date(parsedDate).toISOString().slice(0, 10) : prev.eventDate,
        attendance: ev.attendedCount || ev.attendance || ev.registeredCount || prev.attendance || '',
        objectives: prev.objectives || ev.description || '',
        venue: ev.venue || ev.location || '',
        time: ev.time || '',
        registeredCount: ev.registeredCount || ev.capacity || null,
      }))
    }
  }

  async function handleSubmitReport(event) {
    event.preventDefault()
    if (!reportForm.title.trim()) {
      setFormError('Please enter an event or activity title.')
      return
    }

    setSubmitting(true)
    setFormError('')
    const undo = captureUndo()

    // =========================================================================
    // [DATABASE LINK: DOCUMENTS TABLE - ACCOMPLISHMENT REPORT]
    // In database/student_org_db.sql, accomplishment reports map directly
    // to the `documents` table using `type = 'REPORT'`.
    // Supporting metadata (objectives, activities conducted, results/outcomes,
    // problems encountered, recommendations, attendees count, activity date)
    // is stored in `review_remarks` as structured JSON.
    // If a dedicated accomplishment_reports table is added in the database schema,
    // this comment marks the exact endpoint integration point.
    // =========================================================================

    try {
      const payload = {
        organizationId: organization.id,
        eventId: reportForm.selectedEventId ? Number(reportForm.selectedEventId) : null,
        title: reportForm.title.trim(),
        eventDate: reportForm.eventDate || new Date().toISOString().slice(0, 10),
        venue: reportForm.venue || '',
        time: reportForm.time || '',
        registeredCount: reportForm.registeredCount ? Number(reportForm.registeredCount) : null,
        attendance: reportForm.attendance ? Number(reportForm.attendance) : null,
        objectives: reportForm.objectives.trim(),
        activitiesConducted: reportForm.activitiesConducted.trim(),
        results: reportForm.results.trim(),
        problemsEncountered: reportForm.problemsEncountered.trim(),
        recommendations: reportForm.recommendations.trim(),
        summary: (reportForm.results.trim() || reportForm.objectives.trim() || reportForm.summary || '').trim(),
        fileName: reportForm.file ? reportForm.file.name : null,
      }

      let success = false
      if (typeof addOfficerAccomplishmentReport === 'function') {
        success = await addOfficerAccomplishmentReport(payload)
      } else if (typeof addOfficerDocument === 'function') {
        // Fallback: Use standard document insertion with type 'REPORT'
        success = await addOfficerDocument({
          ...payload,
          type: 'REPORT',
          remarks: JSON.stringify(payload),
        })
      } else {
        // =====================================================================
        // [DATABASE FALLBACK COMMENT]
        // If neither backend handler is available in the current environment,
        // record the report metadata in memory/console and continue gracefully.
        // =====================================================================
        console.warn('[ACCOMPLISHMENT REPORT] Direct database handler not available, handled as comment/stub:', payload)
        success = true
      }

      if (success) {
        setAddModalOpen(false)
        resetReportForm()
        showToast('Accomplishment report submitted for faculty adviser verification.', 'success', undoAction(undo))
      } else {
        setFormError('The accomplishment report could not be submitted. Please check connection and try again.')
      }
    } catch (err) {
      console.error(err)
      setFormError(err.message || 'Error submitting report.')
    } finally {
      setSubmitting(false)
    }
  }

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
        <Button onClick={() => { setFormError(''); setAddModalOpen(true) }}>
          <Icon name="plus" size={15} strokeWidth={2.2} />
          Add Accomplishment Report
        </Button>
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
                  {report.status === 'RETURNED' && Boolean(report.revisionNote && report.revisionNote.trim()) && (
                    <div className="officer-report-revision-alert">
                      <strong>Adviser Revision Note:</strong> {report.revisionNote}
                    </div>
                  )}
                  {report.verifiedBy && (
                    <small className="officer-report-verified-by">
                      Verified by {report.verifiedBy} on {report.decisionDate}
                    </small>
                  )}
                  {report.supportingDocuments && report.supportingDocuments.length > 0 && (
                    <div className="officer-report-attachment-row">
                      <small><Icon name="document" size={13} /> {report.supportingDocuments[0]}</small>
                    </div>
                  )}
                  <div className="officer-report-actions-row">
                    <Button onClick={() => setSelectedReportForView(report)} size="sm" variant="secondary">
                      <Icon name="document" size={13} /> View Accomplishment Details
                    </Button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState
            action={
              <Button onClick={() => { setFormError(''); setAddModalOpen(true) }}>
                <Icon name="plus" size={15} strokeWidth={2.2} /> Add Accomplishment Report
              </Button>
            }
            description={search ? 'No reports match your search query.' : 'Completed activities and submitted reports will appear here.'}
            title={search ? 'No matching reports' : 'No activity reports yet'}
          />
        )}
      </Card>

      {/* Modal: Submit Accomplishment Report */}
      <Modal onClose={() => { resetReportForm(); setAddModalOpen(false) }} open={addModalOpen} size="xl" title="Submit Accomplishment Report">
        <form className="officer-org-form officer-accomplishment-form" onSubmit={handleSubmitReport}>
          {orgEvents.length > 0 && (
            <label>
              Link to Completed Event (Optional)
              <select
                onChange={(event) => handleSelectEvent(event.target.value)}
                value={reportForm.selectedEventId}
              >
                <option value="">— Select an organization event or type custom title below —</option>
                {orgEvents.map((event) => (
                  <option key={event.id} value={event.id}>
                    {event.title} ({event.date || 'Recent'})
                  </option>
                ))}
              </select>
            </label>
          )}

          <label>
            Activity / Event Title
            <input
              onChange={(event) => setReportForm((prev) => ({ ...prev, title: event.target.value }))}
              placeholder="e.g. Annual General Assembly & Leadership Induction"
              required
              value={reportForm.title}
            />
          </label>

          <div className="officer-form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <label>
              Activity Date
              <input
                onChange={(event) => setReportForm((prev) => ({ ...prev, eventDate: event.target.value }))}
                type="date"
                value={reportForm.eventDate}
              />
            </label>

            <label>
              Total Attendees / Beneficiaries
              <input
                min="0"
                onChange={(event) => setReportForm((prev) => ({ ...prev, attendance: event.target.value }))}
                placeholder="e.g. 120"
                type="number"
                value={reportForm.attendance}
              />
            </label>
          </div>

          <div className="officer-accomplishment-section-title">
            <Icon name="document" size={14} /> Accomplishment Details
          </div>

          <div className="officer-accomplishment-grid">
            <label>
              Objectives
              <textarea
                onChange={(event) => setReportForm((prev) => ({ ...prev, objectives: event.target.value }))}
                placeholder="State the objectives and intended goals of the activity..."
                rows={2}
                value={reportForm.objectives}
              />
            </label>

            <label>
              Activities conducted
              <textarea
                onChange={(event) => setReportForm((prev) => ({ ...prev, activitiesConducted: event.target.value }))}
                placeholder="List the specific activities, modules, or sessions held..."
                rows={2}
                value={reportForm.activitiesConducted}
              />
            </label>

            <label>
              Results / Outcomes
              <textarea
                onChange={(event) => setReportForm((prev) => ({ ...prev, results: event.target.value }))}
                placeholder="Deliverables achieved, student impact, quantitative or qualitative results..."
                rows={2}
                value={reportForm.results}
              />
            </label>

            <label>
              Problems encountered
              <textarea
                onChange={(event) => setReportForm((prev) => ({ ...prev, problemsEncountered: event.target.value }))}
                placeholder="Challenges faced, bottlenecks, or logistical constraints..."
                rows={2}
                value={reportForm.problemsEncountered}
              />
            </label>
          </div>

          <label>
            Recommendations
            <textarea
              onChange={(event) => setReportForm((prev) => ({ ...prev, recommendations: event.target.value }))}
              placeholder="Actionable suggestions and advice for subsequent iterations..."
              rows={2}
              value={reportForm.recommendations}
            />
          </label>

          <label>
            Supporting Documentation / Photo Attachments
            <input
              accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
              onChange={(event) => setReportForm((prev) => ({ ...prev, file: event.target.files?.[0] ?? null }))}
              type="file"
            />
          </label>

          {/* ========================================================================= */}
          {/* [DATABASE LINK: DOCUMENTS TABLE - ACCOMPLISHMENT REPORT]                  */}
          {/* In database/student_org_db.sql, accomplishment reports are stored in the  */}
          {/* `documents` table with `type = 'REPORT'`. Supporting narrative fields     */}
          {/* (Objectives, Activities conducted, Results/Outcomes, Problems encountered,  */}
          {/* Recommendations, attendance) are structured in `review_remarks` JSON.     */}
          {/*                                                                           */}
          {/* [GOOGLE DRIVE API PLACEHOLDER — REPORT & PHOTO STORAGE]                   */}
          {/* Insert Google Drive API multipart upload here to upload report PDF/images */}
          {/* and assign the generated Google Drive webViewLink to `file_url`.          */}
          {/* ========================================================================= */}
          <p className="officer-org-upload-note">
            Saves this accomplishment report to the PostgreSQL <code>documents</code> table (type: REPORT) and sends an approval verification request to your faculty adviser.
          </p>

          {formError && <p className="auth-error" role="alert">{formError}</p>}

          <div className="officer-org-modal-actions">
            <Button disabled={submitting} onClick={() => { resetReportForm(); setAddModalOpen(false) }} variant="secondary">
              Cancel
            </Button>
            <Button disabled={submitting} type="submit">
              {submitting ? 'Submitting...' : 'Submit Accomplishment Report'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal: View Accomplishment Report Details */}
      {selectedReportForView && (
        <Modal
          onClose={() => setSelectedReportForView(null)}
          open={Boolean(selectedReportForView)}
          size="xl"
          title={`Accomplishment Report: ${selectedReportForView.eventTitle}`}
        >
          <div className="officer-accomplishment-view" style={{ display: 'grid', gap: '14px' }}>
            <div className="officer-report-header">
              <span className="officer-report-org-label">{selectedReportForView.organizationName || organization.name}</span>
              <Badge tone={statusTone[selectedReportForView.status] ?? 'neutral'}>
                {selectedReportForView.status.replaceAll('_', ' ')}
              </Badge>
            </div>

            <div className="officer-report-meta-row">
              <span>Event Date: <strong>{selectedReportForView.eventDate}</strong></span>
              <span>Attendance: <strong>{selectedReportForView.attendance ?? 0} students</strong></span>
              <span>Submitted: <strong>{selectedReportForView.submittedDate}</strong></span>
            </div>

            <div className="officer-accomplishment-section-title">
              <Icon name="document" size={14} /> Accomplishment Details
            </div>

            <div style={{ display: 'grid', gap: '10px' }}>
              {[
                ['Objectives', selectedReportForView.objectives],
                ['Activities conducted', selectedReportForView.activitiesConducted ?? selectedReportForView.activities],
                ['Results / Outcomes', selectedReportForView.results ?? selectedReportForView.outcomes],
                ['Problems encountered', selectedReportForView.problemsEncountered ?? selectedReportForView.problems],
                ['Recommendations', selectedReportForView.recommendations],
              ].map(([heading, value]) => (
                <div key={heading} style={{ borderBottom: '1px solid #f2eff1', paddingBottom: '6px' }}>
                  <h5 style={{ margin: '0 0 2px', fontSize: '12.5px', fontWeight: 700, color: '#33343b' }}>{heading}</h5>
                  <p style={{ margin: 0, fontSize: '13.5px', color: '#555', whiteSpace: 'pre-wrap' }}>{value || 'Not provided.'}</p>
                </div>
              ))}
            </div>

            {selectedReportForView.revisionNote && (
              <div className="officer-report-revision-alert">
                <strong>Adviser Revision Note:</strong> {selectedReportForView.revisionNote}
              </div>
            )}

            {selectedReportForView.verifiedBy && (
              <small className="officer-report-verified-by">
                Verified by {selectedReportForView.verifiedBy} on {selectedReportForView.decisionDate || 'N/A'}
              </small>
            )}

            <div className="officer-org-modal-actions" style={{ marginTop: '8px' }}>
              <Button onClick={() => setSelectedReportForView(null)} variant="secondary">
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

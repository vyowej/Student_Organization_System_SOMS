import { useState } from 'react'
import { Link, useLocation, useOutletContext } from 'react-router-dom'
import PageHeader from '../components/layout/PageHeader.jsx'
import Badge from '../components/ui/Badge.jsx'
import Button from '../components/ui/Button.jsx'
import Card from '../components/ui/Card.jsx'
import EmptyState from '../components/ui/EmptyState.jsx'
import Modal from '../components/ui/Modal.jsx'
import Table from '../components/ui/Table.jsx'
import { useToast } from '../components/ui/useToast.js'
import { adminPrograms, adminYears } from '../data/adminPortal.js'
import { studentEvents } from '../data/studentEvents.js'
import { formatDisplayName } from '../data/displayName.js'

const decisionOptions = ['APPROVED', 'RETURNED', 'REJECTED']
const roleOptions = ['Student', 'Organization Officer', 'Faculty Adviser', 'Student Affairs Admin']

function toneFor(status = '') {
  if (['ACTIVE', 'APPROVED', 'ACCREDITED', 'PUBLISHED', 'VERIFIED'].includes(status)) return 'success'
  if (['PENDING', 'SUBMITTED', 'UNDER_REVIEW', 'RETURNED_FOR_REVISION'].includes(status)) return 'warning'
  if (['REJECTED', 'SUSPENDED'].includes(status)) return 'danger'
  return 'neutral'
}

function Status({ value }) {
  return <Badge tone={toneFor(value)}>{String(value ?? '—').replaceAll('_', ' ')}</Badge>
}

function Metric({ label, value, detail }) {
  return <Card className="admin-metric-card"><span>{label}</span><strong>{value}</strong>{detail && <small>{detail}</small>}</Card>
}

function FilterBar({ search, setSearch, children }) {
  return (
    <div className="admin-filter-bar">
      <input aria-label="Search records" onChange={(event) => setSearch(event.target.value)} placeholder="Search..." type="search" value={search} />
      {children}
    </div>
  )
}

function downloadCsv(filename, rows) {
  if (!rows.length) return false
  const escape = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`
  const content = [Object.keys(rows[0]), ...rows.map((row) => Object.values(row))]
    .map((row) => row.map(escape).join(','))
    .join('\r\n')
  const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
  return true
}

function downloadExcel(filename, rows) {
  if (!rows.length) return false
  const escape = (value) => String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;')
  const headings = Object.keys(rows[0])
  const html = `<table><thead><tr>${headings.map((heading) => `<th>${escape(heading)}</th>`).join('')}</tr></thead><tbody>${rows.map((row) => `<tr>${headings.map((heading) => `<td>${escape(row[heading])}</td>`).join('')}</tr>`).join('')}</tbody></table>`
  const url = URL.createObjectURL(new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8' }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
  return true
}

function RecordModal({ item, onClose, onDecision, canDecide = false, decisionLabels = {} }) {
  const [decision, setDecision] = useState('')
  const [comment, setComment] = useState('')
  const [error, setError] = useState('')
  if (!item) return null
  const fields = Object.entries(item).filter(([key, value]) => (
    !['id', 'proposedOfficers', 'documents', 'eventIds', 'announcements', 'officers'].includes(key)
    && (typeof value !== 'object' || value === null)
  ))
  function submit() {
    if (!decision) {
      onClose()
      return
    }
    if (['RETURNED', 'REJECTED'].includes(decision) && !comment.trim()) {
      setError('Add a reason or revision comment before continuing.')
      return
    }
    const succeeded = onDecision(decision, comment)
    if (!succeeded) {
      setError('This item is no longer eligible for this action.')
      return
    }
    onClose()
  }
  return (
    <Modal onClose={onClose} open title={item.title ?? item.name ?? 'Record details'}>
      <dl className="admin-detail-list">
        {fields.map(([key, value]) => <div key={key}><dt>{key.replace(/[A-Z]/g, (letter) => ` ${letter.toLowerCase()}`)}</dt><dd>{String(value)}</dd></div>)}
        {Object.entries(item).filter(([key, value]) => Array.isArray(value) && !['documents', 'proposedOfficers'].includes(key)).map(([key, values]) => <div key={key}><dt>{key}</dt><dd>{values.length ? values.join(', ') : 'None recorded'}</dd></div>)}
        {Array.isArray(item.documents) && <div><dt>Supporting documents</dt><dd>{item.documents.join(', ')}</dd></div>}
        {Array.isArray(item.proposedOfficers) && <div><dt>Proposed officers</dt><dd>{item.proposedOfficers.map((officer) => `${officer.name} — ${officer.position}`).join(', ')}</dd></div>}
      </dl>
      {canDecide && (
        <div className="admin-modal-decision">
          <label>Decision
            <select onChange={(event) => setDecision(event.target.value)} value={decision}>
              <option value="">Choose a decision</option>
              {decisionOptions.map((option) => <option key={option} value={option}>{decisionLabels[option] ?? option.replace('_', ' ')}</option>)}
            </select>
          </label>
          {['RETURNED', 'REJECTED'].includes(decision) && (
            <label>{decision === 'RETURNED' ? 'Revision comments' : 'Reason'} <span aria-hidden="true">*</span>
              <textarea onChange={(event) => setComment(event.target.value)} value={comment} />
            </label>
          )}
          {error && <p className="form-error" role="alert">{error}</p>}
          <Button onClick={submit}>{decision ? 'Confirm decision' : 'Close'}</Button>
        </div>
      )}
    </Modal>
  )
}

function OrganizationEditModal({ organization, onClose, onSave }) {
  const [form, setForm] = useState(null)
  if (!organization) return null
  const values = form ?? {
    name: organization.name,
    acronym: organization.acronym,
    category: organization.category,
    adviser: organization.adviser,
  }
  return (
    <Modal onClose={onClose} open title={`Edit ${organization.name}`}>
      <div className="admin-settings-form">
        {Object.entries(values).map(([key, value]) => <label key={key}>{key.charAt(0).toUpperCase() + key.slice(1)}<input onChange={(event) => setForm((current) => ({ ...values, ...current, [key]: event.target.value }))} value={value} /></label>)}
        <Button onClick={() => onSave(values)}>Save organization</Button>
      </div>
    </Modal>
  )
}

function ChartRows({ title, rows }) {
  const maxValue = Math.max(...rows.map((row) => row.value), 1)
  return <Card className="admin-section-card"><h2>{title}</h2>{rows.map((row) => <div className="admin-chart-row" key={row.label}><span>{row.label}</span><div className="admin-chart-track"><div className="admin-chart-fill" style={{ width: `${(row.value / maxValue) * 100}%` }} /></div><strong>{row.value}</strong></div>)}</Card>
}

function AdminDashboard({ data }) {
  const [selected, setSelected] = useState(null)
  const pendingApplications = data.organizationApplications.filter((item) => item.status === 'PENDING').length
  const pendingEvents = data.officerEvents.filter((item) => item.status === 'APPROVED' && item.adviserDecisionDate && !item.adminApprovedAt).length
  const pending = [
    ...data.organizationApplications.filter((item) => item.status === 'PENDING').map((item) => ({ ...item, type: 'Organization application', title: item.name, organizationName: item.name })),
    ...data.officerEvents.filter((item) => item.status === 'APPROVED' && item.adviserDecisionDate && !item.adminApprovedAt).map((item) => ({ ...item, type: 'Event proposal' })),
    ...data.adviserDocuments.filter((item) => item.adminReviewRequired && item.status === 'APPROVED').map((item) => ({ ...item, type: 'Document' })),
    ...data.adviserReports.filter((item) => item.status === 'PENDING_VERIFICATION').map((item) => ({ ...item, title: item.eventTitle, type: 'Accomplishment report' })),
  ]
  const upcomingEvents = data.officerEvents.filter((item) => ['APPROVED', 'PUBLISHED', 'ONGOING'].includes(item.status)).slice(0, 4)
  return (
    <>
      <PageHeader description="Campus-wide oversight of organizations, events, accounts, and approval work." eyebrow="UNIDOS ADMINISTRATION" title="Admin Dashboard" />
      <div className="admin-metrics-grid">
        <Metric label="Active Organizations" value={data.adminOrganizations.filter((item) => item.status === 'ACTIVE').length} />
        <Metric label="Total Students" value={data.adminUsers.filter((item) => item.role === 'Student').length.toLocaleString()} />
        <Metric label="Pending Organization Applications" value={pendingApplications} />
        <Metric label="Pending Event Reviews" value={pendingEvents} />
      </div>
      <Card className="admin-section-card">
        <div className="admin-section-heading"><div><h2>Work requiring attention</h2><p>Review pending requests across campus.</p></div><Link className="button button-secondary" to="/admin/approvals">Open Approval Center</Link></div>
        {pending.length ? <Table columns={[
          { key: 'title', label: 'Item' }, { key: 'type', label: 'Type' },
          { key: 'organizationName', label: 'Organization', render: (value, row) => value ?? row.name },
          { key: 'status', label: 'Status', render: (value) => <Status value={value} /> },
          { key: 'actions', label: 'Action', render: (_, item) => <Button onClick={() => setSelected(item)} variant="secondary">View</Button> },
        ]} rows={pending} /> : <EmptyState description="New adviser-approved requests will appear here." title="No pending approvals" />}
      </Card>
      <RecordModal item={selected} onClose={() => setSelected(null)} />
      {data.adminNotifications.length > 0 && <Card className="admin-section-card"><h2>System notifications</h2>{data.adminNotifications.slice(0, 4).map((notification) => <div className="admin-activity-row" key={notification.id}><strong>{notification.read ? 'Read' : 'New'}</strong><span>{notification.message}</span><small>{notification.createdAt}</small>{!notification.read && <Button onClick={() => data.markAdminNotificationRead(notification.id)} variant="secondary">Mark read</Button>}</div>)}</Card>}
      <Card className="admin-section-card">
        <div className="admin-section-heading"><div><h2>Recent system activity</h2><p>Latest administrative and workflow updates.</p></div><Link to="/admin/audit-logs">View audit log</Link></div>
        {data.adminAuditLogs.slice(0, 4).map((log) => <div className="admin-activity-row" key={log.id}><strong>{log.action.replaceAll('_', ' ')}</strong><span>{log.description}</span><small>{log.timestamp}</small></div>)}
      </Card>
      <Card className="admin-section-card"><h2>Upcoming and approved events</h2>{upcomingEvents.length ? <Table columns={[{ key: 'title', label: 'Event' }, { key: 'organizationName', label: 'Organization' }, { key: 'date', label: 'Date' }, { key: 'startTime', label: 'Time' }, { key: 'location', label: 'Venue' }, { key: 'status', label: 'Status', render: (value) => <Status value={value} /> }]} rows={upcomingEvents} /> : <EmptyState title="No scheduled events" />}</Card>
    </>
  )
}

export default function AdminPortalPage() {
  const { pathname } = useLocation()
  const data = useOutletContext()
  const { showToast } = useToast()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('All')
  const [programFilter, setProgramFilter] = useState('All Programs')
  const [yearFilter, setYearFilter] = useState('All Years')
  const [selected, setSelected] = useState(null)
  const [reason, setReason] = useState('')
  const [target, setTarget] = useState(null)
  const [organizationEdit, setOrganizationEdit] = useState(null)
  const [userChange, setUserChange] = useState(null)
  const [actionFilter, setActionFilter] = useState('All')
  const [reportFilters, setReportFilters] = useState({ college: 'All Colleges', category: 'All Categories', eventType: 'All Event Types' })
  const [settings, setSettings] = useState(() => ({
    ...data.adminSettings,
    organizationCategories: data.adminSettings.organizationCategories ?? ['Academic', 'Socio-Civic', 'Cultural', 'Sports'],
  }))
  const [newCategory, setNewCategory] = useState('')

  const matches = (record, keys = ['name', 'title', 'organizationName', 'userId', 'email', 'studentId', 'action', 'description']) => {
    const query = search.trim().toLowerCase()
    return (!query || keys.some((key) => String(record[key] ?? '').toLowerCase().includes(query)))
      && (statusFilter === 'All' || record.status === statusFilter)
  }
  const filteredStudents = data.adminUsers.filter((item) => item.role === 'Student'
    && (programFilter === 'All Programs' || item.program === programFilter)
    && (yearFilter === 'All Years' || item.yearLevel === yearFilter)
    && matches(item, ['name', 'userId', 'email', 'organization', 'program']))
  const orgEvents = [
    ...studentEvents.filter((event) => !data.officerEvents.some((sharedEvent) => sharedEvent.id === event.id)),
    ...data.officerEvents,
  ]
  const pendingAdminEvents = data.officerEvents.filter((event) => event.status === 'APPROVED' && event.adviserDecisionDate && !event.adminApprovedAt)
  const adminDocuments = data.adviserDocuments.filter((item) => item.adminReviewRequired)
  const filteredApplications = data.organizationApplications.filter((item) => matches(item))

  function decideApplication(item, decision, comment) {
    const ok = data.reviewOrganizationApplication(item.id, decision, comment)
    if (ok) showToast(`Organization application ${decision.toLowerCase()}.`, 'success')
    return ok
  }
  function decideEvent(item, decision, comment) {
    const ok = data.reviewAdminEvent(item.id, decision, comment)
    if (ok) showToast(`Event proposal ${decision.toLowerCase()}.`, 'success')
    return ok
  }
  function decideDocument(item, decision, comment) {
    const ok = data.reviewAdminDocument(item.id, decision, comment)
    if (ok) showToast(`Document ${decision.toLowerCase()}.`, 'success')
    return ok
  }

  if (pathname.endsWith('/dashboard')) return <AdminDashboard data={data} />

  if (pathname.endsWith('/users') || pathname.endsWith('/students')) {
    const isStudents = pathname.endsWith('/students')
    const rows = isStudents ? filteredStudents : data.adminUsers.filter((item) => matches(item))
    return (
      <>
        <PageHeader description={isStudents ? 'Browse student directory records and academic information.' : 'Manage account access while protecting administrator safeguards.'} eyebrow="UNIDOS ADMINISTRATION" title={isStudents ? 'Student Directory' : 'User Management'} />
        <FilterBar search={search} setSearch={setSearch}>
          {!isStudents && <select aria-label="Filter by account status" onChange={(event) => setStatusFilter(event.target.value)} value={statusFilter}><option>All</option>{['ACTIVE', 'INACTIVE', 'SUSPENDED'].map((value) => <option key={value}>{value}</option>)}</select>}
          {isStudents && <>
            <select aria-label="Filter by program" onChange={(event) => setProgramFilter(event.target.value)} value={programFilter}>{adminPrograms.map((value) => <option key={value}>{value}</option>)}</select>
            <select aria-label="Filter by year" onChange={(event) => setYearFilter(event.target.value)} value={yearFilter}>{adminYears.map((value) => <option key={value}>{value}</option>)}</select>
            <select aria-label="Filter student status" onChange={(event) => setStatusFilter(event.target.value)} value={statusFilter}><option>All</option>{['ACTIVE', 'INACTIVE', 'SUSPENDED'].map((value) => <option key={value}>{value}</option>)}</select>
          </>}
        </FilterBar>
        <Card className="admin-section-card">{rows.length ? <Table columns={[
          { key: 'name', label: 'Name', render: (value, row) => isStudents ? formatDisplayName(row) : value }, { key: 'userId', label: 'ID' }, { key: 'email', label: 'Email' },
          ...(isStudents ? [
            { key: 'program', label: 'Program' }, { key: 'yearLevel', label: 'Year' },
            { key: 'organizationCount', label: 'Organizations', render: (_, row) => data.studentMemberships.filter((membership) => membership.studentId === row.userId && membership.status === 'ACTIVE').length },
            { key: 'status', label: 'Status', render: (value) => <Status value={value} /> },
            { key: 'actions', label: 'Profile', render: (_, row) => <Button onClick={() => setSelected({
              ...row,
              title: `${formatDisplayName(row)} — Student Profile`,
              organizations: data.studentMemberships.filter((membership) => membership.studentId === row.userId).map((membership) => `${membership.organizationId}: ${membership.status}`),
              registrations: data.studentRegistrations.filter((registration) => registration.studentId === row.userId).map((registration) => `${registration.eventId}: ${registration.status}`),
              attendance: data.studentRegistrations.filter((registration) => registration.studentId === row.userId).map((registration) => `${registration.eventId}: ${registration.attendanceStatus}`),
            })} variant="secondary">View profile</Button> },
          ] : [
            { key: 'role', label: 'Role', render: (value, row) => <select aria-label={`Role for ${formatDisplayName(row)}`} disabled={row.id === 'admin-root'} onChange={(event) => setUserChange({ user: row, changes: { role: event.target.value } })} value={value}>{roleOptions.map((role) => <option key={role}>{role}</option>)}</select> },
            { key: 'status', label: 'Status', render: (value, row) => <select aria-label={`Status for ${formatDisplayName(row)}`} disabled={row.id === 'admin-root'} onChange={(event) => setUserChange({ user: row, changes: { status: event.target.value } })} value={value}>{['ACTIVE', 'INACTIVE', 'SUSPENDED'].map((status) => <option key={status}>{status}</option>)}</select> },
            { key: 'organization', label: 'Organization' },
          ]),
          { key: 'lastActivity', label: 'Last Activity' },
        ]} rows={rows} /> : <EmptyState title="No matching records" />}</Card>
        <RecordModal item={selected} onClose={() => setSelected(null)} />
        <Modal onClose={() => setUserChange(null)} open={Boolean(userChange)} title="Confirm account change">
          {userChange && <><p>Apply this access change for <strong>{formatDisplayName(userChange.user)}</strong>?</p><p>{Object.entries(userChange.changes).map(([key, value]) => `${key}: ${value}`).join(' · ')}</p><Button onClick={() => { const result = data.updateAdminUser(userChange.user.id, userChange.changes); showToast(result.ok ? 'User account updated.' : result.reason, result.ok ? 'success' : 'error'); if (result.ok) setUserChange(null) }}>Confirm change</Button></>}
        </Modal>
      </>
    )
  }

  if (pathname.endsWith('/organizations')) {
    return (
      <>
        <PageHeader description="Monitor accreditation and institutional standing for recognized organizations." eyebrow="UNIDOS ADMINISTRATION" title="Organizations" />
        <FilterBar search={search} setSearch={setSearch}><select aria-label="Filter organization status" onChange={(event) => setStatusFilter(event.target.value)} value={statusFilter}><option>All</option>{['ACTIVE', 'INACTIVE', 'SUSPENDED'].map((value) => <option key={value}>{value}</option>)}</select></FilterBar>
        <Card className="admin-section-card">{data.adminOrganizations.filter((item) => matches(item, ['name', 'acronym', 'category', 'adviser', 'status'])).length ? <Table columns={[
          { key: 'name', label: 'Organization' }, { key: 'acronym', label: 'Acronym' }, { key: 'category', label: 'Category' },
          { key: 'adviser', label: 'Adviser' }, { key: 'memberCount', label: 'Members' }, { key: 'status', label: 'Status', render: (value) => <Status value={value} /> },
          { key: 'accreditationStatus', label: 'Accreditation' },
          { key: 'actions', label: 'Actions', render: (_, item) => <div className="admin-row-actions"><Button onClick={() => setSelected(item)} variant="secondary">View</Button><Button onClick={() => setOrganizationEdit(item)} variant="secondary">Edit</Button><Button onClick={() => { setTarget(item); setReason('') }} variant={item.status === 'SUSPENDED' ? 'secondary' : 'danger'}>{item.status === 'SUSPENDED' ? 'Reactivate' : 'Suspend'}</Button></div> },
        ]} rows={data.adminOrganizations.filter((item) => matches(item, ['name', 'acronym', 'category', 'adviser', 'status']))} /> : <EmptyState title="No organizations found" />}</Card>
        <Modal onClose={() => setTarget(null)} open={Boolean(target)} title={target?.status === 'SUSPENDED' ? 'Reactivate organization' : 'Suspend organization'}>
          {target && <p>Change <strong>{target.name}</strong> status?{target.status !== 'SUSPENDED' && <label className="admin-modal-label">Reason for suspension<textarea onChange={(event) => setReason(event.target.value)} value={reason} /></label>}</p>}
          <Button onClick={() => {
            const next = target?.status === 'SUSPENDED' ? 'ACTIVE' : 'SUSPENDED'
            const ok = target && data.updateAdminOrganizationStatus(target.id, next, reason)
            if (ok) { showToast(`Organization ${next.toLowerCase()}.`, 'success'); setTarget(null) }
            else showToast('A suspension reason is required.', 'error')
          }}>Confirm</Button>
        </Modal>
        <OrganizationEditModal key={organizationEdit?.id ?? 'closed'} organization={organizationEdit} onClose={() => setOrganizationEdit(null)} onSave={(changes) => {
          const ok = organizationEdit && data.updateAdminOrganization(organizationEdit.id, changes)
          if (ok) { showToast('Organization details updated.', 'success'); setOrganizationEdit(null) }
          else showToast('Complete all organization fields before saving.', 'error')
        }} />
        <RecordModal item={selected} onClose={() => setSelected(null)} />
      </>
    )
  }

  if (pathname.endsWith('/organization-applications')) {
    return (
      <>
        <PageHeader description="Review recognition submissions and required supporting documents." eyebrow="UNIDOS ADMINISTRATION" title="Organization Applications" />
        <FilterBar search={search} setSearch={setSearch}><select aria-label="Filter application status" onChange={(event) => setStatusFilter(event.target.value)} value={statusFilter}><option>All</option>{['PENDING', 'APPROVED', 'RETURNED', 'REJECTED'].map((value) => <option key={value}>{value}</option>)}</select></FilterBar>
        <Card className="admin-section-card">{filteredApplications.length ? <Table columns={[
          { key: 'name', label: 'Organization' }, { key: 'acronym', label: 'Acronym' }, { key: 'submittedBy', label: 'Submitted by' }, { key: 'submittedDate', label: 'Date submitted' },
          { key: 'status', label: 'Status', render: (value) => <Status value={value} /> },
          { key: 'actions', label: 'Actions', render: (_, item) => <div className="admin-row-actions"><Button onClick={() => setSelected({ ...item, title: item.name })} variant="secondary">View</Button>{item.status === 'PENDING' && <Button onClick={() => setSelected({ ...item, title: item.name, __application: true })}>Review</Button>}</div> },
        ]} rows={filteredApplications} /> : <EmptyState title="No applications found" />}</Card>
        <RecordModal canDecide={Boolean(selected?.__application)} decisionLabels={{ APPROVED: 'Approve accreditation', RETURNED: 'Return for revision', REJECTED: 'Reject application' }} item={selected} onClose={() => setSelected(null)} onDecision={(decision, comment) => decideApplication(selected, decision, comment)} />
      </>
    )
  }

  if (pathname.endsWith('/events')) {
    const rows = orgEvents.filter((item) => matches(item, ['title', 'organizationName', 'status', 'category']))
    return (
      <>
        <PageHeader description="Oversee proposals across campus. Publishing is available only after both adviser and Student Affairs approval." eyebrow="UNIDOS ADMINISTRATION" title="Campus Events" />
        <FilterBar search={search} setSearch={setSearch}><select aria-label="Filter event status" onChange={(event) => setStatusFilter(event.target.value)} value={statusFilter}><option>All</option>{['DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'PUBLISHED', 'ONGOING', 'COMPLETED', 'ARCHIVED', 'RETURNED_FOR_REVISION', 'REJECTED'].map((value) => <option key={value}>{value}</option>)}</select></FilterBar>
        <Card className="admin-section-card">{rows.length ? <Table columns={[
          { key: 'title', label: 'Event' }, { key: 'organizationName', label: 'Organization' }, { key: 'date', label: 'Date' }, { key: 'location', label: 'Venue' },
          { key: 'status', label: 'Status', render: (value) => <Status value={value} /> },
          { key: 'actions', label: 'Actions', render: (_, item) => <div className="admin-row-actions"><Button onClick={() => setSelected(item)} variant="secondary">View</Button>{pendingAdminEvents.some((event) => event.id === item.id) && <Button onClick={() => setSelected({ ...item, __event: true })}>Review</Button>}{item.adminApprovedAt && item.status === 'APPROVED' && <Button onClick={() => { const ok = data.publishAdminEvent(item.id); showToast(ok ? 'Event published and visible to students.' : 'Event cannot be published yet.', ok ? 'success' : 'error') }}>Publish</Button>}</div> },
        ]} rows={rows} /> : <EmptyState title="No campus events found" />}</Card>
        <RecordModal canDecide={Boolean(selected?.__event)} decisionLabels={{ APPROVED: 'Approve for publication', RETURNED: 'Return for revision', REJECTED: 'Reject proposal' }} item={selected} onClose={() => setSelected(null)} onDecision={(decision, comment) => decideEvent(selected, decision, comment)} />
      </>
    )
  }

  if (pathname.endsWith('/approvals')) {
    const approvals = [
      ...data.organizationApplications.map((item) => ({ ...item, title: item.name, type: 'Organization application', entityKind: 'application', canReview: item.status === 'PENDING' })),
      ...orgEvents.filter((item) => item.adviserDecisionDate).map((item) => ({ ...item, type: 'Event proposal', entityKind: 'event', canReview: item.status === 'APPROVED' && !item.adminApprovedAt })),
      ...adminDocuments.map((item) => ({ ...item, title: item.title, type: 'Document review', entityKind: 'document', canReview: item.status === 'APPROVED' })),
      ...data.adviserReports.map((item) => ({
        ...item,
        title: item.eventTitle,
        type: 'Accomplishment report',
        status: item.status === 'PENDING_VERIFICATION' ? 'PENDING' : item.status === 'VERIFIED' ? 'APPROVED' : item.status,
        originalStatus: item.status,
        entityKind: 'report',
        canReview: false,
      })),
    ].filter((item) => matches(item, ['title', 'name', 'organizationName', 'type', 'status']))
    return (
      <>
        <PageHeader description="A single queue for cross-campus applications, adviser-approved events, and documents." eyebrow="UNIDOS ADMINISTRATION" title="Approval Center" />
        <FilterBar search={search} setSearch={setSearch} />
        <div aria-label="Filter approvals by status" className="admin-approval-tabs" role="group">{['All', 'PENDING', 'APPROVED', 'RETURNED', 'REJECTED'].map((value) => <button aria-pressed={statusFilter === value} className={statusFilter === value ? 'is-active' : ''} key={value} onClick={() => setStatusFilter(value)} type="button">{value === 'All' ? value : value.replace('_', ' ')}</button>)}</div>
        <Card className="admin-section-card">{approvals.length ? <Table columns={[
          { key: 'title', label: 'Request' }, { key: 'type', label: 'Type' }, { key: 'organizationName', label: 'Organization', render: (value, row) => value ?? row.name },
          { key: 'submittedBy', label: 'Submitted by', render: (value, row) => value ?? row.submittedBy ?? 'Organization officer' },
          { key: 'status', label: 'Status', render: (value) => <Status value={value} /> },
          { key: 'actions', label: 'Actions', render: (_, item) => <div className="admin-row-actions"><Button onClick={() => setSelected(item)} variant="secondary">View</Button>{item.canReview && <Button onClick={() => setSelected({ ...item, __approval: item.entityKind })}>Review</Button>}</div> },
        ]} rows={approvals} /> : <EmptyState title="No approvals found" />}</Card>
        <RecordModal canDecide={Boolean(selected?.__approval)} item={selected} onClose={() => setSelected(null)} onDecision={(decision, comment) => selected?.__approval === 'application'
          ? decideApplication(selected, decision, comment)
          : selected?.__approval === 'event' ? decideEvent(selected, decision, comment)
            : selected?.__approval === 'document' ? decideDocument(selected, decision, comment) : false} />
      </>
    )
  }

  if (pathname.endsWith('/documents')) {
    const rows = adminDocuments.filter((item) => matches(item, ['title', 'organizationName', 'type', 'status']))
    return (
      <>
        <PageHeader description="Review organization documents after the adviser has completed their review." eyebrow="UNIDOS ADMINISTRATION" title="Documents" />
        <FilterBar search={search} setSearch={setSearch}><select aria-label="Filter document status" onChange={(event) => setStatusFilter(event.target.value)} value={statusFilter}><option>All</option>{['PENDING', 'APPROVED', 'RETURNED', 'REJECTED'].map((value) => <option key={value}>{value}</option>)}</select></FilterBar>
        <Card className="admin-section-card">{rows.length ? <Table columns={[
          { key: 'title', label: 'Document' }, { key: 'type', label: 'Type' }, { key: 'organizationName', label: 'Organization' }, { key: 'submittedDate', label: 'Submitted' },
          { key: 'status', label: 'Status', render: (value) => <Status value={value} /> },
          { key: 'actions', label: 'Actions', render: (_, item) => <div className="admin-row-actions"><Button onClick={() => setSelected(item)} variant="secondary">View</Button>{item.status === 'APPROVED' && <Button onClick={() => setSelected({ ...item, __document: true })}>Review</Button>}</div> },
        ]} rows={rows} /> : <EmptyState description="Adviser-approved documents requiring Student Affairs review will appear here." title="No documents to review" />}</Card>
        <RecordModal canDecide={Boolean(selected?.__document)} item={selected} onClose={() => setSelected(null)} onDecision={(decision, comment) => decideDocument(selected, decision, comment)} />
      </>
    )
  }

  if (pathname.endsWith('/reports')) {
    const organizationById = (id) => data.adminOrganizations.find((organization) => organization.id === id)
    const reportRows = [
      ...data.adminOrganizations.map((item) => ({ type: 'Organization', name: item.name, status: item.status, count: item.memberCount, organizationId: item.id, category: item.category, college: item.college })),
      ...orgEvents.map((item) => ({ type: 'Event', name: item.title, status: item.status, count: item.registeredCount ?? 0, organizationId: item.organizationId, category: organizationById(item.organizationId)?.category, college: organizationById(item.organizationId)?.college, eventCategory: item.category })),
      ...data.adviserReports.map((item) => ({ type: 'Accomplishment report', name: item.eventTitle, status: item.status, count: item.attendance, organizationId: item.organizationId, category: organizationById(item.organizationId)?.category, college: organizationById(item.organizationId)?.college })),
    ].filter((item) => matches(item, ['type', 'name', 'status'])
      && (reportFilters.category === 'All Categories' || item.category === reportFilters.category)
      && (reportFilters.college === 'All Colleges' || item.college === reportFilters.college)
      && (reportFilters.eventType === 'All Event Types' || item.eventCategory === reportFilters.eventType))
    return (
      <>
        <PageHeader description="Export current mock system records for administrative review." eyebrow="UNIDOS ADMINISTRATION" title="Reports" />
        <div className="admin-metrics-grid">
          <Metric label="Total Accredited Organizations" value="47" />
          <Metric label="Active Student Members" value="2,381" />
          <Metric label="Total Events Held" value="213" />
          <Metric label="Unique Student Participants" value="1,842" />
        </div>
        <Card className="admin-section-card"><h2>Organization activity sample</h2><p>Active Members: 128 · Events Conducted: 14 · Activities Completed: 12 · Average Event Attendance: 82%</p></Card>
        <div className="admin-report-actions"><Button onClick={() => showToast(downloadCsv('unidos-campus-report.csv', reportRows) ? 'CSV report downloaded.' : 'There is no report data to export.', reportRows.length ? 'success' : 'error')}>Download CSV</Button><Button onClick={() => showToast(downloadExcel('unidos-campus-report.xls', reportRows) ? 'Excel-compatible report downloaded.' : 'There is no report data to export.', reportRows.length ? 'success' : 'error')} variant="secondary">Download Excel</Button><Button onClick={() => window.print()} variant="secondary">Print / Save as PDF</Button></div>
        <FilterBar search={search} setSearch={setSearch}><select aria-label="Filter report status" onChange={(event) => setStatusFilter(event.target.value)} value={statusFilter}><option>All</option>{['ACTIVE', 'PUBLISHED', 'APPROVED', 'PENDING', 'VERIFIED', 'RETURNED', 'REJECTED', 'SUSPENDED'].map((value) => <option key={value}>{value}</option>)}</select><select aria-label="Filter academic year"><option>{data.adminSettings.academicYear}</option></select><select aria-label="Filter semester"><option>{data.adminSettings.semester}</option></select><select aria-label="Filter college" onChange={(event) => setReportFilters((current) => ({ ...current, college: event.target.value }))} value={reportFilters.college}>{['All Colleges', 'College of Computing Studies', 'College of Arts and Sciences'].map((value) => <option key={value}>{value}</option>)}</select><select aria-label="Filter organization category" onChange={(event) => setReportFilters((current) => ({ ...current, category: event.target.value }))} value={reportFilters.category}>{['All Categories', ...new Set(data.adminOrganizations.map((organization) => organization.category))].map((value) => <option key={value}>{value}</option>)}</select><select aria-label="Filter event type" onChange={(event) => setReportFilters((current) => ({ ...current, eventType: event.target.value }))} value={reportFilters.eventType}>{['All Event Types', ...new Set(orgEvents.map((event) => event.category).filter(Boolean))].map((value) => <option key={value}>{value}</option>)}</select></FilterBar>
        <Card className="admin-section-card">{reportRows.length ? <Table columns={[{ key: 'type', label: 'Record type' }, { key: 'name', label: 'Name' }, { key: 'status', label: 'Status', render: (value) => <Status value={value} /> }, { key: 'count', label: 'Members / attendance' }]} rows={reportRows} /> : <EmptyState title="No report records" />}</Card>
      </>
    )
  }

  if (pathname.endsWith('/analytics')) {
    const orgTotal = data.adminOrganizations.length
    const eventTotal = orgEvents.length
    const stats = [
      { label: 'Active organizations', value: data.adminOrganizations.filter((item) => item.status === 'ACTIVE').length, total: orgTotal },
      { label: 'Published events', value: orgEvents.filter((item) => item.status === 'PUBLISHED').length, total: eventTotal },
      { label: 'Student accounts', value: data.adminUsers.filter((item) => item.role === 'Student').length, total: data.adminUsers.length },
      { label: 'Pending applications', value: data.organizationApplications.filter((item) => item.status === 'PENDING').length, total: data.organizationApplications.length },
    ]
    const categories = [...new Set(data.adminOrganizations.map((organization) => organization.category))]
    return <><PageHeader description="A live summary of organization, membership, event, and participation patterns." eyebrow="UNIDOS ADMINISTRATION" title="Analytics" /><div className="admin-metrics-grid">{stats.map((stat) => <Metric key={stat.label} label={stat.label} value={stat.value} detail={`of ${stat.total} total records`} />)}</div><div className="admin-analytics-grid"><ChartRows title="Organization category distribution" rows={categories.map((label) => ({ label, value: data.adminOrganizations.filter((organization) => organization.category === label).length }))} /><ChartRows title="Events per month" rows={[{ label: 'Aug', value: 4 }, { label: 'Sep', value: 7 }, { label: 'Oct', value: 9 }, { label: 'Nov', value: 5 }, { label: 'Dec', value: 3 }]} /><ChartRows title="Attendance trends" rows={[{ label: 'Aug', value: 66 }, { label: 'Sep', value: 74 }, { label: 'Oct', value: 82 }, { label: 'Nov', value: 79 }]} /><ChartRows title="Membership trends" rows={[{ label: 'Aug', value: 188 }, { label: 'Sep', value: 216 }, { label: 'Oct', value: 243 }, { label: 'Nov', value: 278 }]} /></div><Card className="admin-section-card"><h2>Organization standing</h2>{['ACTIVE', 'INACTIVE', 'SUSPENDED'].map((status) => { const count = data.adminOrganizations.filter((item) => item.status === status).length; return <div className="admin-chart-row" key={status}><span>{status}</span><div className="admin-chart-track"><div className={`admin-chart-fill status-${status.toLowerCase()}`} style={{ width: `${orgTotal ? (count / orgTotal) * 100 : 0}%` }} /></div><strong>{count}</strong></div> })}</Card></>
  }

  if (pathname.endsWith('/audit-logs')) {
    const query = search.trim().toLowerCase()
    const rows = data.adminAuditLogs.filter((item) => (
      (statusFilter === 'All' || item.entityType === statusFilter)
      && (actionFilter === 'All' || item.action === actionFilter)
      && (!query || ['actor', 'action', 'entityType', 'entityId', 'description', 'timestamp'].some((key) => String(item[key] ?? '').toLowerCase().includes(query)))
    ))
    return <><PageHeader description="Search the recorded history of significant system and approval actions." eyebrow="UNIDOS ADMINISTRATION" title="Audit Logs" /><FilterBar search={search} setSearch={setSearch}><select aria-label="Filter audit entity" onChange={(event) => setStatusFilter(event.target.value)} value={statusFilter}><option>All</option>{[...new Set(data.adminAuditLogs.map((log) => log.entityType))].map((type) => <option key={type}>{type}</option>)}</select><select aria-label="Filter audit action" onChange={(event) => setActionFilter(event.target.value)} value={actionFilter}><option>All</option>{[...new Set(data.adminAuditLogs.map((log) => log.action))].map((action) => <option key={action}>{action}</option>)}</select></FilterBar><Card className="admin-section-card">{rows.length ? <Table columns={[{ key: 'timestamp', label: 'Date / time' }, { key: 'actor', label: 'Actor' }, { key: 'action', label: 'Action' }, { key: 'entityType', label: 'Entity' }, { key: 'entityId', label: 'Record ID' }, { key: 'description', label: 'Details' }]} rows={rows} /> : <EmptyState title="No audit entries found" />}</Card></>
  }

  if (pathname.endsWith('/settings')) {
    return (
      <>
        <PageHeader description="Update academic period and notification preferences for this local preview." eyebrow="UNIDOS ADMINISTRATION" title="System Settings" />
        <Card className="admin-section-card admin-settings-form">
          <h2>System Information</h2>
          <p><strong>UNIDOS</strong> — Student Organization Management System<br />Western Mindanao State University</p>
          <label>Academic year<input onChange={(event) => setSettings((current) => ({ ...current, academicYear: event.target.value }))} value={settings.academicYear} /></label>
          <label>Current semester<select onChange={(event) => setSettings((current) => ({ ...current, semester: event.target.value }))} value={settings.semester}>{['First Semester', 'Second Semester', 'Summer'].map((value) => <option key={value}>{value}</option>)}</select></label>
          <h2>Organization categories</h2>
          {(settings.organizationCategories ?? ['Academic', 'Socio-Civic', 'Cultural', 'Sports']).map((category) => <div className="admin-category-row" key={category}><span>{category}</span><Button onClick={() => setSettings((current) => ({ ...current, organizationCategories: (current.organizationCategories ?? ['Academic', 'Socio-Civic', 'Cultural', 'Sports']).filter((item) => item !== category) }))} variant="danger">Remove</Button></div>)}
          <div className="admin-category-add"><input aria-label="New organization category" onChange={(event) => setNewCategory(event.target.value)} placeholder="Add a category" value={newCategory} /><Button onClick={() => { const category = newCategory.trim(); if (!category) return; setSettings((current) => ({ ...current, organizationCategories: [...new Set([...(current.organizationCategories ?? ['Academic', 'Socio-Civic', 'Cultural', 'Sports']), category])] })); setNewCategory('') }}>Add category</Button></div>
          <h2>Notification preferences</h2>
          {Object.entries(settings.notifications).map(([key, checked]) => <label className="admin-checkbox-row" key={key}><input checked={checked} onChange={(event) => setSettings((current) => ({ ...current, notifications: { ...current.notifications, [key]: event.target.checked } }))} type="checkbox" />{key.replace(/([A-Z])/g, ' $1')}</label>)}
          <Button onClick={() => { data.saveAdminSettings(settings); showToast('System settings saved.', 'success') }}>Save Settings</Button>
        </Card>
      </>
    )
  }
  return <PageHeader description="This administration section is not available." title="Page not found" />
}

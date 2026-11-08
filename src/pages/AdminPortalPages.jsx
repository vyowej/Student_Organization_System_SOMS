/**
 * Student Affairs Admin Portal Pages (`/admin/*`)
 *
 * Implements campus-wide global Admin access across Dashboard, User & Adviser
 * Account Management (including pre-generation of Faculty Adviser accounts),
 * Organization Accreditation & Standing, Campus Events, Approval Center,
 * Compliance Documents, Reports, 1-Month Interval Analytics + Data Export,
 * Audit Logs, and System Settings.
 */
import { useState, useEffect, useMemo } from 'react'
import { Link, useLocation, useOutletContext } from 'react-router-dom'
import PageHeader from '../components/layout/PageHeader.jsx'
import Badge from '../components/ui/Badge.jsx'
import Button from '../components/ui/Button.jsx'
import Card from '../components/ui/Card.jsx'
import EmptyState from '../components/ui/EmptyState.jsx'
import Modal from '../components/ui/Modal.jsx'
import Table from '../components/ui/Table.jsx'
import ConfirmDialog from '../components/ui/ConfirmDialog.jsx'
import Icon from '../components/ui/Icon.jsx'
import { useToast } from '../components/ui/useToast.js'
import { adminDefaultSettings } from '../data/navigation.js'
import { formatDisplayName, isValidEmail } from '../data/displayName.js'
import AuditLogTracker from '../components/admin/AuditLogTracker.jsx'

const decisionOptions = ['APPROVED', 'RETURNED', 'REJECTED']
const roleOptions = ['Organization Officer', 'Faculty Adviser', 'Student Affairs Admin']

function toneFor(status = '') {
  if (['ACTIVE', 'APPROVED', 'ACCREDITED', 'PUBLISHED', 'VERIFIED'].includes(status)) return 'success'
  if (['PENDING', 'SUBMITTED', 'UNDER_REVIEW', 'RETURNED', 'RETURNED_FOR_REVISION'].includes(status)) return 'warning'
  if (['REJECTED', 'SUSPENDED', 'REVOKED'].includes(status)) return 'danger'
  return 'neutral'
}

function humanize(value) {
  const text = String(value ?? '—').replaceAll('_', ' ').toLowerCase()
  return text.charAt(0).toUpperCase() + text.slice(1)
}

function Status({ value }) {
  return <Badge tone={toneFor(value)}>{humanize(value)}</Badge>
}

function FilterSelect({ label, onChange, options, value }) {
  return (
    <label className="admin-filter-field">
      <span>{label}</span>
      <select onChange={(event) => onChange(event.target.value)} value={value}>
        {options.map((option) => (
          <option key={option} value={option}>
            {option === 'All' ? 'All' : humanize(option)}
          </option>
        ))}
      </select>
    </label>
  )
}

function Metric({ label, value, detail }) {
  return (
    <Card className="admin-metric-card">
      <span className="stat-label">{label}</span>
      <strong className="stat-value">{value}</strong>
      {detail && <small className="stat-note">{detail}</small>}
    </Card>
  )
}

function FilterBar({ search, setSearch, children }) {
  return (
    <div className="admin-filter-bar">
      <label className="admin-filter-field admin-filter-search">
        <span>Search</span>
        <input
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search records"
          type="search"
          value={search}
        />
      </label>
      {children}
    </div>
  )
}

function downloadCsv(filename, rows) {
  if (!rows.length) return false
  const headings = Array.from(
    rows.reduce((set, row) => {
      Object.keys(row).forEach((k) => set.add(k))
      return set
    }, new Set())
  )
  const escape = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`
  const content = [headings, ...rows.map((row) => headings.map((h) => row[h] ?? ''))]
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
  const escape = (value) =>
    String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
  const headings = Array.from(
    rows.reduce((set, row) => {
      Object.keys(row).forEach((k) => set.add(k))
      return set
    }, new Set())
  )
  const html = `<table><thead><tr>${headings.map((heading) => `<th>${escape(heading)}</th>`).join('')}</tr></thead><tbody>${rows
    .map((row) => `<tr>${headings.map((heading) => `<td>${escape(row[heading] ?? '')}</td>`).join('')}</tr>`)
    .join('')}</tbody></table>`
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
  const [confirming, setConfirming] = useState(false)
  if (!item) return null

  const complianceFile = item.complianceFileName || item.supportingDocuments?.[0] || null
  const fields = Object.entries(item).filter(
    ([key, value]) =>
      ![
        'id',
        'proposedOfficers',
        'documents',
        'supportingDocuments',
        'eventIds',
        'announcements',
        'officers',
        '__event',
        '__application',
        '__document',
        '__approval',
      ].includes(key) && (typeof value !== 'object' || value === null)
  )

  function submit() {
    if (!decision) {
      onClose()
      return
    }
    if (['RETURNED', 'REJECTED'].includes(decision) && !comment.trim()) {
      setError('Add a reason or revision comment before continuing.')
      return
    }
    setConfirming(true)
  }

  async function applyDecision() {
    const succeeded = await onDecision(decision, comment)
    setConfirming(false)
    if (!succeeded) {
      setError('Unable to save this decision. Please refresh and try again.')
      return
    }
    onClose()
  }

  const decisionVerb = (decisionLabels[decision] ?? String(decision).replace('_', ' ')).toLowerCase()
  const confirmTone =
    decision === 'APPROVED' ? 'success' : decision === 'RETURNED' ? 'warning' : 'danger'

  return (
    <div className="admin-page">
      <ConfirmDialog
        confirmLabel="Yes, confirm"
        message={`Are you sure you want to ${decisionVerb} "${item.title ?? item.name ?? 'this item'}"?`}
        onCancel={() => setConfirming(false)}
        onConfirm={applyDecision}
        open={confirming}
        title="Confirm administrative decision"
        tone={confirmTone}
      />
      <Modal
        onClose={onClose}
        open={!confirming}
        size="lg"
        status={decision || item.status}
        title={item.title ?? item.name ?? 'Record details'}
      >
        {complianceFile && (
          <div className="compliance-upload-badge" style={{ marginBottom: '14px' }}>
            <Icon name="file" size={16} />
            <span>
              Uploaded Compliance Document: <strong>{complianceFile}</strong>
            </span>
          </div>
        )}
        <dl className="admin-detail-list">
          {fields.map(([key, value]) => (
            <div key={key}>
              <dt>{key.replace(/[A-Z]/g, (letter) => ` ${letter.toLowerCase()}`)}</dt>
              <dd>{String(value)}</dd>
            </div>
          ))}
          {Object.entries(item)
            .filter(([key, value]) => Array.isArray(value) && !['documents', 'proposedOfficers'].includes(key))
            .map(([key, values]) => (
              <div key={key}>
                <dt>{key}</dt>
                <dd>{values.length ? values.join(', ') : 'None recorded'}</dd>
              </div>
            ))}
          {Array.isArray(item.documents) && (
            <div>
              <dt>Supporting documents</dt>
              <dd>{item.documents.join(', ')}</dd>
            </div>
          )}
          {Array.isArray(item.proposedOfficers) && (
            <div>
              <dt>Proposed officers</dt>
              <dd>{item.proposedOfficers.map((officer) => `${officer.name} — ${officer.position}`).join(', ')}</dd>
            </div>
          )}
        </dl>
        {canDecide && (
          <div className="admin-modal-decision">
            <label>
              Decision
              <select onChange={(event) => setDecision(event.target.value)} value={decision}>
                <option value="">Choose a decision</option>
                {decisionOptions.map((option) => (
                  <option key={option} value={option}>
                    {decisionLabels[option] ?? option.replace('_', ' ')}
                  </option>
                ))}
              </select>
            </label>
            {['RETURNED', 'REJECTED'].includes(decision) && (
              <label>
                <span>
                  {decision === 'RETURNED' ? 'Revision comments' : 'Reason'}{' '}
                  <span aria-hidden="true" className="required-asterisk">*</span>
                </span>
                <textarea onChange={(event) => setComment(event.target.value)} value={comment} />
              </label>
            )}
            {error && <p className="form-error" role="alert">{error}</p>}
            <Button onClick={submit}>{decision ? 'Continue' : 'Close'}</Button>
          </div>
        )}
      </Modal>
    </div>
  )
}

function OrganizationEditModal({ organization, onClose, onSave, categories = [] }) {
  const [form, setForm] = useState(null)
  if (!organization) return null
  const categoryOptions =
    Array.isArray(categories) && categories.length > 0
      ? categories
      : adminDefaultSettings.organizationCategories
  const values = form ?? {
    name: organization.name,
    acronym: organization.acronym,
    category: organization.category,
    adviser: organization.adviser,
  }
  const editCategories = [...new Set([...categoryOptions, values.category].filter(Boolean))]
  return (
    <Modal onClose={onClose} open size="md" status={organization.status} title={`Edit ${organization.name}`}>
      <div className="admin-settings-form">
        {Object.entries(values).map(([key, value]) => {
          if (key === 'category') {
            return (
              <label key={key}>
                Category
                <select
                  onChange={(event) =>
                    setForm((current) => ({ ...values, ...current, category: event.target.value }))
                  }
                  value={value}
                >
                  {editCategories.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </label>
            )
          }
          return (
            <label key={key}>
              {key.charAt(0).toUpperCase() + key.slice(1)}
              <input
                onChange={(event) =>
                  setForm((current) => ({ ...values, ...current, [key]: event.target.value }))
                }
                value={value}
              />
            </label>
          )
        })}
        <Button onClick={() => onSave(values)}>Save organization</Button>
      </div>
    </Modal>
  )
}

function OrganizationCreateModal({
  open,
  onClose,
  onCreate,
  colleges = [],
  departments = [],
  advisers = [],
  categories = [],
}) {
  const categoryOptions =
    Array.isArray(categories) && categories.length > 0
      ? categories
      : adminDefaultSettings.organizationCategories

  const [name, setName] = useState('')
  const [acronym, setAcronym] = useState('')
  const [category, setCategory] = useState('')
  const [scope, setScope] = useState('UNIVERSITY')
  const [collegeId, setCollegeId] = useState('')
  const [departmentId, setDepartmentId] = useState('')
  const [adviserId, setAdviserId] = useState('')
  const [description, setDescription] = useState('')
  const [status, setStatus] = useState('ACTIVE')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const activeCategory =
    category && categoryOptions.includes(category) ? category : categoryOptions[0] || 'Academic'

  if (!open) return null

  const filteredDepartments = collegeId
    ? departments.filter((d) => String(d.college_id) === String(collegeId))
    : departments

  const handleScopeChange = (e) => {
    const nextScope = e.target.value
    setScope(nextScope)
    if (nextScope === 'UNIVERSITY') {
      setCollegeId('')
      setDepartmentId('')
    } else if (nextScope === 'COLLEGE') {
      setDepartmentId('')
    }
  }

  const handleCollegeChange = (e) => {
    setCollegeId(e.target.value)
    setDepartmentId('')
  }

  const handleSubmit = async (e) => {
    if (e) e.preventDefault()
    if (!name.trim()) {
      setError('Organization name is required.')
      return
    }
    if (scope === 'COLLEGE' && !collegeId) {
      setError('Please select a college for a College-scoped organization.')
      return
    }
    if (scope === 'DEPARTMENT') {
      if (!collegeId) {
        setError('Please select a college for a Department-scoped organization.')
        return
      }
      if (!departmentId) {
        setError('Please select a department for a Department-scoped organization.')
        return
      }
    }

    setError('')
    setSubmitting(true)
    const result = await onCreate({
      name: name.trim(),
      acronym: acronym.trim(),
      category: activeCategory,
      scope,
      college_id: collegeId || null,
      department_id: departmentId || null,
      adviser_id: adviserId || null,
      description: description.trim(),
      status,
    })
    setSubmitting(false)
    if (result?.ok) {
      setName('')
      setAcronym('')
      setDescription('')
      setCollegeId('')
      setDepartmentId('')
      setAdviserId('')
      setCategory('')
      setError('')
      onClose()
    } else {
      setError(result?.error || 'Failed to create organization.')
    }
  }

  return (
    <Modal onClose={onClose} open={open} size="md" title="Add New Organization">
      <form className="admin-settings-form" onSubmit={handleSubmit} style={{ marginTop: '12px' }}>
        {error && (
          <div
            role="alert"
            style={{
              color: '#a51e37',
              backgroundColor: '#fdf2f2',
              border: '1px solid #f8d7da',
              padding: '10px 14px',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: '500',
            }}
          >
            {error}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label className="admin-field-label" htmlFor="create-org-name">
            <span>Organization Name</span>
            <span aria-hidden="true" className="required-asterisk">*</span>
          </label>
          <input
            id="create-org-name"
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Society of Information Technology Enthusiasts"
            required
            type="text"
            value={name}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label className="admin-field-label" htmlFor="create-org-acronym">
            <span>Acronym</span>
          </label>
          <input
            id="create-org-acronym"
            onChange={(e) => setAcronym(e.target.value)}
            placeholder="e.g. SITE"
            type="text"
            value={acronym}
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label className="admin-field-label" htmlFor="create-org-category">
              <span>Category</span>
            </label>
            <select
              id="create-org-category"
              onChange={(e) => setCategory(e.target.value)}
              value={activeCategory}
            >
              {categoryOptions.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label className="admin-field-label" htmlFor="create-org-scope">
              <span>Scope</span>
            </label>
            <select id="create-org-scope" onChange={handleScopeChange} value={scope}>
              <option value="UNIVERSITY">University-Wide</option>
              <option value="COLLEGE">College-Based</option>
              <option value="DEPARTMENT">Department-Based</option>
            </select>
          </div>
        </div>

        {(scope === 'COLLEGE' || scope === 'DEPARTMENT') && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label className="admin-field-label" htmlFor="create-org-college">
              <span>College</span>
              <span aria-hidden="true" className="required-asterisk">*</span>
            </label>
            <select id="create-org-college" onChange={handleCollegeChange} required value={collegeId}>
              <option value="">Select College</option>
              {colleges.map((col) => (
                <option key={col.id} value={col.id}>
                  {col.name} {col.acronym ? `(${col.acronym})` : ''}
                </option>
              ))}
            </select>
          </div>
        )}

        {scope === 'DEPARTMENT' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label className="admin-field-label" htmlFor="create-org-dept">
              <span>Department</span>
              <span aria-hidden="true" className="required-asterisk">*</span>
            </label>
            <select
              id="create-org-dept"
              onChange={(e) => setDepartmentId(e.target.value)}
              required
              value={departmentId}
            >
              <option value="">Select Department</option>
              {filteredDepartments.map((dept) => (
                <option key={dept.id} value={dept.id}>
                  {dept.name} {dept.acronym ? `(${dept.acronym})` : ''}
                </option>
              ))}
            </select>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label className="admin-field-label" htmlFor="create-org-adviser">
            <span>Prepared Faculty Adviser (Optional)</span>
          </label>
          <select id="create-org-adviser" onChange={(e) => setAdviserId(e.target.value)} value={adviserId}>
            <option value="">Auto-prepare or Assign Later</option>
            {advisers.map((adv) => (
              <option key={adv.adviser_id ?? adv.id} value={adv.adviser_id ?? adv.id}>
                {adv.name || `${adv.first_name || ''} ${adv.last_name || ''}`.trim()}{' '}
                {adv.college_acronym ? `(${adv.college_acronym})` : ''}
              </option>
            ))}
          </select>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label className="admin-field-label" htmlFor="create-org-desc">
            <span>Description</span>
          </label>
          <textarea
            id="create-org-desc"
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Brief overview of the organization's mission, objectives, or activities..."
            rows={3}
            style={{ resize: 'vertical', minHeight: '80px' }}
            value={description}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label className="admin-field-label" htmlFor="create-org-status">
            <span>Status</span>
          </label>
          <select id="create-org-status" onChange={(e) => setStatus(e.target.value)} value={status}>
            <option value="ACTIVE">Active (Accredited)</option>
            <option value="PENDING">Pending (Accreditation Review)</option>
          </select>
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            alignItems: 'center',
            gap: '12px',
            marginTop: '20px',
            paddingTop: '16px',
            borderTop: '1px solid #eee8ec',
          }}
        >
          <Button disabled={submitting} onClick={onClose} style={{ minWidth: '100px' }} type="button" variant="secondary">
            Cancel
          </Button>
          <Button disabled={submitting} style={{ minWidth: '110px' }} type="submit" variant="primary">
            {submitting ? 'Submitting...' : 'Submit'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

function PrepareAdviserModal({ open, onClose, onCreate, departments = [], organizations = [] }) {
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    employeeNumber: '',
    password: 'adviser123',
    departmentId: '',
    organizationId: '',
    isCoordinator: false,
  })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  if (!open) return null

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    if (!form.firstName.trim() || !form.lastName.trim() || !form.email.trim()) {
      setError('First Name, Last Name, and official WMSU Email are required.')
      return
    }
    if (!isValidEmail(form.email.trim())) {
      setError('Enter a valid email address.')
      return
    }
    setSaving(true)
    const res = await onCreate(form)
    setSaving(false)
    if (!res?.ok) {
      setError(res?.error || 'Unable to prepare faculty adviser account.')
      return
    }
    setForm({
      firstName: '',
      lastName: '',
      email: '',
      employeeNumber: '',
      password: 'adviser123',
      departmentId: '',
      organizationId: '',
      isCoordinator: false,
    })
    onClose()
  }

  return (
    <Modal onClose={onClose} open={open} size="md" title="Prepare Faculty Adviser Account">
      <form className="admin-settings-form" onSubmit={handleSubmit}>
        <p style={{ margin: 0, fontSize: '13px', color: '#5c5560' }}>
          Pre-generate a Faculty Adviser account for an organization so credentials are ready beforehand.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div>
            <label className="admin-field-label" htmlFor="admin-adv-first">
              <span>First Name</span>
              <span className="required-asterisk">*</span>
            </label>
            <input
              id="admin-adv-first"
              onChange={(e) => setForm((p) => ({ ...p, firstName: e.target.value }))}
              required
              type="text"
              value={form.firstName}
            />
          </div>
          <div>
            <label className="admin-field-label" htmlFor="admin-adv-last">
              <span>Last Name</span>
              <span className="required-asterisk">*</span>
            </label>
            <input
              id="admin-adv-last"
              onChange={(e) => setForm((p) => ({ ...p, lastName: e.target.value }))}
              required
              type="text"
              value={form.lastName}
            />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '12px' }}>
          <div>
            <label className="admin-field-label" htmlFor="admin-adv-email">
              <span>WMSU Email</span>
              <span className="required-asterisk">*</span>
            </label>
            <input
              id="admin-adv-email"
              onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
              placeholder="adviser@wmsu.edu.ph"
              required
              type="email"
              value={form.email}
            />
          </div>
          <div>
            <label className="admin-field-label" htmlFor="admin-adv-emp">
              <span>Employee Number</span>
            </label>
            <input
              id="admin-adv-emp"
              onChange={(e) => setForm((p) => ({ ...p, employeeNumber: e.target.value }))}
              placeholder="e.g., EMP-2026-088"
              type="text"
              value={form.employeeNumber}
            />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div>
            <label className="admin-field-label" htmlFor="admin-adv-dept">
              <span>Department (optional)</span>
            </label>
            <select
              id="admin-adv-dept"
              onChange={(e) => setForm((p) => ({ ...p, departmentId: e.target.value }))}
              value={form.departmentId}
            >
              <option value="">Select department…</option>
              {departments.map((dept) => (
                <option key={dept.id} value={dept.id}>{dept.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="admin-field-label" htmlFor="admin-adv-pwd">
              <span>Initial Password</span>
              <span className="required-asterisk">*</span>
            </label>
            <input
              id="admin-adv-pwd"
              onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
              required
              type="text"
              value={form.password}
            />
          </div>
        </div>

        <div>
          <label className="admin-field-label" htmlFor="admin-adv-org">
            <span>Assign to Organization (optional)</span>
          </label>
          <select
            id="admin-adv-org"
            onChange={(e) => setForm((p) => ({ ...p, organizationId: e.target.value }))}
            value={form.organizationId}
          >
            <option value="">Keep in prepared adviser pool…</option>
            {organizations.map((org) => (
              <option key={org.id} value={org.id}>
                {org.acronym ? `${org.acronym} — ${org.name}` : org.name}
              </option>
            ))}
          </select>
        </div>

        <label className="admin-checkbox-row">
          <input
            checked={form.isCoordinator}
            onChange={(e) => setForm((p) => ({ ...p, isCoordinator: e.target.checked }))}
            type="checkbox"
          />
          Grant Coordinator Privileges (can prepare adviser accounts beforehand)
        </label>

        {error && <p className="form-error" role="alert">{error}</p>}

        <div className="modal-actions">
          <Button onClick={onClose} type="button" variant="secondary">Cancel</Button>
          <Button disabled={saving} type="submit" variant="primary">
            {saving ? 'Preparing Account…' : 'Create Adviser Account'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

function parseRecordDate(raw) {
  if (!raw) return null
  if (raw instanceof Date) return Number.isNaN(raw.getTime()) ? null : raw
  const str = String(raw).trim()
  if (!str) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    const [y, m, d] = str.split('-').map(Number)
    return new Date(y, m - 1, d)
  }
  const cleaned = str.replace('·', ' ').trim()
  const parsed = new Date(cleaned)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function toMonthKey(dateObj) {
  if (!dateObj || Number.isNaN(dateObj.getTime())) return null
  return `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}`
}

function buildOneMonthIntervals(extraDates = []) {
  const keys = new Set()
  const now = new Date()
  for (let i = 0; i < 12; i += 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    keys.add(toMonthKey(d))
  }
  extraDates.forEach((raw) => {
    const parsed = parseRecordDate(raw)
    if (parsed) {
      const k = toMonthKey(parsed)
      if (k) keys.add(k)
    }
  })

  return Array.from(keys)
    .filter(Boolean)
    .sort((a, b) => b.localeCompare(a))
    .slice(0, 18)
    .map((key) => {
      const [year, month] = key.split('-').map(Number)
      const firstDay = new Date(year, month - 1, 1)
      const lastDay = new Date(year, month, 0)
      const monthName = firstDay.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
      const shortLabel = firstDay.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
      return {
        key,
        shortLabel,
        label: `${monthName} (${firstDay.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${lastDay.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })})`,
        startDate: new Date(year, month - 1, 1, 0, 0, 0, 0),
        endDate: new Date(year, month, 0, 23, 59, 59, 999),
      }
    })
}

function MonthIntervalDropdown({ value, onChange, intervals, ariaLabel = 'Select 1-month interval' }) {
  return (
    <div className="admin-month-interval-select">
      <select
        aria-label={ariaLabel}
        className="admin-month-dropdown"
        onChange={(e) => onChange(e.target.value)}
        value={value}
      >
        <option value="ALL_12M">Last 12 Months (1-Month Intervals)</option>
        {intervals.map((interval) => (
          <option key={interval.key} value={interval.key}>
            {interval.label}
          </option>
        ))}
      </select>
    </div>
  )
}

function buildChartSlotsForInterval(selectedMonthKey, intervals) {
  if (!selectedMonthKey || selectedMonthKey === 'ALL_12M') {
    const chrono = [...intervals].slice(0, 12).reverse()
    return {
      mode: 'monthly',
      slots: chrono.map((item) => ({
        key: item.key,
        label: item.shortLabel,
        startDate: item.startDate,
        endDate: item.endDate,
      })),
    }
  }
  const chosen = intervals.find((i) => i.key === selectedMonthKey)
  if (!chosen) {
    return { mode: 'monthly', slots: [] }
  }
  const [year, month] = chosen.key.split('-').map(Number)
  const daysInMonth = new Date(year, month, 0).getDate()
  const ranges = [
    [1, 7],
    [8, 14],
    [15, 21],
    [22, daysInMonth],
  ]
  const monthShort = chosen.startDate.toLocaleDateString('en-US', { month: 'short' })
  return {
    mode: 'weekly_within_month',
    monthInterval: chosen,
    slots: ranges.map(([startDay, endDay], idx) => ({
      key: `${chosen.key}-W${idx + 1}`,
      label: `${monthShort} ${startDay}–${endDay}`,
      startDate: new Date(year, month - 1, startDay, 0, 0, 0, 0),
      endDate: new Date(year, month - 1, endDay, 23, 59, 59, 999),
    })),
  }
}

function findSlotForDate(rawDate, slots) {
  const parsed = parseRecordDate(rawDate)
  if (!parsed) return null
  const matched = slots.find((slot) => parsed >= slot.startDate && parsed <= slot.endDate)
  return matched ? matched.key : null
}

function getChartUnitLabel(title, value) {
  const t = title.toLowerCase()
  if (t.includes('category') || t.includes('organization')) {
    return value === 1 ? 'organization' : 'organizations'
  }
  if (t.includes('event')) {
    return value === 1 ? 'event' : 'events'
  }
  if (t.includes('attendance') || t.includes('check-in')) {
    return value === 1 ? 'check-in' : 'check-ins'
  }
  if (t.includes('officer') || t.includes('onboarding')) {
    return value === 1 ? 'officer' : 'officers'
  }
  return value === 1 ? 'record' : 'records'
}

function AnalyticsChart({ title, rows, type, lineColor = '#8f1538', filter }) {
  const [hoveredIndex, setHoveredIndex] = useState(null)

  const width = 420
  const height = 180
  const left = 36
  const right = width - 16
  const top = 16
  const bottom = height - 26

  const barPalette = [
    { start: '#8f1538', end: '#b8294e' },
    { start: '#d4653b', end: '#e2825b' },
    { start: '#2563eb', end: '#4f83f2' },
    { start: '#10b981', end: '#34d399' },
    { start: '#8b5cf6', end: '#a78bfa' },
    { start: '#d97706', end: '#f59e0b' },
  ]

  const maxVal = Math.max(...rows.map((r) => r.value), 0)
  const totalVal = rows.reduce((sum, r) => sum + (r.value || 0), 0)

  let ticks = [0, 1, 2]
  if (maxVal <= 2) {
    ticks = [0, 1, 2]
  } else if (maxVal === 3) {
    ticks = [0, 1, 2, 3]
  } else if (maxVal <= 6) {
    ticks = [0, 2, 4, 6]
  } else if (maxVal <= 10) {
    ticks = [0, 3, 6, 9, 12].filter((t, i) => t <= maxVal || i <= 2)
  } else {
    const step = Math.ceil(maxVal / 4)
    ticks = [0, step, step * 2, step * 3, step * 4]
  }
  const chartMax = Math.max(ticks[ticks.length - 1], maxVal, 1)

  const slotWidth = (right - left) / Math.max(rows.length, 1)
  const points = rows.map((row, index) => ({
    x: left + (index + 0.5) * slotWidth,
    y: bottom - (row.value / chartMax) * (bottom - top),
  }))

  const chartId = title.toLowerCase().replace(/[^a-z0-9]+/g, '-')
  const chartDescription = rows.map((row) => `${row.label}: ${row.value}`).join('; ')

  const activePoint = hoveredIndex !== null && points[hoveredIndex] ? points[hoveredIndex] : null
  const activeRow = hoveredIndex !== null && rows[hoveredIndex] ? rows[hoveredIndex] : null
  const activeColor =
    type === 'line'
      ? lineColor
      : rows.length <= 6 && hoveredIndex !== null
        ? barPalette[hoveredIndex % barPalette.length].start
        : lineColor

  return (
    <Card className="admin-section-card admin-analytics-card">
      <div className="admin-chart-header">
        <h2>{title}</h2>
        {filter}
      </div>
      <div className="admin-analytics-chart" onMouseLeave={() => setHoveredIndex(null)}>
        <svg
          aria-label={`${title}. ${chartDescription}`}
          className={`admin-analytics-chart-graphic admin-analytics-chart-${type}`}
          role="img"
          viewBox={`0 0 ${width} ${height}`}
        >
          <defs>
            <linearGradient id={`area-${chartId}`} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={lineColor} stopOpacity="0.28" />
              <stop offset="100%" stopColor={lineColor} stopOpacity="0.01" />
            </linearGradient>
            <linearGradient id={`bar-default-${chartId}`} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={lineColor} stopOpacity="1" />
              <stop offset="100%" stopColor={lineColor} stopOpacity="0.8" />
            </linearGradient>
            {barPalette.map((p, i) => (
              <linearGradient id={`bar-${chartId}-${i}`} key={i} x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor={p.start} stopOpacity="1" />
                <stop offset="100%" stopColor={p.end} stopOpacity="0.85" />
              </linearGradient>
            ))}
          </defs>

          {ticks.map((tickVal) => {
            const y = bottom - (tickVal / chartMax) * (bottom - top)
            return (
              <g key={tickVal}>
                <line
                  className="admin-analytics-chart-gridline"
                  stroke="#f1ebef"
                  strokeDasharray={tickVal === 0 ? 'none' : '3 3'}
                  strokeWidth="1"
                  x1={left}
                  x2={right}
                  y1={y}
                  y2={y}
                />
                <text className="admin-analytics-chart-tick" textAnchor="end" x={left - 8} y={y + 4}>
                  {tickVal}
                </text>
              </g>
            )
          })}

          {type === 'line' ? (
            <>
              {points.length > 1 && (
                <polygon
                  fill={`url(#area-${chartId})`}
                  points={`${points[0].x},${bottom} ${points.map((p) => `${p.x},${p.y}`).join(' ')} ${points[points.length - 1].x},${bottom}`}
                />
              )}
              {points.length > 1 && (
                <polyline
                  className="admin-analytics-chart-line"
                  fill="none"
                  points={points.map((p) => `${p.x},${p.y}`).join(' ')}
                  stroke={lineColor}
                />
              )}
              {hoveredIndex !== null && activePoint && (
                <line
                  className="admin-chart-cursor-line"
                  opacity="0.65"
                  stroke={lineColor}
                  strokeDasharray="3 3"
                  strokeWidth="1.5"
                  x1={activePoint.x}
                  x2={activePoint.x}
                  y1={top}
                  y2={bottom}
                />
              )}
              {points.map((point, index) => {
                const isHovered = hoveredIndex === index
                const hasValue = rows[index].value > 0
                const isCrowded = rows.length > 12
                const r = isHovered ? 6 : hasValue ? 4.5 : isCrowded ? 2.5 : 4
                const strokeWidth = isHovered ? 3 : hasValue ? 2.5 : isCrowded ? 1.5 : 2.5
                const stroke = isHovered || hasValue ? lineColor : '#d1c7ce'

                return (
                  <g key={rows[index].label}>
                    {isHovered && (
                      <circle
                        className="admin-chart-point-halo"
                        cx={point.x}
                        cy={point.y}
                        fill={lineColor}
                        fillOpacity="0.22"
                        r="8.5"
                      />
                    )}
                    <circle
                      className="admin-analytics-chart-point"
                      cx={point.x}
                      cy={point.y}
                      fill="#ffffff"
                      r={r}
                      stroke={stroke}
                      strokeWidth={strokeWidth}
                    />
                  </g>
                )
              })}
            </>
          ) : (
            rows.map((row, index) => {
              const barWidth = Math.min(36, Math.max(12, slotWidth * 0.56))
              const barHeight = chartMax ? (row.value / chartMax) * (bottom - top) : 0
              const gradId =
                rows.length <= 6
                  ? `url(#bar-${chartId}-${index % barPalette.length})`
                  : `url(#bar-default-${chartId})`
              const isHovered = hoveredIndex === index
              const opacity = hoveredIndex !== null ? (isHovered ? 1 : 0.45) : 1

              return (
                <g key={row.label} style={{ opacity, transition: 'opacity 0.15s ease' }}>
                  {barHeight > 0 ? (
                    <rect
                      className="admin-analytics-chart-bar"
                      fill={gradId}
                      filter={isHovered ? 'drop-shadow(0 2px 5px rgba(0,0,0,0.22))' : undefined}
                      height={barHeight}
                      rx="4"
                      ry="4"
                      width={barWidth}
                      x={points[index].x - barWidth / 2}
                      y={bottom - barHeight}
                    />
                  ) : (
                    <rect
                      className="admin-analytics-chart-bar"
                      fill={isHovered ? lineColor : '#e2dce0'}
                      height="2"
                      rx="1"
                      ry="1"
                      width={barWidth}
                      x={points[index].x - barWidth / 2}
                      y={bottom - 2}
                    />
                  )}
                </g>
              )
            })
          )}

          {rows.map((_, index) => {
            const slotX = left + index * slotWidth
            return (
              <rect
                className="admin-chart-hover-zone"
                fill="transparent"
                height={bottom - top}
                key={`hit-${index}`}
                onMouseEnter={() => setHoveredIndex(index)}
                onMouseMove={() => setHoveredIndex(index)}
                width={slotWidth}
                x={slotX}
                y={top}
              />
            )
          })}
        </svg>

        {hoveredIndex !== null && activeRow && activePoint && (
          <div
            className={`admin-chart-tooltip ${activePoint.y < 55 ? 'is-flipped' : ''}`}
            style={{
              left: `clamp(65px, ${(activePoint.x / width) * 100}%, calc(100% - 65px))`,
              top: `${(activePoint.y / height) * 100}%`,
            }}
          >
            <div className="admin-chart-tooltip-header">
              <span className="admin-chart-tooltip-badge" style={{ backgroundColor: activeColor }} />
              <span className="admin-chart-tooltip-title">{activeRow.label}</span>
            </div>
            <div className="admin-chart-tooltip-body">
              <strong>{activeRow.value}</strong>
              <span>{getChartUnitLabel(title, activeRow.value)}</span>
            </div>
            {totalVal > 0 && activeRow.value > 0 && (
              <div className="admin-chart-tooltip-percent">
                {Math.round((activeRow.value / totalVal) * 100)}% of period total
              </div>
            )}
          </div>
        )}

        <div
          className="admin-analytics-chart-labels"
          style={{ gridTemplateColumns: `repeat(${Math.max(rows.length, 1)}, minmax(0, 1fr))` }}
        >
          {rows.map((row, index) => (
            <div
              className={`admin-analytics-chart-label ${hoveredIndex === index ? 'is-hovered' : ''}`}
              key={row.label}
              onMouseEnter={() => setHoveredIndex(index)}
            >
              <span
                className="admin-chart-label-text"
                style={{ fontSize: rows.length > 10 ? '9.5px' : '10.5px' }}
                title={row.label}
              >
                {row.label}
              </span>
              <span
                className={`admin-chart-value-pill ${row.value > 0 ? 'has-value' : ''}`}
                style={{
                  minWidth: rows.length > 10 ? '18px' : '22px',
                  height: rows.length > 10 ? '18px' : '20px',
                  fontSize: rows.length > 10 ? '10px' : '11px',
                }}
              >
                {row.value}
              </span>
            </div>
          ))}
        </div>
      </div>
    </Card>
  )
}

function OrganizationStandingChart({ rows, total, organizations = [] }) {
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [hoveredStatus, setHoveredStatus] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')

  const radius = 52
  const circumference = 2 * Math.PI * radius
  const segments = rows.map((row) => ({
    ...row,
    percent: total ? Math.round((row.value / total) * 100) : 0,
    length: total ? (row.value / total) * circumference : 0,
  }))
  const positionedSegments = segments.map((segment, index) => ({
    ...segment,
    offset: -segments.slice(0, index).reduce((sum, previous) => sum + previous.length, 0),
  }))

  const activeCount = organizations.filter((o) => o.status === 'ACTIVE').length
  const pendingCount = organizations.filter((o) => o.status === 'PENDING').length
  const inactiveCount = organizations.filter((o) => o.status === 'INACTIVE').length
  const suspendedCount = organizations.filter((o) => o.status === 'SUSPENDED').length
  const accreditedCount = organizations.filter(
    (o) => (o.accreditationStatus || (o.status === 'ACTIVE' ? 'ACCREDITED' : 'PENDING')) === 'ACCREDITED'
  ).length
  const accreditationPercent = organizations.length
    ? Math.round((accreditedCount / organizations.length) * 100)
    : 0
  const totalOfficers = organizations.reduce((sum, o) => sum + (Number(o.memberCount) || 0), 0)
  const avgOfficers = organizations.length ? Math.round((totalOfficers / organizations.length) * 10) / 10 : 0
  const standingRate = organizations.length ? Math.round((activeCount / organizations.length) * 100) : 0

  const filteredOrgs = organizations.filter((org) => {
    const matchesStatus = statusFilter === 'ALL' || org.status === statusFilter
    const q = searchQuery.trim().toLowerCase()
    const matchesSearch =
      !q ||
      [org.name, org.acronym, org.category, org.college, org.adviser].some((f) =>
        String(f ?? '').toLowerCase().includes(q)
      )
    return matchesStatus && matchesSearch
  })

  const columns = [
    {
      key: 'name',
      label: 'Organization',
      render: (_, org) => (
        <div className="admin-standing-org-cell">
          <strong className="admin-standing-org-name">{org.name}</strong>
          <span className="admin-standing-org-acronym">{org.acronym}</span>
        </div>
      ),
    },
    {
      key: 'category',
      label: 'Category',
      render: (val) => <span className="admin-standing-cat-pill">{val || '—'}</span>,
    },
    {
      key: 'college',
      label: 'College / Academic Unit',
      render: (val) => <span className="admin-standing-college-cell">{val || '—'}</span>,
    },
    {
      key: 'adviser',
      label: 'Prepared Faculty Adviser',
      render: (val) => <span>{val || '—'}</span>,
    },
    {
      key: 'memberCount',
      label: 'Officers',
      render: (val) => (
        <span className="admin-standing-members-pill">
          <strong>{val ?? 0}</strong>
        </span>
      ),
    },
    {
      key: 'accreditationStatus',
      label: 'Accreditation',
      render: (val) => (
        <Badge tone={toneFor(val || 'ACCREDITED')}>{humanize(val || 'ACCREDITED')}</Badge>
      ),
    },
    {
      key: 'status',
      label: 'Standing',
      render: (val) => <Status value={val} />,
    },
  ]

  return (
    <Card className="admin-section-card admin-analytics-card admin-standing-card">
      <div className="admin-standing-header">
        <div>
          <h2>Organization standing &amp; accreditation roster</h2>
          <p className="admin-standing-subtitle">
            Institutional standing, official accreditation percentage, and active officer body breakdown across all campus organizations.
          </p>
        </div>
        <div className="admin-standing-filter-tabs">
          <button
            className={`admin-standing-tab ${statusFilter === 'ALL' ? 'active' : ''}`}
            onClick={() => setStatusFilter('ALL')}
            type="button"
          >
            All ({organizations.length})
          </button>
          <button
            className={`admin-standing-tab ${statusFilter === 'ACTIVE' ? 'active' : ''}`}
            onClick={() => setStatusFilter('ACTIVE')}
            type="button"
          >
            Active ({activeCount})
          </button>
          {pendingCount > 0 && (
            <button
              className={`admin-standing-tab ${statusFilter === 'PENDING' ? 'active' : ''}`}
              onClick={() => setStatusFilter('PENDING')}
              type="button"
            >
              Pending ({pendingCount})
            </button>
          )}
          <button
            className={`admin-standing-tab ${statusFilter === 'INACTIVE' ? 'active' : ''}`}
            onClick={() => setStatusFilter('INACTIVE')}
            type="button"
          >
            Inactive ({inactiveCount})
          </button>
          <button
            className={`admin-standing-tab ${statusFilter === 'SUSPENDED' ? 'active' : ''}`}
            onClick={() => setStatusFilter('SUSPENDED')}
            type="button"
          >
            Suspended ({suspendedCount})
          </button>
        </div>
      </div>

      <div className="admin-standing-overview-grid">
        <div className="admin-standing-donut-panel">
          <div className="admin-standing-donut-wrapper">
            <svg
              aria-label={`Organization standing. ${rows.map((row) => `${row.label}: ${row.value}`).join('; ')}`}
              className="admin-standing-donut"
              role="img"
              viewBox="0 0 140 140"
            >
              <circle className="admin-standing-donut-track" cx="70" cy="70" r={radius} />
              {positionedSegments.map((segment) => (
                <circle
                  className={`admin-standing-donut-segment admin-standing-${segment.label.toLowerCase()} ${hoveredStatus === segment.label ? 'highlighted' : ''}`}
                  cx="70"
                  cy="70"
                  key={segment.label}
                  onMouseEnter={() => setHoveredStatus(segment.label)}
                  onMouseLeave={() => setHoveredStatus(null)}
                  r={radius}
                  strokeDasharray={`${segment.length} ${circumference - segment.length}`}
                  strokeDashoffset={segment.offset}
                />
              ))}
              <text className="admin-standing-total" textAnchor="middle" x="70" y="67">
                {hoveredStatus ? (rows.find((r) => r.label === hoveredStatus)?.value ?? total) : total}
              </text>
              <text className="admin-standing-caption" textAnchor="middle" x="70" y="84">
                {hoveredStatus ? humanize(hoveredStatus) : 'organizations'}
              </text>
            </svg>

            <ul className="admin-standing-legend">
              {segments.map((segment) => (
                <li
                  className={`admin-standing-legend-item ${hoveredStatus === segment.label ? 'highlighted' : ''} ${statusFilter === segment.label ? 'selected' : ''}`}
                  key={segment.label}
                  onClick={() => setStatusFilter(statusFilter === segment.label ? 'ALL' : segment.label)}
                  onMouseEnter={() => setHoveredStatus(segment.label)}
                  onMouseLeave={() => setHoveredStatus(null)}
                  role="button"
                  tabIndex={0}
                  title={`Click to filter by ${segment.label}`}
                >
                  <span className={`admin-standing-swatch admin-standing-${segment.label.toLowerCase()}`} />
                  <span className="admin-standing-legend-name">{segment.label}</span>
                  <span className="admin-standing-legend-percent">{segment.percent}%</span>
                  <strong className="admin-standing-legend-value">{segment.value}</strong>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="admin-standing-kpi-grid">
          <div className="admin-standing-kpi-card">
            <span className="admin-standing-kpi-label">Good Standing Rate</span>
            <div className="admin-standing-kpi-value-row">
              <span className="admin-standing-kpi-val text-success">{standingRate}%</span>
              <span className="admin-standing-kpi-badge badge-success">Compliant</span>
            </div>
            <span className="admin-standing-kpi-hint">{activeCount} of {total} recognized orgs</span>
          </div>

          <div className="admin-standing-kpi-card">
            <span className="admin-standing-kpi-label">Accreditation Rate</span>
            <div className="admin-standing-kpi-value-row">
              <span className="admin-standing-kpi-val">{accreditedCount}</span>
              <span className="admin-standing-kpi-unit">/ {total}</span>
            </div>
            <span className="admin-standing-kpi-hint">{accreditationPercent}% University accredited</span>
          </div>

          <div className="admin-standing-kpi-card">
            <span className="admin-standing-kpi-label">Active Officer Footprint</span>
            <div className="admin-standing-kpi-value-row">
              <span className="admin-standing-kpi-val">{totalOfficers.toLocaleString()}</span>
              <span className="admin-standing-kpi-unit">officers</span>
            </div>
            <span className="admin-standing-kpi-hint">Enrolled across active rosters</span>
          </div>

          <div className="admin-standing-kpi-card">
            <span className="admin-standing-kpi-label">Mean Officers per Org</span>
            <div className="admin-standing-kpi-value-row">
              <span className="admin-standing-kpi-val">{avgOfficers}</span>
              <span className="admin-standing-kpi-unit">officers</span>
            </div>
            <span className="admin-standing-kpi-hint">Average officer council size</span>
          </div>
        </div>
      </div>

      <div className="admin-standing-roster-section">
        <div className="admin-standing-roster-toolbar">
          <div className="admin-standing-roster-heading">
            <h3>Recognized organizations standing roster</h3>
            <span className="admin-standing-roster-count">
              Showing {filteredOrgs.length} of {organizations.length} organizations
            </span>
          </div>
          <div className="admin-standing-search-wrap">
            <input
              aria-label="Search organizations standing"
              className="admin-standing-search-input"
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, acronym, category, college, adviser..."
              type="text"
              value={searchQuery}
            />
            {searchQuery && (
              <button
                aria-label="Clear search"
                className="admin-standing-search-clear"
                onClick={() => setSearchQuery('')}
                title="Clear search"
                type="button"
              >
                <Icon name="close" size={13} />
              </button>
            )}
          </div>
        </div>

        {filteredOrgs.length ? (
          <Table columns={columns} rows={filteredOrgs} useDataTable />
        ) : (
          <EmptyState
            description="Try selecting a different status filter or clearing your search query."
            title="No organizations match your filter"
          />
        )}
      </div>
    </Card>
  )
}

function AdminDashboard({ data }) {
  const [selected, setSelected] = useState(null)
  const pendingApplications = data.organizationApplications.filter((item) => item.status === 'PENDING').length
  const pendingEvents = data.officerEvents.filter((item) =>
    ['SUBMITTED', 'UNDER_REVIEW', 'PENDING', 'APPROVED'].includes(item.status) && !item.isPublished && item.status !== 'PUBLISHED'
  ).length
  const activeAccounts = data.adminUsers.filter((item) => item.status === 'ACTIVE').length

  const pending = [
    ...data.organizationApplications
      .filter((item) => item.status === 'PENDING')
      .map((item) => ({ ...item, type: 'Organization application', title: item.name, organizationName: item.name })),
    ...data.officerEvents
      .filter((item) => ['SUBMITTED', 'UNDER_REVIEW', 'PENDING', 'APPROVED'].includes(item.status) && !item.adminApprovedAt)
      .map((item) => ({ ...item, type: 'Event proposal' })),
    ...data.adviserDocuments
      .filter((item) => ['PENDING', 'SUBMITTED', 'UNDER_REVIEW'].includes(item.status) || (item.adminReviewRequired && item.status === 'APPROVED'))
      .map((item) => ({ ...item, type: 'Document' })),
    ...data.adviserReports
      .filter((item) => item.status === 'PENDING_VERIFICATION')
      .map((item) => ({ ...item, title: item.eventTitle, type: 'Accomplishment report' })),
  ]
  const upcomingEvents = data.officerEvents
    .filter((item) => ['APPROVED', 'PUBLISHED', 'ONGOING'].includes(item.status))
    .slice(0, 6)

  return (
    <div className="admin-page">
      <PageHeader
        description="Global administrative oversight across all organizations, prepared adviser accounts, officer councils, events, and approvals."
        eyebrow="UNIDOS GLOBAL ADMINISTRATION"
        title="Admin Dashboard"
      >
        <div className="admin-metrics-grid">
          <Metric
            detail={`of ${data.adminOrganizations.length} total organizations`}
            label="Active Organizations"
            value={data.adminOrganizations.filter((item) => item.status === 'ACTIVE').length}
          />
          <Metric
            detail={`${(data.advisers || []).length} prepared faculty advisers`}
            label="Active Portal Accounts"
            value={activeAccounts.toLocaleString()}
          />
          <Metric label="Pending Organization Applications" value={pendingApplications} />
          <Metric label="Events Awaiting Review / Publish" value={pendingEvents} />
        </div>
      </PageHeader>

      <Card className="admin-section-card">
        <div className="admin-section-heading">
          <div>
            <h2>Work requiring attention</h2>
            <p>Global Admin access allows direct review across all campus modules.</p>
          </div>
          <Link className="button button-secondary" to="/admin/approvals">Open Approval Center</Link>
        </div>
        {pending.length ? (
          <Table
            columns={[
              { key: 'title', label: 'Item' },
              { key: 'type', label: 'Type' },
              { key: 'organizationName', label: 'Organization', render: (value, row) => value ?? row.name },
              { key: 'status', label: 'Status', render: (value) => <Status value={value} /> },
              {
                key: 'actions',
                label: 'Action',
                render: (_, item) => (
                  <Button onClick={() => setSelected(item)} variant="secondary">View</Button>
                ),
              },
            ]}
            rows={pending}
            useDataTable
          />
        ) : (
          <EmptyState description="Pending requests across campus will appear here." title="No pending approvals" />
        )}
      </Card>

      <RecordModal item={selected} onClose={() => setSelected(null)} />

      {data.adminNotifications.length > 0 && (
        <Card className="admin-section-card">
          <h2>System notifications</h2>
          {data.adminNotifications.slice(0, 4).map((notification) => (
            <div className="admin-activity-row" key={notification.id}>
              <strong>{notification.read ? 'Read' : 'New'}</strong>
              <span>{notification.message}</span>
              <small>{notification.createdAt}</small>
              {!notification.read && (
                <Button onClick={() => data.markAdminNotificationRead(notification.id)} variant="secondary">
                  Mark read
                </Button>
              )}
            </div>
          ))}
        </Card>
      )}

      <Card className="admin-section-card">
        <div className="admin-section-heading">
          <div>
            <h2>Recent system activity</h2>
            <p>Latest administrative and governance updates.</p>
          </div>
          <Link to="/admin/audit-logs">View audit log</Link>
        </div>
        {data.adminAuditLogs.slice(0, 4).map((log) => (
          <div className="admin-activity-row" key={log.id}>
            <strong>{log.action.replaceAll('_', ' ')}</strong>
            <span>{log.description}</span>
            <small>{log.timestamp}</small>
          </div>
        ))}
      </Card>

      <Card className="admin-section-card">
        <h2>Upcoming and approved events</h2>
        {upcomingEvents.length ? (
          <Table
            columns={[
              { key: 'title', label: 'Event' },
              { key: 'organizationName', label: 'Organization' },
              { key: 'date', label: 'Date' },
              { key: 'startTime', label: 'Time' },
              { key: 'location', label: 'Venue' },
              { key: 'status', label: 'Status', render: (value) => <Status value={value} /> },
            ]}
            rows={upcomingEvents}
            useDataTable
          />
        ) : (
          <EmptyState title="No scheduled events" />
        )}
      </Card>
    </div>
  )
}

export default function AdminPortalPage() {
  const { pathname } = useLocation()
  const data = useOutletContext()
  const { showToast } = useToast()

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('All')
  const [roleFilter, setRoleFilter] = useState('All')
  const [selected, setSelected] = useState(null)
  const [reason, setReason] = useState('')
  const [target, setTarget] = useState(null)
  const [organizationEdit, setOrganizationEdit] = useState(null)
  const [showCreateOrgModal, setShowCreateOrgModal] = useState(false)
  const [showPrepareAdviserModal, setShowPrepareAdviserModal] = useState(false)
  const [preparingMissing, setPreparingMissing] = useState(false)
  const [userChange, setUserChange] = useState(null)
  const [publishTarget, setPublishTarget] = useState(null)
  const [saveSettingsOpen, setSaveSettingsOpen] = useState(false)

  // Clean 1-month interval dropdown states for Analytics
  const [analyticsMonthInterval, setAnalyticsMonthInterval] = useState('ALL_12M')

  const [reportFilters, setReportFilters] = useState({
    college: 'All Colleges',
    category: 'All Categories',
    eventType: 'All Event Types',
  })
  const [settings, setSettings] = useState(() => ({
    ...data.adminSettings,
    organizationCategories:
      data.adminSettings?.organizationCategories ?? adminDefaultSettings.organizationCategories,
    notifications: {
      ...adminDefaultSettings.notifications,
      ...(data.adminSettings?.notifications || {}),
    },
  }))
  const [newCategory, setNewCategory] = useState('')

  useEffect(() => {
    if (data.adminSettings) {
      setSettings((current) => ({
        ...current,
        ...data.adminSettings,
        organizationCategories:
          data.adminSettings.organizationCategories ??
          current.organizationCategories ??
          adminDefaultSettings.organizationCategories,
        notifications: {
          ...adminDefaultSettings.notifications,
          ...(data.adminSettings.notifications || current.notifications || {}),
        },
      }))
    }
  }, [data.adminSettings])

  // Deduplicated live events strictly from database-backed officerEvents
  const orgEvents = useMemo(() => {
    const seen = new Set()
    const list = []
    for (const ev of data.officerEvents || []) {
      const key = String(ev.id)
      if (!seen.has(key)) {
        seen.add(key)
        list.push(ev)
      }
    }
    return list
  }, [data.officerEvents])

  const allAnalyticsDates = useMemo(() => {
    const dates = []
    orgEvents.forEach((e) => dates.push(e.startDatetime || e.date || e.createdAt))
    ;(data.studentRegistrations || []).forEach((r) => dates.push(r.checkInDate || r.registrationDate))
    ;(data.officerMembers || []).forEach((m) => dates.push(m.joinedDate || m.dateJoined))
    return dates
  }, [orgEvents, data.studentRegistrations, data.officerMembers])

  const monthIntervals = useMemo(
    () => buildOneMonthIntervals(allAnalyticsDates),
    [allAnalyticsDates]
  )

  const handleAddCategory = async () => {
    const category = newCategory.trim()
    if (!category) return
    const currentCats =
      settings.organizationCategories ??
      data.adminSettings?.organizationCategories ??
      adminDefaultSettings.organizationCategories
    if (currentCats.some((c) => c.toLowerCase() === category.toLowerCase())) {
      showToast(`Category "${category}" already exists.`, 'info')
      return
    }
    const updatedCategories = [...currentCats, category]
    const updatedSettings = { ...settings, organizationCategories: updatedCategories }
    setSettings(updatedSettings)
    setNewCategory('')
    const ok = await data.saveAdminSettings(updatedSettings)
    showToast(
      ok ? `Category "${category}" added and saved.` : `Category "${category}" added.`,
      ok ? 'success' : 'info'
    )
  }

  const handleRemoveCategory = async (catToRemove) => {
    const currentCats =
      settings.organizationCategories ??
      data.adminSettings?.organizationCategories ??
      adminDefaultSettings.organizationCategories
    const updatedCategories = currentCats.filter((item) => item !== catToRemove)
    const updatedSettings = { ...settings, organizationCategories: updatedCategories }
    setSettings(updatedSettings)
    const ok = await data.saveAdminSettings(updatedSettings)
    if (ok) {
      showToast(`Category "${catToRemove}" removed and saved.`, 'info')
    }
  }

  async function handleEnsureAllAdvisers() {
    setPreparingMissing(true)
    const res = await data.pregenerateMissingAdvisers()
    setPreparingMissing(false)
    if (!res?.ok) {
      showToast(res?.error || 'Unable to prepare missing adviser accounts.', 'error')
      return
    }
    showToast(
      res.createdCount > 0
        ? `Prepared ${res.createdCount} missing organization adviser account(s).`
        : 'All organizations already have prepared adviser accounts assigned.',
      'success'
    )
  }

  const matches = (
    record,
    keys = ['name', 'title', 'organizationName', 'userId', 'email', 'studentId', 'action', 'description']
  ) => {
    const query = search.trim().toLowerCase()
    return (
      (!query || keys.some((key) => String(record[key] ?? '').toLowerCase().includes(query))) &&
      (statusFilter === 'All' || record.status === statusFilter)
    )
  }

  const filteredApplications = data.organizationApplications.filter((item) => matches(item))
  const adviserChangeRequests = (data.adviserChangeRequests || []).map((req) => ({
    id: req.request_id,
    requestId: req.request_id,
    title: `${req.organization_name || 'Organization'} — Adviser Change Request`,
    name: req.organization_name || 'Organization',
    organizationName: req.organization_name || 'Organization',
    type: 'Adviser change request',
    submittedBy: req.requester_first_name
      ? `${req.requester_last_name}, ${req.requester_first_name}`
      : 'Organization Officer',
    submittedDate: req.created_at
      ? new Date(req.created_at).toLocaleDateString('en-US', {
          month: 'long',
          day: 'numeric',
          year: 'numeric',
        })
      : '',
    reason: req.reason,
    status: req.status || 'PENDING',
    entityKind: 'adviser_change',
    canReview: req.status === 'PENDING',
  }))

  async function decideAdviserChange(item, decision, comment) {
    const mappedStatus = decision === 'APPROVED' ? 'APPROVED' : 'REJECTED'
    const ok = await data.reviewAdviserChangeRequest(item.id, mappedStatus, comment)
    if (ok) showToast(`Adviser change request ${mappedStatus.toLowerCase()}.`, 'success')
    return ok
  }

  async function decideApplication(item, decision, comment) {
    const ok = await data.reviewOrganizationApplication(item.id, decision, comment)
    if (ok) showToast(`Organization application ${decision.toLowerCase()}.`, 'success')
    return ok
  }

  async function decideEvent(item, decision, comment) {
    const ok = await data.reviewAdminEvent(item.id, decision, comment)
    if (ok) showToast(`Event proposal ${decision.toLowerCase()}.`, 'success')
    return ok
  }

  async function decideDocument(item, decision, comment) {
    const ok = await data.reviewAdminDocument(item.id, decision, comment)
    if (ok) showToast(`Document ${decision.toLowerCase()}.`, 'success')
    return ok
  }

  if (pathname.endsWith('/dashboard')) return <AdminDashboard data={data} />

  if (pathname.endsWith('/users')) {
    const rows = data.adminUsers
      .filter((item) => item.role !== 'Student')
      .filter((item) => roleFilter === 'All' || item.role === roleFilter)
      .filter((item) => matches(item))

    return (
      <div className="admin-page">
        <PageHeader
          actions={
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              <Button disabled={preparingMissing} onClick={handleEnsureAllAdvisers} variant="outline">
                {preparingMissing ? 'Checking…' : 'Ensure All Org Advisers'}
              </Button>
              <Button onClick={() => setShowPrepareAdviserModal(true)} variant="primary">
                <Icon name="plus" size={14} /> Prepare Adviser Account
              </Button>
            </div>
          }
          description="Manage global Admin, Prepared Faculty Adviser, Coordinator, and Organization Officer accounts."
          eyebrow="UNIDOS ADMINISTRATION"
          title="Users & Adviser Accounts"
        />
        <FilterBar search={search} setSearch={setSearch}>
          <label className="admin-filter-field">
            <span>Role</span>
            <select onChange={(e) => setRoleFilter(e.target.value)} value={roleFilter}>
              <option value="All">All Roles</option>
              {roleOptions.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </label>
          <FilterSelect
            label="Account status"
            onChange={setStatusFilter}
            options={['All', 'ACTIVE', 'INACTIVE', 'SUSPENDED']}
            value={statusFilter}
          />
        </FilterBar>
        <Card className="admin-section-card">
          {rows.length ? (
            <Table
              columns={[
                { key: 'name', label: 'Name', render: (value, row) => formatDisplayName(row) || value },
                { key: 'userId', label: 'ID' },
                { key: 'email', label: 'Email' },
                {
                  key: 'role',
                  label: 'Role',
                  render: (value, row) => (
                    <select
                      aria-label={`Role for ${formatDisplayName(row)}`}
                      disabled={row.id === 'admin-root'}
                      onChange={(event) => setUserChange({ user: row, changes: { role: event.target.value } })}
                      value={roleOptions.includes(value) ? value : 'Organization Officer'}
                    >
                      {roleOptions.map((role) => (
                        <option key={role}>{role}</option>
                      ))}
                    </select>
                  ),
                },
                {
                  key: 'status',
                  label: 'Status',
                  render: (value, row) => (
                    <select
                      aria-label={`Status for ${formatDisplayName(row)}`}
                      disabled={row.id === 'admin-root'}
                      onChange={(event) => setUserChange({ user: row, changes: { status: event.target.value } })}
                      value={value}
                    >
                      {['ACTIVE', 'INACTIVE', 'SUSPENDED'].map((status) => (
                        <option key={status} value={status}>{humanize(status)}</option>
                      ))}
                    </select>
                  ),
                },
                {
                  key: 'organization',
                  label: 'Assigned Organization',
                  render: (value, row) => {
                    if (value && value !== '—' && value !== 'Unassigned') return value
                    const advised = data.adminOrganizations.filter(
                      (org) =>
                        (row.email && org.adviserEmail && org.adviserEmail.toLowerCase() === row.email.toLowerCase()) ||
                        (row.id && String(org.adviserUserId) === String(row.id))
                    )
                    if (advised.length > 0) {
                      return advised.map((o) => `${o.acronym || o.name} (Adviser)`).join(', ')
                    }
                    const activeMemberships = (data.studentMemberships || []).filter(
                      (m) =>
                        m.status === 'ACTIVE' &&
                        ((row.userId && String(m.studentId).toLowerCase() === String(row.userId).toLowerCase()) ||
                          (row.id && String(m.userId) === String(row.id)))
                    )
                    if (activeMemberships.length > 0) {
                      return activeMemberships
                        .map((m) => `${m.organizationName || m.organizationId} (${m.position || 'Officer'})`)
                        .join(', ')
                    }
                    return value || 'Global / Unassigned'
                  },
                },
                { key: 'lastActivity', label: 'Last Activity' },
              ]}
              rows={rows}
              useDataTable
            />
          ) : (
            <EmptyState title="No matching user accounts" />
          )}
        </Card>

        <RecordModal item={selected} onClose={() => setSelected(null)} />

        <PrepareAdviserModal
          departments={data.academicDepartments}
          onClose={() => setShowPrepareAdviserModal(false)}
          onCreate={async (payload) => {
            const res = await data.createAdviserAccount(payload)
            if (res?.ok) {
              showToast(`Prepared Faculty Adviser account (${payload.email}).`, 'success')
            }
            return res
          }}
          open={showPrepareAdviserModal}
          organizations={data.adminOrganizations}
        />

        <Modal onClose={() => setUserChange(null)} open={Boolean(userChange)} size="sm" title="Confirm account change">
          {userChange && (
            <>
              <p>Apply this access change for <strong>{formatDisplayName(userChange.user)}</strong>?</p>
              <p>{Object.entries(userChange.changes).map(([key, value]) => `${key}: ${value}`).join(' · ')}</p>
              <div className="modal-actions">
                <Button onClick={() => setUserChange(null)} variant="secondary">Cancel</Button>
                <Button
                  onClick={async () => {
                    const result = await data.updateAdminUser(userChange.user.id, userChange.changes)
                    showToast(
                      result?.ok ? 'User account updated.' : result?.reason || 'Unable to update user.',
                      result?.ok ? 'success' : 'error'
                    )
                    if (result?.ok) setUserChange(null)
                  }}
                >
                  Confirm change
                </Button>
              </div>
            </>
          )}
        </Modal>
      </div>
    )
  }

  if (pathname.endsWith('/organizations')) {
    return (
      <div className="admin-page">
        <PageHeader
          description="Global oversight of accreditation, prepared advisers, and institutional standing for all campus organizations."
          eyebrow="UNIDOS ADMINISTRATION"
          title="Organizations"
        />
        <FilterBar search={search} setSearch={setSearch}>
          <FilterSelect
            label="Status"
            onChange={setStatusFilter}
            options={['All', 'ACTIVE', 'PENDING', 'INACTIVE', 'SUSPENDED']}
            value={statusFilter}
          />
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <Button onClick={() => setShowPrepareAdviserModal(true)} variant="secondary">
              <Icon name="shield" size={14} /> Prepare Adviser
            </Button>
            <Button onClick={() => setShowCreateOrgModal(true)} variant="primary">
              <Icon name="plus" size={14} /> Add Organization
            </Button>
          </div>
        </FilterBar>
        <Card className="admin-section-card">
          {data.adminOrganizations.filter((item) => matches(item, ['name', 'acronym', 'category', 'adviser', 'status'])).length ? (
            <Table
              columns={[
                { key: 'name', label: 'Organization' },
                { key: 'acronym', label: 'Acronym' },
                { key: 'category', label: 'Category' },
                { key: 'adviser', label: 'Prepared Adviser' },
                { key: 'memberCount', label: 'Officers' },
                { key: 'status', label: 'Status', render: (value) => <Status value={value} /> },
                { key: 'accreditationStatus', label: 'Accreditation' },
                {
                  key: 'actions',
                  label: 'Actions',
                  render: (_, item) => (
                    <div className="admin-row-actions">
                      <Button onClick={() => setSelected(item)} variant="secondary">View</Button>
                      <Button onClick={() => setOrganizationEdit(item)} variant="secondary">Edit</Button>
                      <Button
                        onClick={() => {
                          setTarget(item)
                          setReason('')
                        }}
                        variant={item.status === 'SUSPENDED' ? 'secondary' : 'danger'}
                      >
                        {item.status === 'SUSPENDED' ? 'Reactivate' : 'Suspend'}
                      </Button>
                    </div>
                  ),
                },
              ]}
              rows={data.adminOrganizations.filter((item) =>
                matches(item, ['name', 'acronym', 'category', 'adviser', 'status'])
              )}
              useDataTable
            />
          ) : (
            <EmptyState title="No organizations found" />
          )}
        </Card>

        <Modal
          onClose={() => setTarget(null)}
          open={Boolean(target)}
          size="sm"
          title={target?.status === 'SUSPENDED' ? 'Reactivate organization' : 'Suspend organization'}
          tone={target?.status === 'SUSPENDED' ? 'success' : 'danger'}
        >
          {target && (
            <>
              <p>
                Change <strong>{target.name}</strong> status?
                {target.status !== 'SUSPENDED' && (
                  <label className="admin-modal-label">
                    Reason for suspension
                    <textarea onChange={(event) => setReason(event.target.value)} value={reason} />
                  </label>
                )}
              </p>
              <div className="modal-actions">
                <Button onClick={() => setTarget(null)} variant="secondary">Cancel</Button>
                <Button
                  onClick={async () => {
                    const next = target?.status === 'SUSPENDED' ? 'ACTIVE' : 'SUSPENDED'
                    const ok = target && (await data.updateAdminOrganizationStatus(target.id, next, reason))
                    if (ok) {
                      showToast(`Organization ${next.toLowerCase()}.`, 'success')
                      setTarget(null)
                    } else {
                      showToast('Unable to update organization status.', 'error')
                    }
                  }}
                >
                  Confirm
                </Button>
              </div>
            </>
          )}
        </Modal>

        <OrganizationEditModal
          categories={data.adminSettings?.organizationCategories ?? adminDefaultSettings.organizationCategories}
          key={organizationEdit?.id ?? 'closed'}
          onClose={() => setOrganizationEdit(null)}
          onSave={async (changes) => {
            const ok = organizationEdit && (await data.updateAdminOrganization(organizationEdit.id, changes))
            if (ok) {
              showToast('Organization details updated.', 'success')
              setOrganizationEdit(null)
            } else {
              showToast('Complete all organization fields before saving.', 'error')
            }
          }}
          organization={organizationEdit}
        />

        <OrganizationCreateModal
          advisers={data.advisers}
          categories={data.adminSettings?.organizationCategories ?? adminDefaultSettings.organizationCategories}
          colleges={data.academicColleges}
          departments={data.academicDepartments}
          onClose={() => setShowCreateOrgModal(false)}
          onCreate={async (newOrg) => {
            const res = await data.createAdminOrganization(newOrg)
            if (res?.ok) {
              showToast('Organization created successfully.', 'success')
              setShowCreateOrgModal(false)
            }
            return res
          }}
          open={showCreateOrgModal}
        />

        <PrepareAdviserModal
          departments={data.academicDepartments}
          onClose={() => setShowPrepareAdviserModal(false)}
          onCreate={async (payload) => {
            const res = await data.createAdviserAccount(payload)
            if (res?.ok) {
              showToast(`Prepared Faculty Adviser account (${payload.email}).`, 'success')
            }
            return res
          }}
          open={showPrepareAdviserModal}
          organizations={data.adminOrganizations}
        />

        <RecordModal item={selected} onClose={() => setSelected(null)} />
      </div>
    )
  }

  if (pathname.endsWith('/organization-applications')) {
    return (
      <div className="admin-page">
        <PageHeader
          description="Review recognition submissions and accreditation documents."
          eyebrow="UNIDOS ADMINISTRATION"
          title="Organization Applications"
        />
        <FilterBar search={search} setSearch={setSearch}>
          <FilterSelect
            label="Status"
            onChange={setStatusFilter}
            options={['All', 'PENDING', 'APPROVED', 'RETURNED', 'REJECTED']}
            value={statusFilter}
          />
        </FilterBar>
        <Card className="admin-section-card">
          {filteredApplications.length ? (
            <Table
              columns={[
                { key: 'name', label: 'Organization' },
                { key: 'acronym', label: 'Acronym' },
                { key: 'submittedBy', label: 'Submitted by' },
                { key: 'submittedDate', label: 'Date submitted' },
                { key: 'status', label: 'Status', render: (value) => <Status value={value} /> },
                {
                  key: 'actions',
                  label: 'Actions',
                  render: (_, item) => (
                    <div className="admin-row-actions">
                      <Button onClick={() => setSelected({ ...item, title: item.name })} variant="secondary">View</Button>
                      <Button onClick={() => setSelected({ ...item, title: item.name, __application: true })}>Review</Button>
                    </div>
                  ),
                },
              ]}
              rows={filteredApplications}
              useDataTable
            />
          ) : (
            <EmptyState title="No applications found" />
          )}
        </Card>
        <RecordModal
          canDecide={Boolean(selected?.__application)}
          decisionLabels={{
            APPROVED: 'Approve accreditation',
            RETURNED: 'Return for revision',
            REJECTED: 'Reject application',
          }}
          item={selected}
          onClose={() => setSelected(null)}
          onDecision={(decision, comment) => decideApplication(selected, decision, comment)}
        />
      </div>
    )
  }

  if (pathname.endsWith('/events')) {
    const rows = orgEvents.filter((item) =>
      matches(item, ['title', 'organizationName', 'status', 'category', 'complianceFileName'])
    )
    return (
      <div className="admin-page">
        <PageHeader
          description="Global Admin access over all campus events, compliance files, participant caps, and publication."
          eyebrow="UNIDOS ADMINISTRATION"
          title="Campus Events"
        />
        <FilterBar search={search} setSearch={setSearch}>
          <FilterSelect
            label="Status"
            onChange={setStatusFilter}
            options={[
              'All',
              'DRAFT',
              'SUBMITTED',
              'UNDER_REVIEW',
              'APPROVED',
              'PUBLISHED',
              'ONGOING',
              'COMPLETED',
              'ARCHIVED',
              'RETURNED_FOR_REVISION',
              'REJECTED',
            ]}
            value={statusFilter}
          />
        </FilterBar>
        <Card className="admin-section-card">
          {rows.length ? (
            <Table
              columns={[
                { key: 'title', label: 'Event' },
                { key: 'organizationName', label: 'Organization' },
                { key: 'date', label: 'Date' },
                {
                  key: 'complianceFileName',
                  label: 'Compliance Document',
                  render: (val, row) => val || row.supportingDocuments?.[0] || '—',
                },
                {
                  key: 'capacity',
                  label: 'Participants',
                  render: (val, row) => `${row.registrations ?? row.registeredCount ?? 0} / ${val ?? 100}`,
                },
                { key: 'status', label: 'Status', render: (value) => <Status value={value} /> },
                {
                  key: 'actions',
                  label: 'Actions',
                  render: (_, item) => (
                    <div className="admin-row-actions">
                      <Button onClick={() => setSelected(item)} variant="secondary">View</Button>
                      {!['PUBLISHED', 'COMPLETED', 'ARCHIVED'].includes(item.status) && (
                        <Button onClick={() => setSelected({ ...item, __event: true })}>Review</Button>
                      )}
                      {item.status === 'APPROVED' && (
                        <Button onClick={() => setPublishTarget(item)} variant="primary">Publish</Button>
                      )}
                    </div>
                  ),
                },
              ]}
              rows={rows}
              useDataTable
            />
          ) : (
            <EmptyState title="No campus events found" />
          )}
        </Card>
        <RecordModal
          canDecide={Boolean(selected?.__event)}
          decisionLabels={{
            APPROVED: 'Approve event',
            RETURNED: 'Return for revision',
            REJECTED: 'Reject proposal',
          }}
          item={selected}
          onClose={() => setSelected(null)}
          onDecision={(decision, comment) => decideEvent(selected, decision, comment)}
        />
        <ConfirmDialog
          confirmLabel="Publish event"
          message={`Publish "${publishTarget?.title ?? 'this event'}" to the public UNIDOS directory?`}
          onCancel={() => setPublishTarget(null)}
          onConfirm={async () => {
            const ok = await data.publishAdminEvent(publishTarget.id)
            setPublishTarget(null)
            showToast(
              ok ? 'Event published to the campus directory.' : 'Event cannot be published yet.',
              ok ? 'success' : 'error'
            )
          }}
          open={Boolean(publishTarget)}
          title="Publish event"
          tone="success"
        />
      </div>
    )
  }

  if (pathname.endsWith('/approvals')) {
    const approvals = [
      ...data.organizationApplications.map((item) => ({
        ...item,
        title: item.name,
        type: 'Organization application',
        entityKind: 'application',
        canReview: item.status !== 'APPROVED',
      })),
      ...adviserChangeRequests,
      ...orgEvents
        .filter((item) => item.status !== 'DRAFT')
        .map((item) => ({
          ...item,
          type: 'Event proposal',
          entityKind: 'event',
          canReview: !['PUBLISHED', 'COMPLETED', 'ARCHIVED'].includes(item.status),
        })),
      ...data.adviserDocuments.map((item) => ({
        ...item,
        title: item.title,
        type: 'Document review',
        entityKind: 'document',
        canReview: true,
      })),
    ].filter((item) => matches(item, ['title', 'name', 'organizationName', 'type', 'status', 'complianceFileName']))

    return (
      <div className="admin-page">
        <PageHeader
          description="Global approval queue for cross-campus organization applications, adviser change requests, event proposals, and compliance documents."
          eyebrow="UNIDOS ADMINISTRATION"
          title="Approval Center"
        />
        <FilterBar search={search} setSearch={setSearch}>
          <select
            aria-label="Filter approvals by status"
            onChange={(event) => setStatusFilter(event.target.value)}
            value={statusFilter}
          >
            {['All', 'PENDING', 'SUBMITTED', 'APPROVED', 'RETURNED', 'REJECTED'].map((value) => (
              <option key={value} value={value}>
                {value === 'All' ? value : value.replace('_', ' ')}
              </option>
            ))}
          </select>
        </FilterBar>
        <Card className="admin-section-card">
          {approvals.length ? (
            <Table
              columns={[
                { key: 'title', label: 'Request' },
                { key: 'type', label: 'Type' },
                { key: 'organizationName', label: 'Organization', render: (value, row) => value ?? row.name },
                {
                  key: 'submittedBy',
                  label: 'Submitted by',
                  render: (value, row) => value ?? row.submittedBy ?? 'Organization officer',
                },
                { key: 'status', label: 'Status', render: (value) => <Status value={value} /> },
                {
                  key: 'actions',
                  label: 'Actions',
                  render: (_, item) => (
                    <div className="admin-row-actions">
                      <Button onClick={() => setSelected(item)} variant="secondary">View</Button>
                      {item.canReview && (
                        <Button onClick={() => setSelected({ ...item, __approval: item.entityKind })}>Review</Button>
                      )}
                    </div>
                  ),
                },
              ]}
              rows={approvals}
              useDataTable
            />
          ) : (
            <EmptyState title="No approvals found" />
          )}
        </Card>
        <RecordModal
          canDecide={Boolean(selected?.__approval)}
          item={selected}
          onClose={() => setSelected(null)}
          onDecision={(decision, comment) =>
            selected?.__approval === 'application'
              ? decideApplication(selected, decision, comment)
              : selected?.__approval === 'adviser_change'
                ? decideAdviserChange(selected, decision, comment)
                : selected?.__approval === 'event'
                  ? decideEvent(selected, decision, comment)
                  : selected?.__approval === 'document'
                    ? decideDocument(selected, decision, comment)
                    : false
          }
        />
      </div>
    )
  }

  if (pathname.endsWith('/documents')) {
    const rows = data.adviserDocuments.filter((item) =>
      matches(item, ['title', 'organizationName', 'type', 'status'])
    )
    return (
      <div className="admin-page">
        <PageHeader
          description="Global Admin review access across all organization compliance documents and reports."
          eyebrow="UNIDOS ADMINISTRATION"
          title="Documents"
        />
        <FilterBar search={search} setSearch={setSearch}>
          <select
            aria-label="Filter document status"
            onChange={(event) => setStatusFilter(event.target.value)}
            value={statusFilter}
          >
            <option>All</option>
            {['PENDING', 'APPROVED', 'RETURNED', 'REJECTED'].map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </FilterBar>
        <Card className="admin-section-card">
          {rows.length ? (
            <Table
              columns={[
                { key: 'title', label: 'Document' },
                { key: 'type', label: 'Type' },
                { key: 'organizationName', label: 'Organization' },
                { key: 'submittedDate', label: 'Submitted' },
                { key: 'status', label: 'Status', render: (value) => <Status value={value} /> },
                {
                  key: 'actions',
                  label: 'Actions',
                  render: (_, item) => (
                    <div className="admin-row-actions">
                      <Button onClick={() => setSelected(item)} variant="secondary">View</Button>
                      <Button onClick={() => setSelected({ ...item, __document: true })}>Review</Button>
                    </div>
                  ),
                },
              ]}
              rows={rows}
              useDataTable
            />
          ) : (
            <EmptyState description="Submitted compliance documents across campus will appear here." title="No documents found" />
          )}
        </Card>
        <RecordModal
          canDecide={Boolean(selected?.__document)}
          item={selected}
          onClose={() => setSelected(null)}
          onDecision={(decision, comment) => decideDocument(selected, decision, comment)}
        />
      </div>
    )
  }

  if (pathname.endsWith('/reports')) {
    const organizationById = (id) =>
      data.adminOrganizations.find((organization) => String(organization.id) === String(id))
    const activeOfficersCount = (data.officerMembers || []).filter((m) => m.status === 'ACTIVE').length
    const uniqueParticipantsCount = new Set(
      (data.studentRegistrations || [])
        .filter((r) => r.status !== 'CANCELLED')
        .map((r) => r.studentId)
        .filter(Boolean)
    ).size

    const allReportRows = [
      ...data.adminOrganizations.map((item) => ({
        type: 'Organization',
        name: item.name,
        status: item.status,
        count: item.memberCount ?? 0,
        organizationId: item.id,
        category: item.category,
        college: item.college,
      })),
      ...orgEvents.map((item) => ({
        type: 'Event',
        name: item.title,
        status: item.status,
        count: item.registrations ?? item.registeredCount ?? 0,
        organizationId: item.organizationId,
        category: organizationById(item.organizationId)?.category,
        college: organizationById(item.organizationId)?.college,
        eventCategory: item.category,
      })),
      ...data.adviserReports.map((item) => ({
        type: 'Accomplishment report',
        name: item.eventTitle,
        status: item.status,
        count: item.attendance ?? 0,
        organizationId: item.organizationId,
        category: organizationById(item.organizationId)?.category,
        college: organizationById(item.organizationId)?.college,
      })),
    ]
    const reportRows = allReportRows.filter(
      (item) =>
        matches(item, ['type', 'name', 'status']) &&
        (reportFilters.category === 'All Categories' || item.category === reportFilters.category) &&
        (reportFilters.college === 'All Colleges' || item.college === reportFilters.college) &&
        (reportFilters.eventType === 'All Event Types' || item.eventCategory === reportFilters.eventType)
    )

    return (
      <div className="admin-page">
        <PageHeader
          description="Export institutional records for administrative compliance review."
          eyebrow="UNIDOS ADMINISTRATION"
          title="Reports"
        >
          <div className="admin-metrics-grid">
            <Metric
              label="Total Accredited Organizations"
              value={data.adminOrganizations.filter((o) => o.status === 'ACTIVE').length}
            />
            <Metric label="Active Organization Officers" value={activeOfficersCount} />
            <Metric label="Total Events Recorded" value={orgEvents.length} />
            <Metric label="Unique Event Participants" value={uniqueParticipantsCount} />
          </div>
        </PageHeader>

        <div className="admin-report-actions">
          <Button
            onClick={() =>
              showToast(
                downloadCsv('unidos-campus-report.csv', reportRows)
                  ? 'CSV report downloaded.'
                  : 'There is no report data to export.',
                reportRows.length ? 'success' : 'error'
              )
            }
          >
            Download CSV
          </Button>
          <Button
            onClick={() =>
              showToast(
                downloadExcel('unidos-campus-report.xls', reportRows)
                  ? 'Excel-compatible report downloaded.'
                  : 'There is no report data to export.',
                reportRows.length ? 'success' : 'error'
              )
            }
            variant="secondary"
          >
            Download Excel
          </Button>
        </div>

        <FilterBar search={search} setSearch={setSearch}>
          <select
            aria-label="Filter report status"
            onChange={(event) => setStatusFilter(event.target.value)}
            value={statusFilter}
          >
            <option>All</option>
            {[...new Set(allReportRows.map((row) => row.status).filter(Boolean))].map((value) => (
              <option key={value} value={value}>{value.replace(/_/g, ' ')}</option>
            ))}
          </select>
          <select aria-label="Filter academic year">
            <option>{data.adminSettings.academicYear}</option>
          </select>
          <select aria-label="Filter semester">
            <option>{data.adminSettings.semester}</option>
          </select>
          <select
            aria-label="Filter college"
            onChange={(event) => setReportFilters((current) => ({ ...current, college: event.target.value }))}
            value={reportFilters.college}
          >
            {['All Colleges', ...new Set((data.academicColleges || []).map((col) => col.name))].map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
          <select
            aria-label="Filter organization category"
            onChange={(event) => setReportFilters((current) => ({ ...current, category: event.target.value }))}
            value={reportFilters.category}
          >
            {['All Categories', ...new Set(data.adminOrganizations.map((organization) => organization.category))].map(
              (value) => (
                <option key={value}>{value}</option>
              )
            )}
          </select>
          <select
            aria-label="Filter event type"
            onChange={(event) => setReportFilters((current) => ({ ...current, eventType: event.target.value }))}
            value={reportFilters.eventType}
          >
            {['All Event Types', ...new Set(orgEvents.map((event) => event.category).filter(Boolean))].map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </FilterBar>

        <Card className="admin-section-card">
          {reportRows.length ? (
            <Table
              columns={[
                { key: 'type', label: 'Record type' },
                { key: 'name', label: 'Name' },
                { key: 'status', label: 'Status', render: (value) => <Status value={value} /> },
                { key: 'count', label: 'Officers / registrations' },
              ]}
              rows={reportRows}
              useDataTable
            />
          ) : (
            <EmptyState title="No report records" />
          )}
        </Card>
      </div>
    )
  }

  if (pathname.endsWith('/analytics')) {
    const orgTotal = data.adminOrganizations.length
    const activeOrgsCount = data.adminOrganizations.filter((item) => item.status === 'ACTIVE').length
    const approvedOrPublishedEvents = orgEvents.filter((item) =>
      ['APPROVED', 'PUBLISHED', 'ONGOING', 'COMPLETED'].includes(item.status)
    )
    const activeOfficersCount = (data.officerMembers || []).filter((m) => m.status === 'ACTIVE').length
    const validRegistrations = (data.studentRegistrations || []).filter((r) => r.status !== 'CANCELLED')
    const attendedRegistrations = validRegistrations.filter(
      (r) => r.attendanceStatus === 'ATTENDED' || r.status === 'ATTENDED' || r.status === 'COMPLETED'
    )
    const uniqueParticipantsCount = new Set(validRegistrations.map((r) => r.studentId).filter(Boolean)).size
    const turnoutPercent = validRegistrations.length
      ? Math.round((attendedRegistrations.length / validRegistrations.length) * 100)
      : 0

    const selectedMonthObj =
      analyticsMonthInterval === 'ALL_12M'
        ? null
        : monthIntervals.find((i) => i.key === analyticsMonthInterval) || null

    const isDateInSelectedMonth = (rawDate) => {
      if (!selectedMonthObj) return true
      const parsed = parseRecordDate(rawDate)
      return Boolean(parsed && parsed >= selectedMonthObj.startDate && parsed <= selectedMonthObj.endDate)
    }

    const periodEvents = orgEvents.filter((e) =>
      isDateInSelectedMonth(e.startDatetime || e.date || e.submittedDate || e.createdAt)
    )
    const periodAttended = attendedRegistrations.filter((r) =>
      isDateInSelectedMonth(r.checkInDate || r.registrationDate || r.checkInTime)
    )
    const periodRegistrations = validRegistrations.filter((r) =>
      isDateInSelectedMonth(r.registrationDate || r.checkInDate)
    )

    const stats = [
      {
        label: 'Active organizations',
        value: activeOrgsCount,
        detail: `of ${orgTotal} recognized campus orgs`,
      },
      {
        label: selectedMonthObj ? `Events (${selectedMonthObj.shortLabel})` : 'Approved & published events',
        value: selectedMonthObj ? periodEvents.length : approvedOrPublishedEvents.length,
        detail: selectedMonthObj ? `of ${orgEvents.length} total campus events` : `of ${orgEvents.length} total proposals`,
      },
      {
        label: 'Active organization officers',
        value: activeOfficersCount,
        detail: `${(data.advisers || []).length} prepared faculty advisers`,
      },
      {
        label: selectedMonthObj ? `Verified check-ins (${selectedMonthObj.shortLabel})` : 'Verified event turnout',
        value: selectedMonthObj ? periodAttended.length : `${turnoutPercent}%`,
        detail: selectedMonthObj
          ? `${periodRegistrations.length} registrations in interval`
          : `${attendedRegistrations.length} check-ins · ${uniqueParticipantsCount} unique participants`,
      },
    ]

    const orgById = new Map(data.adminOrganizations.map((org) => [String(org.id), org]))
    const categories = [...new Set(data.adminOrganizations.map((organization) => organization.category).filter(Boolean))]

    const standingStatuses = ['ACTIVE', 'PENDING', 'INACTIVE', 'SUSPENDED'].filter(
      (st) => st !== 'PENDING' || data.adminOrganizations.some((o) => o.status === 'PENDING')
    )
    const organizationStanding = standingStatuses.map((status) => ({
      label: status,
      value: data.adminOrganizations.filter((organization) => organization.status === status).length,
    }))

    const categoryRows = categories.map((cat) => {
      if (!selectedMonthObj) {
        return {
          label: cat,
          value: data.adminOrganizations.filter((org) => org.category === cat).length,
        }
      }
      const activeOrgIdsInMonth = new Set()
      periodEvents.forEach((ev) => {
        const parentOrg = orgById.get(String(ev.organizationId))
        if (parentOrg && parentOrg.category === cat) {
          activeOrgIdsInMonth.add(String(parentOrg.id))
        }
      })
      ;(data.officerAnnouncements || []).forEach((ann) => {
        if (isDateInSelectedMonth(ann.datePosted || ann.date)) {
          const parentOrg = orgById.get(String(ann.organizationId))
          if (parentOrg && parentOrg.category === cat) {
            activeOrgIdsInMonth.add(String(parentOrg.id))
          }
        }
      })
      return { label: cat, value: activeOrgIdsInMonth.size }
    })

    const chartTimeline = buildChartSlotsForInterval(analyticsMonthInterval, monthIntervals)

    const eventsCounts = {}
    orgEvents.forEach((event) => {
      const slotKey = findSlotForDate(
        event.startDatetime || event.date || event.submittedDate || event.createdAt,
        chartTimeline.slots
      )
      if (slotKey) {
        eventsCounts[slotKey] = (eventsCounts[slotKey] || 0) + 1
      }
    })
    const eventsChartData = chartTimeline.slots.map((slot) => ({
      label: slot.label,
      value: eventsCounts[slot.key] || 0,
    }))

    const attendanceCounts = {}
    attendedRegistrations.forEach((reg) => {
      const slotKey = findSlotForDate(
        reg.checkInDate || reg.checkInTime || reg.registrationDate,
        chartTimeline.slots
      )
      if (slotKey) {
        attendanceCounts[slotKey] = (attendanceCounts[slotKey] || 0) + 1
      }
    })
    const attendanceTrends = chartTimeline.slots.map((slot) => ({
      label: slot.label,
      value: attendanceCounts[slot.key] || 0,
    }))

    const officerOnboardingCounts = {}
    ;(data.officerMembers || []).forEach((member) => {
      const slotKey = findSlotForDate(
        member.joinedDate || member.approvedDate || member.dateJoined,
        chartTimeline.slots
      )
      if (slotKey) {
        officerOnboardingCounts[slotKey] = (officerOnboardingCounts[slotKey] || 0) + 1
      }
    })
    const membershipTrends = chartTimeline.slots.map((slot) => ({
      label: slot.label,
      value: officerOnboardingCounts[slot.key] || 0,
    }))

    const buildAnalyticsExportRows = () => {
      const periodLabel = selectedMonthObj ? selectedMonthObj.label : 'Last 12 Months (1-Month Intervals)'
      const rows = [
        {
          Section: 'KPI Summary',
          Interval: periodLabel,
          Metric_or_Entity: 'Active Organizations',
          Category_or_Status: 'ACTIVE',
          Value: activeOrgsCount,
          Total_or_Capacity: orgTotal,
          Notes: `${orgTotal ? Math.round((activeOrgsCount / orgTotal) * 100) : 0}% active standing`,
        },
        {
          Section: 'KPI Summary',
          Interval: periodLabel,
          Metric_or_Entity: 'Campus Events',
          Category_or_Status: 'APPROVED / PUBLISHED',
          Value: selectedMonthObj ? periodEvents.length : approvedOrPublishedEvents.length,
          Total_or_Capacity: orgEvents.length,
          Notes: 'Deduplicated database event records',
        },
        {
          Section: 'KPI Summary',
          Interval: periodLabel,
          Metric_or_Entity: 'Active Organization Officers',
          Category_or_Status: 'ACTIVE',
          Value: activeOfficersCount,
          Total_or_Capacity: (data.officerMembers || []).length,
          Notes: `${(data.advisers || []).length} prepared faculty advisers`,
        },
        {
          Section: 'KPI Summary',
          Interval: periodLabel,
          Metric_or_Entity: 'Verified Attendance Check-Ins',
          Category_or_Status: 'ATTENDED',
          Value: selectedMonthObj ? periodAttended.length : attendedRegistrations.length,
          Total_or_Capacity: selectedMonthObj ? periodRegistrations.length : validRegistrations.length,
          Notes: `${turnoutPercent}% overall verified turnout (${uniqueParticipantsCount} unique participants)`,
        },
      ]

      chartTimeline.slots.forEach((slot, idx) => {
        rows.push({
          Section: 'Interval Trend',
          Interval: slot.label,
          Metric_or_Entity: 'Events / Check-Ins / Officer Onboarding',
          Category_or_Status: selectedMonthObj ? 'Weekly Slice (1-Month Window)' : '1-Month Interval',
          Value: eventsChartData[idx]?.value ?? 0,
          Total_or_Capacity: attendanceTrends[idx]?.value ?? 0,
          Notes: `Events: ${eventsChartData[idx]?.value ?? 0} | Verified Check-Ins: ${attendanceTrends[idx]?.value ?? 0} | Officers Onboarded: ${membershipTrends[idx]?.value ?? 0}`,
        })
      })

      categoryRows.forEach((cat) => {
        rows.push({
          Section: 'Category Distribution',
          Interval: periodLabel,
          Metric_or_Entity: cat.label,
          Category_or_Status: 'Organization Category',
          Value: cat.value,
          Total_or_Capacity: orgTotal,
          Notes: selectedMonthObj ? 'Organizations active during selected 1-month interval' : 'Recognized organizations in category',
        })
      })

      data.adminOrganizations.forEach((org) => {
        rows.push({
          Section: 'Organization Roster',
          Interval: periodLabel,
          Metric_or_Entity: `${org.acronym ? `${org.acronym} — ` : ''}${org.name}`,
          Category_or_Status: org.status,
          Value: org.memberCount ?? 0,
          Total_or_Capacity: org.accreditationStatus || 'ACCREDITED',
          Notes: `Category: ${org.category || '—'} | Adviser: ${org.adviser || 'Prepared'}`,
        })
      })

      return rows
    }

    const exportSlug = selectedMonthObj ? selectedMonthObj.key : 'last-12-months'

    return (
      <div className="admin-page">
        <PageHeader
          actions={
            <div className="admin-analytics-toolbar">
              <MonthIntervalDropdown
                ariaLabel="Filter analytics by 1-month interval"
                intervals={monthIntervals}
                onChange={setAnalyticsMonthInterval}
                value={analyticsMonthInterval}
              />
              <Button
                onClick={() => {
                  const ok = downloadCsv(`unidos-analytics-${exportSlug}.csv`, buildAnalyticsExportRows())
                  showToast(ok ? 'Analytics CSV exported.' : 'No analytics rows to export.', ok ? 'success' : 'error')
                }}
                variant="secondary"
              >
                <Icon name="download" size={14} /> Export CSV
              </Button>
              <Button
                onClick={() => {
                  const ok = downloadExcel(`unidos-analytics-${exportSlug}.xls`, buildAnalyticsExportRows())
                  showToast(ok ? 'Analytics Excel (.xls) exported.' : 'No analytics rows to export.', ok ? 'success' : 'error')
                }}
                variant="primary"
              >
                <Icon name="download" size={14} /> Export Excel
              </Button>
            </div>
          }
          description="Reconciled institutional metrics across organizations, officer councils, events, and verified check-ins using clean 1-month intervals."
          eyebrow="UNIDOS ADMINISTRATION"
          title="Analytics"
        >
          <div className="admin-metrics-grid">
            {stats.map((stat) => (
              <Metric detail={stat.detail} key={stat.label} label={stat.label} value={stat.value} />
            ))}
          </div>
        </PageHeader>

        <div className="admin-analytics-grid">
          <AnalyticsChart
            filter={
              <MonthIntervalDropdown
                ariaLabel="Category interval"
                intervals={monthIntervals}
                onChange={setAnalyticsMonthInterval}
                value={analyticsMonthInterval}
              />
            }
            rows={categoryRows}
            title={
              selectedMonthObj
                ? `Active categories (${selectedMonthObj.shortLabel})`
                : 'Organization category distribution'
            }
            type="bar"
          />
          <AnalyticsChart
            filter={
              <MonthIntervalDropdown
                ariaLabel="Events interval"
                intervals={monthIntervals}
                onChange={setAnalyticsMonthInterval}
                value={analyticsMonthInterval}
              />
            }
            rows={eventsChartData}
            title={selectedMonthObj ? `Events in ${selectedMonthObj.shortLabel}` : 'Events per 1-month interval'}
            type="bar"
          />
          <AnalyticsChart
            filter={
              <MonthIntervalDropdown
                ariaLabel="Attendance interval"
                intervals={monthIntervals}
                onChange={setAnalyticsMonthInterval}
                value={analyticsMonthInterval}
              />
            }
            lineColor="#2563eb"
            rows={attendanceTrends}
            title={
              selectedMonthObj
                ? `Verified check-ins (${selectedMonthObj.shortLabel})`
                : 'Verified attendance trends (1-month)'
            }
            type="line"
          />
          <AnalyticsChart
            filter={
              <MonthIntervalDropdown
                ariaLabel="Officer onboarding interval"
                intervals={monthIntervals}
                onChange={setAnalyticsMonthInterval}
                value={analyticsMonthInterval}
              />
            }
            lineColor="#d97706"
            rows={membershipTrends}
            title={
              selectedMonthObj
                ? `Officer onboarding (${selectedMonthObj.shortLabel})`
                : 'Officer onboarding trends (1-month)'
            }
            type="line"
          />
        </div>

        <OrganizationStandingChart
          organizations={data.adminOrganizations}
          rows={organizationStanding}
          total={orgTotal}
        />
      </div>
    )
  }

  if (pathname.endsWith('/audit-logs')) {
    return <AuditLogTracker logs={data.adminAuditLogs} onRefresh={data.refreshAuditLogs} />
  }

  if (pathname.endsWith('/settings')) {
    return (
      <div className="admin-page">
        <PageHeader
          description="Update academic period, organization categories, and notification preferences."
          eyebrow="UNIDOS ADMINISTRATION"
          title="System Settings"
        />
        <Card className="admin-section-card admin-settings-form">
          <h2>System Information</h2>
          <p>
            <strong>UNIDOS</strong> — Student Organization Management System
            <br />
            Western Mindanao State University
          </p>
          <label>
            Academic year
            <input
              onChange={(event) =>
                setSettings((current) => ({ ...current, academicYear: event.target.value }))
              }
              value={settings.academicYear}
            />
          </label>
          <label>
            Current semester
            <select
              onChange={(event) =>
                setSettings((current) => ({ ...current, semester: event.target.value }))
              }
              value={settings.semester}
            >
              {['First Semester', 'Second Semester', 'Summer'].map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </label>
          <h2>Organization categories</h2>
          {(settings.organizationCategories ?? adminDefaultSettings.organizationCategories).map((category) => (
            <div className="admin-category-row" key={category}>
              <span>{category}</span>
              <Button onClick={() => handleRemoveCategory(category)} variant="danger">
                Remove
              </Button>
            </div>
          ))}
          <div className="admin-category-add">
            <input
              aria-label="New organization category"
              onChange={(event) => setNewCategory(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  handleAddCategory()
                }
              }}
              placeholder="Add a category"
              value={newCategory}
            />
            <Button onClick={handleAddCategory}>Add category</Button>
          </div>
          <h2>Notification preferences</h2>
          {Object.entries(settings.notifications || adminDefaultSettings.notifications).map(([key, checked]) => (
            <label className="admin-checkbox-row" key={key}>
              <input
                checked={Boolean(checked)}
                onChange={(event) =>
                  setSettings((current) => ({
                    ...current,
                    notifications: {
                      ...adminDefaultSettings.notifications,
                      ...(current.notifications || {}),
                      [key]: event.target.checked,
                    },
                  }))
                }
                type="checkbox"
              />
              {key.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase())}
            </label>
          ))}
          <Button onClick={() => setSaveSettingsOpen(true)}>Save Settings</Button>
        </Card>
        <ConfirmDialog
          confirmLabel="Save settings"
          message="Are you sure you want to save these system settings? They apply to every user."
          onCancel={() => setSaveSettingsOpen(false)}
          onConfirm={async () => {
            await data.saveAdminSettings(settings)
            setSaveSettingsOpen(false)
            showToast('System settings saved.', 'success')
          }}
          open={saveSettingsOpen}
          title="Save system settings"
          tone="success"
        />
      </div>
    )
  }

  return <PageHeader description="This administration section is not available." title="Page not found" />
}

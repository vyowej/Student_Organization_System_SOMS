/**
 * Audit Log Tracker Component (src/components/admin/AuditLogTracker.jsx)
 *
 * Real-time system audit trail, security events, user activity, and compliance
 * tracking across Western Mindanao State University UNIDOS.
 */
import { useState, useMemo, useCallback } from 'react'
import PageHeader from '../layout/PageHeader.jsx'
import Card from '../ui/Card.jsx'
import Badge from '../ui/Badge.jsx'
import Button from '../ui/Button.jsx'
import Modal from '../ui/Modal.jsx'
import Table from '../ui/Table.jsx'
import Icon from '../ui/Icon.jsx'
import EmptyState from '../ui/EmptyState.jsx'
import { useToast } from '../ui/useToast.js'

function formatRelativeTime(isoValue) {
  if (!isoValue) return ''
  const parsed = new Date(isoValue)
  if (Number.isNaN(parsed.getTime())) return ''
  const diffMs = Date.now() - parsed.getTime()
  const diffSec = Math.floor(diffMs / 1000)
  const diffMin = Math.floor(diffSec / 60)
  const diffHours = Math.floor(diffMin / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffSec < 60) return 'Just now'
  if (diffMin < 60) return `${diffMin}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays}d ago`
  return parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function getActionTone(action = '') {
  const act = String(action).toUpperCase()
  if (
    act.includes('APPROV') ||
    act.includes('ACCREDIT') ||
    act.includes('VERIF') ||
    act.includes('PUBLISH') ||
    act.includes('JOIN') ||
    act.includes('CHECKIN') ||
    act.includes('SUCCESS')
  ) {
    return 'success'
  }
  if (
    act.includes('REJECT') ||
    act.includes('DELET') ||
    act.includes('SUSPEND') ||
    act.includes('REVOK') ||
    act.includes('ARCHIVE') ||
    act.includes('CANCEL') ||
    act.includes('FAIL')
  ) {
    return 'danger'
  }
  if (
    act.includes('RETURN') ||
    act.includes('PEND') ||
    act.includes('REVIEW') ||
    act.includes('SUBMIT') ||
    act.includes('REQUEST') ||
    act.includes('WARN')
  ) {
    return 'warning'
  }
  if (
    act.includes('UPDATE') ||
    act.includes('EDIT') ||
    act.includes('LOGIN') ||
    act.includes('STATUS') ||
    act.includes('ASSIGN') ||
    act.includes('REGISTER') ||
    act.includes('INITIAL')
  ) {
    return 'info'
  }
  return 'neutral'
}

function getRoleTone(role = '') {
  const r = String(role).toUpperCase()
  if (r.includes('ADMIN')) return 'crimson'
  if (r.includes('ADVISER')) return 'info'
  if (r.includes('OFFICER')) return 'warning'
  if (r.includes('STUDENT')) return 'success'
  return 'neutral'
}

function humanizeAction(action = '') {
  return String(action)
    .replaceAll('_', ' ')
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

function downloadCsv(filename, rows) {
  if (!rows || !rows.length) return false
  const escape = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`
  const headings = Object.keys(rows[0])
  const content = [headings, ...rows.map((row) => headings.map((h) => row[h]))]
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
  if (!rows || !rows.length) return false
  const escape = (value) =>
    String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
  const headings = Object.keys(rows[0])
  const html = `<table><thead><tr>${headings.map((h) => `<th>${escape(h)}</th>`).join('')}</tr></thead><tbody>${rows.map((row) => `<tr>${headings.map((h) => `<td>${escape(row[h])}</td>`).join('')}</tr>`).join('')}</tbody></table>`
  const url = URL.createObjectURL(new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8' }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
  return true
}

export default function AuditLogTracker({ logs = [], onRefresh }) {
  const toast = useToast()
  const [search, setSearch] = useState('')
  const [actionFilter, setActionFilter] = useState('All')
  const [entityFilter, setEntityFilter] = useState('All')
  const [roleFilter, setRoleFilter] = useState('All')
  const [periodFilter, setPeriodFilter] = useState('ALL')
  const [selectedLog, setSelectedLog] = useState(null)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [copiedPayload, setCopiedPayload] = useState(false)

  // KPI Metrics Calculation
  const metrics = useMemo(() => {
    const total = logs.length
    const now = Date.now()
    const oneDayMs = 24 * 60 * 60 * 1000

    let todayCount = 0
    let decisionsCount = 0
    const uniqueActors = new Set()

    logs.forEach((item) => {
      if (item.actor) uniqueActors.add(item.actor)
      if (item.createdAt && now - new Date(item.createdAt).getTime() <= oneDayMs) {
        todayCount += 1
      }
      const act = String(item.action).toUpperCase()
      if (
        act.includes('APPROV') ||
        act.includes('REJECT') ||
        act.includes('RETURN') ||
        act.includes('ACCREDIT') ||
        act.includes('SUSPEND') ||
        act.includes('DELETE')
      ) {
        decisionsCount += 1
      }
    })

    return {
      total,
      todayCount,
      decisionsCount,
      uniqueActorsCount: uniqueActors.size,
    }
  }, [logs])

  // Extract distinct dynamic options
  const actionOptions = useMemo(() => {
    const set = new Set(logs.map((l) => l.action).filter(Boolean))
    return ['All', ...Array.from(set).sort()]
  }, [logs])

  const entityOptions = useMemo(() => {
    const set = new Set(logs.map((l) => l.entityType).filter(Boolean))
    return ['All', ...Array.from(set).sort()]
  }, [logs])

  const roleOptions = useMemo(() => {
    const set = new Set(logs.map((l) => l.role).filter(Boolean))
    return ['All', ...Array.from(set).sort()]
  }, [logs])

  // Filtered rows
  const filteredLogs = useMemo(() => {
    const query = search.trim().toLowerCase()
    const now = Date.now()

    return logs.filter((item) => {
      // Entity Filter
      if (entityFilter !== 'All' && item.entityType !== entityFilter) {
        return false
      }
      // Action Filter
      if (actionFilter !== 'All' && item.action !== actionFilter) {
        return false
      }
      // Role Filter
      if (roleFilter !== 'All' && String(item.role).toUpperCase() !== roleFilter.toUpperCase()) {
        return false
      }
      // Time Period Filter
      if (periodFilter !== 'ALL' && item.createdAt) {
        const itemTime = new Date(item.createdAt).getTime()
        const diffMs = now - itemTime
        if (periodFilter === 'TODAY' && diffMs > 24 * 60 * 60 * 1000) return false
        if (periodFilter === 'WEEK' && diffMs > 7 * 24 * 60 * 60 * 1000) return false
        if (periodFilter === 'MONTH' && diffMs > 30 * 24 * 60 * 60 * 1000) return false
      }
      // Search Query
      if (query) {
        const matchText = [
          item.actor,
          item.role,
          item.action,
          item.entityType,
          item.entityId,
          item.description,
          item.ipAddress,
          item.timestamp,
          item.metadata ? JSON.stringify(item.metadata) : '',
        ]
          .join(' ')
          .toLowerCase()

        if (!matchText.includes(query)) return false
      }
      return true
    })
  }, [logs, search, entityFilter, actionFilter, roleFilter, periodFilter])

  // Refresh handler
  const handleRefresh = useCallback(async () => {
    if (!onRefresh) return
    setIsRefreshing(true)
    try {
      await onRefresh()
      toast.show('Audit logs refreshed live from system records', { tone: 'success' })
    } catch {
      toast.show('Could not refresh logs at this time', { tone: 'danger' })
    } finally {
      setIsRefreshing(false)
    }
  }, [onRefresh, toast])

  // CSV Export handler
  const handleExportCsv = useCallback(() => {
    if (!filteredLogs.length) {
      toast.show('No audit logs available to export', { tone: 'warning' })
      return
    }
    const exportData = filteredLogs.map((log) => ({
      'Log ID': log.id,
      'Date & Time': log.timestamp,
      Actor: log.actor,
      Role: log.role,
      Action: log.action,
      Entity: log.entityType,
      'Record ID': log.entityId,
      Description: log.description,
      'IP Address': log.ipAddress,
    }))
    const filename = `soms_audit_logs_${new Date().toISOString().slice(0, 10)}.csv`
    downloadCsv(filename, exportData)
    toast.show(`Exported ${exportData.length} audit records to CSV`, { tone: 'success' })
  }, [filteredLogs, toast])

  // Excel Export handler
  const handleExportExcel = useCallback(() => {
    if (!filteredLogs.length) {
      toast.show('No audit logs available to export', { tone: 'warning' })
      return
    }
    const exportData = filteredLogs.map((log) => ({
      'Log ID': log.id,
      'Date & Time': log.timestamp,
      Actor: log.actor,
      Role: log.role,
      Action: log.action,
      Entity: log.entityType,
      'Record ID': log.entityId,
      Description: log.description,
      'IP Address': log.ipAddress,
    }))
    const filename = `soms_audit_logs_${new Date().toISOString().slice(0, 10)}.xls`
    downloadExcel(filename, exportData)
    toast.show(`Exported ${exportData.length} audit records to Excel`, { tone: 'success' })
  }, [filteredLogs, toast])

  // Reset filters
  const hasActiveFilters =
    search.trim() !== '' ||
    actionFilter !== 'All' ||
    entityFilter !== 'All' ||
    roleFilter !== 'All' ||
    periodFilter !== 'ALL'

  const handleResetFilters = useCallback(() => {
    setSearch('')
    setActionFilter('All')
    setEntityFilter('All')
    setRoleFilter('All')
    setPeriodFilter('ALL')
  }, [])

  // Copy JSON payload in modal
  const handleCopyPayload = useCallback(() => {
    if (!selectedLog) return
    const payload = JSON.stringify(selectedLog.metadata || selectedLog.details || {}, null, 2)
    navigator.clipboard?.writeText(payload).then(() => {
      setCopiedPayload(true)
      toast.show('Payload JSON copied to clipboard', { tone: 'success' })
      setTimeout(() => setCopiedPayload(false), 2000)
    })
  }, [selectedLog, toast])

  // Table Columns Definition
  const columns = useMemo(
    () => [
      {
        key: 'timestamp',
        label: 'Date & Time',
        render: (value, row) => (
          <div className="log-time-cell">
            <span className="log-time-primary">{value || '—'}</span>
            <small className="log-time-relative">{formatRelativeTime(row.createdAt)}</small>
          </div>
        ),
      },
      {
        key: 'actor',
        label: 'Actor & Role',
        render: (value, row) => (
          <div className="log-actor-cell">
            <span className="log-actor-name">{value || 'System'}</span>
            <Badge tone={getRoleTone(row.role)}>{row.role || 'System'}</Badge>
          </div>
        ),
      },
      {
        key: 'action',
        label: 'Action',
        render: (value) => (
          <Badge tone={getActionTone(value)}>{humanizeAction(value)}</Badge>
        ),
      },
      {
        key: 'entityType',
        label: 'Target Resource',
        render: (value, row) => (
          <div className="log-entity-cell">
            <span className="log-entity-type">{String(value || 'SYSTEM').toLowerCase()}</span>
            {row.entityId && row.entityId !== '—' && (
              <span className="log-entity-id">#{row.entityId}</span>
            )}
          </div>
        ),
      },
      {
        key: 'description',
        label: 'Details & Description',
        render: (value) => (
          <div className="log-description-cell" title={value}>
            {value}
          </div>
        ),
      },
      {
        key: 'ipAddress',
        label: 'Client IP',
        render: (value) => (
          <code className="log-ip-code">{value || '127.0.0.1'}</code>
        ),
      },
      {
        key: 'actions',
        label: 'Action',
        render: (_, row) => (
          <Button
            className="log-inspect-btn"
            onClick={() => setSelectedLog(row)}
            size="sm"
            variant="secondary"
          >
            <Icon name="eye" size={13} />
            <span>Inspect</span>
          </Button>
        ),
      },
    ],
    []
  )

  return (
    <div className="admin-page audit-log-tracker">
      {/* Top Header with title and export/refresh buttons */}
      <div className="log-tracker-header-wrap">
        <PageHeader
          description="Monitor, inspect, and export system-wide user actions, security events, and governance decisions."
          eyebrow="UNIDOS ADMINISTRATION"
          title="Audit Log Tracker"
        />
        <div className="log-tracker-action-buttons">
          {onRefresh && (
            <Button
              className="log-tracker-btn"
              disabled={isRefreshing}
              onClick={handleRefresh}
              variant="secondary"
            >
              <Icon className={isRefreshing ? 'animate-spin' : ''} name="refresh" size={14} />
              <span>{isRefreshing ? 'Refreshing...' : 'Live Sync'}</span>
            </Button>
          )}
          <Button
            className="log-tracker-btn"
            onClick={handleExportCsv}
            variant="secondary"
          >
            <Icon name="download" size={14} />
            <span>Export CSV</span>
          </Button>
          <Button
            className="log-tracker-btn"
            onClick={handleExportExcel}
            variant="secondary"
          >
            <Icon name="reports" size={14} />
            <span>Export Excel</span>
          </Button>
        </div>
      </div>

      {/* KPI Overview Cards */}
      <div className="admin-metrics-grid log-tracker-metrics">
        <Card className="admin-metric-card">
          <span className="stat-label">Total Audit Events</span>
          <strong className="stat-value">{metrics.total.toLocaleString()}</strong>
          <small className="stat-note">Recorded in system database</small>
        </Card>

        <Card className="admin-metric-card">
          <span className="stat-label">
            <span className="live-pulse-dot" /> Today&apos;s Activities
          </span>
          <strong className="stat-value">{metrics.todayCount.toLocaleString()}</strong>
          <small className="stat-note">Recorded in last 24 hours</small>
        </Card>

        <Card className="admin-metric-card">
          <span className="stat-label">Governance Decisions</span>
          <strong className="stat-value">{metrics.decisionsCount.toLocaleString()}</strong>
          <small className="stat-note">Approvals, rejections &amp; reviews</small>
        </Card>

        <Card className="admin-metric-card">
          <span className="stat-label">Active Actors</span>
          <strong className="stat-value">{metrics.uniqueActorsCount.toLocaleString()}</strong>
          <small className="stat-note">Distinct users &amp; automated system</small>
        </Card>
      </div>

      {/* Multi-Facet Filter Bar */}
      <div className="admin-filter-bar log-tracker-filter-bar">
        <label className="admin-filter-field admin-filter-search">
          <span>Search Logs</span>
          <div className="log-search-input-wrap">
            <input
              aria-label="Search audit records"
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by actor, action, target, IP, or details..."
              type="search"
              value={search}
            />
            {search && (
              <button
                className="log-search-clear-btn"
                onClick={() => setSearch('')}
                title="Clear search"
                type="button"
              >
                &times;
              </button>
            )}
          </div>
        </label>

        <label className="admin-filter-field">
          <span>Action</span>
          <select
            aria-label="Filter audit action"
            onChange={(e) => setActionFilter(e.target.value)}
            value={actionFilter}
          >
            {actionOptions.map((act) => (
              <option key={act} value={act}>
                {act === 'All' ? 'All Actions' : humanizeAction(act)}
              </option>
            ))}
          </select>
        </label>

        <label className="admin-filter-field">
          <span>Resource</span>
          <select
            aria-label="Filter audit resource"
            onChange={(e) => setEntityFilter(e.target.value)}
            value={entityFilter}
          >
            {entityOptions.map((ent) => (
              <option key={ent} value={ent}>
                {ent === 'All' ? 'All Resources' : ent}
              </option>
            ))}
          </select>
        </label>

        <label className="admin-filter-field">
          <span>Actor Role</span>
          <select
            aria-label="Filter actor role"
            onChange={(e) => setRoleFilter(e.target.value)}
            value={roleFilter}
          >
            {roleOptions.map((role) => (
              <option key={role} value={role}>
                {role === 'All' ? 'All Roles' : role}
              </option>
            ))}
          </select>
        </label>

        <label className="admin-filter-field">
          <span>Time Period</span>
          <select
            aria-label="Filter time period"
            onChange={(e) => setPeriodFilter(e.target.value)}
            value={periodFilter}
          >
            <option value="ALL">All Time</option>
            <option value="TODAY">Today (24h)</option>
            <option value="WEEK">Past 7 Days</option>
            <option value="MONTH">Past 30 Days</option>
          </select>
        </label>

        {hasActiveFilters && (
          <div className="admin-filter-field log-reset-filter-field">
            <span>&nbsp;</span>
            <Button
              className="log-reset-btn"
              onClick={handleResetFilters}
              size="sm"
              variant="secondary"
            >
              Reset Filters
            </Button>
          </div>
        )}
      </div>

      {/* Main Audit Log Table Card */}
      <Card className="admin-section-card log-table-card">
        <div className="log-table-summary-bar">
          <span className="log-table-count">
            Showing <strong>{filteredLogs.length}</strong> of <strong>{logs.length}</strong> recorded audit events
          </span>
          {hasActiveFilters && (
            <Badge tone="info">Filters Active</Badge>
          )}
        </div>

        {filteredLogs.length > 0 ? (
          <Table
            columns={columns}
            getRowKey={(row) => row.id}
            rows={filteredLogs}
            useDataTable
          />
        ) : (
          <EmptyState
            action={
              hasActiveFilters ? (
                <Button onClick={handleResetFilters} variant="secondary">
                  Reset Active Filters
                </Button>
              ) : undefined
            }
            description="No log events match your current search query and filters."
            title="No audit log entries found"
          />
        )}
      </Card>

      {/* Detailed Log Entry Inspector Modal */}
      {selectedLog && (
        <Modal
          className="log-inspector-modal"
          onClose={() => setSelectedLog(null)}
          open
          size="lg"
          title={`Audit Log Record #${selectedLog.id}`}
        >
          <div className="log-detail-container">
            {/* Top Status Banner */}
            <div className="log-detail-banner">
              <div className="log-detail-banner-left">
                <Badge tone={getActionTone(selectedLog.action)}>
                  {humanizeAction(selectedLog.action)}
                </Badge>
                <strong className="log-detail-banner-action">{selectedLog.action}</strong>
              </div>
              <div className="log-detail-banner-time">
                <Icon name="clock" size={14} />
                <span>{selectedLog.timestamp}</span>
              </div>
            </div>

            {/* 4-Panel Metadata Grid */}
            <div className="log-detail-grid">
              <div className="log-detail-card">
                <h4>Actor Information</h4>
                <div className="log-detail-item">
                  <span className="log-detail-label">Name:</span>
                  <strong className="log-detail-val">{selectedLog.actor || 'System'}</strong>
                </div>
                <div className="log-detail-item">
                  <span className="log-detail-label">Role:</span>
                  <Badge tone={getRoleTone(selectedLog.role)}>{selectedLog.role || 'System'}</Badge>
                </div>
                {selectedLog.actorEmail && (
                  <div className="log-detail-item">
                    <span className="log-detail-label">Email:</span>
                    <span className="log-detail-val">{selectedLog.actorEmail}</span>
                  </div>
                )}
                <div className="log-detail-item">
                  <span className="log-detail-label">User ID:</span>
                  <span className="log-detail-val">{selectedLog.userId ? `#${selectedLog.userId}` : 'System (Automated)'}</span>
                </div>
              </div>

              <div className="log-detail-card">
                <h4>Resource &amp; Target</h4>
                <div className="log-detail-item">
                  <span className="log-detail-label">Entity Type:</span>
                  <span className="log-entity-tag">{selectedLog.entityType}</span>
                </div>
                <div className="log-detail-item">
                  <span className="log-detail-label">Record ID:</span>
                  <span className="log-detail-val">
                    {selectedLog.entityId && selectedLog.entityId !== '—' ? `#${selectedLog.entityId}` : 'None (Global/System)'}
                  </span>
                </div>
                <div className="log-detail-item">
                  <span className="log-detail-label">Relative Age:</span>
                  <span className="log-detail-val">{formatRelativeTime(selectedLog.createdAt)}</span>
                </div>
              </div>

              <div className="log-detail-card">
                <h4>Security &amp; Network</h4>
                <div className="log-detail-item">
                  <span className="log-detail-label">Client IP:</span>
                  <code className="log-ip-code">{selectedLog.ipAddress || '127.0.0.1'}</code>
                </div>
                <div className="log-detail-item">
                  <span className="log-detail-label">Audit Log ID:</span>
                  <span className="log-detail-val">#{selectedLog.id}</span>
                </div>
                <div className="log-detail-item">
                  <span className="log-detail-label">Raw ISO Date:</span>
                  <small className="log-detail-iso">{selectedLog.createdAt || '—'}</small>
                </div>
              </div>
            </div>

            {/* Event Description Summary */}
            <div className="log-detail-description-section">
              <h4>Event Description</h4>
              <p className="log-detail-desc-text">{selectedLog.description}</p>
            </div>

            {/* Changeset / Metadata Payload Explorer */}
            <div className="log-detail-payload-section">
              <div className="log-payload-header">
                <h4>Structured Event Payload (JSON)</h4>
                <Button
                  className="log-copy-payload-btn"
                  onClick={handleCopyPayload}
                  size="sm"
                  variant="secondary"
                >
                  <Icon name={copiedPayload ? 'check' : 'copy'} size={13} />
                  <span>{copiedPayload ? 'Copied!' : 'Copy JSON'}</span>
                </Button>
              </div>
              <pre className="log-payload-code">
                {JSON.stringify(selectedLog.metadata || selectedLog.details || {}, null, 2)}
              </pre>
            </div>

            <div className="log-modal-footer">
              <Button onClick={() => setSelectedLog(null)} variant="primary">
                Close Inspector
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

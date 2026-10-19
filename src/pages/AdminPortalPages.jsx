/**
 * Student Affairs Admin Portal Pages (`/admin/*`)
 *
 * Implements the campus-wide Admin Dashboard, User & Student directories,
 * Organization Accreditation & Change Requests, Approval Center, Compliance
 * Documents, Reports, Analytics, Audit Logs, and System Settings views.
 */
import { useState } from 'react'
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
import { undoAction, useToast } from '../components/ui/useToast.js'
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

// "RETURNED_FOR_REVISION" -> "Returned for revision". Keeps status labels in sentence case
// so they sit consistently next to role names like "Organization Officer".
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
        {options.map((option) => <option key={option} value={option}>{option === 'All' ? 'All' : humanize(option)}</option>)}
      </select>
    </label>
  )
}

function Metric({ label, value, detail }) {
  return <Card className="admin-metric-card"><span className="stat-label">{label}</span><strong className="stat-value">{value}</strong>{detail && <small className="stat-note">{detail}</small>}</Card>
}

function FilterBar({ search, setSearch, children }) {
  return (
    <div className="admin-filter-bar">
      <label className="admin-filter-field admin-filter-search">
        <span>Search</span>
        <input onChange={(event) => setSearch(event.target.value)} placeholder="Search records" type="search" value={search} />
      </label>
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
  const [confirming, setConfirming] = useState(false)
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
    setConfirming(true)
  }
  function applyDecision() {
    const succeeded = onDecision(decision, comment)
    setConfirming(false)
    if (!succeeded) {
      setError('This item is no longer eligible for this action.')
      return
    }
    onClose()
  }
  const decisionVerb = (decisionLabels[decision] ?? String(decision).replace('_', ' ')).toLowerCase()
  return (
    <div className="admin-page">
      <ConfirmDialog
        confirmLabel="Yes, confirm"
        message={`Are you sure you want to ${decisionVerb} "${item.title ?? item.name ?? 'this item'}"? You can undo this right after.`}
        onCancel={() => setConfirming(false)}
        onConfirm={applyDecision}
        open={confirming}
        title="Confirm decision"
        tone={decision === 'REJECTED' ? 'danger' : 'primary'}
      />
      <Modal onClose={onClose} open={!confirming} title={item.title ?? item.name ?? 'Record details'}>
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
            <Button onClick={submit}>{decision ? 'Continue' : 'Close'}</Button>
          </div>
        )}
      </Modal>
    </div>
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

function parseRecordDate(raw) {
  if (!raw) return null
  if (raw instanceof Date) return isNaN(raw.getTime()) ? null : raw
  const str = String(raw).trim()
  if (!str) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    const [y, m, d] = str.split('-').map(Number)
    return new Date(y, m - 1, d)
  }
  const cleaned = str.replace('·', ' ').trim()
  const parsed = new Date(cleaned)
  return isNaN(parsed.getTime()) ? null : parsed
}

function buildTimeline(dateRange, fallbackMonthCount = 6) {
  const sParsed = parseRecordDate(dateRange?.start)
  const eParsed = parseRecordDate(dateRange?.end)

  if (!sParsed && !eParsed) {
    const now = new Date()
    const months = []
    for (let i = fallbackMonthCount - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const label = d.toLocaleString('default', { month: 'short' })
      months.push({ key, label, isMonth: true, year: d.getFullYear(), month: d.getMonth() })
    }
    return { granularity: 'month', slots: months, startDate: null, endDate: null }
  }

  let start = sParsed
  let end = eParsed

  if (start && !end) {
    end = new Date(start)
    end.setDate(end.getDate() + 13)
  } else if (!start && end) {
    start = new Date(end)
    start.setDate(start.getDate() - 13)
  }

  if (start > end) {
    const tmp = start
    start = end
    end = tmp
  }

  const startDate = new Date(start.getFullYear(), start.getMonth(), start.getDate(), 0, 0, 0, 0)
  const endDate = new Date(end.getFullYear(), end.getMonth(), end.getDate(), 23, 59, 59, 999)

  const diffDays = Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))

  if (diffDays <= 14) {
    const days = []
    const cur = new Date(startDate)
    while (cur <= endDate) {
      const y = cur.getFullYear()
      const m = String(cur.getMonth() + 1).padStart(2, '0')
      const d = String(cur.getDate()).padStart(2, '0')
      const key = `${y}-${m}-${d}`
      const label = cur.toLocaleDateString('default', { month: 'short', day: 'numeric' })
      days.push({ key, label, isMonth: false, date: new Date(cur) })
      cur.setDate(cur.getDate() + 1)
    }
    return { granularity: 'day', slots: days, startDate, endDate }
  } else if (diffDays <= 90) {
    const weeks = []
    const cur = new Date(startDate)
    let weekIndex = 1
    while (cur <= endDate) {
      const weekStart = new Date(cur)
      const weekEnd = new Date(cur)
      weekEnd.setDate(weekEnd.getDate() + 6)
      if (weekEnd > endDate) {
        weekEnd.setTime(endDate.getTime())
      }
      weekEnd.setHours(23, 59, 59, 999)

      const y = weekStart.getFullYear()
      const m = String(weekStart.getMonth() + 1).padStart(2, '0')
      const d = String(weekStart.getDate()).padStart(2, '0')
      const key = `${y}-${m}-${d}`

      const startMonth = weekStart.toLocaleDateString('default', { month: 'short' })
      const endMonth = weekEnd.toLocaleDateString('default', { month: 'short' })
      const startDay = weekStart.getDate()
      const endDay = weekEnd.getDate()

      const label = startMonth === endMonth
        ? `${startMonth} ${startDay}–${endDay}`
        : `${startMonth} ${startDay}–${endMonth} ${endDay}`

      weeks.push({
        key,
        label,
        weekStart: new Date(weekStart),
        weekEnd: new Date(weekEnd),
        weekIndex,
      })

      cur.setDate(cur.getDate() + 7)
      weekIndex++
    }
    return { granularity: 'week', slots: weeks, startDate, endDate }
  } else {
    const months = []
    const cur = new Date(startDate.getFullYear(), startDate.getMonth(), 1)
    const endMonth = new Date(endDate.getFullYear(), endDate.getMonth(), 1)
    while (cur <= endMonth) {
      const key = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}`
      const label = cur.toLocaleString('default', { month: 'short' })
      months.push({ key, label, isMonth: true, year: cur.getFullYear(), month: cur.getMonth() })
      cur.setMonth(cur.getMonth() + 1)
    }
    return { granularity: 'month', slots: months, startDate, endDate }
  }
}

function getRecordSlotKey(rawDate, timeline) {
  const d = parseRecordDate(rawDate)
  if (!d) return null
  if (timeline.startDate && d < timeline.startDate) return null
  if (timeline.endDate && d > timeline.endDate) return null

  if (timeline.granularity === 'day') {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  } else if (timeline.granularity === 'week') {
    const match = timeline.slots.find(
      (slot) => d >= slot.weekStart && d <= slot.weekEnd
    )
    return match ? match.key : null
  } else {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    return `${y}-${m}`
  }
}

function DateRangeFilter({ startDate, endDate, onStartChange, onEndChange, onReset }) {
  return (
    <div className="admin-chart-date-filter">
      <input
        type="date"
        className="admin-chart-date-input"
        value={startDate}
        onChange={(e) => onStartChange(e.target.value)}
        title="Start date"
        aria-label="Start date"
      />
      <span className="admin-chart-date-sep">to</span>
      <input
        type="date"
        className="admin-chart-date-input"
        value={endDate}
        onChange={(e) => onEndChange(e.target.value)}
        title="End date"
        aria-label="End date"
      />
      {(startDate || endDate) && (
        <button
          type="button"
          className="admin-chart-date-clear"
          onClick={onReset}
          title="Reset date filter"
          aria-label="Reset date filter"
        >
          <Icon name="close" size={13} />
        </button>
      )}
    </div>
  )
}

function getChartUnitLabel(title, value) {
  const t = title.toLowerCase()
  if (t.includes('category') || t.includes('organization')) {
    return value === 1 ? 'organization' : 'organizations'
  }
  if (t.includes('event')) {
    return value === 1 ? 'event' : 'events'
  }
  if (t.includes('attendance')) {
    return value === 1 ? 'attendee' : 'attendees'
  }
  if (t.includes('membership')) {
    return value === 1 ? 'member' : 'members'
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
  if (maxVal <= 1) {
    ticks = [0, 1, 2]
  } else if (maxVal === 2) {
    ticks = [0, 1, 2]
  } else if (maxVal === 3) {
    ticks = [0, 1, 2, 3]
  } else if (maxVal === 4) {
    ticks = [0, 2, 4]
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
      <div
        className="admin-analytics-chart"
        onMouseLeave={() => setHoveredIndex(null)}
      >
        <svg
          aria-label={`${title}. ${chartDescription}`}
          className={`admin-analytics-chart-graphic admin-analytics-chart-${type}`}
          role="img"
          viewBox={`0 0 ${width} ${height}`}
        >
          <defs>
            <linearGradient id={`area-${chartId}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={lineColor} stopOpacity="0.28" />
              <stop offset="100%" stopColor={lineColor} stopOpacity="0.01" />
            </linearGradient>
            <linearGradient id={`bar-default-${chartId}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={lineColor} stopOpacity="1" />
              <stop offset="100%" stopColor={lineColor} stopOpacity="0.8" />
            </linearGradient>
            {barPalette.map((p, i) => (
              <linearGradient id={`bar-${chartId}-${i}`} key={i} x1="0" y1="0" x2="0" y2="1">
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
                  x1={left}
                  x2={right}
                  y1={y}
                  y2={y}
                  stroke="#f1ebef"
                  strokeWidth="1"
                  strokeDasharray={tickVal === 0 ? 'none' : '3 3'}
                />
                <text
                  className="admin-analytics-chart-tick"
                  textAnchor="end"
                  x={left - 8}
                  y={y + 4}
                >
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
                  x1={activePoint.x}
                  x2={activePoint.x}
                  y1={top}
                  y2={bottom}
                  stroke={lineColor}
                  strokeWidth="1.5"
                  strokeDasharray="3 3"
                  opacity="0.65"
                />
              )}
              {points.map((point, index) => {
                const isHovered = hoveredIndex === index
                const hasValue = rows[index].value > 0
                const isCrowded = rows.length > 12

                const r = isHovered ? 6 : hasValue ? 4.5 : isCrowded ? 2 : 4
                const strokeWidth = isHovered ? 3 : hasValue ? 2.5 : isCrowded ? 1.5 : 2.5
                const stroke = isHovered ? lineColor : hasValue ? lineColor : isCrowded ? '#d1c7ce' : lineColor

                return (
                  <g key={rows[index].label}>
                    {isHovered && (
                      <circle
                        className="admin-chart-point-halo"
                        cx={point.x}
                        cy={point.y}
                        r="8.5"
                        fill={lineColor}
                        fillOpacity="0.22"
                      />
                    )}
                    <circle
                      className="admin-analytics-chart-point"
                      cx={point.x}
                      cy={point.y}
                      r={r}
                      stroke={stroke}
                      strokeWidth={strokeWidth}
                      fill="#ffffff"
                    />
                  </g>
                )
              })}
            </>
          ) : (
            rows.map((row, index) => {
              const barWidth = Math.min(36, Math.max(12, slotWidth * 0.56))
              const barHeight = chartMax ? (row.value / chartMax) * (bottom - top) : 0
              const gradId = rows.length <= 6 ? `url(#bar-${chartId}-${index % barPalette.length})` : `url(#bar-default-${chartId})`
              const isHovered = hoveredIndex === index
              const opacity = hoveredIndex !== null ? (isHovered ? 1 : 0.45) : 1

              return (
                <g key={row.label} style={{ opacity, transition: 'opacity 0.15s ease' }}>
                  {barHeight > 0 ? (
                    <rect
                      className="admin-analytics-chart-bar"
                      height={barHeight}
                      rx="4"
                      ry="4"
                      width={barWidth}
                      x={points[index].x - barWidth / 2}
                      y={bottom - barHeight}
                      fill={gradId}
                      filter={isHovered ? 'drop-shadow(0 2px 5px rgba(0,0,0,0.22))' : undefined}
                    />
                  ) : (
                    <rect
                      className="admin-analytics-chart-bar"
                      height="2"
                      rx="1"
                      ry="1"
                      width={barWidth}
                      x={points[index].x - barWidth / 2}
                      y={bottom - 2}
                      fill={isHovered ? lineColor : '#e2dce0'}
                    />
                  )}
                </g>
              )
            })
          )}

          {/* Full vertical interactive hover hit-areas */}
          {rows.map((row, index) => {
            const slotX = left + index * slotWidth
            return (
              <rect
                key={`hit-${index}`}
                className="admin-chart-hover-zone"
                x={slotX}
                y={top}
                width={slotWidth}
                height={bottom - top}
                fill="transparent"
                onMouseEnter={() => setHoveredIndex(index)}
                onMouseMove={() => setHoveredIndex(index)}
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
              <span
                className="admin-chart-tooltip-badge"
                style={{ backgroundColor: activeColor }}
              />
              <span className="admin-chart-tooltip-title">{activeRow.label}</span>
            </div>
            <div className="admin-chart-tooltip-body">
              <strong>{activeRow.value}</strong>
              <span>{getChartUnitLabel(title, activeRow.value)}</span>
            </div>
            {totalVal > 0 && activeRow.value > 0 && (
              <div className="admin-chart-tooltip-percent">
                {Math.round((activeRow.value / totalVal) * 100)}% of total
              </div>
            )}
          </div>
        )}

        <div className="admin-analytics-chart-labels" style={{ gridTemplateColumns: `repeat(${Math.max(rows.length, 1)}, minmax(0, 1fr))` }}>
          {rows.map((row, index) => (
            <div
              className={`admin-analytics-chart-label ${hoveredIndex === index ? 'is-hovered' : ''}`}
              key={row.label}
              onMouseEnter={() => setHoveredIndex(index)}
            >
              <span
                className="admin-chart-label-text"
                title={row.label}
                style={{ fontSize: rows.length > 12 ? '9.5px' : '10.5px' }}
              >
                {row.label}
              </span>
              <span
                className={`admin-chart-value-pill ${row.value > 0 ? 'has-value' : ''}`}
                style={{
                  minWidth: rows.length > 12 ? '18px' : '22px',
                  height: rows.length > 12 ? '18px' : '20px',
                  fontSize: rows.length > 12 ? '10px' : '11px',
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
  const inactiveCount = organizations.filter((o) => o.status === 'INACTIVE').length
  const suspendedCount = organizations.filter((o) => o.status === 'SUSPENDED').length
  const accreditedCount = organizations.filter((o) => (o.accreditationStatus || 'ACCREDITED') === 'ACCREDITED').length
  const totalMembers = organizations.reduce((sum, o) => sum + (Number(o.memberCount) || 0), 0)
  const avgMembers = organizations.length ? Math.round(totalMembers / organizations.length) : 0
  const standingRate = organizations.length ? Math.round((activeCount / organizations.length) * 100) : 0

  const filteredOrgs = organizations.filter((org) => {
    const matchesStatus = statusFilter === 'ALL' || org.status === statusFilter
    const q = searchQuery.trim().toLowerCase()
    const matchesSearch = !q || [org.name, org.acronym, org.category, org.college, org.adviser].some((f) => String(f ?? '').toLowerCase().includes(q))
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
      label: 'Faculty Adviser',
      render: (val) => <span>{val || '—'}</span>,
    },
    {
      key: 'memberCount',
      label: 'Members',
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
        <Badge tone={toneFor(val || 'ACCREDITED')}>
          {humanize(val || 'ACCREDITED')}
        </Badge>
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
          <h2>Organization standing & accreditation roster</h2>
          <p className="admin-standing-subtitle">
            Comprehensive institutional standing, official accreditation, and member body breakdown for all recognized campus organizations.
          </p>
        </div>
        <div className="admin-standing-filter-tabs">
          <button
            type="button"
            className={`admin-standing-tab ${statusFilter === 'ALL' ? 'active' : ''}`}
            onClick={() => setStatusFilter('ALL')}
          >
            All ({organizations.length})
          </button>
          <button
            type="button"
            className={`admin-standing-tab ${statusFilter === 'ACTIVE' ? 'active' : ''}`}
            onClick={() => setStatusFilter('ACTIVE')}
          >
            Active ({activeCount})
          </button>
          <button
            type="button"
            className={`admin-standing-tab ${statusFilter === 'INACTIVE' ? 'active' : ''}`}
            onClick={() => setStatusFilter('INACTIVE')}
          >
            Inactive ({inactiveCount})
          </button>
          <button
            type="button"
            className={`admin-standing-tab ${statusFilter === 'SUSPENDED' ? 'active' : ''}`}
            onClick={() => setStatusFilter('SUSPENDED')}
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
                  r={radius}
                  strokeDasharray={`${segment.length} ${circumference - segment.length}`}
                  strokeDashoffset={segment.offset}
                  onMouseEnter={() => setHoveredStatus(segment.label)}
                  onMouseLeave={() => setHoveredStatus(null)}
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
                  key={segment.label}
                  className={`admin-standing-legend-item ${hoveredStatus === segment.label ? 'highlighted' : ''} ${statusFilter === segment.label ? 'selected' : ''}`}
                  onMouseEnter={() => setHoveredStatus(segment.label)}
                  onMouseLeave={() => setHoveredStatus(null)}
                  onClick={() => setStatusFilter(statusFilter === segment.label ? 'ALL' : segment.label)}
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
            <span className="admin-standing-kpi-hint">100% University certified</span>
          </div>

          <div className="admin-standing-kpi-card">
            <span className="admin-standing-kpi-label">Total Student Footprint</span>
            <div className="admin-standing-kpi-value-row">
              <span className="admin-standing-kpi-val">{totalMembers.toLocaleString()}</span>
              <span className="admin-standing-kpi-unit">members</span>
            </div>
            <span className="admin-standing-kpi-hint">Enrolled across active rosters</span>
          </div>

          <div className="admin-standing-kpi-card">
            <span className="admin-standing-kpi-label">Average Organization Size</span>
            <div className="admin-standing-kpi-value-row">
              <span className="admin-standing-kpi-val">{avgMembers}</span>
              <span className="admin-standing-kpi-unit">students</span>
            </div>
            <span className="admin-standing-kpi-hint">Mean active roster count</span>
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
              type="text"
              placeholder="Search by name, acronym, category, college, adviser..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="admin-standing-search-input"
              aria-label="Search organizations standing"
            />
            {searchQuery && (
              <button
                type="button"
                className="admin-standing-search-clear"
                onClick={() => setSearchQuery('')}
                title="Clear search"
                aria-label="Clear search"
              >
                <Icon name="close" size={13} />
              </button>
            )}
          </div>
        </div>

        {filteredOrgs.length ? (
          <Table useDataTable columns={columns} rows={filteredOrgs} />
        ) : (
          <EmptyState
            title="No organizations match your filter"
            description="Try selecting a different status filter or clearing your search query."
          />
        )}
      </div>
    </Card>
  )
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
    <div className="admin-page">
      <PageHeader description="Campus-wide oversight of organizations, events, accounts, and approval work." eyebrow="UNIDOS ADMINISTRATION" title="Admin Dashboard">
        <div className="admin-metrics-grid">
          <Metric label="Active Organizations" value={data.adminOrganizations.filter((item) => item.status === 'ACTIVE').length} />
          <Metric label="Total Students" value={data.adminUsers.filter((item) => item.role === 'Student').length.toLocaleString()} />
          <Metric label="Pending Organization Applications" value={pendingApplications} />
          <Metric label="Pending Event Reviews" value={pendingEvents} />
        </div>
      </PageHeader>
      <Card className="admin-section-card">
        <div className="admin-section-heading"><div><h2>Work requiring attention</h2><p>Review pending requests across campus.</p></div><Link className="button button-secondary" to="/admin/approvals">Open Approval Center</Link></div>
        {pending.length ? <Table useDataTable columns={[
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
      <Card className="admin-section-card"><h2>Upcoming and approved events</h2>{upcomingEvents.length ? <Table useDataTable columns={[{ key: 'title', label: 'Event' }, { key: 'organizationName', label: 'Organization' }, { key: 'date', label: 'Date' }, { key: 'startTime', label: 'Time' }, { key: 'location', label: 'Venue' }, { key: 'status', label: 'Status', render: (value) => <Status value={value} /> }]} rows={upcomingEvents} /> : <EmptyState title="No scheduled events" />}</Card>
    </div>
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
  const [publishTarget, setPublishTarget] = useState(null)
  const [saveSettingsOpen, setSaveSettingsOpen] = useState(false)
  const [actionFilter, setActionFilter] = useState('All')
  const [categoryDateRange, setCategoryDateRange] = useState({ start: '', end: '' })
  const [eventsDateRange, setEventsDateRange] = useState({ start: '', end: '' })
  const [attendanceDateRange, setAttendanceDateRange] = useState({ start: '', end: '' })
  const [membershipDateRange, setMembershipDateRange] = useState({ start: '', end: '' })
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
    const undo = data.captureUndo()
    const ok = data.reviewOrganizationApplication(item.id, decision, comment)
    if (ok) showToast(`Organization application ${decision.toLowerCase()}.`, 'success', undoAction(undo))
    return ok
  }
  function decideEvent(item, decision, comment) {
    const undo = data.captureUndo()
    const ok = data.reviewAdminEvent(item.id, decision, comment)
    if (ok) showToast(`Event proposal ${decision.toLowerCase()}.`, 'success', undoAction(undo))
    return ok
  }
  function decideDocument(item, decision, comment) {
    const undo = data.captureUndo()
    const ok = data.reviewAdminDocument(item.id, decision, comment)
    if (ok) showToast(`Document ${decision.toLowerCase()}.`, 'success', undoAction(undo))
    return ok
  }

  if (pathname.endsWith('/dashboard')) return <AdminDashboard data={data} />

  if (pathname.endsWith('/users') || pathname.endsWith('/students')) {
    const isStudents = pathname.endsWith('/students')
    const rows = isStudents ? filteredStudents : data.adminUsers.filter((item) => matches(item))
    return (
      <div className="admin-page">
        <PageHeader description={isStudents ? 'Browse student directory records and academic information.' : 'Manage account access while protecting administrator safeguards.'} eyebrow="UNIDOS ADMINISTRATION" title={isStudents ? 'Student Directory' : 'User Management'} />
        <FilterBar search={search} setSearch={setSearch}>
          {!isStudents && <FilterSelect label="Account status" onChange={setStatusFilter} options={['All', ...['ACTIVE', 'INACTIVE', 'SUSPENDED']]} value={statusFilter} />}
          {isStudents && <>
            <label className="admin-filter-field"><span>Program</span><select onChange={(event) => setProgramFilter(event.target.value)} value={programFilter}>{adminPrograms.map((value) => <option key={value}>{value}</option>)}</select></label>
            <label className="admin-filter-field"><span>Year level</span><select onChange={(event) => setYearFilter(event.target.value)} value={yearFilter}>{adminYears.map((value) => <option key={value}>{value}</option>)}</select></label>
            <FilterSelect label="Account status" onChange={setStatusFilter} options={['All', ...['ACTIVE', 'INACTIVE', 'SUSPENDED']]} value={statusFilter} />
          </>}
        </FilterBar>
        <Card className="admin-section-card">{rows.length ? <Table useDataTable columns={[
          { key: 'name', label: 'Name', render: (value, row) => isStudents ? formatDisplayName(row) : value }, { key: 'userId', label: 'ID' }, { key: 'email', label: 'Email' },
          ...(isStudents ? [
            { key: 'program', label: 'Program' }, { key: 'yearLevel', label: 'Year' },
            { key: 'organizationCount', label: 'Organizations', render: (_, row) => data.studentMemberships.filter((membership) => membership.studentId === row.userId && membership.status === 'ACTIVE').length },
            { key: 'status', label: 'Status', render: (value) => <Status value={value} /> },
            {
              key: 'actions', label: 'Profile', render: (_, row) => <Button onClick={() => setSelected({
                ...row,
                title: `${formatDisplayName(row)} — Student Profile`,
                organizations: data.studentMemberships.filter((membership) => membership.studentId === row.userId).map((membership) => `${membership.organizationId}: ${membership.status}`),
                registrations: data.studentRegistrations.filter((registration) => registration.studentId === row.userId).map((registration) => `${registration.eventId}: ${registration.status}`),
                attendance: data.studentRegistrations.filter((registration) => registration.studentId === row.userId).map((registration) => `${registration.eventId}: ${registration.attendanceStatus}`),
              })} variant="secondary">View profile</Button>
            },
          ] : [
            { key: 'role', label: 'Role', render: (value, row) => <select aria-label={`Role for ${formatDisplayName(row)}`} disabled={row.id === 'admin-root'} onChange={(event) => setUserChange({ user: row, changes: { role: event.target.value } })} value={value}>{roleOptions.map((role) => <option key={role}>{role}</option>)}</select> },
            { key: 'status', label: 'Status', render: (value, row) => <select aria-label={`Status for ${formatDisplayName(row)}`} disabled={row.id === 'admin-root'} onChange={(event) => setUserChange({ user: row, changes: { status: event.target.value } })} value={value}>{['ACTIVE', 'INACTIVE', 'SUSPENDED'].map((status) => <option key={status} value={status}>{humanize(status)}</option>)}</select> },
            { key: 'organization', label: 'Organization' },
          ]),
          { key: 'lastActivity', label: 'Last Activity' },
        ]} rows={rows} /> : <EmptyState title="No matching records" />}</Card>
        <RecordModal item={selected} onClose={() => setSelected(null)} />
        <Modal onClose={() => setUserChange(null)} open={Boolean(userChange)} title="Confirm account change">
          {userChange && <><p>Apply this access change for <strong>{formatDisplayName(userChange.user)}</strong>?</p><p>{Object.entries(userChange.changes).map(([key, value]) => `${key}: ${value}`).join(' · ')}</p><Button onClick={() => { const undo = data.captureUndo(); const result = data.updateAdminUser(userChange.user.id, userChange.changes); showToast(result.ok ? 'User account updated.' : result.reason, result.ok ? 'success' : 'error', result.ok ? undoAction(undo) : {}); if (result.ok) setUserChange(null) }}>Confirm change</Button></>}
        </Modal>
      </div>
    )
  }

  if (pathname.endsWith('/organizations')) {
    return (
      <div className="admin-page">
        <PageHeader description="Monitor accreditation and institutional standing for recognized organizations." eyebrow="UNIDOS ADMINISTRATION" title="Organizations" />
        <FilterBar search={search} setSearch={setSearch}><FilterSelect label="Status" onChange={setStatusFilter} options={['All', ...['ACTIVE', 'INACTIVE', 'SUSPENDED']]} value={statusFilter} /></FilterBar>
        <Card className="admin-section-card">{data.adminOrganizations.filter((item) => matches(item, ['name', 'acronym', 'category', 'adviser', 'status'])).length ? <Table useDataTable columns={[
          { key: 'name', label: 'Organization' }, { key: 'acronym', label: 'Acronym' }, { key: 'category', label: 'Category' },
          { key: 'adviser', label: 'Adviser' }, { key: 'memberCount', label: 'Members' }, { key: 'status', label: 'Status', render: (value) => <Status value={value} /> },
          { key: 'accreditationStatus', label: 'Accreditation' },
          { key: 'actions', label: 'Actions', render: (_, item) => <div className="admin-row-actions"><Button onClick={() => setSelected(item)} variant="secondary">View</Button><Button onClick={() => setOrganizationEdit(item)} variant="secondary">Edit</Button><Button onClick={() => { setTarget(item); setReason('') }} variant={item.status === 'SUSPENDED' ? 'secondary' : 'danger'}>{item.status === 'SUSPENDED' ? 'Reactivate' : 'Suspend'}</Button></div> },
        ]} rows={data.adminOrganizations.filter((item) => matches(item, ['name', 'acronym', 'category', 'adviser', 'status']))} /> : <EmptyState title="No organizations found" />}</Card>
        <Modal onClose={() => setTarget(null)} open={Boolean(target)} title={target?.status === 'SUSPENDED' ? 'Reactivate organization' : 'Suspend organization'}>
          {target && <p>Change <strong>{target.name}</strong> status?{target.status !== 'SUSPENDED' && <label className="admin-modal-label">Reason for suspension<textarea onChange={(event) => setReason(event.target.value)} value={reason} /></label>}</p>}
          <Button onClick={() => {
            const next = target?.status === 'SUSPENDED' ? 'ACTIVE' : 'SUSPENDED'
            const undo = data.captureUndo()
            const ok = target && data.updateAdminOrganizationStatus(target.id, next, reason)
            if (ok) { showToast(`Organization ${next.toLowerCase()}.`, 'success', undoAction(undo)); setTarget(null) }
            else showToast('A suspension reason is required.', 'error')
          }}>Confirm</Button>
        </Modal>
        <OrganizationEditModal key={organizationEdit?.id ?? 'closed'} organization={organizationEdit} onClose={() => setOrganizationEdit(null)} onSave={(changes) => {
          const ok = organizationEdit && data.updateAdminOrganization(organizationEdit.id, changes)
          if (ok) { showToast('Organization details updated.', 'success'); setOrganizationEdit(null) }
          else showToast('Complete all organization fields before saving.', 'error')
        }} />
        <RecordModal item={selected} onClose={() => setSelected(null)} />
      </div>
    )
  }

  if (pathname.endsWith('/organization-applications')) {
    return (
      <div className="admin-page">
        <PageHeader description="Review recognition submissions and required supporting documents." eyebrow="UNIDOS ADMINISTRATION" title="Organization Applications" />
        <FilterBar search={search} setSearch={setSearch}><FilterSelect label="Status" onChange={setStatusFilter} options={['All', 'PENDING', 'APPROVED', 'RETURNED', 'REJECTED']} value={statusFilter} /></FilterBar>
        <Card className="admin-section-card">{filteredApplications.length ? <Table useDataTable columns={[
          { key: 'name', label: 'Organization' }, { key: 'acronym', label: 'Acronym' }, { key: 'submittedBy', label: 'Submitted by' }, { key: 'submittedDate', label: 'Date submitted' },
          { key: 'status', label: 'Status', render: (value) => <Status value={value} /> },
          { key: 'actions', label: 'Actions', render: (_, item) => <div className="admin-row-actions"><Button onClick={() => setSelected({ ...item, title: item.name })} variant="secondary">View</Button>{item.status === 'PENDING' && <Button onClick={() => setSelected({ ...item, title: item.name, __application: true })}>Review</Button>}</div> },
        ]} rows={filteredApplications} /> : <EmptyState title="No applications found" />}</Card>
        <RecordModal canDecide={Boolean(selected?.__application)} decisionLabels={{ APPROVED: 'Approve accreditation', RETURNED: 'Return for revision', REJECTED: 'Reject application' }} item={selected} onClose={() => setSelected(null)} onDecision={(decision, comment) => decideApplication(selected, decision, comment)} />
      </div>
    )
  }

  if (pathname.endsWith('/events')) {
    const rows = orgEvents.filter((item) => matches(item, ['title', 'organizationName', 'status', 'category']))
    return (
      <div className="admin-page">
        <PageHeader description="Oversee proposals across campus. Publishing is available only after both adviser and Student Affairs approval." eyebrow="UNIDOS ADMINISTRATION" title="Campus Events" />
        <FilterBar search={search} setSearch={setSearch}><FilterSelect label="Status" onChange={setStatusFilter} options={['All', 'DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'PUBLISHED', 'ONGOING', 'COMPLETED', 'ARCHIVED', 'RETURNED_FOR_REVISION', 'REJECTED']} value={statusFilter} /></FilterBar>
        <Card className="admin-section-card">{rows.length ? <Table useDataTable columns={[
          { key: 'title', label: 'Event' }, { key: 'organizationName', label: 'Organization' }, { key: 'date', label: 'Date' }, { key: 'location', label: 'Venue' },
          { key: 'status', label: 'Status', render: (value) => <Status value={value} /> },
          { key: 'actions', label: 'Actions', render: (_, item) => <div className="admin-row-actions"><Button onClick={() => setSelected(item)} variant="secondary">View</Button>{pendingAdminEvents.some((event) => event.id === item.id) && <Button onClick={() => setSelected({ ...item, __event: true })}>Review</Button>}{item.adminApprovedAt && item.status === 'APPROVED' && <Button onClick={() => setPublishTarget(item)}>Publish</Button>}</div> },
        ]} rows={rows} /> : <EmptyState title="No campus events found" />}</Card>
        <RecordModal canDecide={Boolean(selected?.__event)} decisionLabels={{ APPROVED: 'Approve for publication', RETURNED: 'Return for revision', REJECTED: 'Reject proposal' }} item={selected} onClose={() => setSelected(null)} onDecision={(decision, comment) => decideEvent(selected, decision, comment)} />
        <ConfirmDialog
          confirmLabel="Publish event"
          message={`Are you sure you want to publish "${publishTarget?.title ?? 'this event'}"? It will become visible to all students.`}
          onCancel={() => setPublishTarget(null)}
          onConfirm={() => {
            const undo = data.captureUndo()
            const ok = data.publishAdminEvent(publishTarget.id)
            setPublishTarget(null)
            showToast(ok ? 'Event published and visible to students.' : 'Event cannot be published yet.', ok ? 'success' : 'error', ok ? undoAction(undo) : {})
          }}
          open={Boolean(publishTarget)}
          title="Publish event"
        />
      </div>
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
      <div className="admin-page">
        <PageHeader description="A single queue for cross-campus applications, adviser-approved events, and documents." eyebrow="UNIDOS ADMINISTRATION" title="Approval Center" />
        <FilterBar search={search} setSearch={setSearch}>
          <select aria-label="Filter approvals by status" onChange={(event) => setStatusFilter(event.target.value)} value={statusFilter}>
            {['All', 'PENDING', 'APPROVED', 'RETURNED', 'REJECTED'].map((value) => <option value={value} key={value}>{value === 'All' ? value : value.replace('_', ' ')}</option>)}
          </select>
        </FilterBar>
        <Card className="admin-section-card">{approvals.length ? <Table useDataTable columns={[
          { key: 'title', label: 'Request' }, { key: 'type', label: 'Type' }, { key: 'organizationName', label: 'Organization', render: (value, row) => value ?? row.name },
          { key: 'submittedBy', label: 'Submitted by', render: (value, row) => value ?? row.submittedBy ?? 'Organization officer' },
          { key: 'status', label: 'Status', render: (value) => <Status value={value} /> },
          { key: 'actions', label: 'Actions', render: (_, item) => <div className="admin-row-actions"><Button onClick={() => setSelected(item)} variant="secondary">View</Button>{item.canReview && <Button onClick={() => setSelected({ ...item, __approval: item.entityKind })}>Review</Button>}</div> },
        ]} rows={approvals} /> : <EmptyState title="No approvals found" />}</Card>
        <RecordModal canDecide={Boolean(selected?.__approval)} item={selected} onClose={() => setSelected(null)} onDecision={(decision, comment) => selected?.__approval === 'application'
          ? decideApplication(selected, decision, comment)
          : selected?.__approval === 'event' ? decideEvent(selected, decision, comment)
            : selected?.__approval === 'document' ? decideDocument(selected, decision, comment) : false} />
      </div>
    )
  }

  if (pathname.endsWith('/documents')) {
    const rows = adminDocuments.filter((item) => matches(item, ['title', 'organizationName', 'type', 'status']))
    return (
      <div className="admin-page">
        <PageHeader description="Review organization documents after the adviser has completed their review." eyebrow="UNIDOS ADMINISTRATION" title="Documents" />
        <FilterBar search={search} setSearch={setSearch}><select aria-label="Filter document status" onChange={(event) => setStatusFilter(event.target.value)} value={statusFilter}><option>All</option>{['PENDING', 'APPROVED', 'RETURNED', 'REJECTED'].map((value) => <option key={value}>{value}</option>)}</select></FilterBar>
        <Card className="admin-section-card">{rows.length ? <Table useDataTable columns={[
          { key: 'title', label: 'Document' }, { key: 'type', label: 'Type' }, { key: 'organizationName', label: 'Organization' }, { key: 'submittedDate', label: 'Submitted' },
          { key: 'status', label: 'Status', render: (value) => <Status value={value} /> },
          { key: 'actions', label: 'Actions', render: (_, item) => <div className="admin-row-actions"><Button onClick={() => setSelected(item)} variant="secondary">View</Button>{item.status === 'APPROVED' && <Button onClick={() => setSelected({ ...item, __document: true })}>Review</Button>}</div> },
        ]} rows={rows} /> : <EmptyState description="Adviser-approved documents requiring Student Affairs review will appear here." title="No documents to review" />}</Card>
        <RecordModal canDecide={Boolean(selected?.__document)} item={selected} onClose={() => setSelected(null)} onDecision={(decision, comment) => decideDocument(selected, decision, comment)} />
      </div>
    )
  }

  if (pathname.endsWith('/reports')) {
    const organizationById = (id) => data.adminOrganizations.find((organization) => organization.id === id)
    const allReportRows = [
      ...data.adminOrganizations.map((item) => ({ type: 'Organization', name: item.name, status: item.status, count: item.memberCount, organizationId: item.id, category: item.category, college: item.college })),
      ...orgEvents.map((item) => ({ type: 'Event', name: item.title, status: item.status, count: item.registeredCount ?? 0, organizationId: item.organizationId, category: organizationById(item.organizationId)?.category, college: organizationById(item.organizationId)?.college, eventCategory: item.category })),
      ...data.adviserReports.map((item) => ({ type: 'Accomplishment report', name: item.eventTitle, status: item.status, count: item.attendance, organizationId: item.organizationId, category: organizationById(item.organizationId)?.category, college: organizationById(item.organizationId)?.college })),
    ]
    const reportRows = allReportRows.filter((item) => matches(item, ['type', 'name', 'status'])
      && (reportFilters.category === 'All Categories' || item.category === reportFilters.category)
      && (reportFilters.college === 'All Colleges' || item.college === reportFilters.college)
      && (reportFilters.eventType === 'All Event Types' || item.eventCategory === reportFilters.eventType))
    return (
      <div className="admin-page">
        <PageHeader description="Export current mock system records for administrative review." eyebrow="UNIDOS ADMINISTRATION" title="Reports">
          <div className="admin-metrics-grid">
            <Metric label="Total Accredited Organizations" value={data.adminOrganizations.filter(o => o.status === 'ACTIVE').length} />
            <Metric label="Active Student Members" value={data.adminUsers.filter(u => u.role === 'Student').length} />
            <Metric label="Total Events Held" value={orgEvents.length} />
            <Metric label="Unique Student Participants" value={data.adminUsers.filter(u => u.role === 'Student').length} />
          </div>
        </PageHeader>

        <div className="admin-report-actions"><Button onClick={() => showToast(downloadCsv('unidos-campus-report.csv', reportRows) ? 'CSV report downloaded.' : 'There is no report data to export.', reportRows.length ? 'success' : 'error')}>Download CSV</Button><Button onClick={() => showToast(downloadExcel('unidos-campus-report.xls', reportRows) ? 'Excel-compatible report downloaded.' : 'There is no report data to export.', reportRows.length ? 'success' : 'error')} variant="secondary">Download Excel</Button><Button onClick={() => window.print()} variant="secondary">Print / Save as PDF</Button></div>
        <FilterBar search={search} setSearch={setSearch}>
          <select aria-label="Filter report status" onChange={(event) => setStatusFilter(event.target.value)} value={statusFilter}>
            <option>All</option>
            {[...new Set(allReportRows.map(row => row.status).filter(Boolean))].map((value) => <option value={value} key={value}>{value.replace(/_/g, ' ')}</option>)}
          </select>
          <select aria-label="Filter academic year"><option>{data.adminSettings.academicYear}</option></select>
          <select aria-label="Filter semester"><option>{data.adminSettings.semester}</option></select>
          <select aria-label="Filter college" onChange={(event) => setReportFilters((current) => ({ ...current, college: event.target.value }))} value={reportFilters.college}>{['All Colleges', 'College of Computing Studies', 'College of Arts and Sciences'].map((value) => <option key={value}>{value}</option>)}</select>
          <select aria-label="Filter organization category" onChange={(event) => setReportFilters((current) => ({ ...current, category: event.target.value }))} value={reportFilters.category}>{['All Categories', ...new Set(data.adminOrganizations.map((organization) => organization.category))].map((value) => <option key={value}>{value}</option>)}</select>
          <select aria-label="Filter event type" onChange={(event) => setReportFilters((current) => ({ ...current, eventType: event.target.value }))} value={reportFilters.eventType}>{['All Event Types', ...new Set(orgEvents.map((event) => event.category).filter(Boolean))].map((value) => <option key={value}>{value}</option>)}</select>
        </FilterBar>
        <Card className="admin-section-card">{reportRows.length ? <Table useDataTable columns={[{ key: 'type', label: 'Record type' }, { key: 'name', label: 'Name' }, { key: 'status', label: 'Status', render: (value) => <Status value={value} /> }, { key: 'count', label: 'Members / attendance' }]} rows={reportRows} /> : <EmptyState title="No report records" />}</Card>
      </div>
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
    const organizationStanding = ['ACTIVE', 'INACTIVE', 'SUSPENDED'].map((status) => ({
      label: status,
      value: data.adminOrganizations.filter((organization) => organization.status === status).length,
    }))

    const categoryRows = categories.map((cat) => {
      const sDate = parseRecordDate(categoryDateRange.start)
      const eDate = parseRecordDate(categoryDateRange.end)
      if (eDate) eDate.setHours(23, 59, 59, 999)

      if (!sDate && !eDate) {
        return {
          label: cat,
          value: data.adminOrganizations.filter((org) => org.category === cat).length,
        }
      }

      const matchingOrgs = data.adminOrganizations.filter((org) => {
        if (org.category !== cat) return false
        const hasAnnouncement = org.announcements?.some((a) => {
          const d = parseRecordDate(a.datePosted || a.date)
          return d && (!sDate || d >= sDate) && (!eDate || d <= eDate)
        })
        const hasEvent = orgEvents.some((e) => {
          if (e.organizationId !== org.id && e.category !== cat) return false
          const d = parseRecordDate(e.date) || parseRecordDate(e.submittedDate) || parseRecordDate(e.createdAt)
          return d && (!sDate || d >= sDate) && (!eDate || d <= eDate)
        })
        return hasAnnouncement || hasEvent
      })

      return { label: cat, value: matchingOrgs.length }
    })

    const eventsTimeline = buildTimeline(eventsDateRange)
    const eventsCounts = {}
    orgEvents.forEach((event) => {
      const primaryKey = getRecordSlotKey(event.date, eventsTimeline)
      const secondaryKey = getRecordSlotKey(event.submittedDate || event.createdAt, eventsTimeline)
      const chosenKey = primaryKey || secondaryKey
      if (chosenKey) {
        eventsCounts[chosenKey] = (eventsCounts[chosenKey] || 0) + 1
      }
    })
    const eventsChartData = eventsTimeline.slots.map((slot) => ({
      label: slot.label,
      value: eventsCounts[slot.key] || 0,
    }))
    const eventsTitle = eventsTimeline.granularity === 'day'
      ? 'Events per day'
      : eventsTimeline.granularity === 'week'
      ? 'Events per week'
      : 'Events per month'

    const attendanceTimeline = buildTimeline(attendanceDateRange)
    const attendanceCounts = {}
    data.studentRegistrations?.forEach((reg) => {
      const regDate = reg.checkInDate || reg.registrationDate || reg.checkInTime
      const key = getRecordSlotKey(regDate, attendanceTimeline)
      if (key && (reg.status === 'COMPLETED' || reg.attendanceStatus === 'ATTENDED' || reg.status === 'REGISTERED')) {
        attendanceCounts[key] = (attendanceCounts[key] || 0) + 1
      }
    })
    const attendanceTrends = attendanceTimeline.slots.map((slot) => ({
      label: slot.label,
      value: attendanceCounts[slot.key] || 0,
    }))

    const membershipTimeline = buildTimeline(membershipDateRange)
    const membershipCounts = {}
    const allMemberships = [
      ...(data.studentMemberships ?? []),
      ...(data.officerMembershipRequests ?? []).filter((req) => !data.studentMemberships?.some((m) => m.id === req.id)),
    ]
    allMemberships.forEach((membership) => {
      const memDate = membership.applicationDate || membership.approvedDate || membership.dateJoined
      const key = getRecordSlotKey(memDate, membershipTimeline)
      if (key) {
        membershipCounts[key] = (membershipCounts[key] || 0) + 1
      }
    })
    const membershipTrends = membershipTimeline.slots.map((slot) => ({
      label: slot.label,
      value: membershipCounts[slot.key] || 0,
    }))

    return (
      <div className="admin-page">
        <PageHeader description="A live summary of organization, membership, event, and participation patterns." eyebrow="UNIDOS ADMINISTRATION" title="Analytics">
          <div className="admin-metrics-grid">{stats.map((stat) => <Metric key={stat.label} label={stat.label} value={stat.value} detail={`of ${stat.total} total records`} />)}</div>
        </PageHeader>
        <div className="admin-analytics-grid">
          <AnalyticsChart 
            title="Organization category distribution" 
            type="bar" 
            rows={categoryRows}
            filter={
              <DateRangeFilter
                startDate={categoryDateRange.start}
                endDate={categoryDateRange.end}
                onStartChange={(val) => setCategoryDateRange((prev) => ({ ...prev, start: val }))}
                onEndChange={(val) => setCategoryDateRange((prev) => ({ ...prev, end: val }))}
                onReset={() => setCategoryDateRange({ start: '', end: '' })}
              />
            }
          />
          <AnalyticsChart 
            title={eventsTitle} 
            type="bar" 
            rows={eventsChartData} 
            filter={
              <DateRangeFilter
                startDate={eventsDateRange.start}
                endDate={eventsDateRange.end}
                onStartChange={(val) => setEventsDateRange((prev) => ({ ...prev, start: val }))}
                onEndChange={(val) => setEventsDateRange((prev) => ({ ...prev, end: val }))}
                onReset={() => setEventsDateRange({ start: '', end: '' })}
              />
            }
          />
          <AnalyticsChart 
            title="Attendance trends" 
            type="line" 
            lineColor="#2563eb" 
            rows={attendanceTrends} 
            filter={
              <DateRangeFilter
                startDate={attendanceDateRange.start}
                endDate={attendanceDateRange.end}
                onStartChange={(val) => setAttendanceDateRange((prev) => ({ ...prev, start: val }))}
                onEndChange={(val) => setAttendanceDateRange((prev) => ({ ...prev, end: val }))}
                onReset={() => setAttendanceDateRange({ start: '', end: '' })}
              />
            }
          />
          <AnalyticsChart 
            title="Membership trends" 
            type="line" 
            lineColor="#d97706" 
            rows={membershipTrends} 
            filter={
              <DateRangeFilter
                startDate={membershipDateRange.start}
                endDate={membershipDateRange.end}
                onStartChange={(val) => setMembershipDateRange((prev) => ({ ...prev, start: val }))}
                onEndChange={(val) => setMembershipDateRange((prev) => ({ ...prev, end: val }))}
                onReset={() => setMembershipDateRange({ start: '', end: '' })}
              />
            }
          />
        </div>
        <OrganizationStandingChart rows={organizationStanding} total={orgTotal} organizations={data.adminOrganizations} />
      </div>
    )
  }

  if (pathname.endsWith('/audit-logs')) {
    const query = search.trim().toLowerCase()
    const rows = data.adminAuditLogs.filter((item) => (
      (statusFilter === 'All' || item.entityType === statusFilter)
      && (actionFilter === 'All' || item.action === actionFilter)
      && (!query || ['actor', 'action', 'entityType', 'entityId', 'description', 'timestamp'].some((key) => String(item[key] ?? '').toLowerCase().includes(query)))
    ))
    return <><PageHeader description="Search the recorded history of significant system and approval actions." eyebrow="UNIDOS ADMINISTRATION" title="Audit Logs" /><FilterBar search={search} setSearch={setSearch}><select aria-label="Filter audit entity" onChange={(event) => setStatusFilter(event.target.value)} value={statusFilter}><option>All</option>{[...new Set(data.adminAuditLogs.map((log) => log.entityType))].map((type) => <option key={type}>{type}</option>)}</select><select aria-label="Filter audit action" onChange={(event) => setActionFilter(event.target.value)} value={actionFilter}><option>All</option>{[...new Set(data.adminAuditLogs.map((log) => log.action))].map((action) => <option key={action}>{action}</option>)}</select></FilterBar><Card className="admin-section-card">{rows.length ? <Table useDataTable columns={[{ key: 'timestamp', label: 'Date / time' }, { key: 'actor', label: 'Actor' }, { key: 'action', label: 'Action' }, { key: 'entityType', label: 'Entity' }, { key: 'entityId', label: 'Record ID' }, { key: 'description', label: 'Details' }]} rows={rows} /> : <EmptyState title="No audit entries found" />}</Card></>
  }

  if (pathname.endsWith('/settings')) {
    return (
      <div className="admin-page">
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
          <Button onClick={() => setSaveSettingsOpen(true)}>Save Settings</Button>
        </Card>
        <ConfirmDialog
          confirmLabel="Save settings"
          message="Are you sure you want to save these system settings? They apply to every user."
          onCancel={() => setSaveSettingsOpen(false)}
          onConfirm={() => {
            const undo = data.captureUndo()
            data.saveAdminSettings(settings)
            setSaveSettingsOpen(false)
            showToast('System settings saved.', 'success', undoAction(undo))
          }}
          open={saveSettingsOpen}
          title="Save system settings"
        />
      </div>
    )
  }
  return <PageHeader description="This administration section is not available." title="Page not found" />
}

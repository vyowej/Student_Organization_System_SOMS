import { useMemo, useState, useEffect, useRef } from 'react'
import { useOutletContext } from 'react-router-dom'
import DataTable from 'datatables.net-dt'
import 'datatables.net-dt/css/dataTables.dataTables.min.css'
import Badge from '../components/ui/Badge.jsx'
import Button from '../components/ui/Button.jsx'
import Card from '../components/ui/Card.jsx'
import Modal from '../components/ui/Modal.jsx'
import PageHeader from '../components/layout/PageHeader.jsx'
import { useToast } from '../components/ui/useToast.js'
import { officerPositions } from '../data/officerPortal.js'
import { formatDisplayName } from '../data/displayName.js'

const statusTones = { ACTIVE: 'success', SUSPENDED: 'warning', INACTIVE: 'neutral' }
const statusFilters = ['All', 'Active', 'Suspended', 'Inactive']
const officerRoles = ['President', 'Vice President', 'Secretary', 'Treasurer', 'Auditor', 'PIO']

function formatStatus(status) {
  return status.charAt(0) + status.slice(1).toLowerCase()
}

export default function OfficerMembersPage() {
  const {
    assignOfficerPosition,
    officerMemberCount,
    officerMembers,
    updateOfficerMemberStatus,
  } = useOutletContext()
  const { showToast } = useToast()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('All')
  const [positionFilter, setPositionFilter] = useState('All Positions')
  const [viewingMember, setViewingMember] = useState(null)
  const [editingMember, setEditingMember] = useState(null)
  const [editPosition, setEditPosition] = useState('')
  const [statusTarget, setStatusTarget] = useState(null)
  const [nextStatus, setNextStatus] = useState('')
  const [positionTarget, setPositionTarget] = useState(null)
  const [assignedMemberId, setAssignedMemberId] = useState('')
  const [assignedPosition, setAssignedPosition] = useState('')
  const tableRef = useRef(null)

  const filteredMembers = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase()
    return officerMembers.filter((member) => {
      const matchesSearch = !normalizedSearch
        || [formatDisplayName(member), member.studentId, member.program].some((value) => value.toLowerCase().includes(normalizedSearch))
      const matchesStatus = statusFilter === 'All' || member.status === statusFilter.toUpperCase()
      const matchesPosition = positionFilter === 'All Positions' || member.position === positionFilter
      return matchesSearch && matchesStatus && matchesPosition
    })
  }, [officerMembers, positionFilter, search, statusFilter])

  useEffect(() => {
    if (tableRef.current) {
      const dt = new DataTable(tableRef.current, {
        destroy: true,
        paging: true,
        searching: false,
        ordering: true,
        info: true,
        layout: {
          topStart: null,
          topEnd: null,
          bottomStart: ['pageLength', 'info'],
          bottomEnd: 'paging'
        },
        columnDefs: [
          { orderable: false, targets: -1 }
        ],
      })
      return () => {
        dt.destroy()
      }
    }
  }, [filteredMembers])

  function startEdit(member) {
    setEditingMember(member)
    setEditPosition(member.position)
  }

  function confirmEdit() {
    if (!editingMember) return
    const result = assignOfficerPosition(editingMember.id, editPosition)
    if (result.ok) {
      showToast(`${formatDisplayName(editingMember)}'s position is now ${editPosition}.`, 'success')
      setEditingMember(null)
    } else {
      showToast(result.reason, 'error')
    }
  }

  function confirmStatusChange() {
    if (!statusTarget) return
    const changed = updateOfficerMemberStatus(statusTarget.id, nextStatus)
    if (changed) showToast(`${formatDisplayName(statusTarget)}'s membership status is now ${formatStatus(nextStatus)}.`, 'success')
    setStatusTarget(null)
  }

  function confirmOfficerPosition() {
    if (!positionTarget) return
    const selectedMember = officerMembers.find((member) => member.id === assignedMemberId && member.status === 'ACTIVE')
    if (!selectedMember) return
    const result = assignOfficerPosition(selectedMember.id, assignedPosition)
    if (result.ok) {
      showToast(`${formatDisplayName(selectedMember)} is now ${assignedPosition}.`, 'success')
      setPositionTarget(null)
    } else {
      showToast(result.reason, 'error')
    }
  }

  const officers = officerRoles.map((position) => ({
    position,
    member: officerMembers.find((member) => member.status === 'ACTIVE' && member.position === position),
  }))

  return (
    <div className="officer-members-page">
      <PageHeader
        description="Manage the members and officers of WMSU Computer Society."
        eyebrow="WMSU Computer Society"
        title="Organization Members"
      />
      <Card className="officer-member-management">
        <div className="officer-member-toolbar">
          <div>
            <h2>WMSU Computer Society</h2>
            <p>{officerMemberCount} total members <span aria-hidden="true">·</span> Search and manage this organization&apos;s roster</p>
          </div>
          <label className="officer-member-search">
            <span className="sr-only">Search members by name, student ID, or program</span>
            <svg aria-hidden="true" viewBox="0 0 24 24"><circle cx="11" cy="11" r="7" /><path d="m16 16 4 4" /></svg>
            <input onChange={(event) => setSearch(event.target.value)} placeholder="Search members..." type="search" value={search} />
          </label>
        </div>

        <div aria-label="Filter membership status" className="officer-filter-row">
          <div className="officer-member-status-filters" role="group">
            {statusFilters.map((filter) => (
              <button
                aria-pressed={statusFilter === filter}
                className={`officer-filter-button${statusFilter === filter ? ' is-selected' : ''}`}
                key={filter}
                onClick={() => setStatusFilter(filter)}
                type="button"
              >
                {filter}
              </button>
            ))}
          </div>
          <label className="officer-position-filter">
            <span>Position</span>
            <select onChange={(event) => setPositionFilter(event.target.value)} value={positionFilter}>
              <option>All Positions</option>
              {officerPositions.map((position) => <option key={position}>{position}</option>)}
            </select>
          </label>
        </div>

        <div className="officer-member-table-wrap using-datatables" key={filteredMembers.length + '-' + filteredMembers.map(m => m.id).join('-').slice(0, 50)}>
          <table className="officer-member-table" ref={tableRef}>
            <thead>
              <tr>
                <th>Student</th>
                <th>Student ID</th>
                <th>Program</th>
                <th>Position</th>
                <th>Membership Status</th>
                <th>Date Joined</th>
                <th><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {filteredMembers.map((member) => (
                <tr key={member.id}>
                  <td data-label="Student"><strong>{formatDisplayName(member)}</strong></td>
                  <td data-label="Student ID">{member.studentId}</td>
                  <td data-label="Program">{member.program}</td>
                  <td data-label="Position">{member.position}</td>
                  <td data-label="Membership Status"><Badge tone={statusTones[member.status]}>{formatStatus(member.status)}</Badge></td>
                  <td data-label="Date Joined">{member.dateJoined}</td>
                  <td className="officer-member-row-actions" data-label="Actions">
                    <Button onClick={() => setViewingMember(member)} variant="secondary">View</Button>
                    <Button disabled={member.status !== 'ACTIVE'} onClick={() => startEdit(member)} variant="outline">Edit</Button>
                    <Button onClick={() => { setStatusTarget(member); setNextStatus(member.status) }} variant="primary">Manage Status</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredMembers.length === 0 && (
            <p className="officer-inline-empty officer-member-empty">No members match those search and filter settings.</p>
          )}
        </div>
      </Card>

      <Card className="officer-page-card officer-officers-card">
        <div className="officer-page-card-heading">
          <div><h2>Organization Officers</h2><p>Only current WMSU Computer Society officers are listed.</p></div>
          <Badge tone="crimson">President-managed</Badge>
        </div>
        <div className="officer-position-grid">
          {officers.map(({ position, member }) => (
            <article className="officer-position-card" key={position}>
              <span>{position}</span>
              <strong>{member ? formatDisplayName(member) : 'Position unassigned'}</strong>
              {member && <small>{member.studentId}</small>}
              <Button
                disabled={!member && !officerMembers.some((item) => item.status === 'ACTIVE' && ['General Member', 'Committee Head'].includes(item.position))}
                onClick={() => {
                  const target = member ?? officerMembers.find((item) => item.status === 'ACTIVE' && ['General Member', 'Committee Head'].includes(item.position))
                  if (!target) return
                  setPositionTarget(target)
                  setAssignedMemberId(target.id)
                  setAssignedPosition(position)
                }}
                variant="secondary"
              >
                {member ? 'Change officer' : 'Assign officer'}
              </Button>
            </article>
          ))}
        </div>
      </Card>

      <Modal onClose={() => setViewingMember(null)} open={Boolean(viewingMember)} title="Member Details">
        {viewingMember && (
          <div className="officer-member-details">
            <dl>
              <div><dt>Full name</dt><dd>{formatDisplayName(viewingMember)}</dd></div>
              <div><dt>Student ID</dt><dd>{viewingMember.studentId}</dd></div>
              <div><dt>Program</dt><dd>{viewingMember.program}</dd></div>
              <div><dt>Email</dt><dd>{viewingMember.email}</dd></div>
              <div><dt>Organization</dt><dd>WMSU Computer Society</dd></div>
              <div><dt>Position</dt><dd>{viewingMember.position}</dd></div>
              <div><dt>Membership status</dt><dd><Badge tone={statusTones[viewingMember.status]}>{formatStatus(viewingMember.status)}</Badge></dd></div>
              <div><dt>Date joined</dt><dd>{viewingMember.dateJoined}</dd></div>
            </dl>
            <h3>Membership history</h3>
            <ul>{viewingMember.history.map((entry, index) => <li key={`${entry.date}-${index}`}><time>{entry.date}</time><span>{entry.action}</span></li>)}</ul>
          </div>
        )}
      </Modal>

      <Modal onClose={() => setEditingMember(null)} open={Boolean(editingMember)} title="Edit Member Position">
        <p>Change the organization position for {editingMember && formatDisplayName(editingMember)}.</p>
        <label className="officer-modal-field">
          <span>Organization position</span>
          <select onChange={(event) => setEditPosition(event.target.value)} value={editPosition}>
            {officerPositions.map((position) => <option key={position}>{position}</option>)}
          </select>
        </label>
        <p className="officer-permission-note">Positions held by another member will be reassigned to General Member.</p>
        <div className="officer-modal-actions">
          <Button onClick={() => setEditingMember(null)} variant="secondary">Cancel</Button>
          <Button onClick={confirmEdit} variant="primary">Confirm Position Change</Button>
        </div>
      </Modal>

      <Modal onClose={() => setStatusTarget(null)} open={Boolean(statusTarget)} title="Manage Membership Status">
        <p>Confirm a membership status change for {statusTarget && formatDisplayName(statusTarget)}.</p>
        <label className="officer-modal-field">
          <span>Membership status</span>
          <select onChange={(event) => setNextStatus(event.target.value)} value={nextStatus}>
            {['ACTIVE', 'SUSPENDED', 'INACTIVE'].map((status) => <option key={status} value={status}>{formatStatus(status)}</option>)}
          </select>
        </label>
        <div className="officer-modal-actions">
          <Button onClick={() => setStatusTarget(null)} variant="secondary">Cancel</Button>
          <Button disabled={nextStatus === statusTarget?.status} onClick={confirmStatusChange} variant="primary">Confirm Status Change</Button>
        </div>
      </Modal>

      <Modal onClose={() => setPositionTarget(null)} open={Boolean(positionTarget)} title="Confirm Officer Assignment">
        <label className="officer-modal-field">
          <span>Active organization member</span>
          <select onChange={(event) => setAssignedMemberId(event.target.value)} value={assignedMemberId}>
            {officerMembers.filter((member) => member.status === 'ACTIVE').map((member) => (
              <option key={member.id} value={member.id}>{formatDisplayName(member)} · {member.position}</option>
            ))}
          </select>
        </label>
        <p>Assign {formatDisplayName(officerMembers.find((member) => member.id === assignedMemberId))} as {assignedPosition} for WMSU Computer Society?</p>
        <p className="officer-permission-note">Only active members of your assigned organization can be officers. This position will be unassigned from its current holder.</p>
        <div className="officer-modal-actions">
          <Button onClick={() => setPositionTarget(null)} variant="secondary">Cancel</Button>
          <Button onClick={confirmOfficerPosition} variant="primary">Confirm Assignment</Button>
        </div>
      </Modal>
    </div>
  )
}

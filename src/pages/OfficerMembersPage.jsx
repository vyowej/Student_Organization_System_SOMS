import { useMemo, useState, useEffect, useRef } from 'react'
import { useOutletContext } from 'react-router-dom'
import DataTable from 'datatables.net-dt'
import { useStickyOffset } from '../components/ui/useStickyColumns.js'
import 'datatables.net-dt/css/dataTables.dataTables.min.css'
import Badge from '../components/ui/Badge.jsx'
import Button from '../components/ui/Button.jsx'
import Card from '../components/ui/Card.jsx'
import Icon from '../components/ui/Icon.jsx'
import Modal from '../components/ui/Modal.jsx'
import SearchableSelect from '../components/ui/SearchableSelect.jsx'
import PageHeader from '../components/layout/PageHeader.jsx'
import { useToast } from '../components/ui/useToast.js'
import {
  OFFICER_HIERARCHY,
  ORGANIZATION_COMMITTEES,
  YEAR_LEVEL_OPTIONS,
  getDemotionOptions,
  getHierarchyEntry,
  readFileAsDataUrl,
  sanitizeNumericStudentId,
} from '../data/officerHierarchy.js'
import { formatDisplayName, isValidEmail } from '../data/displayName.js'

const statusTones = { ACTIVE: 'success', SUSPENDED: 'warning', INACTIVE: 'neutral' }
const statusFilters = ['All', 'Active', 'Suspended', 'Inactive']

function formatStatus(status) {
  const s = String(status || 'ACTIVE')
  return s.charAt(0) + s.slice(1).toLowerCase()
}

const initialEnrollForm = {
  firstName: '',
  lastName: '',
  studentNumber: '',
  email: '',
  program: '',
  yearLevel: '1st Year',
  position: 'OTHER_OFFICER',
  customTitle: '',
  committee: 'Programs & Events Committee',
  corFileName: '',
  corFileData: null,
}

export default function OfficerMembersPage() {
  const {
    academicPrograms = [],
    addOfficerMember,
    adminOrganizations = [],
    assignOfficerPosition,
    currentUser,
    demoteOfficerMember,
    officerMemberCount,
    officerMembers = [],
    removeOfficerMember,
  } = useOutletContext()
  const { showToast } = useToast()

  const orgId = currentUser?.organizationId || adminOrganizations[0]?.id
  const organization =
    adminOrganizations?.find((item) => String(item.id) === String(orgId)) ||
    adminOrganizations[0] || { name: 'Your Organization', acronym: 'ORG' }

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('All')
  const [positionFilter, setPositionFilter] = useState('All Roles')
  const [viewingMember, setViewingMember] = useState(null)

  // Edit role & committee modal state
  const [editingMember, setEditingMember] = useState(null)
  const [editPosition, setEditPosition] = useState('OTHER_OFFICER')
  const [editCustomTitle, setEditCustomTitle] = useState('')
  const [editCommittee, setEditCommittee] = useState('Programs & Events Committee')

  // Demote modal state
  const [demoteTarget, setDemoteTarget] = useState(null)
  const [demotePosition, setDemotePosition] = useState('MEMBER')
  const [demoteCommittee, setDemoteCommittee] = useState('General Operations Committee')

  // Remove modal state
  const [removeTarget, setRemoveTarget] = useState(null)

  // Quick hierarchy card assignment modal state
  const [positionTarget, setPositionTarget] = useState(null)
  const [assignedMemberId, setAssignedMemberId] = useState('')
  const [assignedPositionCode, setAssignedPositionCode] = useState('PRESIDENT')
  const [assignedCommittee, setAssignedCommittee] = useState('Executive Committee')

  // Enroll new officer modal state
  const [enrollOpen, setEnrollOpen] = useState(false)
  const [enrollForm, setEnrollForm] = useState(initialEnrollForm)
  const [enrollError, setEnrollError] = useState('')
  const [enrollSaving, setEnrollSaving] = useState(false)

  const tableRef = useRef(null)
  useStickyOffset(tableRef)

  const orgMembers = useMemo(
    () =>
      officerMembers
        .filter((m) => !organization.id || String(m.organizationId) === String(organization.id))
        .sort((a, b) => {
          const rankA = getHierarchyEntry(a.rawPosition || a.position).rank
          const rankB = getHierarchyEntry(b.rawPosition || b.position).rank
          if (rankA !== rankB) return rankA - rankB
          return String(formatDisplayName(a)).localeCompare(String(formatDisplayName(b)))
        }),
    [officerMembers, organization.id]
  )

  const filteredMembers = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase()
    return orgMembers.filter((member) => {
      const entry = getHierarchyEntry(member.rawPosition || member.position)
      const matchesSearch =
        !normalizedSearch ||
        [formatDisplayName(member), member.studentId, member.program, member.committee, entry.title]
          .some((value) => String(value || '').toLowerCase().includes(normalizedSearch))
      const matchesStatus = statusFilter === 'All' || member.status === statusFilter.toUpperCase()
      const matchesPosition =
        positionFilter === 'All Roles' ||
        entry.code === positionFilter ||
        entry.title === positionFilter
      return matchesSearch && matchesStatus && matchesPosition
    })
  }, [orgMembers, positionFilter, search, statusFilter])

  useEffect(() => {
    if (tableRef.current) {
      const dt = new DataTable(tableRef.current, {
        destroy: true,
        paging: true,
        searching: false,
        ordering: true,
        info: true,
        autoWidth: false,
        layout: {
          topStart: null,
          topEnd: null,
          bottomStart: ['pageLength', 'info'],
          bottomEnd: 'paging',
        },
        columnDefs: [{ orderable: false, targets: -1 }],
      })
      return () => {
        dt.destroy()
      }
    }
  }, [filteredMembers])

  const existingPresidentForEdit = useMemo(() => {
    if (!editingMember) return null
    return orgMembers.find(
      (m) =>
        getHierarchyEntry(m.rawPosition || m.position).code === 'PRESIDENT' &&
        m.status === 'ACTIVE' &&
        String(m.id) !== String(editingMember.id)
    )
  }, [editingMember, orgMembers])

  const existingPresidentForTarget = useMemo(() => {
    if (!positionTarget || assignedPositionCode !== 'PRESIDENT') return null
    return orgMembers.find(
      (m) =>
        getHierarchyEntry(m.rawPosition || m.position).code === 'PRESIDENT' &&
        m.status === 'ACTIVE' &&
        String(m.id) !== String(assignedMemberId)
    )
  }, [assignedMemberId, assignedPositionCode, orgMembers, positionTarget])

  function startEdit(member) {
    const entry = getHierarchyEntry(member.rawPosition || member.position)
    setEditingMember(member)
    setEditPosition(entry.code)
    setEditCustomTitle(member.customTitle || '')
    setEditCommittee(member.committee || entry.defaultCommittee)
  }

  function startDemote(member) {
    const options = getDemotionOptions(member.rawPosition || member.position)
    const firstLower = options[0] || OFFICER_HIERARCHY[OFFICER_HIERARCHY.length - 1]
    setDemoteTarget(member)
    setDemotePosition(firstLower.code)
    setDemoteCommittee(firstLower.defaultCommittee)
  }

  async function confirmEdit() {
    if (!editingMember) return
    const entry = getHierarchyEntry(editPosition)
    const result = await assignOfficerPosition(
      editingMember.id,
      editPosition,
      editPosition === 'OTHER_OFFICER' ? editCustomTitle : '',
      editCommittee
    )
    if (result?.ok) {
      showToast(
        `${formatDisplayName(editingMember)} updated to ${entry.title} (${editCommittee}).`,
        'success'
      )
      setEditingMember(null)
    } else {
      showToast(result?.reason || 'Unable to update officer role & committee.', 'error')
    }
  }

  async function confirmDemote() {
    if (!demoteTarget) return
    const entry = getHierarchyEntry(demotePosition)
    const result = await demoteOfficerMember(demoteTarget.id, demotePosition, demoteCommittee)
    if (result?.ok) {
      showToast(
        `${formatDisplayName(demoteTarget)} demoted to ${entry.title} (${demoteCommittee}).`,
        'success'
      )
      setDemoteTarget(null)
    } else {
      showToast(result?.reason || 'Unable to demote officer.', 'error')
    }
  }

  async function confirmRemove() {
    if (!removeTarget) return
    const result = await removeOfficerMember(removeTarget.id)
    if (result?.ok) {
      showToast(`${formatDisplayName(removeTarget)} has been removed from ${organization.name}.`, 'success')
      setRemoveTarget(null)
    } else {
      showToast(result?.reason || 'Unable to remove officer.', 'error')
    }
  }

  async function confirmOfficerPosition() {
    if (!positionTarget) return
    const selectedMember = orgMembers.find(
      (member) => String(member.id) === String(assignedMemberId) && member.status === 'ACTIVE'
    )
    if (!selectedMember) return
    const entry = getHierarchyEntry(assignedPositionCode)
    const result = await assignOfficerPosition(
      selectedMember.id,
      assignedPositionCode,
      '',
      assignedCommittee
    )
    if (result?.ok) {
      showToast(
        `${formatDisplayName(selectedMember)} assigned as ${entry.title} (${assignedCommittee}).`,
        'success'
      )
      setPositionTarget(null)
    } else {
      showToast(result?.reason || 'Unable to assign officer position.', 'error')
    }
  }

  async function handleEnrollCorChange(event) {
    const file = event.target.files?.[0]
    if (!file) {
      setEnrollForm((prev) => ({ ...prev, corFileName: '', corFileData: null }))
      return
    }
    try {
      const dataUrl = await readFileAsDataUrl(file)
      setEnrollForm((prev) => ({ ...prev, corFileName: file.name, corFileData: dataUrl }))
      setEnrollError('')
    } catch {
      setEnrollError('Unable to read selected COR file.')
    }
  }

  async function handleEnrollOfficer(event) {
    event.preventDefault()
    setEnrollError('')
    const cleanStdNum = sanitizeNumericStudentId(enrollForm.studentNumber)
    if (!enrollForm.firstName.trim() || !enrollForm.lastName.trim() || !cleanStdNum || !enrollForm.email.trim() || !enrollForm.program) {
      setEnrollError('Complete First Name, Last Name, numeric Student ID, Email, and Course/Program.')
      return
    }
    if (!/^\d+$/.test(cleanStdNum)) {
      setEnrollError('Student ID must contain digits only (0–9).')
      return
    }
    if (!isValidEmail(enrollForm.email.trim())) {
      setEnrollError('Enter a valid email address.')
      return
    }
    if (!enrollForm.corFileName) {
      setEnrollError('Certificate of Registration (COR) file upload is required.')
      return
    }
    setEnrollSaving(true)
    const result = await addOfficerMember({
      organizationId: organization.id,
      firstName: enrollForm.firstName.trim(),
      lastName: enrollForm.lastName.trim(),
      studentNumber: cleanStdNum,
      email: enrollForm.email.trim(),
      program: enrollForm.program,
      yearLevel: enrollForm.yearLevel,
      position: enrollForm.position,
      customTitle: enrollForm.position === 'OTHER_OFFICER' ? enrollForm.customTitle.trim() : '',
      committee: enrollForm.committee,
      corFileName: enrollForm.corFileName,
      corFileData: enrollForm.corFileData,
    })
    setEnrollSaving(false)
    if (!result?.ok) {
      setEnrollError(result?.error || 'Unable to enroll officer.')
      return
    }
    showToast(`${enrollForm.firstName} ${enrollForm.lastName} enrolled in ${organization.name}.`, 'success')
    setEnrollOpen(false)
    setEnrollForm(initialEnrollForm)
  }

  const hierarchySlots = useMemo(
    () =>
      OFFICER_HIERARCHY.slice(0, 6).map((tier) => ({
        tier,
        member: orgMembers.find(
          (m) =>
            m.status === 'ACTIVE' &&
            getHierarchyEntry(m.rawPosition || m.position).code === tier.code
        ),
      })),
    [orgMembers]
  )

  function getMemberInitials(member) {
    return (
      formatDisplayName(member)
        .split(/[ ,]+/)
        .map((part) => part[0])
        .filter(Boolean)
        .slice(0, 2)
        .join('')
        .toUpperCase() || 'OF'
    )
  }

  return (
    <div className="officer-members-page">
      <PageHeader
        actions={
          <Button onClick={() => { setEnrollError(''); setEnrollOpen(true) }} variant="primary">
            <Icon name="plus" size={16} /> Enroll Officer
          </Button>
        }
        description={`Manage the officer hierarchy, assigned committees, demotions, and roster of ${organization.name}.`}
        eyebrow={organization.name}
        title="Organization Officers & Committees"
      />

      <Card className="officer-page-card officer-officers-card">
        <div className="officer-page-card-heading">
          <div>
            <h2>Executive Officer Hierarchy</h2>
            <p>Defined rank structure paired with standing committees for {organization.name}.</p>
          </div>
          <Badge tone="crimson">Rank 1 – Rank 8 Hierarchy</Badge>
        </div>
        <div className="officer-position-grid">
          {hierarchySlots.map(({ tier, member }) => (
            <article className="officer-position-card" key={tier.code}>
              <span className="officer-position-tag">
                Rank {tier.rank} · {tier.title}
              </span>
              <strong>{member ? formatDisplayName(member) : 'Seat Vacant'}</strong>
              <small>{member ? (member.committee || tier.defaultCommittee) : tier.defaultCommittee}</small>
              {member && <small>ID: {member.studentId}</small>}
              <Button
                disabled={orgMembers.filter((m) => m.status === 'ACTIVE').length === 0}
                onClick={() => {
                  const target = member ?? orgMembers.find((item) => item.status === 'ACTIVE')
                  if (!target) return
                  setPositionTarget(target)
                  setAssignedMemberId(target.id)
                  setAssignedPositionCode(tier.code)
                  setAssignedCommittee(member?.committee || tier.defaultCommittee)
                }}
                variant="secondary"
              >
                {member ? 'Reassign Seat' : 'Assign Officer'}
              </Button>
            </article>
          ))}
        </div>
      </Card>

      <Card className="officer-member-management">
        <div className="officer-member-toolbar">
          <div>
            <h2>{organization.name} Officer Roster</h2>
            <p>
              {officerMemberCount} active officers <span aria-hidden="true">·</span> Update hierarchy rank, committee, demote, or remove officers
            </p>
          </div>
          <label className="officer-member-search">
            <span className="sr-only">Search officers by name, numeric ID, program, or committee</span>
            <Icon name="search" size={16} />
            <input
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search name, ID, committee..."
              type="search"
              value={search}
            />
          </label>
        </div>

        <div aria-label="Filter officer status and hierarchy role" className="officer-filter-row">
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
            <span>Hierarchy Role</span>
            <select onChange={(event) => setPositionFilter(event.target.value)} value={positionFilter}>
              <option value="All Roles">All Roles</option>
              {OFFICER_HIERARCHY.map((role) => (
                <option key={role.code} value={role.code}>
                  Rank {role.rank}: {role.title}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div
          className="officer-member-table-wrap using-datatables"
          key={filteredMembers.length + '-' + filteredMembers.map((m) => `${m.id}-${m.position}-${m.committee}`).join('-').slice(0, 80)}
        >
          <table className="officer-member-table" ref={tableRef}>
            <thead>
              <tr>
                <th className="cell-sticky cell-sticky-1">Officer</th>
                <th className="cell-sticky cell-sticky-2 cell-sticky-last">Student ID</th>
                <th>Hierarchy Role</th>
                <th>Assigned Committee</th>
                <th>Program</th>
                <th>Status</th>
                <th><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {filteredMembers.map((member) => {
                const tier = getHierarchyEntry(member.rawPosition || member.position)
                const displayRole = member.customTitle || tier.title
                const isLowestRank = tier.rank >= OFFICER_HIERARCHY[OFFICER_HIERARCHY.length - 1].rank
                return (
                  <tr key={member.id}>
                    <td className="cell-sticky cell-sticky-1" data-label="Officer">
                      <div className="officer-member-cell">
                        <span aria-hidden="true" className="officer-member-avatar-chip">
                          {getMemberInitials(member)}
                        </span>
                        <div>
                          <strong>{formatDisplayName(member)}</strong>
                          {member.corFileName && (
                            <small style={{ display: 'block', color: '#15803d', fontSize: '11px' }}>
                              COR Verified
                            </small>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="cell-sticky cell-sticky-2 cell-sticky-last" data-label="Student ID">
                      {member.studentId}
                    </td>
                    <td data-label="Hierarchy Role">
                      <Badge tone={tier.rank <= 2 ? 'crimson' : tier.rank <= 6 ? 'info' : 'neutral'}>
                        Rank {tier.rank} · {displayRole}
                      </Badge>
                    </td>
                    <td data-label="Assigned Committee">{member.committee || tier.defaultCommittee}</td>
                    <td data-label="Program">{member.program}</td>
                    <td data-label="Status">
                      <Badge tone={statusTones[member.status]}>{formatStatus(member.status)}</Badge>
                    </td>
                    <td className="officer-member-row-actions" data-label="Actions">
                      <Button onClick={() => setViewingMember(member)} variant="secondary">View</Button>
                      <Button
                        disabled={member.status !== 'ACTIVE'}
                        onClick={() => startEdit(member)}
                        variant="secondary"
                      >
                        Role &amp; Committee
                      </Button>
                      <Button
                        disabled={member.status !== 'ACTIVE' || isLowestRank}
                        onClick={() => startDemote(member)}
                        variant="outline"
                      >
                        Demote
                      </Button>
                      <Button
                        onClick={() => setRemoveTarget(member)}
                        variant="danger"
                      >
                        Remove
                      </Button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {filteredMembers.length === 0 && (
            <p className="officer-inline-empty officer-member-empty">
              No officers match those search and filter settings.
            </p>
          )}
        </div>
      </Card>

      {/* View Officer Details Modal */}
      <Modal
        onClose={() => setViewingMember(null)}
        open={Boolean(viewingMember)}
        size="md"
        status={viewingMember?.status}
        title="Officer Profile & Committee Assignment"
      >
        {viewingMember && (
          <div className="officer-member-details">
            <dl>
              <div><dt>Full Name</dt><dd>{formatDisplayName(viewingMember)}</dd></div>
              <div><dt>Student ID</dt><dd>{viewingMember.studentId}</dd></div>
              <div><dt>Program &amp; Year</dt><dd>{viewingMember.program} {viewingMember.yearLevel ? `· ${viewingMember.yearLevel}` : ''}</dd></div>
              <div><dt>Email</dt><dd>{viewingMember.email}</dd></div>
              <div><dt>Organization</dt><dd>{organization.name}</dd></div>
              <div>
                <dt>Hierarchy Rank &amp; Role</dt>
                <dd>
                  Rank {getHierarchyEntry(viewingMember.rawPosition || viewingMember.position).rank} —{' '}
                  {viewingMember.customTitle || getHierarchyEntry(viewingMember.rawPosition || viewingMember.position).title}
                </dd>
              </div>
              <div>
                <dt>Assigned Committee</dt>
                <dd>{viewingMember.committee || getHierarchyEntry(viewingMember.rawPosition || viewingMember.position).defaultCommittee}</dd>
              </div>
              <div>
                <dt>Certificate of Registration (COR)</dt>
                <dd>{viewingMember.corFileName || 'Verified on institutional record'}</dd>
              </div>
              <div>
                <dt>Status</dt>
                <dd><Badge tone={statusTones[viewingMember.status]}>{formatStatus(viewingMember.status)}</Badge></dd>
              </div>
            </dl>
          </div>
        )}
      </Modal>

      {/* Edit Role & Committee Modal */}
      <Modal
        onClose={() => setEditingMember(null)}
        open={Boolean(editingMember)}
        size="md"
        title="Update Officer Role & Committee"
        tone="info"
      >
        <p>
          Assign a hierarchy role and standing committee for{' '}
          <strong>{editingMember && formatDisplayName(editingMember)}</strong>.
        </p>
        <label className="officer-modal-field">
          <span>Officer Hierarchy Role</span>
          <select
            onChange={(event) => {
              const code = event.target.value
              const entry = getHierarchyEntry(code)
              setEditPosition(code)
              setEditCommittee(entry.defaultCommittee)
            }}
            value={editPosition}
          >
            {OFFICER_HIERARCHY.map((role) => (
              <option key={role.code} value={role.code}>
                Rank {role.rank}: {role.title}
                {role.code === 'PRESIDENT' && existingPresidentForEdit
                  ? ` (Currently: ${formatDisplayName(existingPresidentForEdit)})`
                  : ''}
              </option>
            ))}
          </select>
        </label>

        {editPosition === 'OTHER_OFFICER' && (
          <label className="officer-modal-field">
            <span>Specific Chairperson Title (optional)</span>
            <input
              className="input"
              onChange={(event) => setEditCustomTitle(event.target.value)}
              placeholder="e.g., Events & Logistics Chairperson"
              type="text"
              value={editCustomTitle}
            />
          </label>
        )}

        <label className="officer-modal-field">
          <span>Assigned Committee</span>
          <select onChange={(event) => setEditCommittee(event.target.value)} value={editCommittee}>
            {ORGANIZATION_COMMITTEES.map((committee) => (
              <option key={committee} value={committee}>{committee}</option>
            ))}
          </select>
        </label>

        {editPosition === 'PRESIDENT' && existingPresidentForEdit && (
          <div className="status-callout status-callout--warning">
            <strong>President Reassignment Notice:</strong> Assigning this officer as President will automatically transition{' '}
            <b>{formatDisplayName(existingPresidentForEdit)}</b> to Committee Member.
          </div>
        )}

        <div className="officer-modal-actions">
          <Button onClick={() => setEditingMember(null)} variant="secondary">Cancel</Button>
          <Button onClick={confirmEdit} variant="primary">Save Role &amp; Committee</Button>
        </div>
      </Modal>

      {/* Demote Officer Modal */}
      <Modal
        onClose={() => setDemoteTarget(null)}
        open={Boolean(demoteTarget)}
        size="md"
        title="Demote Officer"
        tone="warning"
      >
        {demoteTarget && (
          <>
            <p>
              Demote <strong>{formatDisplayName(demoteTarget)}</strong> from{' '}
              <b>{demoteTarget.customTitle || getHierarchyEntry(demoteTarget.rawPosition || demoteTarget.position).title}</b>{' '}
              to a lower tier in the organization hierarchy:
            </p>
            <label className="officer-modal-field">
              <span>New Lower Hierarchy Rank</span>
              <select
                onChange={(event) => {
                  const code = event.target.value
                  const entry = getHierarchyEntry(code)
                  setDemotePosition(code)
                  setDemoteCommittee(entry.defaultCommittee)
                }}
                value={demotePosition}
              >
                {getDemotionOptions(demoteTarget.rawPosition || demoteTarget.position).map((role) => (
                  <option key={role.code} value={role.code}>
                    Rank {role.rank}: {role.title}
                  </option>
                ))}
              </select>
            </label>
            <label className="officer-modal-field">
              <span>Reassigned Committee</span>
              <select onChange={(event) => setDemoteCommittee(event.target.value)} value={demoteCommittee}>
                {ORGANIZATION_COMMITTEES.map((committee) => (
                  <option key={committee} value={committee}>{committee}</option>
                ))}
              </select>
            </label>
            <div className="officer-modal-actions">
              <Button onClick={() => setDemoteTarget(null)} variant="secondary">Cancel</Button>
              <Button onClick={confirmDemote} variant="primary">Confirm Demotion</Button>
            </div>
          </>
        )}
      </Modal>

      {/* Remove Officer Modal */}
      <Modal
        onClose={() => setRemoveTarget(null)}
        open={Boolean(removeTarget)}
        size="sm"
        title="Remove Officer from Organization"
        tone="danger"
      >
        {removeTarget && (
          <>
            <p>
              Are you sure you want to remove <strong>{formatDisplayName(removeTarget)}</strong> ({removeTarget.studentId}) from{' '}
              <b>{organization.name}</b>? Their active officer permissions for this organization will be revoked immediately and recorded in the audit log.
            </p>
            <div className="officer-modal-actions">
              <Button onClick={() => setRemoveTarget(null)} variant="secondary">Cancel</Button>
              <Button onClick={confirmRemove} variant="danger">Remove Officer</Button>
            </div>
          </>
        )}
      </Modal>

      {/* Quick Seat Assignment Modal */}
      <Modal
        onClose={() => setPositionTarget(null)}
        open={Boolean(positionTarget)}
        size="md"
        title="Assign Executive Seat & Committee"
        tone="info"
      >
        <label className="officer-modal-field">
          <span>Select Active Officer</span>
          <select onChange={(event) => setAssignedMemberId(event.target.value)} value={assignedMemberId}>
            {orgMembers
              .filter((member) => member.status === 'ACTIVE')
              .map((member) => (
                <option key={member.id} value={member.id}>
                  {formatDisplayName(member)} · {getHierarchyEntry(member.rawPosition || member.position).title}
                </option>
              ))}
          </select>
        </label>
        <label className="officer-modal-field">
          <span>Assigned Standing Committee</span>
          <select onChange={(event) => setAssignedCommittee(event.target.value)} value={assignedCommittee}>
            {ORGANIZATION_COMMITTEES.map((committee) => (
              <option key={committee} value={committee}>{committee}</option>
            ))}
          </select>
        </label>
        <p>
          Assign{' '}
          <strong>
            {formatDisplayName(orgMembers.find((member) => String(member.id) === String(assignedMemberId)))}
          </strong>{' '}
          as <b>{getHierarchyEntry(assignedPositionCode).title}</b> ({assignedCommittee})?
        </p>
        {assignedPositionCode === 'PRESIDENT' && existingPresidentForTarget && (
          <div className="status-callout status-callout--warning">
            <strong>Notice:</strong> Current President <b>{formatDisplayName(existingPresidentForTarget)}</b> will be transitioned to Committee Member.
          </div>
        )}
        <div className="officer-modal-actions">
          <Button onClick={() => setPositionTarget(null)} variant="secondary">Cancel</Button>
          <Button onClick={confirmOfficerPosition} variant="primary">Confirm Seat Assignment</Button>
        </div>
      </Modal>

      {/* Enroll Officer Modal */}
      <Modal
        onClose={() => setEnrollOpen(false)}
        open={enrollOpen}
        size="md"
        title={`Enroll Officer — ${organization.name}`}
      >
        <form className="admin-settings-form" onSubmit={handleEnrollOfficer}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
            <div>
              <label className="admin-field-label" htmlFor="enroll-first-name">
                First Name <span className="required-asterisk">*</span>
              </label>
              <input
                className="input"
                id="enroll-first-name"
                onChange={(e) => setEnrollForm((prev) => ({ ...prev, firstName: e.target.value }))}
                required
                type="text"
                value={enrollForm.firstName}
              />
            </div>
            <div>
              <label className="admin-field-label" htmlFor="enroll-last-name">
                Last Name <span className="required-asterisk">*</span>
              </label>
              <input
                className="input"
                id="enroll-last-name"
                onChange={(e) => setEnrollForm((prev) => ({ ...prev, lastName: e.target.value }))}
                required
                type="text"
                value={enrollForm.lastName}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
            <div>
              <label className="admin-field-label" htmlFor="enroll-student-id">
                Student ID (Digits Only) <span className="required-asterisk">*</span>
              </label>
              <input
                className="input"
                id="enroll-student-id"
                inputMode="numeric"
                onChange={(e) =>
                  setEnrollForm((prev) => ({
                    ...prev,
                    studentNumber: sanitizeNumericStudentId(e.target.value),
                  }))
                }
                pattern="[0-9]*"
                placeholder="e.g., 202400189"
                required
                type="text"
                value={enrollForm.studentNumber}
              />
            </div>
            <div>
              <label className="admin-field-label" htmlFor="enroll-email">
                WMSU Email <span className="required-asterisk">*</span>
              </label>
              <input
                className="input"
                id="enroll-email"
                onChange={(e) => setEnrollForm((prev) => ({ ...prev, email: e.target.value }))}
                placeholder="officer@wmsu.edu.ph"
                required
                type="email"
                value={enrollForm.email}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px' }}>
            <div>
              <label className="admin-field-label" htmlFor="enroll-program">
                Course / Program <span className="required-asterisk">*</span>
              </label>
              <SearchableSelect
                id="enroll-program"
                onChange={(val) => setEnrollForm((prev) => ({ ...prev, program: val }))}
                options={academicPrograms}
                placeholder="Search course / program…"
                required
                value={enrollForm.program}
              />
            </div>
            <div>
              <label className="admin-field-label" htmlFor="enroll-year-level">
                Year Level <span className="required-asterisk">*</span>
              </label>
              <select
                className="input"
                id="enroll-year-level"
                onChange={(e) => setEnrollForm((prev) => ({ ...prev, yearLevel: e.target.value }))}
                value={enrollForm.yearLevel}
              >
                {YEAR_LEVEL_OPTIONS.map((yr) => (
                  <option key={yr} value={yr}>{yr}</option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
            <div>
              <label className="admin-field-label" htmlFor="enroll-position">
                Officer Hierarchy Role <span className="required-asterisk">*</span>
              </label>
              <select
                className="input"
                id="enroll-position"
                onChange={(e) => {
                  const code = e.target.value
                  setEnrollForm((prev) => ({
                    ...prev,
                    position: code,
                    committee: getHierarchyEntry(code).defaultCommittee,
                  }))
                }}
                value={enrollForm.position}
              >
                {OFFICER_HIERARCHY.map((role) => (
                  <option key={role.code} value={role.code}>
                    Rank {role.rank}: {role.title}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="admin-field-label" htmlFor="enroll-committee">
                Assigned Committee <span className="required-asterisk">*</span>
              </label>
              <select
                className="input"
                id="enroll-committee"
                onChange={(e) => setEnrollForm((prev) => ({ ...prev, committee: e.target.value }))}
                value={enrollForm.committee}
              >
                {ORGANIZATION_COMMITTEES.map((committee) => (
                  <option key={committee} value={committee}>{committee}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="admin-field-label" htmlFor="enroll-cor-file">
              Certificate of Registration (COR) <span className="required-asterisk">*</span>
            </label>
            <input
              accept=".pdf,.jpg,.jpeg,.png"
              className="input"
              id="enroll-cor-file"
              onChange={handleEnrollCorChange}
              required
              type="file"
            />
            {enrollForm.corFileName && (
              <small className="file-upload-selected">
                Selected COR: <strong>{enrollForm.corFileName}</strong>
              </small>
            )}
          </div>

          {enrollError && <p className="auth-error" role="alert">{enrollError}</p>}

          <div className="officer-modal-actions">
            <Button onClick={() => setEnrollOpen(false)} type="button" variant="secondary">Cancel</Button>
            <Button disabled={enrollSaving} type="submit" variant="primary">
              {enrollSaving ? 'Enrolling Officer…' : 'Enroll Officer'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

import { useMemo, useState } from 'react'
import Badge from '../ui/Badge.jsx'
import Button from '../ui/Button.jsx'
import Card from '../ui/Card.jsx'
import ConfirmDialog from '../ui/ConfirmDialog.jsx'

export default function AcademicStructureCard({
  colleges = [],
  departments = [],
  programs = [],
  onCreateCollege,
  onDeleteCollege,
  onCreateDepartment,
  onDeleteDepartment,
  onCreateProgram,
  onDeleteProgram,
  showToast,
}) {
  const [activeTab, setActiveTab] = useState('colleges')
  const [search, setSearch] = useState('')
  const [formState, setFormState] = useState({
    name: '',
    acronym: '',
    collegeId: '',
    departmentId: '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState('')
  const [deleteTarget, setDeleteTarget] = useState(null)

  const selectedCollegeId = formState.collegeId || (colleges[0]?.id ? String(colleges[0].id) : '')
  const selectedDepartmentId =
    formState.departmentId || (departments[0]?.id ? String(departments[0].id) : '')

  const visibleItems = useMemo(() => {
    const query = search.trim().toLowerCase()
    const source =
      activeTab === 'colleges'
        ? colleges
        : activeTab === 'departments'
          ? departments
          : programs
    if (!query) return source
    return source.filter((item) =>
      `${item.name || ''} ${item.acronym || ''} ${item.college_name || ''} ${item.department_name || ''}`
        .toLowerCase()
        .includes(query)
    )
  }, [activeTab, colleges, departments, programs, search])

  const handleAdd = async (event) => {
    event.preventDefault()
    setFormError('')
    const cleanName = formState.name.trim()
    const cleanAcronym = formState.acronym.trim().toUpperCase()
    if (!cleanName || !cleanAcronym) {
      setFormError('Both name and acronym are required.')
      return
    }

    setSubmitting(true)
    try {
      let result
      if (activeTab === 'colleges') {
        result = await onCreateCollege?.({ name: cleanName, acronym: cleanAcronym })
      } else if (activeTab === 'departments') {
        if (!selectedCollegeId) {
          setFormError('Select a parent college first.')
          setSubmitting(false)
          return
        }
        result = await onCreateDepartment?.({
          college_id: Number(selectedCollegeId),
          name: cleanName,
          acronym: cleanAcronym,
        })
      } else {
        if (!selectedDepartmentId) {
          setFormError('Select a parent department first.')
          setSubmitting(false)
          return
        }
        result = await onCreateProgram?.({
          department_id: Number(selectedDepartmentId),
          name: cleanName,
          acronym: cleanAcronym,
        })
      }

      if (result?.ok) {
        setFormState((prev) => ({ ...prev, name: '', acronym: '' }))
        showToast?.(`Added ${cleanAcronym} (${cleanName}).`, 'success')
      } else {
        setFormError(result?.error || 'Unable to save academic record.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return
    const { kind, item } = deleteTarget
    const action =
      kind === 'colleges'
        ? onDeleteCollege
        : kind === 'departments'
          ? onDeleteDepartment
          : onDeleteProgram
    const result = await action?.(item.id)
    setDeleteTarget(null)
    if (result?.ok) {
      showToast?.(`Removed ${item.acronym || item.name}.`, 'success')
    } else {
      showToast?.(result?.error || 'Cannot remove item while other records reference it.', 'error')
    }
  }

  return (
    <Card className="admin-section-card academic-structure-card">
      <div className="academic-structure-header">
        <div>
          <h2>Academic Hierarchy</h2>
          <p className="academic-structure-subtitle">
            Manage WMSU colleges, academic departments, and degree programs used across registrations and organizations.
          </p>
        </div>
        <div className="academic-structure-tabs" role="tablist">
          {[
            ['colleges', `Colleges (${colleges.length})`],
            ['departments', `Departments (${departments.length})`],
            ['programs', `Programs (${programs.length})`],
          ].map(([key, label]) => (
            <button
              aria-selected={activeTab === key}
              className={`academic-tab-btn${activeTab === key ? ' is-active' : ''}`}
              key={key}
              onClick={() => {
                setActiveTab(key)
                setFormError('')
              }}
              role="tab"
              type="button"
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <form className="academic-add-form" onSubmit={handleAdd}>
        {activeTab === 'departments' && (
          <label>
            <span>College</span>
            <select
              onChange={(event) =>
                setFormState((prev) => ({ ...prev, collegeId: event.target.value }))
              }
              value={selectedCollegeId}
            >
              {colleges.map((c) => (
                <option key={c.id} value={String(c.id)}>
                  {c.acronym ? `${c.acronym} — ${c.name}` : c.name}
                </option>
              ))}
            </select>
          </label>
        )}

        {activeTab === 'programs' && (
          <label>
            <span>Department</span>
            <select
              onChange={(event) =>
                setFormState((prev) => ({ ...prev, departmentId: event.target.value }))
              }
              value={selectedDepartmentId}
            >
              {departments.map((d) => (
                <option key={d.id} value={String(d.id)}>
                  {d.acronym ? `${d.acronym} — ${d.name}` : d.name}
                </option>
              ))}
            </select>
          </label>
        )}

        <label>
          <span>
            {activeTab === 'colleges'
              ? 'College Name'
              : activeTab === 'departments'
                ? 'Department Name'
                : 'Program Name'}
          </span>
          <input
            onChange={(event) => setFormState((prev) => ({ ...prev, name: event.target.value }))}
            placeholder={
              activeTab === 'colleges'
                ? 'e.g. College of Architecture'
                : activeTab === 'departments'
                  ? 'e.g. Department of Industrial Design'
                  : 'e.g. Bachelor of Science in Architecture'
            }
            required
            value={formState.name}
          />
        </label>

        <label>
          <span>Acronym</span>
          <input
            onChange={(event) => setFormState((prev) => ({ ...prev, acronym: event.target.value }))}
            placeholder={
              activeTab === 'colleges' ? 'CA' : activeTab === 'departments' ? 'DID' : 'BSArch'
            }
            required
            value={formState.acronym}
          />
        </label>

        <div className="academic-add-submit">
          <Button disabled={submitting} type="submit" variant="primary">
            {submitting ? 'Adding…' : 'Add'}
          </Button>
        </div>
      </form>

      {formError && (
        <p className="auth-error" role="alert">
          {formError}
        </p>
      )}

      <div className="academic-list-toolbar">
        <input
          aria-label={`Search ${activeTab}`}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={`Filter ${activeTab}…`}
          type="search"
          value={search}
        />
        <span className="academic-list-count">{visibleItems.length} listed</span>
      </div>

      <div className="academic-list">
        {visibleItems.length ? (
          visibleItems.map((item) => (
            <div className="academic-list-row" key={`${activeTab}-${item.id}`}>
              <div className="academic-list-info">
                <div className="academic-list-title">
                  {item.acronym && <Badge tone="neutral">{item.acronym}</Badge>}
                  <strong>{item.name}</strong>
                </div>
                {(item.college_name || item.department_name) && (
                  <small>
                    {[item.department_name, item.college_name].filter(Boolean).join(' · ')}
                  </small>
                )}
              </div>
              <Button
                onClick={() => setDeleteTarget({ kind: activeTab, item })}
                size="sm"
                type="button"
                variant="danger"
              >
                Remove
              </Button>
            </div>
          ))
        ) : (
          <p className="academic-empty-note">No matching academic records found.</p>
        )}
      </div>

      <ConfirmDialog
        confirmLabel="Remove"
        message={
          deleteTarget
            ? `Remove "${deleteTarget.item.name}"? This is blocked if any child academic units, students, or organizations reference it.`
            : ''
        }
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
        open={Boolean(deleteTarget)}
        title="Remove academic unit"
        tone="danger"
      />
    </Card>
  )
}

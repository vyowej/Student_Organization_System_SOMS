import { useState } from 'react'
import { useNavigate, useOutletContext, useSearchParams } from 'react-router-dom'
import Button from '../components/ui/Button.jsx'
import Card from '../components/ui/Card.jsx'
import ConfirmDialog from '../components/ui/ConfirmDialog.jsx'
import Icon from '../components/ui/Icon.jsx'
import Input from '../components/ui/Input.jsx'
import PageHeader from '../components/layout/PageHeader.jsx'
import { useToast } from '../components/ui/useToast.js'
import { readFileAsDataUrl } from '../data/officerHierarchy.js'

function toDateInputValue(value) {
  const parsed = value ? new Date(value) : null
  if (!parsed || Number.isNaN(parsed.getTime())) return ''
  return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(parsed.getDate()).padStart(2, '0')}`
}

function toTimeInputValue(value) {
  if (!value) return ''
  const twelveHour = value.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i)
  if (twelveHour) {
    let hours = Number(twelveHour[1]) % 12
    if (twelveHour[3].toUpperCase() === 'PM') hours += 12
    return `${String(hours).padStart(2, '0')}:${twelveHour[2]}`
  }
  return /^\d{2}:\d{2}$/.test(value) ? value : ''
}

function toDisplayTime(value) {
  const [hours, minutes] = value.split(':').map(Number)
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return value
  return `${hours % 12 || 12}:${String(minutes).padStart(2, '0')} ${hours >= 12 ? 'PM' : 'AM'}`
}

export default function OfficerEventFormPage() {
  const [searchParams] = useSearchParams()
  const editId = searchParams.get('edit')
  const { adminOrganizations = [], currentUser, officerEvents = [], saveOfficerEvent } = useOutletContext()
  const orgId = currentUser?.organizationId || adminOrganizations[0]?.id
  const organization =
    adminOrganizations?.find((item) => String(item.id) === String(orgId)) ||
    adminOrganizations[0] || { name: 'Your Organization' }

  const existing = officerEvents.find((event) => String(event.id) === String(editId))
  const initialDateValue = toDateInputValue(existing?.startDatetime || existing?.date)
  const existingTimes = existing?.time?.split('–').map((value) => value.trim()) ?? []
  const initialComplianceName =
    existing?.complianceFileName || existing?.supportingDocuments?.[0] || ''

  const [title, setTitle] = useState(existing?.title ?? '')
  const [date, setDate] = useState(initialDateValue)
  const [location, setLocation] = useState(existing?.location ?? '')
  const [description, setDescription] = useState(existing?.description ?? '')
  const [capacity, setCapacity] = useState(String(existing?.capacity ?? 100))
  const [category, setCategory] = useState(existing?.category ?? 'Academic')
  const [startTime, setStartTime] = useState(toTimeInputValue(existing?.startTime ?? existingTimes[0]))
  const [endTime, setEndTime] = useState(toTimeInputValue(existing?.endTime ?? existingTimes[1]))
  const [targetAudience, setTargetAudience] = useState(existing?.targetAudience ?? '')
  const [registrationDeadline, setRegistrationDeadline] = useState(toDateInputValue(existing?.registrationDeadline))
  const [budget, setBudget] = useState(existing?.budget ?? '')
  const [complianceFileName, setComplianceFileName] = useState(initialComplianceName)
  const [complianceFileData, setComplianceFileData] = useState(undefined)
  const [error, setError] = useState('')
  const [confirmSubmitOpen, setConfirmSubmitOpen] = useState(false)
  const [confirmLeaveOpen, setConfirmLeaveOpen] = useState(false)
  const { showToast } = useToast()
  const navigate = useNavigate()

  async function handleComplianceFileChange(event) {
    const file = event.target.files?.[0]
    if (!file) {
      return
    }
    try {
      const dataUrl = await readFileAsDataUrl(file)
      setComplianceFileName(file.name)
      setComplianceFileData(dataUrl)
      setError('')
    } catch {
      setError('Unable to read the selected compliance document file.')
    }
  }

  async function submit(status, confirmed = false) {
    const numericCapacity = parseInt(String(capacity), 10)
    if (!title.trim() || !date || !location.trim() || !description.trim()) {
      setError('Complete the event title, date, location, and description before saving.')
      return
    }
    if (!Number.isFinite(numericCapacity) || numericCapacity < 1) {
      setError('Enter a valid maximum participant limit (minimum 1 participant).')
      return
    }
    if (status === 'SUBMITTED' && !complianceFileName.trim()) {
      setError('Please upload a compliance document file before submitting the event proposal for adviser review.')
      return
    }
    if (status === 'SUBMITTED' && !confirmed) {
      setError('')
      setConfirmSubmitOpen(true)
      return
    }
    setConfirmSubmitOpen(false)
    const exactFileName = complianceFileName.trim()
    const saved = await saveOfficerEvent(
      {
        ...(existing ?? {}),
        id: existing?.id,
        organizationId: organization.id,
        title: title.trim(),
        rawDate: date,
        date: new Date(`${date}T12:00:00`).toLocaleDateString('en-US', {
          month: 'long',
          day: 'numeric',
          year: 'numeric',
        }),
        startDatetime: `${date}T${startTime || '08:00'}:00`,
        endDatetime: `${date}T${endTime || startTime || '17:00'}:00`,
        location: location.trim(),
        description: description.trim(),
        capacity: numericCapacity,
        maxParticipants: numericCapacity,
        category,
        startTime,
        endTime,
        time: startTime && endTime ? `${toDisplayTime(startTime)} – ${toDisplayTime(endTime)}` : toDisplayTime(startTime),
        targetAudience: targetAudience.trim(),
        registrationDeadline,
        budget: budget ? Number(budget) : '',
        complianceFileName: exactFileName || null,
        complianceFileData,
        supportingDocuments: exactFileName ? [exactFileName] : [],
        registrations: existing?.registrations ?? 0,
      },
      status
    )
    if (!saved) {
      setError('Unable to save the event proposal to the database.')
      return
    }
    showToast(
      status === 'SUBMITTED'
        ? `Event proposal submitted for adviser review with "${exactFileName}".`
        : 'Event proposal saved as a draft.',
      'success'
    )
    navigate('/officer/events')
  }

  return (
    <div className="officer-page">
      <PageHeader
        description={
          existing
            ? 'Address the adviser’s feedback, verify your compliance document attachment, and resubmit for review.'
            : `Create an event proposal for ${organization.name}. Attach your compliance document and set the maximum participant limit.`
        }
        eyebrow={organization.name}
        title={existing ? 'Edit Event Proposal' : 'Create Event Proposal'}
      />
      {existing?.revisionNote && (
        <div className="officer-revision-note">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
            <Icon name="alert-circle" size={18} />
            <strong>Adviser Feedback &amp; Revision Request</strong>
          </div>
          <p>{existing.revisionNote}</p>
        </div>
      )}
      <Card className="officer-event-form-card">
        <form className="officer-event-form" onSubmit={(event) => event.preventDefault()}>
          <Input
            id="officer-event-title"
            label="Event title *"
            onChange={(event) => setTitle(event.target.value)}
            placeholder="e.g. WMSU Hackathon 2026"
            required
            value={title}
          />
          <Input
            id="officer-event-category"
            label="Activity category"
            onChange={(event) => setCategory(event.target.value)}
            value={category}
          />
          <Input
            id="officer-event-date"
            label="Event date *"
            onChange={(event) => setDate(event.target.value)}
            required
            type="date"
            value={date}
          />
          <Input
            id="officer-event-location"
            label="Location / Venue *"
            onChange={(event) => setLocation(event.target.value)}
            placeholder="Venue or campus location"
            required
            value={location}
          />
          <Input
            id="officer-event-start-time"
            label="Start time"
            onChange={(event) => setStartTime(event.target.value)}
            type="time"
            value={startTime}
          />
          <Input
            id="officer-event-end-time"
            label="End time (registration closes automatically after end time)"
            onChange={(event) => setEndTime(event.target.value)}
            type="time"
            value={endTime}
          />
          <Input
            id="officer-event-capacity"
            label="Maximum participant limit *"
            min="1"
            onChange={(event) => setCapacity(event.target.value.replace(/[^\d]/g, ''))}
            required
            type="number"
            value={capacity}
          />
          <Input
            id="officer-event-deadline"
            label="Registration deadline"
            onChange={(event) => setRegistrationDeadline(event.target.value)}
            type="date"
            value={registrationDeadline}
          />
          <Input
            id="officer-event-audience"
            label="Target audience"
            onChange={(event) => setTargetAudience(event.target.value)}
            placeholder="e.g. WMSU campus community"
            value={targetAudience}
          />
          <Input
            id="officer-event-budget"
            label="Proposed budget (PHP)"
            min="0"
            onChange={(event) => setBudget(event.target.value)}
            type="number"
            value={budget}
          />

          <div className="form-field officer-event-description">
            <label className="admin-field-label" htmlFor="officer-event-compliance-file">
              Compliance Document File Upload <span className="required-asterisk">*</span>
            </label>
            <input
              accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
              className="input"
              id="officer-event-compliance-file"
              onChange={handleComplianceFileChange}
              type="file"
            />
            {complianceFileName ? (
              <div className="compliance-upload-badge">
                <Icon name="file" size={16} />
                <span>
                  Attached file (shown identically to Adviser): <strong>{complianceFileName}</strong>
                </span>
              </div>
            ) : (
              <small style={{ color: '#6d6570', fontSize: '12px' }}>
                Upload a single consolidated compliance document (PDF, DOCX, JPG, or PNG). The exact filename uploaded here will appear on your Faculty Adviser&apos;s review screen.
              </small>
            )}
          </div>

          <div className="form-field officer-event-description">
            <label className="admin-field-label" htmlFor="officer-event-description">
              Event description <span className="required-asterisk">*</span>
            </label>
            <textarea
              className="input"
              id="officer-event-description"
              onChange={(event) => setDescription(event.target.value)}
              required
              rows="5"
              value={description}
            />
          </div>

          {error && <p className="officer-form-error" role="alert">{error}</p>}
          <div className="officer-form-footer">
            <p>
              Submission sends this proposal and compliance file (<strong>{complianceFileName || 'none attached'}</strong>) to your Faculty Adviser. Registration closes automatically once the event ends or reaches {capacity || 0} participants.
            </p>
            <div>
              <Button
                onClick={() =>
                  title.trim() || description.trim() || location.trim()
                    ? setConfirmLeaveOpen(true)
                    : navigate('/officer/events')
                }
                variant="secondary"
              >
                Cancel
              </Button>
              <Button onClick={() => submit('DRAFT')} variant="secondary">Save Draft</Button>
              <Button onClick={() => submit('SUBMITTED')} variant="primary">
                {existing ? 'Save and Resubmit' : 'Submit Proposal'}
              </Button>
            </div>
          </div>
        </form>
      </Card>

      <ConfirmDialog
        cancelLabel="Keep editing"
        confirmLabel="Discard and leave"
        message="Are you sure you want to leave? Anything you typed that hasn't been saved as a draft will be lost."
        onCancel={() => setConfirmLeaveOpen(false)}
        onConfirm={() => navigate('/officer/events')}
        open={confirmLeaveOpen}
        title="Discard this proposal?"
        tone="danger"
      />
      <ConfirmDialog
        confirmLabel={existing ? 'Resubmit proposal' : 'Submit proposal'}
        message={`Submit "${title.trim() || 'this event proposal'}" with compliance file "${complianceFileName}" and max participant limit of ${capacity}?`}
        onCancel={() => setConfirmSubmitOpen(false)}
        onConfirm={() => submit('SUBMITTED', true)}
        open={confirmSubmitOpen}
        title="Submit event proposal"
        tone="success"
      />
    </div>
  )
}

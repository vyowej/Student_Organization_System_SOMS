import { useState } from 'react'
import { useNavigate, useOutletContext, useSearchParams } from 'react-router-dom'
import Button from '../components/ui/Button.jsx'
import Card from '../components/ui/Card.jsx'
import Input from '../components/ui/Input.jsx'
import PageHeader from '../components/layout/PageHeader.jsx'
import { useToast } from '../components/ui/useToast.js'

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
  const { officerEvents, saveOfficerEvent } = useOutletContext()
  const existing = officerEvents.find((event) => event.id === editId && event.status === 'RETURNED_FOR_REVISION')
  const initialDateValue = toDateInputValue(existing?.date)
  const existingTimes = existing?.time?.split('–').map((value) => value.trim()) ?? []
  const [title, setTitle] = useState(existing?.title ?? '')
  const [date, setDate] = useState(initialDateValue)
  const [location, setLocation] = useState(existing?.location ?? '')
  const [description, setDescription] = useState(existing?.description ?? '')
  const [capacity, setCapacity] = useState(String(existing?.capacity ?? 100))
  const [category, setCategory] = useState(existing?.category ?? 'Technology')
  const [startTime, setStartTime] = useState(toTimeInputValue(existing?.startTime ?? existingTimes[0]))
  const [endTime, setEndTime] = useState(toTimeInputValue(existing?.endTime ?? existingTimes[1]))
  const [targetAudience, setTargetAudience] = useState(existing?.targetAudience ?? '')
  const [registrationDeadline, setRegistrationDeadline] = useState(toDateInputValue(existing?.registrationDeadline))
  const [budget, setBudget] = useState(existing?.budget ?? '')
  const [supportingDocuments, setSupportingDocuments] = useState(existing?.supportingDocuments?.join(', ') ?? '')
  const [error, setError] = useState('')
  const { showToast } = useToast()
  const navigate = useNavigate()

  function submit(status) {
    if (!title.trim() || !date || !location.trim() || !description.trim()) {
      setError('Complete the event title, date, location, and description before saving.')
      return
    }
    saveOfficerEvent({
      ...(existing ?? {}),
      id: existing?.id,
      title: title.trim(),
      date: new Date(`${date}T12:00:00`).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
      location: location.trim(),
      description: description.trim(),
      capacity: Number(capacity),
      category,
      startTime,
      endTime,
      time: startTime && endTime ? `${toDisplayTime(startTime)} – ${toDisplayTime(endTime)}` : toDisplayTime(startTime),
      targetAudience: targetAudience.trim(),
      registrationDeadline,
      budget: budget ? Number(budget) : '',
      supportingDocuments: supportingDocuments.split(',').map((document) => document.trim()).filter(Boolean),
      registrations: existing?.registrations ?? 0,
    }, status)
    showToast(status === 'SUBMITTED' ? 'Event proposal submitted for adviser review.' : 'Event proposal saved as a draft.', 'success')
    navigate('/officer/events')
  }

  return (
    <>
      <PageHeader
        description={existing ? 'Address the adviser’s feedback, then resubmit the proposal for review.' : 'Create a proposal for your assigned organization. An adviser and Student Affairs Admin will review it.'}
        eyebrow="WMSU Computer Society"
        title={existing ? 'Edit Returned Event Proposal' : 'Create Event Proposal'}
      />
      {existing?.revisionNote && <div className="officer-revision-note"><strong>Adviser feedback</strong><p>{existing.revisionNote}</p></div>}
      <Card className="officer-event-form-card">
        <form className="officer-event-form" onSubmit={(event) => event.preventDefault()}>
          <Input id="officer-event-title" label="Event title" onChange={(event) => setTitle(event.target.value)} placeholder="e.g. WMSU Hackathon 2026" required value={title} />
          <Input id="officer-event-date" label="Event date" onChange={(event) => setDate(event.target.value)} required type="date" value={date} />
          <Input id="officer-event-location" label="Location" onChange={(event) => setLocation(event.target.value)} placeholder="Venue or campus location" required value={location} />
          <Input id="officer-event-capacity" label="Registration capacity" min="1" onChange={(event) => setCapacity(event.target.value)} required type="number" value={capacity} />
          <Input id="officer-event-category" label="Activity category" onChange={(event) => setCategory(event.target.value)} value={category} />
          <Input id="officer-event-start-time" label="Start time" onChange={(event) => setStartTime(event.target.value)} type="time" value={startTime} />
          <Input id="officer-event-end-time" label="End time" onChange={(event) => setEndTime(event.target.value)} type="time" value={endTime} />
          <Input id="officer-event-audience" label="Target audience" onChange={(event) => setTargetAudience(event.target.value)} placeholder="e.g. WMSU students" value={targetAudience} />
          <Input id="officer-event-deadline" label="Registration deadline" onChange={(event) => setRegistrationDeadline(event.target.value)} type="date" value={registrationDeadline} />
          <Input id="officer-event-budget" label="Proposed budget (PHP)" min="0" onChange={(event) => setBudget(event.target.value)} type="number" value={budget} />
          <Input id="officer-event-documents" label="Compliance document names" onChange={(event) => setSupportingDocuments(event.target.value)} placeholder="Venue clearance.pdf, Safety plan.pdf" value={supportingDocuments} />
          <div className="form-field officer-event-description">
            <label htmlFor="officer-event-description">Event description</label>
            <textarea className="input" id="officer-event-description" onChange={(event) => setDescription(event.target.value)} required rows="5" value={description} />
          </div>
          {error && <p className="officer-form-error" role="alert">{error}</p>}
          <div className="officer-form-footer">
            <p>Submission sends this proposal to your adviser. Officers cannot approve event proposals.</p>
            <div>
              <Button onClick={() => navigate('/officer/events')} variant="secondary">Cancel</Button>
              <Button onClick={() => submit('DRAFT')} variant="secondary">Save Draft</Button>
              <Button onClick={() => submit('SUBMITTED')} variant="primary">{existing ? 'Save and Resubmit' : 'Submit Proposal'}</Button>
            </div>
          </div>
        </form>
      </Card>
    </>
  )
}

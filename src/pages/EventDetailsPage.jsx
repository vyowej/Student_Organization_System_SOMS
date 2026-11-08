import { useState } from 'react'
import { Link, useOutletContext, useParams } from 'react-router-dom'
import Badge from '../components/ui/Badge.jsx'
import Button from '../components/ui/Button.jsx'
import Card from '../components/ui/Card.jsx'
import Modal from '../components/ui/Modal.jsx'
import SearchableSelect from '../components/ui/SearchableSelect.jsx'
import Icon from '../components/ui/Icon.jsx'
import PageHeader from '../components/layout/PageHeader.jsx'
import { useToast } from '../components/ui/useToast.js'
import { usePortalData } from '../context/usePortalData.js'
import { useAuth } from '../context/useAuth.js'
import {
  getEventRegistrationState,
  isEventAlmostFull,
  isEventEnded,
  officerEventToStudentEvent,
  studentEvents,
} from '../data/studentEvents.js'
import {
  YEAR_LEVEL_OPTIONS,
  readFileAsDataUrl,
  sanitizeNumericStudentId,
} from '../data/officerHierarchy.js'

const stateTone = {
  REGISTERED: 'success',
  'EVENT FULL': 'danger',
  'REGISTRATION CLOSED': 'neutral',
  'EVENT COMPLETED': 'neutral',
  'NOT REGISTERED': 'success',
}

export default function EventDetailsPage() {
  const { id } = useParams()
  const outletCtx = useOutletContext() || {}
  const portalData = usePortalData()
  const { currentUser } = useAuth()
  const { showToast } = useToast()

  const officerEvents = outletCtx.officerEvents || portalData?.officerEvents || []
  const studentRegistrations = outletCtx.studentRegistrations || portalData?.studentRegistrations || []
  const academicPrograms = outletCtx.academicPrograms || portalData?.academicPrograms || []
  const eventRegisteredCounts =
    outletCtx.eventRegisteredCounts ||
    portalData?.eventRegisteredCounts ||
    Object.fromEntries(officerEvents.map((ev) => [ev.id, ev.registeredCount ?? ev.registrations ?? 0]))
  const registerParticipantForEvent = portalData?.registerParticipantForEvent

  const [registrationDialogOpen, setRegistrationDialogOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [participantForm, setParticipantForm] = useState({
    firstName: currentUser?.firstName || '',
    lastName: currentUser?.lastName || '',
    email: currentUser?.email || '',
    studentNumber: sanitizeNumericStudentId(currentUser?.studentNumber || ''),
    yearLevel: currentUser?.yearLevel || '1st Year',
    program: currentUser?.program || '',
    corFileName: currentUser?.corFileName || '',
    corFileData: null,
  })

  const matchedOfficerEvent = officerEvents.find(
    (item) => String(item.id) === String(id) && ['PUBLISHED', 'APPROVED', 'COMPLETED', 'CANCELLED'].includes(item.status)
  )
  const baseEvent = studentEvents.find((item) => String(item.id) === String(id))
    ?? (matchedOfficerEvent ? officerEventToStudentEvent(matchedOfficerEvent) : undefined)
  const event = baseEvent && {
    ...baseEvent,
    registeredCount: eventRegisteredCounts[baseEvent.id] ?? baseEvent.registeredCount ?? 0,
  }

  const registration = currentUser
    ? studentRegistrations.find((item) => (
      String(item.eventId) === String(id) &&
      item.status !== 'CANCELLED' &&
      (
        (currentUser.studentRecordId && String(item.studentRecordId) === String(currentUser.studentRecordId)) ||
        (currentUser.id && String(item.userId) === String(currentUser.id)) ||
        (currentUser.studentNumber && String(item.studentId) === String(currentUser.studentNumber))
      )
    ))
    : null

  if (!event) {
    return (
      <div className="event-details-page">
        <PageHeader
          description="The event may have been removed or the link may be incorrect."
          eyebrow="UNIDOS CAMPUS EVENTS"
          title="Event not found"
        />
        <Card className="event-not-found">
          <p>We could not find that event in the current directory.</p>
          <Link className="button button-primary" to="/events">Explore all events</Link>
        </Card>
      </div>
    )
  }

  const ended = isEventEnded(event)
  const registrationState = getEventRegistrationState(event, registration)
  const isFull = registrationState === 'EVENT FULL'
  const isOpen = registrationState === 'NOT REGISTERED' && !ended && !isFull
  const canRegister = isOpen && event.registrationStatus === 'OPEN'
  const availableSlots = Math.max((event.capacity || 0) - (event.registeredCount || 0), 0)
  const displayStatus = isOpen && isEventAlmostFull(event) ? 'ALMOST FULL' : registrationState

  async function handleCorChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const dataUrl = await readFileAsDataUrl(file)
      setParticipantForm((prev) => ({
        ...prev,
        corFileName: file.name,
        corFileData: dataUrl,
      }))
    } catch {
      showToast('Unable to read selected COR file.', 'error')
    }
  }

  async function confirmRegistration(e) {
    e.preventDefault()
    if (!canRegister) {
      showToast('Registration is closed for this event.', 'error')
      return
    }

    const needsGuestDetails = !currentUser?.studentRecordId
    const cleanId = sanitizeNumericStudentId(participantForm.studentNumber)

    if (needsGuestDetails) {
      if (!cleanId || !/^\d+$/.test(cleanId)) {
        showToast('Student ID must contain digits only (0–9).', 'error')
        return
      }
      if (!participantForm.program) {
        showToast('Please select your Course / Program.', 'error')
        return
      }
      if (!participantForm.corFileName) {
        showToast('Certificate of Registration (COR) upload is required.', 'error')
        return
      }
    }

    setSubmitting(true)
    const result = await registerParticipantForEvent(
      event.id,
      needsGuestDetails
        ? {
          firstName: participantForm.firstName,
          lastName: participantForm.lastName,
          email: participantForm.email,
          studentNumber: cleanId,
          yearLevel: participantForm.yearLevel,
          program: participantForm.program,
          corFileName: participantForm.corFileName,
          corFileData: participantForm.corFileData,
          requireCor: true,
        }
        : null
    )
    setSubmitting(false)

    if (!result?.ok) {
      showToast(result?.error || 'Unable to complete registration.', 'error')
      return
    }
    setRegistrationDialogOpen(false)
    showToast('Registration confirmed! Your participant slot has been reserved.', 'success')
  }

  const actionLabel = registrationState === 'REGISTERED' ? 'Registered ✓'
    : isFull ? 'Maximum Limit Reached'
      : ended || registrationState === 'REGISTRATION CLOSED' || registrationState === 'EVENT COMPLETED'
        ? 'Registration Closed (Event Ended)'
        : 'Register for Event'

  return (
    <div className="event-details-page">
      <PageHeader
        description="Event schedule, participant limit, and registration status."
        eyebrow="UNIDOS CAMPUS EVENTS"
        title={event.title}
      />

      <Card className="event-details-card event-module-details">
        <div aria-hidden="true" className={`event-details-banner event-${event.color || 'crimson'}`}>
          <span className="event-banner-date">{event.date}</span>
          <strong>{event.category}</strong>
        </div>
        <div className="event-details-body">
          <div className="event-details-heading">
            <div>
              <Badge tone={stateTone[registrationState] || 'neutral'}>{displayStatus}</Badge>
              <h2>{event.title}</h2>
              <p className="event-details-organization">
                Organized by <Link to={`/organizations/${event.organizationId}`}>{event.organizationName}</Link>
              </p>
            </div>
            <div className="event-registration-actions">
              <Button
                className="event-register-button"
                disabled={!canRegister}
                onClick={() => setRegistrationDialogOpen(true)}
              >
                {actionLabel}
              </Button>
            </div>
          </div>

          {ended && (
            <div
              role="status"
              style={{
                padding: '12px 16px',
                borderRadius: '10px',
                background: '#fef2f2',
                border: '1px solid #fecaca',
                color: '#991b1b',
                fontSize: '13.5px',
                fontWeight: 600,
                marginBottom: '16px',
              }}
            >
              Registration has automatically closed because this event has already ended. New registrations are blocked.
            </div>
          )}

          {!ended && isFull && (
            <div
              role="status"
              style={{
                padding: '12px 16px',
                borderRadius: '10px',
                background: '#fffbeb',
                border: '1px solid #fde68a',
                color: '#92400e',
                fontSize: '13.5px',
                fontWeight: 600,
                marginBottom: '16px',
              }}
            >
              This event has reached its maximum participant limit ({event.capacity} participants).
            </div>
          )}

          {registration && (
            <p aria-live="polite" className="registration-confirmation" role="status">
              Registration confirmed · Reference {registration.qrCodeValue || registration.id}
            </p>
          )}

          <div className="event-detail-sections">
            <section className="event-info-section">
              <h3>Event Details</h3>
              <div className="event-details-facts">
                <div><span>Date</span><strong>{event.date}</strong></div>
                <div><span>Time</span><strong>{event.time}</strong></div>
                <div><span>Location</span><strong>{event.location}</strong></div>
                <div><span>Category</span><strong>{event.category}</strong></div>
                <div><span>Maximum Participants</span><strong>{event.capacity} participants</strong></div>
                <div><span>Registration Status</span><strong>{displayStatus}</strong></div>
              </div>
            </section>

            <section className="event-info-section">
              <h3>About This Event</h3>
              <p className="event-description">{event.description}</p>
            </section>

            <section className="event-info-section event-organizer-section">
              <h3>Organized By</h3>
              <Link to={`/organizations/${event.organizationId}`}>{event.organizationName} <Icon name="arrow-right" size={13} /></Link>
            </section>

            <section className="event-info-section">
              <h3>Participant Capacity &amp; Status</h3>
              <div className="event-registration-facts">
                <div><span>Registered participants</span><strong>{event.registeredCount} of {event.capacity}</strong></div>
                <div><span>Remaining slots</span><strong>{ended ? 'Closed (Ended)' : `${availableSlots} slots`}</strong></div>
                <div><span>Your status</span><strong>{registrationState}</strong></div>
              </div>
            </section>
          </div>

          <Link className="event-back-link" to="/events">
            <Icon name="arrow-left" size={14} style={{ display: 'inline-block', verticalAlign: '-1px', marginRight: '6px' }} /> Explore all events
          </Link>
        </div>
      </Card>

      <Modal
        onClose={() => setRegistrationDialogOpen(false)}
        open={registrationDialogOpen}
        size={currentUser?.studentRecordId ? 'sm' : 'md'}
        status={canRegister ? 'APPROVED' : 'REJECTED'}
        title={`Register for ${event.title}`}
      >
        <form onSubmit={confirmRegistration} style={{ display: 'grid', gap: '14px' }}>
          <p className="registration-dialog-copy" style={{ margin: 0 }}>
            {currentUser?.studentRecordId
              ? `Confirm your participant slot (${availableSlots} of ${event.capacity} remaining).`
              : `Enter your participant details below (${availableSlots} of ${event.capacity} slots remaining).`}
          </p>

          {!currentUser?.studentRecordId && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '12px' }}>
              <label style={{ display: 'grid', gap: '6px', fontSize: '13px', fontWeight: 600 }}>
                <span>First Name <span className="required-asterisk">*</span></span>
                <input
                  className="input"
                  onChange={(e) => setParticipantForm((p) => ({ ...p, firstName: e.target.value }))}
                  required
                  type="text"
                  value={participantForm.firstName}
                />
              </label>
              <label style={{ display: 'grid', gap: '6px', fontSize: '13px', fontWeight: 600 }}>
                <span>Last Name <span className="required-asterisk">*</span></span>
                <input
                  className="input"
                  onChange={(e) => setParticipantForm((p) => ({ ...p, lastName: e.target.value }))}
                  required
                  type="text"
                  value={participantForm.lastName}
                />
              </label>
              <label style={{ display: 'grid', gap: '6px', fontSize: '13px', fontWeight: 600 }}>
                <span>Student ID (Numbers Only) <span className="required-asterisk">*</span></span>
                <input
                  className="input"
                  inputMode="numeric"
                  onChange={(e) => setParticipantForm((p) => ({ ...p, studentNumber: sanitizeNumericStudentId(e.target.value) }))}
                  pattern="[0-9]*"
                  placeholder="Digits only, e.g. 202401500"
                  required
                  type="text"
                  value={participantForm.studentNumber}
                />
              </label>
              <label style={{ display: 'grid', gap: '6px', fontSize: '13px', fontWeight: 600 }}>
                <span>Email Address <span className="required-asterisk">*</span></span>
                <input
                  className="input"
                  onChange={(e) => setParticipantForm((p) => ({ ...p, email: e.target.value }))}
                  placeholder="name@wmsu.edu.ph"
                  required
                  type="email"
                  value={participantForm.email}
                />
              </label>
              <label style={{ display: 'grid', gap: '6px', fontSize: '13px', fontWeight: 600 }}>
                <span>Year Level <span className="required-asterisk">*</span></span>
                <select
                  className="input"
                  onChange={(e) => setParticipantForm((p) => ({ ...p, yearLevel: e.target.value }))}
                  value={participantForm.yearLevel}
                >
                  {YEAR_LEVEL_OPTIONS.map((yr) => <option key={yr} value={yr}>{yr}</option>)}
                </select>
              </label>
              <div style={{ display: 'grid', gap: '6px', fontSize: '13px', fontWeight: 600 }}>
                <span>Course / Program <span className="required-asterisk">*</span></span>
                <SearchableSelect
                  onChange={(val) => setParticipantForm((p) => ({ ...p, program: val }))}
                  options={academicPrograms}
                  placeholder="Search course / program…"
                  required
                  value={participantForm.program}
                />
              </div>
              <label style={{ gridColumn: '1 / -1', display: 'grid', gap: '6px', fontSize: '13px', fontWeight: 600 }}>
                <span>Certificate of Registration (COR) <span className="required-asterisk">*</span></span>
                <input
                  accept=".pdf,.jpg,.jpeg,.png"
                  className="input"
                  onChange={handleCorChange}
                  required={!participantForm.corFileName}
                  type="file"
                />
                {participantForm.corFileName && (
                  <small style={{ color: '#15803d', fontWeight: 600 }}>Selected COR: {participantForm.corFileName}</small>
                )}
              </label>
            </div>
          )}

          <div className="registration-dialog-actions">
            <Button onClick={() => setRegistrationDialogOpen(false)} type="button" variant="secondary">Cancel</Button>
            <Button disabled={submitting || !canRegister} type="submit">
              {submitting ? 'Registering…' : 'Confirm Registration'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

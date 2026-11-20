import { useState } from 'react'
import { Link, useOutletContext, useParams } from 'react-router-dom'
import EventPassCard from '../components/attendance/EventPassCard.jsx'
import Badge from '../components/ui/Badge.jsx'
import Button from '../components/ui/Button.jsx'
import Card from '../components/ui/Card.jsx'
import ConfirmDialog from '../components/ui/ConfirmDialog.jsx'
import Modal from '../components/ui/Modal.jsx'
import SearchableSelect from '../components/ui/SearchableSelect.jsx'
import Icon from '../components/ui/Icon.jsx'
import PageHeader from '../components/layout/PageHeader.jsx'
import { useToast } from '../components/ui/useToast.js'
import { usePortalData } from '../context/usePortalData.js'
import { useAuth } from '../context/useAuth.js'
import {
  findUserEventRegistration,
  getEventRegistrationState,
  isEventAlmostFull,
  isEventEnded,
  officerEventToStudentEvent,
  studentEvents,
} from '../data/studentEvents.js'
import {
  YEAR_LEVEL_OPTIONS,
  applyNumericStudentIdPaste,
  readFileAsDataUrl,
  sanitizeNumericStudentId,
} from '../data/officerHierarchy.js'
import { validateUploadFile } from '../data/fileDownload.js'

const GUEST_REG_STORAGE_KEY = 'unidos_guest_event_regs'

function readStoredGuestRegistration(eventId) {
  try {
    const raw = window.localStorage.getItem(GUEST_REG_STORAGE_KEY)
    const map = raw ? JSON.parse(raw) : {}
    return map[String(eventId)] || null
  } catch {
    return null
  }
}

function writeStoredGuestRegistration(eventId, regRef) {
  try {
    const raw = window.localStorage.getItem(GUEST_REG_STORAGE_KEY)
    const map = raw ? JSON.parse(raw) : {}
    if (regRef) {
      map[String(eventId)] = regRef
    } else {
      delete map[String(eventId)]
    }
    window.localStorage.setItem(GUEST_REG_STORAGE_KEY, JSON.stringify(map))
  } catch {
    // Ignore storage errors in restricted contexts
  }
}

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
  const registerParticipantForEvent = outletCtx.registerParticipantForEvent || portalData?.registerParticipantForEvent
  const cancelEventRegistration = outletCtx.cancelEventRegistration || portalData?.cancelEventRegistration
  const attendWithEventCode = outletCtx.attendWithEventCode || portalData?.attendWithEventCode

  const [registrationDialogOpen, setRegistrationDialogOpen] = useState(false)
  const [passModalOpen, setPassModalOpen] = useState(false)
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [checkInCode, setCheckInCode] = useState('')
  const [checkInStudentId, setCheckInStudentId] = useState(() => sanitizeNumericStudentId(currentUser?.studentNumber || ''))
  const [checkingIn, setCheckingIn] = useState(false)
  const [checkInResult, setCheckInResult] = useState(null)
  const [guestRegRef, setGuestRegRef] = useState(() => readStoredGuestRegistration(id))
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

  const storedGuest =
    guestRegRef && String(guestRegRef.eventId) === String(id)
      ? guestRegRef
      : readStoredGuestRegistration(id)
  const guestRegistration = storedGuest
    ? studentRegistrations.find(
        (item) =>
          String(item.eventId) === String(id) &&
          item.status !== 'CANCELLED' &&
          ((storedGuest.registrationId &&
            (String(item.registrationId ?? item.id) === String(storedGuest.registrationId) ||
             String(item.id) === String(storedGuest.registrationId))) ||
           (storedGuest.studentNumber && String(item.studentId) === String(storedGuest.studentNumber)))
      ) || null
    : null
  const registration = findUserEventRegistration(studentRegistrations, id, currentUser) || guestRegistration

  if (!event && portalData?.loading) {
    return (
      <div className="event-details-page">
        <PageHeader
          breadcrumbs={[
            { label: 'Home', to: '/' },
            { label: 'Campus Events', to: '/events' },
            { label: 'Loading event' },
          ]}
          description="Loading event schedule, capacity, and registration status."
          eyebrow="UNIDOS CAMPUS EVENTS"
          title="Loading event…"
        />
        <Card className="event-not-found">
          <p>Fetching event details from the campus directory…</p>
        </Card>
      </div>
    )
  }

  if (!event) {
    return (
      <div className="event-details-page">
        <PageHeader
          breadcrumbs={[
            { label: 'Home', to: '/' },
            { label: 'Campus Events', to: '/events' },
            { label: 'Event not found' },
          ]}
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

  const hasCapacityLimit = Number(event.capacity) > 0
  const ended = isEventEnded(event)
  const registrationState = getEventRegistrationState(event, registration)
  const isFull = registrationState === 'EVENT FULL'
  const isOpen = registrationState === 'NOT REGISTERED' && !ended && !isFull
  const canRegister = isOpen && event.registrationStatus === 'OPEN'
  const availableSlots = hasCapacityLimit ? Math.max((event.capacity || 0) - (event.registeredCount || 0), 0) : null
  const displayStatus = isOpen && isEventAlmostFull(event) ? 'ALMOST FULL' : registrationState

  async function handleCorChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const check = validateUploadFile(file)
    if (!check.ok) {
      showToast(check.error, 'error')
      e.target.value = ''
      return
    }
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
        showToast('COR upload is required.', 'error')
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
    if (result.registration) {
      const nextRef = {
        eventId: String(event.id),
        registrationId: result.registration.id ?? null,
        studentNumber: cleanId || result.registration.student_number || currentUser?.studentNumber || '',
      }
      writeStoredGuestRegistration(event.id, nextRef)
      setGuestRegRef(nextRef)
    }
    setRegistrationDialogOpen(false)
    showToast('Registration confirmed! Your Event Pass is now ready.', 'success')
  }

  async function handleConfirmCancel() {
    if (!registration || !cancelEventRegistration) return
    setCancelling(true)
    const ok = await cancelEventRegistration(registration.registrationId ?? registration.id)
    setCancelling(false)
    setCancelConfirmOpen(false)
    if (ok) {
      writeStoredGuestRegistration(event.id, null)
      setGuestRegRef(null)
      setCheckInResult(null)
      showToast('Your event registration has been cancelled.', 'success')
    } else {
      showToast('Unable to cancel registration. Please try again.', 'error')
    }
  }

  async function handleSelfCheckIn(e) {
    e.preventDefault()
    if (!attendWithEventCode) return
    const targetStudentNumber = registration?.studentId || sanitizeNumericStudentId(checkInStudentId)
    if (!registration && !currentUser?.studentRecordId && !targetStudentNumber) {
      setCheckInResult({ ok: false, message: 'Enter your registered Student ID and attendance code.' })
      return
    }
    setCheckingIn(true)
    const result = await attendWithEventCode({
      eventId: event.id,
      code: checkInCode,
      studentId: registration?.studentRecordId || currentUser?.studentRecordId,
      studentNumber: targetStudentNumber,
      registrationCode: registration?.qrCodeValue || registration?.id,
    })
    setCheckingIn(false)
    setCheckInResult(result)
    if (result?.ok) {
      if (!registration && targetStudentNumber) {
        const nextRef = {
          eventId: String(event.id),
          registrationId: result.data?.registration?.id ?? null,
          studentNumber: targetStudentNumber,
        }
        writeStoredGuestRegistration(event.id, nextRef)
        setGuestRegRef(nextRef)
      }
      setCheckInCode('')
      showToast(result.message || 'Attendance recorded successfully!', 'success')
    } else {
      showToast(result?.message || 'Unable to verify attendance code.', 'error')
    }
  }

  const isAttended = Boolean(
    registration && (registration.status === 'ATTENDED' || registration.attendanceStatus === 'ATTENDED')
  )
  const actionLabel = registrationState === 'REGISTERED' ? 'Registered ✓'
    : isFull ? 'Maximum Limit Reached'
      : ended || registrationState === 'REGISTRATION CLOSED' || registrationState === 'EVENT COMPLETED'
        ? 'Registration Closed (Event Ended)'
        : 'Register for Event'

  return (
    <div className="event-details-page">
      <PageHeader
        breadcrumbs={[
          { label: 'Home', to: '/' },
          { label: 'Campus Events', to: '/events' },
          { label: event.title },
        ]}
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
              <p className="event-details-organization">
                Organized by <Link to={`/organizations/${event.organizationId}`}>{event.organizationName}</Link>
              </p>
            </div>
            <div className="event-registration-actions">
              <Button
                className={`event-register-button ${registrationState === 'REGISTERED' ? 'is-registered' : !canRegister ? 'is-closed' : ''}`.trim()}
                disabled={!canRegister}
                onClick={() => setRegistrationDialogOpen(true)}
                variant={canRegister || registrationState === 'REGISTERED' ? 'primary' : 'secondary'}
              >
                {isAttended ? 'Checked In ✓' : actionLabel}
              </Button>
              {registration && registration.status !== 'CANCELLED' && (
                <Button onClick={() => setPassModalOpen(true)} type="button" variant="secondary">
                  View Event Pass
                </Button>
              )}
              {registration && registration.status !== 'CANCELLED' && !ended && !isAttended && (
                <Button onClick={() => setCancelConfirmOpen(true)} type="button" variant="danger">
                  Cancel Registration
                </Button>
              )}
            </div>
          </div>

          {ended && (
            <div className="status-callout status-callout--danger event-status-banner" role="status">
              Registration has automatically closed because this event has already ended. New registrations are blocked.
            </div>
          )}

          {!ended && isFull && (
            <div className="status-callout status-callout--warning event-status-banner" role="status">
              This event has reached its maximum participant limit ({event.capacity} participants).
            </div>
          )}

          {registration && (
            <p aria-live="polite" className="registration-confirmation" role="status">
              {isAttended
                ? `Attendance verified${registration.checkInTime ? ` at ${registration.checkInTime}` : ''} · Reference ${registration.qrCodeValue || registration.id}`
                : `Registration confirmed · Reference ${registration.qrCodeValue || registration.id}`}
            </p>
          )}

          {!ended && (
            <div className={`event-checkin-box${isAttended ? ' is-attended' : ''}`}>
              <div className="event-checkin-header">
                <div>
                  <h3>Event Self Check-In</h3>
                  <p>
                    {isAttended
                      ? 'Your attendance is verified for this event.'
                      : 'Enter the attendance code announced by the organizer (e.g. WMSU-1234) to confirm your attendance.'}
                  </p>
                </div>
                {isAttended && <Badge tone="success">Attended ✓</Badge>}
              </div>

              {!isAttended && (
                <form className="event-checkin-form" onSubmit={handleSelfCheckIn}>
                  {!registration && !currentUser?.studentRecordId && (
                    <label className="event-checkin-field">
                      <span>Student ID Number</span>
                      <input
                        className="input"
                        inputMode="numeric"
                        onChange={(e) => setCheckInStudentId(sanitizeNumericStudentId(e.target.value))}
                        onPaste={(e) => setCheckInStudentId(applyNumericStudentIdPaste(e, checkInStudentId))}
                        pattern="[0-9]*"
                        placeholder="e.g. 202401500"
                        required
                        type="text"
                        value={checkInStudentId}
                      />
                    </label>
                  )}
                  <label className="event-checkin-field">
                    <span>Attendance Code</span>
                    <input
                      autoComplete="off"
                      className="input"
                      onChange={(e) => setCheckInCode(e.target.value.toUpperCase())}
                      placeholder="e.g. WMSU-1234"
                      required
                      type="text"
                      value={checkInCode}
                    />
                  </label>
                  <Button disabled={checkingIn} type="submit" variant="primary">
                    {checkingIn ? 'Verifying…' : 'Self Check-In'}
                  </Button>
                </form>
              )}

              {checkInResult && (
                <p
                  aria-live="polite"
                  className={`event-checkin-status${checkInResult.ok ? ' is-success' : ' is-error'}`}
                  role="status"
                >
                  {checkInResult.message}
                </p>
              )}
            </div>
          )}

          <div className="event-detail-sections">
            <section className="event-info-section">
              <h3>Event Details</h3>
              <div className="event-details-facts">
                <div><span>Date</span><strong>{event.date}</strong></div>
                <div><span>Time</span><strong>{event.time}</strong></div>
                <div><span>Location</span><strong>{event.location}</strong></div>
                <div><span>Category</span><strong>{event.category}</strong></div>
                <div><span>Maximum Participants</span><strong>{hasCapacityLimit ? `${event.capacity} participants` : 'Open capacity'}</strong></div>
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
                <div><span>Registered participants</span><strong>{hasCapacityLimit ? `${event.registeredCount} of ${event.capacity}` : `${event.registeredCount} registered`}</strong></div>
                <div><span>Remaining slots</span><strong>{ended ? 'Closed (Ended)' : (hasCapacityLimit ? `${availableSlots} slots` : 'Open capacity')}</strong></div>
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
        <form className="modal-form-stack" onSubmit={confirmRegistration}>
          <p className="registration-dialog-copy">
            {hasCapacityLimit
              ? (currentUser?.studentRecordId
                ? `Confirm your participant slot (${availableSlots} of ${event.capacity} remaining).`
                : `Enter your participant details below (${availableSlots} of ${event.capacity} slots remaining).`)
              : (currentUser?.studentRecordId
                ? 'Confirm your event registration below.'
                : 'Enter your participant details below to register.')}
          </p>

          {!currentUser?.studentRecordId && (
            <div className="modal-form-grid">
              <label className="modal-field-compact">
                <span>First Name <span aria-hidden="true" className="required-asterisk">*</span></span>
                <input
                  className="input"
                  onChange={(e) => setParticipantForm((p) => ({ ...p, firstName: e.target.value }))}
                  required
                  type="text"
                  value={participantForm.firstName}
                />
              </label>
              <label className="modal-field-compact">
                <span>Last Name <span aria-hidden="true" className="required-asterisk">*</span></span>
                <input
                  className="input"
                  onChange={(e) => setParticipantForm((p) => ({ ...p, lastName: e.target.value }))}
                  required
                  type="text"
                  value={participantForm.lastName}
                />
              </label>
              <label className="modal-field-compact">
                <span>Student ID (Numbers Only) <span aria-hidden="true" className="required-asterisk">*</span></span>
                <input
                  className="input"
                  inputMode="numeric"
                  onChange={(e) => setParticipantForm((p) => ({ ...p, studentNumber: sanitizeNumericStudentId(e.target.value) }))}
                  onPaste={(e) => setParticipantForm((p) => ({ ...p, studentNumber: applyNumericStudentIdPaste(e, p.studentNumber) }))}
                  pattern="[0-9]*"
                  placeholder="Digits only, e.g. 202401500"
                  required
                  type="text"
                  value={participantForm.studentNumber}
                />
              </label>
              <label className="modal-field-compact">
                <span>Email Address <span aria-hidden="true" className="required-asterisk">*</span></span>
                <input
                  className="input"
                  onChange={(e) => setParticipantForm((p) => ({ ...p, email: e.target.value }))}
                  placeholder="name@wmsu.edu.ph"
                  required
                  type="email"
                  value={participantForm.email}
                />
              </label>
              <label className="modal-field-compact">
                <span>Year Level <span aria-hidden="true" className="required-asterisk">*</span></span>
                <select
                  className="input"
                  onChange={(e) => setParticipantForm((p) => ({ ...p, yearLevel: e.target.value }))}
                  value={participantForm.yearLevel}
                >
                  {YEAR_LEVEL_OPTIONS.map((yr) => <option key={yr} value={yr}>{yr}</option>)}
                </select>
              </label>
              <div className="modal-field-compact">
                <span>Course / Program <span aria-hidden="true" className="required-asterisk">*</span></span>
                <SearchableSelect
                  onChange={(val) => setParticipantForm((p) => ({ ...p, program: val }))}
                  options={academicPrograms}
                  placeholder="Search course / program…"
                  required
                  value={participantForm.program}
                />
              </div>
              <label className="modal-field-compact modal-field-full">
                <span>COR <span aria-hidden="true" className="required-asterisk">*</span></span>
                <input
                  accept=".pdf,.jpg,.jpeg,.png"
                  className="input"
                  onChange={handleCorChange}
                  required={!participantForm.corFileName}
                  type="file"
                />
                {participantForm.corFileName && (
                  <small className="file-upload-selected">Selected COR: <strong>{participantForm.corFileName}</strong></small>
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

      <Modal
        onClose={() => setPassModalOpen(false)}
        open={Boolean(passModalOpen && registration)}
        size="md"
        title="Digital Event Pass"
      >
        {registration && (
          <EventPassCard
            event={event}
            onClose={() => setPassModalOpen(false)}
            registration={registration}
            student={
              currentUser || {
                name: registration.studentName,
                studentNumber: registration.studentId,
                program: registration.program,
              }
            }
          />
        )}
      </Modal>

      <ConfirmDialog
        confirmLabel={cancelling ? 'Cancelling…' : 'Cancel Registration'}
        message={`Cancel your registration for "${event.title}"? Your reserved participant slot will be released.`}
        onCancel={() => setCancelConfirmOpen(false)}
        onConfirm={handleConfirmCancel}
        open={cancelConfirmOpen}
        title="Cancel event registration"
        tone="danger"
      />
    </div>
  )
}

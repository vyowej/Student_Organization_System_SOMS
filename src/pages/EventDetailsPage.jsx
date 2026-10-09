import { useState } from 'react'
import { Link, useOutletContext, useParams } from 'react-router-dom'
import Badge from '../components/ui/Badge.jsx'
import Button from '../components/ui/Button.jsx'
import Card from '../components/ui/Card.jsx'
import Modal from '../components/ui/Modal.jsx'
import PageHeader from '../components/layout/PageHeader.jsx'
import { undoAction, useToast } from '../components/ui/useToast.js'
import { getEventRegistrationState, isEventAlmostFull, studentEvents } from '../data/studentEvents.js'
import { officerEventToStudentEvent } from '../data/officerStudentEvent.js'

const stateTone = {
  REGISTERED: 'success',
  'EVENT FULL': 'danger',
  'REGISTRATION CLOSED': 'neutral',
  'EVENT COMPLETED': 'neutral',
  'NOT REGISTERED': 'success',
}

export default function EventDetailsPage() {
  const { id } = useParams()
  const { captureUndo, eventRegisteredCounts, officerEvents, registerForEvent, studentRegistrations } = useOutletContext()
  const { showToast } = useToast()
  const [registrationDialogOpen, setRegistrationDialogOpen] = useState(false)
  const baseEvent = studentEvents.find((item) => item.id === id)
    ?? (officerEvents.some((item) => item.id === id && item.status === 'PUBLISHED')
      ? officerEventToStudentEvent(officerEvents.find((item) => item.id === id))
      : undefined)
  const event = baseEvent && {
    ...baseEvent,
    registeredCount: eventRegisteredCounts[baseEvent.id] ?? baseEvent.registeredCount,
  }
  const registration = studentRegistrations.find((item) => (
    item.eventId === id && item.status === 'REGISTERED'
  ))

  if (!event) {
    return (
      <>
        <PageHeader
          description="The event may have been removed or the link may be incorrect."
          eyebrow="UNIDOS STUDENT PORTAL"
          title="Event not found"
        />
        <Card className="event-not-found">
          <p>We could not find that event in the current preview.</p>
          <Link className="button button-primary" to="/student/events">Explore all events</Link>
        </Card>
      </>
    )
  }

  const registrationState = getEventRegistrationState(event, registration)
  const isOpen = registrationState === 'NOT REGISTERED'
  const canRegister = isOpen && event.registrationStatus === 'OPEN'
  const availableSlots = Math.max(event.capacity - event.registeredCount, 0)
  const displayStatus = isOpen && isEventAlmostFull(event) ? 'ALMOST FULL' : registrationState

  function confirmRegistration() {
    if (!canRegister) return
    const undo = captureUndo()
    const registrationResult = registerForEvent(event.id)
    if (!registrationResult) {
      showToast('Unable to complete registration. Please refresh the event and try again.', 'error')
      return
    }
    setRegistrationDialogOpen(false)
    showToast('You are registered for this event.', 'success', undoAction(undo))
  }

  const actionLabel = registrationState === 'REGISTERED' ? 'Registered ✓'
    : registrationState === 'EVENT FULL' ? 'Event Full'
      : registrationState === 'REGISTRATION CLOSED' ? 'Registration Closed'
        : registrationState === 'EVENT COMPLETED' ? 'Event Completed'
          : 'Register'

  return (
    <div className="event-details-page">
      <PageHeader
        description="Event information, schedule, and registration details."
        eyebrow="UNIDOS STUDENT PORTAL · CAMPUS EVENTS"
        title={event.title}
      />

      <Card className="event-details-card event-module-details">
        <div aria-hidden="true" className={`event-details-banner event-${event.color}`}>
          <span className="event-banner-date">{event.date}</span>
          <strong>{event.category}</strong>
        </div>
        <div className="event-details-body">
          <div className="event-details-heading">
            <div>
              <Badge tone={stateTone[registrationState]}>{displayStatus}</Badge>
              <h2>{event.title}</h2>
              <p className="event-details-organization">
                Organized by <Link to={`/student/organizations/${event.organizationId}`}>{event.organizationName}</Link>
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
              {registration && (
                <Link className="event-pass-shortcut" to={`/student/registrations/${registration.id}/pass`}>
                  View Pass
                </Link>
              )}
            </div>
          </div>

          {registration && (
            <p aria-live="polite" className="registration-confirmation" role="status">
              Registration confirmed
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
                <div><span>Event status</span><strong>{event.status}</strong></div>
                <div><span>Registration status</span><strong>{displayStatus}</strong></div>
              </div>
            </section>

            <section className="event-info-section">
              <h3>About This Event</h3>
              <p className="event-description">{event.description}</p>
            </section>

            <section className="event-info-section event-organizer-section">
              <h3>Organized By</h3>
              <Link to={`/student/organizations/${event.organizationId}`}>{event.organizationName} <span aria-hidden="true">→</span></Link>
            </section>

            <section className="event-info-section">
              <h3>Registration Information</h3>
              <div className="event-registration-facts">
                <div><span>Registration deadline</span><strong>{event.registrationDeadline}</strong></div>
                <div><span>Available slots</span><strong>{availableSlots} of {event.capacity}</strong></div>
                <div><span>Your status</span><strong>{registrationState}</strong></div>
              </div>
            </section>
          </div>

          <Link className="event-back-link" to="/student/events">← Explore all events</Link>
        </div>
      </Card>

      <Modal
        onClose={() => setRegistrationDialogOpen(false)}
        open={registrationDialogOpen}
        title={`Register for ${event.title}?`}
      >
        <p className="registration-dialog-copy">Confirm your registration for this event.</p>
        <div className="registration-dialog-actions">
          <Button onClick={() => setRegistrationDialogOpen(false)} variant="secondary">Cancel</Button>
          <Button onClick={confirmRegistration}>Confirm Registration</Button>
        </div>
      </Modal>
    </div>
  )
}

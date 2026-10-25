import { useState } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import Badge from '../components/ui/Badge.jsx'
import ConfirmDialog from '../components/ui/ConfirmDialog.jsx'
import EmptyState from '../components/ui/EmptyState.jsx'
import Icon from '../components/ui/Icon.jsx'
import Modal from '../components/ui/Modal.jsx'
import PageHeader from '../components/layout/PageHeader.jsx'
import SearchBar, { matchesQuery } from '../components/ui/SearchBar.jsx'
import EventPassCard from '../components/attendance/EventPassCard.jsx'
import { undoAction, useToast } from '../components/ui/useToast.js'
import { findStudentEvent, studentEvents } from '../data/studentEvents.js'

const tabs = ['Upcoming', 'Past', 'Cancelled']

function isPastEvent(event) {
  return event.status === 'COMPLETED' || event.status === 'ARCHIVED'
}

export default function StudentRegistrationsPage() {
  const {
    cancelRegistration,
    captureUndo,
    currentUser,
    officerEvents = [],
    studentRegistrations = [],
  } = useOutletContext()

  const { showToast } = useToast()
  const [cancelTarget, setCancelTarget] = useState(null)
  const [previewPassRegistration, setPreviewPassRegistration] = useState(null)
  const [activeTab, setActiveTab] = useState('Upcoming')
  const [search, setSearch] = useState('')

  const registrations = studentRegistrations
    .map((registration) => ({
      ...registration,
      event: findStudentEvent(registration.eventId, officerEvents, studentEvents),
    }))
    .filter((registration) => registration.event)
    .filter((registration) => {
      if (activeTab === 'Cancelled') return registration.status === 'CANCELLED'
      if (activeTab === 'Past')
        return (
          registration.status === 'COMPLETED' ||
          (registration.status === 'REGISTERED' && isPastEvent(registration.event))
        )
      return registration.status === 'REGISTERED' && !isPastEvent(registration.event)
    })
    .filter((registration) =>
      matchesQuery(
        search,
        registration.event.title,
        registration.event.organizationName,
        registration.event.date,
        registration.event.location
      )
    )
    .sort((a, b) => new Date(a.event.date) - new Date(b.event.date))

  return (
    <div className="student-registrations-page">
      <PageHeader
        description="Review your event registrations, access your scannable digital passes, and check attendance status."
        eyebrow="UNIDOS STUDENT PORTAL"
        title="My Registrations & Event Passes"
      />

      <SearchBar
        label="Search registrations"
        onChange={setSearch}
        placeholder="Search registrations by event, organization or venue…"
        value={search}
      />

      <div aria-label="Registration groups" className="registration-tabs" role="tablist">
        {tabs.map((tab) => (
          <button
            aria-selected={activeTab === tab}
            className={`registration-tab${activeTab === tab ? ' is-active' : ''}`}
            key={tab}
            onClick={() => setActiveTab(tab)}
            role="tab"
            type="button"
          >
            {tab}
          </button>
        ))}
      </div>

      {registrations.length ? (
        <div className="student-registration-list">
          {registrations.map((registration) => {
            const { event } = registration
            const statusTone =
              registration.status === 'REGISTERED'
                ? 'success'
                : registration.status === 'CANCELLED'
                ? 'danger'
                : 'neutral'
            const attendanceTone =
              registration.attendanceStatus === 'ATTENDED'
                ? 'success'
                : registration.attendanceStatus === 'ABSENT'
                ? 'danger'
                : 'neutral'

            return (
              <article className="student-registration-card" key={registration.id}>
                <div
                  aria-hidden="true"
                  className={`student-registration-date event-${event.color || 'crimson'}`}
                >
                  <span>{event.date.split(' ')[0]?.slice(0, 3) || 'EVT'}</span>
                  <strong>{event.date.match(/\d+/)?.[0] || '•'}</strong>
                </div>

                <div className="student-registration-copy">
                  <h2>{event.title}</h2>
                  <p>{event.organizationName}</p>
                  <div className="student-registration-facts">
                    <span>
                      <Icon name="calendar" size={13} /> {event.date}
                    </span>
                    <span>
                      <Icon name="clock" size={13} /> {event.time}
                    </span>
                    <span>
                      <Icon name="location" size={13} /> {event.location}
                    </span>
                  </div>
                </div>

                <div className="student-registration-statuses">
                  <Badge tone={statusTone}>{registration.status}</Badge>
                  <Badge tone={attendanceTone}>
                    {registration.attendanceStatus === 'ATTENDED'
                      ? '✓ ATTENDED'
                      : `ATTENDANCE: ${registration.attendanceStatus}`}
                  </Badge>
                </div>

                <div className="student-registration-actions">
                  <Link
                    className="button button-secondary"
                    to={`/student/events/${event.id}`}
                  >
                    View Event
                  </Link>

                  {registration.status === 'REGISTERED' && !isPastEvent(event) && (
                    <button
                      className="button button-primary"
                      onClick={() => setPreviewPassRegistration(registration)}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                      type="button"
                    >
                      <Icon name="qr" size={14} /> Digital Pass & QR
                    </button>
                  )}

                  {registration.status === 'REGISTERED' &&
                    registration.attendanceStatus !== 'ATTENDED' &&
                    !isPastEvent(event) && (
                      <button
                        className="button button-danger"
                        onClick={() => setCancelTarget(registration)}
                        type="button"
                      >
                        Cancel
                      </button>
                    )}
                </div>
              </article>
            )
          })}
        </div>
      ) : (
        <EmptyState
          description={
            activeTab === 'Upcoming'
              ? 'When you register for a campus event, your registrations and digital QR passes will appear here.'
              : `You do not have any ${activeTab.toLowerCase()} registrations.`
          }
          title={`No ${activeTab.toLowerCase()} registrations`}
        />
      )}

      {/* Digital Pass & QR Modal */}
      {previewPassRegistration && (
        <Modal
          className="pass-preview-modal"
          onClose={() => setPreviewPassRegistration(null)}
          open={Boolean(previewPassRegistration)}
          size="md"
          title="Digital Event Pass"
        >
          <EventPassCard
            event={previewPassRegistration.event}
            onClose={() => setPreviewPassRegistration(null)}
            registration={previewPassRegistration}
            showActions={true}
            student={currentUser}
          />
        </Modal>
      )}

      {/* Confirmation Dialog for Cancellation */}
      <ConfirmDialog
        cancelLabel="Keep registration"
        confirmLabel="Cancel registration"
        message={`Are you sure you want to cancel your registration for "${cancelTarget?.event.title ?? ''}"? Your digital pass will stop working and your slot will be released.`}
        onCancel={() => setCancelTarget(null)}
        onConfirm={async () => {
          const undo = captureUndo()
          if (await cancelRegistration(cancelTarget.id))
            showToast('Registration cancelled.', 'success', undoAction(undo))
          setCancelTarget(null)
        }}
        open={Boolean(cancelTarget)}
        title="Cancel registration?"
        tone="danger"
      />
    </div>
  )
}

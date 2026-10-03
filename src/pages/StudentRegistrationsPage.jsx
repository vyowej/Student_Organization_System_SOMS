import { useState } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import Badge from '../components/ui/Badge.jsx'
import EmptyState from '../components/ui/EmptyState.jsx'
import PageHeader from '../components/layout/PageHeader.jsx'
import { studentEvents } from '../data/studentEvents.js'

const tabs = ['Upcoming', 'Past', 'Cancelled']

function isPastEvent(event) {
  return event.status === 'COMPLETED' || event.status === 'ARCHIVED'
}

export default function StudentRegistrationsPage() {
  const { studentRegistrations } = useOutletContext()
  const [activeTab, setActiveTab] = useState('Upcoming')

  const registrations = studentRegistrations
    .map((registration) => ({
      ...registration,
      event: studentEvents.find((event) => event.id === registration.eventId),
    }))
    .filter((registration) => registration.event)
    .filter((registration) => {
      if (activeTab === 'Cancelled') return registration.status === 'CANCELLED'
      if (activeTab === 'Past') return registration.status === 'COMPLETED' || (registration.status === 'REGISTERED' && isPastEvent(registration.event))
      return registration.status === 'REGISTERED' && !isPastEvent(registration.event)
    })
    .sort((a, b) => new Date(a.event.date) - new Date(b.event.date))

  return (
    <div className="student-registrations-page">
      <PageHeader
        description="Review your event registrations, attendance details, and digital passes."
        eyebrow="UNIDOS STUDENT PORTAL"
        title="My Registrations"
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
            const statusTone = registration.status === 'REGISTERED' ? 'success'
              : registration.status === 'CANCELLED' ? 'danger'
                : 'neutral'
            const attendanceTone = registration.attendanceStatus === 'ATTENDED' ? 'success'
              : registration.attendanceStatus === 'ABSENT' ? 'danger'
                : 'neutral'
            return (
              <article className="student-registration-card" key={registration.id}>
                <div aria-hidden="true" className={`student-registration-date event-${event.color}`}>
                  <span>{event.date.split(' ')[0].slice(0, 3)}</span>
                  <strong>{event.date.match(/\d+/)?.[0]}</strong>
                </div>
                <div className="student-registration-copy">
                  <h2>{event.title}</h2>
                  <p>{event.organizationName}</p>
                  <div className="student-registration-facts">
                    <span>{event.date}</span>
                    <span>{event.time}</span>
                    <span>{event.location}</span>
                  </div>
                </div>
                <div className="student-registration-statuses">
                  <Badge tone={statusTone}>{registration.status}</Badge>
                  <Badge tone={attendanceTone}>ATTENDANCE: {registration.attendanceStatus}</Badge>
                </div>
                <div className="student-registration-actions">
                  <Link className="button button-secondary" to={`/student/events/${event.id}`}>View Event</Link>
                  {registration.status === 'REGISTERED' && !isPastEvent(event) && (
                    <Link className="button button-primary" to={`/student/registrations/${registration.id}/pass`}>View Pass</Link>
                  )}
                </div>
              </article>
            )
          })}
        </div>
      ) : (
        <EmptyState
          description={activeTab === 'Upcoming'
            ? 'When you register for a campus event, it will appear here.'
            : `You do not have any ${activeTab.toLowerCase()} registrations in this preview.`}
          title={`No ${activeTab.toLowerCase()} registrations`}
        />
      )}
    </div>
  )
}

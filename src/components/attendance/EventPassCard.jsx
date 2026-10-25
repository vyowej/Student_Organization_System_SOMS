import { useState } from 'react'
import Badge from '../ui/Badge.jsx'
import Card from '../ui/Card.jsx'
import Icon from '../ui/Icon.jsx'
import QrCodeCanvas from './QrCodeCanvas.jsx'
import WmsuLogo from '../ui/WmsuLogo.jsx'
import { formatDisplayName } from '../../data/displayName.js'

export default function EventPassCard({
  registration,
  event,
  student,
  onClose,
  showActions = true,
  className = '',
}) {
  const [copied, setCopied] = useState(false)
  const isAttended = registration?.attendanceStatus === 'ATTENDED' || registration?.status === 'ATTENDED'

  const studentDisplayName = formatDisplayName(student) || `${registration?.lastName || ''}, ${registration?.firstName || ''}`.replace(/^,\s*/, '') || 'Registered Student'
  const studentIdNumber = student?.studentId || registration?.studentId || registration?.studentNumber || 'Student ID'
  const regCode = registration?.id || `REG-${registration?.registrationId || '1'}`

  // Standardized QR payload: JSON string containing all essential attributes for the scanner
  const qrPayload = JSON.stringify({
    type: 'UNIDOS_EVENT_PASS',
    id: registration?.registrationId || registration?.id,
    code: regCode,
    studentId: studentIdNumber,
    studentName: studentDisplayName,
    eventId: event?.id,
    eventTitle: event?.title || 'Campus Event',
  })

  function handleCopyCode() {
    navigator.clipboard?.writeText(regCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function handlePrint() {
    window.print()
  }

  return (
    <Card className={`unidos-digital-pass-card ${className}`}>
      {/* Top Banner with Crimson Arch & WMSU Watermark */}
      <div className="event-pass-banner">
        <div className="event-pass-brand">
          <WmsuLogo className="event-pass-seal" />
          <div className="event-pass-brand-text">
            <strong>UNIDOS</strong>
            <small>Western Mindanao State University</small>
          </div>
        </div>
        <Badge tone={isAttended ? 'success' : 'warning'}>
          {isAttended ? '✓ Verified Present' : 'Ready for Check-in'}
        </Badge>
      </div>

      {/* Event Details Section */}
      <div className="event-pass-body">
        <div className="event-pass-event-info">
          <span className="event-pass-eyebrow">OFFICIAL DIGITAL EVENT PASS</span>
          <h2 className="event-pass-title">{event?.title || 'Campus Event'}</h2>
          <p className="event-pass-org">{event?.organizationName || event?.organization || 'WMSU Student Organization'}</p>
        </div>

        {/* QR Code Presentation Box */}
        <div className="event-pass-qr-container">
          <div className="event-pass-qr-frame">
            <QrCodeCanvas
              alt={`QR code for ${studentDisplayName}`}
              size={190}
              value={qrPayload}
            />
            <div className="event-pass-code-pill">
              <span className="code-label">Pass Code:</span>
              <strong className="code-value">{regCode}</strong>
              <button
                aria-label="Copy registration pass code"
                className="code-copy-btn"
                onClick={handleCopyCode}
                title="Copy code"
                type="button"
              >
                <Icon name={copied ? 'check' : 'copy'} size={13} />
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
          </div>
          <span className="event-pass-scan-instruction">
            {isAttended ? (
              <span className="text-success font-semibold">
                <Icon name="check-circle" size={14} /> Checked in {registration?.checkInTime ? `at ${registration.checkInTime}` : 'successfully'}
              </span>
            ) : (
              'Present this QR code at the check-in station upon venue arrival'
            )}
          </span>
        </div>

        {/* Ticket Divider Line with Notches */}
        <div aria-hidden="true" className="event-pass-tear-line">
          <div className="tear-notch notch-left" />
          <div className="tear-dashes" />
          <div className="tear-notch notch-right" />
        </div>

        {/* Attendee Details Grid */}
        <div className="event-pass-meta-grid">
          <div className="meta-item">
            <span className="meta-label">Student Name</span>
            <strong className="meta-value">{studentDisplayName}</strong>
          </div>
          <div className="meta-item">
            <span className="meta-label">Student Number</span>
            <strong className="meta-value">{studentIdNumber}</strong>
          </div>
          <div className="meta-item">
            <span className="meta-label">Date</span>
            <strong className="meta-value">{event?.date || 'Scheduled Date'}</strong>
          </div>
          <div className="meta-item">
            <span className="meta-label">Time & Venue</span>
            <strong className="meta-value">{event?.time || 'TBA'} · {event?.location || 'Campus'}</strong>
          </div>
        </div>
      </div>

      {/* Action Footer */}
      {showActions && (
        <div className="event-pass-actions no-print">
          <button
            className="button button-secondary"
            onClick={handlePrint}
            type="button"
          >
            <Icon name="download" size={14} /> Print / Save Pass
          </button>
          {onClose && (
            <button
              className="button button-primary"
              onClick={onClose}
              type="button"
            >
              Done
            </button>
          )}
        </div>
      )}
    </Card>
  )
}

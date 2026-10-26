import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import Badge from '../ui/Badge.jsx'
import Card from '../ui/Card.jsx'
import Icon from '../ui/Icon.jsx'
import WmsuLogo from '../ui/WmsuLogo.jsx'
import { formatDisplayName } from '../../data/displayName.js'

export function QrCodeCanvas({
  value,
  size = 220,
  darkColor = '#1f1d22',
  lightColor = '#ffffff',
  className = '',
  alt = 'Event Pass QR Code',
}) {
  const [dataUrl, setDataUrl] = useState('')
  const [error, setError] = useState(null)

  useEffect(() => {
    let isCurrent = true
    if (!value) {
      setDataUrl('')
      return undefined
    }

    QRCode.toDataURL(String(value), {
      width: size * 2,
      margin: 2,
      color: {
        dark: darkColor,
        light: lightColor,
      },
      errorCorrectionLevel: 'M',
    })
      .then((url) => {
        if (isCurrent) {
          setDataUrl(url)
          setError(null)
        }
      })
      .catch((err) => {
        if (isCurrent) setError(err?.message || 'Failed to generate QR code')
      })

    return () => {
      isCurrent = false
    }
  }, [value, size, darkColor, lightColor])

  if (error) {
    return (
      <div
        className={`qr-code-error ${className}`}
        style={{
          width: size,
          height: size,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#fdf3f5',
          color: 'var(--crimson)',
          fontSize: '12px',
          textAlign: 'center',
          padding: '12px',
          borderRadius: '12px',
          border: '1px dashed #e8c0cb',
        }}
      >
        <span>Unable to generate QR code</span>
      </div>
    )
  }

  if (!dataUrl) {
    return (
      <div
        aria-busy="true"
        aria-label="Generating QR code"
        className={`qr-code-skeleton ${className}`}
        style={{
          width: size,
          height: size,
          borderRadius: '12px',
          background: 'linear-gradient(135deg, #f5f2f4 25%, #ede8eb 50%, #f5f2f4 75%)',
          backgroundSize: '200% 200%',
          animation: 'qr-pulse 1.6s ease infinite',
        }}
      />
    )
  }

  return (
    <div
      className={`qr-code-wrapper ${className}`}
      style={{
        display: 'inline-flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <img
        alt={alt}
        className="qr-code-image"
        height={size}
        src={dataUrl}
        style={{
          width: size,
          height: size,
          borderRadius: '10px',
          imageRendering: 'pixelated',
          display: 'block',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
        }}
        width={size}
      />
    </div>
  )
}

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

  const studentDisplayName =
    formatDisplayName(student) ||
    `${registration?.lastName || ''}, ${registration?.firstName || ''}`.replace(/^,\s*/, '') ||
    'Registered Student'
  const studentIdNumber = student?.studentId || registration?.studentId || registration?.studentNumber || 'Student ID'
  const rawRegId = registration?.qrCodeValue || registration?.id || registration?.registrationId || '1'
  const regCode = String(rawRegId).startsWith('REG-') || String(rawRegId).startsWith('UNIDOS-')
    ? String(rawRegId)
    : `REG-${rawRegId}`

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

      <div className="event-pass-body">
        <div className="event-pass-event-info">
          <span className="event-pass-eyebrow">OFFICIAL DIGITAL EVENT PASS</span>
          <h2 className="event-pass-title">{event?.title || 'Campus Event'}</h2>
          <p className="event-pass-org">{event?.organizationName || event?.organization || 'WMSU Student Organization'}</p>
        </div>

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

        <div aria-hidden="true" className="event-pass-tear-line">
          <div className="tear-notch notch-left" />
          <div className="tear-dashes" />
          <div className="tear-notch notch-right" />
        </div>

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

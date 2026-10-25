import { useEffect, useState } from 'react'
import QRCode from 'qrcode'

/**
 * High-fidelity, accessible QR Code component using the `qrcode` package.
 * Generates crisp SVG/DataURL QR codes styled for WMSU / UNIDOS digital event passes.
 */
export default function QrCodeCanvas({
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
      return
    }

    QRCode.toDataURL(String(value), {
      width: size * 2, // render at 2x for retina sharpness
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

import { useEffect, useRef, useState } from 'react'
import { Html5Qrcode } from 'html5-qrcode'
import Badge from '../ui/Badge.jsx'
import Icon from '../ui/Icon.jsx'

/**
 * Synthesizes crisp, zero-dependency audio feedback for check-in events.
 */
function playAudioFeedback(type = 'success') {
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext
    if (!AudioContextClass) return
    const ctx = new AudioContextClass()
    if (ctx.state === 'suspended') ctx.resume()
    const now = ctx.currentTime

    if (type === 'success') {
      // Pleasant double-beep (880Hz A5 -> 1320Hz E6)
      const osc1 = ctx.createOscillator()
      const osc2 = ctx.createOscillator()
      const gain = ctx.createGain()
      gain.gain.setValueAtTime(0.15, now)
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.24)

      osc1.frequency.setValueAtTime(880, now)
      osc2.frequency.setValueAtTime(1320, now + 0.09)

      osc1.connect(gain)
      osc2.connect(gain)
      gain.connect(ctx.destination)

      osc1.start(now)
      osc1.stop(now + 0.09)
      osc2.start(now + 0.09)
      osc2.stop(now + 0.24)
    } else {
      // Gentle warning double-thud (440Hz -> 330Hz)
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      gain.gain.setValueAtTime(0.12, now)
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28)
      osc.frequency.setValueAtTime(380, now)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(now)
      osc.stop(now + 0.28)
    }
  } catch (_) {}
}

export default function QrScannerStation({
  onScan,
  eventId,
  eventTitle,
  active = true,
  className = '',
}) {
  const [mode, setMode] = useState('camera') // 'camera' | 'file'
  const [cameras, setCameras] = useState([])
  const [selectedCameraId, setSelectedCameraId] = useState('')
  const [isScanning, setIsScanning] = useState(false)
  const [cameraError, setCameraError] = useState(null)
  const [recentScan, setRecentScan] = useState(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [torchOn, setTorchOn] = useState(false)
  const [torchSupported, setTorchSupported] = useState(false)

  const scannerRef = useRef(null)
  const scannerInstanceRef = useRef(null)
  const cooldownRef = useRef(false)
  const elementIdRef = useRef(`qr-reader-${Math.random().toString(36).substring(2, 9)}`)

  // Discover connected camera devices
  useEffect(() => {
    Html5Qrcode.getCameras()
      .then((devices) => {
        if (devices && devices.length) {
          setCameras(devices)
          // Default to back/environment camera if available, else first camera
          const backCam = devices.find((d) => d.label.toLowerCase().includes('back') || d.label.toLowerCase().includes('environment') || d.label.toLowerCase().includes('rear'))
          setSelectedCameraId(backCam ? backCam.id : devices[0].id)
        } else {
          setCameraError('No camera devices detected on this device.')
        }
      })
      .catch((err) => {
        setCameraError(err?.message || 'Camera permission required for QR scanning.')
      })
  }, [])

  // Start / Stop camera scanner
  useEffect(() => {
    if (!active || mode !== 'camera' || !selectedCameraId) {
      stopScanner()
      return
    }

    startScanner(selectedCameraId)

    return () => {
      stopScanner()
    }
  }, [active, mode, selectedCameraId])

  async function startScanner(cameraId) {
    if (isProcessing) return
    try {
      if (scannerInstanceRef.current) {
        await stopScanner()
      }

      const html5QrCode = new Html5Qrcode(elementIdRef.current)
      scannerInstanceRef.current = html5QrCode

      const config = {
        fps: 15,
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1.0,
      }

      await html5QrCode.start(
        cameraId,
        config,
        async (decodedText) => {
          handleDetectedCode(decodedText)
        },
        () => {
          // Frame scanned without QR match — normal polling
        }
      )

      setIsScanning(true)
      setCameraError(null)

      // Test torch capability
      try {
        const capabilities = html5QrCode.getRunningTrackCapabilities()
        setTorchSupported(Boolean(capabilities?.torch))
      } catch (_) {
        setTorchSupported(false)
      }
    } catch (err) {
      console.warn('[QR Scanner Start Error]', err)
      setIsScanning(false)
      setCameraError(err?.message || 'Could not start camera feed. Please check camera permissions.')
    }
  }

  async function stopScanner() {
    if (scannerInstanceRef.current) {
      try {
        if (scannerInstanceRef.current.isScanning) {
          await scannerInstanceRef.current.stop()
        }
        await scannerInstanceRef.current.clear()
      } catch (_) {}
      scannerInstanceRef.current = null
      setIsScanning(false)
      setTorchOn(false)
    }
  }

  async function handleToggleTorch() {
    if (!scannerInstanceRef.current || !torchSupported) return
    try {
      const nextTorch = !torchOn
      await scannerInstanceRef.current.applyVideoConstraints({
        advanced: [{ torch: nextTorch }],
      })
      setTorchOn(nextTorch)
    } catch (_) {}
  }

  async function handleDetectedCode(decodedText) {
    if (cooldownRef.current) return
    cooldownRef.current = true
    setIsProcessing(true)

    try {
      // Execute the attendance check-in
      const result = await onScan(decodedText, 'QR_SCAN')
      if (result?.ok) {
        playAudioFeedback('success')
        setRecentScan({
          ok: true,
          code: decodedText,
          message: result.message,
          studentName: result.studentName,
          studentId: result.studentId,
          alreadyCheckedIn: result.alreadyCheckedIn,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        })
      } else {
        playAudioFeedback('error')
        setRecentScan({
          ok: false,
          code: decodedText,
          message: result?.message || 'Invalid or unrecognized event pass.',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        })
      }
    } catch (err) {
      playAudioFeedback('error')
      setRecentScan({
        ok: false,
        code: decodedText,
        message: err?.message || 'Failed to process scanned QR code.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      })
    } finally {
      setIsProcessing(false)
      // Allow next scan after 1.8 seconds cooldown to prevent duplicate burst triggers
      setTimeout(() => {
        cooldownRef.current = false
      }, 1800)
    }
  }

  // Handle uploaded image file scanning
  async function handleFileUpload(event) {
    const file = event.target.files?.[0]
    if (!file) return

    setIsProcessing(true)
    try {
      const html5QrCode = new Html5Qrcode(elementIdRef.current)
      const decodedText = await html5QrCode.scanFile(file, true)
      await handleDetectedCode(decodedText)
    } catch (err) {
      playAudioFeedback('error')
      setRecentScan({
        ok: false,
        message: 'No QR code could be detected in the uploaded image. Please try a clearer screenshot.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      })
    } finally {
      setIsProcessing(false)
      event.target.value = ''
    }
  }

  return (
    <div className={`qr-scanner-station ${className}`}>
      {/* Mode Navigation */}
      <div className="scanner-mode-tabs" role="tablist">
        <button
          aria-selected={mode === 'camera'}
          className={`scanner-mode-tab${mode === 'camera' ? ' is-active' : ''}`}
          onClick={() => setMode('camera')}
          role="tab"
          type="button"
        >
          <Icon name="camera" size={15} />
          <span>Live Camera Scan</span>
        </button>
        <button
          aria-selected={mode === 'file'}
          className={`scanner-mode-tab${mode === 'file' ? ' is-active' : ''}`}
          onClick={() => setMode('file')}
          role="tab"
          type="button"
        >
          <Icon name="image" size={15} />
          <span>Upload Pass Image</span>
        </button>
      </div>

      {mode === 'camera' ? (
        <div className="scanner-camera-view">
          {/* Top Controls Bar */}
          <div className="scanner-top-bar">
            {cameras.length > 1 && (
              <div className="camera-selector">
                <Icon name="refresh" size={13} />
                <select
                  aria-label="Select Camera Device"
                  onChange={(e) => setSelectedCameraId(e.target.value)}
                  value={selectedCameraId}
                >
                  {cameras.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label || `Camera ${c.id.substring(0, 5)}`}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {torchSupported && (
              <button
                className={`torch-btn ${torchOn ? 'is-active' : ''}`}
                onClick={handleToggleTorch}
                title={torchOn ? 'Turn Flashlight Off' : 'Turn Flashlight On'}
                type="button"
              >
                <Icon name="bolt" size={14} />
                <span>{torchOn ? 'Light On' : 'Flashlight'}</span>
              </button>
            )}
            <div className="scanner-live-pill">
              <span className="live-dot" />
              <span>{isScanning ? 'Scanner Active' : 'Starting Camera…'}</span>
            </div>
          </div>

          {/* Camera Viewfinder Frame */}
          <div className="scanner-viewport-container">
            <div className="scanner-viewport" id={elementIdRef.current} ref={scannerRef} />

            {/* Futuristic Targeting Reticles */}
            {isScanning && (
              <div aria-hidden="true" className="scanner-reticle-overlay">
                <div className="reticle-box">
                  <div className="bracket bracket-tl" />
                  <div className="bracket bracket-tr" />
                  <div className="bracket bracket-bl" />
                  <div className="bracket bracket-br" />
                  <div className="laser-sweep" />
                </div>
                <span className="reticle-caption">Align digital pass QR code inside frame</span>
              </div>
            )}

            {/* Error Overlay */}
            {cameraError && (
              <div className="scanner-error-card">
                <Icon name="alert-circle" size={28} />
                <strong>Camera Unavailable</strong>
                <p>{cameraError}</p>
                <button
                  className="button button-secondary button-sm"
                  onClick={() => startScanner(selectedCameraId)}
                  type="button"
                >
                  Retry Camera
                </button>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Image File Dropzone */
        <div className="scanner-file-view">
          <label className="scanner-file-dropzone">
            <input
              accept="image/*"
              className="sr-only"
              onChange={handleFileUpload}
              type="file"
            />
            <div className="dropzone-content">
              <div className="dropzone-icon">
                <Icon name="qr" size={32} />
              </div>
              <strong>Upload Pass Screenshot or Photo</strong>
              <p>Drag & drop or browse image file to scan attendance instantly</p>
              <span className="button button-secondary button-sm">Select Image File</span>
            </div>
          </label>
        </div>
      )}

      {/* Real-time Scan Feedback Overlay */}
      {recentScan && (
        <div
          className={`scanner-result-banner animate-pop ${
            recentScan.ok
              ? recentScan.alreadyCheckedIn
                ? 'is-warning'
                : 'is-success'
              : 'is-error'
          }`}
          role="status"
        >
          <div className="result-icon-col">
            <Icon
              name={
                recentScan.ok
                  ? recentScan.alreadyCheckedIn
                    ? 'clock'
                    : 'check-circle'
                  : 'alert-triangle'
              }
              size={22}
            />
          </div>
          <div className="result-text-col">
            <div className="result-headline">
              <strong>{recentScan.studentName || recentScan.code || 'Attendee'}</strong>
              {recentScan.studentId && <code>{recentScan.studentId}</code>}
              <span className="result-time">{recentScan.timestamp}</span>
            </div>
            <p className="result-message">{recentScan.message}</p>
          </div>
          <button
            aria-label="Dismiss scan result"
            className="result-dismiss-btn"
            onClick={() => setRecentScan(null)}
            type="button"
          >
            ×
          </button>
        </div>
      )}
    </div>
  )
}

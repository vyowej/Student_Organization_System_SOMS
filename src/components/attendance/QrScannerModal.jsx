import { useEffect, useId, useRef, useState } from 'react'
import { Html5Qrcode } from 'html5-qrcode'
import Button from '../ui/Button.jsx'
import Icon from '../ui/Icon.jsx'
import Modal from '../ui/Modal.jsx'

export default function QrScannerModal({ open, onClose, onScan, eventTitle }) {
  const rawId = useId().replace(/:/g, '')
  const cameraNodeId = `unidos-qr-reader-${rawId}`
  const fileNodeId = `unidos-qr-file-${rawId}`
  const scannerRef = useRef(null)
  const onScanRef = useRef(onScan)
  useEffect(() => {
    onScanRef.current = onScan
  }, [onScan])

  const [cameraError, setCameraError] = useState('')
  const [cameraReady, setCameraReady] = useState(false)
  const [fileBusy, setFileBusy] = useState(false)
  const [fileError, setFileError] = useState('')

  useEffect(() => {
    if (!open) return undefined

    let cancelled = false
    let activeInstance = null

    const stopScanner = async (instance) => {
      if (!instance) return
      try {
        if (instance.isScanning) {
          await instance.stop()
        }
      } catch {
        // Ignore stop errors if scanner was already stopped
      }
      try {
        await instance.clear()
      } catch {
        // Ignore clear errors on unmount
      }
    }

    const timer = window.setTimeout(async () => {
      if (cancelled || !document.getElementById(cameraNodeId)) return
      setCameraError('')
      setCameraReady(false)

      try {
        const instance = new Html5Qrcode(cameraNodeId)
        activeInstance = instance
        scannerRef.current = instance
        await instance.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 220, height: 220 } },
          (decodedText) => {
            if (!cancelled && decodedText) {
              stopScanner(instance).then(() => {
                onScanRef.current?.(decodedText)
              })
            }
          },
          () => {}
        )
        if (!cancelled) {
          setCameraReady(true)
        } else {
          stopScanner(instance)
        }
      } catch {
        if (!cancelled) {
          setCameraError('Live camera access is unavailable or permission was denied. Upload a participant Event Pass QR image below instead.')
        }
      }
    }, 80)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
      const instance = activeInstance || scannerRef.current
      scannerRef.current = null
      stopScanner(instance)
      setCameraReady(false)
    }
  }, [open, cameraNodeId])

  const handleFileUpload = async (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    setFileError('')
    setFileBusy(true)
    const fileScanner = new Html5Qrcode(fileNodeId)
    try {
      const decodedText = await fileScanner.scanFile(file, false)
      await fileScanner.clear().catch(() => null)
      onScan?.(decodedText)
    } catch {
      await fileScanner.clear().catch(() => null)
      setFileError('No readable QR code found in this image. Upload a downloaded PNG Event Pass or enter the ID manually.')
    } finally {
      setFileBusy(false)
    }
  }

  return (
    <Modal onClose={onClose} open={open} size="md" title="Scan Participant QR Pass">
      <div className="qr-scanner-modal-body">
        {eventTitle && (
          <p className="qr-scanner-event-subtitle">
            Checking in attendees for <strong>{eventTitle}</strong>
          </p>
        )}

        <div className="qr-scanner-viewport-wrap">
          <div className="qr-scanner-viewport" id={cameraNodeId} />
          {!cameraReady && !cameraError && (
            <div className="qr-scanner-status-overlay">
              <Icon name="camera" size={22} />
              <span>Starting camera scanner…</span>
            </div>
          )}
        </div>

        {cameraError && (
          <p className="qr-scanner-notice" role="status">
            {cameraError}
          </p>
        )}

        <div className="qr-scanner-upload-row">
          <label className="button button-secondary qr-scanner-file-btn">
            <Icon name="upload" size={16} />
            <span>{fileBusy ? 'Scanning image…' : 'Scan from QR Pass Image'}</span>
            <input
              accept="image/*"
              disabled={fileBusy}
              onChange={handleFileUpload}
              type="file"
            />
          </label>
          <Button onClick={onClose} type="button" variant="ghost">
            Close Scanner
          </Button>
        </div>

        {fileError && (
          <p className="auth-error" role="alert">
            {fileError}
          </p>
        )}

        <div aria-hidden="true" className="qr-scanner-hidden-reader" id={fileNodeId} />
      </div>
    </Modal>
  )
}

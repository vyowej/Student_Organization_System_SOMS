/**
 * Shared File Validation & Download Helpers (src/data/fileDownload.js)
 *
 * Centralizes file size guards and data-URL / REST file downloads for
 * Documents, Accomplishment Report Attachments, Event Compliance Files, and CORs.
 */

export const MAX_UPLOAD_FILE_BYTES = 5 * 1024 * 1024

/**
 * Validates an uploaded file size against the API JSON limit.
 */
export function validateUploadFile(file, maxBytes = MAX_UPLOAD_FILE_BYTES) {
  if (!file) return { ok: false, error: 'Please select a file.' }
  if (file.size > maxBytes) {
    const mb = Math.round((maxBytes / (1024 * 1024)) * 10) / 10
    return { ok: false, error: `Choose a file smaller than ${mb} MB.` }
  }
  return { ok: true, error: '' }
}

/**
 * Triggers a browser download for a data URL or HTTP link.
 */
export function triggerFileDownload(href, filename = 'document') {
  if (!href) return false
  const link = document.createElement('a')
  link.href = href
  link.download = filename
  if (/^https?:\/\//i.test(href)) {
    link.target = '_blank'
    link.rel = 'noopener noreferrer'
  }
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  return true
}

/**
 * Fetches file bytes/link from a backend endpoint and initiates a download.
 */
export async function downloadFileFromEndpoint({
  endpoint,
  dataField,
  nameField,
  fallbackUrlField = '',
  fallbackName = 'document',
}) {
  if (!endpoint) return { ok: false, error: 'Missing file endpoint.' }
  try {
    const res = await fetch(endpoint)
    if (!res.ok) {
      return { ok: false, error: 'Unable to retrieve stored file from the database.' }
    }
    const payload = await res.json().catch(() => null)
    const fileData = payload?.[dataField]
    const fileName = payload?.[nameField] || fallbackName
    const externalUrl = fallbackUrlField ? payload?.[fallbackUrlField] : null
    if (fileData) {
      triggerFileDownload(fileData, fileName)
      return { ok: true }
    }
    if (externalUrl && /^https?:\/\//i.test(externalUrl)) {
      triggerFileDownload(externalUrl, fileName)
      return { ok: true }
    }
    return { ok: false, error: 'No downloadable file bytes are attached to this record yet.' }
  } catch {
    return { ok: false, error: 'Network error while downloading file.' }
  }
}

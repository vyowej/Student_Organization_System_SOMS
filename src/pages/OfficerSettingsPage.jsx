import { useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import Badge from '../components/ui/Badge.jsx'
import Button from '../components/ui/Button.jsx'
import Card from '../components/ui/Card.jsx'
import ConfirmDialog from '../components/ui/ConfirmDialog.jsx'
import Modal from '../components/ui/Modal.jsx'
import PageHeader from '../components/layout/PageHeader.jsx'
import { undoAction, useToast } from '../components/ui/useToast.js'

const organizationCategories = ['Academic', 'Socio-Civic', 'Cultural', 'Sports']
const preferenceOptions = [
  ['membershipRequests', 'Membership Requests'],
  ['eventUpdates', 'Event Updates'],
  ['documentUpdates', 'Document Updates'],
  ['adviserApprovalUpdates', 'Adviser Approval Updates'],
  ['studentAnnouncements', 'Student Announcements'],
]

function OrganizationLogo({ acronym, image }) {
  return image
    ? <img alt="Organization logo" className="officer-settings-logo-image" src={image} />
    : <span aria-hidden="true" className="officer-settings-logo-placeholder">{acronym || 'ORG'}</span>
}

function SettingsSection({ children, description, title, variant = '' }) {
  return (
    <Card className={`officer-settings-card ${variant}`.trim()}>
      <div className="officer-settings-section-heading"><div><h2>{title}</h2>{description && <p>{description}</p>}</div></div>
      {children}
    </Card>
  )
}

export default function OfficerSettingsPage() {
  const {
    adminOrganizations,
    captureUndo,
    currentUser,
    adminSettings,
    updateOfficerOrganizationProfile,
    updateOfficerOrganizationContact,
    updateOfficerOrganizationLogo,
    saveOfficerNotificationPreferences,
    submitOfficerOrganizationRequest,
  } = useOutletContext()
  const { showToast } = useToast()
  const organization = adminOrganizations.find((item) => item.id === currentUser?.organizationId)
  const [organizationForm, setOrganizationForm] = useState(null)
  const [contactForm, setContactForm] = useState(null)
  const [logoOpen, setLogoOpen] = useState(false)
  const [removeLogoOpen, setRemoveLogoOpen] = useState(false)
  const [pendingLogo, setPendingLogo] = useState('')
  const [logoError, setLogoError] = useState('')
  const [requestType, setRequestType] = useState('')
  const [requestReason, setRequestReason] = useState('')
  const [requestError, setRequestError] = useState('')
  const [preferences, setPreferences] = useState(null)
  const [organizationError, setOrganizationError] = useState('')
  const [contactError, setContactError] = useState('')
  const [saveConfirm, setSaveConfirm] = useState('')
  const [discardConfirm, setDiscardConfirm] = useState('')

  if (!organization) {
    return (
      <>
        <PageHeader title="Organization Settings" description="Manage your organization's information, preferences, and account settings." eyebrow="ORGANIZATION MANAGEMENT" />
        <Card className="officer-settings-card"><p>Your officer account does not have an assigned organization to configure.</p></Card>
      </>
    )
  }

  const savedOrganizationForm = {
    name: organization.name ?? '',
    acronym: organization.acronym ?? '',
    category: organization.category ?? '',
    mission: organization.mission ?? '',
    vision: organization.vision ?? '',
  }
  const savedContactForm = {
    officialEmail: organization.officialEmail ?? '',
    contactNumber: organization.contactNumber ?? '',
    socialMedia: organization.socialMedia ?? '',
  }
  const savedPreferences = organization.notificationPreferences ?? {
    membershipRequests: true,
    eventUpdates: true,
    documentUpdates: true,
    adviserApprovalUpdates: true,
    studentAnnouncements: true,
  }

  function changeOrganizationField(key, value) {
    setOrganizationForm((current) => ({ ...(current ?? savedOrganizationForm), [key]: value }))
  }

  function changeContactField(key, value) {
    setContactForm((current) => ({ ...(current ?? savedContactForm), [key]: value }))
  }

  function saveOrganization(event, confirmed = false) {
    event.preventDefault()
    const values = organizationForm ?? savedOrganizationForm
    if (Object.values(values).some((value) => !value.trim())) {
      setOrganizationError('Organization name, acronym, category, mission, and vision are required.')
      return
    }
    if (!confirmed) { setOrganizationError(''); setSaveConfirm('organization'); return }
    setSaveConfirm('')
    const undo = captureUndo()
    if (!updateOfficerOrganizationProfile(values)) {
      setOrganizationError('Unable to save organization information. Verify your officer access and try again.')
      return
    }
    setOrganizationForm(null)
    setOrganizationError('')
    showToast('Organization information saved.', 'success', undoAction(undo))
  }

  function saveContact(event, confirmed = false) {
    event.preventDefault()
    const values = contactForm ?? savedContactForm
    if (values.officialEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.officialEmail)) {
      setContactError('Enter a valid official email address.')
      return
    }
    if (values.contactNumber && !/^[+()\d\s.-]{7,20}$/.test(values.contactNumber)) {
      setContactError('Enter a valid contact number.')
      return
    }
    if (values.socialMedia && !/^(https?:\/\/|www\.)\S+$/i.test(values.socialMedia)) {
      setContactError('Enter a valid page URL beginning with https:// or www.')
      return
    }
    if (!confirmed) { setContactError(''); setSaveConfirm('contact'); return }
    setSaveConfirm('')
    const undo = captureUndo()
    if (!updateOfficerOrganizationContact(values)) {
      setContactError('Unable to save contact information. Try again.')
      return
    }
    setContactForm(null)
    setContactError('')
    showToast('Organization contact information saved.', 'success', undoAction(undo))
  }

  function savePreferences() {
    const values = preferences ?? savedPreferences
    const undo = captureUndo()
    if (!saveOfficerNotificationPreferences(values)) {
      showToast('Unable to save notification preferences.', 'error')
      return
    }
    setPreferences(null)
    showToast('Notification preferences updated.', 'success', undoAction(undo))
  }

  function chooseLogo(event) {
    const file = event.target.files?.[0]
    if (!file) return
    setLogoError('')
    if (!file.type.startsWith('image/')) {
      setLogoError('Choose an image file.')
      event.target.value = ''
      return
    }
    if (file.size > 1_500_000) {
      setLogoError('Choose an image smaller than 1.5 MB.')
      event.target.value = ''
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') setPendingLogo(reader.result)
      else setLogoError('Unable to preview this image. Choose another file.')
    }
    reader.onerror = () => setLogoError('Unable to read this image. Choose another file.')
    reader.readAsDataURL(file)
  }

  function commitLogo() {
    const undo = captureUndo()
    if (!pendingLogo || !updateOfficerOrganizationLogo(pendingLogo)) {
      setLogoError('Unable to save the logo. Choose another image and try again.')
      return
    }
    setLogoOpen(false)
    setPendingLogo('')
    showToast('Organization logo updated.', 'success', undoAction(undo))
  }

  function removeLogo() {
    const undo = captureUndo()
    setRemoveLogoOpen(false)
    if (!updateOfficerOrganizationLogo(null)) {
      showToast('Unable to remove the organization logo.', 'error')
      return
    }
    showToast('Organization logo removed.', 'success', undoAction(undo))
  }

  function submitRequest(event) {
    event.preventDefault()
    if (!requestReason.trim()) {
      setRequestError('A reason is required to submit this request.')
      return
    }
    const undo = captureUndo()
    if (!submitOfficerOrganizationRequest(requestType, requestReason)) {
      setRequestError('Unable to submit the request. Please try again.')
      return
    }
    setRequestType('')
    setRequestReason('')
    setRequestError('')
    showToast(requestType === 'ADVISER_CHANGE'
      ? 'Adviser change request submitted for Student Affairs review.'
      : 'Organization deactivation request submitted for Student Affairs review.', 'success', undoAction(undo))
  }

  const statusTone = organization.status === 'ACTIVE' ? 'success'
    : organization.status === 'PENDING' ? 'warning'
      : organization.status === 'SUSPENDED' ? 'danger'
        : 'neutral'

  return (
    <div className="officer-settings-page">
      <PageHeader
        description="Manage your organization's information, preferences, and account settings."
        eyebrow="ORGANIZATION MANAGEMENT"
        title="Organization Settings"
      />

      <SettingsSection title="Organization Information" description="Update the public profile shared across UNIDOS.">
        <form className="officer-settings-form" onSubmit={saveOrganization}>
          <div className="officer-settings-field-grid">
            <label>Official Organization Name<input onChange={(event) => changeOrganizationField('name', event.target.value)} required value={(organizationForm ?? savedOrganizationForm).name} /></label>
            <label>Acronym<input onChange={(event) => changeOrganizationField('acronym', event.target.value)} required value={(organizationForm ?? savedOrganizationForm).acronym} /></label>
            <label>Organization Category<select onChange={(event) => changeOrganizationField('category', event.target.value)} required value={(organizationForm ?? savedOrganizationForm).category}>{[...new Set([...organizationCategories, savedOrganizationForm.category])].map((category) => <option key={category}>{category}</option>)}</select></label>
            <label className="officer-settings-wide">Mission<textarea onChange={(event) => changeOrganizationField('mission', event.target.value)} required rows="3" value={(organizationForm ?? savedOrganizationForm).mission} /></label>
            <label className="officer-settings-wide">Vision<textarea onChange={(event) => changeOrganizationField('vision', event.target.value)} required rows="3" value={(organizationForm ?? savedOrganizationForm).vision} /></label>
          </div>
          {organizationError && <p className="auth-error" role="alert">{organizationError}</p>}
          <div className="officer-settings-actions">
            <Button onClick={() => { setOrganizationForm({ ...savedOrganizationForm }); setOrganizationError('') }} type="button" variant="ghost">Reset</Button>
            <Button onClick={() => (organizationForm ? setDiscardConfirm('organization') : setOrganizationError(''))} type="button" variant="secondary">Cancel</Button>
            <Button type="submit">Save Changes</Button>
          </div>
        </form>
      </SettingsSection>

      <div className="officer-settings-two-column">
        <SettingsSection title="Organization Logo" description="Upload a square image to represent your organization.">
          <div className="officer-settings-logo-row">
            <div className="officer-settings-logo-frame"><OrganizationLogo acronym={organization.acronym} image={organization.logo} /></div>
            <div className="officer-settings-logo-copy">
              {organization.logo ? <><strong>Current organization logo</strong><span>Displayed in organization spaces across UNIDOS.</span></> : <><strong>No organization logo uploaded.</strong><span>The acronym mark is shown until an image is uploaded.</span></>}
              <div className="officer-settings-actions">
                <Button onClick={() => { setPendingLogo(''); setLogoError(''); setLogoOpen(true) }} variant="secondary">Upload Logo</Button>
                {organization.logo && <Button onClick={() => setRemoveLogoOpen(true)} variant="danger">Remove Logo</Button>}
              </div>
            </div>
          </div>
        </SettingsSection>

        <SettingsSection title="Faculty Adviser" description="The assigned adviser is managed by Student Affairs.">
          <div className="officer-settings-adviser">
            <span aria-hidden="true" className="officer-settings-adviser-avatar">{organization.adviser?.slice(0, 1) ?? 'A'}</span>
            <div><strong>{organization.adviser || 'No adviser assigned'}</strong><span>Assigned Faculty Adviser</span></div>
            <Badge tone={organization.adviser ? 'success' : 'warning'}>{organization.adviser ? organization.adviserStatus ?? 'ACTIVE' : 'UNASSIGNED'}</Badge>
          </div>
          <Button onClick={() => { setRequestType('ADVISER_CHANGE'); setRequestReason(''); setRequestError('') }} variant="secondary">Request Adviser Change</Button>
        </SettingsSection>
      </div>

      <SettingsSection title="Organization Status" description="Official status changes are handled by Student Affairs.">
        <div className="officer-settings-status-grid">
          <div><span>Current Status</span><Badge tone={statusTone}>{organization.status ?? 'PENDING'}</Badge></div>
          <div><span>Accreditation Status</span><Badge tone={organization.accreditationStatus === 'ACCREDITED' ? 'success' : 'warning'}>{organization.accreditationStatus ?? 'PENDING'}</Badge></div>
          <div><span>Academic Year</span><strong>{adminSettings?.academicYear ?? 'Not set'}</strong></div>
        </div>
        {['SUSPENDED', 'INACTIVE'].includes(organization.status) && <p className="officer-settings-status-notice" role="status">{organization.suspensionReason || 'This organization is not currently active. Contact Student Affairs for more information.'}</p>}
      </SettingsSection>

      <SettingsSection title="Organization Contact Information" description="Keep official contact details available to your members.">
        <form className="officer-settings-form" onSubmit={saveContact}>
          <div className="officer-settings-field-grid">
            <label>Official Email<input autoComplete="email" onChange={(event) => changeContactField('officialEmail', event.target.value)} type="email" value={(contactForm ?? savedContactForm).officialEmail} /></label>
            <label>Contact Number<input autoComplete="tel" onChange={(event) => changeContactField('contactNumber', event.target.value)} type="tel" value={(contactForm ?? savedContactForm).contactNumber} /></label>
            <label className="officer-settings-wide">Official Social Media / Page<input onChange={(event) => changeContactField('socialMedia', event.target.value)} placeholder="https://..." type="url" value={(contactForm ?? savedContactForm).socialMedia} /></label>
          </div>
          {contactError && <p className="auth-error" role="alert">{contactError}</p>}
          <div className="officer-settings-actions">
            <Button onClick={() => { setContactForm({ ...savedContactForm }); setContactError('') }} type="button" variant="ghost">Reset</Button>
            <Button onClick={() => (contactForm ? setDiscardConfirm('contact') : setContactError(''))} type="button" variant="secondary">Cancel</Button>
            <Button type="submit">Save Changes</Button>
          </div>
        </form>
      </SettingsSection>

      <SettingsSection title="Notification Preferences" description="Choose which organization updates should generate notifications.">
        <div className="officer-settings-preferences">
          {preferenceOptions.map(([key, label]) => {
            const selected = (preferences ?? savedPreferences)[key]
            return <label className="officer-settings-preference" key={key}><span>{label}</span><span className={`officer-settings-toggle${selected ? ' is-on' : ''}`}><span>{selected ? 'ON' : 'OFF'}</span><input aria-label={label} checked={selected} onChange={(event) => setPreferences((current) => ({ ...(current ?? savedPreferences), [key]: event.target.checked }))} type="checkbox" /></span></label>
          })}
        </div>
        <div className="officer-settings-actions"><Button onClick={() => setPreferences({ ...savedPreferences })} variant="ghost">Reset</Button><Button onClick={() => (preferences ? setDiscardConfirm('preferences') : null)} variant="secondary">Cancel</Button><Button onClick={savePreferences}>Save Preferences</Button></div>
      </SettingsSection>

      <SettingsSection title="Organization Access / Permissions" description="Access is assigned by the system and cannot be changed here.">
        <div className="officer-settings-access-role"><span aria-hidden="true">♙</span><div><strong>Organization Officer</strong><small>{currentUser?.organizationId === organization.id ? organization.name : ''}</small></div><Badge tone="crimson">ROLE</Badge></div>
        <ul className="officer-settings-permission-list">
          {['Manage Members', 'Review Membership Requests', 'Create Events', 'Manage Announcements', 'Submit Documents', 'View Organization Reports'].map((permission) => <li key={permission}><span aria-hidden="true">✓</span>{permission}</li>)}
        </ul>
        <p className="officer-settings-help">System roles and official organization permissions are managed by Student Affairs.</p>
      </SettingsSection>

      <SettingsSection title="Danger Zone" description="Organization deactivation requires an approval decision from Student Affairs." variant="officer-settings-danger">
        <div className="officer-settings-danger-row"><div><strong>Request Organization Deactivation</strong><span>This submits a request for review. Your organization will not be deactivated immediately.</span></div><Button onClick={() => { setRequestType('DEACTIVATION'); setRequestReason(''); setRequestError('') }} variant="danger">Request Deactivation</Button></div>
      </SettingsSection>

      <Modal onClose={() => { setLogoOpen(false); setPendingLogo(''); setLogoError('') }} open={logoOpen} title="Upload Organization Logo">
        <div className="officer-settings-logo-upload">
          <div className="officer-settings-logo-frame"><OrganizationLogo acronym={organization.acronym} image={pendingLogo || organization.logo} /></div>
          <label className="officer-settings-file-label">Choose image<input accept="image/*" onChange={chooseLogo} type="file" /></label>
          <small>Select an image file up to 1.5 MB. Your existing logo stays in place unless you save the replacement.</small>
        </div>
        {logoError && <p className="auth-error" role="alert">{logoError}</p>}
        <div className="officer-settings-actions"><Button onClick={() => { setLogoOpen(false); setPendingLogo(''); setLogoError('') }} variant="secondary">Cancel</Button><Button disabled={!pendingLogo} onClick={commitLogo}>Save Logo</Button></div>
      </Modal>

      <Modal onClose={() => { setRequestType(''); setRequestReason(''); setRequestError('') }} open={Boolean(requestType)} title={requestType === 'ADVISER_CHANGE' ? 'Request Adviser Change' : 'Request Organization Deactivation'}>
        <form className="officer-settings-request-form" onSubmit={submitRequest}>
          <p>{requestType === 'ADVISER_CHANGE'
            ? 'Changing the assigned faculty adviser requires Student Affairs/Admin approval. This request will not change your adviser immediately.'
            : 'Organization deactivation requires Student Affairs/Admin approval. Submitting this request will not immediately deactivate or delete your organization.'}</p>
          <label>Reason for request<textarea onChange={(event) => setRequestReason(event.target.value)} required rows="5" value={requestReason} /></label>
          {requestError && <p className="auth-error" role="alert">{requestError}</p>}
          <div className="officer-settings-actions"><Button onClick={() => { setRequestType(''); setRequestReason(''); setRequestError('') }} type="button" variant="secondary">Cancel</Button><Button type="submit">Submit Request</Button></div>
        </form>
      </Modal>
      <ConfirmDialog
        confirmLabel="Save changes"
        message={saveConfirm === 'contact'
          ? 'Are you sure you want to save these changes to your organization’s contact information?'
          : 'Are you sure you want to save these changes to your organization’s official information? Students will see the updated details.'}
        onCancel={() => setSaveConfirm('')}
        onConfirm={() => (saveConfirm === 'contact' ? saveContact({ preventDefault() {} }, true) : saveOrganization({ preventDefault() {} }, true))}
        open={Boolean(saveConfirm)}
        title="Save changes?"
      />
      <ConfirmDialog
        cancelLabel="Keep editing"
        confirmLabel="Discard changes"
        message="You have unsaved changes. Are you sure you want to discard them?"
        onCancel={() => setDiscardConfirm('')}
        onConfirm={() => {
          if (discardConfirm === 'organization') { setOrganizationForm(null); setOrganizationError('') }
          if (discardConfirm === 'contact') { setContactForm(null); setContactError('') }
          if (discardConfirm === 'preferences') { setPreferences(null) }
          setDiscardConfirm('')
          showToast('Unsaved changes discarded.', 'info')
        }}
        open={Boolean(discardConfirm)}
        tone="danger"
        title="Discard unsaved changes?"
      />
      <ConfirmDialog
        confirmLabel="Remove logo"
        message="Are you sure you want to remove the organization logo? Your acronym will be shown instead."
        onCancel={() => setRemoveLogoOpen(false)}
        onConfirm={removeLogo}
        open={removeLogoOpen}
        title="Remove organization logo"
        tone="danger"
      />
    </div>
  )
}

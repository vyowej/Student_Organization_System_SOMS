import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import Card from '../components/ui/Card.jsx'
import Input from '../components/ui/Input.jsx'
import Button from '../components/ui/Button.jsx'
import SearchableSelect from '../components/ui/SearchableSelect.jsx'
import { useToast } from '../components/ui/useToast.js'
import { useAuth } from '../context/useAuth.js'
import { usePortalData } from '../context/usePortalData.js'
import { dashboardByRole } from '../data/navigation.js'
import { isValidEmail, isWmsuEmail } from '../data/displayName.js'
import {
  OFFICER_HIERARCHY,
  ORGANIZATION_COMMITTEES,
  YEAR_LEVEL_OPTIONS,
  getHierarchyEntry,
  readFileAsDataUrl,
  sanitizeNumericStudentId,
} from '../data/officerHierarchy.js'
import WmsuLogo from '../components/ui/WmsuLogo.jsx'
import Icon from '../components/ui/Icon.jsx'
import LandingPage from './LandingPage.jsx'

const FACULTY_ADVISER_SEEDS = [
  {
    name: 'Engr. Marjorie A. Rojas',
    college: 'Coordinator · CCS',
    org: 'Adviser Coordinator / CSC – CCS',
    email: 'marjorie.rojas@wmsu.edu.ph',
  },
  {
    name: 'Mr. Guiller Ellomer',
    college: 'CFES',
    org: 'Agroforestry Org / CSC - CFES',
    email: 'guiller.ellomer@wmsu.edu.ph',
  },
  {
    name: 'Mr. Reinier Rosaldo',
    college: 'CCJE',
    org: 'College Student Council – CCJE',
    email: 'reinier.rosaldo@wmsu.edu.ph',
  },
  {
    name: 'Asso. Prof. Eric Roland Natividad',
    college: 'CTE',
    org: 'College Student Council – CTE',
    email: 'ericroland.natividad@wmsu.edu.ph',
  },
  {
    name: 'Default Adviser Alias',
    college: 'CCS',
    org: 'CSC – CCS (Quick Login)',
    email: 'adviser@wmsu.edu.ph',
  },
]

function PasswordVisibilityIcon({ visible }) {
  return <Icon name={visible ? 'eye-off' : 'eye'} size={20} />
}

function AuthenticationPage({ page }) {
  const { login, registerOfficer } = useAuth()
  const { academicPrograms = [], studentOrganizations = [], refreshPortalData } = usePortalData()
  const { showToast } = useToast()
  const navigate = useNavigate()
  const location = useLocation()
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [showLoginPassword, setShowLoginPassword] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [registrationStep, setRegistrationStep] = useState(1)
  const [form, setForm] = useState({
    lastName: '',
    firstName: '',
    middleName: '',
    suffix: '',
    studentId: '',
    email: '',
    password: '',
    confirmPassword: '',
    program: '',
    programId: '',
    yearLevel: '1st Year',
    organizationId: '',
    position: 'OTHER_OFFICER',
    committee: 'Programs & Events Committee',
    corFileName: '',
    corFileData: null,
  })

  async function handleLogin(event) {
    event.preventDefault()
    setError('')
    setSuccess('')
    const trimmedId = identifier.trim()
    if (!trimmedId || !password) {
      setError('Enter your email address (or Employee / Student ID) and password.')
      return
    }
    if (trimmedId.includes('@') && !isValidEmail(trimmedId)) {
      setError('Enter a valid email address.')
      return
    }
    setSubmitting(true)
    const result = await login(trimmedId, password, rememberMe)
    setSubmitting(false)
    if (!result.ok) {
      setError(result.error)
      return
    }
    await refreshPortalData()
    showToast('Signed in successfully.', 'success')
    const hasOrgWorkspace =
      (result.user?.organizationRoles && result.user.organizationRoles.length > 0) ||
      Boolean(result.user?.organizationId)
    const targetDashboard =
      result.user?.role === 'OFFICER' && !hasOrgWorkspace
        ? '/organizations'
        : dashboardByRole[result.user?.role] || '/officer/dashboard'
    navigate(result.redirectTo || targetDashboard, { replace: true })
  }

  async function handleCorFileChange(event) {
    const file = event.target.files?.[0]
    if (!file) {
      setForm((current) => ({ ...current, corFileName: '', corFileData: null }))
      return
    }
    try {
      const dataUrl = await readFileAsDataUrl(file)
      setForm((current) => ({
        ...current,
        corFileName: file.name,
        corFileData: dataUrl,
      }))
      setError('')
    } catch {
      setError('Unable to read the selected Certificate of Registration (COR) file.')
    }
  }

  function validateRegistrationStep(step) {
    setError('')
    setSuccess('')
    if (step === 1) {
      if ([form.lastName, form.firstName, form.studentId, form.email].some((value) => !String(value).trim())) {
        setError('Complete all required personal and numeric Student ID fields to continue.')
        return false
      }
      if (!/^\d+$/.test(String(form.studentId).trim())) {
        setError('Student ID must contain numeric digits only (0–9).')
        return false
      }
      if (!isValidEmail(form.email)) {
        setError('Enter a valid email address.')
        return false
      }
      return true
    }
    if ([form.password, form.confirmPassword, form.program, form.yearLevel].some((value) => !String(value).trim())) {
      setError('Complete Course / Program, Year Level, and password fields.')
      return false
    }
    if (!form.corFileName) {
      setError('Please upload your Certificate of Registration (COR) before submitting.')
      return false
    }
    if (form.password.length < 6) {
      setError('Use a password with at least 6 characters.')
      return false
    }
    if (form.password !== form.confirmPassword) {
      setError('The password confirmation does not match.')
      return false
    }
    return true
  }

  async function handleRegister(event) {
    event.preventDefault()
    if (registrationStep === 1) {
      if (validateRegistrationStep(1)) setRegistrationStep(2)
      return
    }
    if (!validateRegistrationStep(registrationStep)) return
    setSubmitting(true)
    const matchedProg = academicPrograms.find(
      (p) =>
        p.name === form.program ||
        p.acronym === form.program ||
        String(p.id) === String(form.programId)
    )
    const result = await registerOfficer({
      first_name: form.firstName.trim(),
      middle_name: form.middleName.trim(),
      last_name: form.lastName.trim(),
      suffix: form.suffix.trim(),
      student_number: sanitizeNumericStudentId(form.studentId),
      email: form.email.trim(),
      password: form.password,
      program: form.program,
      program_id: matchedProg?.id ?? null,
      year_level: form.yearLevel,
      organization_id: form.organizationId ? Number(form.organizationId) : null,
      position: form.position,
      committee: form.committee,
      cor_file_name: form.corFileName,
      cor_file_data: form.corFileData,
      require_cor: true,
    })
    setSubmitting(false)
    if (!result.ok) {
      setError(result.error)
      return
    }
    await refreshPortalData()
    showToast('Officer account created with Certificate of Registration (COR) on file.', 'success')
    navigate(result.user?.organizationId ? '/officer/dashboard' : '/organizations', { replace: true })
  }

  const titles = {
    login: ['Welcome back', 'Sign in to access your Admin, Faculty Adviser, or Organization Officer portal.'],
    register: ['Officer Registration', 'Register as an organization officer and upload your Certificate of Registration (COR).'],
    'forgot-password': ['Reset your password', 'Enter your WMSU email address to continue.'],
  }
  const [title, description] = titles[page]

  return (
    <div className="auth-layout">
      <aside className="auth-feature-panel">
        <Link aria-label="UNIDOS home" className="auth-feature-brand" to="/">
          <WmsuLogo className="brand-seal" />
          <span><strong>UNIDOS</strong><small>WMSU Organization Governance</small></span>
        </Link>
        <div className="auth-feature-copy">
          <span className="landing-eyebrow">One campus. Unified governance.</span>
          <h2>Lead with clarity.<br /><em>Serve your campus.</em></h2>
          <p>Centralized workspace for Organization Officers, Faculty Advisers, Coordinators, and Student Affairs Administrators.</p>
        </div>
        <div aria-hidden="true" className="auth-device-preview">
          <div className="auth-mini-laptop">
            <div><span>UNIDOS</span><b>Campus, connected.</b><i /><i /><i /></div>
          </div>
          <div className="auth-mini-phone"><span>UNIDOS</span><b>Lead an organization</b><i /><i /></div>
        </div>
        <span className="auth-feature-foot">Western Mindanao State University</span>
      </aside>

      <Card className={`auth-card auth-card-${page}`}>
        <div className="auth-brand">
          <WmsuLogo className="brand-seal" />
          <div><strong>UNIDOS</strong><span>Student Organization Management System</span></div>
        </div>
        <h1>{title}</h1>
        <p>{description}</p>
        {page === 'login' && location.state?.registered && (
          <p className="auth-success" role="status">Account created successfully. Sign in with your new account.</p>
        )}

        {page === 'login' && (
          <form className="auth-form" noValidate onSubmit={handleLogin}>
            <Input
              autoComplete="username"
              id="login-identifier"
              label="WMSU Email, Employee ID, or Numeric Student ID"
              onChange={(event) => setIdentifier(event.target.value)}
              placeholder="name@wmsu.edu.ph or numeric ID"
              type="text"
              value={identifier}
            />
            <div className="auth-password-field">
              <Input
                autoComplete="current-password"
                id="login-password"
                label="Password"
                onChange={(event) => setPassword(event.target.value)}
                type={showLoginPassword ? 'text' : 'password'}
                value={password}
              />
              <button
                aria-label={showLoginPassword ? 'Hide password' : 'Show password'}
                aria-pressed={showLoginPassword}
                className="auth-show-password"
                onClick={() => setShowLoginPassword((visible) => !visible)}
                type="button"
              >
                <PasswordVisibilityIcon visible={showLoginPassword} />
              </button>
            </div>
            <div className="auth-login-options">
              <label>
                <input checked={rememberMe} onChange={(event) => setRememberMe(event.target.checked)} type="checkbox" /> Remember me
              </label>
              <Link to="/forgot-password">Forgot Password?</Link>
            </div>
            {error && <p className="auth-error" role="alert">{error}</p>}
            <Button className="auth-submit" disabled={submitting} type="submit">
              {submitting ? 'Signing in...' : 'Login'}
            </Button>
          </form>
        )}

        {page === 'login' && (
          <div className="auth-adviser-seeds">
            <div className="auth-adviser-seeds-header">
              <div className="auth-adviser-seeds-title">
                <Icon name="shield" size={15} />
                <span>Prepared Faculty Adviser & Coordinator Access</span>
              </div>
              <span className="auth-adviser-seeds-pwd">
                Password: <strong>adviser123</strong>
              </span>
            </div>
            <p className="auth-adviser-seeds-hint">
              Click any prepared faculty adviser or Coordinator Ma&apos;am Marj below to autofill credentials:
            </p>
            <div className="auth-adviser-seed-grid">
              {FACULTY_ADVISER_SEEDS.map((seed) => (
                <button
                  className="auth-adviser-chip"
                  key={seed.email}
                  onClick={() => {
                    setIdentifier(seed.email)
                    setPassword('adviser123')
                    setError('')
                  }}
                  title={`Autofill ${seed.name} (${seed.email})`}
                  type="button"
                >
                  <div className="auth-adviser-chip-top">
                    <span className="auth-adviser-chip-name">{seed.name}</span>
                    <span className="auth-adviser-chip-college">{seed.college}</span>
                  </div>
                  <div className="auth-adviser-chip-org">{seed.org}</div>
                  <div className="auth-adviser-chip-email">{seed.email}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {page === 'register' && (
          <form className="auth-form auth-register-form" noValidate onSubmit={handleRegister}>
            <div aria-label={`Registration step ${registrationStep} of 2`} className="auth-registration-progress">
              <span aria-current={registrationStep === 1 ? 'step' : undefined} className={registrationStep === 1 ? 'is-current' : 'is-complete'}>
                <b aria-hidden="true">{registrationStep === 1 ? '1' : <Icon name="check" size={12} strokeWidth={3} />}</b>
                <span>Officer details</span>
              </span>
              <i aria-hidden="true" className={registrationStep === 2 ? 'is-complete' : ''} />
              <span aria-current={registrationStep === 2 ? 'step' : undefined} className={registrationStep === 2 ? 'is-current' : ''}>
                <b aria-hidden="true">2</b>
                <span>Academic &amp; COR</span>
              </span>
            </div>

            {registrationStep === 1 ? (
              <>
                <Input
                  autoComplete="given-name"
                  id="register-first-name"
                  label="First Name *"
                  onChange={(event) => setForm((current) => ({ ...current, firstName: event.target.value }))}
                  value={form.firstName}
                />
                <Input
                  autoComplete="additional-name"
                  id="register-middle-name"
                  label="Middle Name (optional)"
                  onChange={(event) => setForm((current) => ({ ...current, middleName: event.target.value }))}
                  value={form.middleName}
                />
                <Input
                  autoComplete="family-name"
                  id="register-last-name"
                  label="Last Name *"
                  onChange={(event) => setForm((current) => ({ ...current, lastName: event.target.value }))}
                  value={form.lastName}
                />
                <Input
                  autoComplete="honorific-suffix"
                  id="register-suffix"
                  label="Suffix (optional)"
                  onChange={(event) => setForm((current) => ({ ...current, suffix: event.target.value }))}
                  placeholder="e.g., Jr., Sr., III"
                  value={form.suffix}
                />
                <Input
                  autoComplete="off"
                  fieldClassName="auth-field-full"
                  id="register-student-id"
                  inputMode="numeric"
                  label="Student ID (Digits Only) *"
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      studentId: sanitizeNumericStudentId(event.target.value),
                    }))
                  }
                  onPaste={(event) => {
                    event.preventDefault()
                    const pasted = event.clipboardData?.getData('text') || ''
                    setForm((current) => ({
                      ...current,
                      studentId: sanitizeNumericStudentId(pasted),
                    }))
                  }}
                  pattern="[0-9]*"
                  placeholder="e.g., 202400123"
                  value={form.studentId}
                />
                <Input
                  aria-describedby="register-email-hint"
                  autoComplete="email"
                  fieldClassName="auth-field-full"
                  id="register-email"
                  label="WMSU Email *"
                  onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                  placeholder="name@wmsu.edu.ph"
                  type="email"
                  value={form.email}
                />
                <p className="auth-registration-hint" id="register-email-hint">
                  Student ID strictly accepts numeric digits (0–9). Use your official @wmsu.edu.ph email.
                </p>
              </>
            ) : (
              <>
                <div className="form-field auth-field-full">
                  <label className="admin-field-label" htmlFor="register-program">
                    Course / Program <span className="required-asterisk">*</span>
                  </label>
                  <SearchableSelect
                    id="register-program"
                    onChange={(selectedValue) =>
                      setForm((current) => ({ ...current, program: selectedValue }))
                    }
                    options={academicPrograms}
                    placeholder="Type to search course or program (e.g., BSCS, Nursing)…"
                    required
                    value={form.program}
                  />
                </div>

                <label className="form-field" htmlFor="register-year-level">
                  <span>Year Level <span className="required-asterisk">*</span></span>
                  <select
                    id="register-year-level"
                    onChange={(event) => setForm((current) => ({ ...current, yearLevel: event.target.value }))}
                    value={form.yearLevel}
                  >
                    {YEAR_LEVEL_OPTIONS.map((year) => (
                      <option key={year} value={year}>{year}</option>
                    ))}
                  </select>
                </label>

                <label className="form-field" htmlFor="register-org">
                  <span>Target Organization (optional)</span>
                  <select
                    id="register-org"
                    onChange={(event) => setForm((current) => ({ ...current, organizationId: event.target.value }))}
                    value={form.organizationId}
                  >
                    <option value="">Select organization…</option>
                    {studentOrganizations.map((org) => (
                      <option key={org.id} value={org.id}>
                        {org.acronym ? `${org.acronym} — ${org.name}` : org.name}
                      </option>
                    ))}
                  </select>
                </label>

                {form.organizationId && (
                  <>
                    <label className="form-field" htmlFor="register-position">
                      <span>Desired Officer Role</span>
                      <select
                        id="register-position"
                        onChange={(event) => {
                          const code = event.target.value
                          const entry = getHierarchyEntry(code)
                          setForm((current) => ({
                            ...current,
                            position: code,
                            committee: entry.defaultCommittee,
                          }))
                        }}
                        value={form.position}
                      >
                        {OFFICER_HIERARCHY.map((role) => (
                          <option key={role.code} value={role.code}>
                            Rank {role.rank}: {role.title}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="form-field" htmlFor="register-committee">
                      <span>Assigned Committee</span>
                      <select
                        id="register-committee"
                        onChange={(event) => setForm((current) => ({ ...current, committee: event.target.value }))}
                        value={form.committee}
                      >
                        {ORGANIZATION_COMMITTEES.map((committee) => (
                          <option key={committee} value={committee}>{committee}</option>
                        ))}
                      </select>
                    </label>
                  </>
                )}

                <div className="form-field auth-field-full">
                  <label className="admin-field-label" htmlFor="register-cor-upload">
                    Certificate of Registration (COR) <span className="required-asterisk">*</span>
                  </label>
                  <input
                    accept=".pdf,.jpg,.jpeg,.png"
                    className="input"
                    id="register-cor-upload"
                    onChange={handleCorFileChange}
                    required
                    type="file"
                  />
                  {form.corFileName ? (
                    <small className="file-upload-selected">
                      Attached COR: <strong>{form.corFileName}</strong>
                    </small>
                  ) : (
                    <small className="auth-registration-hint">
                      Required: Upload your current semester COR (PDF, JPG, or PNG).
                    </small>
                  )}
                </div>

                <div className="auth-password-field">
                  <Input
                    autoComplete="new-password"
                    id="register-password"
                    label="Password *"
                    onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
                    type={showPassword ? 'text' : 'password'}
                    value={form.password}
                  />
                  <button
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    aria-pressed={showPassword}
                    className="auth-show-password"
                    onClick={() => setShowPassword((visible) => !visible)}
                    type="button"
                  >
                    <PasswordVisibilityIcon visible={showPassword} />
                  </button>
                </div>
                <div className="auth-password-field">
                  <Input
                    autoComplete="new-password"
                    id="register-confirm-password"
                    label="Confirm Password *"
                    onChange={(event) => setForm((current) => ({ ...current, confirmPassword: event.target.value }))}
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={form.confirmPassword}
                  />
                  <button
                    aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                    aria-pressed={showConfirmPassword}
                    className="auth-show-password"
                    onClick={() => setShowConfirmPassword((visible) => !visible)}
                    type="button"
                  >
                    <PasswordVisibilityIcon visible={showConfirmPassword} />
                  </button>
                </div>
              </>
            )}

            {error && <p className="auth-error" role="alert">{error}</p>}
            <div className="auth-registration-actions">
              {registrationStep === 2 && (
                <Button onClick={() => { setError(''); setRegistrationStep(1) }} variant="secondary">
                  Back
                </Button>
              )}
              {registrationStep === 1 ? (
                <Button className="auth-submit" type="submit">Continue</Button>
              ) : (
                <Button className="auth-submit" disabled={submitting} type="submit">
                  {submitting ? 'Creating Officer Account...' : 'Create Officer Account'}
                </Button>
              )}
            </div>
          </form>
        )}

        {page === 'forgot-password' && (
          <form
            className="auth-form"
            noValidate
            onSubmit={(event) => {
              event.preventDefault()
              if (!isWmsuEmail(identifier)) {
                setError('Enter your WMSU email address ending in @wmsu.edu.ph.')
                setSuccess('')
                return
              }
              setError('')
              setSuccess('If this account exists, password reset instructions would be sent.')
            }}
          >
            <Input
              autoComplete="username"
              id="reset-identifier"
              label="WMSU Email"
              onChange={(event) => setIdentifier(event.target.value)}
              placeholder="name@wmsu.edu.ph"
              type="email"
              value={identifier}
            />
            {error && <p className="auth-error" role="alert">{error}</p>}
            {success && <p className="auth-success" role="status">{success}</p>}
            <Button className="auth-submit" type="submit">Reset Password</Button>
          </form>
        )}

        <p className="auth-note">
          {page === 'login' ? (
            <>Registering as an organization officer? <Link to="/register">Officer Registration</Link></>
          ) : page === 'register' ? (
            <>Already registered? <Link to="/login">Sign in</Link></>
          ) : (
            <Link to="/login">Return to sign in</Link>
          )}
        </p>
      </Card>
    </div>
  )
}

export default function PublicPage({ page }) {
  if (page !== 'home') return <AuthenticationPage page={page} />
  return <LandingPage />
}

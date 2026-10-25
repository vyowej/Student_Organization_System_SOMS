import { useMemo, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import Card from '../components/ui/Card.jsx'
import Input from '../components/ui/Input.jsx'
import Button from '../components/ui/Button.jsx'
import { useToast } from '../components/ui/useToast.js'
import { useAuth } from '../context/useAuth.js'
import { usePortalData } from '../context/usePortalData.js'
import { dashboardByRole } from '../data/mockAuthUsers.js'
import { isValidEmail, isWmsuEmail } from '../data/displayName.js'
import WmsuLogo from '../components/ui/WmsuLogo.jsx'
import Icon from '../components/ui/Icon.jsx'
import LandingPage from './LandingPage.jsx'

function PasswordVisibilityIcon({ visible }) {
  return <Icon name={visible ? 'eye-off' : 'eye'} size={20} />
}

function AuthenticationPage({ page }) {
  const { login, registerStudent } = useAuth()
  const { academicPrograms = [], refreshPortalData } = usePortalData()
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
    yearLevel: '',
  })

  const groupedPrograms = useMemo(() => {
    if (!academicPrograms.length) return []
    const groups = {}
    academicPrograms.forEach((p) => {
      const groupName = p.college_name ? `${p.college_name} (${p.college_acronym})` : 'Other Programs'
      if (!groups[groupName]) groups[groupName] = []
      groups[groupName].push(p)
    })
    return Object.entries(groups).map(([college, progs]) => ({
      college,
      programs: progs,
    }))
  }, [academicPrograms])

  const programOptions = academicPrograms.length > 0
    ? academicPrograms.map((p) => ({ id: p.id, label: `${p.acronym} — ${p.name}`, value: p.acronym }))
    : ['BSCS', 'BSIT', 'BSBA', 'BSED', 'BSA', 'BSHM'].map((code) => ({ id: code, label: code, value: code }))

  async function handleLogin(event) {
    event.preventDefault()
    setError('')
    setSuccess('')
    const trimmedId = identifier.trim()
    if (!trimmedId || !password) {
      setError('Enter your email address (or Employee/Student ID) and password.')
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
    const hasOrgWorkspace = (result.user?.organizationRoles && result.user.organizationRoles.length > 0) || Boolean(result.user?.organizationId)
    const targetDashboard = (result.user?.role === 'OFFICER' && !hasOrgWorkspace)
      ? '/student/dashboard'
      : (dashboardByRole[result.user?.role] || '/student/dashboard')
    navigate(result.redirectTo || targetDashboard, { replace: true })
  }

  function validateRegistrationStep(step) {
    setError('')
    setSuccess('')
    if (step === 1) {
      if ([form.lastName, form.firstName, form.studentId, form.email].some((value) => !String(value).trim())) {
        setError('Complete the required fields to continue.')
        return false
      }
      if (!isValidEmail(form.email)) {
        setError('Enter a valid email address.')
        return false
      }
      if (!isWmsuEmail(form.email)) {
        setError('Use your WMSU email address ending in @wmsu.edu.ph.')
        return false
      }
      return true
    }
    if ([form.password, form.confirmPassword, form.program, form.yearLevel].some((value) => !String(value).trim())) {
      setError('Complete the required fields to create your account.')
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
    const matchedProg = academicPrograms.find((p) => p.acronym === form.program || String(p.id) === String(form.programId))
    const result = await registerStudent({
      ...form,
      programId: matchedProg?.id ?? null,
    })
    setSubmitting(false)
    if (!result.ok) {
      setError(result.error)
      return
    }
    await refreshPortalData()
    showToast('Account created successfully. Welcome to UNIDOS!', 'success')
    navigate('/student/dashboard', { replace: true })
  }

  const titles = {
    login: ['Welcome back', 'Sign in to continue to your WMSU organization workspace.'],
    register: ['Create Account', 'Register to join organizations and campus activities.'],
    'forgot-password': ['Reset your password', 'Enter your WMSU email address to continue.'],
  }
  const [title, description] = titles[page]

  return (
    <div className="auth-layout">
      <aside className="auth-feature-panel">
        <Link aria-label="UNIDOS home" className="auth-feature-brand" to="/">
          <WmsuLogo className="brand-seal" />
          <span><strong>UNIDOS</strong><small>WMSU student community</small></span>
        </Link>
        <div className="auth-feature-copy">
          <span className="landing-eyebrow">One campus. Many communities.</span>
          <h2>Find your people.<br /><em>Make your impact.</em></h2>
          <p>Discover organizations, connect with students, and take part in campus life.</p>
        </div>
        <div aria-hidden="true" className="auth-device-preview">
          <div className="auth-mini-laptop">
            <div><span>UNIDOS</span><b>Campus, connected.</b><i /><i /><i /></div>
          </div>
          <div className="auth-mini-phone"><span>UNIDOS</span><b>Join a community</b><i /><i /></div>
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
      {page === 'login' && location.state?.registered && <p className="auth-success" role="status">Account created successfully. Sign in with your new account.</p>}
      {page === 'login' && (
        <form className="auth-form" noValidate onSubmit={handleLogin}>
          <Input autoComplete="username" id="login-identifier" label="WMSU Email or Employee/Student ID" onChange={(event) => setIdentifier(event.target.value)} placeholder="name@wmsu.edu.ph or Employee/Student ID" type="text" value={identifier} />
          <div className="auth-password-field">
            <Input autoComplete="current-password" id="login-password" label="Password" onChange={(event) => setPassword(event.target.value)} type={showLoginPassword ? 'text' : 'password'} value={password} />
            <button aria-label={showLoginPassword ? 'Hide password' : 'Show password'} aria-pressed={showLoginPassword} className="auth-show-password" onClick={() => setShowLoginPassword((visible) => !visible)} type="button"><PasswordVisibilityIcon visible={showLoginPassword} /></button>
          </div>
          <div className="auth-login-options">
            <label><input checked={rememberMe} onChange={(event) => setRememberMe(event.target.checked)} type="checkbox" /> Remember me</label>
            <Link to="/forgot-password">Forgot Password?</Link>
          </div>
          {error && <p className="auth-error" role="alert">{error}</p>}
          <Button className="auth-submit" disabled={submitting} type="submit">{submitting ? 'Signing in...' : 'Login'}</Button>
        </form>
      )}
      {page === 'register' && (
        <form className="auth-form auth-register-form" noValidate onSubmit={handleRegister}>
          <div aria-label={`Registration step ${registrationStep} of 2`} className="auth-registration-progress">
            <span aria-current={registrationStep === 1 ? 'step' : undefined} className={registrationStep === 1 ? 'is-current' : 'is-complete'}>
              <b aria-hidden="true">{registrationStep === 1 ? '1' : <Icon name="check" size={12} strokeWidth={3} />}</b>
              <span>Input detail</span>
            </span>
            <i aria-hidden="true" className={registrationStep === 2 ? 'is-complete' : ''} />
            <span aria-current={registrationStep === 2 ? 'step' : undefined} className={registrationStep === 2 ? 'is-current' : ''}>
              <b aria-hidden="true">2</b>
              <span>Account security</span>
            </span>
          </div>
          {registrationStep === 1 ? (
            <>
              <Input autoComplete="given-name" id="register-first-name" label="First Name" onChange={(event) => setForm((current) => ({ ...current, firstName: event.target.value }))} value={form.firstName} />
              <Input autoComplete="additional-name" id="register-middle-name" label="Middle Name (optional)" onChange={(event) => setForm((current) => ({ ...current, middleName: event.target.value }))} value={form.middleName} />
              <Input autoComplete="family-name" id="register-last-name" label="Last Name" onChange={(event) => setForm((current) => ({ ...current, lastName: event.target.value }))} value={form.lastName} />
              <Input autoComplete="honorific-suffix" id="register-suffix" label="Suffix (optional)" onChange={(event) => setForm((current) => ({ ...current, suffix: event.target.value }))} placeholder="e.g., Jr., Sr., III" value={form.suffix} />
              <Input autoComplete="off" fieldClassName="auth-field-full" id="register-student-id" label="Employee/Student ID" onChange={(event) => setForm((current) => ({ ...current, studentId: event.target.value }))} placeholder="e.g., 2024-00123" value={form.studentId} />
              <Input aria-describedby="register-email-hint" autoComplete="email" fieldClassName="auth-field-full" id="register-email" label="WMSU Email" onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} placeholder="name@wmsu.edu.ph" type="email" value={form.email} />
              <p className="auth-registration-hint" id="register-email-hint">Use your university email ending in @wmsu.edu.ph.</p>
            </>
          ) : (
            <>
              <label className="form-field" htmlFor="register-program">Course / Program
                <select id="register-program" onChange={(event) => setForm((current) => ({ ...current, program: event.target.value }))} value={form.program}>
                  <option value="">Select program</option>
                  {groupedPrograms.length > 0 ? (
                    groupedPrograms.map((group) => (
                      <optgroup key={group.college} label={group.college}>
                        {group.programs.map((prog) => (
                          <option key={prog.id} value={prog.acronym}>
                            {prog.acronym} — {prog.name}
                          </option>
                        ))}
                      </optgroup>
                    ))
                  ) : (
                    programOptions.map((prog) => <option key={prog.id} value={prog.value}>{prog.label}</option>)
                  )}
                </select>
              </label>
              <label className="form-field" htmlFor="register-year-level">Year Level
                <select id="register-year-level" onChange={(event) => setForm((current) => ({ ...current, yearLevel: event.target.value }))} value={form.yearLevel}>
                  <option value="">Select year level</option>
                  {['1st Year', '2nd Year', '3rd Year', '4th Year', '5th Year', '6th Year'].map((year) => <option key={year} value={year}>{year}</option>)}
                </select>
              </label>
              <div className="auth-password-field">
                <Input autoComplete="new-password" id="register-password" label="Password" onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))} type={showPassword ? 'text' : 'password'} value={form.password} />
                <button aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword} className="auth-show-password" onClick={() => setShowPassword((visible) => !visible)} type="button"><PasswordVisibilityIcon visible={showPassword} /></button>
              </div>
              <div className="auth-password-field">
                <Input autoComplete="new-password" id="register-confirm-password" label="Confirm Password" onChange={(event) => setForm((current) => ({ ...current, confirmPassword: event.target.value }))} type={showConfirmPassword ? 'text' : 'password'} value={form.confirmPassword} />
                <button aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'} aria-pressed={showConfirmPassword} className="auth-show-password" onClick={() => setShowConfirmPassword((visible) => !visible)} type="button"><PasswordVisibilityIcon visible={showConfirmPassword} /></button>
              </div>
            </>
          )}
          {error && <p className="auth-error" role="alert">{error}</p>}
          <div className="auth-registration-actions">
            {registrationStep === 2 && <Button onClick={() => { setError(''); setRegistrationStep(1) }} variant="secondary">Back</Button>}
            {registrationStep === 1
              ? <Button className="auth-submit" type="submit">Continue</Button>
              : <Button className="auth-submit" disabled={submitting} type="submit">{submitting ? 'Creating Account...' : 'Create Account'}</Button>}
          </div>
        </form>
      )}
      {page === 'forgot-password' && (
        <form className="auth-form" noValidate onSubmit={(event) => {
          event.preventDefault()
          if (!isWmsuEmail(identifier)) {
            setError('Enter your WMSU email address ending in @wmsu.edu.ph.')
            setSuccess('')
            return
          }
          setError('')
          setSuccess('If this account exists, password reset instructions would be sent.')
        }}>
          <Input autoComplete="username" id="reset-identifier" label="WMSU Email" onChange={(event) => setIdentifier(event.target.value)} placeholder="name@wmsu.edu.ph" type="email" value={identifier} />
          {error && <p className="auth-error" role="alert">{error}</p>}
          {success && <p className="auth-success" role="status">{success}</p>}
          <Button className="auth-submit" type="submit">Reset Password</Button>
        </form>
      )}
      <p className="auth-note">
        {page === 'login' ? <>Need an account? <Link to="/register">Create Account</Link></>
          : page === 'register' ? <>Already registered? <Link to="/login">Sign in</Link></>
            : <Link to="/login">Return to sign in</Link>}
      </p>
      </Card>
    </div>
  )
}

export default function PublicPage({ page }) {
  if (page !== 'home') return <AuthenticationPage page={page} />
  return <LandingPage />
}

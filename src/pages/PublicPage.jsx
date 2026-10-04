import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import Card from '../components/ui/Card.jsx'
import Input from '../components/ui/Input.jsx'
import Button from '../components/ui/Button.jsx'
import { useToast } from '../components/ui/useToast.js'
import { useAuth } from '../context/useAuth.js'
import { usePortalData } from '../context/usePortalData.js'
import { dashboardByRole } from '../data/mockAuthUsers.js'
import { isValidEmail, isWmsuEmail } from '../data/email.js'
import LandingPage from './LandingPage.jsx'

function PasswordVisibilityIcon({ visible }) {
  return visible
    ? (
        <svg aria-hidden="true" fill="none" height="20" viewBox="0 0 24 24" width="20">
          <path d="M3 3l18 18M10.6 10.6a2 2 0 002.8 2.8" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
          <path d="M9.9 5.2A10.8 10.8 0 0112 5c5 0 8.7 4.2 9.5 7-.3 1-1.2 2.3-2.5 3.5M6.2 6.2C3.9 7.6 2.8 9.8 2.5 12c.8 2.8 4.5 7 9.5 7 1 0 2-.2 2.9-.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
        </svg>
      )
    : (
        <svg aria-hidden="true" fill="none" height="20" viewBox="0 0 24 24" width="20">
          <path d="M2.5 12S6 5 12 5s9.5 7 9.5 7-3.5 7-9.5 7-9.5-7-9.5-7Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.8" />
          <circle cx="12" cy="12" r="2.5" stroke="currentColor" strokeWidth="1.8" />
        </svg>
      )
}

function AuthenticationPage({ page }) {
  const { login, registerStudent } = useAuth()
  const { addRegisteredStudent } = usePortalData()
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
  const [registrationStep, setRegistrationStep] = useState(1)
  const [form, setForm] = useState({
    lastName: '',
    firstName: '',
    middleName: '',
    studentId: '',
    email: '',
    password: '',
    confirmPassword: '',
    program: '',
    yearLevel: '',
  })

  function handleLogin(event) {
    event.preventDefault()
    setError('')
    setSuccess('')
    if (!identifier.trim() || !password) {
      setError('Enter your WMSU email address and password.')
      return
    }
    if (!isWmsuEmail(identifier)) {
      setError('Use your WMSU email address ending in @wmsu.edu.ph.')
      return
    }
    const result = login(identifier, password, rememberMe)
    if (!result.ok) {
      setError(result.error)
      return
    }
    showToast('Signed in successfully.', 'success')
    navigate(dashboardByRole[result.user.role], { replace: true })
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

  function handleRegister(event) {
    event.preventDefault()
    if (registrationStep === 1) {
      if (validateRegistrationStep(1)) setRegistrationStep(2)
      return
    }
    if (!validateRegistrationStep(registrationStep)) return
    const result = registerStudent(form)
    if (!result.ok) {
      setError(result.error)
      return
    }
    if (!addRegisteredStudent(result.user)) {
      setError('The account was created, but its student directory profile could not be added.')
      return
    }
    showToast('Account created successfully.', 'success')
    navigate('/login', { replace: true, state: { registered: true } })
  }

  const titles = {
    login: ['Welcome back', 'Sign in to continue to your WMSU organization workspace.'],
    register: ['Create your student account', 'Register to join organizations and campus activities.'],
    'forgot-password': ['Reset your password', 'Enter your WMSU email address to continue.'],
  }
  const [title, description] = titles[page]

  return (
    <Card className={`auth-card auth-card-${page}`}>
      <div className="auth-brand">
        <span aria-hidden="true" className="brand-seal">WMSU</span>
        <div><strong>UNIDOS</strong><span>Student Organization Management System</span></div>
      </div>
      <h1>{title}</h1>
      <p>{description}</p>
      {page === 'login' && location.state?.registered && <p className="auth-success" role="status">Account created successfully. Sign in with your new account.</p>}
      {page === 'login' && (
        <form className="auth-form" noValidate onSubmit={handleLogin}>
          <Input autoComplete="username" id="login-identifier" label="WMSU Email" onChange={(event) => setIdentifier(event.target.value)} placeholder="name@wmsu.edu.ph" type="email" value={identifier} />
          <div className="auth-password-field">
            <Input autoComplete="current-password" id="login-password" label="Password" onChange={(event) => setPassword(event.target.value)} type={showLoginPassword ? 'text' : 'password'} value={password} />
            <button aria-label={showLoginPassword ? 'Hide password' : 'Show password'} aria-pressed={showLoginPassword} className="auth-show-password" onClick={() => setShowLoginPassword((visible) => !visible)} type="button"><PasswordVisibilityIcon visible={showLoginPassword} /></button>
          </div>
          <div className="auth-login-options">
            <label><input checked={rememberMe} onChange={(event) => setRememberMe(event.target.checked)} type="checkbox" /> Remember me</label>
            <Link to="/forgot-password">Forgot Password?</Link>
          </div>
          {error && <p className="auth-error" role="alert">{error}</p>}
          <Button className="auth-submit" type="submit">Login</Button>
          <details className="auth-test-accounts">
            <summary>Development demo accounts</summary>
            <span className="auth-demo-notice">For preview and testing only. Do not use these credentials for real accounts.</span>
            <span>Student + Organization Officer · student@wmsu.edu.ph · student123</span>
            <span>Adviser · adviser@wmsu.edu.ph · adviser123</span>
            <span>Admin · admin@wmsu.edu.ph · admin123</span>
          </details>
        </form>
      )}
      {page === 'register' && (
        <form className="auth-form auth-register-form" noValidate onSubmit={handleRegister}>
          <div aria-label={`Registration step ${registrationStep} of 2`} className="auth-registration-progress">
            <span className={registrationStep === 1 ? 'is-current' : 'is-complete'}>1/2 <span>Student details</span></span>
            <i aria-hidden="true" />
            <span className={registrationStep === 2 ? 'is-current' : ''}>2/2 <span>Account security</span></span>
          </div>
          {registrationStep === 1 ? (
            <>
              <Input autoComplete="given-name" id="register-first-name" label="First Name" onChange={(event) => setForm((current) => ({ ...current, firstName: event.target.value }))} value={form.firstName} />
              <Input autoComplete="additional-name" id="register-middle-name" label="Middle Name (optional)" onChange={(event) => setForm((current) => ({ ...current, middleName: event.target.value }))} value={form.middleName} />
              <Input autoComplete="family-name" id="register-last-name" label="Last Name" onChange={(event) => setForm((current) => ({ ...current, lastName: event.target.value }))} value={form.lastName} />
              <Input autoComplete="off" id="register-student-id" label="Student ID" onChange={(event) => setForm((current) => ({ ...current, studentId: event.target.value }))} value={form.studentId} />
              <Input aria-describedby="register-email-hint" autoComplete="email" id="register-email" label="WMSU Email" onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} placeholder="name@wmsu.edu.ph" type="email" value={form.email} />
              <p className="auth-registration-hint" id="register-email-hint">Use your university email ending in @wmsu.edu.ph.</p>
            </>
          ) : (
            <>
              <label className="form-field" htmlFor="register-program">Course / Program
                <select id="register-program" onChange={(event) => setForm((current) => ({ ...current, program: event.target.value }))} value={form.program}>
                  <option value="">Select program</option>
                  {['BSCS', 'BSIT', 'BSBA', 'BSED', 'BSA', 'BSHM', 'Other'].map((program) => <option key={program}>{program}</option>)}
                </select>
              </label>
              <label className="form-field" htmlFor="register-year-level">Year Level
                <select id="register-year-level" onChange={(event) => setForm((current) => ({ ...current, yearLevel: event.target.value }))} value={form.yearLevel}>
                  <option value="">Select year level</option>
                  {['1st Year', '2nd Year', '3rd Year', '4th Year', '5th Year'].map((year) => <option key={year}>{year}</option>)}
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
              : <Button className="auth-submit" type="submit">Create Account</Button>}
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
        {page === 'login' ? <>Need an account? <Link to="/register">Register here</Link></>
          : page === 'register' ? <>Already registered? <Link to="/login">Sign in</Link></>
            : <Link to="/login">Return to sign in</Link>}
      </p>
    </Card>
  )
}

export default function PublicPage({ page }) {
  if (page !== 'home') return <AuthenticationPage page={page} />
  return <LandingPage />
}

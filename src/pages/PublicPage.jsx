import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import Card from '../components/ui/Card.jsx'
import Input from '../components/ui/Input.jsx'
import Button from '../components/ui/Button.jsx'
import { useToast } from '../components/ui/useToast.js'
import { useAuth } from '../context/useAuth.js'
import { usePortalData } from '../context/usePortalData.js'
import { dashboardByRole } from '../data/mockAuthUsers.js'
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
      setError('Enter your email or student ID and password.')
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

  function handleRegister(event) {
    event.preventDefault()
    setError('')
    setSuccess('')
    if ([form.lastName, form.firstName, form.studentId, form.email, form.password, form.confirmPassword, form.program, form.yearLevel].some((value) => !String(value).trim())) {
      setError('Complete all fields to create your account.')
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      setError('Enter a valid email address.')
      return
    }
    if (form.password.length < 6) {
      setError('Use a password with at least 6 characters.')
      return
    }
    if (form.password !== form.confirmPassword) {
      setError('The password confirmation does not match.')
      return
    }
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
    'forgot-password': ['Reset your password', 'Enter your email address or student ID to continue.'],
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
          <Input autoComplete="username" id="login-identifier" label="Email or Student ID" onChange={(event) => setIdentifier(event.target.value)} placeholder="name@wmsu.edu.ph or student ID" value={identifier} />
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
          <div className="auth-test-accounts">
            <strong>Mock accounts for testing</strong>
            <span>Student · student@unidos.test · student123</span>
            <span>Officer · officer@unidos.test · officer123</span>
            <span>Adviser · adviser@unidos.test · adviser123</span>
            <span>Admin · admin@unidos.test · admin123</span>
          </div>
        </form>
      )}
      {page === 'register' && (
        <form className="auth-form auth-register-form" noValidate onSubmit={handleRegister}>
          <Input autoComplete="family-name" id="register-last-name" label="Last Name" onChange={(event) => setForm((current) => ({ ...current, lastName: event.target.value }))} value={form.lastName} />
          <Input autoComplete="given-name" id="register-first-name" label="First Name" onChange={(event) => setForm((current) => ({ ...current, firstName: event.target.value }))} value={form.firstName} />
          <Input autoComplete="additional-name" id="register-middle-name" label="Middle Name (optional)" onChange={(event) => setForm((current) => ({ ...current, middleName: event.target.value }))} value={form.middleName} />
          <Input autoComplete="off" id="register-student-id" label="Student ID" onChange={(event) => setForm((current) => ({ ...current, studentId: event.target.value }))} value={form.studentId} />
          <Input autoComplete="email" id="register-email" label="Email" onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} type="email" value={form.email} />
          <div className="auth-password-field">
            <Input autoComplete="new-password" id="register-password" label="Password" onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))} type={showPassword ? 'text' : 'password'} value={form.password} />
            <button aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword} className="auth-show-password" onClick={() => setShowPassword((visible) => !visible)} type="button"><PasswordVisibilityIcon visible={showPassword} /></button>
          </div>
          <div className="auth-password-field">
            <Input autoComplete="new-password" id="register-confirm-password" label="Confirm Password" onChange={(event) => setForm((current) => ({ ...current, confirmPassword: event.target.value }))} type={showConfirmPassword ? 'text' : 'password'} value={form.confirmPassword} />
            <button aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'} aria-pressed={showConfirmPassword} className="auth-show-password" onClick={() => setShowConfirmPassword((visible) => !visible)} type="button"><PasswordVisibilityIcon visible={showConfirmPassword} /></button>
          </div>
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
          {error && <p className="auth-error" role="alert">{error}</p>}
          <Button className="auth-submit" type="submit">Create Account</Button>
        </form>
      )}
      {page === 'forgot-password' && (
        <form className="auth-form" noValidate onSubmit={(event) => {
          event.preventDefault()
          if (!identifier.trim()) {
            setError('Enter your email address or student ID.')
            setSuccess('')
            return
          }
          setError('')
          setSuccess('If this account exists, password reset instructions would be sent.')
        }}>
          <Input autoComplete="username" id="reset-identifier" label="Email or Student ID" onChange={(event) => setIdentifier(event.target.value)} placeholder="name@wmsu.edu.ph or student ID" value={identifier} />
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

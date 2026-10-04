import { useOutletContext } from 'react-router-dom'
import PageHeader from '../components/layout/PageHeader.jsx'
import Badge from '../components/ui/Badge.jsx'
import Card from '../components/ui/Card.jsx'
import { formatDisplayName } from '../data/displayName.js'

export default function StudentProfilePage() {
  const { currentUser } = useOutletContext()
  const details = {
    personal: [
      ['First Name', currentUser.firstName],
      ['Middle Name', currentUser.middleName || '—'],
      ['Last Name', currentUser.lastName],
      ['Email Address', currentUser.email],
    ],
    academic: [
      ['Student ID', currentUser.studentId],
      ['Course / Program', currentUser.program || '—'],
      ['Year Level', currentUser.yearLevel || '—'],
    ],
  }
  const initials = [currentUser.firstName, currentUser.lastName]
    .map((name) => name?.trim()?.[0])
    .filter(Boolean)
    .join('')

  return (
    <div className="student-profile">
      <PageHeader description="Review your student and academic account information." eyebrow="UNIDOS STUDENT PORTAL" title="My Profile" />
      <Card className="student-profile-identity">
        <div aria-hidden="true" className="student-profile-avatar">{initials || 'S'}</div>
        <div className="student-profile-identity-copy">
          <span className="student-profile-eyebrow">Student account</span>
          <h2>{formatDisplayName(currentUser)}</h2>
          <p>{currentUser.program || 'Student'}{currentUser.yearLevel ? ` · ${currentUser.yearLevel}` : ''}</p>
        </div>
        <Badge tone={currentUser.status === 'ACTIVE' ? 'success' : 'neutral'}>
          {currentUser.status === 'ACTIVE' ? 'Active account' : currentUser.status || 'Student'}
        </Badge>
      </Card>

      <div className="student-profile-details">
        <Card className="student-profile-section">
          <div className="student-profile-section-heading">
            <span aria-hidden="true" className="student-profile-section-mark">01</span>
            <div>
              <h2>Personal information</h2>
              <p>Your name and contact details</p>
            </div>
          </div>
          <dl>
            {details.personal.map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value || '—'}</dd>
              </div>
            ))}
          </dl>
        </Card>

        <Card className="student-profile-section">
          <div className="student-profile-section-heading">
            <span aria-hidden="true" className="student-profile-section-mark">02</span>
            <div>
              <h2>Academic information</h2>
              <p>Your university enrollment details</p>
            </div>
          </div>
          <dl>
            {details.academic.map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value || '—'}</dd>
              </div>
            ))}
          </dl>
        </Card>
      </div>
      <p className="student-profile-note">This information is associated with your student account.</p>
    </div>
  )
}

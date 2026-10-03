import { useOutletContext } from 'react-router-dom'
import PageHeader from '../components/layout/PageHeader.jsx'
import Card from '../components/ui/Card.jsx'
import { formatDisplayName } from '../data/displayName.js'

export default function StudentProfilePage() {
  const { currentUser } = useOutletContext()
  const details = [
    ['Last Name', currentUser.lastName],
    ['First Name', currentUser.firstName],
    ['Middle Name', currentUser.middleName || 'Not provided'],
    ['Student ID', currentUser.studentId],
    ['Email', currentUser.email],
    ['Course / Program', currentUser.program ?? 'Not provided'],
    ['Year Level', currentUser.yearLevel ?? 'Not provided'],
  ]
  return (
    <>
      <PageHeader description="Review your student and academic account information." eyebrow="UNIDOS STUDENT PORTAL" title="My Profile" />
      <Card className="student-profile-card">
        <h2>{formatDisplayName(currentUser)}</h2>
        <dl>{details.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
      </Card>
    </>
  )
}

import { useOutletContext } from 'react-router-dom'
import PageHeader from '../components/layout/PageHeader.jsx'
import Badge from '../components/ui/Badge.jsx'
import Button from '../components/ui/Button.jsx'
import Card from '../components/ui/Card.jsx'
import EmptyState from '../components/ui/EmptyState.jsx'

export default function StudentNotificationsPage() {
  const { studentNotifications, markStudentNotificationRead } = useOutletContext()

  return (
    <>
      <PageHeader
        description="Updates about your organization memberships and campus activities."
        eyebrow="UNIDOS STUDENT PORTAL"
        title="Notifications"
      />
      <div className="student-notifications-list">
        {studentNotifications.length ? studentNotifications.map((notification) => (
          <Card className="student-notification-card" key={notification.id}>
            <div>
              {!notification.read && <Badge tone="warning">NEW</Badge>}
              <p>{notification.message}</p>
              <small>{notification.createdAt}</small>
            </div>
            {!notification.read && <Button onClick={() => markStudentNotificationRead(notification.id)} variant="secondary">Mark as read</Button>}
          </Card>
        )) : <EmptyState description="Membership, event, and campus updates will appear here." title="You’re all caught up" />}
      </div>
    </>
  )
}

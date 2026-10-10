import { useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import PageHeader from '../components/layout/PageHeader.jsx'
import SearchBar, { matchesQuery } from '../components/ui/SearchBar.jsx'
import Badge from '../components/ui/Badge.jsx'
import Button from '../components/ui/Button.jsx'
import Card from '../components/ui/Card.jsx'
import EmptyState from '../components/ui/EmptyState.jsx'

export default function StudentNotificationsPage() {
  const { studentNotifications, markStudentNotificationRead } = useOutletContext()
  const [search, setSearch] = useState('')
  const visibleNotifications = studentNotifications.filter((notification) => matchesQuery(search, notification.message, notification.createdAt))

  return (
    <div className="student-page">
      <PageHeader
        description="Updates about your organization memberships and campus activities."
        eyebrow="UNIDOS STUDENT PORTAL"
        title="Notifications"
      />
      <SearchBar label="Search notifications" onChange={setSearch} placeholder="Search notifications…" value={search} />
      <div className="student-notifications-list">
        {visibleNotifications.length ? visibleNotifications.map((notification) => (
          <Card className="student-notification-card" key={notification.id}>
            <div>
              {!notification.read && <Badge tone="warning">NEW</Badge>}
              <p>{notification.message}</p>
              <small>{notification.createdAt}</small>
            </div>
            {!notification.read && <Button onClick={() => markStudentNotificationRead(notification.id)} variant="secondary">Mark as read</Button>}
          </Card>
        )) : <EmptyState description={search ? 'No notifications match your search.' : 'Membership, event, and campus updates will appear here.'} title={search ? 'No matching notifications' : 'You’re all caught up'} />}
      </div>
    </div>
  )
}

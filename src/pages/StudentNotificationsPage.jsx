import { useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import PageHeader from '../components/layout/PageHeader.jsx'
import SearchBar, { matchesQuery } from '../components/ui/SearchBar.jsx'
import Badge from '../components/ui/Badge.jsx'
import Button from '../components/ui/Button.jsx'
import Card from '../components/ui/Card.jsx'
import EmptyState from '../components/ui/EmptyState.jsx'
import Icon from '../components/ui/Icon.jsx'
import { studentDashboardNotifications } from '../data/studentDashboard.js'

export default function StudentNotificationsPage() {
  const {
    studentNotifications = [],
    markStudentNotificationRead,
    readNotificationIds = [],
    markNotificationRead,
  } = useOutletContext()
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('ALL')

  // Combine dynamic notifications from context with the notifications moved from dashboard
  const allNotifications = [
    ...(studentNotifications || []).map((n) => ({
      id: n.id,
      type: n.type || 'Update',
      message: n.message,
      createdAt: n.createdAt || n.time || 'Recently',
      read: Boolean(n.read),
      icon: n.icon || 'bell',
    })),
    ...studentDashboardNotifications
      .filter((n) => !(studentNotifications || []).some((sn) => sn.id === n.id))
      .map((n) => ({
        id: n.id,
        type: n.type,
        message: n.message,
        createdAt: n.time,
        read: !n.unread || (readNotificationIds && readNotificationIds.includes(n.id)),
        icon: n.icon || 'bell',
      })),
  ]

  const handleMarkRead = (id) => {
    if (markStudentNotificationRead) markStudentNotificationRead(id)
    if (markNotificationRead) markNotificationRead(id)
  }

  const handleMarkAllRead = () => {
    allNotifications.forEach((n) => {
      if (!n.read) handleMarkRead(n.id)
    })
  }

  const unreadCount = allNotifications.filter((n) => !n.read).length

  const filteredNotifications = allNotifications.filter((n) => {
    if (filter === 'UNREAD' && n.read) return false
    return matchesQuery(search, n.message, n.type, n.createdAt)
  })

  return (
    <div className="student-page">
      <PageHeader
        description="Updates about your organization memberships, event registrations, and campus activities."
        eyebrow="UNIDOS STUDENT PORTAL"
        title="Notifications"
      />

      <div className="student-notifications-toolbar">
        <SearchBar label="Search notifications" onChange={setSearch} placeholder="Search notifications…" value={search} />
        <div className="student-notifications-controls">
          <div className="student-notifications-filter-tabs">
            <button
              type="button"
              className={`student-filter-tab ${filter === 'ALL' ? 'active' : ''}`}
              onClick={() => setFilter('ALL')}
            >
              All ({allNotifications.length})
            </button>
            <button
              type="button"
              className={`student-filter-tab ${filter === 'UNREAD' ? 'active' : ''}`}
              onClick={() => setFilter('UNREAD')}
            >
              Unread ({unreadCount})
            </button>
          </div>
          {unreadCount > 0 && (
            <Button onClick={handleMarkAllRead} variant="secondary">
              Mark all as read
            </Button>
          )}
        </div>
      </div>

      <div className="student-notifications-list">
        {filteredNotifications.length ? (
          filteredNotifications.map((notification) => (
            <Card
              className={`student-notification-card ${!notification.read ? 'is-unread' : ''}`}
              key={notification.id}
            >
              <div className="student-notif-main">
                <span className={`student-notif-icon notif-type-${(notification.type || '').toLowerCase().replace(/\s+/g, '-')}`}>
                  <Icon name={notification.icon} />
                </span>
                <div className="student-notif-content">
                  <div className="student-notif-header">
                    <span className="student-notif-type-badge">{notification.type}</span>
                    {!notification.read && <Badge tone="warning">NEW</Badge>}
                    <span className="student-notif-time">{notification.createdAt}</span>
                  </div>
                  <p className="student-notif-message">{notification.message}</p>
                </div>
              </div>
              <div className="student-notif-actions">
                {!notification.read ? (
                  <Button onClick={() => handleMarkRead(notification.id)} variant="secondary">
                    Mark as read
                  </Button>
                ) : (
                  <span className="student-notif-read-mark">Read</span>
                )}
              </div>
            </Card>
          ))
        ) : (
          <EmptyState
            description={
              search
                ? 'No notifications match your search query.'
                : filter === 'UNREAD'
                  ? 'You have no unread notifications.'
                  : 'Membership, event, and campus updates will appear here.'
            }
            title={
              search
                ? 'No matching notifications'
                : filter === 'UNREAD'
                  ? 'All caught up'
                  : 'No notifications'
            }
          />
        )}
      </div>
    </div>
  )
}

import { useState } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import PageHeader from '../components/layout/PageHeader.jsx'
import SearchBar, { matchesQuery } from '../components/ui/SearchBar.jsx'
import Badge from '../components/ui/Badge.jsx'
import Button from '../components/ui/Button.jsx'
import Card from '../components/ui/Card.jsx'
import EmptyState from '../components/ui/EmptyState.jsx'
import Icon from '../components/ui/Icon.jsx'

export default function StudentNotificationsPage() {
  const {
    studentNotifications = [],
    markStudentNotificationRead,
    readNotificationIds = [],
    markNotificationRead,
    markAllNotificationsRead,
  } = useOutletContext()
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('ALL')

  // Combine dynamic notifications from context with the notifications moved from dashboard
  const allNotifications = [
    ...(studentNotifications || []).map((n) => {
      const rawType = String(n.rawType || n.type || '').toUpperCase()
      let destination = null
      if (rawType.includes('EVENT') && !rawType.includes('REGISTRATION')) {
        destination = '/student/events'
      } else if (rawType.includes('REGISTRATION')) {
        destination = '/student/registrations'
      } else if (rawType.includes('ATTENDANCE')) {
        destination = '/student/attendance'
      } else if (rawType.includes('MEMBERSHIP')) {
        destination = '/student/my-organizations'
      }
      return {
        id: n.id,
        title: n.title,
        type: n.type || 'Update',
        rawType,
        message: n.message,
        createdAt: n.createdAt || n.time || 'Recently',
        read: Boolean(n.read) || (readNotificationIds && readNotificationIds.includes(n.id)),
        icon: n.icon || (rawType === 'EVENT' ? 'calendar' : rawType === 'ANNOUNCEMENT' ? 'bell' : rawType === 'EVENT_REGISTRATION' ? 'ticket' : rawType === 'ATTENDANCE' ? 'check' : 'bell'),
        to: destination,
      }
    }),
  ]

  const handleMarkRead = (id) => {
    if (markStudentNotificationRead) markStudentNotificationRead(id)
    if (markNotificationRead) markNotificationRead(id)
  }

  const handleMarkAllRead = async () => {
    if (markAllNotificationsRead) {
      await markAllNotificationsRead()
    } else {
      allNotifications.forEach((n) => {
        if (!n.read) handleMarkRead(n.id)
      })
    }
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
                  {notification.title && (
                    <h4 className="student-notif-title" style={{ margin: '4px 0 2px', fontSize: '0.95rem', fontWeight: 600 }}>
                      {notification.title}
                    </h4>
                  )}
                  <p className="student-notif-message">{notification.message}</p>
                </div>
              </div>
              <div className="student-notif-actions" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                {notification.to && (
                  <Link className="button button-secondary" style={{ padding: '4px 10px', fontSize: '0.85rem' }} to={notification.to}>
                    View
                  </Link>
                )}
                {!notification.read ? (
                  <Button onClick={() => handleMarkRead(notification.id)} variant="secondary" style={{ padding: '4px 10px', fontSize: '0.85rem' }}>
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

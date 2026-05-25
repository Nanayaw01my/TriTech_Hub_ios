import { create } from 'zustand'

const useNotificationStore = create((set, get) => ({
  notifications: [],
  unreadCount: 0,

  setNotifications: (notifications) => {
    const unreadCount = notifications.filter((n) => !n.read).length
    set({ notifications, unreadCount })
  },

  addNotification: (notification) => {
    set((state) => {
      const newNotifications = [{ ...notification, id: notification.id || Date.now(), read: false, createdAt: new Date().toISOString() }, ...state.notifications]
      return { notifications: newNotifications, unreadCount: state.unreadCount + 1 }
    })
  },

  markRead: (id) => {
    set((state) => {
      const notifications = state.notifications.map((n) => n.id === id ? { ...n, read: true } : n)
      const unreadCount = notifications.filter((n) => !n.read).length
      return { notifications, unreadCount }
    })
  },

  markAllRead: () => {
    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, read: true })),
      unreadCount: 0,
    }))
  },

  removeNotification: (id) => {
    set((state) => {
      const notifications = state.notifications.filter((n) => n.id !== id)
      const unreadCount = notifications.filter((n) => !n.read).length
      return { notifications, unreadCount }
    })
  },
}))

export default useNotificationStore

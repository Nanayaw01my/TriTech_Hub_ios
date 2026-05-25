import { create } from 'zustand'
import { persist } from 'zustand/middleware'

const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      token: null,

      login: (userData, token) => {
        set({ user: userData, token })
        if (token) localStorage.setItem('ittek_token', token)
      },

      logout: () => {
        set({ user: null, token: null })
        localStorage.removeItem('ittek_token')
        localStorage.removeItem('ittek_auth')
      },

      updateUser: (userData) => {
        set((state) => ({ user: { ...state.user, ...userData } }))
      },

      get isAuthenticated() {
        return !!get().token && !!get().user
      },

      hasRole: (roles) => {
        const { user } = get()
        if (!user) return false
        if (typeof roles === 'string') return user.role === roles
        return roles.includes(user.role)
      },

      canAccess: (minLevel) => {
        const { user } = get()
        if (!user) return false
        const levels = { 'Sales': 1, 'Manager': 2, 'CEO': 3, 'Super Admin': 4 }
        return (levels[user.role] || 0) >= minLevel
      },
    }),
    {
      name: 'ittek_auth',
      partialize: (state) => ({ user: state.user, token: state.token }),
    }
  )
)

export default useAuthStore

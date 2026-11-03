import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000,
})

// Request interceptor - attach Bearer token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// No answer from the server (no internet, weak network, timeout): give every
// screen the same clear message instead of a generic failure.
export const NETWORK_MESSAGE = 'No internet or the network is weak. Check your connection and try again.'
export const isNetworkError = (err) => !!err?.response?.data?.network

// Response interceptor - handle 401
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (!error.response) {
      const slow = error.code === 'ECONNABORTED' || /timeout/i.test(error.message || '')
      error.response = {
        status: 0,
        data: {
          success: false,
          network: true,
          message: slow
            ? 'The network is too slow — we could not get an answer. Check your connection and try again.'
            : NETWORK_MESSAGE,
        },
      }
      return Promise.reject(error)
    }
    if (error.response?.status === 401) {
      // Clear auth data
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      // Redirect to login
      if (window.location.pathname !== '/login') {
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  }
)

export default api

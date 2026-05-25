import api from './axios'

export const getStockRequests = (params) => api.get('/stock-requests', { params })
export const getStockRequest = (id) => api.get(`/stock-requests/${id}`)
export const createStockRequest = (data) => api.post('/stock-requests', data)
export const approveStockRequest = (id, data) => api.put(`/stock-requests/${id}/approve`, data)
export const rejectStockRequest = (id, data) => api.put(`/stock-requests/${id}/reject`, data)
export const deleteStockRequest = (id) => api.delete(`/stock-requests/${id}`)

import api from './axios'

export const createSale = (data) => api.post('/sales', data)
export const createShortPayment = (data) => api.post('/sales/short-payment', data)
export const getSales = (params) => api.get('/sales', { params })
export const getSaleById = (id) => api.get(`/sales/${id}`)
export const getTodaySales = () => api.get('/sales/today')
export const getSalesSummary = (params) => api.get('/sales/summary', { params })
export const voidSale = (id, reason) => api.put(`/sales/${id}/void`, { reason })

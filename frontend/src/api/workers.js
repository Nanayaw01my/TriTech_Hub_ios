import api from './axios'

export const getWorkerPayments = (params) => api.get('/workers', { params })
export const createWorkerPayment = (data) => api.post('/workers', data)
export const updateWorkerPayment = (id, data) => api.put(`/workers/${id}`, data)
export const deleteWorkerPayment = (id) => api.delete(`/workers/${id}`)
export const getWorkerSummary = (params) => api.get('/workers/summary', { params })

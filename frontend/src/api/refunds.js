import api from './axios'

export const getRefunds = (params) => api.get('/refunds', { params })
export const lookupSaleByInvoice = (invoiceNo) => api.get(`/refunds/lookup/${invoiceNo}`)
export const createRefund = (data) => api.post('/refunds', data)
export const updateRefund = (id, data) => api.put(`/refunds/${id}`, data)
export const deleteRefund = (id) => api.delete(`/refunds/${id}`)

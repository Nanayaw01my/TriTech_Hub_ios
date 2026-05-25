import api from './axios'

export const createSale = (data) => api.post('/pos/sale', data)
export const createShortPayment = (data) => api.post('/pos/short-payment', data)
export const getSales = (params) => api.get('/pos/sales', { params })
export const getSaleById = (id) => api.get(`/pos/sales/${id}`)
export const getTodaySales = () => api.get('/pos/sales/today')

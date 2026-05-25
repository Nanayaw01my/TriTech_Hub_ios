import api from './axios'

export const syncOfflineSales = (sales) => api.post('/sync/offline-sales', { sales })

import api from './axios'

export const uploadImage = (file, folder = 'general') => {
  const formData = new FormData()
  formData.append('image', file)
  return api.post(`/upload?folder=${folder}`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
}

import React, { useState, useRef } from 'react'
import { FiUpload, FiX, FiImage } from 'react-icons/fi'
import { uploadImage } from '../api/upload'
import toast from 'react-hot-toast'

export default function ImageUpload({ value, onChange, folder = 'general', label, size = 'md', className = '' }) {
  const [uploading, setUploading] = useState(false)
  const [preview, setPreview] = useState(value || null)
  const inputRef = useRef(null)

  const dim = size === 'lg' ? 'w-24 h-24' : 'w-16 h-16'

  const handleFile = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const local = URL.createObjectURL(file)
    setPreview(local)
    setUploading(true)
    try {
      const res = await uploadImage(file, folder)
      const url = res.data?.url || res.data
      setPreview(url)
      onChange(url)
    } catch {
      toast.error('Image upload failed')
      setPreview(value || null)
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  const handleRemove = (e) => {
    e.stopPropagation()
    setPreview(null)
    onChange(null)
  }

  return (
    <div className={className}>
      {label && <label className="block text-sm font-semibold text-gray-700 mb-1">{label}</label>}
      <div className="flex items-center gap-3">
        <div
          onClick={() => !uploading && inputRef.current?.click()}
          className={`relative ${dim} rounded-xl border-2 flex items-center justify-center flex-shrink-0 overflow-hidden cursor-pointer transition-colors
            ${preview ? 'border-gray-200' : 'border-dashed border-gray-300 hover:border-orange-400 hover:bg-orange-50'}`}
        >
          {preview ? (
            <>
              <img src={preview} alt="" className="w-full h-full object-cover" />
              <button
                type="button"
                onClick={handleRemove}
                className="absolute top-0.5 right-0.5 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 z-10"
              >
                <FiX size={10} />
              </button>
            </>
          ) : (
            <FiImage size={size === 'lg' ? 24 : 18} className="text-gray-400" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <button
            type="button"
            onClick={() => !uploading && inputRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-xl text-sm text-gray-600 hover:border-orange-400 hover:text-orange-600 transition-colors disabled:opacity-60"
          >
            <FiUpload size={13} />
            {uploading ? 'Uploading...' : preview ? 'Change' : 'Upload'}
          </button>
          <p className="text-xs text-gray-400 mt-1">JPG, PNG or WebP · max 5 MB</p>
        </div>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/jpg,image/png,image/webp"
        className="hidden"
        onChange={handleFile}
      />
    </div>
  )
}

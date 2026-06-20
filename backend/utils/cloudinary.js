const { v2: cloudinary } = require('cloudinary');
const logger = require('./logger');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

/**
 * Upload a base64-encoded image/document to Cloudinary.
 * Returns the secure URL, or null if the input is empty.
 *
 * @param {string} base64String  — data URI: "data:image/jpeg;base64,..."
 * @param {string} folder        — Cloudinary folder, e.g. "tritech/customers"
 * @param {string} publicId      — optional stable ID (omit to auto-generate)
 */
const uploadBase64 = async (base64String, folder = 'tritech', publicId = undefined) => {
  if (!base64String || typeof base64String !== 'string') return null;
  if (!base64String.startsWith('data:')) return base64String; // already a URL

  try {
    const options = {
      folder,
      resource_type: 'auto', // handles images and PDFs
      ...(publicId && { public_id: publicId, overwrite: true }),
    };

    const result = await cloudinary.uploader.upload(base64String, options);
    return result.secure_url;
  } catch (error) {
    logger.error('Cloudinary upload error: %s', error.message);
    return null;
  }
};

/**
 * Delete a file from Cloudinary by its URL or public_id.
 */
const deleteByUrl = async (url) => {
  if (!url || !url.includes('cloudinary.com')) return;
  try {
    // Extract public_id from URL
    const parts = url.split('/');
    const uploadIndex = parts.indexOf('upload');
    if (uploadIndex === -1) return;
    // Skip version segment (v1234567) if present
    const afterUpload = parts.slice(uploadIndex + 1);
    if (/^v\d+$/.test(afterUpload[0])) afterUpload.shift();
    const publicIdWithExt = afterUpload.join('/');
    const publicId = publicIdWithExt.replace(/\.[^/.]+$/, '');
    await cloudinary.uploader.destroy(publicId, { resource_type: 'image' });
  } catch (error) {
    logger.error('Cloudinary delete error: %s', error.message);
  }
};

module.exports = { uploadBase64, deleteByUrl };

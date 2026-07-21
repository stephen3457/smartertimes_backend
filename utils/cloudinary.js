const cloudinary = require('cloudinary').v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'wahwb37z',
  api_key: process.env.CLOUDINARY_API_KEY || '976897759294125',
  api_secret: process.env.CLOUDINARY_API_SECRET || '5b4ahP2kHN7rZXSIkT62bdqmgtI',
});

/**
 * Upload image buffer to Cloudinary with automatic optimization & high clarity
 * @param {Buffer} buffer - Image file buffer
 * @param {string} folder - Destination folder in Cloudinary
 * @returns {Promise<{ secure_url: string, public_id: string }>}
 */
const uploadToCloudinary = (buffer, folder = 'smartertimes_watches') => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: 'image',
        transformation: [
          { width: 1200, crop: 'limit' },
          { quality: 'auto:good' },
          { fetch_format: 'auto' },
        ],
      },
      (error, result) => {
        if (error) {
          console.error('Cloudinary Upload Stream Error:', error);
          return reject(error);
        }
        resolve({
          secure_url: result.secure_url,
          public_id: result.public_id,
        });
      }
    );
    uploadStream.end(buffer);
  });
};

/**
 * Delete image from Cloudinary by public_id
 * @param {string} publicId - Cloudinary asset public ID
 * @returns {Promise<any>}
 */
const deleteFromCloudinary = async (publicId) => {
  if (!publicId) return null;
  try {
    const result = await cloudinary.uploader.destroy(publicId);
    console.log(`[CLOUDINARY] Image deleted (${publicId}):`, result);
    return result;
  } catch (error) {
    console.error(`[CLOUDINARY ERROR] Failed to delete image (${publicId}):`, error.message);
    return null;
  }
};

module.exports = {
  cloudinary,
  uploadToCloudinary,
  deleteFromCloudinary,
};

const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');

// Configuration
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

// Storage configurations for different upload types
const storageConfigs = {
  // Profile images (avatars, covers)
  profiles: new CloudinaryStorage({
    cloudinary,
    params: {
      folder: 'social-app/profiles',
      allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
      transformation: [{ width: 500, height: 500, crop: 'fill', quality: 'auto' }],
      public_id: (req, file) => `profile_${req.user?._id || 'anonymous'}_${Date.now()}`,
    },
  }),

  // Post media (images)
  posts: new CloudinaryStorage({
    cloudinary,
    params: {
      folder: 'social-app/posts',
      allowed_formats: ['jpg', 'jpeg', 'png', 'webp', 'gif'],
      transformation: [{ quality: 'auto', fetch_format: 'auto' }],
      public_id: (req, file) => `post_${req.user?._id || 'anonymous'}_${Date.now()}`,
    },
  }),

  // Post videos
  videos: new CloudinaryStorage({
    cloudinary,
    params: {
      folder: 'social-app/videos',
      resource_type: 'video',
      allowed_formats: ['mp4', 'mov', 'avi', 'webm'],
      transformation: [
        { quality: 'auto:good' },
        { fetch_format: 'auto' },
      ],
      public_id: (req, file) => `video_${req.user?._id || 'anonymous'}_${Date.now()}`,
    },
  }),

  // Audio comments
  audio: new CloudinaryStorage({
    cloudinary,
    params: {
      folder: 'social-app/audio',
      resource_type: 'video', // Cloudinary treats audio as video
      allowed_formats: ['mp3', 'wav', 'ogg', 'm4a', 'webm'],
      public_id: (req, file) => `audio_${req.user?._id || 'anonymous'}_${Date.now()}`,
    },
  }),

  // Stories (auto-expire)
  stories: new CloudinaryStorage({
    cloudinary,
    params: {
      folder: 'social-app/stories',
      allowed_formats: ['jpg', 'jpeg', 'png', 'mp4', 'mov'],
      transformation: [{ quality: 'auto' }],
      public_id: (req, file) => `story_${req.user?._id || 'anonymous'}_${Date.now()}`,
    },
  }),
};

// Upload helpers
const uploadToCloudinary = async (file, folder = 'social-app/misc') => {
  try {
    const result = await cloudinary.uploader.upload(file, {
      folder,
      resource_type: 'auto',
      quality: 'auto',
      fetch_format: 'auto',
    });
    return {
      url: result.secure_url,
      publicId: result.public_id,
      format: result.format,
      size: result.bytes,
      width: result.width,
      height: result.height,
    };
  } catch (error) {
    throw new Error(`Cloudinary upload failed: ${error.message}`);
  }
};

// Upload video with transformation
const uploadVideo = async (file, options = {}) => {
  try {
    const result = await cloudinary.uploader.upload(file, {
      folder: options.folder || 'social-app/videos',
      resource_type: 'video',
      eager: [
        { streaming_profile: 'full_hd', format: 'm3u8' }, // HLS streaming
        { width: 640, crop: 'scale', format: 'mp4' }, // Mobile fallback
      ],
      eager_async: true,
      ...options,
    });
    return {
      url: result.secure_url,
      publicId: result.public_id,
      duration: result.duration,
      streamingUrl: result.eager?.[0]?.secure_url,
    };
  } catch (error) {
    throw new Error(`Video upload failed: ${error.message}`);
  }
};

// Delete from Cloudinary
const deleteFromCloudinary = async (publicId, resourceType = 'image') => {
  try {
    const result = await cloudinary.uploader.destroy(publicId, {
      resource_type: resourceType,
    });
    return result.result === 'ok';
  } catch (error) {
    console.error('Cloudinary delete error:', error);
    return false;
  }
};

// Bulk delete
const deleteMultiple = async (publicIds, resourceType = 'image') => {
  try {
    const result = await cloudinary.api.delete_resources(publicIds, {
      resource_type: resourceType,
    });
    return result;
  } catch (error) {
    console.error('Bulk delete error:', error);
    throw error;
  }
};

// Generate signed URL for private media
const generateSignedUrl = (publicId, options = {}) => {
  const timestamp = Math.round(new Date().getTime() / 1000);
  const signature = cloudinary.utils.api_sign_request(
    {
      timestamp,
      public_id: publicId,
      ...options,
    },
    process.env.CLOUDINARY_API_SECRET
  );

  return {
    url: cloudinary.url(publicId, {
      secure: true,
      sign_url: true,
      api_key: process.env.CLOUDINARY_API_KEY,
      timestamp,
      signature,
      ...options,
    }),
    expiresAt: new Date((timestamp + 3600) * 1000), // 1 hour
  };
};

// Create video thumbnail
const generateThumbnail = (videoPublicId, options = {}) => {
  return cloudinary.url(videoPublicId, {
    resource_type: 'video',
    transformation: [
      { width: options.width || 640, crop: 'scale' },
      { start_offset: options.offset || 'auto' },
      { format: 'jpg' },
    ],
    secure: true,
  });
};

// Extract public_id from Cloudinary URL
const getPublicIdFromUrl = (url) => {
  if (!url) return null;
  
  try {
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split('/');
    const filename = pathParts[pathParts.length - 1];
    const publicId = filename.split('.')[0]; // Remove extension
    
    // Reconstruct full public_id with folder
    const folderIndex = pathParts.indexOf('upload');
    if (folderIndex > -1) {
      const folderPath = pathParts.slice(folderIndex + 1, -1).join('/');
      return folderPath ? `${folderPath}/${publicId}` : publicId;
    }
    
    return publicId;
  } catch (error) {
    return null;
  }
};

// ✅ تصدير واحد فقط
module.exports = {
  cloudinary,
  storageConfigs,
  uploadToCloudinary,
  uploadVideo,
  deleteFromCloudinary,
  deleteMultiple,
  generateSignedUrl,
  generateThumbnail,
  getPublicIdFromUrl,
};
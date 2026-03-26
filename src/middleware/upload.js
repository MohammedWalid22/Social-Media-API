const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { AppError } = require('./errorHandler');

// Ensure upload directory exists
const uploadDir = path.join(process.cwd(), 'tmp', 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${uuidv4()}${path.extname(file.originalname).toLowerCase()}`;
    cb(null, uniqueName);
  },
});

// Validate file types and extensions
const fileFilter = (req, file, cb) => {
  // Allowed extensions
  const allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.mp4', '.mov', '.avi', '.webm', '.mp3', '.wav', '.ogg', '.m4a', '.webm'];
  const ext = path.extname(file.originalname).toLowerCase();
  
  if (!allowedExtensions.includes(ext)) {
    return cb(new AppError(`Invalid file extension: ${ext}`, 400), false);
  }

  // Allowed MIME types
  const imageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  const videoTypes = ['video/mp4', 'video/quicktime', 'video/avi', 'video/webm'];
  const audioTypes = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/webm', 'audio/mp4', 'audio/m4a', 'audio/aac'];

  const allowedTypes = [...imageTypes, ...videoTypes, ...audioTypes];
  
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new AppError(`Invalid file type: ${file.mimetype}`, 400), false);
  }
};

// General upload config
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB
    files: 10,
  },
});

// Audio-specific config
upload.audio = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowedExtensions = ['.mp3', '.wav', '.ogg', '.m4a', '.webm'];
    const ext = path.extname(file.originalname).toLowerCase();
    
    if (!allowedExtensions.includes(ext)) {
      return cb(new AppError(`Invalid audio extension: ${ext}`, 400), false);
    }

    const audioTypes = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/webm', 'audio/mp4', 'audio/m4a'];
    
    if (audioTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new AppError('Only audio files allowed', 400), false);
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB for audio
    files: 1,
  },
});

// Cleanup middleware
upload.cleanupOnError = async (req, res, next) => {
  if (req.file) {
    try {
      await fs.promises.unlink(req.file.path);
    } catch (err) {
      // Ignore cleanup errors
    }
  }
  next();
};

module.exports = upload;
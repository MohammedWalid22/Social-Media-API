const { Storage } = require('@google-cloud/storage');
const logger = require('../utils/logger');

class CloudStorageService {
  constructor() {
    this.storage = null;
    this.bucket = null;
    
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      try {
        this.storage = new Storage();
        this.bucket = this.storage.bucket(process.env.GCS_BUCKET_NAME);
        logger.info('✅ Google Cloud Storage initialized');
      } catch (error) {
        logger.error('GCS initialization failed:', error);
      }
    }
  }

  async uploadFile(buffer, filename, folder, options = {}) {
    if (!this.bucket) {
      throw new Error('GCS not configured');
    }

    try {
      const destination = `${folder}/${filename}`;
      const file = this.bucket.file(destination);
      
      await file.save(buffer, {
        metadata: {
          contentType: options.contentType || 'application/octet-stream',
          metadata: options.metadata || {},
        },
        resumable: false,
      });

      // Make public if specified
      if (options.public !== false) {
        await file.makePublic();
      }

      const publicUrl = `https://storage.googleapis.com/${process.env.GCS_BUCKET_NAME}/${destination}`;
      
      return {
        url: publicUrl,
        publicId: destination,
        filename: filename,
      };
    } catch (error) {
      logger.error('GCS upload error:', error);
      throw error;
    }
  }

  async uploadStream(stream, filename, folder, options = {}) {
    if (!this.bucket) {
      throw new Error('GCS not configured');
    }

    return new Promise((resolve, reject) => {
      const destination = `${folder}/${filename}`;
      const file = this.bucket.file(destination);
      
      const writeStream = file.createWriteStream({
        metadata: {
          contentType: options.contentType,
        },
      });

      stream.pipe(writeStream);

      writeStream.on('finish', async () => {
        if (options.public !== false) {
          await file.makePublic();
        }
        
        resolve({
          url: `https://storage.googleapis.com/${process.env.GCS_BUCKET_NAME}/${destination}`,
          publicId: destination,
        });
      });

      writeStream.on('error', reject);
    });
  }

  async deleteFile(filename) {
    if (!this.bucket) {
      logger.warn('GCS not configured, skipping delete');
      return false;
    }

    try {
      await this.bucket.file(filename).delete();
      return true;
    } catch (error) {
      if (error.code === 404) {
        return true; // Already deleted
      }
      logger.error('GCS delete error:', error);
      return false;
    }
  }

  async deleteMultiple(filenames) {
    const results = await Promise.all(
      filenames.map(filename => this.deleteFile(filename))
    );
    return results.every(r => r);
  }

  async getSignedUrl(filename, expiresInMinutes = 60) {
    if (!this.bucket) {
      throw new Error('GCS not configured');
    }

    const [url] = await this.bucket
      .file(filename)
      .getSignedUrl({
        action: 'read',
        expires: Date.now() + expiresInMinutes * 60 * 1000,
      });

    return url;
  }
}

module.exports = new CloudStorageService();
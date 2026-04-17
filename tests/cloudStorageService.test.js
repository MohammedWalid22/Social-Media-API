const { Storage } = require('@google-cloud/storage');
const stream = require('stream');

// Mock Google Cloud Storage First
jest.mock('@google-cloud/storage', () => {
  const mBucket = {
    file: jest.fn(),
  };
  const mStorage = {
    bucket: jest.fn(() => mBucket),
  };
  return { Storage: jest.fn(() => mStorage) };
});

jest.mock('../src/utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn()
}));

const cloudStorageService = require('../src/services/cloudStorageService');

describe('CloudStorageService Unit Tests', () => {
  let fileMock;
  let bucketMock;

  beforeAll(() => {
    // Initialise with process.env.GOOGLE_APPLICATION_CREDENTIALS so it sets up buckets
    process.env.GOOGLE_APPLICATION_CREDENTIALS = 'mock-cred.json';
    process.env.GCS_BUCKET_NAME = 'mock-bucket';
    // Re-initialize to apply env vars
    // We can't easily re-run the constructor unless we create a new instance, so let's mock the bucket directly
    cloudStorageService.storage = new Storage();
    cloudStorageService.bucket = cloudStorageService.storage.bucket('mock-bucket');
  });

  beforeEach(() => {
    jest.clearAllMocks();

    fileMock = {
      save: jest.fn().mockResolvedValue(),
      makePublic: jest.fn().mockResolvedValue(),
      delete: jest.fn().mockResolvedValue(),
      getSignedUrl: jest.fn().mockResolvedValue(['https://signed.url/file']),
      createWriteStream: jest.fn()
    };

    bucketMock = {
      file: jest.fn().mockReturnValue(fileMock)
    };
    
    cloudStorageService.bucket = bucketMock;
  });

  describe('Initialization', () => {
    it('should handle initialization error without crashing', () => {
      jest.isolateModules(() => {
        const { Storage } = require('@google-cloud/storage');
        Storage.mockImplementationOnce(() => {
          throw new Error('Init failure');
        });
        
        const service = require('../src/services/cloudStorageService');
        expect(service.storage).toBeNull();
      });
    });
  });

  describe('uploadFile', () => {
    it('should upload a file and return public URL', async () => {
      const result = await cloudStorageService.uploadFile(Buffer.from('test'), 'test.txt', 'uploads');
      
      expect(bucketMock.file).toHaveBeenCalledWith('uploads/test.txt');
      expect(fileMock.save).toHaveBeenCalled();
      expect(fileMock.makePublic).toHaveBeenCalled();
      expect(result.url).toBe('https://storage.googleapis.com/mock-bucket/uploads/test.txt');
    });

    it('should not make file public if options.public is false', async () => {
      await cloudStorageService.uploadFile(Buffer.from('test'), 'test.txt', 'uploads', { public: false });
      expect(fileMock.makePublic).not.toHaveBeenCalled();
    });

    it('should throw an error if bucket is not configured', async () => {
      cloudStorageService.bucket = null;
      await expect(cloudStorageService.uploadFile(Buffer.from('test'), 'test.txt', 'uploads'))
        .rejects.toThrow('GCS not configured');
    });

    it('should throw and log if upload fails', async () => {
      fileMock.save.mockRejectedValue(new Error('Upload failed'));
      await expect(cloudStorageService.uploadFile(Buffer.from('test'), 'test.txt', 'uploads'))
        .rejects.toThrow('Upload failed');
    });
  });

  describe('uploadStream', () => {
    it('should upload stream and return url', async () => {
      const mockStream = new stream.PassThrough();
      const mockWriteStream = new stream.PassThrough();
      
      fileMock.createWriteStream.mockReturnValue(mockWriteStream);
      
      const uploadPromise = cloudStorageService.uploadStream(mockStream, 'stream.txt', 'uploads');
      
      // Simulate stream finish
      mockStream.end('test data');
      
      const result = await uploadPromise;
      expect(fileMock.createWriteStream).toHaveBeenCalled();
      expect(fileMock.makePublic).toHaveBeenCalled();
      expect(result.url).toContain('uploads/stream.txt');
    });

    it('should throw error if bucket is not configured', async () => {
      cloudStorageService.bucket = null;
      await expect(cloudStorageService.uploadStream(null, 'test', 'folds')).rejects.toThrow('GCS not configured');
    });
  });

  describe('deleteFile', () => {
    it('should delete a file', async () => {
      const result = await cloudStorageService.deleteFile('uploads/test.txt');
      expect(bucketMock.file).toHaveBeenCalledWith('uploads/test.txt');
      expect(fileMock.delete).toHaveBeenCalled();
      expect(result).toBe(true);
    });

    it('should return true if file already deleted (404)', async () => {
      const error = new Error('Not found');
      error.code = 404;
      fileMock.delete.mockRejectedValue(error);
      
      const result = await cloudStorageService.deleteFile('uploads/missing.txt');
      expect(result).toBe(true);
    });

    it('should return false if delete fails', async () => {
      fileMock.delete.mockRejectedValue(new Error('Delete error'));
      const result = await cloudStorageService.deleteFile('uploads/fail.txt');
      expect(result).toBe(false);
    });

    it('should return false if bucket is not configured', async () => {
      cloudStorageService.bucket = null;
      const result = await cloudStorageService.deleteFile('test');
      expect(result).toBe(false);
    });
  });

  describe('deleteMultiple', () => {
    it('should delete multiple files', async () => {
      const result = await cloudStorageService.deleteMultiple(['f1.txt', 'f2.txt']);
      expect(bucketMock.file).toHaveBeenCalledTimes(2);
      expect(result).toBe(true);
    });
  });

  describe('getSignedUrl', () => {
    it('should get a signed url', async () => {
      const url = await cloudStorageService.getSignedUrl('secret.txt');
      expect(bucketMock.file).toHaveBeenCalledWith('secret.txt');
      expect(fileMock.getSignedUrl).toHaveBeenCalled();
      expect(url).toBe('https://signed.url/file');
    });

    it('should throw if bucket is not configured', async () => {
      cloudStorageService.bucket = null;
      await expect(cloudStorageService.getSignedUrl('test')).rejects.toThrow('GCS not configured');
    });
  });
});

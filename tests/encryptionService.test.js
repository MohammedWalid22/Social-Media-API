const encryptionService = require('../src/services/encryptionService');

describe('EncryptionService Unit Tests', () => {
  // ─── generateKeyPair ──────────────────────────────────────────────────────
  describe('generateKeyPair', () => {
    it('should return a publicKey and privateKey in PEM format', () => {
      const { publicKey, privateKey } = encryptionService.generateKeyPair();
      expect(publicKey).toContain('BEGIN PUBLIC KEY');
      expect(privateKey).toContain('BEGIN PRIVATE KEY');
    });
  });

  // ─── encryptMessage / decryptMessage (RSA hybrid) ─────────────────────────
  describe('encryptMessage + decryptMessage (RSA hybrid)', () => {
    let publicKey, privateKey;

    beforeAll(() => {
      const pair = encryptionService.generateKeyPair();
      publicKey = pair.publicKey;
      privateKey = pair.privateKey;
    });

    it('should encrypt and decrypt a message successfully', () => {
      const original = 'Hello, Encrypted World!';
      const encryptedData = encryptionService.encryptMessage(original, publicKey);

      expect(encryptedData).toHaveProperty('encrypted');
      expect(encryptedData).toHaveProperty('iv');
      expect(encryptedData).toHaveProperty('authTag');
      expect(encryptedData).toHaveProperty('encryptedKey');

      const decrypted = encryptionService.decryptMessage(encryptedData, privateKey);
      expect(decrypted).toBe(original);
    });

    it('should throw when encryption fails with invalid key', () => {
      expect(() => encryptionService.encryptMessage('test', 'not-a-real-key')).toThrow('Encryption failed');
    });

    it('should throw when decryption fails with wrong key', () => {
      const { publicKey: pk2 } = encryptionService.generateKeyPair();
      const encrypted = encryptionService.encryptMessage('secret', publicKey);
      // Use a different private key - should fail
      const { privateKey: wrongPk } = encryptionService.generateKeyPair();
      expect(() => encryptionService.decryptMessage(encrypted, wrongPk)).toThrow('Decryption failed');
    });
  });

  // ─── encryptForStorage / decryptFromStorage (AES-256-GCM) ────────────────
  describe('encryptForStorage + decryptFromStorage (AES-256-GCM)', () => {
    const key = Buffer.alloc(32, 'a'); // 32-byte symmetric key

    it('should encrypt and decrypt data for storage', () => {
      const plaintext = 'Sensitive user data';
      const encryptedData = encryptionService.encryptForStorage(plaintext, key);

      expect(encryptedData).toHaveProperty('encrypted');
      expect(encryptedData).toHaveProperty('iv');
      expect(encryptedData).toHaveProperty('authTag');
      expect(encryptedData.encrypted).not.toBe(plaintext);

      const decrypted = encryptionService.decryptFromStorage(encryptedData, key);
      expect(decrypted).toBe(plaintext);
    });

    it('should produce different ciphertexts for the same plaintext (random IV)', () => {
      const key = Buffer.alloc(32, 'b');
      const text = 'same input';
      const enc1 = encryptionService.encryptForStorage(text, key);
      const enc2 = encryptionService.encryptForStorage(text, key);
      // IVs should differ due to randomness
      expect(enc1.iv).not.toBe(enc2.iv);
    });
  });

  // ─── deriveKey ────────────────────────────────────────────────────────────
  describe('deriveKey', () => {
    it('should derive a 32-byte key from password and salt', () => {
      const key = encryptionService.deriveKey('password123', 'random-salt');
      expect(Buffer.isBuffer(key)).toBe(true);
      expect(key.length).toBe(32);
    });

    it('should produce the same key for the same inputs (deterministic)', () => {
      const key1 = encryptionService.deriveKey('pass', 'salt');
      const key2 = encryptionService.deriveKey('pass', 'salt');
      expect(key1.toString('hex')).toBe(key2.toString('hex'));
    });

    it('should produce different keys for different passwords', () => {
      const key1 = encryptionService.deriveKey('password1', 'salt');
      const key2 = encryptionService.deriveKey('password2', 'salt');
      expect(key1.toString('hex')).not.toBe(key2.toString('hex'));
    });
  });
});

const ffmpeg = require('fluent-ffmpeg');
const ffmpegStatic = require('ffmpeg-static');
const path = require('path');
const fs = require('fs').promises;
const os = require('os');
const logger = require('../utils/logger');
const speech = require('@google-cloud/speech');

// Set ffmpeg path if available
if (ffmpegStatic) {
  ffmpeg.setFfmpegPath(ffmpegStatic);
}

class AudioProcessingService {
  constructor() {
    this.supportedFormats = ['mp3', 'ogg', 'webm', 'm4a', 'wav', 'aac'];
    this.speechClient = new speech.SpeechClient();
  }

  /**
   * Get audio metadata (duration, etc.)
   */
  async getAudioMetadata(inputPath) {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(inputPath, (err, metadata) => {
        if (err) return reject(err);
        
        resolve({
          duration: metadata.format.duration,
          size: metadata.format.size,
          bitrate: metadata.format.bit_rate,
          format: metadata.format.format_name,
        });
      });
    });
  }

  /**
   * Process uploaded audio file
   */
  async processAudio(inputPath, options = {}) {
    const tempDir = os.tmpdir();
    const outputFileName = `processed_${Date.now()}.mp3`;
    const outputPath = path.join(tempDir, outputFileName);
    
    try {
      // Compress and normalize audio
      await this.compressAudio(inputPath, outputPath, options);
      
      // Generate waveform data for visualization
      const waveformData = await this.generateWaveform(outputPath);
      
      // Get audio metadata
      const metadata = await this.getAudioMetadata(outputPath);
      
      // Cleanup temp files
      await this.cleanup([inputPath, outputPath]);
      
      return {
        url: null, // Will be set after cloud upload
        publicId: null,
        duration: metadata.duration,
        format: 'mp3',
        size: metadata.size,
        bitrate: options.bitrate || 128000,
        waveformData,
        variants: [],
      };
      
    } catch (error) {
      await this.cleanup([inputPath, outputPath]);
      throw error;
    }
  }

  /**
   * Compress and normalize audio using ffmpeg
   */
  compressAudio(inputPath, outputPath, options = {}) {
    return new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .audioCodec('libmp3lame')
        .audioBitrate(options.bitrate || 128)
        .audioFrequency(44100)
        .audioChannels(2)
        .audioFilters([
          'loudnorm=I=-16:TP=-1.5:LRA=11',
          'afftdn=nf=-25',
          'highpass=f=80',
          'lowpass=f=15000',
        ])
        .format('mp3')
        .on('end', () => resolve(outputPath))
        .on('error', (err) => reject(err))
        .save(outputPath);
    });
  }

  /**
   * Generate waveform data for visualization
   */
  async generateWaveform(audioPath) {
    // Simplified version - returns dummy data for now
    // In production, use audiowaveform or similar
    return Array(100).fill(0).map(() => Math.floor(Math.random() * 100));
  }

  /**
   * Transcribe audio utilizing Google Speech-to-Text
   */
  async transcribeAudio(audioUrl) {
    try {
      logger.info('Transcription requested for:', audioUrl);
      let request;
      
      const config = {
        encoding: 'MP3',
        sampleRateHertz: 44100,
        languageCode: 'ar-SA',
        alternativeLanguageCodes: ['en-US', 'ar-EG'],
      };

      if (audioUrl.startsWith('http')) {
        const response = await fetch(audioUrl);
        const buffer = await response.arrayBuffer();
        request = {
          audio: { content: Buffer.from(buffer).toString('base64') },
          config: config,
        };
      } else if (audioUrl.startsWith('gs://')) {
        request = { audio: { uri: audioUrl }, config };
      } else {
        // Local file
        const fileContent = await fs.readFile(audioUrl);
        request = {
          audio: { content: fileContent.toString('base64') },
          config: config,
        };
      }

      const [response] = await this.speechClient.recognize(request);
      
      const transcription = response.results
        .map(result => result.alternatives[0].transcript)
        .join('\n');
        
      const confidence = response.results.length > 0 
        ? response.results[0].alternatives[0].confidence 
        : 0;

      return {
        text: transcription,
        language: 'ar-SA',
        confidence: confidence,
        processed: true,
      };
    } catch (error) {
      logger.error('Transcription error:', error);
      return { text: '', language: 'unknown', confidence: 0, processed: false, error: error.message };
    }
  }

  /**
   * Analyze voice characteristics (placeholder)
   */
  async analyzeVoice(audioPath) {
    // TODO: Implement voice analysis
    return {
      gender: 'unknown',
      ageEstimate: 'adult',
      emotion: 'neutral',
    };
  }

  /**
   * Cleanup temp files
   */
  async cleanup(files) {
    for (const file of files) {
      try {
        if (file) await fs.unlink(file);
      } catch (err) {
        // Ignore cleanup errors
      }
    }
  }
}

module.exports = new AudioProcessingService();
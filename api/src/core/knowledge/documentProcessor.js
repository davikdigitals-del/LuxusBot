import fs from 'fs/promises';
import path from 'path';
import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';
import logger from '../../utils/logger.js';

class DocumentProcessor {
  constructor() {
    this.supportedFormats = ['.txt', '.pdf', '.doc', '.docx', '.md', '.json'];
    this.chunkSize = 1000; // characters per chunk
    this.chunkOverlap = 200; // overlap between chunks
  }

  /**
   * Guard against a chunkOverlap >= chunkSize, which stalls splitIntoChunks
   * (start never advances, so the loop never terminates).
   */
  assertValidChunkConfig() {
    if (!(this.chunkSize > 0) || !(this.chunkOverlap >= 0) || this.chunkOverlap >= this.chunkSize) {
      throw new Error(
        `Invalid chunk config: chunkSize=${this.chunkSize}, chunkOverlap=${this.chunkOverlap} (overlap must be smaller than size)`
      );
    }
  }

  /**
   * Process file
   */
  async processFile(filePath) {
    try {
      const ext = path.extname(filePath).toLowerCase();

      if (!this.supportedFormats.includes(ext)) {
        throw new Error(`Unsupported file format: ${ext}`);
      }

      logger.info(`Processing file: ${filePath}`);

      let text = '';
      const metadata = {
        filename: path.basename(filePath),
        format: ext,
        processedAt: new Date().toISOString(),
      };

      switch (ext) {
        case '.txt':
        case '.md':
          text = await this.processTxt(filePath);
          break;
        case '.pdf':
          text = await this.processPdf(filePath);
          break;
        case '.doc':
        case '.docx':
          text = await this.processDocx(filePath);
          break;
        case '.json':
          text = await this.processJson(filePath);
          break;
        default:
          throw new Error(`Unsupported format: ${ext}`);
      }

      // Clean text
      text = this.cleanText(text);

      // Split into chunks
      const chunks = this.splitIntoChunks(text);

      logger.info(`Processed file into ${chunks.length} chunks`);

      return {
        text,
        chunks,
        metadata,
      };
    } catch (error) {
      logger.error('Error processing file:', error);
      throw error;
    }
  }

  /**
   * Process text file
   */
  async processTxt(filePath) {
    const buffer = await fs.readFile(filePath);
    return buffer.toString('utf-8');
  }

  /**
   * Process PDF file
   */
  async processPdf(filePath) {
    try {
      const buffer = await fs.readFile(filePath);
      const data = await pdfParse(buffer);
      return data.text;
    } catch (error) {
      logger.error('Error processing PDF:', error);
      throw new Error('Failed to process PDF file');
    }
  }

  /**
   * Process Word document
   */
  async processDocx(filePath) {
    try {
      const buffer = await fs.readFile(filePath);
      const result = await mammoth.extractRawText({ buffer });
      return result.value;
    } catch (error) {
      logger.error('Error processing DOCX:', error);
      throw new Error('Failed to process DOCX file');
    }
  }

  /**
   * Process JSON file
   */
  async processJson(filePath) {
    const buffer = await fs.readFile(filePath);
    const data = JSON.parse(buffer.toString('utf-8'));
    return JSON.stringify(data, null, 2);
  }

  /**
   * Process directory
   */
  async processDirectory(directoryPath) {
    try {
      const files = await fs.readdir(directoryPath);
      const results = [];

      for (const file of files) {
        const filePath = path.join(directoryPath, file);
        const stats = await fs.stat(filePath);

        if (stats.isFile()) {
          const ext = path.extname(file).toLowerCase();
          if (this.supportedFormats.includes(ext)) {
            try {
              const result = await this.processFile(filePath);
              results.push({
                filename: file,
                ...result,
              });
            } catch (error) {
              logger.error(`Error processing ${file}:`, error);
            }
          }
        }
      }

      logger.info(`Processed ${results.length} files from directory`);
      return results;
    } catch (error) {
      logger.error('Error processing directory:', error);
      throw error;
    }
  }

  /**
   * Clean text
   */
  cleanText(text) {
    return text
      .replace(/\r\n/g, '\n') // Normalize line endings
      .replace(/\n{3,}/g, '\n\n') // Remove excessive newlines
      .replace(/\t/g, ' ') // Replace tabs with spaces
      .replace(/  +/g, ' ') // Remove excessive spaces
      .trim();
  }

  /**
   * Split text into chunks
   */
  splitIntoChunks(text) {
    this.assertValidChunkConfig();
    const chunks = [];
    let start = 0;

    while (start < text.length) {
      let end = start + this.chunkSize;

      // Try to break at sentence boundary
      if (end < text.length) {
        const sentenceEnd = text.lastIndexOf('.', end);
        if (sentenceEnd > start && sentenceEnd - start > this.chunkSize / 2) {
          end = sentenceEnd + 1;
        }
      }

      const chunk = text.substring(start, end).trim();
      if (chunk.length > 0) {
        chunks.push(chunk);
      }

      start = end - this.chunkOverlap;
    }

    return chunks;
  }

  /**
   * Extract metadata from text
   */
  extractMetadata(text) {
    const metadata = {};

    // Extract title (first line or heading)
    const lines = text.split('\n');
    if (lines[0]) {
      metadata.title = lines[0].replace(/^#+\s*/, '').trim();
    }

    // Word count
    metadata.wordCount = text.split(/\s+/).length;

    // Character count
    metadata.charCount = text.length;

    // Extract keywords (simple approach)
    const words = text.toLowerCase().match(/\b\w{4,}\b/g) || [];
    const wordFreq = {};
    words.forEach(word => {
      wordFreq[word] = (wordFreq[word] || 0) + 1;
    });

    metadata.keywords = Object.entries(wordFreq)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([word]) => word);

    return metadata;
  }

  /**
   * Process text content directly
   */
  async processText(text, metadata = {}) {
    try {
      const cleanedText = this.cleanText(text);
      const chunks = this.splitIntoChunks(cleanedText);
      const extractedMetadata = this.extractMetadata(cleanedText);

      return {
        text: cleanedText,
        chunks,
        metadata: {
          ...extractedMetadata,
          ...metadata,
          processedAt: new Date().toISOString(),
        },
      };
    } catch (error) {
      logger.error('Error processing text:', error);
      throw error;
    }
  }

  /**
   * Get supported formats
   */
  getSupportedFormats() {
    return this.supportedFormats;
  }

  /**
   * Set chunk size
   */
  setChunkSize(size, overlap) {
    const resolvedOverlap = overlap ?? Math.floor(size * 0.2);
    if (!(size > 0) || !(resolvedOverlap >= 0) || resolvedOverlap >= size) {
      throw new Error(`Invalid chunk size/overlap: size=${size}, overlap=${resolvedOverlap}`);
    }
    this.chunkSize = size;
    this.chunkOverlap = resolvedOverlap;
  }
}

export default DocumentProcessor;

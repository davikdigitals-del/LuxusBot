import logger from '../../utils/logger.js';
import VectorStore from './vectorStore.js';
import DocumentProcessor from './documentProcessor.js';
import { KnowledgeBase as KnowledgeBaseModel } from '../../models/index.js';

/**
 * Tenant-scoped knowledge base. Every document, search, and vector-store
 * collection is isolated to one businessId so one tenant's uploads never
 * surface in another tenant's assistant answers.
 */
class KnowledgeBase {
  constructor(aiEngine, businessId) {
    if (!businessId) {
      throw new Error('KnowledgeBase requires a businessId');
    }
    this.aiEngine = aiEngine;
    this.businessId = String(businessId);
    this.vectorStore = new VectorStore(aiEngine, `kb_${this.businessId}`);
    this.documentProcessor = new DocumentProcessor();
    this.isInitialized = false;
    this.cache = new Map(); // Simple in-memory cache, keyed per instance (per business)
    this.cacheTimeout = 300000; // 5 minutes
  }

  /**
   * Initialize knowledge base
   */
  async initialize() {
    try {
      logger.info(`Initializing knowledge base for business ${this.businessId}...`);

      await this.vectorStore.initialize();
      await this.syncToVectorStore();

      this.isInitialized = true;
      logger.info('✅ Knowledge base initialized successfully');
      return true;
    } catch (error) {
      logger.error('Error initializing knowledge base:', error);
      this.isInitialized = false;
      return false;
    }
  }

  /**
   * Add document to knowledge base
   */
  async addDocument(params) {
    try {
      const { title, content, category, subcategory, tags, source, metadata } = params;

      const processed = await this.documentProcessor.processText(content, {
        title,
        category,
        subcategory,
      });

      const doc = new KnowledgeBaseModel({
        businessId: this.businessId,
        title,
        content,
        category,
        subcategory: subcategory || '',
        tags: tags || [],
        keywords: processed.metadata.keywords || [],
        source: source || { type: 'manual' },
        metadata: metadata || {},
        status: 'published',
        publishedAt: new Date(),
      });

      await doc.save();

      if (this.vectorStore.isReady()) {
        const documents = processed.chunks.map((chunk, index) => ({
          id: `${doc._id}-chunk-${index}`,
          text: chunk,
          metadata: {
            docId: doc._id.toString(),
            businessId: this.businessId,
            title,
            category,
            chunkIndex: index,
          },
        }));

        await this.vectorStore.addDocuments(documents);

        doc.vectorId = doc._id.toString();
        await doc.save();
      }

      logger.info(`Added document to knowledge base (business ${this.businessId}): ${title}`);

      this.cache.clear();

      return doc;
    } catch (error) {
      logger.error('Error adding document:', error);
      throw error;
    }
  }

  /**
   * Add document from file
   */
  async addFromFile(filePath, category, subcategory, tags) {
    try {
      const processed = await this.documentProcessor.processFile(filePath);

      const params = {
        title: processed.metadata.title || processed.metadata.filename,
        content: processed.text,
        category,
        subcategory,
        tags,
        source: {
          type: 'document',
          filename: processed.metadata.filename,
        },
        metadata: processed.metadata,
      };

      return await this.addDocument(params);
    } catch (error) {
      logger.error('Error adding document from file:', error);
      throw error;
    }
  }

  /**
   * Search knowledge base (scoped to this.businessId's vector collection and documents)
   */
  async search(query, limit = 5, options = {}) {
    try {
      const cacheKey = `search:${query}:${limit}`;

      if (this.cache.has(cacheKey)) {
        const cached = this.cache.get(cacheKey);
        if (Date.now() - cached.timestamp < this.cacheTimeout) {
          logger.debug('Returning cached search results');
          return cached.results;
        }
      }

      const results = [];

      if (this.vectorStore.isReady()) {
        const vectorResults = await this.vectorStore.search(query, limit * 2);

        for (const result of vectorResults) {
          const docId = result.metadata.docId;

          // Scope by businessId even though the collection is already per-tenant:
          // cheap defense in depth against a stale/misrouted vector entry.
          const doc = await KnowledgeBaseModel.findOne({ _id: docId, businessId: this.businessId });

          if (doc && doc.status === 'published') {
            doc.incrementUsage();
            await doc.save();

            results.push({
              id: doc._id.toString(),
              title: doc.title,
              content: result.text,
              fullContent: doc.content,
              category: doc.category,
              subcategory: doc.subcategory,
              tags: doc.tags,
              score: result.score,
              chunkIndex: result.metadata.chunkIndex,
            });
          }
        }
      }

      // Fallback: Text search in database, still scoped to this tenant
      if (results.length === 0) {
        const dbResults = await KnowledgeBaseModel
          .find({
            businessId: this.businessId,
            $text: { $search: query },
            status: 'published',
          })
          .limit(limit)
          .sort({ score: { $meta: 'textScore' } });

        for (const doc of dbResults) {
          doc.incrementUsage();
          await doc.save();

          results.push({
            id: doc._id.toString(),
            title: doc.title,
            content: doc.content.substring(0, 500),
            fullContent: doc.content,
            category: doc.category,
            subcategory: doc.subcategory,
            tags: doc.tags,
            score: 0.5,
          });
        }
      }

      const limitedResults = results.slice(0, limit);

      this.cache.set(cacheKey, {
        results: limitedResults,
        timestamp: Date.now(),
      });

      logger.info(`Found ${limitedResults.length} knowledge base results for query`);
      return limitedResults;
    } catch (error) {
      logger.error('Error searching knowledge base:', error);
      return [];
    }
  }

  /**
   * Get document by ID (scoped to this tenant)
   */
  async getDocument(id) {
    try {
      return await KnowledgeBaseModel.findOne({ _id: id, businessId: this.businessId });
    } catch (error) {
      logger.error('Error getting document:', error);
      return null;
    }
  }

  /**
   * Update document (scoped to this tenant)
   */
  async updateDocument(id, updates) {
    try {
      const doc = await KnowledgeBaseModel.findOne({ _id: id, businessId: this.businessId });
      if (!doc) {
        throw new Error('Document not found');
      }

      // businessId is never editable via updates, even if a caller includes it
      const { businessId: _ignored, ...safeUpdates } = updates;
      Object.assign(doc, safeUpdates);
      doc.version += 1;
      await doc.save();

      if (safeUpdates.content && this.vectorStore.isReady()) {
        const processed = await this.documentProcessor.processText(safeUpdates.content);

        const oldChunks = await this.vectorStore.search(doc.title, 100);
        for (const chunk of oldChunks) {
          if (chunk.metadata.docId === id) {
            await this.vectorStore.deleteDocument(chunk.id);
          }
        }

        const documents = processed.chunks.map((chunk, index) => ({
          id: `${doc._id}-chunk-${index}`,
          text: chunk,
          metadata: {
            docId: doc._id.toString(),
            businessId: this.businessId,
            title: doc.title,
            category: doc.category,
            chunkIndex: index,
          },
        }));

        await this.vectorStore.addDocuments(documents);
      }

      this.cache.clear();
      logger.info(`Updated document: ${id}`);
      return doc;
    } catch (error) {
      logger.error('Error updating document:', error);
      throw error;
    }
  }

  /**
   * Delete document (scoped to this tenant)
   */
  async deleteDocument(id) {
    try {
      const doc = await KnowledgeBaseModel.findOne({ _id: id, businessId: this.businessId });
      if (!doc) {
        throw new Error('Document not found');
      }

      if (this.vectorStore.isReady() && doc.vectorId) {
        const chunks = await this.vectorStore.search(doc.title, 100);
        for (const chunk of chunks) {
          if (chunk.metadata.docId === id) {
            await this.vectorStore.deleteDocument(chunk.id);
          }
        }
      }

      await KnowledgeBaseModel.deleteOne({ _id: id, businessId: this.businessId });

      this.cache.clear();
      logger.info(`Deleted document: ${id}`);
      return true;
    } catch (error) {
      logger.error('Error deleting document:', error);
      throw error;
    }
  }

  /**
   * Get documents by category (scoped to this tenant)
   */
  async getByCategory(category, limit = 50) {
    try {
      return await KnowledgeBaseModel
        .find({ businessId: this.businessId, category, status: 'published' })
        .limit(limit)
        .sort({ createdAt: -1 });
    } catch (error) {
      logger.error('Error getting documents by category:', error);
      return [];
    }
  }

  /**
   * Get all categories (scoped to this tenant)
   */
  async getCategories() {
    try {
      return await KnowledgeBaseModel.distinct('category', { businessId: this.businessId });
    } catch (error) {
      logger.error('Error getting categories:', error);
      return [];
    }
  }

  /**
   * Sync this tenant's database documents to its vector store collection
   */
  async syncToVectorStore() {
    if (!this.vectorStore.isReady()) {
      logger.warn('Vector store not ready, skipping sync');
      return;
    }

    try {
      logger.info(`Syncing knowledge base to vector store (business ${this.businessId})...`);

      const docs = await KnowledgeBaseModel.find({ businessId: this.businessId, status: 'published' });
      let syncedCount = 0;

      for (const doc of docs) {
        try {
          const processed = await this.documentProcessor.processText(doc.content);

          const documents = processed.chunks.map((chunk, index) => ({
            id: `${doc._id}-chunk-${index}`,
            text: chunk,
            metadata: {
              docId: doc._id.toString(),
              businessId: this.businessId,
              title: doc.title,
              category: doc.category,
              chunkIndex: index,
            },
          }));

          await this.vectorStore.addDocuments(documents);
          syncedCount++;
        } catch (error) {
          logger.error(`Error syncing document ${doc._id}:`, error);
        }
      }

      logger.info(`Synced ${syncedCount} documents to vector store`);
    } catch (error) {
      logger.error('Error syncing to vector store:', error);
    }
  }

  /**
   * Get statistics (scoped to this tenant)
   */
  async getStatistics() {
    try {
      const total = await KnowledgeBaseModel.countDocuments({ businessId: this.businessId });
      const published = await KnowledgeBaseModel.countDocuments({ businessId: this.businessId, status: 'published' });
      const categories = await this.getCategories();
      const vectorCount = await this.vectorStore.count();

      return {
        total,
        published,
        categories: categories.length,
        vectorCount,
      };
    } catch (error) {
      logger.error('Error getting statistics:', error);
      return null;
    }
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.cache.clear();
    logger.info('Knowledge base cache cleared');
  }

  /**
   * Check if initialized
   */
  isReady() {
    return this.isInitialized;
  }
}

export default KnowledgeBase;

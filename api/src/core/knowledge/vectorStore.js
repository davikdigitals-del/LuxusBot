import { ChromaClient } from 'chromadb';
import logger from '../../utils/logger.js';
import config from '../../config/index.js';

class VectorStore {
  /**
   * @param {object} aiEngine - used to generate embeddings
   * @param {string} [collectionName] - defaults to the legacy single-tenant
   *   collection. Multi-tenant callers (KnowledgeBase) pass `kb_<businessId>`
   *   so one tenant's documents can never surface in another's search results.
   */
  constructor(aiEngine, collectionName) {
    this.aiEngine = aiEngine;
    this.client = null;
    this.collection = null;
    this.collectionName = collectionName || config.vectorDb.collection;
    this.isInitialized = false;
  }

  /**
   * Initialize vector store
   */
  async initialize() {
    try {
      logger.info('Initializing vector store...');

      // Try to connect to ChromaDB
      try {
        this.client = new ChromaClient({
          path: `http://${config.vectorDb.host}:${config.vectorDb.port}`,
        });

        // Get or create collection
        this.collection = await this.client.getOrCreateCollection({
          name: this.collectionName,
          metadata: { 'hnsw:space': 'cosine' },
        });

        this.isInitialized = true;
        logger.info('✅ Vector store initialized successfully');
      } catch (error) {
        logger.warn('ChromaDB not available, using in-memory fallback:', error.message);
        this.isInitialized = false;
      }

      return this.isInitialized;
    } catch (error) {
      logger.error('Error initializing vector store:', error);
      this.isInitialized = false;
      return false;
    }
  }

  /**
   * Add document to vector store
   */
  async addDocument(id, text, metadata = {}) {
    if (!this.isInitialized) {
      logger.warn('Vector store not initialized, skipping add');
      return false;
    }

    try {
      // Generate embeddings
      const embeddingResult = await this.aiEngine.generateEmbeddings(text);
      
      // Add to collection
      await this.collection.add({
        ids: [id],
        embeddings: [embeddingResult.embeddings],
        metadatas: [metadata],
        documents: [text],
      });

      logger.info(`Added document to vector store: ${id}`);
      return true;
    } catch (error) {
      logger.error('Error adding document to vector store:', error);
      return false;
    }
  }

  /**
   * Add multiple documents
   */
  async addDocuments(documents) {
    if (!this.isInitialized) {
      logger.warn('Vector store not initialized, skipping batch add');
      return false;
    }

    try {
      const ids = [];
      const embeddings = [];
      const metadatas = [];
      const docs = [];

      for (const doc of documents) {
        const embeddingResult = await this.aiEngine.generateEmbeddings(doc.text);
        
        ids.push(doc.id);
        embeddings.push(embeddingResult.embeddings);
        metadatas.push(doc.metadata || {});
        docs.push(doc.text);
      }

      await this.collection.add({
        ids,
        embeddings,
        metadatas,
        documents: docs,
      });

      logger.info(`Added ${documents.length} documents to vector store`);
      return true;
    } catch (error) {
      logger.error('Error adding documents to vector store:', error);
      return false;
    }
  }

  /**
   * Search for similar documents
   */
  async search(query, limit = 5) {
    if (!this.isInitialized) {
      logger.warn('Vector store not initialized, skipping search');
      return [];
    }

    try {
      // Generate query embedding
      const embeddingResult = await this.aiEngine.generateEmbeddings(query);

      // Search in collection
      const results = await this.collection.query({
        queryEmbeddings: [embeddingResult.embeddings],
        nResults: limit,
      });

      const documents = [];
      if (results.ids && results.ids[0]) {
        for (let i = 0; i < results.ids[0].length; i++) {
          documents.push({
            id: results.ids[0][i],
            text: results.documents[0][i],
            metadata: results.metadatas[0][i],
            distance: results.distances[0][i],
            score: 1 - results.distances[0][i], // Convert distance to similarity score
          });
        }
      }

      logger.debug(`Found ${documents.length} similar documents for query`);
      return documents;
    } catch (error) {
      logger.error('Error searching vector store:', error);
      return [];
    }
  }

  /**
   * Update document
   */
  async updateDocument(id, text, metadata = {}) {
    if (!this.isInitialized) {
      logger.warn('Vector store not initialized, skipping update');
      return false;
    }

    try {
      // Generate new embeddings
      const embeddingResult = await this.aiEngine.generateEmbeddings(text);

      // Update in collection
      await this.collection.update({
        ids: [id],
        embeddings: [embeddingResult.embeddings],
        metadatas: [metadata],
        documents: [text],
      });

      logger.info(`Updated document in vector store: ${id}`);
      return true;
    } catch (error) {
      logger.error('Error updating document in vector store:', error);
      return false;
    }
  }

  /**
   * Delete document
   */
  async deleteDocument(id) {
    if (!this.isInitialized) {
      logger.warn('Vector store not initialized, skipping delete');
      return false;
    }

    try {
      await this.collection.delete({
        ids: [id],
      });

      logger.info(`Deleted document from vector store: ${id}`);
      return true;
    } catch (error) {
      logger.error('Error deleting document from vector store:', error);
      return false;
    }
  }

  /**
   * Get document by ID
   */
  async getDocument(id) {
    if (!this.isInitialized) {
      logger.warn('Vector store not initialized, skipping get');
      return null;
    }

    try {
      const result = await this.collection.get({
        ids: [id],
      });

      if (result.ids && result.ids.length > 0) {
        return {
          id: result.ids[0],
          text: result.documents[0],
          metadata: result.metadatas[0],
        };
      }

      return null;
    } catch (error) {
      logger.error('Error getting document from vector store:', error);
      return null;
    }
  }

  /**
   * Count documents
   */
  async count() {
    if (!this.isInitialized) {
      return 0;
    }

    try {
      const result = await this.collection.count();
      return result;
    } catch (error) {
      logger.error('Error counting documents:', error);
      return 0;
    }
  }

  /**
   * Clear all documents
   */
  async clear() {
    if (!this.isInitialized) {
      return false;
    }

    try {
      // Delete and recreate collection
      await this.client.deleteCollection({ name: this.collectionName });
      this.collection = await this.client.createCollection({
        name: this.collectionName,
        metadata: { 'hnsw:space': 'cosine' },
      });

      logger.info('Cleared vector store');
      return true;
    } catch (error) {
      logger.error('Error clearing vector store:', error);
      return false;
    }
  }

  /**
   * Check if initialized
   */
  isReady() {
    return this.isInitialized;
  }
}

export default VectorStore;

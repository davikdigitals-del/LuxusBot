import mongoose from 'mongoose';
import config from '../src/config/index.js';
import logger from '../src/utils/logger.js';

async function migrate() {
  try {
    logger.info('Running database migrations...');

    // Connect to MongoDB
    await mongoose.connect(config.database.mongoUri, {
      dbName: config.database.dbName,
    });

    logger.info('Connected to MongoDB');

    // Create indexes
    logger.info('Creating indexes...');

    const collections = mongoose.connection.collections;

    for (const key in collections) {
      const collection = collections[key];
      await collection.createIndexes();
      logger.info(`Created indexes for ${collection.collectionName}`);
    }

    logger.info('✅ Migration completed successfully');

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    logger.error('Migration failed:', error);
    process.exit(1);
  }
}

migrate();

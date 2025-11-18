import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import { logger } from '../utils/logger.js';

let db = null;

export const initializeFirebase = () => {
  try {
    let serviceAccount;

    // Option 1: Use FIREBASE_SERVICE_ACCOUNT_JSON env variable (for deployment)
    if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
      logger.info('Loading Firebase credentials from environment variable');
      serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
    } 
    // Option 2: Use file path (for local development)
    else if (process.env.FIREBASE_SERVICE_ACCOUNT_PATH) {
      logger.info('Loading Firebase credentials from file');
      serviceAccount = JSON.parse(
        readFileSync(process.env.FIREBASE_SERVICE_ACCOUNT_PATH, 'utf8')
      );
    } 
    else {
      throw new Error('No Firebase credentials provided. Set FIREBASE_SERVICE_ACCOUNT_JSON or FIREBASE_SERVICE_ACCOUNT_PATH');
    }

    // Initialize Firebase Admin
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: process.env.FIREBASE_PROJECT_ID
    });

    db = admin.firestore();
    logger.info(' Firebase initialized successfully');
  } catch (error) {
    logger.error(' Firebase initialization error:', error.message);
    logger.warn('  Server will continue but database operations will fail');
  }
};

export const getFirestore = () => {
  if (!db) {
    throw new Error('Firestore not initialized. Call initializeFirebase() first.');
  }
  return db;
};

export const getFirebaseAdmin = () => admin;

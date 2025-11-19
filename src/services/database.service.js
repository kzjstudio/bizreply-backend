import { getFirestore } from '../config/firebase.config.js';
import { logger } from '../utils/logger.js';

/**
 * Save a message to Firestore (nested under business)
 * Structure: businesses/{businessId}/messages/{messageId}
 */
export const saveMessage = async (messageData) => {
  try {
    const db = getFirestore();
    const { businessId, ...restData } = messageData;
    
    // Messages are stored in subcollection under the business
    const messagesRef = db
      .collection('businesses')
      .doc(businessId)
      .collection('messages');

    const docRef = await messagesRef.add({
      ...restData,
      createdAt: new Date()
    });

    logger.info(` Message saved: ${docRef.id} for business: ${businessId}`);
    return { id: docRef.id, businessId, ...restData };
  } catch (error) {
    logger.error(' Error saving message:', error);
    throw error;
  }
};

/**
 * Get conversation history between a business and customer
 */
export const getConversationHistory = async (businessId, customerPhone, limit = 10) => {
  try {
    const db = getFirestore();
    
    // Query only within this businesss messages subcollection
    const messagesRef = db
      .collection('businesses')
      .doc(businessId)
      .collection('messages');

    const snapshot = await messagesRef
      .where('from', '==', customerPhone)
      .orderBy('timestamp', 'desc')
      .limit(limit)
      .get();

    const messages = [];
    snapshot.forEach(doc => {
      messages.push({ id: doc.id, ...doc.data() });
    });

    return messages.reverse();
  } catch (error) {
    logger.error(' Error getting conversation history:', error);
    return [];
  }
};

/**
 * Get business by phone number ID
 */
export const getBusinessByPhone = async (phoneNumberId) => {
  try {
    console.log('[DEBUG] Looking for business with phoneNumberId:', phoneNumberId);
    console.log('[DEBUG] phoneNumberId type:', typeof phoneNumberId, 'length:', phoneNumberId.length);
    const db = getFirestore();
    const businessRef = db.collection('businesses');

    const snapshot = await businessRef
      .where('phoneNumberId', '==', phoneNumberId)
      .limit(1)
      .get();

    if (snapshot.empty) {
      console.log('[DEBUG] No business found. Checking all businesses...');
      const allBusinesses = await businessRef.limit(5).get();
      allBusinesses.forEach(doc => {
        console.log('[DEBUG] Business:', doc.id, 'phoneNumberId:', doc.data().phoneNumberId);
          const storedId = doc.data().phoneNumberId;
          console.log('[DEBUG] Stored type:', typeof storedId, 'length:', storedId?.length, 'match:', storedId === phoneNumberId);
      });
      return null;
    }

    const doc = snapshot.docs[0];
    return { id: doc.id, ...doc.data() };
  } catch (error) {
    logger.error(' Error getting business by phone:', error);
    return null;
  }
};

/**
 * Create a new business
 */
export const createBusinessInDB = async (businessData) => {
  try {
    const db = getFirestore();
    const businessRef = db.collection('businesses');

    const docRef = await businessRef.add({
      ...businessData,
      messageCount: 0,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    logger.info(` Business created: ${docRef.id}`);
    return { id: docRef.id, ...businessData };
  } catch (error) {
    logger.error(' Error creating business:', error);
    throw error;
  }
};

/**
 * Get business by ID
 */
export const getBusinessById = async (businessId) => {
  try {
    const db = getFirestore();
    const doc = await db.collection('businesses').doc(businessId).get();

    if (!doc.exists) {
      return null;
    }

    return { id: doc.id, ...doc.data() };
  } catch (error) {
    logger.error(' Error getting business:', error);
    throw error;
  }
};

/**
 * Update business
 */
export const updateBusinessInDB = async (businessId, updateData) => {
  try {
    const db = getFirestore();
    const businessRef = db.collection('businesses').doc(businessId);

    await businessRef.update({
      ...updateData,
      updatedAt: new Date()
    });

    logger.info(` Business updated: ${businessId}`);
    return { id: businessId, ...updateData };
  } catch (error) {
    logger.error(' Error updating business:', error);
    throw error;
  }
};

/**
 * Delete business
 */
export const deleteBusinessInDB = async (businessId) => {
  try {
    const db = getFirestore();
    await db.collection('businesses').doc(businessId).delete();

    logger.info(`  Business deleted: ${businessId}`);
  } catch (error) {
    logger.error(' Error deleting business:', error);
    throw error;
  }
};

/**
 * Get all businesses
 */
export const getAllBusinesses = async () => {
  try {
    const db = getFirestore();
    const snapshot = await db.collection('businesses').get();

    const businesses = [];
    snapshot.forEach(doc => {
      businesses.push({ id: doc.id, ...doc.data() });
    });

    return businesses;
  } catch (error) {
    logger.error(' Error getting all businesses:', error);
    throw error;
  }
};

import {
  createBusinessInDB,
  getBusinessById,
  updateBusinessInDB,
  deleteBusinessInDB,
  getAllBusinesses
} from '../services/database.service.js';
import { logger } from '../utils/logger.js';

export const createBusiness = async (req, res) => {
  try {
    const businessData = req.body;
    const business = await createBusinessInDB(businessData);
    res.status(201).json({ success: true, data: business });
  } catch (error) {
    logger.error('Error creating business:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

export const getBusiness = async (req, res) => {
  try {
    const { businessId } = req.params;
    const business = await getBusinessById(businessId);
    
    if (!business) {
      return res.status(404).json({ success: false, error: 'Business not found' });
    }
    
    res.status(200).json({ success: true, data: business });
  } catch (error) {
    logger.error('Error getting business:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

export const updateBusiness = async (req, res) => {
  try {
    const { businessId } = req.params;
    const updateData = req.body;
    const business = await updateBusinessInDB(businessId, updateData);
    res.status(200).json({ success: true, data: business });
  } catch (error) {
    logger.error('Error updating business:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

export const deleteBusiness = async (req, res) => {
  try {
    const { businessId } = req.params;
    await deleteBusinessInDB(businessId);
    res.status(200).json({ success: true, message: 'Business deleted successfully' });
  } catch (error) {
    logger.error('Error deleting business:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

export const listBusinesses = async (req, res) => {
  try {
    const businesses = await getAllBusinesses();
    res.status(200).json({ success: true, data: businesses });
  } catch (error) {
    logger.error('Error listing businesses:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

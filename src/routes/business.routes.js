import express from 'express';
import {
  createBusiness,
  getBusiness,
  updateBusiness,
  deleteBusiness,
  listBusinesses
} from '../controllers/business.controller.js';

const router = express.Router();

// Business CRUD operations
router.post('/', createBusiness);
router.get('/:businessId', getBusiness);
router.put('/:businessId', updateBusiness);
router.delete('/:businessId', deleteBusiness);
router.get('/', listBusinesses);

export default router;

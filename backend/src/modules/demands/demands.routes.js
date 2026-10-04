import { Router } from 'express';
import {
  getAllDemands,
  createDemand,
  toggleVoteDemand,
} from './demands.controller.js';
import { optionalAuth, authenticate } from '../../middlewares/auth.js';

const router = Router();

router.get('/demands', optionalAuth, getAllDemands);
router.post('/demands', authenticate, createDemand);
router.post('/demands/:id/vote', authenticate, toggleVoteDemand);

export default router;

import { Router } from 'express';
import {
  getAdminDashboardStats,
  createMovie,
  updateMovie,
  deleteMovie,
  createTheater,
  createScreen,
  getTheatersAndScreens,
  scheduleShow,
  getAdminShows,
  cancelShow,
  greenlightDemand,
  rejectDemand,
} from './admin.controller.js';
import { authenticate, requireAdmin } from '../../middlewares/auth.js';

const router = Router();

// Protect ALL admin routes with authenticate & requireAdmin
router.use(authenticate, requireAdmin);

router.get('/admin/dashboard', getAdminDashboardStats);
router.post('/admin/movies', createMovie);
router.put('/admin/movies/:id', updateMovie);
router.delete('/admin/movies/:id', deleteMovie);
router.post('/admin/theaters', createTheater);
router.post('/admin/theaters/:theaterId/screens', createScreen);
router.get('/admin/theaters-and-screens', getTheatersAndScreens);
router.post('/admin/shows', scheduleShow);
router.get('/admin/shows', getAdminShows);
router.delete('/admin/shows/:id', cancelShow);
router.post('/admin/demands/:id/greenlight', greenlightDemand);
router.post('/admin/demands/:id/reject', rejectDemand);

export default router;

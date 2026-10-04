import { Router } from 'express';
import {
  getAllMovies,
  getMovieById,
  getShowSeatMap,
  getMovieReviews,
  createMovieReview,
  deleteMovieReview,
  hypeMovie,
  reviewSchema,
} from './movies.controller.js';
import { optionalAuth, authenticate } from '../../middlewares/auth.js';
import { validate } from '../../middlewares/validate.js';

const router = Router();

router.get('/movies', getAllMovies);
router.get('/movies/:id', getMovieById);
router.post('/movies/:id/hype', hypeMovie);
router.get('/movies/:id/reviews', optionalAuth, getMovieReviews);
router.post('/movies/:id/reviews', authenticate, validate(reviewSchema), createMovieReview);
router.delete('/movies/:movieId/reviews/:reviewId', authenticate, deleteMovieReview);
router.get('/shows/:id/seats', optionalAuth, getShowSeatMap);

export default router;

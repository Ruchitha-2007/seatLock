import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Auto-attach JWT token if present in localStorage
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('seatlock_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// API Helper methods
export const authApi = {
  login: (email, password) => api.post('/auth/login', { email, password }),
  register: (fullName, email, password) => api.post('/auth/register', { fullName, email, password }),
  getMe: () => api.get('/auth/me'),
};

export const movieApi = {
  getAll: () => api.get('/movies'),
  getById: (id) => api.get(`/movies/${id}`),
  getSeatMap: (showId) => api.get(`/shows/${showId}/seats`),
  getReviews: (movieId) => api.get(`/movies/${movieId}/reviews`),
  submitReview: (movieId, rating, reviewText) =>
    api.post(`/movies/${movieId}/reviews`, { rating, reviewText }),
  deleteReview: (movieId, reviewId) =>
    api.delete(`/movies/${movieId}/reviews/${reviewId}`),
  hypeMovie: (movieId) => api.post(`/movies/${movieId}/hype`),
};

export const bookingApi = {
  holdSeats: (showId, seatIds) => api.post(`/shows/${showId}/hold`, { seatIds }),
  releaseSeats: (showId) => api.post(`/shows/${showId}/release`),
  confirmBooking: (showId, seatIds, idempotencyKey, paymentMethod = 'PAY_AT_THEATER', customerName, customerPhone, customerEmail) => {
    const payload = { showId, seatIds, paymentMethod, customerName, customerEmail };
    if (customerPhone) payload.customerPhone = customerPhone;
    return api.post('/bookings/confirm', payload, { headers: { 'Idempotency-Key': idempotencyKey } });
  },
  cancelBooking: (bookingId) => api.post(`/bookings/${bookingId}/cancel`),
  getMyBookings: () => api.get('/bookings/my-bookings'),
};

export const demandsApi = {
  getAll: (params) => api.get('/demands', { params }),
  create: (demandData) => api.post('/demands', demandData),
  toggleVote: (demandId) => api.post(`/demands/${demandId}/vote`),
};

export const adminApi = {
  getDashboard: () => api.get('/admin/dashboard'),
  createMovie: (movieData) => api.post('/admin/movies', movieData),
  updateMovie: (movieId, movieData) => api.put(`/admin/movies/${movieId}`, movieData),
  deleteMovie: (movieId, force = false) => api.delete(`/admin/movies/${movieId}${force ? '?force=true' : ''}`),
  createTheater: (theaterData) => api.post('/admin/theaters', theaterData),
  createScreen: (theaterId, screenData) => api.post(`/admin/theaters/${theaterId}/screens`, screenData),
  getTheatersAndScreens: () => api.get('/admin/theaters-and-screens'),
  scheduleShow: (showData) => api.post('/admin/shows', showData),
  getShows: (params) => api.get('/admin/shows', { params }),
  cancelShow: (showId, force = false) => api.delete(`/admin/shows/${showId}${force ? '?force=true' : ''}`),
  greenlightDemand: (id, data) => api.post(`/admin/demands/${id}/greenlight`, data),
  rejectDemand: (id, data) => api.post(`/admin/demands/${id}/reject`, data),
};

export default api;

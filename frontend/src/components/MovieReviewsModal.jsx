import React, { useState, useEffect } from 'react';
import { movieApi } from '../services/api';

export default function MovieReviewsModal({ show, movie, user, onClose, onRequireAuth, onReviewUpdated }) {
  const [reviews, setReviews] = useState([]);
  const [stats, setStats] = useState({ total_reviews: 0, avg_rating: '0.0' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [rating, setRating] = useState(9.0);
  const [reviewText, setReviewText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  const [userReviewStatus, setUserReviewStatus] = useState({
    canReview: false,
    reason: 'not_logged_in',
    hasCompletedShow: false,
    hasUpcomingShow: false,
    existingReview: null,
  });

  const fetchReviews = async () => {
    if (!movie) return;
    setLoading(true);
    try {
      const res = await movieApi.getReviews(movie.id);
      setReviews(res.data.data);
      if (res.data.stats) {
        setStats(res.data.stats);
      }
      if (res.data.userReviewStatus) {
        setUserReviewStatus(res.data.userReviewStatus);
        if (res.data.userReviewStatus.existingReview) {
          setRating(parseFloat(res.data.userReviewStatus.existingReview.rating) || 9.0);
          setReviewText(res.data.userReviewStatus.existingReview.review_text || '');
        }
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load reviews');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (show && movie) {
      fetchReviews();
      setSuccessMsg(null);
      setError(null);
    }
  }, [show, movie]);

  if (!show || !movie) return null;

  const handleSubmitReview = async (e) => {
    e.preventDefault();
    if (!user) {
      onRequireAuth();
      return;
    }

    setSubmitting(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const res = await movieApi.submitReview(movie.id, parseFloat(rating), reviewText);
      setSuccessMsg(res.data.message);
      await fetchReviews();
      if (onReviewUpdated) onReviewUpdated();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to submit review');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteReview = async (reviewId) => {
    if (!window.confirm('Are you sure you want to delete this review?')) return;

    setDeletingId(reviewId);
    setError(null);
    try {
      await movieApi.deleteReview(movie.id, reviewId);
      setSuccessMsg('Your review was successfully removed.');
      setReviewText('');
      await fetchReviews();
      if (onReviewUpdated) onReviewUpdated();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete review');
    } finally {
      setDeletingId(null);
    }
  };

  const displayAvg = stats.avg_rating !== '0.0' ? stats.avg_rating : movie.rating;
  const displayCount = reviews.length;

  return (
    <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0, 0, 0, 0.85)', backdropFilter: 'blur(8px)' }}>
      <div className="modal-dialog modal-dialog-centered modal-lg">
        <div className="modal-content border-0 rounded-4 shadow-lg overflow-hidden" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-bright)' }}>
          
          {/* Header */}
          <div className="modal-header border-0 px-4 pt-4 pb-2" style={{ background: 'var(--bg-card)', borderBottom: '1px solid var(--border)' }}>
            <div className="d-flex align-items-center gap-3">
              <img 
                src={movie.poster_url} 
                alt={movie.title}
                style={{ width: '52px', height: '72px', borderRadius: '10px', objectFit: 'cover', border: '1px solid var(--border-bright)' }} 
              />
              <div>
                <h5 className="modal-title fw-bold text-white mb-0">{movie.title}</h5>
                <div className="d-flex align-items-center gap-2 small mt-1">
                  <span className="text-warning fw-bold fs-6">★ {displayAvg}/10</span>
                  <span className="text-secondary">•</span>
                  <span className="text-secondary">{displayCount} Audience Reviews</span>
                </div>
              </div>
            </div>
            <button type="button" className="btn-close" onClick={onClose}></button>
          </div>

          <div className="modal-body px-4 py-3" style={{ maxHeight: '72vh', overflowY: 'auto' }}>
            {error && <div className="alert alert-danger py-2 small mb-3">{error}</div>}
            {successMsg && <div className="alert alert-success py-2 small mb-3">{successMsg}</div>}

            {/* Rating Section: ONLY FOR AUDIENCE MEMBERS WHO COMPLETED WATCHING */}
            {userReviewStatus.canReview ? (
              <div className="p-3 mb-4 rounded-3" style={{ background: 'rgba(124, 58, 237, 0.1)', border: '1px solid rgba(139, 92, 246, 0.35)' }}>
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <h6 className="fw-bold text-white mb-0 d-flex align-items-center gap-2">
                    <span style={{ color: 'var(--gold)' }}>⭐</span>
                    {userReviewStatus.existingReview ? 'Update Your Rating & Review' : 'Rate & Review This Movie'}
                  </h6>
                  <span className="badge bg-success-subtle text-success small border border-success-subtle">
                    <i className="bi bi-patch-check-fill me-1"></i> Verified Viewer
                  </span>
                </div>
                <p className="text-secondary small mb-3">
                  You attended a confirmed screening of <strong className="text-white">{movie.title}</strong>. Your rating helps fellow moviegoers!
                </p>

                <form onSubmit={handleSubmitReview}>
                  <div className="row g-2 align-items-center mb-2">
                    <div className="col-auto">
                      <label htmlFor="movie-rating-input" className="small text-secondary fw-bold">Your Score (1.0 to 10.0):</label>
                    </div>
                    <div className="col-auto">
                      <div className="d-flex align-items-center gap-2">
                        <input 
                          id="movie-rating-input"
                          name="rating"
                          type="range" 
                          className="form-range" 
                          min="1" 
                          max="10" 
                          step="0.1"
                          value={rating}
                          onChange={(e) => setRating(e.target.value)}
                          style={{ width: '150px' }}
                        />
                        <span className="badge bg-warning text-dark fs-6 px-2 py-1 font-monospace fw-bold">★ {rating}</span>
                      </div>
                    </div>
                  </div>

                  <div className="mb-2">
                    <textarea
                      id="movie-review-text"
                      name="reviewText"
                      className="form-control rounded-3"
                      style={{ background: 'rgba(255, 255, 255, 0.05)', color: '#ffffff', border: '1px solid var(--border)' }}
                      rows="2"
                      placeholder="Share your thoughts on the acting, screenplay, music, and theater experience..."
                      value={reviewText}
                      onChange={(e) => setReviewText(e.target.value)}
                      required
                    ></textarea>
                  </div>

                  <div className="text-end">
                    <button 
                      type="submit" 
                      className="btn btn-cinema btn-sm px-4 shadow-sm"
                      disabled={submitting}
                    >
                      {submitting ? 'Submitting...' : userReviewStatus.existingReview ? 'Update Review' : 'Post Review'}
                    </button>
                  </div>
                </form>
              </div>
            ) : userReviewStatus.reason === 'show_upcoming' ? (
              /* Upcoming Ticket Holder - Rating Unlocks After Show */
              <div className="p-3 mb-4 rounded-3 text-center" style={{ background: 'rgba(59, 130, 246, 0.08)', border: '1px solid rgba(59, 130, 246, 0.25)' }}>
                <div className="d-flex align-items-center justify-content-center gap-2 mb-2">
                  <span style={{ fontSize: '1.4rem' }}>🎟️</span>
                  <h6 className="fw-bold mb-0" style={{ color: '#93c5fd' }}>Rating Unlocks After Your Show Concludes</h6>
                </div>
                <p className="text-secondary small mb-0" style={{ maxWidth: '540px', margin: '0 auto', lineHeight: '1.5' }}>
                  You have confirmed tickets for an upcoming show of <strong className="text-white">{movie.title}</strong>. To ensure genuine, post-watch feedback, the rating option will activate automatically once your screening concludes. Enjoy your movie!
                </p>
              </div>
            ) : userReviewStatus.reason === 'not_logged_in' || !user ? (
              /* Visitor / Logged Out */
              <div className="p-3 mb-4 rounded-3 text-center" style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--border)' }}>
                <div className="d-flex align-items-center justify-content-center gap-2 mb-1">
                  <span style={{ fontSize: '1.2rem' }}>⭐</span>
                  <h6 className="fw-bold text-white mb-0">Watched This Movie?</h6>
                </div>
                <p className="text-secondary small mb-2">
                  Sign in to SeatLock to unlock ratings if you have attended this screening.
                </p>
                <button 
                  type="button" 
                  className="btn btn-sm btn-outline-warning rounded-pill px-3 fw-bold"
                  onClick={() => {
                    onClose();
                    onRequireAuth();
                  }}
                >
                  Sign In to Check Eligibility
                </button>
              </div>
            ) : (
              /* Logged In, but No Confirmed Watched Ticket */
              <div className="p-3 mb-4 rounded-3 text-center" style={{ background: 'rgba(234, 179, 8, 0.05)', border: '1px solid rgba(234, 179, 8, 0.2)' }}>
                <div className="d-flex align-items-center justify-content-center gap-2 mb-2">
                  <span style={{ fontSize: '1.2rem' }}>🔒</span>
                  <h6 className="fw-bold mb-0" style={{ color: 'var(--gold)' }}>Audience-Verified Ratings Only</h6>
                </div>
                <p className="text-secondary small mb-0" style={{ maxWidth: '540px', margin: '0 auto', lineHeight: '1.5' }}>
                  To guarantee 100% authentic ratings and protect against spoilers, only viewers who have booked tickets and completed watching <strong className="text-white">{movie.title}</strong> can submit a rating and review.
                </p>
              </div>
            )}

            {/* Reviews List */}
            <div className="d-flex justify-content-between align-items-center mb-3">
              <h6 className="fw-bold text-white mb-0">Audience Reviews ({reviews.length})</h6>
              <span className="small text-secondary">Ordered by most recent</span>
            </div>

            {loading ? (
              <div className="text-center py-4">
                <div className="spinner-border text-danger" role="status"></div>
              </div>
            ) : reviews.length === 0 ? (
              <div className="text-center py-4 text-muted">
                <p>No reviews posted yet. Be the first to post a review!</p>
              </div>
            ) : (
              <div className="d-flex flex-column gap-3">
                {reviews.map((r) => {
                  const isMyReview = user && (r.user_id === user.id || user.role === 'ADMIN');

                  return (
                    <div key={r.id} className="review-item-card">
                      <div className="d-flex justify-content-between align-items-start mb-2">
                        <div className="d-flex align-items-center gap-2">
                          <div 
                            className="rounded-circle d-flex align-items-center justify-content-center fw-bold bg-light text-dark border"
                            style={{ width: '36px', height: '36px', fontSize: '0.9rem' }}
                          >
                            {r.user_name ? r.user_name[0].toUpperCase() : 'U'}
                          </div>
                          <div>
                            <strong className="text-white d-block small">{r.user_name}</strong>
                            <span className="text-secondary" style={{ fontSize: '0.72rem' }}>
                              {new Date(r.created_at).toLocaleDateString()}
                            </span>
                          </div>
                        </div>

                        <div className="d-flex align-items-center gap-2">
                          {r.is_verified_buyer && (
                            <span className="badge-verified-buyer">
                              <i className="bi bi-patch-check-fill text-success"></i> Verified Buyer
                            </span>
                          )}
                          <span className="badge bg-warning text-dark fw-bold px-2 py-1 font-monospace">
                            ★ {parseFloat(r.rating).toFixed(1)}/10
                          </span>

                          {/* Delete Review Button for Author */}
                          {isMyReview && (
                            <button
                              className="btn btn-outline-danger btn-sm p-1 rounded-circle ms-1"
                              style={{ width: '28px', height: '28px', lineHeight: 1 }}
                              onClick={() => handleDeleteReview(r.id)}
                              disabled={deletingId === r.id}
                              title="Delete this review"
                            >
                              <i className="bi bi-trash"></i>
                            </button>
                          )}
                        </div>
                      </div>

                      <p className="mb-0 small" style={{ color: 'var(--text-primary)', lineHeight: '1.5' }}>
                        "{r.review_text}"
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

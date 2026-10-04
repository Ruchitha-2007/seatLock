import React, { useState, useEffect } from 'react';
import { bookingApi } from '../services/api';

export default function MyBookingsModal({ show, onClose, onOpenReviewForMovie }) {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cancellingId, setCancellingId] = useState(null);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('upcoming'); // 'upcoming' | 'completed'

  const fetchBookings = async () => {
    setLoading(true);
    try {
      const res = await bookingApi.getMyBookings();
      // Filter out explicitly cancelled bookings
      const activeOnly = (res.data.data || []).filter((b) => b.status !== 'CANCELLED');
      setBookings(activeOnly);
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to fetch bookings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!show) return;
    fetchBookings();
  }, [show]);

  // Determine if a booking show has already started/completed
  const now = Date.now();
  const isShowCompleted = (b) => {
    if (!b.start_time) return false;
    const startMs = new Date(b.start_time).getTime();
    return startMs <= now;
  };

  const upcomingBookings = bookings.filter((b) => !isShowCompleted(b));
  const completedBookings = bookings.filter((b) => isShowCompleted(b));

  // Automatically focus the tab that has tickets on initial load
  useEffect(() => {
    if (bookings.length > 0) {
      if (upcomingBookings.length === 0 && completedBookings.length > 0) {
        setActiveTab('completed');
      } else {
        setActiveTab('upcoming');
      }
    }
  }, [bookings.length]);

  const handleCancelBooking = async (bookingId, bookingRef) => {
    const ok = window.confirm(
      `Are you sure you want to cancel booking ${bookingRef}?\nYour reserved seats will be immediately released.`
    );
    if (!ok) return;

    setCancellingId(bookingId);
    try {
      await bookingApi.cancelBooking(bookingId);
      // Immediately remove from the list
      setBookings((prev) => prev.filter((b) => b.booking_id !== bookingId));
    } catch (err) {
      alert(err.response?.data?.error || err.message || 'Failed to cancel booking');
    } finally {
      setCancellingId(null);
    }
  };

  if (!show) return null;

  const currentList = activeTab === 'upcoming' ? upcomingBookings : completedBookings;

  return (
    <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0, 0, 0, 0.85)', backdropFilter: 'blur(8px)' }}>
      <div className="modal-dialog modal-dialog-centered modal-lg">
        <div className="modal-content border-0 rounded-4 shadow-lg overflow-hidden" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-bright)' }}>
          
          {/* Header */}
          <div className="modal-header border-0 px-4 pt-4 pb-2" style={{ background: 'var(--bg-card)', borderBottom: '1px solid var(--border)' }}>
            <div>
              <h5 className="modal-title fw-bold text-white d-flex align-items-center gap-2 mb-1">
                <span style={{ fontSize: '1.4rem' }}>🎟️</span>
                <span>My Cinema Bookings & E-Tickets</span>
              </h5>
              <div className="small text-secondary">
                Track your active theater reservations and completed movie history
              </div>
            </div>
            <button type="button" className="btn-close" onClick={onClose}></button>
          </div>

          {/* Navigation Tabs (Upcoming vs Completed) */}
          <div className="px-4 pt-3 pb-2 d-flex gap-2 border-bottom" style={{ borderColor: 'var(--border)', background: 'rgba(18, 18, 26, 0.7)' }}>
            <button
              type="button"
              className="btn btn-sm rounded-pill px-3 py-2 fw-bold d-flex align-items-center gap-2 transition"
              onClick={() => setActiveTab('upcoming')}
              style={{
                background: activeTab === 'upcoming' ? 'linear-gradient(135deg, #7c3aed, #4f46e5)' : 'var(--bg-card)',
                color: activeTab === 'upcoming' ? '#ffffff' : '#94a3b8',
                border: activeTab === 'upcoming' ? '1px solid #a78bfa' : '1px solid var(--border)',
                boxShadow: activeTab === 'upcoming' ? '0 0 14px rgba(124, 58, 237, 0.4)' : 'none',
              }}
            >
              <span>🎟️ Upcoming Shows</span>
              <span 
                className="badge rounded-pill"
                style={{
                  background: activeTab === 'upcoming' ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.08)',
                  color: '#ffffff',
                  fontSize: '0.72rem',
                }}
              >
                {upcomingBookings.length}
              </span>
            </button>

            <button
              type="button"
              className="btn btn-sm rounded-pill px-3 py-2 fw-bold d-flex align-items-center gap-2 transition"
              onClick={() => setActiveTab('completed')}
              style={{
                background: activeTab === 'completed' ? 'linear-gradient(135deg, #3b82f6, #1d4ed8)' : 'var(--bg-card)',
                color: activeTab === 'completed' ? '#ffffff' : '#94a3b8',
                border: activeTab === 'completed' ? '1px solid #60a5fa' : '1px solid var(--border)',
                boxShadow: activeTab === 'completed' ? '0 0 14px rgba(59, 130, 246, 0.4)' : 'none',
              }}
            >
              <span>🍿 Completed / Watched</span>
              <span 
                className="badge rounded-pill"
                style={{
                  background: activeTab === 'completed' ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.08)',
                  color: '#ffffff',
                  fontSize: '0.72rem',
                }}
              >
                {completedBookings.length}
              </span>
            </button>
          </div>

          <div className="modal-body px-4 py-3" style={{ maxHeight: '68vh', overflowY: 'auto' }}>
            {loading ? (
              <div className="text-center py-5">
                <div className="spinner-border text-danger" role="status"></div>
                <p className="mt-2 text-secondary small">Loading your tickets...</p>
              </div>
            ) : error ? (
              <div className="alert alert-danger py-2 small">{error}</div>
            ) : currentList.length === 0 ? (
              <div className="text-center py-5" style={{ color: 'var(--text-muted)' }}>
                {activeTab === 'upcoming' ? (
                  <>
                    <i className="bi bi-calendar-event fs-1 d-block mb-2 text-secondary"></i>
                    <h5 className="text-white">No Upcoming Reservations</h5>
                    <p className="small text-secondary mb-3">
                      You don't have any upcoming shows right now.
                    </p>
                    {completedBookings.length > 0 && (
                      <button 
                        className="btn btn-outline-primary btn-sm rounded-pill px-3"
                        onClick={() => setActiveTab('completed')}
                      >
                        View {completedBookings.length} Completed Shows
                      </button>
                    )}
                  </>
                ) : (
                  <>
                    <i className="bi bi-film fs-1 d-block mb-2 text-secondary"></i>
                    <h5 className="text-white">No Completed Shows Yet</h5>
                    <p className="small text-secondary">
                      Once your reserved movie show concludes, your tickets will automatically move here for you to rate and review!
                    </p>
                  </>
                )}
              </div>
            ) : (
              <div className="d-flex flex-column gap-3">
                {currentList.map((b) => {
                  const showDate = b.start_time ? new Date(b.start_time) : null;
                  const dateStr = showDate
                    ? showDate.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' }) + ' · ' + showDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                    : 'Upcoming Show';

                  const isPast = isShowCompleted(b);

                  return (
                    <div 
                      key={b.booking_id} 
                      className="rounded-4 p-3 shadow-sm position-relative overflow-hidden"
                      style={{ 
                        background: isPast ? 'rgba(24, 24, 38, 0.85)' : 'var(--bg-card)', 
                        border: isPast ? '1px solid rgba(59, 130, 246, 0.25)' : '1px solid var(--border-bright)' 
                      }}
                    >
                      {/* Top Header */}
                      <div className="d-flex justify-content-between align-items-start border-bottom pb-2 mb-2 gap-2" style={{ borderColor: 'var(--border)' }}>
                        <div className="flex-grow-1">
                          <div className="d-flex align-items-center gap-2 mb-1">
                            <span 
                              style={{ 
                                background: isPast ? 'rgba(59, 130, 246, 0.15)' : 'rgba(124, 58, 237, 0.15)', 
                                color: isPast ? '#60a5fa' : '#c4b5fd', 
                                border: isPast ? '1px solid rgba(59, 130, 246, 0.35)' : '1px solid rgba(139, 92, 246, 0.35)',
                                fontSize: '0.68rem',
                                fontWeight: 700,
                                padding: '0.2rem 0.65rem',
                                borderRadius: '20px',
                                letterSpacing: '0.5px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.3rem'
                              }}
                            >
                              <span>{isPast ? '🍿' : '🎟️'}</span>
                              <span>{isPast ? 'Watched Movie' : 'Cinema E-Ticket'}</span>
                            </span>
                          </div>
                          <h4 className="fw-bold text-white mb-1" style={{ fontSize: '1.25rem', letterSpacing: '-0.3px' }}>
                            {b.movie_title || 'Telugu Blockbuster'}
                          </h4>
                          <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                            🏢 {b.theater_name} {b.theater_city ? `· ${b.theater_city}` : ''} — <span style={{ color: 'var(--accent-light)' }}>{b.screen_name}</span>
                          </span>
                        </div>

                        {/* Status Badge */}
                        <div className="text-end flex-shrink-0">
                          <span 
                            style={{ 
                              background: isPast ? 'rgba(59, 130, 246, 0.15)' : 'rgba(34, 197, 94, 0.15)', 
                              color: isPast ? '#60a5fa' : '#4ade80', 
                              border: isPast ? '1px solid rgba(59, 130, 246, 0.35)' : '1px solid rgba(34, 197, 94, 0.35)',
                              fontSize: '0.74rem',
                              fontWeight: 700,
                              padding: '0.3rem 0.75rem',
                              borderRadius: '20px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.35rem',
                              whiteSpace: 'nowrap',
                              lineHeight: 1
                            }}
                          >
                            {isPast ? (
                              <>
                                <i className="bi bi-patch-check-fill"></i>
                                <span>Completed</span>
                              </>
                            ) : (
                              <>
                                <i className="bi bi-check-circle-fill"></i>
                                <span>Confirmed</span>
                              </>
                            )}
                          </span>
                        </div>
                      </div>

                      {/* Middle Details */}
                      <div className="row g-2 small text-secondary">
                        <div className="col-sm-6">
                          <span style={{ color: 'var(--text-muted)' }}>Showtime:</span>{' '}
                          <strong className="text-white" style={{ fontSize: '0.9rem' }}>
                            🕒 {dateStr}
                          </strong>
                        </div>
                        <div className="col-sm-6 text-sm-end">
                          <span style={{ color: 'var(--text-muted)' }}>Booking Ref:</span>{' '}
                          <strong className="font-monospace" style={{ color: 'var(--gold)', fontSize: '0.95rem' }}>
                            {b.booking_reference}
                          </strong>
                        </div>
                        <div className="col-12 mt-2">
                          <span style={{ color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Seats Reserved:</span>{' '}
                          <div className="d-flex flex-wrap gap-1">
                            {b.seats?.map((s) => (
                              <span 
                                key={s.seat_id} 
                                style={{ 
                                  background: 'var(--bg-elevated)', 
                                  border: '1px solid var(--border-bright)', 
                                  color: '#ffffff',
                                  padding: '0.25rem 0.65rem',
                                  borderRadius: '8px',
                                  fontWeight: 700,
                                  fontSize: '0.75rem'
                                }}
                              >
                                Row {s.label} <span style={{ color: 'var(--gold)', fontSize: '0.7rem' }}>({s.tier})</span>
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Bottom Footer Actions */}
                      <div className="d-flex justify-content-between align-items-center mt-3 pt-2 border-top flex-wrap gap-2" style={{ borderColor: 'var(--border)' }}>
                        <div>
                          {isPast ? (
                            <div className="d-flex align-items-center gap-1 small" style={{ color: '#93c5fd' }}>
                              <i className="bi bi-check2-circle fs-6"></i>
                              <span>Movie concluded · Hope you enjoyed the show!</span>
                            </div>
                          ) : (
                            <>
                              <span className="small text-secondary me-2">Payable at Box Office:</span>
                              <span className="fw-bold fs-5" style={{ color: 'var(--gold)' }}>
                                ₹{parseFloat(b.total_amount).toFixed(2)}
                              </span>
                              <span className="d-block small" style={{ color: '#fef08a', fontSize: '0.72rem' }}>
                                ⚠️ Pay at theater counter at least 15 mins before show starts
                              </span>
                            </>
                          )}
                        </div>
                        
                        <div className="d-flex align-items-center gap-2">
                          {/* Cancellation Button: ONLY FOR UPCOMING SHOWS */}
                          {!isPast && (
                            <button 
                              className="btn btn-sm btn-outline-danger rounded-pill px-3 fw-bold d-flex align-items-center gap-1"
                              onClick={() => handleCancelBooking(b.booking_id, b.booking_reference)}
                              disabled={cancellingId === b.booking_id}
                              style={{ borderColor: 'rgba(239, 68, 68, 0.45)' }}
                            >
                              {cancellingId === b.booking_id ? (
                                <>
                                  <span className="spinner-border spinner-border-sm" role="status"></span>
                                  <span>Cancelling...</span>
                                </>
                              ) : (
                                <>
                                  <i className="bi bi-x-circle"></i>
                                  <span>Cancel Reservation</span>
                                </>
                              )}
                            </button>
                          )}

                          {/* Rate Movie Button: ONLY FOR PAST / COMPLETED SHOWS */}
                          {isPast && (
                            <button 
                              className="btn btn-sm rounded-pill fw-bold d-flex align-items-center gap-1 px-4 py-2"
                              style={{
                                background: 'linear-gradient(135deg, #f5c518, #f59e0b)',
                                border: 'none',
                                color: '#000000',
                                boxShadow: '0 2px 10px rgba(245, 197, 24, 0.35)',
                                fontSize: '0.85rem'
                              }}
                              onClick={() => {
                                onClose();
                                onOpenReviewForMovie({ 
                                  id: b.movie_id, 
                                  title: b.movie_title, 
                                  poster_url: b.poster_url, 
                                  rating: '9.0' 
                                });
                              }}
                            >
                              <i className="bi bi-star-fill text-dark"></i>
                              <span>Rate & Review This Movie</span>
                            </button>
                          )}
                        </div>
                      </div>
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

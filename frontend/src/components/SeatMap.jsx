import React, { useState, useEffect } from 'react';
import { movieApi, bookingApi } from '../services/api';

export default function SeatMap({ 
  showId, 
  user, 
  bookingNotice,
  onClearBookingNotice,
  onProceedToCheckout, 
  onRequireAuth, 
  onBack 
}) {
  const [show, setShow] = useState(null);
  const [seats, setSeats] = useState([]);
  const [selectedSeatIds, setSelectedSeatIds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cancellingReservation, setCancellingReservation] = useState(false);
  const [cancelMessage, setCancelMessage] = useState(null);
  const [error, setError] = useState(null);

  // 1. Initial Load & Background Poller
  const fetchSeatMap = async (isBackground = false) => {
    try {
      const res = await movieApi.getSeatMap(showId);
      setShow(res.data.data.show);
      const fetchedSeats = res.data.data.seats;
      setSeats(fetchedSeats);
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to load seat map');
    } finally {
      if (!isBackground) setLoading(false);
    }
  };

  useEffect(() => {
    fetchSeatMap();

    // Poll for live seat status changes every 4 seconds
    const pollInterval = setInterval(() => {
      fetchSeatMap(true);
    }, 4000);

    return () => clearInterval(pollInterval);
  }, [showId]);

  // When a new booking confirmation notice arrives:
  useEffect(() => {
    if (bookingNotice) {
      setSelectedSeatIds([]);
      fetchSeatMap();
    }
  }, [bookingNotice]);

  // Toggle seat selection directly without hold timer
  const handleSeatClick = (seat) => {
    if (seat.effective_status === 'BOOKED' || (seat.effective_status === 'HELD' && !seat.is_my_hold)) {
      return;
    }

    if (selectedSeatIds.includes(seat.seat_id)) {
      setSelectedSeatIds(selectedSeatIds.filter((id) => id !== seat.seat_id));
    } else {
      if (selectedSeatIds.length >= 6) {
        alert('You can select a maximum of 6 seats at once.');
        return;
      }
      setSelectedSeatIds([...selectedSeatIds, seat.seat_id]);
    }
  };

  // Cancel reservation directly from SeatMap
  const handleCancelReservation = async () => {
    if (!bookingNotice?.bookingId) return;

    const confirmed = window.confirm(
      `Are you sure you want to cancel reservation ${bookingNotice.bookingReference}?\nYour reserved seats will be immediately released.`
    );
    if (!confirmed) return;

    setCancellingReservation(true);
    setError(null);
    try {
      await bookingApi.cancelBooking(bookingNotice.bookingId);
      if (onClearBookingNotice) onClearBookingNotice();
      setCancelMessage('Reservation cancelled successfully. Your seats have been released back to available.');
      setTimeout(() => setCancelMessage(null), 6000);
      await fetchSeatMap(true);
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to cancel reservation');
    } finally {
      setCancellingReservation(false);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-5">
        <div className="spinner-border text-danger" role="status"></div>
        <p className="mt-3 text-secondary">Rendering auditorium layout...</p>
      </div>
    );
  }

  const selectedSeatsData = seats.filter((s) => selectedSeatIds.includes(s.seat_id));
  const totalPrice = selectedSeatsData.reduce((sum, s) => sum + parseFloat(s.price), 0);
  const bookedSeatIdsFromNotice = (bookingNotice?.seats || []).map((s) => s.seatId || s.seat_id);

  // Group seats by row
  const rows = {};
  seats.forEach((seat) => {
    if (!rows[seat.row_label]) rows[seat.row_label] = [];
    rows[seat.row_label].push(seat);
  });

  return (
    <div className="cinema-container py-3 px-3" style={{ maxWidth: '960px' }}>
      
      {/* Header & Back Button */}
      <div className="d-flex justify-content-between align-items-center mb-3">
        <button className="btn btn-outline-secondary btn-sm rounded-pill px-3 fw-bold text-white" onClick={onBack}>
          <i className="bi bi-chevron-left me-1"></i> Back to All Movies
        </button>
        <div className="text-end">
          <h5 className="fw-bold text-white mb-0">{show?.movie_title}</h5>
          <span className="small fw-semibold" style={{ color: 'var(--accent-light)' }}>
            {show?.theater_name} <span style={{ color: 'rgba(255,255,255,0.35)' }}>—</span> <span style={{ color: '#c4b5fd' }}>{show?.screen_name}</span>
          </span>
        </div>
      </div>

      {/* Cancellation Success Feedback */}
      {cancelMessage && (
        <div 
          className="p-3 mb-4 rounded-4 shadow-sm text-white d-flex align-items-center justify-content-between"
          style={{
            background: 'rgba(124, 58, 237, 0.15)',
            border: '1px solid rgba(139, 92, 246, 0.4)'
          }}
        >
          <div className="d-flex align-items-center gap-2">
            <i className="bi bi-check-circle-fill fs-5" style={{ color: 'var(--accent-light)' }}></i>
            <span className="small fw-semibold" style={{ color: '#c4b5fd' }}>{cancelMessage}</span>
          </div>
          <button type="button" className="btn-close btn-close-white btn-sm" onClick={() => setCancelMessage(null)}></button>
        </div>
      )}

      {/* Persistent Reservation Notice (Matches Violet Cinema Theme) */}
      {bookingNotice && (
        <div 
          className="p-4 mb-4 rounded-4 shadow-lg text-white position-relative"
          style={{
            background: 'linear-gradient(135deg, rgba(30, 27, 75, 0.88) 0%, rgba(19, 19, 32, 0.96) 100%)',
            border: '1px solid rgba(139, 92, 246, 0.45)',
            boxShadow: '0 8px 32px rgba(124, 58, 237, 0.22)'
          }}
        >
          <div className="d-flex align-items-start justify-content-between flex-wrap gap-3">
            <div className="d-flex align-items-start gap-3">
              <div 
                className="d-flex align-items-center justify-content-center flex-shrink-0"
                style={{
                  width: '46px',
                  height: '46px',
                  borderRadius: '12px',
                  background: 'rgba(124, 58, 237, 0.2)',
                  border: '1px solid rgba(139, 92, 246, 0.4)',
                  color: '#c4b5fd',
                  fontSize: '1.4rem'
                }}
              >
                🎟️
              </div>
              <div>
                <div className="d-flex align-items-center gap-2 flex-wrap mb-1">
                  <span 
                    style={{ 
                      background: 'rgba(124, 58, 237, 0.25)', 
                      color: '#c4b5fd', 
                      border: '1px solid rgba(139, 92, 246, 0.45)',
                      fontSize: '0.72rem',
                      fontWeight: 800,
                      padding: '0.2rem 0.65rem',
                      borderRadius: '20px',
                      letterSpacing: '0.5px'
                    }}
                  >
                    RESERVATION CONFIRMED
                  </span>
                  <span className="small text-secondary">
                    PNR: <strong className="font-monospace text-white">{bookingNotice.bookingReference}</strong>
                  </span>
                  <span className="small text-secondary">•</span>
                  <span className="small fw-bold" style={{ color: '#c4b5fd' }}>
                    ₹{parseFloat(bookingNotice.totalAmount).toFixed(2)} Payable at Box Office
                  </span>
                </div>
                
                <h6 className="fw-bold mb-1 text-white">
                  Seats Reserved Successfully
                </h6>
                <p className="mb-0 small" style={{ color: '#d1d5db', lineHeight: '1.5' }}>
                  <i className="bi bi-clock-history me-1" style={{ color: 'var(--accent-light)' }}></i>
                  <strong>Payment Policy:</strong> Please arrive and pay at the cinema counter <strong>at least 15 minutes before the show begins</strong>. Show this PNR at the box office.
                </p>
              </div>
            </div>

            <div className="d-flex align-items-center gap-2 ms-auto">
              <button 
                className="btn btn-sm rounded-pill px-3 fw-bold d-flex align-items-center gap-1"
                onClick={handleCancelReservation}
                disabled={cancellingReservation}
                style={{ 
                  background: 'rgba(239, 68, 68, 0.12)', 
                  border: '1px solid rgba(239, 68, 68, 0.35)', 
                  color: '#fca5a5' 
                }}
              >
                {cancellingReservation ? (
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

              <button 
                className="btn btn-sm btn-outline-secondary rounded-pill px-3 text-white"
                onClick={() => onClearBookingNotice && onClearBookingNotice()}
                style={{ borderColor: 'var(--border-bright)' }}
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}


      {error && <div className="alert alert-danger py-2 small mb-3">{error}</div>}

      {/* Auditorium Dark Card */}
      <div 
        className="cinema-auditorium-dark mb-4 text-center"
        style={{ paddingTop: '2.5rem' }} // Ensures generous clearance above the curved screen
      >
        {/* Curved Screen */}
        <div className="cinema-curved-screen mx-auto" style={{ maxWidth: '620px' }}></div>
        <div className="small text-secondary text-uppercase tracking-wider fw-bold mb-4" style={{ fontSize: '0.72rem', letterSpacing: '3px' }}>
          Screen This Way
        </div>

        {/* Seat Grid */}
        <div className="d-flex flex-column align-items-center gap-2 mb-4">
          {Object.entries(rows).map(([rowLabel, rowSeats]) => (
            <div key={rowLabel} className="d-flex align-items-center gap-2">
              <span className="text-secondary fw-bold small" style={{ width: '20px' }}>
                {rowLabel}
              </span>
              <div className="d-flex gap-2">
                {rowSeats.map((seat) => {
                  const isJustBookedByMe = bookedSeatIdsFromNotice.includes(seat.seat_id);
                  const isSelected = selectedSeatIds.includes(seat.seat_id);
                  let statusClass = 'seat-available';

                  if (isJustBookedByMe) {
                    statusClass = 'seat-my-reservation';
                  } else if (seat.effective_status === 'BOOKED') {
                    statusClass = 'seat-booked';
                  } else if (seat.effective_status === 'HELD' && !seat.is_my_hold) {
                    statusClass = 'seat-held-by-other';
                  } else if (isSelected) {
                    statusClass = 'seat-selected';
                  }

                  const tierClass =
                    seat.tier === 'RECLINER'
                      ? 'seat-recliner'
                      : seat.tier === 'GOLD'
                      ? 'seat-gold'
                      : 'seat-silver';

                  const isBooked = seat.effective_status === 'BOOKED';
                  const isHeldByOther = seat.effective_status === 'HELD' && !seat.is_my_hold;

                  return (
                    <button
                      key={seat.seat_id}
                      className={`seat-btn ${statusClass} ${tierClass}`}
                      disabled={isBooked || isHeldByOther}
                      onClick={() => handleSeatClick(seat)}
                      title={isJustBookedByMe 
                        ? `Row ${seat.row_label}-${seat.seat_number} • Reserved by You (${bookingNotice?.bookingReference})`
                        : isBooked
                        ? `Row ${seat.row_label}-${seat.seat_number} • Already Reserved`
                        : isHeldByOther
                        ? `Row ${seat.row_label}-${seat.seat_number} • Currently Held by Another Guest`
                        : `Row ${seat.row_label}-${seat.seat_number} • ${seat.tier} • ₹${parseFloat(seat.price).toFixed(0)}`
                      }
                    >
                      {isJustBookedByMe ? (
                        seat.seat_number
                      ) : isBooked ? (
                        <i className="bi bi-lock-fill" style={{ fontSize: '0.68rem', color: '#64748b' }}></i>
                      ) : (
                        seat.seat_number
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Tier Pricing Legend */}
        <div className="d-flex justify-content-center align-items-center gap-3 flex-wrap pt-3 border-top" style={{ borderColor: 'var(--border)' }}>
          <div className="tier-pill tier-pill-silver">
            <span className="tier-pill-dot" style={{ background: '#94a3b8' }}></span>
            <span>Silver · ₹{(parseFloat(show?.base_price || 250) * 1.0).toFixed(0)}</span>
          </div>
          <div className="tier-pill tier-pill-gold">
            <span className="tier-pill-dot" style={{ background: 'var(--gold)' }}></span>
            <span>Gold · ₹{(parseFloat(show?.base_price || 250) * 1.35).toFixed(0)}</span>
          </div>
          <div className="tier-pill tier-pill-recliner">
            <span className="tier-pill-dot" style={{ background: 'var(--accent-light)' }}></span>
            <span>Recliner · ₹{(parseFloat(show?.base_price || 250) * 1.8).toFixed(0)}</span>
          </div>
          <div className="tier-pill" style={{ background: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
            <i className="bi bi-lock-fill me-1" style={{ color: '#64748b', fontSize: '0.72rem' }}></i>
            <span style={{ color: '#94a3b8' }}>Already Reserved</span>
          </div>

          {bookingNotice && (
            <div className="tier-pill" style={{ background: 'rgba(124, 58, 237, 0.22)', border: '1px solid rgba(139, 92, 246, 0.45)' }}>
              <span className="tier-pill-dot" style={{ background: '#a78bfa', boxShadow: '0 0 10px #a78bfa' }}></span>
              <span style={{ color: '#c4b5fd', fontWeight: 700 }}>Your Reserved Seats ({bookingNotice.bookingReference})</span>
            </div>
          )}
        </div>

      </div>

      {/* Bottom Sticky Action Bar */}
      <div 
        className="rounded-4 p-3 d-flex justify-content-between align-items-center shadow-lg"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border-bright)' }}
      >
        <div>
          <span className="small text-secondary d-block">Selected Seats:</span>
          {selectedSeatIds.length === 0 ? (
            <span className="small text-secondary">No seats selected (Max 6)</span>
          ) : (
            <span className="fw-bold text-white fs-6">
              {selectedSeatsData.map((s) => `${s.row_label}${s.seat_number}`).join(', ')}
            </span>
          )}
        </div>

        <div className="d-flex align-items-center gap-3">
          {totalPrice > 0 && (
            <div className="text-end">
              <span className="small text-secondary d-block">Payable at Counter:</span>
              <span className="fs-4 fw-bold" style={{ color: 'var(--accent-light)' }}>
                ₹{totalPrice.toFixed(2)}
              </span>
            </div>
          )}

          <button
            className="btn btn-cinema px-4 py-2 fw-bold"
            disabled={selectedSeatIds.length === 0}
            onClick={() => {
              if (!user) {
                onRequireAuth();
                return;
              }
              onProceedToCheckout({
                show,
                seats: selectedSeatsData,
                totalPrice,
              });
            }}
          >
            Confirm Reservation &gt;
          </button>
        </div>
      </div>

    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { bookingApi } from '../services/api';

export default function CheckoutModal({ show, checkoutData, user, onClose, onBookingSuccess }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [confirmedBooking, setConfirmedBooking] = useState(null);

  // Auto-fill name and email ONLY from authenticated user details (never hardcoded defaults)
  const [customerName, setCustomerName] = useState(() => user?.fullName || user?.name || '');
  const [customerEmail, setCustomerEmail] = useState(() => user?.email || '');
  const [emailError, setEmailError] = useState('');

  // Sync state whenever modal opens or user logs in
  useEffect(() => {
    if (show) {
      setCustomerName(user?.fullName || user?.name || '');
      setCustomerEmail(user?.email || '');
      setEmailError('');
      setError(null);
      setConfirmedBooking(null);
    }
  }, [show, user]);

  // Unique Idempotency Key per checkout session
  const [idempotencyKey, setIdempotencyKey] = useState(() => 'ik_' + Math.random().toString(36).substring(2, 12) + '_' + Date.now());

  useEffect(() => {
    if (show) {
      setIdempotencyKey('ik_' + Math.random().toString(36).substring(2, 12) + '_' + Date.now());
    }
  }, [show]);

  if (!show || !checkoutData) return null;

  const handleReservationSubmit = async (e) => {
    e.preventDefault();

    // Validate email
    const trimmedEmail = customerEmail.trim().toLowerCase();
    if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setEmailError('Please enter a valid email address');
      return;
    }
    setEmailError('');

    if (!customerName.trim()) {
      setError('Please provide your full name');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const seatIds = checkoutData.seats.map((s) => s.seat_id);
      
      const res = await bookingApi.confirmBooking(
        checkoutData.show.show_id,
        seatIds,
        idempotencyKey,
        'PAY_AT_THEATER',
        customerName.trim(),
        null,
        trimmedEmail
      );

      const bookingInfo = {
        ...res.data.data,
        customerName: customerName.trim(),
        customerEmail: trimmedEmail,
      };
      setConfirmedBooking(bookingInfo);
      if (onBookingSuccess) onBookingSuccess(bookingInfo);
    } catch (err) {
      const errMsg = err.response?.data?.details?.[0]?.message || err.response?.data?.error || err.message || 'Seat reservation failed';
      setError(errMsg);
    } finally {
      setLoading(false);
    }
  };

  const showDate = checkoutData.show?.start_time ? new Date(checkoutData.show.start_time) : new Date();
  const dateFormatted = showDate.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' });
  const timeFormatted = showDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  // Handle closing modal: pass confirmedBooking if reservation was completed so SeatMap stays open with notice!
  const handleModalClose = () => {
    onClose(confirmedBooking);
  };

  return (
    <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0, 0, 0, 0.85)', backdropFilter: 'blur(8px)' }}>
      <div className="modal-dialog modal-dialog-centered modal-lg">
        <div className="modal-content border-0 rounded-4 shadow-lg overflow-hidden" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-bright)' }}>
          
          {/* Header */}
          <div className="modal-header border-0 px-4 pt-4 pb-2" style={{ background: 'var(--bg-card)', borderBottom: '1px solid var(--border)' }}>
            <div>
              <h5 className="modal-title fw-bold text-white mb-0 d-flex align-items-center gap-2">
                <span>{confirmedBooking ? '🎉' : '🎟️'}</span>
                <span>{confirmedBooking ? 'Reservation Confirmed' : 'Confirm Seat Reservation'}</span>
              </h5>
            </div>
            <button type="button" className="btn-close" onClick={handleModalClose}></button>
          </div>

          <div className="modal-body p-4">
            {error && <div className="alert alert-danger py-2 small mb-3">{error}</div>}

            {!confirmedBooking ? (
              <div className="row g-4">
                {/* Left Column: Order Summary */}
                <div className="col-md-5">
                  <div className="rounded-4 p-3 h-100" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-bright)' }}>
                    <h6 className="fw-bold text-white mb-3 d-flex align-items-center gap-2">
                      <i className="bi bi-receipt" style={{ color: 'var(--accent-light)' }}></i>
                      <span>Reservation Summary</span>
                    </h6>

                    <div className="p-3 rounded-3 mb-3" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
                      <h6 className="fw-bold text-white mb-1" style={{ fontSize: '1rem' }}>
                        {checkoutData.show.movie_title}
                      </h6>
                      <div className="small text-secondary">{checkoutData.show.theater_name}</div>
                      <div className="small text-secondary">{checkoutData.show.screen_name}</div>
                      <div className="small mt-2 fw-bold" style={{ color: 'var(--gold)' }}>
                        📅 {dateFormatted} · 🕒 {timeFormatted}
                      </div>
                    </div>

                    <div className="small fw-bold mb-2 text-secondary">
                      Reserved Seats ({checkoutData.seats.length})
                    </div>
                    <div className="d-flex flex-column gap-1 mb-3">
                      {checkoutData.seats.map((seat) => (
                        <div 
                          key={seat.seat_id} 
                          className="px-2 py-1 d-flex justify-content-between small rounded"
                          style={{ background: 'var(--bg-elevated)' }}
                        >
                          <span style={{ color: 'var(--text-secondary)' }}>
                            Row {seat.row_label}-{seat.seat_number} ({seat.tier})
                          </span>
                          <strong className="text-white">₹{parseFloat(seat.price).toFixed(2)}</strong>
                        </div>
                      ))}
                    </div>

                    <div className="border-top pt-3 mt-auto" style={{ borderColor: 'var(--border)' }}>
                      <div className="d-flex justify-content-between align-items-center">
                        <span className="fw-bold text-secondary">Payable at Counter:</span>
                        <span className="fs-4 fw-bold" style={{ color: '#4ade80' }}>
                          ₹{checkoutData.totalPrice.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right Column: Pay-at-Theater Reservation Form */}
                <div className="col-md-7">
                  
                  {/* Mandatory 15-Minute Policy Alert Box */}
                  <div 
                    className="p-3 rounded-4 mb-3"
                    style={{ 
                      background: 'rgba(234, 179, 8, 0.12)', 
                      border: '1px solid rgba(234, 179, 8, 0.35)', 
                      color: '#ffffff' 
                    }}
                  >
                    <div className="d-flex align-items-center gap-2 mb-1" style={{ color: 'var(--gold)' }}>
                      <i className="bi bi-exclamation-triangle-fill fs-5"></i>
                      <strong className="small">Pay at Theater Box Office Counter</strong>
                    </div>
                    <p className="small mb-0" style={{ color: '#fef08a', fontSize: '0.82rem', lineHeight: '1.5' }}>
                      <strong>Mandatory Rule:</strong> Payment must be completed at the cinema counter <strong>at least 15 minutes before the show begins</strong>. Unclaimed reservations may be automatically cancelled 15 minutes prior to showtime.
                    </p>
                  </div>

                  <form onSubmit={handleReservationSubmit}>
                    
                    {/* Customer Name Field */}
                    <div className="mb-3">
                      <label htmlFor="checkout-customer-name" className="form-label small text-secondary fw-bold mb-1">Customer Full Name</label>
                      <input
                        id="checkout-customer-name"
                        name="customerName"
                        type="text"
                        className="form-control form-control-sm"
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        placeholder="Enter full name"
                        autoComplete="off"
                        required
                      />
                    </div>

                    {/* Email Field (For E-Ticket Confirmation) */}
                    <div className="mb-3">
                      <label htmlFor="checkout-customer-email" className="form-label small text-secondary fw-bold mb-1">
                        <i className="bi bi-envelope-fill me-1 text-primary"></i>Email Address (For Cinema E-Ticket & PNR)
                      </label>
                      <input
                        id="checkout-customer-email"
                        name="customerEmail"
                        type="email"
                        className={`form-control form-control-sm ${emailError ? 'is-invalid' : ''}`}
                        value={customerEmail}
                        onChange={(e) => {
                          setCustomerEmail(e.target.value);
                          if (emailError) setEmailError('');
                        }}
                        placeholder="yourname@gmail.com"
                        autoComplete="off"
                        required
                      />
                      {emailError ? (
                        <div className="text-danger small mt-1 d-flex align-items-center gap-1" style={{ fontSize: '0.78rem' }}>
                          <i className="bi bi-exclamation-circle-fill"></i>
                          <span>{emailError}</span>
                        </div>
                      ) : (
                        <div className="text-secondary small mt-1" style={{ fontSize: '0.72rem' }}>
                          Your official cinema reservation confirmation and PNR ticket will be sent to this email.
                        </div>
                      )}
                    </div>

                    <button
                      type="submit"
                      className="btn btn-cinema btn-lg w-100 shadow mt-3 fw-bold py-2 d-flex align-items-center justify-content-center gap-2"
                      disabled={loading || !customerEmail || !!emailError}
                    >
                      {loading ? (
                        <>
                          <span className="spinner-border spinner-border-sm" role="status"></span>
                          <span>Locking Seats & Sending E-Ticket...</span>
                        </>
                      ) : (
                        <>
                          <i className="bi bi-ticket-fill"></i>
                          <span>Confirm Seat Reservation (Pay ₹{checkoutData.totalPrice.toFixed(2)} at Counter)</span>
                        </>
                      )}
                    </button>
                  </form>
                </div>
              </div>
            ) : (
              /* Confirmed Reservation Receipt (Pay at Theater) */
              <div className="text-center py-3">
                
                {/* Glowing Success Checkmark in Theme Violet */}
                <div 
                  className="mx-auto mb-3 d-flex align-items-center justify-content-center shadow-lg"
                  style={{ 
                    width: '64px', 
                    height: '64px', 
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #7c3aed, #6366f1)', 
                    color: '#ffffff', 
                    fontSize: '1.8rem',
                    boxShadow: '0 0 25px rgba(124, 58, 237, 0.5)'
                  }}
                >
                  <i className="bi bi-check-lg"></i>
                </div>

                <h3 className="fw-black text-white mb-1" style={{ fontSize: '1.5rem', fontWeight: 900 }}>
                  Seats Reserved Successfully!
                </h3>
                {confirmedBooking.customerEmail && (
                  <div className="small mb-3 d-flex align-items-center justify-content-center gap-1" style={{ color: '#86efac', fontSize: '0.82rem' }}>
                    <i className="bi bi-envelope-check-fill text-success"></i>
                    <span>Cinema E-Ticket dispatched to <strong>{confirmedBooking.customerEmail}</strong></span>
                  </div>
                )}
                
                {/* 15-Minute Payment Reminder Banner */}
                <div 
                  className="p-3 rounded-4 mx-auto mb-3 text-start"
                  style={{ 
                    maxWidth: '480px',
                    background: 'rgba(124, 58, 237, 0.15)', 
                    border: '1px solid rgba(139, 92, 246, 0.45)',
                  }}
                >
                  <div className="d-flex align-items-start gap-2">
                    <i className="bi bi-clock-history fs-5" style={{ color: 'var(--accent-light)' }}></i>
                    <div>
                      <strong className="text-white small d-block">
                        Payment Required at Theater Box Office:
                      </strong>
                      <span className="small" style={{ color: '#c4b5fd' }}>
                        Please show your Booking Reference and complete payment of <strong>₹{parseFloat(confirmedBooking.totalAmount).toFixed(2)}</strong> at the theater counter <strong>at least 15 minutes before the show starts</strong>.
                      </span>
                    </div>
                  </div>
                </div>

                {/* E-Ticket Receipt Card */}
                <div 
                  className="rounded-4 text-start mx-auto p-4 mb-3 text-white shadow-lg"
                  style={{
                    background: 'linear-gradient(135deg, #181824, #12121a)',
                    border: '1px solid var(--border-bright)',
                    maxWidth: '480px',
                  }}
                >
                  <div className="d-flex justify-content-between align-items-start border-bottom pb-3 mb-3" style={{ borderColor: 'var(--border)' }}>
                    <div>
                      <span 
                        style={{ 
                          background: 'rgba(59, 130, 246, 0.2)', 
                          color: '#60a5fa', 
                          border: '1px solid rgba(59, 130, 246, 0.4)',
                          fontSize: '0.68rem',
                          fontWeight: 800,
                          padding: '0.2rem 0.6rem',
                          borderRadius: '20px'
                        }}
                      >
                        CONFIRMED RESERVATION
                      </span>
                      <h4 className="fw-bold text-white mt-1 mb-0" style={{ fontSize: '1.2rem' }}>
                        {checkoutData.show.movie_title}
                      </h4>
                      <span className="small text-secondary">
                        🏢 {checkoutData.show.theater_name}
                      </span>
                    </div>

                    <div className="text-end">
                      <span className="small text-secondary d-block">Booking PNR</span>
                      <strong className="font-monospace fs-5" style={{ color: 'var(--gold)' }}>
                        {confirmedBooking.bookingReference}
                      </strong>
                    </div>
                  </div>

                  <div className="row g-2 small mb-3">
                    <div className="col-6">
                      <span className="text-secondary d-block">Screen</span>
                      <strong className="text-white" style={{ fontSize: '0.88rem' }}>
                        {checkoutData.show.screen_name}
                      </strong>
                    </div>
                    <div className="col-6 text-end">
                      <span className="text-secondary d-block">Showtime</span>
                      <strong className="text-white" style={{ fontSize: '0.88rem' }}>
                        📅 {dateFormatted} · 🕒 {timeFormatted}
                      </strong>
                    </div>

                    <div className="col-12 mt-2">
                      <span className="text-secondary d-block mb-1">Seats Reserved</span>
                      <div className="d-flex flex-wrap gap-1">
                        {confirmedBooking.seats.map((s) => (
                          <span 
                            key={s.seatId} 
                            style={{ 
                              background: 'var(--bg-card)', 
                              border: '1px solid var(--border-bright)', 
                              color: '#ffffff',
                              padding: '0.25rem 0.6rem',
                              borderRadius: '8px',
                              fontWeight: 800,
                              fontSize: '0.8rem'
                            }}
                          >
                            Row {s.label}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="d-flex justify-content-between align-items-center border-top pt-3" style={{ borderColor: 'var(--border)' }}>
                    <div className="d-flex align-items-center gap-2">
                      <i className="bi bi-clock-history fs-5" style={{ color: 'var(--gold)' }}></i>
                      <span className="small text-secondary">Pay at Box Office</span>
                    </div>
                    <span className="fs-5 fw-bold" style={{ color: 'var(--gold)' }}>
                      ₹{parseFloat(confirmedBooking.totalAmount).toFixed(2)} Due at Counter
                    </span>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="d-flex justify-content-center">
                  <button 
                    className="btn btn-outline-secondary rounded-pill px-4 text-white" 
                    onClick={() => window.print()}
                    style={{ borderColor: 'var(--border-bright)' }}
                  >
                    <i className="bi bi-printer me-2"></i> Print Receipt
                  </button>
                </div>


              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

import React from 'react';

export default function Navbar({ user, searchQuery, onSearchChange, onOpenAuth, onLogout, onOpenMyBookings, onHomeClick, onOpenDemands, onOpenAdmin }) {
  return (
    <nav className="navbar navbar-expand-lg cinema-navbar py-2 px-3 sticky-top">
      <div className="container-fluid cinema-container d-flex align-items-center justify-content-between gap-3">
        
        {/* Brand */}
        <a 
          className="cinema-brand-title text-decoration-none" 
          href="#home"
          onClick={(e) => { e.preventDefault(); onHomeClick(); }}
        >
          <span className="cinema-brand-logo-icon">🎬</span>
          <span style={{ color: 'var(--text-primary)' }}>SeatLock</span>
          <span className="cinema-brand-tag">AP & TELANGANA</span>
        </a>

        {/* Global Live Search Bar */}
        <div className="d-flex align-items-center flex-grow-1 mx-2 mx-md-4" style={{ maxWidth: '440px' }}>
          <div className="cinema-search-box w-100">
            <i className="bi bi-search" style={{ color: 'var(--text-muted)' }}></i>
            <input 
              id="cinema-search-input"
              name="searchQuery"
              type="text"
              className="cinema-search-input"
              placeholder="Search Telugu movies, genres, actors..."
              aria-label="Search Telugu movies, genres, actors"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
            />
            {searchQuery && (
              <button 
                className="btn btn-sm btn-link p-0 text-decoration-none"
                style={{ color: 'var(--text-muted)' }}
                onClick={() => onSearchChange('')}
              >
                <i className="bi bi-x-circle-fill"></i>
              </button>
            )}
          </div>
        </div>

        {/* Action Buttons & User Account */}
        <div className="d-flex align-items-center gap-2">
          {/* Audience Demand Vault Button (Only for regular moviegoers) */}
          {user?.role !== 'ADMIN' && (
            <button 
              className="btn btn-sm rounded-pill px-3 fw-bold d-flex align-items-center gap-2 shadow-sm"
              style={{ 
                background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.18), rgba(249, 115, 22, 0.18))', 
                border: '1px solid rgba(249, 115, 22, 0.45)', 
                color: '#fdba74' 
              }}
              onClick={onOpenDemands}
              title="Vote or Demand Movies for Theatrical Screening"
            >
              <span>🔥</span>
              <span className="d-none d-md-inline">Demand a Movie</span>
            </button>
          )}

          {/* Admin Operations Button (Only for ADMIN role) */}
          {user?.role === 'ADMIN' && (
            <button 
              className="btn btn-sm rounded-pill px-3 fw-bold d-flex align-items-center gap-1 shadow-sm"
              style={{ 
                background: 'linear-gradient(135deg, #f5c518, #f59e0b)', 
                border: 'none', 
                color: '#000000',
                boxShadow: '0 2px 10px rgba(245, 197, 24, 0.35)'
              }}
              onClick={onOpenAdmin}
              title="Cinema Admin Operations Portal"
            >
              <i className="bi bi-shield-lock-fill"></i>
              <span className="d-none d-md-inline">Admin Ops</span>
            </button>
          )}

          {user ? (
            <>
              {/* My Tickets Button (Only for regular customers) */}
              {user.role !== 'ADMIN' && (
                <button 
                  className="btn btn-sm rounded-pill px-3 fw-bold d-flex align-items-center gap-2"
                  style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-bright)', color: 'var(--text-secondary)' }}
                  onClick={onOpenMyBookings}
                >
                  <i className="bi bi-ticket-detailed" style={{ color: 'var(--red)' }}></i>
                  <span className="d-none d-sm-inline">My Tickets</span>
                </button>
              )}

              <div className="d-flex align-items-center gap-2 px-3 py-1 rounded-pill"
                style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-bright)' }}>
                <i className="bi bi-person-circle" style={{ color: 'var(--accent-light)' }}></i>
                <span className="small fw-bold" style={{ color: 'var(--text-primary)' }}>{user.fullName.split(' ')[0]}</span>
              </div>

              <button 
                className="btn btn-sm rounded-circle p-2 d-flex align-items-center justify-content-center"
                style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-bright)', color: 'var(--text-muted)', width: '36px', height: '36px' }}
                onClick={onLogout}
                title="Logout"
              >
                <i className="bi bi-box-arrow-right"></i>
              </button>
            </>
          ) : (
            <button 
              className="btn btn-cinema btn-sm px-4"
              onClick={onOpenAuth}
            >
              Sign In
            </button>
          )}
        </div>

      </div>
    </nav>
  );
}

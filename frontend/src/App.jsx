import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import MovieList from './components/MovieList';
import SeatMap from './components/SeatMap';
import AuthModal from './components/AuthModal';
import CheckoutModal from './components/CheckoutModal';
import MyBookingsModal from './components/MyBookingsModal';
import MovieReviewsModal from './components/MovieReviewsModal';
import AudienceDemandModal from './components/AudienceDemandModal';
import AdminPanelModal from './components/AdminPanelModal';
import { authApi } from './services/api';

export default function App() {
  const [user, setUser] = useState(null);
  const [currentView, setCurrentView] = useState('home'); // 'home' | 'seatmap'
  const [activeShowId, setActiveShowId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Modals state
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [checkoutData, setCheckoutData] = useState(null);
  const [bookingNotice, setBookingNotice] = useState(null);
  const [showMyBookings, setShowMyBookings] = useState(false);
  const [showDemandsModal, setShowDemandsModal] = useState(false);
  const [showAdminModal, setShowAdminModal] = useState(false);

  // Reviews modal state
  const [showReviewsModal, setShowReviewsModal] = useState(false);
  const [movieForReview, setMovieForReview] = useState(null);

  // Check existing token on initial render
  useEffect(() => {
    const token = localStorage.getItem('seatlock_token');
    if (token) {
      authApi.getMe()
        .then((res) => setUser(res.data.data))
        .catch(() => localStorage.removeItem('seatlock_token'));
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('seatlock_token');
    setUser(null);
  };

  const handleSelectShow = (showId) => {
    setActiveShowId(showId);
    setCurrentView('seatmap');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleProceedToCheckout = (data) => {
    setCheckoutData(data);
    setShowCheckoutModal(true);
  };

  const handleOpenReviews = (movie) => {
    setMovieForReview(movie);
    setShowReviewsModal(true);
  };

  // Called when review is posted or deleted
  const handleReviewUpdated = () => {
    setRefreshTrigger((prev) => prev + 1);
  };

  return (
    <div className="d-flex flex-column min-vh-100" style={{ backgroundColor: '#0b0f19', color: '#f9fafb' }}>
      {/* Top Navbar */}
      <Navbar
        user={user}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onOpenAuth={() => setShowAuthModal(true)}
        onLogout={handleLogout}
        onOpenMyBookings={() => setShowMyBookings(true)}
        onOpenDemands={() => setShowDemandsModal(true)}
        onOpenAdmin={() => setShowAdminModal(true)}
        onHomeClick={() => {
          setCurrentView('home');
          setSearchQuery('');
        }}
      />

      {/* Main Content Area */}
      <main className="flex-grow-1 pb-5">
        {currentView === 'home' && (
          <MovieList 
            searchQuery={searchQuery}
            onSelectShow={handleSelectShow} 
            onOpenReviews={handleOpenReviews}
            refreshTrigger={refreshTrigger}
          />
        )}

        {currentView === 'seatmap' && activeShowId && (
          <SeatMap
            showId={activeShowId}
            user={user}
            bookingNotice={bookingNotice}
            onClearBookingNotice={() => setBookingNotice(null)}
            onProceedToCheckout={handleProceedToCheckout}
            onRequireAuth={() => setShowAuthModal(true)}
            onBack={() => {
              setBookingNotice(null);
              setCurrentView('home');
            }}
          />
        )}
      </main>

      {/* Authentication Modal */}
      <AuthModal
        show={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onAuthSuccess={(u) => setUser(u)}
      />

      {/* Seat Reservation Modal */}
      <CheckoutModal
        show={showCheckoutModal}
        checkoutData={checkoutData}
        user={user}
        onClose={(confirmedData) => {
          setShowCheckoutModal(false);
          setCheckoutData(null);
          if (confirmedData) {
            // Stay right on the seat selection page and show the 15-minute policy notice!
            setBookingNotice(confirmedData);
          }
          setRefreshTrigger((prev) => prev + 1);
        }}
        onBookingSuccess={(confirmedData) => {
          setBookingNotice(confirmedData);
        }}
      />

      {/* My Bookings & E-Tickets Modal */}
      <MyBookingsModal
        show={showMyBookings}
        onClose={() => setShowMyBookings(false)}
        onOpenReviewForMovie={(m) => handleOpenReviews(m)}
      />

      {/* Audience Demands & Movie Curation Modal */}
      <AudienceDemandModal
        show={showDemandsModal}
        user={user}
        onClose={() => setShowDemandsModal(false)}
        onRequireAuth={() => {
          setShowDemandsModal(false);
          setShowAuthModal(true);
        }}
        onMovieScheduled={() => setRefreshTrigger((prev) => prev + 1)}
      />

      {/* Admin Cinema Operations Portal Modal */}
      <AdminPanelModal
        show={showAdminModal}
        user={user}
        onClose={() => setShowAdminModal(false)}
        onMovieAdded={() => setRefreshTrigger((prev) => prev + 1)}
        onShowScheduled={() => setRefreshTrigger((prev) => prev + 1)}
      />

      {/* Verified Audience Reviews Modal */}
      <MovieReviewsModal
        show={showReviewsModal}
        movie={movieForReview}
        user={user}
        onClose={() => {
          setShowReviewsModal(false);
          setMovieForReview(null);
        }}
        onRequireAuth={() => {
          setShowReviewsModal(false);
          setShowAuthModal(true);
        }}
        onReviewUpdated={handleReviewUpdated}
      />

      {/* Footer */}
      <footer className="footer mt-auto py-3 border-top text-center text-secondary small" style={{ borderColor: 'var(--cinema-border)', backgroundColor: '#0d1117' }}>
        <div className="container">
          <span>SeatLock Cinema Engine • Real-Time Concurrency & Verified Reviews • PostgreSQL</span>
        </div>
      </footer>
    </div>
  );
}

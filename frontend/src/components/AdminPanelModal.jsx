import React, { useState, useEffect } from 'react';
import { adminApi, demandsApi, movieApi } from '../services/api';

export default function AdminPanelModal({ show, user, onClose, onMovieAdded, onShowScheduled }) {
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'demands' | 'addMovie' | 'scheduleShow'
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Data states
  const [dashboardStats, setDashboardStats] = useState(null);
  const [recentBookings, setRecentBookings] = useState([]);
  const [demands, setDemands] = useState([]);
  const [moviesList, setMoviesList] = useState([]);
  const [theatersList, setTheatersList] = useState([]);

  // Form states: Add Movie
  const [movieForm, setMovieForm] = useState({
    title: '',
    genre: '',
    durationMinutes: 150,
    rating: 9.0,
    releaseDate: new Date().toISOString().split('T')[0],
    actors: '',
    posterUrl: '',
    trailerUrl: '',
    description: '',
  });

  // Form states: Schedule Show (pre-filled with valid date and time to prevent incomplete date errors)
  const [showForm, setShowForm] = useState({
    movieId: '',
    theaterId: '',
    screenId: '',
    showDate: new Date().toISOString().split('T')[0],
    showTime: '18:15',
    customTime: '20:00',
    basePrice: 250,
    requestId: null,
  });

  const [actionLoading, setActionLoading] = useState(false);
  const [movieSearch, setMovieSearch] = useState('');
  const [deletingMovieId, setDeletingMovieId] = useState(null);
  const [editingMovie, setEditingMovie] = useState(null);
  const [editForm, setEditForm] = useState({
    title: '',
    genre: '',
    durationMinutes: 150,
    rating: '9.0',
    releaseDate: '',
    actors: '',
    posterUrl: '',
    description: '',
    hypeCount: 150,
  });
  const [showAddTheater, setShowAddTheater] = useState(false);
  const [scheduledShows, setScheduledShows] = useState([]);
  const [cancelingShowId, setCancelingShowId] = useState(null);
  const [showSearch, setShowSearch] = useState('');
  const [theaterForm, setTheaterForm] = useState({
    name: '',
    city: 'Hyderabad (Telangana)',
    address: '',
    totalScreens: 3,
  });

  const getSafePosterUrl = (url) => {
    if (!url || typeof url !== 'string') {
      return 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=500&auto=format&fit=crop';
    }
    const trimmed = url.trim();
    if (trimmed.startsWith('data:')) {
      if (!trimmed.startsWith('data:image/') || !trimmed.includes(';base64,') || trimmed.length < 50 || /\s/.test(trimmed)) {
        return 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=500&auto=format&fit=crop';
      }
    }
    return trimmed;
  };

  const filteredCatalogMovies = moviesList.filter(m => 
    m.title.toLowerCase().includes(movieSearch.toLowerCase()) || 
    (m.genre && m.genre.toLowerCase().includes(movieSearch.toLowerCase())) ||
    (m.actors && m.actors.toLowerCase().includes(movieSearch.toLowerCase()))
  );

  const filteredScheduledShows = scheduledShows.filter(s =>
    (s.movie_title && s.movie_title.toLowerCase().includes(showSearch.toLowerCase())) ||
    (s.theater_name && s.theater_name.toLowerCase().includes(showSearch.toLowerCase())) ||
    (s.theater_city && s.theater_city.toLowerCase().includes(showSearch.toLowerCase())) ||
    (s.screen_name && s.screen_name.toLowerCase().includes(showSearch.toLowerCase()))
  );

  const fetchAdminData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [dashRes, demandsRes, moviesRes, theatersRes, showsRes] = await Promise.all([
        adminApi.getDashboard(),
        demandsApi.getAll(),
        movieApi.getAll(),
        adminApi.getTheatersAndScreens(),
        adminApi.getShows(),
      ]);

      setDashboardStats(dashRes.data.stats);
      setRecentBookings(dashRes.data.recentBookings || []);
      setDemands(demandsRes.data.data || []);
      setMoviesList(moviesRes.data.data || []);
      setTheatersList(theatersRes.data.theaters || []);
      setScheduledShows(showsRes.data.data || []);

      if (moviesRes.data.data?.length > 0 && !showForm.movieId) {
        setShowForm(prev => ({ ...prev, movieId: moviesRes.data.data[0].id }));
      }
      if (theatersRes.data.theaters?.length > 0 && !showForm.theaterId) {
        const firstTheater = theatersRes.data.theaters[0];
        setShowForm(prev => ({
          ...prev,
          theaterId: firstTheater.id,
          screenId: firstTheater.screens[0]?.id || '',
        }));
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load admin operations dashboard');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (show && user?.role === 'ADMIN') {
      fetchAdminData();
      setSuccessMsg(null);
      setError(null);
    }
  }, [show, user]);

  // Auto-dismiss success alert after 4 seconds
  useEffect(() => {
    if (successMsg) {
      const timer = setTimeout(() => {
        setSuccessMsg(null);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [successMsg]);

  // Auto-dismiss error alert after 6 seconds
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => {
        setError(null);
      }, 6000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setError(null);
    setSuccessMsg(null);
  };

  if (!show || user?.role !== 'ADMIN') return null;

  // Handle Add Movie Submit
  const handleAddMovieSubmit = async (e) => {
    e.preventDefault();
    setActionLoading(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await adminApi.createMovie(movieForm);
      setSuccessMsg(res.data.message);
      setMovieForm({
        title: '',
        genre: '',
        durationMinutes: 150,
        rating: 9.0,
        releaseDate: new Date().toISOString().split('T')[0],
        actors: '',
        posterUrl: '',
        trailerUrl: '',
        description: '',
      });
      await fetchAdminData();
      if (onMovieAdded) onMovieAdded();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create movie');
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Delete Movie from Catalog
  const handleDeleteMovie = async (movieId, movieTitle) => {
    if (!window.confirm(`Are you sure you want to permanently delete "${movieTitle}" and all its show schedules from the catalog?`)) {
      return;
    }

    setDeletingMovieId(movieId);
    setError(null);
    setSuccessMsg(null);

    try {
      const res = await adminApi.deleteMovie(movieId, false);
      setSuccessMsg(res.data.message);
      await fetchAdminData();
      if (onMovieAdded) onMovieAdded();
      if (onShowScheduled) onShowScheduled();
    } catch (err) {
      if (err.response?.data?.hasActiveBookings) {
        const forceConfirm = window.confirm(
          `${err.response.data.error}\n\nDo you want to FORCE DELETE this movie, cancel all its scheduled shows, and email all ticket holders?`
        );
        if (forceConfirm) {
          try {
            const forceRes = await adminApi.deleteMovie(movieId, true);
            setSuccessMsg(forceRes.data.message);
            await fetchAdminData();
            if (onMovieAdded) onMovieAdded();
            if (onShowScheduled) onShowScheduled();
          } catch (forceErr) {
            setError(forceErr.response?.data?.error || 'Failed to force delete movie');
          }
        }
      } else {
        setError(err.response?.data?.error || 'Failed to delete movie');
      }
    } finally {
      setDeletingMovieId(null);
    }
  };

  // Open Edit Movie Modal
  const handleOpenEditMovie = (movie) => {
    setEditingMovie(movie);
    setEditForm({
      title: movie.title || '',
      genre: movie.genre || '',
      durationMinutes: movie.duration_mins || 150,
      rating: movie.rating ? String(movie.rating) : '9.0',
      releaseDate: movie.release_date ? movie.release_date.split('T')[0] : '',
      actors: movie.actors || '',
      posterUrl: movie.poster_url || '',
      description: movie.description || '',
      hypeCount: movie.hype_count || 100,
    });
  };

  const handleCloseEditMovie = () => {
    setEditingMovie(null);
  };

  // Handle Update / Edit Movie Submit
  const handleUpdateMovieSubmit = async (e) => {
    e.preventDefault();
    if (!editingMovie) return;
    setActionLoading(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await adminApi.updateMovie(editingMovie.id, {
        title: editForm.title,
        genre: editForm.genre,
        durationMinutes: parseInt(editForm.durationMinutes, 10),
        rating: editForm.rating,
        releaseDate: editForm.releaseDate,
        actors: editForm.actors,
        posterUrl: editForm.posterUrl,
        description: editForm.description,
        hypeCount: parseInt(editForm.hypeCount || 100, 10),
      });
      setSuccessMsg(res.data.message || `Movie "${editForm.title}" updated successfully!`);
      setEditingMovie(null);
      await fetchAdminData();
      if (onMovieAdded) onMovieAdded();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update movie');
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Add Theater Submit with Duplicate Prevention
  const handleCreateTheaterSubmit = async (e) => {
    e.preventDefault();
    setActionLoading(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await adminApi.createTheater(theaterForm);
      setSuccessMsg(res.data.message);
      setTheaterForm({
        name: '',
        city: 'Hyderabad (Telangana)',
        address: '',
        totalScreens: 3,
      });
      setShowAddTheater(false);
      await fetchAdminData();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to register theater');
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Schedule Show Submit
  const handleScheduleShowSubmit = async (e) => {
    e.preventDefault();
    if (!showForm.movieId || !showForm.screenId || !showForm.showDate) {
      setError('Please select movie, theater multiplex, screen auditorium, and show date');
      return;
    }

    const timeValue = showForm.showTime === 'custom' 
      ? (showForm.customTime || '20:00') 
      : (showForm.showTime || '18:15');
    const combinedStartTime = `${showForm.showDate}T${timeValue}:00`;

    setActionLoading(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await adminApi.scheduleShow({
        movieId: parseInt(showForm.movieId, 10),
        screenId: parseInt(showForm.screenId, 10),
        startTime: combinedStartTime,
        basePrice: parseFloat(showForm.basePrice),
        requestId: showForm.requestId || null,
      });

      setSuccessMsg(res.data.message);
      setShowForm(prev => ({ ...prev, requestId: null }));
      await fetchAdminData();
      if (onShowScheduled) onShowScheduled();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to schedule show');
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Cancel / Delete a Scheduled Show
  const handleCancelShow = async (showId, movieTitle, theaterName, timeStr, bookedCount) => {
    let warningPrompt = `Are you sure you want to cancel the scheduled show for "${movieTitle}" at ${theaterName} (${timeStr})?`;
    if (bookedCount > 0) {
      warningPrompt = `⚠️ WARNING: This show has ${bookedCount} booked customer ticket(s).\nCanceling will revoke these tickets and cancel customer reservations.\n\nAre you sure you want to FORCE CANCEL this show?`;
    }
    if (!window.confirm(warningPrompt)) {
      return;
    }

    setCancelingShowId(showId);
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await adminApi.cancelShow(showId, bookedCount > 0);
      setSuccessMsg(res.data.message || 'Show canceled successfully.');
      await fetchAdminData();
      if (onShowScheduled) onShowScheduled();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to cancel scheduled show');
    } finally {
      setCancelingShowId(null);
    }
  };

  // Handle Greenlight Audience Demand
  const handleGreenlight = async (demand) => {
    setActionLoading(true);
    setError(null);
    try {
      const res = await adminApi.greenlightDemand(demand.id, { createAsMovie: true });
      setSuccessMsg(res.data.message);
      await fetchAdminData();
      if (onMovieAdded) onMovieAdded();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to greenlight demand');
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Reject Audience Demand
  const handleReject = async (demandId) => {
    const reason = window.prompt('Reason for rejection / unavailability (e.g. Distribution rights expired):');
    if (reason === null) return;

    setActionLoading(true);
    try {
      await adminApi.rejectDemand(demandId, { adminNotes: reason });
      setSuccessMsg('Audience request rejected with notice to fans.');
      await fetchAdminData();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to reject request');
    } finally {
      setActionLoading(false);
    }
  };

  // Switch to Schedule Tab pre-filled with movie
  const openSchedulerForDemand = (demand) => {
    setError(null);
    setSuccessMsg(null);
    let matchedMovie = moviesList.find(m => m.title.toLowerCase().includes(demand.title.toLowerCase()));
    if (matchedMovie) {
      setShowForm(prev => ({
        ...prev,
        movieId: matchedMovie.id,
        requestId: demand.id,
      }));
    } else {
      setShowForm(prev => ({
        ...prev,
        requestId: demand.id,
      }));
    }
    setActiveTab('scheduleShow');
  };

  const selectedTheater = theatersList.find(t => t.id === parseInt(showForm.theaterId, 10));

  return (
    <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0, 0, 0, 0.9)', backdropFilter: 'blur(10px)' }}>
      <div className="modal-dialog modal-dialog-centered modal-xl">
        <div className="modal-content border-0 rounded-4 shadow-lg overflow-hidden" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-bright)' }}>
          
          {/* Header */}
          <div className="modal-header border-0 px-4 pt-4 pb-3" style={{ background: 'var(--bg-card)', borderBottom: '1px solid var(--border)' }}>
            <div className="d-flex align-items-center justify-content-between w-100">
              <div className="d-flex align-items-center gap-3">
                <div 
                  className="rounded-circle d-flex align-items-center justify-content-center"
                  style={{ width: '45px', height: '45px', background: 'linear-gradient(135deg, #f5c518, #f59e0b)', color: '#000', fontSize: '1.4rem' }}
                >
                  <i className="bi bi-shield-lock-fill"></i>
                </div>
                <div>
                  <h4 className="fw-bold text-white mb-0" style={{ letterSpacing: '-0.3px' }}>
                    SeatLock Admin Portal
                  </h4>
                  <span className="text-secondary small">
                    Logged in as: <strong style={{ color: 'var(--gold)' }}>{user?.fullName}</strong>
                  </span>
                </div>
              </div>
              <button type="button" className="btn-close" onClick={onClose}></button>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="px-4 py-2 border-bottom d-flex gap-2 flex-wrap" style={{ background: 'rgba(255, 255, 255, 0.02)', borderColor: 'var(--border)' }}>
            <button 
              className={`btn btn-sm rounded-pill px-3 fw-bold ${activeTab === 'overview' ? 'btn-warning text-dark' : 'btn-outline-secondary'}`}
              onClick={() => handleTabChange('overview')}
            >
              <i className="bi bi-speedometer2 me-1"></i> Overview
            </button>
            <button 
              className={`btn btn-sm rounded-pill px-3 fw-bold ${activeTab === 'manageMovies' ? 'btn-warning text-dark' : 'btn-outline-secondary'}`}
              onClick={() => handleTabChange('manageMovies')}
            >
              <i className="bi bi-film me-1"></i> Manage Movies ({moviesList.length})
            </button>
            <button 
              className={`btn btn-sm rounded-pill px-3 fw-bold ${activeTab === 'addMovie' ? 'btn-warning text-dark' : 'btn-outline-secondary'}`}
              onClick={() => handleTabChange('addMovie')}
            >
              <i className="bi bi-plus-circle me-1"></i> Add Movie
            </button>
            <button 
              className={`btn btn-sm rounded-pill px-3 fw-bold ${activeTab === 'scheduleShow' ? 'btn-warning text-dark' : 'btn-outline-secondary'}`}
              onClick={() => handleTabChange('scheduleShow')}
            >
              <i className="bi bi-calendar-plus me-1"></i> Schedule Shows
            </button>
            <button 
              className={`btn btn-sm rounded-pill px-3 fw-bold ${activeTab === 'demands' ? 'btn-warning text-dark' : 'btn-outline-secondary'}`}
              onClick={() => handleTabChange('demands')}
            >
              <i className="bi bi-fire me-1"></i> Audience Demands ({demands.length})
            </button>
          </div>

          {/* Body */}
          <div className="modal-body px-4 py-3" style={{ maxHeight: '75vh', overflowY: 'auto' }}>
            {error && (
              <div 
                className="alert alert-danger py-2 px-3 small mb-3 d-flex align-items-center justify-content-between rounded-3 border-0 shadow-sm"
                style={{ background: 'rgba(239, 68, 68, 0.18)', border: '1px solid rgba(239, 68, 68, 0.35)', color: '#fca5a5' }}
              >
                <div className="d-flex align-items-center gap-2">
                  <i className="bi bi-exclamation-triangle-fill text-danger"></i>
                  <span>{error}</span>
                </div>
                <button 
                  type="button" 
                  className="btn-close btn-close-white ms-2" 
                  onClick={() => setError(null)} 
                  aria-label="Close"
                  style={{ filter: 'invert(1) grayscale(100%) brightness(200%)', transform: 'scale(0.8)' }}
                ></button>
              </div>
            )}
            {successMsg && (
              <div 
                className="alert alert-success py-2 px-3 small mb-3 d-flex align-items-center justify-content-between rounded-3 border-0 shadow-sm"
                style={{ background: 'rgba(34, 197, 94, 0.18)', border: '1px solid rgba(34, 197, 94, 0.35)', color: '#86efac' }}
              >
                <div className="d-flex align-items-center gap-2">
                  <i className="bi bi-check-circle-fill text-success"></i>
                  <span>{successMsg}</span>
                </div>
                <button 
                  type="button" 
                  className="btn-close btn-close-white ms-2" 
                  onClick={() => setSuccessMsg(null)} 
                  aria-label="Close"
                  style={{ filter: 'invert(1) grayscale(100%) brightness(200%)', transform: 'scale(0.8)' }}
                ></button>
              </div>
            )}

            {loading ? (
              <div className="text-center py-5">
                <div className="spinner-border text-warning" role="status"></div>
                <div className="text-secondary small mt-2">Loading operations data...</div>
              </div>
            ) : activeTab === 'overview' ? (
              /* TAB 1: OVERVIEW METRICS */
              <div>
                <div className="row g-3 mb-4">
                  <div className="col-md-3">
                    <div className="p-3 rounded-4" style={{ background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.25)' }}>
                      <div className="text-secondary small">Total Catalog Movies</div>
                      <div className="fs-3 fw-bold text-white font-monospace">{dashboardStats?.totalMovies || 0}</div>
                      <div className="small text-muted mt-1">AP & Telangana Catalog</div>
                    </div>
                  </div>
                  <div className="col-md-3">
                    <div className="p-3 rounded-4" style={{ background: 'rgba(234, 179, 8, 0.1)', border: '1px solid rgba(234, 179, 8, 0.25)' }}>
                      <div className="text-secondary small">Active Upcoming Shows</div>
                      <div className="fs-3 fw-bold font-monospace" style={{ color: 'var(--gold)' }}>{dashboardStats?.totalUpcomingShows || 0}</div>
                      <div className="small text-muted mt-1">Multi-city multiplexes</div>
                    </div>
                  </div>
                  <div className="col-md-3">
                    <div className="p-3 rounded-4" style={{ background: 'rgba(34, 197, 94, 0.1)', border: '1px solid rgba(34, 197, 94, 0.25)' }}>
                      <div className="text-secondary small">Confirmed Ticket Bookings</div>
                      <div className="fs-3 fw-bold text-success font-monospace">{dashboardStats?.confirmedBookings || 0}</div>
                      <div className="small text-muted mt-1">Total: {dashboardStats?.totalBookings || 0} reservations</div>
                    </div>
                  </div>
                  <div className="col-md-3">
                    <div className="p-3 rounded-4" style={{ background: 'rgba(139, 92, 246, 0.1)', border: '1px solid rgba(139, 92, 246, 0.25)' }}>
                      <div className="text-secondary small">Gross Platform Revenue</div>
                      <div className="fs-3 fw-bold font-monospace" style={{ color: '#c4b5fd' }}>₹{dashboardStats?.totalRevenue || '0.00'}</div>
                      <div className="small text-muted mt-1">Box office & theater tickets</div>
                    </div>
                  </div>
                </div>

                {/* Audience Demands Status Box */}
                <div className="p-3 rounded-4 mb-4" style={{ background: 'rgba(249, 115, 22, 0.08)', border: '1px solid rgba(249, 115, 22, 0.25)' }}>
                  <div className="d-flex justify-content-between align-items-center mb-2">
                    <h6 className="fw-bold mb-0 text-white d-flex align-items-center gap-2">
                      <span className="text-warning">🔥</span> Audience Demand Pipeline
                    </h6>
                    <button 
                      className="btn btn-sm btn-outline-warning rounded-pill px-3 py-1"
                      onClick={() => handleTabChange('demands')}
                    >
                      Manage Demands
                    </button>
                  </div>
                  <div className="d-flex gap-4 flex-wrap text-secondary small">
                    <div>Total Fan Requests: <strong className="text-white">{dashboardStats?.audienceRequests?.total_requests || 0}</strong></div>
                    <div>Active Voting: <strong className="text-warning">{dashboardStats?.audienceRequests?.voting_requests || 0}</strong></div>
                    <div>Audience Greenlit: <strong className="text-success">{dashboardStats?.audienceRequests?.greenlit_requests || 0}</strong></div>
                    <div>Shows Scheduled: <strong style={{ color: '#93c5fd' }}>{dashboardStats?.audienceRequests?.scheduled_requests || 0}</strong></div>
                  </div>
                </div>

                {/* Recent Bookings */}
                <h6 className="fw-bold text-white mb-2">Recent Bookings</h6>
                <div className="table-responsive rounded-3 overflow-hidden border" style={{ borderColor: 'var(--border)' }}>
                  <table className="table table-dark table-hover mb-0 small">
                    <thead style={{ background: 'var(--bg-card)' }}>
                      <tr>
                        <th>Ref PNR</th>
                        <th>Movie</th>
                        <th>Auditorium & Theater</th>
                        <th>Show Time</th>
                        <th>Customer</th>
                        <th>Amount</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentBookings.map(b => (
                        <tr key={b.booking_id}>
                          <td className="font-monospace text-warning fw-bold">{b.booking_reference}</td>
                          <td className="fw-bold text-white">{b.movie_title}</td>
                          <td className="text-secondary">{b.theater_name}</td>
                          <td className="text-muted">{new Date(b.start_time).toLocaleString()}</td>
                          <td>
                            <span className="d-block text-white">{b.customer_name}</span>
                            <span className="text-muted" style={{ fontSize: '0.7rem' }}>{b.customer_email}</span>
                          </td>
                          <td className="font-monospace text-success fw-bold">₹{parseFloat(b.total_amount).toFixed(2)}</td>
                          <td>
                            <span className={`badge ${b.status === 'CONFIRMED' ? 'bg-success-subtle text-success' : 'bg-danger-subtle text-danger'}`}>
                              {b.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : activeTab === 'manageMovies' ? (
              /* TAB: MANAGE MOVIES */
              <div>
                <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
                  <div>
                    <h5 className="fw-bold text-white mb-0">Manage Movies</h5>
                    <span className="text-secondary small">
                      {moviesList.length} movies in catalog
                    </span>
                  </div>

                  {/* Search in Catalog */}
                  <div style={{ maxWidth: '320px' }} className="w-100">
                    <input 
                      id="admin-catalog-movie-search"
                      name="movieSearch"
                      type="text" 
                      className="form-control form-control-sm rounded-pill"
                      style={{ background: 'rgba(255, 255, 255, 0.05)', color: '#fff', border: '1px solid var(--border)' }}
                      placeholder="Search movie title, cast, genre..."
                      aria-label="Search movie title, cast, genre"
                      value={movieSearch}
                      onChange={(e) => setMovieSearch(e.target.value)}
                    />
                  </div>
                </div>

                <div className="d-flex flex-column gap-2">
                  {filteredCatalogMovies.length === 0 ? (
                    <div className="text-center py-4 text-secondary">
                      No movies found matching "{movieSearch}".
                    </div>
                  ) : (
                    filteredCatalogMovies.map(m => (
                      <div 
                        key={m.id}
                        className="p-3 rounded-4 d-flex justify-content-between align-items-center flex-wrap gap-3"
                        style={{ background: 'var(--bg-card)', border: '1px solid var(--border-bright)' }}
                      >
                        <div className="d-flex align-items-center gap-3">
                          <img 
                            src={getSafePosterUrl(m.poster_url)} 
                            alt={m.title}
                            style={{ width: '48px', height: '68px', borderRadius: '8px', objectFit: 'cover' }}
                            onError={(e) => { e.target.src = 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=500&auto=format&fit=crop'; }}
                          />
                          <div>
                            <div className="d-flex align-items-center gap-2 mb-1">
                              <h6 className="fw-bold text-white mb-0">{m.title}</h6>
                              <span className="badge bg-dark border border-secondary" style={{ fontSize: '0.7rem' }}>
                                ID: {m.id}
                              </span>
                              <span className="badge bg-warning text-dark fw-bold" style={{ fontSize: '0.7rem' }}>
                                ★ {m.rating}
                              </span>
                            </div>
                            <div className="text-secondary small">
                              🎭 {m.genre} · ⏱️ {m.duration_mins} mins {m.release_date ? `· 📅 ${new Date(m.release_date).toLocaleDateString()}` : ''}
                            </div>
                            {m.actors && (
                              <div className="text-muted small mt-1" style={{ fontSize: '0.72rem' }}>
                                👥 <strong>Cast:</strong> {m.actors}
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="d-flex align-items-center gap-2">
                          <button 
                            type="button"
                            className="btn btn-sm btn-outline-warning rounded-pill px-3 fw-bold d-flex align-items-center gap-1"
                            onClick={() => handleOpenEditMovie(m)}
                            title={`Edit details for ${m.title}`}
                          >
                            <i className="bi bi-pencil-square"></i>
                            <span>Edit Movie</span>
                          </button>
                          <button 
                            type="button"
                            className="btn btn-sm btn-outline-danger rounded-pill px-3 fw-bold d-flex align-items-center gap-1"
                            onClick={() => handleDeleteMovie(m.id, m.title)}
                            disabled={deletingMovieId === m.id}
                            title="Permanently remove movie and all its schedules"
                          >
                            {deletingMovieId === m.id ? (
                              <>
                                <span className="spinner-border spinner-border-sm" role="status"></span>
                                <span>Deleting...</span>
                              </>
                            ) : (
                              <>
                                <i className="bi bi-trash3-fill"></i>
                                <span>Delete Movie</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            ) : activeTab === 'demands' ? (
              /* TAB 2: AUDIENCE DEMANDS */
              <div>
                <div className="d-flex justify-content-between align-items-center mb-3">
                  <div>
                    <h5 className="fw-bold text-white mb-0">Audience Demands</h5>
                  </div>
                </div>

                <div className="d-flex flex-column gap-3">
                  {demands.map((d, index) => {
                    return (
                      <div 
                        key={d.id} 
                        className="rounded-4 p-3 d-flex justify-content-between align-items-center flex-wrap gap-3"
                        style={{ 
                          background: index === 0 ? 'rgba(234, 179, 8, 0.05)' : 'var(--bg-card)', 
                          border: index === 0 ? '1px solid rgba(234, 179, 8, 0.35)' : '1px solid var(--border-bright)' 
                        }}
                      >
                        <div className="d-flex align-items-center gap-3">
                          <img 
                            src={getSafePosterUrl(d.poster_url)} 
                            alt={d.title}
                            style={{ width: '56px', height: '80px', borderRadius: '8px', objectFit: 'cover' }}
                            onError={(e) => { e.target.src = 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=500&auto=format&fit=crop'; }}
                          />
                          <div>
                            <div className="d-flex align-items-center gap-2 mb-1 flex-wrap">
                              {index === 0 ? (
                                <span className="badge rounded-pill fw-bold" style={{ background: 'rgba(234, 179, 8, 0.25)', color: '#fbbf24', border: '1px solid #f59e0b' }}>
                                  🏆 #1 Top Voted
                                </span>
                              ) : index === 1 ? (
                                <span className="badge rounded-pill fw-bold" style={{ background: 'rgba(203, 213, 225, 0.2)', color: '#e2e8f0', border: '1px solid #94a3b8' }}>
                                  🥈 #2
                                </span>
                              ) : index === 2 ? (
                                <span className="badge rounded-pill fw-bold" style={{ background: 'rgba(249, 115, 22, 0.2)', color: '#fdba74', border: '1px solid #ea580c' }}>
                                  🥉 #3
                                </span>
                              ) : (
                                <span className="badge rounded-pill" style={{ background: 'rgba(255, 255, 255, 0.08)', color: '#94a3b8', border: '1px solid var(--border)' }}>
                                  #{index + 1}
                                </span>
                              )}
                              <h6 className="fw-bold text-white mb-0">{d.title} ({d.release_year || 'N/A'})</h6>
                              <span className="badge rounded-pill bg-dark border border-secondary small">{d.genre}</span>
                              <span 
                                className="badge rounded-pill"
                                style={
                                  d.status === 'SCHEDULED' ? { background: 'rgba(34, 197, 94, 0.2)', color: '#4ade80' } :
                                  d.status === 'GREENLIT' ? { background: 'rgba(234, 179, 8, 0.2)', color: '#facc15' } :
                                  { background: 'rgba(99, 102, 241, 0.2)', color: '#a5b4fc' }
                                }
                              >
                                {d.status}
                              </span>
                            </div>
                            <div className="text-secondary small mb-1">
                              📍 Target: <strong>{d.target_city}</strong> · Proposed by: {d.requester_name}
                            </div>
                            <div className="d-flex align-items-center gap-2">
                              <span className="fw-bold small" style={{ color: index === 0 ? 'var(--gold)' : '#fff' }}>
                                🔥 <strong>{d.vote_count}</strong> {d.vote_count === 1 ? 'Fan Vote' : 'Fan Votes'}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="d-flex align-items-center gap-2">
                          {d.status !== 'GREENLIT' && d.status !== 'SCHEDULED' && (
                            <button 
                              className="btn btn-sm btn-outline-success rounded-pill px-3 fw-bold"
                              onClick={() => handleGreenlight(d)}
                              disabled={actionLoading}
                            >
                              ✨ Greenlight & Add to Movies
                            </button>
                          )}
                          <button 
                            className="btn btn-sm btn-cinema rounded-pill px-3 fw-bold"
                            onClick={() => openSchedulerForDemand(d)}
                          >
                            🎟️ Schedule Fan Show
                          </button>
                          {d.status !== 'REJECTED' && (
                            <button 
                              className="btn btn-sm btn-outline-danger rounded-pill px-2"
                              onClick={() => handleReject(d.id)}
                              title="Reject request"
                            >
                              <i className="bi bi-x"></i>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : activeTab === 'addMovie' ? (
              /* TAB 3: ADD NEW MOVIE DIRECTLY TO CATALOG */
              <div>
                <h5 className="fw-bold text-white mb-3">Add Movie</h5>

                <form onSubmit={handleAddMovieSubmit}>
                  <div className="row g-3">
                    <div className="col-md-8">
                      <label htmlFor="admin-movie-title" className="form-label small text-secondary fw-bold">Movie Title *</label>
                      <input 
                        id="admin-movie-title"
                        name="title"
                        type="text" 
                        className="form-control rounded-3" 
                        style={{ background: 'rgba(255, 255, 255, 0.05)', color: '#fff', border: '1px solid var(--border)' }}
                        placeholder="e.g. Game Changer, Devara Part 2"
                        value={movieForm.title}
                        onChange={(e) => setMovieForm({ ...movieForm, title: e.target.value })}
                        required
                      />
                    </div>
                    <div className="col-md-4">
                      <label htmlFor="admin-movie-genre" className="form-label small text-secondary fw-bold">Genre *</label>
                      <input 
                        id="admin-movie-genre"
                        name="genre"
                        type="text" 
                        className="form-control rounded-3" 
                        style={{ background: 'rgba(255, 255, 255, 0.05)', color: '#fff', border: '1px solid var(--border)' }}
                        placeholder="e.g. Action Thriller"
                        value={movieForm.genre}
                        onChange={(e) => setMovieForm({ ...movieForm, genre: e.target.value })}
                        required
                      />
                    </div>

                    <div className="col-md-4">
                      <label htmlFor="admin-movie-duration" className="form-label small text-secondary fw-bold">Duration (Minutes)</label>
                      <input 
                        id="admin-movie-duration"
                        name="durationMinutes"
                        type="number" 
                        className="form-control rounded-3" 
                        style={{ background: 'rgba(255, 255, 255, 0.05)', color: '#fff', border: '1px solid var(--border)' }}
                        value={movieForm.durationMinutes}
                        onChange={(e) => setMovieForm({ ...movieForm, durationMinutes: e.target.value })}
                      />
                    </div>
                    <div className="col-md-4">
                      <label htmlFor="admin-movie-rating" className="form-label small text-secondary fw-bold">Initial Rating (1.0 to 10.0)</label>
                      <input 
                        id="admin-movie-rating"
                        name="rating"
                        type="number" 
                        step="0.1" 
                        min="1" 
                        max="10" 
                        className="form-control rounded-3" 
                        style={{ background: 'rgba(255, 255, 255, 0.05)', color: '#fff', border: '1px solid var(--border)' }}
                        value={movieForm.rating}
                        onChange={(e) => setMovieForm({ ...movieForm, rating: e.target.value })}
                      />
                    </div>
                    <div className="col-md-4">
                      <label htmlFor="admin-movie-release" className="form-label small text-secondary fw-bold">Release Date</label>
                      <input 
                        id="admin-movie-release"
                        name="releaseDate"
                        type="date" 
                        className="form-control rounded-3" 
                        style={{ background: 'rgba(255, 255, 255, 0.05)', color: '#fff', border: '1px solid var(--border)' }}
                        value={movieForm.releaseDate}
                        onChange={(e) => setMovieForm({ ...movieForm, releaseDate: e.target.value })}
                      />
                    </div>

                    <div className="col-md-6">
                      <label htmlFor="admin-movie-poster" className="form-label small text-secondary fw-bold">Poster Image URL</label>
                      <input 
                        id="admin-movie-poster"
                        name="posterUrl"
                        type="url" 
                        className="form-control rounded-3" 
                        style={{ background: 'rgba(255, 255, 255, 0.05)', color: '#fff', border: '1px solid var(--border)' }}
                        placeholder="https://image.tmdb.org/..."
                        value={movieForm.posterUrl}
                        onChange={(e) => setMovieForm({ ...movieForm, posterUrl: e.target.value })}
                      />
                    </div>
                    <div className="col-md-6">
                      <label htmlFor="admin-movie-actors" className="form-label small text-secondary fw-bold">Cast & Crew</label>
                      <input 
                        id="admin-movie-actors"
                        name="actors"
                        type="text" 
                        className="form-control rounded-3" 
                        style={{ background: 'rgba(255, 255, 255, 0.05)', color: '#fff', border: '1px solid var(--border)' }}
                        placeholder="e.g. Ram Charan, Kiara Advani, S. Shankar"
                        value={movieForm.actors}
                        onChange={(e) => setMovieForm({ ...movieForm, actors: e.target.value })}
                      />
                    </div>

                    <div className="col-12">
                      <label htmlFor="admin-movie-synopsis" className="form-label small text-secondary fw-bold">Synopsis / Description</label>
                      <textarea 
                        id="admin-movie-synopsis"
                        name="description"
                        className="form-control rounded-3" 
                        style={{ background: 'rgba(255, 255, 255, 0.05)', color: '#fff', border: '1px solid var(--border)' }}
                        rows="3"
                        placeholder="Brief summary of the plot and cinematic highlights..."
                        value={movieForm.description}
                        onChange={(e) => setMovieForm({ ...movieForm, description: e.target.value })}
                      ></textarea>
                    </div>

                    <div className="col-12 text-end">
                      <button 
                        type="submit" 
                        className="btn btn-warning px-4 py-2 rounded-pill fw-bold text-dark"
                        disabled={actionLoading}
                      >
                        {actionLoading ? 'Saving...' : 'Add Movie'}
                      </button>
                    </div>
                  </div>
                </form>
              </div>
            ) : (
              /* TAB 4: SCHEDULE SHOWS & SCREENS */
              <div>
                <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
                  <div>
                    <h5 className="fw-bold text-white mb-0">Schedule Shows</h5>
                  </div>

                  <button 
                    type="button"
                    className="btn btn-sm btn-outline-warning rounded-pill px-3 fw-bold d-flex align-items-center gap-1"
                    onClick={() => setShowAddTheater(!showAddTheater)}
                  >
                    <i className={`bi ${showAddTheater ? 'bi-x' : 'bi-building-fill-add'}`}></i>
                    <span>{showAddTheater ? 'Close' : '+ Add Theater'}</span>
                  </button>
                </div>

                {/* Register New Theater Multiplex Drawer */}
                {showAddTheater && (
                  <div className="p-3 mb-4 rounded-4" style={{ background: 'rgba(234, 179, 8, 0.08)', border: '1px solid rgba(234, 179, 8, 0.3)' }}>
                    <div className="d-flex align-items-center justify-content-between mb-3">
                      <h6 className="fw-bold text-warning mb-0">
                        🏢 Add Theater
                      </h6>
                    </div>

                    <form onSubmit={handleCreateTheaterSubmit}>
                      <div className="row g-2">
                        <div className="col-md-4">
                          <label htmlFor="theater-form-name" className="form-label small text-secondary fw-bold">Multiplex Name *</label>
                          <input 
                            id="theater-form-name"
                            name="name"
                            type="text" 
                            className="form-control form-control-sm rounded-3"
                            style={{ background: 'rgba(255, 255, 255, 0.05)', color: '#fff', border: '1px solid var(--border)' }}
                            placeholder="e.g. Sudarshan 35mm Multiplex"
                            value={theaterForm.name}
                            onChange={(e) => setTheaterForm({ ...theaterForm, name: e.target.value })}
                            required
                          />
                        </div>
                        <div className="col-md-3">
                          <label htmlFor="theater-form-city" className="form-label small text-secondary fw-bold">City / Region *</label>
                          <select 
                            id="theater-form-city"
                            name="city"
                            className="form-select form-select-sm rounded-3"
                            style={{ background: '#1c1c28', color: '#fff', border: '1px solid var(--border)' }}
                            value={theaterForm.city}
                            onChange={(e) => setTheaterForm({ ...theaterForm, city: e.target.value })}
                            required
                          >
                            <option value="Hyderabad (Telangana)">Hyderabad (Telangana)</option>
                            <option value="Visakhapatnam (Andhra Pradesh)">Visakhapatnam (Andhra Pradesh)</option>
                            <option value="Vijayawada (Andhra Pradesh)">Vijayawada (Andhra Pradesh)</option>
                            <option value="Warangal (Telangana)">Warangal (Telangana)</option>
                            <option value="Guntur (Andhra Pradesh)">Guntur (Andhra Pradesh)</option>
                            <option value="Tirupati (Andhra Pradesh)">Tirupati (Andhra Pradesh)</option>
                          </select>
                        </div>
                        <div className="col-md-3">
                          <label htmlFor="theater-form-address" className="form-label small text-secondary fw-bold">Address / Mall *</label>
                          <input 
                            id="theater-form-address"
                            name="address"
                            type="text" 
                            className="form-control form-control-sm rounded-3"
                            style={{ background: 'rgba(255, 255, 255, 0.05)', color: '#fff', border: '1px solid var(--border)' }}
                            placeholder="e.g. RTC X Roads, Chikkadpally"
                            value={theaterForm.address}
                            onChange={(e) => setTheaterForm({ ...theaterForm, address: e.target.value })}
                            required
                          />
                        </div>
                        <div className="col-md-2">
                          <label htmlFor="theater-form-screens" className="form-label small text-secondary fw-bold">Total Screens</label>
                          <input 
                            id="theater-form-screens"
                            name="totalScreens"
                            type="number" 
                            min="1" 
                            max="8"
                            className="form-control form-control-sm rounded-3"
                            style={{ background: 'rgba(255, 255, 255, 0.05)', color: '#fff', border: '1px solid var(--border)' }}
                            value={theaterForm.totalScreens}
                            onChange={(e) => setTheaterForm({ ...theaterForm, totalScreens: parseInt(e.target.value, 10) })}
                          />
                        </div>
                        <div className="col-12 text-end mt-2">
                          <button 
                            type="submit" 
                            className="btn btn-warning btn-sm px-4 rounded-pill fw-bold text-dark"
                            disabled={actionLoading}
                          >
                            {actionLoading ? 'Adding...' : 'Add Theater'}
                          </button>
                        </div>
                      </div>
                    </form>
                  </div>
                )}

                <form onSubmit={handleScheduleShowSubmit}>
                  <div className="row g-3">
                    <div className="col-md-6">
                      <label htmlFor="admin-show-movie" className="form-label small text-secondary fw-bold">Select Movie *</label>
                      <select 
                        id="admin-show-movie"
                        name="movieId"
                        className="form-select rounded-3" 
                        style={{ background: '#1c1c28', color: '#fff', border: '1px solid var(--border)' }}
                        value={showForm.movieId}
                        onChange={(e) => setShowForm({ ...showForm, movieId: e.target.value })}
                        required
                      >
                        {moviesList.map(m => (
                          <option key={m.id} value={m.id}>{m.title} ({m.rating}★)</option>
                        ))}
                      </select>
                    </div>

                    <div className="col-md-6">
                      <label htmlFor="admin-show-theater" className="form-label small text-secondary fw-bold">Select Theater Multiplex *</label>
                      <select 
                        id="admin-show-theater"
                        name="theaterId"
                        className="form-select rounded-3" 
                        style={{ background: '#1c1c28', color: '#fff', border: '1px solid var(--border)' }}
                        value={showForm.theaterId}
                        onChange={(e) => {
                          const tId = e.target.value;
                          const t = theatersList.find(x => x.id === parseInt(tId, 10));
                          setShowForm({
                            ...showForm,
                            theaterId: tId,
                            screenId: t?.screens[0]?.id || '',
                          });
                        }}
                        required
                      >
                        {theatersList.map(t => (
                          <option key={t.id} value={t.id}>{t.name} — {t.city}</option>
                        ))}
                      </select>
                    </div>

                    <div className="col-md-3">
                      <label htmlFor="admin-show-screen" className="form-label small text-secondary fw-bold">Select Screen / Auditorium *</label>
                      <select 
                        id="admin-show-screen"
                        name="screenId"
                        className="form-select rounded-3" 
                        style={{ background: '#1c1c28', color: '#fff', border: '1px solid var(--border)' }}
                        value={showForm.screenId}
                        onChange={(e) => setShowForm({ ...showForm, screenId: e.target.value })}
                        required
                      >
                        {selectedTheater?.screens.map(s => (
                          <option key={s.id} value={s.id}>{s.name} ({s.totalSeats} Seats)</option>
                        ))}
                      </select>
                    </div>

                    <div className="col-md-3">
                      <label htmlFor="admin-show-date" className="form-label small text-secondary fw-bold">Show Date *</label>
                      <input 
                        id="admin-show-date"
                        name="showDate"
                        type="date" 
                        min={new Date().toISOString().split('T')[0]}
                        className="form-control rounded-3" 
                        style={{ background: 'rgba(255, 255, 255, 0.05)', color: '#fff', border: '1px solid var(--border)' }}
                        value={showForm.showDate}
                        onChange={(e) => setShowForm({ ...showForm, showDate: e.target.value })}
                        required
                      />
                    </div>

                    <div className="col-md-3">
                      <label htmlFor="admin-show-time-select" className="form-label small text-secondary fw-bold">Showtime Slot *</label>
                      <select
                        id="admin-show-time-select"
                        name="showTime"
                        className="form-select rounded-3"
                        style={{ background: '#1c1c28', color: '#fff', border: '1px solid var(--border)' }}
                        value={showForm.showTime}
                        onChange={(e) => setShowForm({ ...showForm, showTime: e.target.value })}
                        required
                      >
                        <option value="11:30">🌅 11:30 AM (Morning Show)</option>
                        <option value="14:45">☀️ 02:45 PM (Matinee)</option>
                        <option value="18:15">🌆 06:15 PM (First Show)</option>
                        <option value="21:45">🌙 09:45 PM (Second Show)</option>
                        <option value="custom">⏱️ Custom Showtime...</option>
                      </select>
                    </div>

                    <div className="col-md-3">
                      <label htmlFor="admin-show-price" className="form-label small text-secondary fw-bold">Ticket Base Price (₹) *</label>
                      <input 
                        id="admin-show-price"
                        name="basePrice"
                        type="number" 
                        min="50" 
                        max="2000" 
                        className="form-control rounded-3" 
                        style={{ background: 'rgba(255, 255, 255, 0.05)', color: '#fff', border: '1px solid var(--border)' }}
                        value={showForm.basePrice}
                        onChange={(e) => setShowForm({ ...showForm, basePrice: e.target.value })}
                        required
                      />
                    </div>

                    {showForm.showTime === 'custom' && (
                      <div className="col-md-3 ms-auto">
                        <label htmlFor="admin-show-custom-time" className="form-label small text-warning fw-bold">Enter Custom Time (HH:MM) *</label>
                        <input
                          id="admin-show-custom-time"
                          type="time"
                          className="form-control rounded-3"
                          style={{ background: 'rgba(255, 255, 255, 0.05)', color: '#fff', border: '1px solid var(--gold)' }}
                          value={showForm.customTime || '20:00'}
                          onChange={(e) => setShowForm({ ...showForm, customTime: e.target.value })}
                          required
                        />
                      </div>
                    )}

                    <div className="col-12 text-end mt-4">
                      <button 
                        type="submit" 
                        className="btn btn-warning px-4 py-2 rounded-pill fw-bold text-dark"
                        disabled={actionLoading}
                      >
                        {actionLoading ? 'Scheduling...' : 'Schedule Show'}
                      </button>
                    </div>
                  </div>
                </form>

                {/* Section: Upcoming Scheduled Shows */}
                <div className="mt-5 pt-4 border-top" style={{ borderColor: 'var(--border)' }}>
                  <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
                    <div>
                      <h6 className="fw-bold text-white mb-0">Upcoming Scheduled Shows ({filteredScheduledShows.length})</h6>
                      <span className="text-secondary small">View and cancel active screenings across theaters</span>
                    </div>

                    <div style={{ maxWidth: '300px' }} className="w-100">
                      <input 
                        type="text" 
                        className="form-control form-control-sm rounded-pill"
                        style={{ background: 'rgba(255, 255, 255, 0.05)', color: '#fff', border: '1px solid var(--border)' }}
                        placeholder="Search by movie, theater, or city..."
                        value={showSearch}
                        onChange={(e) => setShowSearch(e.target.value)}
                      />
                    </div>
                  </div>

                  {filteredScheduledShows.length === 0 ? (
                    <div className="text-center py-4 text-secondary rounded-4 p-3" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                      {showSearch ? `No scheduled shows matching "${showSearch}".` : 'No upcoming shows currently scheduled.'}
                    </div>
                  ) : (
                    <div className="d-flex flex-column gap-2" style={{ maxHeight: '420px', overflowY: 'auto' }}>
                      {filteredScheduledShows.map(s => {
                        const startDate = new Date(s.start_time);
                        const dateStr = startDate.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
                        const timeStr = startDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });

                        return (
                          <div 
                            key={s.id}
                            className="p-3 rounded-4 d-flex justify-content-between align-items-center flex-wrap gap-3"
                            style={{ background: 'var(--bg-card)', border: '1px solid var(--border-bright)' }}
                          >
                            <div className="d-flex align-items-center gap-3">
                              <img 
                                src={getSafePosterUrl(s.poster_url)} 
                                alt={s.movie_title}
                                style={{ width: '46px', height: '64px', borderRadius: '8px', objectFit: 'cover' }}
                                onError={(e) => { e.target.src = 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=500&auto=format&fit=crop'; }}
                              />
                              <div>
                                <div className="d-flex align-items-center gap-2 mb-1 flex-wrap">
                                  <h6 className="fw-bold text-white mb-0">{s.movie_title}</h6>
                                  <span className="badge bg-dark border border-secondary" style={{ fontSize: '0.7rem' }}>
                                    Show #{s.id}
                                  </span>
                                  <span className="badge rounded-pill fw-bold" style={{ background: 'rgba(234, 179, 8, 0.15)', color: '#facc15', border: '1px solid rgba(234, 179, 8, 0.3)', fontSize: '0.72rem' }}>
                                    ₹{parseFloat(s.base_price).toFixed(0)}
                                  </span>
                                </div>
                                <div className="text-secondary small">
                                  🏢 <strong>{s.theater_name}</strong> ({s.theater_city}) · 🎬 {s.screen_name}
                                </div>
                                <div className="small mt-1 d-flex align-items-center gap-3 flex-wrap">
                                  <span style={{ color: '#93c5fd' }}>
                                    📅 {dateStr} at <strong>{timeStr}</strong>
                                  </span>
                                  <span className={s.booked_seats_count > 0 ? 'text-warning fw-bold' : 'text-muted'}>
                                    🎟️ {s.booked_seats_count} / {s.total_seats} seats booked
                                  </span>
                                </div>
                              </div>
                            </div>

                            <div>
                              <button 
                                type="button"
                                className="btn btn-sm btn-outline-danger rounded-pill px-3 fw-bold d-flex align-items-center gap-1"
                                onClick={() => handleCancelShow(s.id, s.movie_title, s.theater_name, timeStr, s.booked_seats_count)}
                                disabled={cancelingShowId === s.id}
                                title="Cancel this scheduled show"
                              >
                                {cancelingShowId === s.id ? (
                                  <>
                                    <span className="spinner-border spinner-border-sm" role="status"></span>
                                    <span>Canceling...</span>
                                  </>
                                ) : (
                                  <>
                                    <i className="bi bi-calendar-x"></i>
                                    <span>Cancel Show</span>
                                  </>
                                )}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Edit Movie Sub-Modal */}
      {editingMovie && (
        <div 
          className="modal show d-block" 
          tabIndex="-1" 
          style={{ 
            backgroundColor: 'rgba(0, 0, 0, 0.88)', 
            backdropFilter: 'blur(8px)',
            zIndex: 1070 
          }}
        >
          <div className="modal-dialog modal-dialog-centered modal-lg">
            <div 
              className="modal-content border-0 rounded-4 shadow-lg overflow-hidden" 
              style={{ 
                background: 'var(--bg-elevated)', 
                border: '1px solid var(--border-bright)' 
              }}
            >
              <div className="modal-header border-0 px-4 pt-4 pb-3" style={{ background: 'var(--bg-card)', borderBottom: '1px solid var(--border)' }}>
                <div className="d-flex align-items-center justify-content-between w-100">
                  <div className="d-flex align-items-center gap-2">
                    <span className="fs-4">✏️</span>
                    <div>
                      <h5 className="fw-bold text-white mb-0">Edit Movie: {editingMovie.title}</h5>
                    </div>
                  </div>
                  <button type="button" className="btn-close" onClick={handleCloseEditMovie}></button>
                </div>
              </div>

              <form onSubmit={handleUpdateMovieSubmit}>
                <div className="modal-body px-4 py-3" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
                  <div className="row g-3">
                    <div className="col-md-8">
                      <label htmlFor="edit-movie-title" className="form-label small text-secondary fw-bold">Movie Title *</label>
                      <input 
                        id="edit-movie-title"
                        name="title"
                        type="text" 
                        className="form-control rounded-3" 
                        style={{ background: 'rgba(255, 255, 255, 0.05)', color: '#fff', border: '1px solid var(--border)' }}
                        value={editForm.title}
                        onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                        required
                      />
                    </div>
                    <div className="col-md-4">
                      <label htmlFor="edit-movie-genre" className="form-label small text-secondary fw-bold">Genre *</label>
                      <input 
                        id="edit-movie-genre"
                        name="genre"
                        type="text" 
                        className="form-control rounded-3" 
                        style={{ background: 'rgba(255, 255, 255, 0.05)', color: '#fff', border: '1px solid var(--border)' }}
                        value={editForm.genre}
                        onChange={(e) => setEditForm({ ...editForm, genre: e.target.value })}
                        required
                      />
                    </div>

                    <div className="col-md-4">
                      <label htmlFor="edit-movie-duration" className="form-label small text-secondary fw-bold">Duration (Minutes)</label>
                      <input 
                        id="edit-movie-duration"
                        name="durationMinutes"
                        type="number" 
                        className="form-control rounded-3" 
                        style={{ background: 'rgba(255, 255, 255, 0.05)', color: '#fff', border: '1px solid var(--border)' }}
                        value={editForm.durationMinutes}
                        onChange={(e) => setEditForm({ ...editForm, durationMinutes: e.target.value })}
                      />
                    </div>
                    <div className="col-md-4">
                      <label htmlFor="edit-movie-rating" className="form-label small text-secondary fw-bold">Rating (1.0 to 10.0)</label>
                      <input 
                        id="edit-movie-rating"
                        name="rating"
                        type="number" 
                        step="0.1" 
                        min="1" 
                        max="10" 
                        className="form-control rounded-3" 
                        style={{ background: 'rgba(255, 255, 255, 0.05)', color: '#fff', border: '1px solid var(--border)' }}
                        value={editForm.rating}
                        onChange={(e) => setEditForm({ ...editForm, rating: e.target.value })}
                      />
                    </div>
                    <div className="col-md-4">
                      <label htmlFor="edit-movie-release" className="form-label small text-secondary fw-bold">Release Date</label>
                      <input 
                        id="edit-movie-release"
                        name="releaseDate"
                        type="date" 
                        className="form-control rounded-3" 
                        style={{ background: 'rgba(255, 255, 255, 0.05)', color: '#fff', border: '1px solid var(--border)' }}
                        value={editForm.releaseDate}
                        onChange={(e) => setEditForm({ ...editForm, releaseDate: e.target.value })}
                      />
                    </div>

                    <div className="col-md-9">
                      <label htmlFor="edit-movie-poster" className="form-label small text-secondary fw-bold">Poster Image URL</label>
                      <input 
                        id="edit-movie-poster"
                        name="posterUrl"
                        type="text" 
                        className="form-control rounded-3" 
                        style={{ background: 'rgba(255, 255, 255, 0.05)', color: '#fff', border: '1px solid var(--border)' }}
                        placeholder="https://... or data:image/..."
                        value={editForm.posterUrl}
                        onChange={(e) => setEditForm({ ...editForm, posterUrl: e.target.value })}
                      />
                    </div>
                    <div className="col-md-3 d-flex align-items-center justify-content-center">
                      {editForm.posterUrl ? (
                        <div className="d-flex align-items-center gap-2 mt-3">
                          <img 
                            src={getSafePosterUrl(editForm.posterUrl)} 
                            alt="Poster preview" 
                            style={{ width: '45px', height: '60px', borderRadius: '6px', objectFit: 'cover', border: '1px solid var(--border-bright)' }}
                            onError={(e) => { e.target.style.display = 'none'; }}
                          />
                          <span className="text-secondary small">Preview</span>
                        </div>
                      ) : (
                        <span className="text-secondary small mt-3">No poster preview</span>
                      )}
                    </div>

                    <div className="col-12">
                      <label htmlFor="edit-movie-actors" className="form-label small text-secondary fw-bold">Cast & Crew</label>
                      <input 
                        id="edit-movie-actors"
                        name="actors"
                        type="text" 
                        className="form-control rounded-3" 
                        style={{ background: 'rgba(255, 255, 255, 0.05)', color: '#fff', border: '1px solid var(--border)' }}
                        placeholder="e.g. Prabhas, Amitabh Bachchan, Deepika Padukone"
                        value={editForm.actors}
                        onChange={(e) => setEditForm({ ...editForm, actors: e.target.value })}
                      />
                    </div>

                    <div className="col-12">
                      <label htmlFor="edit-movie-synopsis" className="form-label small text-secondary fw-bold">Synopsis / Description</label>
                      <textarea 
                        id="edit-movie-synopsis"
                        name="description"
                        className="form-control rounded-3" 
                        style={{ background: 'rgba(255, 255, 255, 0.05)', color: '#fff', border: '1px solid var(--border)' }}
                        rows="3"
                        placeholder="Brief summary of the plot and cinematic highlights..."
                        value={editForm.description}
                        onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                      ></textarea>
                    </div>

                    <div className="col-md-4">
                      <label htmlFor="edit-movie-hype" className="form-label small text-secondary fw-bold">Fan Hype Count</label>
                      <input 
                        id="edit-movie-hype"
                        name="hypeCount"
                        type="number" 
                        className="form-control rounded-3" 
                        style={{ background: 'rgba(255, 255, 255, 0.05)', color: '#fff', border: '1px solid var(--border)' }}
                        value={editForm.hypeCount}
                        onChange={(e) => setEditForm({ ...editForm, hypeCount: e.target.value })}
                      />
                    </div>
                  </div>
                </div>

                <div className="modal-footer border-0 px-4 py-3" style={{ background: 'var(--bg-card)', borderTop: '1px solid var(--border)' }}>
                  <button 
                    type="button" 
                    className="btn btn-outline-secondary rounded-pill px-4"
                    onClick={handleCloseEditMovie}
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    className="btn btn-warning rounded-pill px-4 fw-bold text-dark"
                    disabled={actionLoading}
                  >
                    {actionLoading ? 'Updating Movie...' : 'Save Changes'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

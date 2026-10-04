import React, { useState, useEffect } from 'react';
import { movieApi } from '../services/api';

export default function MovieList({ searchQuery, onSelectShow, onOpenReviews, refreshTrigger }) {
  const [movies, setMovies] = useState([]);
  const [selectedGenre, setSelectedGenre] = useState('All');
  const [selectedMovie, setSelectedMovie] = useState(null);
  const [movieShows, setMovieShows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showsLoading, setShowsLoading] = useState(false);
  const [error, setError] = useState(null);

  // Date selection state in showtime modal (index 0 to 3 for upcoming 4 days)
  const [selectedDateIndex, setSelectedDateIndex] = useState(0);

  // Region / State filter: 'ALL' | 'AP' | 'TS'
  const [selectedState, setSelectedState] = useState('ALL');
  // Area-wise filter: 'ALL' | specific area
  const [selectedArea, setSelectedArea] = useState('ALL');

  const fetchMovies = async () => {
    try {
      const res = await movieApi.getAll();
      setMovies(res.data.data);
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to fetch movies');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMovies();
  }, [refreshTrigger]);

  const handleSelectMovie = async (movie) => {
    setSelectedMovie(movie);
    setSelectedDateIndex(0);
    setSelectedState('ALL');
    setSelectedArea('ALL');
    setShowsLoading(true);
    try {
      const res = await movieApi.getById(movie.id);
      setMovieShows(res.data.data.shows || []);
    } catch (err) {
      console.error(err);
    } finally {
      setShowsLoading(false);
    }
  };

  // Genre Filter Categories
  const categories = ['All', 'Action', 'Romance', 'Drama', 'Sci-Fi', 'Thriller', 'Superhero', 'Comedy', 'Biography'];

  // Set of movies hyped by the current user session
  const [hypedMovieIds, setHypedMovieIds] = useState(new Set());

  // Format hype count (e.g. 48.5K)
  const formatHype = (num) => {
    if (!num) return '0';
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  };

  const getSafePosterUrl = (url, fallbackTitle = '') => {
    if (!url || typeof url !== 'string') {
      return `https://placehold.co/400x600/1e1e2e/7c3aed?text=${encodeURIComponent(fallbackTitle.slice(0, 12) || 'Cinema')}`;
    }
    const trimmed = url.trim();
    if (trimmed.startsWith('data:')) {
      if (!trimmed.startsWith('data:image/') || !trimmed.includes(';base64,') || trimmed.length < 50 || /\s/.test(trimmed)) {
        return `https://placehold.co/400x600/1e1e2e/7c3aed?text=${encodeURIComponent(fallbackTitle.slice(0, 12) || 'Cinema')}`;
      }
    }
    return trimmed;
  };

  // Handle Hype click on any movie
  const handleHypeMovie = async (movieId, e) => {
    if (e) e.stopPropagation();

    // Optimistic update: increment hype count immediately
    setMovies((prevMovies) =>
      prevMovies.map((m) =>
        m.id === movieId ? { ...m, hype_count: (m.hype_count || 0) + 1 } : m
      )
    );

    // Track hyped state for button animation
    setHypedMovieIds((prev) => new Set(prev).add(movieId));

    try {
      await movieApi.hypeMovie(movieId);
    } catch (err) {
      console.error('Failed to register hype:', err);
    }
  };

  // Helper to format release date
  const formatReleaseDate = (dateVal) => {
    if (!dateVal) return '';
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' });
  };

  // Search & Category Filtering (Matches Title, Genre, Star Cast / Actors, and Synopsis)
  const filteredMovies = movies
    .filter((m) => {
      const query = searchQuery?.toLowerCase().trim() || '';

      // If user typed a search query, search globally across all categories
      const matchesCategory =
        query !== '' ||
        selectedGenre === 'All' ||
        m.genre.toLowerCase().includes(selectedGenre.toLowerCase());

      // Comprehensive multi-field search:
      // 1. Title
      // 2. Genre (Action, Comedy, Romance, Thriller, Sci-Fi, Drama, etc.)
      // 3. Actors / Star Cast (Allu Arjun, Mahesh Babu, Prabhas, Jr NTR, Ram Charan, Nani, Samantha, etc.)
      // 4. Synopsis
      const matchesSearch =
        query === '' ||
        m.title.toLowerCase().includes(query) ||
        m.genre.toLowerCase().includes(query) ||
        (m.actors && m.actors.toLowerCase().includes(query)) ||
        (m.description && m.description.toLowerCase().includes(query));

      return matchesCategory && matchesSearch;
    })
    .sort((a, b) => {
      const dateA = a.release_date ? new Date(a.release_date).getTime() : 0;
      const dateB = b.release_date ? new Date(b.release_date).getTime() : 0;
      if (dateB !== dateA) return dateB - dateA;
      return b.id - a.id;
    });

  // Top 7 Most Hyped Movies in the Sliding Hero Banner
  // When any movie's hype increases beyond the 7th movie, it automatically enters the carousel!
  const featuredSlides = React.useMemo(() => {
    if (!movies || movies.length === 0) return [];
    const sorted = [...movies].sort((a, b) => (b.hype_count || 0) - (a.hype_count || 0));
    return sorted.slice(0, 7);
  }, [movies]);

  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  // Auto-slide every 3.5 seconds (pauses on hover)
  useEffect(() => {
    if (featuredSlides.length <= 1 || isPaused) return;

    const timer = setInterval(() => {
      setCurrentSlideIndex((prev) => (prev + 1) % featuredSlides.length);
    }, 3500);

    return () => clearInterval(timer);
  }, [featuredSlides.length, isPaused]);

  // Generate next 4 dates (Today, Tomorrow, Day 2, Day 3)
  const upcomingDays = Array.from({ length: 4 }).map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    d.setHours(0, 0, 0, 0);

    let dayLabel = i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : d.toLocaleDateString([], { weekday: 'short' });
    let dateStr = d.toLocaleDateString([], { day: 'numeric', month: 'short' });
    return {
      index: i,
      dayLabel,
      dateStr,
      dateObj: d,
    };
  });

  // State & Area filter configurations
  const apAreas = [
    { label: 'All AP Areas', value: 'ALL' },
    { label: 'Visakhapatnam (Vizag)', value: 'visakhapatnam' },
    { label: 'Vijayawada', value: 'vijayawada' },
    { label: 'Guntur', value: 'guntur' },
    { label: 'Tirupati', value: 'tirupati' }
  ];

  const tsAreas = [
    { label: 'All TS Areas', value: 'ALL' },
    { label: 'Hyderabad (Gachibowli)', value: 'gachibowli' },
    { label: 'Hyderabad (Tank Bund)', value: 'tank bund' },
    { label: 'Hyderabad (Kukatpally)', value: 'kukatpally' },
    { label: 'Warangal (Hanamkonda)', value: 'warangal' }
  ];

  // Filter shows by selected date, state, and area
  const selectedDayObj = upcomingDays[selectedDateIndex]?.dateObj;
  const filteredShows = movieShows.filter((s) => {
    // 1. Date match
    const showDate = new Date(s.start_time);
    const sameDay =
      showDate.getFullYear() === selectedDayObj?.getFullYear() &&
      showDate.getMonth() === selectedDayObj?.getMonth() &&
      showDate.getDate() === selectedDayObj?.getDate();

    if (!sameDay) return false;

    // 2. State match
    const isAP = s.theater_city?.toLowerCase().includes('andhra pradesh');
    const isTS = s.theater_city?.toLowerCase().includes('telangana');

    if (selectedState === 'AP' && !isAP) return false;
    if (selectedState === 'TS' && !isTS) return false;

    // 3. Area match
    if (selectedArea !== 'ALL') {
      const target = selectedArea.toLowerCase();
      const city = (s.theater_city || '').toLowerCase();
      const addr = (s.theater_address || '').toLowerCase();
      const name = (s.theater_name || '').toLowerCase();
      const matches = city.includes(target) || addr.includes(target) || name.includes(target);
      if (!matches) return false;
    }

    return true;
  });

  // Group filtered shows by theater
  const theaterGroups = {};
  filteredShows.forEach((s) => {
    const key = s.theater_name;
    if (!theaterGroups[key]) {
      theaterGroups[key] = {
        theater_name: s.theater_name,
        theater_city: s.theater_city,
        theater_address: s.theater_address,
        screen_name: s.screen_name,
        shows: []
      };
    }
    theaterGroups[key].shows.push(s);
  });

  // Sort show slots inside each theater by time
  Object.values(theaterGroups).forEach(group => {
    group.shows.sort((a, b) => new Date(a.start_time) - new Date(b.start_time));
  });

  if (loading) {
    return (
      <div className="cinema-container px-3 py-5">
        <div className="row g-4">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="col-12 col-sm-6 col-md-4 col-lg-3">
              <div className="cinema-movie-card">
                <div className="shimmer" style={{ height: '330px' }}></div>
                <div className="p-3">
                  <div className="shimmer mb-2" style={{ height: '16px', width: '80%' }}></div>
                  <div className="shimmer mb-2" style={{ height: '12px', width: '60%' }}></div>
                  <div className="shimmer" style={{ height: '12px', width: '40%' }}></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="cinema-container px-3 py-3 pb-5">
      
      {/* 1. Top 7 Most Hyped Movies Carousel (Dynamic & Auto-Updating) */}
      {!searchQuery && featuredSlides.length > 0 && (() => {
        const slideMovie = featuredSlides[currentSlideIndex] || featuredSlides[0];
        if (!slideMovie) return null;

        return (
          <div 
            className="hero-cinema-banner mb-5 position-relative"
            onMouseEnter={() => setIsPaused(true)}
            onMouseLeave={() => setIsPaused(false)}
            onClick={() => handleSelectMovie(slideMovie)}
            style={{ cursor: 'pointer' }}
          >
            {/* Ambient Blurred Backdrop with Key for Smooth Transition */}
            <img 
              key={`bg-${slideMovie.id}`}
              src={slideMovie.poster_url} 
              alt="" 
              className="hero-cinema-backdrop"
            />

            {/* Gradient Overlay & Content */}
            <div className="hero-cinema-overlay">
              <div className="d-flex justify-content-between align-items-center flex-wrap gap-4 w-100">
                {/* Left Side: Movie Information & Booking Action */}
                <div style={{ maxWidth: '640px', flex: '1 1 360px' }}>
                  
                  {/* Subtle Category Tag */}
                  <div className="mb-2">
                    <span style={{
                      color: 'var(--accent-glow)',
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      letterSpacing: '1px',
                      textTransform: 'uppercase'
                    }}>
                      Featured Blockbuster · In Cinemas Now
                    </span>
                  </div>

                  <h1 className="display-5 fw-black mb-2" style={{ color: '#fff', textShadow: '0 2px 20px rgba(0,0,0,0.8)', fontWeight: 900 }}>
                    {slideMovie.title}
                  </h1>
                  <p className="small mb-3 d-none d-md-block" style={{ color: 'rgba(255,255,255,0.9)', lineHeight: 1.6, textShadow: '0 1px 8px rgba(0,0,0,0.9)' }}>
                    {slideMovie.description}
                  </p>
                  <div className="d-flex align-items-center gap-3 small flex-wrap mb-3">
                    <span style={{ color: 'var(--gold)', fontWeight: 800, fontSize: '1.05rem' }}>
                      ★ {slideMovie.rating}/10
                    </span>
                    <span style={{ color: 'rgba(255,255,255,0.4)' }}>|</span>
                    <span style={{ color: 'rgba(255,255,255,0.9)' }}>
                      {Math.floor(slideMovie.duration_mins / 60)}h {slideMovie.duration_mins % 60}m
                    </span>
                    <span style={{ color: 'rgba(255,255,255,0.4)' }}>|</span>
                    <span style={{ color: 'rgba(255,255,255,0.9)', fontWeight: 600 }}>{slideMovie.genre}</span>
                  </div>

                  {/* Booking Action & Hyped Rank Tag */}
                  <div className="d-flex align-items-center gap-3 flex-wrap mt-2">
                    <button 
                      className="btn btn-cinema btn-lg px-4 d-inline-flex align-items-center gap-2"
                      style={{ fontSize: '1rem', padding: '0.75rem 2rem', zIndex: 5 }}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSelectMovie(slideMovie);
                      }}
                    >
                      <i className="bi bi-ticket-perforated-fill"></i>
                      <span>Book Tickets</span>
                    </button>

                    {/* #X Hyped Tag */}
                    <span style={{
                      background: 'linear-gradient(135deg, #e83d3d, #f97316)',
                      color: '#ffffff',
                      fontSize: '0.82rem',
                      fontWeight: 800,
                      padding: '0.45rem 1.1rem',
                      borderRadius: '20px',
                      letterSpacing: '0.5px',
                      boxShadow: '0 4px 16px rgba(232, 61, 61, 0.45)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.35rem'
                    }}>
                      🔥 #{currentSlideIndex + 1} Hyped
                    </span>
                  </div>
                </div>

                {/* Right Side: The Entire Uncropped Movie Poster (100% visible) */}
                <div className="d-flex align-items-center justify-content-center" style={{ zIndex: 4 }}>
                  <img 
                    key={`poster-${slideMovie.id}`}
                    src={getSafePosterUrl(slideMovie.poster_url, slideMovie.title)} 
                    alt={slideMovie.title} 
                    className="hero-poster-card"
                    onError={(e) => {
                      e.target.src = `https://placehold.co/400x600/1e1e2e/7c3aed?text=${encodeURIComponent(slideMovie.title.slice(0,12))}`;
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Slider Navigation Arrows */}
            {featuredSlides.length > 1 && (
              <>
                <button
                  type="button"
                  className="hero-slider-btn hero-slider-prev"
                  aria-label="Previous Slide"
                  onClick={(e) => {
                    e.stopPropagation();
                    setCurrentSlideIndex((prev) => (prev === 0 ? featuredSlides.length - 1 : prev - 1));
                  }}
                >
                  <i className="bi bi-chevron-left"></i>
                </button>
                <button
                  type="button"
                  className="hero-slider-btn hero-slider-next"
                  aria-label="Next Slide"
                  onClick={(e) => {
                    e.stopPropagation();
                    setCurrentSlideIndex((prev) => (prev + 1) % featuredSlides.length);
                  }}
                >
                  <i className="bi bi-chevron-right"></i>
                </button>

                {/* Slider Dot Indicators */}
                <div className="hero-slider-indicators">
                  {featuredSlides.map((s, idx) => (
                    <button
                      key={s.id}
                      type="button"
                      className={`hero-slider-dot ${idx === currentSlideIndex ? 'active' : ''}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setCurrentSlideIndex(idx);
                      }}
                      title={`#${idx + 1} ${s.title} (${formatHype(s.hype_count)} Hypes)`}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        );
      })()}



      {/* 2. Section Header + Genre Chips */}
      <div className="mb-4">
        {!searchQuery && (
          <div className="mb-3">
            <div className="section-eyebrow">Andhra Pradesh & Telangana Multiplexes</div>
            <div className="section-title">Now Showing in Theaters</div>
          </div>
        )}
        <div className="d-flex align-items-center justify-content-between flex-wrap gap-2">
          <div className="d-flex gap-2 overflow-auto py-1" style={{ scrollbarWidth: 'none' }}>
            {categories.map((cat) => (
              <div 
                key={cat}
                className={`genre-chip ${selectedGenre === cat ? 'active' : ''}`}
                onClick={() => setSelectedGenre(cat)}
              >
                {cat === 'All' ? '🎞️ All Movies' : cat}
              </div>
            ))}
          </div>
          <span className="small fw-bold d-none d-sm-flex align-items-center gap-1" style={{ color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
            <i className="bi bi-film"></i>
            {filteredMovies.length} Telugu Blockbusters
          </span>
        </div>
      </div>

      {error && <div className="alert alert-danger py-2 small mb-3">{error}</div>}

      {/* Search results banner */}
      {searchQuery && (
        <div className="alert-light border py-2 px-3 mb-4 d-flex justify-content-between align-items-center rounded-3">
          <span className="small" style={{ color: 'var(--text-secondary)' }}>
            <i className="bi bi-search me-2" style={{ color: 'var(--accent-light)' }}></i>
            Found <strong style={{ color: 'var(--text-primary)' }}>{filteredMovies.length}</strong> movies matching "
            <strong style={{ color: 'var(--accent-light)' }}>{searchQuery}</strong>"
          </span>
          <button 
            className="btn btn-sm btn-link p-0 text-decoration-none" 
            style={{ color: 'var(--red)' }}
            onClick={() => window.location.reload()}
          >
            Clear
          </button>
        </div>
      )}

      {/* 3. Movie Grid */}
      {filteredMovies.length === 0 ? (
        <div className="text-center py-5 rounded-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          <div style={{ fontSize: '3rem' }}>🎬</div>
          <h5 className="mt-3 text-white">No movies found</h5>
          <p style={{ color: 'var(--text-muted)' }} className="small">Try searching with a different title, actor, or genre.</p>
        </div>
      ) : (
        <div className="row g-4">
          {filteredMovies.map((movie) => {
            const hours = Math.floor(movie.duration_mins / 60);
            const mins = movie.duration_mins % 60;
            const ratingNum = parseFloat(movie.rating);
            const ratingColor = ratingNum >= 8 ? '#4ade80' : ratingNum >= 7 ? 'var(--gold)' : ratingNum >= 6 ? '#fb923c' : '#f87171';

            return (
              <div key={movie.id} className="col-12 col-sm-6 col-md-4 col-lg-3">
                <div className="cinema-movie-card">
                  
                  {/* Poster (Clickable to redirect to booking page) */}
                  <div 
                    className="movie-poster-wrap"
                    onClick={() => handleSelectMovie(movie)}
                    style={{ cursor: 'pointer' }}
                    title={`Click to book tickets for ${movie.title}`}
                  >
                    <img 
                      src={getSafePosterUrl(movie.poster_url, movie.title)} 
                      alt={movie.title}
                      className="movie-poster-img"
                      onError={(e) => {
                        e.target.src = `https://placehold.co/400x600/1e1e2e/7c3aed?text=${encodeURIComponent(movie.title.slice(0,12))}`;
                      }}
                    />

                    {/* Rating Badge */}
                    <div className="movie-rating-badge">
                      <i className="bi bi-star-fill" style={{ color: 'var(--gold)' }}></i>
                      <span style={{ color: ratingColor, fontWeight: 900 }}>{movie.rating}</span>
                      <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.7rem' }}>/10</span>
                    </div>

                    {/* Interactive Hype Pill on Poster (Top Left) */}
                    <button 
                      type="button"
                      className={`movie-hype-pill-top ${hypedMovieIds.has(movie.id) ? 'hyped' : ''}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleHypeMovie(movie.id, e);
                      }}
                      title="Click to hype this movie and boost its ranking!"
                    >
                      <span style={{ fontSize: '0.85rem' }}>🔥</span>
                      <span>{formatHype(movie.hype_count)}</span>
                    </button>
                  </div>

                  {/* Movie Info */}
                  <div className="movie-card-info">
                    <h6 
                      className="movie-card-title text-white" 
                      title={`Click to book tickets for ${movie.title}`}
                      onClick={() => handleSelectMovie(movie)}
                      style={{ cursor: 'pointer' }}
                    >
                      {movie.title}
                    </h6>
                    
                    <div className="movie-card-meta">
                      <span style={{ fontSize: '0.68rem', background: 'rgba(30,30,46,0.9)', border: '1px solid var(--border-bright)', color: 'var(--text-muted)', borderRadius: '4px', padding: '0.1rem 0.4rem' }}>UA</span>
                      <span>{hours}h {mins}m</span>
                      <span style={{ color: 'var(--border-bright)' }}>·</span>
                      <span className="text-truncate" style={{ maxWidth: '100px' }}>{movie.genre}</span>
                      {movie.release_date && (
                        <>
                          <span style={{ color: 'var(--border-bright)' }}>·</span>
                          <span style={{ color: 'var(--accent-glow)', fontSize: '0.72rem', fontWeight: 600 }}>
                            {formatReleaseDate(movie.release_date)}
                          </span>
                        </>
                      )}
                    </div>

                    {/* Star Cast / Lead Actors */}
                    {movie.actors && (
                      <div className="movie-card-cast text-truncate mb-2" style={{ color: '#94a3b8', fontSize: '0.74rem' }} title={`Cast: ${movie.actors}`}>
                        <span style={{ color: 'var(--accent-light)', fontWeight: 700 }}>Cast: </span>
                        <span>{movie.actors}</span>
                      </div>
                    )}

                    <p className="movie-card-desc">
                      {movie.description}
                    </p>

                    {/* Card Footer with Hype Button, Reviews & Book Button */}
                    <div className="movie-card-footer d-flex align-items-center justify-content-between flex-wrap gap-2">
                      <div className="d-flex align-items-center gap-2">
                        {/* Dedicated Hype Action Button for Every User */}
                        <button
                          type="button"
                          className={`btn-hype-action ${hypedMovieIds.has(movie.id) ? 'hyped' : ''}`}
                          onClick={(e) => handleHypeMovie(movie.id, e)}
                          title="Click to hype this movie and boost its ranking!"
                        >
                          <span>🔥</span>
                          <span>{hypedMovieIds.has(movie.id) ? 'Hyped' : 'Hype'}</span>
                        </button>

                        {/* Reviews */}
                        <button
                          className="btn btn-sm btn-link p-0 text-decoration-none d-flex align-items-center gap-1"
                          style={{ color: 'var(--text-muted)', fontSize: '0.78rem', fontWeight: 700 }}
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenReviews(movie);
                          }}
                        >
                          <i className="bi bi-chat-dots" style={{ color: '#f87171' }}></i>
                          <span>{movie.reviews_count || 0}</span>
                        </button>
                      </div>

                      <button
                        className="btn btn-cinema btn-sm px-3"
                        onClick={() => handleSelectMovie(movie)}
                      >
                        Book Tickets
                      </button>
                    </div>
                  </div>

                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Showtime Selection Modal with Multi-Day Date Tabs & Hierarchical Region/Area Filter */}
      {selectedMovie && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0, 0, 0, 0.85)', backdropFilter: 'blur(8px)' }}>
          <div className="modal-dialog modal-dialog-centered modal-lg">
            <div className="modal-content border-0 rounded-4 shadow-lg overflow-hidden" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-bright)' }}>
              
              {/* Modal Header with Movie Description */}
              <div className="modal-header border-0 px-4 pt-3 pb-3" style={{ background: 'var(--bg-card)', borderBottom: '1px solid var(--border)' }}>
                <div className="d-flex align-items-start gap-3 flex-grow-1 me-3">
                  <img 
                    src={getSafePosterUrl(selectedMovie.poster_url, selectedMovie.title)} 
                    alt={selectedMovie.title}
                    style={{ width: '64px', height: '90px', borderRadius: '10px', objectFit: 'cover', border: '1px solid var(--border-bright)', flexShrink: 0 }}
                    onError={(e) => {
                      e.target.src = `https://placehold.co/64x90/1e1e2e/7c3aed?text=?`;
                    }}
                  />
                  <div className="flex-grow-1">
                    <div className="d-flex align-items-center gap-2 flex-wrap">
                      <h5 className="modal-title fw-bold text-white mb-0" style={{ fontSize: '1.25rem' }}>{selectedMovie.title}</h5>
                      <span style={{ fontSize: '0.68rem', background: 'rgba(30,30,46,0.9)', border: '1px solid var(--border-bright)', color: 'var(--text-muted)', borderRadius: '4px', padding: '0.1rem 0.4rem' }}>UA</span>
                    </div>
                    <div className="d-flex align-items-center gap-2 mt-1 flex-wrap">
                      <span style={{ color: 'var(--gold)', fontSize: '0.85rem', fontWeight: 800 }}>
                        ★ {selectedMovie.rating}/10
                      </span>
                      <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                        · {selectedMovie.genre} · {Math.floor(selectedMovie.duration_mins / 60)}h {selectedMovie.duration_mins % 60}m
                      </span>

                      {/* Hype Action Button for Selected Movie */}
                      <button
                        type="button"
                        className={`btn-hype-action ms-1 ${hypedMovieIds.has(selectedMovie.id) ? 'hyped' : ''}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleHypeMovie(selectedMovie.id, e);
                          setSelectedMovie((prev) => ({
                            ...prev,
                            hype_count: (prev.hype_count || 0) + 1,
                          }));
                        }}
                        title="Click to hype this movie!"
                      >
                        <span>🔥</span>
                        <span>{hypedMovieIds.has(selectedMovie.id) ? 'Hyped' : 'Hype'} ({formatHype(selectedMovie.hype_count)})</span>
                      </button>
                    </div>

                    {/* Star Cast in Modal */}
                    {selectedMovie.actors && (
                      <div className="small mt-1 text-truncate" style={{ color: '#cbd5e1', fontSize: '0.8rem' }} title={`Starring: ${selectedMovie.actors}`}>
                        <span style={{ color: 'var(--accent-light)', fontWeight: 700 }}>Starring: </span>
                        <span>{selectedMovie.actors}</span>
                      </div>
                    )}

                    {/* Movie Synopsis / Description shown prominently */}
                    {selectedMovie.description && (
                      <p className="small mb-0 mt-2" style={{ color: '#cbd5e1', lineHeight: '1.45', fontSize: '0.82rem', maxHeight: '58px', overflowY: 'auto' }}>
                        {selectedMovie.description}
                      </p>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setSelectedMovie(null)}
                ></button>
              </div>

              <div className="modal-body p-4" style={{ maxHeight: '72vh', overflowY: 'auto' }}>
                
                {/* 1. Date Selector Tabs (Today, Tomorrow, Day 2, Day 3) */}
                <div className="mb-4">
                  <div className="small fw-bold text-uppercase mb-2 text-secondary" style={{ letterSpacing: '1px' }}>
                    Select Date
                  </div>
                  <div className="d-flex gap-2 overflow-auto pb-1" style={{ scrollbarWidth: 'none' }}>
                    {upcomingDays.map((day) => (
                      <div
                        key={day.index}
                        className={`date-tab-btn ${selectedDateIndex === day.index ? 'active' : ''}`}
                        onClick={() => setSelectedDateIndex(day.index)}
                      >
                        <span className="date-tab-day">{day.dayLabel}</span>
                        <span className="date-tab-date">{day.dateStr}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 2. Hierarchical Region & Area Filter */}
                <div className="mb-4 p-3 rounded-3" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-bright)' }}>
                  
                  {/* Level 1: State Filter (All -> AP -> TS) */}
                  <div className="small fw-bold text-uppercase mb-2 text-secondary" style={{ letterSpacing: '0.5px' }}>
                    Select Region:
                  </div>
                  <div className="d-flex gap-2 flex-wrap mb-3">
                    <button
                      className={`btn btn-sm rounded-pill px-3 fw-bold ${selectedState === 'ALL' ? 'btn-cinema' : 'btn-outline-secondary text-white'}`}
                      style={{ fontSize: '0.82rem' }}
                      onClick={() => {
                        setSelectedState('ALL');
                        setSelectedArea('ALL');
                      }}
                    >
                      🌐 All Theaters (AP & TS)
                    </button>
                    <button
                      className={`btn btn-sm rounded-pill px-3 fw-bold ${selectedState === 'AP' ? 'btn-cinema' : 'btn-outline-secondary text-white'}`}
                      style={{ fontSize: '0.82rem' }}
                      onClick={() => {
                        setSelectedState('AP');
                        setSelectedArea('ALL');
                      }}
                    >
                      🏛️ Andhra Pradesh (AP)
                    </button>
                    <button
                      className={`btn btn-sm rounded-pill px-3 fw-bold ${selectedState === 'TS' ? 'btn-cinema' : 'btn-outline-secondary text-white'}`}
                      style={{ fontSize: '0.82rem' }}
                      onClick={() => {
                        setSelectedState('TS');
                        setSelectedArea('ALL');
                      }}
                    >
                      🏛️ Telangana (TS)
                    </button>
                  </div>

                  {/* Level 2: Area / City Filter for Andhra Pradesh */}
                  {selectedState === 'AP' && (
                    <div>
                      <div className="small fw-bold text-secondary mb-2" style={{ fontSize: '0.75rem' }}>
                        📍 Filter Andhra Pradesh Area:
                      </div>
                      <div className="d-flex gap-2 flex-wrap">
                        {apAreas.map((area) => (
                          <button
                            key={area.value}
                            className={`btn btn-sm rounded-pill px-3 fw-bold ${selectedArea === area.value ? 'btn-danger' : 'btn-dark text-secondary border'}`}
                            style={{ fontSize: '0.75rem' }}
                            onClick={() => setSelectedArea(area.value)}
                          >
                            {area.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Level 2: Area / City Filter for Telangana */}
                  {selectedState === 'TS' && (
                    <div>
                      <div className="small fw-bold text-secondary mb-2" style={{ fontSize: '0.75rem' }}>
                        📍 Filter Telangana Area:
                      </div>
                      <div className="d-flex gap-2 flex-wrap">
                        {tsAreas.map((area) => (
                          <button
                            key={area.value}
                            className={`btn btn-sm rounded-pill px-3 fw-bold ${selectedArea === area.value ? 'btn-danger' : 'btn-dark text-secondary border'}`}
                            style={{ fontSize: '0.75rem' }}
                            onClick={() => setSelectedArea(area.value)}
                          >
                            {area.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                </div>

                {/* 3. Showtime Groups by Multiplex Theater */}
                {showsLoading ? (
                  <div className="text-center py-5">
                    <div className="spinner-border text-danger" role="status"></div>
                    <p className="mt-2 text-secondary small">Fetching multiplex showtimes...</p>
                  </div>
                ) : Object.keys(theaterGroups).length === 0 ? (
                  <div className="text-center py-5 rounded-3" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                    <i className="bi bi-calendar-x fs-2 d-block mb-2" style={{ color: 'var(--text-muted)' }}></i>
                    <h6 className="text-white">No Shows Matching Selected Date or Area</h6>
                    <p className="small text-secondary mb-0">
                      Try selecting another date tab above or switch to "All Theaters".
                    </p>
                  </div>
                ) : (
                  <div className="d-flex flex-column gap-3 mt-3">
                    {Object.values(theaterGroups).map((group) => (
                      <div key={group.theater_name} className="theater-group-card">
                        <div className="d-flex justify-content-between align-items-start mb-2 pb-2 border-bottom" style={{ borderColor: 'var(--border)' }}>
                          <div>
                            <h6 className="fw-bold text-white mb-1" style={{ fontSize: '1rem' }}>
                              🏢 {group.theater_name}
                            </h6>
                            <span className="small text-secondary">
                              📍 {group.theater_city} {group.theater_address ? `(${group.theater_address})` : ''} — <span style={{ color: 'var(--accent-light)' }}>{group.screen_name}</span>
                            </span>
                          </div>
                          <span 
                            style={{ 
                              background: 'rgba(124, 58, 237, 0.15)', 
                              color: 'var(--accent-light)', 
                              fontSize: '0.68rem', 
                              fontWeight: 700, 
                              padding: '0.2rem 0.5rem', 
                              borderRadius: '6px' 
                            }}
                          >
                            DOLBY ATMOS · 4K
                          </span>
                        </div>

                        {/* Show Time Slots */}
                        <div className="d-flex flex-wrap gap-2 mt-3">
                          {group.shows.map((show) => {
                            const showTime = new Date(show.start_time);
                            const timeStr = showTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                            return (
                              <button
                                key={show.show_id}
                                className="time-slot-btn"
                                onClick={() => {
                                  setSelectedMovie(null);
                                  onSelectShow(show.show_id);
                                }}
                                title="Click to select seats"
                              >
                                <span style={{ fontSize: '0.88rem' }}>{timeStr}</span>
                                <span className="time-slot-price">₹{parseFloat(show.base_price).toFixed(0)}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

              </div>

            </div>
          </div>
        </div>
      )}

    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { demandsApi } from '../services/api';

export default function AudienceDemandModal({ show, user, onClose, onRequireAuth, onMovieScheduled }) {
  const [demands, setDemands] = useState([]);
  const [stats, setStats] = useState({ total_requests: 0, active_voting: 0, greenlit_count: 0, scheduled_count: 0, total_audience_votes: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [cityFilter, setCityFilter] = useState('ALL');

  // New Request Form State
  const [showProposeForm, setShowProposeForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newGenre, setNewGenre] = useState('');
  const [newYear, setNewYear] = useState(new Date().getFullYear());
  const [newCity, setNewCity] = useState('All AP & Telangana');
  const [newDescription, setNewDescription] = useState('');
  const [newPosterUrl, setNewPosterUrl] = useState('');

  // Voting loading map
  const [votingId, setVotingId] = useState(null);

  const fetchDemands = async () => {
    setLoading(true);
    try {
      const params = {};
      if (statusFilter !== 'ALL') params.status = statusFilter;
      if (cityFilter !== 'ALL') params.city = cityFilter;

      const res = await demandsApi.getAll(params);
      setDemands(res.data.data);
      if (res.data.stats) {
        setStats(res.data.stats);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load audience demands');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (show) {
      fetchDemands();
      setSuccessMsg(null);
      setError(null);
    }
  }, [show, statusFilter, cityFilter]);

  if (!show) return null;

  const handleVote = async (demandId) => {
    if (!user) {
      onRequireAuth();
      return;
    }

    setVotingId(demandId);
    try {
      const res = await demandsApi.toggleVote(demandId);
      // Update local state instantly
      setDemands(prev => prev.map(d => {
        if (d.id === demandId) {
          return {
            ...d,
            has_voted: res.data.has_voted,
            vote_count: res.data.vote_count,
            status: res.data.status,
          };
        }
        return d;
      }));
      setSuccessMsg(res.data.message);
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to record vote');
    } finally {
      setVotingId(null);
    }
  };

  const handleProposeSubmit = async (e) => {
    e.preventDefault();
    if (!user) {
      onRequireAuth();
      return;
    }

    setSubmitting(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const res = await demandsApi.create({
        title: newTitle,
        genre: newGenre,
        releaseYear: parseInt(newYear, 10),
        targetCity: newCity,
        description: newDescription,
        posterUrl: newPosterUrl,
      });

      setSuccessMsg(res.data.message);
      setShowProposeForm(false);
      setNewTitle('');
      setNewGenre('');
      setNewDescription('');
      setNewPosterUrl('');
      await fetchDemands();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to submit movie proposal');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0, 0, 0, 0.88)', backdropFilter: 'blur(10px)' }}>
      <div className="modal-dialog modal-dialog-centered modal-xl">
        <div className="modal-content border-0 rounded-4 shadow-lg overflow-hidden" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-bright)' }}>
          
          {/* Header */}
          <div className="modal-header border-0 px-4 pt-4 pb-3" style={{ background: 'var(--bg-card)', borderBottom: '1px solid var(--border)' }}>
            <div className="d-flex align-items-center justify-content-between w-100">
              <div>
                <div className="d-flex align-items-center gap-2 mb-1">
                  <span className="badge rounded-pill" style={{ background: 'linear-gradient(135deg, #ef4444, #f97316)', color: '#fff', fontSize: '0.72rem', letterSpacing: '0.5px' }}>
                    🔥 AUDIENCE CURATION & DEMAND
                  </span>
                  <span className="text-secondary small">Democratized Telugu Cinema</span>
                </div>
                <h4 className="modal-title fw-bold text-white mb-0" style={{ letterSpacing: '-0.3px' }}>
                  Audience Movie Vault & Demand Screenings
                </h4>
                <p className="text-secondary small mb-0 mt-1">
                  Vote for classic Telugu re-releases and cult blockbusters. The #1 top-voted films on the live leaderboard get selected by theaters for special screenings!
                </p>
              </div>

              <div className="d-flex align-items-center gap-2">
                <button 
                  type="button" 
                  className="btn btn-sm btn-cinema rounded-pill px-3 py-2 fw-bold d-flex align-items-center gap-2 shadow-sm"
                  onClick={() => setShowProposeForm(!showProposeForm)}
                >
                  <i className={`bi ${showProposeForm ? 'bi-x-lg' : 'bi-plus-circle-fill'}`}></i>
                  <span>{showProposeForm ? 'Close Form' : 'Propose a Movie'}</span>
                </button>
                <button type="button" className="btn-close ms-2" onClick={onClose}></button>
              </div>
            </div>
          </div>

          {/* Body */}
          <div className="modal-body px-4 py-3" style={{ maxHeight: '78vh', overflowY: 'auto' }}>
            {error && <div className="alert alert-danger py-2 small mb-3">{error}</div>}
            {successMsg && <div className="alert alert-success py-2 small mb-3">{successMsg}</div>}

            {/* Metrics Ribbon */}
            <div className="row g-2 mb-4">
              <div className="col-6 col-md-3">
                <div className="p-3 rounded-3 text-center" style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--border)' }}>
                  <div className="text-secondary small mb-1">Total Fan Requests</div>
                  <div className="fs-4 fw-bold text-white font-monospace">{stats.total_requests}</div>
                </div>
              </div>
              <div className="col-6 col-md-3">
                <div className="p-3 rounded-3 text-center" style={{ background: 'rgba(234, 179, 8, 0.08)', border: '1px solid rgba(234, 179, 8, 0.25)' }}>
                  <div className="text-warning small mb-1">Active Voting</div>
                  <div className="fs-4 fw-bold text-warning font-monospace">{stats.active_voting}</div>
                </div>
              </div>
              <div className="col-6 col-md-3">
                <div className="p-3 rounded-3 text-center" style={{ background: 'rgba(34, 197, 94, 0.08)', border: '1px solid rgba(34, 197, 94, 0.25)' }}>
                  <div className="text-success small mb-1">Audience Greenlit</div>
                  <div className="fs-4 fw-bold text-success font-monospace">{stats.greenlit_count}</div>
                </div>
              </div>
              <div className="col-6 col-md-3">
                <div className="p-3 rounded-3 text-center" style={{ background: 'rgba(139, 92, 246, 0.08)', border: '1px solid rgba(139, 92, 246, 0.25)' }}>
                  <div className="small mb-1" style={{ color: '#c4b5fd' }}>Total Audience Votes</div>
                  <div className="fs-4 fw-bold font-monospace" style={{ color: '#c4b5fd' }}>{stats.total_audience_votes}</div>
                </div>
              </div>
            </div>

            {/* Propose a Movie Form Drawer */}
            {showProposeForm && (
              <div className="p-4 mb-4 rounded-4 shadow-sm" style={{ background: 'rgba(124, 58, 237, 0.1)', border: '1px solid rgba(139, 92, 246, 0.4)' }}>
                <div className="d-flex align-items-center justify-content-between mb-3">
                  <h5 className="fw-bold text-white mb-0 d-flex align-items-center gap-2">
                    <span>🎬</span> Propose a Movie for Theatrical Screening
                  </h5>
                  <span className="badge bg-warning text-dark fw-bold">Starts with 1 Vote from You</span>
                </div>
                
                <form onSubmit={handleProposeSubmit}>
                  <div className="row g-3">
                    <div className="col-md-6">
                      <label htmlFor="demand-title" className="form-label small text-secondary fw-bold">Movie Title *</label>
                      <input 
                        id="demand-title"
                        name="title"
                        type="text" 
                        className="form-control rounded-3" 
                        style={{ background: 'rgba(255, 255, 255, 0.05)', color: '#fff', border: '1px solid var(--border)' }}
                        placeholder="e.g. Athadu (4K Remaster), Jersey, Eega" 
                        value={newTitle}
                        onChange={(e) => setNewTitle(e.target.value)}
                        required
                      />
                    </div>
                    <div className="col-md-3">
                      <label htmlFor="demand-genre" className="form-label small text-secondary fw-bold">Genre</label>
                      <input 
                        id="demand-genre"
                        name="genre"
                        type="text" 
                        className="form-control rounded-3" 
                        style={{ background: 'rgba(255, 255, 255, 0.05)', color: '#fff', border: '1px solid var(--border)' }}
                        placeholder="e.g. Action Drama, Cult Classic" 
                        value={newGenre}
                        onChange={(e) => setNewGenre(e.target.value)}
                      />
                    </div>
                    <div className="col-md-3">
                      <label htmlFor="demand-year" className="form-label small text-secondary fw-bold">Release Year</label>
                      <input 
                        id="demand-year"
                        name="releaseYear"
                        type="number" 
                        className="form-control rounded-3" 
                        style={{ background: 'rgba(255, 255, 255, 0.05)', color: '#fff', border: '1px solid var(--border)' }}
                        value={newYear}
                        onChange={(e) => setNewYear(e.target.value)}
                      />
                    </div>

                    <div className="col-md-6">
                      <label htmlFor="demand-city" className="form-label small text-secondary fw-bold">Target Screening City</label>
                      <select 
                        id="demand-city"
                        name="targetCity"
                        className="form-select rounded-3" 
                        style={{ background: '#1c1c28', color: '#fff', border: '1px solid var(--border)' }}
                        value={newCity}
                        onChange={(e) => setNewCity(e.target.value)}
                      >
                        <option value="All AP & Telangana">All AP & Telangana</option>
                        <option value="Hyderabad (Telangana)">Hyderabad (Telangana)</option>
                        <option value="Visakhapatnam (Andhra Pradesh)">Visakhapatnam (Andhra Pradesh)</option>
                        <option value="Vijayawada (Andhra Pradesh)">Vijayawada (Andhra Pradesh)</option>
                        <option value="Warangal (Telangana)">Warangal (Telangana)</option>
                        <option value="Guntur (Andhra Pradesh)">Guntur (Andhra Pradesh)</option>
                        <option value="Tirupati (Andhra Pradesh)">Tirupati (Andhra Pradesh)</option>
                      </select>
                    </div>

                    <div className="col-md-6">
                      <label htmlFor="demand-poster" className="form-label small text-secondary fw-bold">Poster Image URL (Optional)</label>
                      <input 
                        id="demand-poster"
                        name="posterUrl"
                        type="url" 
                        className="form-control rounded-3" 
                        style={{ background: 'rgba(255, 255, 255, 0.05)', color: '#fff', border: '1px solid var(--border)' }}
                        placeholder="https://..." 
                        value={newPosterUrl}
                        onChange={(e) => setNewPosterUrl(e.target.value)}
                      />
                    </div>

                    <div className="col-12">
                      <label htmlFor="demand-desc" className="form-label small text-secondary fw-bold">Why should theaters screen this film? *</label>
                      <textarea 
                        id="demand-desc"
                        name="description"
                        className="form-control rounded-3" 
                        style={{ background: 'rgba(255, 255, 255, 0.05)', color: '#fff', border: '1px solid var(--border)' }}
                        rows="2"
                        placeholder="Highlight memorable scenes, cult fan following, anniversary, or sound design that demands large-screen theatrical experience..."
                        value={newDescription}
                        onChange={(e) => setNewDescription(e.target.value)}
                        required
                      ></textarea>
                    </div>

                    <div className="col-12 text-end">
                      <button 
                        type="submit" 
                        className="btn btn-cinema px-4 py-2 rounded-pill fw-bold"
                        disabled={submitting}
                      >
                        {submitting ? 'Submitting Proposal...' : 'Publish Movie Request'}
                      </button>
                    </div>
                  </div>
                </form>
              </div>
            )}

            {/* Filter Bar */}
            <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
              <div className="d-flex align-items-center gap-2">
                <span className="small text-secondary fw-bold">Status:</span>
                {['ALL', 'VOTING', 'GREENLIT', 'SCHEDULED'].map(st => (
                  <button 
                    key={st}
                    className={`btn btn-sm rounded-pill px-3 fw-bold ${statusFilter === st ? 'btn-cinema' : 'btn-outline-secondary'}`}
                    style={statusFilter === st ? {} : { borderColor: 'var(--border)' }}
                    onClick={() => setStatusFilter(st)}
                  >
                    {st === 'ALL' ? 'All Demands' : st === 'VOTING' ? '🗳️ Voting Open' : st === 'GREENLIT' ? '✨ Greenlit' : '🎟️ Scheduled'}
                  </button>
                ))}
              </div>

              <div className="d-flex align-items-center gap-2">
                <span className="small text-secondary fw-bold">City:</span>
                <select 
                  className="form-select form-select-sm rounded-pill"
                  style={{ background: 'var(--bg-card)', color: '#fff', border: '1px solid var(--border)', width: 'auto' }}
                  value={cityFilter}
                  onChange={(e) => setCityFilter(e.target.value)}
                >
                  <option value="ALL">All Cities</option>
                  <option value="Hyderabad">Hyderabad</option>
                  <option value="Visakhapatnam">Visakhapatnam</option>
                  <option value="Vijayawada">Vijayawada</option>
                  <option value="Warangal">Warangal</option>
                  <option value="Guntur">Guntur</option>
                  <option value="Tirupati">Tirupati</option>
                </select>
              </div>
            </div>

            {/* Movie Demands Grid */}
            {loading ? (
              <div className="text-center py-5">
                <div className="spinner-border text-danger" role="status"></div>
                <div className="text-secondary small mt-2">Loading audience demand board...</div>
              </div>
            ) : demands.length === 0 ? (
              <div className="text-center py-5 text-secondary">
                <i className="bi bi-film fs-1 d-block mb-2 text-muted"></i>
                <h5>No movie requests match your filter</h5>
                <p className="small">Be the first to demand a movie for your favorite theater!</p>
                <button 
                  className="btn btn-sm btn-cinema rounded-pill px-3"
                  onClick={() => setShowProposeForm(true)}
                >
                  Propose a Movie Now
                </button>
              </div>
            ) : (
              <div className="row g-3">
                {demands.map((d, index) => {
                  const isGreenlit = d.status === 'GREENLIT';
                  const isScheduled = d.status === 'SCHEDULED';

                  return (
                    <div key={d.id} className="col-md-6 col-xl-6">
                      <div 
                        className="rounded-4 p-3 h-100 position-relative d-flex flex-column justify-content-between overflow-hidden"
                        style={{ 
                          background: index === 0 ? 'rgba(234, 179, 8, 0.05)' : isScheduled ? 'rgba(34, 197, 94, 0.08)' : isGreenlit ? 'rgba(234, 179, 8, 0.08)' : 'var(--bg-card)', 
                          border: index === 0 ? '1px solid rgba(234, 179, 8, 0.35)' : isScheduled ? '1px solid rgba(34, 197, 94, 0.35)' : isGreenlit ? '1px solid rgba(234, 179, 8, 0.35)' : '1px solid var(--border-bright)' 
                        }}
                      >
                        <div>
                          {/* Card Header & Status */}
                          <div className="d-flex justify-content-between align-items-start gap-2 mb-2 flex-wrap">
                            <div className="d-flex align-items-center gap-2 flex-wrap">
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

                              <span 
                                className="badge rounded-pill fw-bold"
                                style={
                                  isScheduled ? { background: 'rgba(34, 197, 94, 0.2)', color: '#4ade80', border: '1px solid #22c55e' } :
                                  isGreenlit ? { background: 'rgba(234, 179, 8, 0.2)', color: '#facc15', border: '1px solid #eab308' } :
                                  { background: 'rgba(99, 102, 241, 0.15)', color: '#a5b4fc', border: '1px solid rgba(99, 102, 241, 0.3)' }
                                }
                              >
                                {isScheduled ? '🎟️ SHOWS SCHEDULED' : isGreenlit ? '✨ GREENLIT' : '🗳️ VOTING OPEN'}
                              </span>
                              <span className="text-secondary" style={{ fontSize: '0.72rem' }}>
                                📍 {d.target_city}
                              </span>
                            </div>

                            <span className="badge rounded-pill text-secondary" style={{ background: 'var(--bg-elevated)', fontSize: '0.72rem' }}>
                              Year: {d.release_year || 'N/A'}
                            </span>
                          </div>

                          {/* Movie Title & Genre */}
                          <div className="d-flex gap-3 align-items-start mb-3">
                            <img 
                              src={d.poster_url} 
                              alt={d.title}
                              style={{ width: '64px', height: '90px', borderRadius: '10px', objectFit: 'cover', border: '1px solid var(--border-bright)' }}
                              onError={(e) => { e.target.src = 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=500&auto=format&fit=crop'; }}
                            />
                            <div className="flex-grow-1">
                              <h5 className="fw-bold text-white mb-1" style={{ fontSize: '1.15rem' }}>{d.title}</h5>
                              <span className="badge bg-dark text-muted border border-secondary mb-2" style={{ fontSize: '0.7rem' }}>
                                {d.genre}
                              </span>
                              <p className="text-secondary small mb-0" style={{ lineHeight: '1.4', fontSize: '0.82rem' }}>
                                "{d.description}"
                              </p>
                              {d.admin_notes && (
                                <div className="mt-2 p-2 rounded-2 small" style={{ background: 'rgba(234, 179, 8, 0.12)', color: '#fef08a', fontSize: '0.75rem', border: '1px solid rgba(234, 179, 8, 0.3)' }}>
                                  🏢 <strong>Theater Note:</strong> {d.admin_notes}
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Live Leaderboard Votes Callout */}
                          <div className="mb-3 p-2 rounded-3 d-flex align-items-center justify-content-between" style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--border)' }}>
                            <div className="d-flex align-items-center gap-2">
                              <span className="fs-5">🔥</span>
                              <div>
                                <span className="fw-bold text-white small d-block">
                                  {d.vote_count} {d.vote_count === 1 ? 'Audience Vote' : 'Audience Votes'}
                                </span>
                                <span className="text-secondary" style={{ fontSize: '0.7rem' }}>
                                  {index === 0 ? 'Leading the fan leaderboard' : `Ranked #${index + 1} on leaderboard`}
                                </span>
                              </div>
                            </div>
                            {index === 0 && (
                              <span className="badge bg-warning text-dark fw-bold" style={{ fontSize: '0.72rem' }}>
                                Leader
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="d-flex justify-content-between align-items-center pt-2 border-top" style={{ borderColor: 'var(--border)' }}>
                          <span className="text-secondary" style={{ fontSize: '0.74rem' }}>
                            Proposed by: <strong className="text-white">{d.requester_name || 'Fan Member'}</strong>
                          </span>

                          <button 
                            className={`btn btn-sm rounded-pill fw-bold px-3 d-flex align-items-center gap-1 ${d.has_voted ? 'btn-success' : 'btn-outline-warning'}`}
                            onClick={() => handleVote(d.id)}
                            disabled={votingId === d.id}
                            style={!d.has_voted ? { borderColor: 'var(--gold)', color: 'var(--gold)' } : {}}
                          >
                            {votingId === d.id ? (
                              <span className="spinner-border spinner-border-sm" role="status"></span>
                            ) : (
                              <>
                                <i className={`bi ${d.has_voted ? 'bi-check2-circle' : 'bi-hand-thumbs-up-fill'}`}></i>
                                <span>{d.has_voted ? 'Voted & Demanded' : 'Vote to Screen'}</span>
                              </>
                            )}
                          </button>
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

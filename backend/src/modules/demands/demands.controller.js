import { query } from '../../config/db.js';

// Get all audience movie demands & wishlist
export const getAllDemands = async (req, res, next) => {
  try {
    const { status, city, sort = 'votes' } = req.query;
    const userId = req.user?.id || null;

    let queryText = `
      SELECT 
        mr.id,
        mr.user_id,
        mr.title,
        mr.description,
        mr.genre,
        mr.release_year,
        mr.target_city,
        mr.poster_url,
        mr.trailer_url,
        mr.status,
        mr.vote_count,
        mr.target_threshold,
        mr.greenlit_movie_id,
        mr.admin_notes,
        mr.created_at,
        u.full_name AS requester_name,
        COALESCE(
          (SELECT TRUE FROM movie_request_votes mrv WHERE mrv.request_id = mr.id AND mrv.user_id = $1),
          FALSE
        ) AS has_voted
      FROM movie_requests mr
      JOIN users u ON mr.user_id = u.id
      WHERE 1=1
    `;

    const params = [userId];
    let paramIndex = 2;

    if (status && status !== 'ALL') {
      queryText += ` AND mr.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    if (city && city !== 'ALL') {
      queryText += ` AND (mr.target_city ILIKE $${paramIndex} OR mr.target_city = 'All AP & Telangana')`;
      params.push(`%${city}%`);
      paramIndex++;
    }

    if (sort === 'recent') {
      queryText += ` ORDER BY mr.created_at DESC`;
    } else {
      queryText += ` ORDER BY mr.vote_count DESC, mr.created_at DESC`;
    }

    const result = await query(queryText, params);

    // Get aggregated stats
    const statsRes = await query(`
      SELECT 
        COUNT(id)::int AS total_requests,
        COUNT(CASE WHEN status = 'VOTING' THEN 1 END)::int AS active_voting,
        COUNT(CASE WHEN status = 'GREENLIT' THEN 1 END)::int AS greenlit_count,
        COUNT(CASE WHEN status = 'SCHEDULED' THEN 1 END)::int AS scheduled_count,
        COALESCE(SUM(vote_count), 0)::int AS total_audience_votes
      FROM movie_requests;
    `);

    res.json({
      success: true,
      data: result.rows,
      stats: statsRes.rows[0],
    });
  } catch (error) {
    next(error);
  }
};

// Propose a movie
export const createDemand = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { 
      title, 
      genre, 
      releaseYear, 
      targetCity, 
      description, 
      posterUrl, 
      trailerUrl 
    } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ success: false, error: 'Movie title is required' });
    }

    // Default poster if not provided
    const safePosterUrl = posterUrl && posterUrl.trim() 
      ? posterUrl.trim() 
      : 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=500&auto=format&fit=crop';

    const result = await query(`
      INSERT INTO movie_requests 
        (user_id, title, genre, release_year, target_city, description, poster_url, trailer_url, vote_count, target_threshold, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 1, 25, 'VOTING')
      RETURNING *;
    `, [
      userId,
      title.trim(),
      genre || 'Telugu Cinema',
      releaseYear ? parseInt(releaseYear, 10) : new Date().getFullYear(),
      targetCity || 'All AP & Telangana',
      description || 'Audience requested screening for Telugu film lovers.',
      safePosterUrl,
      trailerUrl || null,
    ]);

    const createdDemand = result.rows[0];

    // Automatically register creator's vote
    await query(`
      INSERT INTO movie_request_votes (request_id, user_id)
      VALUES ($1, $2)
      ON CONFLICT DO NOTHING;
    `, [createdDemand.id, userId]);

    res.status(201).json({
      success: true,
      message: 'Your movie request has been published! Fellow moviegoers can now vote to greenlight it.',
      data: {
        ...createdDemand,
        has_voted: true,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Vote / Unvote for a movie request
export const toggleVoteDemand = async (req, res, next) => {
  try {
    const requestId = parseInt(req.params.id, 10);
    const userId = req.user.id;

    if (isNaN(requestId)) {
      return res.status(400).json({ success: false, error: 'Invalid request ID' });
    }

    // Check if demand exists
    const demandRes = await query(`SELECT * FROM movie_requests WHERE id = $1;`, [requestId]);
    if (demandRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Movie request not found' });
    }

    const demand = demandRes.rows[0];

    // Check if user already voted
    const existingVote = await query(`
      SELECT id FROM movie_request_votes WHERE request_id = $1 AND user_id = $2;
    `, [requestId, userId]);

    let hasVoted = false;
    let newVoteCount = demand.vote_count;
    let newStatus = demand.status;

    if (existingVote.rows.length > 0) {
      // Remove vote
      await query(`DELETE FROM movie_request_votes WHERE request_id = $1 AND user_id = $2;`, [requestId, userId]);
      newVoteCount = Math.max(0, demand.vote_count - 1);
      hasVoted = false;
    } else {
      // Add vote
      await query(`INSERT INTO movie_request_votes (request_id, user_id) VALUES ($1, $2);`, [requestId, userId]);
      newVoteCount = demand.vote_count + 1;
      hasVoted = true;
    }

    // Update request record
    await query(`
      UPDATE movie_requests 
      SET vote_count = $1, status = $2, updated_at = CURRENT_TIMESTAMP
      WHERE id = $3;
    `, [newVoteCount, newStatus, requestId]);

    res.json({
      success: true,
      has_voted: hasVoted,
      vote_count: newVoteCount,
      status: newStatus,
      message: hasVoted 
        ? 'Vote recorded! Film moved up on the audience leaderboard.' 
        : 'Your vote has been removed.',
    });
  } catch (error) {
    next(error);
  }
};

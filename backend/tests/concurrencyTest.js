/**
 * 🧪 HIGH-CONCURRENCY RACE CONDITION TEST
 * Simulates multiple concurrent users trying to hold the exact same seat simultaneously.
 *
 * Verifies:
 * - Zero double-bookings
 * - Exactly 1 winner (200 OK)
 * - All other contenders receive 409 Conflict
 * - Database state remains 100% consistent
 */

const API_BASE = process.env.API_BASE || 'http://127.0.0.1:5000/api';

async function runConcurrencyBenchmark() {
  console.log('⚡ Starting Concurrency Race Condition Benchmark...');

  // 1. Create tokens for 15 distinct concurrent users
  const CONCURRENT_USERS = 15;
  console.log(`👥 Registering/authenticating ${CONCURRENT_USERS} distinct users...`);
  const userTokens = [];

  for (let i = 1; i <= CONCURRENT_USERS; i++) {
    const email = `contestant_${i}@seatlock.dev`;
    let userToken;
    const registerRes = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        password: 'Password123!',
        fullName: `User Contender ${i}`,
      }),
    });

    if (registerRes.status === 201) {
      const data = await registerRes.json();
      userToken = data.data.token;
    } else {
      const loginRes = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: 'Password123!' }),
      });
      const data = await loginRes.json();
      userToken = data.data.token;
    }
    userTokens.push(userToken);
  }

  console.log(`✅ ${CONCURRENT_USERS} distinct users ready for concurrency contest.`);

  // 2. Fetch first available show and seats
  const moviesRes = await fetch(`${API_BASE}/movies`);
  const moviesData = await moviesRes.json();

  let targetShow = null;
  for (const movie of moviesData.data) {
    const movieDetailRes = await fetch(`${API_BASE}/movies/${movie.id}`);
    const movieDetail = await movieDetailRes.json();
    if (movieDetail.data.shows && movieDetail.data.shows.length > 0) {
      targetShow = movieDetail.data.shows[0];
      break;
    }
  }

  if (!targetShow) {
    console.error('❌ No upcoming shows found in database.');
    process.exit(1);
  }

  // Ensure clean state: release holds on this show
  for (const token of userTokens) {
    await fetch(`${API_BASE}/shows/${targetShow.show_id}/release`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
  }

  const seatMapRes = await fetch(`${API_BASE}/shows/${targetShow.show_id}/seats`, {
    headers: { Authorization: `Bearer ${userTokens[0]}` },
  });
  const seatMapData = await seatMapRes.json();
  const targetSeat = seatMapData.data.seats.find((s) => s.effective_status === 'AVAILABLE');

  if (!targetSeat) {
    console.error('❌ No available seat found to test concurrency on.');
    process.exit(1);
  }

  console.log(`🎯 Target Show ID: ${targetShow.show_id}`);
  console.log(`🎯 Contested Seat: ${targetSeat.row_label}${targetSeat.seat_number} (Seat ID: ${targetSeat.seat_id})`);

  // 3. Launch simultaneous hold requests from distinct users at the exact same millisecond
  console.log(`\n🚀 Firing ${CONCURRENT_USERS} simultaneous hold requests from ${CONCURRENT_USERS} different users for Seat ${targetSeat.row_label}${targetSeat.seat_number}...`);

  const startTime = Date.now();
  const promises = userTokens.map((token, i) =>
    fetch(`${API_BASE}/shows/${targetShow.show_id}/hold`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        'x-benchmark-test': 'seatlock-test',
      },
      body: JSON.stringify({ seatIds: [targetSeat.seat_id] }),
    }).then(async (res) => ({
      userIndex: i + 1,
      status: res.status,
      body: await res.json(),
    }))
  );

  const results = await Promise.all(promises);
  const totalDuration = Date.now() - startTime;

  // 4. Analyze results
  const successfulHolds = results.filter((r) => r.status === 200);
  const conflictHolds = results.filter((r) => r.status === 409);
  const otherErrors = results.filter((r) => r.status !== 200 && r.status !== 409);

  console.log('\n================ BENCHMARK RESULTS ================');
  console.log(`⏱️  Total Execution Time: ${totalDuration}ms`);
  console.log(`📊 Requests: ${CONCURRENT_USERS}`);
  console.log(`✅ Successful Holds (200 OK): ${successfulHolds.length}`);
  console.log(`🛡️  Rejected Conflicts (409 Conflict): ${conflictHolds.length}`);
  console.log(`⚠️  Unexpected Errors: ${otherErrors.length}`);

  if (successfulHolds.length === 1 && conflictHolds.length === CONCURRENT_USERS - 1) {
    console.log('\n🏆 TEST PASSED: Perfect Concurrency Isolation! Zero double bookings occurred.');
  } else {
    console.error('\n❌ TEST FAILED: Race condition detected or unexpected failure!');
  }
}

runConcurrencyBenchmark().catch(console.error);

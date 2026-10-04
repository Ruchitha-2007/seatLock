# 🎬 SeatLock: Complete Beginner-Friendly Guide & Code Walkthrough

> **Note for Interviews & Placements:**  
> This document explains **every single part of SeatLock from ground zero**—even if you have never built a backend or database before. It covers the real-world problem, the architecture, the entire workflow, and an in-depth code walkthrough.

---

## 📑 Table of Contents
1. [What is SeatLock? (The Core Problem)](#1-what-is-seatlock-the-core-problem)
2. [High-Level Architecture (The 4 Building Blocks)](#2-high-level-architecture-the-4-building-blocks)
3. [The End-to-End Workflow (Step-by-Step)](#3-the-end-to-end-workflow-step-by-step)
4. [The Core Computer Science Concepts (Explained with Simple Analogies)](#4-the-core-computer-science-concepts-explained-with-simple-analogies)
   - Race Conditions & Double Booking
   - ACID Transactions (`BEGIN`, `COMMIT`, `ROLLBACK`)
   - Pessimistic Row-Level Locking (`SELECT ... FOR UPDATE`)
   - Deadlock Prevention via Deterministic Sorting
   - Connection Pooling & Traffic Handling
5. [Database Architecture & Tables](#5-database-architecture-tables)
6. [Detailed Code Walkthrough (File by File)](#6-detailed-code-walkthrough-file-by-file)
   - `backend/src/server.js` (The Server Ignition)
   - `backend/src/app.js` (The Middlewares & Routing)
   - `backend/src/config/db.js` (The Database Bridge)
   - `backend/src/modules/bookings/bookings.controller.js` (The Heart of SeatLock)
   - `backend/src/services/emailService.js` (The Transactional Email Engine)
   - `backend/src/modules/admin/admin.controller.js` (Admin & Cascade Cancellation)
   - `backend/src/modules/demands/demands.controller.js` (Audience Re-Release Voting)
   - `frontend/src/components/SeatMap.jsx` (Interactive Cinema Seating)
   - `frontend/src/components/CheckoutModal.jsx` (Reservation & Confirmation)
7. [Top 10 Interview Questions & Plain-English Answers](#7-top-10-interview-questions--plain-english-answers)

---

## 1. What is SeatLock? (The Core Problem)

Imagine a blockbuster movie like **Avengers** or **Pushpa 2** opens for ticket bookings at 9:00 AM.

* **The Problem:** 10,000 fans open the cinema website at the exact same second. Many fans click on the exact same VIP recliner seat (e.g., Row E, Seat 12).
* In a naive, poorly programmed website:
  1. The server checks the database: *"Is Seat E12 free?"* -> Database says: *"Yes"*.
  2. For User A, it says *"Yes"*.
  3. At the exact same millisecond, for User B, it also says *"Yes"*.
  4. Both users pay. Both users are issued a ticket for Seat E12!
  5. Two people show up at the cinema with tickets for the same seat. This is called a **Double Booking / Race Condition**.

**SeatLock solves this completely.** It uses database row-level locking to guarantee that **only one person can hold or book a seat**, even if 100 people click it at the exact same millisecond.

---

## 2. High-Level Architecture (The 4 Building Blocks)

SeatLock is built as a **Full-Stack Distributed System** consisting of 4 distinct layers:

```
[ Frontend: React 19 + Vite ] (Hosted on Vercel)
               │  HTTP Requests (Axios)
               ▼
[ Backend: Node.js + Express ] (Hosted on Render)
         │                   │
         │ PostgreSQL Pool   │ SMTP over TLS (Nodemailer)
         ▼                   ▼
[ Neon Cloud PostgreSQL ]   [ Gmail / SMTP Mail Server ]
(Tables, Locks, ACID)       (Sends PDF/HTML E-Tickets)
```

1. **Frontend (Vercel):** The user interface built with React 19, Vite, and Bootstrap 5. It shows movie posters, trailers, showtimes, and an interactive theater seat map.
2. **Backend (Render):** The brain built with Node.js and Express. It receives requests, validates input, manages security, and coordinates database operations.
3. **Database (Neon Cloud PostgreSQL):** A relational SQL database that stores movies, screens, tiered seats, shows, reservations, and user accounts.
4. **Email Engine (Nodemailer + Gmail):** An automated background service that sends high-resolution cinema confirmation and cancellation emails to customers.

---

## 3. The End-to-End Workflow (Step-by-Step)

Here is what happens behind the scenes from the moment a user arrives:

### Flow 1: Browsing & Selecting a Movie
1. The user opens `https://seat-lock-alpha.vercel.app`.
2. The browser sends a `GET /api/movies` request to the backend.
3. The backend runs an optimized SQL query joining `movies`, `reviews`, and `shows` to retrieve:
   - Movie poster, title, genre, runtime, actors, release date.
   - Aggregate community rating (out of 10).
   - "Hype count" (thumbs-up likes).
   - Count of upcoming active shows.
4. The user clicks **"Book Tickets"** on a movie.

### Flow 2: Viewing the Interactive Theater Screen
1. The frontend requests `GET /api/shows/:id`.
2. The backend fetches all seats for that specific show:
   - Seat row (`A`, `B`, `C`...), number (`1`, `2`...), tier (`VIP`, `PREMIUM`, `STANDARD`), and price.
   - Live availability status: `AVAILABLE`, `HELD`, or `BOOKED`.
3. The frontend renders the theater seat layout with a curved cinema screen banner.

### Flow 3: Locking & Reserving Seats (The Magic Step)
1. The user clicks up to 6 seats and clicks **"Proceed to Reserve"**.
2. The frontend sends `POST /api/shows/:id/hold` with `seatIds: [12, 13]`.
3. **In the database:** A PostgreSQL transaction begins (`BEGIN`). It executes `SELECT ... FOR UPDATE` on rows 12 and 13.
4. If someone else already booked or held them, the server rejects with `409 Conflict` ("Seat already taken").
5. If available, status updates to `HELD` and the transaction commits (`COMMIT`).

### Flow 4: Confirming the Reservation & E-Ticket Email
1. The user enters their full name and email address in the confirmation modal.
2. The modal states the cinema rule: *"Payment of ₹X is completed at the theater box office counter at least 15 minutes before showtime."*
3. The frontend calls `POST /api/bookings/confirm`.
4. The backend:
   - Locks the show seats again to ensure integrity.
   - Marks status as `BOOKED`.
   - Generates a unique Cinema PNR code (e.g., `SL-C8950EDB`).
   - Inserts records into `bookings` and `booking_seats`.
   - Inserts a pending counter payment record into `payments`.
   - Immediately dispatches a formatted HTML E-Ticket with the PNR, movie details, screen number, seat numbers, and amount to the user's email via Nodemailer.
5. The frontend displays the confirmation screen with a success badge and PNR.

### Flow 5: Crowd-Sourced "Audience Demand" (Re-Release Engine)
1. Users can search classic or favorite past films and click **"Demand This Movie"**.
2. Users vote on titles they want re-released in theaters.
3. A live leaderboard displays top-demanded films with badges (`🏆 #1 Top Voted`, `🥈 #2`, etc.).
4. When an Admin clicks **"Greenlight for Theaters"**, the system automatically schedules new shows in cinema screens for that movie and opens ticketing for fans.

### Flow 6: Show Cancellation & Cascading Alerts (Admin)
1. If an Admin cancels a scheduled show from the Admin Panel (`DELETE /api/admin/shows/:id`):
2. The backend identifies all users who reserved tickets for that show.
3. It cascades: deletes the show seats, payment records, and bookings.
4. It triggers bulk transactional emails to each affected customer: *"Your show has been cancelled by theater management. No payment is owed."*

---

## 4. The Core Computer Science Concepts (Explained with Simple Analogies)

### A. Race Conditions & Double Booking
* **Analogy:** Imagine a classroom with one whiteboard pen on the teacher's desk. Two students, Alice and Bob, simultaneously run to grab the pen at the exact same second. If there is no rule, their hands collide.
* In web servers, two requests from two different users can run on two CPU threads at the exact same millisecond. Without locking, both think the seat is available and both reserve it.

### B. ACID Transactions
A database transaction is a collection of SQL queries bundled together that follow four rules:
* **Atomicity:** "All or nothing." If you book 3 seats and 2 succeed but the 3rd fails, **none** are booked. No partial states.
* **Consistency:** The database always follows rules and constraints (e.g., foreign keys, valid statuses).
* **Isolation:** Transaction A cannot see what Transaction B is doing until Transaction B commits.
* **Durability:** Once committed, the booking is permanently saved to disk even if the server crashes.

In SQL, a transaction looks like:
```sql
BEGIN;                    -- Start transaction
... do queries ...
COMMIT;                   -- Permanently save changes
-- OR if an error happens:
ROLLBACK;                 -- Cancel everything back to how it was
```

### C. Pessimistic Row-Level Locking (`SELECT ... FOR UPDATE`)
* **Analogy:** When you enter a public restroom stall, you turn the lock on the door. Anyone else who walks up to that door sees it is locked and must wait outside until you unlock it.
* In PostgreSQL, when you run:
  ```sql
  SELECT * FROM show_seats WHERE id = 12 FOR UPDATE;
  ```
  PostgreSQL puts an exclusive lock on that specific row in memory. If another user's request tries to run `SELECT ... FOR UPDATE` on row 12, PostgreSQL **freezes their request** until the first transaction finishes (`COMMIT` or `ROLLBACK`).

### D. Deadlock Prevention via Deterministic Sorting
* **What is a Deadlock?**
  - Alice wants Seat 1 and Seat 2. She locks Seat 1 first, and wants Seat 2 next.
  - Bob simultaneously wants Seat 2 and Seat 1. He locks Seat 2 first, and wants Seat 1 next.
  - Alice is waiting for Bob to release Seat 2.
  - Bob is waiting for Alice to release Seat 1.
  - **Both wait forever! The server freezes and crashes.**
* **The Solution (Deterministic Sorting):**
  - We sort all requested seat IDs in ascending order: `[1, 2]`.
  - Both Alice and Bob MUST lock Seat 1 first, then Seat 2.
  - Alice locks Seat 1. Bob tries to lock Seat 1 and is blocked immediately. No deadlock is mathematically possible!

### E. Connection Pooling & Traffic Handling
* Creating a brand new database connection for every single HTTP request takes ~50–100ms because of TCP and SSL handshakes. If 500 users click at once, the database runs out of memory.
* **Connection Pool (`pg.Pool`):** We create a pool of 20 reusable connections. When a request comes in, it borrows a connection, runs the query in 5ms, and returns it to the pool. This allows the system to easily serve **500+ requests with <500ms latency**.

---

## 5. Database Architecture & Tables

SeatLock uses a normalized relational schema with 11 migrations:

```
[ THEATERS ] 1 ─── ∞ [ SCREENS ] 1 ─── ∞ [ SEATS ]
                            │                │
                            ▼ 1              ▼ 1
                       [ SHOWS ] 1 ─── ∞ [ SHOW_SEATS ]
                            │                    ▲
                            ▼ 1                  │ ∞
                       [ BOOKINGS ] 1 ────── [ BOOKING_SEATS ]
                            │
                            ▼ 1
                       [ PAYMENTS ]
```

1. **`users`**: Customer accounts (`id`, `full_name`, `email`, `password_hash`, `role`).
2. **`theaters`**: Cinema locations (`id`, `name`, `city`, `address`).
3. **`screens`**: Multiplex auditoriums (`id`, `theater_id`, `screen_number`, `screen_type` e.g., IMAX, 4DX, Dolby).
4. **`seats`**: Physical seats in a screen (`id`, `screen_id`, `row_label`, `seat_number`, `tier_type`).
5. **`movies`**: Catalog of films (`id`, `title`, `genre`, `duration_mins`, `rating`, `poster_url`, `actors`, `hype_count`).
6. **`shows`**: Scheduled screenings (`id`, `movie_id`, `screen_id`, `start_time`, `end_time`, `base_price`).
7. **`show_seats`**: State of each seat for a specific show (`id`, `show_id`, `seat_id`, `status: AVAILABLE|HELD|BOOKED`, `held_until`, `version`).
8. **`bookings`**: Confirmed reservations (`id`, `pnr_code`, `user_id`, `show_id`, `total_amount`, `status: CONFIRMED|CANCELLED`).
9. **`booking_seats`**: Links which seats belong to which booking.
10. **`payments`**: Payment transaction record (`id`, `booking_id`, `amount`, `payment_method`, `status: PENDING_COUNTER|PAID`).
11. **`audience_demands` & `demand_votes`**: Crowd-sourced re-release movie requests and user votes.

---

## 6. Detailed Code Walkthrough (File by File)

### 📄 `backend/src/server.js` (The Server Ignition)
```javascript
import app from './app.js';
import { testConnection } from './config/db.js';
import { runMigrations } from './db/migrate.js';
```
* **Lines 1–15:** Imports Express app and database helpers. Reads the port from `process.env.PORT` (defaults to 5000).
* **`startServer()` function:**
  1. Calls `await testConnection()`: Verifies that our Neon PostgreSQL database is reachable.
  2. Calls `await runMigrations()`: Automatically checks if any SQL migrations are missing and executes them on startup.
  3. Calls `startHoldSweeper()`: Starts a timer that wakes up every 30 seconds to clean up expired seat holds.
  4. Calls `app.listen(PORT)`: Opens the port and starts listening for HTTP traffic from the web.

---

### 📄 `backend/src/app.js` (The Middlewares & Routing)
```javascript
app.use(helmet()); // Adds security headers (prevents XSS, clickjacking)
```
* **CORS Whitelist (Lines 22–45):**
  Reads `CLIENT_ORIGIN` (e.g. `https://seat-lock-alpha.vercel.app`). Automatically parses comma-separated origins and strips trailing slashes so your frontend can communicate with the backend without CORS blocks.
* **Rate Limiter (Line 59):**
  Uses `express-rate-limit` to limit excessive requests per IP, preventing bot scrapers and brute-force attacks.
* **Routes (Lines 70–82):**
  Mounts application modules:
  - `/api/auth`: Login, Registration, JWT verification.
  - `/api/movies`: Film catalog, reviews, hype counts.
  - `/api/shows` & `/api/bookings`: Seat locking and booking confirmations.
  - `/api/demands`: Crowd-sourced movie voting.
  - `/api/admin`: Administrative dashboard controls.
  *(Also aliases them to root `/` for fail-safe compatibility).*

---

### 📄 `backend/src/config/db.js` (The Database Connection Pool)
```javascript
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }, // Required for Neon Cloud SSL
  max: 20,                            // Up to 20 concurrent connections
  idleTimeoutMillis: 30000,
});
```
* Creates a shared `pg.Pool`.
* Exports a `query(text, params)` helper that records query execution time. If any query takes longer than 100ms in development, it logs a `[SLOW QUERY]` warning for optimization.

---

### 📄 `backend/src/modules/bookings/bookings.controller.js` (The Core Engine)

#### Function 1: `holdSeats` (Atomic Pessimistic Lock)
```javascript
export const holdSeats = async (req, res, next) => {
  const showId = parseInt(req.params.id, 10);
  const seatIds = [...req.validated.body.seatIds].sort((a, b) => a - b); // 1. SORT SEAT IDS
```
* **Step 1: Enforce Sort Order:** `.sort((a, b) => a - b)` ensures all requests lock seats in numeric sequence (prevents deadlocks).
* **Step 2: `BEGIN` Transaction:** `await client.query('BEGIN')`.
* **Step 3: `SELECT ... FOR UPDATE`:**
  ```sql
  SELECT ss.id, ss.status, ss.held_until 
  FROM show_seats ss
  WHERE ss.show_id = $1 AND ss.seat_id = ANY($2::int[])
  ORDER BY ss.seat_id ASC
  FOR UPDATE;
  ```
  PostgreSQL locks those exact rows. No other request can touch them.
* **Step 4: Availability Check:** Loops over the locked rows. If any seat is `BOOKED`, or `HELD` with a valid timer, the transaction executes `ROLLBACK` and returns `409 Conflict`.
* **Step 5: Hold Update:** Updates status to `HELD` and calls `COMMIT`.

#### Function 2: `confirmBooking` (Booking & E-Ticket Generation)
```javascript
export const confirmBooking = async (req, res, next) => {
```
* **Step 1:** Verifies the user and seats. Starts a transaction (`BEGIN`).
* **Step 2:** Locks the seats with `FOR UPDATE` to verify they belong to this user.
* **Step 3:** Updates status to `BOOKED`.
* **Step 4: Generate PNR:** Creates a unique booking code using `crypto.randomBytes(4).toString('hex').toUpperCase()` -> `SL-C8950EDB`.
* **Step 5:** Inserts rows into `bookings`, `booking_seats`, and `payments` (status `PENDING_COUNTER`).
* **Step 6: `COMMIT`:** Changes are permanently saved.
* **Step 7: Async Email Dispatch:** Calls `sendBookingConfirmationEmail(...)` in the background with the movie name, showtime, screen, seats, and PNR.

---

### 📄 `backend/src/services/emailService.js` (The Email Engine)
```javascript
export const sendBookingConfirmationEmail = async ({ customerEmail, bookingData }) => {
```
* Connects to Google's SMTP servers using TLS and a secure 16-character App Password.
* Generates a modern HTML email featuring:
  - Cinema branding with Gold & Purple gradients.
  - A highlighted PNR box (`SL-XXXXXXXX`).
  - Screen number, date, time, and seat labels.
  - Box office payment instructions: *"Please present this PNR at the counter at least 15 minutes before showtime."*
* Dispatches the email. If the customer's email is invalid, it catches the error safely without crashing the booking flow.

---

### 📄 `backend/src/modules/admin/admin.controller.js` (Show Cancellation Cascade)
```javascript
export const cancelShow = async (req, res, next) => {
```
* When an admin cancels a scheduled screening:
* **Step 1:** Queries all ticket holders for that show:
  ```sql
  SELECT b.id, b.pnr_code, b.customer_email, m.title, sh.start_time
  FROM bookings b ... WHERE b.show_id = $1
  ```
* **Step 2:** Deletes all related `payments`, `booking_seats`, `bookings`, and `show_seats` inside an atomic transaction.
* **Step 3:** Deletes the show itself.
* **Step 4:** Iterates through every booked customer and calls `sendBookingCancellationEmail(...)`, informing them of the cancellation.

---

### 📄 `frontend/src/components/SeatMap.jsx` (Interactive Cinema UI)
* Renders the visual cinema layout:
  - **Screen Area:** Top curved glowing banner representing the theater screen.
  - **Seat Grid:** Displays rows categorized by tier:
    - 👑 VIP Recliner (Top rows, premium leather styling)
    - ⭐ Premium (Middle rows)
    - 💺 Standard (Front rows)
* **Live Color Coding:**
  - 🟢 Green: Selected by the current user.
  - ⚪ White/Slate: Available to book.
  - 🔴 Red: Already booked by someone else.
  - 🟡 Amber: Currently held by another user.
* Enforces cinema rules: Max 6 seats per transaction.

---

### 📄 `frontend/src/components/CheckoutModal.jsx` (Reservation Modal)
* Shows ticket summary: Movie title, theater, screen, showtime, seat labels, and total price.
* Shows the mandatory counter rule banner:
  > *"Payment must be completed at the cinema counter at least 15 minutes before the show begins."*
* Captures Customer Full Name and Email Address.
* On form submit, locks the buttons, displays a loading spinner (*"Locking Seats & Sending E-Ticket..."*), calls `POST /api/bookings/confirm`, and displays the final Cinema PNR voucher.

---

## 7. Top 10 Interview Questions & Plain-English Answers

If an interviewer asks about this project, here is how to explain it with confidence:

### Q1: "Why did you build SeatLock?"
> *"I wanted to build a real-world system that solves the hardest problem in ticketing: high-concurrency race conditions. During major movie releases, thousands of users compete for the exact same seats at the exact same millisecond. I designed SeatLock to guarantee zero double bookings and zero deadlocks using PostgreSQL ACID transactions and pessimistic locking."*

### Q2: "Why did you use PostgreSQL instead of MongoDB?"
> *"Seat reservation is fundamentally relational and requires strict ACID compliance. MongoDB uses document-level locking, which makes multi-row atomic operations across screens, shows, and seats complex and prone to conflicts. PostgreSQL provides native `SELECT ... FOR UPDATE` row-level locks, foreign keys, and serializable transactions, making it the industry standard for financial and reservation engines."*

### Q3: "What is a race condition, and how does your code stop it?"
> *"A race condition happens when two requests read that a seat is available at the same time and both write a reservation. I prevent this using PostgreSQL's pessimistic row-level locking (`SELECT ... FOR UPDATE`). When User A requests a seat, the database places an exclusive lock on that row. User B's request is forced to wait until User A's transaction completes. When User B finally reads the row, it sees the seat is already taken and is cleanly rejected with a 409 Conflict."*

### Q4: "How do you prevent database deadlocks?"
> *"Deadlocks occur when two transactions acquire locks in opposing order (e.g., User A locks Seat 1 then wants Seat 2; User B locks Seat 2 then wants Seat 1). I eliminated this by enforcing deterministic sorting: all seat IDs are sorted numerically (`[1, 2]`) before acquiring locks. Because every transaction acquires locks in the exact same sequence, deadlocks are mathematically impossible."*

### Q5: "How does the system handle high traffic spikes (500+ users)?"
> *"Through three layers of protection: First, API rate limiting using `express-rate-limit` prevents bot scalping and brute-force flooding. Second, a PostgreSQL connection pool (`pg.Pool`) reuses a pool of active database connections, preventing socket exhaustion. Third, our database queries are tuned with indexes on `show_id` and `seat_id`, maintaining sub-500ms response latency."*

### Q6: "What happens if a user books a ticket but never pays?"
> *"We implemented a Pay-at-Counter reservation model. Every reservation is issued a unique PNR code sent to their email. Cinema counter rules require payment to be collected at least 15 minutes before showtime. If unclaimed, theater management can cancel or re-release the seats directly from the Admin Panel."*

### Q7: "What happens when an admin cancels a scheduled movie show?"
> *"The backend executes a cascading cancellation transaction: it locks the show, retrieves all customer emails associated with active bookings, deletes all payment and ticket records atomically, and dispatches automated cancellation emails to all affected ticket holders via SMTP."*

### Q8: "How does the Audience Movie Demand feature work?"
> *"It's a crowd-sourced re-release voting engine. Fans can search for classic or cult films and upvote them. The system maintains a dynamic leaderboard (`🏆 #1 Top Voted`, `🥈 #2`, etc.). When an admin greenlights a top-voted title, the movie is added to the active theater schedule and shows are opened for booking."*

### Q9: "How is user authentication handled?"
> *"Using JSON Web Tokens (JWT) and Bcrypt password hashing with 12 salt rounds. When a user registers or logs in, the backend signs a secure JWT containing their user ID and role (`CUSTOMER` or `ADMIN`). The frontend attaches this token to the `Authorization: Bearer <token>` header for protected routes."*

### Q10: "Where is the application deployed?"
> *"The frontend is deployed as a single-page application on Vercel with automated SPA route rewrites. The backend is deployed as a Web Service on Render with environment variables for database credentials and SMTP. The database is hosted on Neon Cloud PostgreSQL with automated migrations on boot."*

# Booking System

## Problem Statement

We need a simple booking system where multiple users can book seats concurrently.  
The system must ensure:

1. Only **100 seats** are available in total.  
2. Users cannot overbook (no double allocation).  
3. Concurrent booking requests are handled safely.  
4. The system provides clear booking status (success or failure).  

---

## Requirements

### Functional

- Users can book seats.  
- Maximum seats = 100.  
- No double booking for the same seat or user.  
- Show available seats in real time.  

### Non-Functional

- Handle high concurrency (many users booking at the same time).  
- Ensure consistency (no two users can book the same seat twice).  
- Fast response and scalable architecture.  

---

## Architecture

``` text
[Frontend / App]
     |
     v
[API Gateway / Backend Service] -- (Business Logic: Booking Service)
     |
     +--> [Database: MySQL / PostgreSQL]  <-- Store seat availability & bookings
     |
     +--> [Cache: Redis] (optional, fast availability check)
     |
     +--> [Pub/Sub: Redis] (push seat updates -> frontend)

Frontend: web / mobile UI for availability & booking requests.  
Backend: validates requests, ensures concurrency with DB transactions or locks.  
DB: persistent booking records + seat availability (system_status).  
Cache: for fast reads / counters.  
Pub/Sub: broadcasts seat updates via SSE/WebSocket.  
```
## Flow

User sends a booking request (POST /book) with their userId.
==============================================================

Backend checks availability in DB (row-level lock or atomic decrement).
--------------------------------------------------------------

If a seat is available:

* Decrement count.
* Insert booking record.
* Confirm success.

Otherwise return failure (Sold Out).

## Data Model

``` sql
CREATE TABLE system_status (
  id INT PRIMARY KEY,
  available_seats INT NOT NULL
);

-- initialize with 100 seats
INSERT INTO system_status (id, available_seats) VALUES (1, 100);

CREATE TABLE bookings (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) UNIQUE,
  booked_at TIMESTAMP DEFAULT NOW()
);

```
## Frontend Example

``` typescript
class BookingAPI {
  async bookSeat(userId: string): Promise<any> {
    const res = await fetch("/book", {
      method: "POST",
      body: JSON.stringify({ userId }),
      headers: { "Content-Type": "application/json" }
    });
    return res.json();
  }

  async getStatus(userId: string): Promise<any> {
    const res = await fetch(`/bookings/${userId}`);
    return res.json();
  }
}

```

## Booking Logic (Concurrency Safe)

### Backend Service (TypeScript) with  Pessimistic Locking (MySQL)

```typescript

class BookingService {
  constructor(private db) {}

  async bookSeat(userId: string): Promise<string> {
    return this.db.transaction(async (tx) => {
      const [seatStatus] = await tx.query(
        "SELECT available_seats FROM system_status WHERE id = 1 FOR UPDATE"
      );

      if (seatStatus.available_seats <= 0) {
        throw new Error("Sold Out");
      }

      const alreadyBooked = await tx.query(
        "SELECT 1 FROM bookings WHERE user_id = ?",
        [userId]
      );
      if (alreadyBooked.length > 0) {
        throw new Error("Already Booked");
      }

      await tx.query(
        "UPDATE system_status SET available_seats = available_seats - 1 WHERE id = 1"
      );
      await tx.query("INSERT INTO bookings (user_id) VALUES (?)", [userId]);

      return "Booking Successful";
    });
  }
}
```

## SSE Server (Node + Express + Redis Pub/Sub)

```typescript
// server.js
const express = require("express");
const redis = require("redis");
const app = express();
app.use(express.json());

const redisPub = redis.createClient();
const redisSub = redis.createClient();

app.get("/events", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.flushHeaders();

  const onMessage = (_, message) => {
    res.write(`data: ${message}\n\n`);
  };

  redisSub.subscribe("seat_updates");
  redisSub.on("message", onMessage);

  req.on("close", () => {
    redisSub.unsubscribe("seat_updates");
    redisSub.removeListener("message", onMessage);
    res.end();
  });
});

// broadcast updates after DB changes
function broadcastAvailability(count) {
  const payload = JSON.stringify({ type: "availability", available: count });
  redisPub.publish("seat_updates", payload);
}

```

## Error Handling


- Seats unavailable → "Sold Out"

- Duplicate booking attempt → "Already Booked"

- Transaction/DB failure → "Try again later"


## Trade-offs

**Pessimistic Locking** → Simple, safe, but lower throughput under very high concurrency.

**Queue-based** → Scalable, adds slight latency.

**In-memory counter (Redis)** → Fast, but needs persistence to avoid inconsistencies.


## Future Improvements

- Add payment flow (reserve seat → confirm after payment).

- Implement waiting list if seats are full.

- Add analytics for seat usage trends.

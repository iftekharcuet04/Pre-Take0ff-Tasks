# Booking System
## Problem Statement

We need a simple booking system where multiple users can book seats concurrently.
The system must ensure:

1. Only 100 seats are available in total.

2. Users should not be able to overbook (no double allocation).

3. Concurrent booking requests should be handled safely.

4. The system should provide clear booking status (success or failure).




## Requirements

### Functional Requirements

* Users can book seats.
* Maximum seats = 100.
* Users cannot overbook.
* Show available seats in real-time.

### Non-Functional Requirements

* Handle high concurrency (many users booking at the same time).
* Ensure consistency (no two users can book the same seat twice).
* Fast response and scalable.



## Architecture

``` text
[Frontend / App]
     |
     v
[API Gateway / Backend Service] -- (Business Logic: Booking Service)
     |
     +--> [Database: MySQL / PostgreSQL]  <-- Store seat availability & bookings
     |
     +--> [Cache: Redis] (Optional, for fast availability check)
     |
     +--> [Pub/Sub: Redis] (push seat updates -> frontend)

Frontend: web / mobile UI to view availability & request bookings.

API/Backend: booking service (validates requests, ensures concurrency with DB transactions or locks).

DB: persistent booking records + system_status (available_seats).

Cache: for fast reads/ counters.

Pub/Sub: to broadcast seat-count updates to connected frontends (used by SSE / WebSocket).

```

## Flow

### User Request

A user sends a booking request to the backend (POST /book).

Request contains user ID (or session info).

### API Backend

Booking Service receives the request.

It interacts with the database to check available seats.

Uses row-level locking or atomic decrement to ensure concurrency safety.

If seats are available, it allocates and confirms booking.

If not, returns failure (Sold Out).



## Data Model

``` sql
CREATE TABLE seats (
  id SERIAL PRIMARY KEY,
  is_booked BOOLEAN DEFAULT FALSE,
  booked_by VARCHAR(255),
  booked_at TIMESTAMP
);


CREATE TABLE bookings (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255),
  seats_booked INT,
  booked_at TIMESTAMP DEFAULT NOW()
);
```

## Forntend

``` typescript
class BookingAPI {
  async bookSeat(userId: string): Promise<void> {
    const res = await fetch("/book", { method: "POST", body: JSON.stringify({ userId }) });
    return res.json();
  }

  async getStatus(userId: string): Promise<void> {
    const res = await fetch(`/bookings/${userId}`);
    return res.json();
  }
}
```


## Booking Logic (Concurrency Safe)

Pessimistic Locking (MySQL Example)
``` sql
BEGIN;
SELECT available_seats FROM system_status WHERE id = 1 FOR UPDATE;

-- If available
IF available_seats > 0 THEN
  UPDATE system_status SET available_seats = available_seats - 1 WHERE id = 1;
  INSERT INTO bookings (user_id) VALUES (:userId);
END IF;

COMMIT;
```

## Backend Service Example (TypeScript)


``` typescript
class BookingService {
  constructor(private db) {}

  async bookSeat(userId: string): Promise<string> {
    return this.db.transaction(async (tx) => {
      const seatStatus = await tx.query(
        "SELECT available_seats FROM system_status WHERE id=1 FOR UPDATE"
      );

      if (seatStatus.available_seats <= 0) {
        throw new Error("Sold Out");
      }

      const alreadyBooked = await tx.query(
        "SELECT * FROM bookings WHERE user_id = ?",
        [userId]
      );
      if (alreadyBooked.length > 0) {
        throw new Error("Already Booked");
      }

      await tx.query(
        "UPDATE system_status SET available_seats = available_seats - 1 WHERE id=1"
      );
      await tx.query("INSERT INTO bookings (user_id) VALUES (?)", [userId]);

      return "Booking Successful";
    });
  }
}



class BookingService {
  constructor(private db) {}

  async bookSeat(userId: string): Promise<string> {
    return this.db.transaction(async (tx) => {
      const seatStatus = await tx.query(
        "SELECT available_seats FROM system_status WHERE id=1 FOR UPDATE"
      );

      if (seatStatus.available_seats <= 0) {
        throw new Error("Sold Out");
      }

      const alreadyBooked = await tx.query(
        "SELECT * FROM bookings WHERE user_id = ?",
        [userId]
      );
      if (alreadyBooked.length > 0) {
        throw new Error("Already Booked");
      }

      await tx.query(
        "UPDATE system_status SET available_seats = available_seats - 1 WHERE id=1"
      );
      await tx.query("INSERT INTO bookings (user_id) VALUES (?)", [userId]);

      return "Booking Successful";
    });
  }
}
``` 


## SSE server example (Node + Express + Redis pub/sub)

Simplified example — server publishes seat updates to a Redis channel; the endpoint streams them to clients.

``` typescript
// server.js (Node/Express)
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

  const onMessage = (channel, message) => {
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

// elsewhere in booking flow, after updating DB:
function broadcastAvailability(count) {
  const payload = JSON.stringify({ type: "availability", available: count });
  redisPub.publish("seat_updates", payload);
}

```



### Error Handling

*   Seats unavailable → "Sold Out".
*   Duplicate booking attempt → "Already Booked".
*   Transaction/DB failure → "Try again later".


### Trade-offs



#### Pessimistic Locking

Simpler, safe, but may limit throughput under very high concurrency.


### Queue-based

Scalable, but adds slight latency.

### In-memory counter

Fast, but needs Redis for persistence to avoid inconsistency.


### Future Improvements

*   Add payment flow (reserve seat → confirm after payment).
*   Add waiting list if seats are full.
*   Add analytics for seat usage trends.




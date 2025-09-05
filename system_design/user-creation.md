# System Design: CSV User Import with Auth-Backend
## Problem Statement

We need a system where:

1. Frontend uploads a CSV of users.
2. Backend parses the CSV, validates rows, removes duplicates, and enqueues valid users.
3. Auth-Backend only supports one user creation at a time.
4. Backend Worker processes jobs sequentially, calling Auth-Backend, then sends a welcome email if creation succeeds.
5. System must handle duplicates and log errors.(optional)


## Architecture

[Frontend]
   |
   | 1) POST /uploads (CSV)
   v
[API Backend]
   - Upload Service
   - CSV Parser & Validator
   - Deduper (batch + historical)
   - Enqueuer
   - Status API
   - DB (uploads, staging, jobs, results, errors)
   - Queue (e.g., Redis-backed)
   |
   | Jobs (one-by-one)
   v
[Worker Service] --(concurrency=1)--> [Auth-Backend]
        |                                   |
        +--(on success)--> [Email Service]  |
        |                                   |
        +--> [Logs + Metrics + Traces] <----+




## Data Model

```sql
table uploads (
  id uuid pk,
  filename text,
  uploaded_by text,
  created_at timestamp,
  status text check in ('PENDING','PROCESSING','COMPLETED','FAILED'),
  totals jsonb
);

table staged_users (
  id uuid pk,
  upload_id uuid fk -> uploads(id),
  raw_row_number int,
  email text,
  name text,
  normalized_email text,
  validation_errors text[],
  status text check in ('PENDING','DUPLICATE_IN_BATCH','DUPLICATE_HISTORICAL','VALID','SKIPPED'),
  unique(upload_id, normalized_email)
);

table jobs (
  id uuid pk,
  upload_id uuid,
  normalized_email text,
  payload jsonb,
  idempotency_key text,
  status text check in ('ENQUEUED','IN_PROGRESS','SUCCEEDED','FAILED','DLQ'),
  attempts int default 0,
  last_error text,
  created_at timestamp,
  updated_at timestamp
);

table job_events (
  id uuid pk,
  job_id uuid,
  upload_id uuid,
  event_type text,
  level text,
  message text,
  context jsonb,
  created_at timestamp
);

table users_index (
  normalized_email text pk,
  first_seen_upload uuid,
  created_at timestamp
);
```

## Flow

### Upload & Parse



1. Normalize and validate email.
2. Remove intra-batch duplicates.
3. Skip historical duplicates (users_index).
4. Enqueue only valid unique users as jobs.

### Worker (Single Concurrency)

1. Pick one job at a time.
2. Call Auth-Backend with Idempotency-Key.
3. On success → mark job complete → send welcome email.
4. On conflict (409) → treat as success but log.
5. On error → retry with exponential backoff, else move to DLQ.
6. Log every event in job_events.


## Pseudocode
### Frontend

``` typescript
async function uploadCsv(file) {
  const formData = new FormData();
  formData.append('file', file);
  const { uploadId } = await fetch('/uploads', { method: 'POST', body: formData }).then(r => r.json());

  const poll = setInterval(async () => {
    const s = await fetch(`/uploads/${uploadId}/status`).then(r => r.json());
    updateProgressUI(s.totals);
    if (s.status === 'COMPLETED' || s.status === 'FAILED') clearInterval(poll);
  }, 2000);
}

```

### Backend — Upload Endpoint

``` typescript

POST /uploads
  const uploadId = uuid()
  db.insert('uploads', { id: uploadId, filename, uploaded_by, status: 'PENDING', totals: {} })

  let seen = new Set<string>()
  let counts = initCounts()

  for (const row of parseCSV(fileStream)) {
    const normalized_email = normalizeEmail(row.email)
    const errors = validateRow(row)

    if (errors.length) {
      db.insert('staged_users', { upload_id: uploadId, raw_row_number: row.idx, ...row, normalized_email, validation_errors: errors, status: 'PENDING' })
      logEvent(null, uploadId, 'VALIDATION_ERROR', 'WARN', 'Row failed validation', { rowNumber: row.idx, errors })
      counts.invalid++
      continue
    }

    if (seen.has(normalized_email)) {
      db.insert('staged_users', { upload_id: uploadId, raw_row_number: row.idx, ...row, normalized_email, status: 'DUPLICATE_IN_BATCH' })
      counts.duplicate_in_batch++
      continue
    }
    seen.add(normalized_email)

    if (db.exists('users_index', { normalized_email })) {
      db.insert('staged_users', { upload_id: uploadId, raw_row_number: row.idx, ...row, normalized_email, status: 'DUPLICATE_HISTORICAL' })
      counts.duplicate_historical++
      continue
    }

    const jobId = uuid()
    const key = sha256(uploadId + ':' + normalized_email)
    db.insert('jobs', { id: jobId, upload_id: uploadId, normalized_email, payload: minimalPayload(row), idempotency_key: key, status: 'ENQUEUED' })
    enqueue('userCreationQueue', { jobId })
    counts.enqueued++
  }

  db.update('uploads', { id: uploadId }, { status: 'PROCESSING', totals: counts })
  return { uploadId }

```

### Worker

``` typescript
worker("userCreationQueue", { concurrency: 1 }, async (msg) => {
  const job = db.get('jobs', { id: msg.jobId })
  if (!job || job.status in ['SUCCEEDED','DLQ']) return

  try {
    db.update('jobs', { id: job.id }, { status: 'IN_PROGRESS' })

    const res = await http.post(AUTH_URL + '/users', job.payload, {
      headers: { 'Idempotency-Key': job.idempotency_key },
      timeoutMs: 8000
    })

    if (res.status === 201) {
      db.upsert('users_index', { normalized_email: job.normalized_email }, { first_seen_upload: job.upload_id, created_at: now() })
      db.update('jobs', { id: job.id }, { status: 'SUCCEEDED' })
      logEvent(job.id, job.upload_id, 'AUTH_201_CREATED', 'INFO', 'User created', { email: job.payload.email })
      await trySendEmail(job)
    }
    else if (res.status === 409) {
      db.update('jobs', { id: job.id }, { status: 'SUCCEEDED', last_error: 'AUTH_409_EXISTS' })
      logEvent(job.id, job.upload_id, 'AUTH_409_EXISTS', 'WARN', 'User already exists', { email: job.payload.email })
    }
    else throw new Error(`Unexpected status ${res.status}`)

  } catch (err) {
    const attempts = job.attempts + 1
    db.update('jobs', { id: job.id }, { attempts, last_error: err.message })

    if (attempts < 5) {
      requeue('userCreationQueue', { jobId: job.id }, backoff(attempts))
      logEvent(job.id, job.upload_id, 'RETRY', 'WARN', 'Retrying job', { attempts, error: err.message })
    } else {
      db.update('jobs', { id: job.id }, { status: 'DLQ' })
      logEvent(job.id, job.upload_id, 'DLQ', 'ERROR', 'Moved to dead-letter queue', { error: err.message })
    }
  }
})

```

### Auth-Backend

``` typescript
POST /users
  const key = req.headers['Idempotency-Key']
  if (kv.exists('idem:' + key)) return kv.get('idem:' + key)

  if (processing) return 503
  processing = true
  try {
    const { email, name } = req.body
    const norm = normalizeEmail(email)

    if (db.exists('auth_users', { normalized_email: norm })) {
      const resp = { status: 409 }
      kv.set('idem:' + key, resp, ttl=24h)
      return resp
    }

    db.insert('auth_users', { normalized_email: norm, name })
    const resp = { status: 201, body: { id: uuid(), email } }
    kv.set('idem:' + key, resp, ttl=24h)
    return resp
  } finally {
    processing = false
  }
```

# Error Handling

## Validation Errors

Logged per row.

## Duplicate Emails

Skipped with `DUPLICATE_IN_BATCH` or `DUPLICATE_HISTORICAL`.

## Auth 409

Treated as success (idempotent).

## Network/Timeouts

Retried with backoff; moved to DLQ after N attempts.

## Email Failures

Logged separately; optional retry queue.

# Logging & Observability

## Structured Logs

With `upload_id`, `job_id`, `normalized_email`.

## Metrics

Job success/failure, retries, DLQ depth, auth latency.

## Traces

Correlation IDs across services.

## Audit Logs

Persisted in `job_events`.

# Tradeoffs

## Queue + Single Concurrency

Chosen because Auth-Backend can only process one user at a time.

## Idempotency-Key

Prevents duplicate creations.

## Dead-Letter Queue

Ensures failed jobs don’t block others.

## Separate Email Retry

Prevents blocking user creation flow.

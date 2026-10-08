# Running your own database (self-hosted)

Luxus needs three data stores: **MongoDB** (everything - businesses, users,
conversations, WhatsApp sessions), **Redis** (fast, disposable session cache -
optional, falls back to in-memory), and **ChromaDB** (vector search for the
knowledge base - optional, falls back to plain text search).

The easiest way to run all three yourself is Docker Compose - one command,
no separate installs, and it matches exactly what `docker-compose.yml` in
this repo already expects.

## Option A: Docker Compose (recommended)

1. Install [Docker Desktop](https://www.docker.com/products/docker-desktop/)
   (Windows/Mac) or Docker Engine (Linux).
2. Generate your secrets and fill in `.env` (see main README) - Docker Compose
   still reads `.env` for everything except the four values it overrides
   itself (`MONGODB_URI`, `REDIS_HOST`, `REDIS_PORT`, `CHROMA_HOST`,
   `CHROMA_PORT` - these point at the *other containers*, not `localhost`,
   which only makes sense inside Docker's own network).
3. From the project root:
   ```bash
   docker compose up -d mongodb redis chromadb
   ```
   This starts just the three data stores, so you can still run `npm run dev`
   for the API itself (faster iteration, real error output in your terminal).
   Data persists in Docker volumes (`mongodb_data`, `chroma_data`) across restarts.
4. Or run everything, API included, in containers:
   ```bash
   docker compose up -d
   ```
5. Check it's up: `docker compose ps` should show all three (or four)
   containers as `running`. `docker compose logs -f mongodb` if one won't start.
6. To stop: `docker compose down` (keeps your data). To wipe all data and
   start clean: `docker compose down -v`.

Your existing `MONGODB_URI` in `.env` (e.g. `mongodb://localhost:27017/luxus`)
works fine for step 3 (API on your host machine, database in Docker, exposed
on `localhost:27017`). Step 4 overrides it automatically since the whole
stack runs inside the same Docker network.

## Option B: Install MongoDB directly (no Docker)

If you'd rather not use Docker:

- **Windows/Mac/Linux**: follow MongoDB's own install guide for your OS
  (search "install MongoDB Community Server" - it changes by version, so
  the exact steps aren't worth pinning here). Once installed, it runs on
  `localhost:27017` by default, matching this project's default
  `MONGODB_URI`.
- Redis and ChromaDB are optional in this mode - if you skip them, sessions
  fall back to in-memory (fine for one server process; lost on restart) and
  the knowledge base falls back to plain-text search (works, just less smart
  about paraphrased questions).

## Verifying it's actually connected

```bash
npm run dev
```
Look for `✅ Connected to MongoDB` in the startup logs. If you see a
connection error instead, the most common causes are: Docker containers not
actually running yet (`docker compose ps`), a typo in `MONGODB_URI`, or (on
Docker) using `localhost` instead of the service name from step 4 above.

## A note on your hardware

On a lower-RAM machine, MongoDB + Redis + ChromaDB together in Docker use
roughly 300-500MB of RAM at idle. If that's tight, running MongoDB alone
(skip Redis and ChromaDB - both are optional, as noted above) cuts that to
roughly 150-200MB, at the cost of the fallback behavior described above.

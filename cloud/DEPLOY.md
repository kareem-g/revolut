# Free-tier deployment notes

| Service | Free tier used | Notes |
|---|---|---|
| Vercel Hobby | hosting + serverless functions | non-commercial use |
| Neon | Postgres, 0.5 GB | copies with the connection string |

## Local end-to-end test (no cloud account needed)

```bash
docker run -d --name powerk-pg -e POSTGRES_PASSWORD=powerk -e POSTGRES_DB=powerk -p 55432:5432 postgres:16-alpine
cd cloud && DATABASE_URL="postgres://postgres:powerk@localhost:55432/powerk" npm install && npm run build && npm start
# in another terminal:
node ../bridge/bridge.js   # pair via the dashboard first
# provision a strip (or the test fake) to this machine's IP:10086
```

## Upgrade paths

- Point a hostname at the bridge and provision strips with it — the bridge IP is stored in
  the strip, so use a static IP (Fly.io static IPv4, ~$2/mo) if the bridge moves to the cloud.
- Vercel Hobby is free for non-commercial use; commercial use needs Pro.

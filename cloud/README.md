# powerk cloud

Production server for powerk: multi-user, hosted free (Vercel Hobby + Neon free tier).
The mobile app's **Server mode** points at this — same API shapes as powerk.py, plus accounts.

## Deploy (free, ~10 minutes)

1. **Database** — create a project at [neon.tech](https://neon.tech) (free, no card) and copy
   the connection string (`postgres://…?sslmode=require`).
2. **Deploy** — push this repo, then in Vercel: *Add New Project* → root directory `cloud`.
   Add the env var `DATABASE_URL` with the Neon string. Deploy.
3. **Use** — open the deployment URL, create an account, and either:
   - **Pair a bridge** (recommended): click *Pair a new bridge*, then on the always-on home
     device run `npx powerk-bridge --pair CODE --url https://your-app.vercel.app`.
   - Or paste the **API token** (shown on the dashboard) into the mobile app:
     Settings → Mode → Server, host = your deployment host, port `443`, token = the token.

Strips that dial a paired bridge are claimed automatically — no MAC typing.

## What runs where

| Where | What |
|---|---|
| Vercel | auth, users, REST API (same shapes as powerk.py), dashboard, readings/history |
| Bridge (home, Node) | strip TCP session on 10086, command relay, **schedules + voltage rules** (runs even if the cloud is briefly unreachable) |

The bridge dials out only — nothing to open on the user's router.

## Local development

```bash
DATABASE_URL="postgres://…" npm run dev   # any Postgres (see docker in cloud/DEPLOY.md)
```

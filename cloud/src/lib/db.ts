import postgres from "postgres";

// One pooled client per lambda instance. DATABASE_URL points at Neon (free
// tier) or any Postgres; sslmode is in the URL.
declare global {
  // eslint-disable-next-line no-var
  var __sql: postgres.Sql | undefined;
}

export const sql: postgres.Sql =
  globalThis.__sql ??
  postgres(process.env.DATABASE_URL ?? "", {
    max: 5,
    idle_timeout: 20,
    prepare: false, // serverless-safe
  });

if (process.env.NODE_ENV !== "production") globalThis.__sql = sql;

let migrated = false;

/** Idempotent schema — runs once per instance, safe to call before any query. */
export async function ensureSchema(): Promise<void> {
  if (migrated) return;
  await sql`
    create table if not exists users (
      id uuid primary key default gen_random_uuid(),
      email text unique not null,
      pw_hash text not null,
      api_token text unique not null,
      currency text not null default '$',
      per_kwh numeric not null default 0,
      created timestamptz not null default now()
    )`;
  await sql`
    create table if not exists sessions (
      token text primary key,
      user_id uuid not null references users(id) on delete cascade,
      created timestamptz not null default now()
    )`;
  await sql`
    create table if not exists bridges (
      id uuid primary key default gen_random_uuid(),
      user_id uuid not null references users(id) on delete cascade,
      token text unique,
      pair_code text unique,
      public_ip text,
      last_seen timestamptz,
      created timestamptz not null default now()
    )`;
  // a bridge row is created by the dashboard (pair code only) and gets its
  // token when the bridge redeems the code
  await sql`alter table bridges alter column token drop not null`.catch(() => undefined);
  await sql`alter table bridges alter column pair_code drop not null`.catch(() => undefined);
  await sql`
    create table if not exists strips (
      mac text primary key,
      user_id uuid not null references users(id) on delete cascade,
      bridge_id uuid references bridges(id) on delete cascade,
      name text,
      model text,
      fw text,
      online boolean not null default false,
      last_seen timestamptz,
      payload jsonb
    )`;
  await sql`
    create table if not exists outlet_names (
      mac text not null references strips(mac) on delete cascade,
      outlet int not null,
      name text not null,
      primary key (mac, outlet)
    )`;
  await sql`
    create table if not exists schedules (
      id uuid primary key default gen_random_uuid(),
      mac text not null references strips(mac) on delete cascade,
      outlet int not null,
      turn_on boolean not null,
      time text not null,
      days int[] not null default '{}',
      created timestamptz not null default now()
    )`;
  await sql`
    create table if not exists voltage_rules (
      id uuid primary key default gen_random_uuid(),
      mac text not null references strips(mac) on delete cascade,
      outlet int not null default 0,
      op text not null,
      volts int not null,
      action text not null,
      created timestamptz not null default now()
    )`;
  await sql`
    create table if not exists commands (
      id uuid primary key default gen_random_uuid(),
      mac text not null,
      outlet int not null,
      turn_on boolean not null,
      status text not null default 'pending',
      created timestamptz not null default now()
    )`;
  await sql`
    create table if not exists readings (
      mac text not null,
      day date not null,
      kwh numeric not null,
      primary key (mac, day)
    )`;
  migrated = true;
}

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { sql, ensureSchema } from "@/src/lib/db";
import Dashboard from "./DashboardClient";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  await ensureSchema();
  const token = (await cookies()).get("pk_session")?.value;
  if (!token) redirect("/");
  const rows = await sql`
    select u.id, u.email, u.api_token from sessions s join users u on u.id = s.user_id
    where s.token = ${token}`;
  if (rows.length !== 1) redirect("/");
  return <Dashboard email={rows[0].email} apiToken={rows[0].api_token} />;
}

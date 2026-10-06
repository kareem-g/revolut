import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { sql, ensureSchema } from "@/src/lib/db";
import AuthForm from "./AuthForm";

export const dynamic = "force-dynamic";

export default async function Home() {
  await ensureSchema();
  const token = (await cookies()).get("pk_session")?.value;
  if (token) {
    const rows = await sql`select user_id from sessions where token = ${token}`;
    if (rows.length === 1) redirect("/dashboard");
  }
  return (
    <main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <AuthForm />
    </main>
  );
}

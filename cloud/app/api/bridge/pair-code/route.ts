import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { sql } from "@/src/lib/db";
import { authUser } from "@/src/lib/auth";

export async function POST(request: Request) {
  const user = await authUser(request);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const pairCode = randomBytes(4).toString("hex").toUpperCase().match(/.{1,4}/g)!.join("-");
  await sql`
    insert into bridges (user_id, token, pair_code) values (${user.id}, null, ${pairCode})`;
  return NextResponse.json({ pair_code: pairCode });
}

/*
 * Shared Play Table for MonCards: one saved duel state that every player's browser
 * loads and keeps in sync.
 *
 *   GET    /api/table?room=main[&rev=N]   → { rev, updatedAt, state }
 *                                            (just { rev } when the caller already has rev N)
 *   PUT    /api/table   { room, baseRev, state }
 *                                          → { ok, rev }  or 409 { rev, state } when someone saved first
 *   DELETE /api/table?room=main            → forget the saved table
 *
 * The state is the client's own snapshot (cards by id, no card text), stored as one blob per room.
 * `rev` goes up on every save; a save made on top of an old rev is refused so two players
 * moving at once can't silently overwrite each other (the loser adopts the winner's table).
 */
import { getStore } from "@netlify/blobs"
import type { Config } from "@netlify/functions"

const ROOM_RE = /^[a-z0-9][a-z0-9-]{0,39}$/
const MAX_BYTES = 400_000

// Site-wide on purpose: production and branch deploys share one table.
const store = () => getStore({ name: "moncards-table", consistency: "strong" })

const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { "cache-control": "no-store" } })
const bad = (msg: string) => json({ error: msg }, 400)

type Saved = { rev: number; updatedAt: number; state: unknown }

export default async (req: Request) => {
  const s = store()
  const url = new URL(req.url)

  if (req.method === "GET") {
    const room = url.searchParams.get("room") || "main"
    if (!ROOM_RE.test(room)) return bad("invalid room")
    const saved = (await s.get(room, { type: "json" })) as Saved | null
    if (!saved) return json({ rev: 0 })
    if (Number(url.searchParams.get("rev")) === saved.rev) return json({ rev: saved.rev })
    return json(saved)
  }

  if (req.method === "PUT") {
    let body: { room?: unknown; baseRev?: unknown; state?: unknown }
    try { body = await req.json() } catch { return bad("invalid JSON") }
    const room = typeof body.room === "string" && body.room ? body.room : "main"
    if (!ROOM_RE.test(room)) return bad("invalid room")
    if (!body.state || typeof body.state !== "object" || Array.isArray(body.state)) return bad("state must be an object")
    if (JSON.stringify(body.state).length > MAX_BYTES) return bad("table state is too large")
    const prev = (await s.get(room, { type: "json" })) as Saved | null
    const rev = prev?.rev ?? 0
    if (Number(body.baseRev) !== rev) return json({ error: "conflict", ...prev }, 409)
    const next: Saved = { rev: rev + 1, updatedAt: Date.now(), state: body.state }
    await s.setJSON(room, next)
    return json({ ok: true, rev: next.rev, updatedAt: next.updatedAt })
  }

  if (req.method === "DELETE") {
    const room = url.searchParams.get("room") || "main"
    if (!ROOM_RE.test(room)) return bad("invalid room")
    await s.delete(room)
    return json({ ok: true })
  }

  return json({ error: "method not allowed" }, 405)
}

export const config: Config = {
  path: "/api/table",
  method: ["GET", "PUT", "DELETE"],
}

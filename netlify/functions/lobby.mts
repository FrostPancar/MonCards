/*
 * Multiplayer lobby for MonCards: players wait here until there are two of them,
 * then they're paired into a private Play Table room.
 *
 *   POST /api/lobby  { op: 'join', id, name, deck }  → join or stay in the lobby (send every ~1.5 s as a heartbeat)
 *                    { op: 'leave', id }              → leave the lobby
 *     → { status: 'waiting' | 'matched' | 'left', waiting: [{ name, deckName }], match?, now }
 *
 * A match is { room, startAt, seats: [{ id, name, deck }, { id, name, deck }] }. Seat 0 builds the
 * duel and saves it to /api/table?room=<room>; both players start when the countdown reaches startAt.
 * Players who stop sending heartbeats drop out of the lobby after a few seconds.
 */
import { getStore } from "@netlify/blobs"
import type { Config } from "@netlify/functions"

const KEY = "lobby"
const STALE_MS = 10_000          // no heartbeat for this long: dropped from the lobby
const MATCH_TTL_MS = 30 * 60_000 // matches are remembered this long so a refresh can rejoin
const COUNTDOWN_MS = 5_000
const ID_RE = /^[a-z0-9]{6,40}$/
const MAX_DECK_BYTES = 20_000

type Deck = { name?: string; [k: string]: unknown }
type Waiting = { id: string; name: string; deck: Deck; joinedAt: number; seen: number }
type Seat = { id: string; name: string; deck: Deck }
type Match = { room: string; startAt: number; createdAt: number; seats: Seat[] }
type Lobby = { waiting: Waiting[]; matches: Record<string, Match> }

const store = () => getStore({ name: "moncards-lobby", consistency: "strong" })
const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { "cache-control": "no-store" } })
const bad = (msg: string) => json({ error: msg }, 400)
const rand = () => Math.random().toString(36).slice(2, 10)

export default async (req: Request) => {
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405)
  let body: { op?: unknown; id?: unknown; name?: unknown; deck?: unknown }
  try { body = await req.json() } catch { return bad("invalid JSON") }
  const id = String(body.id ?? "")
  if (!ID_RE.test(id)) return bad("invalid player id")
  const op = body.op === "leave" ? "leave" : "join"
  const name = String(body.name ?? "").trim().slice(0, 24) || "Player"
  const deck = body.deck as Deck
  if (op === "join") {
    if (!deck || typeof deck !== "object" || Array.isArray(deck)) return bad("pick a deck")
    if (JSON.stringify(deck).length > MAX_DECK_BYTES) return bad("deck is too large")
  }

  const s = store()
  // Read-modify-write with an ETag check, retried if another player changed the lobby in between.
  for (let attempt = 0; attempt < 8; attempt++) {
    const now = Date.now()
    const cur = await s.getWithMetadata(KEY, { type: "json" })
    const lobby: Lobby = (cur?.data as Lobby) ?? { waiting: [], matches: {} }
    lobby.waiting = lobby.waiting.filter(w => now - w.seen < STALE_MS)
    for (const [pid, m] of Object.entries(lobby.matches)) if (now - m.createdAt > MATCH_TTL_MS) delete lobby.matches[pid]

    let status: string
    if (op === "leave") {
      lobby.waiting = lobby.waiting.filter(w => w.id !== id)
      delete lobby.matches[id]
      status = "left"
    } else if (lobby.matches[id]) {
      status = "matched"
    } else {
      const me = lobby.waiting.find(w => w.id === id)
      if (me) Object.assign(me, { name, deck, seen: now })
      else lobby.waiting.push({ id, name, deck, joinedAt: now, seen: now })
      // Two players waiting: pair the two who have waited longest, in a random seat order.
      if (lobby.waiting.length >= 2) {
        lobby.waiting.sort((a, b) => a.joinedAt - b.joinedAt)
        const pair = lobby.waiting.splice(0, 2)
        if (Math.random() < 0.5) pair.reverse()
        const match: Match = {
          room: `m-${rand()}${rand()}`.slice(0, 20), startAt: now + COUNTDOWN_MS, createdAt: now,
          seats: pair.map(w => ({ id: w.id, name: w.name, deck: w.deck })),
        }
        for (const w of pair) lobby.matches[w.id] = match
      }
      status = lobby.matches[id] ? "matched" : "waiting"
    }

    const res = cur
      ? await s.setJSON(KEY, lobby, { onlyIfMatch: cur.etag })
      : await s.setJSON(KEY, lobby, { onlyIfNew: true })
    if (!res.modified) continue // someone else wrote first: try again on the fresh copy

    return json({
      status, now,
      waiting: lobby.waiting.map(w => ({ name: w.name, deckName: w.deck?.name ?? "" })),
      match: lobby.matches[id] ?? null,
    })
  }
  return json({ error: "lobby is busy, try again" }, 503)
}

export const config: Config = {
  path: "/api/lobby",
  method: ["POST"],
}

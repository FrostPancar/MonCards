/*
 * Shared card store for MonCards: custom cards and edits to existing cards,
 * visible to and editable by everyone who opens the site.
 *
 *   GET    /api/cards                      → { custom: Card[], edits: { [id]: Edit } }
 *   PUT    /api/cards   { kind, id, data } → save one custom card or one edit
 *                                            (stamps updatedAt, and createdAt for new custom cards)
 *   DELETE /api/cards?kind=…&id=…          → remove one custom card or one edit
 *
 * Each card / edit is its own blob ("custom/<id>", "edit/<id>"), so people
 * saving different cards never overwrite each other. Saving the same card
 * twice is last-write-wins, which is fine for a shared design sandbox.
 */
import { getStore } from "@netlify/blobs"
import type { Config } from "@netlify/functions"

const KINDS = ["custom", "edit"] as const
type Kind = (typeof KINDS)[number]
const CARD_KINDS = ["basic", "tribute", "extra", "action", "field", "barrier", "boss"]
const ID_RE = /^[a-z0-9][a-z0-9-]{0,79}$/
const MAX_BYTES = 20_000

// Site-wide on purpose: production and branch deploys share one card pool.
const store = () => getStore({ name: "moncards-cards", consistency: "strong" })

const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { "cache-control": "no-store" } })
const bad = (msg: string) => json({ error: msg }, 400)

function checkKey(kind: unknown, id: unknown): string | null {
  if (!KINDS.includes(kind as Kind)) return "kind must be 'custom' or 'edit'"
  if (typeof id !== "string" || !ID_RE.test(id)) return "invalid card id"
  return null
}

function checkData(kind: Kind, id: string, data: unknown): string | null {
  if (!data || typeof data !== "object" || Array.isArray(data)) return "data must be an object"
  if (JSON.stringify(data).length > MAX_BYTES) return "card is too large"
  const d = data as Record<string, unknown>
  if (kind === "custom") {
    if (d.id !== id) return "card id mismatch"
    if (typeof d.name !== "string" || !d.name.trim() || d.name.length > 60) return "card needs a name (max 60 chars)"
    if (!CARD_KINDS.includes(d.kind as string)) return "unknown card type"
  }
  if (d.text != null && (typeof d.text !== "string" || d.text.length > 4000)) return "effect text is too long"
  return null
}

export default async (req: Request) => {
  const s = store()

  if (req.method === "GET") {
    const { blobs } = await s.list()
    const entries = await Promise.all(blobs.map(async b => [b.key, await s.get(b.key, { type: "json" })] as const))
    const custom: unknown[] = []
    const edits: Record<string, unknown> = {}
    for (const [key, value] of entries) {
      if (!value) continue
      const [kind, id] = key.split("/")
      if (kind === "custom") custom.push(value)
      else if (kind === "edit") edits[id] = value
    }
    return json({ custom, edits })
  }

  if (req.method === "PUT") {
    let body: { kind?: unknown; id?: unknown; data?: unknown }
    try { body = await req.json() } catch { return bad("invalid JSON") }
    const keyErr = checkKey(body?.kind, body?.id)
    if (keyErr) return bad(keyErr)
    const dataErr = checkData(body.kind as Kind, body.id as string, body.data)
    if (dataErr) return bad(dataErr)
    // Timestamps come from the server so every device agrees on them.
    const key = `${body.kind}/${body.id}`
    const now = Date.now()
    const prev = (await s.get(key, { type: "json" })) as { createdAt?: number } | null
    const data = { ...(body.data as Record<string, unknown>), updatedAt: now } as Record<string, unknown>
    if (body.kind === "custom") data.createdAt = prev?.createdAt ?? (Number(data.createdAt) || now)
    await s.setJSON(key, data)
    return json({ ok: true, updatedAt: now })
  }

  if (req.method === "DELETE") {
    const url = new URL(req.url)
    const kind = url.searchParams.get("kind"), id = url.searchParams.get("id")
    const keyErr = checkKey(kind, id)
    if (keyErr) return bad(keyErr)
    await s.delete(`${kind}/${id}`)
    return json({ ok: true })
  }

  return json({ error: "method not allowed" }, 405)
}

export const config: Config = {
  path: "/api/cards",
  method: ["GET", "PUT", "DELETE"],
}

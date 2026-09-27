// All bot data lives in Netlify Blobs (free storage on the same Netlify site).
// Writes use ETags so two messages arriving at once never overwrite each other.
import { getStore } from "@netlify/blobs";

const store = () => getStore({ name: "shimmer-bot", consistency: "strong" });

export const newThread = (psid) => ({
  psid,
  name: null,
  messages: [], // { by: "customer" | "bot" | "rj", text, at, mid?, images? }
  mids: [], // message ids already processed (Meta sometimes delivers twice)
  pausedUntil: null, // bot stays quiet until this time after RJ replies personally
  handoff: null, // { status: "open" | "answered" | "done", reason, urgent, date_needed, summary, details, openedAt }
  createdAt: new Date().toISOString(),
  lastActivity: null,
});

export async function getThread(psid) {
  return (await store().get(`threads/${psid}`, { type: "json" })) || newThread(psid);
}

// Read, change, and save a thread safely. `change` edits the thread in place.
export async function updateThread(psid, change) {
  const key = `threads/${psid}`;
  for (let attempt = 0; attempt < 6; attempt++) {
    const current = await store().getWithMetadata(key, { type: "json" });
    const thread = current?.data || newThread(psid);
    const result = await change(thread);
    if (result === false) return thread; // nothing to save
    thread.messages = thread.messages.slice(-80);
    thread.mids = thread.mids.slice(-150);
    const write = current
      ? await store().setJSON(key, thread, { onlyIfMatch: current.etag })
      : await store().setJSON(key, thread, { onlyIfNew: true });
    if (write.modified) return thread;
  }
  throw new Error(`Could not save conversation ${psid} after several tries`);
}

export async function listThreads() {
  const { blobs } = await store().list({ prefix: "threads/" });
  const threads = await Promise.all(blobs.map((b) => store().get(b.key, { type: "json" })));
  return threads.filter(Boolean);
}

const DEFAULT_SETTINGS = { mode: "test", testers: [] }; // start safe: only testers get replies

export async function getSettings() {
  return { ...DEFAULT_SETTINGS, ...((await store().get("settings", { type: "json" })) || {}) };
}

export async function updateSettings(change) {
  for (let attempt = 0; attempt < 6; attempt++) {
    const current = await store().getWithMetadata("settings", { type: "json" });
    const settings = { ...DEFAULT_SETTINGS, ...(current?.data || {}) };
    change(settings);
    const write = current
      ? await store().setJSON("settings", settings, { onlyIfMatch: current.etag })
      : await store().setJSON("settings", settings, { onlyIfNew: true });
    if (write.modified) return settings;
  }
  throw new Error("Could not save settings");
}

// Talking to Facebook (Graph API). The Page token is never logged or returned.
const V = process.env.GRAPH_VERSION || "v23.0";
const GRAPH = `https://graph.facebook.com/${V}`;
export const PAGE_ID = process.env.META_PAGE_ID;
export const BOT_TAG = "shimmer-bot"; // attached to every bot message so its echo is recognized

let pageToken = null;

// Same workaround already used by the pipelines: trade the System User token for a Page token.
export async function getPageToken() {
  if (pageToken) return pageToken;
  const r = await fetch(`${GRAPH}/${PAGE_ID}?fields=access_token`, {
    headers: { Authorization: `Bearer ${process.env.META_SYSTEM_USER_TOKEN}` },
  });
  const j = await r.json();
  if (!j.access_token) throw new Error(`Could not get a Page token: ${j.error?.message || r.status}`);
  pageToken = j.access_token;
  return pageToken;
}

async function graph(path, { method = "GET", body } = {}) {
  const token = await getPageToken();
  const r = await fetch(`${GRAPH}/${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.error) throw new Error(`Facebook error on ${path.split("?")[0]}: ${j.error?.message || r.status}`);
  return j;
}

export async function sendText(psid, text) {
  return graph("me/messages", {
    method: "POST",
    body: {
      recipient: { id: psid },
      messaging_type: "RESPONSE",
      message: { text: text.slice(0, 2000), metadata: BOT_TAG },
    },
  });
}

export async function showTyping(psid) {
  return graph("me/messages", {
    method: "POST",
    body: { recipient: { id: psid }, sender_action: "typing_on" },
  }).catch(() => {});
}

export async function getCustomerName(psid) {
  try {
    const j = await graph(`${psid}?fields=first_name,last_name`);
    return [j.first_name, j.last_name].filter(Boolean).join(" ") || null;
  } catch {
    return null;
  }
}

export async function subscribePage() {
  return graph(`${PAGE_ID}/subscribed_apps?subscribed_fields=messages,message_echoes`, { method: "POST" });
}

export async function pageSubscriptionStatus() {
  const j = await graph(`${PAGE_ID}/subscribed_apps`);
  const mine = (j.data || []).find((a) => String(a.id) === String(process.env.META_APP_ID));
  return { connected: Boolean(mine), fields: mine?.subscribed_fields || [] };
}

export const inboxLink = () => `https://business.facebook.com/latest/inbox/all?asset_id=${PAGE_ID}`;

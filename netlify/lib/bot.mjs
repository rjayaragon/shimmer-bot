// What happens to each Messenger event Meta sends us.
import { getThread, updateThread, getSettings } from "./store.mjs";
import { sendText, showTyping, getCustomerName, BOT_TAG } from "./meta.mjs";
import { askClaude } from "./claude.mjs";
import { emailHandoff, emailHandoffUpdate, sendEmail } from "./email.mjs";

const PAUSE_HOURS = 24; // bot stays out of a conversation this long after RJ replies personally
const WAIT_FOR_MORE_MS = 3000; // customers often send several short messages in a row
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const iso = (ts) => new Date(ts || Date.now()).toISOString();
const NO_EMOJI = /[\p{Extended_Pictographic}\u{1F1E6}-\u{1F1FF}\u{FE0F}\u{200D}]/gu;

export async function handleMessagingEvent(ev) {
  if (ev.message?.is_echo) return handleEcho(ev);
  if (ev.message && ev.sender?.id) return handleCustomerMessage(ev);
  if (ev.postback && ev.sender?.id) {
    // "Get Started" and menu buttons: treat the button title as what the customer said.
    return handleCustomerMessage({ ...ev, message: { mid: `pb-${ev.timestamp}-${ev.sender.id}`, text: ev.postback.title } });
  }
}

// A message the Page itself sent: either the bot, or RJ replying personally.
async function handleEcho(ev) {
  const psid = ev.recipient.id;
  const m = ev.message;
  const fromBot = m.metadata === BOT_TAG || String(m.app_id || "") === String(process.env.META_APP_ID);
  await updateThread(psid, (t) => {
    if (t.mids.includes(m.mid)) return false;
    t.mids.push(m.mid);
    if (fromBot) return; // already logged when the bot sent it
    t.messages.push({ by: "rj", text: m.text || "[sent an attachment]", at: iso(ev.timestamp) });
    t.pausedUntil = new Date(Date.now() + PAUSE_HOURS * 3600e3).toISOString();
    t.lastActivity = iso(ev.timestamp);
    if (t.handoff?.status === "open") {
      t.handoff.status = "answered";
      t.handoff.answeredAt = iso();
    }
  });
}

async function handleCustomerMessage(ev) {
  const psid = ev.sender.id;
  const m = ev.message;
  const attachments = m.attachments || [];
  const images = attachments.filter((a) => a.type === "image" && a.payload?.url && !a.payload?.sticker_id).map((a) => a.payload.url);
  const others = attachments.filter((a) => a.type !== "image").map((a) => a.type);
  const isStickerOnly = !m.text && (m.sticker_id || attachments.every((a) => a.payload?.sticker_id)) && attachments.length > 0;
  const text = m.text || (isStickerOnly ? "[sent a sticker]" : images.length ? "[sent a photo]" : others.length ? `[sent ${others.join(", ")}]` : "");
  const name = (await getThread(psid)).name || (await getCustomerName(psid));

  let duplicate = false;
  await updateThread(psid, (t) => {
    if (t.mids.includes(m.mid)) {
      duplicate = true;
      return false;
    }
    t.mids.push(m.mid);
    if (name) t.name = name;
    t.messages.push({ by: "customer", text, at: iso(ev.timestamp), mid: m.mid, images });
    t.lastActivity = iso(ev.timestamp);
  });
  if (duplicate || isStickerOnly) return;

  // If the customer is still typing more messages, let the last one answer them all.
  await sleep(WAIT_FOR_MORE_MS);
  const thread = await getThread(psid);
  const lastFromCustomer = [...thread.messages].reverse().find((x) => x.by === "customer");
  if (lastFromCustomer?.mid !== m.mid) return;

  const settings = await getSettings();
  if (settings.mode === "off") return;
  if (settings.mode === "test" && !settings.testers.includes(psid)) return;
  if (thread.pausedUntil && new Date(thread.pausedUntil) > new Date()) return;
  if (thread.handoff?.status === "open" || thread.handoff?.status === "answered") {
    await emailHandoffUpdate(thread, text).catch((e) => console.error("Email failed:", e.message));
    return;
  }

  await showTyping(psid);
  let decision;
  try {
    decision = await decide(thread);
  } catch (e) {
    console.error("Bot could not decide:", e.message);
    decision = {
      action: "handoff",
      message: "Thank you for your message! Let me check this with our team and we'll get back to you as soon as possible.",
      handoff: { reason: "the assistant hit an error", urgent: false, date_needed: null, summary: `The bot could not answer this message: "${text}". Error: ${e.message}`, details: {} },
    };
  }
  if (decision.action === "none") return;

  const reply = decision.message;
  if (reply) {
    try {
      await sendText(psid, reply);
    } catch (e) {
      console.error("Send failed:", e.message);
      await sendEmail(`Bot could not reply to ${thread.name || "a customer"}`, `Facebook refused the reply.\n\nError: ${e.message}\n\nCustomer said: ${text}\n\nPlease answer them in Business Suite.`).catch(() => {});
      return;
    }
  }

  const saved = await updateThread(psid, (t) => {
    if (reply) t.messages.push({ by: "bot", text: reply, at: iso() });
    t.lastActivity = iso();
    if (decision.action === "handoff") t.handoff = { status: "open", openedAt: iso(), ...decision.handoff };
  });
  if (decision.action === "handoff") await emailHandoff(saved).catch((e) => console.error("Email failed:", e.message));
}

// Ask Claude what to do, and check the answer before trusting it.
async function decide(thread) {
  const manila = new Date().toLocaleString("en-PH", { timeZone: "Asia/Manila", dateStyle: "full", timeStyle: "short" });
  const firstReply = !thread.messages.some((x) => x.by === "bot");
  const lastReplyIndex = thread.messages.map((x) => x.by).lastIndexOf("bot");
  const newImages = thread.messages.slice(lastReplyIndex + 1).flatMap((x) => x.images || []).slice(-3);

  const transcript = thread.messages
    .slice(-30)
    .map((x) => {
      const when = new Date(x.at).toLocaleString("en-PH", { timeZone: "Asia/Manila", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
      const who = x.by === "customer" ? "Customer" : x.by === "bot" ? "Assistant (you)" : "RJ (owner, replied personally)";
      return `[${when}] ${who}: ${x.text}`;
    })
    .join("\n");

  const content = [];
  for (const url of newImages) {
    const img = await fetchImage(url);
    if (img) content.push({ type: "image", source: { type: "base64", media_type: img.type, data: img.data } });
  }
  content.push({
    type: "text",
    text: [
      `Today in Manila: ${manila}.`,
      `Customer name: ${thread.name || "unknown"}.`,
      firstReply ? "This is your first reply in this conversation, so open with the short assistant introduction." : "You have already introduced yourself in this conversation. Do not greet again.",
      newImages.length ? "The image(s) above were sent by the customer in their latest messages." : "",
      "",
      "Conversation so far (oldest first):",
      transcript,
      "",
      "Respond to the customer's latest message(s). Output only the JSON object described in your instructions.",
    ].join("\n"),
  });

  const raw = await askClaude(content);
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end < start) throw new Error("The assistant's answer was not in the expected format");
  const d = JSON.parse(raw.slice(start, end + 1));

  if (!["reply", "handoff", "none"].includes(d.action)) throw new Error(`Unknown action "${d.action}"`);
  d.message = String(d.message || "").replace(NO_EMOJI, "").replace(/\*\*/g, "").trim();
  if (d.action === "reply" && !d.message) throw new Error("The assistant chose to reply but wrote nothing");
  if (d.action === "handoff") {
    const h = d.handoff || {};
    d.handoff = {
      reason: String(h.reason || "needs your input"),
      urgent: Boolean(h.urgent),
      date_needed: h.date_needed || null,
      summary: String(h.summary || ""),
      details: h.details && typeof h.details === "object" ? h.details : {},
    };
  }
  return d;
}

async function fetchImage(url) {
  try {
    const r = await fetch(url);
    const type = (r.headers.get("content-type") || "").split(";")[0];
    if (!r.ok || !["image/jpeg", "image/png", "image/gif", "image/webp"].includes(type)) return null;
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.length > 4.5 * 1024 * 1024) return null;
    return { type, data: buf.toString("base64") };
  } catch {
    return null;
  }
}

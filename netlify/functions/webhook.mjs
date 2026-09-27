// Meta calls this URL for every Messenger event on the Page.
// It answers Meta right away, then does the actual work in the background.
import crypto from "node:crypto";
import { handleMessagingEvent } from "../lib/bot.mjs";

export default async (req, context) => {
  const url = new URL(req.url);

  // One-time check Meta does when you save the webhook URL in the developer console.
  if (req.method === "GET") {
    const ok = url.searchParams.get("hub.mode") === "subscribe" && url.searchParams.get("hub.verify_token") === process.env.META_VERIFY_TOKEN;
    return ok ? new Response(url.searchParams.get("hub.challenge")) : new Response("Verify token does not match", { status: 403 });
  }
  if (req.method !== "POST") return new Response("Not allowed", { status: 405 });

  // Only accept events that are really from Meta (signed with your App Secret).
  const raw = Buffer.from(await req.arrayBuffer());
  const given = req.headers.get("x-hub-signature-256") || "";
  const expected = "sha256=" + crypto.createHmac("sha256", process.env.META_APP_SECRET || "").update(raw).digest("hex");
  if (given.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(given), Buffer.from(expected))) {
    return new Response("Signature does not match", { status: 401 });
  }

  const body = JSON.parse(raw.toString("utf8"));
  if (body.object !== "page") return new Response("OK");
  const events = (body.entry || []).flatMap((e) => e.messaging || []);

  const work = Promise.allSettled(events.map(handleMessagingEvent)).then((results) =>
    results.filter((r) => r.status === "rejected").forEach((r) => console.error("Event failed:", r.reason?.message || r.reason))
  );
  if (context?.waitUntil) context.waitUntil(work);
  else await work;
  return new Response("EVENT_RECEIVED");
};

export const config = { path: "/webhook" };

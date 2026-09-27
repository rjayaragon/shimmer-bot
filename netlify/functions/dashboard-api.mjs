// Everything the dashboard shows or changes. Changes only touch the bot's own
// records and settings; the one Facebook action (connecting the Page) is a button RJ presses.
import crypto from "node:crypto";
import { listThreads, updateThread, getSettings, updateSettings } from "../lib/store.mjs";
import { subscribePage, pageSubscriptionStatus, inboxLink } from "../lib/meta.mjs";
import { reminders } from "../lib/reminders.mjs";

const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });

function authorized(req) {
  const given = Buffer.from(req.headers.get("x-dashboard-password") || "");
  const expected = Buffer.from(process.env.DASHBOARD_PASSWORD || "");
  return expected.length > 0 && given.length === expected.length && crypto.timingSafeEqual(given, expected);
}

export default async (req) => {
  if (!authorized(req)) return json({ error: "Wrong password." }, 401);

  if (req.method === "GET") {
    const [threads, settings] = await Promise.all([listThreads(), getSettings()]);
    const weekAgo = Date.now() - 7 * 86400e3;
    const thisWeek = threads.flatMap((t) => t.messages).filter((m) => new Date(m.at).getTime() > weekAgo);
    const handoffsThisWeek = threads.filter((t) => t.handoff && new Date(t.handoff.openedAt).getTime() > weekAgo).length;
    const conversationsThisWeek = threads.filter((t) => t.lastActivity && new Date(t.lastActivity).getTime() > weekAgo).length;

    return json({
      settings,
      inboxLink: inboxLink(),
      reminders: reminders(settings),
      week: {
        conversations: conversationsThisWeek,
        customerMessages: thisWeek.filter((m) => m.by === "customer").length,
        botReplies: thisWeek.filter((m) => m.by === "bot").length,
        handoffs: handoffsThisWeek,
      },
      threads: threads
        .sort((a, b) => (b.lastActivity || "").localeCompare(a.lastActivity || ""))
        .map(({ mids, ...t }) => ({ ...t, messages: t.messages.slice(-40).map(({ images, mid, ...m }) => m) })),
    });
  }

  if (req.method === "POST") {
    const { action, psid, mode } = await req.json().catch(() => ({}));
    switch (action) {
      case "done": // RJ finished a handoff; the bot may answer this customer again
        await updateThread(psid, (t) => {
          if (t.handoff) t.handoff = { ...t.handoff, status: "done", doneAt: new Date().toISOString() };
          t.pausedUntil = null;
        });
        return json({ ok: true });
      case "resume": // let the bot reply again before the 24 hours are up
        await updateThread(psid, (t) => {
          t.pausedUntil = null;
        });
        return json({ ok: true });
      case "mode":
        if (!["off", "test", "live"].includes(mode)) return json({ error: "Unknown mode." }, 400);
        return json({ settings: await updateSettings((s) => (s.mode = mode)) });
      case "addTester":
        return json({ settings: await updateSettings((s) => (s.testers = [...new Set([...s.testers, psid])])) });
      case "removeTester":
        return json({ settings: await updateSettings((s) => (s.testers = s.testers.filter((x) => x !== psid))) });
      case "pageStatus":
        try {
          return json(await pageSubscriptionStatus());
        } catch (e) {
          return json({ error: e.message }, 502);
        }
      case "connectPage":
        try {
          await subscribePage();
          return json(await pageSubscriptionStatus());
        } catch (e) {
          return json({ error: e.message }, 502);
        }
      default:
        return json({ error: "Unknown action." }, 400);
    }
  }
  return json({ error: "Not allowed." }, 405);
};

export const config = { path: "/api/dashboard" };

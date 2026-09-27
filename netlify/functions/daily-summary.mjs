// Runs every day at 6 PM Manila time (10:00 UTC). Emails RJ only when something
// needs him: open handoffs or an upcoming reminder. No email on quiet days.
import { listThreads, getSettings } from "../lib/store.mjs";
import { sendEmail } from "../lib/email.mjs";
import { inboxLink } from "../lib/meta.mjs";
import { reminders } from "../lib/reminders.mjs";

export default async () => {
  const [threads, settings] = await Promise.all([listThreads(), getSettings()]);
  const waiting = threads
    .filter((t) => t.handoff && t.handoff.status !== "done")
    .sort((a, b) => Number(b.handoff.urgent) - Number(a.handoff.urgent) || (a.handoff.date_needed || "9").localeCompare(b.handoff.date_needed || "9"));
  const notes = reminders(settings).filter((r) => r.level !== "info");
  if (!waiting.length && !notes.length) return;

  const dayAgo = Date.now() - 24 * 3600e3;
  const recent = threads.flatMap((t) => t.messages).filter((m) => new Date(m.at).getTime() > dayAgo);
  const lines = [
    waiting.length ? `${waiting.length} customer${waiting.length > 1 ? "s" : ""} waiting on you:` : "No customers waiting on you.",
    ...waiting.map((t) => {
      const h = t.handoff;
      const tag = h.status === "answered" ? " (you replied, mark done when finished)" : h.urgent ? " (URGENT)" : "";
      return `- ${t.name || "Customer"}${tag}: ${h.summary || h.reason}${h.date_needed ? ` Needed ${h.date_needed}.` : ""}`;
    }),
    "",
    `Last 24 hours: ${recent.filter((m) => m.by === "customer").length} customer messages, ${recent.filter((m) => m.by === "bot").length} bot replies.`,
    ...(notes.length ? ["", "Reminders:", ...notes.map((r) => `- ${r.text}`)] : []),
    "",
    `Dashboard: ${process.env.URL || ""}/`,
    `Business Suite inbox: ${inboxLink()}`,
  ];
  await sendEmail(`Shimmer & Knotted daily summary: ${waiting.length ? `${waiting.length} waiting on you` : "reminders"}`, lines.join("\n"));
};

export const config = { schedule: "0 10 * * *" };

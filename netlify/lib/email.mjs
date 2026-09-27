// Emails go out through RJ's Gmail using an app password (free).
import nodemailer from "nodemailer";
import { inboxLink } from "./meta.mjs";

let transport = null;
const mailer = () =>
  (transport ||= nodemailer.createTransport({
    service: "gmail",
    auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
  }));

export async function sendEmail(subject, text) {
  await mailer().sendMail({
    from: `Shimmer & Knotted Bot <${process.env.GMAIL_USER}>`,
    to: process.env.ALERT_EMAIL || process.env.GMAIL_USER,
    subject,
    text,
  });
}

const dashboardLink = () => `${process.env.URL || ""}/`;

function detailLines(details = {}) {
  const labels = {
    product: "Product",
    quantity: "Quantity",
    colors: "Colors",
    text_to_print: "Text to print",
    date_needed: "Date needed",
    other: "Other",
  };
  return Object.entries(labels)
    .filter(([k]) => details[k])
    .map(([k, label]) => `  ${label}: ${details[k]}`)
    .join("\n");
}

const recent = (thread, n = 6) =>
  thread.messages
    .slice(-n)
    .map((m) => `  ${m.by === "customer" ? thread.name || "Customer" : m.by === "bot" ? "Bot" : "You"}: ${m.text}`)
    .join("\n");

export async function emailHandoff(thread) {
  const h = thread.handoff;
  const who = thread.name || "A customer";
  const when = h.date_needed ? `, needed ${h.date_needed}` : "";
  const subject = `${h.urgent ? "URGENT: " : ""}${who} needs you (${h.reason}${when})`;
  const body = [
    `${h.summary || h.reason}`,
    "",
    detailLines(h.details) ? `Details the bot collected:\n${detailLines(h.details)}\n` : "",
    `Latest messages:\n${recent(thread)}`,
    "",
    "The bot told the customer the team will get back to them, and it will stay out of this",
    "conversation until you mark it done on the dashboard.",
    "",
    `Reply in Business Suite: ${inboxLink()}`,
    `Dashboard: ${dashboardLink()}`,
  ].join("\n");
  await sendEmail(subject, body);
}

export async function emailHandoffUpdate(thread, text) {
  await sendEmail(
    `${thread.name || "A customer"} added a message to an open handoff`,
    [`New message: ${text}`, "", `Latest messages:\n${recent(thread)}`, "", `Reply in Business Suite: ${inboxLink()}`, `Dashboard: ${dashboardLink()}`].join("\n")
  );
}

// Things RJ should not have to remember himself.
export function reminders(settings) {
  const out = [];
  const expires = process.env.TOKEN_EXPIRES; // e.g. 2026-11-06
  if (expires) {
    const days = Math.ceil((new Date(`${expires}T00:00:00+08:00`) - Date.now()) / 86400e3);
    if (days <= 0) out.push({ level: "urgent", text: "The Facebook Page token has expired. The bot cannot reply until you generate a new one and update META_SYSTEM_USER_TOKEN in Netlify." });
    else if (days <= 21) out.push({ level: "warn", text: `The Facebook Page token expires in ${days} day${days > 1 ? "s" : ""} (${expires}). Generate a new one and update META_SYSTEM_USER_TOKEN and TOKEN_EXPIRES in Netlify.` });
    else out.push({ level: "info", text: `Facebook Page token is good until ${expires}.` });
  }
  if (settings.mode === "test") out.push({ level: "warn", text: "The bot is in testing mode, so it only replies to testers. Switch it to Live on the dashboard when you are ready." });
  if (settings.mode === "off") out.push({ level: "warn", text: "The bot is turned off. Customers are not getting automatic replies." });
  out.push({ level: "info", text: "Check your Netlify credit usage once a month (free plan: 300 credits). Each code change you save uses about 15." });
  return out;
}

# Shimmer & Knotted Messenger bot: setup guide

This guide sets up three things: the bot that answers Messenger, the emails that tell you when a customer needs you, and your dashboard. Plan on one to two hours, done in one sitting on a laptop. You only do this once.

Every key and password in this guide goes into Netlify only. Never paste them into a chat, including with Claude.

## What you need before starting

- The folder `shimmer-bot` (unzipped from the file Claude gave you).
- Your Facebook login that manages the Page and the Meta developer app.
- Your Gmail.
- A payment card for the Claude API (pay per use).

## Step 1: Get a Claude API key

1. Go to platform.claude.com and create an account (this is separate from your Claude subscription).
2. Open Billing, add a payment card, and buy a small amount of credits to start.
3. Set a monthly spend limit so the bill can never surprise you. Check your usage after the first week to see what a normal month costs.
4. Open API Keys, create a key named "Shimmer bot", and keep that tab open. You will paste it into Netlify in Step 4.

## Step 2: Make a Gmail app password

The bot sends you emails through your own Gmail.

1. Go to myaccount.google.com, then Security.
2. Turn on 2-Step Verification if it is not on already (Google requires this for app passwords).
3. Search for "App passwords" at the top of the Google Account page, create one named "Shimmer bot", and copy the 16-letter password. Keep it for Step 4.

## Step 3: Put the bot's files on GitHub

Netlify builds the bot from a GitHub folder, which also gives you an easy place to edit prices later.

1. Create a free account at github.com.
2. Click New repository. Name it `shimmer-bot` and choose Private. Click Create repository.
3. On the next page, click "uploading an existing file".
4. Open the unzipped `shimmer-bot` folder on your computer, select everything inside it (the folders `bot`, `netlify`, `public`, `scripts` and the other files), and drag it all into the GitHub page. Drag the contents, not the zip file.
5. Click Commit changes.

## Step 4: Create the Netlify site

Use the same Netlify account as your Ribbon Preview Tool. This will be a second, separate site so the two never interfere.

1. Go to app.netlify.com. Click Add new project, then Import an existing project, then GitHub. Allow Netlify to see the `shimmer-bot` repository and pick it.
2. Leave the build settings as they are (they come from the files) and click Deploy. The first deploy will build but the bot will not work yet, because it has no keys.
3. Open Project configuration, then General, and change the project name to something like `shimmer-knotted-inbox`. Your dashboard address becomes `https://shimmer-knotted-inbox.netlify.app`.
4. Open Project configuration, then Environment variables, and add each of these. Mark the keys and passwords as secret when Netlify offers it.

| Name | Value |
|---|---|
| ANTHROPIC_API_KEY | The Claude API key from Step 1 |
| META_APP_ID | 2168981093681907 |
| META_PAGE_ID | 358473671426268 |
| META_APP_SECRET | In developers.facebook.com, open your app, then App settings, then Basic, and click Show next to App secret |
| META_SYSTEM_USER_TOKEN | The token from your `facebook-system-user-page-access-token.md` project doc (copy it yourself) |
| META_VERIFY_TOKEN | Make up a long random phrase, such as `pavia-ribbon-foil-2026-xk7` (you will type it again in Step 6) |
| TOKEN_EXPIRES | 2026-11-06 |
| GMAIL_USER | Your Gmail address |
| GMAIL_APP_PASSWORD | The 16-letter app password from Step 2 |
| ALERT_EMAIL | Where handoff emails should go (can be the same Gmail) |
| DASHBOARD_PASSWORD | A password you will use to open the dashboard |

5. Open Deploys and click Trigger deploy, then Deploy project. Wait until it says Published.

Each deploy uses about 15 of your 300 free Netlify credits per month, so avoid unnecessary redeploys.

## Step 5: Open your dashboard

1. On your phone, open your dashboard address and sign in with the DASHBOARD_PASSWORD.
2. Add it to your home screen (Safari: Share, then Add to Home Screen. Chrome: menu, then Add to Home screen).

The bot starts in Testing mode, so it will not reply to any real customer yet.

## Step 6: Point your Meta app at the bot

1. Go to developers.facebook.com, open the Shimmer and Knotted Labels app.
2. If Messenger is not listed under your app's products, add it.
3. Open Messenger API settings and find the Webhooks section.
4. Callback URL: your dashboard address followed by `/webhook`, for example `https://shimmer-knotted-inbox.netlify.app/webhook`.
5. Verify token: the exact META_VERIFY_TOKEN phrase from Step 4.
6. Click Verify and save. If it fails, check that the phrase matches exactly and that the Step 4 deploy finished.
7. Subscribe to the webhook fields `messages` and `message_echoes`.

## Step 7: Connect the Page

On your dashboard, under Bot settings, tap "Connect the Page to the bot". It should change to "Connected."

## Step 8: Turn off Meta's old automatic replies

In Meta Business Suite, open Inbox, then Automations, and turn off Instant Reply, Away Message, and the FAQ replies. They quote wrong prices and a wrong turnaround, and the bot now does their job. If they stay on, the bot mistakes their replies for yours and goes quiet for 24 hours.

## Step 9: Test with a friend

Use someone who is not an admin of the Page, so the test matches a real customer.

1. Ask them to message the Page. Within a few seconds they should appear under Conversations on your dashboard, marked "Not a tester".
2. Tap their conversation and tap "Add as tester".
3. Have them try a few things and check each result:
   - A price question in English, then one in Ilonggo. The bot should answer in the same language, with correct prices and no emoji.
   - "Pwede rush by Friday?" The bot should ask for details, then hand off. You should get an email and see them under Needs you.
   - Reply to them yourself in Business Suite. The bot should go quiet in that conversation, and the dashboard should say so.
   - Tap Mark done on the dashboard. The bot should answer them again next time.
4. If something looks wrong, turn the bot Off on the dashboard and tell Claude what happened.

If your friend's messages never appear on the dashboard, recheck Steps 6 and 7.

If their messages appear but the bot never replies and you get an email saying "Facebook refused the reply", Meta is not yet letting your app message non-admins. In the developer console, switch the app to Live mode, and if Meta asks, request Advanced Access for `pages_messaging` through App Review. Meta's review can take a few days.

## Step 10: Go live

1. On the dashboard, tap Live under Bot settings.
2. Turn off the old Inbox Pipeline scheduled task in Claude, since the bot replaces it.

## Your daily routine (about 15 minutes, any time that suits your schedule)

1. Open the dashboard. Anything under Needs you is waiting on you, most urgent first.
2. Tap Reply in Business Suite, answer the customer, then tap Mark done.
3. Glance at Conversations to spot-check what the bot said.

Handoff emails arrive the moment something needs you, with URGENT in the subject when the date is close. A summary email arrives at 6 PM Manila time only on days when something is waiting or a reminder is due.

## Changing prices or bot rules

The bot only knows what is in two files on GitHub: `bot/price-sheet.md` (prices and products) and `bot/policy.md` (how it behaves). To change something, open the file on github.com, click the pencil icon, edit, and click Commit changes. Netlify redeploys automatically in a minute or two. Group several edits into one commit, since each commit uses about 15 Netlify credits.

## Before November 6: renew the Facebook token

The dashboard and the daily email will remind you three weeks ahead.

1. In Business Settings, open System users, then Shimmer Knotted Page Automation, and click Generate token.
2. Select the same permissions as before, and this time also `pages_read_user_content`. Pick the longest expiration offered.
3. In Netlify, update META_SYSTEM_USER_TOKEN and TOKEN_EXPIRES (or clear TOKEN_EXPIRES if the new token never expires), then trigger a deploy.
4. Update the token in your project doc as well.

## If something goes wrong

| What you see | What to do |
|---|---|
| The bot is saying something wrong | Tap Off on the dashboard right away, answer the customer yourself, then fix the price sheet or tell Claude what happened. |
| No one is getting replies | Check the mode is Live, the Page shows Connected, and the token has not expired. |
| One customer is not getting replies | Their conversation may be paused because you replied, or waiting on you. Tap it on the dashboard to see why. |
| No emails arriving | Check GMAIL_USER and GMAIL_APP_PASSWORD in Netlify, and look in Gmail's spam folder. |
| Replies are slow or sometimes missing | Add CLAUDE_MODEL with the value `claude-haiku-4-5-20251001` in Netlify for a faster model, then trigger a deploy. |
| Netlify warns about credits | Stop making edits until the month resets. Normal daily use is small; deploys are what use credits. |

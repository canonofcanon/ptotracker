# SurtzMedia Time-Off Tracker — Setup Guide

This is a simple website for your team to request time off, plus a private page
where you review those requests and keep everyone's day balances. There are two
pages, each with its own password:

- **The team page** — where employees send a request. They can't see anyone's
  balances here; they just type their request and hit send.
- **Your review page** (lives at `/admin`) — where you read each request, see how
  many days the person has, and approve or deny it. Approving subtracts the days
  automatically. Denying changes nothing.

You don't need to understand the code. You just need to put it online once and
type in a few passwords. The steps below walk through every click.

---

## A few words you'll run into

- **Netlify** — the service that puts the website online (you already use it).
- **Deploy** — "publish it / put it online." When you "deploy," your site goes live.
- **API key** — a long secret password that lets the app use AI to read requests.
- **Environment variable** — Netlify's name for a setting you type in once
  (your passwords and keys go here, kept hidden from everyone).

If any step looks different from what's written — buttons get renamed sometimes
— the overall order is what matters. And you can stop and ask me at any point.

---

## Step 1 — Get your AI key (about 5 minutes)

The app uses AI to read each request and figure out the dates and number of days.
That needs one key.

1. Go to **https://console.anthropic.com** and sign in (or create an account).
2. You may need to add a little credit to use the key — $5 is plenty and will
   last a long time for something this small. Look for **Billing** and add a
   small amount if it asks.
3. Find **API Keys** in the menu, click **Create Key**, give it a name like
   "PTO app," and click create.
4. Copy the key it shows you and paste it somewhere safe for a minute (a sticky
   note or Notes app). You'll need it in Step 4. **You only see it once**, so
   don't close that window until you've copied it.

---

## Step 2 — Put the project on GitHub

GitHub is just a place to store the project files so Netlify can grab them. It's
free and all point-and-click.

1. Go to **https://github.com** and sign in (or create a free account).
2. Click the **+** in the top-right corner, then **New repository**.
3. Give it a name like `pto-tracker`. Leave everything else as-is. Click
   **Create repository**.
4. On the next page, click the link that says
   **"uploading an existing file."**
5. Unzip the `pto-app` file I sent you. Open the unzipped folder, select
   **everything inside it**, and drag those files into the GitHub upload box.
   (Drag the *contents* — the README, the folders, etc. — not the outer folder.)
6. Scroll down and click the green **Commit changes** button.

That's it — your files now live on GitHub.

---

## Step 3 — Connect it to Netlify and publish

1. Go to **https://app.netlify.com** and sign in.
2. Click **Add new site**, then **Import an existing project**.
3. Choose **GitHub**. If it asks for permission, click **Authorize**.
4. Find and click the `pto-tracker` repository you just made.
5. Don't change any of the settings it shows. Click **Deploy**.
6. Wait a minute or two. When it's done, Netlify shows you a web address like
   `https://something-random.netlify.app`. That's your live site. Copy it.

---

## Step 4 — Type in your passwords and key

Right now the site is live but won't work yet, because it needs your passwords
and AI key. Here's where they go.

1. In Netlify, on your site, click **Site configuration** (or **Site settings**).
2. In the side menu, click **Environment variables**.
3. Click **Add a variable** and add each of these, one at a time. For each one,
   type the **Key** name exactly as shown, then the value you choose:

   | Key (type this exactly) | Value (you choose / paste) |
   |---|---|
   | `SUBMIT_PASSWORD` | a simple password you'll give the whole team |
   | `ADMIN_PASSWORD` | a different password, just for you |
   | `ANTHROPIC_API_KEY` | the key you copied in Step 1 |

   (There's an optional fourth one, `SLACK_WEBHOOK_URL`, for Slack alerts — skip
   it for now. You can add it later.)

4. After adding all three, click **Deploys** in the top menu, then the
   **Trigger deploy** button, then **Deploy site**. This makes your new
   passwords take effect. (Settings only "kick in" after a fresh publish — this
   is the one thing people forget.)

---

## Step 5 — Test it

1. Open your Netlify web address in a browser. You should see the team request
   page. Enter the team password, pick a name, type a sentence like
   "I'd like Thursday and Friday next week off," and send it.
2. Now add `/admin` to the end of your web address (so it ends in
   `.netlify.app/admin`) and open that. Enter your admin password. You should
   see the request you just made, with the days and balance shown.

If something doesn't work, take a screenshot and send it to me — that's usually
enough for me to spot the fix.

---

## Step 6 — Make a friendly link

Your web address is ugly and random. Use short.io like you already do:

1. In **short.io**, make a link such as `go.surtzmedia.com/pto` that points to
   your Netlify address.
2. Give that link plus the team password to your crew.
3. Bookmark the `/admin` address for yourself.

(The reason it's not literally `surtzmedia.com/pto`: your main site lives in
Webflow, and bolting a sub-page onto it is the fussy way. The short.io link is
the clean way and works exactly the same for the team.)

---

## Starting balances

I've already filled in your guesses. The first time you open `/admin`, you'll see:

- **Ryan Howey** — 7 PTO days, 2 comp days
- **Ryan Cain** — 0 PTO days
- **Lucas Hibdon** — 10 PTO days

You can change any number, add new people, and set vacation days right there on
the review page — just edit the boxes and click **Save balances**. Everyone
starts at 0 vacation until you set it.

---

## Good to know

- This is a temporary tool, so the security is simple: one password for the team,
  one for you. Don't post the links publicly, and change the passwords if someone
  leaves the company.
- Approving a request is the only thing that subtracts days. The AI only reads
  the request and suggests the days/dates — it never touches the math, so the
  balances stay correct.
- If the AI guesses the number of days wrong on a confusing request, you can fix
  it right on the review card before you approve.

---

## Adding Slack alerts (optional, do this later)

If you want a Slack ping every time a request comes in:

1. Go to **https://api.slack.com/apps** and click **Create New App** →
   **From scratch**. Name it and pick your workspace.
2. In the app's menu, open **Incoming Webhooks** and turn it **On**.
3. Click **Add New Webhook to Workspace**, choose a channel (a private channel
   like `#pto-requests` with just you in it works well), and approve.
4. Copy the web address Slack gives you (it starts with
   `https://hooks.slack.com/...`).
5. Back in Netlify, add it as an environment variable named `SLACK_WEBHOOK_URL`,
   then trigger a deploy again (like Step 4).

---

## If you'd rather use the command line (for a techy helper)

Inside the `pto-app` folder:

```
npm install
npx netlify-cli deploy --prod
```

Then set the same environment variables in the Netlify dashboard and redeploy.

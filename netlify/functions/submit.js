// netlify/functions/submit.js
// Public-facing function for the team submit page.
//   GET  -> returns the roster (names only, no balances, no password needed)
//   POST -> validates the shared team password, parses the paragraph with the
//           Anthropic API, stores the request as "pending", and pings Slack.
//
// The LLM never touches balances or does arithmetic. It only reads the
// paragraph and pulls out days / dates / type. All math happens in admin.js,
// and only when you approve.

import { getStore } from "@netlify/blobs";

const BUCKETS = ["pto", "comp", "vacation"];

// Seeded once if the ledger doesn't exist yet. Edit balances later from the
// review page, not here.
const DEFAULT_BALANCES = {
  "Ryan Howey": { pto: 7, comp: 2, vacation: 0 },
  "Ryan Cain": { pto: 0, comp: 0, vacation: 0 },
  "Lucas Hibdon": { pto: 10, comp: 0, vacation: 0 },
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

async function getBalances(store) {
  const existing = await store.get("balances", { type: "json" });
  if (existing) return existing;
  await store.setJSON("balances", DEFAULT_BALANCES);
  return DEFAULT_BALANCES;
}

// Ask the model to turn free text into structured fields. The person is fixed
// by the form dropdown, so we only extract days / dates / type / summary.
async function parseRequest({ message, selectedType, today }) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    // Degrade gracefully: store it raw and flag for manual reading.
    return {
      days: null,
      dates: "",
      type: selectedType,
      summary: message.slice(0, 140),
      needs_review: true,
      note: "No ANTHROPIC_API_KEY set — paragraph stored unparsed.",
    };
  }

  const prompt = `Today is ${today}. A team member submitted a time-off request. Extract the details.

Their selected category was: "${selectedType}".
Their message: """${message}"""

Return ONLY a JSON object, no prose and no markdown fences, with these keys:
- "days": number of working days requested (use 0.5 for half days; null if you truly cannot tell)
- "dates": a short human-readable date or range, e.g. "Thu Jul 16 – Fri Jul 17" (empty string if none given)
- "type": one of "pto", "comp", "vacation" — default to the selected category unless the message clearly says otherwise
- "summary": one short plain sentence describing the request
- "needs_review": true if the days or dates are ambiguous or missing, otherwise false`;

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 400,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    const data = await res.json();
    const text = (data.content || [])
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("")
      .replace(/```json|```/g, "")
      .trim();

    const parsed = JSON.parse(text);
    // Normalize.
    if (!BUCKETS.includes(parsed.type)) parsed.type = selectedType;
    if (typeof parsed.days !== "number") parsed.days = null;
    if (parsed.days === null) parsed.needs_review = true;
    return parsed;
  } catch (err) {
    return {
      days: null,
      dates: "",
      type: selectedType,
      summary: message.slice(0, 140),
      needs_review: true,
      note: "Could not parse automatically — read the message and set days manually.",
    };
  }
}

async function notifySlack(request, balances) {
  const url = process.env.SLACK_WEBHOOK_URL;
  if (!url) return; // Optional. If unset, the review page is the only notice.

  const bal = balances[request.name] || {};
  const p = request.parsed;
  const lines = [
    `*New time-off request — ${request.name}*`,
    `> ${request.message}`,
    `*Parsed:* ${p.days ?? "?"} ${p.type} day(s)${p.dates ? ` · ${p.dates}` : ""}`,
    `*Current ${p.type} balance:* ${bal[p.type] ?? "?"}` +
      (typeof p.days === "number" && typeof bal[p.type] === "number"
        ? ` → ${bal[p.type] - p.days} after approval`
        : ""),
    p.needs_review ? "_Needs a manual look._" : "",
    "Review & approve on the /admin page.",
  ].filter(Boolean);

  try {
    await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: lines.join("\n") }),
    });
  } catch (_) {
    /* Notification is best-effort; the request is already saved. */
  }
}

export default async (req) => {
  const store = getStore("pto");

  if (req.method === "GET") {
    const balances = await getBalances(store);
    return json({ roster: Object.keys(balances) });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Bad request" }, 400);
  }

  const { password, name, type, message } = body;

  if (!password || password !== process.env.SUBMIT_PASSWORD) {
    return json({ error: "That password isn't right. Check with Christian." }, 401);
  }

  const balances = await getBalances(store);
  if (!name || !balances[name]) {
    return json({ error: "Pick your name from the list." }, 400);
  }
  if (!message || message.trim().length < 3) {
    return json({ error: "Add a sentence about what you're requesting." }, 400);
  }
  const selectedType = BUCKETS.includes(type) ? type : "pto";

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  const parsed = await parseRequest({ message: message.trim(), selectedType, today });

  const request = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name,
    message: message.trim(),
    parsed,
    status: "pending",
    createdAt: new Date().toISOString(),
  };

  const requests = (await store.get("requests", { type: "json" })) || [];
  requests.unshift(request);
  await store.setJSON("requests", requests);

  await notifySlack(request, balances);

  return json({ ok: true });
};

// netlify/functions/admin.js
// Manager-only function behind the admin password. Everything is one POST
// with an "action" so the review page makes a single kind of call.
//
//   list        -> { requests, balances }
//   decide      -> approve/deny a request; approval deducts in CODE (not the LLM)
//   setBalances -> overwrite the ledger (used by the inline balance editor)
//   addPerson   -> add a name with zeroed buckets
//
// The deduction is the whole point: balances are real numbers the code owns,
// so they never drift no matter how chatty the parsing gets.

import { getStore } from "@netlify/blobs";

const BUCKETS = ["pto", "comp", "other"];

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function cleanBuckets(obj = {}) {
  const out = {};
  for (const b of BUCKETS) {
    const n = Number(obj[b]);
    out[b] = Number.isFinite(n) ? n : 0;
  }
  return out;
}

export default async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  let body;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Bad request" }, 400);
  }

  if (!body.password || body.password !== process.env.ADMIN_PASSWORD) {
    return json({ error: "Wrong admin password." }, 401);
  }

  const store = getStore("pto");
  const action = body.action;

  const balances = (await store.get("balances", { type: "json" })) || {};
  const requests = (await store.get("requests", { type: "json" })) || [];

  if (action === "list") {
    return json({ requests, balances });
  }

  if (action === "decide") {
    const { id, decision } = body; // decision: "approve" | "deny"
    const reqItem = requests.find((r) => r.id === id);
    if (!reqItem) return json({ error: "Request not found." }, 404);
    if (reqItem.status !== "pending") {
      return json({ error: "Already decided.", requests, balances });
    }

    if (decision === "approve") {
      const bucket = reqItem.parsed.type;
      const days = Number(reqItem.parsed.days);
      // Only deduct for people who already have a balance on file. A request
      // from the catch-all "Other" name is just approved, no balance touched.
      if (balances[reqItem.name] && BUCKETS.includes(bucket) && Number.isFinite(days)) {
        balances[reqItem.name] = cleanBuckets(balances[reqItem.name]);
        balances[reqItem.name][bucket] = Number(
          (balances[reqItem.name][bucket] - days).toFixed(2)
        );
        await store.setJSON("balances", balances);
      }
      reqItem.status = "approved";
      reqItem.decidedAt = new Date().toISOString();
    } else {
      reqItem.status = "denied";
      reqItem.decidedAt = new Date().toISOString();
    }

    await store.setJSON("requests", requests);
    return json({ ok: true, requests, balances });
  }

  if (action === "setBalances") {
    const next = {};
    for (const [name, vals] of Object.entries(body.balances || {})) {
      next[name] = cleanBuckets(vals);
    }
    await store.setJSON("balances", next);
    return json({ ok: true, balances: next });
  }

  if (action === "addPerson") {
    const name = (body.name || "").trim();
    if (!name) return json({ error: "Name required." }, 400);
    if (!balances[name]) balances[name] = cleanBuckets({});
    await store.setJSON("balances", balances);
    return json({ ok: true, balances });
  }

  // Manual override of a parsed request's days/type before approving, in case
  // the LLM guessed wrong on an ambiguous message.
  if (action === "editParsed") {
    const { id, days, type } = body;
    const reqItem = requests.find((r) => r.id === id);
    if (!reqItem) return json({ error: "Request not found." }, 404);
    if (type && BUCKETS.includes(type)) reqItem.parsed.type = type;
    if (days !== undefined && days !== null && days !== "") {
      reqItem.parsed.days = Number(days);
    }
    reqItem.parsed.needs_review = false;
    await store.setJSON("requests", requests);
    return json({ ok: true, requests, balances });
  }

  return json({ error: "Unknown action." }, 400);
};

const express = require("express");
const app = express();

app.use(express.json({ limit: "2mb" }));

app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-RV-Secret");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

const RV_SECRET = process.env.RV_SECRET || "";
app.use((req, res, next) => {
  if (req.path === "/health") return next();
  if (RV_SECRET && req.headers["x-rv-secret"] !== RV_SECRET) {
    return res.status(403).json({ error: "Forbidden" });
  }
  next();
});

const APIFY_TOKEN = process.env.APIFY_TOKEN;
const ACTOR_ID = "compass~crawler-google-places";

app.get("/health", (req, res) => {
  res.json({ ok: true, actor: ACTOR_ID, tokenSet: !!APIFY_TOKEN, ts: new Date().toISOString() });
});

app.get("/test", async (req, res) => {
  if (!APIFY_TOKEN) return res.status(500).json({ error: "APIFY_TOKEN not set on server." });
  try {
    const apifyRes = await fetch(
      `https://api.apify.com/v2/acts/${ACTOR_ID}/run-sync-get-dataset-items?token=${APIFY_TOKEN}&timeout=60&format=json`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          searchStringsArray: ["coffee shop in New York"],
          maxCrawledPlacesPerSearch: 1,
          language: "en",
          scrapePlaceDetailPage: false,
          scrapeReviews: false,
        }),
      }
    );
    if (!apifyRes.ok) {
      const txt = await apifyRes.text().catch(() => "");
      return res.status(apifyRes.status).json({ error: `Apify returned ${apifyRes.status}`, detail: txt.slice(0, 200) });
    }
    const data = await apifyRes.json();
    const count = Array.isArray(data) ? data.length : 0;
    res.json({ ok: true, msg: `Proxy and Apify token both work. Actor returned ${count} result.` });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/search", async (req, res) => {
  if (!APIFY_TOKEN) return res.status(500).json({ error: "APIFY_TOKEN not set on server." });
  const { searchStringsArray, maxCrawledPlacesPerSearch, ...rest } = req.body;
  if (!searchStringsArray || !Array.isArray(searchStringsArray)) {
    return res.status(400).json({ error: "searchStringsArray is required." });
  }
  const input = {
    searchStringsArray,
    maxCrawledPlacesPerSearch: Math.min(maxCrawledPlacesPerSearch || 20, 60),
    language: "en",
    scrapePlaceDetailPage: true,
    scrapeReviews: false,
    scrapeTableReservations: false,
    deeperCityScrape: false,
    ...rest,
  };
  try {
    const apifyRes = await fetch(
      `https://api.apify.com/v2/acts/${ACTOR_ID}/run-sync-get-dataset-items?token=${APIFY_TOKEN}&timeout=300&format=json`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) }
    );
    if (!apifyRes.ok) {
      const txt = await apifyRes.text().catch(() => "");
      let parsed = {};
      try { parsed = JSON.parse(txt); } catch {}
      if (apifyRes.status === 401) return res.status(401).json({ error: "Apify token invalid." });
      if (apifyRes.status === 402) return res.status(402).json({ error: "Apify account out of credits." });
      return res.status(apifyRes.status).json({ error: `Apify returned ${apifyRes.status}`, detail: txt.slice(0, 300) });
    }
    const data = await apifyRes.json();
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: `Proxy error: ${e.message}` });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Ramel's Vision proxy running on port ${PORT}`);
  console.log(`Apify token: ${APIFY_TOKEN ? "SET ✓" : "NOT SET ✗"}`);
});

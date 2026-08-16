const express = require("express");
const app = express();
app.use(express.json());
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});
const TOKEN = process.env.APIFY_TOKEN;
app.get("/health", (req, res) => res.json({ ok: true, tokenSet: !!TOKEN }));
app.get("/test", async (req, res) => {
  if (!TOKEN) return res.status(500).json({ error: "APIFY_TOKEN not set" });
  const r = await fetch(`https://api.apify.com/v2/acts/compass~crawler-google-places/run-sync-get-dataset-items?token=${TOKEN}&timeout=60&format=json`, { method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify({ searchStringsArray: ["coffee in New York"], maxCrawledPlacesPerSearch: 1, language: "en", scrapePlaceDetailPage: false, scrapeReviews: false }) });
  const d = await r.json();
  res.json({ ok: true, msg: `Works. Got ${Array.isArray(d) ? d.length : 0} result.` });
});
app.post("/search", async (req, res) => {
  if (!TOKEN) return res.status(500).json({ error: "APIFY_TOKEN not set" });
  const r = await fetch(`https://api.apify.com/v2/acts/compass~crawler-google-places/run-sync-get-dataset-items?token=${TOKEN}&timeout=300&format=json`, { method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify({ ...req.body, maxCrawledPlacesPerSearch: Math.min(req.body.maxCrawledPlacesPerSearch || 20, 60), language: "en", scrapePlaceDetailPage: true, scrapeReviews: false }) });
  const d = await r.json();
  res.json(d);
});
app.listen(process.env.PORT || 3001, () => console.log("Proxy running. Token:", TOKEN ? "SET" : "NOT SET"));

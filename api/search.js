export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { query } = req.body;
  if (!query) return res.status(400).json({ error: "No query" });

  const HEADERS = {
    "User-Agent": "Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36",
    "Accept-Language": "hu-HU,hu;q=0.9",
    "Accept": "text/html,application/xhtml+xml",
  };

  const parseFloat2 = (s) => s ? parseFloat(s.replace(",", ".")) : null;

  // ── 1. kaloriabazis.hu ───────────────────────────────────────────────────
  async function scrapeKaloriabazis(q) {
    try {
      const html = await fetch("https://www.kaloriabazis.hu/kereses/" + encodeURIComponent(q), { headers: HEADERS }).then(r => r.text());
      const results = [];
      const blocks = html.split('class="etel-lista-elem"');
      for (let i = 1; i < blocks.length && results.length < 4; i++) {
        const b = blocks[i];
        const nameMatch = b.match(/class="nev"[^>]*>([\s\S]*?)<\//) || b.match(/<strong>([\s\S]*?)<\/strong>/);
        const hrefMatch = b.match(/href="\/etel\/([^"?]+)/);
        const calMatch  = b.match(/(\d+(?:[.,]\d+)?)\s*(?:kcal|kkal)/i);
        const pMatch    = b.match(/feh[eé]rje[^\d]*(\d+(?:[.,]\d+)?)/i);
        const cMatch    = b.match(/sz[eé]nhidr[aá]t[^\d]*(\d+(?:[.,]\d+)?)/i);
        const fMatch    = b.match(/zs[ií]r[^\d]*(\d+(?:[.,]\d+)?)/i);
        if (!nameMatch || !calMatch) continue;
        const name = nameMatch[1].replace(/<[^>]+>/g, "").trim();
        if (name.length < 2) continue;
        results.push({
          name, slug: hrefMatch ? hrefMatch[1] : null,
          cal: parseFloat2(calMatch[1]),
          protein: parseFloat2(pMatch?.[1]), carbs: parseFloat2(cMatch?.[1]), fat: parseFloat2(fMatch?.[1]),
        });
      }
      // Fetch detail pages for missing macros
      await Promise.all(results.slice(0, 3).filter(r => r.slug && r.protein === null).map(async (item) => {
        try {
          const dHtml = await fetch("https://www.kaloriabazis.hu/etel/" + item.slug, { headers: HEADERS }).then(r => r.text());
          const p = dHtml.match(/feh[eé]rje[\s\S]{0,300}?(\d+(?:[.,]\d+)?)\s*g/i);
          const c = dHtml.match(/sz[eé]nhidr[aá]t[\s\S]{0,300}?(\d+(?:[.,]\d+)?)\s*g/i);
          const f = dHtml.match(/zs[ií]r[\s\S]{0,300}?(\d+(?:[.,]\d+)?)\s*g/i);
          if (p) item.protein = parseFloat2(p[1]);
          if (c) item.carbs   = parseFloat2(c[1]);
          if (f) item.fat     = parseFloat2(f[1]);
        } catch {}
      }));
      return results.filter(r => r.cal > 0).map(r => ({
        name: r.name, cal: r.cal,
        protein: r.protein ?? 0, carbs: r.carbs ?? 0, fat: r.fat ?? 0,
        source: "kaloriabazis.hu"
      }));
    } catch { return []; }
  }

  // ── 2. kaloriaguru.hu ────────────────────────────────────────────────────
  async function scrapeKaloriaguru(q) {
    try {
      const html = await fetch("https://www.kaloriaguru.hu/kereses?q=" + encodeURIComponent(q), { headers: HEADERS }).then(r => r.text());
      const results = [];
      // kaloriaguru uses table rows or card blocks
      const blocks = html.split(/<tr|class="food-item|class="result-item|class="etel/i);
      for (let i = 1; i < blocks.length && results.length < 4; i++) {
        const b = blocks[i];
        const nameMatch = b.match(/(?:title|alt|class="nev"[^>]*>|<td[^>]*>)\s*"?([^"<>\n]{3,60})"?\s*(?:<|\/)/);
        const calMatch  = b.match(/(\d+(?:[.,]\d+)?)\s*(?:kcal|kkal|kalória)/i);
        const pMatch    = b.match(/feh[eé]rje[^\d]*(\d+(?:[.,]\d+)?)/i);
        const cMatch    = b.match(/sz[eé]nhidr[aá]t[^\d]*(\d+(?:[.,]\d+)?)/i);
        const fMatch    = b.match(/zs[ií]r[^\d]*(\d+(?:[.,]\d+)?)/i);
        if (!nameMatch || !calMatch) continue;
        const name = nameMatch[1].replace(/<[^>]+>/g, "").trim();
        if (name.length < 2) continue;
        results.push({
          name, cal: parseFloat2(calMatch[1]),
          protein: parseFloat2(pMatch?.[1]) ?? 0,
          carbs:   parseFloat2(cMatch?.[1]) ?? 0,
          fat:     parseFloat2(fMatch?.[1]) ?? 0,
          source: "kaloriaguru.hu"
        });
      }
      return results.filter(r => r.cal > 0);
    } catch { return []; }
  }

  // ── 3. Claude haiku fallback ─────────────────────────────────────────────
  async function claudeFallback(q) {
    try {
      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": process.env.ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-haiku-4-5", max_tokens: 600,
          messages: [{ role: "user", content: 'Give accurate nutritional values per 100g for: "' + q + '". Use standard USDA or European food composition data only — no guessing. Return ONLY a JSON array, no markdown:\n[{"name":"hungarian name","cal":number,"protein":number,"carbs":number,"fat":number}]\nMax 3 variants (e.g. cooked/raw). If uncertain, omit the item.' }]
        })
      });
      const data = await r.json();
      const text = (data.content || []).map(c => c.text || "").join("").replace(/```json|```/g, "");
      const m = text.match(/\[[\s\S]*\]/);
      if (!m) return [];
      return JSON.parse(m[0]).map(item => ({ ...item, source: "AI becslés ⚠️" }));
    } catch { return []; }
  }

  try {
    // Run both scrapers in parallel
    const [kb, kg] = await Promise.all([scrapeKaloriabazis(query), scrapeKaloriaguru(query)]);

    // Merge: kaloriabazis first, then kaloriaguru, deduplicate by name similarity
    const merged = [...kb];
    for (const item of kg) {
      const duplicate = merged.some(m => m.name.toLowerCase().includes(item.name.toLowerCase().slice(0, 6)) || item.name.toLowerCase().includes(m.name.toLowerCase().slice(0, 6)));
      if (!duplicate) merged.push(item);
    }

    if (merged.length > 0) return res.status(200).json({ results: merged.slice(0, 6) });

    // Fallback to Claude only if both scrapers got nothing
    const fallback = await claudeFallback(query);
    return res.status(200).json({ results: fallback });

  } catch (err) {
    return res.status(500).json({ error: err.message, results: [] });
  }
}

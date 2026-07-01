import { useState, useEffect, useRef } from "react";
import * as XLSX from "xlsx";

// ── CONSTANTS ──────────────────────────────────────────────────────────────
const LIME = "#b5f542";
const BG = "#0a0a0a";
const CARD = "#111111";
const CARD2 = "#161616";
const BORDER = "#222222";
const TEXT = "#e8e8e8";
const MUTED = "#555555";
const RED = "#ff4444";
const BLUE = "#42b5f5";
const ORANGE = "#f5a542";
const PINK = "#f542b5";

const DEFAULT_GOALS = { cal: 2200, protein: 160, carbs: 250, fat: 70 };
const DEFAULT_FOODS = [
  { id: "f1", name: "Csirkemell", cal: 165, protein: 31, carbs: 0, fat: 3.6, weight: 100 },
  { id: "f2", name: "Rizs főtt", cal: 130, protein: 2.7, carbs: 28, fat: 0.3, weight: 100 },
  { id: "f3", name: "Tojás", cal: 78, protein: 6, carbs: 0.6, fat: 5, weight: 60 },
  { id: "f4", name: "Zabpehely", cal: 370, protein: 13, carbs: 58, fat: 7, weight: 100 },
  { id: "f5", name: "Banán", cal: 89, protein: 1.1, carbs: 23, fat: 0.3, weight: 120 },
  { id: "f6", name: "Görög joghurt", cal: 59, protein: 10, carbs: 3.6, fat: 0.4, weight: 100 },
];

const todayStr = () => new Date().toISOString().split("T")[0];
const uid = () => Math.random().toString(36).slice(2, 9);

// ── STORAGE (localStorage) ─────────────────────────────────────────────────
function storageGet(key) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : null; }
  catch { return null; }
}
function storageSet(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch {}
}

// ── SVG RING (responsive size) ────────────────────────────────────────────
function Ring({ value, goal, label, color, size = 80, showRemaining = false }) {
  const pct = Math.min(value / (goal || 1), 1);
  const r = (size - 12) / 2;
  const circ = 2 * Math.PI * r;
  const dash = pct * circ;
  const unit = label === "Kalória" ? "kcal" : "g";
  const cx = size / 2, cy = size / 2;
  const remaining = Math.max(0, Math.round(goal - value));

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, minWidth: 0 }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)", overflow: "visible" }}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={BORDER} strokeWidth={7} />
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth={7}
          strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
          style={{ transition: "stroke-dasharray 0.6s cubic-bezier(.4,2,.6,1)" }} />
        <g style={{ transform: "rotate(90deg)", transformOrigin: `${cx}px ${cy}px` }}>
          <text x={cx} y={cy - 7} textAnchor="middle" dominantBaseline="middle"
            fill={TEXT} fontSize={size * 0.17} fontWeight={700} fontFamily="monospace">
            {showRemaining ? remaining : Math.round(value)}
          </text>
          <text x={cx} y={cy + 8} textAnchor="middle" dominantBaseline="middle"
            fill={MUTED} fontSize={size * 0.1}>
            {showRemaining ? "hátra" : unit}
          </text>
          <text x={cx} y={cy + 19} textAnchor="middle" dominantBaseline="middle"
            fill={color} fontSize={size * 0.12} fontWeight={600}>
            {Math.round(pct * 100)}%
          </text>
        </g>
      </svg>
      <span style={{ fontSize: 10, color: MUTED, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", textAlign: "center" }}>{label}</span>
      <span style={{ fontSize: 10, color: "#333", textAlign: "center" }}>/{goal}{unit}</span>
    </div>
  );
}

// ── MACRO BAR ─────────────────────────────────────────────────────────────
function MacroBar({ label, value, goal, color }) {
  const pct = Math.min((value / (goal || 1)) * 100, 100);
  return (
    <div style={{ marginBottom: 9 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
        <span style={{ color: MUTED, fontSize: 11, fontWeight: 600, letterSpacing: "0.05em" }}>{label}</span>
        <span style={{ color: TEXT, fontSize: 11, fontFamily: "monospace" }}>{Math.round(value)}/{goal}</span>
      </div>
      <div style={{ height: 5, background: BORDER, borderRadius: 3, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 3, transition: "width 0.5s ease" }} />
      </div>
    </div>
  );
}

// ── INPUT ─────────────────────────────────────────────────────────────────
function Input({ label, value, onChange, type = "text", placeholder, min, step, style: sx }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, ...sx }}>
      {label && <label style={{ fontSize: 10, color: MUTED, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>{label}</label>}
      <input type={type} value={value} onChange={onChange} placeholder={placeholder} min={min} step={step}
        style={{ background: CARD2, border: `1px solid ${BORDER}`, borderRadius: 8, color: TEXT, padding: "9px 11px", fontSize: 14, outline: "none", fontFamily: "inherit", width: "100%", boxSizing: "border-box" }}
        onFocus={e => e.target.style.borderColor = LIME}
        onBlur={e => e.target.style.borderColor = BORDER}
      />
    </div>
  );
}

// ── BTN ───────────────────────────────────────────────────────────────────
function Btn({ children, onClick, variant = "primary", small, full, disabled, style: sx }) {
  const styles = {
    primary: { background: LIME, color: "#000", border: "none" },
    ghost: { background: "transparent", color: LIME, border: `1px solid ${LIME}` },
    muted: { background: CARD2, color: TEXT, border: `1px solid ${BORDER}` },
    danger: { background: "transparent", color: RED, border: `1px solid ${RED}` },
  };
  return (
    <button onClick={onClick} disabled={disabled} style={{
      ...styles[variant], borderRadius: 8, padding: small ? "6px 12px" : "10px 18px",
      fontSize: small ? 12 : 14, fontWeight: 700, cursor: disabled ? "not-allowed" : "pointer",
      letterSpacing: "0.04em", fontFamily: "inherit", width: full ? "100%" : "auto",
      opacity: disabled ? 0.4 : 1, transition: "opacity 0.15s", ...sx
    }}>{children}</button>
  );
}

// ── FOOD SEARCH ───────────────────────────────────────────────────────────
function FoodSearch({ onSelect }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef(null);
  const wrapRef = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const search = async (q) => {
    if (!q || q.trim().length < 2) { setResults([]); setSearched(false); setOpen(false); return; }
    setSearching(true);
    setSearched(false);
    try {
      const prompt = `You are a nutrition database. Give accurate nutritional values for: "${q}".
Return ONLY a valid JSON array, no markdown, no backticks, no explanation, nothing else:
[{"name":"magyar neve","cal":number,"protein":number,"carbs":number,"fat":number}]
Rules: all values per 100g, cal in kcal, max 4 variants (e.g. cooked/raw, different types), be precise and realistic. Use standard USDA/Hungarian nutrition data.`;
      const res = await fetch("/api/claude", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-haiku-4-5", max_tokens: 1000,
          messages: [{ role: "user", content: prompt }]
        })
      });
      const data = await res.json();
      const text = (data.content || []).filter(c => c.type === "text").map(c => c.text).join("");
      const clean = text.replace(/```json|```/g, "").trim();
      const match = clean.match(/\[[\s\S]*\]/);
      if (match) { setResults(JSON.parse(match[0])); setOpen(true); }
      else { setResults([]); setOpen(true); }
    } catch { setResults([]); setOpen(true); }
    setSearching(false);
    setSearched(true);
  };

  const handleChange = (e) => {
    const val = e.target.value;
    setQuery(val);
    clearTimeout(debounceRef.current);
    if (val.trim().length >= 2) {
      debounceRef.current = setTimeout(() => search(val), 800);
    } else { setResults([]); setSearched(false); setOpen(false); }
  };

  const handleSelect = (food) => {
    onSelect(food);
    setQuery(""); setResults([]); setSearched(false); setOpen(false);
  };

  return (
    <div ref={wrapRef} style={{ position: "relative", zIndex: 20 }}>
      <div style={{ position: "relative" }}>
        <input type="text" value={query} onChange={handleChange}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder="🔍 Keress ételt pl. csirkemell, rizs..."
          style={{
            width: "100%", boxSizing: "border-box", background: CARD2,
            border: `1px solid ${searching ? LIME : BORDER}`, borderRadius: 10,
            color: TEXT, padding: "12px 42px 12px 14px", fontSize: 14,
            outline: "none", fontFamily: "inherit"
          }}
          onBlur={e => { if (!searching) e.target.style.borderColor = BORDER; }}
        />
        <div style={{ position: "absolute", right: 13, top: "50%", transform: "translateY(-50%)", color: searching ? LIME : MUTED, fontSize: 16, pointerEvents: "none" }}>
          {searching ? "⟳" : "🔍"}
        </div>
      </div>
      {open && (results.length > 0 || (searched && !searching)) && (
        <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, background: CARD, border: `1px solid ${LIME}`, borderRadius: 10, zIndex: 99, overflow: "hidden", boxShadow: "0 8px 32px rgba(0,0,0,0.7)" }}>
          {results.length === 0
            ? <div style={{ padding: "14px 16px", color: MUTED, fontSize: 13 }}>Nincs találat — töltsd ki manuálisan.</div>
            : results.map((food, i) => (
              <div key={i} onClick={() => handleSelect(food)}
                style={{ padding: "11px 15px", cursor: "pointer", borderBottom: i < results.length - 1 ? `1px solid ${BORDER}` : "none" }}
                onMouseEnter={e => e.currentTarget.style.background = CARD2}
                onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                <div style={{ fontWeight: 600, fontSize: 14, color: TEXT, marginBottom: 2 }}>{food.name}</div>
                <div style={{ fontSize: 11, color: MUTED, fontFamily: "monospace" }}>
                  <span style={{ color: LIME }}>{food.cal} kcal</span>
                  {" · "}P:{food.protein}g C:{food.carbs}g F:{food.fat}g
                  <span style={{ color: "#333" }}> /100g</span>
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}

// ── TODAY TAB ─────────────────────────────────────────────────────────────
function TodayTab({ date, setDate, log, setLog, goals, setSavedFoods }) {
  const [form, setForm] = useState({ name: "", cal: "", protein: "", carbs: "", fat: "", weight: "100" });
  const [saveQuick, setSaveQuick] = useState(false);
  const [base100, setBase100] = useState(null);
  const [showRemaining, setShowRemaining] = useState(true);

  const dayLog = log[date] || [];
  const totals = dayLog.reduce((a, e) => ({ cal: a.cal + e.cal, protein: a.protein + e.protein, carbs: a.carbs + e.carbs, fat: a.fat + e.fat }), { cal: 0, protein: 0, carbs: 0, fat: 0 });

  const setWeight = (val) => {
    const num = Math.max(1, val);
    if (base100) {
      const r = num / 100;
      setForm(p => ({ ...p, weight: String(num), cal: +(base100.cal * r).toFixed(1), protein: +(base100.protein * r).toFixed(1), carbs: +(base100.carbs * r).toFixed(1), fat: +(base100.fat * r).toFixed(1) }));
    } else { setForm(p => ({ ...p, weight: String(num) })); }
  };

  const handleWeightChange = (val) => {
    if (val === "") { setForm(p => ({ ...p, weight: "" })); return; }
    setWeight(+val);
  };

  const bumpWeight = (delta) => setWeight((+form.weight || 0) + delta);

  const handleSearchSelect = (food) => {
    setBase100({ cal: food.cal, protein: food.protein, carbs: food.carbs, fat: food.fat });
    setForm({ name: food.name, cal: food.cal, protein: food.protein, carbs: food.carbs, fat: food.fat, weight: "100" });
  };

  const addEntry = () => {
    if (!form.name || !form.cal) return;
    const entry = { id: uid(), name: form.name, cal: +form.cal || 0, protein: +form.protein || 0, carbs: +form.carbs || 0, fat: +form.fat || 0, weight: +form.weight || 100 };
    setLog(p => ({ ...p, [date]: [...(p[date] || []), entry] }));
    if (saveQuick) setSavedFoods(p => [...p, { id: uid(), name: form.name, cal: base100?.cal ?? +form.cal, protein: base100?.protein ?? +form.protein, carbs: base100?.carbs ?? +form.carbs, fat: base100?.fat ?? +form.fat, weight: 100 }]);
    setForm({ name: "", cal: "", protein: "", carbs: "", fat: "", weight: "100" });
    setBase100(null); setSaveQuick(false);
  };

  const removeEntry = id => setLog(p => ({ ...p, [date]: (p[date] || []).filter(e => e.id !== id) }));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {/* Date picker */}
      <input type="date" value={date} onChange={e => setDate(e.target.value)}
        style={{ background: CARD2, border: `1px solid ${BORDER}`, borderRadius: 8, color: TEXT, padding: "9px 12px", fontSize: 14, outline: "none", fontFamily: "inherit", width: "100%", boxSizing: "border-box" }}
        onFocus={e => e.target.style.borderColor = LIME} onBlur={e => e.target.style.borderColor = BORDER}
      />

      {/* Rings — 2x2 grid on mobile. Tap calorie ring to toggle remaining/consumed */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        {[
          { label: "Kalória", value: totals.cal, goal: goals.cal, color: LIME, tappable: true },
          { label: "Fehérje", value: totals.protein, goal: goals.protein, color: BLUE },
          { label: "Szénhidrát", value: totals.carbs, goal: goals.carbs, color: ORANGE },
          { label: "Zsír", value: totals.fat, goal: goals.fat, color: PINK },
        ].map(r => (
          <div key={r.label}
            onClick={r.tappable ? () => setShowRemaining(s => !s) : undefined}
            style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: "14px 8px", display: "flex", justifyContent: "center", cursor: r.tappable ? "pointer" : "default" }}>
            <Ring {...r} size={90} showRemaining={r.tappable && showRemaining} />
          </div>
        ))}
      </div>

      {/* Add food form */}
      <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 16 }}>
        <div style={{ fontSize: 12, color: LIME, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 14 }}>⊕ Étel hozzáadása</div>

        <FoodSearch onSelect={handleSearchSelect} />

        <div style={{ height: 1, background: BORDER, margin: "14px 0" }} />

        <div style={{ fontSize: 10, color: base100 ? LIME : MUTED, fontWeight: 700, letterSpacing: "0.08em", marginBottom: 10 }}>
          {base100 ? "✓ KITÖLTVE — állítsd a grammot" : "MANUÁLIS BEVITEL"}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <Input label="Étel neve" value={form.name} placeholder="pl. Csirkemell" onChange={e => setForm(p => ({ ...p, name: e.target.value }))} style={{ gridColumn: "1/-1" }} />

          <div style={{ gridColumn: "1/-1", display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={{ fontSize: 10, color: MUTED, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>Tömeg (g)</label>
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <input type="number" inputMode="numeric" value={form.weight} min="1"
                onChange={e => handleWeightChange(e.target.value)}
                style={{ flex: 1, minWidth: 0, background: CARD2, border: `1px solid ${BORDER}`, borderRadius: 8, color: TEXT, padding: "9px 11px", fontSize: 14, outline: "none", fontFamily: "inherit", boxSizing: "border-box" }}
                onFocus={e => e.target.style.borderColor = LIME} onBlur={e => e.target.style.borderColor = BORDER}
              />
              <Btn small variant="muted" onClick={() => bumpWeight(10)}>+10g</Btn>
              <Btn small variant="muted" onClick={() => bumpWeight(100)}>+100g</Btn>
            </div>
          </div>

          <Input label="Kalória" type="number" value={form.cal} min="0" onChange={e => { setBase100(null); setForm(p => ({ ...p, cal: e.target.value })); }} />
          <Input label="Fehérje (g)" type="number" value={form.protein} min="0" step="0.1" onChange={e => { setBase100(null); setForm(p => ({ ...p, protein: e.target.value })); }} />
          <Input label="Szénhidrát (g)" type="number" value={form.carbs} min="0" step="0.1" onChange={e => { setBase100(null); setForm(p => ({ ...p, carbs: e.target.value })); }} />
          <Input label="Zsír (g)" type="number" value={form.fat} min="0" step="0.1" onChange={e => { setBase100(null); setForm(p => ({ ...p, fat: e.target.value })); }} />
        </div>

        <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, color: MUTED, margin: "12px 0" }}>
          <input type="checkbox" checked={saveQuick} onChange={e => setSaveQuick(e.target.checked)} style={{ accentColor: LIME, width: 15, height: 15 }} />
          Mentés gyors ételként
        </label>

        <Btn onClick={addEntry} full disabled={!form.name || !form.cal}>Hozzáadás</Btn>
      </div>

      {/* Log */}
      {dayLog.length > 0 && (
        <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 16 }}>
          <div style={{ fontSize: 12, color: MUTED, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 12 }}>Rögzített ételek</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {dayLog.map(e => (
              <div key={e.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px", background: CARD2, borderRadius: 8, border: `1px solid ${BORDER}` }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 13, color: TEXT, marginBottom: 2 }}>{e.name} <span style={{ color: MUTED, fontWeight: 400 }}>{e.weight}g</span></div>
                  <div style={{ fontSize: 11, color: MUTED, fontFamily: "monospace" }}>
                    <span style={{ color: LIME }}>{Math.round(e.cal)}kcal</span> · P:{e.protein} C:{e.carbs} F:{e.fat}
                  </div>
                </div>
                <button onClick={() => removeEntry(e.id)} style={{ background: "none", border: "none", color: RED, cursor: "pointer", fontSize: 20, padding: "0 4px", flexShrink: 0 }}>×</button>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 12, padding: "10px 12px", background: CARD2, borderRadius: 8, fontSize: 12, fontFamily: "monospace", color: MUTED }}>
            Összesen: <span style={{ color: LIME }}>{Math.round(totals.cal)} kcal</span> · P:{Math.round(totals.protein)}g C:{Math.round(totals.carbs)}g F:{Math.round(totals.fat)}g
          </div>
        </div>
      )}
    </div>
  );
}

// ── QUICK TAB ─────────────────────────────────────────────────────────────
function QuickTab({ savedFoods, setSavedFoods, date, setLog }) {
  const [weights, setWeights] = useState({});
  const [added, setAdded] = useState({});

  const getW = (food) => weights[food.id] !== undefined ? weights[food.id] : food.weight;
  const scale = (food, field) => Math.round((food[field] / food.weight) * (getW(food) || 1) * 10) / 10;

  const bump = (food, delta) => {
    setWeights(p => ({ ...p, [food.id]: Math.max(1, (p[food.id] !== undefined ? p[food.id] : food.weight) + delta) }));
  };

  const setW = (food, val) => {
    if (val === "") { setWeights(p => ({ ...p, [food.id]: "" })); return; }
    const num = parseInt(val, 10);
    if (!isNaN(num)) setWeights(p => ({ ...p, [food.id]: Math.max(1, num) }));
  };

  const addToDay = (food) => {
    const w = getW(food) || food.weight;
    setLog(p => ({ ...p, [date]: [...(p[date] || []), { id: uid(), name: food.name, cal: scale(food, "cal"), protein: scale(food, "protein"), carbs: scale(food, "carbs"), fat: scale(food, "fat"), weight: w }] }));
    setAdded(p => ({ ...p, [food.id]: true }));
    setTimeout(() => setAdded(p => ({ ...p, [food.id]: false })), 1800);
  };

  if (savedFoods.length === 0) return <p style={{ color: MUTED, fontSize: 13 }}>Még nincs mentett étel. A Ma fülön pipáld be a "Mentés gyors ételként" opciót.</p>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {savedFoods.map(food => {
        const w = getW(food);
        const justAdded = !!added[food.id];
        return (
          <div key={food.id} style={{ background: CARD, border: `1px solid ${justAdded ? LIME : BORDER}`, borderRadius: 12, padding: 14, transition: "border-color 0.3s" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <span style={{ fontWeight: 700, fontSize: 14, color: TEXT }}>{food.name}</span>
              <button onClick={() => setSavedFoods(p => p.filter(f => f.id !== food.id))} style={{ background: "none", border: "none", color: MUTED, cursor: "pointer", fontSize: 15 }}>🗑</button>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10, flexWrap: "wrap" }}>
              <Btn small variant="muted" onClick={() => bump(food, -10)}>−10</Btn>
              <input type="number" inputMode="numeric" min="1" value={w}
                onChange={e => setW(food, e.target.value)}
                onBlur={e => { if (e.target.value === "") setWeights(p => ({ ...p, [food.id]: food.weight })); }}
                style={{ width: 60, background: CARD2, border: "1px solid " + BORDER, borderRadius: 8, color: TEXT, padding: "6px 8px", fontSize: 14, textAlign: "center", fontFamily: "monospace", outline: "none", boxSizing: "border-box" }}
                onFocus={e => e.target.style.borderColor = LIME}
              />
              <span style={{ color: MUTED, fontSize: 12 }}>g</span>
              <Btn small variant="muted" onClick={() => bump(food, 10)}>+10</Btn>
              <Btn small variant="muted" onClick={() => bump(food, 100)}>+100</Btn>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 6, marginBottom: 12 }}>
              {[[scale(food, "cal"), "kcal", LIME], [scale(food, "protein"), "P", BLUE], [scale(food, "carbs"), "C", ORANGE], [scale(food, "fat"), "F", PINK]].map(([v, l, c]) => (
                <div key={l} style={{ textAlign: "center", background: CARD2, borderRadius: 8, padding: "8px 4px" }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: c, fontFamily: "monospace" }}>{v}</div>
                  <div style={{ fontSize: 10, color: MUTED, marginTop: 1 }}>{l}</div>
                </div>
              ))}
            </div>
            <button onClick={() => !justAdded && addToDay(food)} style={{
              width: "100%", padding: "9px 0", borderRadius: 8, fontSize: 13, fontWeight: 700,
              cursor: justAdded ? "default" : "pointer", border: "none", fontFamily: "inherit",
              background: justAdded ? "#1a3a00" : LIME, color: justAdded ? LIME : "#000",
              transition: "all 0.3s", letterSpacing: "0.04em",
            }}>
              {justAdded ? "✓ Hozzáadva!" : "+ Hozzáadás a mai naphoz"}
            </button>
          </div>
        );
      })}
    </div>
  );
}

// ── PHOTO TAB ─────────────────────────────────────────────────────────────
function PhotoTab({ date, setLog }) {
  const [imgData, setImgData] = useState(null);
  const [extra, setExtra] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        const MAX = 1024;
        let { width, height } = img;
        if (width > MAX || height > MAX) {
          const ratio = Math.min(MAX / width, MAX / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }
        const canvas = document.createElement("canvas");
        canvas.width = width; canvas.height = height;
        canvas.getContext("2d").drawImage(img, 0, 0, width, height);
        const compressed = canvas.toDataURL("image/jpeg", 0.7);
        setImgData(compressed); setResult(null); setError(null);
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const analyze = async () => {
    if (!imgData) return;
    setLoading(true); setError(null);
    try {
      const base64 = imgData.split(",")[1];
      const mediaType = imgData.split(";")[0].split(":")[1];
      const res = await fetch("/api/claude", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-6", max_tokens: 1000,
          messages: [{ role: "user", content: [
            { type: "image", source: { type: "base64", media_type: mediaType, data: base64 } },
            { type: "text", text: "Analyze this food image. Return ONLY valid JSON, no markdown:\n{\"name\":\"magyar neve\",\"cal\":number,\"protein\":number,\"carbs\":number,\"fat\":number}\nAll macros in grams for the full visible portion. Cal in kcal." + (extra ? " Extra info: " + extra : "") }
          ]}]
        })
      });
      const data = await res.json();
      const text = (data.content || []).map(c => c.text || "").join("");
      const clean = text.replace(/```json|```/g, "").trim();
      const match = clean.match(/\{[\s\S]*\}/);
      if (match) setResult(JSON.parse(match[0]));
      else setError("Nem sikerült elemezni. Próbáld újra!");
    } catch { setError("API hiba. Próbáld újra!"); }
    setLoading(false);
  };

  const addToDay = () => {
    if (!result) return;
    setLog(p => ({ ...p, [date]: [...(p[date] || []), { id: uid(), ...result, weight: 100 }] }));
    setResult(null); setImgData(null); setExtra("");
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Hidden inputs: gallery + camera */}
      <input type="file" id="food-img-gallery" accept="image/*" style={{ display: "none" }} onChange={handleFile} />
      <input type="file" id="food-img-camera" accept="image/*" capture="environment" style={{ display: "none" }} onChange={handleFile} />

      {/* Image preview or placeholder */}
      {imgData
        ? <div style={{ position: "relative", borderRadius: 14, overflow: "hidden", border: "2px solid " + LIME }}>
            <img src={imgData} alt="preview" style={{ width: "100%", maxHeight: 300, objectFit: "contain", display: "block", background: CARD2 }} />
            <button onClick={() => { setImgData(null); setResult(null); setError(null); }}
              style={{ position: "absolute", top: 10, right: 10, background: "rgba(0,0,0,0.7)", border: "none", color: TEXT, borderRadius: 20, width: 30, height: 30, cursor: "pointer", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>
          </div>
        : <div style={{ display: "flex", gap: 10 }}>
            <label htmlFor="food-img-gallery" style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 120, background: CARD, border: "2px dashed " + BORDER, borderRadius: 14, cursor: "pointer", gap: 8 }}>
              <span style={{ fontSize: 28 }}>🖼️</span>
              <span style={{ color: LIME, fontWeight: 700, fontSize: 13 }}>Galéria</span>
            </label>
            <label htmlFor="food-img-camera" style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 120, background: CARD, border: "2px dashed " + BORDER, borderRadius: 14, cursor: "pointer", gap: 8 }}>
              <span style={{ fontSize: 28 }}>📷</span>
              <span style={{ color: LIME, fontWeight: 700, fontSize: 13 }}>Kamera</span>
            </label>
          </div>
      }

      <Input label="Extra info (opcionális)" value={extra} onChange={e => setExtra(e.target.value)} placeholder="pl. 200g adag, sózott..." />
      <Btn onClick={analyze} full disabled={!imgData || loading}>{loading ? "⟳ Elemzés..." : "🔍 Elemzés Claude-dal"}</Btn>

      {error && <div style={{ color: RED, fontSize: 13, padding: "10px 14px", background: "#1a0000", borderRadius: 8, border: "1px solid " + RED }}>{error}</div>}

      {result && (
        <div style={{ background: CARD, border: "1px solid " + LIME, borderRadius: 12, padding: 16 }}>
          <div style={{ fontWeight: 700, color: LIME, fontSize: 15, marginBottom: 12 }}>{result.name}</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8, marginBottom: 14 }}>
            {[[result.cal, "kcal", LIME], [result.protein, "P(g)", BLUE], [result.carbs, "C(g)", ORANGE], [result.fat, "F(g)", PINK]].map(([v, l, c]) => (
              <div key={l} style={{ textAlign: "center", background: CARD2, borderRadius: 8, padding: "10px 4px" }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: c, fontFamily: "monospace" }}>{v}</div>
                <div style={{ fontSize: 10, color: MUTED, marginTop: 3 }}>{l}</div>
              </div>
            ))}
          </div>
          <Btn onClick={addToDay} full>+ Hozzáadás a mai naphoz</Btn>
        </div>
      )}
    </div>
  );
}

// ── HISTORY TAB ───────────────────────────────────────────────────────────
function HistoryTab({ log, goals }) {
  const days = Object.keys(log).sort((a, b) => a.localeCompare(b));

  const exportXLSX = () => {
    const wb = XLSX.utils.book_new();

    // 1. munkalap: minden étel dátummal
    const allRows = [];
    days.forEach(day => {
      (log[day] || []).forEach(e => {
        allRows.push({
          "Dátum": day,
          "Étel": e.name,
          "Tömeg (g)": e.weight,
          "Kalória (kcal)": Math.round(e.cal),
          "Fehérje (g)": e.protein,
          "Szénhidrát (g)": e.carbs,
          "Zsír (g)": e.fat,
        });
      });
    });
    const ws1 = XLSX.utils.json_to_sheet(allRows);
    ws1["!cols"] = [{ wch: 12 }, { wch: 24 }, { wch: 10 }, { wch: 16 }, { wch: 13 }, { wch: 15 }, { wch: 10 }];
    XLSX.utils.book_append_sheet(wb, ws1, "Ételnapló");

    // 2. munkalap: napi összesítő
    const summaryRows = days.map(day => {
      const entries = log[day] || [];
      const t = entries.reduce((a, e) => ({ cal: a.cal + e.cal, protein: a.protein + e.protein, carbs: a.carbs + e.carbs, fat: a.fat + e.fat }), { cal: 0, protein: 0, carbs: 0, fat: 0 });
      return {
        "Dátum": day,
        "Ételek száma": entries.length,
        "Kalória (kcal)": Math.round(t.cal),
        "Kcal cél": goals.cal,
        "Kcal %": Math.round((t.cal / goals.cal) * 100) + "%",
        "Fehérje (g)": Math.round(t.protein),
        "Fehérje cél": goals.protein,
        "Szénhidrát (g)": Math.round(t.carbs),
        "Szénhidrát cél": goals.carbs,
        "Zsír (g)": Math.round(t.fat),
        "Zsír cél": goals.fat,
      };
    });
    const ws2 = XLSX.utils.json_to_sheet(summaryRows);
    ws2["!cols"] = [{ wch: 12 }, { wch: 14 }, { wch: 16 }, { wch: 12 }, { wch: 10 }, { wch: 13 }, { wch: 13 }, { wch: 15 }, { wch: 15 }, { wch: 10 }, { wch: 10 }];
    XLSX.utils.book_append_sheet(wb, ws2, "Napi összesítő");

    XLSX.writeFile(wb, "makro_naplo.xlsx");
  };

  if (days.length === 0) return <p style={{ color: MUTED, fontSize: 13 }}>Még nincs rögzített nap.</p>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <Btn onClick={exportXLSX} variant="ghost" full>📥 Excel export</Btn>
      {days.map(day => {
        const entries = log[day] || [];
        const t = entries.reduce((a, e) => ({ cal: a.cal + e.cal, protein: a.protein + e.protein, carbs: a.carbs + e.carbs, fat: a.fat + e.fat }), { cal: 0, protein: 0, carbs: 0, fat: 0 });
        return (
          <div key={day} style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 14 }}>
            <div style={{ fontWeight: 700, color: TEXT, fontSize: 14, marginBottom: 10 }}>{day}</div>
            <MacroBar label="Kalória" value={t.cal} goal={goals.cal} color={LIME} />
            <MacroBar label="Fehérje" value={t.protein} goal={goals.protein} color={BLUE} />
            <MacroBar label="Szénhidrát" value={t.carbs} goal={goals.carbs} color={ORANGE} />
            <MacroBar label="Zsír" value={t.fat} goal={goals.fat} color={PINK} />
            <div style={{ marginTop: 8, fontSize: 11, color: MUTED, fontFamily: "monospace" }}>
              {entries.length} étel · <span style={{ color: LIME }}>{Math.round(t.cal)} kcal</span> · P:{Math.round(t.protein)}g C:{Math.round(t.carbs)}g F:{Math.round(t.fat)}g
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── GOALS MODAL ───────────────────────────────────────────────────────────
function GoalsModal({ goals, setGoals, onClose }) {
  const [local, setLocal] = useState({ ...goals });
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.88)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ background: CARD, border: `1px solid ${LIME}`, borderRadius: 16, padding: 24, width: "100%", maxWidth: 360 }}>
        <div style={{ fontSize: 15, color: LIME, fontWeight: 800, letterSpacing: "0.08em", marginBottom: 18 }}>⚙ Napi célok</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 20 }}>
          <Input label="Kalória (kcal)" type="number" value={local.cal} onChange={e => setLocal(p => ({ ...p, cal: +e.target.value }))} />
          <Input label="Fehérje (g)" type="number" value={local.protein} onChange={e => setLocal(p => ({ ...p, protein: +e.target.value }))} />
          <Input label="Szénhidrát (g)" type="number" value={local.carbs} onChange={e => setLocal(p => ({ ...p, carbs: +e.target.value }))} />
          <Input label="Zsír (g)" type="number" value={local.fat} onChange={e => setLocal(p => ({ ...p, fat: +e.target.value }))} />
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <Btn onClick={() => { setGoals(local); onClose(); }} full>Mentés</Btn>
          <Btn variant="ghost" onClick={onClose} full>Mégse</Btn>
        </div>
      </div>
    </div>
  );
}

// ── APP ───────────────────────────────────────────────────────────────────
export default function App() {
  const [tab, setTab] = useState("today");
  const [date, setDate] = useState(todayStr());
  const [log, setLog] = useState({});
  const [goals, setGoals] = useState(DEFAULT_GOALS);
  const [savedFoods, setSavedFoods] = useState(DEFAULT_FOODS);
  const [goalsOpen, setGoalsOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const l = storageGet("macro-log");
    const g = storageGet("macro-goals");
    const f = storageGet("macro-foods");
    if (l) setLog(l);
    if (g) setGoals(g);
    if (f) setSavedFoods(f);
    setLoaded(true);
  }, []);

  useEffect(() => { if (loaded) storageSet("macro-log", log); }, [log, loaded]);
  useEffect(() => { if (loaded) storageSet("macro-goals", goals); }, [goals, loaded]);
  useEffect(() => { if (loaded) storageSet("macro-foods", savedFoods); }, [savedFoods, loaded]);

  if (!loaded) return (
    <div style={{ minHeight: "100dvh", background: BG, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ color: LIME, fontSize: 13, fontWeight: 700, letterSpacing: "0.1em" }}>BETÖLTÉS...</div>
    </div>
  );

  const TABS = [
    { id: "today", label: "📊 Ma" },
    { id: "quick", label: "⚡ Gyors" },
    { id: "photo", label: "📷 Képből" },
    { id: "history", label: "📅 Előzmény" },
  ];

  return (
    <div style={{ minHeight: "100dvh", background: BG, color: TEXT, fontFamily: "'Inter',-apple-system,sans-serif" }}>
      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: ${BG}; color: ${TEXT}; overflow-x: hidden; }
        input[type=number]::-webkit-inner-spin-button,
        input[type=number]::-webkit-outer-spin-button { opacity: 1; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: ${BG}; }
        ::-webkit-scrollbar-thumb { background: ${BORDER}; border-radius: 2px; }
      `}</style>

      {/* HEADER */}
      <div style={{ position: "sticky", top: 0, zIndex: 50, background: `${BG}f5`, backdropFilter: "blur(12px)", borderBottom: `1px solid ${BORDER}` }}>
        <div style={{ maxWidth: 600, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", height: 52, padding: "0 16px" }}>
          <span style={{ fontSize: 20, fontWeight: 900, color: LIME, letterSpacing: "-0.02em" }}>
            MACRO<span style={{ color: TEXT }}>OS</span>
            <span style={{ fontSize: 9, color: MUTED, fontWeight: 600, letterSpacing: "0.1em", border: `1px solid ${BORDER}`, borderRadius: 3, padding: "1px 5px", marginLeft: 6, verticalAlign: "middle" }}>PRO</span>
          </span>
          <button onClick={() => setGoalsOpen(true)} style={{ background: "transparent", border: `1px solid ${BORDER}`, borderRadius: 7, color: MUTED, padding: "5px 12px", fontSize: 12, cursor: "pointer", fontFamily: "inherit", fontWeight: 600 }}>
            ⚙ Célok
          </button>
        </div>
      </div>

      {/* TAB BAR — scrollable on very narrow screens */}
      <div style={{ borderBottom: `1px solid ${BORDER}`, background: CARD, overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
        <div style={{ display: "flex", minWidth: "max-content", maxWidth: 600, margin: "0 auto", padding: "0 8px" }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              background: "none", border: "none", color: tab === t.id ? LIME : MUTED,
              padding: "13px 14px", fontSize: 13, fontWeight: tab === t.id ? 700 : 500,
              cursor: "pointer", borderBottom: `2px solid ${tab === t.id ? LIME : "transparent"}`,
              fontFamily: "inherit", whiteSpace: "nowrap", marginBottom: -1,
            }}>{t.label}</button>
          ))}
        </div>
      </div>

      {/* CONTENT */}
      <div style={{ maxWidth: 600, margin: "0 auto", padding: "16px 14px 40px" }}>
        {tab === "today" && <TodayTab date={date} setDate={setDate} log={log} setLog={setLog} goals={goals} setSavedFoods={setSavedFoods} />}
        {tab === "quick" && <QuickTab savedFoods={savedFoods} setSavedFoods={setSavedFoods} date={date} setLog={setLog} />}
        {tab === "photo" && <PhotoTab date={date} setLog={setLog} />}
        {tab === "history" && <HistoryTab log={log} goals={goals} />}
      </div>

      {goalsOpen && <GoalsModal goals={goals} setGoals={setGoals} onClose={() => setGoalsOpen(false)} />}
    </div>
  );
}

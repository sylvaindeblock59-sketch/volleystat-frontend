import { useState, useEffect } from "react";

const API_URL = "https://volleystat-backend.onrender.com";

const POSTES = ["Passeuse", "Centrale", "Pointue", "Réceptionneuse", "Libéro", "Universelle"];

// Roster VBC Bailleulois 2024-2025 comme point de départ pour une nouvelle saison
const DEFAULT_ROSTER = [
  { number: 2,  prenom: "Romane",   nom: "Finet",      poste: "Réceptionneuse" },
  { number: 3,  prenom: "Doriane",  nom: "Ehret",       poste: "Pointue" },
  { number: 4,  prenom: "Maeline",  nom: "Facon",       poste: "Centrale" },
  { number: 6,  prenom: "Sarah",    nom: "Gokelaere",   poste: "Passeuse" },
  { number: 7,  prenom: "Chloé",    nom: "Adam",        poste: "Pointue" },
  { number: 8,  prenom: "Marjorie", nom: "Machen",      poste: "Libéro" },
  { number: 9,  prenom: "Zoé",      nom: "Vanmerris",   poste: "Centrale" },
  { number: 10, prenom: "Candice",  nom: "Eeckhoutte",  poste: "Réceptionneuse" },
  { number: 11, prenom: "Alix",     nom: "Lamerand",    poste: "Réceptionneuse" },
  { number: 12, prenom: "Julie",    nom: "Adam",        poste: "Centrale" },
  { number: 13, prenom: "Elise",    nom: "Deremetz",    poste: "Réceptionneuse" },
  { number: 14, prenom: "Maelle",   nom: "Moreels",     poste: "Libéro" },
  { number: 16, prenom: "Zélie",    nom: "Veron",       poste: "Réceptionneuse" },
  { number: 19, prenom: "Marine",   nom: "Degrendel",   poste: "Passeuse" },
  { number: 20, prenom: "Manon",    nom: "Clyti",       poste: "Centrale" },
];

const POSTE_COLORS = {
  "Passeuse":       { bg: "#fef3c7", color: "#d97706" },
  "Centrale":       { bg: "#ede9fe", color: "#7c3aed" },
  "Pointue":        { bg: "#fee2e2", color: "#dc2626" },
  "Réceptionneuse": { bg: "#dcfce7", color: "#16a34a" },
  "Libéro":         { bg: "#dbeafe", color: "#2563eb" },
  "Universelle":    { bg: "#f1f5f9", color: "#64748b" },
};

export default function Seasons({ onBack, C, s: styles }) {
  const [seasons, setSeasons]       = useState([]);
  const [loading, setLoading]       = useState(true);
  const [editingSeason, setEditing] = useState(null); // null | season object | "new"
  const [saving, setSaving]         = useState(false);
  const [error, setError]           = useState(null);

  // ── Formulaire saison ──────────────────────────────────────────────────
  const emptyForm = { nom: "", club: "VBC Bailleulois", division: "N3F", poule: "", active: false, roster: [] };
  const [form, setForm] = useState(emptyForm);
  const [newPlayer, setNewPlayer] = useState({ number: "", prenom: "", nom: "", poste: "Centrale" });

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/seasons/`);
      setSeasons(await res.json());
    } catch { setError("Erreur de chargement"); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const openEdit = (season) => {
    setForm({ ...season });
    setEditing(season.id);
    setError(null);
  };

  const openNew = (copyFrom = null) => {
    if (copyFrom) {
      setForm({ ...copyFrom, nom: "", active: false, roster: copyFrom.roster.map(p => ({ ...p })) });
    } else {
      setForm({ ...emptyForm, roster: DEFAULT_ROSTER.map(p => ({ ...p })) });
    }
    setEditing("new");
    setError(null);
  };

  const save = async () => {
    if (!form.nom.trim()) { setError("Le nom de la saison est obligatoire."); return; }
    setSaving(true);
    setError(null);
    try {
      const isNew = editingSeason === "new";
      const url   = isNew ? `${API_URL}/seasons/` : `${API_URL}/seasons/${editingSeason}`;
      const method = isNew ? "POST" : "PATCH";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Erreur serveur");
      }
      setEditing(null);
      await load();
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  };

  const setActive = async (id) => {
    await fetch(`${API_URL}/seasons/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: true }),
    });
    await load();
  };

  const deleteSeason = async (id) => {
    if (!window.confirm("Supprimer cette saison ? (impossible si des matchs y sont rattachés)")) return;
    const res = await fetch(`${API_URL}/seasons/${id}`, { method: "DELETE" });
    if (!res.ok) { const e = await res.json(); alert(e.detail); return; }
    await load();
  };

  // ── Gestion du roster ──────────────────────────────────────────────────
  const addPlayer = () => {
    if (!newPlayer.prenom.trim() || !newPlayer.nom.trim()) return;
    const num = parseInt(newPlayer.number) || 0;
    setForm(f => ({ ...f, roster: [...f.roster, { ...newPlayer, number: num }] }));
    setNewPlayer({ number: "", prenom: "", nom: "", poste: "Centrale" });
  };

  const removePlayer = (idx) => setForm(f => ({ ...f, roster: f.roster.filter((_, i) => i !== idx) }));

  const updatePlayer = (idx, field, val) => {
    setForm(f => ({ ...f, roster: f.roster.map((p, i) => i === idx ? { ...p, [field]: field === "number" ? (parseInt(val) || 0) : val } : p) }));
  };

  const movePlayer = (idx, dir) => {
    const roster = [...form.roster];
    const to = idx + dir;
    if (to < 0 || to >= roster.length) return;
    [roster[idx], roster[to]] = [roster[to], roster[idx]];
    setForm(f => ({ ...f, roster }));
  };

  // ══════════════════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════════════════

  // Palette de couleurs de secours si non transmise
  const C2 = C || {
    blue:"#2563eb",blueXlt:"#dbeafe",white:"#ffffff",gray50:"#f8fafc",
    gray100:"#f1f5f9",gray200:"#e2e8f0",gray400:"#94a3b8",gray800:"#1e293b",
    green:"#16a34a",red:"#dc2626",gold:"#d97706",
  };
  const card = { background: C2.white, borderRadius: 12, boxShadow: "0 1px 4px rgba(0,0,0,0.08)", padding: "20px 24px", marginBottom: 16 };
  const input = { width: "100%", padding: "8px 10px", borderRadius: 6, border: `1px solid ${C2.gray200}`, fontSize: 13, outline: "none", boxSizing: "border-box", color: C2.gray800, background: C2.white };
  const label = { display: "block", fontSize: 11, fontWeight: 700, color: C2.gray400, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 };
  const btn = (v="primary") => ({
    padding: "8px 16px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600,
    background: v === "primary" ? C2.blue : v === "success" ? C2.green : v === "danger" ? C2.red : v === "ghost" ? "transparent" : C2.gray100,
    color: ["primary","success","danger"].includes(v) ? "#fff" : v === "ghost" ? C2.gray400 : C2.gray800,
  });

  // ── Formulaire d'édition ──────────────────────────────────────────────
  if (editingSeason !== null) {
    const isNew = editingSeason === "new";
    const sortedRoster = [...form.roster].sort((a, b) => a.number - b.number);

    return (
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "24px 16px" }}>
        <button onClick={() => setEditing(null)} style={{ ...btn("ghost"), marginBottom: 16, fontSize: 12 }}>← Retour aux saisons</button>
        <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 20, color: C2.gray800 }}>
          {isNew ? "Nouvelle saison" : `Modifier — ${form.nom}`}
        </h2>

        {error && <div style={{ background: "#fee2e2", color: C2.red, borderRadius: 8, padding: "10px 14px", marginBottom: 16, fontSize: 13 }}>{error}</div>}

        {/* Infos générales */}
        <div style={{ ...card }}>
          <p style={{ fontWeight: 700, fontSize: 14, marginBottom: 14, color: C2.gray800 }}>Informations générales</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12 }}>
            <div>
              <label style={label}>Saison *</label>
              <input style={input} placeholder="ex. 2025-2026" value={form.nom} onChange={e => setForm(f => ({ ...f, nom: e.target.value }))} />
            </div>
            <div>
              <label style={label}>Club</label>
              <input style={input} value={form.club} onChange={e => setForm(f => ({ ...f, club: e.target.value }))} />
            </div>
            <div>
              <label style={label}>Division</label>
              <input style={input} placeholder="N3F, Nat2, R1…" value={form.division} onChange={e => setForm(f => ({ ...f, division: e.target.value }))} />
            </div>
            <div>
              <label style={label}>Poule</label>
              <input style={input} placeholder="Poule A, Poule B…" value={form.poule} onChange={e => setForm(f => ({ ...f, poule: e.target.value }))} />
            </div>
          </div>
          <div style={{ marginTop: 12 }}>
            <label style={{ fontSize: 13, color: C2.gray800, display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
              <input type="checkbox" checked={form.active} onChange={e => setForm(f => ({ ...f, active: e.target.checked }))} />
              Saison active (utilisée pour les nouveaux matchs)
            </label>
          </div>
        </div>

        {/* Roster */}
        <div style={{ ...card }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <p style={{ fontWeight: 700, fontSize: 14, color: C2.gray800, margin: 0 }}>
              Effectif — {form.roster.length} joueuses
            </p>
            <span style={{ fontSize: 12, color: C2.gray400 }}>Tri par numéro dans l'app</span>
          </div>

          {/* Tableau des joueuses existantes */}
          <div style={{ overflowX: "auto", marginBottom: 16 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: C2.gray50 }}>
                  {["#", "Prénom", "Nom", "Poste", "Ordre", ""].map(h => (
                    <th key={h} style={{ padding: "8px 10px", textAlign: h === "#" || h === "Ordre" || h === "" ? "center" : "left", fontWeight: 700, fontSize: 11, color: C2.gray400, textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: `1px solid ${C2.gray200}` }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {form.roster.map((p, i) => {
                  const pc = POSTE_COLORS[p.poste] || POSTE_COLORS["Universelle"];
                  return (
                    <tr key={i} style={{ borderBottom: `1px solid ${C2.gray100}` }}>
                      <td style={{ padding: "6px 10px", textAlign: "center" }}>
                        <input type="number" value={p.number} onChange={e => updatePlayer(i, "number", e.target.value)}
                          style={{ ...input, width: 54, textAlign: "center", padding: "4px 6px" }} />
                      </td>
                      <td style={{ padding: "6px 10px" }}>
                        <input value={p.prenom} onChange={e => updatePlayer(i, "prenom", e.target.value)} style={{ ...input, padding: "4px 8px" }} />
                      </td>
                      <td style={{ padding: "6px 10px" }}>
                        <input value={p.nom} onChange={e => updatePlayer(i, "nom", e.target.value)} style={{ ...input, padding: "4px 8px" }} />
                      </td>
                      <td style={{ padding: "6px 10px" }}>
                        <select value={p.poste} onChange={e => updatePlayer(i, "poste", e.target.value)}
                          style={{ ...input, padding: "4px 8px", cursor: "pointer" }}>
                          {POSTES.map(pos => <option key={pos} value={pos}>{pos}</option>)}
                        </select>
                      </td>
                      <td style={{ padding: "6px 10px", textAlign: "center" }}>
                        <div style={{ display: "flex", gap: 2, justifyContent: "center" }}>
                          <button onClick={() => movePlayer(i, -1)} disabled={i === 0} style={{ ...btn("ghost"), padding: "2px 6px", fontSize: 12, opacity: i === 0 ? 0.3 : 1 }}>↑</button>
                          <button onClick={() => movePlayer(i, 1)} disabled={i === form.roster.length - 1} style={{ ...btn("ghost"), padding: "2px 6px", fontSize: 12, opacity: i === form.roster.length - 1 ? 0.3 : 1 }}>↓</button>
                        </div>
                      </td>
                      <td style={{ padding: "6px 10px", textAlign: "center" }}>
                        <button onClick={() => removePlayer(i)} style={{ ...btn("ghost"), padding: "2px 8px", fontSize: 12, color: C2.red }}>✕</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Ajout d'une joueuse */}
          <div style={{ background: C2.gray50, borderRadius: 8, padding: "12px 14px" }}>
            <p style={{ ...label, marginBottom: 10 }}>Ajouter une joueuse</p>
            <div style={{ display: "grid", gridTemplateColumns: "64px 1fr 1fr 1fr auto", gap: 8, alignItems: "end" }}>
              <div>
                <label style={{ ...label, marginBottom: 4 }}>#</label>
                <input type="number" placeholder="N°" value={newPlayer.number} onChange={e => setNewPlayer(p => ({ ...p, number: e.target.value }))} style={{ ...input, textAlign: "center" }} />
              </div>
              <div>
                <label style={{ ...label, marginBottom: 4 }}>Prénom</label>
                <input value={newPlayer.prenom} onChange={e => setNewPlayer(p => ({ ...p, prenom: e.target.value }))} style={input} />
              </div>
              <div>
                <label style={{ ...label, marginBottom: 4 }}>Nom</label>
                <input value={newPlayer.nom} onChange={e => setNewPlayer(p => ({ ...p, nom: e.target.value }))}
                  onKeyDown={e => e.key === "Enter" && addPlayer()} style={input} />
              </div>
              <div>
                <label style={{ ...label, marginBottom: 4 }}>Poste</label>
                <select value={newPlayer.poste} onChange={e => setNewPlayer(p => ({ ...p, poste: e.target.value }))} style={{ ...input, cursor: "pointer" }}>
                  {POSTES.map(pos => <option key={pos} value={pos}>{pos}</option>)}
                </select>
              </div>
              <button onClick={addPlayer} style={{ ...btn("primary"), padding: "8px 14px", whiteSpace: "nowrap" }}>+ Ajouter</button>
            </div>
          </div>
        </div>

        {/* Boutons sauvegarde */}
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button onClick={() => setEditing(null)} style={btn("ghost")}>Annuler</button>
          <button onClick={save} disabled={saving} style={btn("success")}>
            {saving ? "Enregistrement…" : "✓ Enregistrer la saison"}
          </button>
        </div>
      </div>
    );
  }

  // ── Liste des saisons ──────────────────────────────────────────────────
  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "24px 16px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={onBack} style={{ ...btn("ghost"), fontSize: 12 }}>← Retour</button>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: C2.gray800, margin: 0 }}>🗓 Gestion des saisons</h2>
        </div>
        <button onClick={() => openNew()} style={btn("primary")}>+ Nouvelle saison</button>
      </div>

      {loading && <p style={{ color: C2.gray400, textAlign: "center" }}>Chargement…</p>}
      {error && <div style={{ background: "#fee2e2", color: C2.red, borderRadius: 8, padding: "10px 14px", marginBottom: 16, fontSize: 13 }}>{error}</div>}

      {seasons.length === 0 && !loading && (
        <div style={{ ...card, textAlign: "center", color: C2.gray400 }}>
          <p style={{ fontSize: 32, marginBottom: 8 }}>🏐</p>
          <p style={{ fontWeight: 600 }}>Aucune saison créée.</p>
          <p style={{ fontSize: 13 }}>Crée ta première saison pour commencer.</p>
          <button onClick={() => openNew()} style={{ ...btn("primary"), marginTop: 12 }}>+ Créer la première saison</button>
        </div>
      )}

      {seasons.map(season => (
        <div key={season.id} style={{ ...card, border: season.active ? `2px solid ${C2.blue}` : "2px solid transparent", position: "relative" }}>
          {season.active && (
            <span style={{ position: "absolute", top: 14, right: 20, background: C2.blue, color: "#fff", fontSize: 11, fontWeight: 700, padding: "2px 10px", borderRadius: 20 }}>
              ACTIVE
            </span>
          )}
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
            <div>
              <p style={{ fontSize: 18, fontWeight: 800, color: C2.gray800, margin: "0 0 4px" }}>{season.nom}</p>
              <p style={{ fontSize: 13, color: C2.gray400, margin: 0 }}>
                {season.club} · <strong style={{ color: C2.blue }}>{season.division}</strong>
                {season.poule && <> · <strong style={{ color: C2.gray800 }}>{season.poule}</strong></>}
                {" "}· {season.matchCount} match{season.matchCount > 1 ? "s" : ""} · {season.roster?.length || 0} joueuses
              </p>
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {!season.active && (
                <button onClick={() => setActive(season.id)} style={{ ...btn("ghost"), fontSize: 12, color: C2.blue }}>
                  ⚡ Activer
                </button>
              )}
              <button onClick={() => openNew(season)} style={{ ...btn("ghost"), fontSize: 12 }} title="Créer une nouvelle saison en copiant celle-ci">
                📋 Dupliquer
              </button>
              <button onClick={() => openEdit(season)} style={btn("ghost")}>✏ Modifier</button>
              {!season.active && season.matchCount === 0 && (
                <button onClick={() => deleteSeason(season.id)} style={{ ...btn("ghost"), color: C2.red, fontSize: 12 }}>🗑 Supprimer</button>
              )}
            </div>
          </div>

          {/* Aperçu du roster */}
          {season.roster && season.roster.length > 0 && (
            <div style={{ marginTop: 12, display: "flex", flexWrap: "wrap", gap: 6 }}>
              {[...season.roster].sort((a, b) => a.number - b.number).map((p, i) => {
                const pc = POSTE_COLORS[p.poste] || POSTE_COLORS["Universelle"];
                return (
                  <span key={i} style={{ fontSize: 11, padding: "2px 8px", borderRadius: 20, background: pc.bg, color: pc.color, fontWeight: 600 }}>
                    #{p.number} {p.prenom} {p.nom}
                  </span>
                );
              })}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

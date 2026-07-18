import { useState, useRef } from "react";

const API_URL = "https://volleystat-backend.onrender.com";

const CONFIDENCE_LABELS = {
  high:   { label: "Confiance élevée",  color: "#16a34a", bg: "#dcfce7" },
  medium: { label: "Confiance moyenne", color: "#d97706", bg: "#fef3c7" },
  low:    { label: "Confiance faible",  color: "#dc2626", bg: "#fee2e2" },
};

export default function ImportFFVB({ onMatchCreated, activeSeason, onCancel }) {
  const [step, setStep]         = useState(1);  // 1=upload, 2=review, 3=done
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving]     = useState(false);
  const [parsed, setParsed]     = useState(null);
  const [error, setError]       = useState(null);

  // Formulaire éditable après extraction
  const [form, setForm] = useState({
    date: "", equipeA: "", equipeB: "",
    setScores: [], players: [],
  });

  const fileRef = useRef(null);

  // ── Upload + Parse ──────────────────────────────────────────────────────
  const handleFile = async (file) => {
    if (!file || !file.name.toLowerCase().endsWith(".pdf")) {
      setError("Sélectionne un fichier PDF.");
      return;
    }
    setUploading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`${API_URL}/import/parse`, { method: "POST", body: fd });
      if (!res.ok) {
        const e = await res.json();
        throw new Error(e.detail || "Erreur serveur");
      }
      const data = await res.json();
      setParsed(data);

      // Pré-remplir le formulaire avec les données extraites
      const playersMerged = [
        ...(data.players_a || []).map(p => ({ ...p, team: "A" })),
      ];
      // Utiliser les stats extraites si disponibles
      const statsPlayers = data.stats_tables?.[0]?.players || [];
      const mergedPlayers = playersMerged.length > 0
        ? playersMerged
        : statsPlayers.map(p => ({ ...p, team: "A" }));

      setForm({
        date:      data.date     || "",
        equipeA:   data.equipeA  || "",
        equipeB:   data.equipeB  || "",
        setScores: data.set_scores?.length > 0
          ? data.set_scores
          : [{ scoreA: 0, scoreB: 0 }, { scoreA: 0, scoreB: 0 }, { scoreA: 0, scoreB: 0 }],
        players: mergedPlayers,
        pdf_b64: data.pdf_b64 || null,
      });
      setStep(2);
    } catch (e) {
      setError(e.message);
    } finally {
      setUploading(false);
    }
  };

  const onDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    handleFile(file);
  };

  // ── Édition du formulaire ───────────────────────────────────────────────
  const updateScore = (i, field, val) => {
    setForm(f => ({
      ...f,
      setScores: f.setScores.map((s, idx) => idx === i ? { ...s, [field]: parseInt(val) || 0 } : s),
    }));
  };

  const addSet = () => setForm(f => ({ ...f, setScores: [...f.setScores, { scoreA: 0, scoreB: 0 }] }));
  const removeSet = (i) => setForm(f => ({ ...f, setScores: f.setScores.filter((_, idx) => idx !== i) }));

  const updatePlayer = (i, field, val) => {
    setForm(f => ({
      ...f,
      players: f.players.map((p, idx) => idx === i ? { ...p, [field]: val } : p),
    }));
  };

  const addPlayer = () => setForm(f => ({ ...f, players: [...f.players, { number: "", nom: "", team: "A" }] }));
  const removePlayer = (i) => setForm(f => ({ ...f, players: f.players.filter((_, idx) => idx !== i) }));

  // ── Création du match ────────────────────────────────────────────────────
  const createMatch = async () => {
    if (!form.date || !form.equipeA || !form.equipeB) {
      setError("Date et noms des équipes obligatoires.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload = {
        date:      form.date,
        equipeA:   form.equipeA,
        equipeB:   form.equipeB,
        season_id: activeSeason?.id || null,
        set_scores: form.setScores,
        players:    form.players.filter(p => p.nom),
        pdf_b64:   form.pdf_b64 || null,
      };
      const res = await fetch(`${API_URL}/import/create-match`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const e = await res.json();
        throw new Error(e.detail || "Erreur création match");
      }
      const created = await res.json();
      setStep(3);
      setTimeout(() => onMatchCreated && onMatchCreated(created), 1500);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  // ══════════════════════════════════════════════════════════════════════════
  // STYLES
  // ══════════════════════════════════════════════════════════════════════════
  const input = {
    width: "100%", padding: "7px 10px", borderRadius: 6,
    border: "1px solid #e2e8f0", fontSize: 13, outline: "none",
    boxSizing: "border-box", color: "#1e293b",
  };
  const btn = (v = "primary") => ({
    padding: "8px 18px", borderRadius: 8, border: "none", cursor: "pointer",
    fontSize: 13, fontWeight: 600,
    background: v === "primary" ? "#2563eb" : v === "success" ? "#16a34a" : v === "ghost" ? "transparent" : "#f1f5f9",
    color: ["primary", "success"].includes(v) ? "#fff" : v === "ghost" ? "#64748b" : "#1e293b",
  });
  const label = { fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 4 };
  const card = { background: "#fff", borderRadius: 12, boxShadow: "0 1px 4px rgba(0,0,0,0.08)", padding: "20px 24px", marginBottom: 16 };

  // ══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════════════════════

  if (step === 3) {
    return (
      <div style={{ maxWidth: 600, margin: "60px auto", textAlign: "center" }}>
        <div style={{ fontSize: 56, marginBottom: 16 }}>✅</div>
        <h2 style={{ fontSize: 22, fontWeight: 800, color: "#1e293b", marginBottom: 8 }}>Match importé !</h2>
        <p style={{ color: "#64748b", fontSize: 14 }}>
          Le match a été créé avec les scores et les joueuses pré-remplies.<br />
          Tu vas être redirigé vers la page du match pour saisir les statistiques.
        </p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 860, margin: "0 auto", padding: "24px 16px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
        <button onClick={onCancel} style={{ ...btn("ghost"), fontSize: 12 }}>← Retour</button>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: "#1e293b", margin: 0 }}>
          📄 Import Feuille de Match FFVB
        </h2>
        {activeSeason && (
          <span style={{ fontSize: 12, background: "#dbeafe", color: "#2563eb", padding: "2px 10px", borderRadius: 20, fontWeight: 600 }}>
            Saison : {activeSeason.nom} · {activeSeason.division}{activeSeason.poule ? " " + activeSeason.poule : ""}
          </span>
        )}
      </div>

      {error && (
        <div style={{ background: "#fee2e2", color: "#dc2626", borderRadius: 8, padding: "10px 14px", marginBottom: 16, fontSize: 13 }}>
          ⚠ {error}
        </div>
      )}

      {/* ── ÉTAPE 1 : Upload ── */}
      {step === 1 && (
        <div style={card}>
          <p style={{ fontSize: 14, color: "#64748b", marginBottom: 20 }}>
            Télécharge la feuille de match depuis <strong>competitions.ffvb.org</strong> et dépose-la ici.
            SlyVolleyStat extraira automatiquement les équipes, les scores et les joueuses.
          </p>

          {/* Zone de drop */}
          <div
            onDrop={onDrop}
            onDragOver={e => e.preventDefault()}
            onClick={() => fileRef.current?.click()}
            style={{
              border: "2px dashed #93c5fd", borderRadius: 12,
              padding: "48px 24px", textAlign: "center", cursor: "pointer",
              background: uploading ? "#eff6ff" : "#f8fafc",
              transition: "all 0.2s",
            }}
          >
            {uploading ? (
              <>
                <div style={{ fontSize: 36, marginBottom: 10 }}>⏳</div>
                <p style={{ color: "#2563eb", fontWeight: 600 }}>Analyse du PDF en cours…</p>
              </>
            ) : (
              <>
                <div style={{ fontSize: 48, marginBottom: 12 }}>📄</div>
                <p style={{ fontWeight: 700, color: "#1e293b", marginBottom: 6 }}>
                  Glisse le PDF ici ou clique pour sélectionner
                </p>
                <p style={{ fontSize: 12, color: "#94a3b8" }}>PDF uniquement · 20 MB max</p>
              </>
            )}
          </div>
          <input ref={fileRef} type="file" accept=".pdf" style={{ display: "none" }}
            onChange={e => handleFile(e.target.files[0])} />

          <p style={{ fontSize: 12, color: "#94a3b8", marginTop: 16, textAlign: "center" }}>
            💡 Si l'extraction est imparfaite, tu pourras corriger les données à l'étape suivante avant d'importer.
          </p>
        </div>
      )}

      {/* ── ÉTAPE 2 : Révision ── */}
      {step === 2 && parsed && (
        <>
          {/* Bandeau de confiance */}
          {(() => {
            const c = CONFIDENCE_LABELS[parsed.confidence] || CONFIDENCE_LABELS.low;
            return (
              <div style={{ background: c.bg, border: `1px solid ${c.color}40`, borderRadius: 8, padding: "10px 14px", marginBottom: 16, display: "flex", alignItems: "center", gap: 10, fontSize: 13 }}>
                <span style={{ color: c.color, fontWeight: 700 }}>{c.label}</span>
                <span style={{ color: "#64748b" }}>
                  {parsed.equipeA && parsed.equipeB ? "✓ Équipes " : "⚠ Équipes "}
                  {parsed.set_scores?.length ? `✓ ${parsed.set_scores.length} sets ` : "⚠ Scores "}
                  {parsed.players_a?.length ? `✓ ${parsed.players_a.length} joueuses détectées` : "⚠ Joueuses "}
                </span>
                <span style={{ marginLeft: "auto", fontSize: 11, color: "#94a3b8" }}>
                  Vérifie et corrige si nécessaire avant d'importer
                </span>
              </div>
            );
          })()}

          {/* Infos générales */}
          <div style={card}>
            <p style={{ fontWeight: 700, fontSize: 14, color: "#1e293b", marginBottom: 14 }}>Informations du match</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
              <div>
                <label style={label}>Date</label>
                <input type="date" style={input} value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
              </div>
              <div>
                <label style={label}>Équipe A (domicile)</label>
                <input style={input} value={form.equipeA} onChange={e => setForm(f => ({ ...f, equipeA: e.target.value }))} />
              </div>
              <div>
                <label style={label}>Équipe B (visiteur)</label>
                <input style={input} value={form.equipeB} onChange={e => setForm(f => ({ ...f, equipeB: e.target.value }))} />
              </div>
            </div>
          </div>

          {/* Scores par set */}
          <div style={card}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <p style={{ fontWeight: 700, fontSize: 14, color: "#1e293b", margin: 0 }}>Scores par set</p>
              <button onClick={addSet} style={{ ...btn("ghost"), fontSize: 12, color: "#2563eb" }}>+ Ajouter un set</button>
            </div>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              {form.setScores.map((sc, i) => (
                <div key={i} style={{ background: "#f8fafc", borderRadius: 8, padding: "12px 16px", minWidth: 140, position: "relative" }}>
                  <p style={{ ...label, textAlign: "center", marginBottom: 8 }}>Set {i + 1}</p>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <input type="number" min={0} max={40} style={{ ...input, width: 52, textAlign: "center", padding: "6px 4px" }}
                      value={sc.scoreA} onChange={e => updateScore(i, "scoreA", e.target.value)} />
                    <span style={{ color: "#94a3b8", fontWeight: 700 }}>–</span>
                    <input type="number" min={0} max={40} style={{ ...input, width: 52, textAlign: "center", padding: "6px 4px" }}
                      value={sc.scoreB} onChange={e => updateScore(i, "scoreB", e.target.value)} />
                  </div>
                  {form.setScores.length > 1 && (
                    <button onClick={() => removeSet(i)} style={{ position: "absolute", top: 6, right: 6, background: "none", border: "none", color: "#dc2626", cursor: "pointer", fontSize: 12 }}>✕</button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Joueuses */}
          <div style={card}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <p style={{ fontWeight: 700, fontSize: 14, color: "#1e293b", margin: 0 }}>
                Joueuses à importer ({form.players.filter(p => p.nom).length})
              </p>
              <button onClick={addPlayer} style={{ ...btn("ghost"), fontSize: 12, color: "#2563eb" }}>+ Ajouter</button>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ background: "#f1f5f9" }}>
                    {["#", "Nom Prénom", "Équipe", ""].map(h => (
                      <th key={h} style={{ padding: "7px 10px", textAlign: h === "#" ? "center" : "left", fontWeight: 700, fontSize: 11, color: "#64748b", textTransform: "uppercase", borderBottom: "1px solid #e2e8f0" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {form.players.map((p, i) => (
                    <tr key={i} style={{ borderBottom: "1px solid #f1f5f9" }}>
                      <td style={{ padding: "5px 10px", textAlign: "center" }}>
                        <input type="number" value={p.number || ""} onChange={e => updatePlayer(i, "number", e.target.value)}
                          style={{ ...input, width: 50, textAlign: "center", padding: "4px 6px" }} />
                      </td>
                      <td style={{ padding: "5px 10px" }}>
                        <input value={p.nom || ""} onChange={e => updatePlayer(i, "nom", e.target.value)}
                          placeholder="Nom Prénom" style={{ ...input, padding: "4px 8px" }} />
                      </td>
                      <td style={{ padding: "5px 10px" }}>
                        <select value={p.team || "A"} onChange={e => updatePlayer(i, "team", e.target.value)}
                          style={{ ...input, width: 90, padding: "4px 6px", cursor: "pointer" }}>
                          <option value="A">Équipe A</option>
                          <option value="B">Équipe B</option>
                        </select>
                      </td>
                      <td style={{ padding: "5px 10px" }}>
                        <button onClick={() => removePlayer(i)} style={{ background: "none", border: "none", color: "#dc2626", cursor: "pointer", fontSize: 12 }}>✕</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p style={{ fontSize: 11, color: "#94a3b8", marginTop: 10 }}>
              ℹ Seules les joueuses de l'équipe A (ton équipe) seront importées avec des stats à 0 à remplir ensuite.
            </p>
          </div>

          {/* Boutons */}
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <button onClick={() => setStep(1)} style={btn("ghost")}>← Re-uploader</button>
            <button onClick={createMatch} disabled={saving} style={btn("success")}>
              {saving ? "Import en cours…" : "✓ Importer le match"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

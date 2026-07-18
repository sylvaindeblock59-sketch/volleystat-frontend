import { useState, useEffect, useCallback, useRef } from "react";
import { PLAYERS } from "./data/players";

const ACTIONS = [
  { groupe:"Service", color:"#3b82f6", bg:"#dbeafe", touches:[
    { key:"1", label:"SG", desc:"Service Gagnant", field:"SG" },
    { key:"2", label:"S+", desc:"Service +", field:"S+" },
    { key:"3", label:"S0", desc:"Service neutre", field:"S0" },
    { key:"4", label:"S−", desc:"Service faute", field:"S-" },
  ]},
  { groupe:"Réception", color:"#16a34a", bg:"#dcfce7", touches:[
    { key:"q", label:"R++", desc:"Réception parfaite", field:"R++" },
    { key:"w", label:"R+", desc:"Réception bonne", field:"R+" },
    { key:"e", label:"R0", desc:"Réception neutre", field:"R0" },
    { key:"r", label:"R−", desc:"Réception faute", field:"R-" },
  ]},
  { groupe:"Attaque", color:"#dc2626", bg:"#fee2e2", touches:[
    { key:"a", label:"A+", desc:"Attaque gagnante", field:"A+" },
    { key:"s", label:"A0", desc:"Attaque neutre", field:"A0" },
    { key:"d", label:"A−", desc:"Attaque faute", field:"A-" },
  ]},
  { groupe:"Bloc", color:"#7c3aed", bg:"#ede9fe", touches:[
    { key:"z", label:"B+", desc:"Bloc gagnant", field:"B+" },
    { key:"x", label:"Bd", desc:"Bloc défensif", field:"Bdef" },
    { key:"c", label:"B−", desc:"Bloc faute", field:"B-" },
  ]},
  { groupe:"Passe", color:"#d97706", bg:"#fef3c7", touches:[
    { key:"f", label:"P+", desc:"Passe parfaite", field:"P+" },
    { key:"g", label:"P0", desc:"Passe neutre", field:"P0" },
    { key:"h", label:"P−", desc:"Passe faute", field:"P-" },
  ]},
  { groupe:"Défense", color:"#0891b2", bg:"#cffafe", touches:[
    { key:"v", label:"D+", desc:"Défense réussie", field:"D+" },
    { key:"b", label:"D−", desc:"Défense faute", field:"D-" },
  ]},
];
const ALL_TOUCHES = ACTIONS.flatMap(a => a.touches);
const FIELD_DEFAULTS = () => {
  const o = {};
  ALL_TOUCHES.forEach(t => { o[t.field] = 0; });
  o.PG = 0; o.FD = 0; o.FF = 0; o.errS = 0; o.errA = 0;
  return o;
};
const ROSTER_NAMES = PLAYERS.map(p => `${p.prenom} ${p.nom}`);

export default function LiveTagger({ matchData, onStatsUpdate, onClose }) {

  // ── Calcul formation initiale — JAMAIS recalculé même si matchData change ─
  const initNoms = () => {
    const noms = [...ROSTER_NAMES];
    if (matchData) matchData.sets.forEach(s => s.stats.forEach(ps => { if (!noms.includes(ps.nom)) noms.push(ps.nom); }));
    return noms;
  };
  const initLibero = (noms) => noms.find(n => PLAYERS.find(p => `${p.prenom} ${p.nom}` === n)?.poste === "Libéro") || null;
  const initRest   = (noms, lib) => noms.filter(n => n !== lib);

  const [joueuses,       setJoueuses]       = useState(initNoms);
  const [selectedJoueuse, setSelectedJoueuse] = useState(() => initNoms()[0] || null);
  const [selectedSet, setSelectedSet] = useState(1);
  const [statsMap, setStatsMap] = useState(() => {
    const map = {};
    if (matchData) matchData.sets.forEach(set => set.stats.forEach(ps => { map[`${ps.nom}_set${set.num}`] = { ...FIELD_DEFAULTS(), ...ps }; }));
    return map;
  });
  const [history, setHistory] = useState([]);
  const [flashKey, setFlashKey] = useState(null);
  const [actionLog, setActionLog] = useState([]);
  const [showLegend, setShowLegend] = useState(false);

  // Formation : initialisée UNE SEULE FOIS à partir du roster, jamais réécrasée
  const [onCourt, setOnCourt] = useState(() => { const n = initNoms(); const l = initLibero(n); return initRest(n, l).slice(0, 6); });
  const [libero,  setLibero]  = useState(() => { const n = initNoms(); return initLibero(n); });
  const [bench,   setBench]   = useState(() => { const n = initNoms(); const l = initLibero(n); return initRest(n, l).slice(6); });

  const [subMode,    setSubMode]    = useState(false);
  const [pendingIn,  setPendingIn]  = useState(null);
  const [elapsed,    setElapsed]    = useState(0);
  const [running,    setRunning]    = useState(false);
  const tickRef = useRef(null);

  useEffect(() => {
    if (running) {
      tickRef.current = setInterval(() => setElapsed(e => e + 1), 1000);
    } else if (tickRef.current) {
      clearInterval(tickRef.current);
    }
    return () => { if (tickRef.current) clearInterval(tickRef.current); };
  }, [running]);

  const formatTime = (t) => `${Math.floor(t / 60)}:${Math.floor(t % 60).toString().padStart(2, "0")}`;

  const cyclePlayer = useCallback((reverse) => {
    setSelectedJoueuse(prev => {
      if (joueuses.length === 0) return prev;
      const idx = joueuses.indexOf(prev);
      const nextIdx = reverse ? (idx - 1 + joueuses.length) % joueuses.length : (idx + 1) % joueuses.length;
      return joueuses[nextIdx];
    });
  }, [joueuses]);

  const handleChipClick = (name) => {
    if (subMode) {
      if (pendingIn === name) { setPendingIn(null); return; }
      if (pendingIn) {
        if (onCourt.includes(name)) {
          setOnCourt(prev => prev.map(p => p === name ? pendingIn : p));
          setBench(prev => [...prev.filter(p => p !== pendingIn), name]);
        } else if (name === libero) {
          setLibero(pendingIn);
          setBench(prev => [...prev.filter(p => p !== pendingIn), name]);
        }
        setPendingIn(null);
        setSubMode(false);
        setSelectedJoueuse(pendingIn);
        return;
      }
      if (bench.includes(name)) setPendingIn(name);
      return;
    }
    setSelectedJoueuse(name);
  };

  const tagAction = useCallback((field, label, desc) => {
    if (!selectedJoueuse) return;
    const key = `${selectedJoueuse}_set${selectedSet}`;
    setStatsMap(prev => {
      const current = prev[key] || FIELD_DEFAULTS();
      return { ...prev, [key]: { ...current, [field]: (current[field] || 0) + 1 } };
    });
    const entry = { id: Date.now(), time: elapsed, joueuse: selectedJoueuse, set: selectedSet, field, label, desc, key };
    setHistory(h => [...h, entry]);
    setActionLog(l => [entry, ...l.slice(0, 49)]);
    setFlashKey(field);
    setTimeout(() => setFlashKey(null), 250);
  }, [selectedJoueuse, selectedSet, elapsed]);

  const undoLast = useCallback(() => {
    if (history.length === 0) return;
    const last = history[history.length - 1];
    setStatsMap(prev => {
      const current = prev[last.key] || FIELD_DEFAULTS();
      return { ...prev, [last.key]: { ...current, [last.field]: Math.max(0, (current[last.field] || 0) - 1) } };
    });
    setHistory(h => h.slice(0, -1));
    setActionLog(l => l.filter(e => e.id !== last.id));
  }, [history]);

  useEffect(() => {
    const handler = (e) => {
      if (e.target.tagName === "INPUT" || e.target.tagName === "SELECT") return;
      if (e.ctrlKey && e.key === "z") { e.preventDefault(); undoLast(); return; }
      if (e.key === "Tab") { e.preventDefault(); cyclePlayer(e.shiftKey); return; }
      if (e.key === "?") { setShowLegend(s => !s); return; }
      const action = ALL_TOUCHES.find(t => t.key === e.key.toLowerCase());
      if (action) tagAction(action.field, action.label, action.desc);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [tagAction, undoLast, cyclePlayer]);

  const saveStats = () => {
    if (!matchData || !onStatsUpdate) return;
    const updates = [];
    Object.entries(statsMap).forEach(([key, stats]) => {
      const parts = key.split("_set");
      if (parts.length !== 2) return;
      updates.push({ nom: parts[0], setNum: parseInt(parts[1]), stats });
    });
    onStatsUpdate(matchData.id, updates);
  };

  const getStatKey = (nom, setNum) => `${nom}_set${setNum}`;
  const currentStats = statsMap[getStatKey(selectedJoueuse, selectedSet)] || FIELD_DEFAULTS();

  return (
    <div style={{
      position: "fixed", inset: 0, background: "#0a0f1e", zIndex: 200,
      display: "flex", flexDirection: "column", color: "#e2e8f0",
      fontFamily: "'DM Mono','Courier New',monospace", overflow: "auto"
    }}>
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "6px 10px", background: "#0f172a", borderBottom: "1px solid #1e293b",
        position: "sticky", top: 0, zIndex: 5, flexWrap: "wrap", gap: 6
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 14 }}>🟢</span>
          <span style={{ fontWeight: 700, fontSize: 12, color: "#f8fafc" }}>Saisie en direct</span>
          <span onClick={() => setRunning(r => !r)} style={{
            fontSize: 11, color: running ? "#22c55e" : "#64748b", background: "#1e293b",
            padding: "2px 8px", borderRadius: 999, cursor: "pointer", fontWeight: 700
          }}>
            {running ? "⏸" : "▶"} {formatTime(elapsed)}
          </span>
        </div>
        <div style={{ display: "flex", gap: 5 }}>
          <button onClick={() => setShowLegend(s => !s)} style={{
            padding: "4px 9px", borderRadius: 5, border: "1px solid #334155", cursor: "pointer",
            background: showLegend ? "#3b82f6" : "transparent", color: showLegend ? "white" : "#94a3b8",
            fontSize: 10, fontWeight: 600
          }}>📖</button>
<button onClick={() => { saveStats(); onClose(); }} style={{
  padding: "4px 10px", borderRadius: 5, border: "none", cursor: "pointer",
  background: "#16a34a", color: "white", fontSize: 10, fontWeight: 600
}}>✓ Enregistrer et quitter</button>
          <button onClick={onClose} style={{
            padding: "4px 8px", borderRadius: 5, border: "1px solid #334155",
            cursor: "pointer", background: "transparent", color: "#94a3b8", fontSize: 10
          }}>✕</button>
        </div>
      </div>

      <div style={{ padding: 8, display: "flex", flexDirection: "column", gap: 7 }}>

        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <div style={{ display: "flex", gap: 3 }}>
            {(matchData?.sets || [{num:1},{num:2},{num:3},{num:4},{num:5}]).map(st => (
              <button key={st.num} onClick={() => setSelectedSet(st.num)} style={{
                padding: "6px 10px", borderRadius: 6, border: "1px solid #334155", cursor: "pointer",
                background: selectedSet === st.num ? "#3b82f6" : "#1e293b",
                color: selectedSet === st.num ? "white" : "#94a3b8", fontSize: 11, fontWeight: 700
              }}>S{st.num}</button>
            ))}
          </div>
          <button onClick={undoLast} disabled={history.length === 0} style={{
            padding: "6px 10px", borderRadius: 6, border: "1px solid #334155", cursor: "pointer",
            background: "#7c3aed", color: "white", fontSize: 11, fontWeight: 700, opacity: history.length === 0 ? 0.4 : 1
          }}>↩ Annuler</button>
        </div>

        <div style={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 8, padding: 8 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <p style={{ fontSize: 10, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em", margin: 0 }}>
              Formation — Set {selectedSet}
            </p>
            <button onClick={() => { setSubMode(s => !s); setPendingIn(null); }} style={{
              padding: "3px 8px", borderRadius: 5, border: "1px solid #334155", cursor: "pointer",
              background: subMode ? "#f59e0b" : "transparent", color: subMode ? "#0a0f1e" : "#94a3b8",
              fontSize: 10, fontWeight: 700
            }}>🔄 Remplacement{subMode ? " (actif)" : ""}</button>
          </div>

          {subMode && (
            <p style={{ fontSize: 10, color: "#fbbf24", margin: "0 0 6px" }}>
              {pendingIn ? `Touchez la joueuse qui sort pour faire entrer ${pendingIn}` : "Touchez une joueuse du banc à faire entrer"}
            </p>
          )}

          <p style={{ fontSize: 9, color: "#64748b", margin: "0 0 4px" }}>Sur le terrain</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 5, marginBottom: 8 }}>
            {onCourt.map(name => (
              <button key={name} onClick={() => handleChipClick(name)} style={{
                padding: "7px 4px", borderRadius: 7, border: `2px solid ${selectedJoueuse === name ? "#3b82f6" : "#334155"}`,
                background: selectedJoueuse === name ? "#1e3a8a" : "#1e293b", color: "#f8fafc",
                fontSize: 10, fontWeight: 700, cursor: "pointer", textAlign: "center"
              }}>{name}</button>
            ))}
          </div>

          {libero && (
            <>
              <p style={{ fontSize: 9, color: "#64748b", margin: "0 0 4px" }}>Libéro</p>
              <button onClick={() => handleChipClick(libero)} style={{
                padding: "6px 10px", borderRadius: 7, border: `2px solid ${selectedJoueuse === libero ? "#16a34a" : "#334155"}`,
                background: selectedJoueuse === libero ? "#14532d" : "#1e293b", color: "#f8fafc",
                fontSize: 10, fontWeight: 700, cursor: "pointer", marginBottom: 8
              }}>🟢 {libero}</button>
            </>
          )}

          <p style={{ fontSize: 9, color: "#64748b", margin: "0 0 4px" }}>Banc</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            {bench.map(name => (
              <button key={name} onClick={() => handleChipClick(name)} style={{
                padding: "5px 9px", borderRadius: 6, border: `1px solid ${pendingIn === name ? "#f59e0b" : (selectedJoueuse === name ? "#3b82f6" : "#334155")}`,
                background: pendingIn === name ? "#78350f" : (selectedJoueuse === name ? "#1e3a8a" : "#1e293b"),
                color: "#cbd5e1", fontSize: 10, fontWeight: 600, cursor: "pointer"
              }}>{name}</button>
            ))}
          </div>
        </div>

        {showLegend && (
          <div style={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 8, padding: 8, display: "flex", flexDirection: "column", gap: 4 }}>
            {ACTIONS.map(group => (
              <div key={group.groupe} style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: group.color, width: 68 }}>{group.groupe}</span>
                {group.touches.map(t => (
                  <span key={t.key} style={{ fontSize: 10, color: "#cbd5e1" }}>
                    <strong style={{ color: group.color }}>[{t.key}]</strong> {t.label}={t.desc}
                  </span>
                ))}
              </div>
            ))}
            <p style={{ fontSize: 10, color: "#64748b", margin: "2px 0 0" }}>
              Tab=joueuse suivante · Ctrl+Z=annuler · ?=légende
            </p>
          </div>
        )}
  return (
    <div style={{ position: "fixed", inset: 0, background: "#0a0f1e", zIndex: 200, display: "flex", flexDirection: "column", color: "#e2e8f0", fontFamily: "'DM Mono','Courier New',monospace", overflow: "hidden" }}>

      {/* Bannière récupération */}
      {showRecovery && (
        <div style={{ background: "#854d0e", padding: "5px 10px", display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          <span style={{ fontSize: 11, color: "#fef9c3", fontWeight: 700 }}>💾 Session précédente détectée</span>
          <button onClick={applyRecovery} style={{ padding: "3px 10px", borderRadius: 4, border: "none", cursor: "pointer", background: "#16a34a", color: "white", fontSize: 10, fontWeight: 700 }}>✓ Restaurer</button>
          <button onClick={discardRecovery} style={{ padding: "3px 8px", borderRadius: 4, border: "1px solid #a16207", cursor: "pointer", background: "transparent", color: "#fef9c3", fontSize: 10 }}>✗ Ignorer</button>
        </div>
      )}

      {/* Header compact */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "4px 8px", background: "#0f172a", borderBottom: "1px solid #1e293b", gap: 6, flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 12 }}>🟢</span>
          <span onClick={() => setRunning(r => !r)} style={{ fontSize: 11, color: running ? "#22c55e" : "#64748b", background: "#1e293b", padding: "2px 7px", borderRadius: 999, cursor: "pointer", fontWeight: 700 }}>{running ? "⏸" : "▶"} {formatTime(elapsed)}</span>
          <span style={{ fontSize: 9, padding: "2px 7px", borderRadius: 999, fontWeight: 700, background: saveStatus === "saved" ? "#16a34a30" : saveStatus === "error" ? "#dc262630" : hasUnsaved ? "#d9770620" : "#1e293b", color: saveStatus === "saved" ? "#22c55e" : saveStatus === "error" ? "#ef4444" : hasUnsaved ? "#fb923c" : "#475569" }}>
            {saveStatus === "saving" ? "⏳" : saveStatus === "saved" ? `✓ ${lastSaveTime?.toLocaleTimeString("fr-FR",{hour:"2-digit",minute:"2-digit"})||""}` : saveStatus === "error" ? "✗" : hasUnsaved ? "●" : "✓"}
          </span>
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          <button onClick={() => { const e = document.documentElement; e.requestFullscreen?.() || e.webkitRequestFullscreen?.(); }} style={{ padding: "3px 7px", borderRadius: 4, border: "1px solid #334155", cursor: "pointer", background: "transparent", color: "#60a5fa", fontSize: 12, fontWeight: 700 }} title="Plein écran">⛶</button>
          <button onClick={exportCSV} style={{ padding: "3px 7px", borderRadius: 4, border: "1px solid #334155", cursor: "pointer", background: "transparent", color: "#64748b", fontSize: 9 }}>💾</button>
          <button onClick={() => setShowLegend(s => !s)} style={{ padding: "3px 7px", borderRadius: 4, border: "1px solid #334155", cursor: "pointer", background: showLegend ? "#3b82f6" : "transparent", color: showLegend ? "white" : "#94a3b8", fontSize: 9 }}>📖</button>
          <button onClick={async () => { const ok = await saveStats(); if (ok) onClose(); }} style={{ padding: "3px 9px", borderRadius: 4, border: "none", cursor: "pointer", background: "#16a34a", color: "white", fontSize: 9, fontWeight: 700 }}>✓ Sauver</button>
          <button onClick={() => { if (hasUnsaved) { if(window.confirm("Quitter ? (données locales conservées)")) { exportCSV(); onClose(); } } else onClose(); }} style={{ padding: "3px 7px", borderRadius: 4, border: "1px solid #334155", cursor: "pointer", background: "transparent", color: "#94a3b8", fontSize: 9 }}>✕</button>
        </div>
      </div>

      <div style={{ padding: "4px 6px", display: "flex", flexDirection: "column", gap: 4, flex: 1, overflow: "hidden" }}>

        {/* Sets + Annuler */}
        <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
          {(matchData?.sets || [{num:1},{num:2},{num:3},{num:4},{num:5}]).map(st => (
            <button key={st.num} onClick={() => setSelectedSet(st.num)} style={{ padding: "5px 10px", borderRadius: 6, border: "1px solid #334155", cursor: "pointer", background: selectedSet === st.num ? "#3b82f6" : "#1e293b", color: selectedSet === st.num ? "white" : "#94a3b8", fontSize: 11, fontWeight: 700 }}>S{st.num}</button>
          ))}
          <button onClick={undoLast} disabled={history.length === 0} style={{ padding: "5px 9px", borderRadius: 6, border: "1px solid #334155", cursor: "pointer", background: "#7c3aed", color: "white", fontSize: 10, fontWeight: 700, opacity: history.length === 0 ? 0.4 : 1, marginLeft: 4 }}>↩</button>
          {subMode && pendingIn && <span style={{ fontSize: 10, color: "#fbbf24", marginLeft: 4, fontWeight: 600 }}>🔄 Touche la joueuse qui sort</span>}
        </div>

        {/* Corps 3 colonnes */}
        <div style={{ display: "flex", gap: 5, flex: 1, overflow: "hidden" }}>

          {/* ── GAUCHE : Remplaçantes ── */}
          <div style={{ width: 155, flexShrink: 0, display: "flex", flexDirection: "column", gap: 5 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 10, color: "#64748b", fontWeight: 700, textTransform: "uppercase" }}>Remplaçantes</span>
            </div>
            {/* Bouton remplacement plus grand */}
            <button onClick={() => { setSubMode(s => !s); setPendingIn(null); }} style={{
              width: "100%", padding: "8px 6px", borderRadius: 8,
              border: `2px solid ${subMode ? "#f59e0b" : "#334155"}`,
              cursor: "pointer", background: subMode ? "#78350f" : "#1e293b",
              color: subMode ? "#fbbf24" : "#94a3b8", fontSize: 13, fontWeight: 800,
            }}>🔄 Remplacement {subMode ? "✓" : ""}</button>

            <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1, overflow: "auto" }}>
              {bench.length === 0
                ? <p style={{ fontSize: 10, color: "#334155", textAlign: "center", margin: "8px 0" }}>—</p>
                : bench.map(nom => (
                  <button key={nom} onClick={() => handleChipClick(nom)} style={{
                    width: "100%", padding: "7px 8px", borderRadius: 7,
                    border: `1px solid ${pendingIn === nom ? "#f59e0b" : selectedJoueuse === nom ? "#3b82f6" : "#1e293b"}`,
                    background: pendingIn === nom ? "#78350f" : selectedJoueuse === nom ? "#1e3a8a" : "#0f172a",
                    cursor: "pointer", display: "flex", alignItems: "center", gap: 7
                  }}>
                    <span style={{ fontSize: 16, fontWeight: 900, color: pendingIn === nom ? "#fbbf24" : selectedJoueuse === nom ? "#60a5fa" : "#475569", minWidth: 32 }}>#{playerNumber(nom)}</span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: pendingIn === nom ? "#fef9c3" : selectedJoueuse === nom ? "#bfdbfe" : "#94a3b8", lineHeight: 1.3, textAlign: "left" }}>{nom}</span>
                  </button>
                ))
              }
            </div>
          </div>

          {/* ── CENTRE : Terrain + Score + Actions ── */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 3, overflow: "auto" }}>

            {/* Terrain EN PREMIER */}
            <div style={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 8, overflow: "hidden", flexShrink: 0 }}>
              <div style={{ textAlign: "center", padding: "1px 0", background: "#1e293b", fontSize: 8, color: "#3b82f6", fontWeight: 700, letterSpacing: "0.3em" }}>─ NET ─</div>
              <div style={{ display: "flex", gap: 3, padding: "3px 4px" }}>
                {frontRow.map(nom => courtCell(nom))}
                {frontRow.length < 3 && Array(3-frontRow.length).fill(null).map((_,i) => <div key={`e${i}`} style={{ flex:1, border:"1px dashed #1e293b", borderRadius:6, textAlign:"center", color:"#334155", fontSize:8, padding:4 }}>—</div>)}
              </div>
              <div style={{ display: "flex", gap: 3, padding: "0 4px 3px" }}>
                {backRow.map(nom => courtCell(nom))}
                {backRow.length < 3 && Array(3-backRow.length).fill(null).map((_,i) => <div key={`f${i}`} style={{ flex:1, border:"1px dashed #1e293b", borderRadius:6, textAlign:"center", color:"#334155", fontSize:8, padding:4 }}>—</div>)}
              </div>
            </div>

            {/* Score compact — sous le terrain */}
            <div style={{ display: "flex", alignItems: "center", gap: 3, background: "#0f172a", borderRadius: 8, padding: "3px 6px", border: "1px solid #1e293b", flexShrink: 0 }}>
              <button onClick={() => addPoint("us")} style={{ padding: "3px 9px", borderRadius: 6, background: "#450a0a", border: "1px solid #7f1d1d", color: "#ef4444", fontSize: 12, fontWeight: 800, cursor: "pointer", WebkitTapHighlightColor: "transparent" }}>+1</button>
              <span style={{ fontSize: 9, color: "#fca5a5", fontWeight: 700, flex: 1, textAlign: "right", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ourTeam}</span>
              <span style={{ fontSize: 24, fontWeight: 900, color: "#ef4444", lineHeight: 1 }}>{usScore}</span>
              <span style={{ fontSize: 12, color: "#334155", fontWeight: 700, padding: "0 2px" }}>—</span>
              <span style={{ fontSize: 24, fontWeight: 900, color: "#3b82f6", lineHeight: 1 }}>{advScore}</span>
              <span style={{ fontSize: 9, color: "#93c5fd", fontWeight: 700, flex: 1, textAlign: "left", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{advTeam}</span>
              <button onClick={() => addPoint("adv")} style={{ padding: "3px 9px", borderRadius: 6, background: "#0c1a3a", border: "1px solid #1e3a8a", color: "#3b82f6", fontSize: 12, fontWeight: 800, cursor: "pointer", WebkitTapHighlightColor: "transparent" }}>+1</button>
              <button onClick={undoPoint} disabled={scoreHistory.length === 0} style={{ padding: "2px 5px", borderRadius: 4, border: "1px solid #334155", background: "transparent", color: scoreHistory.length > 0 ? "#f59e0b" : "#334155", fontSize: 10, cursor: "pointer" }}>↩</button>
            </div>

            {showLegend && (
              <div style={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 7, padding: 6, flexShrink: 0 }}>
                {ACTIONS.map(group => (
                  <div key={group.groupe} style={{ display: "flex", flexWrap: "wrap", gap: 4, alignItems: "center", marginBottom: 2 }}>
                    <span style={{ fontSize: 8, fontWeight: 700, color: group.color, width: 50 }}>{group.groupe}</span>
                    {group.touches.map(t => <span key={t.key} style={{ fontSize: 8, color: "#cbd5e1" }}><strong style={{ color: group.color }}>[{t.key}]</strong> {t.label}</span>)}
                  </div>
                ))}
              </div>
            )}

            {/* Boutons d'action */}
            <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              {ACTIONS.map(group => (
                <div key={group.groupe}>
                  <p style={{ fontSize: 7, fontWeight: 700, color: group.color, textTransform: "uppercase", margin: "0 0 2px" }}>{group.groupe}</p>
                  <div style={{ display: "grid", gridTemplateColumns: `repeat(${group.touches.length}, 1fr)`, gap: 3 }}>
                    {group.touches.map(t => (
                      <button key={t.key} onClick={() => tagAction(t.field, t.label, t.desc)} style={{
                        padding: "7px 2px", borderRadius: 6, border: `1px solid ${group.color}50`, cursor: "pointer",
                        background: flashKey === t.field ? group.color : group.bg,
                        color: flashKey === t.field ? "white" : group.color,
                        fontSize: 12, fontWeight: 800, transition: "all 0.1s", WebkitTapHighlightColor: "transparent",
                      }}>
                        {t.label}
                        {currentStats[t.field] > 0 && <div style={{ fontSize: 7, opacity: 0.8 }}>{currentStats[t.field]}</div>}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Journal mini */}
            <div style={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 7, padding: "3px 6px", maxHeight: 60, overflow: "auto", flexShrink: 0 }}>
              <p style={{ fontSize: 7, color: "#64748b", fontWeight: 700, textTransform: "uppercase", margin: "0 0 2px" }}>Journal ({actionLog.length})</p>
              {actionLog.slice(0, 5).map((entry, i) => {
                const group = ACTIONS.find(g => g.touches.some(t => t.field === entry.field));
                return (
                  <div key={entry.id} style={{ display: "flex", alignItems: "center", gap: 4, padding: "1px 0" }}>
                    <span style={{ fontSize: 9, fontWeight: 700, color: group?.color, background: (group?.color||"#94a3b8")+"20", padding: "0 3px", borderRadius: 3, minWidth: 22, textAlign: "center" }}>{entry.label}</span>
                    <span style={{ fontSize: 8, color: "#94a3b8", flex: 1 }}>{entry.joueuse.split(" ")[0]}</span>
                    <span style={{ fontSize: 8, color: "#475569" }}>S{entry.set}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── DROITE : Libéro + Erreurs ADV ── */}
          <div style={{ width: 105, flexShrink: 0, display: "flex", flexDirection: "column", gap: 5 }}>
            {libero ? (
              <div style={{ background: "#0f2010", border: "1px solid #14532d", borderRadius: 8, padding: 6 }}>
                <span style={{ fontSize: 9, color: "#22c55e", fontWeight: 700, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Libéro</span>
                <button onClick={() => handleChipClick(libero)} style={{ width: "100%", padding: "6px 4px", borderRadius: 6, border: `2px solid ${selectedJoueuse === libero ? "#22c55e" : "#14532d"}`, background: selectedJoueuse === libero ? "#166534" : "#0f2010", color: "#86efac", cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}>
                  <span style={{ fontSize: 15, fontWeight: 900 }}>#{playerNumber(libero)}</span>
                  <span style={{ fontSize: 10, fontWeight: 700, lineHeight: 1.2, textAlign: "left" }}>{libero}</span>
                </button>
              </div>
            ) : null}

            <div style={{ background: "#0f172a", border: "1px solid #334155", borderRadius: 8, padding: "6px 8px", flex: 1 }}>
              <span style={{ fontSize: 9, color: "#64748b", fontWeight: 700, textTransform: "uppercase", display: "block", textAlign: "center", marginBottom: 6 }}>Erreurs ADV</span>
              {[{label:"Srv—",key:"s",color:"#ef4444"},{label:"Att—",key:"a",color:"#f97316"}].map(e => (
                <div key={e.key} style={{ marginBottom: 10 }}>
                  <span style={{ fontSize: 10, color: e.color, fontWeight: 700, display: "block", textAlign: "center", marginBottom: 4 }}>{e.label}</span>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 3 }}>
                    <button onClick={() => bumpAdv(e.key, -1)} style={{ width: 28, height: 28, borderRadius: 5, border: `1px solid ${e.color}40`, background: "#1e293b", color: "#94a3b8", fontSize: 16, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>−</button>
                    <span style={{ fontSize: 22, fontWeight: 900, color: e.color, minWidth: 24, textAlign: "center" }}>{advErrors[selectedSet]?.[e.key] || 0}</span>
                    <button onClick={() => bumpAdv(e.key, 1)} style={{ width: 28, height: 28, borderRadius: 5, border: `1px solid ${e.color}60`, background: `${e.color}20`, color: e.color, fontSize: 16, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>+</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
          </div>
        </div>
      </div>
    </div>
  );
}
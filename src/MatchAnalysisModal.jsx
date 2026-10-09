/**
 * MatchAnalysisModal.jsx
 * Modal d'analyse IA d'un match via Claude API
 *
 * Intégration dans VolleyStatPro.jsx :
 *   import MatchAnalysisModal from './MatchAnalysisModal';
 *   // dans les states :
 *   const [analysisModal, setAnalysisModal] = useState({ open: false, matchId: null, matchLabel: '' });
 *   // dans le JSX de chaque match card :
 *   <button onClick={() => setAnalysisModal({ open: true, matchId: m.id, matchLabel: `${m.equipeA} vs ${m.equipeB}` })} ...>🤖 Analyse IA</button>
 *   // avant </div> de fermeture :
 *   {analysisModal.open && <MatchAnalysisModal matchId={analysisModal.matchId} matchLabel={analysisModal.matchLabel} onClose={() => setAnalysisModal({ open: false })} API_BASE={API_BASE} />}
 */

import React, { useState, useEffect, useRef } from 'react';

const SECTOR_LABELS = {
  service:     { label: 'Service',      icon: '🏐' },
  reception:   { label: 'Réception',    icon: '🤲' },
  attaque:     { label: 'Attaque',      icon: '💥' },
  bloc_defense:{ label: 'Bloc / Défense', icon: '🛡️' },
};

function NoteCircle({ note }) {
  const color = note >= 8 ? '#22c55e' : note >= 6 ? '#f59e0b' : '#ef4444';
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      width: 36, height: 36, borderRadius: '50%',
      background: color, color: '#fff', fontWeight: 700, fontSize: 14,
      flexShrink: 0,
    }}>{note}</span>
  );
}

function SectorCard({ sector, data }) {
  const { label, icon } = SECTOR_LABELS[sector] || { label: sector, icon: '📊' };
  return (
    <div style={{
      background: '#1e293b', borderRadius: 10, padding: '14px 16px',
      display: 'flex', flexDirection: 'column', gap: 6,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
        <span style={{ fontSize: 20 }}>{icon}</span>
        <span style={{ fontWeight: 600, color: '#e2e8f0', fontSize: 15 }}>{label}</span>
        <div style={{ marginLeft: 'auto' }}><NoteCircle note={data.note} /></div>
      </div>
      <p style={{ color: '#94a3b8', fontSize: 13, margin: 0 }}>{data.resume}</p>
      <p style={{ color: '#64748b', fontSize: 12, margin: 0, lineHeight: 1.5 }}>{data.detail}</p>
    </div>
  );
}

function PlayerFocus({ p }) {
  return (
    <div style={{
      background: '#1e293b', borderRadius: 10, padding: '12px 14px',
      borderLeft: '3px solid #3b82f6',
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 6 }}>
        <span style={{ fontWeight: 700, color: '#e2e8f0', fontSize: 14 }}>{p.nom}</span>
        <span style={{ color: '#64748b', fontSize: 11, background: '#0f172a', padding: '1px 7px', borderRadius: 9 }}>{p.role}</span>
      </div>
      <p style={{ color: '#94a3b8', fontSize: 12.5, margin: '0 0 6px 0', lineHeight: 1.5 }}>{p.analyse}</p>
      {p.conseil && (
        <div style={{ background: '#172554', borderRadius: 6, padding: '6px 10px', fontSize: 12, color: '#93c5fd' }}>
          💡 {p.conseil}
        </div>
      )}
    </div>
  );
}

export default function MatchAnalysisModal({ matchId, matchLabel, onClose, API_BASE }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);
  const [context, setContext] = useState('');
  const [activeTab, setActiveTab] = useState('bilan');
  const [showContextInput, setShowContextInput] = useState(false);
  const abortRef = useRef(null);

  const runAnalysis = async (ctx = '') => {
    setLoading(true);
    setError(null);
    setData(null);
    try {
      const res = await fetch(`${API_BASE}/analysis/${matchId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ context: ctx }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || `Erreur ${res.status}`);
      }
      const json = await res.json();
      setData(json);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { runAnalysis(); }, [matchId]);

  const tabs = [
    { id: 'bilan', label: '📊 Bilan' },
    { id: 'secteurs', label: '🏐 Secteurs' },
    { id: 'joueuses', label: '👤 Joueuses' },
    { id: 'seance', label: '🎯 Séance' },
  ];

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 16,
    }} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={{
        background: '#0f172a', borderRadius: 16, width: '100%', maxWidth: 680,
        maxHeight: '90vh', display: 'flex', flexDirection: 'column',
        border: '1px solid #1e293b', boxShadow: '0 25px 60px rgba(0,0,0,0.6)',
      }}>
        {/* Header */}
        <div style={{
          padding: '16px 20px', borderBottom: '1px solid #1e293b',
          display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0,
        }}>
          <span style={{ fontSize: 22 }}>🤖</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, color: '#f1f5f9', fontSize: 15 }}>Analyse IA — Claude</div>
            <div style={{ color: '#64748b', fontSize: 12, marginTop: 1 }}>{matchLabel}</div>
          </div>
          {data && (
            <button
              onClick={() => setShowContextInput(v => !v)}
              style={{ background: '#1e293b', color: '#94a3b8', border: 'none', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', fontSize: 12 }}
            >✏️ Re-analyser</button>
          )}
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#64748b', fontSize: 22, cursor: 'pointer', lineHeight: 1, padding: '0 4px' }}>×</button>
        </div>

        {/* Context input (optionnel) */}
        {showContextInput && (
          <div style={{ padding: '12px 20px', borderBottom: '1px solid #1e293b', display: 'flex', gap: 8 }}>
            <input
              value={context}
              onChange={e => setContext(e.target.value)}
              placeholder="Contexte optionnel (blessures, conditions, adversaire...)"
              style={{ flex: 1, background: '#1e293b', border: '1px solid #334155', borderRadius: 8, padding: '8px 12px', color: '#e2e8f0', fontSize: 13 }}
            />
            <button
              onClick={() => { setShowContextInput(false); runAnalysis(context); }}
              style={{ background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 14px', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}
            >Analyser</button>
          </div>
        )}

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px 20px' }}>
          {loading && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 20px', gap: 16 }}>
              <div style={{ fontSize: 40, animation: 'spin 2s linear infinite' }}>⚙️</div>
              <p style={{ color: '#64748b', textAlign: 'center', fontSize: 14, margin: 0 }}>
                Claude analyse le match...<br/>
                <span style={{ fontSize: 12, color: '#475569' }}>Cela prend 10-20 secondes</span>
              </p>
              <style>{`@keyframes spin { to { transform: rotate(360deg); }}`}</style>
            </div>
          )}

          {error && (
            <div style={{ background: '#450a0a', border: '1px solid #7f1d1d', borderRadius: 10, padding: '16px 20px', margin: '20px 0' }}>
              <div style={{ color: '#fca5a5', fontWeight: 600, marginBottom: 6 }}>❌ Erreur d'analyse</div>
              <div style={{ color: '#f87171', fontSize: 13 }}>{error}</div>
              <button
                onClick={() => runAnalysis(context)}
                style={{ marginTop: 12, background: '#7f1d1d', color: '#fca5a5', border: 'none', borderRadius: 6, padding: '8px 16px', cursor: 'pointer', fontSize: 13 }}
              >🔄 Réessayer</button>
            </div>
          )}

          {data && !loading && (
            <>
              {/* Verdict + note */}
              <div style={{
                background: 'linear-gradient(135deg, #1e3a5f, #1e293b)',
                borderRadius: 12, padding: '16px 18px', margin: '16px 0 12px',
                display: 'flex', alignItems: 'center', gap: 14,
                border: '1px solid #2563eb33',
              }}>
                <NoteCircle note={data.note_globale || 7} />
                <p style={{ color: '#e2e8f0', fontWeight: 600, fontSize: 15, margin: 0, lineHeight: 1.4 }}>{data.verdict}</p>
              </div>

              {/* Joueuse du match */}
              {data.joueuse_du_match && (
                <div style={{
                  background: 'linear-gradient(135deg, #451a03, #1e293b)',
                  borderRadius: 10, padding: '12px 16px', marginBottom: 12,
                  border: '1px solid #d9770633',
                  display: 'flex', alignItems: 'flex-start', gap: 12,
                }}>
                  <span style={{ fontSize: 24, flexShrink: 0 }}>🏅</span>
                  <div>
                    <div style={{ color: '#fb923c', fontWeight: 700, fontSize: 14 }}>Joueuse du Match — {data.joueuse_du_match.nom}</div>
                    <div style={{ color: '#94a3b8', fontSize: 12.5, marginTop: 4, lineHeight: 1.5 }}>{data.joueuse_du_match.justification}</div>
                  </div>
                </div>
              )}

              {/* Tabs */}
              <div style={{ display: 'flex', gap: 4, marginBottom: 14, flexWrap: 'wrap' }}>
                {tabs.map(t => (
                  <button key={t.id} onClick={() => setActiveTab(t.id)} style={{
                    background: activeTab === t.id ? '#2563eb' : '#1e293b',
                    color: activeTab === t.id ? '#fff' : '#94a3b8',
                    border: 'none', borderRadius: 8, padding: '7px 14px',
                    cursor: 'pointer', fontSize: 13, fontWeight: activeTab === t.id ? 600 : 400,
                    transition: 'all 0.15s',
                  }}>{t.label}</button>
                ))}
              </div>

              {/* Tab : Bilan */}
              {activeTab === 'bilan' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ background: '#1e293b', borderRadius: 10, padding: '14px 16px' }}>
                    <div style={{ color: '#94a3b8', fontSize: 12, fontWeight: 600, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>Bilan général</div>
                    <p style={{ color: '#cbd5e1', fontSize: 13.5, margin: 0, lineHeight: 1.6 }}>{data.bilan_general}</p>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div>
                      <div style={{ color: '#22c55e', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>✅ Points forts</div>
                      {(data.points_forts || []).map((p, i) => (
                        <div key={i} style={{ background: '#052e16', borderRadius: 8, padding: '10px 12px', marginBottom: 6, borderLeft: '3px solid #22c55e' }}>
                          <div style={{ color: '#86efac', fontWeight: 600, fontSize: 13, marginBottom: 3 }}>{p.titre}</div>
                          <div style={{ color: '#6b7280', fontSize: 12, lineHeight: 1.5 }}>{p.detail}</div>
                        </div>
                      ))}
                    </div>
                    <div>
                      <div style={{ color: '#f59e0b', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>⚠️ À améliorer</div>
                      {(data.axes_amelioration || []).map((p, i) => (
                        <div key={i} style={{ background: '#431407', borderRadius: 8, padding: '10px 12px', marginBottom: 6, borderLeft: '3px solid #f59e0b' }}>
                          <div style={{ color: '#fcd34d', fontWeight: 600, fontSize: 13, marginBottom: 3 }}>{p.titre}</div>
                          <div style={{ color: '#6b7280', fontSize: 12, lineHeight: 1.5 }}>{p.detail}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Tab : Secteurs */}
              {activeTab === 'secteurs' && data.analyse_par_secteur && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {Object.entries(data.analyse_par_secteur).map(([key, val]) => (
                    <SectorCard key={key} sector={key} data={val} />
                  ))}
                </div>
              )}

              {/* Tab : Joueuses */}
              {activeTab === 'joueuses' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {(data.focus_joueuses || []).map((p, i) => (
                    <PlayerFocus key={i} p={p} />
                  ))}
                  {(!data.focus_joueuses || data.focus_joueuses.length === 0) && (
                    <p style={{ color: '#64748b', textAlign: 'center', padding: 30 }}>Aucun focus individuel dans cette analyse.</p>
                  )}
                </div>
              )}

              {/* Tab : Séance */}
              {activeTab === 'seance' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ background: '#1e293b', borderRadius: 10, padding: '14px 16px' }}>
                    <div style={{ color: '#94a3b8', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 }}>🎯 Priorités pour la prochaine séance</div>
                    {(data.recommandations_seance || []).map((r, i) => (
                      <div key={i} style={{
                        display: 'flex', gap: 12, padding: '10px 0',
                        borderBottom: i < (data.recommandations_seance.length - 1) ? '1px solid #0f172a' : 'none',
                      }}>
                        <span style={{
                          width: 26, height: 26, borderRadius: '50%', background: '#1d4ed8',
                          color: '#fff', fontWeight: 700, fontSize: 12,
                          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                        }}>{i + 1}</span>
                        <span style={{ color: '#cbd5e1', fontSize: 13.5, lineHeight: 1.5 }}>{r}</span>
                      </div>
                    ))}
                  </div>
                  {data.message_equipe && (
                    <div style={{
                      background: 'linear-gradient(135deg, #1e3a5f22, #1e293b)',
                      border: '1px solid #2563eb44', borderRadius: 10, padding: '14px 16px',
                    }}>
                      <div style={{ color: '#60a5fa', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>💬 Message du coach</div>
                      <p style={{ color: '#cbd5e1', fontSize: 13.5, margin: 0, lineHeight: 1.6, fontStyle: 'italic' }}>"{data.message_equipe}"</p>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

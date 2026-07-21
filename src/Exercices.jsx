import { useState, useEffect, useCallback } from "react";

const API_URL = "https://volleystat-backend.onrender.com";

export default function Exercices({ C, s, onBack }) {
  const [exercices, setExercices] = useState([]);
  const [categories, setCategories] = useState([]);
  const [niveaux, setNiveaux] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erreur, setErreur] = useState(null);

  // Filtres
  const [filtreCategorie, setFiltreCategorie] = useState(null);
  const [filtreNiveau, setFiltreNiveau] = useState(null);
  const [recherche, setRecherche] = useState("");

  // Formulaire de création / édition
  const [showForm, setShowForm] = useState(false);
  const [exerciceEnEdition, setExerciceEnEdition] = useState(null);
  const [detailExercice, setDetailExercice] = useState(null);

  const vide = {
    nom: "", description: "", objectif_pedagogique: "", consignes_coaching: "",
    categorie_id: "", niveau_id: "", effectif_min: "", effectif_max: "",
    duree_min: "", materiel_necessaire: "", source_url: "", source_auteur: "",
    source_pays: "", source_type: "video", tags: "",
  };
  const [form, setForm] = useState(vide);

  // ── Chargement des données ──────────────────────────────────────────────

  const chargerExercices = useCallback(async () => {
    const params = new URLSearchParams();
    if (filtreCategorie) params.set("categorie_id", filtreCategorie);
    if (filtreNiveau) params.set("niveau_id", filtreNiveau);
    if (recherche) params.set("recherche", recherche);
    const res = await fetch(`${API_URL}/exercices/?${params.toString()}`);
    const data = await res.json();
    setExercices(data);
  }, [filtreCategorie, filtreNiveau, recherche]);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const [catRes, nivRes] = await Promise.all([
          fetch(`${API_URL}/exercices/categories`),
          fetch(`${API_URL}/exercices/niveaux`),
        ]);
        setCategories(await catRes.json());
        setNiveaux(await nivRes.json());
        await chargerExercices();
      } catch (e) {
        setErreur("Impossible de charger les données. Le serveur met parfois 50s à démarrer — réessaie dans un instant.");
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { chargerExercices(); }, [chargerExercices]);

  // ── Création / édition ──────────────────────────────────────────────────

  const ouvrirNouveau = () => {
    setExerciceEnEdition(null);
    setForm(vide);
    setShowForm(true);
  };

  const ouvrirEdition = (ex) => {
    setExerciceEnEdition(ex);
    setForm({
      nom: ex.nom || "", description: ex.description || "",
      objectif_pedagogique: ex.objectif_pedagogique || "",
      consignes_coaching: ex.consignes_coaching || "",
      categorie_id: ex.categorie_id || "", niveau_id: ex.niveau_id || "",
      effectif_min: ex.effectif_min || "", effectif_max: ex.effectif_max || "",
      duree_min: ex.duree_min || "", materiel_necessaire: ex.materiel_necessaire || "",
      source_url: ex.source_url || "", source_auteur: ex.source_auteur || "",
      source_pays: ex.source_pays || "", source_type: ex.source_type || "video",
      tags: "",
    });
    setShowForm(true);
  };

  const enregistrer = async () => {
    const payload = {
      ...form,
      categorie_id: form.categorie_id ? Number(form.categorie_id) : null,
      niveau_id: form.niveau_id ? Number(form.niveau_id) : null,
      effectif_min: form.effectif_min ? Number(form.effectif_min) : null,
      effectif_max: form.effectif_max ? Number(form.effectif_max) : null,
      duree_min: form.duree_min ? Number(form.duree_min) : null,
      tags: form.tags ? form.tags.split(",").map(t => t.trim()).filter(Boolean) : [],
    };

    const url = exerciceEnEdition
      ? `${API_URL}/exercices/${exerciceEnEdition.id}`
      : `${API_URL}/exercices/`;
    const method = exerciceEnEdition ? "PATCH" : "POST";

    await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    setShowForm(false);
    chargerExercices();
  };

  const supprimer = async (id) => {
    if (!window.confirm("Supprimer définitivement cet exercice ?")) return;
    await fetch(`${API_URL}/exercices/${id}`, { method: "DELETE" });
    setDetailExercice(null);
    chargerExercices();
  };

  // ── Rendu ────────────────────────────────────────────────────────────────

  if (loading) {
    return <div style={{ padding: 40, textAlign: "center", color: C.gray400 }}>Chargement des exercices…</div>;
  }

  if (erreur) {
    return (
      <div style={{ padding: 40, textAlign: "center" }}>
        <p style={{ color: C.red }}>{erreur}</p>
        <button style={s.btn("ghost")} onClick={() => window.location.reload()}>Réessayer</button>
      </div>
    );
  }

  const categorieParId = Object.fromEntries(categories.map(c => [c.id, c]));

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>📚 Bibliothèque d'exercices</h2>
        <button style={s.btn("primary")} onClick={ouvrirNouveau}>+ Nouvel exercice</button>
      </div>

      {/* Filtres */}
      <div style={{ ...s.card, padding: 16, marginBottom: 20, display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
        <div style={{ flex: "1 1 200px" }}>
          <label style={s.label}>Recherche</label>
          <input style={s.input} placeholder="Nom de l'exercice…"
            value={recherche} onChange={e => setRecherche(e.target.value)} />
        </div>
        <div style={{ flex: "1 1 160px" }}>
          <label style={s.label}>Catégorie</label>
          <select style={s.input} value={filtreCategorie || ""} onChange={e => setFiltreCategorie(e.target.value || null)}>
            <option value="">Toutes</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.libelle}</option>)}
          </select>
        </div>
        <div style={{ flex: "1 1 160px" }}>
          <label style={s.label}>Niveau</label>
          <select style={s.input} value={filtreNiveau || ""} onChange={e => setFiltreNiveau(e.target.value || null)}>
            <option value="">Tous</option>
            {niveaux.map(n => <option key={n.id} value={n.id}>{n.libelle}</option>)}
          </select>
        </div>
      </div>

      {/* Liste */}
      {exercices.length === 0 ? (
        <div style={{ ...s.card, padding: 40, textAlign: "center", color: C.gray400 }}>
          Aucun exercice ne correspond à ces filtres pour l'instant.
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 14 }}>
          {exercices.map(ex => {
            const cat = categorieParId[ex.categorie_id];
            return (
              <div key={ex.id} style={{ ...s.card, padding: 16, cursor: "pointer" }}
                onClick={() => setDetailExercice(ex)}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                  <span style={s.badge(C.gray800, cat?.couleur || C.gray100)}>{cat?.libelle || "—"}</span>
                  {ex.duree_min && <span style={{ fontSize: 11, color: C.gray400 }}>{ex.duree_min} min</span>}
                </div>
                <h3 style={{ margin: "0 0 6px", fontSize: 15, fontWeight: 700 }}>{ex.nom}</h3>
                {ex.description && (
                  <p style={{ margin: 0, fontSize: 12, color: C.gray600, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                    {ex.description}
                  </p>
                )}
                {(ex.effectif_min || ex.effectif_max) && (
                  <p style={{ margin: "8px 0 0", fontSize: 11, color: C.gray400 }}>
                    👥 {ex.effectif_min || "?"}–{ex.effectif_max || "?"} joueuses
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modale détail */}
      {detailExercice && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}
          onClick={() => setDetailExercice(null)}>
          <div style={{ ...s.card, maxWidth: 600, width: "90%", maxHeight: "85vh", overflow: "auto", padding: 24 }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <h2 style={{ margin: "0 0 12px" }}>{detailExercice.nom}</h2>
              <button style={s.btn("ghost")} onClick={() => setDetailExercice(null)}>✕</button>
            </div>
            {detailExercice.description && <p><strong>Description :</strong> {detailExercice.description}</p>}
            {detailExercice.objectif_pedagogique && <p><strong>Objectif :</strong> {detailExercice.objectif_pedagogique}</p>}
            {detailExercice.consignes_coaching && <p><strong>Consignes coaching :</strong> {detailExercice.consignes_coaching}</p>}
            {detailExercice.materiel_necessaire && <p><strong>Matériel :</strong> {detailExercice.materiel_necessaire}</p>}
            {detailExercice.source_url && (
              <p><strong>Source :</strong> <a href={detailExercice.source_url} target="_blank" rel="noreferrer">{detailExercice.source_auteur || detailExercice.source_url}</a></p>
            )}
            <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
              <button style={s.btn("primary")} onClick={() => { ouvrirEdition(detailExercice); setDetailExercice(null); }}>Modifier</button>
              <button style={s.btn("danger")} onClick={() => supprimer(detailExercice.id)}>Supprimer</button>
            </div>
          </div>
        </div>
      )}

      {/* Modale formulaire */}
      {showForm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}
          onClick={() => setShowForm(false)}>
          <div style={{ ...s.card, maxWidth: 560, width: "90%", maxHeight: "85vh", overflow: "auto", padding: 24 }}
            onClick={e => e.stopPropagation()}>
            <h2 style={{ marginTop: 0 }}>{exerciceEnEdition ? "Modifier l'exercice" : "Nouvel exercice"}</h2>

            <label style={s.label}>Nom *</label>
            <input style={{ ...s.input, marginBottom: 10 }} value={form.nom}
              onChange={e => setForm({ ...form, nom: e.target.value })} />

            <label style={s.label}>Description</label>
            <textarea style={{ ...s.input, marginBottom: 10, minHeight: 60 }} value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })} />

            <label style={s.label}>Objectif pédagogique</label>
            <input style={{ ...s.input, marginBottom: 10 }} value={form.objectif_pedagogique}
              onChange={e => setForm({ ...form, objectif_pedagogique: e.target.value })} />

            <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
              <div style={{ flex: 1 }}>
                <label style={s.label}>Catégorie</label>
                <select style={s.input} value={form.categorie_id}
                  onChange={e => setForm({ ...form, categorie_id: e.target.value })}>
                  <option value="">—</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.libelle}</option>)}
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <label style={s.label}>Niveau</label>
                <select style={s.input} value={form.niveau_id}
                  onChange={e => setForm({ ...form, niveau_id: e.target.value })}>
                  <option value="">—</option>
                  {niveaux.map(n => <option key={n.id} value={n.id}>{n.libelle}</option>)}
                </select>
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
              <div style={{ flex: 1 }}>
                <label style={s.label}>Effectif min</label>
                <input type="number" style={s.input} value={form.effectif_min}
                  onChange={e => setForm({ ...form, effectif_min: e.target.value })} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={s.label}>Effectif max</label>
                <input type="number" style={s.input} value={form.effectif_max}
                  onChange={e => setForm({ ...form, effectif_max: e.target.value })} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={s.label}>Durée (min)</label>
                <input type="number" style={s.input} value={form.duree_min}
                  onChange={e => setForm({ ...form, duree_min: e.target.value })} />
              </div>
            </div>

            <label style={s.label}>Matériel nécessaire</label>
            <input style={{ ...s.input, marginBottom: 10 }} value={form.materiel_necessaire}
              onChange={e => setForm({ ...form, materiel_necessaire: e.target.value })} />

            <label style={s.label}>Lien source (vidéo, site…)</label>
            <input style={{ ...s.input, marginBottom: 10 }} value={form.source_url}
              onChange={e => setForm({ ...form, source_url: e.target.value })} />

            <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
              <div style={{ flex: 1 }}>
                <label style={s.label}>Auteur / entraîneur source</label>
                <input style={s.input} value={form.source_auteur}
                  onChange={e => setForm({ ...form, source_auteur: e.target.value })} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={s.label}>Pays d'origine</label>
                <input style={s.input} value={form.source_pays}
                  onChange={e => setForm({ ...form, source_pays: e.target.value })} />
              </div>
            </div>

            <label style={s.label}>Tags (séparés par des virgules)</label>
            <input style={{ ...s.input, marginBottom: 16 }} placeholder="transition, 3v3, puissance"
              value={form.tags} onChange={e => setForm({ ...form, tags: e.target.value })} />

            <div style={{ display: "flex", gap: 8 }}>
              <button style={s.btn("primary")} onClick={enregistrer} disabled={!form.nom}>
                {exerciceEnEdition ? "Enregistrer les modifications" : "Créer l'exercice"}
              </button>
              <button style={s.btn("ghost")} onClick={() => setShowForm(false)}>Annuler</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { createMatch, importSetStats } from "../api/client";

export default function ImportMatch() {
  const navigate = useNavigate();
  const [step, setStep]       = useState(1);   // 1 = infos match, 2 = import sets
  const [matchId, setMatchId] = useState(null);
  const [form, setForm]       = useState({
    date: "", team_home: "Bailleul", team_away: "", sets_count: 3,
  });
  const [files, setFiles]     = useState({});   // { 1: File, 2: File, 3: File }
  const [loading, setLoading] = useState(false);

  const handleCreateMatch = async () => {
    const sets = Array.from({ length: Number(form.sets_count) }, (_, i) => ({
      set_number: i + 1, score_home: 0, score_away: 0,
    }));
    const res = await createMatch({ ...form, sets });
    setMatchId(res.data.id);
    setStep(2);
  };

  const handleImportAll = async () => {
    setLoading(true);
    for (const [setNum, file] of Object.entries(files)) {
      if (file) await importSetStats(matchId, setNum, file);
    }
    setLoading(false);
    navigate(`/match/${matchId}`);
  };

  if (step === 1) return (
    <div className="max-w-lg mx-auto bg-white rounded-xl shadow p-8">
      <h2 className="text-xl font-bold mb-6">Nouveau match</h2>
      <div className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm font-medium">
          Date
          <input type="date" value={form.date} onChange={e => setForm({...form, date: e.target.value})}
            className="border rounded p-2" />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Équipe domicile
          <input value={form.team_home} onChange={e => setForm({...form, team_home: e.target.value})}
            className="border rounded p-2" />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Équipe visiteur
          <input value={form.team_away} onChange={e => setForm({...form, team_away: e.target.value})}
            className="border rounded p-2" placeholder="Ex : Malakof" />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Nombre de sets
          <select value={form.sets_count} onChange={e => setForm({...form, sets_count: e.target.value})}
            className="border rounded p-2">
            {[2,3,4,5].map(n => <option key={n}>{n}</option>)}
          </select>
        </label>
        <button onClick={handleCreateMatch}
          className="bg-blue-600 text-white py-2 rounded font-semibold hover:bg-blue-700 mt-2">
          Créer le match →
        </button>
      </div>
    </div>
  );

  return (
    <div className="max-w-lg mx-auto bg-white rounded-xl shadow p-8">
      <h2 className="text-xl font-bold mb-2">Importer les stats</h2>
      <p className="text-sm text-gray-500 mb-6">Un fichier Excel ou CSV par set (colonnes : Joueurs, S+, S0, S-, R++, R+, R0, R-, A+, A0, A-, B+, Bdef, B-, P+, P0, P-, D+, D-, FF, Gagnants, Directes)</p>
      <div className="flex flex-col gap-4">
        {Array.from({ length: Number(form.sets_count) }, (_, i) => i + 1).map(setNum => (
          <label key={setNum} className="flex flex-col gap-1 text-sm font-medium">
            Set {setNum}
            <input type="file" accept=".csv,.xlsx,.xls"
              onChange={e => setFiles(prev => ({...prev, [setNum]: e.target.files[0]}))}
              className="border rounded p-2 text-sm" />
          </label>
        ))}
        <button onClick={handleImportAll} disabled={loading}
          className="bg-green-600 text-white py-2 rounded font-semibold hover:bg-green-700 mt-2 disabled:opacity-50">
          {loading ? "Import en cours…" : "Importer et voir les stats →"}
        </button>
      </div>
    </div>
  );
}

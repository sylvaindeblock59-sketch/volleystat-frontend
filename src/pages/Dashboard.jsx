import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getMatches, deleteMatch } from "../api/client";

export default function Dashboard() {
  const [matches, setMatches] = useState([]);
  const navigate = useNavigate();

  const load = () => getMatches().then(r => setMatches(r.data));
  useEffect(() => { load(); }, []);

  const handleDelete = async (id, e) => {
    e.stopPropagation();
    if (confirm("Supprimer ce match ?")) {
      await deleteMatch(id);
      load();
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-6 text-gray-800">Mes matches</h1>
      {matches.length === 0 && (
        <p className="text-gray-500 text-center py-16">Aucun match. Commencez par en créer un !</p>
      )}
      <div className="flex flex-col gap-3">
        {matches.map(m => (
          <div
            key={m.id}
            onClick={() => navigate(`/match/${m.id}`)}
            className="bg-white rounded-xl shadow p-4 flex items-center justify-between cursor-pointer hover:shadow-md transition"
          >
            <div>
              <p className="font-semibold text-gray-800 text-lg">
                {m.team_home} <span className="text-blue-600">vs</span> {m.team_away}
              </p>
              <p className="text-sm text-gray-500">{new Date(m.date).toLocaleDateString("fr-FR")} · {m.sets_count} set(s)</p>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-2xl font-bold text-blue-700">{m.score}</span>
              <button
                onClick={(e) => handleDelete(m.id, e)}
                className="text-red-400 hover:text-red-600 text-sm"
              >✕</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

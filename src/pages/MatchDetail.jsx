import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { getMatchStats, getSetStats } from "../api/client";
import StatsTable from "../components/StatsTableFixed";
import Charts from "../components/Charts";

export default function MatchDetail() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [activeSet, setActiveSet] = useState("global");

  useEffect(() => {
    if (!id) return;
    getMatchStats(id)
      .then((r) => setData(r.data))
      .catch(() => setData({ players: {} }));
  }, [id]);

  const handleSetChange = async (setVal) => {
    setActiveSet(setVal);
    if (setVal === "global") {
      const r = await getMatchStats(id);
      setData(r.data);
      return;
    }

    const r = await getSetStats(id, setVal);
    setData({
      ...r.data,
      sets: r.data.set ? [r.data.set] : [],
    });
  };

  if (!data) {
    return <p className="text-center text-gray-400 mt-20">Chargement…</p>;
  }

  const sets = Array.isArray(data.sets)
    ? data.sets
    : data.set
      ? [data.set]
      : [];
  const tabs = ["global", ...sets.map((s) => s.number ?? s.num)];
  const players = data.players ?? {};

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <div className="bg-white rounded-xl shadow p-5 mb-6 flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">
            {data.team_home || "Match"} <span className="text-blue-500">vs</span> {data.team_away || `#${id}`}
          </h1>
          <p className="text-sm text-gray-400">{data.date || "Statistiques détaillées"}</p>
        </div>
        <div className="flex gap-4 flex-wrap">
          {sets.map((s) => (
            <div key={s.number ?? s.num} className="text-center">
              <p className="text-xs text-gray-400">Set {s.number ?? s.num}</p>
              <p className="text-xl font-bold text-blue-700">
                {s.score_home ?? s.scoreA} – {s.score_away ?? s.scoreB}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="flex gap-2 mb-5 flex-wrap">
        {tabs.map((t) => (
          <button
            key={t}
            onClick={() => handleSetChange(t)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition ${
              activeSet === t
                ? "bg-blue-600 text-white"
                : "bg-white text-gray-600 border hover:bg-gray-50"
            }`}
          >
            {t === "global" ? "Global" : `Set ${t}`}
          </button>
        ))}
      </div>

      <StatsTable players={players} />
      <Charts players={players} />
    </div>
  );
}

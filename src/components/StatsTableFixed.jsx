const COLS = [
  {
    group: "Service",
    cols: [
      ["SG", "SG"],
      ["S_plus", "S+"],
      ["S_zero", "S0"],
      ["S_minus", "S−"],
    ],
  },
  {
    group: "Réception",
    cols: [
      ["R_pp", "R++"],
      ["R_plus", "R+"],
      ["R_zero", "R0"],
      ["R_minus", "R−"],
    ],
  },
  {
    group: "Attaque",
    cols: [
      ["A_plus", "A+"],
      ["A_zero", "A0"],
      ["A_minus", "A−"],
    ],
  },
  {
    group: "Bloc",
    cols: [
      ["B_plus", "B+"],
      ["B_def", "Bd"],
      ["B_minus", "B−"],
    ],
  },
  {
    group: "Passe",
    cols: [
      ["P_plus", "P+"],
      ["P_zero", "P0"],
      ["P_minus", "P−"],
    ],
  },
  {
    group: "Défense",
    cols: [
      ["D_plus", "D+"],
      ["D_minus", "D−"],
    ],
  },
  {
    group: "Bilan",
    cols: [
      ["FF", "FF"],
      ["points_gagnants", "Pts✓"],
      ["fautes_directes", "Fts✗"],
    ],
  },
];

const GROUP_COLORS = [
  "bg-yellow-50",
  "bg-green-50",
  "bg-red-50",
  "bg-purple-50",
  "bg-blue-50",
  "bg-orange-50",
  "bg-gray-100",
];

export default function StatsTableFixed({ players }) {
  const names = Object.keys(players || {});

  if (!names.length) {
    return <p className="text-center text-gray-400 py-10">Aucune statistique disponible.</p>;
  }

  return (
    <div className="overflow-x-auto bg-white rounded-xl shadow mb-6">
      <table className="text-xs w-full border-collapse">
        <thead>
          <tr className="bg-gray-100">
            <th className="sticky left-0 bg-gray-100 px-3 py-2 text-left font-semibold text-gray-700 border-b">Joueuse</th>
            {COLS.flatMap((group, gi) =>
              group.cols.map(([key, label]) => (
                <th
                  key={key}
                  className={`px-2 py-2 text-center font-semibold text-gray-600 border-b ${GROUP_COLORS[gi]}`}
                >
                  {label}
                </th>
              ))
            )}
          </tr>
          <tr className="text-[10px] text-gray-400">
            <td className="sticky left-0 bg-white" />
            {COLS.map((group, gi) => (
              <td
                key={group.group}
                colSpan={group.cols.length}
                className={`text-center font-medium uppercase tracking-wider border-b py-1 ${GROUP_COLORS[gi]}`}
              >
                {group.group}
              </td>
            ))}
          </tr>
        </thead>
        <tbody>
          {names.map((name, i) => (
            <tr key={name} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
              <td className="sticky left-0 px-3 py-2 font-semibold text-gray-700 border-b border-gray-100 bg-inherit">
                {name}
              </td>
              {COLS.flatMap((group) =>
                group.cols.map(([key]) => (
                  <td key={`${name}-${key}`} className="px-2 py-2 text-center border-b border-gray-100">
                    {players[name]?.[key] ?? 0}
                  </td>
                ))
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

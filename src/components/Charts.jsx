import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Pie,
  PieChart,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const COLORS = ["#2563eb", "#dc2626", "#16a34a", "#7c3aed", "#f59e0b", "#0891b2"];

const sum = (player, key) => Number(player?.[key] || 0);

export default function Charts({ players }) {
  const names = Object.keys(players || {});

  if (!names.length) return null;

  const radarData = [
    { subject: "Service", fullMark: 20 },
    { subject: "Réception", fullMark: 20 },
    { subject: "Attaque", fullMark: 20 },
    { subject: "Bloc", fullMark: 20 },
    { subject: "Passe", fullMark: 20 },
    { subject: "Défense", fullMark: 20 },
  ];

  names.slice(0, 4).forEach((name) => {
    const player = players[name];
    radarData[0][name] = sum(player, "S_plus") + sum(player, "S_zero") + sum(player, "SG") * 2;
    radarData[1][name] = sum(player, "R_pp") * 2 + sum(player, "R_plus") + sum(player, "R_zero");
    radarData[2][name] = sum(player, "A_plus") * 2 + sum(player, "A_zero");
    radarData[3][name] = sum(player, "B_plus") * 2 + sum(player, "B_def");
    radarData[4][name] = sum(player, "P_plus") * 2 + sum(player, "P_zero");
    radarData[5][name] = sum(player, "D_plus") * 2;
  });

  const attackData = names.map((name) => ({
    name: name.length > 8 ? `${name.slice(0, 8)}…` : name,
    A_plus: sum(players[name], "A_plus"),
    A_zero: sum(players[name], "A_zero"),
    A_minus: sum(players[name], "A_minus"),
  }));

  const serviceData = [
    { name: "SG", value: names.reduce((acc, n) => acc + sum(players[n], "SG"), 0) },
    { name: "S+", value: names.reduce((acc, n) => acc + sum(players[n], "S_plus"), 0) },
    { name: "S0", value: names.reduce((acc, n) => acc + sum(players[n], "S_zero"), 0) },
    { name: "S−", value: names.reduce((acc, n) => acc + sum(players[n], "S_minus"), 0) },
  ];

  const pointsData = names
    .map((name) => ({
      name: name.length > 8 ? `${name.slice(0, 8)}…` : name,
      points_gagnants: sum(players[name], "points_gagnants"),
      fautes_directes: sum(players[name], "fautes_directes"),
    }))
    .sort((a, b) => b.points_gagnants - a.points_gagnants);

  return (
    <div className="grid gap-4 md:grid-cols-2 mb-6">
      <div className="bg-white rounded-xl shadow p-4">
        <p className="text-sm font-semibold text-gray-600 mb-3">Profil par compétence</p>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart data={radarData}>
              <PolarGrid />
              <PolarAngleAxis dataKey="subject" />
              <PolarRadiusAxis angle={30} domain={[0, 20]} />
              {names.slice(0, 4).map((name, i) => (
                <Radar
                  key={name}
                  name={name}
                  dataKey={name}
                  stroke={COLORS[i]}
                  fill={COLORS[i]}
                  fillOpacity={0.18}
                />
              ))}
              <Legend />
              <Tooltip />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow p-4">
        <p className="text-sm font-semibold text-gray-600 mb-3">Efficacité attaque</p>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={attackData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="A_plus" fill="#16a34a" name="A+" />
              <Bar dataKey="A_zero" fill="#f59e0b" name="A0" />
              <Bar dataKey="A_minus" fill="#dc2626" name="A−" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow p-4">
        <p className="text-sm font-semibold text-gray-600 mb-3">Répartition services</p>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={serviceData}
                dataKey="value"
                nameKey="name"
                outerRadius={90}
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
              >
                {serviceData.map((entry, index) => (
                  <Pie key={`${entry.name}-${index}`} dataKey="value" fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow p-4">
        <p className="text-sm font-semibold text-gray-600 mb-3">Points gagnants / fautes directes</p>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={pointsData} layout="vertical" margin={{ left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" />
              <YAxis type="category" dataKey="name" width={90} />
              <Tooltip />
              <Legend />
              <Bar dataKey="points_gagnants" fill="#2563eb" name="Pts gagnants" />
              <Bar dataKey="fautes_directes" fill="#dc2626" name="Fautes directes" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

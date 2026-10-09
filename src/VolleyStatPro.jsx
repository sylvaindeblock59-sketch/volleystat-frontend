    import { useState, useRef, useEffect, useCallback } from "react";
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis,
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie, Legend, LineChart, Line
} from "recharts";
import VideoTagger from "./VideoTagger";
import LiveTagger from "./LiveTagger";
import Seasons from "./Seasons";
import ImportFFVB from "./ImportFFVB";
import { PLAYERS } from "./data/players";
import MatchAnalysisModal from "./MatchAnalysisModal";

// ─── Design tokens ────────────────────────────────────────────────────────────
const C = {
  navy:    "#0f172a", blue:    "#1e40af", blueLt:  "#3b82f6",
  blueXlt: "#dbeafe", gold:    "#d97706", goldLt:  "#fef3c7",
  green:   "#16a34a", greenLt: "#dcfce7", red:     "#dc2626",
  redLt:   "#fee2e2", purple:  "#7c3aed", purpleLt:"#ede9fe",
  cyan:    "#0891b2", cyanLt:  "#cffafe",
  gray50:  "#f8fafc", gray100: "#f1f5f9", gray200: "#e2e8f0",
  gray400: "#94a3b8", gray600: "#475569", gray800: "#1e293b", white: "#ffffff",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const uid = () => Math.random().toString(36).slice(2, 9);
const today = () => new Date().toISOString().slice(0, 10);

// ─── Définition des stats ─────────────────────────────────────────────────────
const STAT_FIELDS = {
  service:   ["SG","S+","S0","S-"],
  reception: ["R++","R+","R0","R-"],
  attaque:   ["A+","A0","A-"],
  bloc:      ["B+","Bdef","B-"],
  passe:     ["P+","P0","P-"],
  defense:   ["D+","D-"],
  bilan:     ["FF","PG","FD","errS","errA"],
};
const STAT_LABELS = {
  SG:"SG","S+":"S+","S0":"S0","S-":"S−",
  "R++":"R++","R+":"R+","R0":"R0","R-":"R−",
  "A+":"A+","A0":"A0","A-":"A−",
  "B+":"B+","Bdef":"Bd","B-":"B−",
  "P+":"P+","P0":"P0","P-":"P−",
  "D+":"D+","D-":"D−",
  FF:"FF", PG:"Pts✓", FD:"Fts✗", errS:"errS", errA:"errA",
};
const GROUP_META = [
  { key:"service",   label:"Service",   color:C.blue,   bg:C.blueXlt  },
  { key:"reception", label:"Réception", color:C.green,  bg:C.greenLt  },
  { key:"attaque",   label:"Attaque",   color:C.red,    bg:C.redLt    },
  { key:"bloc",      label:"Bloc",      color:C.purple, bg:C.purpleLt },
  { key:"passe",     label:"Passe",     color:C.gold,   bg:C.goldLt   },
  { key:"defense",   label:"Défense",   color:C.cyan,   bg:C.cyanLt   },
  { key:"bilan",     label:"Bilan",     color:C.gray800,bg:C.gray100  },
];
// Champs vraiment saisissables (PG/FD ne se saisissent jamais à la main : ils sont toujours recalculés)
const EDITABLE_FIELDS = GROUP_META.flatMap(g => STAT_FIELDS[g.key]).filter(f => f !== "PG" && f !== "FD");
// Calcul unique de Points Gagnants / Fautes Directes à partir des stats détaillées — utilisé PARTOUT (création, édition, recalcul)
const computePGFD = (v) => ({
  PG: (v.SG || 0) + (v["A+"] || 0) + (v["B+"] || 0),
  FD: (v["S-"] || 0) + (v["A-"] || 0) + (v.R0 || 0),
});
const EMPTY_STATS = () => {
  const s = {};
  Object.values(STAT_FIELDS).flat().forEach(f => { s[f] = 0; });
  return s;
};
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => typeof window !== "undefined" && window.innerWidth < 768);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);
  return isMobile;
}
const sumStats = (arr) => {
  const t = EMPTY_STATS();
  arr.forEach(s => Object.keys(t).forEach(k => { t[k] += (s[k]||0); }));
  return t;
};

// ─── Données démo ─────────────────────────────────────────────────────────────
const SEED = [
  {
    id:"m1", date:"2026-02-22", equipeA:"Bailleul", equipeB:"Malakof",
    sets:[
      { id:"s1", num:1, scoreA:25, scoreB:13, stats:[
        { id:"p1", nom:"Sarah",  titulaire:true,  ...EMPTY_STATS(), "S+":3,"S0":2,"S-":1,"R++":4,"R+":2,"A+":7,"A0":2,"A-":1,"B+":2,"Bdef":1,"P+":5,"P0":1,"D+":3, PG:10,FD:2 },
        { id:"p2", nom:"Julie",  titulaire:true,  ...EMPTY_STATS(), "S+":1,"S0":3,"S-":2,"R++":2,"R+":3,"R0":1,"A+":4,"A0":3,"A-":2,"P+":3,"P0":2,"P-":1,"D+":2,"D-":1, PG:6,FD:3 },
        { id:"p3", nom:"Léa",    titulaire:true,  ...EMPTY_STATS(), SG:1,"S+":2,"S-":1,"R++":1,"R+":2,"R0":2,"R-":1,"A+":5,"A0":1,"B+":3,"B-":1,"D+":4, PG:8,FD:1 },
        { id:"p4", nom:"Emma",   titulaire:false, ...EMPTY_STATS(), "S0":2,"S-":1,"R+":1,"R0":1,"A+":2,"A0":1, PG:3,FD:1 },
        { id:"p5", nom:"Chloé",  titulaire:true,  ...EMPTY_STATS(), "S+":2,"S0":1,"R++":3,"R+":1,"P+":8,"P0":2,"D+":2, PG:5,FD:0 },
        { id:"p6", nom:"Marie",  titulaire:true,  ...EMPTY_STATS(), "S+":1,"B+":4,"Bdef":2,"B-":1,"D+":5,"D-":1, PG:7,FD:2 },
      ]},
      { id:"s2", num:2, scoreA:25, scoreB:21, stats:[
        { id:"q1", nom:"Sarah",  titulaire:true,  ...EMPTY_STATS(), "S+":2,"S0":3,"S-":1,"R++":3,"R+":3,"A+":6,"A0":3,"A-":2,"B+":1,"P+":4,"P0":2,"D+":2, PG:8,FD:3 },
        { id:"q2", nom:"Julie",  titulaire:true,  ...EMPTY_STATS(), "S+":2,"S0":2,"S-":1,"R++":1,"R+":4,"R0":2,"A+":3,"A0":2,"A-":1,"P+":2,"P0":3,"P-":1,"D+":1,"D-":2, PG:4,FD:2 },
        { id:"q3", nom:"Léa",    titulaire:true,  ...EMPTY_STATS(), "S+":3,"S-":2,"R+":2,"R0":3,"R-":1,"A+":4,"A0":2,"A-":1,"B+":2,"D+":3, PG:6,FD:2 },
        { id:"q5", nom:"Chloé",  titulaire:true,  ...EMPTY_STATS(), "S+":1,"S0":2,"R++":2,"R+":2,"P+":6,"P0":3,"P-":1,"D+":3, PG:4,FD:1 },
        { id:"q6", nom:"Marie",  titulaire:true,  ...EMPTY_STATS(), "S+":2,"B+":3,"Bdef":1,"B-":2,"D+":4,"D-":1, PG:5,FD:2 },
      ]},
      { id:"s3", num:3, scoreA:25, scoreB:18, stats:[
        { id:"r1", nom:"Sarah",  titulaire:true,  ...EMPTY_STATS(), "S+":4,"S0":1,"R++":5,"R+":1,"A+":9,"A0":1,"B+":2,"P+":3,"D+":4, PG:12,FD:1 },
        { id:"r2", nom:"Julie",  titulaire:true,  ...EMPTY_STATS(), "S+":1,"S0":2,"R++":2,"R+":2,"R0":2,"A+":2,"A0":3,"A-":1,"P+":3,"P0":1,"D+":2, PG:4,FD:2 },
        { id:"r3", nom:"Léa",    titulaire:true,  ...EMPTY_STATS(), "S+":2,"S0":2,"R+":1,"R0":2,"A+":6,"A-":1,"B+":1,"Bdef":1,"D+":3, PG:7,FD:1 },
        { id:"r4", nom:"Emma",   titulaire:false, ...EMPTY_STATS(), "S+":1,"A+":3,"A0":1, PG:4,FD:0 },
        { id:"r5", nom:"Chloé",  titulaire:true,  ...EMPTY_STATS(), "S+":2,"S0":1,"R++":3,"R+":2,"P+":7,"P0":2,"D+":2, PG:5,FD:1 },
        { id:"r6", nom:"Marie",  titulaire:true,  ...EMPTY_STATS(), "S+":1,"S0":1,"B+":5,"Bdef":1,"D+":6, PG:6,FD:1 },
      ]},
    ]
  }
];

// ─── API ──────────────────────────────────────────────────────────────────────
const API_URL = "https://volleystat-backend.onrender.com";

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = {
app: {
    minHeight: "100vh",
    backgroundColor: C.gray50,
    backgroundImage: `linear-gradient(rgba(248,250,252,0.92), rgba(248,250,252,0.92)), url(/hero-volleyball.jpg)`,
    backgroundSize: "cover",
    backgroundAttachment: "fixed",
    backgroundPosition: "center",
    fontFamily: "'DM Sans','Segoe UI',sans-serif",
    color: C.gray800
  },
 header: {
backgroundImage: `linear-gradient(rgba(15,23,42,0.5), rgba(15,23,42,0.5)), url(/hero-volleyball.jpg)`,    backgroundSize: "cover",
    backgroundPosition: "center 35%",
    padding: "0 24px",
    display: "flex",
    alignItems: "center",
    gap: 16,
    height: 72,
    boxShadow: "0 2px 16px rgba(0,0,0,0.25)"
  },
  logo:   { fontSize:22, fontWeight:700, color:C.white, letterSpacing:"-0.5px", display:"flex", alignItems:"center", gap:8 },
  nav:    { display:"flex", gap:4, marginLeft:24 },
navBtn: (a) => ({ padding:"6px 14px", borderRadius:8, border:"none", cursor:"pointer", fontSize:13, fontWeight:500, background:a?"rgba(255,255,255,0.18)":"transparent", color:a?C.white:"rgba(255,255,255,0.65)", transition:"all 0.15s", boxShadow:a?"inset 0 -2px 0 #fbbf24":"none" }),  main:   { maxWidth:1200, margin:"0 auto", padding:"24px 16px" },
  card:   { background:C.white, borderRadius:12, border:`1px solid ${C.gray200}`, overflow:"hidden" },
  btn:    (v="primary") => ({ padding:"9px 18px", borderRadius:8, border:"none", cursor:"pointer", fontSize:13, fontWeight:600, background:v==="primary"?C.blue:v==="success"?C.green:v==="danger"?C.red:v==="purple"?C.purple:C.gray100, color:v==="ghost"?C.gray600:C.white, display:"inline-flex", alignItems:"center", gap:6, transition:"opacity 0.15s" }),
  input:  { width:"100%", padding:"9px 12px", borderRadius:8, border:`1px solid ${C.gray200}`, fontSize:13, outline:"none", background:C.white, color:C.gray800, boxSizing:"border-box" },
  label:  { fontSize:12, fontWeight:600, color:C.gray600, marginBottom:4, display:"block", textTransform:"uppercase", letterSpacing:"0.05em" },
  badge:  (color,bg) => ({ display:"inline-block", padding:"2px 8px", borderRadius:4, fontSize:11, fontWeight:600, color, background:bg }),
  tag:    (a) => ({ padding:"4px 10px", borderRadius:6, fontSize:12, fontWeight:600, cursor:"pointer", border:`1px solid ${a?C.blue:C.gray200}`, background:a?C.blueXlt:C.white, color:a?C.blue:C.gray600, transition:"all 0.12s" }),
};

// ─── Composants stats ─────────────────────────────────────────────────────────
function SectionHeader({ label, color, bg, count }) {
  return (
    <th colSpan={count} style={{ padding:"4px 6px", fontSize:10, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.07em", color, background:bg, textAlign:"center", borderBottom:`2px solid ${color}`, whiteSpace:"nowrap" }}>
      {label}
    </th>
  );
}
function CompactPlayerRow({ nom, ps, editable, onEdit }) {
  const [expanded, setExpanded] = useState(false);
  const r = computeRates(ps);
  const rateItems = [
    { label: "Service", val: r.servEff, color: C.blue },
    { label: "Réception", val: r.recPos, color: C.green },
    { label: "Attaque", val: r.attEff, color: C.red },
    { label: "Bloc", val: r.blocEff, color: C.purple },
    { label: "Passe", val: r.passeEff, color: C.gold },
    { label: "Défense", val: r.defEff, color: C.cyan },
  ];
  return (
    <div style={{ borderBottom: `1px solid ${C.gray100}`, padding: "10px 12px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ width: 28, height: 28, borderRadius: "50%", background: C.blueXlt, color: C.blue, fontSize: 12, fontWeight: 700, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{nom[0]}</span>
          <span style={{ fontWeight: 600, fontSize: 13 }}>{nom}</span>
        </div>
        <button onClick={() => setExpanded(e => !e)} style={{ background: "none", border: "none", color: C.blue, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
          {expanded ? "Réduire ▲" : "Détail ▼"}
        </button>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
        {rateItems.map(item => (
          <span key={item.label} style={{ fontSize: 11, padding: "3px 8px", borderRadius: 999, background: item.val === null ? C.gray100 : `${item.color}15`, color: item.val === null ? C.gray400 : item.color, fontWeight: 700 }}>
            {item.label} {item.val === null ? "—" : `${item.val}%`}
          </span>
        ))}
        <span style={{ fontSize: 11, padding: "3px 8px", borderRadius: 999, background: C.gray100, color: C.gray800, fontWeight: 700 }}>
          Pts {ps.PG || 0} · Fts {ps.FD || 0}
        </span>
      </div>
      {expanded && (
        <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6 }}>
          {GROUP_META.map(g => STAT_FIELDS[g.key].map(f => (
            <div key={f} style={{ background: g.bg, borderRadius: 6, padding: "4px 2px", textAlign: "center" }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: g.color }}>{ps[f] || 0}</div>
              <div style={{ fontSize: 9, color: C.gray600 }}>{STAT_LABELS[f]}</div>
            </div>
          )))}
          {editable && (
            <button onClick={() => onEdit && onEdit(nom)} style={{ gridColumn: "1 / -1", marginTop: 6, ...s.btn("ghost"), padding: "6px", fontSize: 11, justifyContent: "center" }}>
              ✏️ Éditer ce set
            </button>
          )}
        </div>
      )}
    </div>
  );
}
function StatsTable({ players, editable=false, onEdit, compact=false }) {
  const names = Object.keys(players);
  if (!names.length) return <p style={{color:C.gray400,padding:20,textAlign:"center"}}>Aucune statistique.</p>;
  if (compact) {
    return (
      <div>
        {names.map(nom => (
          <CompactPlayerRow key={nom} nom={nom} ps={players[nom]} editable={editable} onEdit={onEdit} />
        ))}
      </div>
    );
  }
  return (
    <div style={{overflowX:"auto"}}>
      <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
        <thead>
          <tr>
            <th style={{padding:"8px 12px",textAlign:"left",background:C.gray100,position:"sticky",left:0,zIndex:2,borderBottom:`1px solid ${C.gray200}`}}>Joueuse</th>
            {GROUP_META.map(g => <SectionHeader key={g.key} label={g.label} color={g.color} bg={g.bg} count={STAT_FIELDS[g.key].length} />)}
            {editable && <th style={{padding:"8px",background:C.gray100,borderBottom:`1px solid ${C.gray200}`}} />}
          </tr>
          <tr style={{background:C.gray50}}>
            <th style={{padding:"6px 12px",position:"sticky",left:0,background:C.gray50,zIndex:2,borderBottom:`1px solid ${C.gray200}`}} />
            {GROUP_META.map(g => STAT_FIELDS[g.key].map(f => (
              <th key={f} style={{padding:"4px 6px",fontSize:11,fontWeight:600,color:g.color,textAlign:"center",minWidth:32,borderBottom:`1px solid ${C.gray200}`}}>
                {STAT_LABELS[f]}
              </th>
            )))}
            {editable && <th style={{borderBottom:`1px solid ${C.gray200}`}} />}
          </tr>
        </thead>
        <tbody>
          {names.map((nom,i) => {
            const ps = players[nom];
            return (
              <tr key={nom} style={{background:i%2===0?C.white:C.gray50}}>
                <td style={{padding:"8px 12px",fontWeight:600,fontSize:13,position:"sticky",left:0,background:i%2===0?C.white:C.gray50,zIndex:1,borderBottom:`1px solid ${C.gray100}`,whiteSpace:"nowrap"}}>
                  <span style={{display:"inline-flex",alignItems:"center",gap:6}}>
                    <span style={{width:26,height:26,borderRadius:"50%",background:C.blueXlt,color:C.blue,fontSize:11,fontWeight:700,display:"inline-flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>{nom[0]}</span>
                    {nom}
                  </span>
                </td>
                {GROUP_META.map(g => STAT_FIELDS[g.key].map(f => (
                  <td key={f} style={{padding:"6px",textAlign:"center",borderBottom:`1px solid ${C.gray100}`}}>
                    {ps[f] ? <span style={{fontSize:14,fontWeight:600}}>{ps[f]}</span> : <span style={{color:C.gray400,fontSize:14}}>—</span>}
                  </td>
                )))}
                {editable && (
                  <td style={{padding:"6px",textAlign:"center",borderBottom:`1px solid ${C.gray100}`}}>
                    <button style={{...s.btn("ghost"),padding:"4px 8px",fontSize:11}} onClick={() => onEdit && onEdit(nom)}>✏️ Éditer</button>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Charts({ players }) {
  const names = Object.keys(players);
  if (!names.length) return null;
  const COLORS = [C.blue,C.red,C.green,C.purple,C.gold,C.cyan];

  const radarData = [
    { axis:"Service" }, { axis:"Réception" }, { axis:"Attaque" },
    { axis:"Bloc" },    { axis:"Passe" },      { axis:"Défense" },
  ];
  names.slice(0,4).forEach(n => {
    const p = players[n];
    radarData[0][n] = (p["S+"]||0)*2+(p["S0"]||0)+(p.SG||0)*3;
    radarData[1][n] = (p["R++"]||0)*3+(p["R+"]||0)*2+(p["R0"]||0);
    radarData[2][n] = (p["A+"]||0)*3+(p["A0"]||0);
    radarData[3][n] = (p["B+"]||0)*3+(p["Bdef"]||0)*2;
    radarData[4][n] = (p["P+"]||0)*2+(p["P0"]||0);
    radarData[5][n] = (p["D+"]||0)*2;
  });

  const attData = names.map(n => ({ nom:n.length>7?n.slice(0,7)+".":n, "A+":players[n]["A+"]||0, "A0":players[n]["A0"]||0, "A-":players[n]["A-"]||0 }));

  let SG=0,Sp=0,Sz=0,Sm=0;
  names.forEach(n => { SG+=players[n].SG||0; Sp+=players[n]["S+"]||0; Sz+=players[n]["S0"]||0; Sm+=players[n]["S-"]||0; });
  const pieData = [{ name:"SG",value:SG,fill:"#7c3aed" },{ name:"S+",value:Sp,fill:C.green },{ name:"S0",value:Sz,fill:C.gold },{ name:"S−",value:Sm,fill:C.red }].filter(d=>d.value>0);

  const ptsData = Object.entries(players).map(([n,p]) => ({ nom:n.length>7?n.slice(0,7)+".":n, PG:p.PG||0, FD:p.FD||0 })).sort((a,b)=>b.PG-a.PG);

  return (
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(280px,1fr))",gap:16,marginBottom:20}}>
      <div style={{...s.card,padding:20}}>
        <p style={{fontSize:13,fontWeight:600,color:C.gray600,marginBottom:12}}>Profil par compétence</p>
        <ResponsiveContainer width="100%" height={240}>
          <RadarChart data={radarData}>
            <PolarGrid stroke={C.gray200} />
            <PolarAngleAxis dataKey="axis" tick={{fontSize:11,fill:C.gray600}} />
            {names.slice(0,4).map((n,i) => <Radar key={n} name={n} dataKey={n} stroke={COLORS[i]} fill={COLORS[i]} fillOpacity={0.12} strokeWidth={2} />)}
            <Legend wrapperStyle={{fontSize:11}} /><Tooltip />
          </RadarChart>
        </ResponsiveContainer>
      </div>
      <div style={{...s.card,padding:20}}>
        <p style={{fontSize:13,fontWeight:600,color:C.gray600,marginBottom:12}}>Efficacité attaque</p>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={attData} margin={{left:-10}}>
            <XAxis dataKey="nom" tick={{fontSize:11}} /><YAxis tick={{fontSize:11}} /><Tooltip />
            <Bar dataKey="A+" fill={C.green} stackId="a" /><Bar dataKey="A0" fill={C.gold} stackId="a" /><Bar dataKey="A-" fill={C.red} stackId="a" radius={[4,4,0,0]} />
            <Legend wrapperStyle={{fontSize:11}} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div style={{...s.card,padding:20}}>
        <p style={{fontSize:13,fontWeight:600,color:C.gray600,marginBottom:12}}>Répartition services</p>
        <ResponsiveContainer width="100%" height={200}>
          <PieChart><Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={({name,percent})=>`${name} ${Math.round(percent*100)}%`} labelLine={false} fontSize={11}>
            {pieData.map((d,i)=><Cell key={i} fill={d.fill} />)}
          </Pie><Tooltip /></PieChart>
        </ResponsiveContainer>
      </div>
      <div style={{...s.card,padding:20}}>
        <p style={{fontSize:13,fontWeight:600,color:C.gray600,marginBottom:12}}>Points gagnants / Fautes</p>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={ptsData} layout="vertical" margin={{left:8}}>
            <XAxis type="number" tick={{fontSize:11}} /><YAxis type="category" dataKey="nom" tick={{fontSize:11}} width={55} /><Tooltip />
            <Bar dataKey="PG" fill={C.blue} radius={[0,4,4,0]} name="Pts gagnants" />
            <Bar dataKey="FD" fill={C.red}  radius={[0,4,4,0]} name="Fautes dir." />
            <Legend wrapperStyle={{fontSize:11}} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function aggregateSeasonStats(matches) {
  const totals = {};
  matches.forEach(m => {
    m.sets.forEach(set => {
      set.stats.forEach(ps => {
        if (!totals[ps.nom]) totals[ps.nom] = EMPTY_STATS();
        Object.keys(totals[ps.nom]).forEach(k => {
          totals[ps.nom][k] += (ps[k] || 0);
        });
      });
    });
  });
  return totals;
}

function pct(num, den) {
  if (!den) return null;
  return Math.round((num / den) * 100);
}
const computeRates = (p) => {
    const servTotal = (p.SG || 0) + (p["S+"] || 0) + (p.S0 || 0) + (p["S-"] || 0);
    const servEff = pct((p.SG || 0) + (p["S+"] || 0), servTotal);
    const recTotal = (p["R++"] || 0) + (p["R+"] || 0) + (p.R0 || 0) + (p["R-"] || 0);
    const recPos = pct((p["R++"] || 0) + (p["R+"] || 0), recTotal);
    const attTotal = (p["A+"] || 0) + (p.A0 || 0) + (p["A-"] || 0);
    const attEff = pct(p["A+"] || 0, attTotal);
    const attGagnante = pct(p["A+"] || 0, attTotal);
    const attNeutre = pct(p.A0 || 0, attTotal);
    const attEchec = pct(p["A-"] || 0, attTotal);
    const blocTotal = (p["B+"] || 0) + (p.Bdef || 0) + (p["B-"] || 0);
    const blocEff = pct(p["B+"] || 0, blocTotal);
    const passeTotal = (p["P+"] || 0) + (p.P0 || 0) + (p["P-"] || 0);
    const passeEff = pct(p["P+"] || 0, passeTotal);
    const defTotal = (p["D+"] || 0) + (p["D-"] || 0);
    const defEff = pct(p["D+"] || 0, defTotal);
    const pg = p.PG || 0, fd = p.FD || 0;
    const rapport = pg + fd > 0 ? Math.round((pg / (pg + fd)) * 100) : null;
    return { servEff, recPos, attEff, attGagnante, attNeutre, attEchec, attTotal, blocEff, passeEff, defEff, pg, fd, rapport };
  };
  function statsForPlayerInMatch(match, nom) {
  const agg = EMPTY_STATS();
  match.sets.forEach(set => {
    set.stats.forEach(ps => {
      if (ps.nom === nom) {
        Object.keys(agg).forEach(k => { agg[k] += (ps[k] || 0); });
      }
    });
  });
  return agg;
}
function TeamAnalysis({ matches }) {
  const totals = aggregateSeasonStats(matches);
  const names = Object.keys(totals);
  const sortedMatches = [...matches].sort((a, b) => new Date(a.date) - new Date(b.date));

  const setsWon = matches.reduce((acc, m) => acc + m.sets.filter(st => st.scoreA > st.scoreB).length, 0);
  const setsLost = matches.reduce((acc, m) => acc + m.sets.filter(st => st.scoreB > st.scoreA).length, 0);
  const matchesWon = matches.filter(m => m.sets.filter(st => st.scoreA > st.scoreB).length > m.sets.filter(st => st.scoreB > st.scoreA).length).length;
  const totalPG = names.reduce((acc, n) => acc + (totals[n].PG || 0), 0);
  const totalFD = names.reduce((acc, n) => acc + (totals[n].FD || 0), 0);

  const formData = sortedMatches.map((m, idx) => {
    const won = m.sets.filter(st => st.scoreA > st.scoreB).length > m.sets.filter(st => st.scoreB > st.scoreA).length;
    const sW = m.sets.filter(st => st.scoreA > st.scoreB).length;
    const sL = m.sets.filter(st => st.scoreB > st.scoreA).length;
    const ptsGagnes = m.sets.reduce((acc, st) => {
      let pg = 0;
      st.stats.forEach(ps => { pg += (ps.PG || 0); });
      return acc + pg;
    }, 0);
    return {
      label: `M${idx + 1}`,
      adversaire: m.equipeB === "Bailleul" ? m.equipeA : m.equipeB,
      date: new Date(m.date).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" }),
      résultat: won ? "V" : "D",
      "Sets gagnés": sW,
      "Sets perdus": sL,
      "Pts gagnants": ptsGagnes,
    };
  });

  const contributionData = names.map(n => ({
    nom: n.split(" ")[0],
    fullNom: n,
    PG: totals[n].PG || 0,
    FD: totals[n].FD || 0,
    ratio: (totals[n].PG || 0) + (totals[n].FD || 0) > 0
      ? Math.round(((totals[n].PG || 0) / ((totals[n].PG || 0) + (totals[n].FD || 0))) * 100)
      : 0,
  })).sort((a, b) => b.PG - a.PG).slice(0, 10);

  const rankingsData = [
    { label: "Service eff.", color: C.blue, key: "servEff" },
    { label: "Récep. +", color: C.green, key: "recPos" },
    { label: "Attaque eff.", color: C.red, key: "attEff" },
    { label: "Bloc eff.", color: C.purple, key: "blocEff" },
    { label: "Passe eff.", color: C.gold, key: "passeEff" },
    { label: "Défense eff.", color: C.cyan, key: "defEff" },
  ];

  const rankingsBySkill = rankingsData.map(skill => {
    const ranked = names
      .map(n => ({ nom: n, val: computeRates(totals[n])[skill.key] }))
      .filter(x => x.val !== null)
      .sort((a, b) => b.val - a.val)
      .slice(0, 5);
    return { ...skill, ranked };
  });

  const faultData = (() => {
    let errS = 0, errA = 0, recFault = 0, blocFault = 0, passeFault = 0, defFault = 0;
    names.forEach(n => {
      const p = totals[n];
      errS += (p["S-"] || 0);
      errA += (p["A-"] || 0);
      recFault += (p["R-"] || 0);
      blocFault += (p["B-"] || 0);
      passeFault += (p["P-"] || 0);
      defFault += (p["D-"] || 0);
    });
    return [
      { name: "Erreurs service", value: errS, fill: C.blue },
      { name: "Erreurs attaque", value: errA, fill: C.red },
      { name: "Récep. fautes", value: recFault, fill: C.green },
      { name: "Bloc fautes", value: blocFault, fill: C.purple },
      { name: "Passe fautes", value: passeFault, fill: C.gold },
      { name: "Défense fautes", value: defFault, fill: C.cyan },
    ].filter(d => d.value > 0);
  })();

  if (matches.length === 0) return (
    <div style={{ ...s.card, padding: 48, textAlign: "center" }}>
      <p style={{ color: C.gray400 }}>Aucun match enregistré.</p>
    </div>
  );

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto" }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>🏆 Analyse collective</h1>
        <p style={{ fontSize: 13, color: C.gray400, margin: "4px 0 0" }}>
          Saison en cours · {matches.length} match{matches.length !== 1 ? "s" : ""}
        </p>
      </div>

      {/* KPI cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 14, marginBottom: 20 }}>
        {[
          { label: "Matchs joués", val: matches.length, color: C.blue },
          { label: "Victoires", val: matchesWon, color: C.green },
          { label: "Défaites", val: matches.length - matchesWon, color: C.red },
          { label: "Sets gagnés", val: setsWon, color: C.blue },
          { label: "Sets perdus", val: setsLost, color: C.red },
          { label: "Pts gagnants", val: totalPG, color: C.green },
          { label: "Fautes dir.", val: totalFD, color: C.gold },
          { label: "Rapport +/-", val: totalPG + totalFD > 0 ? `${Math.round(totalPG / (totalPG + totalFD) * 100)}%` : "—", color: totalPG > totalFD ? C.green : C.red },
        ].map((kpi, i) => (
          <div key={i} style={{ ...s.card, padding: "16px 18px", textAlign: "center", borderTop: `3px solid ${kpi.color}` }}>
            <p style={{ fontSize: 26, fontWeight: 800, color: kpi.color, margin: 0 }}>{kpi.val}</p>
            <p style={{ fontSize: 11, color: C.gray400, margin: "3px 0 0" }}>{kpi.label}</p>
          </div>
        ))}
      </div>

      {/* Forme de l'équipe */}
      <div style={{ ...s.card, padding: 20, marginBottom: 20 }}>
        <p style={{ fontSize: 14, fontWeight: 700, color: C.gray600, marginBottom: 4 }}>Forme de l'équipe — match par match</p>
        <p style={{ fontSize: 12, color: C.gray400, marginBottom: 14 }}>Sets gagnés et points gagnants par match</p>
        <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
          {formData.map((m, i) => (
            <div key={i} style={{ textAlign: "center", minWidth: 44 }}>
              <div style={{ width: 36, height: 36, borderRadius: "50%", margin: "0 auto 4px", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 13, background: m.résultat === "V" ? C.green : C.red, color: C.white }}>
                {m.résultat}
              </div>
              <p style={{ fontSize: 10, color: C.gray600, margin: 0 }}>{m.label}</p>
              <p style={{ fontSize: 9, color: C.gray400, margin: 0 }}>{m["Sets gagnés"]}-{m["Sets perdus"]}</p>
            </div>
          ))}
        </div>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={formData}>
            <XAxis dataKey="label" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip labelFormatter={(l, d) => d?.[0]?.payload?.adversaire || l} formatter={(v, n) => [`${v}`, n]} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="Pts gagnants" fill={C.blue} radius={[4, 4, 0, 0]} />
            <Bar dataKey="Sets gagnés" fill={C.green} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Contribution aux points + Répartition fautes */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
        <div style={{ ...s.card, padding: 20 }}>
          <p style={{ fontSize: 14, fontWeight: 700, color: C.gray600, marginBottom: 4 }}>Contribution aux points</p>
          <p style={{ fontSize: 12, color: C.gray400, marginBottom: 14 }}>Classement par points gagnants</p>
          {contributionData.map((p, i) => (
            <div key={p.fullNom} style={{ marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: C.gray800 }}>
                  <span style={{ color: C.gray400, marginRight: 6, fontSize: 11 }}>#{i + 1}</span>
                  {p.fullNom}
                </span>
                <span style={{ fontSize: 12 }}>
                  <strong style={{ color: C.blue }}>{p.PG} pts</strong>
                  <span style={{ color: C.gray400, fontSize: 11 }}> · {p.ratio}%</span>
                </span>
              </div>
              <div style={{ height: 7, background: C.gray200, borderRadius: 999 }}>
                <div style={{ width: `${contributionData[0].PG > 0 ? (p.PG / contributionData[0].PG) * 100 : 0}%`, height: "100%", background: i === 0 ? C.gold : i <= 2 ? C.blue : C.gray400, borderRadius: 999, transition: "width 0.5s" }} />
              </div>
            </div>
          ))}
        </div>

        <div style={{ ...s.card, padding: 20 }}>
          <p style={{ fontSize: 14, fontWeight: 700, color: C.gray600, marginBottom: 4 }}>Répartition des fautes</p>
          <p style={{ fontSize: 12, color: C.gray400, marginBottom: 14 }}>Par catégorie d'action</p>
          {faultData.length === 0 ? (
            <p style={{ color: C.gray400, fontSize: 13, textAlign: "center", marginTop: 40 }}>Pas encore de données</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={faultData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80}
                  label={({ name, percent }) => `${name.split(" ")[0]} ${Math.round(percent * 100)}%`}
                  labelLine={false} fontSize={10}>
                  {faultData.map((d, i) => <Cell key={i} fill={d.fill} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Classement interne par compétence */}
      <div style={{ ...s.card, padding: 20 }}>
        <p style={{ fontSize: 14, fontWeight: 700, color: C.gray600, marginBottom: 16 }}>Classement interne par compétence</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 20 }}>
          {rankingsBySkill.map(skill => (
            <div key={skill.label}>
              <p style={{ fontSize: 12, fontWeight: 700, color: skill.color, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 10 }}>
                {skill.label}
              </p>
              {skill.ranked.length === 0 ? (
                <p style={{ fontSize: 12, color: C.gray400 }}>Pas de données</p>
              ) : skill.ranked.map((r, i) => (
                <div key={r.nom} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                  <span style={{ width: 22, height: 22, borderRadius: "50%", background: i === 0 ? C.gold : i === 1 ? C.gray400 : i === 2 ? "#cd7f32" : C.gray200, color: i <= 2 ? C.white : C.gray600, fontSize: 10, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    {i + 1}
                  </span>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: C.gray800 }}>{r.nom}</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: skill.color }}>{r.val}%</span>
                    </div>
                    <div style={{ height: 5, background: C.gray200, borderRadius: 999 }}>
                      <div style={{ width: `${r.val}%`, height: "100%", background: skill.color, borderRadius: 999, opacity: 1 - i * 0.15 }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
function PlayerAnalysis({ matches, seasonPlayers }) {
  const rosterSource = (seasonPlayers && seasonPlayers.length > 0) ? seasonPlayers : PLAYERS;
  const totals = aggregateSeasonStats(matches);
  const names  = Object.keys(totals).sort((a, b) => (totals[b].PG || 0) - (totals[a].PG || 0));

  const [selected,   setSelected]   = useState("");
  const [compared,   setCompared]   = useState("");
  const [activeTab,  setActiveTab]  = useState("overview");

  const activeName   = names.includes(selected)  ? selected  : (names[0] || "");
  const comparedName = names.includes(compared) && compared !== activeName ? compared : "";

  const roster  = rosterSource.find(p => `${p.prenom} ${p.nom}` === activeName);
  const roster2 = comparedName ? rosterSource.find(p => `${p.prenom} ${p.nom}` === comparedName) : null;

  // Totaux équipe
  const teamTotals = EMPTY_STATS();
  names.forEach(n => Object.keys(teamTotals).forEach(k => { teamTotals[k] += (totals[n][k] || 0); }));
  const teamRates = computeRates(teamTotals);
  const pr  = computeRates(totals[activeName]  || EMPTY_STATS());
  const pr2 = comparedName ? computeRates(totals[comparedName] || EMPTY_STATS()) : null;

  const sortedMatches = [...matches].sort((a, b) => new Date(a.date) - new Date(b.date));
  const matchCount1 = matches.filter(m => m.sets.some(st => st.stats.some(ps => ps.nom === activeName))).length;
  const matchCount2 = comparedName ? matches.filter(m => m.sets.some(st => st.stats.some(ps => ps.nom === comparedName))).length : 0;

  // Helper multi-match stats
  const multiStats = (nom, matchList) => sumStats(matchList.map(m => statsForPlayerInMatch(m, nom)));

  // Forme récente (5 derniers matchs)
  const last5 = sortedMatches.slice(-5);
  const last5Rates  = computeRates(multiStats(activeName,   last5));
  const last5Rates2 = comparedName ? computeRates(multiStats(comparedName, last5)) : null;

  // Tendance : dernier tiers vs premier tiers
  const n3 = Math.max(1, Math.ceil(sortedMatches.length / 3));
  const recentRates = computeRates(multiStats(activeName, sortedMatches.slice(-n3)));
  const earlyRates  = computeRates(multiStats(activeName, sortedMatches.slice(0, n3)));
  const getTrend = (key) => {
    const r = recentRates[key], e = earlyRates[key];
    if (r === null || e === null || sortedMatches.length < 4) return "—";
    if (r > e + 5) return "↑";
    if (r < e - 5) return "↓";
    return "→";
  };
  const trendColor = (t) => t === "↑" ? C.green : t === "↓" ? C.red : C.gray400;

  // Classement équipe
  const getRank = (key) => {
    const vals = names.map(n => ({ n, v: computeRates(totals[n])[key] })).filter(x => x.v !== null).sort((a, b) => b.v - a.v);
    return { rank: vals.findIndex(x => x.n === activeName) + 1, total: vals.length };
  };

  // Radar
  const radarData = [
    { stat: "Service",   val: pr.servEff  || 0, team: teamRates.servEff  || 0, ...(pr2 ? { comp: pr2.servEff  || 0 } : {}) },
    { stat: "Réception", val: pr.recPos   || 0, team: teamRates.recPos   || 0, ...(pr2 ? { comp: pr2.recPos   || 0 } : {}) },
    { stat: "Attaque",   val: pr.attEff   || 0, team: teamRates.attEff   || 0, ...(pr2 ? { comp: pr2.attEff   || 0 } : {}) },
    { stat: "Bloc",      val: pr.blocEff  || 0, team: teamRates.blocEff  || 0, ...(pr2 ? { comp: pr2.blocEff  || 0 } : {}) },
    { stat: "Passe",     val: pr.passeEff || 0, team: teamRates.passeEff || 0, ...(pr2 ? { comp: pr2.passeEff || 0 } : {}) },
    { stat: "Défense",   val: pr.defEff   || 0, team: teamRates.defEff   || 0, ...(pr2 ? { comp: pr2.defEff   || 0 } : {}) },
  ];

  // Évolution match par match
  const evolutionData = sortedMatches.map((m, idx) => {
    const r  = computeRates(statsForPlayerInMatch(m, activeName));
    const r2 = comparedName ? computeRates(statsForPlayerInMatch(m, comparedName)) : null;
    const adv = m.equipeB?.toLowerCase().includes("bailleul") ? m.equipeA : m.equipeB;
    return {
      label: `M${idx + 1}`, adversaire: adv,
      Service: r.servEff, Réception: r.recPos, Attaque: r.attEff, Bloc: r.blocEff,
      ...(r2 ? { "Srv 2": r2.servEff, "Réc 2": r2.recPos, "Att 2": r2.attEff } : {}),
    };
  });

  // Métriques comparatives
  const METRICS = [
    { label: "Efficacité service",  key: "servEff",  color: C.blue   },
    { label: "Réception positive",  key: "recPos",   color: C.green  },
    { label: "Efficacité attaque",  key: "attEff",   color: C.red    },
    { label: "Efficacité bloc",     key: "blocEff",  color: C.purple },
    { label: "Efficacité passe",    key: "passeEff", color: C.gold   },
    { label: "Efficacité défense",  key: "defEff",   color: C.cyan   },
  ];
  const strengths    = METRICS.filter(m => pr[m.key] !== null && teamRates[m.key] !== null && pr[m.key] >= teamRates[m.key]).sort((a,b) => (pr[b.key]-teamRates[b.key])-(pr[a.key]-teamRates[a.key])).slice(0,3);
  const improvements = METRICS.filter(m => pr[m.key] !== null && teamRates[m.key] !== null && pr[m.key] < teamRates[m.key]).sort((a,b) => (pr[a.key]-teamRates[a.key])-(pr[b.key]-teamRates[b.key])).slice(0,3);

  // Performance vs adversaires
  const byAdv = {};
  sortedMatches.forEach(m => {
    const adv = m.equipeB?.toLowerCase().includes("bailleul") ? m.equipeA : m.equipeB;
    if (!byAdv[adv]) byAdv[adv] = [];
    byAdv[adv].push(m);
  });
  const advData = Object.entries(byAdv).map(([adv, ms]) => {
    const st = multiStats(activeName, ms);
    const r = computeRates(st);
    return { adversaire: adv, matchCount: ms.length, r, hasData: Object.values(st).some(v => v > 0) };
  }).filter(d => d.hasData).sort((a,b) => (b.r.rapport || 0) - (a.r.rapport || 0));

  const getLevel = (rapport) => {
    if (rapport === null) return { label: "Pas de données", color: C.gray400, bg: C.gray100 };
    if (rapport >= 80) return { label: "Excellent", color: "#fff", bg: "#15803d" };
    if (rapport >= 65) return { label: "Bon",       color: "#fff", bg: C.blue };
    if (rapport >= 50) return { label: "Moyen",     color: "#fff", bg: C.gold };
    return                     { label: "À améliorer", color: "#fff", bg: C.red };
  };
  const level  = getLevel(pr.rapport);
  const level2 = pr2 ? getLevel(pr2.rapport) : null;

  if (names.length === 0) return (
    <div style={{ ...s.card, padding: 48, textAlign: "center" }}><p style={{ color: C.gray400 }}>Aucune statistique disponible.</p></div>
  );

  // ── Rendu ──────────────────────────────────────────────────────────────
  return (
    <div style={{ maxWidth: 1100, margin: "0 auto" }}>

      {/* Sélecteurs */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>👤 Analyse individuelle</h1>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <select value={activeName} onChange={e => setSelected(e.target.value)} style={{ ...s.input, width: 200, fontWeight: 600 }}>
            {names.map(n => <option key={n} value={n}>{n}</option>)}
          </select>
          <span style={{ fontSize: 11, color: C.gray400, fontWeight: 700 }}>VS</span>
          <select value={compared} onChange={e => setCompared(e.target.value)} style={{ ...s.input, width: 200 }}>
            <option value="">— Comparer avec —</option>
            {names.filter(n => n !== activeName).map(n => <option key={n} value={n}>{n}</option>)}
          </select>
          {compared && <button onClick={() => setCompared("")} style={{ ...s.btn("ghost"), padding: "6px 10px", fontSize: 12 }}>✕</button>}
        </div>
      </div>

      {/* Headers joueuses */}
      <div style={{ display: "grid", gridTemplateColumns: comparedName ? "1fr 1fr" : "1fr", gap: 16, marginBottom: 20 }}>
        {[{ name: activeName, p: pr, ros: roster, lv: level, cnt: matchCount1 }, ...(comparedName ? [{ name: comparedName, p: pr2, ros: roster2, lv: level2, cnt: matchCount2 }] : [])].map(({ name, p, ros, lv, cnt }, idx) => (
          <div key={name} style={{ background: `linear-gradient(135deg, ${idx === 0 ? C.navy : "#1e3a5f"} 0%, ${idx === 0 ? C.blue : "#1d4ed8"} 100%)`, borderRadius: 16, padding: "20px 24px", display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap", boxShadow: "0 4px 20px rgba(30,64,175,0.2)" }}>
            <div style={{ width: 54, height: 54, borderRadius: "50%", background: "rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, fontWeight: 800, color: C.white, border: "2px solid rgba(255,255,255,0.3)", flexShrink: 0 }}>
              {name.split(" ").map(w => w[0]).join("").slice(0, 2)}
            </div>
            <div style={{ flex: 1, minWidth: 120 }}>
              <p style={{ margin: 0, fontSize: 17, fontWeight: 800, color: C.white }}>{name}</p>
              <p style={{ margin: "2px 0 0", fontSize: 12, color: "rgba(255,255,255,0.65)" }}>
                {ros ? `#${ros.number} · ${ros.poste}` : ""} · {cnt} match{cnt !== 1 ? "s" : ""}
              </p>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {[{ v: p.pg, l: "Pts ✓" }, { v: p.fd, l: "Fts ✗" }, { v: p.rapport === null ? "—" : `${p.rapport}%`, l: "+/-" }].map(({ v, l }) => (
                <div key={l} style={{ textAlign: "center", background: "rgba(255,255,255,0.1)", borderRadius: 8, padding: "7px 12px" }}>
                  <p style={{ margin: 0, fontSize: 18, fontWeight: 800, color: C.white }}>{v}</p>
                  <p style={{ margin: 0, fontSize: 10, color: "rgba(255,255,255,0.6)" }}>{l}</p>
                </div>
              ))}
              <div style={{ textAlign: "center", background: lv.bg, borderRadius: 8, padding: "7px 12px", border: "1px solid rgba(255,255,255,0.2)" }}>
                <p style={{ margin: 0, fontSize: 12, fontWeight: 800, color: lv.color }}>{lv.label}</p>
                <p style={{ margin: 0, fontSize: 10, color: lv.color, opacity: 0.8 }}>Niveau</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Forme récente */}
      <div style={{ ...s.card, padding: "14px 18px", marginBottom: 20 }}>
        <p style={{ fontSize: 12, fontWeight: 700, color: C.gray600, marginBottom: 10 }}>📈 Forme récente — {Math.min(5, sortedMatches.length)} derniers matchs vs saison</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px,1fr))", gap: 8 }}>
          {METRICS.map(m => {
            const recent = last5Rates[m.key], season = pr[m.key];
            const trend  = getTrend(m.key);
            const diff   = recent !== null && season !== null ? recent - season : null;
            return (
              <div key={m.key} style={{ background: C.gray50, borderRadius: 8, padding: "8px 10px", borderLeft: `3px solid ${m.color}` }}>
                <p style={{ fontSize: 10, color: C.gray400, fontWeight: 700, textTransform: "uppercase", margin: "0 0 4px" }}>{m.label}</p>
                <div style={{ display: "flex", alignItems: "baseline", gap: 5 }}>
                  <span style={{ fontSize: 18, fontWeight: 800, color: m.color }}>{recent !== null ? `${recent}%` : "—"}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: trendColor(trend) }}>{trend}</span>
                </div>
                <p style={{ fontSize: 10, color: C.gray400, margin: "2px 0 0" }}>
                  Saison: {season !== null ? `${season}%` : "—"}
                  {diff !== null && <span style={{ color: diff > 0 ? C.green : diff < 0 ? C.red : C.gray400, marginLeft: 4, fontWeight: 700 }}>{diff > 0 ? `+${diff}` : diff}</span>}
                </p>
                {comparedName && last5Rates2 && <p style={{ fontSize: 10, color: "#60a5fa", margin: "2px 0 0" }}>{comparedName.split(" ")[0]}: {last5Rates2[m.key] !== null ? `${last5Rates2[m.key]}%` : "—"}</p>}
              </div>
            );
          })}
        </div>
      </div>

      {/* Points forts / Axes (mode non-comparaison seulement) */}
      {!comparedName && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
          {[
            { title: "✅ Points forts", color: C.green, data: strengths, positive: true },
            { title: "📈 Axes de progression", color: C.gold, data: improvements, positive: false },
          ].map(({ title, color, data, positive }) => (
            <div key={title} style={{ ...s.card, padding: 18 }}>
              <p style={{ fontSize: 13, fontWeight: 700, color, marginBottom: 10 }}>{title}</p>
              {data.length === 0
                ? <p style={{ color: C.gray400, fontSize: 13 }}>{positive ? "Pas encore assez de données" : "Performances au-dessus de la moyenne !"}</p>
                : data.map(st => (
                  <div key={st.label} style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                    <span style={{ fontSize: 13, color: C.gray800 }}>{st.label}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: st.color }}>{pr[st.key]}% <span style={{ fontSize: 11, color: C.gray400, fontWeight: 400 }}>vs {teamRates[st.key]}%</span></span>
                  </div>
                ))
              }
            </div>
          ))}
        </div>
      )}

      {/* Radar + Évolution */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
        <div style={{ ...s.card, padding: 18 }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: C.gray600, marginBottom: 10 }}>Profil radar{comparedName ? " — comparaison" : " vs équipe"}</p>
          <ResponsiveContainer width="100%" height={230}>
            <RadarChart data={radarData}>
              <PolarGrid stroke={C.gray200} />
              <PolarAngleAxis dataKey="stat" tick={{ fontSize: 11, fill: C.gray600 }} />
              <Radar name="Équipe"              dataKey="team" stroke={C.gray300} fill={C.gray300} fillOpacity={0.1} strokeWidth={1.5} strokeDasharray="4 2" />
              {comparedName && <Radar name={comparedName.split(" ")[0]} dataKey="comp" stroke="#1d4ed8" fill="#1d4ed8" fillOpacity={0.15} strokeWidth={2} />}
              <Radar name={activeName.split(" ")[0]} dataKey="val" stroke={C.blue} fill={C.blue} fillOpacity={0.2} strokeWidth={2.5} />
              <Legend wrapperStyle={{ fontSize: 11 }} /><Tooltip />
            </RadarChart>
          </ResponsiveContainer>
        </div>
        <div style={{ ...s.card, padding: 18 }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: C.gray600, marginBottom: 10 }}>Évolution match par match</p>
          {evolutionData.length < 2
            ? <p style={{ color: C.gray400, fontSize: 13, textAlign: "center", marginTop: 40 }}>Minimum 2 matchs nécessaires</p>
            : (
              <ResponsiveContainer width="100%" height={230}>
                <LineChart data={evolutionData}>
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} domain={[0, 100]} />
                  <Tooltip formatter={v => v !== null ? `${v}%` : "—"} labelFormatter={(l, d) => d?.[0]?.payload?.adversaire || l} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  {[["Service", C.blue], ["Réception", C.green], ["Attaque", C.red]].map(([k, c]) => (
                    <Line key={k} type="monotone" dataKey={k} stroke={c} strokeWidth={2} dot={{ r: 3 }} connectNulls />
                  ))}
                  {comparedName && [["Srv 2", "#93c5fd"], ["Réc 2", "#86efac"]].map(([k, c]) => (
                    <Line key={k} type="monotone" dataKey={k} stroke={c} strokeWidth={1.5} strokeDasharray="4 2" dot={{ r: 2 }} connectNulls />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            )
          }
        </div>
      </div>

      {/* Onglets */}
      <div style={{ display: "flex", gap: 2, marginBottom: 0, borderBottom: `2px solid ${C.gray200}` }}>
        {[
          { id: "overview",  label: "📊 Comparaison équipe" },
          { id: "actions",   label: "🎯 Détail actions" },
          { id: "opponents", label: "🆚 Par adversaire" },
          { id: "history",   label: "📅 Match par match" },
        ].map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)} style={{ padding: "8px 14px", border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600, background: "transparent", color: activeTab === t.id ? C.blue : C.gray400, borderBottom: activeTab === t.id ? `2px solid ${C.blue}` : "2px solid transparent", marginBottom: -2 }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Onglet : Comparaison équipe */}
      {activeTab === "overview" && (
        <div style={{ ...s.card, padding: 20, borderRadius: "0 8px 8px 8px" }}>
          {METRICS.map(m => {
            const { rank, total } = getRank(m.key);
            const val1 = pr[m.key], val2 = pr2 ? pr2[m.key] : null, team = teamRates[m.key];
            const medal = rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : null;
            return (
              <div key={m.key} style={{ marginBottom: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, alignItems: "center" }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: C.gray800 }}>{m.label}</span>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <strong style={{ fontSize: 12, color: m.color }}>{val1 !== null ? `${val1}%` : "—"}</strong>
                    {comparedName && val2 !== null && <span style={{ fontSize: 12, color: "#60a5fa" }}>· {comparedName.split(" ")[0]}: <strong>{val2}%</strong></span>}
                    <span style={{ fontSize: 11, color: C.gray400 }}>équipe {team !== null ? `${team}%` : "—"}</span>
                    {rank > 0 && <span style={{ fontSize: 11, fontWeight: 700, color: rank <= 3 ? C.gold : C.gray400 }}>{medal || `${rank}e`}/{total}</span>}
                    <span style={{ fontSize: 12, fontWeight: 700, color: trendColor(getTrend(m.key)), minWidth: 14 }}>{getTrend(m.key)}</span>
                  </div>
                </div>
                <div style={{ height: 7, background: C.gray200, borderRadius: 999, position: "relative" }}>
                  {team !== null && <div style={{ position: "absolute", left: `${team}%`, top: -3, width: 2, height: 13, background: C.gray400, borderRadius: 1, zIndex: 2 }} />}
                  {val1 !== null && <div style={{ width: `${val1}%`, height: "100%", background: m.color, borderRadius: 999 }} />}
                  {comparedName && val2 !== null && <div style={{ position: "absolute", top: 0, left: 0, width: `${val2}%`, height: "100%", background: "#1d4ed8", borderRadius: 999, opacity: 0.35 }} />}
                </div>
              </div>
            );
          })}
          <p style={{ fontSize: 11, color: C.gray400, marginTop: 6 }}>
            ┃ = moyenne équipe · Médailles = classement dans l'équipe · ↑↓→ = tendance saison
          </p>
        </div>
      )}

      {/* Onglet : Détail actions */}
      {activeTab === "actions" && (
        <div style={{ ...s.card, padding: 20, borderRadius: "0 8px 8px 8px" }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: C.gray600, marginBottom: 14 }}>Toutes les actions — saison complète</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(270px,1fr))", gap: 14 }}>
            {GROUP_META.map(g => {
              const fields = STAT_FIELDS[g.key];
              const data = fields.map(f => ({
                name: STAT_LABELS[f] || f,
                [activeName.split(" ")[0]]: totals[activeName]?.[f] || 0,
                ...(comparedName ? { [comparedName.split(" ")[0]]: totals[comparedName]?.[f] || 0 } : {}),
              }));
              const total1 = fields.reduce((acc, f) => acc + (totals[activeName]?.[f] || 0), 0);
              return (
                <div key={g.key} style={{ background: C.gray50, borderRadius: 8, padding: "10px 12px" }}>
                  <p style={{ fontSize: 11, fontWeight: 700, color: g.color, textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 8px", display: "flex", justifyContent: "space-between" }}>
                    <span>{g.label}</span>
                    <span style={{ color: C.gray400, fontWeight: 400 }}>{total1} total</span>
                  </p>
                  <ResponsiveContainer width="100%" height={110}>
                    <BarChart data={data} margin={{ left: -22, bottom: 0, top: 2 }}>
                      <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 9 }} allowDecimals={false} />
                      <Tooltip />
                      <Bar dataKey={activeName.split(" ")[0]} fill={g.color} radius={[3,3,0,0]} />
                      {comparedName && <Bar dataKey={comparedName.split(" ")[0]} fill="#1d4ed8" opacity={0.65} radius={[3,3,0,0]} />}
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Onglet : Par adversaire */}
      {activeTab === "opponents" && (
        <div style={{ ...s.card, overflowX: "auto", borderRadius: "0 8px 8px 8px" }}>
          <div style={{ padding: "14px 20px", borderBottom: `1px solid ${C.gray200}` }}>
            <span style={{ fontWeight: 700, fontSize: 14 }}>Performance par adversaire</span>
          </div>
          {advData.length === 0
            ? <p style={{ padding: 24, color: C.gray400, textAlign: "center" }}>Pas assez de données.</p>
            : (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr style={{ background: C.gray50 }}>
                    {["Adversaire", "Matchs", "Srv eff.", "Réc +", "Att eff.", "Pts ✓", "Fts ✗", "+/-"].map(h => (
                      <th key={h} style={{ padding: "8px 10px", textAlign: h === "Adversaire" ? "left" : "center", borderBottom: `1px solid ${C.gray200}`, fontSize: 11, color: C.gray400, textTransform: "uppercase", fontWeight: 700 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {advData.map(({ adversaire, matchCount, r }, i) => (
                    <tr key={adversaire} style={{ background: i % 2 === 0 ? C.white : C.gray50 }}>
                      <td style={{ padding: "8px 10px", fontWeight: 600, borderBottom: `1px solid ${C.gray100}` }}>{adversaire}</td>
                      <td style={{ padding: "8px 10px", textAlign: "center", color: C.gray400, borderBottom: `1px solid ${C.gray100}` }}>{matchCount}</td>
                      {[r.servEff, r.recPos, r.attEff].map((v, j) => (
                        <td key={j} style={{ padding: "8px 10px", textAlign: "center", borderBottom: `1px solid ${C.gray100}` }}>
                          {v === null ? <span style={{ color: C.gray400 }}>—</span> : <span style={{ fontWeight: 700, color: v >= 60 ? C.green : v >= 40 ? C.gold : C.red }}>{v}%</span>}
                        </td>
                      ))}
                      <td style={{ padding: "8px 10px", textAlign: "center", fontWeight: 700, color: C.blue, borderBottom: `1px solid ${C.gray100}` }}>{r.pg}</td>
                      <td style={{ padding: "8px 10px", textAlign: "center", fontWeight: 700, color: C.red, borderBottom: `1px solid ${C.gray100}` }}>{r.fd}</td>
                      <td style={{ padding: "8px 10px", textAlign: "center", borderBottom: `1px solid ${C.gray100}` }}>
                        {r.rapport === null ? <span style={{ color: C.gray400 }}>—</span> : <span style={{ fontWeight: 700, color: r.rapport >= 60 ? C.green : r.rapport >= 40 ? C.gold : C.red }}>{r.rapport}%</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          }
        </div>
      )}

      {/* Onglet : Match par match */}
      {activeTab === "history" && (
        <div style={{ ...s.card, overflowX: "auto", borderRadius: "0 8px 8px 8px" }}>
          <div style={{ padding: "14px 20px", borderBottom: `1px solid ${C.gray200}` }}>
            <span style={{ fontWeight: 700, fontSize: 14 }}>Détail match par match</span>
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ background: C.gray50 }}>
                {["Date","Adversaire","Résultat","Srv eff.","Réc +","Att eff.","Bloc eff.","Pts ✓","Fts ✗","+/-"].map(h => (
                  <th key={h} style={{ padding: "8px 10px", textAlign: ["Date","Adversaire","Résultat"].includes(h) ? "left" : "center", borderBottom: `1px solid ${C.gray200}`, fontSize: 11, color: C.gray400, textTransform: "uppercase", fontWeight: 700 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedMatches.map((m, i) => {
                const st = statsForPlayerInMatch(m, activeName);
                const r  = computeRates(st);
                const adv = m.equipeB?.toLowerCase().includes("bailleul") ? m.equipeA : m.equipeB;
                const hasPlayed = Object.values(st).some(v => v > 0);
                const totalA = m.sets.reduce((a, set) => a + set.scoreA, 0);
                const totalB = m.sets.reduce((a, set) => a + set.scoreB, 0);
                return (
                  <tr key={m.id} style={{ background: i % 2 === 0 ? C.white : C.gray50, opacity: hasPlayed ? 1 : 0.4 }}>
                    <td style={{ padding: "8px 10px", color: C.gray600, borderBottom: `1px solid ${C.gray100}` }}>{new Date(m.date).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })}</td>
                    <td style={{ padding: "8px 10px", fontWeight: 600, borderBottom: `1px solid ${C.gray100}` }}>{adv}</td>
                    <td style={{ padding: "8px 10px", borderBottom: `1px solid ${C.gray100}` }}>
                      <span style={{ fontWeight: 700, color: totalA > totalB ? C.green : C.red }}>{totalA}–{totalB}</span>
                    </td>
                    {[r.servEff, r.recPos, r.attEff, r.blocEff].map((v, j) => (
                      <td key={j} style={{ padding: "8px 10px", textAlign: "center", borderBottom: `1px solid ${C.gray100}` }}>
                        {v === null ? <span style={{ color: C.gray400 }}>—</span> : <span style={{ fontWeight: 700, color: v >= 60 ? C.green : v >= 40 ? C.gold : C.red }}>{v}%</span>}
                      </td>
                    ))}
                    <td style={{ padding: "8px 10px", textAlign: "center", fontWeight: 700, color: C.blue, borderBottom: `1px solid ${C.gray100}` }}>{r.pg}</td>
                    <td style={{ padding: "8px 10px", textAlign: "center", fontWeight: 700, color: C.red, borderBottom: `1px solid ${C.gray100}` }}>{r.fd}</td>
                    <td style={{ padding: "8px 10px", textAlign: "center", borderBottom: `1px solid ${C.gray100}` }}>
                      {r.rapport === null ? <span style={{ color: C.gray400 }}>—</span> : <span style={{ fontWeight: 700, color: r.rapport >= 60 ? C.green : r.rapport >= 40 ? C.gold : C.red }}>{r.rapport}%</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function SeasonBilan({ matches }) {
  const totals = aggregateSeasonStats(matches);
  const names = Object.keys(totals).sort((a, b) => (totals[b].PG || 0) - (totals[a].PG || 0));
  const teamTotals = EMPTY_STATS();
  names.forEach(n => Object.keys(teamTotals).forEach(k => { teamTotals[k] += (totals[n][k] || 0); }));
  const teamRates = computeRates(teamTotals);
  const [compactView, setCompactView] = useState(true);

  const cellPct = (val) => val === null ? <span style={{ color: C.gray400 }}>—</span> : (
    <span style={{ fontWeight: 700, color: val >= 60 ? C.green : val >= 40 ? C.gold : C.red }}>{val}%</span>
  );

  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 10, marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>📊 Bilan de saison</h1>
          <p style={{ fontSize: 13, color: C.gray400, margin: "4px 0 0" }}>
            {matches.length} match{matches.length !== 1 ? "s" : ""} agrégé{matches.length !== 1 ? "s" : ""} · {names.length} joueuses
          </p>
        </div>
        {matches.length > 0 && (
          <button onClick={() => setCompactView(v => !v)} style={{ ...s.btn("ghost"), padding: "6px 12px", fontSize: 12 }}>
            {compactView ? "📊 Vue détaillée" : "🔲 Vue compacte"}
          </button>
        )}
      </div>

      {matches.length === 0 ? (
        <div style={{ ...s.card, padding: 48, textAlign: "center" }}>
          <p style={{ color: C.gray400 }}>Aucun match enregistré pour l'instant.</p>
        </div>
      ) : compactView ? (
        <div style={{ ...s.card }}>
          {names.map(n => (
            <CompactPlayerRow key={n} nom={n} ps={totals[n]} editable={false} onEdit={null} />
          ))}
          <div style={{ background: C.blueXlt }}>
            <CompactPlayerRow nom="Équipe" ps={teamTotals} editable={false} onEdit={null} />
          </div>
        </div>
      ) : (
        <div style={{ ...s.card, overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ background: C.gray100 }}>
                <th style={{ padding: "10px 12px", textAlign: "left", position: "sticky", left: 0, background: C.gray100, borderBottom: `2px solid ${C.gray200}` }}>Joueuse</th>
                <th style={{ padding: "10px 8px", borderBottom: `2px solid ${C.gray200}` }}>Eff. Service</th>
                <th style={{ padding: "10px 8px", borderBottom: `2px solid ${C.gray200}` }}>Récep. +</th>
                <th style={{ padding: "10px 8px", borderBottom: `2px solid ${C.gray200}` }}>Att. Gagnante</th>
                <th style={{ padding: "10px 8px", borderBottom: `2px solid ${C.gray200}` }}>Att. Neutre</th>
                <th style={{ padding: "10px 8px", borderBottom: `2px solid ${C.gray200}` }}>Att. Échec</th>
                <th style={{ padding: "10px 8px", borderBottom: `2px solid ${C.gray200}` }}>Eff. Bloc</th>
                <th style={{ padding: "10px 8px", borderBottom: `2px solid ${C.gray200}` }}>Eff. Passe</th>
                <th style={{ padding: "10px 8px", borderBottom: `2px solid ${C.gray200}` }}>Eff. Défense</th>
                <th style={{ padding: "10px 8px", borderBottom: `2px solid ${C.gray200}` }}>Pts ✓</th>
                <th style={{ padding: "10px 8px", borderBottom: `2px solid ${C.gray200}` }}>Fts ✗</th>
                <th style={{ padding: "10px 8px", borderBottom: `2px solid ${C.gray200}` }}>Rapport +/-</th>
              </tr>
            </thead>
            <tbody>
              {names.map((n, i) => {
                const r = computeRates(totals[n]);
                return (
                  <tr key={n} style={{ background: i % 2 === 0 ? C.white : C.gray50 }}>
                    <td style={{ padding: "8px 12px", fontWeight: 600, position: "sticky", left: 0, background: i % 2 === 0 ? C.white : C.gray50, borderBottom: `1px solid ${C.gray100}`, whiteSpace: "nowrap" }}>{n}</td>
                    <td style={{ padding: "8px", textAlign: "center", borderBottom: `1px solid ${C.gray100}` }}>{cellPct(r.servEff)}</td>
                    <td style={{ padding: "8px", textAlign: "center", borderBottom: `1px solid ${C.gray100}` }}>{cellPct(r.recPos)}</td>
<td style={{ padding: "8px", textAlign: "center", borderBottom: `1px solid ${C.gray100}` }}>{cellPct(r.attGagnante)}</td>
                    <td style={{ padding: "8px", textAlign: "center", borderBottom: `1px solid ${C.gray100}` }}>{cellPct(r.attNeutre)}</td>
                    <td style={{ padding: "8px", textAlign: "center", borderBottom: `1px solid ${C.gray100}` }}>{cellPct(r.attEchec)}</td>                    <td style={{ padding: "8px", textAlign: "center", borderBottom: `1px solid ${C.gray100}` }}>{cellPct(r.blocEff)}</td>
                    <td style={{ padding: "8px", textAlign: "center", borderBottom: `1px solid ${C.gray100}` }}>{cellPct(r.passeEff)}</td>
                    <td style={{ padding: "8px", textAlign: "center", borderBottom: `1px solid ${C.gray100}` }}>{cellPct(r.defEff)}</td>
                    <td style={{ padding: "8px", textAlign: "center", fontWeight: 700, color: C.blue, borderBottom: `1px solid ${C.gray100}` }}>{r.pg}</td>
                    <td style={{ padding: "8px", textAlign: "center", fontWeight: 700, color: C.red, borderBottom: `1px solid ${C.gray100}` }}>{r.fd}</td>
                    <td style={{ padding: "8px", textAlign: "center", borderBottom: `1px solid ${C.gray100}` }}>{cellPct(r.rapport)}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr style={{ background: C.blueXlt, fontWeight: 700 }}>
                <td style={{ padding: "10px 12px", position: "sticky", left: 0, background: C.blueXlt }}>Équipe</td>
                <td style={{ padding: "10px 8px", textAlign: "center" }}>{cellPct(teamRates.servEff)}</td>
                <td style={{ padding: "10px 8px", textAlign: "center" }}>{cellPct(teamRates.recPos)}</td>
                <td style={{ padding: "10px 8px", textAlign: "center" }}>{cellPct(teamRates.attGagnante)}</td>
                <td style={{ padding: "10px 8px", textAlign: "center" }}>{cellPct(teamRates.attNeutre)}</td>
                <td style={{ padding: "10px 8px", textAlign: "center" }}>{cellPct(teamRates.attEchec)}</td>                <td style={{ padding: "10px 8px", textAlign: "center" }}>{cellPct(teamRates.blocEff)}</td>
                <td style={{ padding: "10px 8px", textAlign: "center" }}>{cellPct(teamRates.passeEff)}</td>
                <td style={{ padding: "10px 8px", textAlign: "center" }}>{cellPct(teamRates.defEff)}</td>
                <td style={{ padding: "10px 8px", textAlign: "center", color: C.blue }}>{teamRates.pg}</td>
                <td style={{ padding: "10px 8px", textAlign: "center", color: C.red }}>{teamRates.fd}</td>
                <td style={{ padding: "10px 8px", textAlign: "center" }}>{cellPct(teamRates.rapport)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
// ─── Pages ────────────────────────────────────────────────────────────────────
function Dashboard({ matches, onSelect, onDelete, onNew, onAnalyze }) {
  return (
    <div>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:24 }}>
        <div>
          <h1 style={{ fontSize:22, fontWeight:700, margin:0 }}>🏐 Mes matches</h1>
          <p style={{ fontSize:13, color:C.gray400, margin:"4px 0 0" }}>{matches.length} match{matches.length!==1?"es":""} enregistré{matches.length!==1?"s":""}</p>
        </div>
        <button style={s.btn()} onClick={onNew}>+ Nouveau match</button>
      </div>
      {matches.length === 0 && (
        <div style={{ ...s.card, padding:48, textAlign:"center" }}>
          <div style={{ fontSize:48, marginBottom:16 }}>🏐</div>
          <p style={{ color:C.gray400, fontSize:15 }}>Aucun match. Commencez par en créer un !</p>
          <button style={{ ...s.btn(), marginTop:16 }} onClick={onNew}>Créer le premier match</button>
        </div>
      )}
      <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
        {matches.map(m => {
          const sA = m.sets.filter(s=>s.scoreA>s.scoreB).length;
          const sB = m.sets.filter(s=>s.scoreB>s.scoreA).length;
          const isUpcoming = m.sets.every(s => s.scoreA === 0 && s.scoreB === 0);
          const accentColor = isUpcoming ? C.gold : (sA > sB ? C.green : C.red);
          return (
            <div key={m.id} style={{ ...s.card, cursor:"pointer", borderLeft:`4px solid ${accentColor}` }}
              onClick={() => onSelect(m.id)}
              onMouseEnter={e=>e.currentTarget.style.boxShadow="0 4px 20px rgba(0,0,0,0.1)"}
              onMouseLeave={e=>e.currentTarget.style.boxShadow="none"}>
              <div style={{ padding:"16px 20px", display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:12 }}>
                <div>
                  <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:6 }}>
                    <span style={{ fontSize:16, fontWeight:700 }}>{m.equipeA}</span>
                   {isUpcoming ? (
                      <span style={{ ...s.badge(C.gold, C.goldLt), fontSize:13, fontWeight:800, padding:"6px 14px" }}>🔴 À venir</span>
                    ) : (
                      <span style={{ ...s.badge(C.blue,C.blueXlt), fontSize:18, fontWeight:800, padding:"4px 14px" }}>{sA} — {sB}</span>
                    )}
                    <span style={{ fontSize:16, fontWeight:700 }}>{m.equipeB}</span>
                  </div>
                  <div style={{ display:"flex", gap:8, alignItems:"center", flexWrap:"wrap" }}>
                    <span style={{ fontSize:12, color:C.gray400 }}>📅 {new Date(m.date).toLocaleDateString("fr-FR",{day:"2-digit",month:"long",year:"numeric"})}</span>
                   {!isUpcoming && (
                      <>
                        <span style={s.badge(C.gray600,C.gray100)}>{m.sets.filter(st => st.scoreA > 0 || st.scoreB > 0).length} sets</span>
                        {m.sets.filter(st => st.scoreA > 0 || st.scoreB > 0).map(st => <span key={st.id} style={{ ...s.badge(C.gray600,C.gray100), fontSize:11 }}>{st.scoreA}–{st.scoreB}</span>)}
                      </>
                    )}
                  </div>
                </div>
                <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                  <button style={s.btn("primary")} onClick={e=>{e.stopPropagation();onAnalyze(m);}}>🤖 Analyse IA</button>
                  <button style={s.btn("ghost")} onClick={e=>{e.stopPropagation();onDelete(m.id);}}>🗑 Supprimer</button>
                  <span style={{ color:C.gray400, fontSize:20 }}>›</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MatchView({ match, onBack, onUpdateStats, onUpdateScores, onOpenVideo, onOpenLive }) {
  const [activeSet, setActiveSet] = useState("global");
  const [setEditMode, setSetEditMode] = useState(false);
  const [setEditValues, setSetEditValues] = useState({});
  const [saving, setSaving] = useState(false);
  const [recalculating, setRecalculating] = useState(false);
  const [scoreEditMode, setScoreEditMode] = useState(false);
  const [scoreValues, setScoreValues] = useState([]);
  const [compactView, setCompactView] = useState(true);

  const openScoreEdit = () => {
    setScoreValues(match.sets.map(st => ({ num: st.num, scoreA: st.scoreA, scoreB: st.scoreB })));
    setScoreEditMode(true);
  };

  const saveScores = async () => {
    await onUpdateScores(match.id, scoreValues);
    setScoreEditMode(false);
  };

  const getPlayers = () => {
    if (activeSet === "global") {
      const map = {};
      match.sets.forEach(set => set.stats.forEach(ps => { if (!map[ps.nom]) map[ps.nom]=[]; map[ps.nom].push(ps); }));
      const r = {};
      Object.entries(map).forEach(([n,arr]) => { r[n] = sumStats(arr); });
      return r;
    }
    const set = match.sets.find(s=>s.num===activeSet);
    if (!set) return {};
    const r = {};
    set.stats.forEach(ps => { r[ps.nom] = {...ps}; });
    return r;
  };

  const players = getPlayers();
  const playerOrder = Object.keys(players);
  const totalA  = match.sets.reduce((a,s)=>a+s.scoreA,0);
  const totalB  = match.sets.reduce((a,s)=>a+s.scoreB,0);

  // ── Édition du set actif : grille collable depuis Excel ──
  const startSetEdit = () => {
    if (activeSet === "global") return;
    const init = {};
    Object.entries(players).forEach(([nom, ps]) => { init[nom] = { ...ps }; });
    setSetEditValues(init);
    setSetEditMode(true);
  };

  const cancelSetEdit = () => setSetEditMode(false);

  const updateSetStat = (nom, field, value) => {
    setSetEditValues(prev => ({ ...prev, [nom]: { ...prev[nom], [field]: Math.max(0, parseInt(value) || 0) } }));
  };

  const handlePasteGridSet = (e, playerIndex, fieldIndex) => {
    const text = e.clipboardData.getData("text");
    if (!text) return;
    e.preventDefault();
    const rows = text.split(/\r?\n/).filter(r => r.length > 0);
    rows.forEach((rowText, rOffset) => {
      const pIdx = playerIndex + rOffset;
      if (pIdx >= playerOrder.length) return;
      const nom = playerOrder[pIdx];
      rowText.split("\t").forEach((cellText, cOffset) => {
        const fIdx = fieldIndex + cOffset;
        if (fIdx >= EDITABLE_FIELDS.length) return;
        const val = parseInt(cellText.replace(/[^\d-]/g, "")) || 0;
        updateSetStat(nom, EDITABLE_FIELDS[fIdx], val);
      });
    });
  };

  const saveSetEdit = async () => {
    setSaving(true);
    for (const nom of playerOrder) {
      const v = setEditValues[nom];
      if (!v) continue;
      const { PG, FD } = computePGFD(v);
      await onUpdateStats(match.id, activeSet, nom, { ...v, PG, FD });
    }
    setSaving(false);
    setSetEditMode(false);
  };

  // ── Corrige les Pts/Fautes déjà enregistrés (ex: anciennes éditions qui ne recalculaient pas) ──
  const recalcAll = async () => {
    setRecalculating(true);
    for (const set of match.sets) {
      for (const ps of set.stats) {
        const { PG, FD } = computePGFD(ps);
        if (PG !== (ps.PG || 0) || FD !== (ps.FD || 0)) {
          await onUpdateStats(match.id, set.num, ps.nom, { ...ps, PG, FD });
        }
      }
    }
    setRecalculating(false);
  };

  return (
    <div>
      {/* Header */}
      <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:20, flexWrap:"wrap" }}>
        <button style={s.btn("ghost")} onClick={onBack}>← Retour</button>
        <h1 style={{ fontSize:18, fontWeight:700, margin:0 }}>
          {match.equipeA} <span style={{ color:C.blue }}>vs</span> {match.equipeB}
        </h1>
        <span style={{ fontSize:12, color:C.gray400 }}>
          {new Date(match.date).toLocaleDateString("fr-FR",{day:"2-digit",month:"long",year:"numeric"})}
        </span>
       <button style={{ ...s.btn("success") }} onClick={onOpenLive}>
  🟢 Saisie en direct
</button>
        <button style={s.btn("ghost")} onClick={openScoreEdit}>
          ✏️ {match.sets.every(st => st.scoreA === 0 && st.scoreB === 0) ? "Saisir le score" : "Modifier le score"}
        </button>
        <button style={s.btn("ghost")} onClick={recalcAll} disabled={recalculating}>
          {recalculating ? "Recalcul…" : "🔄 Recalculer Pts/Fautes"}
        </button>
        <button style={{ ...s.btn("purple"), marginLeft:"auto" }} onClick={onOpenVideo}>
          🎬 Analyser vidéo
        </button>
      </div>

      {/* Score */}
      <div style={{ ...s.card, marginBottom:20 }}>
        <div style={{ padding:"20px 24px", display:"flex", alignItems:"center", justifyContent:"space-around", flexWrap:"wrap", gap:16 }}>
          <div style={{ textAlign:"center" }}>
            <p style={{ fontSize:13, color:C.gray400, margin:0 }}>Score total</p>
            <p style={{ fontSize:32, fontWeight:800, margin:"4px 0", color:C.navy }}>{totalA} — {totalB}</p>
            <p style={{ fontSize:13, color:C.gray600, margin:0 }}>{match.equipeA} / {match.equipeB}</p>
          </div>
          <div style={{ display:"flex", gap:16, flexWrap:"wrap" }}>
            {match.sets.filter(st => st.scoreA > 0 || st.scoreB > 0).map(st => (
              <div key={st.id} style={{ textAlign:"center" }}>
                <p style={{ fontSize:11, color:C.gray400, margin:0, textTransform:"uppercase" }}>Set {st.num}</p>
                <p style={{ fontSize:22, fontWeight:700, margin:"4px 0", color:st.scoreA>st.scoreB?C.blue:C.gray600 }}>{st.scoreA}–{st.scoreB}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Tabs sets */}
      <div style={{ display:"flex", gap:8, marginBottom:20, flexWrap:"wrap" }}>
        <button style={s.tag(activeSet==="global")} onClick={()=>setActiveSet("global")}>Global</button>
        {match.sets.map(st => (
          <button key={st.num} style={s.tag(activeSet===st.num)} onClick={()=>setActiveSet(st.num)}>Set {st.num}</button>
        ))}
      </div>

      {/* Tableau */}
      <div style={{ ...s.card, marginBottom:20 }}>
        <div style={{ padding:"14px 20px", borderBottom:`1px solid ${C.gray200}`, display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:10 }}>
          <span style={{ fontWeight:600, fontSize:14 }}>Statistiques {activeSet==="global"?"globales":`— Set ${activeSet}`}</span>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            {activeSet !== "global" && !setEditMode && (
              <button onClick={startSetEdit} style={{ ...s.btn("primary"), padding:"6px 12px", fontSize:12 }}>✏️ Éditer le set</button>
            )}
            {!setEditMode && (
              <button onClick={() => setCompactView(v => !v)} style={{ ...s.btn("ghost"), padding:"6px 12px", fontSize:12 }}>
                {compactView ? "📊 Vue détaillée" : "🔲 Vue compacte"}
              </button>
            )}
          </div>
        </div>

        {!setEditMode && <StatsTable players={players} editable={false} onEdit={null} compact={compactView} />}

        {setEditMode && (
          <div>
            <p style={{ fontSize:12, color:C.gray400, padding:"10px 20px 0" }}>
              Astuce : sélectionne une cellule puis colle (Ctrl+V) un bloc copié depuis Excel — les colonnes se remplissent dans l'ordre. <b>Pts✓</b> et <b>Fts✗</b> se recalculent automatiquement, ils ne se saisissent pas.
            </p>
            <div style={{ overflowX:"auto", padding:"10px 20px 20px" }}>
              <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12 }}>
                <thead>
                  <tr>
                    <th rowSpan={2} style={{ padding:"8px 12px", textAlign:"left", background:C.gray100, position:"sticky", left:0, zIndex:2, borderBottom:`1px solid ${C.gray200}`, minWidth:120 }}>Joueuse</th>
                    {GROUP_META.map(g => <SectionHeader key={g.key} label={g.label} color={g.color} bg={g.bg} count={STAT_FIELDS[g.key].length} />)}
                  </tr>
                  <tr style={{ background:C.gray50 }}>
                    {GROUP_META.map(g => STAT_FIELDS[g.key].map(f => (
                      <th key={f} style={{ padding:"4px 6px", fontSize:11, fontWeight:600, color:g.color, textAlign:"center", minWidth:36, borderBottom:`1px solid ${C.gray200}` }}>{STAT_LABELS[f]}</th>
                    )))}
                  </tr>
                </thead>
                <tbody>
                  {playerOrder.map((nom, i) => (
                    <tr key={nom} style={{ background:i%2===0?C.white:C.gray50 }}>
                      <td style={{ padding:"8px 12px", fontWeight:600, fontSize:13, position:"sticky", left:0, background:i%2===0?C.white:C.gray50, zIndex:1, borderBottom:`1px solid ${C.gray100}`, whiteSpace:"nowrap" }}>
                        <span style={{ display:"inline-flex", alignItems:"center", gap:6 }}>
                          <span style={{ width:26, height:26, borderRadius:"50%", background:C.blueXlt, color:C.blue, fontSize:11, fontWeight:700, display:"inline-flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>{nom[0]}</span>
                          {nom}
                        </span>
                      </td>
                      {GROUP_META.map(g => STAT_FIELDS[g.key].map(f => {
                        if (f === "PG" || f === "FD") {
                          const computed = computePGFD(setEditValues[nom] || {})[f];
                          return (
                            <td key={f} style={{ padding:"3px", borderBottom:`1px solid ${C.gray100}`, textAlign:"center" }}>
                              <span style={{ display:"inline-block", width:40, fontWeight:700, color:f==="PG"?C.blue:C.red }}>{computed}</span>
                            </td>
                          );
                        }
                        const fieldIndex = EDITABLE_FIELDS.indexOf(f);
                        return (
                          <td key={f} style={{ padding:"3px", borderBottom:`1px solid ${C.gray100}` }}>
                            <input type="number" min={0}
                              style={{ width:40, padding:"4px", border:`1px solid ${C.gray200}`, borderRadius:4, textAlign:"center", fontSize:12, outline:"none", background:C.white }}
                              value={setEditValues[nom]?.[f] || 0}
                              onFocus={e => e.target.select()}
                              onPaste={e => handlePasteGridSet(e, i, fieldIndex)}
                              onChange={e => updateSetStat(nom, f, e.target.value)} />
                          </td>
                        );
                      }))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ padding:"0 20px 20px", display:"flex", gap:10 }}>
              <button style={s.btn("ghost")} onClick={cancelSetEdit}>Annuler</button>
              <button style={s.btn("success")} onClick={saveSetEdit} disabled={saving}>{saving ? "Enregistrement…" : "✓ Enregistrer le set"}</button>
            </div>
          </div>
        )}
      </div>

      {/* Graphiques */}
      <Charts players={players} />

      {scoreEditMode && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.45)", zIndex:100, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}
          onClick={e=>{if(e.target===e.currentTarget)setScoreEditMode(false);}}>
          <div style={{ background:C.white, borderRadius:16, width:"100%", maxWidth:480, padding:"24px", boxShadow:"0 20px 60px rgba(0,0,0,0.25)" }}>
            <p style={{ fontWeight:700, fontSize:16, margin:"0 0 16px" }}>Saisir le score du match</p>
            <div style={{ display:"flex", flexDirection:"column", gap:12, marginBottom:20 }}>
              {scoreValues.map((ss, i) => (
                <div key={ss.num} style={{ display:"flex", alignItems:"center", gap:10 }}>
                  <span style={{ fontSize:13, fontWeight:600, color:C.gray600, width:50 }}>Set {ss.num}</span>
                  <input type="number" min={0} style={{ ...s.input, width:64, textAlign:"center" }}
                    value={ss.scoreA} onFocus={e=>e.target.select()}
                    onChange={e=>setScoreValues(prev=>prev.map((x,j)=>j===i?{...x,scoreA:parseInt(e.target.value)||0}:x))} />
                  <span style={{ color:C.gray400 }}>–</span>
                  <input type="number" min={0} style={{ ...s.input, width:64, textAlign:"center" }}
                    value={ss.scoreB} onFocus={e=>e.target.select()}
                    onChange={e=>setScoreValues(prev=>prev.map((x,j)=>j===i?{...x,scoreB:parseInt(e.target.value)||0}:x))} />
                </div>
              ))}
            </div>
            <div style={{ display:"flex", gap:10, justifyContent:"flex-end" }}>
              <button style={s.btn("ghost")} onClick={()=>setScoreEditMode(false)}>Annuler</button>
              <button style={s.btn("success")} onClick={saveScores}>✓ Enregistrer le score</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function NewMatch({ onSave, onCancel, players: seasonRoster }) {
  const rosterSource = (seasonRoster && seasonRoster.length > 0) ? seasonRoster : PLAYERS;
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({ date: today(), equipeA: "Bailleul", equipeB: "", nbSets: 3 });
  const [scores, setScores] = useState(
    Array.from({ length: 3 }, (_, i) => ({ num: i + 1, scoreA: 0, scoreB: 0 }))
  );
  const [scoresKnown, setScoresKnown] = useState(true);
  const [players, setPlayers] = useState([]);
  const [pendingPlayer, setPendingPlayer] = useState("");
  const [customName, setCustomName] = useState("");
  const [statsPerSet, setStatsPerSet] = useState({});
  const [activeSetInput, setActiveSetInput] = useState(1);

  // ── Nouveaux états étape 1 ─────────────────────────────────────────────
  const [isAway, setIsAway]       = useState(false);      // Bailleul joue à domicile ou extérieur
  const [adversaire, setAdversaire] = useState("");        // Nom de l'adversaire (champ unique)
  const [errors, setErrors]       = useState({});          // Erreurs de validation visibles

  useEffect(() => {
    const n = Number(form.nbSets);
    setScores(prev => Array.from({ length: n }, (_, i) => prev[i] || { num: i + 1, scoreA: 0, scoreB: 0 }));
  }, [form.nbSets]);

  const fullName = (rp) => `${rp.prenom} ${rp.nom}`;
  const availableRoster = rosterSource.filter(rp => !players.some(pl => pl.nom === fullName(rp)));

  const addPlayer = (nameToAdd) => {
    if (!nameToAdd || players.some(pl => pl.nom === nameToAdd)) return;
    setPlayers(prev => [...prev, { nom: nameToAdd }]);
  };

const togglePlayer = (name) => {
  setPlayers(prev => prev.some(pl => pl.nom === name) ? prev.filter(pl => pl.nom !== name) : [...prev, { nom: name }]);
};

  const step1 = () => {
    const newErrors = {};
    if (!form.date) newErrors.date = "La date est obligatoire.";
    if (!adversaire.trim()) newErrors.adversaire = "Entre le nom de l'adversaire.";
    if (Object.keys(newErrors).length > 0) { setErrors(newErrors); return; }
    setErrors({});
    // Calcul equipeA / equipeB selon domicile ou extérieur
    const adv = adversaire.trim();
    setForm(f => ({
      ...f,
      equipeA: isAway ? adv : "Bailleul",
      equipeB: isAway ? "Bailleul" : adv,
    }));
    setStep(2);
  };

  const step2 = () => {
    if (!players.length) return;
    const sp = {};
    scores.forEach(s => { sp[s.num] = {}; players.forEach(p => { sp[s.num][p.nom] = { ...EMPTY_STATS(), statut: "titulaire" }; }); });
    setStatsPerSet(sp);
    setStep(3);
  };
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  const handleSave = async () => {
    setIsSaving(true);
    setSaveError(null);
    try {
      const sets = scores.map(ss => {
        const setStats = players.map(p => {
          const entry = statsPerSet[ss.num]?.[p.nom] || { ...EMPTY_STATS(), statut: "titulaire" };
          const { statut, ...statFields } = entry;
          const { PG, FD } = computePGFD(statFields);
          return { id: uid(), nom: p.nom, titulaire: statut === "titulaire", statut, ...statFields, PG, FD };
        });
        return { id: uid(), num: ss.num, scoreA: ss.scoreA, scoreB: ss.scoreB, stats: setStats };
      });
      await onSave({ id: uid(), date: form.date, equipeA: form.equipeA, equipeB: form.equipeB, sets });
    } catch (e) {
      setSaveError(e.message || "Erreur de connexion. Le serveur peut prendre 30-50s à démarrer — réessaie.");
      setIsSaving(false);
    }
  };

  const updateStat = (setNum, nom, field, value) => {
    setStatsPerSet(prev => ({ ...prev, [setNum]: { ...prev[setNum], [nom]: { ...prev[setNum][nom], [field]: Math.max(0, parseInt(value) || 0) } } }));
  };

  const updateStatut = (setNum, nom, statut) => {
    setStatsPerSet(prev => ({ ...prev, [setNum]: { ...prev[setNum], [nom]: { ...prev[setNum][nom], statut } } }));
  };
const handlePasteGrid = (e, playerIndex, fieldIndex) => {
    const text = e.clipboardData.getData("text");
    if (!text) return;
    e.preventDefault();
    const rows = text.split(/\r?\n/).filter(r => r.length > 0);
    rows.forEach((rowText, rOffset) => {
      const pIdx = playerIndex + rOffset;
      if (pIdx >= players.length) return;
      const playerNom = players[pIdx].nom;
      rowText.split("\t").forEach((cellText, cOffset) => {
        const fIdx = fieldIndex + cOffset;
        if (fIdx >= EDITABLE_FIELDS.length) return;
        const val = parseInt(cellText.replace(/[^\d-]/g, "")) || 0;
        updateStat(activeSetInput, playerNom, EDITABLE_FIELDS[fIdx], val);
      });
    });
  };

  const statutBtn = (active, color) => ({
    padding: "3px 7px", borderRadius: 5, border: `1px solid ${active ? color : C.gray200}`,
    background: active ? color : C.white, color: active ? C.white : C.gray600,
    fontSize: 10, fontWeight: 700, cursor: "pointer",
  });

  return (
    <div style={{ maxWidth: step === 3 ? 1400 : 800, margin: "0 auto" }}>
      <style>{`
        input[type="number"]::-webkit-inner-spin-button,
        input[type="number"]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
        input[type="number"] { -moz-appearance: textfield; }
      `}</style>

      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
        <button style={s.btn("ghost")} onClick={onCancel}>← Retour</button>
        <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Nouveau match</h1>
      </div>

      <div style={{ display: "flex", gap: 6, marginBottom: 18, justifyContent: "center" }}>
        {["Infos match", "Joueuses", "Statistiques"].map((label, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 10px 5px 6px", borderRadius: 20, background: step === i + 1 ? C.blueXlt : "transparent" }}>
            <div style={{ width: 20, height: 20, borderRadius: "50%", flexShrink: 0, background: step > i + 1 ? C.green : step === i + 1 ? C.blue : C.gray200, color: step >= i + 1 ? C.white : C.gray400, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700 }}>
              {step > i + 1 ? "✓" : i + 1}
            </div>
            <span style={{ fontSize: 12, color: step === i + 1 ? C.blue : C.gray400, fontWeight: step === i + 1 ? 600 : 400 }}>{label}</span>
          </div>
        ))}
      </div>

      {step === 1 && (
        <div style={{ ...s.card, padding: 24 }}>

          {/* ── Erreurs de validation visibles ── */}
          {Object.keys(errors).length > 0 && (
            <div style={{ background: C.redLt, border: `1px solid ${C.red}40`, borderRadius: 8, padding: "10px 14px", marginBottom: 16 }}>
              {Object.values(errors).map((e, i) => (
                <p key={i} style={{ color: C.red, margin: 0, fontSize: 13, fontWeight: 600 }}>⚠ {e}</p>
              ))}
            </div>
          )}

          <div style={{ display: "grid", gap: 20 }}>

            {/* Date */}
            <div>
              <label style={s.label}>Date du match</label>
              <input type="date" style={{ ...s.input, borderColor: errors.date ? C.red : undefined, fontSize: 16, padding: "10px 12px" }}
                value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
            </div>

            {/* Toggle domicile / extérieur */}
            <div>
              <label style={s.label}>Bailleul joue...</label>
              <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                <button onClick={() => setIsAway(false)} style={{ flex: 1, padding: "12px 8px", borderRadius: 10, border: `2px solid ${!isAway ? C.blue : C.gray200}`, cursor: "pointer", background: !isAway ? C.blueXlt : C.white, color: !isAway ? C.blue : C.gray600, fontSize: 14, fontWeight: 700, textAlign: "center" }}>
                  🏠 À domicile
                </button>
                <button onClick={() => setIsAway(true)} style={{ flex: 1, padding: "12px 8px", borderRadius: 10, border: `2px solid ${isAway ? C.blue : C.gray200}`, cursor: "pointer", background: isAway ? C.blueXlt : C.white, color: isAway ? C.blue : C.gray600, fontSize: 14, fontWeight: 700, textAlign: "center" }}>
                  ✈ À l'extérieur
                </button>
              </div>
            </div>

            {/* Adversaire (champ unique, clair) */}
            <div>
              <label style={s.label}>Équipe adverse *</label>
              <input style={{ ...s.input, fontSize: 16, padding: "10px 12px", borderColor: errors.adversaire ? C.red : undefined }}
                value={adversaire} onChange={e => { setAdversaire(e.target.value); if (errors.adversaire) setErrors({}); }}
                placeholder="Ex : Malakof, Lys, Spol…" autoComplete="off" />
              {errors.adversaire && <p style={{ color: C.red, fontSize: 12, marginTop: 4 }}>{errors.adversaire}</p>}

              {/* Récapitulatif clair */}
              {adversaire.trim() && (
                <div style={{ marginTop: 8, background: C.blueXlt, borderRadius: 8, padding: "8px 12px", fontSize: 13, color: C.blue, fontWeight: 600 }}>
                  {isAway
                    ? <>✈ <strong>{adversaire}</strong> (dom.) — <strong>Bailleul</strong> (ext.)</>
                    : <>🏠 <strong>Bailleul</strong> (dom.) — <strong>{adversaire}</strong> (ext.)</>}
                </div>
              )}
            </div>

            {/* Match joué ou à venir */}
            <div>
              <label style={s.label}>Quand a lieu le match ?</label>
              <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                <button type="button" style={{ flex: 1, padding: "10px 8px", borderRadius: 10, border: `2px solid ${scoresKnown ? C.blue : C.gray200}`, cursor: "pointer", background: scoresKnown ? C.blueXlt : C.white, color: scoresKnown ? C.blue : C.gray600, fontSize: 13, fontWeight: 700 }}
                  onClick={() => setScoresKnown(true)}>📋 Déjà joué</button>
                <button type="button" style={{ flex: 1, padding: "10px 8px", borderRadius: 10, border: `2px solid ${!scoresKnown ? C.blue : C.gray200}`, cursor: "pointer", background: !scoresKnown ? C.blueXlt : C.white, color: !scoresKnown ? C.blue : C.gray600, fontSize: 13, fontWeight: 700 }}
                  onClick={() => { setScoresKnown(false); setForm(f => ({ ...f, nbSets: 5 })); }}>🔴 À venir</button>
              </div>
            </div>

            {/* Nombre de sets */}
            {scoresKnown && (
              <div>
                <label style={s.label}>Nombre de sets joués</label>
                <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                  {[2, 3, 4, 5].map(n => (
                    <button key={n} onClick={() => setForm(f => ({ ...f, nbSets: n }))}
                      style={{ flex: 1, padding: "10px", borderRadius: 10, border: `2px solid ${form.nbSets === n ? C.blue : C.gray200}`, cursor: "pointer", background: form.nbSets === n ? C.blueXlt : C.white, color: form.nbSets === n ? C.blue : C.gray600, fontSize: 18, fontWeight: 800 }}>
                      {n}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Scores par set — boutons +/- grands */}
            {scoresKnown && (
              <div>
                <label style={s.label}>Scores par set</label>
                <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 4 }}>
                  {scores.map((ss, i) => {
                    const nomA = isAway ? (adversaire || "Adversaire") : "Bailleul";
                    const nomB = isAway ? "Bailleul" : (adversaire || "Adversaire");
                    const scoreBtn = (bg, color, border) => ({
                      width: 48, height: 48, borderRadius: 10, border, cursor: "pointer",
                      background: bg, color, fontSize: 24, fontWeight: 700,
                      display: "flex", alignItems: "center", justifyContent: "center",
                    });
                    return (
                      <div key={ss.num} style={{ background: C.gray50, border: `1px solid ${C.gray200}`, borderRadius: 12, padding: "12px 16px" }}>
                        <p style={{ fontSize: 11, fontWeight: 700, color: C.gray400, textTransform: "uppercase", margin: "0 0 10px", textAlign: "center" }}>Set {ss.num}</p>
                        {/* Équipe A */}
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                          <span style={{ fontSize: 14, fontWeight: 700, color: C.gray800, minWidth: 90 }}>{nomA}</span>
                          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                            <button onClick={() => setScores(prev => prev.map((x, j) => j === i ? { ...x, scoreA: Math.max(0, x.scoreA - 1) } : x))}
                              style={scoreBtn(C.white, C.gray600, `1px solid ${C.gray200}`)}>−</button>
                            <span style={{ fontSize: 32, fontWeight: 900, color: C.blue, minWidth: 44, textAlign: "center" }}>{ss.scoreA}</span>
                            <button onClick={() => setScores(prev => prev.map((x, j) => j === i ? { ...x, scoreA: x.scoreA + 1 } : x))}
                              style={scoreBtn(C.blueXlt, C.blue, `1px solid ${C.blue}`)}>+</button>
                          </div>
                        </div>
                        {/* Équipe B */}
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                          <span style={{ fontSize: 14, fontWeight: 700, color: C.gray800, minWidth: 90 }}>{nomB}</span>
                          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                            <button onClick={() => setScores(prev => prev.map((x, j) => j === i ? { ...x, scoreB: Math.max(0, x.scoreB - 1) } : x))}
                              style={scoreBtn(C.white, C.gray600, `1px solid ${C.gray200}`)}>−</button>
                            <span style={{ fontSize: 32, fontWeight: 900, color: C.red, minWidth: 44, textAlign: "center" }}>{ss.scoreB}</span>
                            <button onClick={() => setScores(prev => prev.map((x, j) => j === i ? { ...x, scoreB: x.scoreB + 1 } : x))}
                              style={scoreBtn(C.redLt, C.red, `1px solid ${C.red}`)}>+</button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Bouton Suivant — grand, pleine largeur */}
          <button style={{ ...s.btn(), marginTop: 24, width: "100%", justifyContent: "center", padding: "14px", fontSize: 16 }}
            onClick={step1}>
            Suivant →
          </button>
        </div>
      )}

      {step === 2 && (
  <div style={{ ...s.card, padding: 28 }}>
    <p style={{ fontSize: 13, color: C.gray600, marginBottom: 18 }}>
      Cochez les joueuses présentes dans l'effectif pour ce match. Vous préciserez set par set qui était titulaire, remplaçante ou absente à l'étape suivante.
    </p>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 10, marginBottom: 20 }}>
      {PLAYERS.map(rp => {
        const name = fullName(rp);
        const checked = players.some(pl => pl.nom === name);
        return (
          <label key={rp.number} style={{
            display: "flex", alignItems: "center", gap: 10, padding: "10px 14px",
            border: `1px solid ${checked ? C.blue : C.gray200}`, borderRadius: 10,
            background: checked ? C.blueXlt : C.white, cursor: "pointer", transition: "all 0.12s"
          }}>
            <input type="checkbox" checked={checked} onChange={() => togglePlayer(name)}
              style={{ width: 16, height: 16, accentColor: C.blue }} />
            <span style={{ width: 28, height: 28, borderRadius: "50%", background: checked ? C.blue : C.gray100, color: checked ? C.white : C.gray600, fontSize: 11, fontWeight: 700, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              {rp.prenom[0]}{rp.nom[0]}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: 0, fontWeight: 600, fontSize: 13, color: C.gray800 }}>{name}</p>
              <p style={{ margin: 0, fontSize: 11, color: C.gray400 }}>#{rp.number} · {rp.poste}</p>
            </div>
          </label>
        );
      })}
    </div>

    <details style={{ marginBottom: 20 }}>
      <summary style={{ fontSize: 12, color: C.gray400, cursor: "pointer" }}>+ Ajouter une joueuse hors liste</summary>
      <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
        <input style={{ ...s.input, flex: 1 }} placeholder="Nom de la joueuse" value={customName} onChange={e => setCustomName(e.target.value)} />
        <button style={s.btn("ghost")} onClick={() => { addPlayer(customName); setCustomName(""); }}>+ Ajouter</button>
      </div>
    </details>

    <p style={{ fontSize: 12, color: C.gray400, marginBottom: 16 }}>
      {players.length} joueuse{players.length !== 1 ? "s" : ""} sélectionnée{players.length !== 1 ? "s" : ""}
    </p>

    <div style={{ display: "flex", gap: 10 }}>
      <button style={s.btn("ghost")} onClick={() => setStep(1)}>← Retour</button>
      <button style={s.btn()} onClick={step2} disabled={!players.length}>Suivant →</button>
    </div>
  </div>
)}

      {step === 3 && (
        <div>
          <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap", alignItems: "center" }}>
            {scores.map(ss => <button key={ss.num} style={s.tag(activeSetInput === ss.num)} onClick={() => setActiveSetInput(ss.num)}>Set {ss.num} ({ss.scoreA}–{ss.scoreB})</button>)}
            <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
              <button style={{ ...s.tag(false), fontSize: 11 }} onClick={() => setActiveSetInput(activeSetInput)}>
                💡 Les stats à 0 = non saisies — tu peux les compléter après depuis la page du match
              </button>
            </div>
          </div>
          <p style={{ fontSize: 12, color: C.gray400, marginBottom: 10 }}>
            <b style={{ color: C.blue }}>T</b> = titulaire · <b style={{ color: C.gold }}>R</b> = remplaçante · <b style={{ color: C.gray600 }}>—</b> = absente
            <span style={{ marginLeft: 12, color: C.gray400 }}>Colle (Ctrl+V) un bloc Excel sur n'importe quelle cellule.</span>
          </p>
          <div style={s.card}>
            <div style={{ padding: "10px 16px", borderBottom: `1px solid ${C.gray200}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontWeight: 600, fontSize: 13 }}>Saisie stats — Set {activeSetInput}</span>
              <span style={{ fontSize: 11, color: C.gray400 }}>← Scroll horizontal pour voir toutes les colonnes →</span>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr>
                    <th rowSpan={2} style={{ padding: "8px 12px", textAlign: "left", background: C.gray100, position: "sticky", left: 0, zIndex: 2, borderBottom: `1px solid ${C.gray200}`, minWidth: 120 }}>Joueuse</th>
                    <th rowSpan={2} style={{ padding: "8px 6px", background: C.gray100, borderBottom: `1px solid ${C.gray200}`, minWidth: 90 }}>Statut</th>
                    {GROUP_META.map(g => <SectionHeader key={g.key} label={g.label} color={g.color} bg={g.bg} count={STAT_FIELDS[g.key].length} />)}
                  </tr>
                  <tr style={{ background: C.gray50 }}>
                    {GROUP_META.map(g => STAT_FIELDS[g.key].map(f => (
                      <th key={f} style={{ padding: "4px 6px", fontSize: 11, fontWeight: 600, color: g.color, textAlign: "center", minWidth: 36, borderBottom: `1px solid ${C.gray200}` }}>{STAT_LABELS[f]}</th>
                    )))}
                  </tr>
                </thead>
                <tbody>
                  {players.map((pl, i) => {
                    const statut = statsPerSet[activeSetInput]?.[pl.nom]?.statut || "titulaire";
                    const absente = statut === "absente";
                    return (
                      <tr key={pl.nom} style={{ background: i % 2 === 0 ? C.white : C.gray50, opacity: absente ? 0.45 : 1 }}>
                        <td style={{ padding: "8px 12px", fontWeight: 600, fontSize: 13, position: "sticky", left: 0, background: i % 2 === 0 ? C.white : C.gray50, zIndex: 1, borderBottom: `1px solid ${C.gray100}`, whiteSpace: "nowrap" }}>
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                            <span style={{ width: 26, height: 26, borderRadius: "50%", background: C.blueXlt, color: C.blue, fontSize: 11, fontWeight: 700, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{pl.nom[0]}</span>
                            {pl.nom}
                          </span>
                        </td>
                        <td style={{ padding: "6px", textAlign: "center", borderBottom: `1px solid ${C.gray100}` }}>
                          <div style={{ display: "flex", gap: 3, justifyContent: "center" }}>
                            <button style={statutBtn(statut === "titulaire", C.blue)} onClick={() => updateStatut(activeSetInput, pl.nom, "titulaire")}>T</button>
                            <button style={statutBtn(statut === "remplacante", C.gold)} onClick={() => updateStatut(activeSetInput, pl.nom, "remplacante")}>R</button>
                            <button style={statutBtn(statut === "absente", C.gray600)} onClick={() => updateStatut(activeSetInput, pl.nom, "absente")}>—</button>
                          </div>
                        </td>
                        {GROUP_META.map(g => STAT_FIELDS[g.key].map(f => {
                          if (f === "PG" || f === "FD") {
                            const v = statsPerSet[activeSetInput]?.[pl.nom] || {};
                            const computed = computePGFD(v)[f];
                            return (
                              <td key={f} style={{ padding: "3px", borderBottom: `1px solid ${C.gray100}`, textAlign: "center" }}>
                                <span style={{ display: "inline-block", width: 40, fontWeight: 700, color: f === "PG" ? C.blue : C.red }}>{computed}</span>
                              </td>
                            );
                          }
                          const fieldIndex = EDITABLE_FIELDS.indexOf(f);
                          return (
                            <td key={f} style={{ padding: "3px", borderBottom: `1px solid ${C.gray100}` }}>
                              <input type="number" min={0} disabled={absente}
                                style={{ width: 40, padding: "4px", border: `1px solid ${C.gray200}`, borderRadius: 4, textAlign: "center", fontSize: 12, outline: "none", background: absente ? C.gray100 : C.white }}
                                value={statsPerSet[activeSetInput]?.[pl.nom]?.[f] || 0}
                                onFocus={e => e.target.select()}
                                onPaste={e => handlePasteGrid(e, i, fieldIndex)}
                                onChange={e => updateStat(activeSetInput, pl.nom, f, e.target.value)} />
                            </td>
                          );
                        }))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 20, flexDirection: "column" }}>
            {saveError && (
              <div style={{ background: C.redLt, border: `1px solid ${C.red}40`, borderRadius: 8, padding: "12px 16px" }}>
                <p style={{ color: C.red, margin: 0, fontSize: 13, fontWeight: 600 }}>⚠ {saveError}</p>
                <p style={{ color: C.red, margin: "4px 0 0", fontSize: 11, opacity: 0.8 }}>
                  Si le problème persiste, le serveur est peut-être en train de démarrer (gratuit = 50s de délai). Reclique dans 30 secondes.
                </p>
              </div>
            )}
            <div style={{ display: "flex", gap: 10 }}>
              <button style={s.btn("ghost")} onClick={() => setStep(2)} disabled={isSaving}>← Retour</button>
              <button style={{ ...s.btn("success"), padding: "12px 24px", fontSize: 15, opacity: isSaving ? 0.8 : 1, cursor: isSaving ? "wait" : "pointer" }}
                onClick={handleSave} disabled={isSaving}>
                {isSaving ? "⏳ Enregistrement en cours… (peut prendre 30s)" : "✓ Enregistrer le match"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
// ─── App Root ─────────────────────────────────────────────────────────────────
export default function App() {
  const [data, setData]               = useState({ matches: [] });
  const [loading, setLoading]         = useState(true);
  const [page, setPage]               = useState("dashboard");
  const [selectedMatchId, setSelectedMatchId] = useState(null);
  const [videoMode, setVideoMode]     = useState(false);
  const [liveMode, setLiveMode]       = useState(false);
  const [analysisMatch, setAnalysisMatch] = useState(null);

  // ── Saisons ─────────────────────────────────────────────────────────
  const [seasons, setSeasons]         = useState([]);
  const [activeSeason, setActiveSeason] = useState(null);   // saison affichée/filtrée
  const [showSeasonPicker, setShowSeasonPicker] = useState(false);

  const loadSeasons = async () => {
    try {
      const res = await fetch(`${API_URL}/seasons/`);
      const list = await res.json();
      setSeasons(list);
      const active = list.find(s => s.active) || list[0] || null;
      setActiveSeason(active);
    } catch { /* si pas encore de saisons, pas d'erreur bloquante */ }
  };

  const refreshMatches = async () => {
    try {
      const res = await fetch(`${API_URL}/matches/`);
      const matches = await res.json();
      setData({ matches });
    } catch (e) { console.error("Erreur de chargement des matches", e); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadSeasons(); refreshMatches(); }, []);

  // Matchs filtrés par saison active (si une saison est sélectionnée)
  const filteredMatches = activeSeason
    ? data.matches.filter(m => m.season_id === activeSeason.id)
    : data.matches;

  // Joueuses de la saison active (ou liste codée en dur en fallback)
  const seasonPlayers = activeSeason?.roster?.length
    ? activeSeason.roster
    : PLAYERS;

  const selectedMatch = data.matches.find(m => m.id === selectedMatchId);

  const handleSaveMatch = async (match) => {
    const payload = {
      date: match.date,
      equipeA: match.equipeA,
      equipeB: match.equipeB,
      season_id: activeSeason?.id || null,
      sets: match.sets.map(st => ({
        num: st.num,
        scoreA: st.scoreA,
        scoreB: st.scoreB,
        stats: st.stats.map(ps => {
          const { id, nom, titulaire, ...statFields } = ps;
          return { nom, titulaire: !!titulaire, stats: statFields };
        }),
      })),
    };
    const res = await fetch(`${API_URL}/matches/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || `Erreur serveur (${res.status}). Réessaie dans quelques secondes.`);
    }
    const created = await res.json();
    setData(d => ({ ...d, matches: [created, ...d.matches] }));
    setSelectedMatchId(created.id);
    setPage("match");
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Supprimer ce match définitivement ?")) return;
    await fetch(`${API_URL}/matches/${id}`, { method: "DELETE" });
    setData(d => ({ ...d, matches: d.matches.filter(m => m.id !== id) }));
  };
const handleUpdateScores = async (matchId, sets) => {
    const res = await fetch(`${API_URL}/matches/${matchId}/scores`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sets }),
    });
    const updated = await res.json();
    setData(d => ({ ...d, matches: d.matches.map(m => m.id === matchId ? updated : m) }));
  };
  const handleUpdateStats = async (matchId, setNum, playerNom, newValues) => {
    const { id, nom, titulaire, ...statFields } = newValues;
    const payload = { nom: playerNom, setNum, stats: { ...statFields, titulaire: titulaire ?? true } };
    const res = await fetch(`${API_URL}/matches/${matchId}/stats`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const updated = await res.json();
    setData(d => ({ ...d, matches: d.matches.map(m => m.id === matchId ? updated : m) }));
  };

  const handleVideoStats = async (matchId, updates) => {
    for (const { nom, setNum, stats } of updates) {
      await handleUpdateStats(matchId, setNum, nom, stats);
    }
  };

  if (loading) {
    return (
      <div style={{ ...s.app, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={{ color: C.gray400 }}>Chargement…</p>
      </div>
    );
  }

  return (
    <div style={s.app}>
      <header style={s.header}>
        <div style={s.logo}><span>🏐</span><span>SlyVolleyStat Pro</span></div>
        <nav style={s.nav}>
          <button style={s.navBtn(page === "dashboard")} onClick={() => setPage("dashboard")}>Matches</button>
          <button style={s.navBtn(page === "bilan")} onClick={() => setPage("bilan")}>📊 Bilan saison</button>
          <button style={s.navBtn(page === "player")} onClick={() => setPage("player")}>👤 Analyse joueuse</button>
          <button style={s.navBtn(page === "team")} onClick={() => setPage("team")}>🏆 Équipe</button>
          <button style={s.navBtn(page === "seasons")} onClick={() => setPage("seasons")} title="Gérer les saisons et les effectifs">🗓 Saisons</button>
          <button style={s.navBtn(page === "import")} onClick={() => setPage("import")} title="Importer une feuille de match FFVB (PDF)">📄 Import FDM</button>
          <button style={s.navBtn(page === "new")} onClick={() => setPage("new")}>+ Nouveau</button>
          {page === "match" && selectedMatch && (
            <button style={s.navBtn(true)}>{selectedMatch.equipeA} vs {selectedMatch.equipeB}</button>
          )}
        </nav>
        {/* Sélecteur de saison compact */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: "auto" }}>
          {seasons.length > 0 && (
            <div style={{ position: "relative" }}>
              <button
                onClick={() => setShowSeasonPicker(p => !p)}
                style={{ background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 6, color: C.white, padding: "4px 10px", fontSize: 11, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}
              >
                <span>🗓</span>
                <span>{activeSeason ? `${activeSeason.nom} · ${activeSeason.division}${activeSeason.poule ? " " + activeSeason.poule : ""}` : "Toutes saisons"}</span>
                <span style={{ fontSize: 9 }}>▾</span>
              </button>
              {showSeasonPicker && (
                <div style={{ position: "absolute", top: "110%", right: 0, background: C.white, borderRadius: 8, boxShadow: "0 8px 24px rgba(0,0,0,0.15)", minWidth: 200, zIndex: 50, overflow: "hidden" }}
                  onMouseLeave={() => setShowSeasonPicker(false)}>
                  <div style={{ padding: "4px 0" }}>
                    <button onClick={() => { setActiveSeason(null); setShowSeasonPicker(false); }}
                      style={{ width: "100%", padding: "8px 14px", textAlign: "left", background: !activeSeason ? C.blueXlt : "transparent", border: "none", cursor: "pointer", fontSize: 12, color: !activeSeason ? C.blue : C.gray800 }}>
                      Toutes les saisons
                    </button>
                    {seasons.map(s => (
                      <button key={s.id} onClick={() => { setActiveSeason(s); setShowSeasonPicker(false); }}
                        style={{ width: "100%", padding: "8px 14px", textAlign: "left", background: activeSeason?.id === s.id ? C.blueXlt : "transparent", border: "none", cursor: "pointer", fontSize: 12, color: activeSeason?.id === s.id ? C.blue : C.gray800 }}>
                        {s.nom} · {s.division}{s.poule ? " " + s.poule : ""}
                        {s.active && <span style={{ marginLeft: 6, fontSize: 10, color: C.green, fontWeight: 700 }}>●</span>}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", fontStyle: "italic", whiteSpace: "nowrap" }}>
            Deblock Sylvain, Entraîneur
          </div>
        </div>
      </header>
      <main style={s.main}>
        {page === "dashboard" && (
          <Dashboard matches={filteredMatches}
            onSelect={id => { setSelectedMatchId(id); setPage("match"); }}
            onDelete={handleDelete} onNew={() => setPage("new")}
            onAnalyze={m => setAnalysisMatch(m)} />
        )}
       {page === "match" && selectedMatch && (
          <MatchView match={selectedMatch} onBack={() => setPage("dashboard")}
  onUpdateStats={handleUpdateStats}
  onUpdateScores={handleUpdateScores}
  onOpenVideo={() => setVideoMode(true)}
  onOpenLive={() => setLiveMode(true)} />
        )}
        {page === "new" && (
          <NewMatch onSave={handleSaveMatch} onCancel={() => setPage("dashboard")} players={seasonPlayers} />
        )}
        {page === "seasons" && (
          <Seasons onBack={() => setPage("dashboard")} C={C} s={s}
            onSeasonsUpdated={() => { loadSeasons(); refreshMatches(); }} />
        )}
        {page === "import" && (
          <ImportFFVB
            activeSeason={activeSeason}
            onCancel={() => setPage("dashboard")}
            onMatchCreated={(created) => {
              setData(d => ({ ...d, matches: [created, ...d.matches] }));
              setSelectedMatchId(created.id);
              setPage("match");
            }}
          />
        )}
        {page === "bilan" && (
  <SeasonBilan matches={data.matches} />
)}
{page === "player" && (
  <PlayerAnalysis matches={filteredMatches} seasonPlayers={seasonPlayers} />
)}
{page === "team" && (
  <TeamAnalysis matches={data.matches} />
)}
      </main>

      {videoMode && selectedMatch && (
        <VideoTagger matchData={selectedMatch}
          onStatsUpdate={handleVideoStats}
          roster={seasonPlayers}
          onClose={() => setVideoMode(false)} />
      )}
      {liveMode && selectedMatch && (
  <LiveTagger matchData={selectedMatch}
    onStatsUpdate={handleVideoStats}
    onClose={() => setLiveMode(false)} />
)}
      {analysisMatch && (
        <MatchAnalysisModal
          matchId={analysisMatch.id}
          matchLabel={`${analysisMatch.equipeA} vs ${analysisMatch.equipeB}`}
          API_BASE={API_URL}
          onClose={() => setAnalysisMatch(null)} />
      )}
    </div>
  );
}
    

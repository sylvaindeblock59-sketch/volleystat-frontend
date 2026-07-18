import { useState, useRef, useEffect, useCallback } from "react";
import { PLAYERS } from "./data/players";

// ─── Constantes ───────────────────────────────────────────────────────────────
const ACTIONS = [
  {
    groupe: "Service", color: "#3b82f6", bg: "#dbeafe", touches: [
      { key: "1", label: "SG",  desc: "Service Gagnant",   field: "SG"  },
      { key: "2", label: "S+",  desc: "Service +",         field: "S+"  },
      { key: "3", label: "S0",  desc: "Service neutre",    field: "S0"  },
      { key: "4", label: "S−",  desc: "Service faute",     field: "S-"  },
    ]
  },
  {
    groupe: "Réception", color: "#16a34a", bg: "#dcfce7", touches: [
      { key: "q", label: "R++", desc: "Réception parfaite", field: "R++" },
      { key: "w", label: "R+",  desc: "Réception bonne",    field: "R+"  },
      { key: "e", label: "R0",  desc: "Réception neutre",   field: "R0"  },
      { key: "r", label: "R−",  desc: "Réception faute",    field: "R-"  },
    ]
  },
  {
    groupe: "Attaque", color: "#dc2626", bg: "#fee2e2", touches: [
      { key: "a", label: "A+", desc: "Attaque gagnante", field: "A+" },
      { key: "s", label: "A0", desc: "Attaque neutre",   field: "A0" },
      { key: "d", label: "A−", desc: "Attaque faute",    field: "A-" },
    ]
  },
  {
    groupe: "Bloc", color: "#7c3aed", bg: "#ede9fe", touches: [
      { key: "z", label: "B+",  desc: "Bloc gagnant",   field: "B+"   },
      { key: "x", label: "Bd",  desc: "Bloc défensif",  field: "Bdef" },
      { key: "c", label: "B−",  desc: "Bloc faute",     field: "B-"   },
    ]
  },
  {
    groupe: "Passe", color: "#d97706", bg: "#fef3c7", touches: [
      { key: "f", label: "P+", desc: "Passe parfaite", field: "P+" },
      { key: "g", label: "P0", desc: "Passe neutre",   field: "P0" },
      { key: "h", label: "P−", desc: "Passe faute",    field: "P-" },
    ]
  },
  {
    groupe: "Défense", color: "#0891b2", bg: "#cffafe", touches: [
      { key: "v", label: "D+", desc: "Défense réussie", field: "D+" },
      { key: "b", label: "D−", desc: "Défense faute",   field: "D-" },
    ]
  },
];

const ALL_TOUCHES = ACTIONS.flatMap(a => a.touches);
const FIELD_DEFAULTS = () => {
  const o = {};
  ALL_TOUCHES.forEach(t => { o[t.field] = 0; });
  o.PG = 0; o.FD = 0; o.FF = 0; o.errS = 0; o.errA = 0;
  return o;
};

const ROSTER_NAMES = PLAYERS.map(p => `${p.prenom} ${p.nom}`);

// ─── Composant principal ──────────────────────────────────────────────────────
export default function VideoTagger({ matchData, onStatsUpdate, onClose, roster: rosterWithNumbers }) {
  // Roster avec numéros pour l'identification automatique des maillots
  const rosterSource = (rosterWithNumbers && rosterWithNumbers.length > 0) ? rosterWithNumbers : PLAYERS;
  const videoRef   = useRef(null);
  const fileRef    = useRef(null);
  const [videoSrc, setVideoSrc] = useState(null);
  const [videoName, setVideoName] = useState("");
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);

  const [joueuses, setJoueuses] = useState(ROSTER_NAMES);
  const [selectedJoueuse, setSelectedJoueuse] = useState(ROSTER_NAMES[0] || null);

  // ── Formation terrain (6 majeur + libéro) pour tag rapide ────────────────
  const initLib = () => ROSTER_NAMES.find(n => PLAYERS.find(p => `${p.prenom} ${p.nom}` === n)?.poste === "Libéro") || null;
  const [vtOnCourt, setVtOnCourt] = useState(() => { const lib = initLib(); return ROSTER_NAMES.filter(n => n !== lib).slice(0, 6); });
  const [vtLibero,  setVtLibero]  = useState(initLib);
  const [vtBench,   setVtBench]   = useState(() => { const lib = initLib(); return ROSTER_NAMES.filter(n => n !== lib).slice(6); });
  const [selectedSet, setSelectedSet] = useState(1);

  // ── Score live VideoTagger ───────────────────────────────────────────────
  const [vtLiveScore, setVtLiveScore]     = useState({ 1:{us:0,adv:0}, 2:{us:0,adv:0}, 3:{us:0,adv:0}, 4:{us:0,adv:0}, 5:{us:0,adv:0} });
  const [vtScoreHistory, setVtScoreHistory] = useState([]);
  const vtUsScore  = vtLiveScore[selectedSet]?.us  || 0;
  const vtAdvScore = vtLiveScore[selectedSet]?.adv || 0;
  const ourTeam = matchData ? (matchData.equipeA?.toLowerCase().includes("bailleul") ? matchData.equipeA : matchData.equipeB) : "Bailleul";
  const advTeam = matchData ? (matchData.equipeA?.toLowerCase().includes("bailleul") ? matchData.equipeB : matchData.equipeA) : "Adversaire";
  const addVtScore = (team) => {
    setVtLiveScore(prev => ({ ...prev, [selectedSet]: { ...prev[selectedSet], [team]: (prev[selectedSet]?.[team] || 0) + 1 } }));
    setVtScoreHistory(h => [...h, { set: selectedSet, team }]);
  };
  const undoVtScore = () => {
    if (!vtScoreHistory.length) return;
    const last = vtScoreHistory[vtScoreHistory.length - 1];
    setVtLiveScore(prev => ({ ...prev, [last.set]: { ...prev[last.set], [last.team]: Math.max(0, (prev[last.set]?.[last.team] || 0) - 1) } }));
    setVtScoreHistory(h => h.slice(0, -1));
  };

  // ── Erreurs adversaire VideoTagger ──────────────────────────────────────
  const [vtAdvErrors, setVtAdvErrors] = useState({ 1:{s:0,a:0}, 2:{s:0,a:0}, 3:{s:0,a:0}, 4:{s:0,a:0}, 5:{s:0,a:0} });
  const bumpVtAdv = (type, delta) => setVtAdvErrors(prev => ({
    ...prev, [selectedSet]: { ...prev[selectedSet], [type]: Math.max(0, (prev[selectedSet]?.[type] || 0) + delta) }
  }));
  // Volleyball : équipes alternent les côtés à chaque set
  // set 1: gauche, set 2: droite, set 3: gauche, set 4: droite, set 5: droite jusqu'à 8 pts
  const [sidePerSet, setSidePerSet] = useState({ 1:"left", 2:"right", 3:"left", 4:"right", 5:"left" });
  const bailleulSide = sidePerSet[selectedSet] || "left"; // "left" ou "right"
  const toggleSide = () => setSidePerSet(prev => ({ ...prev, [selectedSet]: prev[selectedSet] === "left" ? "right" : "left" }));

  // ── Remplacement joueuses dans VideoTagger ───────────────────────────────
  const [vtSubMode,   setVtSubMode]   = useState(false);
  const [vtPendingIn, setVtPendingIn] = useState(null);

  const handleVtChipClick = (nom) => {
    if (!vtSubMode) { setSelectedJoueuse(nom); return; }
    if (!vtPendingIn) {
      // Première tape : joueuse du banc = celle qui ENTRE
      if (vtBench.includes(nom) || nom === vtLibero) { setVtPendingIn(nom); return; }
      setSelectedJoueuse(nom); return;
    }
    // Deuxième tape : joueuse sur le terrain = celle qui SORT
    const entering = vtPendingIn;
    if (vtOnCourt.includes(nom)) {
      setVtOnCourt(prev => prev.map(p => p === nom ? entering : p));
      if (vtBench.includes(entering)) setVtBench(prev => [...prev.filter(p => p !== entering), nom]);
      else if (entering === vtLibero) { setVtLibero(nom); }
      setSelectedJoueuse(entering);
    } else if (nom === vtLibero) {
      setVtLibero(entering);
      if (vtBench.includes(entering)) setVtBench(prev => [...prev.filter(p => p !== entering), nom]);
    }
    setVtPendingIn(null);
    setVtSubMode(false);
  };

  // ── Changelog / Versions ──────────────────────────────────────────────────
  const [showChangelog, setShowChangelog] = useState(false);
  const CHANGELOG = [
    { version: "3.2", date: "Juil. 2026", changes: ["Terrain cliquable (6 majeur + libéro) dans le VideoTagger", "Layout split-screen tags | vidéo", "Reconnaissance numéros maillot avec côté de jeu", "LiveTagger : score live rouge/bleu, 3 colonnes"] },
    { version: "3.1", date: "Juil. 2026", changes: ["Plans IA 1-6 : tagging → pipeline autonome", "OCR score (Plan 3), Détection COCO-SSD (Plan 4)", "Classification IA (Plan 5), Pipeline (Plan 6)", "Protection données LiveTagger (autosave localStorage)"] },
    { version: "3.0", date: "Juin 2026", changes: ["Multi-saison + roster dynamique par saison", "Import feuille de match FFVB (PDF)", "Analyse joueuse avancée (comparaison, tendances)", "SlyVolleyStat Pro (renommage + signature auteur)"] },
    { version: "2.0", date: "Juin 2026", changes: ["VideoTagger Plans 1-2 (tagging vidéo + détection échanges)", "LiveTagger en direct avec formation", "Édition stats par grille collable Excel"] },
  ];

  const [statsMap, setStatsMap] = useState({});
  const [history, setHistory] = useState([]);
  const [flashKey, setFlashKey] = useState(null);
  const [actionLog, setActionLog] = useState([]);
  const [showLegend, setShowLegend] = useState(false);
  const [autoPause, setAutoPause] = useState(true);

  // ── Responsive layout ────────────────────────────────────────────────────
  const [isNarrow, setIsNarrow]     = useState(typeof window !== "undefined" && window.innerWidth < 960);
  const [sidebarOpen, setSidebarOpen] = useState(false); // masquée par défaut sur tablette

  useEffect(() => {
    const handler = () => {
      const narrow = window.innerWidth < 960;
      setIsNarrow(narrow);
      if (!narrow) setSidebarOpen(true); // toujours ouverte sur PC
    };
    window.addEventListener("resize", handler);
    // Sur PC on ouvre la sidebar au démarrage
    if (window.innerWidth >= 960) setSidebarOpen(true);
    return () => window.removeEventListener("resize", handler);
  }, []);
  const [rallyCount, setRallyCount] = useState(1);

  // ── Détection automatique des échanges ──
  const [videoFile, setVideoFile] = useState(null);
  const [suggestedRallies, setSuggestedRallies] = useState([]); // [{id, start}]
  const [detecting, setDetecting] = useState(false);
  const [detectProgress, setDetectProgress] = useState(0);
  const [detectError, setDetectError] = useState(null);
  const [autoAdvanceRally, setAutoAdvanceRally] = useState(true);
  const [detectThreshold, setDetectThreshold] = useState(0.08);   // % énergie max = seuil silence
  const [minSilenceSec, setMinSilenceSec] = useState(2.5);        // durée min silence (s)
  const [showDetectSettings, setShowDetectSettings] = useState(false);
  const audioCtxRef    = useRef(null);
  const analyserRef    = useRef(null);
  const detectingRef   = useRef(false);  // flag d'annulation
  const lastAutoRallyRef = useRef(0);    // évite les incréments répétés

  // ── Plan 3 — OCR lecture du score ──
  const [scoreZone, setScoreZone]           = useState(null);  // {x,y,w,h} en % du conteneur vidéo
  const [isSelectingZone, setIsSelectingZone] = useState(false);
  const [selectAnchor, setSelectAnchor]     = useState(null);
  const [selectCurrent, setSelectCurrent]   = useState(null);
  const [ocrActive, setOcrActive]           = useState(false);
  const [ocrStatus, setOcrStatus]           = useState("");
  const [invertOcr, setInvertOcr]           = useState(false);
  const [detectedScores, setDetectedScores] = useState([]);
  const [currentScore, setCurrentScore]     = useState(null);
  const [showScorePanel, setShowScorePanel] = useState(false);
  const captureCanvasRef  = useRef(null);
  const ocrWorkerRef      = useRef(null);
  const ocrIntervalRef    = useRef(null);
  const lastScoreRef      = useRef(null);
  const videoContainerRef = useRef(null);

  // ── Plan 4 — Détection joueurs/ballon (COCO-SSD) ──
  const [detectionLoading, setDetectionLoading] = useState(false);
  const [detectionError, setDetectionError]     = useState(null);
  const [detections, setDetections]             = useState([]);     // [{bbox,class,score}]
  const [suggestion, setSuggestion]             = useState(null);   // {playerName, boxIdx}
  const [autoDetect, setAutoDetect]             = useState(false);
  const [playerBoxMap, setPlayerBoxMap]         = useState({});     // {boxIdx: playerName}
  const [showDetection, setShowDetection]       = useState(true);
  const [jerseyReading, setJerseyReading]       = useState(false);  // lecture numéros en cours
  const [jerseyStatus, setJerseyStatus]         = useState("");     // résultat de la lecture
  const detectorRef         = useRef(null);
  const detectionCanvasRef  = useRef(null);
  const autoDetectInterval  = useRef(null);

  // ── Plan 5 — Classification IA des actions (TF.js, entraîné sur tes exports) ──
  const AI_ACTIONS  = ALL_TOUCHES.map(t => t.field);                            // 19 champs
  const NUM_ACTIONS = AI_ACTIONS.length;
  const NUM_PLAYERS = ROSTER_NAMES.length || 15;
  const FEAT_SIZE   = NUM_PLAYERS + 1 + 1 + NUM_ACTIONS;                        // joueur OH + set + rally + prev_action OH

  const [trainingData, setTrainingData]         = useState([]);
  const [modelReady, setModelReady]             = useState(false);
  const [modelTraining, setModelTraining]       = useState(false);
  const [trainAccuracy, setTrainAccuracy]       = useState(null);
  const [trainEpoch, setTrainEpoch]             = useState(0);
  const [actionSuggestions, setActionSuggestions] = useState([]);               // [{field,label,desc,prob}]
  const [showAIPanel, setShowAIPanel]           = useState(false);
  const [lastTaggedField, setLastTaggedField]   = useState(null);               // dernière action taguée dans le rally courant
  const aiModelRef = useRef(null);
  const tfRef      = useRef(null);

  // ── Plan 6 — Pipeline autonome (vidéo → stats auto) ──
  const [pipelineRunning, setPipelineRunning]     = useState(false);
  const [pipelineProgress, setPipelineProgress]   = useState(0);
  const [reviewQueue, setReviewQueue]             = useState([]);   // [{id,time,rally,setNum,player,action,field,confidence,status}]
  const [pipelineStats, setPipelineStats]         = useState(null); // {total,auto,pending,coverage}
  const [autoThreshold, setAutoThreshold]         = useState(0.75); // seuil auto-accept
  const [showPipelinePanel, setShowPipelinePanel] = useState(false);
  const [editingItem, setEditingItem]             = useState(null); // {id,player,field}
  const pipelineAbortRef = useRef(false);

  useEffect(() => {
    if (!matchData) {
      setJoueuses(ROSTER_NAMES);
      if (ROSTER_NAMES.length > 0) setSelectedJoueuse(ROSTER_NAMES[0]);
      return;
    }
    const noms = [...ROSTER_NAMES];
    matchData.sets.forEach(set => {
      set.stats.forEach(ps => {
        if (!noms.includes(ps.nom)) noms.push(ps.nom);
      });
    });
    setJoueuses(noms);
    if (noms.length > 0) setSelectedJoueuse(noms[0]);

    const map = {};
    matchData.sets.forEach(set => {
      set.stats.forEach(ps => {
        const key = `${ps.nom}_set${set.num}`;
        map[key] = { ...FIELD_DEFAULTS(), ...ps };
      });
    });
    setStatsMap(map);
  }, [matchData]);

  const loadVideo = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setVideoFile(file);
    setVideoSrc(URL.createObjectURL(file));
    setVideoName(file.name);
    setActionLog([]);
    setHistory([]);
    setSuggestedRallies([]);
    setDetectError(null);
    setDetectProgress(0);
    lastAutoRallyRef.current = 0;
    // Réinitialise l'AudioContext si on change de vidéo
    if (audioCtxRef.current) {
      audioCtxRef.current.close();
      audioCtxRef.current = null;
      analyserRef.current = null;
    }
  };

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) { v.play(); setPlaying(true); }
    else { v.pause(); setPlaying(false); }
  };

  const seek = (e) => {
    const v = videoRef.current;
    if (!v) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    v.currentTime = ratio * duration;
  };

  const changeRate = (rate) => {
    setPlaybackRate(rate);
    if (videoRef.current) videoRef.current.playbackRate = rate;
  };

  const rewind = (secs) => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = Math.max(0, v.currentTime - secs);
  };

  const formatTime = (t) => {
    const m = Math.floor(t / 60);
    const s = Math.floor(t % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const cyclePlayer = useCallback((reverse) => {
    setSelectedJoueuse(prev => {
      if (joueuses.length === 0) return prev;
      const idx = joueuses.indexOf(prev);
      const nextIdx = reverse
        ? (idx - 1 + joueuses.length) % joueuses.length
        : (idx + 1) % joueuses.length;
      return joueuses[nextIdx];
    });
  }, [joueuses]);

  const tagAction = useCallback((field, label, desc) => {
    if (!selectedJoueuse) return;
    const key = `${selectedJoueuse}_set${selectedSet}`;

    setStatsMap(prev => {
      const current = prev[key] || FIELD_DEFAULTS();
      return { ...prev, [key]: { ...current, [field]: (current[field] || 0) + 1 } };
    });

    const entry = {
      id: Date.now(),
      time: videoRef.current ? videoRef.current.currentTime : 0,
      joueuse: selectedJoueuse,
      set: selectedSet,
      rally: rallyCount,
      field, label, desc, key
    };

    setHistory(h => [...h, entry]);
    setActionLog(l => [entry, ...l.slice(0, 49)]);

    setFlashKey(field);
    setTimeout(() => setFlashKey(null), 300);

    // Plan 5 : mémoriser l'action taguée → mise à jour des suggestions
    setLastTaggedField(field);
    if (modelReady) predictActions(selectedJoueuse, selectedSet, rallyCount, field);

    if (autoPause && videoRef.current && !videoRef.current.paused) {
      videoRef.current.pause();
      setPlaying(false);
      setTimeout(() => {
        if (videoRef.current) { videoRef.current.play(); setPlaying(true); }
      }, 1500);
    }
  }, [selectedJoueuse, selectedSet, autoPause]);

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

      if (e.code === "Space") { e.preventDefault(); togglePlay(); return; }
      if (e.ctrlKey && e.key === "z") { e.preventDefault(); undoLast(); return; }
      if (e.key === "ArrowLeft") { rewind(e.shiftKey ? 1 : 5); return; }
      if (e.key === "ArrowRight") { const v = videoRef.current; if (v) v.currentTime = Math.min(duration, v.currentTime + 5); return; }
      if (e.key === "Tab") { e.preventDefault(); cyclePlayer(e.shiftKey); return; }
      if (e.key === "?") { setShowLegend(s => !s); return; }
      if (e.key === "n" || e.key === "N") { setRallyCount(r => r + 1); return; }

      const action = ALL_TOUCHES.find(t => t.key === e.key.toLowerCase());
      if (action) tagAction(action.field, action.label, action.desc);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [tagAction, undoLast, cyclePlayer]);

  // ── Auto-avancement du compteur de rally lors de la lecture ──
  useEffect(() => {
    if (!autoAdvanceRally || suggestedRallies.length === 0) return;
    // Nombre de frontières dépassées = numéro du rally courant
    const idx = suggestedRallies.filter(r => r.start <= currentTime).length;
    const newRally = Math.max(1, idx);
    if (newRally !== lastAutoRallyRef.current) {
      lastAutoRallyRef.current = newRally;
      setRallyCount(newRally);
    }
  }, [currentTime, suggestedRallies, autoAdvanceRally]);

  // ── Détection automatique des échanges par analyse audio ──
  const detectRallies = async () => {
    const v = videoRef.current;
    if (!v || !videoSrc) return;

    setDetecting(true);
    setDetectProgress(0);
    setDetectError(null);
    setSuggestedRallies([]);
    detectingRef.current = true;

    const savedTime   = v.currentTime;
    const savedRate   = v.playbackRate;
    const savedPlaying = !v.paused;

    try {
      // Crée l'AudioContext + MediaElementSource (une seule fois par vidéo)
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
        const source = audioCtxRef.current.createMediaElementSource(v);
        analyserRef.current  = audioCtxRef.current.createAnalyser();
        analyserRef.current.fftSize = 2048;
        source.connect(analyserRef.current);
        analyserRef.current.connect(audioCtxRef.current.destination);
      }
      if (audioCtxRef.current.state === "suspended") await audioCtxRef.current.resume();

      const analyser = analyserRef.current;
      const bufLen   = analyser.frequencyBinCount;
      const dataArr  = new Float32Array(bufLen);

      v.currentTime = 0;
      v.playbackRate = 4;     // 4x : audio fiable dans tous les navigateurs
      v.muted = false;
      await v.play();
      setPlaying(true);

      const energySamples = [];  // [{time, energy}]
      const realIntervalMs = 200; // 200ms réel = 0.8s vidéo à 4x

      const intervalId = setInterval(() => {
        if (!detectingRef.current) { clearInterval(intervalId); return; }
        analyser.getFloatTimeDomainData(dataArr);
        const rms = Math.sqrt(dataArr.reduce((s, x) => s + x * x, 0) / bufLen);
        energySamples.push({ time: v.currentTime, energy: rms });
        setDetectProgress(Math.min(98, Math.round((v.currentTime / (duration || 1)) * 100)));
      }, realIntervalMs);

      await new Promise((resolve) => {
        const onEnded = () => resolve();
        v.addEventListener("ended", onEnded, { once: true });
        // Sécurité : timeout si la vidéo ne se termine pas (annulation)
        const check = setInterval(() => { if (!detectingRef.current) { clearInterval(check); resolve(); } }, 500);
      });
      clearInterval(intervalId);

      // ── Traitement : détection des silences ──
      if (energySamples.length < 5) throw new Error("Pas assez de données audio. La vidéo a-t-elle une piste audio ?");

      const maxE    = Math.max(...energySamples.map(s => s.energy));
      if (maxE < 0.001) throw new Error("Signal audio trop faible ou absent. Vérifie le son de ta vidéo.");

      const thresh  = detectThreshold * maxE;
      // Nb de fenêtres consécutives pour constituer un silence (à 4x, 200ms réel = 0.8s vidéo)
      const minWins = Math.max(2, Math.ceil(minSilenceSec / (realIntervalMs / 1000 * 4)));

      let silenceCount = 0;
      let inSilence    = false;
      const boundaries = []; // timestamps de début de chaque nouveau rally

      energySamples.forEach((sample) => {
        if (sample.energy < thresh) {
          if (!inSilence) inSilence = true;
          silenceCount++;
        } else {
          if (inSilence && silenceCount >= minWins) {
            boundaries.push(parseFloat(sample.time.toFixed(1)));
          }
          inSilence    = false;
          silenceCount = 0;
        }
      });

      // Rally 1 démarre toujours à t=0, les suivants aux frontières détectées
      const rallies = [{ id: 1, start: 0 }, ...boundaries.map((t, i) => ({ id: i + 2, start: t }))];
      setSuggestedRallies(rallies);
      setDetectProgress(100);
      lastAutoRallyRef.current = 0; // reset pour relancer l'auto-avancement

    } catch (err) {
      setDetectError(err.message || "Erreur inconnue");
    } finally {
      detectingRef.current = false;
      setDetecting(false);
      const v2 = videoRef.current;
      if (v2) {
        v2.pause();
        v2.currentTime = savedTime;
        v2.playbackRate = savedRate;
        setPlaying(false);
      }
    }
  };

  const cancelDetect = () => {
    detectingRef.current = false;
    if (videoRef.current) videoRef.current.pause();
  };

  const removeRally = (id) => setSuggestedRallies(prev => prev.filter(r => r.id !== id));

  const addRallyAt = (time) => {
    setSuggestedRallies(prev => {
      const newList = [...prev, { id: Date.now(), start: parseFloat(time.toFixed(1)) }];
      return newList.sort((a, b) => a.start - b.start).map((r, i) => ({ ...r, id: i + 1 }));
    });
  };

  // ── OCR : sélection de la zone score sur la vidéo ──
  const getRelativePos = (e) => {
    const rect = videoContainerRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height)),
    };
  };

  const onZoneMouseDown = (e) => {
    if (!isSelectingZone) return;
    e.preventDefault();
    const pos = getRelativePos(e);
    setSelectAnchor(pos);
    setSelectCurrent(pos);
  };

  const onZoneMouseMove = (e) => {
    if (!isSelectingZone || !selectAnchor) return;
    setSelectCurrent(getRelativePos(e));
  };

  const onZoneMouseUp = (e) => {
    if (!isSelectingZone || !selectAnchor) return;
    const pos = getRelativePos(e);
    const x = Math.min(selectAnchor.x, pos.x);
    const y = Math.min(selectAnchor.y, pos.y);
    const w = Math.abs(pos.x - selectAnchor.x);
    const h = Math.abs(pos.y - selectAnchor.y);
    if (w > 0.03 && h > 0.02) setScoreZone({ x, y, w, h });
    setSelectAnchor(null);
    setSelectCurrent(null);
    setIsSelectingZone(false);
  };

  // ── OCR : capture + prétraitement de la zone ──
  const captureZoneToCanvas = () => {
    const video  = videoRef.current;
    const canvas = captureCanvasRef.current;
    if (!video || !canvas || !scoreZone) return false;
    const vw = video.videoWidth, vh = video.videoHeight;
    if (!vw || !vh) return false;

    // Zone en % du conteneur → coordonnées intrinsèques de la vidéo
    const sx = scoreZone.x * vw, sy = scoreZone.y * vh;
    const sw = scoreZone.w * vw, sh = scoreZone.h * vh;

    canvas.width  = Math.max(sw * 3, 300);
    canvas.height = Math.max(sh * 3, 80);

    const ctx = canvas.getContext("2d");
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(video, Math.max(0,sx), Math.max(0,sy), Math.min(vw,sw), Math.min(vh,sh), 0, 0, canvas.width, canvas.height);

    // Prétraitement : niveaux de gris + contraste + binarisation
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const d = imgData.data;
    for (let i = 0; i < d.length; i += 4) {
      const gray = 0.299 * d[i] + 0.587 * d[i+1] + 0.114 * d[i+2];
      const boosted = Math.min(255, Math.max(0, (gray - 128) * 2.2 + 128));
      const bin = boosted > 130 ? 255 : 0;
      const val = invertOcr ? 255 - bin : bin;
      d[i] = d[i+1] = d[i+2] = val;
    }
    ctx.putImageData(imgData, 0, 0);
    return true;
  };

  // ── OCR : parsing du résultat Tesseract → deux scores ──
  const parseScore = (text) => {
    const nums = text.replace(/[^0-9\s]/g, " ").trim().match(/\d+/g);
    if (!nums || nums.length < 2) return null;
    const a = parseInt(nums[0]), b = parseInt(nums[1]);
    if (a <= 35 && b <= 35 && a >= 0 && b >= 0) return { scoreA: a, scoreB: b };
    return null;
  };

  // ── OCR : initialisation de Tesseract (lazy, une seule fois) ──
  const initOCR = async () => {
    if (ocrWorkerRef.current) return ocrWorkerRef.current;
    setOcrStatus("Chargement moteur OCR…");
    try {
      const { createWorker } = await import("tesseract.js");
      const worker = await createWorker("eng");
      await worker.setParameters({
        tessedit_char_whitelist: "0123456789",
        tessedit_pageseg_mode: "7",
      });
      ocrWorkerRef.current = worker;
      setOcrStatus("OCR prêt ✓");
      return worker;
    } catch {
      setOcrStatus("⚠ Tesseract.js non installé — lance : npm install tesseract.js");
      return null;
    }
  };

  // ── OCR : un cycle de capture + reconnaissance ──
  const runOCROnce = async () => {
    const worker = ocrWorkerRef.current;
    const canvas = captureCanvasRef.current;
    if (!worker || !canvas) return;
    if (!captureZoneToCanvas()) return;
    try {
      const { data } = await worker.recognize(canvas);
      const raw = data.text.trim();
      const score = parseScore(raw);
      const last = lastScoreRef.current;
      if (score) {
        setOcrStatus(`"${raw}" → ${score.scoreA}–${score.scoreB}`);
        if (!last || score.scoreA !== last.scoreA || score.scoreB !== last.scoreB) {
          const entry = { scoreA: score.scoreA, scoreB: score.scoreB, time: videoRef.current?.currentTime || 0 };
          setDetectedScores(prev => [...prev, entry]);
          setCurrentScore(score);
          lastScoreRef.current = score;
        }
      } else {
        setOcrStatus(`"${raw}" → ?`);
      }
    } catch { /* erreur OCR ponctuelle ignorée */ }
  };

  const startOCR = async () => {
    if (!scoreZone) { setOcrStatus("⚠ Définis d'abord la zone du score."); return; }
    const worker = await initOCR();
    if (!worker) return;
    setOcrActive(true);
    lastScoreRef.current = null;
    ocrIntervalRef.current = setInterval(runOCROnce, 1500);
  };

  const stopOCR = () => {
    clearInterval(ocrIntervalRef.current);
    setOcrActive(false);
    setOcrStatus("OCR arrêté.");
  };

  const exportScoreTimeline = () => {
    if (detectedScores.length === 0) return;
    const rows = [["timestamp_sec","timestamp_fmt","scoreA","scoreB"]];
    detectedScores.forEach(s => rows.push([s.time.toFixed(2), formatTime(s.time), s.scoreA, s.scoreB]));
    const csv = rows.map(r => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `scores_${videoName.replace(/\.[^.]+$/, "")}_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
  };

  // ── Plan 4 : init COCO-SSD (lazy, une fois par session) ──
  const initDetector = async () => {
    if (detectorRef.current) return detectorRef.current;
    setDetectionLoading(true);
    setDetectionError(null);
    try {
      const tf      = await import("@tensorflow/tfjs");
      const cocoSsd = await import("@tensorflow-models/coco-ssd");
      await tf.ready();
      const model = await cocoSsd.load({ base: "lite_mobilenet_v2" });
      detectorRef.current = model;
      return model;
    } catch {
      setDetectionError("⚠ Installe d'abord : npm install @tensorflow/tfjs @tensorflow-models/coco-ssd");
      return null;
    } finally {
      setDetectionLoading(false);
    }
  };

  // ── Plan 4 : dessin des boîtes sur le canvas overlay ──
  const drawDetections = (preds, suggestedIdx) => {
    const canvas = detectionCanvasRef.current;
    const video  = videoRef.current;
    const container = videoContainerRef.current;
    if (!canvas || !video || !container) return;

    const cRect = container.getBoundingClientRect();
    canvas.width  = cRect.width;
    canvas.height = cRect.height;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Calcul du décalage letterbox (object-fit: contain)
    const vw = video.videoWidth, vh = video.videoHeight;
    if (!vw || !vh) return;
    const cAspect = cRect.width / cRect.height;
    const vAspect = vw / vh;
    let renderW = cRect.width, renderH = cRect.height, offX = 0, offY = 0;
    if (cAspect > vAspect) { renderW = cRect.height * vAspect; offX = (cRect.width - renderW) / 2; }
    else                    { renderH = cRect.width / vAspect;  offY = (cRect.height - renderH) / 2; }
    const sx = renderW / vw, sy = renderH / vh;

    let personIdx = 0;
    preds.forEach((pred, i) => {
      const [x, y, w, h] = pred.bbox;
      const rx = offX + x * sx, ry = offY + y * sy, rw = w * sx, rh = h * sy;
      const isBall    = pred.class === "sports ball";
      const isSuggest = i === suggestedIdx;
      const label     = playerBoxMap[i] || (isBall ? "🏐" : `J${++personIdx}`);

      ctx.lineWidth   = isBall ? 3 : isSuggest ? 3 : 2;
      ctx.strokeStyle = isBall ? "#fbbf24" : isSuggest ? "#22c55e" : "rgba(59,130,246,0.8)";
      ctx.strokeRect(rx, ry, rw, rh);

      if (isSuggest) {
        ctx.fillStyle = "rgba(34,197,94,0.15)";
        ctx.fillRect(rx, ry, rw, rh);
      }

      // Étiquette
      const tagW = ctx.measureText(label).width + 10;
      ctx.fillStyle = isBall ? "#fbbf24" : isSuggest ? "#22c55e" : "#3b82f6";
      ctx.fillRect(rx, ry - 18, tagW, 18);
      ctx.fillStyle = "#000";
      ctx.font = "bold 12px monospace";
      ctx.fillText(label, rx + 5, ry - 4);
    });
  };

  // ── Plan 4 : détection d'une frame + suggestion ──
  const detectCurrentFrame = async () => {
    const model = detectorRef.current || await initDetector();
    if (!model || !videoRef.current) return;

    const preds = await model.detect(videoRef.current);
    setDetections(preds);

    const ball    = preds.find(p => p.class === "sports ball");
    const persons = preds.map((p, i) => ({ ...p, origIdx: i })).filter(p => p.class === "person");

    let suggestedIdx = null;
    let suggestedName = null;

    if (ball && persons.length > 0) {
      const bx = ball.bbox[0] + ball.bbox[2] / 2;
      const by = ball.bbox[1] + ball.bbox[3] / 2;
      let minDist = Infinity;
      persons.forEach(p => {
        const px = p.bbox[0] + p.bbox[2] / 2, py = p.bbox[1] + p.bbox[3] / 2;
        const d = Math.hypot(px - bx, py - by);
        if (d < minDist) { minDist = d; suggestedIdx = p.origIdx; }
      });
      suggestedName = playerBoxMap[suggestedIdx] || null;
    } else if (persons.length > 0) {
      // Sans ballon : highlight la personne la plus centrale
      const centerX = (videoRef.current.videoWidth || 1920) / 2;
      let minDist = Infinity;
      persons.forEach(p => {
        const px = p.bbox[0] + p.bbox[2] / 2;
        if (Math.abs(px - centerX) < minDist) { minDist = Math.abs(px - centerX); suggestedIdx = p.origIdx; }
      });
    }

    setSuggestion(suggestedIdx !== null ? { idx: suggestedIdx, name: suggestedName } : null);
    if (suggestedName) setSelectedJoueuse(suggestedName);
    drawDetections(preds, suggestedIdx);
  };

  // ── Plan 4 : auto-detect toutes les 3s ──
  const toggleAutoDetect = async () => {
    if (autoDetect) {
      clearInterval(autoDetectInterval.current);
      setAutoDetect(false);
    } else {
      const model = await initDetector();
      if (!model) return;
      setAutoDetect(true);
      autoDetectInterval.current = setInterval(detectCurrentFrame, 3000);
    }
  };

  // Assigner une joueuse à une boîte détectée
  // ── Plan 4.5 : lecture automatique des numéros de maillot ──
  const readJerseyNumbers = async () => {
    const video  = videoRef.current;
    const canvas = captureCanvasRef.current;
    if (!video || !canvas || detections.length === 0) {
      setJerseyStatus("⚠ Lance d'abord 🎯 Détecter pour repérer les joueuses.");
      return;
    }

    setJerseyReading(true);
    setJerseyStatus(`Scan côté ${bailleulSide === "left" ? "gauche ←" : "droite →"} · Set ${selectedSet}…`);

    // Initialiser Tesseract si pas déjà fait
    let worker = ocrWorkerRef.current;
    if (!worker) {
      worker = await initOCR();
      if (!worker) { setJerseyReading(false); return; }
    }
    // Restreindre aux chiffres uniquement
    await worker.setParameters({ tessedit_char_whitelist: "0123456789", tessedit_pageseg_mode: "8" });

    const vw = video.videoWidth;
    const vh = video.videoHeight;
    const newMap = { ...playerBoxMap };
    let identified = 0;

    const persons = detections.map((d, i) => ({ ...d, origIdx: i })).filter(d => d.class === "person");

    // Filtrer par côté de jeu — Bailleul joue à gauche ou à droite selon le set
    const videoW = videoRef.current?.videoWidth || 1920;
    const sidedPersons = persons.filter(p => {
      const centerX = p.bbox[0] + p.bbox[2] / 2;
      if (bailleulSide === "left")  return centerX < videoW / 2;
      return centerX >= videoW / 2;
    });

    for (const person of sidedPersons) {
      const [bx, by, bw, bh] = person.bbox;
      setJerseyStatus(`Scan ${sidedPersons.indexOf(person) + 1}/${sidedPersons.length} — côté ${bailleulSide === "left" ? "←" : "→"}…`);

      // Différentes zones à tester : milieu-haut (dos), poitrine (avant), centre
      const zones = [
        { sx: bx + bw * 0.15, sy: by + bh * 0.25, sw: bw * 0.70, sh: bh * 0.35 }, // dos/torse milieu
        { sx: bx + bw * 0.20, sy: by + bh * 0.15, sw: bw * 0.60, sh: bh * 0.30 }, // haut du torse
        { sx: bx + bw * 0.10, sy: by + bh * 0.30, sw: bw * 0.80, sh: bh * 0.40 }, // large centre
      ];

      let bestNum = null;
      let bestConf = 0;

      for (const zone of zones) {
        const cx = Math.max(0,  Math.floor(zone.sx));
        const cy = Math.max(0,  Math.floor(zone.sy));
        const cw = Math.min(vw - cx, Math.max(8, Math.floor(zone.sw)));
        const ch = Math.min(vh - cy, Math.max(8, Math.floor(zone.sh)));
        if (cw < 8 || ch < 8) continue;

        // Scale agressif pour Tesseract (min 80px de haut)
        const scale = Math.max(3, Math.ceil(80 / ch));
        canvas.width  = cw * scale;
        canvas.height = ch * scale;

        const ctx = canvas.getContext("2d");
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(video, cx, cy, cw, ch, 0, 0, canvas.width, canvas.height);

        // Tester binarisation normale ET inversée (maillot clair/foncé)
        for (const invert of [false, true]) {
          const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const d = imgData.data;
          // Binarisation adaptative : tester 3 seuils
          for (const threshold of [90, 128, 170]) {
            for (let j = 0; j < d.length; j += 4) {
              const gray = 0.299 * d[j] + 0.587 * d[j+1] + 0.114 * d[j+2];
              const bin  = gray > threshold ? 255 : 0;
              d[j] = d[j+1] = d[j+2] = invert ? 255 - bin : bin;
            }
            ctx.putImageData(imgData, 0, 0);

            try {
              const { data: ocrData } = await worker.recognize(canvas);
              const raw = ocrData.text.replace(/[^0-9]/g, "").trim();
              const num = parseInt(raw);
              if (!isNaN(num) && num >= 1 && num <= 99 && ocrData.confidence > bestConf) {
                // Chercher ce numéro dans le roster
                const match = rosterSource.find(p => p.number === num);
                if (match) {
                  bestNum  = `${match.prenom} ${match.nom}`;
                  bestConf = ocrData.confidence;
                }
              }
            } catch { /* OCR ponctuelle */ }
          }
        }
      }

      if (bestNum) {
        newMap[person.origIdx] = bestNum;
        identified++;
      }
    }

    setPlayerBoxMap(newMap);
    // Redessiner avec les nouveaux labels
    drawDetections(detections, suggestion?.idx ?? null);
    // Remettre les paramètres OCR pour les chiffres du score
    await worker.setParameters({ tessedit_char_whitelist: "0123456789", tessedit_pageseg_mode: "7" });

    const total = persons.length;
    setJerseyStatus(
      identified === 0
        ? `⚠ Aucun numéro lisible — essaie une frame plus nette ou mets la vidéo sur pause sur une action`
        : `✓ ${identified}/${total} identifiée(s) automatiquement`
    );
    setJerseyReading(false);
  };

  const assignPlayerToBox = (boxIdx, playerName) => {
    setPlayerBoxMap(prev => ({ ...prev, [boxIdx]: playerName }));
    if (detections.length > 0) drawDetections(detections, suggestion?.idx ?? null);
  };

  // Cleanup
  useEffect(() => {
    return () => {
      clearInterval(ocrIntervalRef.current);
      clearInterval(autoDetectInterval.current);
      ocrWorkerRef.current?.terminate();
    };
  }, []);

  // ── Plan 5 : encodage des features ──
  const encodeFeature = (joueuse, setNum, rallyNum, prevField) => {
    const playerVec = ROSTER_NAMES.map(n => n === joueuse ? 1 : 0);
    const setNorm   = (Math.min(setNum, 5) - 1) / 4;
    const rallyNorm = Math.min((rallyNum - 1) / 50, 1);
    const prevVec   = AI_ACTIONS.map(f => f === prevField ? 1 : 0);
    return [...playerVec, setNorm, rallyNorm, ...prevVec];
  };

  // ── Plan 5 : chargement des fichiers JSON exports (Plan 1) ──
  const loadTrainingFiles = async (files) => {
    const allActions = [];
    for (const file of Array.from(files)) {
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        if (Array.isArray(data.actions)) allActions.push(...data.actions);
      } catch { /* fichier invalide ignoré */ }
    }
    // Enrichir avec l'action précédente dans le même rally
    const sorted = allActions.sort((a, b) => a.set - b.set || a.rally - b.rally || a.timestamp_sec - b.timestamp_sec);
    const enriched = sorted.map((entry, i) => {
      const prev = sorted.slice(0, i).reverse().find(
        e => e.set === entry.set && e.rally === entry.rally
      );
      return { ...entry, prevField: prev?.field || null };
    });
    setTrainingData(enriched);
    setModelReady(false);
    setActionSuggestions([]);
    return enriched;
  };

  // ── Plan 5 : entraînement du modèle TF.js ──
  const trainAIModel = async () => {
    if (trainingData.length < 30) return;
    setModelTraining(true);
    setTrainEpoch(0);
    setTrainAccuracy(null);
    try {
      if (!tfRef.current) {
        const tf = await import("@tensorflow/tfjs");
        await tf.ready();
        tfRef.current = tf;
      }
      const tf = tfRef.current;

      const valid = trainingData.filter(e =>
        AI_ACTIONS.includes(e.field) && ROSTER_NAMES.includes(e.joueuse)
      );
      if (valid.length < 20) { setModelTraining(false); return; }

      const xs = valid.map(e => encodeFeature(e.joueuse, e.set, e.rally, e.prevField));
      const ys = valid.map(e => AI_ACTIONS.indexOf(e.field));

      const xT = tf.tensor2d(xs);
      const yT = tf.oneHot(tf.tensor1d(ys, "int32"), NUM_ACTIONS);

      const model = tf.sequential({ layers: [
        tf.layers.dense({ inputShape: [FEAT_SIZE], units: 64, activation: "relu" }),
        tf.layers.dropout({ rate: 0.25 }),
        tf.layers.dense({ units: 32, activation: "relu" }),
        tf.layers.dense({ units: NUM_ACTIONS, activation: "softmax" }),
      ]});

      model.compile({ optimizer: tf.train.adam(0.001), loss: "categoricalCrossentropy", metrics: ["accuracy"] });

      await model.fit(xT, yT, {
        epochs: 80, batchSize: 16, validationSplit: 0.15, shuffle: true,
        callbacks: { onEpochEnd: (epoch, logs) => {
          setTrainEpoch(epoch + 1);
          if (logs.val_acc != null) setTrainAccuracy(Math.round(logs.val_acc * 100));
        }}
      });

      aiModelRef.current = model;
      setModelReady(true);
      tf.dispose([xT, yT]);
    } catch (err) { console.error("Erreur entraînement:", err); }
    finally { setModelTraining(false); }
  };

  // ── Plan 5 : prédiction des actions les plus probables ──
  const predictActions = async (joueuse, setNum, rallyNum, prevField) => {
    const model = aiModelRef.current;
    const tf    = tfRef.current;
    if (!model || !tf || !joueuse) { setActionSuggestions([]); return; }
    const feat  = encodeFeature(joueuse, setNum, rallyNum, prevField);
    const inp   = tf.tensor2d([feat]);
    const pred  = model.predict(inp);
    const probs = await pred.data();
    tf.dispose([inp, pred]);
    const sugg = AI_ACTIONS
      .map((field, i) => {
        const t = ALL_TOUCHES.find(tt => tt.field === field);
        return { field, label: t?.label || field, desc: t?.desc || field, prob: probs[i] };
      })
      .sort((a, b) => b.prob - a.prob)
      .slice(0, 4)
      .filter(s => s.prob > 0.04);
    setActionSuggestions(sugg);
  };

  // ── Plan 5 : re-prédire à chaque changement de joueuse ou de rally ──
  useEffect(() => {
    if (modelReady) predictActions(selectedJoueuse, selectedSet, rallyCount, lastTaggedField);
  }, [selectedJoueuse, selectedSet, rallyCount, modelReady]);

  // ── Plan 6 : tag automatique (sans dépendance aux états de tagAction) ──
  const autoTag = (playerName, field, setNum, rallyNum, videoTime) => {
    if (!playerName || !field) return;
    const key   = `${playerName}_set${setNum}`;
    const touch = ALL_TOUCHES.find(t => t.field === field);
    setStatsMap(prev => {
      const cur = prev[key] || FIELD_DEFAULTS();
      return { ...prev, [key]: { ...cur, [field]: (cur[field] || 0) + 1 } };
    });
    const entry = { id: Date.now() + Math.random(), time: videoTime, joueuse: playerName, set: setNum, rally: rallyNum, field, label: touch?.label || field, desc: touch?.desc || field, key };
    setHistory(h => [...h, entry]);
    setActionLog(l => [entry, ...l.slice(0, 49)]);
  };

  // ── Plan 6 : seek vidéo + attendre la frame ──
  const seekAndWait = (time) => new Promise(resolve => {
    const v = videoRef.current;
    if (!v) { resolve(); return; }
    const onSeeked = () => resolve();
    v.addEventListener("seeked", onSeeked, { once: true });
    v.currentTime = time;
    setTimeout(resolve, 600); // fallback si seeked ne déclenche pas
  });

  // ── Plan 6 : pipeline principal ──
  const runPipeline = async () => {
    if (suggestedRallies.length === 0) {
      alert("Lance d'abord la détection des échanges (bouton 🔍 Échanges).");
      return;
    }
    pipelineAbortRef.current = false;
    setPipelineRunning(true);
    setPipelineProgress(0);
    setReviewQueue([]);
    setPipelineStats(null);

    const savedTime = videoRef.current?.currentTime || 0;
    const results   = [];

    for (let i = 0; i < suggestedRallies.length; i++) {
      if (pipelineAbortRef.current) break;

      const rally     = suggestedRallies[i];
      const nextStart = suggestedRallies[i + 1]?.start ?? duration;
      // Analyser à 25% dans le rally (typiquement le moment de l'action principale)
      const analyzeTime = rally.start + Math.min(2.0, (nextStart - rally.start) * 0.25);

      await seekAndWait(analyzeTime);
      await new Promise(r => setTimeout(r, 120));

      // ── P4 : détection joueur/ballon ──
      let suggestedPlayer = null, detConf = 0;
      if (detectorRef.current) {
        try {
          const preds   = await detectorRef.current.detect(videoRef.current);
          const ball    = preds.find(p => p.class === "sports ball");
          const persons = preds.filter(p => p.class === "person");
          if (persons.length > 0) {
            let best = null;
            if (ball) {
              const bx = ball.bbox[0] + ball.bbox[2] / 2, by = ball.bbox[1] + ball.bbox[3] / 2;
              let minD = Infinity;
              persons.forEach(p => {
                const d = Math.hypot(p.bbox[0]+p.bbox[2]/2 - bx, p.bbox[1]+p.bbox[3]/2 - by);
                if (d < minD) { minD = d; best = p; }
              });
            } else {
              best = persons.sort((a, b) => b.score - a.score)[0];
            }
            if (best) {
              suggestedPlayer = playerBoxMap[preds.indexOf(best)] || null;
              detConf = best.score;
            }
          }
        } catch { /* P4 indisponible */ }
      }

      // ── P5 : classification de l'action ──
      let suggestedAction = null, actionConf = 0;
      if (aiModelRef.current && tfRef.current && suggestedPlayer) {
        try {
          const prevField = results.length > 0 ? results[results.length - 1].field : null;
          const feat = encodeFeature(suggestedPlayer, selectedSet, rally.id, prevField);
          const inp  = tfRef.current.tensor2d([feat]);
          const pred = aiModelRef.current.predict(inp);
          const probs = Array.from(await pred.data());
          tfRef.current.dispose([inp, pred]);
          const topIdx = probs.indexOf(Math.max(...probs));
          suggestedAction = ALL_TOUCHES.find(t => t.field === AI_ACTIONS[topIdx]);
          actionConf = probs[topIdx];
        } catch { /* P5 indisponible */ }
      }

      // ── Confiance composite ──
      const confidence = suggestedPlayer && suggestedAction
        ? detConf * 0.35 + actionConf * 0.65
        : suggestedPlayer ? detConf * 0.4 : 0;

      const item = {
        id: `p6_${rally.id}_${i}`,
        time: analyzeTime,
        rally: rally.id,
        setNum: selectedSet,
        player: suggestedPlayer,
        action: suggestedAction,
        field: suggestedAction?.field || null,
        confidence,
        status: "pending",
      };

      if (confidence >= autoThreshold && suggestedPlayer && suggestedAction) {
        item.status = "auto";
        autoTag(suggestedPlayer, suggestedAction.field, selectedSet, rally.id, analyzeTime);
      }

      results.push(item);
      setPipelineProgress(Math.round((i + 1) / suggestedRallies.length * 100));
    }

    if (videoRef.current) videoRef.current.currentTime = savedTime;

    const pending  = results.filter(r => r.status === "pending");
    const autoCount = results.filter(r => r.status === "auto").length;
    setReviewQueue(pending);
    setPipelineStats({
      total:    results.length,
      auto:     autoCount,
      pending:  pending.length,
      coverage: Math.round(autoCount / Math.max(1, results.length) * 100),
    });
    setPipelineRunning(false);
  };

  const cancelPipeline = () => { pipelineAbortRef.current = true; };

  // ── Plan 6 : actions de révision ──
  const acceptReviewItem = (item) => {
    if (item.player && item.field) autoTag(item.player, item.field, item.setNum, item.rally, item.time);
    setReviewQueue(q => q.filter(i => i.id !== item.id));
  };

  const skipReviewItem = (id) => setReviewQueue(q => q.filter(i => i.id !== id));

  const saveEditedItem = () => {
    if (!editingItem) return;
    const { id, player, field, setNum, rally, time } = editingItem;
    if (player && field) autoTag(player, field, setNum, rally, time);
    setReviewQueue(q => q.filter(i => i.id !== id));
    setEditingItem(null);
  };

  const computePGFD = (v) => ({
    PG: (v.SG || 0) + (v["A+"] || 0) + (v["B+"] || 0),
    FD: (v["S-"] || 0) + (v["A-"] || 0) + (v.R0 || 0),
  });

  const saveStats = () => {
    if (!matchData || !onStatsUpdate) return;
    const updates = [];
    Object.entries(statsMap).forEach(([key, stats]) => {
      const parts = key.split("_set");
      if (parts.length !== 2) return;
      const nom = parts[0];
      const setNum = parseInt(parts[1]);
      const { PG, FD } = computePGFD(stats);
      updates.push({ nom, setNum, stats: { ...stats, PG, FD } });
    });
    onStatsUpdate(matchData.id, updates);
  };

  const exportJSON = () => {
    const data = {
      export_date: new Date().toISOString(),
      match: matchData ? `${matchData.equipeA} vs ${matchData.equipeB}` : videoName,
      match_date: matchData?.date || "",
      video_file: videoName,
      total_actions: actionLog.length,
      actions: [...actionLog].reverse().map(e => ({
        timestamp_sec: parseFloat(e.time.toFixed(2)),
        timestamp_fmt: formatTime(e.time),
        set: e.set,
        rally: e.rally,
        joueuse: e.joueuse,
        action: e.label,
        action_desc: e.desc,
        groupe: ACTIONS.find(g => g.touches.some(t => t.field === e.field))?.groupe || "",
        field: e.field,
      })),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `slyvolleystat_${(matchData ? `${matchData.equipeA}_vs_${matchData.equipeB}` : "match").replace(/\s+/g, "_")}_${new Date().toISOString().slice(0,10)}.json`;
    a.click();
  };

  const exportCSV = () => {
    const rows = [["timestamp_sec","timestamp_fmt","set","rally","joueuse","action","action_desc","groupe"]];
    [...actionLog].reverse().forEach(e => {
      rows.push([
        e.time.toFixed(2), formatTime(e.time), e.set, e.rally,
        e.joueuse, e.label, e.desc,
        ACTIONS.find(g => g.touches.some(t => t.field === e.field))?.groupe || "",
      ]);
    });
    const csv = rows.map(r => r.map(v => `"${v}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `slyvolleystat_${(matchData ? `${matchData.equipeA}_vs_${matchData.equipeB}` : "match").replace(/\s+/g, "_")}_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
  };

  const getStatKey = (nom, setNum) => `${nom}_set${setNum}`;
  const currentStats = statsMap[getStatKey(selectedJoueuse, selectedSet)] || FIELD_DEFAULTS();

  const totalJoueuse = {};
  if (selectedJoueuse && matchData) {
    matchData.sets.forEach(set => {
      const k = getStatKey(selectedJoueuse, set.num);
      const s = statsMap[k] || FIELD_DEFAULTS();
      ALL_TOUCHES.forEach(t => {
        totalJoueuse[t.field] = (totalJoueuse[t.field] || 0) + (s[t.field] || 0);
      });
    });
  }

  return (
    <div style={{
      position: "fixed", inset: 0, background: "#0a0f1e", zIndex: 200,
      display: "flex", flexDirection: "column", color: "#e2e8f0",
      fontFamily: "'DM Mono', 'Courier New', monospace"
    }}>
      {/* ── Header responsive ── */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: isNarrow ? "5px 10px" : "8px 16px",
        background: "#0f172a", borderBottom: "1px solid #1e293b", gap: 6, flexShrink: 0, flexWrap: "wrap"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: isNarrow ? 16 : 20 }}>🏐</span>
          {!isNarrow && <span style={{ fontWeight: 700, fontSize: 14, color: "#f8fafc" }}>SlyVolleyStat — Analyse Vidéo</span>}
          {videoName && <span style={{ fontSize: 10, color: "#64748b", background: "#1e293b", padding: "2px 7px", borderRadius: 4, maxWidth: isNarrow ? 120 : 250, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{videoName}</span>}
        </div>
        <div style={{ display: "flex", gap: 5, alignItems: "center", flexWrap: "wrap" }}>
          {/* Plein écran */}
          <button onClick={() => { const e = document.documentElement; e.requestFullscreen?.() || e.webkitRequestFullscreen?.(); }}
            style={{ padding: isNarrow ? "4px 7px" : "6px 10px", borderRadius: 6, border: "1px solid #334155", cursor: "pointer", background: "transparent", color: "#60a5fa", fontSize: isNarrow ? 14 : 13, fontWeight: 700 }} title="Plein écran">⛶</button>
          {/* Toggle sidebar */}
          <button onClick={() => setSidebarOpen(s => !s)}
            style={{ padding: isNarrow ? "4px 8px" : "6px 12px", borderRadius: 6, border: "1px solid #334155", cursor: "pointer", background: sidebarOpen ? "#1e3a8a" : "transparent", color: sidebarOpen ? "#60a5fa" : "#94a3b8", fontSize: isNarrow ? 12 : 11, fontWeight: 700 }}
            title="Afficher/masquer la sidebar">📊{!isNarrow && (sidebarOpen ? " Masquer" : " Afficher")}</button>
          {actionLog.length > 0 && (
            <button onClick={exportCSV} style={{ padding: isNarrow ? "4px 7px" : "6px 12px", borderRadius: 6, border: "1px solid #334155", cursor: "pointer", background: "transparent", color: "#94a3b8", fontSize: isNarrow ? 11 : 12, fontWeight: 600 }}>
              {isNarrow ? "📊" : "📊 CSV"}
            </button>
          )}
          {actionLog.length > 0 && (
            <button onClick={exportJSON} style={{ padding: isNarrow ? "4px 7px" : "6px 12px", borderRadius: 6, border: "1px solid #334155", cursor: "pointer", background: "transparent", color: "#94a3b8", fontSize: isNarrow ? 11 : 12, fontWeight: 600 }}>
              {isNarrow ? "🧠" : "🧠 JSON"}
            </button>
          )}
          <label style={{ padding: isNarrow ? "4px 7px" : "6px 12px", borderRadius: 6, border: "1px solid #a78bfa60", cursor: "pointer", background: modelReady ? "#7c3aed30" : "transparent", color: modelReady ? "#a78bfa" : "#64748b", fontSize: isNarrow ? 11 : 12, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 4 }}>
            {modelReady ? `🧠${isNarrow ? "" : ` IA (${trainAccuracy ?? "?"}%)`}` : isNarrow ? "📂" : `📂 ${trainingData.length > 0 ? trainingData.length + " actions" : "Données IA"}`}
            <input type="file" accept=".json" multiple style={{ display: "none" }} onChange={async e => { await loadTrainingFiles(e.target.files); e.target.value = ""; }} />
          </label>
          {trainingData.length >= 30 && !modelReady && (
            <button onClick={trainAIModel} disabled={modelTraining} style={{ padding: isNarrow ? "4px 7px" : "6px 12px", borderRadius: 6, border: "none", cursor: "pointer", background: modelTraining ? "#1e293b" : "#7c3aed", color: "white", fontSize: isNarrow ? 11 : 12, fontWeight: 600 }}>
              {modelTraining ? `⚙ ${trainEpoch}/80` : "⚡ IA"}
            </button>
          )}
          <button onClick={() => setShowChangelog(s => !s)} style={{ padding: isNarrow ? "4px 7px" : "6px 10px", borderRadius: 6, border: "1px solid #334155", cursor: "pointer", background: showChangelog ? "#1e3a8a" : "transparent", color: showChangelog ? "#60a5fa" : "#64748b", fontSize: isNarrow ? 11 : 11, fontWeight: 600 }} title="Versions et nouveautés">v3.2</button>
          <button onClick={() => setShowLegend(s => !s)} style={{ padding: isNarrow ? "4px 7px" : "6px 12px", borderRadius: 6, border: "1px solid #334155", cursor: "pointer", background: showLegend ? "#3b82f6" : "transparent", color: showLegend ? "white" : "#94a3b8", fontSize: isNarrow ? 12 : 12, fontWeight: 600 }}>
            📖
          </button>
          {matchData && (
            <button onClick={() => { saveStats(); onClose(); }} style={{ padding: isNarrow ? "4px 8px" : "6px 12px", borderRadius: 6, border: "none", cursor: "pointer", background: "#16a34a", color: "white", fontSize: isNarrow ? 11 : 12, fontWeight: 600 }}>
              ✓{isNarrow ? "" : " Sauvegarder"}
            </button>
          )}
          <button onClick={onClose} style={{ padding: isNarrow ? "4px 7px" : "6px 10px", borderRadius: 6, border: "1px solid #334155", cursor: "pointer", background: "transparent", color: "#94a3b8", fontSize: 12 }}>✕</button>
        </div>
      </div>

      {/* ── Modal Changelog ── */}
      {showChangelog && (
        <div style={{ position: "absolute", top: 48, right: 16, background: "#0f172a", border: "1px solid #1e293b", borderRadius: 10, padding: 16, zIndex: 50, width: 320, boxShadow: "0 8px 32px rgba(0,0,0,0.5)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <span style={{ fontWeight: 700, fontSize: 13, color: "#f8fafc" }}>🏐 SlyVolleyStat Pro — Versions</span>
            <button onClick={() => setShowChangelog(false)} style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer", fontSize: 14 }}>✕</button>
          </div>
          {CHANGELOG.map(v => (
            <div key={v.version} style={{ marginBottom: 12, paddingBottom: 12, borderBottom: "1px solid #1e293b" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <span style={{ fontWeight: 700, fontSize: 12, color: "#3b82f6" }}>v{v.version}</span>
                <span style={{ fontSize: 10, color: "#64748b" }}>{v.date}</span>
              </div>
              {v.changes.map((c, i) => (
                <div key={i} style={{ fontSize: 11, color: "#94a3b8", lineHeight: 1.5 }}>· {c}</div>
              ))}
            </div>
          ))}
          <p style={{ fontSize: 10, color: "#334155", margin: 0 }}>Deblock Sylvain — Entraîneur VBC Bailleulois</p>
        </div>
      )}

      {/* ── Layout split : Tags | Vidéo | Sidebar ── */}
      <div style={{
        flex: 1,
        display: "flex",
        flexDirection: isNarrow ? "column" : "row",
        overflow: "hidden"
      }}>

        {/* ── GAUCHE : Tags (Rally + Terrain + Actions) ── */}
        <div style={{
          width: isNarrow ? "100%" : 290,
          flexShrink: 0,
          display: "flex", flexDirection: "column",
          borderRight: isNarrow ? "none" : "1px solid #1e293b",
          borderBottom: isNarrow ? "1px solid #1e293b" : "none",
          overflow: "auto",
          padding: "6px 8px 6px 16px",
          gap: 6,
          background: "#0a0f1e",
        }}>
          {/* ── RALLY + TERRAIN côte à côte — toujours visible ── */}
          <div style={{ display: "flex", gap: 8, alignItems: "stretch" }}>

            {/* Rally colonne gauche */}
            <div style={{ display: "flex", flexDirection: "column", gap: 4, width: 90, background: "#0f172a", borderRadius: 8, padding: "5px 6px", border: `1px solid ${suggestedRallies.length > 0 ? "#fbbf2440" : "#1e293b"}`, flexShrink: 0, alignItems: "center" }}>
              <span style={{ fontSize: 8, fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>Rally</span>
              <span style={{ fontSize: 22, fontWeight: 900, color: "#fbbf24", lineHeight: 1 }}>{rallyCount}</span>
              {suggestedRallies.length > 0 && autoAdvanceRally && <span style={{ fontSize: 8, color: "#fbbf2480", fontStyle: "italic" }}>auto</span>}
              <button onClick={() => { setRallyCount(r => r + 1); lastAutoRallyRef.current = rallyCount + 1; }} style={{ ...btnStyle, background: "#fbbf2420", color: "#fbbf24", border: "1px solid #fbbf2440", padding: "4px 8px", fontSize: 10, width: "100%", justifyContent: "center" }}>+ Pt [N]</button>
              <div style={{ display: "flex", gap: 3, width: "100%" }}>
                <button onClick={() => setRallyCount(r => Math.max(1, r - 1))} style={{ ...btnStyle, padding: "3px 6px", opacity: rallyCount <= 1 ? 0.3 : 1, flex: 1, justifyContent: "center" }}>−</button>
                <button onClick={() => { if(window.confirm("Reset?")) { setRallyCount(1); lastAutoRallyRef.current = 0; } }} style={{ ...btnStyle, padding: "3px 5px", fontSize: 9, color: "#64748b", flex: 1, justifyContent: "center" }}>R</button>
              </div>
            </div>

            {/* Terrain (centre flexible) avec Set+Undo intégrés en bas */}
            <div style={{ flex: 1, background: "#0f172a", border: "1px solid #1e293b", borderRadius: 8, overflow: "hidden" }}>
              <div style={{ textAlign: "center", fontSize: 8, color: "#3b82f6", fontWeight: 700, padding: "1px 0", background: "#1e293b", letterSpacing: "0.3em", display: "flex", alignItems: "center", justifyContent: "space-between", paddingLeft: 6, paddingRight: 4 }}>
                <span>─ NET ─</span>
                <button onClick={() => { setVtSubMode(s => !s); setVtPendingIn(null); }} style={{ padding: "1px 6px", borderRadius: 4, border: `1px solid ${vtSubMode ? "#f59e0b" : "#334155"}`, background: vtSubMode ? "#f59e0b" : "transparent", color: vtSubMode ? "#0a0f1e" : "#64748b", fontSize: 9, fontWeight: 700, cursor: "pointer" }}>
                  🔄{vtSubMode ? " EN COURS" : ""}
                </button>
              </div>
              {vtSubMode && vtPendingIn && <div style={{ fontSize: 8, color: "#fbbf24", background: "#78350f", padding: "2px 6px", textAlign: "center" }}>Tape la joueuse qui sort → {vtPendingIn.split(" ")[0]}</div>}
              {/* Rangée avant */}
              <div style={{ display: "flex", gap: 3, padding: "3px 4px" }}>
                {vtOnCourt.slice(0, 3).map(nom => {
                  const p = PLAYERS.find(pl => `${pl.prenom} ${pl.nom}` === nom);
                  const sel = selectedJoueuse === nom;
                  return (
                    <button key={nom} onClick={() => handleVtChipClick(nom)} style={{ flex: 1, padding: "7px 3px", borderRadius: 7, cursor: "pointer", textAlign: "center", border: `2px solid ${vtPendingIn === nom ? "#f59e0b" : sel ? "#3b82f6" : "#1e293b"}`, background: vtPendingIn === nom ? "#78350f" : sel ? "#1e3a8a" : "#0f172a", WebkitTapHighlightColor: "transparent" }}>
                      <div style={{ fontSize: 17, fontWeight: 900, color: sel ? "#60a5fa" : "#64748b", lineHeight: 1 }}>#{p?.number || "?"}</div>
                      <div style={{ fontSize: 9, color: sel ? "#bfdbfe" : "#475569", lineHeight: 1.3 }}>{p ? `${p.prenom[0]}. ${p.nom}` : nom}</div>
                    </button>
                  );
                })}
              </div>
              {/* Rangée arrière */}
              <div style={{ display: "flex", gap: 3, padding: "0 4px 3px" }}>
                {vtOnCourt.slice(3, 6).map(nom => {
                  const p = PLAYERS.find(pl => `${pl.prenom} ${pl.nom}` === nom);
                  const sel = selectedJoueuse === nom;
                  return (
                    <button key={nom} onClick={() => handleVtChipClick(nom)} style={{ flex: 1, padding: "7px 3px", borderRadius: 7, cursor: "pointer", textAlign: "center", border: `2px solid ${vtPendingIn === nom ? "#f59e0b" : sel ? "#3b82f6" : "#1e293b"}`, background: vtPendingIn === nom ? "#78350f" : sel ? "#1e3a8a" : "#0f172a", WebkitTapHighlightColor: "transparent" }}>
                      <div style={{ fontSize: 17, fontWeight: 900, color: sel ? "#60a5fa" : "#64748b", lineHeight: 1 }}>#{p?.number || "?"}</div>
                      <div style={{ fontSize: 9, color: sel ? "#bfdbfe" : "#475569", lineHeight: 1.3 }}>{p ? `${p.prenom[0]}. ${p.nom}` : nom}</div>
                    </button>
                  );
                })}
              </div>
              {/* Libéro + Banc + Set + Undo en bas */}
              <div style={{ display: "flex", gap: 3, padding: "2px 4px 4px", alignItems: "center", flexWrap: "wrap", borderTop: "1px solid #0a0f1e" }}>
                {vtLibero && (() => {
                  const p = PLAYERS.find(pl => `${pl.prenom} ${pl.nom}` === vtLibero);
                  const sel = selectedJoueuse === vtLibero;
                  return (
                    <button onClick={() => handleVtChipClick(vtLibero)} style={{ padding: "3px 7px", borderRadius: 5, cursor: "pointer", display: "flex", alignItems: "center", gap: 4, border: `2px solid ${sel ? "#22c55e" : "#14532d"}`, background: sel ? "#166534" : "#0f2010", WebkitTapHighlightColor: "transparent", flexShrink: 0 }}>
                      <span style={{ fontSize: 8, color: "#22c55e", fontWeight: 700 }}>LIB</span>
                      <span style={{ fontSize: 11, fontWeight: 900, color: sel ? "#86efac" : "#22c55e" }}>#{p?.number}</span>
                      <span style={{ fontSize: 8, color: sel ? "#bbf7d0" : "#4ade80" }}>{p ? `${p.prenom[0]}. ${p.nom}` : ""}</span>
                    </button>
                  );
                })()}
                {vtBench.map(nom => {
                  const p = PLAYERS.find(pl => `${pl.prenom} ${pl.nom}` === nom);
                  const sel = selectedJoueuse === nom;
                  return (
                    <button key={nom} onClick={() => handleVtChipClick(nom)} style={{ padding: "3px 6px", borderRadius: 5, cursor: "pointer", fontSize: 9, fontWeight: 600, border: `1px solid ${sel ? "#3b82f6" : "#1e293b"}`, background: sel ? "#1e3a8a" : "#0f172a", color: sel ? "#93c5fd" : "#64748b", flexShrink: 0 }}>
                      #{p?.number} {p?.prenom || nom.split(" ")[0]}
                    </button>
                  );
                })}
                {/* Set + Undo intégrés à droite */}
                <div style={{ marginLeft: "auto", display: "flex", gap: 4, alignItems: "center", flexShrink: 0 }}>
                  {/* Toggle côté de jeu */}
                  <button onClick={toggleSide} title={`Bailleul joue côté ${bailleulSide === "left" ? "gauche ← (cliquer pour passer à droite)" : "droit → (cliquer pour passer à gauche)"}`}
                    style={{ padding: "3px 8px", borderRadius: 5, border: `1px solid ${bailleulSide === "left" ? "#3b82f6" : "#f97316"}`, background: "transparent", color: bailleulSide === "left" ? "#3b82f6" : "#f97316", fontSize: 10, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}>
                    {bailleulSide === "left" ? "← Bailleul" : "Bailleul →"}
                  </button>
                  <span style={{ fontSize: 9, color: "#475569" }}>{actionLog.filter(e => e.set === selectedSet).length} tags</span>
                  <select value={selectedSet} onChange={e => setSelectedSet(Number(e.target.value))} style={{ ...inputStyle, padding: "3px 6px", fontSize: 11, width: 68 }}>
                    {(matchData?.sets || [{num:1},{num:2},{num:3},{num:4},{num:5}]).map(s => (
                      <option key={s.num} value={s.num}>Set {s.num}</option>
                    ))}
                  </select>
                  <button onClick={undoLast} disabled={history.length === 0} style={{ ...btnStyle, background: "#7c3aed", opacity: history.length === 0 ? 0.4 : 1, padding: "4px 8px", fontSize: 11 }}>↩</button>
                </div>
              </div>
            </div>
          </div>
          {/* ── Plan 5 : barre de suggestions IA ── */}
          {modelReady && actionSuggestions.length > 0 && (
            <div style={{ background: "#0f172a", border: "1px solid #7c3aed60", borderRadius: 8, padding: "8px 12px" }}>
              <div style={{ fontSize: 10, color: "#7c3aed", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6 }}>
                🧠 Suggestions IA — clique pour tagger directement
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {actionSuggestions.map((s, i) => {
                  const group = ACTIONS.find(g => g.touches.some(t => t.field === s.field));
                  const conf  = Math.round(s.prob * 100);
                  return (
                    <button key={s.field} onClick={() => tagAction(s.field, s.label, s.desc)}
                      style={{
                        padding: "6px 12px", borderRadius: 6, cursor: "pointer", border: `1px solid ${group?.color || "#7c3aed"}60`,
                        background: i === 0 ? (group?.color || "#7c3aed") : `${group?.color || "#7c3aed"}20`,
                        color: i === 0 ? "#fff" : (group?.color || "#a78bfa"),
                        fontSize: 12, fontWeight: 700, display: "flex", flexDirection: "column", alignItems: "center", gap: 1,
                        boxShadow: i === 0 ? `0 0 12px ${group?.color || "#7c3aed"}60` : "none",
                      }}>
                      <span>{s.label}</span>
                      <span style={{ fontSize: 9, opacity: 0.8 }}>{conf}%</span>
                    </button>
                  );
                })}
                <span style={{ fontSize: 10, color: "#334155", alignSelf: "center", marginLeft: "auto" }}>
                  {trainingData.length} actions · {trainAccuracy}% val.
                </span>
              </div>
            </div>
          )}

          {/* ── Score live + Erreurs ADV ── */}
          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            {/* Score */}
            <div style={{ display: "flex", alignItems: "center", gap: 3, background: "#0f172a", borderRadius: 7, padding: "3px 5px", border: "1px solid #1e293b" }}>
              <button onClick={() => addVtScore("us")} style={{ padding: "3px 7px", borderRadius: 5, background: "#450a0a", border: "1px solid #7f1d1d", color: "#ef4444", fontSize: 10, fontWeight: 800, cursor: "pointer", WebkitTapHighlightColor: "transparent" }}>+1</button>
              <span style={{ fontSize: 8, color: "#fca5a5", fontWeight: 700, flex: 1, textAlign: "right", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ourTeam}</span>
              <span style={{ fontSize: 20, fontWeight: 900, color: "#ef4444", lineHeight: 1 }}>{vtUsScore}</span>
              <span style={{ fontSize: 11, color: "#334155", fontWeight: 700, padding: "0 2px" }}>–</span>
              <span style={{ fontSize: 20, fontWeight: 900, color: "#3b82f6", lineHeight: 1 }}>{vtAdvScore}</span>
              <span style={{ fontSize: 8, color: "#93c5fd", fontWeight: 700, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{advTeam}</span>
              <button onClick={() => addVtScore("adv")} style={{ padding: "3px 7px", borderRadius: 5, background: "#0c1a3a", border: "1px solid #1e3a8a", color: "#3b82f6", fontSize: 10, fontWeight: 800, cursor: "pointer", WebkitTapHighlightColor: "transparent" }}>+1</button>
              <button onClick={undoVtScore} disabled={!vtScoreHistory.length} style={{ padding: "2px 4px", borderRadius: 4, border: "1px solid #334155", background: "transparent", color: vtScoreHistory.length ? "#f59e0b" : "#334155", fontSize: 10, cursor: "pointer" }}>↩</button>
            </div>
            {/* Erreurs ADV */}
            <div style={{ display: "flex", alignItems: "center", gap: 6, background: "#0f172a", borderRadius: 7, padding: "3px 8px", border: "1px solid #334155" }}>
              <span style={{ fontSize: 8, color: "#64748b", fontWeight: 700, textTransform: "uppercase", flexShrink: 0 }}>ADV</span>
              {[{label:"Srv−",key:"s",color:"#ef4444"},{label:"Att−",key:"a",color:"#f97316"}].map(e => (
                <div key={e.key} style={{ display: "flex", alignItems: "center", gap: 3, flex: 1 }}>
                  <span style={{ fontSize: 8, color: e.color, fontWeight: 700 }}>{e.label}</span>
                  <button onClick={() => bumpVtAdv(e.key, -1)} style={{ width: 18, height: 18, borderRadius: 4, background: "#1e293b", border: "none", color: "#94a3b8", fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>−</button>
                  <span style={{ fontSize: 15, fontWeight: 900, color: e.color, minWidth: 18, textAlign: "center" }}>{vtAdvErrors[selectedSet]?.[e.key] || 0}</span>
                  <button onClick={() => bumpVtAdv(e.key, 1)} style={{ width: 18, height: 18, borderRadius: 4, background: `${e.color}20`, border: `1px solid ${e.color}50`, color: e.color, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>+</button>
                </div>
              ))}
            </div>
          </div>

          {/* ── Boutons de tag ── */}
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {ACTIONS.map(group => {
              // Abréviations pour gagner de la place sur la ligne
              const abbr = { "Service":"SRV","Réception":"REC","Attaque":"ATT","Bloc":"BLC","Passe":"PAS","Défense":"DEF" };
              return (
                <div key={group.groupe} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  {/* Label abrégé sur la gauche */}
                  <span style={{ fontSize: 8, fontWeight: 800, color: group.color, width: 28, textTransform: "uppercase", letterSpacing: "0.04em", flexShrink: 0, textAlign: "right", opacity: 0.9 }}>
                    {abbr[group.groupe] || group.groupe.slice(0,3)}
                  </span>
                  {/* Tous les boutons sur la même ligne, no wrap */}
                  <div style={{ display: "flex", gap: 3, flex: 1, flexWrap: "nowrap" }}>
                    {group.touches.map(t => (
                      <button key={t.key} onClick={() => tagAction(t.field, t.label, t.desc)}
                        title={`${t.desc} [${t.key}]`}
                        style={{
                          flex: 1,
                          padding: "6px 2px",
                          borderRadius: 6, border: `1px solid ${group.color}40`,
                          cursor: "pointer", background: flashKey === t.field ? group.color : group.bg,
                          color: flashKey === t.field ? "white" : group.color,
                          fontSize: 11, fontWeight: 800, textAlign: "center",
                          transition: "all 0.1s", transform: flashKey === t.field ? "scale(1.08)" : "scale(1)",
                          WebkitTapHighlightColor: "transparent", whiteSpace: "nowrap",
                        }}>
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {showLegend && (
            <div style={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 8, padding: 14, display: "flex", flexDirection: "column", gap: 8 }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.07em", margin: 0 }}>
                Lexique des raccourcis
              </p>
              {ACTIONS.map(group => (
                <div key={group.groupe} style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: group.color, width: 78, flexShrink: 0 }}>{group.groupe}</span>
                  {group.touches.map(t => (
                    <span key={t.key} style={{ fontSize: 12, color: "#cbd5e1" }}>
                      <strong style={{ color: group.color }}>[{t.key}]</strong> {t.label} = {t.desc}
                    </span>
                  ))}
                </div>
              ))}
              <p style={{ fontSize: 11, color: "#64748b", marginTop: 4 }}>
                Espace = play/pause · ← = -5s · Shift+← = -1s · → = +5s · Ctrl+Z = annuler · Tab = joueuse suivante · N = nouveau rally · ? = légende
              </p>
            </div>
          )}
        </div>

        {/* ── CENTRE : Vidéo + Contrôles ── */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "8px 10px", gap: 8, overflow: "hidden", minWidth: 0 }}>

          <div ref={videoContainerRef} style={{
            flex: "1 1 auto", minHeight: 240, background: "#000", borderRadius: 10,
            display: "flex", alignItems: "center", justifyContent: "center",
            position: "relative", overflow: "hidden",
            border: "1px solid #1e293b",
            cursor: isSelectingZone ? "crosshair" : "default",
          }}
            onMouseDown={onZoneMouseDown}
            onMouseMove={onZoneMouseMove}
            onMouseUp={onZoneMouseUp}
          >
            {!videoSrc ? (
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>🎬</div>
                <p style={{ color: "#64748b", fontSize: 14, marginBottom: 16 }}>
                  Chargez la vidéo de votre match
                </p>
                <button onClick={() => fileRef.current?.click()} style={{
                  padding: "10px 24px", borderRadius: 8, border: "none", cursor: "pointer",
                  background: "#3b82f6", color: "white", fontSize: 13, fontWeight: 600
                }}>
                  📂 Choisir la vidéo (.mp4)
                </button>
                <input ref={fileRef} type="file" accept="video/*" style={{ display: "none" }} onChange={loadVideo} />
              </div>
            ) : (
              <>
                <video
                  ref={videoRef}
                  src={videoSrc}
                  style={{ width: "100%", height: "100%", objectFit: "contain" }}
                  onTimeUpdate={e => setCurrentTime(e.target.currentTime)}
                  onLoadedMetadata={e => setDuration(e.target.duration)}
                  onEnded={() => setPlaying(false)}
                />
                {/* Overlay play button */}
                {!playing && !isSelectingZone && (
                  <div onClick={togglePlay} style={{
                    position: "absolute", inset: 0, display: "flex",
                    alignItems: "center", justifyContent: "center",
                    background: "rgba(0,0,0,0.3)", cursor: "pointer"
                  }}>
                    <div style={{
                      width: 60, height: 60, borderRadius: "50%",
                      background: "rgba(59,130,246,0.9)", display: "flex",
                      alignItems: "center", justifyContent: "center", fontSize: 24
                    }}>▶</div>
                  </div>
                )}
                {/* Canvas overlay détection IA */}
                {showDetection && (
                  <canvas ref={detectionCanvasRef} style={{
                    position: "absolute", inset: 0, width: "100%", height: "100%",
                    pointerEvents: "none", zIndex: 3,
                  }} />
                )}
                {/* Zone score sélectionnée */}
                {scoreZone && (
                  <div style={{
                    position: "absolute",
                    left:   `${scoreZone.x * 100}%`,
                    top:    `${scoreZone.y * 100}%`,
                    width:  `${scoreZone.w * 100}%`,
                    height: `${scoreZone.h * 100}%`,
                    border: `2px solid ${ocrActive ? "#22c55e" : "#f59e0b"}`,
                    background: ocrActive ? "rgba(34,197,94,0.10)" : "rgba(245,158,11,0.10)",
                    borderRadius: 4, pointerEvents: "none",
                  }}>
                    <span style={{ position: "absolute", top: -18, left: 0, fontSize: 10, fontWeight: 700, color: ocrActive ? "#22c55e" : "#f59e0b", whiteSpace: "nowrap", background: "rgba(0,0,0,0.7)", padding: "1px 4px", borderRadius: 3 }}>
                      {ocrActive ? `Score: ${currentScore ? `${currentScore.scoreA}–${currentScore.scoreB}` : "lecture…"}` : "Zone score"}
                    </span>
                  </div>
                )}
                {/* Rectangle de sélection en cours */}
                {isSelectingZone && selectAnchor && selectCurrent && (
                  <div style={{
                    position: "absolute",
                    left:   `${Math.min(selectAnchor.x, selectCurrent.x) * 100}%`,
                    top:    `${Math.min(selectAnchor.y, selectCurrent.y) * 100}%`,
                    width:  `${Math.abs(selectCurrent.x - selectAnchor.x) * 100}%`,
                    height: `${Math.abs(selectCurrent.y - selectAnchor.y) * 100}%`,
                    border: "2px dashed #f59e0b", background: "rgba(245,158,11,0.15)",
                    borderRadius: 4, pointerEvents: "none",
                  }} />
                )}
                {/* Message mode sélection */}
                {isSelectingZone && (
                  <div style={{ position: "absolute", top: 10, left: 0, right: 0, textAlign: "center", pointerEvents: "none" }}>
                    <span style={{ background: "rgba(245,158,11,0.9)", color: "#000", fontSize: 12, fontWeight: 700, padding: "4px 12px", borderRadius: 6 }}>
                      ✏ Clique et glisse sur le tableau de score
                    </span>
                  </div>
                )}
              </>
            )}
          </div>
          {/* Canvas caché pour la capture OCR */}
          <canvas ref={captureCanvasRef} style={{ display: "none" }} />

          {videoSrc && (
            <div>
              {/* Barre de progression de la détection */}
              {detecting && (
                <div style={{ marginBottom: 6, display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ flex: 1, height: 4, background: "#1e293b", borderRadius: 2 }}>
                    <div style={{ width: `${detectProgress}%`, height: "100%", background: "#fbbf24", borderRadius: 2, transition: "width 0.3s" }} />
                  </div>
                  <span style={{ fontSize: 11, color: "#fbbf24", whiteSpace: "nowrap" }}>Analyse… {detectProgress}%</span>
                  <button onClick={cancelDetect} style={{ ...btnStyle, padding: "3px 8px", fontSize: 10, color: "#ef4444", borderColor: "#ef444440" }}>✕ Annuler</button>
                </div>
              )}
              {detectError && (
                <div style={{ fontSize: 11, color: "#ef4444", background: "#7f1d1d30", padding: "6px 10px", borderRadius: 6, marginBottom: 6 }}>
                  ⚠ {detectError}
                </div>
              )}

              {/* Timeline principale */}
              <div onClick={seek} style={{
                width: "100%", height: 8, background: "#1e293b",
                borderRadius: 4, cursor: "pointer", position: "relative", marginBottom: 2
              }}>
                {/* Progression */}
                <div style={{
                  width: `${duration ? (currentTime / duration) * 100 : 0}%`,
                  height: "100%", background: "#3b82f6", borderRadius: 4,
                  transition: "width 0.1s"
                }} />
                {/* Zones de rally détectées (fond jaune semi-transparent) */}
                {duration > 0 && suggestedRallies.map((r, i) => {
                  const nextStart = suggestedRallies[i + 1]?.start ?? duration;
                  const left  = (r.start / duration) * 100;
                  const width = ((nextStart - r.start) / duration) * 100;
                  const isActive = rallyCount === r.id;
                  return (
                    <div key={r.id} title={`Rally ${r.id} — ${formatTime(r.start)}`} style={{
                      position: "absolute", top: 0, left: `${left}%`, width: `${width}%`,
                      height: "100%", background: isActive ? "rgba(251,191,36,0.25)" : "rgba(251,191,36,0.08)",
                      borderLeft: `2px solid ${isActive ? "#fbbf24" : "#fbbf2460"}`,
                      cursor: "pointer", zIndex: 1,
                    }} onClick={e => { e.stopPropagation(); if (videoRef.current) videoRef.current.currentTime = r.start; }} />
                  );
                })}
                {/* Marqueurs d'actions (traits colorés) */}
                {duration > 0 && actionLog.map(entry => {
                  const group = ACTIONS.find(g => g.touches.some(t => t.field === entry.field));
                  return (
                    <div key={entry.id} title={`${entry.label} — ${entry.joueuse} (${formatTime(entry.time)})`} style={{
                      position: "absolute", top: -4, width: 2, height: 16,
                      background: group?.color || "#94a3b8", borderRadius: 1, zIndex: 2,
                      left: `${(entry.time / duration) * 100}%`, transform: "translateX(-50%)",
                      cursor: "pointer", opacity: 0.9,
                    }} onClick={e => { e.stopPropagation(); if (videoRef.current) videoRef.current.currentTime = entry.time; }} />
                  );
                })}
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#64748b", marginTop: 2 }}>
                <span>{formatTime(currentTime)}</span>
                <span style={{ color: "#94a3b8" }}>
                  {suggestedRallies.length > 0 && <span style={{ color: "#fbbf24", marginRight: 8 }}>🏐 {suggestedRallies.length} échanges détectés</span>}
                  {actionLog.length} actions taguées
                </span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>
          )}

          {videoSrc && (<>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <button onClick={() => rewind(10)} style={btnStyle}>⏪ 10s</button>
              <button onClick={() => rewind(5)} style={btnStyle}>⏪ 5s</button>
              <button onClick={togglePlay} style={{ ...btnStyle, background: "#3b82f6", minWidth: 70 }}>
                {playing ? "⏸ Pause" : "▶ Play"}
              </button>
              <div style={{ display: "flex", gap: 4, marginLeft: 8 }}>
                {[0.25, 0.5, 0.75, 1, 1.5, 2].map(r => (
                  <button key={r} onClick={() => changeRate(r)} style={{
                    ...btnStyle,
                    background: playbackRate === r ? "#3b82f6" : "#1e293b",
                    minWidth: 40, padding: "5px 8px"
                  }}>{r}x</button>
                ))}
              </div>
              <label style={{ fontSize: 11, color: "#94a3b8", display: "flex", alignItems: "center", gap: 5, marginLeft: 8 }}>
                <input type="checkbox" checked={autoPause} onChange={e => setAutoPause(e.target.checked)} />
                Pause auto après chaque tag
              </label>
              <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
                <button onClick={() => setShowDetectSettings(s => !s)} style={{
                  ...btnStyle, padding: "5px 12px", fontSize: 11,
                  background: showDetectSettings ? "#1e40af" : "#1e293b",
                  color: showDetectSettings ? "#93c5fd" : "#94a3b8"
                }}>⚙ Réglages</button>
                <button onClick={detectRallies} disabled={detecting} style={{
                  ...btnStyle, padding: "5px 14px", fontSize: 11, fontWeight: 700,
                  background: detecting ? "#1e293b" : "#fbbf2420",
                  color: detecting ? "#64748b" : "#fbbf24",
                  border: "1px solid #fbbf2460",
                  opacity: detecting ? 0.5 : 1,
                }}>
                  {detecting ? `⏳ ${detectProgress}%` : "🔍 Échanges"}
                </button>
                {videoSrc && (<>
                  <button onClick={detectCurrentFrame} disabled={detectionLoading} style={{
                    ...btnStyle, padding: "5px 12px", fontSize: 11, fontWeight: 700,
                    background: "#7c3aed20", color: "#a78bfa", border: "1px solid #7c3aed60",
                    opacity: detectionLoading ? 0.5 : 1,
                  }} title="Détecter joueurs et ballon sur la frame courante">
                    {detectionLoading ? "⏳ Chargement IA…" : "🎯 Détecter"}
                  </button>
                  {/* Bouton identification numéros de maillot */}
                  {detections.filter(d => d.class === "person").length > 0 && (
                    <button onClick={readJerseyNumbers} disabled={jerseyReading} style={{
                      ...btnStyle, padding: "5px 12px", fontSize: 11, fontWeight: 700,
                      background: jerseyReading ? "#1e293b" : "#22c55e20",
                      color: jerseyReading ? "#64748b" : "#22c55e",
                      border: `1px solid ${jerseyReading ? "#334155" : "#22c55e60"}`,
                      opacity: jerseyReading ? 0.6 : 1,
                    }} title="Lire les numéros de maillot et identifier automatiquement les joueuses">
                      {jerseyReading ? "⏳ Lecture…" : "🔢 Identifier"}
                    </button>
                  )}
                  <button onClick={toggleAutoDetect} style={{
                    ...btnStyle, padding: "5px 10px", fontSize: 11,
                    background: autoDetect ? "#7c3aed40" : "#1e293b",
                    color: autoDetect ? "#a78bfa" : "#64748b",
                    border: `1px solid ${autoDetect ? "#7c3aed80" : "#334155"}`,
                  }} title="Détection automatique toutes les 3s">
                    {autoDetect ? "⏹ Auto" : "🔁 Auto"}
                  </button>
                  {/* Plan 6 */}
                  <button onClick={pipelineRunning ? cancelPipeline : runPipeline} style={{
                    ...btnStyle, padding: "5px 14px", fontSize: 11, fontWeight: 800,
                    background: pipelineRunning ? "#ef444420" : "linear-gradient(135deg,#7c3aed,#2563eb)",
                    color: pipelineRunning ? "#ef4444" : "#fff",
                    border: pipelineRunning ? "1px solid #ef444460" : "none",
                    boxShadow: pipelineRunning ? "none" : "0 2px 8px rgba(124,58,237,0.4)",
                  }} title="Pipeline autonome : analyse toute la vidéo et propose les stats">
                    {pipelineRunning ? `⏹ ${pipelineProgress}%` : "🚀 Pipeline"}
                  </button>
                </>)}
              </div>
            </div>

            {/* Panneau de réglages de détection */}
            {showDetectSettings && (
              <div style={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 8, padding: "12px 16px", display: "flex", flexWrap: "wrap", gap: 20, alignItems: "center" }}>
                <div>
                  <label style={labelStyle}>Seuil silence ({Math.round(detectThreshold * 100)}% énergie max)</label>
                  <input type="range" min={2} max={30} step={1} value={Math.round(detectThreshold * 100)}
                    onChange={e => setDetectThreshold(Number(e.target.value) / 100)}
                    style={{ width: 120 }} />
                  <span style={{ fontSize: 10, color: "#475569", marginLeft: 6 }}>↑ = moins sensible</span>
                </div>
                <div>
                  <label style={labelStyle}>Silence min entre échanges ({minSilenceSec}s)</label>
                  <input type="range" min={1} max={6} step={0.5} value={minSilenceSec}
                    onChange={e => setMinSilenceSec(Number(e.target.value))}
                    style={{ width: 120 }} />
                </div>
                <label style={{ fontSize: 11, color: "#94a3b8", display: "flex", alignItems: "center", gap: 5 }}>
                  <input type="checkbox" checked={autoAdvanceRally} onChange={e => setAutoAdvanceRally(e.target.checked)} />
                  Avancer le compteur automatiquement
                </label>
                {suggestedRallies.length > 0 && (
                  <button onClick={() => { setSuggestedRallies([]); lastAutoRallyRef.current = 0; }} style={{ ...btnStyle, fontSize: 10, color: "#ef4444", borderColor: "#ef444440" }}>
                    🗑 Effacer la détection
                  </button>
                )}
              </div>
            )}
          </>)}
        </div>

        {sidebarOpen && <div style={{
          background: "#0f172a", borderLeft: isNarrow ? "none" : "1px solid #1e293b",
          borderTop: isNarrow ? "1px solid #1e293b" : "none",
          display: "flex", flexDirection: "column", overflow: "hidden",
          maxHeight: isNarrow ? "45vh" : undefined,
          width: isNarrow ? undefined : 275,
          flexShrink: 0,
        }}>
          <div style={{ padding: "14px 16px", borderBottom: "1px solid #1e293b" }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.07em", margin: "0 0 10px" }}>
              Stats — {selectedJoueuse || "—"} · Set {selectedSet}
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6 }}>
              {ACTIONS.map(group =>
                group.touches.map(t => (
                  <div key={t.field} style={{
                    background: "#1e293b", borderRadius: 6, padding: "6px 8px",
                    textAlign: "center", border: `1px solid ${(currentStats[t.field] || 0) > 0 ? group.color + "60" : "transparent"}`
                  }}>
                    <div style={{ fontSize: 18, fontWeight: 700, color: (currentStats[t.field] || 0) > 0 ? group.color : "#334155" }}>
                      {currentStats[t.field] || 0}
                    </div>
                    <div style={{ fontSize: 9, color: "#64748b" }}>{t.label}</div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div style={{ padding: "10px 16px", borderBottom: "1px solid #1e293b" }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.07em", margin: "0 0 8px" }}>
              Total match — {selectedJoueuse || "—"}
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
              {ACTIONS.map(group =>
                group.touches.slice(0, 1).map(t => (
                  <span key={t.field} style={{
                    padding: "3px 8px", background: group.bg + "30", borderRadius: 4,
                    fontSize: 11, color: group.color, fontWeight: 600
                  }}>
                    {group.groupe}: {group.touches.reduce((sum, tt) => sum + (totalJoueuse[tt.field] || 0), 0)}
                  </span>
                ))
              )}
            </div>
          </div>

          <div style={{ flex: 1, overflow: "auto", padding: "10px 16px" }}>

            {/* ── Plan 6 : Pipeline résultats + file de révision ── */}
            {(pipelineStats || reviewQueue.length > 0 || pipelineRunning) && (
              <div style={{ marginBottom: 12, background: "#0f172a", border: "1px solid #2563eb60", borderRadius: 8, padding: "10px 12px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <p style={{ fontSize: 11, fontWeight: 700, color: "#60a5fa", textTransform: "uppercase", letterSpacing: "0.07em", margin: 0 }}>
                    🚀 Pipeline
                  </p>
                  {pipelineRunning && (
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <div style={{ width: 80, height: 4, background: "#1e293b", borderRadius: 2 }}>
                        <div style={{ width: `${pipelineProgress}%`, height: "100%", background: "#3b82f6", borderRadius: 2, transition: "width 0.3s" }} />
                      </div>
                      <span style={{ fontSize: 10, color: "#3b82f6" }}>{pipelineProgress}%</span>
                    </div>
                  )}
                </div>

                {/* Résumé pipeline */}
                {pipelineStats && (
                  <div style={{ display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
                    {[
                      { label: "Total", val: pipelineStats.total, color: "#94a3b8" },
                      { label: "Auto ✓", val: pipelineStats.auto, color: "#22c55e" },
                      { label: "À revoir", val: pipelineStats.pending, color: "#fbbf24" },
                      { label: "Couverture", val: `${pipelineStats.coverage}%`, color: "#3b82f6" },
                    ].map(s => (
                      <div key={s.label} style={{ textAlign: "center", flex: 1, minWidth: 50 }}>
                        <div style={{ fontSize: 16, fontWeight: 800, color: s.color }}>{s.val}</div>
                        <div style={{ fontSize: 9, color: "#475569", textTransform: "uppercase" }}>{s.label}</div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Réglage seuil auto */}
                {!pipelineRunning && (
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                    <span style={{ fontSize: 10, color: "#64748b", whiteSpace: "nowrap" }}>Auto ≥ {Math.round(autoThreshold * 100)}%</span>
                    <input type="range" min={50} max={95} step={5} value={Math.round(autoThreshold * 100)}
                      onChange={e => setAutoThreshold(Number(e.target.value) / 100)}
                      style={{ flex: 1 }} />
                  </div>
                )}

                {/* File de révision */}
                {reviewQueue.length > 0 && (
                  <div>
                    <p style={{ fontSize: 10, color: "#fbbf24", fontWeight: 700, margin: "0 0 6px" }}>
                      À valider · {reviewQueue.length} échanges
                    </p>
                    <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 260, overflow: "auto" }}>
                      {reviewQueue.map(item => {
                        const group = ACTIONS.find(g => g.touches.some(t => t.field === item.field));
                        const isEditing = editingItem?.id === item.id;
                        const conf = Math.round(item.confidence * 100);
                        return (
                          <div key={item.id} style={{ background: "#1e293b", borderRadius: 6, padding: "6px 8px", border: "1px solid #334155" }}>
                            {!isEditing ? (
                              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                {/* Time + rally */}
                                <button onClick={() => { if(videoRef.current) videoRef.current.currentTime = item.time; }}
                                  style={{ background: "none", border: "none", color: "#3b82f6", cursor: "pointer", fontSize: 10, padding: 0, whiteSpace: "nowrap" }}>
                                  R{item.rally} · {formatTime(item.time)}
                                </button>
                                {/* Player */}
                                <span style={{ fontSize: 11, color: item.player ? "#f8fafc" : "#ef4444", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                  {item.player || "? Joueuse"}
                                </span>
                                {/* Action badge */}
                                {item.action && (
                                  <span style={{ fontSize: 11, fontWeight: 700, color: group?.color || "#94a3b8", background: `${group?.color || "#94a3b8"}20`, padding: "1px 6px", borderRadius: 4 }}>
                                    {item.action.label}
                                  </span>
                                )}
                                {/* Confiance */}
                                <span style={{ fontSize: 9, color: conf >= 60 ? "#22c55e" : "#fbbf24", minWidth: 28, textAlign: "right" }}>{conf}%</span>
                                {/* Boutons */}
                                <button onClick={() => acceptReviewItem(item)} title="Accepter" style={{ background: "none", border: "none", color: "#22c55e", cursor: "pointer", fontSize: 14, padding: "0 2px" }}>✓</button>
                                <button onClick={() => setEditingItem({ ...item })} title="Modifier" style={{ background: "none", border: "none", color: "#fbbf24", cursor: "pointer", fontSize: 12, padding: "0 2px" }}>✏</button>
                                <button onClick={() => skipReviewItem(item.id)} title="Passer" style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer", fontSize: 12, padding: "0 2px" }}>✗</button>
                              </div>
                            ) : (
                              /* Mode édition inline */
                              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                                <select value={editingItem.player || ""} onChange={e => setEditingItem(v => ({ ...v, player: e.target.value }))}
                                  style={{ ...inputStyle, padding: "3px 6px", fontSize: 11 }}>
                                  <option value="">— Joueuse —</option>
                                  {joueuses.map(n => <option key={n} value={n}>{n}</option>)}
                                </select>
                                <select value={editingItem.field || ""} onChange={e => setEditingItem(v => ({ ...v, field: e.target.value }))}
                                  style={{ ...inputStyle, padding: "3px 6px", fontSize: 11 }}>
                                  <option value="">— Action —</option>
                                  {ACTIONS.map(g => (
                                    <optgroup key={g.groupe} label={g.groupe}>
                                      {g.touches.map(t => <option key={t.field} value={t.field}>{t.label} — {t.desc}</option>)}
                                    </optgroup>
                                  ))}
                                </select>
                                <div style={{ display: "flex", gap: 4 }}>
                                  <button onClick={saveEditedItem} style={{ ...btnStyle, flex: 1, fontSize: 10, padding: "3px", background: "#16a34a", border: "none", color: "#fff" }}>✓ Valider</button>
                                  <button onClick={() => setEditingItem(null)} style={{ ...btnStyle, flex: 1, fontSize: 10, padding: "3px" }}>✗ Annuler</button>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    {reviewQueue.length > 0 && (
                      <button onClick={() => setReviewQueue([])} style={{ ...btnStyle, width: "100%", fontSize: 10, marginTop: 4, color: "#64748b", justifyContent: "center" }}>
                        Tout passer ({reviewQueue.length} restants)
                      </button>
                    )}
                  </div>
                )}

                {pipelineStats && reviewQueue.length === 0 && !pipelineRunning && (
                  <p style={{ fontSize: 11, color: "#22c55e", textAlign: "center", margin: 0 }}>✓ Révision terminée</p>
                )}
              </div>
            )}

            {/* ── Panneau OCR Score ── */}
            <div style={{ marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.07em", margin: 0 }}>
                  📋 Score OCR
                </p>
                <button onClick={() => setShowScorePanel(s => !s)} style={{ ...btnStyle, padding: "2px 8px", fontSize: 10 }}>
                  {showScorePanel ? "▲ Masquer" : "▼ Afficher"}
                </button>
              </div>

              {showScorePanel && (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {/* Bouton zone + contrôles */}
                  <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                    <button onClick={() => { setIsSelectingZone(true); stopOCR(); }} disabled={!videoSrc} style={{
                      ...btnStyle, padding: "4px 8px", fontSize: 10,
                      background: isSelectingZone ? "#f59e0b" : "#1e293b",
                      color: isSelectingZone ? "#000" : "#f59e0b",
                      border: "1px solid #f59e0b60", flex: 1
                    }}>
                      {isSelectingZone ? "✏ Dessine la zone…" : scoreZone ? "✏ Changer la zone" : "✏ Définir zone score"}
                    </button>
                    {scoreZone && (
                      <button onClick={ocrActive ? stopOCR : startOCR} style={{
                        ...btnStyle, padding: "4px 8px", fontSize: 10, flex: 1,
                        background: ocrActive ? "#16a34a20" : "#1e293b",
                        color: ocrActive ? "#22c55e" : "#94a3b8",
                        border: `1px solid ${ocrActive ? "#22c55e60" : "#334155"}`,
                      }}>
                        {ocrActive ? "⏹ Arrêter OCR" : "▶ Lire le score"}
                      </button>
                    )}
                  </div>

                  {/* Options */}
                  {scoreZone && (
                    <label style={{ fontSize: 10, color: "#64748b", display: "flex", alignItems: "center", gap: 4 }}>
                      <input type="checkbox" checked={invertOcr} onChange={e => setInvertOcr(e.target.checked)} />
                      Inverser couleurs (texte foncé sur fond clair)
                    </label>
                  )}

                  {/* Status OCR */}
                  {ocrStatus && (
                    <div style={{ fontSize: 10, color: ocrActive ? "#22c55e" : "#64748b", background: "#0f172a", padding: "4px 8px", borderRadius: 4, wordBreak: "break-all" }}>
                      {ocrStatus}
                    </div>
                  )}

                  {/* Score courant */}
                  {currentScore && (
                    <div style={{ display: "flex", justifyContent: "center", gap: 16, padding: "8px", background: "#0f172a", borderRadius: 8, border: "1px solid #22c55e40" }}>
                      <span style={{ fontSize: 22, fontWeight: 800, color: "#3b82f6" }}>{currentScore.scoreA}</span>
                      <span style={{ fontSize: 18, color: "#475569" }}>–</span>
                      <span style={{ fontSize: 22, fontWeight: 800, color: "#ef4444" }}>{currentScore.scoreB}</span>
                    </div>
                  )}

                  {/* Historique des scores détectés */}
                  {detectedScores.length > 0 && (
                    <div style={{ maxHeight: 120, overflow: "auto" }}>
                      {[...detectedScores].reverse().map((s, i) => (
                        <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "3px 6px", borderBottom: "1px solid #1e293b", fontSize: 11 }}>
                          <span style={{ color: "#3b82f6", fontWeight: 700 }}>{s.scoreA}</span>
                          <span style={{ color: "#475569" }}>–</span>
                          <span style={{ color: "#ef4444", fontWeight: 700 }}>{s.scoreB}</span>
                          <span style={{ color: "#475569", marginLeft: "auto" }}>{formatTime(s.time)}</span>
                          <button onClick={() => { if(videoRef.current) videoRef.current.currentTime = s.time; }} style={{ marginLeft: 6, background: "none", border: "none", color: "#3b82f6", cursor: "pointer", fontSize: 10 }}>▶</button>
                        </div>
                      ))}
                    </div>
                  )}

                  {!scoreZone && (
                    <p style={{ fontSize: 10, color: "#334155", textAlign: "center" }}>
                      Pause la vidéo sur une frame avec le score visible, puis définis la zone.
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* ── Panneau Détection IA ── */}
            {(detections.length > 0 || detectionError) && (
              <div style={{ marginBottom: 12, background: "#0f172a", border: "1px solid #7c3aed40", borderRadius: 8, padding: "10px 12px" }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: "#a78bfa", textTransform: "uppercase", letterSpacing: "0.07em", margin: "0 0 8px" }}>
                  🎯 Détection IA · {detections.length} objet{detections.length > 1 ? "s" : ""}
                </p>

                {detectionError && (
                  <p style={{ fontSize: 10, color: "#ef4444", margin: "0 0 6px" }}>{detectionError}</p>
                )}

                {/* Suggestion principale */}
                {suggestion?.name && (
                  <div style={{ background: "#22c55e20", border: "1px solid #22c55e60", borderRadius: 6, padding: "6px 10px", marginBottom: 8 }}>
                    <p style={{ fontSize: 10, color: "#22c55e", margin: "0 0 4px", fontWeight: 700 }}>
                      💡 Joueuse suggérée (proche du ballon)
                    </p>
                    <p style={{ fontSize: 13, color: "#f8fafc", margin: 0, fontWeight: 700 }}>{suggestion.name}</p>
                    <p style={{ fontSize: 10, color: "#64748b", margin: "2px 0 0" }}>Préselectionnée automatiquement</p>
                  </div>
                )}

                {/* Assignation des boîtes aux joueuses */}
                {/* Statut lecture numéros */}
                {jerseyStatus && (
                  <div style={{ fontSize: 10, padding: "5px 8px", borderRadius: 5, marginBottom: 6,
                    background: jerseyStatus.startsWith("✓") ? "#22c55e20" : jerseyStatus.startsWith("⚠") ? "#ef444420" : "#1e293b",
                    color: jerseyStatus.startsWith("✓") ? "#22c55e" : jerseyStatus.startsWith("⚠") ? "#ef4444" : "#94a3b8",
                    wordBreak: "break-word"
                  }}>
                    {jerseyStatus}
                  </div>
                )}

                {/* Bouton lire les numéros */}
                <button onClick={readJerseyNumbers} disabled={jerseyReading} style={{
                  ...btnStyle, width: "100%", fontSize: 11, padding: "6px",
                  background: "#22c55e20", color: "#22c55e", border: "1px solid #22c55e40",
                  justifyContent: "center", marginBottom: 8, opacity: jerseyReading ? 0.6 : 1,
                }}>
                  {jerseyReading ? "⏳ Lecture des numéros…" : "🔢 Identifier automatiquement"}
                </button>

                <p style={{ fontSize: 10, color: "#64748b", margin: "0 0 4px" }}>Ou assigner manuellement :</p>
                {detections.filter(p => p.class === "person").map((p, i) => {
                  const origIdx = detections.indexOf(p);
                  return (
                    <div key={origIdx} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                      <span style={{ fontSize: 11, color: "#a78bfa", minWidth: 24, fontWeight: 700 }}>
                        J{i + 1}
                      </span>
                      <select value={playerBoxMap[origIdx] || ""} onChange={e => assignPlayerToBox(origIdx, e.target.value)}
                        style={{ ...inputStyle, flex: 1, padding: "3px 6px", fontSize: 11 }}>
                        <option value="">— Non assignée —</option>
                        {joueuses.map(n => <option key={n} value={n}>{n}</option>)}
                      </select>
                    </div>
                  );
                })}

                <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                  <button onClick={() => { setDetections([]); setSuggestion(null); setPlayerBoxMap({}); const c = detectionCanvasRef.current; if(c) { const ctx = c.getContext("2d"); ctx.clearRect(0,0,c.width,c.height); } }} style={{ ...btnStyle, fontSize: 10, padding: "3px 8px", flex: 1, color: "#64748b" }}>
                    🗑 Effacer
                  </button>
                  <button onClick={detectCurrentFrame} style={{ ...btnStyle, fontSize: 10, padding: "3px 8px", flex: 1, color: "#a78bfa", border: "1px solid #7c3aed60" }}>
                    🔄 Re-détecter
                  </button>
                </div>
              </div>
            )}

            <p style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.07em", margin: "0 0 8px" }}>
              Journal ({actionLog.length} actions)
            </p>
            {actionLog.length === 0 && (
              <p style={{ fontSize: 12, color: "#334155", textAlign: "center", marginTop: 20 }}>
                Aucune action taguée.<br />Appuyez sur les touches pour commencer.
              </p>
            )}
            {actionLog.map((entry, i) => {
              const group = ACTIONS.find(g => g.touches.some(t => t.field === entry.field));
              return (
                <div key={entry.id} style={{
                  display: "flex", alignItems: "center", gap: 8,
                  padding: "5px 8px", borderRadius: 5, marginBottom: 3,
                  background: i === 0 ? "#1e293b" : "transparent",
                  border: i === 0 ? "1px solid #334155" : "none"
                }}>
                  <span style={{
                    fontSize: 11, fontWeight: 700, color: group?.color || "#94a3b8",
                    background: group?.bg + "30" || "#1e293b",
                    padding: "2px 6px", borderRadius: 3, minWidth: 32, textAlign: "center"
                  }}>{entry.label}</span>
                  <span style={{ fontSize: 11, color: "#94a3b8", flex: 1 }}>{entry.joueuse}</span>
                  <span style={{ fontSize: 10, color: "#475569" }}>
                    S{entry.set} · R{entry.rally} · {formatTime(entry.time)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>}
      </div>
    </div>
  );
}

const btnStyle = {
  padding: "6px 12px", borderRadius: 6, border: "1px solid #334155",
  cursor: "pointer", background: "#1e293b", color: "#e2e8f0",
  fontSize: 12, fontWeight: 500, whiteSpace: "nowrap"
};

const labelStyle = {
  display: "block", fontSize: 10, fontWeight: 700, color: "#64748b",
  textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 4
};

const inputStyle = {
  width: "100%", padding: "8px 10px", borderRadius: 6,
  border: "1px solid #334155", background: "#1e293b",
  color: "#e2e8f0", fontSize: 12, outline: "none", boxSizing: "border-box"
};
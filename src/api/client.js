import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:8000",
});

export const getMatches = () => api.get("/matches/");
export const createMatch = (data) => api.post("/matches/", data);
export const deleteMatch = (id) => api.delete(`/matches/${id}`);
export const getMatchStats = (matchId) => api.get(`/stats/match/${matchId}`);
export const getSetStats = (matchId, setN) => api.get(`/stats/match/${matchId}/set/${setN}`);
export const importSetStats = (matchId, setN, file) => {
  const fd = new FormData();
  fd.append("file", file);
  return api.post(`/matches/${matchId}/sets/${setN}/import`, fd, {
    headers: { "Content-Type": "multipart/form-data" },
  });
};

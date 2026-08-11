import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || "";
export const API = `${BACKEND_URL}/api`;

export const api = axios.create({ baseURL: API });

api.interceptors.request.use((config) => {
  const token =
    localStorage.getItem("sfr_token") || sessionStorage.getItem("sfr_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export function saveToken(token, remember) {
  clearToken();
  if (remember) localStorage.setItem("sfr_token", token);
  else sessionStorage.setItem("sfr_token", token);
}

export function clearToken() {
  localStorage.removeItem("sfr_token");
  sessionStorage.removeItem("sfr_token");
}

export function getToken() {
  return localStorage.getItem("sfr_token") || sessionStorage.getItem("sfr_token");
}

export function formatApiError(detail) {
  if (detail == null) return "Une erreur est survenue. Veuillez réessayer.";
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail))
    return detail
      .map((e) => (e && typeof e.msg === "string" ? e.msg : JSON.stringify(e)))
      .filter(Boolean)
      .join(" ");
  if (detail && typeof detail.msg === "string") return detail.msg;
  return String(detail);
}

export function formatEUR(amount) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
  }).format(amount);
}

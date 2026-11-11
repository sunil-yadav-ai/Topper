import axios from "axios";
import { finishPageRequest, trackPageRequest } from "./page-request-tracker.js";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api",
  headers: {
    "Content-Type": "application/json",
  },
  withCredentials: true,
  timeout: 10000,
});

api.interceptors.request.use((config) => {
  trackPageRequest(config);
  return config;
});

api.interceptors.response.use(
  (response) => {
    finishPageRequest(response.config);
    return response;
  },
  (error) => {
    finishPageRequest(error.config);
    return Promise.reject(error);
  },
);

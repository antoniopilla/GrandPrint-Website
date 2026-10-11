import axios from "axios";
import { API } from "./config";

export function createAdminApi(onUnauthorized) {
  const api = axios.create({ baseURL: API });
  api.interceptors.request.use((config) => {
    const token = sessionStorage.getItem("adminToken");
    config._adminSessionToken = token;
    config.headers.set("Authorization", token ? `Bearer ${token}` : undefined);
    return config;
  }, undefined, { synchronous: true });
  api.interceptors.response.use((response) => response, (error) => {
    if (error.response?.status === 401 && error.config?._adminSessionToken !== undefined
      && sessionStorage.getItem("adminToken") === error.config._adminSessionToken) {
      sessionStorage.removeItem("adminToken");
      onUnauthorized();
    }
    return Promise.reject(error);
  });
  return api;
}

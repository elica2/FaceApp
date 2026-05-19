import axios from "axios";

// En desarrollo usa localhost; en producción Railway pone la URL real
const BASE_URL = process.env.REACT_APP_API_URL || "http://localhost:8000";

const api = axios.create({ baseURL: BASE_URL });

export const getUsers = () => api.get("/users");
export const deleteUser = (name) => api.delete(`/users/${encodeURIComponent(name)}`);
export const getMetrics = () => api.get("/metrics");

export const registerUser = (name, imagesBase64) =>
  api.post("/register-base64", { name, images: imagesBase64 });

export const identifyImage = (imageBase64) =>
  api.post("/identify", { image: imageBase64 });

export default api;

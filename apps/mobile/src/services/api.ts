import axios from "axios";
import SuperTokens from "supertokens-react-native";

export const API_URL = process.env.EXPO_PUBLIC_API_URL || "http://localhost:3001";

export const api = axios.create({
  baseURL: API_URL,
  timeout: 10000,
  headers: {
    "Content-Type": "application/json",
  },
});

// Attach SuperTokens interceptor to auto-attach tokens and handle session refreshes
SuperTokens.addAxiosInterceptors(api);

// Global response error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const message = error.response?.data?.message || error.message || "An unexpected error occurred";
    console.error("[API Error]", message);
    return Promise.reject(new Error(message));
  }
);

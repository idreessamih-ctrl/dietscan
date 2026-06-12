import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import * as SecureStore from "expo-secure-store";
import SuperTokens from "supertokens-react-native";
import { api } from "../services/api";

export interface User {
  id: string;
  email: string;
  dietaryProtocol?: string;
}

export interface Session {
  userId: string;
}

export interface AuthState {
  session: Session | null;
  isLoading: boolean;
  user: User | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, dietaryProtocol?: string) => Promise<void>;
  signOut: () => Promise<void>;
  initialize: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  immer((set) => ({
    session: null,
    isLoading: true,
    user: null,

    initialize: async () => {
      try {
        const doesExist = await SuperTokens.doesSessionExist();
        if (doesExist) {
          const userId = await SuperTokens.getUserId();
          const userStr = await SecureStore.getItemAsync("dietscan_user");
          let user: User | null = null;
          if (userStr) {
            try {
              user = JSON.parse(userStr);
            } catch {
              user = { id: userId, email: "user@example.com" };
            }
          } else {
            user = { id: userId, email: "user@example.com" };
          }

          set((state) => {
            state.session = { userId };
            state.user = user;
            state.isLoading = false;
          });
        } else {
          set((state) => {
            state.session = null;
            state.user = null;
            state.isLoading = false;
          });
        }
      } catch (error) {
        console.error("Auth store initialization failed:", error);
        set((state) => {
          state.session = null;
          state.user = null;
          state.isLoading = false;
        });
      }
    },

    signIn: async (email, password) => {
      set((state) => {
        state.isLoading = true;
      });
      try {
        const response = await api.post("/auth/signin", {
          formFields: [
            { id: "email", value: email },
            { id: "password", value: password },
          ],
        });

        if (response.data.status !== "OK") {
          throw new Error(response.data.message || "Failed to sign in");
        }

        const userId = await SuperTokens.getUserId();
        const user: User = { id: userId, email };
        await SecureStore.setItemAsync("dietscan_user", JSON.stringify(user));

        set((state) => {
          state.session = { userId };
          state.user = user;
          state.isLoading = false;
        });
      } catch (error) {
        set((state) => {
          state.isLoading = false;
        });
        throw error;
      }
    },

    signUp: async (email, password, dietaryProtocol) => {
      set((state) => {
        state.isLoading = true;
      });
      try {
        const response = await api.post("/auth/signup", {
          formFields: [
            { id: "email", value: email },
            { id: "password", value: password },
          ],
        });

        if (response.data.status !== "OK") {
          throw new Error(response.data.message || "Failed to sign up");
        }

        const userId = await SuperTokens.getUserId();
        const user: User = { id: userId, email, dietaryProtocol };
        await SecureStore.setItemAsync("dietscan_user", JSON.stringify(user));

        set((state) => {
          state.session = { userId };
          state.user = user;
          state.isLoading = false;
        });
      } catch (error) {
        set((state) => {
          state.isLoading = false;
        });
        throw error;
      }
    },

    signOut: async () => {
      set((state) => {
        state.isLoading = true;
      });
      try {
        await SuperTokens.signOut();
        await SecureStore.deleteItemAsync("dietscan_user");
        set((state) => {
          state.session = null;
          state.user = null;
          state.isLoading = false;
        });
      } catch (error) {
        set((state) => {
          state.isLoading = false;
        });
        throw error;
      }
    },
  }))
);

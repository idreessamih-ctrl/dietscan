import { useAuthStore } from "./authStore";

export const useAuth = () => {
  const session = useAuthStore((state) => state.session);
  const isLoading = useAuthStore((state) => state.isLoading);
  const user = useAuthStore((state) => state.user);
  const signIn = useAuthStore((state) => state.signIn);
  const signUp = useAuthStore((state) => state.signUp);
  const signOut = useAuthStore((state) => state.signOut);
  const initialize = useAuthStore((state) => state.initialize);

  return {
    session,
    isLoading,
    user,
    signIn,
    signUp,
    signOut,
    initialize,
    isAuthenticated: !!session,
  };
};

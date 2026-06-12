import * as Sentry from "@sentry/react-native";

// Initialize Sentry/GlitchTip for React Native
Sentry.init({
  dsn: process.env.EXPO_PUBLIC_GLITCHTIP_DSN || process.env.GLITCHTIP_DSN,
  // debug: true in development to verify config is working
  debug: typeof __DEV__ !== "undefined" ? __DEV__ : false,
});

export { Sentry };
export const ErrorBoundary = Sentry.ErrorBoundary;
export const withSentry = Sentry.wrap;

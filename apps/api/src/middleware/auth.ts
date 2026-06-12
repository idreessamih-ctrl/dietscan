import { verifySession as superTokensVerifySession } from "supertokens-node/recipe/session/framework/express";

// Required session middleware for protected routes
export const verifySession = superTokensVerifySession();

// Optional session middleware for public routes that can consume session info if present
export const optionalSession = superTokensVerifySession({
  sessionRequired: false,
});

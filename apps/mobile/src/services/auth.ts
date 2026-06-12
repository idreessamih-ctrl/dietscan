import SuperTokens from "supertokens-react-native";
import { API_URL } from "./api";

export const initAuth = () => {
  SuperTokens.init({
    apiDomain: API_URL,
    apiBasePath: "/auth",
    tokenTransferMethod: "header",
  });
};

export const checkSession = async (): Promise<boolean> => {
  return await SuperTokens.doesSessionExist();
};

export const getUserId = async (): Promise<string> => {
  return await SuperTokens.getUserId();
};

export const signOut = async (): Promise<void> => {
  await SuperTokens.signOut();
};

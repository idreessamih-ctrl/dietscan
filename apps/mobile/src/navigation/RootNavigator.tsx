import { useEffect } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useAuth } from "../store/useAuth";
import { AuthStack } from "./AuthStack";
import { MainTabs } from "./MainTabs";
import { LoadingSpinner } from "../components/LoadingSpinner";
import { ScanResultScreen } from "../screens/ScanResultScreen";
import { PrivacyScreen } from "../screens/PrivacyScreen";
import { DataExportScreen } from "../screens/DataExportScreen";
import { DeleteAccountScreen } from "../screens/DeleteAccountScreen";
import { ScanResult } from "../store/scanStore";
import { OfflineIndicator } from "../components/OfflineIndicator";
import { startAutoSync, stopAutoSync } from "../services/sync";

import { navigationRef } from "./navigationRef";

import { registerForPushNotificationsAsync, setupNotificationListeners } from "../services/notifications";

import { NavigatorScreenParams } from "@react-navigation/native";
import { MainTabParamList } from "./MainTabs";

export type RootStackParamList = {
  Auth: undefined;
  Main: NavigatorScreenParams<MainTabParamList>;
  ScanResult: { result: ScanResult };
  Privacy: undefined;
  DataExport: undefined;
  DeleteAccount: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export const RootNavigator = () => {
  const { session, isLoading, initialize } = useAuth();

  useEffect(() => {
    initialize();
    startAutoSync();
    return () => {
      stopAutoSync();
    };
  }, [initialize]);

  useEffect(() => {
    const cleanup = setupNotificationListeners();
    return () => {
      cleanup();
    };
  }, []);

  useEffect(() => {
    if (session) {
      registerForPushNotificationsAsync().catch((err) =>
        console.error("[Notifications] Registration error in RootNavigator:", err)
      );
    }
  }, [session]);

  if (isLoading) {
    return <LoadingSpinner />;
  }

  return (
    <>
      <NavigationContainer ref={navigationRef}>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          {session ? (
            <>
              <Stack.Screen name="Main" component={MainTabs} />
              <Stack.Screen name="ScanResult" component={ScanResultScreen} />
              <Stack.Screen name="Privacy" component={PrivacyScreen} />
              <Stack.Screen name="DataExport" component={DataExportScreen} />
              <Stack.Screen name="DeleteAccount" component={DeleteAccountScreen} />
            </>
          ) : (
            <Stack.Screen name="Auth" component={AuthStack} />
          )}
        </Stack.Navigator>
      </NavigationContainer>
      <OfflineIndicator />
    </>
  );
};

import { useEffect } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useAuth } from "../store/useAuth";
import { AuthStack } from "./AuthStack";
import { MainTabs } from "./MainTabs";
import { LoadingSpinner } from "../components/LoadingSpinner";
import { ScanResultScreen } from "../screens/ScanResultScreen";
import { ScanResult } from "../store/scanStore";
import { OfflineIndicator } from "../components/OfflineIndicator";
import { startAutoSync, stopAutoSync } from "../services/sync";

export type RootStackParamList = {
  Auth: undefined;
  Main: undefined;
  ScanResult: { result: ScanResult };
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

  if (isLoading) {
    return <LoadingSpinner />;
  }

  return (
    <>
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          {session ? (
            <>
              <Stack.Screen name="Main" component={MainTabs} />
              <Stack.Screen name="ScanResult" component={ScanResultScreen} />
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

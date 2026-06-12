import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { api } from "./api";
import { navigationRef } from "../navigation/navigationRef";

// Configure notification behavior for when the app is foregrounded
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/**
 * Request permission and register user's device for push notifications.
 * Sends the retrieved Expo push token to the API server.
 */
export async function registerForPushNotificationsAsync(): Promise<string | null> {
  let token = null;

  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== "granted") {
      console.warn("[Notifications] Failed to obtain push permission.");
      return null;
    }

    // Retrieve Expo push token
    token = (await Notifications.getExpoPushTokenAsync()).data;
    console.log("[Notifications] Expo Push Token obtained:", token);

    // Register token on the backend server
    await api.post("/notifications/register", { token });
  } catch (error) {
    console.error("[Notifications] Error registering for push notifications:", error);
  }

  // Extra Android channel configuration
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "default",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#10B981",
    });
  }

  return token;
}

/**
 * Setup event listeners for handling notification interactions (taps).
 * Returns a cleanup function.
 */
export function setupNotificationListeners(): () => void {
  const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
    try {
      const data = response.notification.request.content.data as Record<string, unknown>;
      const type = data?.type;

      console.log("[Notifications] Notification tapped. Data type:", type);

      if (navigationRef.isReady()) {
        if (type === "journal_reminder") {
          navigationRef.navigate("Main", { screen: "Journal" });
        } else if (type === "weekly_summary") {
          navigationRef.navigate("Main", { screen: "MealPlan" });
        } else if (type === "streak_milestone") {
          navigationRef.navigate("Main", { screen: "Journal" });
        }
      }
    } catch (error) {
      console.error("[Notifications] Error handling notification tap:", error);
    }
  });

  return () => {
    subscription.remove();
  };
}

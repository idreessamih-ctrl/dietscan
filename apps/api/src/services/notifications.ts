/**
 * Service for sending push notifications using the Expo Push API.
 */
export async function sendPushNotification(
  expoPushToken: string,
  title: string,
  body: string,
  data?: Record<string, unknown>
): Promise<void> {
  if (!expoPushToken) {
    console.warn("[Push Notifications] Empty push token provided");
    return;
  }

  if (!expoPushToken.startsWith("ExponentPushToken[")) {
    console.warn(`[Push Notifications] Invalid Expo push token format: ${expoPushToken}`);
    return;
  }

  try {
    const response = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Accept-encoding": "gzip, deflate",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        to: expoPushToken,
        sound: "default",
        title,
        body,
        data,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Push Notifications] Expo API returned status ${response.status}: ${errorText}`);
      return;
    }

    const resData = (await response.json()) as {
      data?: {
        status: string;
        message?: string;
        details?: Record<string, unknown>;
      };
    };

    if (resData.data?.status === "error") {
      console.error(`[Push Notifications] Error sending push notification: ${resData.data.message}`);
    } else {
      console.log(`[Push Notifications] Notification sent successfully to ${expoPushToken}`);
    }
  } catch (error) {
    console.error("[Push Notifications] Failed to send push notification:", error);
  }
}

import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, SafeAreaView, Animated } from "react-native";
import NetInfo from "@react-native-community/netinfo";
import { runFullSync } from "../services/sync";

export const OfflineIndicator: React.FC = () => {
  const [isConnected, setIsConnected] = useState<boolean>(true);
  const [wasOffline, setWasOffline] = useState<boolean>(false);
  const [showReconnected, setShowReconnected] = useState<boolean>(false);
  const [fadeAnim] = useState(() => new Animated.Value(0));

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      const online = !!state.isConnected && !!state.isInternetReachable;

      if (!online) {
        setIsConnected(false);
        setWasOffline(true);
        setShowReconnected(false);
        
        // Fade in offline banner
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }).start();
      } else {
        setIsConnected(true);
        if (wasOffline) {
          // Trigger sync on reconnection
          runFullSync().catch(console.error);

          setWasOffline(false);
          setShowReconnected(true);

          // Hold green banner, then fade out
          setTimeout(() => {
            Animated.timing(fadeAnim, {
              toValue: 0,
              duration: 300,
              useNativeDriver: true,
            }).start(() => {
              setShowReconnected(false);
            });
          }, 3000);
        } else {
          // If was never offline, hide
          fadeAnim.setValue(0);
        }
      }
    });

    return () => unsubscribe();
  }, [wasOffline]);

  if (isConnected && !showReconnected) {
    return null;
  }

  const isOfflineState = !isConnected;

  return (
    <Animated.View
      style={[
        styles.bannerContainer,
        isOfflineState ? styles.offlineBanner : styles.onlineBanner,
        { opacity: fadeAnim },
      ]}
    >
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.content}>
          <Text style={styles.emoji}>
            {isOfflineState ? "⚠️" : "⚡"}
          </Text>
          <Text style={styles.text}>
            {isOfflineState
              ? "Offline — changes will sync when connected"
              : "Back online — syncing..."}
          </Text>
        </View>
      </SafeAreaView>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  bannerContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 9999,
    elevation: 9999,
    paddingBottom: 8,
  },
  offlineBanner: {
    backgroundColor: "#b91c1c", // Red
  },
  onlineBanner: {
    backgroundColor: "#047857", // Green
  },
  safeArea: {
    width: "100%",
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  emoji: {
    fontSize: 14,
    marginRight: 8,
  },
  text: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "bold",
    textAlign: "center",
  },
});

import { View, Text, StyleSheet } from "react-native";

interface StreakCounterProps {
  streak: number;
}

export const StreakCounter = ({ streak }: StreakCounterProps) => {
  return (
    <View style={styles.container}>
      <View style={styles.streakBadge}>
        <Text style={styles.streakEmoji}>{streak > 0 ? "🔥" : "❄️"}</Text>
        <View style={styles.textContainer}>
          <Text style={styles.streakNumber}>
            {streak} {streak === 1 ? "Day" : "Days"}
          </Text>
          <Text style={styles.streakLabel}>
            {streak > 0 ? "Active Logging Streak!" : "Log a meal to start a streak"}
          </Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 12,
    alignSelf: "stretch",
  },
  streakBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(249, 115, 22, 0.1)", // translucent orange
    borderWidth: 1.5,
    borderColor: "#f97316", // solid orange
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  streakEmoji: {
    fontSize: 28,
    marginRight: 14,
  },
  textContainer: {
    flex: 1,
  },
  streakNumber: {
    color: "#f9fafb",
    fontSize: 16,
    fontWeight: "bold",
  },
  streakLabel: {
    color: "#9ca3af",
    fontSize: 12,
    marginTop: 2,
  },
});

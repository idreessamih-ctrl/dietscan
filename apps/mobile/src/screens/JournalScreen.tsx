import { View, Text, StyleSheet } from "react-native";

export const JournalScreen = () => {
  return (
    <View style={styles.container}>
      <Text style={styles.emoji}>📓</Text>
      <Text style={styles.title}>Journal Screen</Text>
      <Text style={styles.subtitle}>Daily meal journal and compliance tracking is coming soon.</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#111827",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  emoji: {
    fontSize: 64,
    marginBottom: 20,
  },
  title: {
    color: "#f9fafb",
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 10,
  },
  subtitle: {
    color: "#9ca3af",
    fontSize: 16,
    textAlign: "center",
  },
});

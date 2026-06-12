import { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from "react-native";
import { api } from "../services/api";

interface PrivacyScreenProps {
  navigation: {
    goBack: () => void;
  };
}

export const PrivacyScreen = ({ navigation }: PrivacyScreenProps) => {
  const [policy, setPolicy] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    const fetchPrivacy = async () => {
      try {
        const response = await api.get("/gdpr/privacy");
        setPolicy(response.data.policy);
        setLoading(false);
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : "Failed to load privacy policy";
        setError(errMsg);
        setLoading(false);
      }
    };
    fetchPrivacy();
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Privacy Policy</Text>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#10b981" />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity
            style={styles.button}
            onPress={() => {
              setLoading(true);
              setError("");
              api.get("/gdpr/privacy")
                .then(res => {
                  setPolicy(res.data.policy);
                  setLoading(false);
                })
                .catch(err => {
                  const errMsg = err instanceof Error ? err.message : "Failed to load privacy policy";
                  setError(errMsg);
                  setLoading(false);
                });
            }}
          >
            <Text style={styles.buttonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          <Text style={styles.policyText}>{policy}</Text>
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#111827",
    paddingTop: 50,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#1f2937",
  },
  backButton: {
    marginRight: 16,
  },
  backText: {
    color: "#10b981",
    fontSize: 16,
    fontWeight: "600",
  },
  headerTitle: {
    color: "#f9fafb",
    fontSize: 20,
    fontWeight: "bold",
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  errorText: {
    color: "#ef4444",
    fontSize: 16,
    marginBottom: 16,
    textAlign: "center",
  },
  button: {
    backgroundColor: "#10b981",
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  buttonText: {
    color: "#f9fafb",
    fontSize: 16,
    fontWeight: "600",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  policyText: {
    color: "#d1d5db",
    fontSize: 16,
    lineHeight: 24,
  },
});

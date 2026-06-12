import { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Share, ScrollView } from "react-native";
import { api } from "../services/api";

interface DataExportScreenProps {
  navigation: {
    goBack: () => void;
  };
}

export const DataExportScreen = ({ navigation }: DataExportScreenProps) => {
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [success, setSuccess] = useState<boolean>(false);
  const [exportedData, setExportedData] = useState<string>("");

  const handleExport = async () => {
    setLoading(true);
    setError("");
    setSuccess(false);
    try {
      const response = await api.get("/gdpr/export");
      const dataStr = JSON.stringify(response.data, null, 2);
      setExportedData(dataStr);
      setSuccess(true);
      setLoading(false);
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : "Failed to export data";
      setError(errMsg);
      setLoading(false);
    }
  };

  const handleShare = async () => {
    try {
      if (!exportedData) {
        return;
      }
      await Share.share({
        message: exportedData,
        title: "DietScan User Data Export",
      });
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : "Failed to share data";
      setError(errMsg);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Export My Data</Text>
      </View>

      <View style={styles.content}>
        <Text style={styles.description}>
          In accordance with GDPR, you can download a complete copy of your personal data collected by DietScan. This includes your profile, meal journal history, shopping lists, dietary protocols, and scanned products.
        </Text>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color="#10b981" />
            <Text style={styles.loadingText}>Compiling your data package...</Text>
          </View>
        ) : success ? (
          <View style={styles.successContainer}>
            <Text style={styles.successEmoji}>📦</Text>
            <Text style={styles.successTitle}>Data Package Ready!</Text>
            <Text style={styles.successText}>
              Your data package has been successfully compiled. You can share or save it below.
            </Text>

            <TouchableOpacity style={styles.primaryButton} onPress={handleShare}>
              <Text style={styles.buttonText}>Share / Save JSON</Text>
            </TouchableOpacity>

            <ScrollView style={styles.previewContainer}>
              <Text style={styles.previewText}>{exportedData}</Text>
            </ScrollView>

            <TouchableOpacity style={styles.secondaryButton} onPress={handleExport}>
              <Text style={styles.secondaryButtonText}>Refresh Export</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.formContainer}>
            {error ? <Text style={styles.errorText}>{error}</Text> : null}
            <TouchableOpacity style={styles.primaryButton} onPress={handleExport}>
              <Text style={styles.buttonText}>Request Data Export</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
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
  content: {
    flex: 1,
    padding: 24,
  },
  description: {
    color: "#9ca3af",
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 24,
  },
  center: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40,
  },
  loadingText: {
    color: "#9ca3af",
    marginTop: 16,
    fontSize: 16,
  },
  successContainer: {
    flex: 1,
    alignItems: "center",
  },
  successEmoji: {
    fontSize: 48,
    marginBottom: 16,
  },
  successTitle: {
    color: "#f9fafb",
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 8,
  },
  successText: {
    color: "#9ca3af",
    fontSize: 14,
    textAlign: "center",
    marginBottom: 20,
    lineHeight: 20,
  },
  previewContainer: {
    flex: 1,
    width: "100%",
    backgroundColor: "#1f2937",
    borderRadius: 8,
    padding: 12,
    marginVertical: 16,
    borderWidth: 1,
    borderColor: "#374151",
  },
  previewText: {
    color: "#10b981",
    fontFamily: "monospace",
    fontSize: 12,
  },
  formContainer: {
    alignItems: "center",
    marginTop: 20,
    width: "100%",
  },
  errorText: {
    color: "#ef4444",
    fontSize: 14,
    marginBottom: 16,
    textAlign: "center",
  },
  primaryButton: {
    backgroundColor: "#10b981",
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 8,
    width: "100%",
    alignItems: "center",
  },
  secondaryButton: {
    backgroundColor: "transparent",
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    width: "100%",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#374151",
    marginTop: 8,
  },
  secondaryButtonText: {
    color: "#9ca3af",
    fontSize: 16,
    fontWeight: "600",
  },
  buttonText: {
    color: "#f9fafb",
    fontSize: 16,
    fontWeight: "bold",
  },
});

import { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, TextInput } from "react-native";
import { api } from "../services/api";
import { useAuth } from "../store/useAuth";

interface DeleteAccountScreenProps {
  navigation: {
    goBack: () => void;
  };
}

export const DeleteAccountScreen = ({ navigation }: DeleteAccountScreenProps) => {
  const { signOut } = useAuth();
  const [confirmText, setConfirmText] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");

  const handleDelete = async () => {
    if (confirmText !== "DELETE") {
      setError("Please type DELETE to confirm.");
      return;
    }

    setLoading(true);
    setError("");
    try {
      // Call DELETE /gdpr/account
      await api.delete("/gdpr/account");
      
      // Clean up local authentication
      try {
        await signOut();
      } catch {
        // If session was already revoked on server, local signOut might fail, so we can ignore it
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : "Failed to delete account";
      setError(errMsg);
      setLoading(false);
    }
  };

  const isButtonEnabled = confirmText === "DELETE" && !loading;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Delete Account</Text>
      </View>

      <View style={styles.content}>
        <Text style={styles.warningTitle}>⚠️ WARNING: Permanent Action</Text>
        <Text style={styles.warningText}>
          Deleting your account is permanent and cannot be undone. All of your personal data, including scan history, meal journals, shopping lists, and custom settings, will be permanently erased.
        </Text>

        <Text style={styles.confirmLabel}>
          To confirm, type <Text style={styles.boldText}>DELETE</Text> in the box below:
        </Text>

        <TextInput
          style={styles.input}
          value={confirmText}
          onChangeText={setConfirmText}
          placeholder="DELETE"
          placeholderTextColor="#6b7280"
          autoCapitalize="characters"
          editable={!loading}
        />

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        {loading ? (
          <ActivityIndicator size="large" color="#ef4444" style={styles.loader} />
        ) : (
          <TouchableOpacity
            style={[styles.deleteButton, !isButtonEnabled && styles.disabledButton]}
            onPress={handleDelete}
            disabled={!isButtonEnabled}
          >
            <Text style={styles.deleteButtonText}>Permanently Delete My Account</Text>
          </TouchableOpacity>
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
    alignItems: "center",
  },
  warningTitle: {
    color: "#ef4444",
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 16,
    textAlign: "center",
  },
  warningText: {
    color: "#d1d5db",
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 32,
    textAlign: "center",
  },
  confirmLabel: {
    color: "#9ca3af",
    fontSize: 14,
    marginBottom: 12,
    textAlign: "center",
  },
  boldText: {
    color: "#f9fafb",
    fontWeight: "bold",
  },
  input: {
    backgroundColor: "#1f2937",
    color: "#f9fafb",
    fontSize: 18,
    fontWeight: "bold",
    textAlign: "center",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    width: "100%",
    borderWidth: 1,
    borderColor: "#ef4444",
    marginBottom: 24,
  },
  errorText: {
    color: "#ef4444",
    fontSize: 14,
    marginBottom: 24,
    textAlign: "center",
  },
  loader: {
    marginTop: 16,
  },
  deleteButton: {
    backgroundColor: "#ef4444",
    paddingVertical: 16,
    borderRadius: 8,
    width: "100%",
    alignItems: "center",
  },
  disabledButton: {
    backgroundColor: "#374151",
    opacity: 0.5,
  },
  deleteButtonText: {
    color: "#f9fafb",
    fontSize: 16,
    fontWeight: "bold",
  },
});

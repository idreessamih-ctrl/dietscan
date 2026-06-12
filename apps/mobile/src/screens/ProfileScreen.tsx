import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { useAuth } from "../store/useAuth";
import { useNavigation } from "@react-navigation/native";

export const ProfileScreen = () => {
  const { user, signOut } = useAuth();
  const navigation = useNavigation<{ navigate: (screen: string) => void }>();

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error("Failed to sign out:", error);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.emoji}>👤</Text>
      <Text style={styles.title}>Profile Screen</Text>
      
      {user ? (
        <View style={styles.profileBox}>
          <Text style={styles.label}>Email:</Text>
          <Text style={styles.value}>{user.email}</Text>
          
          {user.dietaryProtocol ? (
            <>
              <Text style={styles.label}>Dietary Protocol:</Text>
              <Text style={styles.value}>{user.dietaryProtocol}</Text>
            </>
          ) : null}
        </View>
      ) : (
        <Text style={styles.subtitle}>No user logged in.</Text>
      )}

      {user ? (
        <View style={styles.gdprBox}>
          <Text style={styles.gdprTitle}>GDPR & Privacy</Text>
          
          <TouchableOpacity 
            style={styles.actionButton} 
            onPress={() => navigation.navigate("Privacy")}
          >
            <Text style={styles.actionButtonText}>📄 Privacy Policy</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.actionButton} 
            onPress={() => navigation.navigate("DataExport")}
          >
            <Text style={styles.actionButtonText}>📦 Export My Data</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.actionButton, styles.dangerButton]} 
            onPress={() => navigation.navigate("DeleteAccount")}
          >
            <Text style={styles.dangerButtonText}>⚠️ Delete Account</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <TouchableOpacity style={styles.button} onPress={handleSignOut}>
        <Text style={styles.buttonText}>Sign Out</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#111827",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  emoji: {
    fontSize: 48,
    marginBottom: 10,
  },
  title: {
    color: "#f9fafb",
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 20,
  },
  profileBox: {
    backgroundColor: "#1f2937",
    padding: 16,
    borderRadius: 8,
    width: "100%",
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#374151",
  },
  gdprBox: {
    backgroundColor: "#1f2937",
    padding: 16,
    borderRadius: 8,
    width: "100%",
    marginBottom: 24,
    borderWidth: 1,
    borderColor: "#374151",
  },
  gdprTitle: {
    color: "#f9fafb",
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#374151",
    paddingBottom: 6,
  },
  actionButton: {
    backgroundColor: "#374151",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 6,
    marginBottom: 10,
    alignItems: "flex-start",
    width: "100%",
  },
  actionButtonText: {
    color: "#f9fafb",
    fontSize: 14,
    fontWeight: "600",
  },
  dangerButton: {
    backgroundColor: "#7f1d1d",
    borderColor: "#b91c1c",
    borderWidth: 1,
    marginBottom: 0,
  },
  dangerButtonText: {
    color: "#fca5a5",
    fontSize: 14,
    fontWeight: "600",
  },
  label: {
    color: "#9ca3af",
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 4,
  },
  value: {
    color: "#f9fafb",
    fontSize: 16,
    fontWeight: "500",
    marginBottom: 10,
  },
  subtitle: {
    color: "#9ca3af",
    fontSize: 16,
    marginBottom: 30,
  },
  button: {
    backgroundColor: "#ef4444",
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    width: "100%",
    alignItems: "center",
  },
  buttonText: {
    color: "#f9fafb",
    fontSize: 16,
    fontWeight: "bold",
  },
});

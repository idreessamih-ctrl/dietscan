import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { useAuth } from "../store/useAuth";

export const ProfileScreen = () => {
  const { user, signOut } = useAuth();

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
    fontSize: 64,
    marginBottom: 20,
  },
  title: {
    color: "#f9fafb",
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 20,
  },
  profileBox: {
    backgroundColor: "#1f2937",
    padding: 20,
    borderRadius: 8,
    width: "100%",
    marginBottom: 30,
    borderWidth: 1,
    borderColor: "#374151",
  },
  label: {
    color: "#9ca3af",
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 4,
  },
  value: {
    color: "#f9fafb",
    fontSize: 18,
    fontWeight: "500",
    marginBottom: 16,
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

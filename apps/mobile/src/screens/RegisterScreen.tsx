import { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useAuth } from "../store/useAuth";
import { AuthStackParamList } from "../navigation/AuthStack";

const PROTOCOLS = [
  { slug: "keto", name: "Keto", emoji: "🥩" },
  { slug: "vegan", name: "Vegan", emoji: "🌱" },
  { slug: "paleo", name: "Paleo", emoji: "🍖" },
  { slug: "gluten-free", name: "Gluten-Free", emoji: "🍞" },
  { slug: "mediterranean", name: "Mediterranean", emoji: "🐟" },
];

export const RegisterScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<AuthStackParamList, "Register">>();
  const { signUp } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [selectedProtocol, setSelectedProtocol] = useState("keto");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleRegister = async () => {
    if (!email || !password || !confirmPassword) {
      setError("Please fill in all fields");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    setError(null);
    setIsLoading(true);
    try {
      await signUp(email, password, selectedProtocol);
    } catch (err) {
      const errMessage = err instanceof Error ? err.message : "Failed to register";
      setError(errMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <View style={styles.header}>
        <Text style={styles.title}>Create Account</Text>
        <Text style={styles.subtitle}>Join DietScan to start scanning</Text>
      </View>

      {error ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <View style={styles.inputContainer}>
        <Text style={styles.label}>Email Address</Text>
        <TextInput
          style={styles.input}
          placeholder="email@example.com"
          placeholderTextColor="#6b7280"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />
      </View>

      <View style={styles.inputContainer}>
        <Text style={styles.label}>Password</Text>
        <TextInput
          style={styles.input}
          placeholder="••••••••"
          placeholderTextColor="#6b7280"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoCapitalize="none"
        />
      </View>

      <View style={styles.inputContainer}>
        <Text style={styles.label}>Confirm Password</Text>
        <TextInput
          style={styles.input}
          placeholder="••••••••"
          placeholderTextColor="#6b7280"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry
          autoCapitalize="none"
        />
      </View>

      <View style={styles.inputContainer}>
        <Text style={styles.label}>Select Dietary Protocol</Text>
        <View style={styles.protocolGrid}>
          {PROTOCOLS.map((protocol) => {
            const isSelected = selectedProtocol === protocol.slug;
            return (
              <TouchableOpacity
                key={protocol.slug}
                style={[
                  styles.protocolCard,
                  isSelected && styles.protocolCardSelected,
                ]}
                onPress={() => setSelectedProtocol(protocol.slug)}
              >
                <Text style={styles.protocolEmoji}>{protocol.emoji}</Text>
                <Text
                  style={[
                    styles.protocolName,
                    isSelected && styles.protocolNameSelected,
                  ]}
                >
                  {protocol.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <TouchableOpacity 
        style={styles.button} 
        onPress={handleRegister}
        disabled={isLoading}
      >
        {isLoading ? (
          <ActivityIndicator color="#111827" />
        ) : (
          <Text style={styles.buttonText}>Sign Up</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity 
        style={styles.switchButton}
        onPress={() => navigation.navigate("Login")}
      >
        <Text style={styles.switchButtonText}>
          Already have an account? <Text style={styles.switchButtonAccent}>Sign In</Text>
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: "#111827",
    padding: 24,
    justifyContent: "center",
  },
  header: {
    alignItems: "center",
    marginBottom: 30,
  },
  title: {
    color: "#f9fafb",
    fontSize: 28,
    fontWeight: "bold",
  },
  subtitle: {
    color: "#9ca3af",
    fontSize: 14,
    marginTop: 4,
  },
  errorContainer: {
    backgroundColor: "#7f1d1d",
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#f87171",
  },
  errorText: {
    color: "#fca5a5",
    fontSize: 14,
    fontWeight: "500",
  },
  inputContainer: {
    marginBottom: 16,
  },
  label: {
    color: "#e5e7eb",
    fontSize: 14,
    fontWeight: "500",
    marginBottom: 6,
  },
  input: {
    backgroundColor: "#1f2937",
    borderWidth: 1,
    borderColor: "#374151",
    borderRadius: 8,
    padding: 12,
    color: "#f9fafb",
    fontSize: 16,
  },
  protocolGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 4,
  },
  protocolCard: {
    backgroundColor: "#1f2937",
    borderWidth: 1,
    borderColor: "#374151",
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  protocolCardSelected: {
    borderColor: "#10b981",
    backgroundColor: "rgba(16, 185, 129, 0.1)",
  },
  protocolEmoji: {
    fontSize: 16,
  },
  protocolName: {
    color: "#9ca3af",
    fontSize: 14,
    fontWeight: "500",
  },
  protocolNameSelected: {
    color: "#10b981",
    fontWeight: "bold",
  },
  button: {
    backgroundColor: "#10b981",
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 20,
  },
  buttonText: {
    color: "#111827",
    fontSize: 16,
    fontWeight: "bold",
  },
  switchButton: {
    marginTop: 20,
    alignItems: "center",
    marginBottom: 20,
  },
  switchButtonText: {
    color: "#9ca3af",
    fontSize: 14,
  },
  switchButtonAccent: {
    color: "#10b981",
    fontWeight: "bold",
  },
});

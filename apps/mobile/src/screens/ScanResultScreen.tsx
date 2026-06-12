import React from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import * as Haptics from "expo-haptics";
import { RootStackParamList } from "../navigation/RootNavigator";
import { useAuth } from "../store/useAuth";

type Props = NativeStackScreenProps<RootStackParamList, "ScanResult">;

export const ScanResultScreen: React.FC<Props> = ({ route, navigation }) => {
  const { result } = route.params;
  const { user } = useAuth();
  const activeProtocol = user?.dietaryProtocol || "keto";

  const handleLogToJournal = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    alert("Log to Journal: Product logged successfully!");
  };

  const handleFindAlternatives = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    alert("Find Alternatives: Showing alternatives for " + result.name);
  };

  const { passed, score, violations } = result.complianceReport;

  // Determine color coding for each ingredient:
  // - Red: Banned (present in violations)
  // - Green: Compliant (known in DB and not banned)
  // - Yellow: Uncertain (not found in local DB)
  const isBanned = (ingName: string) =>
    violations.some((v) => v.ingredient.toLowerCase() === ingName.toLowerCase());

  // Check if ingredient exists in local DB but isn't banned (so it is green/compliant)
  // We can pass/inject the DB check if we want, or do a simple check.
  // Actually, any ingredient that's not in violations:
  // If it's a known food ingredient from our dictionary (e.g. we can check its category or list), it is green.
  // If we don't know it, it's yellow.
  // Let's import the local database list of names/aliases to check if it's a known ingredient.
  const { INGREDIENTS } = require("../data/ingredients");
  const isKnown = (ingName: string) => {
    const nameLower = ingName.toLowerCase();
    return INGREDIENTS.some(
      (i: any) => i.name.toLowerCase() === nameLower || i.aliases.some((a: string) => a.toLowerCase() === nameLower)
    );
  };

  const getIngredientColor = (ingName: string) => {
    if (isBanned(ingName)) {
      return { bg: "#fef2f2", text: "#991b1b", border: "#fca5a5", badge: "🔴 Banned" };
    }
    if (isKnown(ingName)) {
      return { bg: "#f0fdf4", text: "#166534", border: "#86efac", badge: "🟢 Compliant" };
    }
    return { bg: "#fffbeb", text: "#92400e", border: "#fde047", badge: "🟡 Uncertain" };
  };

  // Extract nutrition values if available
  const nutriments = result.nutritionFacts || {};
  const calories = nutriments["energy-kcal_100g"] || nutriments["energy-kcal"] || null;
  const fat = nutriments["fat_100g"] || nutriments["fat"] || null;
  const saturatedFat = nutriments["saturated-fat_100g"] || nutriments["saturated-fat"] || null;
  const carbs = nutriments["carbohydrates_100g"] || nutriments["carbohydrates"] || null;
  const sugars = nutriments["sugars_100g"] || nutriments["sugars"] || null;
  const protein = nutriments["proteins_100g"] || nutriments["proteins"] || null;
  const salt = nutriments["salt_100g"] || nutriments["salt"] || null;
  const fiber = nutriments["fiber_100g"] || nutriments["fiber"] || null;

  const hasNutrition = calories !== null || fat !== null || carbs !== null || protein !== null;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Scan Details</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Product Meta */}
        <View style={styles.productCard}>
          <Text style={styles.productBrand}>{result.brand || "Generic Brand"}</Text>
          <Text style={styles.productName}>{result.name}</Text>
          {result.barcode && <Text style={styles.productBarcode}>UPC/EAN: {result.barcode}</Text>}
        </View>

        {/* Compliance Results */}
        <View style={[styles.complianceCard, passed ? styles.passCard : styles.failCard]}>
          <View style={styles.complianceHeader}>
            <Text style={styles.complianceEmoji}>{passed ? "🟢" : "🔴"}</Text>
            <View>
              <Text style={styles.complianceTitle}>
                {passed ? "Protocol Compliant" : "Non-Compliant"}
              </Text>
              <Text style={styles.complianceSubtitle}>
                Protocol: {activeProtocol.toUpperCase()}
              </Text>
            </View>
            <View style={styles.scoreContainer}>
              <Text style={styles.scoreNumber}>{score}</Text>
              <Text style={styles.scoreLabel}>Score</Text>
            </View>
          </View>

          {violations.length > 0 && (
            <View style={styles.violationsContainer}>
              <Text style={styles.violationsTitle}>Dietary Violations:</Text>
              {violations.map((violation, index) => (
                <View key={index} style={styles.violationItem}>
                  <Text style={styles.violationBullet}>•</Text>
                  <Text style={styles.violationText}>
                    <Text style={styles.bold}>{violation.ingredient}</Text> falls under the banned category{" "}
                    <Text style={styles.italic}>{violation.category}</Text> ({violation.reason}).
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Ingredients List */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Ingredients Breakdown</Text>
          <Text style={styles.sectionSubtitle}>
            Color-coded assessment based on local database
          </Text>

          {result.ingredients.length === 0 ? (
            <Text style={styles.noIngredientsText}>No ingredients listed.</Text>
          ) : (
            <View style={styles.ingredientsList}>
              {result.ingredients.map((ing, index) => {
                const colors = getIngredientColor(ing);
                return (
                  <View
                    key={index}
                    style={[
                      styles.ingredientItem,
                      { backgroundColor: colors.bg, borderColor: colors.border },
                    ]}
                  >
                    <Text style={[styles.ingredientText, { color: colors.text }]}>{ing}</Text>
                    <Text style={[styles.ingredientBadge, { color: colors.text }]}>
                      {colors.badge}
                    </Text>
                  </View>
                );
              })}
            </View>
          )}
        </View>

        {/* Nutrition Table */}
        {hasNutrition && (
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Nutrition Facts</Text>
            <Text style={styles.sectionSubtitle}>Values per 100g</Text>

            <View style={styles.nutritionTable}>
              {calories !== null && (
                <View style={styles.nutritionRow}>
                  <Text style={styles.nutritionLabel}>Calories</Text>
                  <Text style={styles.nutritionValue}>{Math.round(Number(calories))} kcal</Text>
                </View>
              )}
              {fat !== null && (
                <View style={styles.nutritionRow}>
                  <Text style={styles.nutritionLabel}>Total Fat</Text>
                  <Text style={styles.nutritionValue}>{Number(fat).toFixed(1)}g</Text>
                </View>
              )}
              {saturatedFat !== null && (
                <View style={[styles.nutritionRow, styles.subNutritionRow]}>
                  <Text style={styles.subNutritionLabel}>Saturated Fat</Text>
                  <Text style={styles.nutritionValue}>{Number(saturatedFat).toFixed(1)}g</Text>
                </View>
              )}
              {carbs !== null && (
                <View style={styles.nutritionRow}>
                  <Text style={styles.nutritionLabel}>Total Carbohydrates</Text>
                  <Text style={styles.nutritionValue}>{Number(carbs).toFixed(1)}g</Text>
                </View>
              )}
              {sugars !== null && (
                <View style={[styles.nutritionRow, styles.subNutritionRow]}>
                  <Text style={styles.subNutritionLabel}>Sugars</Text>
                  <Text style={styles.nutritionValue}>{Number(sugars).toFixed(1)}g</Text>
                </View>
              )}
              {fiber !== null && (
                <View style={styles.nutritionRow}>
                  <Text style={styles.nutritionLabel}>Dietary Fiber</Text>
                  <Text style={styles.nutritionValue}>{Number(fiber).toFixed(1)}g</Text>
                </View>
              )}
              {protein !== null && (
                <View style={styles.nutritionRow}>
                  <Text style={styles.nutritionLabel}>Protein</Text>
                  <Text style={styles.nutritionValue}>{Number(protein).toFixed(1)}g</Text>
                </View>
              )}
              {salt !== null && (
                <View style={styles.nutritionRow}>
                  <Text style={styles.nutritionLabel}>Sodium (Salt)</Text>
                  <Text style={styles.nutritionValue}>{Number(salt).toFixed(2)}g</Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Action Buttons */}
        <View style={styles.buttonContainer}>
          <TouchableOpacity style={styles.logButton} onPress={handleLogToJournal}>
            <Text style={styles.logButtonText}>📓 Log to Journal</Text>
          </TouchableOpacity>

          {!passed && (
            <TouchableOpacity style={styles.altButton} onPress={handleFindAlternatives}>
              <Text style={styles.altButtonText}>🔍 Find Alternatives</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#111827",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    height: 56,
    borderBottomWidth: 1,
    borderBottomColor: "#1f2937",
    paddingHorizontal: 16,
  },
  backButton: {
    paddingVertical: 8,
  },
  backButtonText: {
    color: "#10b981",
    fontSize: 16,
    fontWeight: "600",
  },
  headerTitle: {
    color: "#f9fafb",
    fontSize: 18,
    fontWeight: "bold",
  },
  placeholder: {
    width: 50,
  },
  scrollContent: {
    padding: 16,
  },
  productCard: {
    backgroundColor: "#1f2937",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#374151",
  },
  productBrand: {
    color: "#9ca3af",
    fontSize: 14,
    textTransform: "uppercase",
    fontWeight: "600",
    letterSpacing: 0.5,
  },
  productName: {
    color: "#f9fafb",
    fontSize: 22,
    fontWeight: "bold",
    marginVertical: 4,
  },
  productBarcode: {
    color: "#6b7280",
    fontSize: 12,
    marginTop: 4,
  },
  complianceCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
  },
  passCard: {
    backgroundColor: "rgba(6, 78, 59, 0.2)",
    borderColor: "#065f46",
  },
  failCard: {
    backgroundColor: "rgba(153, 27, 27, 0.2)",
    borderColor: "#991b1b",
  },
  complianceHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  complianceEmoji: {
    fontSize: 32,
    marginRight: 12,
  },
  complianceTitle: {
    color: "#f9fafb",
    fontSize: 18,
    fontWeight: "bold",
  },
  complianceSubtitle: {
    color: "#9ca3af",
    fontSize: 13,
    marginTop: 2,
  },
  scoreContainer: {
    marginLeft: "auto",
    alignItems: "center",
    backgroundColor: "rgba(31, 41, 55, 0.5)",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  scoreNumber: {
    color: "#f9fafb",
    fontSize: 18,
    fontWeight: "bold",
  },
  scoreLabel: {
    color: "#9ca3af",
    fontSize: 10,
  },
  violationsContainer: {
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.1)",
  },
  violationsTitle: {
    color: "#fca5a5",
    fontSize: 14,
    fontWeight: "bold",
    marginBottom: 8,
  },
  violationItem: {
    flexDirection: "row",
    marginBottom: 6,
  },
  violationBullet: {
    color: "#fca5a5",
    marginRight: 6,
    fontSize: 14,
  },
  violationText: {
    color: "#f3f4f6",
    fontSize: 13,
    flex: 1,
  },
  sectionCard: {
    backgroundColor: "#1f2937",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#374151",
  },
  sectionTitle: {
    color: "#f9fafb",
    fontSize: 16,
    fontWeight: "bold",
  },
  sectionSubtitle: {
    color: "#9ca3af",
    fontSize: 12,
    marginBottom: 12,
    marginTop: 2,
  },
  ingredientsList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  ingredientItem: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  ingredientText: {
    fontSize: 13,
    fontWeight: "600",
    marginRight: 6,
  },
  ingredientBadge: {
    fontSize: 11,
    fontWeight: "bold",
  },
  noIngredientsText: {
    color: "#9ca3af",
    fontStyle: "italic",
  },
  nutritionTable: {
    borderWidth: 1,
    borderColor: "#374151",
    borderRadius: 8,
    overflow: "hidden",
  },
  nutritionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#374151",
    backgroundColor: "#111827",
  },
  subNutritionRow: {
    paddingLeft: 24,
    backgroundColor: "#1f2937",
  },
  nutritionLabel: {
    color: "#f9fafb",
    fontSize: 13,
    fontWeight: "600",
  },
  subNutritionLabel: {
    color: "#9ca3af",
    fontSize: 13,
  },
  nutritionValue: {
    color: "#f9fafb",
    fontSize: 13,
    fontWeight: "bold",
  },
  buttonContainer: {
    gap: 12,
    marginTop: 8,
    marginBottom: 24,
  },
  logButton: {
    backgroundColor: "#10b981",
    borderRadius: 8,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  logButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "bold",
  },
  altButton: {
    backgroundColor: "transparent",
    borderColor: "#10b981",
    borderWidth: 1,
    borderRadius: 8,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  altButtonText: {
    color: "#10b981",
    fontSize: 16,
    fontWeight: "bold",
  },
  bold: {
    fontWeight: "bold",
  },
  italic: {
    fontStyle: "italic",
  },
});

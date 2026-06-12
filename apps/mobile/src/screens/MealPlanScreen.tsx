import { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  FlatList,
  Modal,
  TextInput,
  ActivityIndicator,
  Alert,
} from "react-native";
import { api } from "../services/api";
import { useAuth } from "../store/useAuth";
import { getDb } from "../lib/db";
import * as Haptics from "expo-haptics";

interface MealPlan {
  id: string;
  weekStart: string;
  protocolSlug: string;
}

interface MealEntry {
  id: string;
  dayOfWeek: string;
  mealType: "breakfast" | "lunch" | "dinner" | "snack";
  productId: string;
  name: string;
  brand: string | null;
  ingredients: string[];
  nutrition: Record<string, unknown>;
}

interface ComplianceDayInfo {
  score: number;
  status: "green" | "yellow" | "red" | "gray";
  violationsCount: number;
}

interface ComplianceForecast {
  protocolSlug: string;
  days: Record<string, ComplianceDayInfo>;
}

interface SearchProduct {
  id: string;
  name: string;
  brand: string | null;
}

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const MEAL_TYPES: ("breakfast" | "lunch" | "dinner" | "snack")[] = ["breakfast", "lunch", "dinner", "snack"];

export const MealPlanScreen = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [plans, setPlans] = useState<MealPlan[]>([]);
  const [currentPlan, setCurrentPlan] = useState<MealPlan | null>(null);
  const [entries, setEntries] = useState<MealEntry[]>([]);
  const [compliance, setCompliance] = useState<ComplianceForecast | null>(null);

  // UI Navigation states
  const [selectedDay, setSelectedDay] = useState("Monday");

  // Search/Add entry modal state
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchProduct[]>([]);
  const [searching, setSearching] = useState(false);
  const [targetSlot, setTargetSlot] = useState<{
    day: string;
    mealType: "breakfast" | "lunch" | "dinner" | "snack";
  } | null>(null);

  useEffect(() => {
    fetchMealPlans();
  }, []);

  const fetchMealPlans = async () => {
    setLoading(true);
    try {
      const response = await api.get<MealPlan[]>("/meal-plans");
      setPlans(response.data);
      if (response.data.length > 0) {
        // Automatically select the most recent plan
        await selectPlan(response.data[0]);
      }
    } catch {
      Alert.alert("Error", "Failed to fetch meal plans");
    } finally {
      setLoading(false);
    }
  };

  const selectPlan = async (plan: MealPlan) => {
    setCurrentPlan(plan);
    setLoading(true);
    try {
      // Fetch plan entries
      const entriesRes = await api.get<{ entries: MealEntry[] }>(`/meal-plans/${plan.id}`);
      setEntries(entriesRes.data.entries || []);

      // Fetch compliance forecast
      const complianceRes = await api.get<ComplianceForecast>(`/meal-plans/${plan.id}/compliance`);
      setCompliance(complianceRes.data);
    } catch {
      Alert.alert("Error", "Failed to fetch meal plan details");
    } finally {
      setLoading(false);
    }
  };

  const getMondayOfCurrentWeek = () => {
    const today = new Date();
    const day = today.getDay();
    const diff = today.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(today.setDate(diff));
    return monday.toISOString().split("T")[0];
  };

  const handleCreatePlan = async () => {
    setLoading(true);
    try {
      const protocolSlug = user?.dietaryProtocol || "keto";
      const weekStart = getMondayOfCurrentWeek();

      // Check if a plan for this week already exists
      const existing = plans.find((p) => p.weekStart === weekStart);
      if (existing) {
        await selectPlan(existing);
        return;
      }

      const response = await api.post<MealPlan>("/meal-plans", {
        weekStart,
        protocolSlug,
      });

      setPlans((prev) => [response.data, ...prev]);
      await selectPlan(response.data);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      Alert.alert("Error", "Failed to create a new meal plan");
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveEntry = async (entryId: string) => {
    if (!currentPlan) return;

    // Optimistic update
    const originalEntries = [...entries];
    setEntries((prev) => prev.filter((e) => e.id !== entryId));

    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await api.delete(`/meal-plans/${currentPlan.id}/entries/${entryId}`);
      
      // Refresh compliance
      const complianceRes = await api.get<ComplianceForecast>(`/meal-plans/${currentPlan.id}/compliance`);
      setCompliance(complianceRes.data);
    } catch {
      // Rollback
      setEntries(originalEntries);
      Alert.alert("Error", "Failed to remove meal entry");
    }
  };

  // Product Search logic
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(() => {
      searchProducts();
    }, 400);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const searchProducts = async () => {
    setSearching(true);
    try {
      const db = await getDb();
      const localProducts = await db.getAllAsync<{ id: string; name: string; brand: string | null }>(
        "SELECT id, name, brand FROM products WHERE name LIKE ? OR brand LIKE ? LIMIT 10",
        [`%${searchQuery}%`, `%${searchQuery}%`]
      );

      let remoteProducts: SearchProduct[] = [];
      try {
        const response = await api.get<{ hits: SearchProduct[] }>("/products", {
          params: { q: searchQuery },
        });
        remoteProducts = response.data.hits || [];
      } catch {
        // Ignore API failures for offline search
      }

      const merged = [...localProducts, ...remoteProducts];
      const uniqueMap = new Map<string, SearchProduct>();
      for (const p of merged) {
        uniqueMap.set(p.id, p);
      }

      setSearchResults(Array.from(uniqueMap.values()));
    } catch {
      // Search failed
    } finally {
      setSearching(false);
    }
  };

  const handleAddMeal = async (productId: string) => {
    if (!currentPlan || !targetSlot) return;

    try {
      await api.post(`/meal-plans/${currentPlan.id}/entries`, {
        dayOfWeek: targetSlot.day,
        mealType: targetSlot.mealType,
        productId,
      });

      // Reload plan entries and compliance details
      const entriesRes = await api.get<{ entries: MealEntry[] }>(`/meal-plans/${currentPlan.id}`);
      setEntries(entriesRes.data.entries || []);

      const complianceRes = await api.get<ComplianceForecast>(`/meal-plans/${currentPlan.id}/compliance`);
      setCompliance(complianceRes.data);

      setIsSearchOpen(false);
      setSearchQuery("");
      setTargetSlot(null);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      Alert.alert("Error", "Failed to add meal to planner");
    }
  };

  const openSearchForSlot = (day: string, mealType: "breakfast" | "lunch" | "dinner" | "snack") => {
    setTargetSlot({ day, mealType });
    setIsSearchOpen(true);
  };

  // Helper to extract macros from nutritional information
  const getMacrosForDay = (day: string) => {
    const dayEntries = entries.filter((e) => e.dayOfWeek === day);
    let protein = 0;
    let carbs = 0;
    let fat = 0;

    dayEntries.forEach((e) => {
      const n = e.nutrition || {};
      
      // Parse protein
      const rawProtein = n.protein ?? n.proteins ?? n.protein_100g ?? 0;
      protein += Number(rawProtein) || 0;

      // Parse carbs
      const rawCarbs = n.carbohydrates ?? n.carbs ?? n.carbohydrates_100g ?? 0;
      carbs += Number(rawCarbs) || 0;

      // Parse fat
      const rawFat = n.fat ?? n.fats ?? n.fat_100g ?? 0;
      fat += Number(rawFat) || 0;
    });

    return {
      protein: Math.round(protein),
      carbs: Math.round(carbs),
      fat: Math.round(fat),
    };
  };

  const getDayComplianceColor = (day: string): string => {
    if (!compliance || !compliance.days[day]) return "#9ca3af";
    const status = compliance.days[day].status;
    if (status === "green") return "#10b981";
    if (status === "yellow") return "#f59e0b";
    if (status === "red") return "#ef4444";
    return "#374151"; // Gray for no meals
  };

  const activeDayMacros = getMacrosForDay(selectedDay);
  const activeDayCompliance = compliance?.days[selectedDay];

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Weekly Meal Planner</Text>
        {currentPlan && (
          <Text style={styles.headerSubtitle}>
            Week starting: {currentPlan.weekStart} ({currentPlan.protocolSlug.toUpperCase()})
          </Text>
        )}
      </View>

      {loading && !currentPlan ? (
        <ActivityIndicator size="large" color="#10b981" style={styles.loader} />
      ) : !currentPlan ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyEmoji}>📅</Text>
          <Text style={styles.emptyText}>No active meal plans found.</Text>
          <TouchableOpacity style={styles.createButton} onPress={handleCreatePlan}>
            <Text style={styles.createButtonText}>Start Weekly Plan</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={{ flex: 1 }}>
          {/* Horizontal Day Selector */}
          <View style={styles.daySelectorContainer}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.daySelectorScroll}>
              {DAYS.map((day) => {
                const isSelected = selectedDay === day;
                const dotColor = getDayComplianceColor(day);
                return (
                  <TouchableOpacity
                    key={day}
                    style={[styles.dayButton, isSelected && styles.dayButtonActive]}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setSelectedDay(day);
                    }}
                  >
                    <Text style={[styles.dayButtonText, isSelected && styles.dayButtonTextActive]}>
                      {day.substring(0, 3)}
                    </Text>
                    <View style={[styles.complianceDot, { backgroundColor: dotColor }]} />
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {/* Compliance Forecast & Macros Bar */}
          <View style={styles.statusSection}>
            <View style={styles.statusCard}>
              <Text style={styles.statusTitle}>Day Compliance Forecast</Text>
              {activeDayCompliance ? (
                <View style={styles.forecastRow}>
                  <View style={[styles.forecastBar, { backgroundColor: getDayComplianceColor(selectedDay) }]} />
                  <Text style={styles.forecastScore}>
                    {activeDayCompliance.status === "gray"
                      ? "No Meals Planned"
                      : `${activeDayCompliance.score}% Compliant`}
                  </Text>
                </View>
              ) : (
                <Text style={styles.statusPlaceholder}>Calculating...</Text>
              )}
            </View>

            <View style={styles.macrosCard}>
              <Text style={styles.statusTitle}>Daily Macros Target</Text>
              <View style={styles.macrosRow}>
                <View style={styles.macroCol}>
                  <Text style={styles.macroVal}>{activeDayMacros.protein}g</Text>
                  <Text style={styles.macroLabel}>Protein</Text>
                </View>
                <View style={styles.macroCol}>
                  <Text style={styles.macroVal}>{activeDayMacros.carbs}g</Text>
                  <Text style={styles.macroLabel}>Carbs</Text>
                </View>
                <View style={styles.macroCol}>
                  <Text style={styles.macroVal}>{activeDayMacros.fat}g</Text>
                  <Text style={styles.macroLabel}>Fat</Text>
                </View>
              </View>
            </View>
          </View>

          {/* Daily Slots List */}
          <ScrollView contentContainerStyle={styles.slotsScroll} style={{ flex: 1 }}>
            {MEAL_TYPES.map((mealType) => {
              const dayMeals = entries.filter((e) => e.dayOfWeek === selectedDay && e.mealType === mealType);

              return (
                <View key={mealType} style={styles.slotCard}>
                  <Text style={styles.slotHeader}>{mealType.toUpperCase()}</Text>

                  {dayMeals.length === 0 ? (
                    <TouchableOpacity
                      style={styles.addMealSlotButton}
                      onPress={() => openSearchForSlot(selectedDay, mealType)}
                    >
                      <Text style={styles.addMealSlotText}>➕ Add {mealType}</Text>
                    </TouchableOpacity>
                  ) : (
                    dayMeals.map((meal) => (
                      <View key={meal.id} style={styles.mealRow}>
                        <View style={styles.mealDetails}>
                          <Text style={styles.mealName}>{meal.name}</Text>
                          {meal.brand && <Text style={styles.mealBrand}>{meal.brand}</Text>}
                        </View>
                        <TouchableOpacity
                          onPress={() => handleRemoveEntry(meal.id)}
                          style={styles.removeMealButton}
                        >
                          <Text style={styles.removeMealIcon}>❌</Text>
                        </TouchableOpacity>
                      </View>
                    ))
                  )}
                </View>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* Search Product Modal */}
      <Modal
        visible={isSearchOpen}
        animationType="slide"
        onRequestClose={() => {
          setIsSearchOpen(false);
          setTargetSlot(null);
          setSearchQuery("");
        }}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              Add to {targetSlot?.day} - {targetSlot?.mealType}
            </Text>
            <TouchableOpacity
              onPress={() => {
                setIsSearchOpen(false);
                setTargetSlot(null);
                setSearchQuery("");
              }}
              style={styles.closeButton}
            >
              <Text style={styles.closeButtonText}>Close</Text>
            </TouchableOpacity>
          </View>

          <TextInput
            style={styles.searchInput}
            placeholder="Search products by name..."
            placeholderTextColor="#9ca3af"
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoFocus
          />

          {searching ? (
            <ActivityIndicator size="large" color="#10b981" style={styles.loader} />
          ) : searchResults.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>
                {searchQuery ? "No products found." : "Search database products to add..."}
              </Text>
            </View>
          ) : (
            <FlatList
              data={searchResults}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.searchRow} onPress={() => handleAddMeal(item.id)}>
                  <View style={styles.searchInfo}>
                    <Text style={styles.searchName}>{item.name}</Text>
                    {item.brand && <Text style={styles.searchBrand}>{item.brand}</Text>}
                  </View>
                  <Text style={styles.searchAddIcon}>➕</Text>
                </TouchableOpacity>
              )}
              contentContainerStyle={styles.listContent}
            />
          )}
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#111827",
  },
  header: {
    padding: 16,
    backgroundColor: "#1f2937",
    borderBottomWidth: 1,
    borderBottomColor: "#374151",
  },
  headerTitle: {
    color: "#f9fafb",
    fontSize: 22,
    fontWeight: "bold",
  },
  headerSubtitle: {
    color: "#9ca3af",
    fontSize: 14,
    marginTop: 4,
  },
  loader: {
    marginTop: 40,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 40,
  },
  emptyEmoji: {
    fontSize: 64,
    marginBottom: 20,
  },
  emptyText: {
    color: "#9ca3af",
    fontSize: 16,
    textAlign: "center",
    marginBottom: 20,
  },
  createButton: {
    backgroundColor: "#10b981",
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  createButtonText: {
    color: "#ffffff",
    fontWeight: "bold",
    fontSize: 16,
  },
  daySelectorContainer: {
    backgroundColor: "#1f2937",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#374151",
  },
  daySelectorScroll: {
    paddingHorizontal: 16,
  },
  dayButton: {
    width: 60,
    height: 60,
    backgroundColor: "#374151",
    borderRadius: 30,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
    position: "relative",
  },
  dayButtonActive: {
    backgroundColor: "#10b981",
  },
  dayButtonText: {
    color: "#d1d5db",
    fontWeight: "bold",
    fontSize: 14,
  },
  dayButtonTextActive: {
    color: "#ffffff",
  },
  complianceDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    position: "absolute",
    bottom: 6,
  },
  statusSection: {
    flexDirection: "row",
    padding: 16,
    justifyContent: "space-between",
  },
  statusCard: {
    backgroundColor: "#1f2937",
    borderRadius: 12,
    padding: 12,
    flex: 1,
    marginRight: 8,
    borderWidth: 1,
    borderColor: "#374151",
  },
  macrosCard: {
    backgroundColor: "#1f2937",
    borderRadius: 12,
    padding: 12,
    flex: 1,
    marginLeft: 8,
    borderWidth: 1,
    borderColor: "#374151",
  },
  statusTitle: {
    color: "#9ca3af",
    fontSize: 12,
    fontWeight: "bold",
    marginBottom: 8,
    textTransform: "uppercase",
  },
  statusPlaceholder: {
    color: "#6b7280",
    fontSize: 14,
  },
  forecastRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },
  forecastBar: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  forecastScore: {
    color: "#f9fafb",
    fontSize: 14,
    fontWeight: "bold",
  },
  macrosRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  macroCol: {
    alignItems: "center",
  },
  macroVal: {
    color: "#f9fafb",
    fontSize: 14,
    fontWeight: "bold",
  },
  macroLabel: {
    color: "#9ca3af",
    fontSize: 10,
    marginTop: 2,
  },
  slotsScroll: {
    padding: 16,
  },
  slotCard: {
    backgroundColor: "#1f2937",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#374151",
  },
  slotHeader: {
    color: "#10b981",
    fontSize: 14,
    fontWeight: "bold",
    marginBottom: 12,
    letterSpacing: 1,
  },
  addMealSlotButton: {
    backgroundColor: "#111827",
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "#4b5563",
    borderRadius: 8,
    padding: 16,
    alignItems: "center",
  },
  addMealSlotText: {
    color: "#9ca3af",
    fontSize: 14,
    fontWeight: "600",
  },
  mealRow: {
    flexDirection: "row",
    backgroundColor: "#111827",
    borderRadius: 8,
    padding: 14,
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#374151",
  },
  mealDetails: {
    flex: 1,
  },
  mealName: {
    color: "#f9fafb",
    fontSize: 16,
    fontWeight: "600",
  },
  mealBrand: {
    color: "#9ca3af",
    fontSize: 13,
    marginTop: 2,
  },
  removeMealButton: {
    padding: 8,
  },
  removeMealIcon: {
    fontSize: 14,
  },
  // Search Modal
  modalContainer: {
    flex: 1,
    backgroundColor: "#111827",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    backgroundColor: "#1f2937",
    borderBottomWidth: 1,
    borderBottomColor: "#374151",
  },
  modalTitle: {
    color: "#f9fafb",
    fontSize: 18,
    fontWeight: "bold",
  },
  closeButton: {
    padding: 8,
  },
  closeButtonText: {
    color: "#ef4444",
    fontSize: 16,
    fontWeight: "bold",
  },
  searchInput: {
    backgroundColor: "#1f2937",
    borderWidth: 1,
    borderColor: "#374151",
    borderRadius: 8,
    color: "#f9fafb",
    padding: 12,
    margin: 16,
    fontSize: 16,
  },
  listContent: {
    padding: 16,
  },
  searchRow: {
    backgroundColor: "#1f2937",
    borderRadius: 8,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#374151",
  },
  searchInfo: {
    flex: 1,
  },
  searchName: {
    color: "#f9fafb",
    fontSize: 16,
    fontWeight: "600",
  },
  searchBrand: {
    color: "#9ca3af",
    fontSize: 13,
    marginTop: 2,
  },
  searchAddIcon: {
    fontSize: 20,
  },
});

import { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { api } from "../services/api";
import { MacroRing } from "../components/MacroRing";
import { StreakCounter } from "../components/StreakCounter";

interface DailyMacroSummary {
  calories: number;
  carbs: number;
  protein: number;
  fat: number;
  fiber: number;
  salt: number;
}

interface DailyItem {
  id: string;
  productId: string;
  name: string;
  brand: string | null;
  scannedAt: string;
  nutrition: DailyMacroSummary;
}

interface DailyNutritionResponse {
  date: string;
  summary: DailyMacroSummary;
  targets: DailyMacroSummary;
  items: DailyItem[];
}

interface WeeklyDayData extends DailyMacroSummary {
  date: string;
  complianceScore: number;
}

interface WeeklyNutritionResponse {
  dailyData: WeeklyDayData[];
  streak: number;
  averageCompliance: number;
}

export const NutritionScreen = () => {
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [dailyData, setDailyData] = useState<DailyNutritionResponse | null>(null);
  const [weeklyData, setWeeklyData] = useState<WeeklyNutritionResponse | null>(null);

  const fetchNutritionData = async () => {
    try {
      const [dailyRes, weeklyRes] = await Promise.all([
        api.get<DailyNutritionResponse>("/nutrition/daily"),
        api.get<WeeklyNutritionResponse>("/nutrition/weekly"),
      ]);

      setDailyData(dailyRes.data);
      setWeeklyData(weeklyRes.data);
    } catch (error) {
      console.error("[NutritionScreen] Error fetching nutrition data:", error);
      Alert.alert("Error", "Failed to fetch nutrition dashboard data.");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchNutritionData();
    }, [])
  );

  const onRefresh = () => {
    setIsRefreshing(true);
    fetchNutritionData();
  };

  const getDayName = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString(undefined, { weekday: "short" });
    } catch {
      return dateStr;
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return "#10b981"; // green
    if (score >= 50) return "#f59e0b"; // orange
    if (score > 0) return "#ef4444"; // red
    return "#4b5563"; // gray
  };

  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#10b981" />
      </View>
    );
  }

  // Calculate percentages safely
  const calPercent = dailyData
    ? (dailyData.summary.calories / (dailyData.targets.calories || 2000)) * 100
    : 0;
  const proteinPercent = dailyData
    ? (dailyData.summary.protein / (dailyData.targets.protein || 80)) * 100
    : 0;
  const carbsPercent = dailyData
    ? (dailyData.summary.carbs / (dailyData.targets.carbs || 250)) * 100
    : 0;
  const fatPercent = dailyData
    ? (dailyData.summary.fat / (dailyData.targets.fat || 70)) * 100
    : 0;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>📊 Nutrition Dashboard</Text>
        <Text style={styles.headerSubtitle}>Monitor your daily macros and compliance trends</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor="#10b981" />
        }
      >
        {/* Streak Component */}
        <StreakCounter streak={weeklyData?.streak || 0} />

        {/* Macro Rings Grid */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Today's Macronutrients</Text>
          <View style={styles.ringsGrid}>
            <View style={styles.ringRow}>
              <MacroRing
                percentage={calPercent}
                color="#3b82f6"
                label="Calories"
                value={`${Math.round(dailyData?.summary.calories || 0)} kcal`}
              />
              <MacroRing
                percentage={proteinPercent}
                color="#ef4444"
                label="Protein"
                value={`${Math.round(dailyData?.summary.protein || 0)}g`}
              />
            </View>
            <View style={styles.ringRow}>
              <MacroRing
                percentage={carbsPercent}
                color="#f59e0b"
                label="Carbs"
                value={`${Math.round(dailyData?.summary.carbs || 0)}g`}
              />
              <MacroRing
                percentage={fatPercent}
                color="#10b981"
                label="Fats"
                value={`${Math.round(dailyData?.summary.fat || 0)}g`}
              />
            </View>
          </View>
        </View>

        {/* Compliance & Nutrition Details */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Daily Details</Text>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Fiber</Text>
            <Text style={styles.detailValue}>{Math.round(dailyData?.summary.fiber || 0)}g / {dailyData?.targets.fiber || 30}g</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Salt</Text>
            <Text style={styles.detailValue}>{Math.round(dailyData?.summary.salt || 0)}g / {dailyData?.targets.salt || 6}g</Text>
          </View>
          <View style={[styles.detailRow, { borderBottomWidth: 0 }]}>
            <Text style={styles.detailLabel}>Average Weekly Compliance</Text>
            <Text style={[styles.detailValue, { color: getScoreColor(weeklyData?.averageCompliance || 0), fontWeight: "bold" }]}>
              {Math.round(weeklyData?.averageCompliance || 0)}%
            </Text>
          </View>
        </View>

        {/* Weekly Trends Chart (Simulated list) */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Weekly Trends</Text>
          {weeklyData?.dailyData.map((day, idx) => {
            const scoreColor = getScoreColor(day.complianceScore);
            return (
              <View key={day.date || idx} style={styles.trendRow}>
                <View style={styles.trendDayContainer}>
                  <Text style={styles.trendDayText}>{getDayName(day.date)}</Text>
                  <Text style={styles.trendDateText}>
                    {day.date.split("-").slice(1).join("/")}
                  </Text>
                </View>
                
                <View style={styles.trendBarContainer}>
                  <View style={styles.trendBarInfo}>
                    <Text style={styles.trendCalText}>{Math.round(day.calories)} kcal</Text>
                    <Text style={[styles.trendScoreText, { color: scoreColor }]}>
                      {day.complianceScore > 0 ? `${Math.round(day.complianceScore)}% compliance` : "No data"}
                    </Text>
                  </View>
                  <View style={styles.progressBarBg}>
                    <View
                      style={[
                        styles.progressBarFill,
                        {
                          width: `${Math.min(day.complianceScore || 0, 100)}%`,
                          backgroundColor: scoreColor,
                        },
                      ]}
                    />
                  </View>
                </View>
              </View>
            );
          })}
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
  centerContainer: {
    flex: 1,
    backgroundColor: "#111827",
    justifyContent: "center",
    alignItems: "center",
  },
  header: {
    paddingTop: 50,
    paddingBottom: 20,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#1f2937",
    backgroundColor: "#1f2937",
  },
  headerTitle: {
    color: "#f9fafb",
    fontSize: 24,
    fontWeight: "bold",
  },
  headerSubtitle: {
    color: "#9ca3af",
    fontSize: 14,
    marginTop: 4,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
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
    marginBottom: 16,
  },
  ringsGrid: {
    alignItems: "center",
  },
  ringRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    width: "100%",
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#374151",
  },
  detailLabel: {
    color: "#9ca3af",
    fontSize: 14,
  },
  detailValue: {
    color: "#f9fafb",
    fontSize: 14,
    fontWeight: "600",
  },
  trendRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#374151",
  },
  trendDayContainer: {
    width: 60,
  },
  trendDayText: {
    color: "#f9fafb",
    fontSize: 14,
    fontWeight: "bold",
  },
  trendDateText: {
    color: "#9ca3af",
    fontSize: 11,
    marginTop: 2,
  },
  trendBarContainer: {
    flex: 1,
    marginLeft: 12,
  },
  trendBarInfo: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  trendCalText: {
    color: "#f9fafb",
    fontSize: 12,
    fontWeight: "600",
  },
  trendScoreText: {
    fontSize: 12,
    fontWeight: "bold",
  },
  progressBarBg: {
    height: 6,
    backgroundColor: "#374151",
    borderRadius: 3,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    borderRadius: 3,
  },
});

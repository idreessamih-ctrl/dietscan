import { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
  Alert,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { getDb } from "../lib/db";
import { isOnline } from "../services/sync";
import { api } from "../services/api";

interface JournalEntry {
  id: string;
  meal_type: "breakfast" | "lunch" | "dinner" | "snack";
  compliance_score: number;
  created_at: string;
  synced: number;
  product_name: string | null;
  product_brand: string | null;
}

export const JournalScreen = () => {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  const fetchJournalEntries = async () => {
    try {
      const db = await getDb();
      // Join with products table to get product name and brand
      const rows = await db.getAllAsync<{
        id: string;
        meal_type: string;
        compliance_score: number;
        created_at: string;
        synced: number;
        product_name: string | null;
        product_brand: string | null;
      }>(`
        SELECT j.id, j.meal_type, j.compliance_score, j.created_at, j.synced,
               p.name as product_name, p.brand as product_brand
        FROM meal_journal j
        LEFT JOIN products p ON j.product_id = p.id
        ORDER BY j.created_at DESC
      `);

      const mappedEntries = rows.map((row) => ({
        id: row.id,
        meal_type: row.meal_type as "breakfast" | "lunch" | "dinner" | "snack",
        compliance_score: Number(row.compliance_score),
        created_at: row.created_at,
        synced: row.synced,
        product_name: row.product_name,
        product_brand: row.product_brand,
      }));

      setEntries(mappedEntries);
    } catch (error) {
      console.error("[JournalScreen] Error loading journal entries:", error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const deleteEntry = async (id: string) => {
    Alert.alert(
      "Delete Entry",
      "Are you sure you want to delete this meal journal entry?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              const db = await getDb();
              await db.runAsync("DELETE FROM meal_journal WHERE id = ?", [id]);
              
              const online = await isOnline();
              if (online) {
                try {
                  await api.delete(`/journal/${id}`);
                } catch (err) {
                  console.warn("[JournalScreen] Server deletion failed, will be deleted on next sync or ignored:", err);
                }
              }
              
              setEntries((prev) => prev.filter((entry) => entry.id !== id));
            } catch (error) {
              console.error("[JournalScreen] Failed to delete entry:", error);
              Alert.alert("Error", "Failed to delete the journal entry.");
            }
          },
        },
      ]
    );
  };

  // Reload data whenever the screen gets focus
  useFocusEffect(
    useCallback(() => {
      fetchJournalEntries();
    }, [])
  );

  const onRefresh = () => {
    setIsRefreshing(true);
    fetchJournalEntries();
  };

  const getMealEmoji = (mealType: string) => {
    switch (mealType) {
      case "breakfast":
        return "🍳";
      case "lunch":
        return "🥗";
      case "dinner":
        return "🥩";
      default:
        return "🍎";
    }
  };

  const formatDate = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return isoString;
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return "#10b981"; // green
    if (score >= 50) return "#f59e0b"; // orange/yellow
    return "#ef4444"; // red
  };

  const renderItem = ({ item }: { item: JournalEntry }) => {
    const scoreColor = getScoreColor(item.compliance_score);
    return (
      <View style={styles.entryCard}>
        <View style={styles.cardHeader}>
          <View style={styles.mealTypeContainer}>
            <Text style={styles.mealEmoji}>{getMealEmoji(item.meal_type)}</Text>
            <View>
              <Text style={styles.mealTypeText}>
                {item.meal_type.toUpperCase()}
              </Text>
              <Text style={styles.dateText}>{formatDate(item.created_at)}</Text>
            </View>
          </View>
          <View style={[styles.scoreBadge, { borderColor: scoreColor }]}>
            <Text style={[styles.scoreText, { color: scoreColor }]}>
              {item.compliance_score}%
            </Text>
          </View>
        </View>

        <View style={styles.productInfo}>
          <Text style={styles.productName}>
            {item.product_name || "Unknown Product"}
          </Text>
          {item.product_brand && (
            <Text style={styles.productBrand}>{item.product_brand}</Text>
          )}
        </View>

        <View style={styles.cardFooter}>
          <TouchableOpacity onPress={() => deleteEntry(item.id)} style={styles.deleteButton}>
            <Text style={styles.deleteButtonText}>🗑️ Delete</Text>
          </TouchableOpacity>
          <Text style={[styles.syncStatus, item.synced === 1 ? styles.syncedText : styles.pendingText]}>
            {item.synced === 1 ? "☁️ Synced" : "⏳ Pending sync"}
          </Text>
        </View>
      </View>
    );
  };

  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#10b981" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>📓 Food Journal</Text>
        <Text style={styles.headerSubtitle}>Track your daily compliance history</Text>
      </View>

      <FlatList
        data={entries}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor="#10b981" />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyEmoji}>🍽️</Text>
            <Text style={styles.emptyTitle}>Journal is Empty</Text>
            <Text style={styles.emptySubtitle}>
              Scan food products or ingredient lists, then log them to build your compliance history.
            </Text>
          </View>
        }
      />
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
  listContent: {
    padding: 16,
    flexGrow: 1,
  },
  entryCard: {
    backgroundColor: "#1f2937",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#374151",
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  mealTypeContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  mealEmoji: {
    fontSize: 28,
    marginRight: 12,
  },
  mealTypeText: {
    color: "#f9fafb",
    fontSize: 14,
    fontWeight: "bold",
    letterSpacing: 0.5,
  },
  dateText: {
    color: "#9ca3af",
    fontSize: 12,
    marginTop: 2,
  },
  scoreBadge: {
    borderWidth: 1.5,
    borderRadius: 8,
    paddingVertical: 4,
    paddingHorizontal: 8,
    backgroundColor: "rgba(17, 24, 39, 0.3)",
  },
  scoreText: {
    fontSize: 13,
    fontWeight: "bold",
  },
  productInfo: {
    marginBottom: 12,
    paddingLeft: 40,
  },
  productName: {
    color: "#f9fafb",
    fontSize: 16,
    fontWeight: "600",
  },
  productBrand: {
    color: "#9ca3af",
    fontSize: 12,
    marginTop: 2,
  },
  cardFooter: {
    borderTopWidth: 1,
    borderTopColor: "#374151",
    paddingTop: 8,
    flexDirection: "row",
    justifyContent: "flex-end",
  },
  deleteButton: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    backgroundColor: "rgba(239, 68, 68, 0.1)",
    marginRight: "auto",
  },
  deleteButtonText: {
    color: "#ef4444",
    fontSize: 12,
    fontWeight: "bold",
  },
  syncStatus: {
    fontSize: 11,
    fontWeight: "600",
  },
  syncedText: {
    color: "#10b981",
  },
  pendingText: {
    color: "#f59e0b",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
    paddingVertical: 80,
  },
  emptyEmoji: {
    fontSize: 64,
    marginBottom: 20,
  },
  emptyTitle: {
    color: "#f9fafb",
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 8,
  },
  emptySubtitle: {
    color: "#9ca3af",
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
  },
});

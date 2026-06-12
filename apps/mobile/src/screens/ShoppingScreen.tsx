import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  ActivityIndicator,
  Animated,
  PanResponder,
} from "react-native";
import { api } from "../services/api";
import { getDb } from "../lib/db";
import * as Haptics from "expo-haptics";

interface ShoppingList {
  id: string;
  name: string;
}

interface ShoppingItem {
  id: string;
  productId: string;
  name: string;
  brand: string | null;
  checked: boolean;
  complianceBadge: string; // 'green' | 'red' | 'gray'
}

interface SelectedList {
  id: string;
  name: string;
  items: ShoppingItem[];
}

interface SearchProduct {
  id: string;
  name: string;
  brand: string | null;
}

interface SwipeableItemProps {
  children: React.ReactNode;
  onDelete: () => void;
}

const SwipeableItem: React.FC<SwipeableItemProps> = ({ children, onDelete }) => {
  const translateX = useRef(new Animated.Value(0)).current;
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => Math.abs(gestureState.dx) > 10,
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dx < 0) {
          translateX.setValue(gestureState.dx);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dx < -80) {
          Animated.timing(translateX, {
            toValue: -500,
            duration: 200,
            useNativeDriver: true,
          }).start(() => onDelete());
        } else {
          Animated.spring(translateX, {
            toValue: 0,
            useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;

  return (
    <View style={styles.swipeContainer}>
      <View style={styles.swipeBackground}>
        <Text style={styles.swipeDeleteText}>🗑️ Delete</Text>
      </View>
      <Animated.View style={{ transform: [{ translateX }] }} {...panResponder.panHandlers}>
        {children}
      </Animated.View>
    </View>
  );
};

export const ShoppingScreen = () => {
  const [lists, setLists] = useState<ShoppingList[]>([]);
  const [selectedList, setSelectedList] = useState<SelectedList | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // New list creation state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newListName, setNewListName] = useState("");

  // Product search state
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchProduct[]>([]);
  const [searching, setSearching] = useState(false);

  // Compliance Filter toggle
  const [showCompliantOnly, setShowCompliantOnly] = useState(false);

  useEffect(() => {
    fetchLists();
  }, []);

  const fetchLists = async () => {
    setLoading(true);
    try {
      const response = await api.get<ShoppingList[]>("/shopping/lists");
      setLists(response.data);
    } catch (error) {
      Alert.alert("Error", "Failed to fetch shopping lists");
    } finally {
      setLoading(false);
    }
  };

  const handleRefreshLists = async () => {
    setRefreshing(true);
    try {
      const response = await api.get<ShoppingList[]>("/shopping/lists");
      setLists(response.data);
    } catch {
      // Ignore error for pull-to-refresh
    } finally {
      setRefreshing(false);
    }
  };

  const fetchListDetails = async (listId: string) => {
    setLoading(true);
    try {
      const response = await api.get<SelectedList>(`/shopping/lists/${listId}`);
      setSelectedList(response.data);
    } catch (error) {
      Alert.alert("Error", "Failed to fetch shopping list details");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateList = async () => {
    if (!newListName.trim()) {
      Alert.alert("Validation", "Please enter a shopping list name.");
      return;
    }

    try {
      const response = await api.post<ShoppingList>("/shopping/lists", {
        name: newListName.trim(),
      });
      setLists((prev) => [...prev, response.data]);
      setIsCreateModalOpen(false);
      setNewListName("");
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      Alert.alert("Error", "Failed to create shopping list");
    }
  };

  const handleDeleteList = async (listId: string) => {
    Alert.alert(
      "Delete List",
      "Are you sure you want to delete this shopping list and all of its items?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await api.delete(`/shopping/lists/${listId}`);
              setLists((prev) => prev.filter((l) => l.id !== listId));
              setSelectedList(null);
              await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            } catch {
              Alert.alert("Error", "Failed to delete shopping list");
            }
          },
        },
      ]
    );
  };

  const handleToggleChecked = async (item: ShoppingItem) => {
    if (!selectedList) return;
    const newChecked = !item.checked;

    // Optimistically update
    const originalItems = [...selectedList.items];
    setSelectedList({
      ...selectedList,
      items: selectedList.items.map((i) => (i.id === item.id ? { ...i, checked: newChecked } : i)),
    });

    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await api.patch(`/shopping/lists/${selectedList.id}/items/${item.id}`, {
        checked: newChecked,
      });
    } catch {
      // Rollback on failure
      setSelectedList({ ...selectedList, items: originalItems });
      Alert.alert("Error", "Failed to update item");
    }
  };

  const handleRemoveItem = async (itemId: string) => {
    if (!selectedList) return;

    // Optimistically update
    const originalItems = [...selectedList.items];
    setSelectedList({
      ...selectedList,
      items: selectedList.items.filter((i) => i.id !== itemId),
    });

    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await api.delete(`/shopping/lists/${selectedList.id}/items/${itemId}`);
    } catch {
      // Rollback
      setSelectedList({ ...selectedList, items: originalItems });
      Alert.alert("Error", "Failed to remove item");
    }
  };

  // Product Search & Add Item
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
      // 1. Search local SQLite DB
      const db = await getDb();
      const localProducts = await db.getAllAsync<{ id: string; name: string; brand: string | null }>(
        "SELECT id, name, brand FROM products WHERE name LIKE ? OR brand LIKE ? LIMIT 10",
        [`%${searchQuery}%`, `%${searchQuery}%`]
      );

      // 2. Search API Meilisearch index if online
      let remoteProducts: SearchProduct[] = [];
      try {
        const response = await api.get<{ hits: SearchProduct[] }>("/products", {
          params: { q: searchQuery },
        });
        remoteProducts = response.data.hits || [];
      } catch {
        // Ignore API failures for search when offline
      }

      // Merge local and remote products, removing duplicates by ID
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

  const handleAddItemToList = async (productId: string) => {
    if (!selectedList) return;

    try {
      await api.post(`/shopping/lists/${selectedList.id}/items`, {
        productId,
      });
      // Refresh list details to recalculate badges and fetch item ID
      await fetchListDetails(selectedList.id);
      setIsSearchModalOpen(false);
      setSearchQuery("");
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      Alert.alert("Error", "Failed to add product to shopping list");
    }
  };

  // Filter items based on Compliance Filter toggle
  const filteredItems = selectedList
    ? selectedList.items.filter((item) => {
        if (showCompliantOnly) {
          return item.complianceBadge === "green";
        }
        return true;
      })
    : [];

  if (selectedList) {
    return (
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setSelectedList(null)} style={styles.backButton}>
            <Text style={styles.backButtonText}>⬅️ Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {selectedList.name}
          </Text>
          <TouchableOpacity
            onPress={() => handleDeleteList(selectedList.id)}
            style={styles.deleteListButton}
          >
            <Text style={styles.deleteListIcon}>🗑️</Text>
          </TouchableOpacity>
        </View>

        {/* Filters and Controls */}
        <View style={styles.controlsRow}>
          <TouchableOpacity
            style={[styles.filterChip, showCompliantOnly && styles.filterChipActive]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setShowCompliantOnly(!showCompliantOnly);
            }}
          >
            <Text style={[styles.filterChipText, showCompliantOnly && styles.filterChipTextActive]}>
              🟢 Compliant Only
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.addButton}
            onPress={() => setIsSearchModalOpen(true)}
          >
            <Text style={styles.addButtonText}>➕ Add Item</Text>
          </TouchableOpacity>
        </View>

        {/* Items List */}
        {loading ? (
          <ActivityIndicator size="large" color="#10b981" style={styles.loader} />
        ) : filteredItems.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyEmoji}>🛒</Text>
            <Text style={styles.emptyText}>
              {showCompliantOnly ? "No compliant items found." : "This shopping list is empty."}
            </Text>
            {!showCompliantOnly && (
              <TouchableOpacity
                style={styles.emptyAddButton}
                onPress={() => setIsSearchModalOpen(true)}
              >
                <Text style={styles.emptyAddButtonText}>Add Products</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <FlatList
            data={filteredItems}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => {
              let badgeColor = "#9ca3af";
              if (item.complianceBadge === "green") badgeColor = "#10b981";
              else if (item.complianceBadge === "red") badgeColor = "#ef4444";

              return (
                <SwipeableItem onDelete={() => handleRemoveItem(item.id)}>
                  <TouchableOpacity
                    style={styles.itemRow}
                    activeOpacity={0.7}
                    onPress={() => handleToggleChecked(item)}
                  >
                    <View style={styles.checkboxContainer}>
                      <Text style={styles.checkbox}>{item.checked ? "✅" : "⬜"}</Text>
                    </View>
                    <View style={styles.itemInfo}>
                      <Text
                        style={[
                          styles.itemName,
                          item.checked && styles.itemNameChecked,
                        ]}
                      >
                        {item.name}
                      </Text>
                      {item.brand && <Text style={styles.itemBrand}>{item.brand}</Text>}
                    </View>
                    <View style={[styles.badgeDot, { backgroundColor: badgeColor }]} />
                  </TouchableOpacity>
                </SwipeableItem>
              );
            }}
            contentContainerStyle={styles.listContent}
          />
        )}

        {/* Product Search Modal */}
        <Modal
          visible={isSearchModalOpen}
          animationType="slide"
          onRequestClose={() => setIsSearchModalOpen(false)}
        >
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Search Products</Text>
              <TouchableOpacity
                onPress={() => {
                  setIsSearchModalOpen(false);
                  setSearchQuery("");
                }}
                style={styles.closeButton}
              >
                <Text style={styles.closeButtonText}>Close</Text>
              </TouchableOpacity>
            </View>

            <TextInput
              style={styles.searchInput}
              placeholder="Search products by name or brand..."
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
                  {searchQuery ? "No products found." : "Type a product name to search..."}
                </Text>
              </View>
            ) : (
              <FlatList
                data={searchResults}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.searchResultRow}
                    onPress={() => handleAddItemToList(item.id)}
                  >
                    <View style={styles.searchResultInfo}>
                      <Text style={styles.searchResultName}>{item.name}</Text>
                      {item.brand && <Text style={styles.searchResultBrand}>{item.brand}</Text>}
                    </View>
                    <Text style={styles.searchResultAddIcon}>➕</Text>
                  </TouchableOpacity>
                )}
                contentContainerStyle={styles.listContent}
              />
            )}
          </View>
        </Modal>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Shopping Lists</Text>
        <TouchableOpacity
          onPress={() => setIsCreateModalOpen(true)}
          style={styles.headerCreateButton}
        >
          <Text style={styles.headerCreateIcon}>➕</Text>
        </TouchableOpacity>
      </View>

      {loading && lists.length === 0 ? (
        <ActivityIndicator size="large" color="#10b981" style={styles.loader} />
      ) : lists.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyEmoji}>🛒</Text>
          <Text style={styles.emptyText}>No shopping lists created yet.</Text>
          <TouchableOpacity
            style={styles.emptyAddButton}
            onPress={() => setIsCreateModalOpen(true)}
          >
            <Text style={styles.emptyAddButtonText}>Create New List</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={lists}
          keyExtractor={(item) => item.id}
          refreshing={refreshing}
          onRefresh={handleRefreshLists}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.listCard}
              onPress={() => fetchListDetails(item.id)}
            >
              <Text style={styles.listCardTitle}>{item.name}</Text>
              <Text style={styles.listCardArrow}>➡️</Text>
            </TouchableOpacity>
          )}
          contentContainerStyle={styles.listContent}
        />
      )}

      {/* Create List Modal */}
      <Modal
        visible={isCreateModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsCreateModalOpen(false)}
      >
        <View style={styles.dialogOverlay}>
          <View style={styles.dialogContainer}>
            <Text style={styles.dialogTitle}>New Shopping List</Text>
            <TextInput
              style={styles.dialogInput}
              placeholder="List Name (e.g. Weekly Groceries)"
              placeholderTextColor="#9ca3af"
              value={newListName}
              onChangeText={setNewListName}
            />
            <View style={styles.dialogButtonsRow}>
              <TouchableOpacity
                style={[styles.dialogButton, styles.dialogButtonCancel]}
                onPress={() => {
                  setIsCreateModalOpen(false);
                  setNewListName("");
                }}
              >
                <Text style={styles.dialogButtonCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.dialogButton, styles.dialogButtonConfirm]}
                onPress={handleCreateList}
              >
                <Text style={styles.dialogButtonConfirmText}>Create</Text>
              </TouchableOpacity>
            </View>
          </View>
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
    height: 60,
    backgroundColor: "#1f2937",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#374151",
  },
  headerTitle: {
    color: "#f9fafb",
    fontSize: 20,
    fontWeight: "bold",
    flex: 1,
    textAlign: "center",
  },
  backButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  backButtonText: {
    color: "#10b981",
    fontSize: 16,
    fontWeight: "600",
  },
  deleteListButton: {
    padding: 8,
  },
  deleteListIcon: {
    fontSize: 20,
  },
  headerCreateButton: {
    padding: 8,
  },
  headerCreateIcon: {
    fontSize: 22,
    color: "#10b981",
  },
  controlsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    backgroundColor: "#111827",
  },
  filterChip: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: "#1f2937",
    borderWidth: 1,
    borderColor: "#374151",
  },
  filterChipActive: {
    backgroundColor: "#065f46",
    borderColor: "#10b981",
  },
  filterChipText: {
    color: "#9ca3af",
    fontWeight: "600",
    fontSize: 14,
  },
  filterChipTextActive: {
    color: "#34d399",
  },
  addButton: {
    backgroundColor: "#10b981",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  addButtonText: {
    color: "#ffffff",
    fontWeight: "bold",
    fontSize: 14,
  },
  loader: {
    marginTop: 40,
  },
  listContent: {
    padding: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 40,
    marginTop: 60,
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
  emptyAddButton: {
    backgroundColor: "#10b981",
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  emptyAddButtonText: {
    color: "#ffffff",
    fontWeight: "bold",
    fontSize: 16,
  },
  listCard: {
    backgroundColor: "#1f2937",
    borderRadius: 12,
    padding: 20,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: "#374151",
  },
  listCardTitle: {
    color: "#f9fafb",
    fontSize: 18,
    fontWeight: "bold",
  },
  listCardArrow: {
    fontSize: 16,
  },
  swipeContainer: {
    position: "relative",
    marginBottom: 8,
  },
  swipeBackground: {
    position: "absolute",
    right: 0,
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: "#ef4444",
    borderRadius: 8,
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  swipeDeleteText: {
    color: "#ffffff",
    fontWeight: "bold",
    fontSize: 15,
  },
  itemRow: {
    backgroundColor: "#1f2937",
    borderRadius: 8,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#374151",
  },
  checkboxContainer: {
    marginRight: 12,
  },
  checkbox: {
    fontSize: 20,
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    color: "#f9fafb",
    fontSize: 16,
    fontWeight: "600",
  },
  itemNameChecked: {
    textDecorationLine: "line-through",
    color: "#9ca3af",
  },
  itemBrand: {
    color: "#9ca3af",
    fontSize: 13,
    marginTop: 2,
  },
  badgeDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginLeft: 10,
  },
  // Dialog (Create List Modal)
  dialogOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    justifyContent: "center",
    alignItems: "center",
  },
  dialogContainer: {
    backgroundColor: "#1f2937",
    borderRadius: 16,
    padding: 24,
    width: "80%",
    borderWidth: 1,
    borderColor: "#374151",
  },
  dialogTitle: {
    color: "#f9fafb",
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 16,
    textAlign: "center",
  },
  dialogInput: {
    backgroundColor: "#111827",
    borderWidth: 1,
    borderColor: "#374151",
    borderRadius: 8,
    color: "#f9fafb",
    padding: 12,
    marginBottom: 20,
    fontSize: 16,
  },
  dialogButtonsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  dialogButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  dialogButtonCancel: {
    backgroundColor: "#374151",
    marginRight: 8,
  },
  dialogButtonCancelText: {
    color: "#d1d5db",
    fontWeight: "600",
  },
  dialogButtonConfirm: {
    backgroundColor: "#10b981",
    marginLeft: 8,
  },
  dialogButtonConfirmText: {
    color: "#ffffff",
    fontWeight: "bold",
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
    fontSize: 20,
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
  searchResultRow: {
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
  searchResultInfo: {
    flex: 1,
  },
  searchResultName: {
    color: "#f9fafb",
    fontSize: 16,
    fontWeight: "600",
  },
  searchResultBrand: {
    color: "#9ca3af",
    fontSize: 13,
    marginTop: 2,
  },
  searchResultAddIcon: {
    fontSize: 20,
  },
});

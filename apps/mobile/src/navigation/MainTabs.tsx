import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Text } from "react-native";
import { ScanScreen } from "../screens/ScanScreen";
import { JournalScreen } from "../screens/JournalScreen";
import { NutritionScreen } from "../screens/NutritionScreen";
import { ShoppingScreen } from "../screens/ShoppingScreen";
import { MealPlanScreen } from "../screens/MealPlanScreen";
import { ProfileScreen } from "../screens/ProfileScreen";

export type MainTabParamList = {
  Scan: undefined;
  Journal: undefined;
  Nutrition: undefined;
  Shopping: undefined;
  MealPlan: undefined;
  Profile: undefined;
};

const Tab = createBottomTabNavigator<MainTabParamList>();

export const MainTabs = () => {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerStyle: {
          backgroundColor: "#111827",
          borderBottomWidth: 1,
          borderBottomColor: "#1f2937",
        },
        headerTitleStyle: {
          color: "#f9fafb",
          fontWeight: "bold",
        },
        tabBarStyle: {
          backgroundColor: "#111827",
          borderTopWidth: 1,
          borderTopColor: "#1f2937",
          paddingBottom: 5,
          paddingTop: 5,
          height: 60,
        },
        tabBarActiveTintColor: "#10b981",
        tabBarInactiveTintColor: "#9ca3af",
        tabBarIcon: ({ focused }) => {
          let icon = "";
          if (route.name === "Scan") icon = "📷";
          else if (route.name === "Journal") icon = "📓";
          else if (route.name === "Nutrition") icon = "📊";
          else if (route.name === "Shopping") icon = "🛒";
          else if (route.name === "MealPlan") icon = "📅";
          else if (route.name === "Profile") icon = "👤";

          return (
            <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.6 }}>
              {icon}
            </Text>
          );
        },
      })}
    >
      <Tab.Screen name="Scan" component={ScanScreen} options={{ title: "Scan" }} />
      <Tab.Screen name="Journal" component={JournalScreen} options={{ title: "Journal" }} />
      <Tab.Screen name="Nutrition" component={NutritionScreen} options={{ title: "Nutrition" }} />
      <Tab.Screen name="Shopping" component={ShoppingScreen} options={{ title: "Shopping" }} />
      <Tab.Screen name="MealPlan" component={MealPlanScreen} options={{ title: "Meal Plan" }} />
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ title: "Profile" }} />
    </Tab.Navigator>
  );
};

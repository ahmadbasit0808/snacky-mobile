import React, { useEffect, useState } from "react";
import {
  View,
  ActivityIndicator,
  Text,
  StatusBar,
  TouchableOpacity,
} from "react-native";
import { useOTAUpdate } from "./src/hooks/useOTAUpdate";
import { enableScreens } from "react-native-screens";
import { NavigationContainer } from "@react-navigation/native";
import { ThemeProvider, useTheme } from "./src/context/ThemeContext";

enableScreens();
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { initDb, getSetting } from "./src/db/database";
import SetupScreen from "./src/screens/SetupScreen";
import ProductsScreen from "./src/screens/ProductsScreen";
import ShoppingScreen from "./src/screens/ShoppingScreen";
import InventoryScreen from "./src/screens/InventoryScreen";
import HistoryScreen from "./src/screens/HistoryScreen";
import SummaryScreen from "./src/screens/SummaryScreen";
import SettingsScreen from "./src/screens/SettingsScreen";
import SnackDetailScreen from "./src/screens/SnackDetailScreen";
import ProductDetailScreen from "./src/screens/ProductDetailScreen";

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

const TAB_ICONS = {
  Products: "fast-food-outline",
  Shopping: "cart-outline",
  Inventory: "cube-outline",
  History: "receipt-outline",
  Summary: "stats-chart-outline",
};

function MainTabs() {
  const { theme } = useTheme();
  return (
    <Tab.Navigator
      screenOptions={({ route, navigation }) => ({
        tabBarIcon: ({ color, size }) => (
          <Ionicons name={TAB_ICONS[route.name]} size={size} color={color} />
        ),
        tabBarActiveTintColor: theme.primary || "#6c63ff",
        tabBarInactiveTintColor: theme.textMuted,
        tabBarStyle: {
          backgroundColor: theme.tabBar,
          borderTopColor: theme.border,
          paddingBottom: 4,
        },
        headerStyle: { backgroundColor: theme.header },
        headerTintColor: theme.text,
        headerTitleStyle: { fontWeight: "700" },
        headerRight: () => (
          <TouchableOpacity
            onPress={() => navigation.navigate("Settings")}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={{ marginRight: 16, padding: 4 }}
          >
            <Ionicons name="settings-outline" size={22} color={theme.text} />
          </TouchableOpacity>
        ),
      })}
    >
      <Tab.Screen
        name="Products"
        component={ProductsScreen}
        options={{ title: "Products" }}
      />
      <Tab.Screen
        name="Shopping"
        component={ShoppingScreen}
        options={{ title: "Shopping" }}
      />
      <Tab.Screen
        name="Inventory"
        component={InventoryScreen}
        options={{ title: "Inventory" }}
      />
      <Tab.Screen
        name="History"
        component={HistoryScreen}
        options={{ title: "History" }}
      />
      <Tab.Screen
        name="Summary"
        component={SummaryScreen}
        options={{ title: "Summary" }}
      />
    </Tab.Navigator>
  );
}

function AppInner() {
  const [ready, setReady] = useState(false);
  const [setupDone, setSetupDone] = useState(false);
  const { isChecking, updateMessage } = useOTAUpdate();
  const { theme } = useTheme();

  useEffect(() => {
    (async () => {
      await initDb();
      const done = await getSetting("setup_done");
      setSetupDone(done === "1");
      setReady(true);
    })();
  }, []);

  if (!ready || isChecking) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: theme.bg,
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <ActivityIndicator size="large" color="#6c63ff" />
        {updateMessage && (
          <Text style={{ color: theme.textSecondary, marginTop: 12 }}>
            {updateMessage}
          </Text>
        )}
      </View>
    );
  }

  if (!setupDone) {
    return <SetupScreen onComplete={() => setSetupDone(true)} />;
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Main" component={MainTabs} />
        <Stack.Screen
          name="ProductDetail"
          component={ProductDetailScreen}
          options={({ route }) => ({
            headerShown: true,
            title: route.params?.productName || "Product",
            headerStyle: { backgroundColor: theme.header },
            headerTintColor: theme.text,
          })}
        />
        <Stack.Screen
          name="Settings"
          component={SettingsScreen}
          options={{
            headerShown: true,
            title: "Settings",
            headerStyle: { backgroundColor: theme.header },
            headerTintColor: theme.text,
          }}
        />
        <Stack.Screen
          name="SnackDetail"
          component={SnackDetailScreen}
          options={({ route }) => {
            const snack = route.params?.snack;
            const title = snack
              ? [
                  snack.name,
                  snack.flavor && snack.flavor !== snack.name
                    ? snack.flavor
                    : null,
                ]
                  .filter(Boolean)
                  .join(" ")
              : "Snack";
            return {
              headerShown: true,
              title,
              headerStyle: { backgroundColor: theme.header },
              headerTintColor: theme.text,
            };
          }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <StatusBarController />
      <AppInner />
    </ThemeProvider>
  );
}

function StatusBarController() {
  const { isDark, theme } = useTheme();
  return (
    <StatusBar
      barStyle={isDark ? "light-content" : "dark-content"}
      backgroundColor={isDark ? "#0f0f1a" : theme.bg}
    />
  );
}

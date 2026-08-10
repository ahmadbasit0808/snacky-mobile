import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { setSetting } from "../db/database";
import { useTheme } from "../context/ThemeContext";

export default function SetupScreen({ onComplete }) {
  const { theme } = useTheme();

  const handleStart = async () => {
    await setSetting("setup_done", "1");
    onComplete();
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <Ionicons name="fast-food-outline" size={72} color="#6c63ff" style={styles.icon} />
      <Text style={[styles.title, { color: theme.text }]}>Snack Manager</Text>
      <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
        Track your snack inventory, log consumption, and monitor spending — all in one place.
      </Text>
      <TouchableOpacity style={styles.button} onPress={handleStart}>
        <Text style={styles.buttonText}>Get Started</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", alignItems: "center", padding: 32 },
  icon: { marginBottom: 24 },
  title: { fontSize: 30, fontWeight: "700", marginBottom: 12, textAlign: "center" },
  subtitle: { fontSize: 15, textAlign: "center", lineHeight: 22, marginBottom: 40 },
  button: {
    backgroundColor: "#6c63ff",
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 48,
  },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});

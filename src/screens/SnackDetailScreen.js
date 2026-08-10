import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, ScrollView, Image } from "react-native";
import { getSnacks } from "../db/database";
import { useTheme } from "../context/ThemeContext";
import { resolveImageSource } from "../utils/images";

const CATEGORY_ICONS = {
  Chips: "🥔",
  Biscuits: "🍪",
  Candy: "🍫",
  Drinks: "🥤",
  Snack: "🍟",
  General: "🍿",
  Other: "📦",
};

export default function SnackDetailScreen({ route }) {
  const { theme } = useTheme();
  const [snack, setSnack] = useState(route.params.snack);

  // Refresh snack data after changes.
  useEffect(() => {
    (async () => {
      const all = await getSnacks();
      const updated = all.find((s) => s.id === snack.id);
      if (updated) setSnack(updated);
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const stockColor =
    snack.stock <= 0 ? "#ff6b6b" : snack.stock <= 2 ? "#ffa94d" : "#69db7c";

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Header card */}
        <View style={[styles.heroCard, { backgroundColor: theme.card }]}>
          {snack.image ? (
            <Image
              source={resolveImageSource(snack.image)}
              style={styles.heroImage}
              resizeMode="cover"
            />
          ) : (
            <Text style={styles.heroEmoji}>
              {CATEGORY_ICONS[snack.category] || "🍿"}
            </Text>
          )}
          <Text style={[styles.heroName, { color: theme.text }]}>
            {[
              snack.name,
              snack.flavor && snack.flavor !== snack.name ? snack.flavor : null,
            ]
              .filter(Boolean)
              .join(" ")}
          </Text>
          <Text style={[styles.heroCat, { color: theme.textMuted }]}>
            {[
              snack.category,
              snack.brand && snack.brand !== snack.name ? snack.brand : null,
            ]
              .filter(Boolean)
              .join(" • ")}
          </Text>
          <View style={styles.heroRow}>
            <View
              style={[styles.stockPill, { backgroundColor: stockColor + "22" }]}
            >
              <Text style={[styles.stockPillText, { color: stockColor }]}>
                {snack.stock} {snack.unit} in stock
              </Text>
            </View>
            {snack.price > 0 && (
              <View
                style={[styles.stockPill, { backgroundColor: "#6c63ff22" }]}
              >
                <Text style={[styles.stockPillText, { color: "#6c63ff" }]}>
                  ₨{snack.price} / {snack.unit}
                </Text>
              </View>
            )}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16 },
  heroCard: {
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
    marginBottom: 20,
  },
  heroEmoji: { fontSize: 56, marginBottom: 12 },
  heroImage: {
    width: 140,
    height: 140,
    borderRadius: 20,
    marginBottom: 12,
  },
  heroName: {
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 4,
    textAlign: "center",
  },
  heroCat: { fontSize: 13, marginBottom: 16 },
  heroRow: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
    justifyContent: "center",
  },
  stockPill: { borderRadius: 20, paddingHorizontal: 16, paddingVertical: 6 },
  stockPillText: { fontSize: 14, fontWeight: "600" },
});

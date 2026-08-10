import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Image,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { getSnacks } from "../db/database";
import { useTheme } from "../context/ThemeContext";
import { groupSnacksByProduct } from "../utils/products";
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

const stockColorFor = (stock) =>
  stock <= 0 ? "#ff6b6b" : stock <= 2 ? "#ffa94d" : "#69db7c";

function VariantCard({ variant, onPress, theme }) {
  const stockColor = stockColorFor(variant.stock);
  const label = [variant.name, variant.flavor].filter(Boolean).join(" ");
  return (
    <TouchableOpacity
      style={[
        styles.card,
        { backgroundColor: theme.card, borderColor: theme.border },
      ]}
      onPress={() => onPress(variant)}
      activeOpacity={0.85}
    >
      {/* Image / emoji area */}
      <View style={styles.imageWrap}>
        {variant.image ? (
          <Image
            source={resolveImageSource(variant.image)}
            style={styles.productImage}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.imageFallback}>
            <Text style={styles.imageEmoji}>
              {CATEGORY_ICONS[variant.category] || "🍿"}
            </Text>
          </View>
        )}

        {/* Round stock badge */}
        <View style={[styles.stockBadge, { backgroundColor: stockColor }]}>
          <Text style={styles.stockBadgeQty}>{variant.stock}</Text>
          <Text style={styles.stockBadgeUnit}>{variant.unit}</Text>
        </View>
      </View>

      {/* Name at bottom */}
      <View style={styles.cardBody}>
        <Text
          style={[styles.cardName, { color: theme.text }]}
          numberOfLines={1}
        >
          {label}
        </Text>
        <Text style={[styles.cardBrand, { color: theme.textMuted }]}>
          ₨{variant.price} / {variant.unit}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

export default function InventoryScreen({ navigation }) {
  const { theme } = useTheme();
  const [snacks, setSnacks] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => setSnacks(await getSnacks());

  useFocusEffect(
    useCallback(() => {
      load();
    }, []),
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  // Flatten all variants so each flavor/price pack is its own card, then sort
  // by name and flavor so the grid is predictable.
  const variants = groupSnacksByProduct(snacks)
    .flatMap((p) => p.variants)
    .filter((v) => Number(v.stock) > 0)
    .sort(
      (a, b) =>
        (a.name || "").localeCompare(b.name || "") ||
        (a.flavor || "").localeCompare(b.flavor || "") ||
        (Number(a.price) || 0) - (Number(b.price) || 0),
    );

  const totalUnits = variants.reduce((sum, v) => sum + Number(v.stock) || 0, 0);

  const openVariant = (variant) => {
    navigation.navigate("SnackDetail", { snack: variant });
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <FlatList
        data={variants}
        keyExtractor={(item) => `inv-${item.id}`}
        numColumns={2}
        columnWrapperStyle={styles.row}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#6c63ff"
          />
        }
        renderItem={({ item }) => (
          <VariantCard variant={item} theme={theme} onPress={openVariant} />
        )}
        ListHeaderComponent={
          <View style={styles.summaryRow}>
            <View style={[styles.summaryCard, { backgroundColor: theme.card }]}>
              <Text style={[styles.summaryValue, { color: theme.text }]}>
                {variants.length}
              </Text>
              <Text style={[styles.summaryLabel, { color: theme.textMuted }]}>
                Packs
              </Text>
            </View>
            <View style={[styles.summaryCard, { backgroundColor: theme.card }]}>
              <Text style={[styles.summaryValue, { color: theme.text }]}>
                {totalUnits}
              </Text>
              <Text style={[styles.summaryLabel, { color: theme.textMuted }]}>
                Units in stock
              </Text>
            </View>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyEmoji}>📦</Text>
            <Text style={[styles.emptyText, { color: theme.textMuted }]}>
              Nothing in stock.{"\n"}Add items from the Shopping tab.
            </Text>
          </View>
        }
        ListFooterComponent={<View style={{ height: 24 }} />}
        contentContainerStyle={styles.list}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  list: { padding: 16 },
  row: { gap: 12, marginBottom: 12 },
  summaryRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 4,
  },
  summaryCard: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#6c63ff22",
    paddingVertical: 16,
    alignItems: "center",
    marginBottom: 16,
  },
  summaryValue: { fontSize: 26, fontWeight: "800" },
  summaryLabel: {
    fontSize: 12,
    marginTop: 2,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },

  card: {
    flexGrow: 1,
    flexBasis: "48%",
    maxWidth: "48%",
    borderRadius: 18,
    borderWidth: 1,
    overflow: "hidden",
  },
  imageWrap: {
    aspectRatio: 1,
    backgroundColor: "#fff",
    position: "relative",
  },
  productImage: { width: "100%", height: "100%" },
  imageFallback: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  imageEmoji: { fontSize: 40 },
  stockBadge: {
    position: "absolute",
    top: 8,
    right: 8,
    minWidth: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  stockBadgeQty: { color: "#fff", fontSize: 16, fontWeight: "800" },
  stockBadgeUnit: {
    color: "#ffffffdd",
    fontSize: 9,
    fontWeight: "600",
    textTransform: "uppercase",
  },
  cardBody: { padding: 10 },
  cardName: { fontSize: 14, fontWeight: "700" },
  cardBrand: { fontSize: 11, marginTop: 1 },

  emptyWrap: { alignItems: "center", marginTop: 60 },
  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 14, textAlign: "center", lineHeight: 22 },
});

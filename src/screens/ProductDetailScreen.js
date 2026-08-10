import React, { useState, useCallback, useMemo, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
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

export default function ProductDetailScreen({ route, navigation }) {
  const { theme } = useTheme();
  const { productKey } = route.params;
  const [snacks, setSnacks] = useState([]);
  const [selectedFlavor, setSelectedFlavor] = useState(null);
  const [selectedPrice, setSelectedPrice] = useState(null);

  const load = useCallback(async () => setSnacks(await getSnacks()), []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const product = useMemo(() => {
    const groups = groupSnacksByProduct(snacks);
    return groups.find((g) => g.key === productKey) || null;
  }, [snacks, productKey]);

  // Pick sensible defaults once the product data is available.
  useEffect(() => {
    if (!product) return;
    if (selectedFlavor === null && product.flavors.length > 0) {
      setSelectedFlavor(product.flavors[0]);
    }
    if (selectedPrice === null && product.prices.length > 0) {
      setSelectedPrice(product.prices[0]);
    }
  }, [product]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    navigation.setOptions({ title: product ? product.name : "Product" });
  }, [product, navigation]);

  if (!product) {
    return (
      <View
        style={[
          styles.container,
          {
            backgroundColor: theme.bg,
            justifyContent: "center",
            alignItems: "center",
          },
        ]}
      >
        <Text style={{ color: theme.textMuted }}>Product not found.</Text>
      </View>
    );
  }

  const hasFlavors = product.flavors.length > 0;

  // Only offer prices that actually exist for the selected flavor (falls
  // back to every known price if the product has no flavor concept).
  const pricesForFlavor = hasFlavors
    ? Array.from(
        new Set(
          product.variants
            .filter((v) => (v.flavor || "").trim() === selectedFlavor)
            .map((v) => Number(v.price) || 0),
        ),
      ).sort((a, b) => a - b)
    : product.prices;

  const activeVariant = product.variants.find((v) => {
    const flavorMatches = hasFlavors
      ? (v.flavor || "").trim() === selectedFlavor
      : true;
    const priceMatches = Number(v.price) === Number(selectedPrice);
    return flavorMatches && priceMatches;
  });

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.bg }]}
      contentContainerStyle={styles.content}
    >
      <View style={[styles.heroCard, { backgroundColor: theme.card }]}>
        {product.image ? (
          <Image
            source={resolveImageSource(product.image)}
            style={styles.heroImage}
            resizeMode="cover"
          />
        ) : (
          <Text style={styles.heroEmoji}>
            {CATEGORY_ICONS[product.category] || "🍿"}
          </Text>
        )}
        <Text style={[styles.heroName, { color: theme.text }]}>
          {product.name}
        </Text>
        {product.brand && product.brand !== product.name ? (
          <Text style={[styles.heroBrand, { color: theme.textMuted }]}>
            {product.brand}
          </Text>
        ) : null}
        <Text style={[styles.heroCat, { color: theme.textMuted }]}>
          {product.category} · {product.totalStock} {product.unit} in stock
          total
        </Text>
      </View>

      {hasFlavors && (
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>
            Flavor
          </Text>
          <View style={styles.chipRow}>
            {product.flavors.map((flavor) => {
              const active = selectedFlavor === flavor;
              return (
                <TouchableOpacity
                  key={flavor}
                  onPress={() => setSelectedFlavor(flavor)}
                  style={[
                    styles.chip,
                    {
                      borderColor: active ? "#6c63ff" : theme.border,
                      backgroundColor: active ? "#6c63ff" : theme.card,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.chipText,
                      { color: active ? "#fff" : theme.text },
                    ]}
                  >
                    {flavor}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      )}

      <View style={styles.section}>
        <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>
          Price
        </Text>
        <View style={styles.chipRow}>
          {pricesForFlavor.map((price) => {
            const active = Number(selectedPrice) === price;
            return (
              <TouchableOpacity
                key={price}
                onPress={() => setSelectedPrice(price)}
                style={[
                  styles.chip,
                  {
                    borderColor: active ? "#6c63ff" : theme.border,
                    backgroundColor: active ? "#6c63ff" : theme.card,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.chipText,
                    { color: active ? "#fff" : theme.text },
                  ]}
                >
                  ₨{price}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {activeVariant ? (
        <View
          style={[
            styles.variantCard,
            { backgroundColor: theme.card, borderColor: theme.border },
          ]}
        >
          <View style={{ flex: 1 }}>
            <Text style={[styles.variantTitle, { color: theme.text }]}>
              {[product.name, hasFlavors ? selectedFlavor : null]
                .filter(Boolean)
                .join(" ")}
            </Text>
            <Text style={[styles.variantSub, { color: theme.textMuted }]}>
              ₨{selectedPrice} per {activeVariant.unit}
            </Text>
            <View
              style={[
                styles.stockPill,
                {
                  backgroundColor: stockColorFor(activeVariant.stock) + "22",
                  alignSelf: "flex-start",
                },
              ]}
            >
              <Text
                style={[
                  styles.stockPillText,
                  { color: stockColorFor(activeVariant.stock) },
                ]}
              >
                {activeVariant.stock} {activeVariant.unit} in stock
              </Text>
            </View>
          </View>
        </View>
      ) : (
        <View
          style={[
            styles.variantCard,
            { backgroundColor: theme.card, borderColor: theme.border },
          ]}
        >
          <Text style={{ color: theme.textMuted }}>
            This flavor and price combination isn't in your catalog yet. Add it
            from Products → Add Custom Snack.
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 40 },
  heroCard: {
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
    marginBottom: 20,
  },
  heroEmoji: { fontSize: 48, marginBottom: 10 },
  heroImage: {
    width: 120,
    height: 120,
    borderRadius: 20,
    marginBottom: 12,
  },
  heroName: {
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 4,
    textAlign: "center",
  },
  heroBrand: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 4,
    textAlign: "center",
  },
  heroCat: { fontSize: 13 },
  section: { marginBottom: 20 },
  sectionLabel: {
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 10,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  chipText: { fontSize: 13, fontWeight: "600" },
  variantCard: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 8,
  },
  variantTitle: { fontSize: 16, fontWeight: "700", marginBottom: 4 },
  variantSub: { fontSize: 13, marginBottom: 8 },
  stockPill: { borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4 },
  stockPillText: { fontSize: 12, fontWeight: "600" },
});

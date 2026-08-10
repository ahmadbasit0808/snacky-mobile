import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Image,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { getSnacks, addLog } from "../db/database";
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

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];
const fmtDate = (d) =>
  `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
const fmtTime = (d) => {
  const h = d.getHours();
  return `${h % 12 || 12}:${String(d.getMinutes()).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
};

function CheckoutModal({
  visible,
  cart,
  setCart,
  date,
  setDate,
  onCheckout,
  onClose,
  theme,
}) {
  const [pickerMode, setPickerMode] = useState(null);
  const [saving, setSaving] = useState(false);

  const totalCost = cart.reduce(
    (sum, c) => sum + (Number(c.snack.price) || 0) * c.qty,
    0,
  );
  const totalItems = cart.reduce((sum, c) => sum + c.qty, 0);

  const setQty = (id, qty) => {
    const q = Math.max(1, parseInt(qty, 10) || 1);
    setCart((prev) =>
      prev.map((c) => (c.snack.id === id ? { ...c, qty: q } : c)),
    );
  };

  const removeFromCart = (id) => {
    setCart((prev) => prev.filter((c) => c.snack.id !== id));
  };

  const handlePickerChange = (event, selectedDate) => {
    if (Platform.OS === "android") {
      setPickerMode(null);
      if (event.type === "set" && selectedDate) setDate(selectedDate);
      return;
    }
    if (selectedDate) setDate(selectedDate);
  };

  const handleCheckout = async () => {
    if (!cart.length) return Alert.alert("Cart is empty");
    const noPrice = cart.find((c) => Number(c.snack.price) <= 0);
    if (noPrice) {
      return Alert.alert(
        "No unit price",
        `"${[noPrice.snack.name, noPrice.snack.flavor].filter(Boolean).join(" ")}" has no unit price set. Edit it in Manage Catalog first.`,
      );
    }
    setSaving(true);
    try {
      await onCheckout(cart, date);
      onClose();
    } catch (e) {
      Alert.alert("Error", e.message);
    }
    setSaving(false);
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { backgroundColor: theme.card }]}>
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderLeft}>
                <View style={styles.modalHeaderIcon}>
                  <Ionicons name="cart" size={20} color="#fff" />
                </View>
                <View>
                  <Text style={[styles.modalTitle, { color: theme.text }]}>
                    Your Cart
                  </Text>
                  <Text
                    style={[styles.modalSubtitle, { color: theme.textMuted }]}
                  >
                    {cart.length} item{cart.length !== 1 ? "s" : ""} ·{" "}
                    {totalItems} unit{totalItems !== 1 ? "s" : ""}
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                style={[styles.closeBtn, { backgroundColor: theme.input }]}
                onPress={onClose}
              >
                <Ionicons name="close" size={20} color={theme.textMuted} />
              </TouchableOpacity>
            </View>

            {cart.length === 0 ? (
              <View style={styles.cartEmpty}>
                <Text style={styles.cartEmptyEmoji}>🛒</Text>
                <Text
                  style={[styles.cartEmptyText, { color: theme.textMuted }]}
                >
                  Your cart is empty.{"\n"}Tap + on a product to add it.
                </Text>
              </View>
            ) : (
              <ScrollView
                style={styles.cartList}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                {cart.map((c) => (
                  <View
                    key={c.snack.id}
                    style={[
                      styles.cartRow,
                      {
                        backgroundColor: theme.input,
                        borderColor: theme.border,
                      },
                    ]}
                  >
                    <View style={styles.cartThumb}>
                      {c.snack.image ? (
                        <Image
                          source={resolveImageSource(c.snack.image)}
                          style={styles.cartThumbImg}
                          resizeMode="cover"
                        />
                      ) : (
                        <Text style={styles.cartThumbEmoji}>
                          {CATEGORY_ICONS[c.snack.category] || "🍿"}
                        </Text>
                      )}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text
                        style={[styles.cartName, { color: theme.text }]}
                        numberOfLines={1}
                      >
                        {[c.snack.name, c.snack.flavor]
                          .filter(Boolean)
                          .join(" ")}
                      </Text>
                      <Text
                        style={[styles.cartMeta, { color: theme.textMuted }]}
                      >
                        ₨{c.snack.price} / {c.snack.unit}
                      </Text>
                    </View>
                    <View style={styles.stepper}>
                      <TouchableOpacity
                        style={styles.stepperBtn}
                        onPress={() => setQty(c.snack.id, c.qty - 1)}
                      >
                        <Ionicons name="remove" size={16} color="#6c63ff" />
                      </TouchableOpacity>
                      <TextInput
                        style={[
                          styles.stepperQty,
                          { color: theme.text, borderColor: theme.border },
                        ]}
                        keyboardType="numeric"
                        value={String(c.qty)}
                        onChangeText={(v) => setQty(c.snack.id, v)}
                        textAlign="center"
                      />
                      <TouchableOpacity
                        style={styles.stepperBtn}
                        onPress={() => setQty(c.snack.id, c.qty + 1)}
                      >
                        <Ionicons name="add" size={16} color="#6c63ff" />
                      </TouchableOpacity>
                    </View>
                    <TouchableOpacity
                      style={styles.removeBtn}
                      onPress={() => removeFromCart(c.snack.id)}
                    >
                      <Ionicons
                        name="trash-outline"
                        size={16}
                        color="#ff6b6b"
                      />
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            )}

            {/* Date & Time */}
            <Text style={[styles.label, { color: theme.textSecondary }]}>
              Date & Time
            </Text>
            <View style={styles.dateRow}>
              <TouchableOpacity
                style={[
                  styles.dateChip,
                  { backgroundColor: theme.input, borderColor: theme.border },
                ]}
                onPress={() => setPickerMode("date")}
              >
                <Ionicons
                  name="calendar-outline"
                  size={14}
                  color={theme.textMuted}
                />
                <Text style={[styles.dateChipText, { color: theme.text }]}>
                  {fmtDate(date)}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.dateChip,
                  { backgroundColor: theme.input, borderColor: theme.border },
                ]}
                onPress={() => setPickerMode("time")}
              >
                <Ionicons
                  name="time-outline"
                  size={14}
                  color={theme.textMuted}
                />
                <Text style={[styles.dateChipText, { color: theme.text }]}>
                  {fmtTime(date)}
                </Text>
              </TouchableOpacity>
            </View>

            {pickerMode && Platform.OS === "ios" && (
              <View
                style={[styles.iosPicker, { backgroundColor: theme.input }]}
              >
                <DateTimePicker
                  value={date}
                  mode={pickerMode}
                  display="spinner"
                  onChange={handlePickerChange}
                />
                <TouchableOpacity
                  style={styles.iosPickerDone}
                  onPress={() => setPickerMode(null)}
                >
                  <Text style={{ color: "#6c63ff", fontWeight: "600" }}>
                    Done
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            <TouchableOpacity
              style={[
                styles.checkoutBtn,
                { backgroundColor: "#69db7c" },
                (saving || cart.length === 0) && { opacity: 0.5 },
              ]}
              onPress={handleCheckout}
              disabled={saving || cart.length === 0}
            >
              <Text style={styles.checkoutBtnText}>
                {saving
                  ? "Adding..."
                  : `Checkout · Add ${totalItems} to Stock · ₨${totalCost.toLocaleString()}`}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>

      {pickerMode && Platform.OS === "android" && (
        <DateTimePicker
          value={date}
          mode={pickerMode}
          display="default"
          onChange={handlePickerChange}
        />
      )}
    </Modal>
  );
}

const CATEGORIES = [
  "All",
  "General",
  "Chips",
  "Snack",
  "Drinks",
  "Candy",
  "Biscuits",
  "Other",
];

export default function ShoppingScreen() {
  const { theme } = useTheme();
  const [snacks, setSnacks] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [cart, setCart] = useState([]); // [{ snack, qty }]
  const [showCheckout, setShowCheckout] = useState(false);
  const [date, setDate] = useState(new Date());
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");

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

  // Flatten all variants into individual rows (like the inventory list).
  const allVariants = groupSnacksByProduct(snacks)
    .flatMap((p) => p.variants)
    .sort(
      (a, b) =>
        (a.name || "").localeCompare(b.name || "") ||
        (a.flavor || "").localeCompare(b.flavor || "") ||
        (Number(a.price) || 0) - (Number(b.price) || 0),
    );

  const normalizedSearch = String(search || "")
    .trim()
    .toLowerCase();
  const variants = allVariants.filter((s) => {
    if (category !== "All" && s.category !== category) return false;
    if (!normalizedSearch) return true;
    return [s.name, s.brand, s.flavor, String(s.price || "")]
      .filter(Boolean)
      .some((v) => String(v).toLowerCase().includes(normalizedSearch));
  });

  const addToCart = (snack) => {
    setCart((prev) => {
      const existing = prev.find((c) => c.snack.id === snack.id);
      if (existing) {
        return prev.map((c) =>
          c.snack.id === snack.id ? { ...c, qty: c.qty + 1 } : c,
        );
      }
      return [...prev, { snack, qty: 1 }];
    });
  };

  const cartCount = cart.reduce((sum, c) => sum + c.qty, 0);

  const handleCheckout = async (items, checkoutDate) => {
    for (const c of items) {
      const cost = (Number(c.snack.price) || 0) * c.qty;
      await addLog(
        c.snack.id,
        c.snack.name,
        "restock",
        c.qty,
        cost,
        "Shopping",
        checkoutDate.toISOString(),
      );
    }
    setCart([]);
    setDate(new Date());
    await load();
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <FlatList
        data={variants}
        keyExtractor={(item) => `shopping-${item.id}`}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#6c63ff"
          />
        }
        renderItem={({ item }) => (
          <View
            style={[
              styles.row,
              { backgroundColor: theme.card, borderColor: theme.border },
            ]}
          >
            <View style={styles.thumb}>
              {item.image ? (
                <Image
                  source={resolveImageSource(item.image)}
                  style={styles.thumbImg}
                  resizeMode="cover"
                />
              ) : (
                <Text style={styles.thumbEmoji}>
                  {CATEGORY_ICONS[item.category] || "🍿"}
                </Text>
              )}
            </View>
            <View style={{ flex: 1 }}>
              <Text
                style={[styles.rowName, { color: theme.text }]}
                numberOfLines={1}
              >
                {[item.name, item.flavor].filter(Boolean).join(" ")}
              </Text>
              <Text style={[styles.rowMeta, { color: theme.textMuted }]}>
                ₨{item.price} / {item.unit} · {item.stock} in stock
              </Text>
            </View>
            <TouchableOpacity
              style={styles.addBtn}
              onPress={() => addToCart(item)}
              activeOpacity={0.8}
            >
              <Ionicons name="add" size={24} color="#fff" />
            </TouchableOpacity>
          </View>
        )}
        ListHeaderComponent={
          <View>
            <TextInput
              style={[
                styles.search,
                {
                  backgroundColor: theme.card,
                  color: theme.text,
                  borderColor: theme.border,
                },
              ]}
              placeholder="Search products..."
              placeholderTextColor={theme.placeholder}
              value={search}
              onChangeText={setSearch}
            />

            <View style={styles.categoryRow}>
              {CATEGORIES.map((cat) => {
                const active = category === cat;
                return (
                  <TouchableOpacity
                    key={cat}
                    style={[
                      styles.categoryChip,
                      { borderColor: theme.border },
                      active && styles.categoryChipActive,
                    ]}
                    onPress={() => setCategory(cat)}
                  >
                    <Text
                      style={[
                        styles.categoryChipText,
                        {
                          color: active ? "#fff" : theme.textMuted,
                        },
                      ]}
                    >
                      {active ? "✓ " : ""}
                      {cat}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={[styles.header, { color: theme.textSecondary }]}>
              {variants.length} item{variants.length !== 1 ? "s" : ""} to shop
            </Text>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyEmoji}>🛒</Text>
            <Text style={[styles.emptyText, { color: theme.textMuted }]}>
              No products available. Add snacks in the Products tab first.
            </Text>
          </View>
        }
        ListFooterComponent={<View style={{ height: 24 }} />}
        contentContainerStyle={styles.list}
      />

      {cart.length > 0 && (
        <TouchableOpacity
          style={styles.cartFab}
          onPress={() => setShowCheckout(true)}
          activeOpacity={0.85}
        >
          <Ionicons name="cart" size={26} color="#fff" />
          {cartCount > 0 && (
            <View style={styles.cartBadge}>
              <Text style={styles.cartBadgeText}>{cartCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      )}

      <CheckoutModal
        visible={showCheckout}
        cart={cart}
        setCart={setCart}
        date={date}
        setDate={setDate}
        onCheckout={handleCheckout}
        onClose={() => setShowCheckout(false)}
        theme={theme}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  list: { padding: 16 },
  header: {
    fontSize: 13,
    marginBottom: 12,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  search: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    marginBottom: 12,
  },
  categoryRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 16,
  },
  categoryChip: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  categoryChipActive: { backgroundColor: "#6c63ff", borderColor: "#6c63ff" },
  categoryChipText: { fontSize: 12, fontWeight: "600" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    marginBottom: 8,
  },
  thumb: {
    width: 52,
    height: 52,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  thumbImg: { width: "100%", height: "100%" },
  thumbEmoji: { fontSize: 24 },
  rowName: { fontSize: 14, fontWeight: "700", marginBottom: 2 },
  rowMeta: { fontSize: 12 },
  addBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#6c63ff",
    alignItems: "center",
    justifyContent: "center",
  },
  emptyWrap: { alignItems: "center", marginTop: 60 },
  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 14, textAlign: "center", lineHeight: 22 },
  cartFab: {
    position: "absolute",
    right: 20,
    bottom: 24,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#6c63ff",
    alignItems: "center",
    justifyContent: "center",
    elevation: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
  },
  cartBadge: {
    position: "absolute",
    top: -4,
    right: -4,
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#ff6b6b",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  cartBadgeText: { color: "#fff", fontSize: 12, fontWeight: "700" },
  modalOverlay: {
    flex: 1,
    backgroundColor: "#00000088",
    justifyContent: "flex-end",
  },
  modalSheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    paddingBottom: 36,
    maxHeight: "92%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  modalHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  modalHeaderIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#6c63ff",
    alignItems: "center",
    justifyContent: "center",
  },
  modalTitle: { fontSize: 18, fontWeight: "700" },
  modalSubtitle: { fontSize: 12, marginTop: 2 },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  cartEmpty: { alignItems: "center", paddingVertical: 40 },
  cartEmptyEmoji: { fontSize: 48, marginBottom: 12 },
  cartEmptyText: { fontSize: 14, textAlign: "center", lineHeight: 22 },
  cartList: { maxHeight: 320, marginBottom: 8 },
  cartRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 12,
    borderWidth: 1,
    padding: 10,
    marginBottom: 8,
  },
  cartThumb: {
    width: 40,
    height: 40,
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  cartThumbImg: { width: "100%", height: "100%" },
  cartThumbEmoji: { fontSize: 18 },
  cartName: { fontSize: 13, fontWeight: "700", marginBottom: 2 },
  cartMeta: { fontSize: 11 },
  stepper: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderWidth: 1,
    borderColor: "#6c63ff",
    borderRadius: 10,
  },
  stepperBtn: {
    width: 30,
    height: 30,
    alignItems: "center",
    justifyContent: "center",
  },
  stepperQty: {
    width: 34,
    height: 30,
    borderWidth: 1,
    fontSize: 13,
    fontWeight: "700",
    paddingVertical: 0,
    paddingHorizontal: 0,
  },
  removeBtn: { padding: 4 },
  label: { fontSize: 13, marginBottom: 6, marginTop: 8 },
  dateRow: { flexDirection: "row", gap: 8, marginTop: 4 },
  dateChip: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 10,
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  dateChipText: { fontSize: 13, fontWeight: "600" },
  iosPicker: { borderRadius: 10, marginTop: 8, overflow: "hidden" },
  iosPickerDone: {
    alignItems: "flex-end",
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  checkoutBtn: {
    borderRadius: 14,
    padding: 16,
    alignItems: "center",
    marginTop: 16,
  },
  checkoutBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
});

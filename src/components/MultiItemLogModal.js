import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  Image,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import {
  getSnacks,
  addLog,
  batchAddLogs,
  getRecentConsumedSnacks,
} from "../db/database";
import { resolveImageSource } from "../utils/images";

// Only used in restock mode when the user is adding stock; consume mode uses
// batchAddLogs so we still import addLog for the single-choice default.
const CATEGORY_ICONS = {
  Chips: "🥔",
  Biscuits: "🍪",
  Candy: "🍫",
  Drinks: "🥤",
  Snack: "🍟",
  General: "🍿",
  Other: "📦",
};
const categoryEmoji = (cat) => CATEGORY_ICONS[cat] || "🍿";

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

const stockColorFor = (stock) =>
  stock <= 0 ? "#ff6b6b" : stock <= 2 ? "#ffa94d" : "#69db7c";

function Thumb({ snack, size }) {
  if (snack.image) {
    const src = resolveImageSource(snack.image);
    if (src) {
      return (
        <Image
          source={src}
          style={{ width: size, height: size, borderRadius: size / 2.5 }}
          resizeMode="cover"
        />
      );
    }
  }
  return (
    <View
      style={[
        styles.thumbEmojiWrap,
        {
          width: size,
          height: size,
          borderRadius: size / 2.5,
        },
      ]}
    >
      <Text style={[styles.thumbEmoji, { fontSize: size / 2 }]}>
        {categoryEmoji(snack.category)}
      </Text>
    </View>
  );
}

// mode: "restock" (add to stock) or "consume" (reduce stock)
export default function MultiItemLogModal({
  visible,
  mode,
  onClose,
  onSaved,
  theme,
}) {
  const isRestock = mode === "restock";
  const [catalog, setCatalog] = useState([]);
  const [recent, setRecent] = useState([]);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [cart, setCart] = useState([]); // [{ snack, qty }]
  const [date, setDate] = useState(new Date());
  const [pickerMode, setPickerMode] = useState(null);
  const [saving, setSaving] = useState(false);

  const loadCatalog = useCallback(async () => {
    if (!visible) return;
    const all = await getSnacks();
    setCatalog(all);
    setSearch("");
    setCategory("All");
    setCart([]);
    setDate(new Date());
    setPickerMode(null);
    // Show quick-reuse recently consumed snacks (consume mode only).
    if (!isRestock) {
      const recentConsumed = await getRecentConsumedSnacks(6);
      const inCatalog = new Set(all.map((s) => s.id));
      setRecent(
        recentConsumed.filter(
          (s) => inCatalog.has(s.id) && Number(s.stock) > 0,
        ),
      );
    } else {
      setRecent([]);
    }
  }, [visible, isRestock]);

  React.useEffect(() => {
    if (visible) loadCatalog();
  }, [visible, loadCatalog]);

  const normalizedSearch = String(search || "")
    .trim()
    .toLowerCase();

  const categoryList = ["All"]
    .concat(
      Array.from(
        new Set(catalog.map((s) => s.category).filter((c) => c && c !== "All")),
      ),
    )
    .sort((a, b) => a.localeCompare(b));

  const filtered = catalog
    .filter((s) => {
      if (category !== "All" && s.category !== category) return false;
      if (!normalizedSearch) return true;
      return [s.name, s.brand, s.flavor, String(s.price || "")]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(normalizedSearch));
    })
    .filter((s) => (isRestock ? true : Number(s.stock) > 0))
    .sort(
      (a, b) =>
        (a.name || "").localeCompare(b.name || "") ||
        (a.flavor || "").localeCompare(b.flavor || "") ||
        (Number(a.price) || 0) - (Number(b.price) || 0),
    );

  const addToCart = (snack) => {
    setCart((prev) => {
      const existing = prev.find((c) => c.snack.id === snack.id);
      const currentQty = existing ? existing.qty : 0;
      if (!isRestock && currentQty >= Number(snack.stock)) {
        return prev;
      }
      if (existing) {
        return prev.map((c) =>
          c.snack.id === snack.id ? { ...c, qty: c.qty + 1 } : c,
        );
      }
      return [...prev, { snack, qty: 1 }];
    });
  };

  const setQty = (id, qty) => {
    const item = cart.find((c) => c.snack.id === id);
    const maxQty = isRestock ? Infinity : Number(item?.snack.stock ?? Infinity);
    let q = parseInt(qty, 10);
    if (Number.isNaN(q) || q < 1) q = 1;
    if (!isRestock && q > maxQty) {
      q = maxQty;
      if (maxQty <= 0) return;
      Alert.alert(
        "Insufficient stock",
        `Only ${item?.snack.stock} ${item?.snack.unit} of this snack is in stock.`,
      );
    }
    setCart((prev) =>
      prev.map((c) => (c.snack.id === id ? { ...c, qty: q } : c)),
    );
  };

  const removeFromCart = (id) => {
    setCart((prev) => prev.filter((c) => c.snack.id !== id));
  };

  const totalCost = cart.reduce(
    (sum, c) => sum + (Number(c.snack.price) || 0) * c.qty,
    0,
  );
  const totalItems = cart.reduce((sum, c) => sum + c.qty, 0);

  const handlePickerChange = (event, selectedDate) => {
    if (Platform.OS === "android") {
      setPickerMode(null);
      if (event.type === "set" && selectedDate) setDate(selectedDate);
      return;
    }
    if (selectedDate) setDate(selectedDate);
  };

  const handleSave = async () => {
    if (!cart.length) return Alert.alert("Add at least one item");
    if (isRestock) {
      const noPrice = cart.find((c) => Number(c.snack.price) <= 0);
      if (noPrice) {
        return Alert.alert(
          "No unit price",
          `"${[noPrice.snack.name, noPrice.snack.flavor].filter(Boolean).join(" ")}" has no unit price set. Edit it in Manage Catalog first.`,
        );
      }
    }
    setSaving(true);
    try {
      if (isRestock) {
        for (const c of cart) {
          const cost = (Number(c.snack.price) || 0) * c.qty;
          await addLog(
            c.snack.id,
            c.snack.name,
            mode,
            c.qty,
            cost,
            "",
            date.toISOString(),
          );
        }
      } else {
        await batchAddLogs(
          cart.map((c) => ({
            snackId: c.snack.id,
            snackName: c.snack.name,
            type: "consume",
            qty: c.qty,
            cost: 0,
            note: "",
            date: date.toISOString(),
          })),
        );
      }
      onSaved();
      onClose();
    } catch (e) {
      Alert.alert("Error", e.message);
    }
    setSaving(false);
  };

  const quickAddRecent = (s) => {
    const live = catalog.find((c) => c.id === s.id);
    if (!live) return;
    if (!isRestock && Number(live.stock) <= 0) return;
    addToCart(live);
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
                  <Ionicons
                    name={isRestock ? "add" : "restaurant-outline"}
                    size={20}
                    color="#fff"
                  />
                </View>
                <View>
                  <Text style={[styles.modalTitle, { color: theme.text }]}>
                    {isRestock
                      ? "Add Multiple Items"
                      : "Log Multiple Consumption"}
                  </Text>
                  <Text
                    style={[styles.modalSubtitle, { color: theme.textMuted }]}
                  >
                    {isRestock
                      ? "Add stock to several snacks at once"
                      : "Consume stock from several snacks at once"}
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                style={[styles.closeButton, { backgroundColor: theme.input }]}
                onPress={onClose}
              >
                <Ionicons name="close" size={20} color={theme.textMuted} />
              </TouchableOpacity>
            </View>

            <TextInput
              style={[
                styles.search,
                {
                  backgroundColor: theme.input,
                  color: theme.text,
                  borderColor: theme.border,
                },
              ]}
              placeholder="Search snacks..."
              placeholderTextColor={theme.placeholder}
              value={search}
              onChangeText={setSearch}
            />

            {/* Category quick filters */}
            {categoryList.length > 1 && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                style={styles.categoryRow}
                contentContainerStyle={styles.categoryRowContent}
              >
                {categoryList.map((cat) => {
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
                      activeOpacity={0.8}
                    >
                      <Text
                        style={[
                          styles.categoryChipText,
                          { color: active ? "#fff" : theme.textMuted },
                        ]}
                      >
                        {active ? "✓ " : ""}
                        {cat}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}

            {/* Recently consumed quick strip (consume mode only) */}
            {!isRestock && recent.length > 0 && (
              <View style={styles.recentWrap}>
                <View style={styles.recentHeader}>
                  <Ionicons
                    name="time-outline"
                    size={13}
                    color={theme.textMuted}
                  />
                  <Text
                    style={[styles.recentLabel, { color: theme.textMuted }]}
                  >
                    RECENTLY LOGGED
                  </Text>
                </View>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                  contentContainerStyle={styles.recentContent}
                >
                  {recent.map((s) => (
                    <TouchableOpacity
                      key={s.id}
                      style={[
                        styles.recentChip,
                        {
                          backgroundColor: theme.input,
                          borderColor:
                            Number(s.stock) <= 0 ? "#ff6b6b44" : theme.border,
                        },
                      ]}
                      onPress={() => quickAddRecent(s)}
                      activeOpacity={0.7}
                    >
                      <Thumb snack={s} size={30} />
                      <Text
                        style={[styles.recentChipText, { color: theme.text }]}
                        numberOfLines={1}
                      >
                        {[s.name, s.flavor].filter(Boolean).join(" ")}
                      </Text>
                      <Text
                        style={[
                          styles.recentChipStock,
                          { color: stockColorFor(Number(s.stock)) },
                        ]}
                      >
                        {s.stock} {s.unit}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}

            {/* Cart summary chips */}
            {cart.length > 0 && (
              <View style={styles.cartSummary}>
                <Text style={[styles.cartSummaryText, { color: theme.text }]}>
                  {cart.length} item{cart.length > 1 ? "s" : ""} · {totalItems}{" "}
                  unit{totalItems !== 1 ? "s" : ""}
                </Text>
                {isRestock && (
                  <Text style={[styles.cartSummaryTotal, { color: "#69db7c" }]}>
                    ₨{totalCost.toLocaleString()}
                  </Text>
                )}
              </View>
            )}

            <ScrollView
              style={styles.pickerList}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {filtered.map((s) => {
                const inCart = cart.find((c) => c.snack.id === s.id);
                const label = [s.name, s.flavor].filter(Boolean).join(" ");
                const lowStock = Number(s.stock) <= 2;
                return (
                  <TouchableOpacity
                    key={s.id}
                    style={[
                      styles.pickerRow,
                      {
                        backgroundColor: theme.input,
                        borderColor: inCart ? "#6c63ff" : theme.border,
                      },
                    ]}
                    onPress={() => addToCart(s)}
                    activeOpacity={0.8}
                  >
                    <Thumb snack={s} size={38} />
                    <View style={{ flex: 1 }}>
                      <Text
                        style={[
                          styles.pickerRowText,
                          { color: theme.text },
                          inCart && {
                            color: "#6c63ff",
                            fontWeight: "700",
                          },
                        ]}
                        numberOfLines={1}
                      >
                        {label}
                      </Text>
                      <Text
                        style={[
                          styles.pickerRowMeta,
                          { color: theme.textMuted },
                          lowStock && { color: "#ffa94d" },
                        ]}
                        numberOfLines={1}
                      >
                        ₨{s.price} / {s.unit} · {s.stock} in stock
                        {lowStock ? " · LOW" : ""}
                      </Text>
                    </View>
                    {inCart ? (
                      <View style={styles.inCartBadge}>
                        <Text style={styles.inCartBadgeText}>{inCart.qty}</Text>
                      </View>
                    ) : (
                      <Ionicons
                        name="add-circle-outline"
                        size={22}
                        color="#6c63ff"
                      />
                    )}
                  </TouchableOpacity>
                );
              })}
              {filtered.length === 0 && (
                <View style={styles.pickerEmpty}>
                  <Text style={styles.pickerEmptyEmoji}>🔍</Text>
                  <Text
                    style={[styles.pickerEmptyText, { color: theme.textMuted }]}
                  >
                    {isRestock
                      ? "No snacks found in this category."
                      : "No snacks with stock available."}
                  </Text>
                </View>
              )}
            </ScrollView>

            {/* Cart list */}
            {cart.length > 0 && (
              <ScrollView
                style={styles.cartList}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                <Text style={[styles.cartLabel, { color: theme.textMuted }]}>
                  {isRestock ? "ITEMS TO ADD" : "ITEMS TO CONSUME"}
                </Text>
                {cart.map((c) => {
                  const remaining = Math.max(
                    0,
                    Number(c.snack.stock) - (isRestock ? 0 : c.qty),
                  );
                  return (
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
                      <View style={{ flex: 1 }}>
                        <Text
                          style={[styles.cartRowName, { color: theme.text }]}
                          numberOfLines={1}
                        >
                          {[c.snack.name, c.snack.flavor]
                            .filter(Boolean)
                            .join(" ")}
                        </Text>
                        <Text
                          style={[
                            styles.cartRowMeta,
                            { color: theme.textMuted },
                          ]}
                        >
                          ₨{c.snack.price} / {c.snack.unit}
                          {!isRestock ? ` · ${remaining} left after` : ""}
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
                          onBlur={() => setQty(c.snack.id, c.qty || 1)}
                          textAlign="center"
                        />
                        <TouchableOpacity
                          style={[
                            styles.stepperBtn,
                            !isRestock &&
                              c.qty >= Number(c.snack.stock) && {
                                opacity: 0.35,
                              },
                          ]}
                          onPress={() => setQty(c.snack.id, c.qty + 1)}
                          disabled={
                            !isRestock && c.qty >= Number(c.snack.stock)
                          }
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
                  );
                })}
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
                styles.saveBtn,
                { backgroundColor: isRestock ? "#69db7c" : "#6c63ff" },
                saving && { opacity: 0.5 },
              ]}
              onPress={handleSave}
              disabled={saving}
            >
              <Text style={styles.saveBtnText}>
                {saving
                  ? "Saving..."
                  : isRestock
                    ? `Add ${totalItems} to Stock`
                    : `Log ${totalItems} Consumed`}
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

const styles = StyleSheet.create({
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
    maxHeight: "100%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
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
  closeButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  search: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    marginBottom: 10,
  },
  categoryRow: { marginBottom: 10 },
  categoryRowContent: { gap: 8, paddingRight: 8 },
  categoryChip: {
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  categoryChipActive: {
    backgroundColor: "#6c63ff",
    borderColor: "#6c63ff",
  },
  categoryChipText: { fontSize: 12, fontWeight: "600" },
  recentWrap: { marginBottom: 10 },
  recentHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginBottom: 8,
  },
  recentLabel: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1,
  },
  recentContent: { gap: 8, paddingRight: 8 },
  recentChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 8,
    maxWidth: 180,
  },
  recentChipText: { fontSize: 12, fontWeight: "600", flexShrink: 1 },
  recentChipStock: { fontSize: 10, fontWeight: "700", flexShrink: 0 },
  thumbEmojiWrap: {
    backgroundColor: "#6c63ff22",
    alignItems: "center",
    justifyContent: "center",
  },
  thumbEmoji: { fontWeight: "600" },
  cartSummary: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  cartSummaryText: { fontSize: 13, fontWeight: "600" },
  cartSummaryTotal: { fontSize: 15, fontWeight: "700" },
  pickerList: { maxHeight: 190, marginBottom: 8 },
  pickerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 8,
  },
  pickerRowText: { flex: 1, fontSize: 14 },
  pickerRowMeta: { fontSize: 12, marginTop: 1 },
  pickerEmpty: { alignItems: "center", paddingVertical: 24 },
  pickerEmptyEmoji: { fontSize: 32, marginBottom: 8 },
  pickerEmptyText: { fontSize: 13, textAlign: "center" },
  inCartBadge: {
    minWidth: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "#6c63ff",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  inCartBadgeText: { color: "#fff", fontSize: 13, fontWeight: "700" },
  cartLabel: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1,
    marginBottom: 8,
    marginTop: 4,
  },
  cartList: { maxHeight: 250, marginBottom: 8 },
  cartRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 12,
    borderWidth: 1,
    padding: 10,
    marginBottom: 8,
  },
  cartRowName: { fontSize: 13, fontWeight: "700", marginBottom: 2 },
  cartRowMeta: { fontSize: 11 },
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
  saveBtn: {
    borderRadius: 14,
    padding: 16,
    alignItems: "center",
    marginTop: 16,
  },
  saveBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
});

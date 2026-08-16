import React, { useState, useCallback, useMemo, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
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
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];
const fmtDate = (d) =>
  `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
const fmtTime = (d) => {
  const h = d.getHours();
  return `${h % 12 || 12}:${String(d.getMinutes()).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
};

const stockColorFor = (stock) =>
  stock <= 0 ? "#ff6b6b" : stock <= 2 ? "#ffa94d" : "#69db7c";

export default function ProductDetailScreen({ route, navigation }) {
  const { theme } = useTheme();
  const { productKey } = route.params;
  const [snacks, setSnacks] = useState([]);
  const [selectedFlavor, setSelectedFlavor] = useState(null);
  const [selectedPrice, setSelectedPrice] = useState(null);

  const [logModalMode, setLogModalMode] = useState(null); // 'consume' | 'restock' | null
  const [qty, setQty] = useState("1");
  const [note, setNote] = useState("");
  const [date, setDate] = useState(new Date());
  const [pickerMode, setPickerMode] = useState(null);
  const [saving, setSaving] = useState(false);

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

  const activeVariantName = activeVariant
    ? [product.name, hasFlavors ? selectedFlavor : null]
        .filter(Boolean)
        .join(" ")
    : product.name;

  const openLogModal = (mode) => {
    setLogModalMode(mode);
    setQty("1");
    setNote("");
    setDate(new Date());
    setPickerMode(null);
  };

  const closeLogModal = () => {
    setLogModalMode(null);
    setPickerMode(null);
  };

  const handlePickerChange = (event, selectedDate) => {
    if (Platform.OS === "android") {
      setPickerMode(null);
      if (event.type === "set" && selectedDate) setDate(selectedDate);
      return;
    }
    if (selectedDate) setDate(selectedDate);
  };

  const handleSaveLog = async () => {
    if (!activeVariant) return;
    const parsedQty = parseInt(qty, 10);
    if (Number.isNaN(parsedQty) || parsedQty <= 0) {
      return Alert.alert("Invalid quantity", "Please enter a valid quantity.");
    }
    if (logModalMode === "consume" && parsedQty > Number(activeVariant.stock)) {
      return Alert.alert(
        "Insufficient stock",
        `Only ${activeVariant.stock} ${activeVariant.unit} available in stock.`
      );
    }

    setSaving(true);
    try {
      const cost = (Number(activeVariant.price) || 0) * parsedQty;
      await addLog(
        activeVariant.id,
        activeVariantName,
        logModalMode,
        parsedQty,
        cost,
        note.trim(),
        date.toISOString()
      );
      await load();
      closeLogModal();
      Alert.alert(
        "Success",
        logModalMode === "consume"
          ? `Logged consumption of ${parsedQty} ${activeVariant.unit}.`
          : `Logged restock of ${parsedQty} ${activeVariant.unit}.`
      );
    } catch (e) {
      Alert.alert("Error", e.message);
    }
    setSaving(false);
  };

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
              {activeVariantName}
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
                  marginBottom: 12,
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

            {/* Log Buttons for activeVariant */}
            <View style={styles.actionRow}>
              <TouchableOpacity
                style={[
                  styles.actionBtn,
                  { backgroundColor: "#6c63ff" },
                  Number(activeVariant.stock) <= 0 && styles.actionBtnDisabled,
                ]}
                disabled={Number(activeVariant.stock) <= 0}
                onPress={() => openLogModal("consume")}
                activeOpacity={0.85}
              >
                <Ionicons name="restaurant-outline" size={18} color="#fff" />
                <Text style={styles.actionBtnText}>Consume</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: "#37b24d" }]}
                onPress={() => openLogModal("restock")}
                activeOpacity={0.85}
              >
                <Ionicons name="cart-outline" size={18} color="#fff" />
                <Text style={styles.actionBtnText}>Restock</Text>
              </TouchableOpacity>
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

      {/* Log Action Modal for activeVariant */}
      {activeVariant && (
        <Modal
          visible={logModalMode !== null}
          transparent
          animationType="slide"
          onRequestClose={closeLogModal}
        >
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === "ios" ? "padding" : "height"}
          >
            <View style={styles.modalOverlay}>
              <View style={[styles.modalSheet, { backgroundColor: theme.card }]}>
                <View style={styles.modalHeader}>
                  <View style={styles.modalHeaderLeft}>
                    <Ionicons
                      name={logModalMode === "consume" ? "restaurant" : "cart"}
                      size={22}
                      color={logModalMode === "consume" ? "#6c63ff" : "#37b24d"}
                    />
                    <Text style={[styles.modalTitle, { color: theme.text }]}>
                      {logModalMode === "consume" ? "Log Consumption" : "Log Restock"}
                    </Text>
                  </View>
                  <TouchableOpacity onPress={closeLogModal} style={styles.modalCloseBtn}>
                    <Ionicons name="close" size={22} color={theme.textMuted} />
                  </TouchableOpacity>
                </View>

                <Text style={[styles.snackSubLabel, { color: theme.textMuted }]}>
                  {activeVariantName} ({activeVariant.stock} {activeVariant.unit} in stock)
                </Text>

                {/* Quantity Controls */}
                <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>QUANTITY</Text>
                <View style={styles.qtyContainer}>
                  <TouchableOpacity
                    style={[styles.qtyBtn, { backgroundColor: theme.input, borderColor: theme.border }]}
                    onPress={() => {
                      const current = parseInt(qty, 10) || 1;
                      if (current > 1) setQty(String(current - 1));
                    }}
                  >
                    <Ionicons name="remove" size={20} color={theme.text} />
                  </TouchableOpacity>

                  <TextInput
                    style={[styles.qtyInput, { backgroundColor: theme.input, color: theme.text, borderColor: theme.border }]}
                    keyboardType="numeric"
                    value={qty}
                    onChangeText={setQty}
                  />

                  <TouchableOpacity
                    style={[styles.qtyBtn, { backgroundColor: theme.input, borderColor: theme.border }]}
                    onPress={() => {
                      const current = parseInt(qty, 10) || 0;
                      setQty(String(current + 1));
                    }}
                  >
                    <Ionicons name="add" size={20} color={theme.text} />
                  </TouchableOpacity>
                </View>

                {/* Date & Time Picker */}
                <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>DATE & TIME</Text>
                <View style={styles.dateTimeRow}>
                  <TouchableOpacity
                    style={[styles.dateChip, { backgroundColor: theme.input, borderColor: theme.border }]}
                    onPress={() => setPickerMode("date")}
                  >
                    <Ionicons name="calendar-outline" size={16} color="#6c63ff" />
                    <Text style={[styles.dateChipText, { color: theme.text }]}>{fmtDate(date)}</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.dateChip, { backgroundColor: theme.input, borderColor: theme.border }]}
                    onPress={() => setPickerMode("time")}
                  >
                    <Ionicons name="time-outline" size={16} color="#6c63ff" />
                    <Text style={[styles.dateChipText, { color: theme.text }]}>{fmtTime(date)}</Text>
                  </TouchableOpacity>
                </View>

                {pickerMode && (
                  <DateTimePicker
                    value={date}
                    mode={pickerMode}
                    display={Platform.OS === "ios" ? "spinner" : "default"}
                    onChange={handlePickerChange}
                  />
                )}

                {/* Optional Note */}
                <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>NOTE (OPTIONAL)</Text>
                <TextInput
                  style={[styles.noteInput, { backgroundColor: theme.input, color: theme.text, borderColor: theme.border }]}
                  placeholder="e.g. Late night snack, Shared with friends"
                  placeholderTextColor={theme.placeholder}
                  value={note}
                  onChangeText={setNote}
                />

                {/* Total Cost preview if applicable */}
                {activeVariant.price > 0 && (
                  <View style={styles.costRow}>
                    <Text style={[styles.costLabel, { color: theme.textMuted }]}>Total Value:</Text>
                    <Text style={[styles.costValue, { color: theme.text }]}>
                      ₨{(Number(activeVariant.price) || 0) * (parseInt(qty, 10) || 0)}
                    </Text>
                  </View>
                )}

                <TouchableOpacity
                  style={[
                    styles.saveBtn,
                    { backgroundColor: logModalMode === "consume" ? "#6c63ff" : "#37b24d" },
                    saving && { opacity: 0.6 },
                  ]}
                  disabled={saving}
                  onPress={handleSaveLog}
                >
                  <Text style={styles.saveBtnText}>
                    {saving ? "Saving..." : logModalMode === "consume" ? "Save Consumption Log" : "Save Restock Log"}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>
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
  actionRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 6,
  },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
  actionBtnDisabled: {
    opacity: 0.5,
  },
  actionBtnText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 13,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 34,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  modalHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  modalCloseBtn: {
    padding: 4,
  },
  snackSubLabel: {
    fontSize: 13,
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 8,
    marginTop: 8,
  },
  qtyContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 12,
  },
  qtyBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  qtyInput: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    textAlign: "center",
    fontSize: 18,
    fontWeight: "700",
  },
  dateTimeRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 12,
  },
  dateChip: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  dateChipText: {
    fontSize: 13,
    fontWeight: "600",
  },
  noteInput: {
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontSize: 14,
    marginBottom: 16,
  },
  costRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  costLabel: {
    fontSize: 14,
  },
  costValue: {
    fontSize: 16,
    fontWeight: "700",
  },
  saveBtn: {
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  saveBtnText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
  },
});

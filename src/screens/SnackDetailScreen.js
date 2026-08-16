import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { getSnacks, addLog } from "../db/database";
import { useTheme } from "../context/ThemeContext";
import { resolveImageSource } from "../utils/images";
import { productKeyFor } from "../utils/products";

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

export default function SnackDetailScreen({ route, navigation }) {
  const { theme } = useTheme();
  const [snack, setSnack] = useState(route.params.snack);
  const [logModalMode, setLogModalMode] = useState(null); // 'consume' | 'restock' | null
  const [qty, setQty] = useState("1");
  const [note, setNote] = useState("");
  const [date, setDate] = useState(new Date());
  const [pickerMode, setPickerMode] = useState(null);
  const [saving, setSaving] = useState(false);

  const refreshSnack = async () => {
    const all = await getSnacks();
    const updated = all.find((s) => s.id === snack.id);
    if (updated) setSnack(updated);
  };

  useEffect(() => {
    refreshSnack();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const stockColor =
    snack.stock <= 0 ? "#ff6b6b" : snack.stock <= 2 ? "#ffa94d" : "#69db7c";

  const snackName = [
    snack.name,
    snack.flavor && snack.flavor !== snack.name ? snack.flavor : null,
  ]
    .filter(Boolean)
    .join(" ");

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
    const parsedQty = parseInt(qty, 10);
    if (Number.isNaN(parsedQty) || parsedQty <= 0) {
      return Alert.alert("Invalid quantity", "Please enter a valid quantity.");
    }
    if (logModalMode === "consume" && parsedQty > Number(snack.stock)) {
      return Alert.alert(
        "Insufficient stock",
        `Only ${snack.stock} ${snack.unit} available in stock.`
      );
    }

    setSaving(true);
    try {
      const cost = (Number(snack.price) || 0) * parsedQty;
      await addLog(
        snack.id,
        snackName,
        logModalMode,
        parsedQty,
        cost,
        note.trim(),
        date.toISOString()
      );
      await refreshSnack();
      closeLogModal();
      Alert.alert(
        "Success",
        logModalMode === "consume"
          ? `Logged consumption of ${parsedQty} ${snack.unit}.`
          : `Logged restock of ${parsedQty} ${snack.unit}.`
      );
    } catch (e) {
      Alert.alert("Error", e.message);
    }
    setSaving(false);
  };

  const handleGoToProduct = () => {
    const pKey = productKeyFor(snack);
    navigation.navigate("ProductDetail", {
      productKey: pKey,
      productName: snack.name || snack.brand || "Product",
    });
  };

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
            {snackName}
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

        {/* Quick Log Action Section */}
        <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>
          Log Activity
        </Text>
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[
              styles.actionBtn,
              { backgroundColor: "#6c63ff" },
              Number(snack.stock) <= 0 && styles.actionBtnDisabled,
            ]}
            disabled={Number(snack.stock) <= 0}
            onPress={() => openLogModal("consume")}
            activeOpacity={0.85}
          >
            <Ionicons name="restaurant-outline" size={20} color="#fff" />
            <Text style={styles.actionBtnText}>Log Consumption</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: "#37b24d" }]}
            onPress={() => openLogModal("restock")}
            activeOpacity={0.85}
          >
            <Ionicons name="cart-outline" size={20} color="#fff" />
            <Text style={styles.actionBtnText}>Log Restock</Text>
          </TouchableOpacity>
        </View>

        {/* Navigation to Product Detail */}
        <TouchableOpacity
          style={[styles.productLinkCard, { backgroundColor: theme.card, borderColor: theme.border }]}
          onPress={handleGoToProduct}
          activeOpacity={0.8}
        >
          <View style={styles.productLinkLeft}>
            <Ionicons name="grid-outline" size={20} color="#6c63ff" />
            <Text style={[styles.productLinkText, { color: theme.text }]}>
              View All Product Flavors & Prices
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={theme.textMuted} />
        </TouchableOpacity>
      </ScrollView>

      {/* Log Action Modal */}
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
                {snackName} ({snack.stock} {snack.unit} in stock)
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
              {snack.price > 0 && (
                <View style={styles.costRow}>
                  <Text style={[styles.costLabel, { color: theme.textMuted }]}>Total Value:</Text>
                  <Text style={[styles.costValue, { color: theme.text }]}>
                    ₨{(Number(snack.price) || 0) * (parseInt(qty, 10) || 0)}
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
    </View>
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
  sectionTitle: {
    fontSize: 13,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  actionRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 16,
  },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 12,
  },
  actionBtnDisabled: {
    opacity: 0.5,
  },
  actionBtnText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 14,
  },
  productLinkCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
  },
  productLinkLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  productLinkText: {
    fontSize: 14,
    fontWeight: "600",
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


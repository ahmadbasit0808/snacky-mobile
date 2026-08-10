import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  SectionList,
  TouchableOpacity,
  RefreshControl,
  Platform,
  TextInput,
  Alert,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { getLogsFiltered, deleteLog, updateLog } from "../db/database";
import { useTheme } from "../context/ThemeContext";
import MultiItemLogModal from "../components/MultiItemLogModal";

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

const TYPE_CONFIG = {
  restock: {
    emoji: "🛒",
    icon: "cart-outline",
    label: "Purchased",
    color: "#69db7c",
    sign: "+",
  },
  consume: {
    emoji: "🍽️",
    icon: "restaurant-outline",
    label: "Consumed",
    color: "#6c63ff",
    sign: "-",
  },
};

const DEFAULT_CFG = {
  emoji: "📋",
  icon: "receipt-outline",
  label: "Transaction",
  color: "#999",
  sign: "+",
};

// Produce a clean section label from a Date: "Today", "Yesterday", or a date.
function sectionLabel(date) {
  const now = new Date();
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);

  const diffDays = Math.round(
    (startOfToday - startOfDay) / (1000 * 60 * 60 * 24),
  );
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  return `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

// Keep sections ordered newest-first.
function groupByDate(logs) {
  const map = new Map();
  for (const item of logs) {
    const d = new Date(item.date);
    if (Number.isNaN(d.getTime())) continue;
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    if (!map.has(key)) map.set(key, { title: sectionLabel(d), data: [] });
    map.get(key).data.push(item);
  }
  return Array.from(map.values());
}

function LogCard({ item, theme, onDelete, onEdit }) {
  const cfg = TYPE_CONFIG[item.type] || DEFAULT_CFG;
  const date = new Date(item.date);
  const h = date.getHours();
  const timeStr = `${h % 12 || 12}:${String(date.getMinutes()).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;

  return (
    <View style={[styles.logCard, { backgroundColor: theme.card }]}>
      <View style={[styles.logIcon, { backgroundColor: cfg.color + "1c" }]}>
        <Ionicons name={cfg.icon} size={18} color={cfg.color} />
      </View>

      <View style={styles.logInfo}>
        <Text style={[styles.logName, { color: theme.text }]} numberOfLines={1}>
          {item.snack_name}
        </Text>
        <Text style={[styles.logMeta, { color: theme.textMuted }]}>
          {cfg.label}
          {item.type === "restock" && item.cost > 0
            ? ` · ₨${item.cost.toLocaleString()}`
            : ""}
        </Text>
        {item.note ? (
          <Text
            style={[styles.logNote, { color: theme.textSecondary }]}
            numberOfLines={1}
          >
            “{item.note}”
          </Text>
        ) : null}
        <Text style={[styles.logDate, { color: theme.textMuted }]}>
          {timeStr}
        </Text>
      </View>

      <View style={[styles.qtyBadge, { backgroundColor: cfg.color + "22" }]}>
        <Text style={[styles.qtyText, { color: cfg.color }]}>
          {cfg.sign}
          {item.qty}
        </Text>
        <Text style={[styles.qtyUnit, { color: cfg.color }]}>
          {item.type === "restock" ? "added" : "consumed"}
        </Text>
      </View>

      <View style={styles.logActions}>
        <TouchableOpacity
          onPress={() => onEdit(item)}
          style={[styles.iconBtn, { backgroundColor: theme.input }]}
          activeOpacity={0.7}
        >
          <Ionicons name="pencil-outline" size={15} color="#6c63ff" />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => onDelete(item)}
          style={[styles.iconBtn, { backgroundColor: theme.input }]}
          activeOpacity={0.7}
        >
          <Ionicons name="trash-outline" size={15} color="#ff6b6b" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const KIND_OPTIONS = [
  { key: "all", label: "All", icon: "apps-outline" },
  { key: "restock", label: "Purchases", icon: "cart-outline" },
  { key: "consume", label: "Consumed", icon: "restaurant-outline" },
];

function StatCell({ icon, label, value, color }) {
  const { theme } = useTheme();
  return (
    <View style={[styles.statCell, { backgroundColor: theme.card }]}>
      <View style={[styles.statIconWrap, { backgroundColor: color + "1e" }]}>
        <Ionicons name={icon} size={14} color={color} />
      </View>
      <Text style={[styles.statValue, { color: theme.text }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: theme.textMuted }]}>
        {label}
      </Text>
    </View>
  );
}

export default function HistoryScreen() {
  const { theme } = useTheme();
  const [logs, setLogs] = useState([]);
  const [hasMore, setHasMore] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showConsumeModal, setShowConsumeModal] = useState(false);
  const offsetRef = React.useRef(0);
  const loadingRef = React.useRef(false);
  const LIMIT = 30;

  const [kind, setKind] = useState("all");
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [search, setSearch] = useState("");
  const [pickerTarget, setPickerTarget] = useState(null);
  const [pickerValue, setPickerValue] = useState(new Date());
  const [selectedLog, setSelectedLog] = useState(null);
  const [editQty, setEditQty] = useState("");
  const [editNote, setEditNote] = useState("");
  const [editCost, setEditCost] = useState("");
  const [editDate, setEditDate] = useState(new Date());
  const [editPickerMode, setEditPickerMode] = useState(null);
  const [editSaving, setEditSaving] = useState(false);

  const activeQuery = useMemo(
    () => ({
      type: kind,
      startDate,
      endDate,
      searchQuery: search.trim().toLowerCase(),
    }),
    [kind, startDate, endDate, search],
  );

  useEffect(() => {
    if (!selectedLog) return;
    setEditQty(String(selectedLog.qty || ""));
    setEditNote(selectedLog.note || "");
    setEditCost(String(selectedLog.cost || ""));
    const parsed = new Date(selectedLog.date);
    setEditDate(Number.isNaN(parsed.getTime()) ? new Date() : parsed);
  }, [selectedLog]);

  const load = async (reset = false) => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    const offset = reset ? 0 : offsetRef.current;
    const data = await getLogsFiltered({
      limit: LIMIT,
      offset,
      ...activeQuery,
    });
    offsetRef.current = offset + data.length;
    if (reset) {
      setLogs(data);
    } else {
      setLogs((prev) => {
        const ids = new Set(prev.map((l) => l.id));
        return [...prev, ...data.filter((l) => !ids.has(l.id))];
      });
    }
    setHasMore(data.length === LIMIT);
    loadingRef.current = false;
  };

  useFocusEffect(
    useCallback(() => {
      offsetRef.current = 0;
      load(true);
    }, [
      activeQuery.type,
      activeQuery.startDate,
      activeQuery.endDate,
      activeQuery.searchQuery,
    ]),
  );

  const onRefresh = async () => {
    setRefreshing(true);
    offsetRef.current = 0;
    await load(true);
    setRefreshing(false);
  };

  const handleEdit = (item) => {
    setSelectedLog(item);
  };

  const handleSaveEdit = async () => {
    if (!selectedLog) return;
    const qty = parseFloat(editQty);
    if (!qty || qty <= 0) return Alert.alert("Enter a valid quantity");
    setEditSaving(true);
    try {
      const cost =
        selectedLog.type === "restock" ? parseFloat(editCost) || 0 : 0;
      await updateLog(
        selectedLog.id,
        editNote.trim(),
        qty,
        cost,
        editDate.toISOString(),
      );
      setSelectedLog(null);
      offsetRef.current = 0;
      await load(true);
    } catch (e) {
      Alert.alert("Error", e?.message || "Unable to update transaction.");
    }
    setEditSaving(false);
  };

  const handleEditPickerChange = (event, selected) => {
    if (Platform.OS === "android") {
      setEditPickerMode(null);
      if (event.type === "set" && selected) setEditDate(selected);
      return;
    }
    if (selected) setEditDate(selected);
  };

  const handleDelete = (item) => {
    Alert.alert(
      "Delete Log",
      `Delete this log for "${item.snack_name}"? Stock will be reversed.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            await deleteLog(item.id);
            offsetRef.current = 0;
            load(true);
          },
        },
      ],
    );
  };

  const fmtLabel = (iso) => {
    if (!iso) return "Any";
    const d = new Date(iso);
    return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
  };

  const handlePickerChange = (event, selected) => {
    if (Platform.OS === "android") {
      if (event.type === "set" && selected && pickerTarget) {
        const d = new Date(selected);
        if (pickerTarget === "start") {
          d.setHours(0, 0, 0, 0);
          setStartDate(d.toISOString());
        } else {
          d.setHours(23, 59, 59, 999);
          setEndDate(d.toISOString());
        }
      }
      setPickerTarget(null);
      return;
    }
    if (selected) {
      setPickerValue(selected);
      const d = new Date(selected);
      if (pickerTarget === "start") {
        d.setHours(0, 0, 0, 0);
        setStartDate(d.toISOString());
      } else {
        d.setHours(23, 59, 59, 999);
        setEndDate(d.toISOString());
      }
    }
  };

  const hasFilters = kind !== "all" || startDate || endDate || search;

  // Summary stats computed from currently loaded (filtered) logs.
  const stats = useMemo(() => {
    let purchases = 0;
    let consumed = 0;
    let spend = 0;
    for (const l of logs) {
      if (l.type === "restock") {
        purchases += Number(l.qty) || 0;
        spend += Number(l.cost) || 0;
      } else {
        consumed += Number(l.qty) || 0;
      }
    }
    return {
      purchases,
      consumed,
      spend,
      count: logs.length,
    };
  }, [logs]);

  const sections = useMemo(() => groupByDate(logs), [logs]);

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      {/* Summary stats */}
      <View style={styles.statsRow}>
        <StatCell
          icon="cart-outline"
          label="Purchases"
          value={stats.purchases}
          color="#69db7c"
        />
        <StatCell
          icon="restaurant-outline"
          label="Consumed"
          value={stats.consumed}
          color="#6c63ff"
        />
        <StatCell
          icon="cash-outline"
          label="Spend"
          value={`₨${stats.spend.toLocaleString()}`}
          color="#ffa94d"
        />
      </View>

      <SectionList
        sections={sections}
        keyExtractor={(item) => `log-${item.id}`}
        renderItem={({ item }) => (
          <LogCard
            item={item}
            theme={theme}
            onDelete={handleDelete}
            onEdit={handleEdit}
          />
        )}
        renderSectionHeader={({ section }) => (
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: theme.textMuted }]}>
              {section.title}
            </Text>
          </View>
        )}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#6c63ff"
          />
        }
        onEndReached={() => hasMore && load(false)}
        onEndReachedThreshold={0.3}
        ListEmptyComponent={
          <View style={[styles.emptyWrap, { backgroundColor: theme.card }]}>
            <View style={[styles.emptyIcon, { backgroundColor: "#6c63ff18" }]}>
              <Ionicons name="receipt-outline" size={34} color="#6c63ff" />
            </View>
            <Text style={[styles.emptyTitle, { color: theme.text }]}>
              No transactions yet
            </Text>
            <Text style={[styles.emptySub, { color: theme.textMuted }]}>
              {hasFilters
                ? "Try adjusting your filters, or clear them to see everything."
                : "Logged purchases and consumption will appear here. Tap the button below to log consumed snacks."}
            </Text>
          </View>
        }
        ListFooterComponent={<View style={{ height: 90 }} />}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <View>
            {/* Search */}
            <TextInput
              style={[
                styles.search,
                {
                  backgroundColor: theme.card,
                  color: theme.text,
                  borderColor: theme.border,
                },
              ]}
              placeholder="Search snack name or note..."
              placeholderTextColor={theme.placeholder}
              value={search}
              onChangeText={setSearch}
            />

            {/* Type filter */}
            <View
              style={[
                styles.filterCard,
                { backgroundColor: theme.card, borderColor: theme.border },
              ]}
            >
              <View style={[styles.segment, { backgroundColor: theme.bg }]}>
                {KIND_OPTIONS.map((opt) => {
                  const active = kind === opt.key;
                  return (
                    <TouchableOpacity
                      key={opt.key}
                      style={[
                        styles.segBtn,
                        active && [
                          styles.segBtnActive,
                          { backgroundColor: theme.card },
                        ],
                      ]}
                      onPress={() => setKind(opt.key)}
                      activeOpacity={0.7}
                    >
                      <Ionicons
                        name={opt.icon}
                        size={14}
                        color={active ? "#6c63ff" : theme.textMuted}
                      />
                      <Text
                        style={[
                          styles.segLabel,
                          { color: active ? "#6c63ff" : theme.textMuted },
                          active && { fontWeight: "700" },
                        ]}
                      >
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Date range */}
              <View style={styles.dateRow}>
                <TouchableOpacity
                  style={[
                    styles.dateChip,
                    {
                      backgroundColor: theme.bg,
                      borderColor: theme.border,
                    },
                  ]}
                  onPress={() => {
                    setPickerTarget("start");
                    setPickerValue(
                      startDate ? new Date(startDate) : new Date(),
                    );
                  }}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name="calendar-outline"
                    size={14}
                    color={startDate ? "#6c63ff" : theme.textMuted}
                  />
                  <View style={styles.dateChipTextWrap}>
                    <Text
                      style={[styles.dateChipLabel, { color: theme.textMuted }]}
                    >
                      From
                    </Text>
                    <Text
                      style={[
                        styles.dateChipValue,
                        { color: startDate ? "#6c63ff" : theme.text },
                      ]}
                      numberOfLines={1}
                    >
                      {fmtLabel(startDate)}
                    </Text>
                  </View>
                </TouchableOpacity>

                <View style={styles.dateDivider}>
                  <Ionicons
                    name="arrow-forward"
                    size={13}
                    color={theme.textMuted}
                  />
                </View>

                <TouchableOpacity
                  style={[
                    styles.dateChip,
                    {
                      backgroundColor: theme.bg,
                      borderColor: theme.border,
                    },
                  ]}
                  onPress={() => {
                    setPickerTarget("end");
                    setPickerValue(endDate ? new Date(endDate) : new Date());
                  }}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name="calendar-outline"
                    size={14}
                    color={endDate ? "#6c63ff" : theme.textMuted}
                  />
                  <View style={styles.dateChipTextWrap}>
                    <Text
                      style={[styles.dateChipLabel, { color: theme.textMuted }]}
                    >
                      To
                    </Text>
                    <Text
                      style={[
                        styles.dateChipValue,
                        { color: endDate ? "#6c63ff" : theme.text },
                      ]}
                      numberOfLines={1}
                    >
                      {fmtLabel(endDate)}
                    </Text>
                  </View>
                </TouchableOpacity>
              </View>

              {hasFilters && (
                <TouchableOpacity
                  style={styles.clearBtn}
                  onPress={() => {
                    setKind("all");
                    setStartDate(null);
                    setEndDate(null);
                    setSearch("");
                  }}
                  activeOpacity={0.6}
                >
                  <Ionicons name="close-circle" size={14} color="#ff6b6b" />
                  <Text style={styles.clearText}>Clear filters</Text>
                </TouchableOpacity>
              )}
            </View>

            {pickerTarget && Platform.OS === "ios" && (
              <View style={[styles.iosPicker, { backgroundColor: theme.card }]}>
                <DateTimePicker
                  value={pickerValue}
                  mode="date"
                  display="spinner"
                  onChange={handlePickerChange}
                />
                <TouchableOpacity
                  style={styles.iosPickerDone}
                  onPress={() => setPickerTarget(null)}
                >
                  <Text style={{ color: "#6c63ff", fontWeight: "600" }}>
                    Done
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        }
      />

      {selectedLog && (
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { backgroundColor: theme.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>
                Edit Transaction
              </Text>
              <TouchableOpacity
                style={[styles.modalClose, { backgroundColor: theme.input }]}
                onPress={() => setSelectedLog(null)}
              >
                <Ionicons name="close" size={20} color={theme.textMuted} />
              </TouchableOpacity>
            </View>
            <View
              style={[
                styles.modalSnackRow,
                {
                  backgroundColor: theme.input,
                  borderColor: theme.border,
                },
              ]}
            >
              <Ionicons
                name={TYPE_CONFIG[selectedLog.type]?.icon || "receipt-outline"}
                size={16}
                color={TYPE_CONFIG[selectedLog.type]?.color || "#999"}
              />
              <Text
                style={[styles.modalSnackName, { color: theme.textSecondary }]}
                numberOfLines={1}
              >
                {selectedLog.snack_name}
              </Text>
              <Text
                style={[
                  styles.modalTypeChip,
                  { color: TYPE_CONFIG[selectedLog.type]?.color || "#999" },
                ]}
              >
                {TYPE_CONFIG[selectedLog.type]?.label || selectedLog.type}
              </Text>
            </View>
            <Text style={[styles.label, { color: theme.textSecondary }]}>
              Quantity ({selectedLog.type === "restock" ? "added" : "removed"})
            </Text>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: theme.input,
                  color: theme.text,
                  borderColor: theme.border,
                },
              ]}
              keyboardType="numeric"
              placeholder="e.g. 2"
              placeholderTextColor={theme.placeholder}
              value={editQty}
              onChangeText={setEditQty}
            />
            {selectedLog.type === "restock" && (
              <>
                <Text
                  style={[
                    styles.label,
                    { color: theme.textSecondary, marginTop: 14 },
                  ]}
                >
                  Total cost
                </Text>
                <TextInput
                  style={[
                    styles.input,
                    {
                      backgroundColor: theme.input,
                      color: theme.text,
                      borderColor: theme.border,
                    },
                  ]}
                  keyboardType="numeric"
                  placeholder="e.g. 120"
                  placeholderTextColor={theme.placeholder}
                  value={editCost}
                  onChangeText={setEditCost}
                />
              </>
            )}
            <Text
              style={[
                styles.label,
                { color: theme.textSecondary, marginTop: 14 },
              ]}
            >
              Note (optional)
            </Text>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: theme.input,
                  color: theme.text,
                  borderColor: theme.border,
                },
              ]}
              placeholder="Add a note"
              placeholderTextColor={theme.placeholder}
              value={editNote}
              onChangeText={setEditNote}
            />
            <Text
              style={[
                styles.label,
                { color: theme.textSecondary, marginTop: 14 },
              ]}
            >
              Date & Time
            </Text>
            <View style={styles.dateRow}>
              <TouchableOpacity
                style={[
                  styles.dateChip,
                  {
                    backgroundColor: theme.input,
                    borderColor: theme.border,
                  },
                ]}
                onPress={() => setEditPickerMode("date")}
              >
                <Ionicons
                  name="calendar-outline"
                  size={13}
                  color={theme.textMuted}
                />
                <Text
                  style={[styles.dateChipValue, { color: theme.text }]}
                >{`${new Date(editDate).getDate()} ${MONTHS[new Date(editDate).getMonth()]} ${new Date(editDate).getFullYear()}`}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.dateChip,
                  {
                    backgroundColor: theme.input,
                    borderColor: theme.border,
                  },
                ]}
                onPress={() => setEditPickerMode("time")}
              >
                <Ionicons
                  name="time-outline"
                  size={13}
                  color={theme.textMuted}
                />
                <Text
                  style={[styles.dateChipValue, { color: theme.text }]}
                >{`${new Date(editDate).getHours() % 12 || 12}:${String(new Date(editDate).getMinutes()).padStart(2, "0")} ${new Date(editDate).getHours() < 12 ? "AM" : "PM"}`}</Text>
              </TouchableOpacity>
            </View>
            {editPickerMode && Platform.OS === "ios" && (
              <View
                style={[styles.iosPicker, { backgroundColor: theme.input }]}
              >
                <DateTimePicker
                  value={editDate}
                  mode={editPickerMode}
                  display="spinner"
                  onChange={handleEditPickerChange}
                />
                <TouchableOpacity
                  style={styles.iosPickerDone}
                  onPress={() => setEditPickerMode(null)}
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
                { backgroundColor: "#6c63ff" },
                editSaving && { opacity: 0.5 },
              ]}
              onPress={handleSaveEdit}
              disabled={editSaving}
            >
              <Text style={styles.saveBtnText}>
                {editSaving ? "Saving..." : "Save changes"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {pickerTarget && Platform.OS === "android" && (
        <DateTimePicker
          value={pickerValue}
          mode="date"
          display="default"
          onChange={handlePickerChange}
        />
      )}

      <TouchableOpacity
        style={[styles.fab, { backgroundColor: "#6c63ff" }]}
        onPress={() => setShowConsumeModal(true)}
        activeOpacity={0.85}
      >
        <Ionicons name="restaurant" size={24} color="#fff" />
        <Text style={styles.fabLabel}>Log</Text>
      </TouchableOpacity>

      <MultiItemLogModal
        visible={showConsumeModal}
        mode="consume"
        onClose={() => setShowConsumeModal(false)}
        onSaved={() => {
          offsetRef.current = 0;
          load(true);
        }}
        theme={theme}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  // Summary stats
  statsRow: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
  },
  statCell: {
    flex: 1,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: "center",
    gap: 4,
  },
  statIconWrap: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2,
  },
  statValue: { fontSize: 16, fontWeight: "800" },
  statLabel: { fontSize: 10, fontWeight: "600", letterSpacing: 0.3 },

  listContent: { paddingHorizontal: 16, paddingBottom: 8 },

  // Search
  search: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    marginTop: 8,
    marginBottom: 10,
  },

  // Filter card
  filterCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
    gap: 10,
    marginBottom: 10,
  },
  segment: { flexDirection: "row", borderRadius: 10, padding: 3, gap: 3 },
  segBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingVertical: 8,
    borderRadius: 8,
  },
  segBtnActive: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 1,
  },
  segLabel: { fontSize: 12 },
  dateRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  dateChip: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  dateChipTextWrap: { flex: 1 },
  dateChipLabel: {
    fontSize: 9,
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginBottom: 1,
  },
  dateChipValue: { fontSize: 12, fontWeight: "600" },
  dateDivider: { paddingHorizontal: 2 },
  clearBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingTop: 2,
  },
  clearText: { fontSize: 12, fontWeight: "600", color: "#ff6b6b" },

  iosPicker: { borderRadius: 12, marginBottom: 10, overflow: "hidden" },
  iosPickerDone: {
    alignItems: "flex-end",
    paddingHorizontal: 16,
    paddingBottom: 10,
  },

  // Sections
  sectionHeader: {
    marginTop: 14,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },

  // Log card
  logCard: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 16,
    padding: 12,
    marginBottom: 10,
  },
  logIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  logInfo: { flex: 1 },
  logName: { fontSize: 14, fontWeight: "700" },
  logMeta: { fontSize: 12, marginTop: 2 },
  logNote: { fontSize: 11, marginTop: 2, fontStyle: "italic" },
  logDate: { fontSize: 11, marginTop: 3, fontWeight: "500" },
  qtyBadge: {
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
    alignItems: "center",
  },
  qtyText: { fontSize: 14, fontWeight: "800" },
  qtyUnit: { fontSize: 9, fontWeight: "600", textTransform: "uppercase" },
  logActions: { flexDirection: "row", alignItems: "center", gap: 6 },
  iconBtn: {
    width: 30,
    height: 30,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },

  // Empty state
  emptyWrap: {
    marginTop: 16,
    borderRadius: 20,
    paddingVertical: 40,
    paddingHorizontal: 24,
    alignItems: "center",
  },
  emptyIcon: {
    width: 68,
    height: 68,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  emptyTitle: { fontSize: 16, fontWeight: "700", marginBottom: 6 },
  emptySub: {
    fontSize: 13,
    textAlign: "center",
    lineHeight: 19,
    maxWidth: 280,
  },

  // Edit modal
  modalOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#00000066",
    justifyContent: "flex-end",
  },
  modalSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  modalTitle: { fontSize: 17, fontWeight: "700" },
  modalClose: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  modalSnackRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 16,
  },
  modalSnackName: { flex: 1, fontSize: 14, fontWeight: "600" },
  modalTypeChip: { fontSize: 12, fontWeight: "700" },
  label: { fontSize: 13, marginBottom: 6 },
  input: { borderRadius: 10, padding: 14, fontSize: 15, borderWidth: 1 },
  saveBtn: {
    borderRadius: 14,
    padding: 16,
    alignItems: "center",
    marginTop: 20,
  },
  saveBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },

  // FAB
  fab: {
    position: "absolute",
    right: 20,
    bottom: 24,
    height: 58,
    borderRadius: 29,
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    elevation: 6,
    shadowColor: "#6c63ff",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
  },
  fabLabel: { color: "#fff", fontSize: 14, fontWeight: "700" },
});

import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";

const KIND_OPTIONS = [
  { key: "all", label: "All", icon: "apps-outline" },
  { key: "consume", label: "Consumed", icon: "restaurant-outline" },
  { key: "restock", label: "Restocked", icon: "cube-outline" },
];

export default function HistoryFilters({
  theme, kind, onChangeKind,
  onOpenStartPicker, onOpenEndPicker,
  onClear, startLabel, endLabel, hasAny,
}) {
  return (
    <View style={[styles.card, { backgroundColor: theme.card }]}>
      <View style={[styles.segment, { backgroundColor: theme.bg }]}>
        {KIND_OPTIONS.map((opt) => {
          const active = kind === opt.key;
          return (
            <TouchableOpacity
              key={opt.key}
              style={[styles.segmentItem, active && [styles.segmentItemActive, { backgroundColor: theme.card }]]}
              onPress={() => onChangeKind(opt.key)}
              activeOpacity={0.7}
            >
              <Ionicons name={opt.icon} size={14} color={active ? "#6c63ff" : theme.textMuted} />
              <Text style={[styles.segmentLabel, { color: active ? "#6c63ff" : theme.textMuted }, active && styles.segmentLabelActive]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.dateRow}>
        <TouchableOpacity
          style={[styles.dateChip, { borderColor: theme.border || "#e9e9ef" }]}
          onPress={onOpenStartPicker}
          activeOpacity={0.7}
        >
          <Ionicons name="calendar-outline" size={13} color={theme.textMuted} />
          <View style={styles.dateChipTextWrap}>
            <Text style={[styles.dateChipLabel, { color: theme.textMuted }]}>From</Text>
            <Text style={[styles.dateChipValue, { color: theme.text }]} numberOfLines={1}>{startLabel}</Text>
          </View>
        </TouchableOpacity>

        <View style={styles.dateDivider}>
          <Ionicons name="arrow-forward" size={13} color={theme.textMuted} />
        </View>

        <TouchableOpacity
          style={[styles.dateChip, { borderColor: theme.border || "#e9e9ef" }]}
          onPress={onOpenEndPicker}
          activeOpacity={0.7}
        >
          <Ionicons name="calendar-outline" size={13} color={theme.textMuted} />
          <View style={styles.dateChipTextWrap}>
            <Text style={[styles.dateChipLabel, { color: theme.textMuted }]}>To</Text>
            <Text style={[styles.dateChipValue, { color: theme.text }]} numberOfLines={1}>{endLabel}</Text>
          </View>
        </TouchableOpacity>
      </View>

      {hasAny && (
        <TouchableOpacity style={styles.clearRow} onPress={onClear} activeOpacity={0.6}>
          <Ionicons name="close-circle" size={14} color="#ff6b6b" />
          <Text style={styles.clearText}>Clear filters</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 16, padding: 12, gap: 10 },
  segment: { flexDirection: "row", borderRadius: 10, padding: 3, gap: 3 },
  segmentItem: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, paddingVertical: 8, borderRadius: 8 },
  segmentItemActive: { shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 3, elevation: 1 },
  segmentLabel: { fontSize: 12, fontWeight: "500" },
  segmentLabelActive: { fontWeight: "700" },
  dateRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  dateChip: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 10 },
  dateChipTextWrap: { flex: 1 },
  dateChipLabel: { fontSize: 9, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 1 },
  dateChipValue: { fontSize: 12, fontWeight: "600" },
  dateDivider: { paddingHorizontal: 2 },
  clearRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, paddingTop: 2 },
  clearText: { fontSize: 12, fontWeight: "600", color: "#ff6b6b" },
});

import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { getLogsByDateRange } from "../db/database";
import { useTheme } from "../context/ThemeContext";

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

function getWeekRange(offset = 0) {
  const now = new Date();
  const day = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((day + 6) % 7) + offset * 7);
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  return { start: monday, end: sunday };
}

function getMonthRange(offset = 0) {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const end = new Date(
    now.getFullYear(),
    now.getMonth() + offset + 1,
    0,
    23,
    59,
    59,
    999,
  );
  return { start, end };
}

function StatRow({ label, value, color, theme }) {
  return (
    <View style={[styles.statRow, { borderBottomColor: theme.border }]}>
      <Text style={[styles.statLabel, { color: theme.textSecondary }]}>
        {label}
      </Text>
      <Text style={[styles.statValue, { color: color || theme.text }]}>
        ₨ {value.toLocaleString()}
      </Text>
    </View>
  );
}

function CategoryBreakdown({ logs, theme }) {
  const byName = {};
  logs.forEach((l) => {
    if (l.type !== "restock") return;
    const key = l.snack_name || "Other";
    if (!byName[key]) byName[key] = 0;
    byName[key] += Number(l.cost) || 0;
  });

  const sorted = Object.entries(byName).sort((a, b) => b[1] - a[1]);

  return (
    <View style={[styles.card, { backgroundColor: theme.card }]}>
      <Text style={[styles.cardTitle, { color: theme.textSecondary }]}>
        Spending by Product
      </Text>
      {sorted.map(([name, total]) => (
        <StatRow key={name} label={name} value={total} theme={theme} />
      ))}
      {sorted.length === 0 && (
        <Text style={[styles.empty, { color: theme.textMuted }]}>
          No purchases this period
        </Text>
      )}
    </View>
  );
}

export default function SummaryScreen() {
  const { theme } = useTheme();
  const [mode, setMode] = useState("week");
  const [offset, setOffset] = useState(0);
  const [logs, setLogs] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    const range =
      mode === "week" ? getWeekRange(offset) : getMonthRange(offset);
    const data = await getLogsByDateRange(
      range.start.toISOString(),
      range.end.toISOString(),
    );
    setLogs(data);
  };

  useFocusEffect(
    useCallback(() => {
      load();
    }, [mode, offset]),
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const totalSpent = logs
    .filter((l) => l.type === "restock")
    .reduce((s, l) => s + (Number(l.cost) || 0), 0);
  const totalPurchasedUnits = logs
    .filter((l) => l.type === "restock")
    .reduce((s, l) => s + (Number(l.qty) || 0), 0);
  const totalConsumedUnits = logs
    .filter((l) => l.type === "consume")
    .reduce((s, l) => s + (Number(l.qty) || 0), 0);
  const totalRestockLogs = logs.filter((l) => l.type === "restock").length;
  const totalConsumeLogs = logs.filter((l) => l.type === "consume").length;

  const getRangeLabel = () => {
    if (mode === "week") {
      const { start, end } = getWeekRange(offset);
      return `${start.getDate()} ${MONTHS[start.getMonth()]} – ${end.getDate()} ${MONTHS[end.getMonth()]}`;
    }
    const { start } = getMonthRange(offset);
    return start.toLocaleString("default", {
      month: "long",
      year: "numeric",
    });
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.bg }]}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor="#6c63ff"
        />
      }
    >
      <View style={[styles.toggleRow, { backgroundColor: theme.card }]}>
        <TouchableOpacity
          style={[styles.toggleBtn, mode === "week" && styles.toggleActive]}
          onPress={() => {
            setMode("week");
            setOffset(0);
          }}
        >
          <Text
            style={[
              styles.toggleText,
              { color: theme.textMuted },
              mode === "week" && styles.toggleTextActive,
            ]}
          >
            Weekly
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.toggleBtn, mode === "month" && styles.toggleActive]}
          onPress={() => {
            setMode("month");
            setOffset(0);
          }}
        >
          <Text
            style={[
              styles.toggleText,
              { color: theme.textMuted },
              mode === "month" && styles.toggleTextActive,
            ]}
          >
            Monthly
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.navRow}>
        <TouchableOpacity
          style={styles.navBtn}
          onPress={() => setOffset((o) => o - 1)}
        >
          <Text style={styles.navText}>‹ Prev</Text>
        </TouchableOpacity>
        <Text style={[styles.rangeLabel, { color: theme.text }]}>
          {getRangeLabel()}
        </Text>
        <TouchableOpacity
          style={styles.navBtn}
          onPress={() => setOffset((o) => o + 1)}
          disabled={offset >= 0}
        >
          <Text style={[styles.navText, offset >= 0 && { opacity: 0.3 }]}>
            Next ›
          </Text>
        </TouchableOpacity>
      </View>

      <View style={[styles.card, { backgroundColor: theme.card }]}>
        <Text style={[styles.cardTitle, { color: theme.textSecondary }]}>
          Overview
        </Text>
        <StatRow
          label="Total Spent (Purchases)"
          value={totalSpent}
          color="#ff6b6b"
          theme={theme}
        />
        <StatRow
          label="Units Purchased"
          value={totalPurchasedUnits}
          color="#74c0fc"
          theme={theme}
        />
        <StatRow
          label="Units Consumed"
          value={totalConsumedUnits}
          color="#ffa94d"
          theme={theme}
        />
        <StatRow
          label="Purchases Logged"
          value={totalRestockLogs}
          color="#69db7c"
          theme={theme}
        />
        <StatRow
          label="Consumption Logged"
          value={totalConsumeLogs}
          color="#6c63ff"
          theme={theme}
        />
        <View style={styles.divider} />
        <StatRow
          label="Avg Cost / Purchase"
          value={
            totalRestockLogs > 0 ? Math.round(totalSpent / totalRestockLogs) : 0
          }
          color="#69db7c"
          theme={theme}
        />
      </View>

      <CategoryBreakdown logs={logs} theme={theme} />
      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  toggleRow: {
    flexDirection: "row",
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
  },
  toggleBtn: { flex: 1, padding: 10, borderRadius: 10, alignItems: "center" },
  toggleActive: { backgroundColor: "#6c63ff" },
  toggleText: { fontWeight: "600" },
  toggleTextActive: { color: "#fff" },
  navRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  navBtn: { padding: 8 },
  navText: { color: "#6c63ff", fontSize: 16, fontWeight: "600" },
  rangeLabel: { fontSize: 14, fontWeight: "600" },
  card: { borderRadius: 16, padding: 16, marginBottom: 16 },
  cardTitle: {
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 12,
  },
  statRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  statLabel: { fontSize: 14 },
  statValue: { fontSize: 14, fontWeight: "600" },
  divider: { height: 1, backgroundColor: "#6c63ff33", marginVertical: 8 },
  empty: { textAlign: "center", padding: 20 },
});

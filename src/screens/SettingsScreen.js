import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Switch,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import * as DocumentPicker from "expo-document-picker";
import { getAllData, restoreData, clearAllData } from "../db/database";
import { useTheme } from "../context/ThemeContext";

function SettingRow({ icon, label, desc, color, onPress, loading, theme }) {
  return (
    <TouchableOpacity
      style={[styles.row, { borderBottomColor: theme.border }]}
      onPress={onPress}
      disabled={loading}
    >
      <View style={[styles.rowIcon, { backgroundColor: color + "22" }]}>
        {loading ? (
          <ActivityIndicator size="small" color={color} />
        ) : (
          <Ionicons name={icon} size={20} color={color} />
        )}
      </View>
      <View style={styles.rowInfo}>
        <Text style={[styles.rowLabel, { color: theme.text }]}>{label}</Text>
        <Text style={[styles.rowDesc, { color: theme.textMuted }]}>{desc}</Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={theme.textMuted} />
    </TouchableOpacity>
  );
}

export default function SettingsScreen({ navigation }) {
  const { theme, isDark, toggleTheme } = useTheme();
  const [backupLoading, setBackupLoading] = useState(false);
  const [restoreLoading, setRestoreLoading] = useState(false);

  const handleBackup = async () => {
    setBackupLoading(true);
    try {
      const data = await getAllData();
      const json = JSON.stringify(data, null, 2);
      const date = new Date().toISOString().split("T")[0];
      const path = FileSystem.cacheDirectory + `snacks_backup_${date}.json`;
      await FileSystem.writeAsStringAsync(path, json, {
        encoding: FileSystem.EncodingType.UTF8,
      });
      const canShare = await Sharing.isAvailableAsync();
      if (!canShare) throw new Error("Sharing is not available on this device");
      await Sharing.shareAsync(path, {
        mimeType: "application/json",
        dialogTitle: "Save Backup",
        UTI: "public.json",
      });
    } catch (e) {
      Alert.alert("Backup Failed", e.message);
    }
    setBackupLoading(false);
  };

  const handleRestore = async () => {
    Alert.alert(
      "Restore Backup",
      "This will replace ALL current data. Are you sure?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Restore",
          style: "destructive",
          onPress: async () => {
            setRestoreLoading(true);
            try {
              const result = await DocumentPicker.getDocumentAsync({
                type: "application/json",
              });
              if (result.canceled) {
                setRestoreLoading(false);
                return;
              }
              const content = await FileSystem.readAsStringAsync(
                result.assets[0].uri,
              );
              const data = JSON.parse(content);
              if (!data.snacks || !data.logs)
                throw new Error("Invalid backup file");
              await restoreData(data);
              Alert.alert("Success", "Data restored successfully");
            } catch (e) {
              Alert.alert("Restore Failed", e.message);
            }
            setRestoreLoading(false);
          },
        },
      ],
    );
  };

  const handleResetAll = async () => {
    Alert.alert(
      "Reset All Data",
      "This will clear all snacks and logs. Are you sure?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reset",
          style: "destructive",
          onPress: async () => {
            try {
              await clearAllData();
              navigation.reset({ index: 0, routes: [{ name: "Main" }] });
            } catch (e) {
              Alert.alert("Reset Failed", e.message);
            }
          },
        },
      ],
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <View style={[styles.card, { backgroundColor: theme.card }]}>
        <Text style={[styles.cardTitle, { color: theme.textSecondary }]}>
          Appearance
        </Text>
        <View style={[styles.row, { borderBottomColor: theme.border }]}>
          <View style={[styles.rowIcon, { backgroundColor: "#6c63ff22" }]}>
            <Ionicons
              name={isDark ? "moon-outline" : "sunny-outline"}
              size={20}
              color="#6c63ff"
            />
          </View>
          <View style={styles.rowInfo}>
            <Text style={[styles.rowLabel, { color: theme.text }]}>
              {isDark ? "Dark Mode" : "Light Mode"}
            </Text>
            <Text style={[styles.rowDesc, { color: theme.textMuted }]}>
              Switch app theme
            </Text>
          </View>
          <Switch
            value={isDark}
            onValueChange={toggleTheme}
            trackColor={{ false: "#ccc", true: "#6c63ff" }}
            thumbColor="#fff"
          />
        </View>
      </View>

      <View style={[styles.card, { backgroundColor: theme.card }]}>
        <SettingRow
          icon="download-outline"
          label="Export Backup"
          desc="Save all data as a JSON file"
          color="#69db7c"
          onPress={handleBackup}
          loading={backupLoading}
          theme={theme}
        />
        <SettingRow
          icon="cloud-upload-outline"
          label="Restore Backup"
          desc="Load data from a JSON backup file"
          color="#ffa94d"
          onPress={handleRestore}
          loading={restoreLoading}
          theme={theme}
        />
        <SettingRow
          icon="trash-outline"
          label="Reset All"
          desc="Clear all snacks and logs"
          color="#ff6b6b"
          onPress={handleResetAll}
          loading={false}
          theme={theme}
        />
      </View>

      <View style={[styles.card, { backgroundColor: theme.card }]}>
        <Text style={[styles.cardTitle, { color: theme.textSecondary }]}>
          About
        </Text>
        <View style={[styles.aboutRow, { borderBottomColor: theme.border }]}>
          <Text style={[styles.aboutLabel, { color: theme.textSecondary }]}>
            Snacky - Snack Manager
          </Text>
          <Text style={[styles.aboutValue, { color: theme.textMuted }]}>
            v1.0.0
          </Text>
        </View>
        <View style={[styles.aboutRow, { borderBottomColor: theme.border }]}>
          <Text style={[styles.aboutLabel, { color: theme.textSecondary }]}>
            Storage
          </Text>
          <Text style={[styles.aboutValue, { color: theme.textMuted }]}>
            Local SQLite
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  card: { borderRadius: 16, padding: 16, marginBottom: 16 },
  cardTitle: {
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 12,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  rowIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  rowInfo: { flex: 1 },
  rowLabel: { fontSize: 14, fontWeight: "600" },
  rowDesc: { fontSize: 12, marginTop: 2 },
  aboutRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  aboutLabel: { fontSize: 14 },
  aboutValue: { fontSize: 14 },
});

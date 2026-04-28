import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  SafeAreaView,
  StyleSheet,
  StatusBar,
} from "react-native";
import { useTheme } from "../../context/ThemeContext";

export default function SettingsScreen() {
  const { theme, mode, setMode } = useTheme();

  const modes = [
    { label: "🌞  Light", value: "light" },
    { label: "🌙  Dark", value: "dark" },
    { label: "⚙️  Default (System)", value: "default" },
  ] as const;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <StatusBar barStyle={mode === "dark" ? "light-content" : "dark-content"} />

      {/* HEADER */}
      <Text style={[styles.header, { color: theme.text }]}>Settings</Text>

      {/* THEME SECTION */}
      <View style={[styles.section, { backgroundColor: theme.card }]}>
        <Text style={[styles.sectionTitle, { color: theme.subtext }]}>APPEARANCE</Text>

        {modes.map((item) => (
          <TouchableOpacity
            key={item.value}
            style={[
              styles.row,
              { borderBottomColor: theme.background },
            ]}
            onPress={() => setMode(item.value)}
          >
            <Text style={[styles.rowLabel, { color: theme.text }]}>{item.label}</Text>

            {/* Checkmark if selected */}
            {mode === item.value && (
              <Text style={[styles.check, { color: theme.tint }]}>✓</Text>
            )}
          </TouchableOpacity>
        ))}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    fontSize: 32,
    fontWeight: "800",
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 24,
    letterSpacing: -0.5,
  },
  section: {
    marginHorizontal: 16,
    borderRadius: 12,
    overflow: "hidden",
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1.2,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  rowLabel: { fontSize: 16 },
  check: { fontSize: 18, fontWeight: "700" },
});
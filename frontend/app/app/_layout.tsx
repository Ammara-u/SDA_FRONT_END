import { ThemeProvider as NavigationThemeProvider } from "@react-navigation/native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import "react-native-reanimated";

import { ThemeProviderCustom, useTheme } from "../context/ThemeContext";
import { useMemo } from "react";

function LayoutContent() {
  const { navigationTheme, mode } = useTheme();

  // ensure stable reference + proper re-rendering
  const navTheme = useMemo(() => navigationTheme, [navigationTheme]);

  return (
    <NavigationThemeProvider value={navTheme}>
      <Stack
        screenOptions={{
          contentStyle: {
            backgroundColor: navTheme.colors.background,
          },
        }}
      >
        <Stack.Screen
          name="(tabs)"
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="modal"
          options={{
            presentation: "modal",
            title: "Modal",
          }}
        />
      </Stack>

      <StatusBar
        style={navTheme.dark ? "light" : "dark"}
      />
    </NavigationThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <ThemeProviderCustom>
      <LayoutContent />
    </ThemeProviderCustom>
  );
}
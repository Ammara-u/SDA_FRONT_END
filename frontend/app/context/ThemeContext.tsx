import { createContext, useContext, useState, useEffect } from "react";
import { useColorScheme } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Colors } from "../constants/theme";
import { DarkTheme, DefaultTheme } from "@react-navigation/native";

const ThemeContext = createContext<any>(null);

export const ThemeProviderCustom = ({ children }: any) => {
  const systemScheme = useColorScheme();
  const [mode, setMode] = useState<"light" | "dark" | "default">("default");
  const [loaded, setLoaded] = useState(false);

  // Load saved mode on app start
  useEffect(() => {
    AsyncStorage.getItem("theme_mode").then((saved) => {
      if (saved === "light" || saved === "dark" || saved === "default") {
        setMode(saved);
      }
      setLoaded(true);
    });
  }, []);

  // Save mode whenever it changes
  const handleSetMode = (newMode: "light" | "dark" | "default") => {
    setMode(newMode);
    AsyncStorage.setItem("theme_mode", newMode);
  };

  const themeColors =
    mode === "dark"
      ? Colors.dark
      : mode === "light"
      ? Colors.light
      : systemScheme === "dark"
      ? Colors.dark
      : Colors.light;

  const navigationTheme = themeColors === Colors.dark ? DarkTheme : DefaultTheme;

  if (!loaded) return null;

  return (
    <ThemeContext.Provider value={{ mode, setMode: handleSetMode, theme: themeColors, navigationTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
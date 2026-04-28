import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  ScrollView,
  Image,
  ActivityIndicator,
  Alert,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { decode as atob } from "base-64";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { useTheme } from "../../../context/ThemeContext";

const API_URL = "http://127.0.0.1:8000";

function decodeToken(token: string) {
  try {
    return JSON.parse(atob(token.split(".")[1]));
  } catch {
    return null;
  }
}

function FieldRow({
  label,
  value,
  onChangeText,
  placeholder,
  multiline = false,
  editable = true,
  theme,
}: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  multiline?: boolean;
  editable?: boolean;
  theme: any;
}) {
  return (
    <View style={styles.fieldRow}>
      <Text style={[styles.fieldLabel, { color: theme.text }]}>{label}</Text>
      <TextInput
        style={[
          styles.fieldInput,
          { color: theme.text },
          multiline && styles.fieldInputMulti,
          !editable && { color: theme.subtext },
        ]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder ?? ""}
        placeholderTextColor={theme.subtext}
        multiline={multiline}
        editable={editable}
        autoCapitalize="none"
      />
      <View style={[styles.fieldDivider, { backgroundColor: theme.card }]} />
    </View>
  );
}

export default function EditProfileScreen() {
  const router = useRouter();
  const { theme, mode } = useTheme();

  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [department, setDepartment] = useState("");
  const [profilePic, setProfilePic] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const token = await AsyncStorage.getItem("access_token");
        if (!token) {
          router.replace("/");
          return;
        }

        const payload = decodeToken(token);
        const uid = payload?.sub;
        if (!uid) throw new Error("Invalid token");
        setUserId(uid);

        const res = await fetch(`${API_URL}/users/id/${uid}`, {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        });

        const data = await res.json();
        setFullName(data.full_name ?? "");
        setUsername(data.username ?? "");
        setBio(data.bio ?? "");
        setDepartment(data.department ?? "");
        setProfilePic(data.profile_pic ? `${API_URL}${data.profile_pic}` : null);
      } catch (err) {
        console.log("❌ Load error:", err);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const handleChangePhoto = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permission needed", "Please allow photo library access.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets.length > 0) {
      setProfilePic(result.assets[0].uri);
    }
  };

  const handleSave = async () => {
    setSaving(true);

    try {
      const token = await AsyncStorage.getItem("access_token");

      const updateRes = await fetch(`${API_URL}/users/${userId}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          full_name: fullName,
          username,
          bio,
          department,
        }),
      });

      if (!updateRes.ok) {
        const err = await updateRes.json();
        Alert.alert("Error", err.detail ?? "Could not save changes.");
        return;
      }

      if (profilePic && !profilePic.startsWith("http")) {
        const form = new FormData();
        const filename = profilePic.split("/").pop() || "profile.jpg";
        const response = await fetch(profilePic);
        const blob = await response.blob();
        form.append("file", blob, filename);

        const uploadRes = await fetch(
          `${API_URL}/users/${userId}/upload-profile-pic`,
          {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
            body: form,
          }
        );

        const uploadData = await uploadRes.json();

        if (!uploadRes.ok) {
          Alert.alert("Upload failed");
          return;
        }

        setProfilePic(`${API_URL}${uploadData.profile_pic}`);
      }

      router.replace("/(tabs)/profile");
    } catch (err) {
      console.log("❌ Save error:", err);
      Alert.alert("Error", "Something went wrong.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.center, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.text} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: theme.background }]}>
      <StatusBar barStyle={mode === "dark" ? "light-content" : "dark-content"} />

      {/* TOP BAR */}
      <View style={[styles.topBar, { borderBottomColor: theme.card }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.topBtn}>
          <Text style={[styles.topBtnText, { color: theme.text }]}>Cancel</Text>
        </TouchableOpacity>

        <Text style={[styles.topTitle, { color: theme.text }]}>Edit Profile</Text>

        <TouchableOpacity onPress={handleSave} style={styles.topBtn} disabled={saving}>
          {saving ? (
            <ActivityIndicator size="small" color="#3897f0" />
          ) : (
            <Text style={[styles.topBtnText, styles.topBtnDone]}>Done</Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* AVATAR */}
        <View style={styles.avatarSection}>
          {profilePic ? (
            <Image source={{ uri: profilePic }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder, { backgroundColor: theme.card }]}>
              <Ionicons name="person" size={44} color={theme.subtext} />
            </View>
          )}
          <TouchableOpacity onPress={handleChangePhoto}>
            <Text style={styles.changePhotoText}>Change Profile Photo</Text>
          </TouchableOpacity>
        </View>

        {/* FIELDS */}
        <FieldRow label="Name" value={fullName} onChangeText={setFullName} placeholder="Full name" theme={theme} />
        <FieldRow label="Username" value={username} onChangeText={setUsername} placeholder="username" theme={theme} />
        <FieldRow label="Bio" value={bio} onChangeText={setBio} placeholder="Bio" multiline theme={theme} />
        <FieldRow label="Department" value={department} onChangeText={setDepartment} placeholder="e.g. Computer Science" theme={theme} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
  },
  topBtn: { minWidth: 60 },
  topBtnText: { fontSize: 15 },
  topBtnDone: { color: "#3897f0", fontWeight: "600", textAlign: "right" },
  topTitle: { fontSize: 16, fontWeight: "700" },
  scroll: { paddingBottom: 40 },
  avatarSection: { alignItems: "center", paddingVertical: 24 },
  avatar: { width: 96, height: 96, borderRadius: 48, marginBottom: 10 },
  avatarPlaceholder: { justifyContent: "center", alignItems: "center" },
  changePhotoText: { fontSize: 14, color: "#3897f0", fontWeight: "500" },
  fieldRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 0,
  },
  fieldLabel: { width: 90, fontSize: 14, paddingTop: 2 },
  fieldInput: { flex: 1, fontSize: 14, paddingBottom: 10, paddingTop: 0 },
  fieldInputMulti: { minHeight: 56, textAlignVertical: "top" },
  fieldDivider: { position: "absolute", bottom: 0, left: 16, right: 16, height: 0.5 },
});
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

const API_URL = "https://sda-app-backend.onrender.com";

// ─── TOKEN DECODER ──────────────────────────────────────
function decodeToken(token: string) {
  try {
    return JSON.parse(atob(token.split(".")[1]));
  } catch {
    return null;
  }
}

// ─── ROW INPUT ──────────────────────────────────────────
// Renders a label + underlined text input in one row, like Instagram
function FieldRow({
  label,
  value,
  onChangeText,
  placeholder,
  multiline = false,
  editable = true,
}: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  multiline?: boolean;
  editable?: boolean;
}) {
  return (
    <View style={styles.fieldRow}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={[
          styles.fieldInput,
          multiline && styles.fieldInputMulti,
          !editable && styles.fieldInputDisabled,
        ]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder ?? ""}
        placeholderTextColor="#bbb"
        multiline={multiline}
        editable={editable}
        autoCapitalize="none"
      />
      <View style={styles.fieldDivider} />
    </View>
  );
}

// ─── SECTION HEADER ─────────────────────────────────────
function SectionHeader({ title }: { title: string }) {
  return <Text style={styles.sectionHeader}>{title}</Text>;
}

// ─── MAIN SCREEN ────────────────────────────────────────
export default function EditProfileScreen() {
  const router = useRouter();

  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Editable fields
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [department, setDepartment] = useState("");
  const [profilePic, setProfilePic] = useState<string | null>(null);

  // ── Load existing user data ──
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
setProfilePic(
  data.profile_pic ? `${API_URL}${data.profile_pic}` : null
);      } catch (err) {
        console.log("❌ Load error:", err);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  
  // ── Pick profile photo ──
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

  // ── Save changes ──
const handleSave = async () => {
  setSaving(true);

  try {
    const token = await AsyncStorage.getItem("access_token");

    // ── 1. UPDATE TEXT DATA ──
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

    // ── 2. UPLOAD IMAGE (if changed) ──
if (profilePic && !profilePic.startsWith("http")) {
  const form = new FormData();

  const filename = profilePic.split("/").pop() || "profile.jpg";

  // 🔥 convert to blob (REQUIRED for web)
  const response = await fetch(profilePic);
  const blob = await response.blob();

  form.append("file", blob, filename);

  const uploadRes = await fetch(
    `${API_URL}/users/${userId}/upload-profile-pic`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: form,
    }
  );

  const uploadData = await uploadRes.json();

  if (!uploadRes.ok) {
    console.log("UPLOAD ERROR:", uploadData);
    Alert.alert("Upload failed");
    return;
  }

  console.log("UPLOAD SUCCESS:", uploadData);

  setProfilePic(`${API_URL}${uploadData.profile_pic}`);
}

    console.log("✅ Profile saved");

    // ── 3. NAVIGATE BACK ──
    router.replace("/(tabs)/profile");

  } catch (err) {
    console.log("❌ Save error:", err);
    Alert.alert("Error", "Something went wrong.");
  } finally {
    setSaving(false);
  }
};

  // ── Loading state ──
  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" color="#000" />
      </SafeAreaView>
    );
  }

  // ── RENDER ──
  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      {/* ── Top bar ── */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.topBtn}>
          <Text style={styles.topBtnText}>Cancel</Text>
        </TouchableOpacity>

        <Text style={styles.topTitle}>Edit Profile</Text>

        <TouchableOpacity
          onPress={handleSave}
          style={styles.topBtn}
          disabled={saving}
        >
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
        {/* ── Avatar ── */}
        <View style={styles.avatarSection}>
          {profilePic ? (
            <Image source={{ uri: profilePic }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder]}>
              <Ionicons name="person" size={44} color="#bbb" />
            </View>
          )}
          <TouchableOpacity onPress={handleChangePhoto}>
            <Text style={styles.changePhotoText}>Change Profile Photo</Text>
          </TouchableOpacity>
        </View>

        {/* ── Public fields ── */}
        <FieldRow
          label="Name"
          value={fullName}
          onChangeText={setFullName}
          placeholder="Full name"
        />
        <FieldRow
          label="Username"
          value={username}
          onChangeText={setUsername}
          placeholder="username"
        />
        <FieldRow
          label="Bio"
          value={bio}
          onChangeText={setBio}
          placeholder="Bio"
          multiline
        />
        <FieldRow
          label="Department"
          value={department}
          onChangeText={setDepartment}
          placeholder="e.g. Computer Science"
        />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── STYLES ─────────────────────────────────────────────
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#fff" },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
  },

  // Top bar
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: "#dbdbdb",
  },
  topBtn: {
    minWidth: 60,
  },
  topBtnText: {
    fontSize: 15,
    color: "#000",
  },
  topBtnDone: {
    color: "#3897f0",   // Instagram blue
    fontWeight: "600",
    textAlign: "right",
  },
  topTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#000",
  },

  // Scroll content
  scroll: {
    paddingBottom: 40,
  },

  // Avatar section
  avatarSection: {
    alignItems: "center",
    paddingVertical: 24,
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    marginBottom: 10,
  },
  avatarPlaceholder: {
    backgroundColor: "#f0f0f0",
    justifyContent: "center",
    alignItems: "center",
  },
  changePhotoText: {
    fontSize: 14,
    color: "#3897f0",
    fontWeight: "500",
  },

  // Field rows
  fieldRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 0,
  },
  fieldLabel: {
    width: 90,
    fontSize: 14,
    color: "#000",
    paddingTop: 2,
  },
  fieldInput: {
    flex: 1,
    fontSize: 14,
    color: "#000",
    paddingBottom: 10,
    paddingTop: 0,
  },
  fieldInputMulti: {
    minHeight: 56,
    textAlignVertical: "top",
  },
  fieldInputDisabled: {
    color: "#aaa",
  },
  fieldDivider: {
    position: "absolute",
    bottom: 0,
    left: 16,
    right: 16,
    height: 0.5,
    backgroundColor: "#dbdbdb",
  },

  // Professional account link
  professionalBtn: {
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 8,
  },
  professionalText: {
    fontSize: 14,
    color: "#3897f0",
    fontWeight: "500",
  },

  // Section header (Private Information)
  sectionHeader: {
    fontSize: 13,
    fontWeight: "700",
    color: "#000",
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 4,
  },
});
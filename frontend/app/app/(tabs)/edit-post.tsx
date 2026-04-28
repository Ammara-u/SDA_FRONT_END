import React, { useState, useEffect } from "react";
import {
  View,
  TextInput,
  Image,
  Alert,
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  SafeAreaView,
  StatusBar,
  Platform,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../context/ThemeContext";

const API_URL = "http://127.0.0.1:8000";

export default function EditPostScreen() {
  const router = useRouter();
  const { theme, mode } = useTheme();
  const { postId, currentContent, currentImage } = useLocalSearchParams<{
    postId: string;
    currentContent: string;
    currentImage: string;
  }>();

  const [content, setContent] = useState("");
  const [existingImage, setExistingImage] = useState<string | null>(null);
  const [newImage, setNewImage] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [removeImage, setRemoveImage] = useState(false);
const [saving, setSaving] = useState(false);
const [deleting, setDeleting] = useState(false);

useEffect(() => {
  setContent(currentContent ?? "");
  setExistingImage(currentImage ?? null);
  setNewImage(null);
  setRemoveImage(false);
}, [postId]);
  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission needed", "Please allow access to your photo library.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setNewImage(result.assets[0]);
      setExistingImage(null);
      setRemoveImage(false);
    }
  };

  const handleRemoveImage = () => {
    setNewImage(null);
    setExistingImage(null);
    setRemoveImage(true);
  };

  const handleSave = async () => {
    if (!content.trim() && !existingImage && !newImage) {
      Alert.alert("Empty post", "Write something or add an image.");
      return;
    }

    const token = await AsyncStorage.getItem("access_token");
    if (!token) {
      Alert.alert("Not logged in");
      return;
    }

    setSaving(true);

    try {
      const formData = new FormData();
      formData.append("content", content.trim() || " ");
      formData.append("remove_image", String(removeImage));

      if (newImage) {
        if (Platform.OS === "web") {
          const response = await fetch(newImage.uri);
          const blob = await response.blob();
          const mimeType = blob.type || "image/jpeg";
          const ext = mimeType.split("/")[1]?.replace("jpeg", "jpg") ?? "jpg";
          formData.append("file", blob, `post_image.${ext}`);
        } else {
          const ext = newImage.uri.split(".").pop() ?? "jpg";
          formData.append("file", {
            uri: newImage.uri,
            name: `post_image.${ext}`,
            type: `image/${ext === "jpg" ? "jpeg" : ext}`,
          } as any);
        }
      }

      const res = await fetch(`${API_URL}/posts/${postId}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      if (!res.ok) {
        const body = await res.text();
        Alert.alert("Error", body ?? "Could not update post.");
        return;
      }

      // ✅ go directly to profile instead of back()
      router.replace("/(tabs)/profile");
    } catch (e) {
      console.error("❌ Edit error:", e);
      Alert.alert("Error", "Could not connect to server.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
  const token = await AsyncStorage.getItem("access_token");
  if (!token) return;

  const doDelete = async () => {
    setDeleting(true);
    try {
      const res = await fetch(`${API_URL}/posts/${postId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      const body = await res.text();

      if (!res.ok) {
        Platform.OS === "web"
          ? window.alert(body ?? "Could not delete post.")
          : Alert.alert("Error", body ?? "Could not delete post.");
        return;
      }

      router.replace("/(tabs)/profile");
    } catch (e) {
      console.error("❌ Delete error:", e);
      Platform.OS === "web"
        ? window.alert("Could not connect to server.")
        : Alert.alert("Error", "Could not connect to server.");
    } finally {
      setDeleting(false);
    }
  };

  if (Platform.OS === "web") {
    // ✅ window.confirm works on web
    const confirmed = window.confirm(
      "Are you sure you want to delete this post? This cannot be undone."
    );
    if (confirmed) doDelete();
  } else {
    // ✅ Alert.alert works on mobile
    Alert.alert(
      "Delete Post",
      "Are you sure you want to delete this post? This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: doDelete },
      ]
    );
  }
};

  const displayImage = newImage?.uri ?? (existingImage
    ? existingImage.startsWith("http")
      ? existingImage
      : `${API_URL}${existingImage}`
    : null);

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: theme.background }]}>
      <StatusBar barStyle={mode === "dark" ? "light-content" : "dark-content"} />

      {/* HEADER */}
      <View style={[styles.header, { borderBottomColor: theme.card }]}>
        <TouchableOpacity onPress={() => router.replace("/(tabs)/profile")} style={styles.cancelBtn}>
          <Text style={[styles.cancelText, { color: theme.subtext }]}>Cancel</Text>
        </TouchableOpacity>

        <Text style={[styles.headerTitle, { color: theme.text }]}>Edit Post</Text>

        <TouchableOpacity
          style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
          onPress={handleSave}
          disabled={saving || deleting}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.saveBtnText}>Save</Text>
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.container}>
        {/* TEXT INPUT */}
        <TextInput
          placeholder="What's on your mind?"
          placeholderTextColor={theme.subtext}
          value={content}
          onChangeText={setContent}
          style={[styles.input, { color: theme.text }]}
          multiline
          maxLength={500}
        />

        <Text style={[styles.charCount, { color: theme.subtext }]}>
          {content.length}/500
        </Text>

        {/* IMAGE PREVIEW */}
        {displayImage && (
          <View style={styles.imageWrapper}>
            <Image source={{ uri: displayImage }} style={styles.imagePreview} />
            <TouchableOpacity
              style={styles.removeImageBtn}
              onPress={handleRemoveImage}
            >
              <Ionicons name="close-circle" size={26} color="#fff" />
            </TouchableOpacity>
          </View>
        )}

        {/* TOOLBAR */}
        <View style={[styles.toolbar, { borderTopColor: theme.card }]}>
          <TouchableOpacity style={styles.toolbarBtn} onPress={pickImage}>
            <Ionicons name="image-outline" size={24} color="#6c63ff" />
            <Text style={styles.toolbarBtnText}>
              {displayImage ? "Change Image" : "Add Image"}
            </Text>
          </TouchableOpacity>
        </View>

        {/* DELETE BUTTON */}
        <TouchableOpacity
          style={[styles.deleteBtn, { borderColor: "#e0245e" }]}
          onPress={handleDelete}
          disabled={deleting || saving}
        >
          {deleting ? (
            <ActivityIndicator size="small" color="#e0245e" />
          ) : (
            <>
              <Ionicons name="trash-outline" size={18} color="#e0245e" />
              <Text style={styles.deleteBtnText}>Delete Post</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
  },
  cancelBtn: { padding: 4 },
  cancelText: { fontSize: 15 },
  headerTitle: { fontSize: 16, fontWeight: "700" },
  saveBtn: {
    backgroundColor: "#6c63ff",
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 20,
    minWidth: 60,
    alignItems: "center",
  },
  saveBtnDisabled: { backgroundColor: "#c5c2f5" },
  saveBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  container: { flex: 1, padding: 16 },
  input: {
    fontSize: 16,
    lineHeight: 24,
    minHeight: 120,
    textAlignVertical: "top",
  },
  charCount: { alignSelf: "flex-end", fontSize: 12, marginBottom: 12 },
  imageWrapper: {
    position: "relative",
    marginBottom: 12,
    borderRadius: 12,
    overflow: "hidden",
  },
  imagePreview: { width: "100%", height: 220, borderRadius: 12 },
  removeImageBtn: {
    position: "absolute",
    top: 8,
    right: 8,
    backgroundColor: "rgba(0,0,0,0.5)",
    borderRadius: 13,
  },
  toolbar: {
    flexDirection: "row",
    borderTopWidth: 0.5,
    paddingTop: 12,
    marginTop: "auto",
  },
  toolbarBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    padding: 4,
  },
  toolbarBtnText: { fontSize: 14, color: "#6c63ff", fontWeight: "600" },
  deleteBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 16,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 12,
  },
  deleteBtnText: { color: "#e0245e", fontWeight: "700", fontSize: 15 },
});
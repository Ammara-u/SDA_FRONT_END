import React, { useState } from "react";
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
import { decode as atob } from "base-64";
import * as ImagePicker from "expo-image-picker";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

// const API_URL = "https://sda-app-backend.onrender.com";
const API_URL = "http://127.0.0.1:8000"

export default function PostScreen() {
  const router = useRouter();
  const [content, setContent] = useState("");
  const [image, setImage] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [uploading, setUploading] = useState(false);

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission needed", "Please allow access to your photo library.");
      return;
    }

   const result = await ImagePicker.launchImageLibraryAsync({
  mediaTypes: ["images"], // ✅ replaces deprecated MediaTypeOptions.Images
  quality: 0.8,
});

    if (!result.canceled && result.assets[0]) {
      setImage(result.assets[0]);
    }
  };

  const removeImage = () => setImage(null);

  const createPost = async () => {
    if (!content.trim() && !image) {
      Alert.alert("Empty post", "Write something or pick an image first.");
      return;
    }

    // ✅ Read the real token from AsyncStorage
    const token = await AsyncStorage.getItem("access_token");
    if (!token) {
      Alert.alert("Not logged in", "Please log in first.");
      return;
    }

    setUploading(true);

    try {
      const formData = new FormData();
      formData.append("content", content.trim() || " "); // backend requires non-empty

      // ✅ Only append file if user actually picked one
      // Replace the image append block in createPost:

if (image) {
  if (Platform.OS === "web") {
    const response = await fetch(image.uri);
    const blob = await response.blob();
    // ✅ Get ext from MIME type, not the blob URI
    const mimeType = blob.type || "image/jpeg";
    const ext = mimeType.split("/")[1]?.replace("jpeg", "jpg") ?? "jpg";
    formData.append("file", blob, `post_image.${ext}`);
  } else {
    const ext = image.uri.split(".").pop() ?? "jpg";
    formData.append("file", {
      uri: image.uri,
      name: `post_image.${ext}`,
      type: `image/${ext === "jpg" ? "jpeg" : ext}`,
    } as any);
  }
}
const payload = JSON.parse(atob(token.split(".")[1]));
const userId = payload?.sub;
if (!userId) {
  Alert.alert("Error", "User ID missing from token");
  return;
}

// formData.append("author_id", String(userId));
      // ✅ Use /post-with-image — works with or without an image
      const res = await fetch(`${API_URL}/post-with-image`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          // Do NOT set Content-Type manually — fetch sets it with the boundary for FormData
        },
        body: formData,
      });
if (!res.ok) {
  const data = await res.json();
  console.error("Post failed:", JSON.stringify(data, null, 2)); // ← see full detail array
  Alert.alert("Failed", JSON.stringify(data.detail) ?? "Something went wrong.");
  return;
}

      console.log("TOKEN:", token);
console.log("USERID:", userId);

      const data = await res.json();

      if (!res.ok) {
        console.error("Post failed:", data);
        Alert.alert("Failed", data.detail ?? "Something went wrong.");
        return;
      }

      console.log("✅ Post created:", data);
      Alert.alert("Posted! 🎉", "Your post is now live.", [
        { text: "OK", onPress: () => router.back() },
      ]);

      setContent("");
      setImage(null);
    } catch (err) {
      console.error("Network error:", err);
      Alert.alert("Error", "Could not connect to server.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.cancelBtn}>
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>New Post</Text>
        <TouchableOpacity
          style={[styles.postBtn, (!content.trim() && !image) && styles.postBtnDisabled]}
          onPress={createPost}
          disabled={uploading || (!content.trim() && !image)}
        >
          {uploading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.postBtnText}>Share</Text>
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.container}>
        {/* Text input */}
        <TextInput
          placeholder="What's on your mind?"
          placeholderTextColor="#aaa"
          value={content}
          onChangeText={setContent}
          style={styles.input}
          multiline
          maxLength={500}
        />

        <Text style={styles.charCount}>{content.length}/500</Text>

        {/* Image preview */}
        {image && (
          <View style={styles.imageWrapper}>
            <Image source={{ uri: image.uri }} style={styles.imagePreview} />
            <TouchableOpacity style={styles.removeImageBtn} onPress={removeImage}>
              <Ionicons name="close-circle" size={26} color="#fff" />
            </TouchableOpacity>
          </View>
        )}

        {/* Bottom toolbar */}
        <View style={styles.toolbar}>
          <TouchableOpacity style={styles.toolbarBtn} onPress={pickImage}>
            <Ionicons name="image-outline" size={24} color="#6c63ff" />
            <Text style={styles.toolbarBtnText}>
              {image ? "Change Image" : "Add Image"}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#fff",
  },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: "#e0e0e0",
  },
  cancelBtn: { padding: 4 },
  cancelText: { fontSize: 15, color: "#555" },
  headerTitle: { fontSize: 16, fontWeight: "700", color: "#111" },
  postBtn: {
    backgroundColor: "#6c63ff",
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 20,
    minWidth: 60,
    alignItems: "center",
  },
  postBtnDisabled: { backgroundColor: "#c5c2f5" },
  postBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },

  // Body
  container: {
    flex: 1,
    padding: 16,
  },
  input: {
    fontSize: 16,
    color: "#111",
    lineHeight: 24,
    minHeight: 120,
    textAlignVertical: "top",
  },
  charCount: {
    alignSelf: "flex-end",
    fontSize: 12,
    color: "#bbb",
    marginBottom: 12,
  },

  // Image
  imageWrapper: {
    position: "relative",
    marginBottom: 12,
    borderRadius: 12,
    overflow: "hidden",
  },
  imagePreview: {
    width: "100%",
    height: 220,
    borderRadius: 12,
  },
  removeImageBtn: {
    position: "absolute",
    top: 8,
    right: 8,
    backgroundColor: "rgba(0,0,0,0.5)",
    borderRadius: 13,
  },

  // Toolbar
  toolbar: {
    flexDirection: "row",
    borderTopWidth: 0.5,
    borderTopColor: "#e0e0e0",
    paddingTop: 12,
    marginTop: "auto",
  },
  toolbarBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    padding: 4,
  },
  toolbarBtnText: {
    fontSize: 14,
    color: "#6c63ff",
    fontWeight: "600",
  },
});
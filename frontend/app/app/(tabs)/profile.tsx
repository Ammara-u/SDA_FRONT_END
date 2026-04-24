import React, { useEffect, useState, useCallback } from "react";
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl, Dimensions,
  StatusBar, SafeAreaView
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { decode as atob } from "base-64";

const API_URL = "http://192.168.100.22:8000";
const { width } = Dimensions.get("window");
const TILE_SIZE = (width - 3) / 3;

// ─── TYPES ─────────────────────────
type Post = { id: string; content?: string };

type User = {
  id: string;
  username: string;
  full_name?: string;
  bio?: string;
};

// ─── TOKEN DECODER ─────────────────
function decodeToken(token: string) {
  try {
    return JSON.parse(atob(token.split(".")[1]));
  } catch (e) {
    console.log("❌ Token decode failed:", e);
    return null;
  }
}

// ─── TILE ───────────────────────────
function PostTile({ post }: { post: Post }) {
  return (
    <TouchableOpacity style={styles.tile}>
      <Text numberOfLines={4} style={styles.tileText}>
        {post.content || ""}
      </Text>
    </TouchableOpacity>
  );
}

// ─── SCREEN ─────────────────────────
export default function ProfileScreen({ navigation }: any) {
  const [user, setUser] = useState<User | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [followers, setFollowers] = useState<any[]>([]);
  const [following, setFollowing] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    console.log("🚀 Loading profile...");

    try {
      const token = await AsyncStorage.getItem("access_token");
      console.log("🔑 Token:", token);

      if (!token) {
        navigation.replace("Login");
        return;
      }

      const payload = decodeToken(token);
      const userId = payload?.sub;
      
      console.log("👤 Username:", userId);

      if (!userId) throw new Error("Invalid token");

      const headers = {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      };

      // ── USER ──
      const userRes = await fetch(`${API_URL}/users/id/${userId}`, { headers });
      console.log("👤 User status:", userRes.status);

      const userData = await userRes.json();
      console.log("👤 User:", userData);

      setUser(userData);

      // ── POSTS ──
      const postsRes = await fetch(`${API_URL}/users/${userId}/posts`, { headers });

console.log("📦 Posts status:", postsRes.status);

if (!postsRes.ok) {
  console.log("❌ Posts API failed");
} else {
  const data = await postsRes.json();
  console.log("📦 Posts:", data);
  setPosts(Array.isArray(data) ? data : []);
}
      if (postsRes.ok) {
        const data = await postsRes.json();
        setPosts(Array.isArray(data) ? data : []);
      }

      // ── FOLLOWERS / FOLLOWING ──
      const [f1, f2] = await Promise.all([
        fetch(`${API_URL}/users/${userData.id}/followers`, { headers }),
        fetch(`${API_URL}/users/${userData.id}/following`, { headers }),
      ]);

      console.log("👥 Followers status:", f1.status);
      console.log("👥 Following status:", f2.status);

      if (f1.ok) {
        const data = await f1.json();
        console.log("followers raw:", data);
        setFollowers(Array.isArray(data) ? data : []);
      }

      if (f2.ok) {
        const data = await f2.json();
        console.log("following raw:", data);
        setFollowing(Array.isArray(data) ? data : []);
      }

    } catch (err) {
      console.log("❌ ERROR:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" />
        <Text>Loading...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar barStyle="dark-content" />

      <FlatList
        data={posts}
        keyExtractor={(item) => item.id}
        numColumns={3}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={fetchData} />
        }
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.username}>
              {user?.username ?? "No username"}
            </Text>

            <View style={styles.stats}>
              <Text>Posts: {posts.length}</Text>
              <Text>Followers: {followers.length}</Text>
              <Text>Following: {following.length}</Text>
            </View>

            <Text>{user?.full_name ?? ""}</Text>
            <Text>{user?.bio ?? ""}</Text>
          </View>
        }
        renderItem={({ item }) => <PostTile post={item} />}
      />
    </SafeAreaView>
  );
}

// ─── STYLES ─────────────────────────
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#fff" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },

  header: { padding: 16 },

  username: { fontSize: 20, fontWeight: "bold" },

  stats: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginVertical: 10,
  },

  tile: {
    width: TILE_SIZE,
    height: TILE_SIZE,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 0.5,
  },

  tileText: { fontSize: 12 },
});
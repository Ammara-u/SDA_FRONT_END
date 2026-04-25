import { useEffect, useState, useCallback } from "react";
import { useFocusEffect } from "expo-router";

import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
  StatusBar,
  SafeAreaView,
  Image,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { decode as atob } from "base-64";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

const API_URL = "https://sda-app-backend.onrender.com";
const { width } = Dimensions.get("window");
const TILE_SIZE = (width - 3) / 3;

// ─── TYPES — matched exactly to your models.py ──────────
type PostImage = {
  id: string;
  image_url: string;
};

type Post = {
  id: string;
  content?: string;
  created_at?: string;
  images?: PostImage[]; // your PostImage table rows, nested by API
};

type User = {
  id: string;
  username: string;
  full_name?: string;
  bio?: string;
  profile_pic?: string;   // ← your actual column name
  department?: string;    // ← your actual column
  university?: string;    // ← your actual column
};

// ─── TOKEN DECODER ──────────────────────────────────────
function decodeToken(token: string) {
  try {
    return JSON.parse(atob(token.split(".")[1]));
  } catch (e) {
    console.log("❌ Token decode failed:", e);
    return null;
  }
}

// ─── POST TILE ──────────────────────────────────────────
// A post can have multiple images — we show the first one.
// If no images, fall back to text content.
function PostTile({ post }: { post: Post }) {
  const firstImage = post.images?.[0]?.image_url;

  return (
    <TouchableOpacity style={styles.tile} activeOpacity={0.8}>
      {firstImage ? (
        <Image
         source={{ uri: `${API_URL}${firstImage}` }}
          style={styles.tileImage}
          resizeMode="cover"
        />
      ) : (
        <View style={styles.tileFallback}>
          <Text numberOfLines={4} style={styles.tileText}>
            {post.content || ""}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

// ─── STAT COLUMN ────────────────────────────────────────
function StatCol({ count, label }: { count: number; label: string }) {
  return (
    <View style={styles.statCol}>
      <Text style={styles.statNumber}>{count}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

// ─── MAIN SCREEN ────────────────────────────────────────
export default function ProfileScreen({ navigation }: any) {
  const router = useRouter();
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
      if (!token) {
        navigation.replace("Login");
        return;
      }

      const payload = decodeToken(token);
      const userId = payload?.sub;
      if (!userId) throw new Error("Invalid token");

      const headers = {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      };

      // ── USER ──
      const userRes = await fetch(`${API_URL}/users/id/${userId}`, { headers });
      const userData: User = await userRes.json();
      console.log("👤 User:", userData);
      setUser(userData);

      // ── POSTS ──
      // Your API should return posts with nested images array.
      // e.g. [{ id, content, images: [{ id, image_url }] }]
      const postsRes = await fetch(`${API_URL}/users/${userId}/posts`, { headers });
      if (postsRes.ok) {
        const data = await postsRes.json();
        console.log("📦 Posts:", data);
        setPosts(Array.isArray(data) ? data : []);
      } else {
        console.log("❌ Posts API failed:", postsRes.status);
      }

      // ── FOLLOWERS / FOLLOWING ──
      const [f1, f2] = await Promise.all([
        fetch(`${API_URL}/users/${userData.id}/followers`, { headers }),
        fetch(`${API_URL}/users/${userData.id}/following`, { headers }),
      ]);

      if (f1.ok) {
        const data = await f1.json();
        setFollowers(Array.isArray(data) ? data : []);
      }
      if (f2.ok) {
        const data = await f2.json();
        setFollowing(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.log("❌ ERROR:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
  useCallback(() => {
    fetchData();
  }, [])  // empty deps — re-runs every time screen is focused
);

  // ── LOADING STATE ──
  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" color="#000" />
        <Text style={{ marginTop: 10, color: "#888" }}>Loading...</Text>
      </SafeAreaView>
    );
  }

  // ── PROFILE HEADER ──────────────────────────────────────
  const ProfileHeader = () => (
    <View>
      {/* Top bar */}
      <View style={styles.topBar}>
        <View style={styles.topBarLeft}>
          <Ionicons name="lock-closed" size={13} color="#000" />
          <Text style={styles.topUsername}>{user?.username ?? ""}</Text>
          <Ionicons name="chevron-down" size={13} color="#000" />
        </View>
        <TouchableOpacity>
          <Ionicons name="menu" size={26} color="#000" />
        </TouchableOpacity>
      </View>

      {/* Avatar + Stats */}
      
      <View style={styles.avatarStatsRow}>
        <View style={styles.avatarWrapper}>
          {user?.profile_pic ? (
            <Image
              source={{ uri: `${API_URL}${user.profile_pic}` }}
              style={styles.avatar}
            />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder]}>
              <Ionicons name="person" size={36} color="#aaa" />
            </View>
          )}
        </View>

        <View style={styles.statsRow}>
          <StatCol count={posts.length} label="Posts" />
          <StatCol count={followers.length} label="Followers" />
          <StatCol count={following.length} label="Following" />
        </View>
      </View>

      {/* Name + department · university + bio */}
      <View style={styles.bioSection}>
        {user?.full_name ? (
          <Text style={styles.fullName}>{user.full_name}</Text>
        ) : null}

        {/* department and university shown as "CS · LUMS" style */}
        {(user?.department || user?.university) ? (
          <Text style={styles.subInfo}>
            {[user.department, user.university].filter(Boolean).join(" · ")}
          </Text>
        ) : null}

        {user?.bio ? (
          <Text style={styles.bio}>{user.bio}</Text>
        ) : null}
      </View>

      {/* Edit Profile */}
      <View style={styles.editBtnWrapper}>
        <TouchableOpacity style={styles.editBtn} onPress={() => router.push("/profile/edit")}>
          <Text style={styles.editBtnText}>Edit Profile</Text>
        </TouchableOpacity>
      </View>

      {/* Grid / Tagged tabs */}
      <View style={styles.tabsRow}>
        <TouchableOpacity style={[styles.tab, styles.tabActive]}>
          <Ionicons name="grid" size={22} color="#000" />
        </TouchableOpacity>
        {/* <TouchableOpacity style={styles.tab}>
          <Ionicons name="person-circle-outline" size={22} color="#aaa" />
        </TouchableOpacity> */}
      </View>
    </View>
  );

  // ── MAIN RENDER ──
  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      <FlatList
        data={posts}
        keyExtractor={(item) => item.id}
        numColumns={3}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              fetchData();
            }}
          />
        }
        ListHeaderComponent={<ProfileHeader />}
        renderItem={({ item }) => <PostTile post={item} />}
        columnWrapperStyle={styles.row}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="camera-outline" size={48} color="#ccc" />
            <Text style={styles.emptyText}>No posts yet</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

// ─── STYLES ─────────────────────────────────────────────
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#fff" },
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#fff" },

  // Top bar
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  topBarLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  topUsername: {
    fontSize: 17,
    fontWeight: "700",
    color: "#000",
    marginHorizontal: 4,
  },

  // Avatar + Stats
  avatarStatsRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    marginTop: 6,
  },
  avatarWrapper: { marginRight: 24 },
  avatar: {
    width: 86,
    height: 86,
    borderRadius: 43,
  },
  avatarPlaceholder: {
    backgroundColor: "#f0f0f0",
    justifyContent: "center",
    alignItems: "center",
  },
  statsRow: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "space-around",
  },
  statCol: { alignItems: "center" },
  statNumber: { fontSize: 17, fontWeight: "700", color: "#000" },
  statLabel: { fontSize: 13, color: "#000", marginTop: 2 },

  // Bio
  bioSection: {
    paddingHorizontal: 16,
    marginTop: 10,
  },
  fullName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#000",
    marginBottom: 2,
  },
  subInfo: {
    fontSize: 13,
    color: "#555",
    marginBottom: 3,
  },
  bio: {
    fontSize: 14,
    color: "#000",
    lineHeight: 19,
  },

  // Edit button
  editBtnWrapper: {
    paddingHorizontal: 16,
    marginTop: 12,
    marginBottom: 4,
  },
  editBtn: {
    borderWidth: 1,
    borderColor: "#dbdbdb",
    borderRadius: 8,
    paddingVertical: 7,
    alignItems: "center",
    backgroundColor: "#fff",
  },
  editBtnText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#000",
  },

  // Tabs
  tabsRow: {
    flexDirection: "row",
    borderTopWidth: 0.5,
    borderTopColor: "#dbdbdb",
    marginTop: 12,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 10,
  },
  tabActive: {
    borderBottomWidth: 1.5,
    borderBottomColor: "#000",
  },

  // Grid tiles
  row: { gap: 1.5 },
  tile: {
    width: TILE_SIZE,
    height: TILE_SIZE,
    backgroundColor: "#f0f0f0",
  },
  tileImage: { width: "100%", height: "100%" },
  tileFallback: {
    flex: 1,
    backgroundColor: "#e8e8e8",
    justifyContent: "center",
    alignItems: "center",
    padding: 6,
  },
  tileText: { fontSize: 11, color: "#555", textAlign: "center" },

  // Empty
  emptyState: { alignItems: "center", paddingTop: 60, gap: 12 },
  emptyText: { fontSize: 14, color: "#aaa" },
});
import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
  StatusBar,
  SafeAreaView,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

const API_URL = "http://192.168.100.22:8000";
const { width } = Dimensions.get("window");
const TILE_SIZE = (width - 3) / 3; // 3 columns with 1px gaps

// ─── Helper: decode JWT payload ──────────────────────────────────────────────
function decodeToken(token) {
  try {
    const base64Payload = token.split(".")[1];
    const decoded = atob(base64Payload);
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

// ─── Stat Column ─────────────────────────────────────────────────────────────
function StatColumn({ count, label }) {
  return (
    <View style={styles.statCol}>
      <Text style={styles.statNumber}>{count}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

// ─── Post Tile ────────────────────────────────────────────────────────────────
function PostTile({ post }) {
  // Use first media URL if available, else a grey placeholder
  const imageUri =
    post.media_urls && post.media_urls.length > 0
      ? post.media_urls[0]
      : null;

  return (
    <TouchableOpacity activeOpacity={0.85} style={styles.tile}>
      {imageUri ? (
        <Image
          source={{ uri: imageUri }}
          style={styles.tileImage}
          resizeMode="cover"
        />
      ) : (
        // Text-only post fallback
        <View style={styles.tileTextFallback}>
          <Text style={styles.tileText} numberOfLines={4}>
            {post.content || ""}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

// ─── Main Profile Screen ──────────────────────────────────────────────────────
export default function ProfileScreen({ navigation }) {
  const [user, setUser] = useState(null);
  const [posts, setPosts] = useState([]);
  const [followers, setFollowers] = useState(0);
  const [following, setFollowing] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  // ── Fetch everything ────────────────────────────────────────────────────────
  const fetchProfileData = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem("access_token");
      if (!token) {
        // No token → back to login
        navigation?.replace("Login");
        return;
      }

      const headers = {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      };

      // Decode username from JWT (sub claim)
      const payload = decodeToken(token);
      const username = payload?.sub;

      if (!username) throw new Error("Invalid token");

      // Parallel requests: profile + posts
      const [profileRes, postsRes] = await Promise.all([
        fetch(`${API_URL}/users/${username}`, { headers }),
        fetch(`${API_URL}/users/${username}/posts`, { headers }),
      ]);

      // Handle 401 → token expired
      if (profileRes.status === 401) {
        await AsyncStorage.multiRemove(["access_token", "refresh_token"]);
        navigation?.replace("Login");
        return;
      }

      if (!profileRes.ok) throw new Error("Failed to load profile");

      const profileData = await profileRes.json();
      setUser(profileData);

      // Posts endpoint might not exist yet — gracefully degrade
      if (postsRes.ok) {
        const postsData = await postsRes.json();
        setPosts(Array.isArray(postsData) ? postsData : postsData.posts ?? []);
      }

      // ── Optional: follower counts ─────────────────────────────────────────
      // Uncomment if you add these endpoints later:
      // const [fwrRes, fwgRes] = await Promise.all([
      //   fetch(`${API_URL}/users/${username}/followers/count`, { headers }),
      //   fetch(`${API_URL}/users/${username}/following/count`, { headers }),
      // ]);
      // if (fwrRes.ok) setFollowers((await fwrRes.json()).count ?? 0);
      // if (fwgRes.ok) setFollowing((await fwgRes.json()).count ?? 0);

      setError(null);
    } catch (err) {
      console.error("ProfileScreen error:", err);
      setError(err.message || "Something went wrong");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [navigation]);

  useEffect(() => {
    fetchProfileData();
  }, [fetchProfileData]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchProfileData();
  };

  const handleLogout = async () => {
    await AsyncStorage.multiRemove(["access_token", "refresh_token"]);
    navigation?.replace("Login");
  };

  // ── Render header (profile info) ────────────────────────────────────────────
  const renderHeader = () => (
    <View style={styles.headerContainer}>
      {/* Top bar */}
      <View style={styles.topBar}>
        <View style={styles.topBarLeft}>
          <Text style={styles.lockIcon}>🔒</Text>
          <Text style={styles.usernameTopBar}>{user?.username ?? ""}</Text>
        </View>
        <TouchableOpacity onPress={handleLogout}>
          <Text style={styles.menuIcon}>☰</Text>
        </TouchableOpacity>
      </View>

      {/* Avatar + Stats row */}
      <View style={styles.avatarStatsRow}>
        {/* Avatar */}
        <View style={styles.avatarWrapper}>
          {user?.avatar_url ? (
            <Image
              source={{ uri: user.avatar_url }}
              style={styles.avatar}
            />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder]}>
              <Text style={styles.avatarInitial}>
                {(user?.full_name ?? user?.username ?? "U")[0].toUpperCase()}
              </Text>
            </View>
          )}
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          <StatColumn count={posts.length} label="Posts" />
          <StatColumn count={followers} label="Followers" />
          <StatColumn count={following} label="Following" />
        </View>
      </View>

      {/* Bio section */}
      <View style={styles.bioSection}>
        <Text style={styles.fullName}>{user?.full_name ?? ""}</Text>
        {user?.department || user?.university ? (
          <Text style={styles.bioLine}>
            {[user.department, user.university].filter(Boolean).join(" · ")}
          </Text>
        ) : null}
        {user?.bio ? (
          <Text style={styles.bioLine}>{user.bio}</Text>
        ) : null}
      </View>

      {/* Edit Profile Button */}
      <TouchableOpacity style={styles.editButton}>
        <Text style={styles.editButtonText}>Edit Profile</Text>
      </TouchableOpacity>

      {/* Grid / tab bar */}
      <View style={styles.tabBar}>
        <View style={styles.activeTab}>
          <Text style={styles.gridIcon}>⊞</Text>
        </View>
      </View>
    </View>
  );

  // ── Loading / Error states ──────────────────────────────────────────────────
  if (loading) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator size="large" color="#262626" />
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.centered}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={fetchProfileData}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  // ── Main render ─────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <FlatList
        data={posts}
        keyExtractor={(item) => item.id}
        numColumns={3}
        ListHeaderComponent={renderHeader}
        renderItem={({ item }) => <PostTile post={item} />}
        ItemSeparatorComponent={() => <View style={{ height: 1 }} />}
        columnWrapperStyle={styles.row}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.emptyPosts}>
            <Text style={styles.emptyIcon}>📷</Text>
            <Text style={styles.emptyText}>No posts yet</Text>
          </View>
        }
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#fff",
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
  },

  // ── Header ──
  headerContainer: {
    backgroundColor: "#fff",
    paddingBottom: 2,
  },
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  topBarLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  lockIcon: {
    fontSize: 14,
    color: "#262626",
  },
  usernameTopBar: {
    fontSize: 17,
    fontWeight: "700",
    color: "#262626",
    letterSpacing: -0.3,
  },
  menuIcon: {
    fontSize: 22,
    color: "#262626",
  },

  // ── Avatar + Stats ──
  avatarStatsRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    marginTop: 4,
  },
  avatarWrapper: {
    marginRight: 24,
  },
  avatar: {
    width: 86,
    height: 86,
    borderRadius: 43,
    borderWidth: 1,
    borderColor: "#dbdbdb",
  },
  avatarPlaceholder: {
    backgroundColor: "#262626",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitial: {
    color: "#fff",
    fontSize: 32,
    fontWeight: "700",
  },
  statsRow: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "space-around",
  },
  statCol: {
    alignItems: "center",
  },
  statNumber: {
    fontSize: 17,
    fontWeight: "700",
    color: "#262626",
  },
  statLabel: {
    fontSize: 13,
    color: "#262626",
    marginTop: 2,
  },

  // ── Bio ──
  bioSection: {
    paddingHorizontal: 16,
    marginTop: 12,
  },
  fullName: {
    fontSize: 14,
    fontWeight: "700",
    color: "#262626",
    marginBottom: 2,
  },
  bioLine: {
    fontSize: 14,
    color: "#262626",
    lineHeight: 18,
  },

  // ── Edit Button ──
  editButton: {
    marginHorizontal: 16,
    marginTop: 12,
    borderWidth: 1,
    borderColor: "#dbdbdb",
    borderRadius: 8,
    paddingVertical: 7,
    alignItems: "center",
  },
  editButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#262626",
  },

  // ── Tab bar ──
  tabBar: {
    flexDirection: "row",
    borderTopWidth: 0.5,
    borderTopColor: "#dbdbdb",
    marginTop: 14,
  },
  activeTab: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#262626",
  },
  gridIcon: {
    fontSize: 22,
    color: "#262626",
  },

  // ── Grid ──
  row: {
    gap: 1,
  },
  tile: {
    width: TILE_SIZE,
    height: TILE_SIZE,
    backgroundColor: "#efefef",
  },
  tileImage: {
    width: "100%",
    height: "100%",
  },
  tileTextFallback: {
    flex: 1,
    backgroundColor: "#f0f0f0",
    padding: 8,
    justifyContent: "center",
  },
  tileText: {
    fontSize: 11,
    color: "#555",
    lineHeight: 15,
  },

  // ── Empty state ──
  emptyPosts: {
    alignItems: "center",
    paddingTop: 60,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 16,
    color: "#8e8e8e",
    fontWeight: "500",
  },

  // ── Error ──
  errorText: {
    color: "#e53e3e",
    fontSize: 15,
    marginBottom: 16,
    textAlign: "center",
    paddingHorizontal: 24,
  },
  retryBtn: {
    backgroundColor: "#262626",
    paddingHorizontal: 28,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryText: {
    color: "#fff",
    fontWeight: "600",
  },
});
import React, { useEffect, useState, useCallback } from "react";
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
  Alert,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../../context/ThemeContext";

const API_URL = "http://127.0.0.1:8000";

const { width } = Dimensions.get("window");
const TILE_SIZE = (width - 3) / 3;

type PostImage = { id: string; image_url: string };
type Post = { id: string; content?: string; images?: PostImage[] };
type User = {
  id: string;
  username: string;
  full_name?: string;
  bio?: string;
  profile_pic?: string;
  department?: string;
  university?: string;
};

function PostTile({ post, theme }: { post: Post; theme: any }) {
  const firstImage = post.images?.[0]?.image_url
    ? post.images[0].image_url.startsWith("http")
      ? post.images[0].image_url
      : `${API_URL}${post.images[0].image_url}`
    : null;

  return (
    <TouchableOpacity style={[styles.tile, { backgroundColor: theme.card }]}>
      {firstImage ? (
        <Image source={{ uri: firstImage }} style={styles.tileImage} />
      ) : (
        <View style={[styles.tileFallback, { backgroundColor: theme.card }]}>
          <Text numberOfLines={4} style={[styles.tileText, { color: theme.subtext }]}>
            {post.content || ""}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

function StatCol({ count, label, theme }: { count: number; label: string; theme: any }) {
  return (
    <View style={styles.statCol}>
      <Text style={[styles.statNumber, { color: theme.text }]}>{count}</Text>
      <Text style={[styles.statLabel, { color: theme.subtext }]}>{label}</Text>
    </View>
  );
}

function FollowButton({
  isFollowing,
  isOwnProfile,
  loading,
  onPress,
  theme,
}: {
  isFollowing: boolean;
  isOwnProfile: boolean;
  loading: boolean;
  onPress: () => void;
  theme: any;
}) {
  if (isOwnProfile) return null;

  return (
    <TouchableOpacity
      style={[
        styles.followBtn,
        isFollowing
          ? { backgroundColor: theme.card, borderWidth: 1, borderColor: theme.subtext }
          : { backgroundColor: "#0095f6" },
      ]}
      onPress={onPress}
      disabled={loading}
      activeOpacity={0.8}
    >
      {loading ? (
        <ActivityIndicator size="small" color={isFollowing ? theme.text : "#fff"} />
      ) : (
        <Text style={[styles.followBtnText, { color: isFollowing ? theme.text : "#fff" }]}>
          {isFollowing ? "Following" : "Follow"}
        </Text>
      )}
    </TouchableOpacity>
  );
}

export default function UserProfileScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const { theme, mode } = useTheme();

  const [user, setUser] = useState<User | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem("access_token");
      const myId = await AsyncStorage.getItem("user_id");
      setCurrentUserId(myId);

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      };

      const userId = String(id);

      const [userRes, postsRes, followersRes, followingRes] = await Promise.all([
        fetch(`${API_URL}/users/id/${userId}`, { headers }),
        fetch(`${API_URL}/users/${userId}/posts`, { headers }),
        fetch(`${API_URL}/users/${userId}/followers`, { headers }),
        fetch(`${API_URL}/users/${userId}/following`, { headers }),
      ]);

      const userData = await userRes.json();
      const postsData = await postsRes.json();
      const followersData = await followersRes.json();
      const followingData = await followingRes.json();

      setUser(userData);
      setPosts(Array.isArray(postsData) ? postsData : []);

      const followers = Array.isArray(followersData) ? followersData : [];
      const following = Array.isArray(followingData) ? followingData : [];

      setFollowerCount(followers.length);
      setFollowingCount(following.length);

      if (myId) {
        const alreadyFollowing = followers.some((f: any) => f.follower_id === myId);
        setIsFollowing(alreadyFollowing);
      }
    } catch (err) {
      console.log("❌ ERROR:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleFollowToggle = async () => {
    const token = await AsyncStorage.getItem("access_token");
    if (!token) {
      Alert.alert("Not logged in", "Please log in to follow users.");
      return;
    }

    setFollowLoading(true);
    const userId = String(id);
    const method = isFollowing ? "DELETE" : "POST";
    const endpoint = isFollowing
      ? `${API_URL}/unfollow/${userId}`
      : `${API_URL}/follow/${userId}`;

    try {
      const res = await fetch(endpoint, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        const err = await res.json();
        Alert.alert("Error", err.detail || "Something went wrong.");
        return;
      }

      setIsFollowing((prev) => !prev);
      setFollowerCount((prev) => (isFollowing ? prev - 1 : prev + 1));
    } catch (e) {
      Alert.alert("Network error", "Could not complete the request.");
    } finally {
      setFollowLoading(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.center, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.text} />
      </SafeAreaView>
    );
  }

  const profilePic = user?.profile_pic
    ? user.profile_pic.startsWith("http")
      ? user.profile_pic
      : `${API_URL}${user.profile_pic}`
    : null;

  const isOwnProfile = currentUserId === String(id);

  const ProfileHeader = () => (
    <View>
      <View style={[styles.topBar, { borderBottomColor: theme.card }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.username, { color: theme.text }]}>@{user?.username}</Text>
        <View style={{ width: 34 }} />
      </View>

      <View style={styles.rowTop}>
        {profilePic ? (
          <Image source={{ uri: profilePic }} style={[styles.avatar, { borderColor: theme.card }]} />
        ) : (
          <View style={[styles.avatar, styles.avatarPlaceholder, { backgroundColor: theme.card }]}>
            <Ionicons name="person" size={36} color={theme.subtext} />
          </View>
        )}

        <View style={styles.statsRow}>
          <StatCol count={posts.length} label="Posts" theme={theme} />
          <StatCol count={followerCount} label="Followers" theme={theme} />
          <StatCol count={followingCount} label="Following" theme={theme} />
        </View>
      </View>

      <View style={styles.bio}>
        {user?.full_name && <Text style={[styles.name, { color: theme.text }]}>{user.full_name}</Text>}
        {user?.department && <Text style={[styles.meta, { color: theme.subtext }]}>{user.department}</Text>}
        {user?.university && <Text style={[styles.meta, { color: theme.subtext }]}>{user.university}</Text>}
        {user?.bio && <Text style={[styles.bioText, { color: theme.text }]}>{user.bio}</Text>}
      </View>

      <View style={styles.actionRow}>
        <FollowButton
          isFollowing={isFollowing}
          isOwnProfile={isOwnProfile}
          loading={followLoading}
          onPress={handleFollowToggle}
          theme={theme}
        />
        {isOwnProfile && (
          <TouchableOpacity style={[styles.editBtn, { borderColor: theme.subtext }]}>
            <Text style={[styles.editBtnText, { color: theme.text }]}>Edit Profile</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={[styles.divider, { backgroundColor: theme.card }]} />
    </View>
  );

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: theme.background }]}>
      <StatusBar barStyle={mode === "dark" ? "light-content" : "dark-content"} />
      <FlatList
        data={posts}
        keyExtractor={(item) => item.id}
        numColumns={3}
        renderItem={({ item }) => <PostTile post={item} theme={theme} />}
        ListHeaderComponent={<ProfileHeader />}
        ListEmptyComponent={
          <View style={styles.emptyPosts}>
            <Ionicons name="images-outline" size={40} color={theme.subtext} />
            <Text style={[styles.emptyPostsText, { color: theme.subtext }]}>No posts yet</Text>
          </View>
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            tintColor={theme.text}
            onRefresh={() => {
              setRefreshing(true);
              fetchData();
            }}
          />
        }
      />
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
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
  },
  backBtn: { width: 34, height: 34, alignItems: "center", justifyContent: "center" },
  username: { fontSize: 16, fontWeight: "700", letterSpacing: 0.1 },
  rowTop: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 10,
  },
  avatar: { width: 84, height: 84, borderRadius: 42, borderWidth: 2 },
  avatarPlaceholder: { justifyContent: "center", alignItems: "center" },
  statsRow: { flex: 1, flexDirection: "row", justifyContent: "space-around", marginLeft: 10 },
  statCol: { alignItems: "center" },
  statNumber: { fontWeight: "800", fontSize: 18 },
  statLabel: { fontSize: 12, marginTop: 2 },
  bio: { paddingHorizontal: 18, paddingBottom: 12 },
  name: { fontWeight: "700", fontSize: 15, marginBottom: 2 },
  meta: { fontSize: 13, marginBottom: 1 },
  bioText: { fontSize: 13, marginTop: 4, lineHeight: 19 },
  actionRow: { paddingHorizontal: 18, paddingBottom: 14, flexDirection: "row", gap: 10 },
  followBtn: { flex: 1, height: 36, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  followBtnText: { fontSize: 14, fontWeight: "700" },
  editBtn: { flex: 1, height: 36, borderRadius: 8, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  editBtnText: { fontSize: 14, fontWeight: "700" },
  divider: { height: 1, marginBottom: 1 },
  tile: { width: TILE_SIZE, height: TILE_SIZE, margin: 0.5 },
  tileImage: { width: "100%", height: "100%" },
  tileFallback: { flex: 1, justifyContent: "center", alignItems: "center", padding: 6 },
  tileText: { fontSize: 10, textAlign: "center" },
  emptyPosts: { alignItems: "center", paddingTop: 60, gap: 12 },
  emptyPostsText: { fontSize: 14 },
});
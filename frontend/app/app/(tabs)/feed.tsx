import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  Image,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
} from "react-native";

import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useTheme } from "../../context/ThemeContext";

const API_URL = "http://127.0.0.1:8000";

// ─── POST CARD ─────────────────────────────────────────
function PostCard({ item, theme }: { item: any; theme: any }) {
  const [isLiked, setIsLiked] = useState(item.is_liked);
  const [likesCount, setLikesCount] = useState(item.likes_count);
  const [liking, setLiking] = useState(false);

  const handleLike = async () => {
    if (liking) return;
    const token = await AsyncStorage.getItem("access_token");
    if (!token) return;

    const wasLiked = isLiked; // ✅ capture before any state change

    // optimistic update
    setIsLiked(!wasLiked);
    setLikesCount((c: number) => wasLiked ? c - 1 : c + 1);
    setLiking(true);

    try {
      const method = wasLiked ? "DELETE" : "POST";
      const res = await fetch(`${API_URL}/posts/${item.id}/like`, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (!res.ok) {
        // revert using captured value
        setIsLiked(wasLiked);
        setLikesCount((c: number) => wasLiked ? c + 1 : c - 1);
      }
    } catch (e) {
      console.log("Like error:", e);
      setIsLiked(wasLiked);
      setLikesCount((c: number) => wasLiked ? c + 1 : c - 1);
    } finally {
      setLiking(false);
    }
  };

  return (
    <View style={[styles.post, { borderColor: theme.card, backgroundColor: theme.card }]}>
      {/* HEADER ROW */}
      <View style={styles.postHeader}>
        {item.profile_pic ? (
          <Image
            source={{
              uri: item.profile_pic.startsWith("http")
                ? item.profile_pic
                : `${API_URL}${item.profile_pic}`,
            }}
            style={styles.avatar}
          />
        ) : (
          <View style={[styles.avatar, styles.avatarFallback, { backgroundColor: theme.background }]}>
            <Ionicons name="person" size={16} color={theme.subtext} />
          </View>
        )}
        <Text style={[styles.username, { color: theme.text }]}>
          @{item.username}
        </Text>
      </View>

      {/* CONTENT */}
      {item.content ? (
        <Text style={[styles.content, { color: theme.text }]}>
          {item.content}
        </Text>
      ) : null}

      {/* IMAGE */}
      {item.image && (
        <Image
          source={{
            uri: item.image.startsWith("http")
              ? item.image
              : `${API_URL}${item.image}`,
          }}
          style={styles.image}
          resizeMode="cover"
        />
      )}

      {/* FOOTER */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.likeBtn}
          onPress={handleLike}
          disabled={liking}
          activeOpacity={1}
        >
          <Ionicons
            name={isLiked ? "heart" : "heart-outline"}
            size={22}
            color={isLiked ? "#e0245e" : theme.subtext}
          />
          <Text style={[styles.likeCount, { color: isLiked ? "#e0245e" : theme.subtext }]}>
            {likesCount}
          </Text>
        </TouchableOpacity>

        <Text style={[styles.time, { color: theme.subtext }]}>
          {item.created_at ? new Date(item.created_at).toLocaleString() : ""}
        </Text>
      </View>
    </View>
  );
}

// ─── HOME SCREEN ───────────────────────────────────────
export default function Home() {
  const { theme } = useTheme();

  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchFeed = async () => {
    try {
      const res = await fetch(`${API_URL}/feed`);
      const data = await res.json();

      const withLikes = await Promise.all(
        data.map(async (post: any) => {
          try {
            const likesRes = await fetch(`${API_URL}/posts/${post.id}/likes`);
            const likesData = await likesRes.json();
            return {
              ...post,
              likes_count: likesData.likes ?? 0,
              is_liked: likesData.is_liked ?? false,
            };
          } catch {
            return { ...post, likes_count: 0, is_liked: false };
          }
        })
      );

      setPosts(withLikes);
    } catch (e) {
      console.log("Feed error:", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchFeed();
    }, [])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchFeed();
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Text style={[styles.header, { color: theme.text }]}>Unifi Feed</Text>

      {loading ? (
        <ActivityIndicator size="large" color={theme.text} />
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={theme.text}
            />
          }
          renderItem={({ item }) => <PostCard item={item} theme={theme} />}
          ListEmptyComponent={
            <Text style={[styles.empty, { color: theme.text }]}>
              No posts yet. Create one!
            </Text>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 60,
  },
  header: {
    fontSize: 24,
    fontWeight: "800",
    paddingHorizontal: 16,
    paddingBottom: 12,
    letterSpacing: -0.5,
  },
  post: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginHorizontal: 16,
    marginBottom: 12,
  },
  postHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
    gap: 8,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  avatarFallback: {
    justifyContent: "center",
    alignItems: "center",
  },
  username: {
    fontWeight: "700",
    fontSize: 14,
  },
  content: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 8,
  },
  image: {
    width: "100%",
    height: 200,
    borderRadius: 8,
    marginBottom: 8,
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 8,
  },
  likeBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  likeCount: {
    fontSize: 14,
    fontWeight: "600",
  },
  time: {
    fontSize: 11,
  },
  empty: {
    textAlign: "center",
    marginTop: 60,
    fontSize: 14,
  },
});
import React, { useState, useEffect, useRef } from "react";
import {
  View,
  TextInput,
  TouchableOpacity,
  Text,
  StyleSheet,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { useLocalSearchParams } from "expo-router";

const API_URL = "http://127.0.0.1:8000"

export default function ChatScreen() {
  const params = useLocalSearchParams();

  // ✅ Safely extract — useLocalSearchParams can return arrays, force string
  const conversationId = Array.isArray(params.conversationId)
    ? params.conversationId[0]
    : params.conversationId;
  const token = Array.isArray(params.token) ? params.token[0] : params.token;
  const userId = Array.isArray(params.userId2) ? params.userId2[0] : params.userId2;

  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const flatListRef = useRef(null);

  // ✅ Guard: don't poll if params are missing/undefined
  const paramsReady =
    conversationId &&
    conversationId !== "undefined" &&
    token &&
    token !== "undefined";

  useEffect(() => {
    if (!paramsReady) {
      setLoading(false);
      setError("Missing conversation info. Please go back and try again.");
      return;
    }

    fetchMessages();
    const interval = setInterval(fetchMessages, 2000);
    return () => clearInterval(interval);
  }, [paramsReady]);

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages.length]);

  const fetchMessages = async () => {
    try {
      const res = await fetch(`${API_URL}/messages/${conversationId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        console.error("Fetch failed:", res.status, body);
        return;
      }

      const data = await res.json();

      const formatted = data.map((msg) => ({
        id: msg.id,
        text: msg.text,
        sender: String(msg.sender_id) === String(userId) ? "me" : "other",
        created_at: msg.created_at,
      }));

      setMessages(formatted);
    } catch (err) {
      console.error("Fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async () => {
    const trimmed = message.trim();
    if (!trimmed || !paramsReady) return;

    setMessage("");

    try {
      const res = await fetch(`${API_URL}/messages/${conversationId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ content: trimmed }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        console.error("Send failed:", err);
        return;
      }

      fetchMessages();
    } catch (error) {
      console.error("Send error:", error);
    }
  };

  const renderItem = ({ item }) => {
    const isMe = item.sender === "me";
    return (
      <View style={[styles.messageBubble, isMe ? styles.myMessage : styles.otherMessage]}>
        <Text style={isMe ? styles.myMessageText : styles.otherMessageText}>
          {item.text}
        </Text>
        {item.created_at && (
          <Text style={isMe ? styles.myTimestamp : styles.otherTimestamp}>
            {new Date(item.created_at).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </Text>
        )}
      </View>
    );
  };

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={{ color: "red", textAlign: "center", padding: 20 }}>{error}</Text>
        <Text style={{ color: "#666", fontSize: 12, marginTop: 8 }}>
          Debug — conversationId: {String(conversationId)} | token: {token ? "✅ present" : "❌ missing"}
        </Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
    >
      <View style={styles.container}>
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 12, paddingBottom: 8 }}
          onContentSizeChange={() =>
            flatListRef.current?.scrollToEnd({ animated: false })
          }
        />

        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="Type a message..."
            placeholderTextColor="#999"
            value={message}
            onChangeText={setMessage}
            multiline
            returnKeyType="send"
            blurOnSubmit={false}
          />
          <TouchableOpacity
            style={[styles.sendButton, !message.trim() && styles.sendButtonDisabled]}
            onPress={sendMessage}
            disabled={!message.trim()}
          >
            <Text style={styles.sendButtonText}>Send</Text>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f2f2f2" },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  messageBubble: {
    padding: 10,
    paddingHorizontal: 14,
    borderRadius: 18,
    marginVertical: 4,
    maxWidth: "75%",
  },
  myMessage: {
    backgroundColor: "#007AFF",
    alignSelf: "flex-end",
    borderBottomRightRadius: 4,
  },
  otherMessage: {
    backgroundColor: "#e5e5ea",
    alignSelf: "flex-start",
    borderBottomLeftRadius: 4,
  },
  myMessageText: { color: "#ffffff", fontSize: 15 },
  otherMessageText: { color: "#000000", fontSize: 15 },
  myTimestamp: {
    color: "rgba(255,255,255,0.65)",
    fontSize: 10,
    marginTop: 3,
    alignSelf: "flex-end",
  },
  otherTimestamp: {
    color: "rgba(0,0,0,0.4)",
    fontSize: 10,
    marginTop: 3,
    alignSelf: "flex-end",
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "flex-end",
    padding: 10,
    borderTopWidth: 1,
    borderColor: "#ddd",
    backgroundColor: "#fff",
  },
  input: {
    flex: 1,
    backgroundColor: "#f1f1f1",
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 9,
    fontSize: 15,
    maxHeight: 100,
    color: "#000",
  },
  sendButton: {
    backgroundColor: "#007AFF",
    marginLeft: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    justifyContent: "center",
    borderRadius: 20,
  },
  sendButtonDisabled: { backgroundColor: "#b0c4de" },
  sendButtonText: { color: "#fff", fontWeight: "600", fontSize: 15 },
});
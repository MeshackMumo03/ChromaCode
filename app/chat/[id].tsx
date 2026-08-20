import { StyledButton } from "@/components/StyledButton";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { getBaseUrl, getImageUrl, getVideoThumbnailUrl, getGroupImageUrl } from "@/constants/api";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useAuth } from "@/hooks/useAuth";
import { useConversations } from "@/hooks/useConversations";
import { useSocket } from "@/hooks/useSocket";
import { useToast } from "@/hooks/useToast";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AudioModule, useAudioPlayer, useAudioRecorder, RecordingPresets } from "expo-audio";
import * as Haptics from "expo-haptics";

import { useLocalSearchParams, useNavigation, useRouter } from "expo-router";
import { useVideoPlayer, VideoView } from "expo-video";
import React, {
  memo,
  useCallback,
  useEffect,
  useRef,
  useState
} from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  FlatList,
  KeyboardAvoidingView,
  Linking,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Image as ExpoImage } from "expo-image";
import { SafeAreaView } from "react-native-safe-area-context";

import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";

const BASE_URL = getBaseUrl();
const getChatCacheKey = (id: string) => `chromacode_chat_${id}`;

interface Message {
  _id: string;
  sender: {
    _id: string;
    username: string;
    profilePicture?: string;
  };
  text: string;
  codeId?: {
    _id: string;
    name: string;
    color: string;
    meaning: string;
  };
  status?: "sent" | "delivered" | "read";
  mediaType:
    | "none"
    | "image"
    | "voice"
    | "document"
    | "sticker"
    | "video"
    | "audio"
    | "gif";
  mediaUrl?: string;
  fileName?: string;
  fileSize?: number;
  fileMimeType?: string;
  timestamp: string;
  reactions?: { emoji: string; userId: string }[];
  replyTo?: Message;
}

const Waveform = ({ active, color }: { active: boolean; color: string }) => (
  <View
    style={{
      flexDirection: "row",
      alignItems: "center",
      height: 25,
      marginHorizontal: 10,
    }}
  >
    {[4, 12, 18, 10, 14, 22, 16, 8, 12, 15].map((h, i) => (
      <View
        key={i}
        style={{
          width: 3,
          height: h,
          backgroundColor: active ? color : color + "50",
          marginHorizontal: 1,
          borderRadius: 2,
        }}
      />
    ))}
  </View>
);

// Separate component so useVideoPlayer is only created when a video URL exists
const VideoLightbox = ({ url, token }: { url: string; token: string | null }) => {
  const player = useVideoPlayer(url, (p) => {
    p.loop = false;
    p.replace({
      uri: url,
      metadata: { title: "Video Message" },
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    p.play();
  });

  return (
    <VideoView
      player={player}
      style={styles.fullMedia}
      contentFit="contain"
    />
  );
};

// Optimized Message Component — supports swipe-right-to-reply via PanResponder
const MessageItem = memo(
  ({
    item,
    isMyMessage,
    showDateSeparator,
    formatDateSeparator,
    colors,
    colorScheme,
    setPeekCode,
    StatusIcon,
    token,
    playSound,
    playingId,
    loadingSoundId,
    openDocument,
    onLongPress,
    onMediaPress,
    onSwipeReply,
  }: any) => {
    const lastTap = useRef(0);

    // ── Swipe-right-to-reply (PanResponder) ──────────────────────────────────
    const swipeX = useRef(new Animated.Value(0)).current;
    const swipeTriggered = useRef(false);
    const SWIPE_THRESHOLD = 60;

    const panResponder = useRef(
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gestureState) =>
          // Only capture significant horizontal motion that is more horizontal than vertical
          Math.abs(gestureState.dx) > 8 && Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 1.5,
        onPanResponderGrant: () => {
          swipeTriggered.current = false;
        },
        onPanResponderMove: (_, gestureState) => {
          // Only allow swipe in the "away from edge" direction: right for their messages, left for mine
          const dx = isMyMessage ? Math.min(0, gestureState.dx) : Math.max(0, gestureState.dx);
          const clamped = isMyMessage
            ? Math.max(-SWIPE_THRESHOLD * 1.2, dx)
            : Math.min(SWIPE_THRESHOLD * 1.2, dx);
          swipeX.setValue(clamped);
          // Trigger reply haptic once at threshold
          if (!swipeTriggered.current && Math.abs(clamped) >= SWIPE_THRESHOLD) {
            swipeTriggered.current = true;
          }
        },
        onPanResponderRelease: (_, gestureState) => {
          // If passed threshold, trigger reply callback
          const dx = isMyMessage ? gestureState.dx : gestureState.dx;
          if (Math.abs(dx) >= SWIPE_THRESHOLD && onSwipeReply) {
            onSwipeReply(item);
          }
          // Snap back
          Animated.spring(swipeX, {
            toValue: 0,
            useNativeDriver: true,
            tension: 200,
            friction: 20,
          }).start();
          swipeTriggered.current = false;
        },
        onPanResponderTerminate: () => {
          Animated.spring(swipeX, { toValue: 0, useNativeDriver: true }).start();
        },
      }),
    ).current;

    // Reply arrow opacity: fades in as you swipe
    const replyArrowOpacity = swipeX.interpolate({
      inputRange: isMyMessage ? [-SWIPE_THRESHOLD, 0] : [0, SWIPE_THRESHOLD],
      outputRange: [1, 0],
      extrapolate: 'clamp',
    });

    const handlePress = () => {
      const now = Date.now();
      if (now - lastTap.current < 300) {
        onLongPress(item);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      lastTap.current = now;
    };

    const isPlaying = playingId === item._id;

    return (
      <View>
        {showDateSeparator && (
          <View style={styles.dateSeparator}>
            <View style={[styles.dateLine, { backgroundColor: colors.icon }]} />
            <ThemedText
              style={[
                styles.dateText,
                { color: colors.icon, backgroundColor: colors.background },
              ]}
            >
              {formatDateSeparator(item.timestamp)}
            </ThemedText>
            <View style={[styles.dateLine, { backgroundColor: colors.icon }]} />
          </View>
        )}
        {/* Swipeable row wrapper */}
        <Animated.View
          style={[
            styles.messageWrapper,
            isMyMessage ? styles.myMessageWrapper : styles.theirMessageWrapper,
            { transform: [{ translateX: swipeX }] },
          ]}
          {...panResponder.panHandlers}
        >
          {/* Reply arrow indicator (appears on swipe from the side) */}
          {!isMyMessage && (
            <Animated.View style={[styles.replyArrow, { opacity: replyArrowOpacity, left: -36 }]}>
              <View style={[styles.replyArrowCircle, { backgroundColor: colors.tint + '22' }]}>
                <Ionicons name="arrow-undo" size={16} color={colors.tint} />
              </View>
            </Animated.View>
          )}
          {isMyMessage && (
            <Animated.View style={[styles.replyArrow, { opacity: replyArrowOpacity, right: -36 }]}>
              <View style={[styles.replyArrowCircle, { backgroundColor: colors.tint + '22' }]}>
                <Ionicons name="arrow-undo" size={16} color={colors.tint} />
              </View>
            </Animated.View>
          )}

          {!isMyMessage && (
            <ExpoImage
              source={{ uri: getImageUrl(item.sender.profilePicture) }}
              style={styles.messageAvatar}
              contentFit="cover"
            />
          )}
          <View style={styles.bubbleContainer}>
            <Pressable
              onLongPress={() => {
                onLongPress(item);
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              }}
              onPress={handlePress}
              style={[
                styles.messageContainer,
                isMyMessage ? styles.myMessage : styles.theirMessage,
                {
                  backgroundColor: item.codeId
                    ? colorScheme === "dark"
                      ? "#2A2A2A"
                      : "#FFFFFF"
                    : isMyMessage
                      ? colors.tint
                      : colorScheme === "light"
                        ? "#E9E9EB"
                        : "#333333",
                  borderWidth: item.codeId ? 1 : 0,
                  borderColor: item.codeId ? item.codeId.color : "transparent",
                  padding:
                    item.codeId ||
                    item.mediaType === "image" ||
                    item.mediaType === "video" ||
                    item.mediaType === "gif" ||
                    item.mediaType === "sticker"
                      ? 0
                      : 10,
                  width:
                    item.codeId ||
                    item.mediaType === "image" ||
                    item.mediaType === "video" ||
                    item.mediaType === "gif" ||
                    item.mediaType === "sticker"
                      ? 250
                      : undefined,
                  maxWidth: 280,
                  alignSelf: item.codeId
                    ? "center"
                    : isMyMessage
                      ? "flex-end"
                      : "flex-start",
                  marginVertical: item.codeId ? 10 : 2,
                  elevation: item.codeId ? 3 : 0,
                },
              ]}
            >
              {item.replyTo && (
                <View
                  style={[
                    styles.quotedBox,
                    {
                      borderLeftColor: isMyMessage ? '#FFF' : colors.tint,
                      backgroundColor: isMyMessage
                        ? 'rgba(255, 255, 255, 0.2)'
                        : colorScheme === 'dark'
                          ? 'rgba(255, 255, 255, 0.08)'
                          : 'rgba(0, 0, 0, 0.05)',
                    },
                  ]}
                >
                  <ThemedText
                    style={[
                      styles.quotedAuthor,
                      { color: isMyMessage ? '#FFF' : colors.tint },
                    ]}
                  >
                    {item.replyTo.sender?.username || 'User'}
                  </ThemedText>
                  <ThemedText
                    style={[
                      styles.quotedText,
                      {
                        color: isMyMessage
                          ? 'rgba(255,255,255,0.9)'
                          : colors.text,
                      },
                    ]}
                    numberOfLines={2}
                  >
                    {item.replyTo.codeId
                      ? `🎨 Code: ${item.replyTo.codeId.name}`
                      : item.replyTo.mediaType === 'image'
                        ? '📷 Photo'
                        : item.replyTo.mediaType === 'video'
                          ? '🎥 Video'
                          : item.replyTo.mediaType === 'voice' || item.replyTo.mediaType === 'audio'
                            ? '🎤 Voice Note'
                            : item.replyTo.mediaType === 'document'
                              ? `📄 ${item.replyTo.fileName || 'Document'}`
                              : item.replyTo.text || 'Message'}
                  </ThemedText>
                </View>
              )}
              {item.codeId ? (
                <TouchableOpacity
                  onPress={() => setPeekCode(item.codeId)}
                  activeOpacity={0.9}
                  style={styles.richMessageCard}
                >
                  <View
                    style={[
                      styles.colorSideBar,
                      { backgroundColor: item.codeId.color },
                    ]}
                  />
                  <View style={styles.richContent}>
                    <ThemedText
                      style={[
                        styles.codeNameLabel,
                        { color: item.codeId.color },
                      ]}
                    >
                      {item.codeId.name}
                    </ThemedText>
                    <ThemedText
                      style={styles.codeMeaningText}
                      numberOfLines={3}
                    >
                      {item.codeId.meaning}
                    </ThemedText>
                    <View style={styles.timestampRow}>
                      <ThemedText
                        style={[
                          styles.timestamp,
                          {
                            color: isMyMessage
                              ? colorScheme === "light"
                                ? "rgba(255,255,255,0.8)"
                                : "#000"
                              : colorScheme === "dark"
                                ? "rgba(255,255,255,0.7)"
                                : colors.icon,
                          },
                        ]}
                      >
                        {new Date(item.timestamp).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </ThemedText>
                      <StatusIcon
                        status={item.status}
                        isMyMessage={isMyMessage}
                      />
                    </View>
                  </View>
                </TouchableOpacity>
              ) : item.mediaType === "image" || item.mediaType === "gif" ? (
                <TouchableOpacity
                  onPress={() =>
                    onMediaPress(getImageUrl(item.mediaUrl), item.mediaType)
                  }
                  onLongPress={() => {
                    onLongPress(item);
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  }}
                  delayLongPress={350}
                  activeOpacity={0.9}
                >
                  <ExpoImage
                    source={{ uri: getImageUrl(item.mediaUrl) }}
                    style={styles.messageImage}
                    contentFit="cover"
                  />
                  <View style={[styles.timestampRow, styles.mediaTimestamp]}>
                    <ThemedText style={styles.timestamp}>
                      {new Date(item.timestamp).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </ThemedText>
                    <StatusIcon
                      status={item.status}
                      isMyMessage={isMyMessage}
                    />
                  </View>
                </TouchableOpacity>
              ) : item.mediaType === "video" ? (
                <TouchableOpacity
                  onPress={() =>
                    onMediaPress(getImageUrl(item.mediaUrl), item.mediaType)
                  }
                  onLongPress={() => {
                    onLongPress(item);
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  }}
                  delayLongPress={350}
                  activeOpacity={0.9}
                >
                  <ExpoImage
                    source={{ uri: getVideoThumbnailUrl(item.mediaUrl) }}
                    style={styles.messageImage}
                    contentFit="cover"
                  />
                  <View style={styles.playOverlay}>
                    <Ionicons name="play" size={40} color="#fff" />
                  </View>
                  <View style={[styles.timestampRow, styles.mediaTimestamp]}>
                    <ThemedText style={styles.timestamp}>
                      {new Date(item.timestamp).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </ThemedText>
                    <StatusIcon
                      status={item.status}
                      isMyMessage={isMyMessage}
                    />
                  </View>
                </TouchableOpacity>
              ) : item.mediaType === "sticker" ? (
                <TouchableOpacity
                  onLongPress={() => {
                    onLongPress(item);
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  }}
                  delayLongPress={350}
                  activeOpacity={0.9}
                >
                <View style={styles.stickerContainer}>
                  <ExpoImage
                    source={{ uri: getImageUrl(item.mediaUrl) }}
                    style={styles.stickerImage}
                    contentFit="contain"
                  />
                  <View style={[styles.timestampRow, styles.mediaTimestamp]}>
                    <ThemedText style={styles.timestamp}>
                      {new Date(item.timestamp).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </ThemedText>
                    <StatusIcon
                      status={item.status}
                      isMyMessage={isMyMessage}
                    />
                  </View>
                </View>
                </TouchableOpacity>
              ) : item.mediaType === "document" ? (
                <TouchableOpacity
                  style={styles.documentContainer}
                  onPress={() =>
                    openDocument(
                      item.mediaUrl || "",
                      item.fileName || "document",
                    )
                  }
                  onLongPress={() => {
                    onLongPress(item);
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  }}
                  delayLongPress={350}
                >
                  <Ionicons
                    name="document-text"
                    size={30}
                    color={isMyMessage ? "#fff" : colors.tint}
                  />
                  <View style={styles.documentInfo}>
                    <ThemedText
                      style={[
                        styles.documentName,
                        { color: isMyMessage ? "#fff" : colors.text },
                      ]}
                      numberOfLines={1}
                    >
                      {item.fileName || "Document"}
                    </ThemedText>
                    <ThemedText
                      style={[
                        styles.documentSize,
                        {
                          color: isMyMessage
                            ? "rgba(255,255,255,0.7)"
                            : colors.icon,
                        },
                      ]}
                    >
                      {item.fileSize
                        ? `${(item.fileSize / 1024).toFixed(1)} KB`
                        : ""}
                    </ThemedText>
                  </View>
                  <View style={styles.timestampRow}>
                    <ThemedText
                      style={[
                        styles.timestamp,
                        {
                          color: isMyMessage
                            ? "rgba(255,255,255,0.8)"
                            : colors.icon,
                        },
                      ]}
                    >
                      {new Date(item.timestamp).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </ThemedText>
                    <StatusIcon
                      status={item.status}
                      isMyMessage={isMyMessage}
                    />
                  </View>
                </TouchableOpacity>
              ) : item.mediaType === "voice" || item.mediaType === "audio" ? (
                <TouchableOpacity
                  style={styles.voiceContainer}
                  onPress={() => playSound(item.mediaUrl || "", item._id)}
                  onLongPress={() => {
                    onLongPress(item);
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  }}
                  delayLongPress={350}
                >
                  {loadingSoundId === item._id ? (
                    <ActivityIndicator
                      size="small"
                      color={isMyMessage ? "#fff" : colors.tint}
                    />
                  ) : (
                    <Ionicons
                      name={isPlaying ? "pause" : "play"}
                      size={24}
                      color={isMyMessage ? "#fff" : colors.tint}
                    />
                  )}
                  <Waveform
                    active={isPlaying}
                    color={isMyMessage ? "#fff" : colors.tint}
                  />
                  <View style={styles.timestampRow}>
                    <ThemedText
                      style={[
                        styles.timestamp,
                        {
                          color: isMyMessage
                            ? "rgba(255,255,255,0.8)"
                            : colors.icon,
                        },
                      ]}
                    >
                      {new Date(item.timestamp).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </ThemedText>
                    <StatusIcon
                      status={item.status}
                      isMyMessage={isMyMessage}
                    />
                  </View>
                </TouchableOpacity>
              ) : (
                <>
                  <ThemedText
                    style={[
                      styles.messageText,
                      {
                        color: isMyMessage
                          ? colorScheme === "light"
                            ? "#fff"
                            : colors.background
                          : colors.text,
                      },
                    ]}
                  >
                    {item.text}
                  </ThemedText>
                  <View style={styles.timestampRow}>
                    <ThemedText
                      style={[
                        styles.timestamp,
                        {
                          color: isMyMessage
                            ? colorScheme === "light"
                              ? "rgba(255,255,255,0.8)"
                              : "#000"
                            : colorScheme === "dark"
                              ? "rgba(255,255,255,0.7)"
                              : colors.icon,
                        },
                      ]}
                    >
                      {new Date(item.timestamp).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </ThemedText>
                    <StatusIcon
                      status={item.status}
                      isMyMessage={isMyMessage}
                    />
                  </View>
                </>
              )}
            </Pressable>
            {item.reactions && item.reactions.length > 0 && (
              <View
                style={[
                  styles.reactionsBadgeContainer,
                  isMyMessage ? { right: 5 } : { left: 5 },
                ]}
              >
                {item.reactions.map((r: any, i: number) => (
                  <View key={i} style={styles.reactionBadge}>
                    <ThemedText style={{ fontSize: 12 }}>{r.emoji}</ThemedText>
                  </View>
                ))}
              </View>
            )}
          </View>
        </Animated.View>
      </View>
    );
  },
  (prevProps, nextProps) => {
    const isPlayingChanged = (prevProps.playingId === prevProps.item._id) !== (nextProps.playingId === nextProps.item._id);
    const isLoadingChanged = (prevProps.loadingSoundId === prevProps.item._id) !== (nextProps.loadingSoundId === nextProps.item._id);
    
    return (
      prevProps.item._id === nextProps.item._id &&
      prevProps.item.status === nextProps.item.status &&
      prevProps.item.text === nextProps.item.text &&
      prevProps.item.mediaUrl === nextProps.item.mediaUrl &&
      prevProps.item.reactions?.length === nextProps.item.reactions?.length &&
      prevProps.isMyMessage === nextProps.isMyMessage &&
      prevProps.showDateSeparator === nextProps.showDateSeparator &&
      prevProps.colorScheme === nextProps.colorScheme &&
      !isPlayingChanged &&
      !isLoadingChanged
    );
  }
);

MessageItem.displayName = "MessageItem";

export default function ChatScreen() {
  const { id, name, avatar } = useLocalSearchParams();
  const { token, user } = useAuth();
  const { markAsRead } = useConversations();
  const socket = useSocket();
  const navigation = useNavigation();
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [conversation, setConversation] = useState<any>(null);
  const [typingUser, setTypingUser] = useState<string | null>(null);
  const [peekCode, setPeekCode] = useState<any>(null);
  const [page, setPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [recording, setRecording] = useState<any>(null);
  const [isRecording, setIsRecording] = useState(false);
  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const audioPlayer = useAudioPlayer();
  const [sound, setSound] = useState<any>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [loadingSoundId, setLoadingSoundId] = useState<string | null>(null);

  const [showMenu, setShowMenu] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [lightbox, setLightbox] = useState<{
    url: string;
    type: string;
  } | null>(null);
  const [isOnline, setIsOnline] = useState(false);
  const [customEmojiInput, setCustomEmojiInput] = useState('');
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);

  const updateCache = useCallback(
    async (msgs: Message[]) => {
      if (!id || !conversation) return;
      const safeMessages = msgs.map((m: any) => {
        const { mediaData, ...rest } = m;
        return rest;
      });
      await AsyncStorage.setItem(
        getChatCacheKey(id.toString()),
        JSON.stringify({
          conversation,
          messages: safeMessages,
        }),
      );
    },
    [id, conversation],
  );

  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const flatListRef = useRef<FlatList>(null);
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? "light"];
  const { showToast } = useToast();

  const StatusIcon = useCallback(
    ({ status, isMyMessage }: { status?: string; isMyMessage: boolean }) => {
      if (!isMyMessage || !status) return null;
      let iconName: any = "checkmark-outline";
      let color = colors.icon;

      if (status === "delivered") iconName = "checkmark-done-outline";
      if (status === "read") {
        iconName = "checkmark-done-outline";
        color = "#3498db"; // Blue for read
      }

      return (
        <Ionicons
          name={iconName}
          size={14}
          color={color}
          style={{ marginLeft: 4 }}
        />
      );
    },
    [colors.icon],
  );

  const formatDateSeparator = useCallback((dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);

    if (date.toDateString() === today.toDateString()) return "Today";
    if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
    return date.toLocaleDateString(undefined, {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }, []);

  // Header update including online status
  useEffect(() => {
    const title = conversation?.isGroup ? conversation.name : name || "Chat";
    const headerAvatar = conversation?.isGroup
      ? getGroupImageUrl(conversation.groupImage)
      : getImageUrl(
          conversation?.participants?.find((p: any) => p._id !== user?._id)
            ?.profilePicture,
        ) ||
        (avatar as string) ||
        'https://www.gravatar.com/avatar/?d=mp';

    navigation.setOptions({
      headerLeft: () => (
        <TouchableOpacity
          onPress={() => router.back()}
          style={{ marginRight: 10, padding: 5 }}
        >
          <Ionicons name="arrow-back" size={24} color={colors.tint} />
        </TouchableOpacity>
      ),
      headerTitle: () => (
        <View style={styles.headerTitleContainer}>
          <ExpoImage
            source={{ uri: headerAvatar }}
            style={styles.headerAvatar}
            contentFit="cover"
          />
          <View>
            <ThemedText style={styles.headerUsername}>{title}</ThemedText>
            {typingUser ? (
              <ThemedText style={{ fontSize: 12, color: colors.tint, fontStyle: 'italic' }}>
                typing...
              </ThemedText>
            ) : isOnline ? (
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <View
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: "#4cd964",
                    marginRight: 4,
                  }}
                />
                <ThemedText style={{ fontSize: 10, color: "#4cd964" }}>
                  online
                </ThemedText>
              </View>
            ) : (
              <ThemedText style={{ fontSize: 10, color: colors.icon }}>
                offline
              </ThemedText>
            )}
          </View>
        </View>
      ),
      headerRight: () =>
        conversation?.isGroup ? (
          <TouchableOpacity
            onPress={() => router.push(`/group-settings/${id}`)}
          >
            <Ionicons
              name="settings-outline"
              size={24}
              color={colors.tint}
              style={{ marginRight: 15 }}
            />
          </TouchableOpacity>
        ) : null,
    });
  }, [name, avatar, conversation, isOnline, typingUser, colors.tint, colors.icon, id, navigation, router, user?._id]);

  useEffect(() => {
    const init = async () => {
      // Load cached conversation and messages
      if (id) {
        try {
          const cachedStr = await AsyncStorage.getItem(
            getChatCacheKey(id.toString()),
          );
          if (cachedStr) {
            const { conversation: cachedConv, messages: cachedMsgs } =
              JSON.parse(cachedStr);
            setConversation(cachedConv);
            setMessages(cachedMsgs);
          }
        } catch (e) {
          console.error("Error loading chat cache:", e);
        }
      }
      // Fetch latest messages from API
      if (token && id) {
        try {
          const res = await fetch(
            `${BASE_URL}/conversations/${id}?page=1&limit=20`,
            {
              headers: { Authorization: `Bearer ${token}` },
            },
          );
          const contentType = res.headers.get("content-type") || "";
          if (!contentType.includes("application/json")) {
            const text = await res.text();
            console.error(
              "Non-JSON response from API:",
              text.substring(0, 200),
            );
            return;
          }
          const data = await res.json();
          if (!res.ok) {
            console.error("API error:", data?.message || res.status);
            return;
          }
          const sorted = (data.messages || []).sort(
            (a: any, b: any) =>
              new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
          );
          setConversation(data.conversation);
          setMessages(sorted);
          setHasMore(data.hasMore);
          // Tell the server (and update the conversations list) that this
          // conversation has now been read, so the unread badge clears.
          markAsRead(id.toString());
          // Save to cache
          const safeMessages = (data.messages || []).map((m: any) => {
            const { mediaData, ...rest } = m;
            return rest;
          });
          await AsyncStorage.setItem(
            getChatCacheKey(id.toString()),
            JSON.stringify({
              conversation: data.conversation,
              messages: safeMessages,
            }),
          );
        } catch (e) {
          console.error("Error loading messages from API:", e);
        }
      }
    };
    init();
  }, [id, token]);

  // Socket listeners for new messages
  useEffect(() => {
    if (!socket) return;
    const handleNewMessage = (data: any) => {
      setMessages((prev) => {
        const updated = [data.message, ...prev];
        return updated.sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      });
      // Scroll to bottom when a new message arrives
      setTimeout(
        () => flatListRef.current?.scrollToOffset({ offset: 0, animated: true }),
        100,
      );
    };

    const handleTypingEvent = (data: any) => {
      if (data.conversationId === id && data.senderId !== user?._id) {
        setTypingUser(data.senderName || "Someone");
      }
    };

    const handleStopTypingEvent = (data: any) => {
      if (data.conversationId === id && data.senderId !== user?._id) {
        setTypingUser(null);
      }
    };

    const handleReaction = ({ messageId, reactions }: any) => {
      setMessages((prev) => {
        const next = prev.map((m) =>
          m._id === messageId ? { ...m, reactions } : m,
        );
        updateCache(next);
        return next;
      });
    };

    const handleDeleted = ({ messageId }: any) => {
      setMessages((prev) => prev.filter((m) => m._id !== messageId));
    };

    const handleStatusChange = ({ userId, status }: any) => {
      setConversation((prev: any) => {
        const other = prev?.participants?.find((p: any) => p._id !== user?._id);
        if (other && other._id === userId) {
          setIsOnline(status === "online");
        }
        return prev;
      });
    };

    const handleOnlineUsers = (users: string[]) => {
      setConversation((prev: any) => {
        const other = prev?.participants?.find((p: any) => p._id !== user?._id);
        if (other && users.includes(other._id)) {
          setIsOnline(true);
        }
        return prev;
      });
    };

    socket.on("new_message", handleNewMessage);
    socket.on("typing", handleTypingEvent);
    socket.on("stop_typing", handleStopTypingEvent);
    socket.on("message_reaction", handleReaction);
    socket.on("message_deleted", handleDeleted);
    socket.on("user_status_change", handleStatusChange);
    socket.on("online_users", handleOnlineUsers);

    socket.on("messages_read", (data: any) => {
      if (data.conversationId === id) {
        setMessages((prev) =>
          prev.map((m) =>
            m.sender._id !== data.readerId ? { ...m, status: "read" } : m,
          ),
        );
      }
    });

    return () => {
      socket.off("new_message", handleNewMessage);
      socket.off("typing", handleTypingEvent);
      socket.off("stop_typing", handleStopTypingEvent);
      socket.off("message_reaction", handleReaction);
      socket.off("message_deleted", handleDeleted);
      socket.off("user_status_change", handleStatusChange);
      socket.off("online_users", handleOnlineUsers);
      socket.off("messages_read");
    };
  }, [id, token, user, socket]);

  useEffect(() => {
    if (page > 1) {
      const fetchMore = async () => {
        if (!token || !id) return;
        setLoadingMore(true);
        try {
          const response = await fetch(
            `${BASE_URL}/conversations/${id}?page=${page}&limit=20`,
            {
              headers: { Authorization: `Bearer ${token}` },
            },
          );
          const data = await response.json();
          if (response.ok) {
            setMessages((prev) => {
              const combined = [...prev, ...(data.messages || [])];
              const uniqueMap = new Map();
              combined.forEach((m) => uniqueMap.set(m._id, m));
              return Array.from(uniqueMap.values()).sort(
                (a: any, b: any) =>
                  new Date(b.timestamp).getTime() -
                  new Date(a.timestamp).getTime(),
              );
            });
            setHasMore(data.hasMore);
          }
        } catch (error) {
          console.error("Error loading more messages:", error);
        } finally {
          setLoadingMore(false);
        }
      };
      fetchMore();
    }
  }, [page]);

  const handleLoadMore = () => {
    if (!loadingMore && hasMore) {
      setPage((prev) => prev + 1);
    }
  };

  const handleTyping = () => {
    if (!socket || !user) return;
    socket.emit("typing", {
      conversationId: id,
      senderId: user._id,
      senderName: user.username,
    });
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      socket.emit("stop_typing", { conversationId: id, senderId: user._id });
    }, 2000) as any;
  };

  const uploadFile = async (uri: string, name: string, type: string) => {
    if (!token) return null;
    setUploading(true);
    try {
      const formData = new FormData();
      const cleanUri = Platform.OS === "ios" ? uri.replace("file://", "") : uri;

      formData.append("file", {
        uri: cleanUri,
        name: name,
        type: type,
      } as any);

      const response = await fetch(`${BASE_URL}/conversations/upload`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      const responseText = await response.text();
      if (!response.ok) {
        let errorMsg = "Upload failed";
        try {
          const errorJson = JSON.parse(responseText);
          errorMsg = errorJson.message || errorMsg;
        } catch (e) {}
        showToast(errorMsg, "error", "Upload failed");
        return null;
      }
      return JSON.parse(responseText);
    } catch (error: any) {
      console.error("Upload error:", error);
      showToast(error.message || "Could not upload file", "error", "Upload error");
      return null;
    } finally {
      setUploading(false);
    }
  };

  const handleSendMedia = async (mediaData: any, mediaType: string) => {
    if (!token || !id) return;
    try {
      const response = await fetch(`${BASE_URL}/conversations/${id}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          text: "",
          mediaType,
          mediaUrl: mediaData.mediaUrl,
          fileName: mediaData.fileName,
          fileSize: mediaData.fileSize,
          fileMimeType: mediaData.fileMimeType,
        }),
      });
      const data = await response.json();
      if (response.ok) {
        setMessages((prev) => {
          const combined = [...prev, data];
          const uniqueMap = new Map();
          combined.forEach((m) => uniqueMap.set(m._id, m));
          return Array.from(uniqueMap.values());
        });
        setTimeout(
          () =>
            flatListRef.current?.scrollToOffset({ offset: 0, animated: true }),
          100,
        );
      }
    } catch (error) {
      console.error("Error sending media message:", error);
    }
  };

  const pickImage = async () => {
    setShowAttachMenu(false);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images", "videos"],
        quality: 1,
      });

      if (!result.canceled) {
        const asset = result.assets[0];
        const mediaData = await uploadFile(
          asset.uri,
          asset.fileName ||
            (asset.type === "video" ? "video.mp4" : "image.jpg"),
          asset.mimeType ||
            (asset.type === "video" ? "video/mp4" : "image/jpeg"),
        );
        if (mediaData) {
          let type = "image";
          if (asset.type === "video") type = "video";
          else if (
            asset.mimeType?.includes("gif") ||
            asset.uri.toLowerCase().endsWith(".gif")
          )
            type = "gif";
          handleSendMedia(mediaData, type);
        }
      }
    } catch (e) {
      console.error("pickImage error:", e);
    }
  };

  const pickDocument = async () => {
    setShowAttachMenu(false);
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: "*/*" });
      if (!result.canceled) {
        const asset = result.assets[0];
        const mediaData = await uploadFile(
          asset.uri,
          asset.name,
          asset.mimeType || "application/octet-stream",
        );
        if (mediaData) {
          handleSendMedia(mediaData, "document");
        }
      }
    } catch (error) {
      console.error("Document picker error:", error);
    }
  };

  const startRecording = async () => {
    try {
      const permStatus = await AudioModule.requestRecordingPermissionsAsync();
      if (!permStatus.granted) {
        showToast(
          "Mic permission is required to record audio.",
          "error",
          "Permission Denied"
        );
        return;
      }
      await audioRecorder.prepareToRecordAsync();
      audioRecorder.record();
      setRecording(audioRecorder);
      setIsRecording(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch (err) {
      console.error("Failed to start recording", err);
    }
  };

  const stopRecording = async () => {
    if (!recording) return;
    setIsRecording(false);
    setRecording(null);
    try {
      await recording.stop();
      const uri = recording.uri;
      if (uri) {
        const mediaData = await uploadFile(
          uri,
          "voice_message.m4a",
          "audio/m4a",
        );
        if (mediaData) handleSendMedia(mediaData, "voice");
      }
    } catch (error) {
      console.error("Failed to stop recording", error);
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const playSound = async (uri: string, messageId: string) => {
    try {
      setLoadingSoundId(messageId);
      const fullUri = getImageUrl(uri);
      audioPlayer.replace(fullUri);
      audioPlayer.play();
      setSound(audioPlayer);
      setPlayingId(messageId);
      setLoadingSoundId(null);
      // Listen for playback completion
      const subscription = audioPlayer.addListener('playbackStatusUpdate', (status: any) => {
        if (status.didJustFinish) {
          setPlayingId(null);
          subscription?.remove();
        }
      });
    } catch (error) {
      console.error("Error playing sound:", error);
      setLoadingSoundId(null);
      showToast("Could not play audio", "error");
    }
  };

  const openDocument = async (uri: string, fileName: string) => {
    const fullUri = getImageUrl(uri);
    const urlWithToken = `${fullUri}${fullUri.includes("?") ? "&" : "?"}token=${token}`;
    try {
      const supported = await Linking.canOpenURL(urlWithToken);
      if (supported) await Linking.openURL(urlWithToken);
      else
        showToast(
          "Don't know how to open this URL: " + urlWithToken,
          "error"
        );
    } catch (error) {
      console.error("Error opening document:", error);
      showToast("Could not open document", "error");
    }
  };

  const handleSendMessage = useCallback(async () => {
    if (!newMessage.trim() || !token || !id || !user) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const currentReplyTo = replyingTo;
    setReplyingTo(null);

    const tempId = Date.now().toString();
    const optimisticMsg: Message = {
      _id: tempId,
      sender: {
        _id: user._id,
        username: user.username,
        profilePicture: user.profilePicture,
      },
      text: newMessage,
      mediaType: "none",
      replyTo: currentReplyTo || undefined,
      timestamp: new Date().toISOString(),
      status: "sent",
    };

    setMessages((prev) => [optimisticMsg, ...prev]);
    setNewMessage("");
    setTimeout(
      () => flatListRef.current?.scrollToOffset({ offset: 0, animated: true }),
      100,
    );

    try {
      const response = await fetch(`${BASE_URL}/conversations/${id}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ 
          text: optimisticMsg.text,
          replyTo: currentReplyTo?._id 
        }),
      });
      const data = await response.json();
      if (response.ok) {
        setMessages((prev) => prev.map((m) => (m._id === tempId ? data : m)));
      } else {
        setMessages((prev) => prev.filter((m) => m._id !== tempId));
        showToast("Failed to send message", "error");
      }
    } catch (error) {
      console.error("Network error during sending message:", error);
      setMessages((prev) => prev.filter((m) => m._id !== tempId));
    }
  }, [newMessage, token, id, user, replyingTo, BASE_URL]);

  const addReaction = useCallback(
    async (messageId: string, emoji: string) => {
      if (!user) return;

      // Optimistic update
      setMessages((prev) =>
        prev.map((m) => {
          if (m._id === messageId) {
            const existingReactions = m.reactions || [];
            const filtered = existingReactions.filter(
              (r) => r.userId !== user._id,
            );
            return {
              ...m,
              reactions: [...filtered, { emoji, userId: user._id }],
            };
          }
          return m;
        }),
      );

      setShowMenu(false);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      try {
        await fetch(
          `${BASE_URL}/conversations/${id}/messages/${messageId}/reactions`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ emoji }),
          },
        );
      } catch (error) {
        console.error("Error adding reaction:", error);
      }
    },
    [id, token, user, BASE_URL],
  );

  const deleteMsg = useCallback(
    async (messageId: string) => {
      Alert.alert(
        "Delete Message",
        "Are you sure you want to delete this message?",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Delete",
            style: "destructive",
            onPress: async () => {
              try {
                await fetch(
                  `${BASE_URL}/conversations/${id}/messages/${messageId}`,
                  {
                    method: "DELETE",
                    headers: { Authorization: `Bearer ${token}` },
                  },
                );
                setMessages((p) => p.filter((m) => m._id !== messageId));
                setShowMenu(false);
              } catch (e) {
                console.error("Delete error:", e);
              }
            },
          },
        ],
      );
    },
    [id, token, BASE_URL],
  );

  const onLongPress = useCallback((m: Message) => {
    setSelectedMessage(m);
    setShowMenu(true);
  }, []);

  const onMediaPress = useCallback((url: string, type: string) => {
    setLightbox({ url, type });
  }, []);

  const [isAtBottom, setIsAtBottom] = useState(true);

  const handleScroll = (event: any) => {
    const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
    const paddingToBottom = 100;
    const isBottom =
      layoutMeasurement.height + contentOffset.y >=
      contentSize.height - paddingToBottom;
    setIsAtBottom(isBottom);
    // Auto-scroll when user is near bottom and new messages arrive
    if (isBottom) {
      setTimeout(
        () => flatListRef.current?.scrollToOffset({ offset: 0, animated: true }),
        100,
      );
    }
  };

  const renderItem = useCallback(
    ({ item, index }: any) => {
      const isMyMessage = item.sender._id === user?._id || item.sender === user?._id;
      
      let showDateSeparator = false;
      if (index === messages.length - 1) {
        showDateSeparator = true;
      } else if (messages[index + 1]) {
        const nextMessage = messages[index + 1];
        const nextDate = new Date(nextMessage.timestamp).toDateString();
        const currDate = new Date(item.timestamp).toDateString();
        if (nextDate !== currDate) showDateSeparator = true;
      }

      return (
        <MessageItem
          item={item}
          isMyMessage={isMyMessage}
          showDateSeparator={showDateSeparator}
          colors={colors}
          colorScheme={colorScheme}
          formatDateSeparator={formatDateSeparator}
          setPeekCode={setPeekCode}
          StatusIcon={StatusIcon}
          token={token}
          playSound={playSound}
          playingId={playingId}
          loadingSoundId={loadingSoundId}
          openDocument={openDocument}
          onLongPress={onLongPress}
          onMediaPress={onMediaPress}
          onSwipeReply={(m: any) => {
            setReplyingTo(m);
          }}
        />
      );
    },
    [
      messages,
      user?._id,
      colors,
      colorScheme,
      StatusIcon,
      formatDateSeparator,
      token,
      playingId,
      loadingSoundId,
      onLongPress,
      onMediaPress,
    ],
  );

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colorScheme === 'dark' ? '#0B141A' : '#EFE7DE' }}
      behavior="padding"
      keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 100}
    >
      <View style={{ flex: 1 }}>
        <FlatList
          ref={flatListRef}
          data={messages}
          inverted
          keyExtractor={(item) => item._id}
          initialNumToRender={20}
          maxToRenderPerBatch={20}
          windowSize={21}
          ListFooterComponent={
            loadingMore ? (
              <ActivityIndicator
                size="small"
                color={colors.tint}
                style={{ marginVertical: 10 }}
              />
            ) : null
          }
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          renderItem={renderItem}
          contentContainerStyle={styles.messagesList}
          onScroll={handleScroll}
          scrollEventThrottle={16}
        />

        {peekCode && (
          <Modal
            visible={!!peekCode}
            transparent
            animationType="fade"
            onRequestClose={() => setPeekCode(null)}
          >
            <Pressable
              style={styles.modalOverlay}
              onPress={() => setPeekCode(null)}
            >
              <View
                style={[
                  styles.peekCard,
                  {
                    backgroundColor: colors.background,
                    borderTopColor: peekCode?.color,
                  },
                ]}
              >
                <View
                  style={[
                    styles.peekColorCircle,
                    { backgroundColor: peekCode?.color },
                  ]}
                />
                <ThemedText style={styles.peekName}>
                  {peekCode?.name}
                </ThemedText>
                <ThemedText style={styles.peekMeaning}>
                  {peekCode?.meaning}
                </ThemedText>
                <StyledButton title="Close" onPress={() => setPeekCode(null)} />
              </View>
            </Pressable>
          </Modal>
        )}

        <Modal visible={showMenu} transparent animationType="fade">
          <Pressable
            style={styles.modalOverlay}
            onPress={() => setShowMenu(false)}
          >
            <View
              style={[
                styles.menuContainer,
                {
                  backgroundColor: colors.background,
                  shadowColor: colors.text,
                },
              ]}
            >
              <View style={styles.reactionGrid}>
                {["❤️", "👍", "😂", "😮", "😢", "🔥", "👏", "🎉", "😍", "💯", "🤔", "😎"].map((emoji) => (
                  <TouchableOpacity
                    key={emoji}
                    onPress={() => addReaction(selectedMessage!._id, emoji)}
                    style={styles.emojiBtn}
                  >
                    <ThemedText style={{ fontSize: 28 }}>{emoji}</ThemedText>
                  </TouchableOpacity>
                ))}
              </View>
              {/* Custom emoji input from keyboard */}
              <View style={[styles.customEmojiRow, { borderTopColor: colors.icon + '20' }]}>
                <TextInput
                  style={[styles.customEmojiInput, { color: colors.text, backgroundColor: colors.icon + '12', borderColor: colors.icon + '30' }]}
                  placeholder="Type any emoji..."
                  placeholderTextColor={colors.icon}
                  value={customEmojiInput}
                  onChangeText={setCustomEmojiInput}
                  maxLength={8}
                />
                <TouchableOpacity
                  style={[styles.customEmojiSend, { backgroundColor: customEmojiInput.trim() ? colors.tint : colors.icon + '30' }]}
                  onPress={() => {
                    if (customEmojiInput.trim() && selectedMessage) {
                      addReaction(selectedMessage._id, customEmojiInput.trim());
                      setCustomEmojiInput('');
                    }
                  }}
                  disabled={!customEmojiInput.trim()}
                >
                  <ThemedText style={{ fontSize: 18 }}>➤</ThemedText>
                </TouchableOpacity>
              </View>
              <TouchableOpacity
                onPress={() => {
                  if (selectedMessage) {
                    setReplyingTo(selectedMessage);
                    setShowMenu(false);
                  }
                }}
                style={styles.menuActionBtn}
              >
                <Ionicons name="arrow-undo-outline" size={22} color={colors.tint} />
                <ThemedText
                  style={{
                    color: colors.text,
                    marginLeft: 10,
                    fontWeight: "600",
                  }}
                >
                  Reply
                </ThemedText>
              </TouchableOpacity>
              {selectedMessage?.sender._id === user?._id && (
                <TouchableOpacity
                  onPress={() => deleteMsg(selectedMessage!._id)}
                  style={styles.menuActionBtn}
                >
                  <Ionicons name="trash-outline" size={22} color="#ff3b30" />
                  <ThemedText
                    style={{
                      color: "#ff3b30",
                      marginLeft: 10,
                      fontWeight: "600",
                    }}
                  >
                    Delete Message
                  </ThemedText>
                </TouchableOpacity>
              )}
            </View>
          </Pressable>
        </Modal>

        <Modal
          visible={!!lightbox}
          transparent
          onRequestClose={() => setLightbox(null)}
          animationType="fade"
          statusBarTranslucent
        >
          <View style={styles.lightboxContainer}>
            <TouchableOpacity
              style={styles.closeBtn}
              onPress={() => setLightbox(null)}
            >
              <Ionicons name="close-circle" size={40} color="#fff" />
            </TouchableOpacity>
            {lightbox?.type === "video" ? (
              <VideoLightbox url={lightbox.url} token={token} />
            ) : (
              <ExpoImage
                source={{ uri: lightbox?.url }}
                style={styles.fullMedia}
                contentFit="contain"
              />
            )}
          </View>
        </Modal>

        <SafeAreaView
          edges={["bottom"]}
          style={{ backgroundColor: colors.background }}
        >
          {typingUser && (
            <ThemedText
              style={[styles.typingIndicator, { color: colors.icon }]}
            >
              {typingUser} is typing...
            </ThemedText>
          )}

          {replyingTo && (
            <View style={[styles.replyPreviewContainer, { backgroundColor: colorScheme === 'dark' ? '#1F2C34' : '#F0F2F5', borderLeftColor: colors.tint }]}>
              <View style={{ flex: 1 }}>
                <ThemedText style={[styles.replyPreviewAuthor, { color: colors.tint }]}>
                  Replying to {replyingTo.sender?.username || 'User'}
                </ThemedText>
                <ThemedText style={[styles.replyPreviewText, { color: colors.text }]} numberOfLines={1}>
                  {replyingTo.codeId ? `🎨 Code: ${replyingTo.codeId.name}` :
                   replyingTo.mediaType === 'image' ? '📷 Photo' :
                   replyingTo.mediaType === 'video' ? '🎥 Video' :
                   replyingTo.mediaType === 'voice' || replyingTo.mediaType === 'audio' ? '🎤 Voice Note' :
                   replyingTo.mediaType === 'document' ? `📄 ${replyingTo.fileName || 'Document'}` :
                   replyingTo.text || 'Message'}
                </ThemedText>
              </View>
              <TouchableOpacity onPress={() => setReplyingTo(null)} style={styles.replyCloseButton}>
                <Ionicons name="close-circle" size={22} color={colors.icon} />
              </TouchableOpacity>
            </View>
          )}
          <View
            style={[
              styles.inputContainer,
              {
                borderTopColor: colors.icon,
                borderTopWidth: StyleSheet.hairlineWidth,
              },
            ]}
          >
            <TouchableOpacity
              onPress={() => setShowAttachMenu(true)}
              style={styles.attachButton}
            >
              <Ionicons name="add" size={28} color={colors.tint} />
            </TouchableOpacity>

            {isRecording ? (
              <View style={styles.recordingContainer}>
                <View style={styles.recordingDot} />
                <ThemedText style={styles.recordingText}>
                  Recording...
                </ThemedText>
                <TouchableOpacity
                  onPress={stopRecording}
                  style={styles.stopRecordingButton}
                >
                  <ThemedText style={{ color: "#ff3b30", fontWeight: "bold" }}>
                    Stop & Send
                  </ThemedText>
                </TouchableOpacity>
              </View>
            ) : (
              <TextInput
                style={[
                  styles.input,
                  {
                    borderColor: colors.icon,
                    backgroundColor: colors.background,
                    color: colors.text,
                  },
                ]}
                value={newMessage}
                onChangeText={(text) => {
                  setNewMessage(text);
                  handleTyping();
                }}
                placeholder="Type a message..."
                placeholderTextColor={colors.icon}
                multiline
              />
            )}

            {uploading ? (
              <ActivityIndicator
                size="small"
                color={colors.tint}
                style={{ marginHorizontal: 10 }}
              />
            ) : isRecording ? null : newMessage.trim() ? (
              <StyledButton
                title="Send"
                onPress={handleSendMessage}
                style={styles.sendButton}
              />
            ) : (
              <TouchableOpacity
                onPress={startRecording}
                style={styles.micButton}
              >
                <Ionicons name="mic" size={28} color={colors.tint} />
              </TouchableOpacity>
            )}
          </View>
        </SafeAreaView>

        {showAttachMenu && (
          <Modal
            visible={showAttachMenu}
            transparent
            animationType="slide"
            onRequestClose={() => setShowAttachMenu(false)}
          >
            <Pressable
              style={styles.modalOverlay}
              onPress={() => setShowAttachMenu(false)}
            >
              <View
                style={[
                  styles.attachMenu,
                  { backgroundColor: colors.background },
                ]}
              >
                <TouchableOpacity
                  style={styles.attachOption}
                  onPress={pickImage}
                >
                  <View
                    style={[
                      styles.attachIconContainer,
                      { backgroundColor: "#4a90e2" },
                    ]}
                  >
                    <Ionicons name="image" size={24} color="#fff" />
                  </View>
                  <ThemedText style={styles.attachText}>
                    Photos & Videos
                  </ThemedText>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.attachOption}
                  onPress={pickDocument}
                >
                  <View
                    style={[
                      styles.attachIconContainer,
                      { backgroundColor: "#5c5c5c" },
                    ]}
                  >
                    <Ionicons name="document" size={24} color="#fff" />
                  </View>
                  <ThemedText style={styles.attachText}>Document</ThemedText>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.attachOption}
                  onPress={() => {
                    setShowAttachMenu(false);
                    startRecording();
                  }}
                >
                  <View
                    style={[
                      styles.attachIconContainer,
                      { backgroundColor: "#f5a623" },
                    ]}
                  >
                    <Ionicons name="mic" size={24} color="#fff" />
                  </View>
                  <ThemedText style={styles.attachText}>
                    Audio Message
                  </ThemedText>
                </TouchableOpacity>
              </View>
            </Pressable>
          </Modal>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  headerTitleContainer: { flexDirection: "row", alignItems: "center" },
  headerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 10,
    backgroundColor: "#eee",
  },
  headerUsername: { fontSize: 18, fontWeight: "bold" },
  messagesList: { padding: 10, paddingBottom: 20 },
  messageWrapper: {
    flexDirection: "row",
    alignItems: "flex-end",
    marginBottom: 5,
  },
  myMessageWrapper: { justifyContent: "flex-end" },
  theirMessageWrapper: { justifyContent: "flex-start" },
  messageAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    marginRight: 8,
    marginBottom: 2,
    backgroundColor: "#eee",
  },
  dateSeparator: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 15,
  },
  dateLine: { flex: 1, height: 1, opacity: 0.2 },
  dateText: {
    fontSize: 12,
    fontWeight: "bold",
    paddingHorizontal: 10,
    textTransform: "uppercase",
  },
  typingIndicator: {
    paddingHorizontal: 15,
    paddingVertical: 5,
    fontSize: 12,
    fontStyle: "italic",
  },
  messageContainer: {
    padding: 10,
    borderRadius: 18,
    marginBottom: 5,
    maxWidth: "85%",
  },
  myMessage: { alignSelf: "flex-end", borderBottomRightRadius: 4 },
  theirMessage: { alignSelf: "flex-start", borderBottomLeftRadius: 4 },
  messageText: { fontSize: 16, lineHeight: 22 },
  messageImage: { width: "100%", aspectRatio: 1, borderRadius: 10 },
  playOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.3)",
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 10,
  },
  stickerContainer: { padding: 5, backgroundColor: "transparent" },
  stickerImage: { width: 120, height: 120 },
  mediaTimestamp: {
    position: "absolute",
    bottom: 5,
    right: 10,
    backgroundColor: "rgba(0,0,0,0.3)",
    paddingHorizontal: 5,
    borderRadius: 10,
  },
  documentContainer: { flexDirection: "row", alignItems: "center", padding: 5 },
  documentInfo: { flex: 1, marginLeft: 10 },
  documentName: { fontSize: 14, fontWeight: "bold" },
  documentSize: { fontSize: 12 },
  richMessageCard: { flexDirection: "row", minHeight: 80 },
  colorSideBar: { width: 12, height: "100%" },
  richContent: { flex: 1, padding: 15, justifyContent: "center" },
  codeNameLabel: {
    fontSize: 14,
    fontWeight: "bold",
    textTransform: "uppercase",
    marginBottom: 4,
    letterSpacing: 1,
  },
  codeMeaningText: { fontSize: 16, lineHeight: 22, marginBottom: 8 },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
  },
  peekCard: {
    width: "100%",
    padding: 25,
    borderRadius: 20,
    alignItems: "center",
    borderTopWidth: 8,
  },
  peekColorCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginBottom: 15,
  },
  peekName: { fontSize: 22, fontWeight: "bold", marginBottom: 10 },
  peekMeaning: {
    fontSize: 18,
    textAlign: "center",
    marginBottom: 25,
    lineHeight: 26,
  },
  timestampRow: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-end",
    marginTop: 4,
  },
  timestamp: { fontSize: 10, opacity: 0.8 },
  inputContainer: {
    flexDirection: "row",
    padding: 10,
    borderTopWidth: 1,
    alignItems: "flex-end",
    backgroundColor: "transparent",
    paddingBottom: Platform.OS === "ios" ? 0 : 10,
  },
  attachButton: { padding: 5, marginRight: 5 },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 100,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingTop: 10,
    paddingBottom: 10,
    marginRight: 10,
  },
  sendButton: { height: 40, justifyContent: "center", paddingVertical: 0 },
  attachMenu: {
    width: "100%",
    padding: 20,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    position: "absolute",
    bottom: 0,
  },
  attachOption: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 15,
  },
  attachIconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 15,
  },
  attachText: { fontSize: 16, fontWeight: "600" },
  voiceContainer: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    minWidth: 150,
  },
  recordingContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,59,48,0.1)",
    borderRadius: 20,
    paddingHorizontal: 15,
    height: 40,
    marginRight: 10,
  },
  recordingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#ff3b30",
    marginRight: 10,
  },
  recordingText: {
    flex: 1,
    color: "#ff3b30",
    fontWeight: "bold",
    fontSize: 14,
  },
  stopRecordingButton: { paddingVertical: 5, paddingHorizontal: 10 },
  micButton: { padding: 5, marginHorizontal: 5 },
  reactionsRow: {
    flexDirection: "row",
    marginTop: -8,
    marginBottom: 8,
    zIndex: 10,
  },
  myReactions: { alignSelf: "flex-end", marginRight: 10 },
  theirReactions: { alignSelf: "flex-start", marginLeft: 40 },
  bubbleContainer: { position: "relative", flexShrink: 1 },
  reactionsBadgeContainer: {
    position: "absolute",
    bottom: -10,
    flexDirection: "row",
    zIndex: 10,
    elevation: 4,
  },
  reactionBadge: {
    backgroundColor: "#fff",
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginRight: 6,
    borderWidth: 1,
    borderColor: "#eee",
    elevation: 4,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    zIndex: 1,
  },
  menuContainer: {
    width: "85%",
    padding: 15,
    borderRadius: 25,
    elevation: 12,
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    zIndex: 1000,
  },
  reactionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-around",
    marginBottom: 15,
    gap: 8,
  },
  emojiBtn: {
    width: 58,
    height: 58,
    borderRadius: 16,
    backgroundColor: "rgba(128,128,128,0.1)",
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 6,
    marginHorizontal: 4,
  },
  menuActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 15,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(0,0,0,0.1)",
  },
  // ── Reply styles ──
  replyPreviewContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderLeftWidth: 4,
    marginHorizontal: 8,
    marginBottom: 4,
    borderRadius: 10,
    gap: 10,
  },
  replyPreviewAuthor: {
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 3,
  },
  replyPreviewText: {
    fontSize: 13,
    opacity: 0.8,
  },
  replyCloseButton: {
    padding: 4,
  },
  // Quoted box inside a message bubble
  quotedBox: {
    borderLeftWidth: 3,
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    marginBottom: 8,
  },
  quotedAuthor: {
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 2,
  },
  quotedText: {
    fontSize: 13,
    opacity: 0.85,
  },
  // Swipe-to-reply
  swipeRow: {
    position: "relative",
  },
  replyArrow: {
    position: "absolute",
    top: 0,
    bottom: 0,
    justifyContent: "center",
    zIndex: -1,
  },
  replyArrowCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  lightboxContainer: {
    flex: 1,
    backgroundColor: "#000",
    justifyContent: "center",
    alignItems: "center",
  },
  closeBtn: { position: "absolute", top: 50, right: 20, zIndex: 10 },
  fullMedia: { width: "100%", height: "100%" },
  customEmojiRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    marginTop: 4,
    marginBottom: 8,
  },
  customEmojiInput: {
    flex: 1,
    height: 52,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 18,
    fontSize: 22,
  },
  customEmojiSend: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: "center",
    alignItems: "center",
  },
});
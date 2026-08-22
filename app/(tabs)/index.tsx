import { ThemedText } from '@/components/themed-text';
import { getBaseUrl, getImageUrl } from '@/constants/api';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image as ExpoImage } from 'expo-image';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Animated,
    FlatList,
    Modal,
    RefreshControl,
    ScrollView,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const BASE_URL = getBaseUrl();

interface User {
  _id: string;
  username: string;
  profilePicture?: string;
}

/** Deterministic pastel color derived from a username string */
function usernameToColor(username: string): string {
  const palette = [
    '#FF6B9D', '#FF8C42', '#FFD166', '#06D6A0', '#118AB2',
    '#8338EC', '#FF4D6D', '#3A86FF', '#FB5607', '#8AC926',
    '#6A4C93', '#1982C4', '#FF595E', '#FFCA3A', '#6A994E',
  ];
  let hash = 0;
  for (let i = 0; i < username.length; i++) {
    hash = username.charCodeAt(i) + ((hash << 5) - hash);
  }
  return palette[Math.abs(hash) % palette.length];
}

/** Sanitize search input: trim, max 30 chars, allow only safe characters */
function sanitizeSearch(input: string): string {
  return input.replace(/[<>"'&]/g, '').slice(0, 30);
}

/** Returns initials from a username (up to 2 chars) */
function getInitials(username: string): string {
  return username.slice(0, 2).toUpperCase();
}

/** Greeting based on time of day */
function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

// ---------- Sub-components ----------

const AvatarBubble = ({
  username,
  profilePicture,
  size = 52,
  style,
}: {
  username: string;
  profilePicture?: string;
  size?: number;
  style?: any;
}) => {
  const color = usernameToColor(username);
  return (
    <View
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
          alignItems: 'center',
          justifyContent: 'center',
        },
        style,
      ]}
    >
      {profilePicture ? (
        <ExpoImage
          source={{ uri: getImageUrl(profilePicture) }}
          style={{ width: size, height: size, borderRadius: size / 2 }}
          contentFit="cover"
        />
      ) : (
        <ThemedText
          style={{ color: '#fff', fontWeight: '800', fontSize: size * 0.34 }}
        >
          {getInitials(username)}
        </ThemedText>
      )}
    </View>
  );
};

/** Unique "Prism Card" for a friend — 2-column mosaic grid */
const FriendPrismCard = ({
  friend,
  onPress,
  colors,
  colorScheme,
  index,
}: {
  friend: User;
  onPress: () => void;
  colors: any;
  colorScheme: string | null | undefined;
  index: number;
}) => {
  const accentColor = usernameToColor(friend.username);
  const scale = useRef(new Animated.Value(1)).current;

  const onPressIn = () =>
    Animated.spring(scale, { toValue: 0.95, useNativeDriver: true }).start();
  const onPressOut = () =>
    Animated.spring(scale, { toValue: 1, useNativeDriver: true }).start();

  // Alternate card height slightly for organic mosaic feel
  const extraHeight = index % 3 === 0 ? 12 : 0;

  return (
    <Animated.View style={{ transform: [{ scale }], flex: 1, margin: 5 }}>
      <TouchableOpacity
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        activeOpacity={1}
        style={[
          styles.friendCard,
          {
            backgroundColor: colorScheme === 'dark' ? '#1E1E2E' : '#FFFFFF',
            borderColor: accentColor + '40',
            minHeight: 130 + extraHeight,
          },
        ]}
      >
        {/* Top accent gradient strip */}
        <View style={[styles.cardTopStrip, { backgroundColor: accentColor }]} />

        {/* Avatar */}
        <View style={styles.cardAvatarContainer}>
          <AvatarBubble username={friend.username} profilePicture={friend.profilePicture} size={50} />
          {/* Pulsing online dot placeholder */}
          <View
            style={[styles.onlineDot, { borderColor: colorScheme === 'dark' ? '#1E1E2E' : '#fff' }]}
          />
        </View>

        {/* Username */}
        <ThemedText style={[styles.friendCardName, { color: colors.text }]} numberOfLines={1}>
          {friend.username}
        </ThemedText>

        {/* Chat CTA */}
        <TouchableOpacity
          style={[styles.chatCTA, { backgroundColor: accentColor + '22', borderColor: accentColor + '55' }]}
          onPress={onPress}
        >
          <Ionicons name="chatbubble-ellipses-outline" size={13} color={accentColor} />
          <ThemedText style={[styles.chatCTAText, { color: accentColor }]}>Chat</ThemedText>
        </TouchableOpacity>
      </TouchableOpacity>
    </Animated.View>
  );
};

/** Search result row */
const SearchResultRow = ({
  item,
  isSelf,
  onAddFriend,
  colors,
  colorScheme,
}: {
  item: User;
  isSelf: boolean;
  onAddFriend: () => void;
  colors: any;
  colorScheme: string | null | undefined;
}) => {
  const accentColor = usernameToColor(item.username);
  return (
    <View
      style={[
        styles.searchRow,
        {
          backgroundColor: colorScheme === 'dark' ? '#1E1E2E' : '#FFFFFF',
          borderLeftColor: accentColor,
        },
      ]}
    >
      <AvatarBubble username={item.username} profilePicture={item.profilePicture} size={40} />
      <View style={styles.searchRowInfo}>
        <ThemedText style={[styles.searchRowName, { color: colors.text }]}>
          {item.username}
        </ThemedText>
      </View>
      {!isSelf && (
        <TouchableOpacity
          style={[styles.addBtn, { backgroundColor: accentColor }]}
          onPress={onAddFriend}
        >
          <Ionicons name="person-add-outline" size={14} color="#fff" />
          <ThemedText style={styles.addBtnText}>Add</ThemedText>
        </TouchableOpacity>
      )}
      {isSelf && (
        <View style={[styles.youBadge, { backgroundColor: accentColor + '22' }]}>
          <ThemedText style={[styles.youBadgeText, { color: accentColor }]}>You</ThemedText>
        </View>
      )}
    </View>
  );
};

// ---------- Main Screen ----------

export default function HomeScreen() {
  const { token, user } = useAuth();
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [friends, setFriends] = useState<User[]>([]);
  const [isFetchingFriends, setIsFetchingFriends] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const headerAnim = useRef(new Animated.Value(0)).current;
  const { showToast } = useToast();

  const [whatsNewVisible, setWhatsNewVisible] = useState(false);

  const versionNoticeKey = 'chromacode_seen_v2_71';

  const handleDismissWhatsNew = async () => {
    setWhatsNewVisible(false);
    try {
      await AsyncStorage.setItem(versionNoticeKey, 'true');
    } catch (e) {
      console.error('Failed to save version notice key', e);
    }
  };

  // Animate header in on mount
  useEffect(() => {
    Animated.spring(headerAnim, {
      toValue: 1,
      delay: 100,
      useNativeDriver: true,
    }).start();
  }, []);

  // Live-search with 300ms debounce
  const handleSearchChange = useCallback(
    (text: string) => {
      const safe = sanitizeSearch(text);
      setSearchTerm(safe);
      if (searchDebounce.current) clearTimeout(searchDebounce.current);
      if (!safe.trim()) {
        setSearchResults([]);
        return;
      }
      searchDebounce.current = setTimeout(async () => {
        setIsSearching(true);
        try {
          const response = await fetch(
            `${BASE_URL}/users/search?username=${encodeURIComponent(safe.trim())}`,
            { headers: { Authorization: `Bearer ${token}` } },
          );
          const data = await response.json();
          if (response.ok) {
            setSearchResults(Array.isArray(data) ? data : []);
          } else {
            showToast(data.message || 'Failed to search.', 'error', 'Search Error');
          }
        } catch {
          showToast('Network error during search.', 'error');
        } finally {
          setIsSearching(false);
        }
      }, 300);
    },
    [token],
  );

  const handleAddFriend = async (friendId: string, friendUsername: string) => {
    try {
      const response = await fetch(`${BASE_URL}/users/friend-request`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ friendId }),
      });
      const data = await response.json();
      if (response.ok) {
        showToast(`Friend request sent to ${friendUsername}!`, 'success', '✅ Request Sent');
      } else {
        showToast(data.message || 'Failed to send request.', 'error');
      }
    } catch {
      showToast('Network error while sending friend request.', 'error');
    }
  };

  const handleStartChat = async (friendId: string, friendUsername: string) => {
    if (!token || !user) return;
    try {
      const response = await fetch(`${BASE_URL}/conversations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        // No text: the backend will open the existing conversation or create one
        body: JSON.stringify({ recipientId: friendId }),
      });
      const data = await response.json();
      if ((response.ok || response.status === 200) && data.conversation?._id) {
        router.push(`/chat/${data.conversation._id}` as any);
      } else {
        showToast(data.message || `Failed to start chat with ${friendUsername}.`, 'error');
      }
    } catch {
      showToast('Network error while starting chat.', 'error');
    }
  };

  const fetchFriends = useCallback(async () => {
    if (!token) return;
    setIsFetchingFriends(true);
    try {
      const response = await fetch(`${BASE_URL}/users/friends`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (response.ok) {
        setFriends(Array.isArray(data) ? data : []);
      } else {
        showToast(data.message || 'Failed to fetch friends.', 'error');
      }
    } catch {
      showToast('Network error while fetching friends.', 'error');
    } finally {
      setIsFetchingFriends(false);
    }
  }, [token]);

  useEffect(() => {
    fetchFriends();
  }, [fetchFriends]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchFriends();
    setRefreshing(false);
  }, [fetchFriends]);

  const isDark = colorScheme === 'dark';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.tint} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header greeting ── */}
        <Animated.View
          style={[
            styles.header,
            {
              backgroundColor: isDark ? '#0F0F1A' : '#F7F8FF',
              opacity: headerAnim,
              transform: [{ translateY: headerAnim.interpolate({ inputRange: [0, 1], outputRange: [-20, 0] }) }],
            },
          ]}
        >
          <View>
            <ThemedText style={[styles.greetingSmall, { color: colors.icon }]}>
              {getGreeting()},
            </ThemedText>
            <ThemedText style={[styles.greetingName, { color: colors.text }]}>
              {user?.username ?? 'there'} 👋
            </ThemedText>
          </View>
          <View style={[styles.headerBadge, { backgroundColor: colors.tint + '22' }]}>
            <Ionicons name="sparkles-outline" size={18} color={colors.tint} />
          </View>
        </Animated.View>

        {/* ── Find Friends Search ── */}
        <View style={styles.section}>
          <ThemedText style={[styles.sectionTitle, { color: colors.text }]}>
            🔍 Find Friends
          </ThemedText>
          <View
            style={[
              styles.searchBar,
              {
                backgroundColor: isDark ? '#1E1E2E' : '#FFFFFF',
                borderColor: searchTerm ? colors.tint : (isDark ? '#333' : '#E0E0E8'),
              },
            ]}
          >
            <Ionicons
              name="search"
              size={18}
              color={searchTerm ? colors.tint : colors.icon}
              style={{ marginRight: 8 }}
            />
            <TextInput
              style={[styles.searchInput, { color: colors.text, flex: 1 }]}
              placeholder="Search users..."
              placeholderTextColor={colors.icon}
              value={searchTerm}
              onChangeText={handleSearchChange}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
            />
            {isSearching && <ActivityIndicator size="small" color={colors.tint} />}
            {searchTerm.length > 0 && !isSearching && (
              <TouchableOpacity
                onPress={() => {
                  setSearchTerm('');
                  setSearchResults([]);
                }}
              >
                <Ionicons name="close-circle" size={18} color={colors.icon} />
              </TouchableOpacity>
            )}
          </View>

          {/* Search Results */}
          {searchResults.length > 0 && (
            <View style={[styles.resultsContainer, { borderColor: isDark ? '#333' : '#E0E0E8' }]}>
              {searchResults.map((item) => (
                <SearchResultRow
                  key={item._id}
                  item={item}
                  isSelf={item._id === user?._id}
                  onAddFriend={() => handleAddFriend(item._id, item.username)}
                  colors={colors}
                  colorScheme={colorScheme}
                />
              ))}
            </View>
          )}

          {searchTerm.length > 0 && !isSearching && searchResults.length === 0 && (
            <View style={styles.emptySearch}>
              <Ionicons name="person-outline" size={32} color={colors.icon} />
              <ThemedText style={[styles.emptyText, { color: colors.icon }]}>
                No users found for "{searchTerm}"
              </ThemedText>
            </View>
          )}
        </View>

        {/* ── Friends Prism Grid ── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <ThemedText style={[styles.sectionTitle, { color: colors.text }]}>
              ✨ Your Friends
            </ThemedText>
            <ThemedText style={[styles.friendCount, { color: colors.tint }]}>
              {friends.length > 0 ? `${friends.length} friend${friends.length !== 1 ? 's' : ''}` : ''}
            </ThemedText>
          </View>

          {isFetchingFriends ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.tint} />
              <ThemedText style={[styles.emptyText, { color: colors.icon, marginTop: 10 }]}>
                Loading your friends...
              </ThemedText>
            </View>
          ) : friends.length > 0 ? (
            /* 2-column mosaic grid via FlatList numColumns */
            <FlatList
              data={friends}
              keyExtractor={(item) => item._id}
              numColumns={2}
              scrollEnabled={false}
              renderItem={({ item, index }) => (
                <FriendPrismCard
                  friend={item}
                  onPress={() => handleStartChat(item._id, item.username)}
                  colors={colors}
                  colorScheme={colorScheme}
                  index={index}
                />
              )}
              contentContainerStyle={{ paddingBottom: 4 }}
            />
          ) : (
            <View style={[styles.emptyFriends, { backgroundColor: isDark ? '#1E1E2E' : '#F7F8FF' }]}>
              <ThemedText style={{ fontSize: 48, marginBottom: 10 }}>🌌</ThemedText>
              <ThemedText style={[styles.emptyTitle, { color: colors.text }]}>
                Your galaxy is empty
              </ThemedText>
              <ThemedText style={[styles.emptyText, { color: colors.icon }]}>
                Search for friends above and start connecting!
              </ThemedText>
            </View>
          )}
        </View>

        {/* ── App blurb ── */}
        <View style={[styles.blurb, { backgroundColor: isDark ? '#1E1E2E' : '#F0F2FF' }]}>
          <ThemedText style={[styles.blurbTitle, { color: colors.text }]}>
            Your secret language, simplified.
          </ThemedText>
          <ThemedText style={[styles.blurbBody, { color: colors.icon }]}>
            Go to the{' '}
            <ThemedText style={{ fontWeight: 'bold', color: colors.tint }}>Chroma</ThemedText>
            {' '}tab to send a code, check{' '}
            <ThemedText style={{ fontWeight: 'bold', color: colors.tint }}>History</ThemedText>
            {' '}for past communications, and customise in{' '}
            <ThemedText style={{ fontWeight: 'bold', color: colors.tint }}>Settings</ThemedText>.
          </ThemedText>
        </View>

        {/* ── What's New Update Modal ── */}
        <Modal
          visible={whatsNewVisible}
          transparent
          animationType="fade"
          onRequestClose={handleDismissWhatsNew}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalCard, { backgroundColor: isDark ? '#1C1C28' : '#FFFFFF' }]}>
              <View style={[styles.modalHeaderIcon, { backgroundColor: colors.tint + '18' }]}>
                <Ionicons name="sparkles" size={28} color={colors.tint} />
              </View>
              <ThemedText style={[styles.modalTitle, { color: colors.text }]}>
                What's New in v2.71
              </ThemedText>
              <ThemedText style={[styles.modalSub, { color: colors.icon }]}>
                Security, media and reliability updates:
              </ThemedText>

              <View style={styles.modalList}>
                <ThemedText style={[styles.modalBullet, { color: colors.text }]}>
                  <ThemedText style={{ fontWeight: 'bold' }}>Encrypted messaging</ThemedText> — end-to-end before storage.
                </ThemedText>
                <ThemedText style={[styles.modalBullet, { color: colors.text }]}>
                  <ThemedText style={{ fontWeight: 'bold' }}>Media uploads</ThemedText> — images, video, audio and documents via Cloudinary.
                </ThemedText>
                <ThemedText style={[styles.modalBullet, { color: colors.text }]}>
                  <ThemedText style={{ fontWeight: 'bold' }}>Profile banner</ThemedText> — upload a custom banner on your profile.
                </ThemedText>
                <ThemedText style={[styles.modalBullet, { color: colors.text }]}>
                  <ThemedText style={{ fontWeight: 'bold' }}>Multi-device</ThemedText> — sign in on multiple devices at once.
                </ThemedText>
                <ThemedText style={[styles.modalBullet, { color: colors.text }]}>
                  <ThemedText style={{ fontWeight: 'bold' }}>Socket hardening</ThemedText> — authenticated rooms and CORS lock-down.
                </ThemedText>
              </View>

              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: colors.tint }]}
                onPress={handleDismissWhatsNew}
              >
                <ThemedText style={styles.modalBtnText}>Got It!</ThemedText>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalSecondaryBtn}
                onPress={() => {
                  handleDismissWhatsNew();
                  router.push('/privacy-policy' as any);
                }}
              >
                <ThemedText style={[styles.modalSecondaryText, { color: colors.tint }]}>
                  View Privacy Policy & Changelog
                </ThemedText>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingBottom: 40,
  },
  // ── Header ──
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 18,
    marginBottom: 4,
  },
  greetingSmall: {
    fontSize: 14,
    fontWeight: '500',
    opacity: 0.7,
  },
  greetingName: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  headerBadge: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // ── Sections ──
  section: {
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
    letterSpacing: -0.2,
  },
  friendCount: {
    fontSize: 13,
    fontWeight: '600',
  },
  // ── Search ──
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1.5,
    paddingHorizontal: 16,
    paddingVertical: 6,
    marginBottom: 14,
    minHeight: 52,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    height: 44,
    paddingVertical: 8,
  },
  resultsContainer: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 8,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderLeftWidth: 4,
    gap: 12,
  },
  searchRowInfo: {
    flex: 1,
  },
  searchRowName: {
    fontSize: 15,
    fontWeight: '600',
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
  },
  addBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
  },
  youBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  youBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  emptySearch: {
    alignItems: 'center',
    paddingVertical: 24,
    gap: 8,
  },
  // ── Friend Cards (Prism Grid) ──
  friendCard: {
    borderRadius: 18,
    borderWidth: 1.5,
    overflow: 'hidden',
    alignItems: 'center',
    paddingBottom: 12,
  },
  cardTopStrip: {
    width: '100%',
    height: 5,
    marginBottom: 16,
  },
  cardAvatarContainer: {
    position: 'relative',
    marginBottom: 8,
  },
  onlineDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 13,
    height: 13,
    borderRadius: 6.5,
    backgroundColor: '#4CD964',
    borderWidth: 2,
  },
  friendCardName: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 10,
    paddingHorizontal: 8,
    textAlign: 'center',
  },
  chatCTA: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  chatCTAText: {
    fontSize: 12,
    fontWeight: '700',
  },
  // ── Empty / Loading ──
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyFriends: {
    borderRadius: 20,
    padding: 32,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 6,
  },
  emptyText: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
  },
  // ── App Blurb ──
  blurb: {
    marginHorizontal: 16,
    borderRadius: 18,
    padding: 20,
  },
  blurbTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 8,
  },
  blurbBody: {
    fontSize: 13,
    lineHeight: 21,
  },
  // ── Modal ──
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
  },
  modalHeaderIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 6,
    textAlign: 'center',
  },
  modalSub: {
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 18,
  },
  modalList: {
    width: '100%',
    gap: 10,
    marginBottom: 22,
  },
  modalBullet: {
    fontSize: 13,
    lineHeight: 20,
  },
  modalBtn: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    marginBottom: 10,
  },
  modalBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  modalSecondaryBtn: {
    paddingVertical: 8,
  },
  modalSecondaryText: {
    fontSize: 13,
    fontWeight: '600',
  },
});

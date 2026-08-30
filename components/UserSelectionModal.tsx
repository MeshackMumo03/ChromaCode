import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { getBaseUrl, getGroupImageUrl, getImageUrl } from '@/constants/api';
import { Code } from '@/constants/codes';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { Ionicons } from '@expo/vector-icons';
import { Image as ExpoImage } from 'expo-image';
import { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Animated,
    Easing,
    FlatList,
    Modal,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';

const BASE_URL = getBaseUrl();

interface Friend {
  _id: string;
  username: string;
  profilePicture?: string;
}

interface GroupConversation {
  _id: string;
  name: string;
  groupImage?: string;
  participants: any[];
}

export type SelectionType = 'user' | 'group';

interface UserSelectionModalProps {
  modalVisible: boolean;
  onClose: () => void;
  onUserSelect: (id: string, type: SelectionType) => void;
  code: Code | null;
}

// Generate a consistent color from a string (for avatar initials)
function stringToColor(str: string): string {
  const palette = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
    '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9',
    '#F1948A', '#82E0AA', '#F0B27A', '#AED6F1', '#A9DFBF',
  ];
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return palette[Math.abs(hash) % palette.length];
}

function AvatarInitials({ name, size = 46 }: { name: string; size?: number }) {
  const initials = name
    .split(' ')
    .map((w) => w[0]?.toUpperCase())
    .slice(0, 2)
    .join('');
  const bg = stringToColor(name);
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: bg,
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <ThemedText style={{ color: '#fff', fontWeight: 'bold', fontSize: size * 0.38 }}>
        {initials}
      </ThemedText>
    </View>
  );
}

export default function UserSelectionModal({
  modalVisible,
  onClose,
  onUserSelect,
  code,
}: UserSelectionModalProps) {
  const { token } = useAuth();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const { showToast } = useToast();

  const [friends, setFriends] = useState<Friend[]>([]);
  const [groups, setGroups] = useState<GroupConversation[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'friends' | 'groups'>('friends');
  const [search, setSearch] = useState('');

  const indicatorAnim = useState(new Animated.Value(0))[0];

  const fetchData = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [friendsRes, convsRes] = await Promise.all([
        fetch(`${BASE_URL}/users/friends`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${BASE_URL}/conversations`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      if (friendsRes.ok) {
        const data = await friendsRes.json();
        setFriends(data);
      }
      if (convsRes.ok) {
        const data = await convsRes.json();
        const groupConvs: GroupConversation[] = (data.conversations || data || []).filter(
          (c: any) => c.isGroup
        );
        setGroups(groupConvs);
      }
    } catch (error) {
      showToast('Network error while fetching recipients.', 'error');
    } finally {
      setLoading(false);
    }
  }, [token]);

  // Reset local UI state during render when the modal transitions to visible,
  // instead of calling setState synchronously inside an effect (avoids the
  // extra cascading render that pattern causes).
  const [wasModalVisible, setWasModalVisible] = useState(modalVisible);
  if (modalVisible !== wasModalVisible) {
    setWasModalVisible(modalVisible);
    if (modalVisible) {
      setSearch('');
      setActiveTab('friends');
    }
  }

  useEffect(() => {
    if (modalVisible) {
      // fetchData sets a loading flag synchronously before its first await,
      // which is the standard "fetch on mount" pattern from React's own
      // docs. Neither `friends`, `groups`, nor `loading` are effect
      // dependencies, so this cannot re-trigger the effect or loop.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      fetchData();
    }
  }, [modalVisible, fetchData]);

  const switchTab = (tab: 'friends' | 'groups') => {
    setActiveTab(tab);
    Animated.timing(indicatorAnim, {
      toValue: tab === 'friends' ? 0 : 1,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  };

  const filteredFriends = friends.filter((f) =>
    f.username.toLowerCase().includes(search.toLowerCase())
  );
  const filteredGroups = groups.filter((g) =>
    g.name?.toLowerCase().includes(search.toLowerCase())
  );

  const indicatorLeft = indicatorAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '50%'],
  });

  const renderFriend = ({ item }: { item: Friend }) => (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: colors.background, borderColor: colors.icon + '20' }]}
      onPress={() => {
        onUserSelect(item._id, 'user');
        onClose();
      }}
      activeOpacity={0.75}
    >
      {item.profilePicture ? (
        <ExpoImage
          source={{ uri: getImageUrl(item.profilePicture) }}
          style={styles.cardAvatar}
          contentFit="cover"
        />
      ) : (
        <AvatarInitials name={item.username} />
      )}
      <View style={styles.cardInfo}>
        <ThemedText style={[styles.cardName, { color: colors.text }]}>{item.username}</ThemedText>
        <ThemedText style={[styles.cardSub, { color: colors.icon }]}>Friend</ThemedText>
      </View>
      <View style={[styles.sendChip, { backgroundColor: colors.tint + '18' }]}>
        <ThemedText style={[styles.sendChipText, { color: colors.tint }]}>Send</ThemedText>
        <Ionicons name="send" size={13} color={colors.tint} />
      </View>
    </TouchableOpacity>
  );

  const renderGroup = ({ item }: { item: GroupConversation }) => (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: colors.background, borderColor: colors.icon + '20' }]}
      onPress={() => {
        onUserSelect(item._id, 'group');
        onClose();
      }}
      activeOpacity={0.75}
    >
      {item.groupImage ? (
        <ExpoImage
          source={{ uri: getGroupImageUrl(item.groupImage) }}
          style={styles.cardAvatar}
          contentFit="cover"
        />
      ) : (
        <View style={[styles.groupIconWrapper, { backgroundColor: colors.tint + '22' }]}>
          <Ionicons name="people" size={24} color={colors.tint} />
        </View>
      )}
      <View style={styles.cardInfo}>
        <ThemedText style={[styles.cardName, { color: colors.text }]}>{item.name}</ThemedText>
        <ThemedText style={[styles.cardSub, { color: colors.icon }]}>
          {item.participants?.length ?? '?'} members
        </ThemedText>
      </View>
      <View style={[styles.sendChip, { backgroundColor: colors.tint + '18' }]}>
        <ThemedText style={[styles.sendChipText, { color: colors.tint }]}>Send</ThemedText>
        <Ionicons name="send" size={13} color={colors.tint} />
      </View>
    </TouchableOpacity>
  );

  return (
    <Modal
      animationType="slide"
      transparent
      visible={modalVisible}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        {/* Backdrop */}
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onClose} activeOpacity={1} />

        <ThemedView style={[styles.sheet, { backgroundColor: colors.background }]}>
          {/* Handle bar */}
          <View style={[styles.handleBar, { backgroundColor: colors.icon + '40' }]} />

          {/* Header */}
          <View style={styles.sheetHeader}>
            <View>
              <ThemedText style={[styles.sheetTitle, { color: colors.text }]}>
                Send &quot;{code?.name}&quot;
              </ThemedText>
              <ThemedText style={[styles.sheetSub, { color: colors.icon }]}>
                Choose a friend or group to send this code
              </ThemedText>
            </View>
            {/* Code color accent */}
            {code?.color && (
              <View style={[styles.codeAccentDot, { backgroundColor: code.color }]} />
            )}
          </View>

          {/* Search */}
          <View style={[styles.searchBar, { backgroundColor: colors.icon + '12', borderColor: colors.icon + '25' }]}>
            <Ionicons name="search" size={18} color={colors.icon} style={{ marginRight: 8 }} />
            <TextInput
              style={[styles.searchInput, { color: colors.text }]}
              placeholder={activeTab === 'friends' ? 'Search friends...' : 'Search groups...'}
              placeholderTextColor={colors.icon}
              value={search}
              onChangeText={setSearch}
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch('')}>
                <Ionicons name="close-circle" size={18} color={colors.icon} />
              </TouchableOpacity>
            )}
          </View>

          {/* Tabs */}
          <View style={[styles.tabBar, { backgroundColor: colors.icon + '12' }]}>
            <Animated.View style={[styles.tabIndicator, { left: indicatorLeft, backgroundColor: colors.tint }]} />
            <TouchableOpacity style={styles.tab} onPress={() => switchTab('friends')}>
              <ThemedText
                style={[styles.tabLabel, { color: activeTab === 'friends' ? '#fff' : colors.icon }]}
              >
                <Ionicons
                  name="person"
                  size={14}
                  color={activeTab === 'friends' ? '#fff' : colors.icon}
                />{' '}
                Friends
              </ThemedText>
            </TouchableOpacity>
            <TouchableOpacity style={styles.tab} onPress={() => switchTab('groups')}>
              <ThemedText
                style={[styles.tabLabel, { color: activeTab === 'groups' ? '#fff' : colors.icon }]}
              >
                <Ionicons
                  name="people"
                  size={14}
                  color={activeTab === 'groups' ? '#fff' : colors.icon}
                />{' '}
                Groups
              </ThemedText>
            </TouchableOpacity>
          </View>

          {/* List */}
          {loading ? (
            <ActivityIndicator
              size="large"
              color={colors.tint}
              style={{ marginTop: 40 }}
            />
          ) : activeTab === 'friends' ? (
            <FlatList
              data={filteredFriends}
              keyExtractor={(item) => item._id}
              renderItem={renderFriend}
              contentContainerStyle={styles.list}
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={
                <ThemedText style={[styles.emptyText, { color: colors.icon }]}>
                  {search ? 'No friends found matching your search.' : 'No friends yet. Add some friends to send codes!'}
                </ThemedText>
              }
            />
          ) : (
            <FlatList
              data={filteredGroups}
              keyExtractor={(item) => item._id}
              renderItem={renderGroup}
              contentContainerStyle={styles.list}
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={
                <ThemedText style={[styles.emptyText, { color: colors.icon }]}>
                  {search ? 'No groups found matching your search.' : 'No group chats yet. Create a group to share codes!'}
                </ThemedText>
              }
            />
          )}

          {/* Cancel */}
          <TouchableOpacity
            style={[styles.cancelBtn, { borderColor: colors.icon + '30' }]}
            onPress={onClose}
          >
            <ThemedText style={[styles.cancelText, { color: colors.icon }]}>Cancel</ThemedText>
          </TouchableOpacity>
        </ThemedView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 12,
    paddingHorizontal: 20,
    paddingBottom: 30,
    maxHeight: '82%',
  },
  handleBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sheetTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  sheetSub: {
    fontSize: 13,
    marginTop: 2,
    opacity: 0.7,
  },
  codeAccentDot: {
    width: 38,
    height: 38,
    borderRadius: 19,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 14,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
  },
  tabBar: {
    flexDirection: 'row',
    borderRadius: 12,
    padding: 3,
    marginBottom: 16,
    position: 'relative',
  },
  tabIndicator: {
    position: 'absolute',
    top: 3,
    bottom: 3,
    width: '50%',
    borderRadius: 10,
  },
  tab: {
    flex: 1,
    paddingVertical: 9,
    alignItems: 'center',
    zIndex: 1,
  },
  tabLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  list: {
    paddingBottom: 10,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 16,
    marginBottom: 10,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  cardAvatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    marginRight: 14,
    backgroundColor: '#eee',
  },
  groupIconWrapper: {
    width: 46,
    height: 46,
    borderRadius: 23,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  cardInfo: {
    flex: 1,
  },
  cardName: {
    fontSize: 16,
    fontWeight: '600',
  },
  cardSub: {
    fontSize: 12,
    marginTop: 2,
  },
  sendChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 5,
  },
  sendChipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 30,
    fontSize: 15,
    lineHeight: 22,
    paddingHorizontal: 20,
  },
  cancelBtn: {
    marginTop: 12,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
  },
  cancelText: {
    fontSize: 16,
    fontWeight: '600',
  },
});

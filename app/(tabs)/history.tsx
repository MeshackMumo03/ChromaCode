import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { getImageUrl } from '@/constants/api';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { HistoryItem, useHistory } from '@/hooks/useHistory';
import { Ionicons } from '@expo/vector-icons';
import { Image as ExpoImage } from 'expo-image';
import React, { useCallback } from 'react';
import {
    ActivityIndicator,
    FlatList,
    RefreshControl,
    StyleSheet,
    TouchableOpacity,
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatGroupHeader(dateString: string): string {
  const date = new Date(dateString);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (date.toDateString() === today.toDateString()) return 'Today';
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';

  return date.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

function formatTime(dateString: string): string {
  return new Date(dateString).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Returns initials from a username */
function getInitials(username: string): string {
  return username.slice(0, 2).toUpperCase();
}

/** Deterministic color for an avatar */
function usernameToColor(username: string): string {
  const palette = [
    '#FF6B9D', '#FF8C42', '#FFD166', '#06D6A0', '#118AB2',
    '#8338EC', '#FF4D6D', '#3A86FF', '#FB5607', '#8AC926',
  ];
  let hash = 0;
  for (let i = 0; i < username.length; i++) {
    hash = username.charCodeAt(i) + ((hash << 5) - hash);
  }
  return palette[Math.abs(hash) % palette.length];
}

/** Group history items by date */
interface GroupedSection {
  title: string;
  data: HistoryItem[];
}

function groupByDate(items: HistoryItem[]): GroupedSection[] {
  const groups: Record<string, HistoryItem[]> = {};
  for (const item of items) {
    const key = new Date(item.timestamp).toDateString();
    if (!groups[key]) groups[key] = [];
    groups[key].push(item);
  }
  return Object.entries(groups).map(([, data]) => ({
    title: formatGroupHeader(data[0].timestamp),
    data,
  }));
}

// ── Sub-components ────────────────────────────────────────────────────────────

const DateGroupHeader = ({
  title,
  colors,
}: {
  title: string;
  colors: any;
}) => (
  <View style={styles.groupHeader}>
    <View style={[styles.groupLine, { backgroundColor: colors.icon + '30' }]} />
    <View style={[styles.groupPill, { backgroundColor: colors.tint + '18', borderColor: colors.tint + '30' }]}>
      <ThemedText style={[styles.groupTitle, { color: colors.tint }]}>{title}</ThemedText>
    </View>
    <View style={[styles.groupLine, { backgroundColor: colors.icon + '30' }]} />
  </View>
);

const HistoryCard = ({
  item,
  colors,
  colorScheme,
}: {
  item: HistoryItem;
  colors: any;
  colorScheme: string | null | undefined;
}) => {
  const isDark = colorScheme === 'dark';
  const codeColor = item.code?.color || '#8338EC';
  const recipientName = item.recipient?.username;
  const recipientColor = recipientName ? usernameToColor(recipientName) : '#999';

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: isDark ? '#1A1A2E' : '#FFFFFF',
          shadowColor: codeColor,
        },
      ]}
    >
      {/* Left accent bar with the code's color */}
      <View style={[styles.cardAccent, { backgroundColor: codeColor }]} />

      {/* Subtle color wash */}
      <View style={[styles.cardWash, { backgroundColor: codeColor + '12' }]} />

      <View style={styles.cardBody}>
        {/* Top row: code color swatch + code name + time */}
        <View style={styles.cardTopRow}>
          <View style={[styles.colorSwatch, { backgroundColor: codeColor }]} />
          <ThemedText style={[styles.cardCodeName, { color: codeColor }]} numberOfLines={1}>
            {item.code?.name ?? 'Unknown Code'}
          </ThemedText>
          <ThemedText style={[styles.cardTime, { color: colors.icon }]}>
            {formatTime(item.timestamp)}
          </ThemedText>
        </View>

        {/* Meaning */}
        <ThemedText style={[styles.cardMeaning, { color: colors.text }]} numberOfLines={2}>
          {item.code?.meaning ?? '—'}
        </ThemedText>

        {/* Footer: recipient + direction badge */}
        <View style={styles.cardFooter}>
          {recipientName ? (
            <View style={styles.recipientRow}>
              {item.recipient?.profilePicture ? (
                <ExpoImage
                  source={{ uri: getImageUrl(item.recipient.profilePicture) }}
                  style={styles.recipientAvatar}
                  contentFit="cover"
                />
              ) : (
                <View style={[styles.recipientAvatar, { backgroundColor: recipientColor }]}>
                  <ThemedText style={styles.recipientInitials}>
                    {getInitials(recipientName)}
                  </ThemedText>
                </View>
              )}
              <ThemedText style={[styles.recipientName, { color: colors.icon }]}>
                {recipientName}
              </ThemedText>
            </View>
          ) : (
            <View />
          )}
          <View style={[styles.directionBadge, { backgroundColor: codeColor + '20', borderColor: codeColor + '40' }]}>
            <Ionicons name="arrow-up-outline" size={11} color={codeColor} />
            <ThemedText style={[styles.directionText, { color: codeColor }]}>Sent</ThemedText>
          </View>
        </View>
      </View>
    </View>
  );
};

// ── Screen ────────────────────────────────────────────────────────────────────

export default function HistoryScreen() {
  const { history, isLoading, error, fetchHistory } = useHistory();
  const [refreshing, setRefreshing] = React.useState(false);
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const isDark = colorScheme === 'dark';

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchHistory();
    setRefreshing(false);
  }, [fetchHistory]);

  // Build a flat list from grouped data for FlatList rendering
  type ListItem =
    | { type: 'header'; title: string; id: string }
    | { type: 'item'; data: HistoryItem; id: string };

  const listData: ListItem[] = React.useMemo(() => {
    const groups = groupByDate(history);
    const flat: ListItem[] = [];
    for (const group of groups) {
      flat.push({ type: 'header', title: group.title, id: `header-${group.title}` });
      for (const item of group.data) {
        flat.push({ type: 'item', data: item, id: item._id });
      }
    }
    return flat;
  }, [history]);

  const renderItem = ({ item }: { item: ListItem }) => {
    if (item.type === 'header') {
      return <DateGroupHeader title={item.title} colors={colors} />;
    }
    return (
      <HistoryCard item={item.data} colors={colors} colorScheme={colorScheme} />
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ThemedView style={[styles.container, { backgroundColor: colors.background }]}>

        {/* Page header */}
        <View style={[styles.pageHeader, { backgroundColor: isDark ? '#0F0F1A' : '#F7F8FF' }]}>
          <View>
            <ThemedText style={[styles.pageTitle, { color: colors.text }]}>History</ThemedText>
            <ThemedText style={[styles.pageSubtitle, { color: colors.icon }]}>
              {history.length} code{history.length !== 1 ? 's' : ''} sent
            </ThemedText>
          </View>
          <TouchableOpacity
            style={[styles.refreshBtn, { backgroundColor: colors.tint + '18' }]}
            onPress={onRefresh}
          >
            <Ionicons name="refresh-outline" size={20} color={colors.tint} />
          </TouchableOpacity>
        </View>

        {/* Error state */}
        {error && (
          <View style={styles.errorBanner}>
            <Ionicons name="warning-outline" size={18} color="#fff" />
            <ThemedText style={styles.errorText}>{error}</ThemedText>
            <TouchableOpacity onPress={fetchHistory} style={styles.retryBtn}>
              <ThemedText style={styles.retryText}>Retry</ThemedText>
            </TouchableOpacity>
          </View>
        )}

        {/* Loading skeleton */}
        {isLoading && history.length === 0 ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.tint} />
            <ThemedText style={[styles.loadingText, { color: colors.icon }]}>
              Loading your history...
            </ThemedText>
          </View>
        ) : history.length > 0 ? (
          <FlatList
            data={listData}
            renderItem={renderItem}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                colors={[colors.tint]}
                tintColor={colors.tint}
              />
            }
          />
        ) : (
          /* Empty state */
          <View style={styles.emptyContainer}>
            <ThemedText style={{ fontSize: 60, marginBottom: 16 }}>🎨</ThemedText>
            <ThemedText style={[styles.emptyTitle, { color: colors.text }]}>
              No codes sent yet
            </ThemedText>
            <ThemedText style={[styles.emptyBody, { color: colors.icon }]}>
              Head to the Chroma tab and send your first color code!
            </ThemedText>
          </View>
        )}
      </ThemedView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  // ── Page Header ──
  pageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  pageTitle: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  pageSubtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  refreshBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // ── Error ──
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF3B30',
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 12,
    padding: 12,
    gap: 8,
  },
  errorText: {
    color: '#fff',
    flex: 1,
    fontSize: 13,
  },
  retryBtn: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  retryText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 12,
  },
  // ── List ──
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 40,
  },
  // ── Date Group Header ──
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 16,
    gap: 10,
  },
  groupLine: {
    flex: 1,
    height: 1,
  },
  groupPill: {
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
  },
  groupTitle: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  // ── History Card ──
  card: {
    flexDirection: 'row',
    borderRadius: 16,
    marginBottom: 10,
    overflow: 'hidden',
    elevation: 2,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
  },
  cardAccent: {
    width: 6,
  },
  cardWash: {
    ...StyleSheet.absoluteFill,
    left: 6,
  },
  cardBody: {
    flex: 1,
    padding: 14,
    gap: 6,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  colorSwatch: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  cardCodeName: {
    fontSize: 15,
    fontWeight: '800',
    flex: 1,
    letterSpacing: 0.2,
  },
  cardTime: {
    fontSize: 11,
    fontWeight: '500',
  },
  cardMeaning: {
    fontSize: 13,
    lineHeight: 19,
    opacity: 0.85,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  recipientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  recipientAvatar: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recipientInitials: {
    fontSize: 9,
    fontWeight: '800',
    color: '#fff',
  },
  recipientName: {
    fontSize: 12,
    fontWeight: '500',
  },
  directionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
  },
  directionText: {
    fontSize: 11,
    fontWeight: '700',
  },
  // ── States ──
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  emptyBody: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 22,
  },
});
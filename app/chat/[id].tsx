import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, TextInput, FlatList, Alert, View, Platform, KeyboardAvoidingView, Modal, Pressable, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { getBaseUrl } from '@/constants/api';
import { StyledButton } from '@/components/StyledButton';
import * as Haptics from 'expo-haptics';
import { Audio } from 'expo-av';
import { useSocket } from '@/hooks/useSocket';
import { useConversations } from '@/hooks/useConversations';
import { Image as ExpoImage } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';

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
  status?: 'sent' | 'delivered' | 'read';
  mediaType: 'none' | 'image' | 'voice' | 'document' | 'sticker' | 'video' | 'audio';
  mediaUrl?: string;
  fileName?: string;
  fileSize?: number;
  fileMimeType?: string;
  timestamp: string;
}

export default function ChatScreen() {
  const { id } = useLocalSearchParams();
  const { token, user } = useAuth();
  const { markAsRead } = useConversations();
  const socket = useSocket();
  const navigation = useNavigation();
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [conversation, setConversation] = useState<any>(null);
  const [typingUser, setTypingUser] = useState<string | null>(null);
  const [peekCode, setPeekCode] = useState<any>(null);
  const [page, setPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const flatListRef = useRef<FlatList>(null);
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const StatusIcon = ({ status, isMyMessage }: { status?: string, isMyMessage: boolean }) => {
    if (!isMyMessage || !status) return null;
    let iconName: any = 'checkmark-outline';
    let color = colors.icon;
    
    if (status === 'delivered') iconName = 'checkmark-done-outline';
    if (status === 'read') {
      iconName = 'checkmark-done-outline';
      color = '#3498db'; // Blue for read
    }

    return <Ionicons name={iconName} size={14} color={color} style={{ marginLeft: 4 }} />;
  };

  const formatDateSeparator = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);

    if (date.toDateString() === today.toDateString()) return 'Today';
    if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return date.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  };

  useEffect(() => {
    const loadCache = async () => {
      if (!id) return;
      try {
        const cached = await AsyncStorage.getItem(getChatCacheKey(id.toString()));
        if (cached) {
          const { conversation: cachedConv, messages: cachedMsgs } = JSON.parse(cached);
          setConversation(cachedConv);
          setMessages(cachedMsgs);
        }
      } catch (e) {
        console.error('Error loading chat cache:', e);
      }
    };
    loadCache();

    const fetchConversation = async () => {
      if (!token || !id) return;
      try {
        const response = await fetch(`${BASE_URL}/conversations/${id}?page=1&limit=50`, {
          headers: { 'Authorization': `Bearer ${token}` },
        });
        const data = await response.json();
        if (response.ok) {
          setConversation(data.conversation);
          setMessages(data.messages);
          setHasMore(data.hasMore);
          
          // Save to cache
          AsyncStorage.setItem(getChatCacheKey(id.toString()), JSON.stringify({
            conversation: data.conversation,
            messages: data.messages
          }));

          const title = data.conversation.isGroup 
            ? data.conversation.name 
            : data.conversation.participants.find((p: any) => p._id !== user?._id)?.username || 'Chat';

          const avatar = data.conversation.isGroup
            ? (data.conversation.groupImage || 'https://cdn-icons-png.flaticon.com/512/166/166258.png')
            : data.conversation.participants.find((p: any) => p._id !== user?._id)?.profilePicture || 'https://www.gravatar.com/avatar/?d=mp';
          
          navigation.setOptions({
            headerTitle: () => (
              <View style={styles.headerTitleContainer}>
                <ExpoImage source={{ uri: avatar }} style={styles.headerAvatar} />
                <ThemedText style={styles.headerUsername}>{title}</ThemedText>
              </View>
            ),
            headerRight: () => data.conversation.isGroup ? (
              <TouchableOpacity onPress={() => router.push(`/group-settings/${id}`)}>
                <Ionicons name="settings-outline" size={24} color={colors.tint} style={{ marginRight: 15 }} />
              </TouchableOpacity>
            ) : null,
          });
        }
      } catch (error) {
        console.error('Error fetching conversation:', error);
      }
    };
    fetchConversation();

    if (id) {
      markAsRead(id.toString());
    }

    if (socket && id) {
      socket.emit('join_conversation', id);

      const handleNewMessage = (data: any) => {
        if (data.conversationId === id) {
          setMessages(prev => {
            if (prev.find(m => m._id === data.message._id)) return prev;
            if (data.message.sender._id !== user?._id) {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              // Mark as read immediately if we are in this chat
              markAsRead(id.toString());
            }
            const updated = [...prev, data.message];
            // Update cache
            AsyncStorage.setItem(getChatCacheKey(id.toString()), JSON.stringify({
              conversation: conversation, 
              messages: updated.slice(-50)
            }));
            return updated;
          });
          setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
        }
      };

      const handleTypingEvent = (data: any) => {
        if (data.conversationId === id && data.senderId !== user?._id) {
          setTypingUser(data.senderName || 'Someone');
        }
      };

      const handleStopTypingEvent = (data: any) => {
        if (data.conversationId === id && data.senderId !== user?._id) {
          setTypingUser(null);
        }
      };

      socket.on('new_message', handleNewMessage);
      socket.on('typing', handleTypingEvent);
      socket.on('stop_typing', handleStopTypingEvent);
      
      socket.on('messages_read', (data: any) => {
        if (data.conversationId === id) {
          setMessages(prev => prev.map(m => 
            m.sender._id !== data.readerId ? { ...m, status: 'read' } : m
          ));
        }
      });

      return () => {
        socket.off('new_message', handleNewMessage);
        socket.off('typing', handleTypingEvent);
        socket.off('stop_typing', handleStopTypingEvent);
        socket.off('messages_read');
      };
    }
  }, [id, token, user?._id, socket]);

  useEffect(() => {
    if (page > 1) {
      const fetchMore = async () => {
        if (!token || !id) return;
        setLoadingMore(true);
        try {
          const response = await fetch(`${BASE_URL}/conversations/${id}?page=${page}&limit=50`, {
            headers: { 'Authorization': `Bearer ${token}` },
          });
          const data = await response.json();
          if (response.ok) {
            setMessages(prev => [...data.messages, ...prev]);
            setHasMore(data.hasMore);
          }
        } catch (error) {
          console.error('Error loading more messages:', error);
        } finally {
          setLoadingMore(false);
        }
      };
      fetchMore();
    }
  }, [page]);

  const handleLoadMore = () => {
    if (!loadingMore && hasMore) {
      setPage(prev => prev + 1);
    }
  };

  const handleTyping = () => {
    if (!socket || !user) return;
    socket.emit('typing', { conversationId: id, senderId: user._id, senderName: user.username });
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      socket.emit('stop_typing', { conversationId: id, senderId: user._id });
    }, 2000);
  };

  const uploadFile = async (uri: string, name: string, type: string) => {
    if (!token) return null;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', {
        uri: Platform.OS === 'ios' ? uri.replace('file://', '') : uri,
        name: name,
        type: type,
      } as any);

      const response = await fetch(`${BASE_URL}/conversations/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'multipart/form-data',
        },
        body: formData,
      });

      const data = await response.json();
      if (response.ok) {
        return data;
      } else {
        Alert.alert('Upload failed', data.message || 'Something went wrong');
        return null;
      }
    } catch (error) {
      console.error('Upload error:', error);
      Alert.alert('Upload error', 'Could not upload file');
      return null;
    } finally {
      setUploading(false);
    }
  };

  const handleSendMedia = async (mediaData: any, mediaType: string) => {
    if (!token || !id) return;
    try {
      const response = await fetch(`${BASE_URL}/conversations/${id}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          text: '',
          mediaType,
          mediaUrl: mediaData.mediaUrl,
          fileName: mediaData.fileName,
          fileSize: mediaData.fileSize,
          fileMimeType: mediaData.fileMimeType,
        }),
      });
      const data = await response.json();
      if (response.ok) {
        setMessages(prev => [...prev, data]);
        setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
      }
    } catch (error) {
      console.error('Error sending media message:', error);
    }
  };

  const pickImage = async () => {
    setShowAttachMenu(false);
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      quality: 0.7,
    });

    if (!result.canceled) {
      const asset = result.assets[0];
      const mediaData = await uploadFile(asset.uri, asset.fileName || 'image.jpg', asset.mimeType || 'image/jpeg');
      if (mediaData) {
        const type = asset.type === 'video' ? 'video' : 'image';
        handleSendMedia(mediaData, type);
      }
    }
  };

  const pickDocument = async () => {
    setShowAttachMenu(false);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
      });

      if (!result.canceled) {
        const asset = result.assets[0];
        const mediaData = await uploadFile(asset.uri, asset.name, asset.mimeType || 'application/octet-stream');
        if (mediaData) {
          handleSendMedia(mediaData, 'document');
        }
      }
    } catch (error) {
      console.error('Document picker error:', error);
    }
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !token || !id) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      const response = await fetch(`${BASE_URL}/conversations/${id}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ text: newMessage }),
      });
      const data = await response.json();
      if (response.ok) {
        setMessages(prev => [...prev, data]);
        setNewMessage('');
        setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
      }
    } catch (error) {
      console.error('Network error during sending message:', error);
    }
  };

  return (
    <KeyboardAvoidingView 
      style={{ flex: 1, backgroundColor: colors.background }} 
      behavior="padding"
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 100}
    >
      <ThemedView style={{ flex: 1 }}>
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item._id}
          ListHeaderComponent={
            loadingMore ? (
              <ActivityIndicator size="small" color={colors.tint} style={{ marginVertical: 10 }} />
            ) : null
          }
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.1}
          renderItem={({ item, index }) => {
            const isMyMessage = item.sender._id.toString() === user?._id?.toString();
            const showDateSeparator = index === 0 || 
              new Date(messages[index - 1].timestamp).toDateString() !== new Date(item.timestamp).toDateString();

            return (
              <View>
                {showDateSeparator && (
                  <View style={styles.dateSeparator}>
                    <View style={[styles.dateLine, { backgroundColor: colors.icon }]} />
                    <ThemedText style={[styles.dateText, { color: colors.icon, backgroundColor: colors.background }]}>
                      {formatDateSeparator(item.timestamp)}
                    </ThemedText>
                    <View style={[styles.dateLine, { backgroundColor: colors.icon }]} />
                  </View>
                )}
                <View style={[styles.messageWrapper, isMyMessage ? styles.myMessageWrapper : styles.theirMessageWrapper]}>
                  {!isMyMessage && (
                    <ExpoImage source={{ uri: item.sender.profilePicture || 'https://www.gravatar.com/avatar/?d=mp' }} style={styles.messageAvatar} />
                  )}
                  <Pressable 
                    onPress={() => item.codeId && setPeekCode(item.codeId)}
                    style={[
                      styles.messageContainer,
                      isMyMessage ? styles.myMessage : styles.theirMessage,
                      { 
                        backgroundColor: item.codeId 
                          ? (colorScheme === 'dark' ? '#2A2A2A' : '#FFFFFF')
                          : (isMyMessage ? colors.tint : (colorScheme === 'light' ? '#E9E9EB' : '#333333')),
                        borderWidth: item.codeId ? 1 : 0,
                        borderColor: item.codeId ? item.codeId.color : 'transparent',
                        padding: (item.codeId || item.mediaType === 'image' || item.mediaType === 'video') ? 0 : 10,
                        width: (item.codeId || item.mediaType === 'image' || item.mediaType === 'video') ? '90%' : undefined,
                        maxWidth: (item.mediaType === 'image' || item.mediaType === 'video') ? '70%' : '85%',
                        alignSelf: item.codeId ? 'center' : (isMyMessage ? 'flex-end' : 'flex-start'),
                        marginVertical: item.codeId ? 10 : 2,
                        elevation: item.codeId ? 3 : 0,
                        overflow: 'hidden',
                      }
                    ]}
                  >
                    {item.codeId ? (
                      <View style={styles.richMessageCard}>
                        <View style={[styles.colorSideBar, { backgroundColor: item.codeId.color }]} />
                        <View style={styles.richContent}>
                          <ThemedText style={[styles.codeNameLabel, { color: item.codeId.color }]}>{item.codeId.name}</ThemedText>
                          <ThemedText style={styles.codeMeaningText} numberOfLines={3}>{item.codeId.meaning}</ThemedText>
                          <View style={styles.timestampRow}>
                            <ThemedText style={[styles.timestamp, { color: isMyMessage ? (colorScheme === 'light' ? 'rgba(255,255,255,0.8)' : '#000') : (colorScheme === 'dark' ? 'rgba(255,255,255,0.7)' : colors.icon) }]}>
                              {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </ThemedText>
                            <StatusIcon status={item.status} isMyMessage={isMyMessage} />
                          </View>
                        </View>
                      </View>
                    ) : item.mediaType === 'image' ? (
                      <View>
                        <ExpoImage 
                          source={{ 
                            uri: item.mediaUrl?.startsWith('http') 
                              ? item.mediaUrl 
                              : (item.mediaUrl?.startsWith('/api') 
                                  ? `${BASE_URL.replace('/api', '')}${item.mediaUrl}` 
                                  : `${BASE_URL.replace('/api', '')}${item.mediaUrl?.startsWith('/') ? '' : '/'}${item.mediaUrl}`) 
                          }} 
                          style={styles.messageImage} 
                          contentFit="cover"
                        />
                        <View style={[styles.timestampRow, styles.mediaTimestamp]}>
                          <ThemedText style={styles.timestamp}>
                            {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </ThemedText>
                          <StatusIcon status={item.status} isMyMessage={isMyMessage} />
                        </View>
                      </View>
                    ) : item.mediaType === 'sticker' ? (
                      <View style={styles.stickerContainer}>
                        <ExpoImage 
                          source={{ 
                            uri: item.mediaUrl?.startsWith('http') 
                              ? item.mediaUrl 
                              : (item.mediaUrl?.startsWith('/api') 
                                  ? `${BASE_URL.replace('/api', '')}${item.mediaUrl}` 
                                  : `${BASE_URL.replace('/api', '')}${item.mediaUrl?.startsWith('/') ? '' : '/'}${item.mediaUrl}`) 
                          }} 
                          style={styles.stickerImage} 
                          contentFit="contain"
                        />
                        <View style={[styles.timestampRow, styles.mediaTimestamp]}>
                          <ThemedText style={styles.timestamp}>
                            {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </ThemedText>
                          <StatusIcon status={item.status} isMyMessage={isMyMessage} />
                        </View>
                      </View>
                    ) : item.mediaType === 'document' ? (
                      <TouchableOpacity 
                        style={styles.documentContainer}
                        onPress={() => Alert.alert('Open Document', `Do you want to open ${item.fileName}?`)}
                      >
                        <Ionicons name="document-text" size={30} color={isMyMessage ? '#fff' : colors.tint} />
                        <View style={styles.documentInfo}>
                          <ThemedText style={[styles.documentName, { color: isMyMessage ? '#fff' : colors.text }]} numberOfLines={1}>
                            {item.fileName || 'Document'}
                          </ThemedText>
                          <ThemedText style={[styles.documentSize, { color: isMyMessage ? 'rgba(255,255,255,0.7)' : colors.icon }]}>
                            {item.fileSize ? `${(item.fileSize / 1024).toFixed(1)} KB` : ''}
                          </ThemedText>
                        </View>
                        <View style={styles.timestampRow}>
                          <ThemedText style={[styles.timestamp, { color: isMyMessage ? 'rgba(255,255,255,0.8)' : colors.icon }]}>
                            {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </ThemedText>
                          <StatusIcon status={item.status} isMyMessage={isMyMessage} />
                        </View>
                      </TouchableOpacity>
                    ) : (
                      <>
                        <ThemedText style={[styles.messageText, { color: isMyMessage ? (colorScheme === 'light' ? '#fff' : colors.background) : colors.text }]}>{item.text}</ThemedText>
                        <View style={styles.timestampRow}>
                          <ThemedText style={[styles.timestamp, { color: isMyMessage ? (colorScheme === 'light' ? 'rgba(255,255,255,0.8)' : '#000') : (colorScheme === 'dark' ? 'rgba(255,255,255,0.7)' : colors.icon) }]}>
                            {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </ThemedText>
                          <StatusIcon status={item.status} isMyMessage={isMyMessage} />
                        </View>
                      </>
                    )}
                  </Pressable>
                </View>
              </View>
            );
          }}
          contentContainerStyle={styles.messagesList}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        />

        {peekCode && (
          <Modal visible={!!peekCode} transparent animationType="fade" onRequestClose={() => setPeekCode(null)}>
            <Pressable style={styles.modalOverlay} onPress={() => setPeekCode(null)}>
              <View style={[styles.peekCard, { backgroundColor: colors.background, borderTopColor: peekCode?.color }]}>
                <View style={[styles.peekColorCircle, { backgroundColor: peekCode?.color }]} />
                <ThemedText style={styles.peekName}>{peekCode?.name}</ThemedText>
                <ThemedText style={styles.peekMeaning}>{peekCode?.meaning}</ThemedText>
                <StyledButton title="Close" onPress={() => setPeekCode(null)} />
              </View>
            </Pressable>
          </Modal>
        )}
        
        <SafeAreaView edges={['bottom']} style={{ backgroundColor: colors.background }}>
          {typingUser && <ThemedText style={[styles.typingIndicator, { color: colors.icon }]}>{typingUser} is typing...</ThemedText>}
          <View style={[styles.inputContainer, { borderTopColor: colors.icon, borderTopWidth: StyleSheet.hairlineWidth }]}>
            <TouchableOpacity onPress={() => setShowAttachMenu(true)} style={styles.attachButton}>
              <Ionicons name="add" size={28} color={colors.tint} />
            </TouchableOpacity>
            <TextInput
              style={[styles.input, { borderColor: colors.icon, backgroundColor: colors.background, color: colors.text }]}
              value={newMessage}
              onChangeText={(text) => { setNewMessage(text); handleTyping(); }}
              placeholder="Type a message..."
              placeholderTextColor={colors.icon}
              multiline
            />
            {uploading ? (
              <ActivityIndicator size="small" color={colors.tint} style={{ marginHorizontal: 10 }} />
            ) : (
              <StyledButton title="Send" onPress={handleSendMessage} style={styles.sendButton} />
            )}
          </View>
        </SafeAreaView>

        {showAttachMenu && (
          <Modal visible={showAttachMenu} transparent animationType="slide" onRequestClose={() => setShowAttachMenu(false)}>
            <Pressable style={styles.modalOverlay} onPress={() => setShowAttachMenu(false)}>
              <View style={[styles.attachMenu, { backgroundColor: colors.background }]}>
                <TouchableOpacity style={styles.attachOption} onPress={pickImage}>
                  <View style={[styles.attachIconContainer, { backgroundColor: '#4a90e2' }]}>
                    <Ionicons name="image" size={24} color="#fff" />
                  </View>
                  <ThemedText style={styles.attachText}>Photos & Videos</ThemedText>
                </TouchableOpacity>
                <TouchableOpacity style={styles.attachOption} onPress={pickDocument}>
                  <View style={[styles.attachIconContainer, { backgroundColor: '#5c5c5c' }]}>
                    <Ionicons name="document" size={24} color="#fff" />
                  </View>
                  <ThemedText style={styles.attachText}>Document</ThemedText>
                </TouchableOpacity>
                <TouchableOpacity style={styles.attachOption} onPress={() => { setShowAttachMenu(false); Alert.alert('Coming Soon', 'Voice messages are coming soon!'); }}>
                  <View style={[styles.attachIconContainer, { backgroundColor: '#f5a623' }]}>
                    <Ionicons name="mic" size={24} color="#fff" />
                  </View>
                  <ThemedText style={styles.attachText}>Audio</ThemedText>
                </TouchableOpacity>
              </View>
            </Pressable>
          </Modal>
        )}
      </ThemedView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  headerTitleContainer: { flexDirection: 'row', alignItems: 'center' },
  headerAvatar: { width: 36, height: 36, borderRadius: 18, marginRight: 10, backgroundColor: '#eee' },
  headerUsername: { fontSize: 18, fontWeight: 'bold' },
  messagesList: { padding: 10, paddingBottom: 20 },
  messageWrapper: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: 5 },
  myMessageWrapper: { justifyContent: 'flex-end' },
  theirMessageWrapper: { justifyContent: 'flex-start' },
  messageAvatar: { width: 30, height: 30, borderRadius: 15, marginRight: 8, marginBottom: 2, backgroundColor: '#eee' },
  dateSeparator: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginVertical: 15 },
  dateLine: { flex: 1, height: 1, opacity: 0.2 },
  dateText: { fontSize: 12, fontWeight: 'bold', paddingHorizontal: 10, textTransform: 'uppercase' },
  typingIndicator: { paddingHorizontal: 15, paddingVertical: 5, fontSize: 12, fontStyle: 'italic' },
  messageContainer: { padding: 10, borderRadius: 18, marginBottom: 5, maxWidth: '85%' },
  myMessage: { alignSelf: 'flex-end', borderBottomRightRadius: 4 },
  theirMessage: { alignSelf: 'flex-start', borderBottomLeftRadius: 4 },
  messageText: { fontSize: 16, lineHeight: 22 },
  messageImage: { width: '100%', aspectRatio: 1, borderRadius: 10 },
  stickerContainer: { padding: 5, backgroundColor: 'transparent' },
  stickerImage: { width: 120, height: 120 },
  mediaTimestamp: { position: 'absolute', bottom: 5, right: 10, backgroundColor: 'rgba(0,0,0,0.3)', paddingHorizontal: 5, borderRadius: 10 },
  documentContainer: { flexDirection: 'row', alignItems: 'center', padding: 5 },
  documentInfo: { flex: 1, marginLeft: 10 },
  documentName: { fontSize: 14, fontWeight: 'bold' },
  documentSize: { fontSize: 12 },
  richMessageCard: { flexDirection: 'row', minHeight: 80 },
  colorSideBar: { width: 12, height: '100%' },
  richContent: { flex: 1, padding: 15, justifyContent: 'center' },
  codeNameLabel: { fontSize: 14, fontWeight: 'bold', textTransform: 'uppercase', marginBottom: 4, letterSpacing: 1 },
  codeMeaningText: { fontSize: 16, lineHeight: 22, marginBottom: 8 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  peekCard: { width: '100%', padding: 25, borderRadius: 20, alignItems: 'center', borderTopWidth: 8 },
  peekColorCircle: { width: 60, height: 60, borderRadius: 30, marginBottom: 15 },
  peekName: { fontSize: 22, fontWeight: 'bold', marginBottom: 10 },
  peekMeaning: { fontSize: 18, textAlign: 'center', marginBottom: 25, lineHeight: 26 },
  timestampRow: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-end', marginTop: 4 },
  timestamp: { fontSize: 10, opacity: 0.8 },
  inputContainer: { flexDirection: 'row', padding: 10, borderTopWidth: 1, alignItems: 'flex-end', backgroundColor: 'transparent', paddingBottom: Platform.OS === 'ios' ? 0 : 10 },
  attachButton: { padding: 5, marginRight: 5 },
  input: { flex: 1, minHeight: 40, maxHeight: 100, borderWidth: 1, borderRadius: 20, paddingHorizontal: 15, paddingTop: 10, paddingBottom: 10, marginRight: 10 },
  sendButton: { height: 40, justifyContent: 'center', paddingVertical: 0 },
  attachMenu: { width: '100%', padding: 20, borderTopLeftRadius: 20, borderTopRightRadius: 20, position: 'absolute', bottom: 0 },
  attachOption: { flexDirection: 'row', alignItems: 'center', paddingVertical: 15 },
  attachIconContainer: { width: 50, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  attachText: { fontSize: 16, fontWeight: '600' }
});

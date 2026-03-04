import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, TextInput, FlatList, Alert, View, Platform, KeyboardAvoidingView, Modal, Pressable, TouchableOpacity, useColorScheme } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { Colors } from '@/constants/theme';
import { getBaseUrl } from '@/constants/api';
import { StyledButton } from '@/components/StyledButton';
import * as Haptics from 'expo-haptics';
import { Audio } from 'expo-av';
import { useSocket } from '@/hooks/useSocket';
import { Image as ExpoImage } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';

const BASE_URL = getBaseUrl();

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
  timestamp: string;
}

export default function ChatScreen() {
  const { id } = useLocalSearchParams();
  const { token, user } = useAuth();
  const socket = useSocket();
  const navigation = useNavigation();
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [conversation, setConversation] = useState<any>(null);
  const [typingUser, setTypingUser] = useState<string | null>(null);
  const [peekCode, setPeekCode] = useState<any>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const flatListRef = useRef<FlatList>(null);
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

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
    const fetchConversation = async () => {
      if (!token || !id) return;
      try {
        const response = await fetch(`${BASE_URL}/conversations/${id}`, {
          headers: { 'Authorization': `Bearer ${token}` },
        });
        const data = await response.json();
        if (response.ok) {
          setConversation(data.conversation);
          setMessages(data.messages);
          
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

    if (socket && id) {
      socket.emit('join_conversation', id);

      const handleNewMessage = (data: any) => {
        if (data.conversationId === id) {
          setMessages(prev => {
            if (prev.find(m => m._id === data.message._id)) return prev;
            if (data.message.sender._id !== user?._id) {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }
            return [...prev, data.message];
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

      return () => {
        socket.off('new_message', handleNewMessage);
        socket.off('typing', handleTypingEvent);
        socket.off('stop_typing', handleStopTypingEvent);
      };
    }
  }, [id, token, user?._id, socket]);

  const handleTyping = () => {
    if (!socket || !user) return;
    socket.emit('typing', { conversationId: id, senderId: user._id, senderName: user.username });
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      socket.emit('stop_typing', { conversationId: id, senderId: user._id });
    }, 2000);
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
                          : (isMyMessage ? colors.tint : (colorScheme === 'light' ? '#E0E0E0' : colors.icon)),
                        borderWidth: item.codeId ? 1 : 0,
                        borderColor: item.codeId ? item.codeId.color : 'transparent',
                        padding: item.codeId ? 0 : 10,
                        width: item.codeId ? '90%' : undefined,
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
                          <ThemedText style={[styles.timestamp, { color: colors.icon }]}>
                            {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </ThemedText>
                        </View>
                      </View>
                    ) : (
                      <>
                        <ThemedText style={[styles.messageText, { color: isMyMessage ? (colorScheme === 'light' ? '#fff' : colors.background) : colors.text }]}>{item.text}</ThemedText>
                        <ThemedText style={[styles.timestamp, { color: colors.icon }]}>
                          {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </ThemedText>
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
            <TextInput
              style={[styles.input, { borderColor: colors.icon, backgroundColor: colors.background, color: colors.text }]}
              value={newMessage}
              onChangeText={(text) => { setNewMessage(text); handleTyping(); }}
              placeholder="Type a message..."
              placeholderTextColor={colors.icon}
              multiline
            />
            <StyledButton title="Send" onPress={handleSendMessage} style={styles.sendButton} />
          </View>
        </SafeAreaView>
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
  timestamp: { fontSize: 10, alignSelf: 'flex-end', marginTop: 4, opacity: 0.8 },
  inputContainer: { flexDirection: 'row', padding: 10, borderTopWidth: 1, alignItems: 'flex-end', backgroundColor: 'transparent', paddingBottom: Platform.OS === 'ios' ? 0 : 10 },
  input: { flex: 1, minHeight: 40, maxHeight: 100, borderWidth: 1, borderRadius: 20, paddingHorizontal: 15, paddingTop: 10, paddingBottom: 10, marginRight: 10 },
  sendButton: { height: 40, justifyContent: 'center', paddingVertical: 0 }
});

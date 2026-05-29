import React, { useEffect, useMemo, useState } from 'react';
import { FlatList, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import mockMessages from '../data/mockMessages';
import {
  fetchMessagesWithUser,
  sendMessage,
  subscribeToMessages,
} from '../services/messageService';
import { fetchProfileById } from '../services/profileService.js';
import useMessageStore from '../store/messageStore';
import useUserStore from '../store/userStore';
import colors from '../theme/colors';
import spacing from '../theme/spacing';
import { getVietnameseErrorMessage } from '../utils/errorMessages';
import { formatLastActive } from '../utils/formatTime';
import { loadCachedMessages, saveCachedMessages } from '../utils/messageCache';

const reactions = ['👍', '❤️', '✨', '😂', '☕'];
const LIKE_MESSAGE = '👍';
const SEND_ICON = '➤';

function mapMessage(row) {
  const createdAt = row.created_at || row.createdAt || new Date().toISOString();

  return {
    id: row.id ? String(row.id) : `${row.sender_id}-${row.receiver_id}-${createdAt}-${row.text}`,
    senderId: row.sender_id || row.senderId,
    receiverId: row.receiver_id || row.receiverId,
    text: row.text,
    createdAt,
    time: createdAt
      ? new Date(createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : 'Bây giờ',
  };
}

function getMessageKey(message) {
  if (message?.id) {
    return String(message.id);
  }

  return `${message?.senderId}-${message?.receiverId}-${message?.createdAt || message?.time}-${message?.text}`;
}

function getMessageFingerprint(message) {
  return `${message?.senderId}-${message?.receiverId}-${message?.createdAt || ''}-${message?.text}`;
}

function getMessageTimeValue(message) {
  const time = new Date(message?.createdAt || 0).getTime();
  return Number.isNaN(time) ? 0 : time;
}

function isMatchingPendingMessage(pendingMessage, savedMessage) {
  if (!pendingMessage?.pending || !savedMessage) {
    return false;
  }

  const sameConversation =
    pendingMessage.senderId === savedMessage.senderId &&
    pendingMessage.receiverId === savedMessage.receiverId;
  if (!sameConversation || pendingMessage.text !== savedMessage.text) {
    return false;
  }

  const pendingTime = getMessageTimeValue(pendingMessage);
  const savedTime = getMessageTimeValue(savedMessage);
  if (!pendingTime || !savedTime) {
    return true;
  }

  return Math.abs(savedTime - pendingTime) < 60 * 1000;
}

function addMessageOnce(items, message) {
  const nextMessage = { ...message, id: getMessageKey(message) };
  const nextKey = getMessageKey(nextMessage);
  const nextFingerprint = getMessageFingerprint(nextMessage);

  if (
    items.some(
      (item) =>
        getMessageKey(item) === nextKey ||
        (nextFingerprint && getMessageFingerprint(item) === nextFingerprint)
    )
  ) {
    return items;
  }

  return [...items, nextMessage];
}

function reconcileSavedMessage(items, message) {
  const nextMessage = { ...message, id: getMessageKey(message), pending: false };
  const nextKey = getMessageKey(nextMessage);
  const existingIndex = items.findIndex((item) => getMessageKey(item) === nextKey);

  if (existingIndex >= 0) {
    return items
      .filter((item, index) => index === existingIndex || !isMatchingPendingMessage(item, nextMessage))
      .map((item) => (getMessageKey(item) === nextKey ? { ...item, ...nextMessage } : item));
  }

  const pendingIndex = items.findIndex((item) => isMatchingPendingMessage(item, nextMessage));
  if (pendingIndex >= 0) {
    return items.reduce((nextItems, item, index) => {
      if (index === pendingIndex) {
        nextItems.push(nextMessage);
      } else if (!isMatchingPendingMessage(item, nextMessage)) {
        nextItems.push(item);
      }

      return nextItems;
    }, []);
  }

  return addMessageOnce(items, nextMessage);
}

function replaceMessage(items, tempId, message) {
  const withoutTemp = items.filter((item) => String(item.id) !== String(tempId));
  return reconcileSavedMessage(withoutTemp, message);
}

function mergeMessages(oldMessages, newMessages) {
  const messageMap = new Map();
  [...oldMessages, ...newMessages].forEach((message) => {
    if (message) {
      messageMap.set(getMessageKey(message), { ...message, id: getMessageKey(message) });
    }
  });

  return Array.from(messageMap.values()).sort((first, second) => {
    const timeDiff = getMessageTimeValue(first) - getMessageTimeValue(second);
    if (timeDiff !== 0) {
      return timeDiff;
    }

    return getMessageKey(first).localeCompare(getMessageKey(second));
  });
}

function normalizeCachedMessages(items) {
  return mergeMessages([], items || []);
}

function getNewestMessagesFirst(items) {
  return [...items].sort((first, second) => {
    const timeDiff = getMessageTimeValue(second) - getMessageTimeValue(first);
    if (timeDiff !== 0) {
      return timeDiff;
    }

    return getMessageKey(second).localeCompare(getMessageKey(first));
  });
}

export default function ChatScreen({ route }) {
  const { users, friends, currentUser, isBackendReady } = useUserStore();
  const markConversationSeen = useMessageStore(
    (state) => state.markConversationSeen
  );
  const allPeople = useMemo(() => [...users, ...friends], [users, friends]);
  const localUser = allPeople.find((item) => item.id === route.params?.userId);
  const [remoteUser, setRemoteUser] = useState(route.params?.user || null);
  const user = localUser || remoteUser || (!route.params?.userId ? allPeople[0] : null);
  const [messages, setMessages] = useState(isBackendReady ? [] : mockMessages);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const visibleMessages = useMemo(() => getNewestMessagesFirst(messages), [messages]);

  useEffect(() => {
    if (isBackendReady && user?.id) {
      markConversationSeen(user.id, null, currentUser?.id);
    }
  }, [currentUser?.id, isBackendReady, markConversationSeen, user?.id]);

  useEffect(() => {
    if (!isBackendReady || !user?.id || !messages.length) {
      return;
    }

    const latestTimestamp = Math.max(...messages.map(getMessageTimeValue));
    if (latestTimestamp) {
      markConversationSeen(
        user.id,
        new Date(latestTimestamp).toISOString(),
        currentUser?.id
      );
    }
  }, [currentUser?.id, isBackendReady, markConversationSeen, messages, user?.id]);

  useEffect(() => {
    if (!isBackendReady || localUser || remoteUser || !route.params?.userId) {
      return undefined;
    }

    let active = true;
    fetchProfileById(route.params.userId)
      .then((profile) => {
        if (active) {
          setRemoteUser(profile);
        }
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, [isBackendReady, localUser, remoteUser, route.params?.userId]);

  useEffect(() => {
    if (!isBackendReady || !user?.id || !currentUser?.id) {
      return undefined;
    }

    let active = true;

    async function loadMessages() {
      const cachedMessages = normalizeCachedMessages(
        await loadCachedMessages(currentUser.id, user.id)
      );
      if (active && cachedMessages.length) {
        setMessages(cachedMessages);
      }

      setLoading(!cachedMessages.length);
      setError(null);
      try {
        const rows = await fetchMessagesWithUser(user.id);
        if (active) {
          const remoteMessages = rows.map(mapMessage);
          setMessages((items) => {
            const nextMessages = mergeMessages(items, remoteMessages);
            saveCachedMessages(currentUser.id, user.id, nextMessages);
            return nextMessages;
          });
        }
      } catch (err) {
        setError(getVietnameseErrorMessage(err.message));
      } finally {
        setLoading(false);
      }
    }

    loadMessages();

    return () => {
      active = false;
    };
  }, [currentUser?.id, isBackendReady, user?.id]);

  useEffect(() => {
    if (!isBackendReady || !user?.id || !currentUser?.id) {
      return undefined;
    }

    return subscribeToMessages(user.id, currentUser.id, (row) => {
      const isCurrentConversation =
        (row?.sender_id === currentUser.id && row?.receiver_id === user.id) ||
        (row?.sender_id === user.id && row?.receiver_id === currentUser.id);

      if (!isCurrentConversation) {
        return;
      }

      const newMessage = mapMessage(row);
      setMessages((items) => {
        const nextMessages = reconcileSavedMessage(items, newMessage);
        saveCachedMessages(currentUser.id, user.id, nextMessages);
        return nextMessages;
      });

      if (row.sender_id === user.id) {
        markConversationSeen(user.id, row.created_at, currentUser.id);
      }
    });
  }, [currentUser?.id, isBackendReady, markConversationSeen, user?.id]);

  async function handleSend(messageText) {
    const cleanText = (messageText || text).trim();
    if (!cleanText || sending || !user?.id) {
      return;
    }

    const isTypedMessage = !messageText;

    if (!isBackendReady) {
      setMessages((items) =>
        addMessageOnce(items, {
          id: `local-${Date.now()}`,
          senderId: 'me',
          receiverId: user.id,
          text: cleanText,
          createdAt: new Date().toISOString(),
          time: 'Bây giờ',
        })
      );
      if (isTypedMessage) {
        setText('');
      }
      return;
    }

    if (!currentUser?.id) {
      setError('Bạn cần đăng nhập lại để gửi tin nhắn.');
      return;
    }

    const tempId = `temp-${Date.now()}`;
    const optimisticMessage = {
      id: tempId,
      senderId: currentUser.id,
      receiverId: user.id,
      text: cleanText,
      createdAt: new Date().toISOString(),
      time: 'Bây giờ',
      pending: true,
    };

    setSending(true);
    setError(null);
    setMessages((items) => addMessageOnce(items, optimisticMessage));
    if (isTypedMessage) {
      setText('');
    }

    try {
      const row = await sendMessage(user.id, cleanText);
      const newMessage = mapMessage(row);
      setMessages((items) => {
        const nextMessages = replaceMessage(items, tempId, newMessage);
        saveCachedMessages(currentUser.id, user.id, nextMessages);
        return nextMessages;
      });
    } catch (err) {
      setError(getVietnameseErrorMessage(err.message));
      setMessages((items) => items.filter((item) => String(item.id) !== tempId));
      if (isTypedMessage) {
        setText(cleanText);
      }
    } finally {
      setSending(false);
    }
  }

  function handleActionPress() {
    if (text.trim()) {
      handleSend();
      return;
    }

    handleSend(LIKE_MESSAGE);
  }

  function handleInputKeyPress(event) {
    if (Platform.OS !== 'web') {
      return;
    }

    const nativeEvent = event.nativeEvent || {};
    if (nativeEvent.key === 'Enter' && !nativeEvent.shiftKey) {
      event.preventDefault?.();
      handleSend();
    }
  }

  if (!user) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.error}>Không tìm thấy người để nhắn tin.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.name}>{user.name}</Text>
        <Text style={styles.status}>{formatLastActive(user)}</Text>
      </View>
      {loading ? <Text style={styles.notice}>Đang tải tin nhắn...</Text> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <FlatList
        data={visibleMessages}
        inverted
        keyExtractor={(item, index) => String(item.id || `message-${index}`)}
        renderItem={({ item }) => {
          const isMine = item.senderId === 'me' || item.senderId === currentUser?.id;
          return (
            <View style={[styles.message, isMine ? styles.myMessage : styles.theirMessage]}>
              <Text style={styles.messageText}>{item.text}</Text>
              <Text style={styles.time}>{item.time}</Text>
            </View>
          );
        }}
        contentContainerStyle={styles.messages}
        showsVerticalScrollIndicator={false}
      />
      <View style={styles.reactions}>
        {reactions.map((item, index) => (
          <Pressable key={`reaction-${index}`} onPress={() => setText((value) => `${value}${item}`)}>
            <Text style={styles.reaction}>{item}</Text>
          </Pressable>
        ))}
      </View>
      <View style={styles.inputRow}>
        <View style={styles.inputBox}>
          <TextInput
            style={styles.input}
            placeholder="Nhập tin nhắn..."
            placeholderTextColor={colors.muted}
            value={text}
            onChangeText={setText}
            onKeyPress={handleInputKeyPress}
            multiline
            blurOnSubmit={false}
            returnKeyType="send"
            scrollEnabled
          />
        </View>
        <Pressable
          onPress={handleActionPress}
          disabled={sending}
          style={({ pressed }) => [
            styles.actionButton,
            pressed && styles.actionPressed,
            sending && styles.sendDisabled,
          ]}
        >
          <Text style={styles.actionIcon}>{text.trim() ? SEND_ICON : LIKE_MESSAGE}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.lg,
  },
  header: {
    paddingBottom: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  name: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '800',
  },
  status: {
    color: colors.accent,
    marginTop: 4,
  },
  notice: {
    color: colors.muted,
    marginTop: spacing.md,
  },
  error: {
    color: colors.danger,
    marginTop: spacing.md,
  },
  messages: {
    paddingVertical: spacing.lg,
    gap: spacing.md,
  },
  message: {
    maxWidth: '78%',
    borderRadius: 20,
    padding: spacing.md,
  },
  myMessage: {
    alignSelf: 'flex-end',
    backgroundColor: colors.primary,
  },
  theirMessage: {
    alignSelf: 'flex-start',
    backgroundColor: colors.cardStrong,
    borderWidth: 1,
    borderColor: colors.line,
  },
  messageText: {
    color: colors.text,
    fontSize: 15,
    lineHeight: 21,
  },
  time: {
    color: 'rgba(248, 250, 252, 0.7)',
    fontSize: 11,
    marginTop: 6,
    alignSelf: 'flex-end',
  },
  reactions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  reaction: {
    overflow: 'hidden',
    width: 42,
    height: 42,
    borderRadius: 21,
    textAlign: 'center',
    textAlignVertical: 'center',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    fontSize: 20,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.md,
  },
  inputBox: {
    flex: 1,
    height: 52,
    borderRadius: 18,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: spacing.md,
  },
  input: {
    flex: 1,
    height: 52,
    paddingTop: 15,
    paddingBottom: 15,
    color: colors.text,
    outlineStyle: 'none',
  },
  sendDisabled: {
    opacity: 0.85,
  },
  actionButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
  },
  actionPressed: {
    opacity: 0.78,
    transform: [{ scale: 0.96 }],
  },
  actionIcon: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '900',
  },
});

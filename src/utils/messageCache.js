import AsyncStorage from '@react-native-async-storage/async-storage';

function getMessageCacheKey(currentUserId, otherUserId) {
  const ids = [currentUserId || 'me', otherUserId || 'unknown'].sort();
  return `orbit:messages:${ids[0]}:${ids[1]}`;
}

export async function loadCachedMessages(currentUserId, otherUserId) {
  try {
    const value = await AsyncStorage.getItem(getMessageCacheKey(currentUserId, otherUserId));
    return value ? JSON.parse(value) : [];
  } catch {
    return [];
  }
}

export async function saveCachedMessages(currentUserId, otherUserId, messages) {
  try {
    await AsyncStorage.setItem(
      getMessageCacheKey(currentUserId, otherUserId),
      JSON.stringify(messages.slice(-80))
    );
  } catch {
    // Cache chỉ để mở chat nhanh hơn, lỗi cache không chặn gửi tin nhắn.
  }
}

import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import colors from '../theme/colors';
import spacing from '../theme/spacing';
import GlassCard from './GlassCard';
import UserListItem from './UserListItem';

export default function MapUserGroupSheet({ users = [], onClose, onSelectUser }) {
  if (!users.length) {
    return null;
  }

  return (
    <View style={styles.overlay}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <Pressable style={styles.sheetWrap} onPress={(event) => event.stopPropagation?.()}>
        <GlassCard style={styles.sheet}>
          <Pressable onPress={onClose} style={styles.handle} />
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>Những người ở gần đây</Text>
              <Text style={styles.subtitle}>{users.length} người đang ở cùng khu vực</Text>
            </View>
            <Pressable style={styles.closeButton} onPress={onClose}>
              <Text style={styles.closeText}>Đóng</Text>
            </Pressable>
          </View>

          <ScrollView style={styles.list} contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
            {users.map((user) => (
              <UserListItem
                key={user.id}
                user={user}
                onPress={() => onSelectUser(user)}
                showFriendButton={false}
                showChatButton={false}
              />
            ))}
          </ScrollView>
        </GlassCard>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'flex-end',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  sheetWrap: {
    alignSelf: 'stretch',
  },
  sheet: {
    paddingTop: spacing.md,
    minHeight: 360,
    maxHeight: '78%',
  },
  handle: {
    alignSelf: 'center',
    width: 44,
    height: 5,
    borderRadius: 999,
    backgroundColor: colors.line,
    marginBottom: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  title: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '900',
  },
  subtitle: {
    color: colors.muted,
    fontSize: 13,
    marginTop: 4,
  },
  closeButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 999,
    backgroundColor: colors.accentSoft,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  closeText: {
    color: colors.accent,
    fontWeight: '900',
  },
  list: {
    maxHeight: 560,
  },
  listContent: {
    paddingBottom: spacing.lg,
  },
});

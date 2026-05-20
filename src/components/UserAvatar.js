import React, { useEffect, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import DEFAULT_AVATAR_URL from '../constants/defaultAvatar';

function shouldRenderImage(uri, failed) {
  if (!uri || failed) {
    return false;
  }

  return uri !== DEFAULT_AVATAR_URL && !String(uri).startsWith('data:image/svg');
}

export default function UserAvatar({ uri, size = 54, style }) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [uri]);

  if (shouldRenderImage(uri, failed)) {
    return (
      <Image
        source={{ uri }}
        style={[{ width: size, height: size, borderRadius: size / 2 }, style]}
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    <View style={[styles.placeholder, { width: size, height: size, borderRadius: size / 2 }, style]}>
      <View
        style={[
          styles.head,
          {
            width: size * 0.34,
            height: size * 0.34,
            borderRadius: size * 0.17,
            top: size * 0.2,
          },
        ]}
      />
      <View
        style={[
          styles.body,
          {
            width: size * 0.78,
            height: size * 0.46,
            borderRadius: size * 0.22,
            bottom: -size * 0.1,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  placeholder: {
    overflow: 'hidden',
    alignItems: 'center',
    backgroundColor: '#E5E7EB',
  },
  head: {
    position: 'absolute',
    backgroundColor: '#737A7D',
  },
  body: {
    position: 'absolute',
    backgroundColor: '#737A7D',
  },
});

import React, { useEffect, useRef, useState } from 'react';
import { Animated, Platform, StyleSheet } from 'react-native';

export default function AutoHideNotice({ children, delay = 5000, style }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    Animated.sequence([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 450,
        useNativeDriver: Platform.OS !== 'web',
      }),
      Animated.delay(delay),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 650,
        useNativeDriver: Platform.OS !== 'web',
      }),
    ]).start(() => setVisible(false));
  }, [delay, opacity]);

  if (!visible) {
    return null;
  }

  return (
    <Animated.View style={[styles.wrap, style, { opacity }]}>
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignSelf: 'stretch',
    pointerEvents: 'none',
  },
});

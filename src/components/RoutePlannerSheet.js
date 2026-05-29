import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import {
  formatRouteDistance,
  formatRouteDuration,
  ROUTE_VEHICLES,
} from '../services/routeService';
import colors from '../theme/colors';
import spacing from '../theme/spacing';
import GlassCard from './GlassCard';
import OrbitButton from './OrbitButton';

export default function RoutePlannerSheet({
  visible,
  target,
  vehicleId,
  routes,
  selectedRouteId,
  loading,
  error,
  onClose,
  onExit,
  onSelectVehicle,
  onSelectRoute,
  onStart,
}) {
  if (!visible || !target) {
    return null;
  }

  const selectedRoute = routes.find((route) => route.id === selectedRouteId) || routes[0];

  return (
    <View style={styles.overlay}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <Pressable style={styles.sheetWrap} onPress={(event) => event.stopPropagation?.()}>
        <GlassCard style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <View style={styles.headerText}>
              <Text style={styles.eyebrow}>Chỉ đường tới</Text>
              <Text style={styles.title} numberOfLines={1}>
                {target.name || 'Điểm đến'}
              </Text>
            </View>
            <Pressable style={styles.iconButton} onPress={onExit} hitSlop={10}>
              <Ionicons name="close" size={22} color={colors.text} />
            </Pressable>
          </View>

          <View style={styles.vehicleRow}>
            {ROUTE_VEHICLES.map((vehicle) => {
              const active = vehicle.id === vehicleId;
              return (
                <Pressable
                  key={vehicle.id}
                  onPress={() => onSelectVehicle(vehicle.id)}
                  style={[styles.vehicleButton, active && styles.vehicleButtonActive]}
                >
                  <Ionicons
                    name={vehicle.icon}
                    size={18}
                    color={active ? colors.background : colors.accent}
                  />
                  <Text style={[styles.vehicleText, active && styles.vehicleTextActive]}>
                    {vehicle.shortLabel}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.routeList}>
            {loading ? (
              <View style={styles.loadingBox}>
                <ActivityIndicator color={colors.accent} />
                <Text style={styles.loadingText}>Đang tìm các tuyến đường phù hợp...</Text>
              </View>
            ) : null}

            {!loading && error ? <Text style={styles.errorText}>{error}</Text> : null}
            {!error && routes.length ? (
              routes.map((route) => {
                const active = route.id === selectedRoute?.id;
                return (
                  <Pressable
                    key={route.id}
                    onPress={() => onSelectRoute(route.id)}
                    style={[styles.routeItem, active && styles.routeItemActive]}
                  >
                    <View style={styles.routeIconWrap}>
                      <Ionicons
                        name={active ? 'navigate-circle' : 'ellipse-outline'}
                        size={24}
                        color={active ? colors.accent : colors.muted}
                      />
                    </View>
                    <View style={styles.routeInfo}>
                      <Text style={styles.routeTitle}>{route.title}</Text>
                      <Text style={styles.routeMeta}>
                        {formatRouteDistance(route.distance)} · {formatRouteDuration(route.duration)}
                      </Text>
                      {route.summary ? (
                        <Text style={styles.routeSummary} numberOfLines={1}>
                          {route.summary}
                        </Text>
                      ) : null}
                    </View>
                  </Pressable>
                );
              })
            ) : null}
          </View>

          <View style={styles.footer}>
            <OrbitButton title="Thoát" variant="ghost" onPress={onExit} style={styles.footerButton} />
            <OrbitButton
              title="Bắt đầu"
              onPress={onStart}
              disabled={!selectedRoute || loading}
              style={styles.footerButton}
            />
          </View>
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
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  headerText: {
    flex: 1,
  },
  eyebrow: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  title: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '900',
    marginTop: 2,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accentSoft,
    borderWidth: 1,
    borderColor: colors.line,
  },
  vehicleRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  vehicleButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.cardStrong,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  vehicleButtonActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  vehicleText: {
    color: colors.accent,
    fontWeight: '900',
    fontSize: 13,
  },
  vehicleTextActive: {
    color: colors.background,
  },
  routeList: {
    marginTop: spacing.lg,
    gap: spacing.sm,
  },
  loadingBox: {
    minHeight: 88,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.cardStrong,
  },
  loadingText: {
    color: colors.muted,
    fontWeight: '700',
  },
  errorText: {
    color: colors.danger,
    fontWeight: '800',
    lineHeight: 20,
  },
  routeItem: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.cardStrong,
    opacity: 0.78,
  },
  routeItemActive: {
    borderColor: colors.accent,
    backgroundColor: colors.accentSoft,
    opacity: 1,
  },
  routeIconWrap: {
    paddingTop: 2,
  },
  routeInfo: {
    flex: 1,
  },
  routeTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '900',
  },
  routeMeta: {
    color: colors.accent,
    fontSize: 13,
    fontWeight: '800',
    marginTop: 4,
  },
  routeSummary: {
    color: colors.muted,
    fontSize: 12,
    marginTop: 4,
  },
  footer: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  footerButton: {
    flex: 1,
  },
});

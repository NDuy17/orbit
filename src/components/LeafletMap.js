import React, { useEffect, useMemo, useRef } from 'react';
import { Platform, StyleSheet } from 'react-native';
import colors, { getCurrentThemeName, themePalettes } from '../theme/colors';

function serializeForScript(value) {
  return JSON.stringify(value || null).replace(/</g, '\\u003c');
}

export function buildLeafletHtml({
  users,
  currentLocation,
  trails,
  clusterLocation,
  routePlan,
  recenterKey,
  locationReady,
}) {
  const mapPalette = themePalettes[getCurrentThemeName()] || themePalettes.dark;
  const initialData = serializeForScript({
    users: users || [],
    currentLocation,
    trails: trails || {},
    clusterLocation,
    routePlan,
    recenterKey,
    locationReady,
  });

  return `
<!DOCTYPE html>
<html>
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">
    <style>
      html, body, #map {
        width: 100%;
        height: 100%;
        margin: 0;
        background: ${mapPalette.background};
      }
      .leaflet-container {
        background: ${mapPalette.background};
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }
      .leaflet-control-attribution {
        background: rgba(5, 8, 22, 0.72);
        color: #94A3B8;
      }
      .leaflet-control-attribution a {
        color: #22D3EE;
      }
      .avatar-marker {
        position: relative;
        width: 58px;
        height: 58px;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .avatar-marker::before {
        content: "";
        position: absolute;
        width: 54px;
        height: 54px;
        border-radius: 50%;
        border: 2px solid #7C3AED;
        background: rgba(124, 58, 237, 0.18);
        box-shadow: 0 0 18px rgba(124, 58, 237, 0.35);
      }
      .avatar-marker.online::before {
        border-color: #22D3EE;
        box-shadow: 0 0 22px rgba(34, 211, 238, 0.8);
      }
      .avatar-marker img {
        position: relative;
        width: 42px;
        height: 42px;
        border-radius: 50%;
        border: 2px solid #F8FAFC;
        object-fit: cover;
      }
      .status-dot {
        position: absolute;
        right: 6px;
        bottom: 7px;
        width: 13px;
        height: 13px;
        border-radius: 50%;
        border: 2px solid #050816;
      }
      .current-marker {
        width: 34px;
        height: 34px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        border: 1px solid #22D3EE;
        background: rgba(34, 211, 238, 0.16);
        box-shadow: 0 0 22px rgba(34, 211, 238, 0.75);
      }
      .current-marker span {
        width: 14px;
        height: 14px;
        border-radius: 50%;
        background: #22D3EE;
      }
      .cluster-marker {
        width: 50px;
        height: 50px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        color: #F8FAFC;
        font-size: 18px;
        font-weight: 900;
        background: #7C3AED;
        border: 2px solid #22D3EE;
        box-shadow: 0 0 18px rgba(34, 211, 238, 0.55);
      }
      .user-group-marker {
        position: relative;
        width: 58px;
        height: 58px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        color: #F8FAFC;
        font-size: 17px;
        font-weight: 900;
        background: linear-gradient(135deg, #7C3AED, #0891B2);
        border: 2px solid #F8FAFC;
        box-shadow: 0 0 0 8px rgba(34, 211, 238, 0.18), 0 14px 32px rgba(8, 13, 31, 0.32);
      }
      .user-group-marker::after {
        content: "";
        position: absolute;
        right: 5px;
        bottom: 6px;
        width: 12px;
        height: 12px;
        border-radius: 50%;
        background: #22C55E;
        border: 2px solid #050816;
      }
      .meet-point {
        width: 22px;
        height: 22px;
        border-radius: 50%;
        background: #7C3AED;
        border: 3px solid #F8FAFC;
        box-shadow: 0 0 22px rgba(124, 58, 237, 0.9);
      }
      .route-status {
        position: absolute;
        left: 14px;
        right: 14px;
        bottom: 18px;
        z-index: 800;
        display: none;
        align-items: center;
        justify-content: center;
        gap: 8px;
        pointer-events: none;
      }
      .route-status span {
        max-width: min(420px, calc(100vw - 28px));
        padding: 9px 13px;
        border-radius: 999px;
        background: rgba(5, 8, 22, 0.84);
        color: #F8FAFC;
        border: 1px solid rgba(34, 211, 238, 0.42);
        box-shadow: 0 10px 30px rgba(5, 8, 22, 0.26);
        font-size: 13px;
        font-weight: 800;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
    </style>
  </head>
  <body>
    <div id="map"></div>
    <div id="route-status" class="route-status"><span></span></div>
    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
    <script>
      const initialData = ${initialData};
      let userMarkers = {};
      let routeLayers = [];
      let activeRouteRenderKey = '';
      let trailLayers = [];
      let currentMarker = null;
      let currentCircle = null;
      let clusterMarker = null;
      let latestUsers = initialData.users || [];
      let latestRoutePlan = initialData.routePlan || null;
      let lastRecenterKey = initialData.recenterKey || 0;
      let hasCenteredOnReadyLocation = Boolean(initialData.locationReady);
      let latestCurrentLocation = hasLocation(initialData.currentLocation) ? initialData.currentLocation : null;
      let isNavigationActive = Boolean(initialData.routePlan && initialData.routePlan.navigationActive);
      let isAwayFromCurrent = false;
      let userMovedMapManually = false;
      let isProgrammaticMove = false;

      function escapeValue(value) {
        return String(value || '')
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#039;');
      }

      function hasLocation(value) {
        return value && Number.isFinite(Number(value.latitude)) && Number.isFinite(Number(value.longitude));
      }

      function getLatLng(location) {
        return [Number(location.latitude), Number(location.longitude)];
      }

      function getLngLat(location) {
        return [Number(location.longitude), Number(location.latitude)];
      }

      function roundRouteCoord(value) {
        return Math.round(Number(value) * 10000) / 10000;
      }

      function getRouteKey(startLocation, endLocation) {
        return [
          roundRouteCoord(startLocation.latitude),
          roundRouteCoord(startLocation.longitude),
          roundRouteCoord(endLocation.latitude),
          roundRouteCoord(endLocation.longitude)
        ].join(',');
      }

      function formatRouteDistance(meters) {
        if (!Number.isFinite(Number(meters))) {
          return '';
        }

        return meters < 1000
          ? Math.round(meters) + 'm'
          : (meters / 1000).toFixed(1) + 'km';
      }

      function formatRouteDuration(seconds) {
        if (!Number.isFinite(Number(seconds))) {
          return '';
        }

        const minutes = Math.max(1, Math.round(seconds / 60));
        if (minutes < 60) {
          return minutes + ' phút';
        }

        const hours = Math.floor(minutes / 60);
        const remainingMinutes = minutes % 60;
        return remainingMinutes ? hours + ' giờ ' + remainingMinutes + ' phút' : hours + ' giờ';
      }

      function clearLayers(layers) {
        layers.forEach((layer) => map.removeLayer(layer));
        layers.length = 0;
      }

      function setRouteStatus(text) {
        const element = document.getElementById('route-status');
        if (!element) {
          return;
        }

        const label = element.querySelector('span');
        if (!text) {
          element.style.display = 'none';
          if (label) {
            label.textContent = '';
          }
          return;
        }

        if (label) {
          label.textContent = text;
        }
        element.style.display = 'flex';
      }

      function getIconKey(user) {
        return [user.avatar || '', user.name || '', user.isOnline ? '1' : '0'].join('|');
      }

      function getGroupKey(users) {
        return users.map((user) => String(user.id)).sort().join('|');
      }

      function animateLatLng(layer, nextLatLng, duration) {
        const start = layer.getLatLng();
        const end = L.latLng(nextLatLng);

        if (start.distanceTo(end) < 1) {
          layer.setLatLng(end);
          return;
        }

        if (layer._orbitAnimation) {
          cancelAnimationFrame(layer._orbitAnimation);
        }

        const startedAt = performance.now();
        const animate = function(now) {
          const progress = Math.min((now - startedAt) / duration, 1);
          const eased = 1 - Math.pow(1 - progress, 3);
          const lat = start.lat + (end.lat - start.lat) * eased;
          const lng = start.lng + (end.lng - start.lng) * eased;
          layer.setLatLng([lat, lng]);

          if (progress < 1) {
            layer._orbitAnimation = requestAnimationFrame(animate);
          } else {
            layer._orbitAnimation = null;
          }
        };

        layer._orbitAnimation = requestAnimationFrame(animate);
      }

      function postToApp(message) {
        const value = JSON.stringify(message);
        if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
          window.ReactNativeWebView.postMessage(value);
        } else if (window.parent) {
          window.parent.postMessage(value, '*');
        }
      }

      function updateAwayFromCurrent() {
        if (!latestCurrentLocation || !userMovedMapManually) {
          return;
        }

        const currentLatLng = L.latLng(getLatLng(latestCurrentLocation));
        const distance = map.getCenter().distanceTo(currentLatLng);
        const nextAway = distance > 220;

        if (nextAway !== isAwayFromCurrent) {
          isAwayFromCurrent = nextAway;
          postToApp({ type: 'awayFromUserChanged', isAwayFromUser: nextAway });
        }
      }

      const startLocation = hasLocation(initialData.currentLocation)
        ? initialData.currentLocation
        : { latitude: 21.0285, longitude: 105.8542 };

      const map = L.map('map', {
        zoomControl: false,
        attributionControl: true
      }).setView(getLatLng(startLocation), 15);

      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap'
      }).addTo(map);

      const currentIcon = L.divIcon({
        html: '<div class="current-marker"><span></span></div>',
        className: '',
        iconSize: [34, 34],
        iconAnchor: [17, 17]
      });

      function drawCurrent(location) {
        if (!hasLocation(location)) {
          return;
        }

        latestCurrentLocation = location;
        const latLng = getLatLng(location);
        if (currentMarker) {
          animateLatLng(currentMarker, latLng, 900);
        } else {
          currentMarker = L.marker(latLng, { icon: currentIcon }).addTo(map);
        }

        if (currentCircle) {
          animateLatLng(currentCircle, latLng, 900);
        } else {
          currentCircle = L.circle(latLng, {
            radius: 180,
            color: 'rgba(34, 211, 238, 0.38)',
            fillColor: 'rgba(34, 211, 238, 0.08)',
            fillOpacity: 1,
            weight: 1
          }).addTo(map);
        }
      }

      function centerOnCurrent(location) {
        if (!hasLocation(location)) {
          return;
        }

        isProgrammaticMove = true;
        map.once('moveend', function() {
          isProgrammaticMove = false;
        });
        map.setView(getLatLng(location), Math.max(map.getZoom(), 16), {
          animate: true,
          duration: 0.4
        });
      }

      function buildUserIcon(user) {
        const iconHtml = '<div class="avatar-marker ' + (user.isOnline ? 'online' : '') + '">' +
          '<img src="' + escapeValue(user.avatar) + '" alt="' + escapeValue(user.name) + '">' +
          '<span class="status-dot" style="background:' + (user.isOnline ? '#22C55E' : '#64748B') + '"></span>' +
        '</div>';

        return L.divIcon({
          html: iconHtml,
          className: '',
          iconSize: [58, 58],
          iconAnchor: [29, 29]
        });
      }

      function buildUserGroupIcon(group) {
        return L.divIcon({
          html: '<div class="user-group-marker">' + escapeValue(group.users.length) + '</div>',
          className: '',
          iconSize: [58, 58],
          iconAnchor: [29, 29]
        });
      }

      function getGroupLocation(group) {
        const total = group.users.reduce((sum, user) => ({
          latitude: sum.latitude + Number(user.location.latitude),
          longitude: sum.longitude + Number(user.location.longitude)
        }), { latitude: 0, longitude: 0 });

        return {
          latitude: total.latitude / group.users.length,
          longitude: total.longitude / group.users.length
        };
      }

      function groupCloseUsers(users) {
        const threshold = 46;
        const groups = [];

        (users || []).forEach((user) => {
          if (!hasLocation(user.location)) {
            return;
          }

          const point = map.latLngToLayerPoint(getLatLng(user.location));
          let targetGroup = null;

          for (const group of groups) {
            if (point.distanceTo(group.point) <= threshold) {
              targetGroup = group;
              break;
            }
          }

          if (!targetGroup) {
            groups.push({
              point,
              users: [user]
            });
            return;
          }

          targetGroup.users.push(user);
          targetGroup.point = L.point(
            (targetGroup.point.x * (targetGroup.users.length - 1) + point.x) / targetGroup.users.length,
            (targetGroup.point.y * (targetGroup.users.length - 1) + point.y) / targetGroup.users.length
          );
        });

        return groups;
      }

      function drawUsers(nextUsers) {
        latestUsers = nextUsers || [];
        const nextIds = new Set();

        groupCloseUsers(latestUsers).forEach((group) => {
          const isGroup = group.users.length > 1;
          const user = group.users[0];
          const markerKey = isGroup ? 'group:' + getGroupKey(group.users) : 'user:' + String(user.id);
          const location = isGroup ? getGroupLocation(group) : user.location;
          const latLng = getLatLng(location);
          const existingMarker = userMarkers[markerKey];
          const nextIconKey = isGroup
            ? 'group|' + group.users.length + '|' + getGroupKey(group.users)
            : getIconKey(user);

          nextIds.add(markerKey);

          if (existingMarker) {
            animateLatLng(existingMarker, latLng, 900);
            if (existingMarker._orbitIconKey !== nextIconKey) {
              existingMarker.setIcon(isGroup ? buildUserGroupIcon(group) : buildUserIcon(user));
              existingMarker._orbitIconKey = nextIconKey;
            }
            return;
          }

          const marker = L.marker(latLng, {
            icon: isGroup ? buildUserGroupIcon(group) : buildUserIcon(user)
          }).addTo(map);
          marker._orbitIconKey = nextIconKey;

          marker.on('click', () => {
            if (isGroup) {
              postToApp({ type: 'selectUserGroup', userIds: group.users.map((item) => item.id) });
              return;
            }

            postToApp({ type: 'selectUser', userId: user.id });
          });

          userMarkers[markerKey] = marker;
        });

        Object.keys(userMarkers).forEach((id) => {
          if (!nextIds.has(id)) {
            map.removeLayer(userMarkers[id]);
            delete userMarkers[id];
          }
        });
      }

      function getRouteTarget(routePlan) {
        return routePlan ? routePlan.target || routePlan : null;
      }

      function getSelectedRoute(routePlan) {
        const routes = Array.isArray(routePlan?.routes) ? routePlan.routes : [];
        return routes.find((route) => route.id === routePlan.selectedRouteId) || routes[0] || null;
      }

      function getRoutePoints(route) {
        return (route?.coordinates || [])
          .map((coord) => [Number(coord[1]), Number(coord[0])])
          .filter((coord) => Number.isFinite(coord[0]) && Number.isFinite(coord[1]));
      }

      function getRouteRenderKey(routePlan, nextCurrentLocation) {
        if (!routePlan) {
          return '';
        }

        const target = getRouteTarget(routePlan);
        const routesKey = (routePlan.routes || [])
          .map((route) => [route.id, route.coordinates?.length || 0, route.distance, route.duration].join(':'))
          .join('|');
        const fallbackKey =
          !routesKey && hasLocation(nextCurrentLocation) && hasLocation(target?.location)
            ? getRouteKey(nextCurrentLocation, target.location)
            : '';

        return [
          target?.id || '',
          routePlan.vehicleId || '',
          routePlan.selectedRouteId || '',
          routePlan.navigationActive ? 'nav' : 'preview',
          routePlan.loading ? 'loading' : 'ready',
          routePlan.error || '',
          routesKey,
          fallbackKey
        ].join('~');
      }

      function drawRouteEndpoints(routePoints, targetName) {
        if (!routePoints.length) {
          return;
        }

        const startCircle = L.circle(routePoints[0], {
          radius: 70,
          color: 'rgba(34, 211, 238, 0.75)',
          fillColor: 'rgba(34, 211, 238, 0.12)',
          fillOpacity: 1,
          weight: 2
        }).addTo(map);

        const meetMarker = L.marker(routePoints[routePoints.length - 1], {
          icon: L.divIcon({
            html: '<div class="meet-point"></div>',
            className: '',
            iconSize: [22, 22],
            iconAnchor: [11, 11]
          }),
          title: targetName || 'Điểm đến'
        }).addTo(map);

        routeLayers.push(startCircle, meetMarker);
      }

      function fitRouteBounds(routeLine) {
        isProgrammaticMove = true;
        map.once('moveend', function() {
          isProgrammaticMove = false;
        });
        map.fitBounds(routeLine.getBounds(), {
          padding: [80, 80],
          maxZoom: 17
        });
      }

      function drawRouteLine(routePoints, options) {
        const routeLine = L.polyline(routePoints, {
          color: options.color,
          weight: options.weight,
          opacity: options.opacity,
          dashArray: options.dashArray || null,
          lineCap: 'round',
          lineJoin: 'round'
        }).addTo(map);

        if (options.routeId) {
          routeLine.on('click', function() {
            postToApp({ type: 'selectRoute', routeId: options.routeId });
          });
        }

        routeLayers.push(routeLine);
        return routeLine;
      }

      function drawFallbackRoute(startLocation, endLocation, targetName) {
        const routePoints = [getLatLng(startLocation), getLatLng(endLocation)];
        clearLayers(routeLayers);
        const routeLine = drawRouteLine(routePoints, {
          color: '#F59E0B',
          weight: 4,
          opacity: 0.78,
          dashArray: '8, 12'
        });
        drawRouteEndpoints(routePoints, targetName);
        fitRouteBounds(routeLine);
      }

      function drawRoutePlan(nextRoutePlan, nextCurrentLocation) {
        latestRoutePlan = nextRoutePlan || null;
        isNavigationActive = Boolean(nextRoutePlan?.navigationActive);

        const target = getRouteTarget(nextRoutePlan);
        if (!hasLocation(nextCurrentLocation) || !target || !hasLocation(target.location)) {
          activeRouteRenderKey = '';
          clearLayers(routeLayers);
          setRouteStatus('');
          return;
        }

        const renderKey = getRouteRenderKey(nextRoutePlan, nextCurrentLocation);
        if (renderKey === activeRouteRenderKey) {
          if (isNavigationActive && !userMovedMapManually) {
            centerOnCurrent(nextCurrentLocation);
          }
          return;
        }

        activeRouteRenderKey = renderKey;
        const targetName = target.name || 'điểm đến';
        const routes = Array.isArray(nextRoutePlan.routes) ? nextRoutePlan.routes : [];
        const selectedRoute = getSelectedRoute(nextRoutePlan);

        if (!routes.length || !selectedRoute) {
          drawFallbackRoute(nextCurrentLocation, target.location, targetName);
          setRouteStatus(
            nextRoutePlan.error ||
              (nextRoutePlan.loading
                ? 'Đang tìm các tuyến đường phù hợp tới ' + targetName + '...'
                : 'Chưa có tuyến đường phù hợp, đang hiển thị hướng tham khảo.')
          );
          if (isNavigationActive && !userMovedMapManually) {
            centerOnCurrent(nextCurrentLocation);
          }
          return;
        }

        clearLayers(routeLayers);
        let selectedRouteLine = null;
        const selectedRouteId = selectedRoute.id;

        routes.forEach((route) => {
          if (route.id === selectedRouteId) {
            return;
          }

          const routePoints = getRoutePoints(route);
          if (routePoints.length < 2) {
            return;
          }

          drawRouteLine(routePoints, {
            color: '#94A3B8',
            weight: 5,
            opacity: 0.36,
            routeId: route.id
          });
        });

        const selectedRoutePoints = getRoutePoints(selectedRoute);
        if (selectedRoutePoints.length >= 2) {
          selectedRouteLine = drawRouteLine(selectedRoutePoints, {
            color: '#22D3EE',
            weight: 7,
            opacity: 0.98,
            routeId: selectedRoute.id
          });
          drawRouteEndpoints(selectedRoutePoints, targetName);
        }

        setRouteStatus(
          (isNavigationActive && nextRoutePlan.loading
            ? 'Đang cập nhật đường tới '
            : isNavigationActive
              ? 'Đang chỉ đường tới '
              : 'Đường bộ tới ') +
            targetName +
            ': ' +
            formatRouteDistance(selectedRoute.distance) +
            ' · ' +
            formatRouteDuration(selectedRoute.duration)
        );

        if (isNavigationActive && !userMovedMapManually) {
          if (isAwayFromCurrent) {
            isAwayFromCurrent = false;
            postToApp({ type: 'awayFromUserChanged', isAwayFromUser: false });
          }
          centerOnCurrent(nextCurrentLocation);
        } else if (selectedRouteLine) {
          fitRouteBounds(selectedRouteLine);
        }
      }

      function drawTrails(nextTrails) {
        clearLayers(trailLayers);
        Object.keys(nextTrails || {}).forEach((id) => {
          const points = (nextTrails[id] || []).filter(hasLocation).map(getLatLng);
          if (points.length < 2) {
            return;
          }

          const trail = L.polyline(points, {
            color: 'rgba(34, 211, 238, 0.72)',
            weight: 3,
            opacity: 0.9
          }).addTo(map);
          trailLayers.push(trail);
        });
      }

      function drawCluster(nextClusterLocation) {
        if (clusterMarker) {
          map.removeLayer(clusterMarker);
          clusterMarker = null;
        }

        if (!hasLocation(nextClusterLocation)) {
          return;
        }

        clusterMarker = L.marker(getLatLng(nextClusterLocation), {
          icon: L.divIcon({
            html: '<div class="cluster-marker">' + escapeValue(nextClusterLocation.count) + '</div>',
            className: '',
            iconSize: [50, 50],
            iconAnchor: [25, 25]
          })
        }).addTo(map);
      }

      window.handleUpdate = function(data) {
        const nextData = data || {};
        const nextLocation = hasLocation(nextData.currentLocation)
          ? nextData.currentLocation
          : initialData.currentLocation;

        drawCurrent(nextLocation);
        drawUsers(nextData.users || []);
        drawRoutePlan(nextData.routePlan, nextLocation);

        if (nextData.locationReady && !hasCenteredOnReadyLocation) {
          hasCenteredOnReadyLocation = true;
          centerOnCurrent(nextLocation);
        } else if (nextData.recenterKey !== undefined && nextData.recenterKey !== lastRecenterKey) {
          lastRecenterKey = nextData.recenterKey;
          isAwayFromCurrent = false;
          userMovedMapManually = false;
          postToApp({ type: 'awayFromUserChanged', isAwayFromUser: false });
          centerOnCurrent(nextLocation);
        } else if (nextData.routePlan?.navigationActive && !userMovedMapManually) {
          centerOnCurrent(nextLocation);
        } else if (!userMovedMapManually && !nextData.routePlan) {
          centerOnCurrent(nextLocation);
        }

        if ('trails' in nextData) {
          drawTrails(nextData.trails || {});
        }

        if ('clusterLocation' in nextData) {
          drawCluster(nextData.clusterLocation);
        }
      };

      window.addEventListener('message', function(event) {
        let data = event.data;
        if (typeof data === 'string') {
          try {
            data = JSON.parse(data);
          } catch (error) {
            return;
          }
        }

        if (data && data.type === 'updateData') {
          window.handleUpdate(data);
        }
      });

      drawCurrent(initialData.currentLocation);
      if (!initialData.routePlan) {
        centerOnCurrent(initialData.currentLocation);
      }
      drawTrails(initialData.trails || {});
      drawUsers(initialData.users || []);
      drawRoutePlan(initialData.routePlan, initialData.currentLocation);
      drawCluster(initialData.clusterLocation);
      map.on('dragstart zoomstart', function() {
        if (!isProgrammaticMove) {
          userMovedMapManually = true;
        }
      });
      map.on('zoomend', function() {
        drawUsers(latestUsers);
      });
      map.on('moveend', updateAwayFromCurrent);
    </script>
  </body>
</html>`;
}

export default function LeafletMap({
  users,
  currentLocation,
  trails,
  clusterLocation,
  routePlan,
  recenterKey = 0,
  locationReady = false,
  onAwayFromUserChange,
  onSelectUser,
  onSelectUserGroup,
  onSelectRoute,
}) {
  const webViewRef = useRef(null);
  const iframeRef = useRef(null);
  const initialHtmlRef = useRef(null);

  if (!initialHtmlRef.current) {
    initialHtmlRef.current = buildLeafletHtml({
      users,
      currentLocation,
      trails,
      clusterLocation,
      routePlan,
      recenterKey,
      locationReady,
    });
  }

  const html = initialHtmlRef.current;
  const webViewSource = useMemo(() => ({ html }), [html]);
  const updateData = useMemo(
    () => ({
      type: 'updateData',
      users: users || [],
      currentLocation,
      routePlan,
      recenterKey,
      locationReady,
      trails: trails || {},
      clusterLocation,
    }),
    [clusterLocation, currentLocation, locationReady, recenterKey, routePlan, trails, users]
  );

  function sendUpdateToWebFrame() {
    iframeRef.current?.contentWindow?.postMessage(updateData, '*');
  }

  useEffect(() => {
    if (Platform.OS === 'web') {
      sendUpdateToWebFrame();
      return;
    }

    webViewRef.current?.injectJavaScript(
      `window.handleUpdate && window.handleUpdate(${serializeForScript(updateData)}); true;`
    );
  }, [updateData]);

  useEffect(() => {
    if (Platform.OS !== 'web') {
      return undefined;
    }

    function handleWebMessage(event) {
      try {
        const message = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        if (message.type === 'selectUser') {
          const user = users.find((item) => item.id === message.userId);
          onSelectUser(user);
        } else if (message.type === 'selectUserGroup') {
          const userIdSet = new Set(message.userIds || []);
          const groupUsers = users.filter((item) => userIdSet.has(item.id));
          onSelectUserGroup?.(groupUsers);
        } else if (message.type === 'selectRoute') {
          onSelectRoute?.(message.routeId);
        } else if (message.type === 'awayFromUserChanged') {
          onAwayFromUserChange?.(Boolean(message.isAwayFromUser));
        }
      } catch (error) {
        return;
      }
    }

    window.addEventListener('message', handleWebMessage);
    return () => window.removeEventListener('message', handleWebMessage);
  }, [onAwayFromUserChange, onSelectRoute, onSelectUser, onSelectUserGroup, users]);

  if (Platform.OS === 'web') {
    return React.createElement('iframe', {
      ref: iframeRef,
      title: 'Orbit Leaflet Map',
      srcDoc: html,
      onLoad: sendUpdateToWebFrame,
      style: {
        width: '100%',
        height: '100%',
        border: 0,
        display: 'block',
        backgroundColor: colors.background,
      },
    });
  }

  function handleMessage(event) {
    try {
      const message = JSON.parse(event.nativeEvent.data);
      if (message.type === 'selectUser') {
        const user = users.find((item) => item.id === message.userId);
        onSelectUser(user);
      } else if (message.type === 'selectUserGroup') {
        const userIdSet = new Set(message.userIds || []);
        const groupUsers = users.filter((item) => userIdSet.has(item.id));
        onSelectUserGroup?.(groupUsers);
      } else if (message.type === 'selectRoute') {
        onSelectRoute?.(message.routeId);
      } else if (message.type === 'awayFromUserChanged') {
        onAwayFromUserChange?.(Boolean(message.isAwayFromUser));
      }
    } catch (error) {
      onSelectUser(null);
    }
  }

  const WebView = require('react-native-webview').default;

  return (
    <WebView
      ref={webViewRef}
      originWhitelist={['*']}
      source={webViewSource}
      style={styles.webview}
      onMessage={handleMessage}
      javaScriptEnabled
      domStorageEnabled
      scrollEnabled={false}
    />
  );
}

const styles = StyleSheet.create({
  webview: {
    flex: 1,
    backgroundColor: colors.background,
  },
});

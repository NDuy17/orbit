import React, { useEffect, useMemo, useRef } from 'react';
import { Platform, StyleSheet } from 'react-native';
import colors from '../theme/colors';

function serializeForScript(value) {
  return JSON.stringify(value || null).replace(/</g, '\\u003c');
}

export function buildLeafletHtml({ users, currentLocation, trails, clusterLocation, routeTarget }) {
  const initialData = serializeForScript({
    users: users || [],
    currentLocation,
    trails: trails || {},
    clusterLocation,
    routeTarget,
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
        background: ${colors.background};
      }
      .leaflet-container {
        background: ${colors.background};
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
      .meet-point {
        width: 22px;
        height: 22px;
        border-radius: 50%;
        background: #7C3AED;
        border: 3px solid #F8FAFC;
        box-shadow: 0 0 22px rgba(124, 58, 237, 0.9);
      }
    </style>
  </head>
  <body>
    <div id="map"></div>
    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
    <script>
      const initialData = ${initialData};
      let userMarkers = [];
      let routeLayers = [];
      let trailLayers = [];
      let currentMarker = null;
      let currentCircle = null;
      let clusterMarker = null;

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

      function clearLayers(layers) {
        layers.forEach((layer) => map.removeLayer(layer));
        layers.length = 0;
      }

      function postToApp(message) {
        const value = JSON.stringify(message);
        if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
          window.ReactNativeWebView.postMessage(value);
        } else if (window.parent) {
          window.parent.postMessage(value, '*');
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

        const latLng = getLatLng(location);
        if (currentMarker) {
          currentMarker.setLatLng(latLng);
        } else {
          currentMarker = L.marker(latLng, { icon: currentIcon }).addTo(map);
        }

        if (currentCircle) {
          currentCircle.setLatLng(latLng);
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

      function drawUsers(nextUsers) {
        clearLayers(userMarkers);
        (nextUsers || []).forEach((user) => {
          if (!hasLocation(user.location)) {
            return;
          }

          const marker = L.marker(getLatLng(user.location), {
            icon: buildUserIcon(user)
          }).addTo(map);

          marker.on('click', () => {
            postToApp({ type: 'selectUser', userId: user.id });
          });

          userMarkers.push(marker);
        });
      }

      function drawRoute(nextRouteTarget, nextCurrentLocation) {
        clearLayers(routeLayers);
        if (!hasLocation(nextCurrentLocation) || !nextRouteTarget || !hasLocation(nextRouteTarget.location)) {
          return;
        }

        const routePoints = [getLatLng(nextCurrentLocation), getLatLng(nextRouteTarget.location)];
        const routeLine = L.polyline(routePoints, {
          color: '#22D3EE',
          weight: 5,
          opacity: 0.95,
          dashArray: '10, 10',
          lineCap: 'round'
        }).addTo(map);

        const startCircle = L.circle(routePoints[0], {
          radius: 70,
          color: 'rgba(34, 211, 238, 0.75)',
          fillColor: 'rgba(34, 211, 238, 0.12)',
          fillOpacity: 1,
          weight: 2
        }).addTo(map);

        const meetMarker = L.marker(routePoints[1], {
          icon: L.divIcon({
            html: '<div class="meet-point"></div>',
            className: '',
            iconSize: [22, 22],
            iconAnchor: [11, 11]
          })
        }).addTo(map);

        routeLayers.push(routeLine, startCircle, meetMarker);
        map.fitBounds(routeLine.getBounds(), {
          padding: [80, 80],
          maxZoom: 17
        });
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
        drawRoute(nextData.routeTarget, nextLocation);

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
      drawTrails(initialData.trails || {});
      drawUsers(initialData.users || []);
      drawRoute(initialData.routeTarget, initialData.currentLocation);
      drawCluster(initialData.clusterLocation);
    </script>
  </body>
</html>`;
}

export default function LeafletMap({
  users,
  currentLocation,
  trails,
  clusterLocation,
  routeTarget,
  onSelectUser,
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
      routeTarget,
    });
  }

  const html = initialHtmlRef.current;
  const webViewSource = useMemo(() => ({ html }), [html]);
  const updateData = useMemo(
    () => ({
      type: 'updateData',
      users: users || [],
      currentLocation,
      routeTarget,
      trails: trails || {},
      clusterLocation,
    }),
    [clusterLocation, currentLocation, routeTarget, trails, users]
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
        }
      } catch (error) {
        return;
      }
    }

    window.addEventListener('message', handleWebMessage);
    return () => window.removeEventListener('message', handleWebMessage);
  }, [onSelectUser, users]);

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

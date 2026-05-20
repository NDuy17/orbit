import React, { useEffect, useMemo } from 'react';
import { Platform, StyleSheet } from 'react-native';
import colors from '../theme/colors';

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function buildLeafletHtml({ users, currentLocation, trails, clusterLocation, routeTarget }) {
  const safeUsers = JSON.stringify(users);
  const safeCurrentLocation = JSON.stringify(currentLocation);
  const safeTrails = JSON.stringify(trails || {});
  const safeClusterLocation = JSON.stringify(clusterLocation);
  const safeRouteTarget = JSON.stringify(routeTarget);

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
      const users = ${safeUsers};
      const currentLocation = ${safeCurrentLocation};
      const trails = ${safeTrails};
      const clusterLocation = ${safeClusterLocation};
      const routeTarget = ${safeRouteTarget};

      const map = L.map('map', {
        zoomControl: false,
        attributionControl: true
      }).setView([currentLocation.latitude, currentLocation.longitude], 15);

      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap'
      }).addTo(map);

      L.circle([currentLocation.latitude, currentLocation.longitude], {
        radius: 180,
        color: 'rgba(34, 211, 238, 0.38)',
        fillColor: 'rgba(34, 211, 238, 0.08)',
        fillOpacity: 1,
        weight: 1
      }).addTo(map);

      const currentIcon = L.divIcon({
        html: '<div class="current-marker"><span></span></div>',
        className: '',
        iconSize: [34, 34],
        iconAnchor: [17, 17]
      });

      L.marker([currentLocation.latitude, currentLocation.longitude], { icon: currentIcon }).addTo(map);

      if (routeTarget && routeTarget.location) {
        const routePoints = [
          [currentLocation.latitude, currentLocation.longitude],
          [routeTarget.location.latitude, routeTarget.location.longitude]
        ];

        const routeLine = L.polyline(routePoints, {
          color: '#22D3EE',
          weight: 5,
          opacity: 0.95,
          dashArray: '10, 10',
          lineCap: 'round'
        }).addTo(map);

        L.circle(routePoints[0], {
          radius: 70,
          color: 'rgba(34, 211, 238, 0.75)',
          fillColor: 'rgba(34, 211, 238, 0.12)',
          fillOpacity: 1,
          weight: 2
        }).addTo(map);

        L.marker(routePoints[1], {
          icon: L.divIcon({
            html: '<div class="meet-point"></div>',
            className: '',
            iconSize: [22, 22],
            iconAnchor: [11, 11]
          })
        }).addTo(map);

        map.fitBounds(routeLine.getBounds(), {
          padding: [80, 80],
          maxZoom: 17
        });
      }

      Object.keys(trails).forEach((id) => {
        L.polyline(trails[id].map((point) => [point.latitude, point.longitude]), {
          color: 'rgba(34, 211, 238, 0.72)',
          weight: 3,
          opacity: 0.9
        }).addTo(map);
      });

      users.forEach((user) => {
        const iconHtml = '<div class="avatar-marker ' + (user.isOnline ? 'online' : '') + '">' +
          '<img src="' + user.avatar + '" alt="' + user.name + '">' +
          '<span class="status-dot" style="background:' + (user.isOnline ? '#22C55E' : '#64748B') + '"></span>' +
        '</div>';

        const marker = L.marker([user.location.latitude, user.location.longitude], {
          icon: L.divIcon({
            html: iconHtml,
            className: '',
            iconSize: [58, 58],
            iconAnchor: [29, 29]
          })
        }).addTo(map);

        marker.on('click', () => {
          const message = JSON.stringify({ type: 'selectUser', userId: user.id });
          if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
            window.ReactNativeWebView.postMessage(message);
          } else if (window.parent) {
            window.parent.postMessage(message, '*');
          }
        });
      });

      if (clusterLocation) {
        L.marker([clusterLocation.latitude, clusterLocation.longitude], {
          icon: L.divIcon({
            html: '<div class="cluster-marker">' + clusterLocation.count + '</div>',
            className: '',
            iconSize: [50, 50],
            iconAnchor: [25, 25]
          })
        }).addTo(map);
      }
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
  const html = useMemo(
    () => buildLeafletHtml({ users, currentLocation, trails, clusterLocation, routeTarget }),
    [users, currentLocation, trails, clusterLocation, routeTarget]
  );

  useEffect(() => {
    if (Platform.OS !== 'web') {
      return undefined;
    }

    function handleWebMessage(event) {
      try {
        const message = JSON.parse(event.data);
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
      title: 'Orbit Leaflet Map',
      srcDoc: html,
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
      originWhitelist={['*']}
      source={{ html }}
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

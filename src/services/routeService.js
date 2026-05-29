const OSRM_BASE_URL = 'https://router.project-osrm.org/route/v1';
const OVERPASS_ENDPOINT = 'https://overpass-api.de/api/interpreter';
const EARTH_RADIUS_METERS = 6371000;
const MOTORBIKE_VALIDATION_MAX_DISTANCE_METERS = 80000;
const MOTORBIKE_VALIDATION_MATCH_METERS = 42;
const VEHICLE_SPEED_PROFILES = {
  walking: {
    shortKmh: 4.5,
    longKmh: 5,
    longDistanceMeters: 3000,
  },
  motorbike: {
    shortKmh: 28,
    longKmh: 42,
    longDistanceMeters: 18000,
  },
  car: {
    shortKmh: 22,
    longKmh: 72,
    longDistanceMeters: 30000,
  },
};

export const ROUTE_VEHICLES = [
  {
    id: 'motorbike',
    label: 'Xe máy',
    shortLabel: 'Xe máy',
    icon: 'bicycle-outline',
    profile: 'driving',
    strategies: [
      {
        id: 'avoid-motorway',
        profile: 'driving',
        exclude: 'motorway',
        warning: null,
      },
      {
        id: 'validated-driving',
        profile: 'driving',
        exclude: null,
        warning: 'Tuyến này được kiểm tra theo dữ liệu đường OSM để tránh đường cấm xe máy.',
      },
      {
        id: 'bike-fallback',
        profile: 'bike',
        exclude: null,
        warning: 'OSRM không tìm được tuyến xe máy chuẩn, đang dùng tuyến tránh cao tốc gần nhất và kiểm tra đường cấm theo OSM.',
      },
    ],
    requiresRoadSafety: true,
    note: 'Không đi cao tốc',
  },
  {
    id: 'car',
    label: 'Ô tô',
    shortLabel: 'Ô tô',
    icon: 'car-sport-outline',
    profile: 'driving',
    strategies: [{ id: 'driving', profile: 'driving', exclude: null, warning: null }],
    requiresRoadSafety: false,
    note: 'Có thể đi cao tốc',
  },
  {
    id: 'walking',
    label: 'Đi bộ',
    shortLabel: 'Đi bộ',
    icon: 'walk-outline',
    profile: 'foot',
    strategies: [{ id: 'foot', profile: 'foot', exclude: null, warning: null }],
    requiresRoadSafety: true,
    note: 'Ưu tiên đường ngắn',
  },
];

function hasLocation(value) {
  return value && Number.isFinite(Number(value.latitude)) && Number.isFinite(Number(value.longitude));
}

function getLngLat(location) {
  return [Number(location.longitude), Number(location.latitude)];
}

function roundRouteCoord(value) {
  return Math.round(Number(value) * 10000) / 10000;
}

function getRouteCacheKey({ startLocation, targetLocation, vehicleId, allowProfileFallback }) {
  return [
    vehicleId,
    allowProfileFallback ? 'fallback' : 'main',
    roundRouteCoord(startLocation.latitude),
    roundRouteCoord(startLocation.longitude),
    roundRouteCoord(targetLocation.latitude),
    roundRouteCoord(targetLocation.longitude),
  ].join(':');
}

function getVehicleConfig(vehicleId) {
  return ROUTE_VEHICLES.find((item) => item.id === vehicleId) || ROUTE_VEHICLES[0];
}

function toRadians(value) {
  return (Number(value) * Math.PI) / 180;
}

function coordinateToLocation(coordinate) {
  return {
    latitude: Number(coordinate?.[1]),
    longitude: Number(coordinate?.[0]),
  };
}

function projectToMeters(location, referenceLatitude) {
  const latitude = toRadians(location.latitude);
  const longitude = toRadians(location.longitude);
  const reference = toRadians(referenceLatitude);

  return {
    x: EARTH_RADIUS_METERS * longitude * Math.cos(reference),
    y: EARTH_RADIUS_METERS * latitude,
  };
}

function getSegmentProjection(point, start, end) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;

  if (!lengthSquared) {
    return {
      distance: Math.hypot(point.x - start.x, point.y - start.y),
      progress: 0,
      segmentLength: 0,
    };
  }

  const rawProgress = ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared;
  const progress = Math.max(0, Math.min(1, rawProgress));
  const projected = {
    x: start.x + progress * dx,
    y: start.y + progress * dy,
  };

  return {
    distance: Math.hypot(point.x - projected.x, point.y - projected.y),
    progress,
    segmentLength: Math.sqrt(lengthSquared),
  };
}

function buildRouteUrl({ startLocation, targetLocation, profile, exclude }) {
  const coordinates = `${getLngLat(startLocation).join(',')};${getLngLat(targetLocation).join(',')}`;
  const params = [
    ['overview', 'full'],
    ['geometries', 'geojson'],
    ['alternatives', '3'],
    ['steps', 'true'],
  ];

  if (exclude) {
    params.push(['exclude', exclude]);
  }

  const query = params.map(([key, value]) => `${key}=${encodeURIComponent(value)}`).join('&');
  return `${OSRM_BASE_URL}/${profile}/${coordinates}?${query}`;
}

function interpolateSpeed({ shortKmh, longKmh, longDistanceMeters }, distance) {
  if (!Number.isFinite(distance) || distance <= 0) {
    return shortKmh;
  }

  const progress = Math.max(0, Math.min(1, distance / longDistanceMeters));
  return shortKmh + (longKmh - shortKmh) * progress;
}

function estimateVehicleDurationSeconds({ vehicleId, distance, rawDuration }) {
  const profile = VEHICLE_SPEED_PROFILES[vehicleId];
  if (!profile || !Number.isFinite(Number(distance)) || Number(distance) <= 0) {
    return Number(rawDuration) || 0;
  }

  const speedKmh = interpolateSpeed(profile, Number(distance));
  const speedMetersPerSecond = (speedKmh * 1000) / 3600;
  return Math.max(60, Math.round(Number(distance) / speedMetersPerSecond));
}

function normalizeRoute(route, index, vehicle, strategy = null) {
  const coordinates = route?.geometry?.coordinates;
  if (!Array.isArray(coordinates) || coordinates.length < 2) {
    return null;
  }

  const distance = Number(route.distance) || 0;
  const rawDuration = Number(route.duration) || 0;

  return {
    id: `${vehicle.id}-${strategy?.id || vehicle.profile}-${index}-${Math.round(distance)}-${Math.round(rawDuration)}`,
    index,
    title: index === 0 ? 'Tuyến đề xuất' : `Tuyến ${index + 1}`,
    coordinates,
    distance,
    duration: estimateVehicleDurationSeconds({
      vehicleId: vehicle.id,
      distance,
      rawDuration,
    }),
    rawDuration,
    summary: route.legs?.[0]?.summary || '',
    strategyId: strategy?.id || vehicle.profile,
    routingProfile: strategy?.profile || vehicle.profile,
    safetyWarning: strategy?.warning || null,
  };
}

async function requestRoutes({ startLocation, targetLocation, vehicle, strategy = null, profile = vehicle.profile, exclude = null }) {
  const url = buildRouteUrl({
    startLocation,
    targetLocation,
    profile,
    exclude,
  });
  const response = await fetch(url);
  const result = await response.json().catch(() => null);

  if (!response.ok || result?.code !== 'Ok') {
    const message = result?.message || result?.code || 'Không tìm được tuyến đường phù hợp.';
    const error = new Error(message);
    error.code = result?.code || response.status;
    throw error;
  }

  const routes = (result.routes || [])
    .map((route, index) => normalizeRoute(route, index, vehicle, strategy))
    .filter(Boolean);

  if (!routes.length) {
    throw new Error('Không tìm được tuyến đường phù hợp.');
  }

  return routes;
}

function getRouteBounds(coordinates) {
  return coordinates.reduce(
    (bounds, coordinate) => ({
      south: Math.min(bounds.south, Number(coordinate[1])),
      west: Math.min(bounds.west, Number(coordinate[0])),
      north: Math.max(bounds.north, Number(coordinate[1])),
      east: Math.max(bounds.east, Number(coordinate[0])),
    }),
    { south: Infinity, west: Infinity, north: -Infinity, east: -Infinity }
  );
}

function expandBounds(bounds, paddingDegrees = 0.003) {
  return {
    south: bounds.south - paddingDegrees,
    west: bounds.west - paddingDegrees,
    north: bounds.north + paddingDegrees,
    east: bounds.east + paddingDegrees,
  };
}

function sampleCoordinates(coordinates, maxSamples = 80) {
  if (coordinates.length <= maxSamples) {
    return coordinates;
  }

  const step = Math.max(1, Math.floor(coordinates.length / maxSamples));
  const samples = [];
  for (let index = 0; index < coordinates.length; index += step) {
    samples.push(coordinates[index]);
  }
  samples.push(coordinates[coordinates.length - 1]);
  return samples;
}

function getDistanceToWay(location, way, referenceLatitude) {
  const geometry = way.geometry || [];
  if (geometry.length < 2) {
    return Infinity;
  }

  const point = projectToMeters(location, referenceLatitude);
  let bestDistance = Infinity;

  for (let index = 0; index < geometry.length - 1; index += 1) {
    const startLocation = { latitude: geometry[index].lat, longitude: geometry[index].lon };
    const endLocation = { latitude: geometry[index + 1].lat, longitude: geometry[index + 1].lon };
    if (!hasLocation(startLocation) || !hasLocation(endLocation)) {
      continue;
    }

    const start = projectToMeters(startLocation, referenceLatitude);
    const end = projectToMeters(endLocation, referenceLatitude);
    const projection = getSegmentProjection(point, start, end);
    bestDistance = Math.min(bestDistance, projection.distance);
  }

  return bestDistance;
}

function hasExplicitMotorbikeAllow(tags) {
  const allowValues = new Set(['yes', 'designated', 'permissive']);
  return allowValues.has(tags.motorcycle) || allowValues.has(tags.motor_vehicle);
}

function hasExplicitMotorbikeBan(tags) {
  const banValues = new Set(['no', 'private', 'agricultural', 'forestry', 'delivery']);
  return (
    banValues.has(tags.motorcycle) ||
    banValues.has(tags.motor_vehicle) ||
    banValues.has(tags.vehicle) ||
    (banValues.has(tags.access) && !hasExplicitMotorbikeAllow(tags))
  );
}

function isMotorbikeDisallowedWay(tags = {}) {
  if (hasExplicitMotorbikeBan(tags)) {
    return true;
  }

  if (hasExplicitMotorbikeAllow(tags)) {
    return false;
  }

  const highway = tags.highway;
  return (
    highway === 'motorway' ||
    highway === 'motorway_link' ||
    tags.motorroad === 'yes' ||
    highway === 'cycleway' ||
    highway === 'footway' ||
    highway === 'path' ||
    highway === 'pedestrian' ||
    highway === 'steps' ||
    highway === 'bridleway'
  );
}

async function fetchRoadWaysForBounds(bounds) {
  const query = `
    [out:json][timeout:8];
    (
      way["highway"](${bounds.south},${bounds.west},${bounds.north},${bounds.east});
    );
    out tags geom;
  `;

  const response = await fetch(OVERPASS_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
    body: `data=${encodeURIComponent(query)}`,
  });

  if (!response.ok) {
    throw new Error('Không kiểm tra được dữ liệu đường cấm xe máy.');
  }

  const result = await response.json();
  return Array.isArray(result.elements) ? result.elements : [];
}

async function validateMotorbikeRoute(route) {
  if (!Array.isArray(route.coordinates) || route.coordinates.length < 2) {
    return { allowed: false, unknown: false };
  }

  if (route.distance > MOTORBIKE_VALIDATION_MAX_DISTANCE_METERS) {
    return { allowed: true, unknown: true };
  }

  const bounds = expandBounds(getRouteBounds(route.coordinates));
  const ways = await fetchRoadWaysForBounds(bounds);
  if (!ways.length) {
    return { allowed: true, unknown: true };
  }

  const samples = sampleCoordinates(route.coordinates);
  let matchedSamples = 0;

  for (const coordinate of samples) {
    const location = coordinateToLocation(coordinate);
    if (!hasLocation(location)) {
      continue;
    }

    let nearestWay = null;
    let nearestDistance = Infinity;

    for (const way of ways) {
      const distance = getDistanceToWay(location, way, location.latitude);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestWay = way;
      }
    }

    if (nearestDistance > MOTORBIKE_VALIDATION_MATCH_METERS || !nearestWay) {
      continue;
    }

    matchedSamples += 1;
    if (isMotorbikeDisallowedWay(nearestWay.tags || {})) {
      return { allowed: false, unknown: false, blockedWay: nearestWay.tags || {} };
    }
  }

  return { allowed: true, unknown: matchedSamples < Math.max(3, Math.floor(samples.length * 0.35)) };
}

function uniqRoutes(routes) {
  const seen = new Set();
  return routes.filter((route) => {
    const key = `${Math.round(route.distance / 20)}:${Math.round(route.duration / 20)}:${route.coordinates?.length || 0}`;
    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function rankRoutes(routes) {
  return [...routes]
    .sort((left, right) => {
      const leftWarning = left.safetyWarning ? 1 : 0;
      const rightWarning = right.safetyWarning ? 1 : 0;
      if (leftWarning !== rightWarning) {
        return leftWarning - rightWarning;
      }

      return left.duration - right.duration;
    })
    .map((route, index) => ({
      ...route,
      index,
      title: index === 0 ? 'Tuyến đề xuất' : `Tuyến ${index + 1}`,
    }));
}

const routeCache = new Map();

export async function fetchRouteOptions({ startLocation, targetLocation, vehicleId = 'motorbike' }) {
  if (!hasLocation(startLocation) || !hasLocation(targetLocation)) {
    throw new Error('Cần có vị trí hiện tại và điểm đến để dẫn đường.');
  }

  const vehicle = getVehicleConfig(vehicleId);
  const cacheKey = getRouteCacheKey({
    startLocation,
    targetLocation,
    vehicleId: vehicle.id,
    allowProfileFallback: false,
  });

  if (routeCache.has(cacheKey)) {
    return routeCache.get(cacheKey);
  }

  const strategies = vehicle.strategies?.length
    ? vehicle.strategies
    : [{ id: vehicle.profile, profile: vehicle.profile, exclude: null, warning: null }];
  const candidateRoutes = [];
  let lastError = null;

  for (const strategy of strategies) {
    try {
      const routes = await requestRoutes({
        startLocation,
        targetLocation,
        vehicle,
        strategy,
        profile: strategy.profile,
        exclude: strategy.exclude,
      });
      candidateRoutes.push(...routes);

      if (vehicle.id !== 'motorbike') {
        const result = { routes, warning: strategy.warning || null, vehicle };
        routeCache.set(cacheKey, result);
        return result;
      }
    } catch (error) {
      lastError = error;
    }
  }

  if (vehicle.id === 'motorbike') {
    const routes = uniqRoutes(candidateRoutes);
    const acceptedRoutes = [];
    let validationUnavailable = false;

    for (const route of routes) {
      try {
        const validation = await validateMotorbikeRoute(route);
        if (!validation.allowed) {
          continue;
        }

        acceptedRoutes.push({
          ...route,
          safetyWarning:
            validation.unknown
              ? route.safetyWarning ||
                'Tuyến xe máy đã tránh cao tốc rõ ràng, nhưng dữ liệu OSM chưa đủ để kiểm tra toàn bộ biển cấm.'
              : route.safetyWarning,
        });
      } catch (error) {
        validationUnavailable = true;
        if (route.strategyId === 'avoid-motorway' || route.strategyId === 'bike-fallback') {
          acceptedRoutes.push({
            ...route,
            safetyWarning:
              route.safetyWarning ||
              'Tuyến xe máy đã tránh cao tốc theo OSRM, nhưng chưa kiểm tra được toàn bộ đường cấm xe máy.',
          });
        }
      }
    }

    if (acceptedRoutes.length) {
      const rankedRoutes = rankRoutes(acceptedRoutes);
      const warning =
        rankedRoutes.find((route) => route.safetyWarning)?.safetyWarning ||
        (validationUnavailable ? 'Chưa kiểm tra được toàn bộ dữ liệu đường cấm xe máy.' : null);
      const result = { routes: rankedRoutes, warning, vehicle };
      routeCache.set(cacheKey, result);
      return result;
    }

    if (routes.length && validationUnavailable) {
      const fallbackRoutes = rankRoutes(routes.map((route) => ({
        ...route,
        safetyWarning:
          'Không kiểm tra được dữ liệu cấm xe máy ở khu vực này, tuyến chỉ mang tính tham khảo và cần theo biển báo thực tế.',
      })));
      const result = {
        routes: fallbackRoutes,
        warning:
          'Không kiểm tra được dữ liệu cấm xe máy ở khu vực này, tuyến chỉ mang tính tham khảo và cần theo biển báo thực tế.',
        vehicle,
      };
      routeCache.set(cacheKey, result);
      return result;
    }

    throw new Error('Các tuyến tìm được đang đi qua đường có dữ liệu cấm xe máy/cao tốc, chưa có tuyến hợp pháp để đề xuất.');
  }

  if (vehicle.id === 'walking') {
    throw new Error('Không tìm được tuyến đi bộ phù hợp từ vị trí hiện tại.');
  }

  throw lastError || new Error('Không tìm được tuyến đường phù hợp.');
}

export function getRouteVehicle(vehicleId) {
  return getVehicleConfig(vehicleId);
}

export function getAutoRerouteConfig(vehicleId) {
  if (vehicleId === 'walking') {
    return {
      offRouteMeters: 30,
      backwardsMeters: 18,
      minMoveMeters: 10,
      minIntervalMs: 8000,
    };
  }

  if (vehicleId === 'car') {
    return {
      offRouteMeters: 90,
      backwardsMeters: 40,
      minMoveMeters: 28,
      minIntervalMs: 10000,
    };
  }

  return {
    offRouteMeters: 70,
    backwardsMeters: 30,
    minMoveMeters: 22,
    minIntervalMs: 9000,
  };
}

export function getRouteProgress(location, route) {
  if (!hasLocation(location) || !Array.isArray(route?.coordinates) || route.coordinates.length < 2) {
    return {
      distanceFromRoute: Infinity,
      alongDistance: 0,
      routeLength: 0,
    };
  }

  const referenceLatitude = Number(location.latitude);
  const point = projectToMeters(location, referenceLatitude);
  let traveledBeforeSegment = 0;
  let bestDistance = Infinity;
  let bestAlongDistance = 0;
  let routeLength = 0;

  for (let index = 0; index < route.coordinates.length - 1; index += 1) {
    const startLocation = coordinateToLocation(route.coordinates[index]);
    const endLocation = coordinateToLocation(route.coordinates[index + 1]);

    if (!hasLocation(startLocation) || !hasLocation(endLocation)) {
      continue;
    }

    const start = projectToMeters(startLocation, referenceLatitude);
    const end = projectToMeters(endLocation, referenceLatitude);
    const projection = getSegmentProjection(point, start, end);
    const alongDistance = traveledBeforeSegment + projection.segmentLength * projection.progress;

    if (projection.distance < bestDistance) {
      bestDistance = projection.distance;
      bestAlongDistance = alongDistance;
    }

    traveledBeforeSegment += projection.segmentLength;
    routeLength += projection.segmentLength;
  }

  return {
    distanceFromRoute: bestDistance,
    alongDistance: bestAlongDistance,
    routeLength,
  };
}

export function formatRouteDistance(meters) {
  if (!Number.isFinite(Number(meters))) {
    return '--';
  }

  return meters < 1000 ? `${Math.round(meters)}m` : `${(meters / 1000).toFixed(1)}km`;
}

export function formatRouteDuration(seconds) {
  if (!Number.isFinite(Number(seconds))) {
    return '--';
  }

  const minutes = Math.max(1, Math.round(seconds / 60));
  if (minutes < 60) {
    return `${minutes} phút`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes ? `${hours} giờ ${remainingMinutes} phút` : `${hours} giờ`;
}

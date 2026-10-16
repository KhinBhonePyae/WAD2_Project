<script setup>
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import axios from 'axios'
import L from 'leaflet'
import polyline from '@mapbox/polyline'
import 'leaflet/dist/leaflet.css'
import { BASE_URL } from '../utils/api.js'

const props = defineProps({
  place: {
    type: Object,
    required: true,
  },
})

const mapElement = ref(null)
const location = ref(null)
const locationNote = ref('')
const routeStatus = ref('idle')
const routeError = ref('')
const routeSummary = ref(null)
const selectedMode = ref('walk')
const userLocation = ref(null)
let map

let routeLayers = []
let userMarker
const routeModes = [
  { id: 'walk', label: 'Walk', icon: '🚶' },
  { id: 'car', label: 'Car', icon: '🚗' },
  { id: 'bus', label: 'Bus', icon: '🚌' },
  { id: 'train', label: 'Train', icon: '🚆' },
]

function validCoordinates(lat, lon) {
  return Number.isFinite(Number(lat)) && Number.isFinite(Number(lon))
}

function renderMap() {
  if (!mapElement.value || !location.value) return

  const { lat, lon } = location.value
  map = L.map(mapElement.value, {
    scrollWheelZoom: false,
    zoomControl: true,
  }).setView([lat, lon], 17)

  L.tileLayer('https://www.onemap.gov.sg/maps/tiles/Default/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.onemap.gov.sg/">OneMap Singapore</a>',
  }).addTo(map)

  const marker = L.circleMarker([lat, lon], {
    radius: 10,
    color: '#171512',
    weight: 3,
    fillColor: '#c8ff36',
    fillOpacity: 1,
  }).addTo(map)
  const label = document.createElement('span')
  label.textContent = props.place.name
  marker.bindTooltip(label, { direction: 'top', offset: [0, -8] }).openTooltip()
}

function getBrowserLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('This browser does not support location sharing.'))
      return
    }

    navigator.geolocation.getCurrentPosition(
      position => resolve({
        lat: position.coords.latitude,
        lon: position.coords.longitude,
      }),
      error => {
        const message = {
          1: 'Location permission was denied. Allow location access in your browser to get a route.',
          2: 'Your current location could not be determined. Try again in a place with a clearer GPS signal.',
          3: 'Location request timed out. Please try again.',
        }[error.code] || 'Could not access your current location.'
        reject(new Error(message))
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 },
    )
  })
}

function removeRouteLayers() {
  routeLayers.forEach(layer => map.removeLayer(layer))
  routeLayers = []
  if (userMarker) map.removeLayer(userMarker)
  userMarker = null
}

function drawRoute(data, origin) {
  removeRouteLayers()

  const legs = data.legs?.length
    ? data.legs.map(leg => ({ geometry: leg.geometry, mode: leg.mode }))
    : [{ geometry: data.geometry, mode: data.mode }]
  const bounds = []

  for (const leg of legs) {
    if (!leg.geometry) continue
    const points = polyline.decode(leg.geometry)
    if (points.length < 2) continue
    const color = leg.mode === 'WALK' || leg.mode === 'walk' ? '#ff5b22' : '#5b8def'
    const outline = L.polyline(points, {
      color: '#15130f',
      weight: 9,
      opacity: .85,
      lineCap: 'round',
      lineJoin: 'round',
    }).addTo(map)
    const line = L.polyline(points, {
      color,
      weight: 5,
      opacity: .95,
      lineCap: 'round',
      lineJoin: 'round',
    }).addTo(map)
    routeLayers.push(outline, line)
    bounds.push(line.getBounds())
  }

  if (!bounds.length) throw new Error('OneMap returned an incomplete route.')

  userMarker = L.circleMarker([origin.lat, origin.lon], {
    radius: 8,
    color: '#15130f',
    weight: 3,
    fillColor: '#9dd1f6',
    fillOpacity: 1,
  }).addTo(map)
  userMarker.bindTooltip('Your location', { direction: 'top', offset: [0, -6] })
  map.fitBounds(bounds.reduce((combined, bound) => combined.extend(bound), L.latLngBounds([])), {
    padding: [28, 28],
    maxZoom: 17,
  })
}

async function fetchRoute(mode, origin) {
  routeError.value = ''
  routeSummary.value = null
  routeStatus.value = 'routing'
  removeRouteLayers()

  try {
    const { data } = await axios.post(`${BASE_URL}/places/${props.place.id}/map-route`, {
      ...origin,
      mode,
    })
    if (data.mode !== 'bus' && data.mode !== 'train' && (typeof data.geometry !== 'string' || !data.geometry)) {
      throw new Error('OneMap did not return a route.')
    }
    if ((mode === 'bus' || mode === 'train') && !data.legs?.length) {
      throw new Error('OneMap did not return public-transport directions.')
    }

    drawRoute(data, origin)
    routeSummary.value = data
    routeStatus.value = 'ready'
  } catch (error) {
    // 503 = no ONEMAP_TOKEN on the server: expected, so no console noise
    if (error.response?.status === 503) {
      routeError.value = 'Directions aren’t available right now.'
      routeStatus.value = 'idle'
      return
    }
    console.error(`Could not show ${mode} route:`, error)
    routeError.value = error.response?.data?.error || error.message || 'Could not get directions. Please try again.'
    routeStatus.value = 'idle'
  }
}

async function showRoute() {
  routeError.value = ''
  routeStatus.value = 'locating'
  routeSummary.value = null
  removeRouteLayers()

  try {
    const origin = await getBrowserLocation()
    userLocation.value = origin
    await fetchRoute(selectedMode.value, origin)
  } catch (error) {
    console.error('Could not access the browser location:', error)
    routeError.value = error.message || 'Could not access your current location.'
    routeStatus.value = 'idle'
  }
}

async function changeMode(mode) {
  selectedMode.value = mode
  if (userLocation.value) {
    await fetchRoute(mode, userLocation.value)
    return
  }
  await showRoute()
}

function clearRoute() {
  removeRouteLayers()
  userLocation.value = null
  routeSummary.value = null
  routeError.value = ''
  routeStatus.value = 'idle'
  if (location.value) map.setView([location.value.lat, location.value.lon], 17)
}

function formatDistance(distance) {
  if (distance < 1000) return `${Math.round(distance)} m`
  return `${(distance / 1000).toFixed(1)} km`
}

function formatDuration(duration) {
  const minutes = Math.max(1, Math.round(duration / 60))
  if (minutes < 60) return `about ${minutes} min`
  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60
  return remainingMinutes ? `about ${hours} hr ${remainingMinutes} min` : `about ${hours} hr`
}

function modeLabel(mode) {
  return routeModes.find(item => item.id === mode)?.label || 'Walking'
}

function legDescription(leg) {
  if (leg.mode === 'WALK') return `Walk to ${leg.to || 'the next stop'}`
  const transport = leg.mode === 'BUS' ? 'Bus' : leg.mode === 'RAIL' ? 'Train' : leg.mode
  return `${transport}${leg.route ? ` ${leg.route}` : ''}: ${leg.from || 'Start'} to ${leg.to || 'destination'}`
}

onMounted(async () => {
  try {
    const { data } = await axios.get(`${BASE_URL}/places/${props.place.id}/map-location`)
    if (!validCoordinates(data.lat, data.lon)) {
      throw new Error('OneMap returned invalid coordinates.')
    }
    location.value = data
  } catch (error) {
    if (error.response?.status !== 503) console.error('Could not resolve this place with OneMap:', error)
    if (validCoordinates(props.place.lat, props.place.lon)) {
      location.value = {
        lat: Number(props.place.lat),
        lon: Number(props.place.lon),
        address: props.place.address,
      }
      locationNote.value = 'Showing the saved location; OneMap address lookup was unavailable.'
    } else {
      locationNote.value = 'The location could not be found. Please try again later.'
    }
  }

  await nextTick()
  renderMap()
})

onBeforeUnmount(() => map?.remove())
</script>

<template>
  <section class="x-place-map" aria-labelledby="place-map-title">
    <div class="x-place-map__heading">
      <div>
        <h2 id="place-map-title" class="x-place-map__title">Find it on the map</h2>
        <p class="x-place-map__address">{{ location?.address || place.address }}</p>
      </div>
      <button v-if="location" class="x-place-map__directions" type="button"
        :disabled="routeStatus === 'locating' || routeStatus === 'routing'" data-test="map-route-button"
        @click="showRoute">
        {{ routeStatus === 'locating' ? 'Finding your location...' : routeStatus === 'routing' ? 'Building route...' :
        'Show routes from my location' }}
        <span v-if="routeStatus !== 'locating' && routeStatus !== 'routing'" aria-hidden="true">↗</span>
      </button>
    </div>

    <div class="x-place-map__modes" role="group" aria-label="Choose a transportation mode">
      <button v-for="mode in routeModes" :key="mode.id" type="button" class="x-place-map__mode"
        :class="{ 'x-place-map__mode--active': selectedMode === mode.id }" :aria-pressed="selectedMode === mode.id"
        :disabled="routeStatus === 'locating' || routeStatus === 'routing'" @click="changeMode(mode.id)">
        <span class="x-place-map__mode-icon" aria-hidden="true">{{ mode.icon }}</span>
        {{ mode.label }}
      </button>
    </div>

    <div v-if="routeSummary" class="x-place-map__route-summary" role="status" data-test="map-route-summary">
      <span class="x-place-map__route-dot" aria-hidden="true"></span>
      {{ modeLabel(routeSummary.mode) }} route:
      <strong v-if="routeSummary.distance">{{ formatDistance(routeSummary.distance) }}</strong>
      <span aria-hidden="true">·</span>
      <strong>{{ formatDuration(routeSummary.duration) }}</strong>
      <span v-if="routeSummary.mode === 'bus' || routeSummary.mode === 'train'">
        · {{ routeSummary.transfers }} {{ routeSummary.transfers === 1 ? 'transfer' : 'transfers' }}
      </span>
      <button type="button" class="x-place-map__clear" @click="clearRoute">Clear route</button>
    </div>
    <details v-if="routeSummary?.legs?.length || routeSummary?.instructions?.length" class="x-place-map__details">
      <summary>Route details</summary>
      <ol>
        <li v-for="(leg, index) in routeSummary.legs" :key="`${leg.mode}-${index}`">
          {{ legDescription(leg) }}
          <span v-if="leg.duration"> · {{ formatDuration(leg.duration).replace('about ', '') }}</span>
        </li>
        <li v-for="(instruction, index) in routeSummary.instructions" :key="`instruction-${index}`">
          {{ instruction.action }}<span v-if="instruction.road"> on {{ instruction.road }}</span>
          <span v-if="instruction.distance"> · {{ formatDistance(instruction.distance) }}</span>
        </li>
      </ol>
    </details>
    <p v-if="routeError" class="x-place-map__route-error" role="alert" data-test="map-route-error">
      {{ routeError }}
    </p>
    <div v-if="location" ref="mapElement" class="x-place-map__canvas" data-test="place-map"></div>
    <div v-else class="x-place-map__unavailable" role="status">
      {{ locationNote || 'Loading OneMap...' }}
    </div>
    <p v-if="locationNote && location" class="x-place-map__note" role="status">{{ locationNote }}</p>
  </section>
</template>

<style>
.x-place-map {
  margin-top: 3.5rem;
  padding: clamp(1rem, 3vw, 1.75rem);
  border: var(--x-line);
  border-radius: 24px;
  background: var(--x-card);
  box-shadow: var(--x-pop);
}

.x-place-map__heading {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 1rem;
  margin-bottom: 1rem;
}

.x-place-map__title {
  margin: 0 0 .2rem;
  font-size: clamp(1.4rem, 3vw, 2rem);
}

.x-place-map__address {
  margin: 0;
  color: var(--x-muted);
}

.x-place-map__directions {
  display: inline-flex;
  align-items: center;
  gap: .45rem;
  padding: .65rem 1rem;
  border: var(--x-line);
  border-radius: 999px;
  background: var(--x-lime);
  color: var(--x-ink);
  font: inherit;
  font-weight: 700;
  cursor: pointer;
  box-shadow: 3px 3px 0 var(--x-ink);
  transition: transform .2s var(--x-ease);
}

.x-place-map__directions:hover:not(:disabled) {
  transform: translate(-2px, -2px);
}

.x-place-map__directions:disabled {
  cursor: wait;
  opacity: .72;
}

.x-place-map__modes {
  display: flex;
  flex-wrap: wrap;
  gap: .5rem;
  margin: 0 0 1rem;
}

.x-place-map__mode {
  display: inline-flex;
  align-items: center;
  gap: .4rem;
  padding: .45rem .8rem;
  border: 1.5px solid rgba(23, 21, 18, .3);
  border-radius: 999px;
  background: transparent;
  color: var(--x-ink);
  font: inherit;
  cursor: pointer;
  transition: background .2s var(--x-ease), border-color .2s var(--x-ease);
}

.x-place-map__mode:hover:not(:disabled) {
  border-color: var(--x-ink);
}

.x-place-map__mode--active {
  border-color: var(--x-ink);
  background: var(--x-lime);
  font-weight: 700;
}

.x-place-map__mode:disabled {
  cursor: wait;
  opacity: .65;
}

.x-place-map__mode-icon {
  font-size: 1.05rem;
}

.x-place-map__route-summary {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: .5rem;
  margin: 0 0 1rem;
  color: var(--x-ink);
}

.x-place-map__route-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--x-orange);
}

.x-place-map__clear {
  margin-left: auto;
  padding: .3rem .65rem;
  border: 1.5px solid var(--x-ink);
  border-radius: 999px;
  background: transparent;
  color: var(--x-ink);
  font-size: .8rem;
}

.x-place-map__details {
  margin: -.3rem 0 1rem;
  color: var(--x-ink);
}

.x-place-map__details summary {
  width: fit-content;
  cursor: pointer;
  font-weight: 700;
}

.x-place-map__details ol {
  margin: .6rem 0 0;
  padding-left: 1.4rem;
  color: var(--x-muted);
}

.x-place-map__details li {
  padding: .2rem 0;
}

.x-place-map__route-error {
  margin: 0 0 1rem;
  color: #a42b11;
  font-size: .9rem;
}

.x-place-map__canvas {
  height: clamp(280px, 42vw, 440px);
  overflow: hidden;
  border: var(--x-line);
  border-radius: 16px;
  background: #e9e3d6;
}

.x-place-map__canvas .leaflet-control-attribution {
  font-size: 10px;
}

.x-place-map__canvas .leaflet-tooltip {
  border: 1.5px solid var(--x-ink);
  border-radius: 8px;
  color: var(--x-ink);
  font-weight: 700;
}

.x-place-map__unavailable {
  display: grid;
  min-height: 180px;
  place-items: center;
  border: 1.5px dashed rgba(23, 21, 18, .4);
  border-radius: 16px;
  color: var(--x-muted);
  text-align: center;
}

.x-place-map__note {
  margin: .65rem 0 0;
  color: var(--x-muted);
  font-size: .82rem;
}

@media (prefers-reduced-motion: reduce) {
  .x-place-map__directions {
    transition: none;
  }
}
</style>

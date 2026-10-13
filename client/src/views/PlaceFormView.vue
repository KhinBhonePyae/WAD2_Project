<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import axios from 'axios'
import { BASE_URL } from '../utils/api.js'

const route = useRoute()
const router = useRouter()
const isEdit = computed(() => !!route.params.id)

const name = ref('')
const address = ref('')
const area = ref('')
const lat = ref('')
const lon = ref('')
const openTime = ref('')
const closeTime = ref('')
const indoor = ref(true)
const openNow = ref(true)
const description = ref('')
const facilities = ref([])
const photo1 = ref('')
const photo2 = ref('')
const photo3 = ref('')
const extraPhotos = ref([])
const originalPhotos = ref(['', '', ''])
const validationErrors = ref([])
const busy = ref(false)

const FACILITIES = [
  { value: 'wifi', label: 'Wi-Fi' },
  { value: 'sockets', label: 'Power sockets' },
  { value: 'toilets', label: 'Toilets' },
  { value: 'water', label: 'Water point' },
  { value: 'fnb', label: 'Food & drink' },
  { value: 'quiet', label: 'Quiet zone' }
]

onMounted(async () => {
  if (!isEdit.value) return

  try {
    const { data } = await axios.get(`${BASE_URL}/places/${route.params.id}`)
    const times = data.hours?.split(' - ') || []

    name.value = data.name || ''
    address.value = data.address || ''
    area.value = data.area || ''
    lat.value = data.lat ?? ''
    lon.value = data.lon ?? ''
    openTime.value = times[0] || ''
    closeTime.value = times[1] || ''
    indoor.value = data.indoor ?? true
    openNow.value = data.openNow ?? true
    description.value = data.description || ''
    facilities.value = data.facilities || []

    photo1.value = data.photos?.[0] || ''
    photo2.value = data.photos?.[1] || ''
    photo3.value = data.photos?.[2] || ''
    extraPhotos.value = data.photos?.slice(3) || []
    originalPhotos.value = [photo1.value, photo2.value, photo3.value]
  } catch (e) {
    console.error('Could not load place', e)
    validationErrors.value = ['Could not load the study space.']
  }
})

function validPhotoUrl(url) {
  if (!url) return true

  try {
    const parsedUrl = new URL(url)
    return parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:'
  } catch {
    return false
  }
}

function validPhoto(photo, index) {
  if (!photo) return true
  if (validPhotoUrl(photo)) return true
  return isEdit.value && photo === originalPhotos.value[index] && photo.startsWith('/images/')
}

function canPreviewPhoto(photo, index) {
  return photo && validPhoto(photo, index)
}

function timeToMinutes(time) {
  const [hour, minute] = time.split(':').map(Number)
  return hour * 60 + minute
}

function validateForm() {
  validationErrors.value = []

  const cleanName = name.value.trim()
  const cleanArea = area.value.trim()
  const cleanAddress = address.value.trim()
  const cleanDescription = description.value.trim()
  const allPhotos = [photo1.value.trim(), photo2.value.trim(), photo3.value.trim(), ...extraPhotos.value].filter(Boolean)

  if (!cleanName) validationErrors.value.push('Name is required.')
  else if (cleanName.length < 2) validationErrors.value.push('Name must contain at least 2 characters.')
  else if (!/[A-Za-z]/.test(cleanName)) validationErrors.value.push('Name must contain letters.')

  if (!cleanArea) validationErrors.value.push('Area is required.')
  else if (cleanArea.length < 2) validationErrors.value.push('Area must contain at least 2 characters.')
  else if (!/[A-Za-z]/.test(cleanArea)) validationErrors.value.push('Area must contain letters.')

  if (!cleanAddress) validationErrors.value.push('Address is required.')
  else if (cleanAddress.length < 5) validationErrors.value.push('Address must contain at least 5 characters.')
  else if (!/[A-Za-z]/.test(cleanAddress)) validationErrors.value.push('Address must contain letters.')

  if (lat.value === '') validationErrors.value.push('Latitude is required.')
  else if (!Number.isFinite(Number(lat.value))) validationErrors.value.push('Latitude must be a valid number.')
  else if (Number(lat.value) < -90 || Number(lat.value) > 90) validationErrors.value.push('Latitude must be between -90 and 90.')

  if (lon.value === '') validationErrors.value.push('Longitude is required.')
  else if (!Number.isFinite(Number(lon.value))) validationErrors.value.push('Longitude must be a valid number.')
  else if (Number(lon.value) < -180 || Number(lon.value) > 180) validationErrors.value.push('Longitude must be between -180 and 180.')

  // A closed place (e.g. under renovation) may leave both times blank
  const closedNoHours = !openNow.value && !openTime.value && !closeTime.value
  if (!openTime.value && !closedNoHours) validationErrors.value.push('Opening time is required.')
  if (!closeTime.value && !closedNoHours) validationErrors.value.push('Closing time is required.')
  if (openTime.value && closeTime.value && timeToMinutes(closeTime.value) <= timeToMinutes(openTime.value)) validationErrors.value.push('Closing time must be later than opening time.')

  if (allPhotos.length === 0) validationErrors.value.push('At least one photo is required.')
  if (photo1.value.trim() && !validPhoto(photo1.value.trim(), 0)) validationErrors.value.push('Photo URL 1 must be a valid http or https URL.')
  if (photo2.value.trim() && !validPhoto(photo2.value.trim(), 1)) validationErrors.value.push('Photo URL 2 must be a valid http or https URL.')
  if (photo3.value.trim() && !validPhoto(photo3.value.trim(), 2)) validationErrors.value.push('Photo URL 3 must be a valid http or https URL.')

  if (!cleanDescription) validationErrors.value.push('Description is required.')

  return validationErrors.value.length === 0
}

async function savePlace() {
  if (!validateForm()) {
    window.scrollTo({ top: 0, behavior: 'smooth' })
    return
  }

  busy.value = true

  const editablePhotos = [photo1.value.trim(), photo2.value.trim(), photo3.value.trim()].filter(Boolean)

  const payload = {
    name: name.value.trim(),
    address: address.value.trim(),
    area: area.value.trim(),
    lat: Number(lat.value),
    lon: Number(lon.value),
    hours: openTime.value && closeTime.value ? `${openTime.value} - ${closeTime.value}` : 'Closed for renovation',
    indoor: indoor.value,
    openNow: openNow.value,
    facilities: facilities.value,
    photos: isEdit.value ? [...editablePhotos, ...extraPhotos.value] : editablePhotos,
    description: description.value.trim()
  }

  try {
    let data

    if (isEdit.value) {
      const response = await axios.put(`${BASE_URL}/places/${route.params.id}`, payload)
      data = response.data
    } else {
      const response = await axios.post(`${BASE_URL}/places`, payload)
      data = response.data
    }

    router.push(`/places/${data.id}`)
  } catch (e) {
    console.error('Could not save place', e)
    validationErrors.value = [e.response?.data?.error || 'Could not save study space.']
    window.scrollTo({ top: 0, behavior: 'smooth' })
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <main class="container ss-section">
    <h1>{{ isEdit ? 'Edit Study Space' : 'Add Study Space' }}</h1>
    <p class="ss-muted mb-4">{{ isEdit ? 'Update this study space.' : 'Create a new study space.' }}</p>

    <div v-if="validationErrors.length" class="alert alert-danger">
      <strong>Please fix the following:</strong>
      <ul class="mb-0 mt-2">
        <li v-for="error in validationErrors" :key="error">{{ error }}</li>
      </ul>
    </div>

    <form class="ss-card p-4" @submit.prevent="savePlace" novalidate>
      <div class="row g-3">

        <div class="col-12 col-md-6">
          <label class="form-label">Name</label>
          <input v-model="name" class="form-control" maxlength="100" placeholder="e.g. Li Ka Shing Library">
        </div>

        <div class="col-12 col-md-6">
          <label class="form-label">Area</label>
          <input v-model="area" class="form-control" maxlength="80" placeholder="e.g. Bras Basah">
        </div>

        <div class="col-12">
          <label class="form-label">Address</label>
          <input v-model="address" class="form-control" maxlength="200" placeholder="e.g. 70 Stamford Rd, Singapore 178901">
        </div>

        <div class="col-6">
          <label class="form-label">Latitude</label>
          <input v-model="lat" type="number" step="any" min="-90" max="90" class="form-control" placeholder="e.g. 1.2963">
          <div class="form-text">Must be between -90 and 90.</div>
        </div>

        <div class="col-6">
          <label class="form-label">Longitude</label>
          <input v-model="lon" type="number" step="any" min="-180" max="180" class="form-control" placeholder="e.g. 103.8502">
          <div class="form-text">Must be between -180 and 180.</div>
        </div>

        <div class="col-6 col-md-3">
          <label class="form-label">Opening time</label>
          <input v-model="openTime" type="time" class="form-control">
        </div>

        <div class="col-6 col-md-3">
          <label class="form-label">Closing time</label>
          <input v-model="closeTime" type="time" :min="openTime" class="form-control">
        </div>

        <div class="col-6 col-md-3">
          <label class="form-label">Location</label>
          <select v-model="indoor" class="form-select">
            <option :value="true">Indoor</option>
            <option :value="false">Outdoor</option>
          </select>
        </div>

        <div class="col-6 col-md-3">
          <label class="form-label">Status</label>
          <select v-model="openNow" class="form-select">
            <option :value="true">Open</option>
            <option :value="false">Closed</option>
          </select>
        </div>

        <div class="col-12">
          <label class="form-label">Facilities</label>
          <div class="d-flex flex-wrap gap-3">
            <div v-for="f in FACILITIES" :key="f.value" class="form-check">
              <input :id="f.value" v-model="facilities" :value="f.value" class="form-check-input" type="checkbox">
              <label :for="f.value" class="form-check-label">{{ f.label }}</label>
            </div>
          </div>
        </div>

        <div class="col-12">
          <label class="form-label">Photo URLs</label>
          <input v-model="photo1" type="text" class="form-control mb-2" placeholder="https://example.com/photo1.jpg">
          <input v-model="photo2" type="text" class="form-control mb-2" placeholder="https://example.com/photo2.jpg">
          <input v-model="photo3" type="text" class="form-control" placeholder="https://example.com/photo3.jpg">
          <div class="form-text">Add or edit up to 3 photo URLs here. Extra imported photos are preserved automatically.</div>
        </div>

        <div v-if="canPreviewPhoto(photo1, 0) || canPreviewPhoto(photo2, 1) || canPreviewPhoto(photo3, 2)" class="col-12">
          <label class="form-label">Photo preview</label>
          <div class="d-flex flex-wrap gap-2">
            <img v-if="canPreviewPhoto(photo1, 0)" :src="photo1" :alt="`${name} photo 1`" class="rounded border" style="width:120px; height:80px; object-fit:cover;">
            <img v-if="canPreviewPhoto(photo2, 1)" :src="photo2" :alt="`${name} photo 2`" class="rounded border" style="width:120px; height:80px; object-fit:cover;">
            <img v-if="canPreviewPhoto(photo3, 2)" :src="photo3" :alt="`${name} photo 3`" class="rounded border" style="width:120px; height:80px; object-fit:cover;">
          </div>
        </div>

        <div v-if="isEdit && extraPhotos.length" class="col-12">
          <label class="form-label">Additional existing photos</label>
          <div class="d-flex flex-wrap gap-2">
            <img v-for="(photo, index) in extraPhotos" :key="index" :src="photo" :alt="`${name} photo ${index + 4}`" class="rounded border" style="width:120px; height:80px; object-fit:cover;">
          </div>
          <div class="form-text">These imported photos will be kept automatically when you save.</div>
        </div>

        <div class="col-12">
          <label class="form-label">Description</label>
          <textarea v-model="description" class="form-control" rows="4" placeholder="Describe the study space..."></textarea>
          <div class="form-text">{{ description.length }} characters.</div>
        </div>

        <div class="col-12">
          <button class="btn btn-primary" type="submit" :disabled="busy">{{ busy ? 'Saving...' : isEdit ? 'Save Changes' : 'Add Study Space' }}</button>
        </div>

      </div>
    </form>
  </main>
</template>
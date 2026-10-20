<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter, RouterLink } from 'vue-router'
import axios from 'axios'
import { BASE_URL, authConfig } from '../utils/api.js'

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
const closureStatus = ref('normal')
const description = ref('')
const capacity = ref('')
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
  { value: 'water', label: 'Water dispenser' },
  { value: 'fnb', label: 'Food & drink' },
  { value: 'quiet', label: 'Quiet zone' }
]

function inferClosureStatus(data) {
  const hours = (data.hours || '').toLowerCase()
  if (data.closureStatus === 'permanent' || hours.includes('permanent')) return 'permanent'
  if (data.closureStatus === 'temporary' || hours.includes('renovation') || hours.includes('temporar')) return 'temporary'
  return 'normal'
}

watch(closureStatus, status => {
  if (status !== 'normal') openNow.value = false
})

onMounted(async () => {
  if (!isEdit.value) return

  try {
    const { data } = await axios.get(`${BASE_URL}/places/${route.params.id}`)

    const times = data.hours?.includes(' - ')
      ? data.hours.split(' - ')
      : []

    name.value = data.name || ''
    address.value = data.address || ''
    area.value = data.area || ''
    lat.value = data.lat ?? ''
    lon.value = data.lon ?? ''
    openTime.value = times[0] || ''
    closeTime.value = times[1] || ''
    indoor.value = data.indoor ?? true
    closureStatus.value = inferClosureStatus(data)
    // markedOpen is the saved switch; openNow from the API is live and depends on the time of day
    openNow.value = closureStatus.value === 'normal' ? (data.markedOpen ?? data.openNow ?? true) : false
    description.value = data.description || ''
    capacity.value = data.capacity ?? ''
    facilities.value = data.facilities || []

    photo1.value = data.photos?.[0] || ''
    photo2.value = data.photos?.[1] || ''
    photo3.value = data.photos?.[2] || ''
    extraPhotos.value = data.photos?.slice(3) || []

    originalPhotos.value = [
      photo1.value,
      photo2.value,
      photo3.value
    ]
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

  return (
    isEdit.value &&
    photo === originalPhotos.value[index] &&
    photo.startsWith('/images/')
  )
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

  const allPhotos = [
    photo1.value.trim(),
    photo2.value.trim(),
    photo3.value.trim(),
    ...extraPhotos.value
  ].filter(Boolean)

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

  if (closureStatus.value === 'normal') {
    if (!openTime.value) validationErrors.value.push('Opening time is required.')
    if (!closeTime.value) validationErrors.value.push('Closing time is required.')

    if (openTime.value && closeTime.value && timeToMinutes(closeTime.value) <= timeToMinutes(openTime.value)) {
      validationErrors.value.push('Closing time must be later than opening time.')
    }
  }

  if (allPhotos.length === 0) {
    validationErrors.value.push('At least one photo is required.')
  }

  if (photo1.value.trim() && !validPhoto(photo1.value.trim(), 0)) {
    validationErrors.value.push('Photo URL 1 must be a valid http or https URL.')
  }

  if (photo2.value.trim() && !validPhoto(photo2.value.trim(), 1)) {
    validationErrors.value.push('Photo URL 2 must be a valid http or https URL.')
  }

  if (photo3.value.trim() && !validPhoto(photo3.value.trim(), 2)) {
    validationErrors.value.push('Photo URL 3 must be a valid http or https URL.')
  }

  if (capacity.value !== '' && capacity.value !== null) {
    const cap = Number(capacity.value)

    if (!Number.isInteger(cap) || cap < 1 || cap > 5000) {
      validationErrors.value.push('Capacity must be a whole number between 1 and 5000.')
    }
  }

  if (!cleanDescription) {
    validationErrors.value.push('Description is required.')
  }

  return validationErrors.value.length === 0
}

async function savePlace() {
  if (!validateForm()) {
    window.scrollTo({ top: 0, behavior: 'smooth' })
    return
  }

  busy.value = true

  const editablePhotos = [
    photo1.value.trim(),
    photo2.value.trim(),
    photo3.value.trim()
  ].filter(Boolean)

  const payload = {
    name: name.value.trim(),
    address: address.value.trim(),
    area: area.value.trim(),
    lat: Number(lat.value),
    lon: Number(lon.value),
    hours: closureStatus.value === 'normal' && openTime.value && closeTime.value ? `${openTime.value} - ${closeTime.value}` : '',
    indoor: indoor.value,
    openNow: closureStatus.value === 'normal' ? openNow.value : false,
    closureStatus: closureStatus.value,
    facilities: facilities.value,
    photos: isEdit.value
      ? [...editablePhotos, ...extraPhotos.value]
      : editablePhotos,
    description: description.value.trim(),
    capacity: capacity.value === '' || capacity.value === null
      ? null
      : Number(capacity.value)
  }

  try {
    let data

    if (isEdit.value) {
      const response = await axios.put(`${BASE_URL}/places/${route.params.id}`, payload, authConfig())
      data = response.data
    } else {
      const response = await axios.post(`${BASE_URL}/places`, payload, authConfig())
      data = response.data
    }

    router.push(`/places/${data.id}`)
  } catch (e) {
    console.error('Could not save place', e)

    validationErrors.value = [
      e.response?.data?.error || 'Could not save study space.'
    ]

    window.scrollTo({ top: 0, behavior: 'smooth' })
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <main class="container ss-section place-form-page">
    <!-- HEADER -->
    <div class="form-page-header">
      <div>
        <div class="form-eyebrow">
          {{ isEdit ? 'EDIT LISTING' : 'NEW LISTING' }}
        </div>

        <h1 class="mb-2">
          {{ isEdit ? 'Edit Study Space' : 'Add Study Space' }}
        </h1>

        <p class="ss-muted mb-0">
          {{
            isEdit
              ? 'Keep this study space accurate and useful for students.'
              : 'Create a new study space listing for students to discover.'
          }}
        </p>
      </div>

      <RouterLink to="/admin/places" class="btn btn-outline-primary">
        ← Back to Manage
      </RouterLink>
    </div>

    <!-- VALIDATION -->
    <div v-if="validationErrors.length" class="form-errors">
      <div class="form-errors-title">
        Please fix the following
      </div>

      <ul class="mb-0 mt-2">
        <li v-for="error in validationErrors" :key="error">
          {{ error }}
        </li>
      </ul>
    </div>

    <form @submit.prevent="savePlace" novalidate>
      <!-- SECTION 01 -->
      <section class="form-section">
        <div class="form-section-heading">
          <span class="form-section-number form-section-orange">01</span>

          <div>
            <h2>Basic Information</h2>
            <p>What students should know about this study space.</p>
          </div>
        </div>

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
            <input v-model="address" class="form-control" maxlength="200"
              placeholder="e.g. 70 Stamford Rd, Singapore 178901">
          </div>
        </div>
      </section>

      <!-- SECTION 02 -->
      <section class="form-section">
        <div class="form-section-heading">
          <span class="form-section-number form-section-sky">02</span>

          <div>
            <h2>Location &amp; Availability</h2>
            <p>Coordinates, opening hours, status and estimated capacity.</p>
          </div>
        </div>

        <div class="row g-3">
          <div class="col-12 col-md-6">
            <label class="form-label">Latitude</label>
            <input v-model="lat" type="number" step="any" min="-90" max="90" class="form-control"
              placeholder="e.g. 1.2963">
            <div class="form-text">Must be between -90 and 90.</div>
          </div>

          <div class="col-12 col-md-6">
            <label class="form-label">Longitude</label>
            <input v-model="lon" type="number" step="any" min="-180" max="180" class="form-control"
              placeholder="e.g. 103.8502">
            <div class="form-text">Must be between -180 and 180.</div>
          </div>

          <div class="col-12 col-sm-6 col-lg-3">
            <label class="form-label">Seats (approx.)</label>
            <input v-model="capacity" type="number" min="1" max="5000" step="1" class="form-control"
              placeholder="e.g. 40" data-test="capacity-input">
            <div class="form-text">Used to estimate how packed it may be.</div>
          </div>

          <div class="col-12 col-sm-6 col-lg-3">
            <label class="form-label">Opening time</label>
            <input v-model="openTime" type="time" class="form-control" :disabled="closureStatus !== 'normal'">
          </div>

          <div class="col-12 col-sm-6 col-lg-3">
            <label class="form-label">Closing time</label>
            <input v-model="closeTime" type="time" :min="openTime" class="form-control"
              :disabled="closureStatus !== 'normal'">
          </div>

          <div class="col-12 col-sm-6 col-lg-3">
            <label class="form-label">Location</label>

            <select v-model="indoor" class="form-select">
              <option :value="true">Indoor</option>
              <option :value="false">Outdoor</option>
            </select>
          </div>

          <div class="col-12 col-sm-6 col-lg-3">
            <label class="form-label">Status</label>
            <select v-model="openNow" class="form-select" :disabled="closureStatus !== 'normal'">
              <option :value="true">Open during its hours</option>
              <option :value="false">Closed until further notice</option>
            </select>
            <div class="form-text">"Open now" is worked out from the opening hours; choose closed to override them.</div>
          </div>

          <div class="col-12 col-sm-6 col-lg-3">
            <label class="form-label">Closure type</label>
            <select v-model="closureStatus" class="form-select">
              <option value="normal">Normal operation</option>
              <option value="temporary">Temporarily closed</option>
              <option value="permanent">Permanently closed</option>
            </select>
            <div class="form-text">Use temporary/permanent only for special closures.</div>
          </div>

          <div v-if="closureStatus !== 'normal'" class="col-12">
            <div class="closure-note"><strong>{{ closureStatus === 'temporary' ? 'Temporarily closed' : 'Permanently closed' }}</strong> 
            <!-- current status is automatically set to closed and opening hours are not required. -->
            </div>
          </div>
        </div>
      </section>

      <!-- SECTION 03 -->
      <section class="form-section">
        <div class="form-section-heading">
          <span class="form-section-number form-section-lime">03</span>

          <div>
            <h2>Facilities</h2>
            <p>Select everything students can expect to find there.</p>
          </div>
        </div>

        <div class="facility-grid">
          <label v-for="f in FACILITIES" :key="f.value" class="facility-chip"
            :class="{ active: facilities.includes(f.value) }">
            <input v-model="facilities" :value="f.value" type="checkbox">

            <span class="facility-check">
              {{ facilities.includes(f.value) ? '✓' : '+' }}
            </span>

            <span>{{ f.label }}</span>
          </label>
        </div>
      </section>

      <!-- SECTION 04 -->
      <section class="form-section">
        <div class="form-section-heading">
          <span class="form-section-number form-section-lilac">04</span>

          <div>
            <h2>Photos</h2>
            <p>Show students what the space looks like before they arrive.</p>
          </div>
        </div>

        <div class="row g-3">
          <div class="col-12">
            <label class="form-label">Photo URL 1</label>
            <input v-model="photo1" type="text" class="form-control" placeholder="https://example.com/photo1.jpg">
          </div>

          <div class="col-12">
            <label class="form-label">Photo URL 2</label>
            <input v-model="photo2" type="text" class="form-control" placeholder="https://example.com/photo2.jpg">
          </div>

          <div class="col-12">
            <label class="form-label">Photo URL 3</label>
            <input v-model="photo3" type="text" class="form-control" placeholder="https://example.com/photo3.jpg">

            <div class="form-text">
              Add or edit up to 3 photo URLs. Extra imported photos are preserved automatically.
            </div>
          </div>

          <!-- PREVIEW -->
          <div v-if="canPreviewPhoto(photo1, 0) || canPreviewPhoto(photo2, 1) || canPreviewPhoto(photo3, 2)"
            class="col-12">
            <div class="photo-panel">
              <div class="photo-panel-title">Photo preview</div>

              <div class="photo-grid">
                <img v-if="canPreviewPhoto(photo1, 0)" :src="photo1" :alt="`${name} photo 1`">
                <img v-if="canPreviewPhoto(photo2, 1)" :src="photo2" :alt="`${name} photo 2`">
                <img v-if="canPreviewPhoto(photo3, 2)" :src="photo3" :alt="`${name} photo 3`">
              </div>
            </div>
          </div>

          <!-- EXTRA IMPORTED -->
          <div v-if="isEdit && extraPhotos.length" class="col-12">
            <div class="photo-panel photo-panel-extra">
              <div class="photo-panel-title">
                Additional existing photos
              </div>

              <div class="photo-grid">
                <img v-for="(photo, index) in extraPhotos" :key="index" :src="photo"
                  :alt="`${name} photo ${index + 4}`">
              </div>

              <div class="form-text mt-2">
                These imported photos will be kept automatically when you save.
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- SECTION 05 -->
      <section class="form-section">
        <div class="form-section-heading">
          <span class="form-section-number form-section-butter">05</span>

          <div>
            <h2>Description</h2>
            <p>Give students a quick idea of what makes this place useful.</p>
          </div>
        </div>

        <label class="form-label">Study space description</label>

        <textarea v-model="description" class="form-control description-box" rows="5"
          placeholder="Describe the study space..."></textarea>

        <div class="description-counter">
          {{ description.length }} characters
        </div>
      </section>

      <!-- ACTION BAR -->
      <div class="form-action-bar">
        <div>
          <div class="form-action-title">
            {{ isEdit ? 'Ready to update this listing?' : 'Ready to publish this space?' }}
          </div>

          <div class="ss-muted">
            Check the information before saving.
          </div>
        </div>

        <div class="form-action-buttons">
          <RouterLink to="/admin/places" class="btn btn-outline-primary">
            Cancel
          </RouterLink>

          <button class="btn btn-primary" type="submit" :disabled="busy">
            {{
              busy
                ? 'Saving...'
                : isEdit
                  ? 'Save Changes'
                  : 'Add Study Space'
            }}
          </button>
        </div>
      </div>
    </form>
  </main>
</template>

<style scoped>
.place-form-page {
  max-width: 1100px;
  padding-top: 8.5rem !important;
  padding-bottom: 6rem;
}

.form-page-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 2rem;
  margin-bottom: 2rem;
}

.form-page-header h1 {
  margin: 0;
  font-size: clamp(3rem, 6vw, 5rem);
}

.form-eyebrow {
  display: inline-block;
  margin-bottom: .75rem;
  padding: .35rem .75rem;
  border: 2px solid var(--x-ink);
  border-radius: 999px;
  background: var(--x-orange);
  font-family: var(--x-mono);
  font-size: .72rem;
  font-weight: 700;
  letter-spacing: .06em;
  box-shadow: 3px 3px 0 var(--x-ink);
}

/* ERROR */
.form-errors {
  margin-bottom: 1.5rem;
  padding: 1.25rem 1.5rem;
  border: 2px solid var(--x-ink);
  border-radius: 20px;
  background: #FFC9B8;
  box-shadow: 4px 4px 0 var(--x-ink);
}

.form-errors-title {
  font-weight: 800;
  font-size: 1.05rem;
}

/* SECTION CARD */
.form-section {
  margin-bottom: 1.5rem;
  padding: 1.7rem;
  border: 2px solid var(--x-ink);
  border-radius: 24px;
  background: var(--x-card);
  box-shadow: 5px 5px 0 var(--x-ink);
}

.form-section-heading {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1.5rem;
  padding-bottom: 1.25rem;
  border-bottom: 2px solid var(--x-ink);
}

.form-section-heading h2 {
  margin: 0 0 .25rem;
  font-size: 1.4rem !important;
  line-height: 1.1 !important;
  letter-spacing: -.02em !important;
}

.form-section-heading p {
  margin: 0;
  color: var(--x-muted);
  font-size: .88rem;
}

.form-section-number {
  width: 48px;
  height: 48px;
  flex-shrink: 0;
  display: grid;
  place-items: center;
  border: 2px solid var(--x-ink);
  border-radius: 14px;
  font-weight: 800;
  box-shadow: 3px 3px 0 var(--x-ink);
}

.form-section-orange {
  background: var(--x-orange);
}

.form-section-sky {
  background: var(--x-sky);
}

.form-section-lime {
  background: var(--x-lime);
}

.form-section-lilac {
  background: var(--x-lilac);
}

.form-section-butter {
  background: var(--x-butter);
}

/* LABELS */
.form-label {
  font-weight: 700;
  margin-bottom: .45rem;
}

.form-text {
  color: var(--x-muted);
  font-size: .75rem;
}

.closure-note {
  padding: .9rem 1rem;
  border: 2px solid var(--x-ink);
  border-radius: 14px;
  background: var(--x-butter);
  font-size: .82rem;
  box-shadow: 3px 3px 0 var(--x-ink);
}

/* FACILITY CHIPS */
.facility-grid {
  display: flex;
  flex-wrap: wrap;
  gap: .75rem;
}

.facility-chip {
  display: inline-flex;
  align-items: center;
  gap: .55rem;
  padding: .65rem 1rem;
  border: 2px solid var(--x-ink);
  border-radius: 999px;
  background: var(--x-card);
  font-weight: 700;
  cursor: pointer;
  box-shadow: 3px 3px 0 var(--x-ink);
  transition: transform .18s var(--x-ease), box-shadow .18s var(--x-ease), background .2s;
  user-select: none;
}

.facility-chip input {
  position: absolute;
  opacity: 0;
  pointer-events: none;
}

.facility-chip:hover {
  transform: translate(-1px, -1px);
  box-shadow: 5px 5px 0 var(--x-ink);
}

.facility-chip.active {
  background: var(--x-lime);
}

.facility-check {
  width: 22px;
  height: 22px;
  display: grid;
  place-items: center;
  border: 1.5px solid var(--x-ink);
  border-radius: 50%;
  background: var(--x-card);
  font-size: .75rem;
}

/* PHOTOS */
.photo-panel {
  margin-top: .5rem;
  padding: 1.25rem;
  border: 2px dashed var(--x-ink);
  border-radius: 18px;
  background: var(--x-paper);
}

.photo-panel-extra {
  background: #F5F0FF;
}

.photo-panel-title {
  margin-bottom: .8rem;
  font-weight: 800;
}

.photo-grid {
  display: flex;
  flex-wrap: wrap;
  gap: .8rem;
}

.photo-grid img {
  width: 165px;
  height: 105px;
  object-fit: cover;
  border: 2px solid var(--x-ink);
  border-radius: 14px;
  background: var(--x-paper-2);
  box-shadow: 3px 3px 0 var(--x-ink);
}

/* DESCRIPTION */
.description-box {
  min-height: 150px;
  resize: vertical;
}

.description-counter {
  margin-top: .45rem;
  text-align: right;
  color: var(--x-muted);
  font-family: var(--x-mono);
  font-size: .72rem;
}

/* BOTTOM ACTION BAR */
.form-action-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 2rem;
  padding: 1.5rem;
  border: 2px solid var(--x-ink);
  border-radius: 22px;
  background: var(--x-butter);
  box-shadow: 5px 5px 0 var(--x-ink);
}

.form-action-title {
  margin-bottom: .2rem;
  font-size: 1.1rem;
  font-weight: 800;
}

.form-action-buttons {
  display: flex;
  gap: .8rem;
  flex-shrink: 0;
}

/* RESPONSIVE */
@media (max-width: 700px) {
  .place-form-page {
    padding-top: 9rem !important;
  }

  .form-page-header {
    flex-direction: column;
    align-items: flex-start;
  }

  .form-section {
    padding: 1.2rem;
  }

  .form-action-bar {
    flex-direction: column;
    align-items: stretch;
  }

  .form-action-buttons {
    width: 100%;
  }

  .form-action-buttons .btn {
    flex: 1;
  }

  .photo-grid img {
    width: 135px;
    height: 90px;
  }
}
</style>
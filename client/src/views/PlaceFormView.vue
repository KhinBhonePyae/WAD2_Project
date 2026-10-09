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
const hours = ref('')
const indoor = ref(true)
const openNow = ref(true)
const description = ref('')
const facilities = ref([])
const photo1 = ref('')
const photo2 = ref('')
const photo3 = ref('')
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
  if (!isEdit.value) return;

  try {
    const { data } = await axios.get(`${BASE_URL}/places/${route.params.id}`);

    name.value = data.name;
    address.value = data.address;
    area.value = data.area;
    lat.value = data.lat;
    lon.value = data.lon;
    hours.value = data.hours;
    indoor.value = data.indoor;
    openNow.value = data.openNow;
    description.value = data.description;
    facilities.value = data.facilities || [];
    photo1.value = data.photos?.[0] || '';
    photo2.value = data.photos?.[1] || '';
    photo3.value = data.photos?.[2] || '';
  } catch (e) {
    console.error('Could not load place', e);
  }
});

async function savePlace() {
  busy.value = true;

  const payload = {
    name: name.value,
    address: address.value,
    area: area.value,
    lat: lat.value === '' ? null : Number(lat.value),
    lon: lon.value === '' ? null : Number(lon.value),
    hours: hours.value,
    indoor: indoor.value,
    openNow: openNow.value,
    facilities: facilities.value,
    photos: [photo1.value, photo2.value, photo3.value].filter(Boolean),
    description: description.value
  };

  try {
    let data;

    if (isEdit.value) {
      const response = await axios.put(`${BASE_URL}/places/${route.params.id}`, payload);
      data = response.data;
    } else {
      const response = await axios.post(`${BASE_URL}/places`, payload);
      data = response.data;
    }

    router.push(`/places/${data.id}`);
  } catch (e) {
    console.error('Could not save place', e);
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <main class="container ss-section">
    <h1>{{ isEdit ? 'Edit Study Space' : 'Add Study Space' }}</h1>

    <p class="ss-muted mb-4">
    {{ isEdit ? 'Update this study space.' : 'Create a new study space.' }}
    </p>

    <form class="ss-card p-4" @submit.prevent="savePlace">
      <div class="row g-3">

        <div class="col-12 col-md-6">
          <label class="form-label">Name</label>
          <input v-model="name" class="form-control" required>
        </div>

        <div class="col-12 col-md-6">
          <label class="form-label">Area</label>
          <input v-model="area" class="form-control">
        </div>

        <div class="col-12">
          <label class="form-label">Address</label>
          <input v-model="address" class="form-control">
        </div>

        <div class="col-6">
          <label class="form-label">Latitude</label>
          <input v-model="lat" type="number" step="any" class="form-control">
        </div>

        <div class="col-6">
          <label class="form-label">Longitude</label>
          <input v-model="lon" type="number" step="any" class="form-control">
        </div>

        <div class="col-12 col-md-6">
          <label class="form-label">Opening hours</label>
          <input v-model="hours" class="form-control" placeholder="08:30 - 22:00">
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
              <input :id="f.value" v-model="facilities" :value="f.value"
                     class="form-check-input" type="checkbox">
              <label :for="f.value" class="form-check-label">{{ f.label }}</label>
            </div>
          </div>
        </div>

        <div class="col-12">
          <label class="form-label">Photo paths</label>
          <input v-model="photo1" class="form-control mb-2" placeholder="/images/example1.jpg">
          <input v-model="photo2" class="form-control mb-2" placeholder="/images/example2.jpg">
          <input v-model="photo3" class="form-control" placeholder="/images/example3.jpg">
        </div>

        <div class="col-12">
          <label class="form-label">Description</label>
          <textarea v-model="description" class="form-control" rows="4"></textarea>
        </div>

        <div class="col-12">
          <button class="btn btn-primary" type="submit" :disabled="busy">
            {{ busy ? 'Saving...' : isEdit ? 'Save Changes' : 'Add Study Space' }}
          </button>
        </div>

      </div>
    </form>
  </main>
</template>
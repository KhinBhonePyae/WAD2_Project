<script setup>
/* Owner: Jeffrey Wen. Edit + delete complete the CRUD. */
import { ref } from 'vue'
import StarRating from './StarRating.vue'
import CrowdMeter from './CrowdMeter.vue'

defineProps({
  reviews: { type:Array, default:() => [] },
  currentUserId:String
})

const emit = defineEmits(['edit-review','delete-review'])

const editingId = ref(null)
const draftRating = ref(5)
const draftComment = ref('')
const draftCrowd = ref('moderate')

function startEdit(r) {
  editingId.value = r._id
  draftRating.value = r.rating
  draftComment.value = r.comment || ''
  draftCrowd.value = r.crowdLevel || 'moderate'
}

function saveEdit(r) {
  emit('edit-review', {
    id:r._id,
    rating:Number(draftRating.value),
    comment:draftComment.value,
    crowdLevel:draftCrowd.value
  })

  editingId.value = null
}

function fmt(d) {
  const date = new Date(d)
  const day = date.toLocaleDateString('en-SG', { day:'numeric', month:'short', year:'numeric' })
  const time = date.toLocaleTimeString('en-SG', { hour:'numeric', minute:'2-digit', hour12:true })
  return `${day} · ${time}`
}
</script>

<template>
  <div data-test="review-list">
    <div v-if="!reviews.length" class="ss-empty">
      <p class="mb-0">No reviews yet. Be the first to tell people what this spot is like.</p>
    </div>

    <article v-for="r in reviews" :key="r._id" class="ss-card p-4 mb-3 review-card" data-test="review-item">
      <div class="review-head">
        <div>
          <strong>{{ r.author }}</strong>
          <div class="ss-meta">{{ fmt(r.createdAt) }}</div>
        </div>

        <div class="review-status">
          <CrowdMeter :level="r.crowdLevel" />
          <StarRating :value="r.rating" />
        </div>
      </div>

      <template v-if="editingId === r._id">
        <div class="row g-2 mt-2">
          <div class="col-6 col-md-2">
            <select v-model.number="draftRating" class="form-select" aria-label="Rating" data-test="edit-rating">
              <option :value="5">5</option>
              <option :value="4">4</option>
              <option :value="3">3</option>
              <option :value="2">2</option>
              <option :value="1">1</option>
            </select>
          </div>

          <div class="col-6 col-md-3">
            <select v-model="draftCrowd" class="form-select" aria-label="How busy was it" data-test="edit-crowd">
              <option value="quiet">Quiet</option>
              <option value="moderate">Moderate</option>
              <option value="packed">Packed</option>
            </select>
          </div>

          <div class="col-12 col-md-7">
            <input v-model="draftComment" class="form-control" aria-label="Comment" data-test="edit-comment">
          </div>
        </div>

        <div class="mt-2 d-flex gap-2">
          <button class="btn btn-primary btn-sm" data-test="edit-save" @click="saveEdit(r)">Save</button>
          <button class="btn btn-ghost btn-sm" @click="editingId = null">Cancel</button>
        </div>
      </template>

      <template v-else>
        <p v-if="r.comment" class="review-comment">{{ r.comment }}</p>

        <div v-if="currentUserId && r.userId === currentUserId" class="d-flex gap-2">
          <button class="btn btn-ghost btn-sm" data-test="edit-btn" @click="startEdit(r)">Edit</button>

          <button class="btn btn-ghost btn-sm" style="color:var(--ss-danger)" data-test="delete-btn" @click="$emit('delete-review',r._id)">Delete</button>
        </div>
      </template>
    </article>
  </div>
</template>

<style scoped>
.review-card { min-height:145px; }

.review-head {
  display:flex;
  align-items:flex-start;
  justify-content:space-between;
  gap:1rem;
}

.review-status {
  display:flex;
  align-items:center;
  justify-content:flex-end;
  gap:.8rem;
  flex-wrap:wrap;
}

.review-comment { margin:.85rem 0; }

@media(max-width:575.98px) {
  .review-head { flex-direction:column; }
  .review-status { justify-content:flex-start; }
  .review-card { min-height:0; }
}
</style>
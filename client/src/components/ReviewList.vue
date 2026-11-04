<script setup>
/* Owner: Jeffrey Wen. Edit + delete complete the CRUD. */
import { ref, computed, watch } from 'vue'
import StarRating from './StarRating.vue'
import StarPicker from './StarPicker.vue'
import CrowdMeter from './CrowdMeter.vue'

const props = defineProps({
  reviews: { type:Array, default:() => [] },
  currentUserId:String
})

// 6 reviews per page, newest first (the order the API sends)
const PER_PAGE = 6
const page = ref(1)
const pageCount = computed(() => Math.max(1, Math.ceil(props.reviews.length / PER_PAGE)))
const pageReviews = computed(() => props.reviews.slice((page.value - 1) * PER_PAGE, page.value * PER_PAGE))

// a new review lands on page 1; after a delete, stay on a page that still exists
watch(() => props.reviews.length, (now, before) => {
  if (now > before) page.value = 1
  else if (page.value > pageCount.value) page.value = pageCount.value
})

function goTo(n) {
  page.value = Math.min(pageCount.value, Math.max(1, n))
  editingId.value = null
}

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

    <article v-for="r in pageReviews" :key="r._id" class="ss-card p-4 mb-3 review-card" data-test="review-item">
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
          <div class="col-12">
            <StarPicker v-model="draftRating" label="Edit rating" data-test="edit-rating" />
          </div>

          <div class="col-12 col-md-5">
            <select v-model="draftCrowd" class="form-select" aria-label="How busy was it" data-test="edit-crowd">
              <option value="quiet">Quiet</option>
              <option value="moderate">Moderate</option>
              <option value="packed">Packed</option>
            </select>
          </div>

          <div class="col-12 col-md-7">
            <input v-model="draftComment" class="form-control" aria-label="Comment" maxlength="600" data-test="edit-comment">
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

    <nav v-if="pageCount > 1" class="review-pager" aria-label="Review pages" data-test="review-pager">
      <button type="button" class="x-page-btn" :disabled="page === 1" data-test="review-prev" @click="goTo(page - 1)">◀ Prev</button>
      <button v-for="n in pageCount" :key="n" type="button" class="x-page-btn" :class="{ 'is-active': n === page }"
        :aria-current="n === page ? 'page' : null" :data-test="'review-page-' + n" @click="goTo(n)">{{ n }}</button>
      <button type="button" class="x-page-btn" :disabled="page === pageCount" data-test="review-next" @click="goTo(page + 1)">Next ▶</button>
    </nav>
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

/* same look as the Browse page buttons */
.review-pager { display:flex; justify-content:center; flex-wrap:wrap; gap:.4rem; margin-top:1rem; }
.x-page-btn {
  min-width:38px;
  padding:.4rem .8rem;
  border:2px solid var(--x-ink);
  border-radius:10px;
  background:var(--x-card);
  color:var(--x-ink);
  font-weight:800;
  font-size:.9rem;
  box-shadow:2px 2px 0 var(--x-ink);
  transition:all .2s ease;
}
.x-page-btn:not(:disabled):hover { transform:translate(-2px, -2px); box-shadow:4px 4px 0 var(--x-ink); }
.x-page-btn.is-active { background:var(--x-lime); }
.x-page-btn:disabled { opacity:.4; box-shadow:1px 1px 0 var(--x-ink); }

@media(max-width:575.98px) {
  .review-head { flex-direction:column; }
  .review-status { justify-content:flex-start; }
  .review-card { min-height:0; }
}
</style>
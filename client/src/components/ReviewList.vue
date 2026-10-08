<script setup>
/* Owner: Jeffrey Wen. Edit + delete complete the CRUD. */
import { ref } from 'vue'
import StarRating from './StarRating.vue'
import CrowdMeter from './CrowdMeter.vue'

defineProps({ reviews: Array })
const emit = defineEmits(['edit-review', 'delete-review'])

const editingId = ref(null)
const draftRating = ref(5)
const draftComment = ref('')

function startEdit(r) {
  editingId.value = r._id; draftRating.value = r.rating; draftComment.value = r.comment || ''
}
function saveEdit(r) {
  emit('edit-review', { id: r._id, rating: Number(draftRating.value), comment: draftComment.value })
  editingId.value = null
}
function fmt(d) {
  return new Date(d).toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' })
}
</script>

<template>
  <div data-test="review-list">
    <div v-if="!reviews.length" class="ss-empty">
      <p class="mb-0">No reviews yet. Be the first to tell people what this spot is like.</p>
    </div>

    <article v-for="r in reviews" :key="r._id" class="ss-card p-4 mb-3" data-test="review-item">
      <div class="d-flex justify-content-between align-items-start gap-3 flex-wrap">
        <div>
          <strong>{{ r.author }}</strong>
          <div class="ss-meta">{{ fmt(r.createdAt) }}</div>
        </div>
        <div class="d-flex align-items-center gap-3">
          <CrowdMeter :level="r.crowdLevel" />
          <StarRating :value="r.rating" />
        </div>
      </div>

      <template v-if="editingId === r._id">
        <div class="row g-2 mt-2">
          <div class="col-4 col-md-2">
            <select v-model.number="draftRating" class="form-select" data-test="edit-rating">
              <option :value="5">5</option><option :value="4">4</option><option :value="3">3</option>
              <option :value="2">2</option><option :value="1">1</option>
            </select>
          </div>
          <div class="col-8 col-md-10">
            <input v-model="draftComment" class="form-control" data-test="edit-comment">
          </div>
        </div>
        <div class="mt-2 d-flex gap-2">
          <button class="btn btn-primary btn-sm" @click="saveEdit(r)" data-test="edit-save">Save</button>
          <button class="btn btn-ghost btn-sm" @click="editingId = null">Cancel</button>
        </div>
      </template>

      <template v-else>
        <p class="mt-2 mb-2" v-if="r.comment">{{ r.comment }}</p>
        <div class="d-flex gap-2">
          <button class="btn btn-ghost btn-sm" @click="startEdit(r)" data-test="edit-btn">Edit</button>
          <button class="btn btn-ghost btn-sm" style="color:var(--ss-danger)"
                  @click="$emit('delete-review', r._id)" data-test="delete-btn">Delete</button>
        </div>
      </template>
    </article>
  </div>
</template>

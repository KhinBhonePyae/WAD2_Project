<script setup>
/* Owner: Jeffrey Wen - ratings, reviews and crowd reporting. */
import { ref } from 'vue'
import StarPicker from './StarPicker.vue'

const props = defineProps({ placeId: Number, busy: Boolean, authorName: String })
const emit = defineEmits(['submit-review'])

const rating = ref(5)
const comment = ref('')
const crowdLevel = ref('moderate')
const error = ref('')

function submit() {
  error.value = ''
  if (rating.value < 1 || rating.value > 5) { error.value = 'Rating must be 1 to 5.'; return }
  emit('submit-review', {
    placeId: props.placeId,
    rating: Number(rating.value),
    comment: comment.value.trim(),
    crowdLevel: crowdLevel.value,
  })
  // the page resets this form once the review is saved, so a failed post keeps the text
}
</script>

<template>
  <form class="ss-card p-4" @submit.prevent="submit" data-test="review-form">
    <div class="row g-3">
      <div class="col-12 ss-meta" data-test="rv-author">Posting as <strong>{{ authorName }}</strong></div>
      <div class="col-12">
        <div class="form-label ss-meta mb-1" id="rv-rating-label">Your rating</div>
        <StarPicker v-model="rating" label="Your rating" data-test="rv-rating" />
      </div>
      <div class="col-12">
        <label class="form-label ss-meta" for="rv-crowd">Busy now?</label>
        <select id="rv-crowd" v-model="crowdLevel" class="form-select" data-test="rv-crowd">
          <option value="quiet">Quiet</option>
          <option value="moderate">Moderate</option>
          <option value="packed">Packed</option>
        </select>
      </div>
      <div class="col-12">
        <label class="form-label ss-meta" for="rv-comment">Comment</label>
        <textarea id="rv-comment" v-model="comment" class="form-control" rows="2" maxlength="600"
          placeholder="Sockets? Noise? Seat availability?" data-test="rv-comment"></textarea>
      </div>
    </div>

    <p v-if="error" class="mt-3 mb-0" style="color:var(--ss-danger);font-size:var(--ss-text-sm)" data-test="rv-error">{{
      error }}</p>

    <div class="mt-3">
      <button class="btn btn-primary" type="submit" :disabled="busy" data-test="rv-submit">
        {{ busy ? 'Posting…' : 'Post review' }}
      </button>
    </div>
  </form>
</template>

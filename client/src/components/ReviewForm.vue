<script setup>
/* Owner: Jeffrey Wen - ratings, reviews and crowd reporting. */
import { ref } from 'vue'

const props = defineProps({ placeId: Number, busy: Boolean })
const emit = defineEmits(['submit-review'])

const author = ref('')
const rating = ref(5)
const comment = ref('')
const crowdLevel = ref('moderate')
const error = ref('')

function submit() {
  error.value = ''
  if (!author.value.trim()) { error.value = 'Please enter your name.'; return }
  if (rating.value < 1 || rating.value > 5) { error.value = 'Rating must be 1 to 5.'; return }
  emit('submit-review', {
    placeId: props.placeId,
    author: author.value.trim(),
    rating: Number(rating.value),
    comment: comment.value.trim(),
    crowdLevel: crowdLevel.value,
  })
  author.value = ''; comment.value = ''; rating.value = 5; crowdLevel.value = 'moderate'
}
</script>

<template>
  <form class="ss-card p-4" @submit.prevent="submit" data-test="review-form">
    <h3 class="ss-card__title mb-3">Leave a review</h3>

    <div class="row g-3">
      <div class="col-12">
        <label class="form-label ss-meta" for="rv-name">Your name</label>
        <input id="rv-name" v-model="author" class="form-control" type="text"
               placeholder="e.g. Jeffrey" data-test="rv-name">
      </div>
      <div class="col-6">
        <label class="form-label ss-meta" for="rv-rating">Rating</label>
        <select id="rv-rating" v-model.number="rating" class="form-select" data-test="rv-rating">
          <option :value="5">5 ★</option>
          <option :value="4">4 ★</option>
          <option :value="3">3 ★</option>
          <option :value="2">2 ★</option>
          <option :value="1">1 ★</option>
        </select>
      </div>
      <div class="col-6">
        <label class="form-label ss-meta" for="rv-crowd">Busy now?</label>
        <select id="rv-crowd" v-model="crowdLevel" class="form-select" data-test="rv-crowd">
          <option value="quiet">Quiet</option>
          <option value="moderate">Moderate</option>
          <option value="packed">Packed</option>
        </select>
      </div>
      <div class="col-12">
        <label class="form-label ss-meta" for="rv-comment">Comment</label>
        <textarea id="rv-comment" v-model="comment" class="form-control" rows="2"
                  placeholder="Sockets? Noise? Seat availability?" data-test="rv-comment"></textarea>
      </div>
    </div>

    <p v-if="error" class="mt-3 mb-0" style="color:var(--ss-danger);font-size:var(--ss-text-sm)"
       data-test="rv-error">{{ error }}</p>

    <div class="mt-3">
      <button class="btn btn-primary" type="submit" :disabled="busy" data-test="rv-submit">
        {{ busy ? 'Posting…' : 'Post review' }}
      </button>
    </div>
  </form>
</template>

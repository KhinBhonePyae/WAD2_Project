<script setup>
/* "Explore by area" ride. Its scroll animation (pinning + sideways slide)
 * is set up by HomeView, which decides where on the page this sits:
 * near the top for first-time visitors, below the place cards once logged in. */
defineProps({ areas: Array })

const AREA_COLOURS = ['var(--x-lime)', 'var(--x-lilac)', 'var(--x-butter)', 'var(--x-sky)', 'var(--x-pink)', 'var(--x-orange)', 'var(--x-lime)']
const words = text => text.split(' ')
</script>

<template>
  <section class="x-areas" aria-label="Explore by area">
    <div class="x-areas__track">
      <div class="x-areas__intro">
        <h2 class="x-reveal"><span v-for="(w, i) in words('Explore by area')" :key="i" class="x-mask"><span
              class="x-word">{{ w }}</span></span></h2>
      </div>
      <RouterLink v-for="(a, i) in areas" :key="a.name" :to="{ path: '/places', query: { q: a.name } }" class="x-area"
        :style="{ '--area': AREA_COLOURS[i % AREA_COLOURS.length] }" data-cursor="explore">
        <span class="x-area__count x-mono">{{ String(i + 1).padStart(2, '0') }} · {{ a.list.length }} spot{{
          a.list.length === 1 ? '' : 's' }}</span>
        <span class="x-area__name">{{ a.name }}</span>
        <span class="x-area__photos">
          <img v-for="(src, j) in a.photos" :key="j" :src="src" alt="" class="x-area__photo" loading="lazy">
        </span>
      </RouterLink>
    </div>
  </section>
</template>

<style scoped>
.x-areas {
  overflow: hidden;
  padding: 4rem 0;
}

.x-areas__track {
  display: flex;
  align-items: stretch;
  gap: 24px;
  padding-inline: 24px;
  width: max-content;
  will-change: transform;
}

.x-areas__intro {
  width: min(420px, 80vw);
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.x-mask {
  display: inline-block;
  overflow: hidden;
  vertical-align: top;
  padding-bottom: .08em;
  margin-right: .22em;
}

.x-word {
  display: inline-block;
}

.x-area {
  position: relative;
  width: min(460px, 82vw);
  min-height: min(68vh, 560px);
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  padding: 26px;
  overflow: hidden;
  background: var(--area);
  border: var(--x-line);
  border-radius: 30px;
  box-shadow: var(--x-pop-lg);
  color: var(--x-ink);
  text-decoration: none;
  transition: transform .4s var(--x-ease);
}

.x-area:hover {
  transform: rotate(-1.5deg) scale(1.02);
}

.x-area__count {
  font-size: .72rem;
}

.x-area__name {
  font-weight: 800;
  font-size: clamp(2.6rem, 5vw, 4.2rem);
  letter-spacing: -.05em;
  line-height: .9;
  margin-top: .4rem;
}

.x-area__photos {
  position: relative;
  flex: 1;
  margin-top: 1rem;
}

.x-area__photo {
  position: absolute;
  width: 58%;
  aspect-ratio: 4 / 5;
  object-fit: cover;
  border: var(--x-line);
  border-radius: 18px;
  box-shadow: var(--x-pop);
}

.x-area__photo:nth-child(1) {
  left: 0;
  bottom: 0;
}

.x-area__photo:nth-child(2) {
  right: 0;
  top: 0;
}

.x-area__photo:nth-child(3) {
  left: 24%;
  bottom: 8%;
  width: 46%;
}

@media (max-width: 767.98px) {

  /* no pinning on phones: swipe sideways instead */
  .x-areas {
    overflow-x: auto;
    scroll-snap-type: x mandatory;
    -webkit-overflow-scrolling: touch;
  }

  .x-area,
  .x-areas__intro {
    scroll-snap-align: center;
  }

  .x-area {
    min-height: 440px;
  }
}

/* Below desktop: area cards scale with the screen to match the place cards */
@media (max-width: 991.98px) {
  .x-areas {
    padding: clamp(2rem, 5vw, 4rem) 0;
  }

  .x-areas__track {
    gap: clamp(12px, 2.4vw, 24px);
    padding-inline: clamp(12px, 2.4vw, 24px);
  }

  .x-areas__intro {
    width: 40vw;
  }

  .x-area {
    width: clamp(170px, 34vw, 320px);
    min-height: 0;
    aspect-ratio: 4 / 5;
    padding: clamp(12px, 2.4vw, 24px);
    border-radius: clamp(18px, 3vw, 28px);
  }

  .x-area__count {
    font-size: clamp(.64rem, 1.2vw, .72rem);
  }

  .x-area__name {
    font-size: clamp(1.25rem, 3.6vw, 2.2rem);
    margin-top: .2rem;
  }

  .x-area__photos {
    margin-top: clamp(.6rem, 1.4vw, 1rem);
  }

  .x-area__photo {
    border-radius: clamp(10px, 1.8vw, 18px);
  }
}

@media (max-width: 575.98px) {
  .x-area {
    box-shadow: 4px 4px 0 var(--x-ink);
  }

  .x-area__photo {
    border-width: 1.5px;
    box-shadow: 2px 2px 0 var(--x-ink);
  }
}
</style>

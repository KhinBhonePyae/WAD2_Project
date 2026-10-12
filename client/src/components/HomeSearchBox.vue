<script setup>
// Hero search bar with an animated dropdown of matching places.
// Data comes from the `places` prop (HomeView already fetches them), so no extra API call.
import { ref, computed, watch } from 'vue'

const props = defineProps({
    modelValue: { type: String, default: '' },
    places: { type: Array, default: () => [] },
    max: { type: Number, default: 5 },
})
const emit = defineEmits(['update:modelValue', 'search', 'select'])

const open = ref(false)
const active = ref(-1) // highlighted row (keyboard / hover); -1 = none
const listId = 'hero-suggest-list'

const term = computed(() => props.modelValue.trim().toLowerCase())

// Rank: name starts with > name contains > area/address/tags contain; ties broken by rating
const suggestions = computed(() => {
    const t = term.value
    if (!t) return []
    const hits = []
    for (const p of props.places) {
        const name = (p.name || '').toLowerCase()
        let tier = 0
        if (name.startsWith(t)) tier = 3
        else if (name.includes(t)) tier = 2
        else if ([p.area, p.address, ...(p.tags || [])].some((f) => String(f || '').toLowerCase().includes(t))) tier = 1
        if (tier) hits.push({ p, tier })
    }
    hits.sort((a, b) => b.tier - a.tier || (b.p.rating || 0) - (a.p.rating || 0))
    return hits.slice(0, props.max).map((h) => h.p)
})

const showList = computed(() => open.value && term.value.length > 0)

// Re-open and reset the highlight whenever the text changes
watch(() => props.modelValue, () => { active.value = -1; open.value = true })

// Split a name into plain / matching parts so the match can be bolded without v-html
function parts(name) {
    const t = term.value
    const i = name.toLowerCase().indexOf(t)
    if (i < 0) return [{ text: name, hit: false }]
    return [
        { text: name.slice(0, i), hit: false },
        { text: name.slice(i, i + t.length), hit: true },
        { text: name.slice(i + t.length), hit: false },
    ].filter((s) => s.text)
}

function move(step) {
    const n = suggestions.value.length
    if (!n) return
    open.value = true
    active.value = active.value === -1 ? (step > 0 ? 0 : n - 1) : (active.value + step + n) % n
}
function choose(place) { open.value = false; emit('select', place) }
function onEnter() {
    if (showList.value && active.value >= 0) choose(suggestions.value[active.value])
    else { open.value = false; emit('search') }
}
function searchAll() { open.value = false; emit('search') }
</script>

<template>
    <div class="home-search" style="width:100%;">
        <div class="hero-search-pill">
            <span class="ss-muted" aria-hidden="true">⌕</span>
            <input :value="modelValue" type="text" placeholder="Library, café or area — try “Bugis”"
                aria-label="Search study spaces" data-test="hero-search" autocomplete="off" role="combobox"
                aria-autocomplete="list" :aria-expanded="showList" :aria-controls="listId"
                :aria-activedescendant="active >= 0 && suggestions[active] ? `suggest-${suggestions[active].id}` : undefined"
                @input="emit('update:modelValue', $event.target.value)" @focus="open = true" @blur="open = false"
                @keydown.down.prevent="move(1)" @keydown.up.prevent="move(-1)" @keydown.esc="open = false"
                @keydown.enter="onEnter">
            <button class="btn btn-primary" @click="searchAll" data-test="hero-search-btn">Search</button>
        </div>

        <Transition name="suggest">
            <!-- mousedown.prevent keeps focus in the input so clicking a row doesn't close the list first -->
            <ul v-if="showList" :id="listId" class="suggest" role="listbox" data-test="suggest-list" @mousedown.prevent>
                <li v-for="(p, i) in suggestions" :key="p.id" :id="`suggest-${p.id}`" class="suggest__item"
                    :class="{ 'is-active': i === active }" :style="{ animationDelay: i * 45 + 'ms' }" role="option"
                    :aria-selected="i === active" data-test="suggest-item" @mouseenter="active = i" @click="choose(p)">
                    <div class="suggest__main">
                        <span class="suggest__name">
                            <template v-for="(s, k) in parts(p.name)" :key="k">
                                <mark v-if="s.hit">{{ s.text }}</mark>
                                <template v-else>{{ s.text }}</template>
                            </template>
                        </span>
                        <span class="suggest__meta">
                            {{ p.area }}<template v-if="p.rating > 0"> · ★ {{ Number(p.rating).toFixed(1) }}</template>
                        </span>
                    </div>
                    <span class="suggest__status" :class="p.openNow ? 'is-open' : 'is-closed'">
                        {{ p.openNow ? 'Open now' : 'Closed' }}
                    </span>
                </li>

                <li v-if="!suggestions.length" class="suggest__empty" data-test="suggest-empty">
                    No spots match “{{ modelValue.trim() }}”
                </li>
                <li class="suggest__all" role="presentation" data-test="suggest-all" @click="searchAll">
                    See all results for “{{ modelValue.trim() }}” →
                </li>
            </ul>
        </Transition>
    </div>
</template>

<style scoped>
.hero-search-pill {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: .5rem;
    width: 100%;
}

.hero-search-pill input {
    flex: 1;
    min-width: 0;
    width: 100%;
}

.hero-search-pill .btn-primary {
    flex-shrink: 0;
}

.suggest {
    position: absolute;
    top: calc(100% + 8px);
    left: 0;
    right: 0;
    z-index: 1000;

    margin: 0;
    padding: 6px;
    list-style: none;
    text-align: left;

    color: var(--ss-text, #1f2340);
    background: var(--ss-surface, #fff);
    border: 1px solid var(--ss-border, #e5e7eb);
    border-radius: 18px;
    box-shadow: 0 18px 40px rgba(20, 24, 60, 0.18);

    max-height: min(60vh, 380px);
    overflow-y: auto;
}

.ss-hero {
    position: relative;
    z-index: 1;
}

/* Whole panel: fade + slide down */
.suggest-enter-active,
.suggest-leave-active {
    transition: opacity 0.18s ease, transform 0.18s ease;
}

.suggest-enter-from,
.suggest-leave-to {
    opacity: 0;
    transform: translateY(-8px) scale(0.98);
}

/* Rows: staggered rise (delay set inline per row) */
.suggest__item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 10px 14px;
    border-radius: 12px;
    cursor: pointer;
    animation: suggest-in 0.22s ease both;
}

.suggest__item.is-active {
    background: var(--ss-purple-100, #efeafe);
}

@keyframes suggest-in {
    from {
        opacity: 0;
        transform: translateY(-6px);
    }

    to {
        opacity: 1;
        transform: none;
    }
}

.suggest__main {
    display: flex;
    flex-direction: column;
    min-width: 0;
}

.suggest__name {
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.suggest__name mark {
    background: var(--ss-sky-100, #dff1ff);
    color: inherit;
    border-radius: 4px;
    padding: 0 2px;
}

.suggest__meta {
    font-size: 0.85rem;
    opacity: 0.7;
}

.suggest__status {
    font-size: 0.8rem;
    font-weight: 600;
    white-space: nowrap;
}

.suggest__status.is-open {
    color: #1b7f4b;
}

.suggest__status.is-closed {
    color: #a3402f;
}

.suggest__empty {
    padding: 12px 14px;
    opacity: 0.7;
}

.suggest__all {
    margin-top: 4px;
    padding: 10px 14px;
    border-top: 1px solid var(--ss-border, #e5e7eb);
    font-weight: 600;
    cursor: pointer;
    border-radius: 0 0 12px 12px;
}

.suggest__all:hover {
    background: var(--ss-purple-100, #efeafe);
}

@media (prefers-reduced-motion: reduce) {

    .suggest-enter-active,
    .suggest-leave-active {
        transition: none;
    }

    .suggest__item {
        animation: none;
    }
}
</style>
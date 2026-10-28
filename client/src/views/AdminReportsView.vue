<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import axios from 'axios'
import { BASE_URL, authConfig } from '../utils/api.js'

const router = useRouter()

const reports = ref([])
const loading = ref(true)
const search = ref('')
const statusFilter = ref('pending')
const busyId = ref(null)
const errorMessage = ref('')
const successMessage = ref('')
const deleteTarget = ref(null)

const currentPage = ref(1)
const perPage = 10

const CATEGORY_LABELS = {
  hours:'Opening hours',
  facilities:'Facilities',
  address:'Address / location',
  photos:'Photos',
  capacity:'Capacity / seats',
  closure:'Open / closure status',
  other:'Other information'
}

const filteredReports = computed(() => {
  const q = search.value.trim().toLowerCase()

  return reports.value.filter(report => {
    const matchesStatus =
      statusFilter.value === 'all' ||
      report.status === statusFilter.value

    const haystack =
      `${report.placeName} ${report.reporterName} ${report.reporterEmail} ` +
      `${CATEGORY_LABELS[report.category] || report.category} ${report.message}`.toLowerCase()

    const matchesSearch =
      !q || haystack.includes(q)

    return matchesStatus && matchesSearch
  })
})

const pendingCount = computed(() =>
  reports.value.filter(
    report => report.status === 'pending'
  ).length
)

const resolvedCount = computed(() =>
  reports.value.filter(
    report => report.status === 'resolved'
  ).length
)

const totalPages = computed(() =>
  Math.ceil(
    filteredReports.value.length / perPage
  )
)

const startIndex = computed(() =>
  (currentPage.value - 1) * perPage
)

const endIndex = computed(() =>
  Math.min(
    startIndex.value + perPage,
    filteredReports.value.length
  )
)

const paginatedReports = computed(() =>
  filteredReports.value.slice(
    startIndex.value,
    endIndex.value
  )
)

const visiblePages = computed(() => {
  if (totalPages.value <= 3) {
    return Array.from(
      { length:totalPages.value },
      (_, i) => i + 1
    )
  }

  let start =
    currentPage.value

  if (
    start >
    totalPages.value - 2
  ) {
    start =
      totalPages.value - 2
  }

  return [
    start,
    start + 1,
    start + 2
  ]
})

watch(
  [search, statusFilter],
  () => {
    currentPage.value = 1
  }
)

watch(
  totalPages,
  pages => {
    if (
      currentPage.value >
      pages
    ) {
      currentPage.value =
        Math.max(
          pages,
          1
        )
    }
  }
)

function changePage(page) {
  if (
    page < 1 ||
    page > totalPages.value ||
    page === currentPage.value
  ) {
    return
  }

  currentPage.value = page
}

function formatDate(date) {
  if (!date) return '-'

  return new Date(date)
    .toLocaleString(
      'en-SG',
      {
        day:'numeric',
        month:'short',
        year:'numeric',
        hour:'numeric',
        minute:'2-digit'
      }
    )
}

function handleAuthError(error) {
  if (
    error.response?.status === 401
  ) {
    localStorage.removeItem(
      'token'
    )

    localStorage.removeItem(
      'user'
    )

    window.dispatchEvent(
      new Event('user-login')
    )

    router.push('/login')

    return true
  }

  if (
    error.response?.status === 403
  ) {
    router.push('/places')

    return true
  }

  return false
}

async function loadReports() {
  loading.value = true
  errorMessage.value = ''

  try {
    const { data } =
      await axios.get(
        `${BASE_URL}/reports/admin`,
        authConfig()
      )

    reports.value =
      data.reports || []
  } catch (error) {
    if (
      !handleAuthError(error)
    ) {
      errorMessage.value =
        error.response?.data?.error ||
        'Could not load reports.'
    }
  } finally {
    loading.value = false
  }
}

async function setStatus(
  report,
  status
) {
  busyId.value =
    report._id

  errorMessage.value = ''
  successMessage.value = ''

  try {
    const { data } =
      await axios.patch(
        `${BASE_URL}/reports/admin/${report._id}/status`,
        { status },
        authConfig()
      )

    const index =
      reports.value.findIndex(
        item =>
          item._id ===
          report._id
      )

    if (index !== -1) {
      reports.value[index] =
        data.report
    }

    successMessage.value =
      data.message
  } catch (error) {
    if (
      !handleAuthError(error)
    ) {
      errorMessage.value =
        error.response?.data?.error ||
        'Could not update report.'
    }
  } finally {
    busyId.value = null
  }
}

function askDeleteReport(report) {
  errorMessage.value = ''
  successMessage.value = ''

  deleteTarget.value =
    report
}

function closeDeleteModal() {
  if (busyId.value) return

  deleteTarget.value =
    null
}

async function confirmDeleteReport() {
  if (!deleteTarget.value) {
    return
  }

  const report =
    deleteTarget.value

  busyId.value =
    report._id

  errorMessage.value = ''
  successMessage.value = ''

  try {
    const { data } =
      await axios.delete(
        `${BASE_URL}/reports/admin/${report._id}`,
        authConfig()
      )

    reports.value =
      reports.value.filter(
        item =>
          item._id !==
          report._id
      )

    deleteTarget.value =
      null

    successMessage.value =
      data.message ||
      'Report deleted successfully.'
  } catch (error) {
    if (
      !handleAuthError(error)
    ) {
      errorMessage.value =
        error.response?.data?.error ||
        'Could not delete report.'
    }
  } finally {
    busyId.value = null
  }
}

onMounted(loadReports)
</script>

<template>
  <main class="container ss-section reports-page">

    <!-- HEADER -->
    <div class="reports-header">
      <div>
        <div class="reports-eyebrow">
          ADMIN · COMMUNITY REPORTS
        </div>

        <h1 class="mb-2">
          Reported Information
        </h1>

        <p class="ss-muted mb-0">
          Review corrections submitted by LockedIN users and keep study-space information accurate.
        </p>
      </div>

      <div class="reports-stats">
        <span class="report-stat report-stat-pending">
          {{ pendingCount }} pending
        </span>

        <span class="report-stat report-stat-resolved">
          {{ resolvedCount }} resolved
        </span>
      </div>
    </div>

    <!-- MESSAGES -->
    <div
      v-if="successMessage"
      class="alert alert-success"
    >
      {{ successMessage }}
    </div>

    <div
      v-if="errorMessage"
      class="alert alert-danger"
    >
      {{ errorMessage }}
    </div>

    <!-- SEARCH + FILTER -->
    <div class="reports-controls">
      <input
        v-model="search"
        type="search"
        class="reports-search"
        placeholder="Search place, reporter or issue..."
      >

      <select
        v-model="statusFilter"
        class="reports-filter"
      >
        <option value="pending">
          Pending
        </option>

        <option value="resolved">
          Resolved
        </option>

        <option value="all">
          All reports
        </option>
      </select>
    </div>

    <!-- LOADING -->
    <div
      v-if="loading"
      class="reports-loading"
    >
      Loading reports...
    </div>

    <!-- EMPTY -->
    <div
      v-else-if="!filteredReports.length"
      class="ss-empty reports-empty"
    >
      <strong>
        No reports here.
      </strong>

      <span>
        {{
          statusFilter === 'pending'
            ? 'All caught up — there are no pending corrections.'
            : 'Try another filter or search.'
        }}
      </span>
    </div>

    <!-- REPORT LIST -->
    <div
      v-else
      class="reports-list"
    >
      <article
        v-for="report in paginatedReports"
        :key="report._id"
        class="report-card"
      >

        <div class="report-card-top">
          <div>
            <div class="report-meta-line">

              <span
                class="report-status"
                :class="`report-status-${report.status}`"
              >
                {{ report.status }}
              </span>

              <span class="report-category">
                {{
                  CATEGORY_LABELS[
                    report.category
                  ] ||
                  report.category
                }}
              </span>

            </div>

            <h2>
              {{ report.placeName }}
            </h2>

            <p class="report-date">
              Reported
              {{ formatDate(report.createdAt) }}
            </p>
          </div>

          <div class="report-links">

            <RouterLink
              :to="`/places/${report.placeId}`"
              class="btn btn-outline-primary btn-sm"
            >
              View place
            </RouterLink>

            <RouterLink
              :to="`/admin/places/${report.placeId}/edit`"
              class="btn btn-outline-primary btn-sm"
            >
              Edit place
            </RouterLink>

          </div>
        </div>

        <div class="report-message">
          “{{ report.message }}”
        </div>

        <div class="report-footer">

          <div class="report-reporter">
            <span class="report-reporter-label">
              Reported by
            </span>

            <strong>
              {{ report.reporterName }}
            </strong>

            <span>
              {{ report.reporterEmail }}
            </span>
          </div>

          <div class="report-actions">

            <button
              v-if="report.status === 'pending'"
              type="button"
              class="btn btn-primary btn-sm"
              :disabled="busyId === report._id"
              @click="setStatus(report, 'resolved')"
            >
              {{
                busyId === report._id
                  ? 'Updating...'
                  : 'Mark resolved'
              }}
            </button>

            <button
              v-else
              type="button"
              class="btn btn-outline-primary btn-sm"
              :disabled="busyId === report._id"
              @click="setStatus(report, 'pending')"
            >
              Reopen
            </button>

            <button
              type="button"
              class="report-delete"
              :disabled="busyId === report._id"
              @click="askDeleteReport(report)"
            >
              Delete
            </button>

          </div>
        </div>

      </article>
    </div>

    <!-- PAGINATION -->
    <div
      v-if="
        !loading &&
        filteredReports.length > 0
      "
      class="pagination-section"
    >
      <p>
        Showing
        {{ startIndex + 1 }}–{{ endIndex }}
        of {{ filteredReports.length }}
        reports
      </p>

      <div
        v-if="totalPages > 1"
        class="pagination-buttons"
      >

        <button
          class="page-button arrow"
          :disabled="currentPage === 1"
          aria-label="Previous page"
          @click="changePage(currentPage - 1)"
        >
          ‹
        </button>

        <button
          v-for="page in visiblePages"
          :key="page"
          class="page-button"
          :class="{
            active:
              currentPage === page
          }"
          @click="changePage(page)"
        >
          {{ page }}
        </button>

        <button
          class="page-button arrow"
          :disabled="
            currentPage ===
            totalPages
          "
          aria-label="Next page"
          @click="changePage(currentPage + 1)"
        >
          ›
        </button>

      </div>
    </div>

    <!-- DELETE REPORT MODAL -->
    <div
      v-if="deleteTarget"
      class="confirm-overlay"
      @click.self="closeDeleteModal"
    >
      <div class="confirm-card">

        <div class="confirm-heading">
          <div>
            <p class="confirm-eyebrow">
              COMMUNITY REPORT
            </p>

            <h2>
              Delete report
            </h2>

            <p class="confirm-subtitle">
              {{ deleteTarget.placeName }}
            </p>
          </div>

          <button
            class="confirm-close"
            type="button"
            :disabled="
              busyId ===
              deleteTarget._id
            "
            @click="closeDeleteModal"
          >
            ×
          </button>
        </div>

        <div class="confirm-warning">

          <strong>
            Delete this report?
          </strong>

          <p>
            This report will be permanently removed.
            This action cannot be undone.
          </p>

          <div class="confirm-actions">

            <button
              type="button"
              class="confirm-cancel"
              :disabled="
                busyId ===
                deleteTarget._id
              "
              @click="closeDeleteModal"
            >
              Cancel
            </button>

            <button
              type="button"
              class="confirm-delete"
              :disabled="
                busyId ===
                deleteTarget._id
              "
              @click="confirmDeleteReport"
            >
              {{
                busyId ===
                deleteTarget._id
                  ? 'Deleting...'
                  : 'Delete report'
              }}
            </button>

          </div>
        </div>

      </div>
    </div>

  </main>
</template>

<style scoped>
.reports-page {
  max-width:1180px;
}

.reports-header {
  display:flex;
  justify-content:space-between;
  align-items:flex-end;
  gap:1.5rem;
  margin-bottom:1.5rem;
  padding:1.5rem;
  border:2px solid var(--x-ink);
  border-radius:22px;
  background:var(--x-lilac);
  box-shadow:8px 8px 0 var(--x-ink);
}

.reports-eyebrow {
  font-family:var(--x-mono);
  font-size:.72rem;
  font-weight:800;
  letter-spacing:.08em;
}

.reports-stats {
  display:flex;
  gap:.6rem;
  flex-wrap:wrap;
}

.report-stat {
  padding:.42rem .75rem;
  border:1.5px solid var(--x-ink);
  border-radius:999px;
  font-size:.75rem;
  font-weight:800;
}

.report-stat-pending {
  background:var(--x-butter);
}

.report-stat-resolved {
  background:var(--x-lime);
}

.reports-controls {
  display:grid;
  grid-template-columns:minmax(0,1fr) 190px;
  gap:1rem;
  margin:1.5rem 0;
}

.reports-search,
.reports-filter {
  min-height:50px;
  padding:.7rem 1rem;
  border:2px solid var(--x-ink);
  border-radius:999px;
  background:white;
  color:var(--x-ink);
  box-shadow:4px 4px 0 var(--x-ink);
  outline:none;
}

.reports-list {
  display:grid;
  gap:1rem;
}

.report-card {
  padding:1.25rem;
  border:2px solid var(--x-ink);
  border-radius:20px;
  background:white;
  box-shadow:6px 6px 0 var(--x-ink);
}

.report-card-top,
.report-footer {
  display:flex;
  justify-content:space-between;
  align-items:flex-start;
  gap:1rem;
}

.report-card h2 {
  margin:.4rem 0 .15rem;
  font-size:1.35rem;
}

.report-meta-line {
  display:flex;
  gap:.45rem;
  align-items:center;
  flex-wrap:wrap;
}

.report-status,
.report-category {
  padding:.25rem .55rem;
  border:1px solid var(--x-ink);
  border-radius:999px;
  font-size:.66rem;
  font-weight:800;
  text-transform:uppercase;
}

.report-status-pending {
  background:var(--x-butter);
}

.report-status-resolved {
  background:var(--x-lime);
}

.report-category {
  background:var(--x-paper-2);
}

.report-date {
  margin:0;
  color:var(--x-muted);
  font-size:.75rem;
}

.report-links,
.report-actions {
  display:flex;
  gap:.55rem;
  flex-wrap:wrap;
}

.report-message {
  margin:1rem 0;
  padding:1rem;
  border:1px dashed rgba(0,0,0,.38);
  border-radius:12px;
  background:var(--x-paper-2);
  line-height:1.55;
}

.report-reporter {
  display:grid;
  gap:.1rem;
  font-size:.76rem;
}

.report-reporter-label {
  color:var(--x-muted);
  font-size:.66rem;
  font-weight:800;
  text-transform:uppercase;
}

.report-delete {
  padding:.5rem .8rem;
  border:1.5px solid var(--x-ink);
  border-radius:999px;
  background:#ffc9b8;
  color:var(--x-ink);
  font-size:.75rem;
  font-weight:800;
  box-shadow:3px 3px 0 var(--x-ink);
}

.reports-loading,
.reports-empty {
  min-height:220px;
  display:grid;
  place-items:center;
}

.reports-empty span {
  color:var(--x-muted);
}

/* PAGINATION */

.pagination-section {
  margin-top:3rem;
  text-align:center;
}

.pagination-section p {
  margin-bottom:1.2rem;
  color:var(--x-muted);
  font-size:1rem;
  font-weight:700;
}

.pagination-buttons {
  display:flex;
  align-items:center;
  justify-content:center;
  gap:.8rem;
  flex-wrap:wrap;
}

.page-button {
  width:56px;
  height:56px;
  border:2px solid var(--x-ink);
  border-radius:50%;
  background:white;
  color:var(--x-ink);
  font-size:1.1rem;
  font-weight:800;
  box-shadow:5px 5px 0 var(--x-ink);
  transition:.15s ease;
}

.page-button:hover:not(:disabled) {
  transform:translateY(-2px);
}

.page-button.active {
  background:var(--x-orange);
}

.page-button.arrow {
  font-size:1.8rem;
}

.page-button:disabled {
  opacity:.3;
  cursor:not-allowed;
  box-shadow:none;
}

/* CONFIRM DELETE MODAL */

.confirm-overlay {
  position:fixed;
  inset:0;
  z-index:3000;
  padding:1rem;
  display:grid;
  place-items:center;
  background:rgba(20,18,15,.48);
  backdrop-filter:blur(5px);
}

.confirm-card {
  width:min(700px,100%);
  padding:1.7rem;
  border:2px solid var(--x-ink);
  border-radius:26px;
  background:var(--x-card);
  box-shadow:12px 12px 0 var(--x-ink);
}

.confirm-heading {
  display:flex;
  align-items:flex-start;
  justify-content:space-between;
  gap:1rem;
  margin-bottom:1.25rem;
}

.confirm-eyebrow {
  margin:0 0 .3rem;
  color:var(--x-ink);
  font-family:var(--x-mono);
  font-size:.75rem;
  font-weight:800;
  letter-spacing:.08em;
}

.confirm-heading h2 {
  margin:0;
  color:var(--x-ink);
  font-size:clamp(1.8rem,5vw,2.4rem);
  font-weight:800;
}

.confirm-subtitle {
  margin:.25rem 0 0;
  color:var(--x-muted);
}

.confirm-close {
  width:48px;
  height:48px;
  flex-shrink:0;
  border:1.5px solid var(--x-ink);
  border-radius:50%;
  background:white;
  color:var(--x-ink);
  font-size:1.45rem;
  font-weight:800;
}

.confirm-warning {
  padding:1.35rem;
  border:1.5px solid var(--x-ink);
  border-radius:18px;
  background:#ffc9b8;
}

.confirm-warning strong {
  display:block;
  margin-bottom:.45rem;
  color:var(--x-ink);
  font-size:1.15rem;
}

.confirm-warning p {
  margin:0;
  color:var(--x-ink);
  line-height:1.55;
}

.confirm-actions {
  margin-top:1.2rem;
  display:flex;
  gap:.75rem;
  flex-wrap:wrap;
}

.confirm-cancel,
.confirm-delete {
  padding:.65rem 1.1rem;
  border:2px solid var(--x-ink);
  border-radius:999px;
  color:var(--x-ink);
  font-weight:800;
  box-shadow:4px 4px 0 var(--x-ink);
}

.confirm-cancel {
  background:white;
}

.confirm-delete {
  background:var(--x-orange);
}

.confirm-cancel:disabled,
.confirm-delete:disabled,
.confirm-close:disabled {
  opacity:.55;
  cursor:not-allowed;
}

/* TABLET */

@media(max-width:767.98px) {
  .reports-header,
  .report-card-top,
  .report-footer {
    align-items:stretch;
    flex-direction:column;
  }

  .reports-controls {
    grid-template-columns:minmax(0,1fr) 170px;
    gap:.75rem;
  }

  .report-links,
  .report-actions {
    width:100%;
  }

  .report-links .btn,
  .report-actions .btn,
  .report-delete {
    flex:1;
  }
}

/* MOBILE */

@media(max-width:575.98px) {
  .confirm-card {
    padding:1.25rem;
  }

  .confirm-actions {
    display:grid;
    grid-template-columns:1fr;
  }

  .confirm-cancel,
  .confirm-delete {
    width:100%;
  }

  .reports-controls {
    grid-template-columns:minmax(0,1fr) 140px;
    gap:.6rem;
  }

  .reports-search,
  .reports-filter {
    padding:.65rem .8rem;
    font-size:.9rem;
  }

  .page-button {
    width:46px;
    height:46px;
  }
}

@media(max-width:420px) {
  .reports-controls {
    grid-template-columns:1fr;
  }

  .report-links,
  .report-actions {
    display:grid;
    grid-template-columns:1fr;
  }
}
</style>
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'

const { mockPush, mockGet, mockPatch, mockDelete } = vi.hoisted(() => ({
  mockPush: vi.fn(),
  mockGet: vi.fn(),
  mockPatch: vi.fn(),
  mockDelete: vi.fn()
}))

vi.mock('vue-router', () => ({
  useRouter: () => ({ push:mockPush }),
  RouterLink: {
    props:['to'],
    template:'<a><slot /></a>'
  }
}))

vi.mock('axios', () => ({
  default: {
    get:mockGet,
    patch:mockPatch,
    delete:mockDelete
  }
}))

import AdminReportsView from '../AdminReportsView.vue'

const pendingReport = {
  _id:'r1',
  placeId:1,
  placeName:'Li Ka Shing Library',
  reporterName:'Thet',
  reporterEmail:'thet@example.com',
  category:'hours',
  message:'Opening hours are incorrect.',
  status:'pending',
  createdAt:'2026-10-20T10:00:00.000Z'
}

const resolvedReport = {
  _id:'r2',
  placeId:2,
  placeName:'SMU Connexion',
  reporterName:'Alex',
  reporterEmail:'alex@example.com',
  category:'facilities',
  message:'Power sockets information is incorrect.',
  status:'resolved',
  createdAt:'2026-10-19T10:00:00.000Z'
}

function mountView() {
  return mount(AdminReportsView)
}

describe('AdminReportsView', () => {
  beforeEach(() => {
    localStorage.clear()
    localStorage.setItem('token', 'admin-token')

    mockPush.mockReset()
    mockGet.mockReset()
    mockPatch.mockReset()
    mockDelete.mockReset()
  })

  it('loads reports and shows pending reports by default', async () => {
    mockGet.mockResolvedValue({
      data:{ reports:[pendingReport, resolvedReport] }
    })

    const wrapper = mountView()
    await flushPromises()

    expect(mockGet).toHaveBeenCalled()

    expect(wrapper.text()).toContain('Li Ka Shing Library')
    expect(wrapper.text()).not.toContain('SMU Connexion')

    expect(wrapper.text()).toContain('1 pending')
    expect(wrapper.text()).toContain('1 resolved')
  })

  it('can filter and show resolved reports', async () => {
    mockGet.mockResolvedValue({
      data:{ reports:[pendingReport, resolvedReport] }
    })

    const wrapper = mountView()
    await flushPromises()

    await wrapper.find('.reports-filter').setValue('resolved')

    expect(wrapper.text()).toContain('SMU Connexion')
    expect(wrapper.text()).not.toContain('Li Ka Shing Library')
  })

  it('marks a pending report as resolved', async () => {
    mockGet.mockResolvedValue({
      data:{ reports:[pendingReport] }
    })

    mockPatch.mockResolvedValue({
      data:{
        report:{ ...pendingReport, status:'resolved' },
        message:'Report marked as resolved.'
      }
    })

    const wrapper = mountView()
    await flushPromises()

    await wrapper.find('.report-actions .btn-primary').trigger('click')
    await flushPromises()

    expect(mockPatch).toHaveBeenCalled()

    expect(mockPatch.mock.calls[0][0]).toContain(
      '/reports/admin/r1/status'
    )

    expect(mockPatch.mock.calls[0][1]).toEqual({
      status:'resolved'
    })

    expect(wrapper.text()).toContain('Report marked as resolved.')
  })

  it('opens the delete modal and deletes a report', async () => {
    mockGet.mockResolvedValue({
      data:{ reports:[pendingReport] }
    })

    mockDelete.mockResolvedValue({
      data:{ message:'Report deleted successfully.' }
    })

    const wrapper = mountView()
    await flushPromises()

    await wrapper.find('.report-delete').trigger('click')

    expect(wrapper.find('.confirm-overlay').exists()).toBe(true)
    expect(wrapper.text()).toContain('Delete this report?')

    await wrapper.find('.confirm-delete').trigger('click')
    await flushPromises()

    expect(mockDelete).toHaveBeenCalled()
    expect(mockDelete.mock.calls[0][0]).toContain(
      '/reports/admin/r1'
    )

    expect(wrapper.find('.confirm-overlay').exists()).toBe(false)
    expect(wrapper.text()).toContain('Report deleted successfully.')
  })

  it('redirects a non-admin user away from admin reports', async () => {
    mockGet.mockRejectedValue({
      response:{ status:403 }
    })

    mountView()
    await flushPromises()

    expect(mockPush).toHaveBeenCalledWith('/places')
  })
})
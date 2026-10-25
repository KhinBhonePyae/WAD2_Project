const test = require('node:test')
const assert = require('node:assert/strict')

global.MOCK_MODE = true

const reportModel = require('../models/report-model')

test('creates a new report as pending', async () => {
  const report = await reportModel.createReport({
    placeId: 1,
    placeName: 'Li Ka Shing Library',
    reporterName: 'Thet',
    reporterEmail: 'thet@example.com',
    category: 'hours',
    message: 'Opening hours are incorrect'
  })

  assert.equal(report.placeId, 1)
  assert.equal(report.category, 'hours')
  assert.equal(report.status, 'pending')
  assert.equal(report.resolvedAt, null)
})

test('marks a report as resolved', async () => {
  const report = await reportModel.createReport({
    placeId: 1,
    placeName: 'Li Ka Shing Library',
    reporterName: 'Thet',
    reporterEmail: 'thet@example.com',
    category: 'facilities',
    message: 'Water dispenser is missing'
  })

  const updated = await reportModel.updateStatus(report._id, 'resolved', 'admin123')

  assert.equal(updated.status, 'resolved')
  assert.ok(updated.resolvedAt)
  assert.equal(updated.resolvedBy, 'admin123')
})

test('can reopen a resolved report', async () => {
  const report = await reportModel.createReport({
    placeId: 1,
    placeName: 'Li Ka Shing Library',
    reporterName: 'Thet',
    reporterEmail: 'thet@example.com',
    category: 'closure',
    message: 'This place is actually open'
  })

  await reportModel.updateStatus(report._id, 'resolved', 'admin123')
  const reopened = await reportModel.updateStatus(report._id, 'pending', 'admin123')

  assert.equal(reopened.status, 'pending')
  assert.equal(reopened.resolvedAt, null)
  assert.equal(reopened.resolvedBy, null)
})

test('deletes a report', async () => {
  const report = await reportModel.createReport({
    placeId: 1,
    placeName: 'Li Ka Shing Library',
    reporterName: 'Thet',
    reporterEmail: 'thet@example.com',
    category: 'photos',
    message: 'The photo is outdated'
  })

  const deleted = await reportModel.deleteReport(report._id)
  const found = await reportModel.findById(report._id)

  assert.equal(deleted._id, report._id)
  assert.equal(found, null)
})

test('returns null for a report that does not exist', async () => {
  const report = await reportModel.findById('does-not-exist')

  assert.equal(report, null)
})
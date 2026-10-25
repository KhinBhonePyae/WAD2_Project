const test = require('node:test')
const assert = require('node:assert/strict')
const express = require('express')
const jwt = require('jsonwebtoken')

global.MOCK_MODE = true
process.env.JWT_SECRET = 'integration-test-secret'

const reportsRoutes = require('../routes/reports-routes')
const userModel = require('../models/user-model')

let server
let baseURL
let userToken
let adminToken

test.before(async () => {
  const user = await userModel.createUser({
    name:'Normal User',
    email:'user@test.com',
    password:'test-password',
    role:'user'
  })

  const admin = await userModel.createUser({
    name:'Admin User',
    email:'admin@test.com',
    password:'test-password',
    role:'admin'
  })

  userToken = jwt.sign({ userId:user._id }, process.env.JWT_SECRET)
  adminToken = jwt.sign({ userId:admin._id }, process.env.JWT_SECRET)

  const app = express()
  app.use(express.json())
  app.use('/reports', reportsRoutes)

  app.use((err, req, res, next) => {
    res.status(500).json({ error:err.message })
  })

  await new Promise(resolve => {
    server = app.listen(0, '127.0.0.1', resolve)
  })

  const port = server.address().port
  baseURL = `http://127.0.0.1:${port}`
})

test.after(async () => {
  await new Promise(resolve => server.close(resolve))
})

function auth(token) {
  return {
    Authorization:`Bearer ${token}`,
    'Content-Type':'application/json'
  }
}

async function createReport() {
  const response = await fetch(`${baseURL}/reports`, {
    method:'POST',
    headers:auth(userToken),
    body:JSON.stringify({
      placeId:1,
      category:'hours',
      message:'The opening hours shown are incorrect.'
    })
  })

  return {
    response,
    data:await response.json()
  }
}

test('rejects report submission when user is not logged in', async () => {
  const response = await fetch(`${baseURL}/reports`, {
    method:'POST',
    headers:{ 'Content-Type':'application/json' },
    body:JSON.stringify({
      placeId:1,
      category:'hours',
      message:'The opening hours shown are incorrect.'
    })
  })

  const data = await response.json()

  assert.equal(response.status, 401)
  assert.equal(data.error, 'Authentication required')
})

test('logged-in user can submit a report', async () => {
  const { response, data } = await createReport()

  assert.equal(response.status, 201)
  assert.equal(data.report.placeId, 1)
  assert.equal(data.report.placeName, 'Li Ka Shing Library')
  assert.equal(data.report.category, 'hours')
  assert.equal(data.report.status, 'pending')

  assert.equal(data.report.reporterName, 'Normal User')
  assert.equal(data.report.reporterEmail, 'user@test.com')
})

test('rejects an invalid report', async () => {
  const response = await fetch(`${baseURL}/reports`, {
    method:'POST',
    headers:auth(userToken),
    body:JSON.stringify({
      placeId:1,
      category:'wrong-category',
      message:'Incorrect information'
    })
  })

  const data = await response.json()

  assert.equal(response.status, 400)
  assert.equal(data.error, 'Choose what information is incorrect.')
})

test('normal user cannot access admin reports', async () => {
  const response = await fetch(`${baseURL}/reports/admin`, {
    headers:auth(userToken)
  })

  const data = await response.json()

  assert.equal(response.status, 403)
  assert.equal(data.error, 'Admin access required')
})

test('admin can view submitted reports', async () => {
  await createReport()

  const response = await fetch(`${baseURL}/reports/admin`, {
    headers:auth(adminToken)
  })

  const data = await response.json()

  assert.equal(response.status, 200)
  assert.ok(Array.isArray(data.reports))
  assert.ok(data.reports.length > 0)
  assert.equal(data.reports[0].status, 'pending')
})

test('admin can resolve and reopen a report', async () => {
  const { data:created } = await createReport()
  const id = created.report._id

  const resolveResponse = await fetch(
    `${baseURL}/reports/admin/${id}/status`,
    {
      method:'PATCH',
      headers:auth(adminToken),
      body:JSON.stringify({ status:'resolved' })
    }
  )

  const resolved = await resolveResponse.json()

  assert.equal(resolveResponse.status, 200)
  assert.equal(resolved.report.status, 'resolved')
  assert.ok(resolved.report.resolvedAt)

  const reopenResponse = await fetch(
    `${baseURL}/reports/admin/${id}/status`,
    {
      method:'PATCH',
      headers:auth(adminToken),
      body:JSON.stringify({ status:'pending' })
    }
  )

  const reopened = await reopenResponse.json()

  assert.equal(reopenResponse.status, 200)
  assert.equal(reopened.report.status, 'pending')
  assert.equal(reopened.report.resolvedAt, null)
})

test('admin can delete a report', async () => {
  const { data:created } = await createReport()
  const id = created.report._id

  const deleteResponse = await fetch(
    `${baseURL}/reports/admin/${id}`,
    {
      method:'DELETE',
      headers:auth(adminToken)
    }
  )

  const deleted = await deleteResponse.json()

  assert.equal(deleteResponse.status, 200)
  assert.equal(deleted.message, 'Report deleted.')

  const reportsResponse = await fetch(`${baseURL}/reports/admin`, {
    headers:auth(adminToken)
  })

  const reportsData = await reportsResponse.json()

  assert.equal(
    reportsData.reports.some(report => report._id === id),
    false
  )
})
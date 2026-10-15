/* Incorrect-information reports for study spaces.
 * Users submit reports from a place detail page; admins review them.
 */
const mongoose = require('mongoose')

const reportSchema = new mongoose.Schema({
  placeId: { type: Number, required: true },
  placeName: { type: String, required: true, trim: true },
  userId: { type: mongoose.Schema.Types.ObjectId, default: null },
  reporterName: { type: String, required: true, trim: true, maxlength: 60 },
  reporterEmail: { type: String, required: true, trim: true, lowercase: true },
  category: {
    type: String,
    enum: ['hours', 'facilities', 'address', 'photos', 'capacity', 'closure', 'other'],
    required: true
  },
  message: { type: String, required: true, trim: true, maxlength: 600 },
  status: { type: String, enum: ['pending', 'resolved'], default: 'pending' },
  createdAt: { type: Date, default: Date.now, immutable: true },
  resolvedAt: { type: Date, default: null },
  resolvedBy: { type: mongoose.Schema.Types.ObjectId, default: null }
}, { versionKey: false })

const Report = mongoose.model('Report', reportSchema, 'reports')

let mem = []
let nextId = 1

exports.createReport = async (data) => {
  if (global.MOCK_MODE) {
    const report = { _id: `report${nextId++}`, ...data, status: 'pending', createdAt: new Date(), resolvedAt: null, resolvedBy: null }
    mem.unshift(report)
    return report
  }

  return Report.create(data)
}

exports.getAllReports = async () => {
  if (global.MOCK_MODE) return [...mem].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
  return Report.find().sort({ createdAt: -1 })
}

exports.findById = async (id) => {
  if (global.MOCK_MODE) return mem.find(report => report._id === id) || null
  if (!mongoose.Types.ObjectId.isValid(id)) return null
  return Report.findById(id)
}

exports.updateStatus = async (id, status, adminId) => {
  const resolved = status === 'resolved'
  const updates = { status, resolvedAt: resolved ? new Date() : null, resolvedBy: resolved ? adminId : null }

  if (global.MOCK_MODE) {
    const report = mem.find(report => report._id === id)
    if (!report) return null
    Object.assign(report, updates)
    return report
  }

  return Report.findByIdAndUpdate(id, updates, { new: true, runValidators: true })
}

exports.deleteReport = async (id) => {
  if (global.MOCK_MODE) {
    const index = mem.findIndex(report => report._id === id)
    if (index === -1) return null
    return mem.splice(index, 1)[0]
  }

  if (!mongoose.Types.ObjectId.isValid(id)) return null
  return Report.findByIdAndDelete(id)
}

exports.Report = Report

const mongoose = require('mongoose');
const { Schema } = mongoose;

const aiMonitorSchema = new Schema({
  clientId: { type: Schema.Types.ObjectId, ref: 'Client', required: true, index: true },
  pageId: { type: Schema.Types.ObjectId, ref: 'Page', required: true, index: true },
  queries: [{ type: String }], // queries to watch
  lastChecked: Date,
  lastResult: Schema.Types.Mixed, // store { appeared: bool, citedDomains: [String], screenshotKey: String }
}, { timestamps: true });

module.exports = mongoose.model('AIOMonitor', aiMonitorSchema);

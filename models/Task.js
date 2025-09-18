const mongoose = require('mongoose');
const { Schema } = mongoose;

const taskSchema = new Schema({
  title: { type: String, required: true },
  description: String,
  assignedTo: { type: Schema.Types.ObjectId, ref: 'User' },
  pageId: { type: Schema.Types.ObjectId, ref: 'Page' },
  clientId: { type: Schema.Types.ObjectId, ref: 'Client' },
  status: { type: String, enum: ['open', 'in-progress', 'completed'], default: 'open' },
}, { timestamps: true });

module.exports = mongoose.model('Task', taskSchema);

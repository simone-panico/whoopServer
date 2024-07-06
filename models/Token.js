// models/Token.js
const mongoose = require('mongoose');

const tokenSchema = new mongoose.Schema({
  accessToken: String,
  refreshToken: String,
  expiresIn: Number,
  createdAt: { type: Date, default: Date.now },
});

tokenSchema.methods.isExpired = function() {
  const now = new Date();
  const expiresInMilliseconds = this.expiresIn * 1000;
  return now - this.createdAt >= expiresInMilliseconds;
};

module.exports = mongoose.model('Token', tokenSchema);

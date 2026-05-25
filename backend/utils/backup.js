const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');

/**
 * Export all collections to a JSON backup object.
 * @returns {Object} { filename, data }
 */
const createBackup = async () => {
  const collections = mongoose.connection.collections;
  const backup = {};

  for (const [name, collection] of Object.entries(collections)) {
    try {
      const docs = await collection.find({}).toArray();
      backup[name] = docs;
    } catch (err) {
      console.error(`Backup error for collection ${name}:`, err.message);
      backup[name] = [];
    }
  }

  const now = new Date();
  const timestamp = now.toISOString().replace(/[:.]/g, '-');
  const filename = `backup-${timestamp}.json`;

  // Optionally save to disk
  const backupDir = path.resolve('./backups');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const filePath = path.join(backupDir, filename);
  fs.writeFileSync(filePath, JSON.stringify(backup, null, 2));

  // Keep track of backup history
  const historyFile = path.join(backupDir, 'history.json');
  let history = [];
  if (fs.existsSync(historyFile)) {
    try {
      history = JSON.parse(fs.readFileSync(historyFile, 'utf8'));
    } catch (_) {}
  }
  history.unshift({
    filename,
    created_at: now.toISOString(),
    size_bytes: fs.statSync(filePath).size,
    collections: Object.keys(backup).length,
  });
  // Keep last 20 entries
  history = history.slice(0, 20);
  fs.writeFileSync(historyFile, JSON.stringify(history, null, 2));

  console.log(`Backup created: ${filename}`);
  return { filename, data: backup, path: filePath };
};

/**
 * Get backup history list.
 */
const getBackupHistory = () => {
  const backupDir = path.resolve('./backups');
  const historyFile = path.join(backupDir, 'history.json');
  if (!fs.existsSync(historyFile)) return [];
  try {
    return JSON.parse(fs.readFileSync(historyFile, 'utf8'));
  } catch (_) {
    return [];
  }
};

/**
 * Restore database from a backup JSON object.
 * @param {Object} backupData - The parsed backup JSON
 */
const restoreFromBackup = async (backupData) => {
  const results = {};
  for (const [collectionName, docs] of Object.entries(backupData)) {
    if (!Array.isArray(docs) || docs.length === 0) continue;
    try {
      const collection = mongoose.connection.collection(collectionName);
      await collection.deleteMany({});
      await collection.insertMany(docs);
      results[collectionName] = { restored: docs.length };
    } catch (err) {
      results[collectionName] = { error: err.message };
    }
  }
  return results;
};

module.exports = { createBackup, getBackupHistory, restoreFromBackup };

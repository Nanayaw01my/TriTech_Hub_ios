const axios = require('axios');
const logger = require('../utils/logger');

// Self-hosted OTA update check for the Capacitor app (@capgo/capacitor-updater).
// The "Publish OTA Update" GitHub Action builds a new web bundle and attaches
// it to a GitHub Release. This endpoint reads the latest release and tells the
// app the newest bundle version + download URL. Results are cached briefly so a
// fleet of devices doesn't hammer the GitHub API.

const REPO = process.env.OTA_GITHUB_REPO || 'Nanayaw01my/TriTech_Hub_ios';
const CACHE_TTL_MS = 5 * 60 * 1000;
let cache = { at: 0, data: null };

async function getLatestBundle() {
  if (cache.data && Date.now() - cache.at < CACHE_TTL_MS) return cache.data;

  const headers = {
    'User-Agent': 'tritech-hub-ota',
    Accept: 'application/vnd.github+json',
  };
  // Optional token raises the GitHub API rate limit (60/hr → 5000/hr).
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;

  const { data } = await axios.get(
    `https://api.github.com/repos/${REPO}/releases/latest`,
    { headers, timeout: 10000 }
  );

  const asset = (data.assets || []).find((a) => a.name && a.name.endsWith('.zip'));
  const result = asset
    ? { version: String(data.tag_name).replace(/^ota-?/i, '') || String(data.tag_name), url: asset.browser_download_url }
    : null;

  cache = { at: Date.now(), data: result };
  return result;
}

// GET or POST /api/app/updates  (Capgo posts device/version info in the body)
const checkUpdate = async (req, res) => {
  try {
    const current = req.body?.version_name || req.query?.version_name || '';
    const latest = await getLatestBundle();

    if (!latest || !latest.url) {
      return res.status(200).json({ message: 'no update available' });
    }
    if (current && current === latest.version) {
      return res.status(200).json({ message: 'up to date' });
    }
    return res.status(200).json({ version: latest.version, url: latest.url });
  } catch (err) {
    logger.error('OTA checkUpdate error: %s', err.message);
    // Never break the app over a failed update check.
    return res.status(200).json({ message: 'update check unavailable' });
  }
};

module.exports = { checkUpdate };

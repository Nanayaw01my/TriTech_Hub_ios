const axios = require('axios');
const logger = require('./logger');

const SIMPLEMDM_BASE_URL = 'https://a.simplemdm.com/api/v1';

const getAuthConfig = () => ({
  auth: {
    username: process.env.SIMPLEMDM_API_KEY,
    password: '',
  },
  headers: { 'Content-Type': 'application/json' },
});

/**
 * Find a SimpleMDM device record by UDID.
 */
const findDeviceByUDID = async (udid) => {
  try {
    let startingAfter = undefined;
    const limit = 100;

    while (true) {
      const response = await axios.get(`${SIMPLEMDM_BASE_URL}/devices`, {
        ...getAuthConfig(),
        params: { limit, ...(startingAfter && { starting_after: startingAfter }) },
      });

      const devices = response.data?.data || [];
      const found = devices.find(
        (d) => d.attributes?.unique_identifier === udid || d.attributes?.udid === udid
      );
      if (found) return found;

      if (!response.data?.has_more || devices.length < limit) break;
      startingAfter = devices[devices.length - 1]?.id;
    }
    return null;
  } catch (error) {
    logger.error('SimpleMDM findDeviceByUDID error: %s', error.message);
    return null;
  }
};

/**
 * Lock a device via SimpleMDM.
 *
 * - SUPERVISED devices use Lost Mode — a persistent, full lock the customer
 *   cannot dismiss or remove, showing your business phone number on the screen.
 * - NON-SUPERVISED devices only support a basic screen lock (the customer can
 *   still unlock with their own passcode). We send it anyway so *something*
 *   happens, but the returned `supervised: false` tells the caller it is not a
 *   true lock-out.
 *
 * Returns { success, supervised, data, message }. Throws only if the device
 * cannot be reached at all (bad UDID, auth failure, network).
 */
const lockDevice = async (udid) => {
  const device = await findDeviceByUDID(udid);
  if (!device) throw new Error(`Device with UDID ${udid} not found in SimpleMDM`);

  const deviceId = device.id;
  const businessPhone = process.env.BUSINESS_PHONE || '';
  const businessName = process.env.BUSINESS_NAME || 'Tritech Hub iOS';
  const message = `This iPhone is locked due to a missed payment. Please call ${businessName} to resolve your account.`;

  // Try Lost Mode FIRST — the real, non-dismissible lock (works on supervised
  // devices). SimpleMDM's inventory `is_supervised` flag can be stale/false even
  // when Lost Mode actually works, so we attempt it rather than trust the flag,
  // and only fall back to a basic lock if Lost Mode genuinely errors out.
  try {
    const response = await axios.post(
      `${SIMPLEMDM_BASE_URL}/devices/${deviceId}/lost_mode`,
      { message, phone_number: businessPhone, footnote: businessName },
      getAuthConfig()
    );
    return { success: true, supervised: true, mode: 'lost_mode', data: response.data, message: `Lost Mode enabled on device ${deviceId}` };
  } catch (error) {
    const errData = error.response?.data?.errors?.[0];
    const msg = (errData && (errData.title || errData.detail)) || error.message;
    logger.warn('SimpleMDM Lost Mode unavailable for UDID %s (%s); falling back to basic lock', udid, msg);
    // fall through to basic lock
  }

  // Fallback: basic DeviceLock. Shows the message + phone number, but on a
  // non-supervised device the customer can unlock with their own passcode.
  try {
    const fallback = await axios.post(
      `${SIMPLEMDM_BASE_URL}/devices/${deviceId}/lock`,
      { message, phone_number: businessPhone },
      getAuthConfig()
    );
    return {
      success: true,
      supervised: false,
      mode: 'device_lock',
      data: fallback.data,
      message: `Basic lock sent to device ${deviceId} (Lost Mode unavailable — customer can dismiss it)`,
    };
  } catch (fallbackError) {
    const errData = fallbackError.response?.data?.errors?.[0];
    const msg = (errData && (errData.title || errData.detail)) || fallbackError.message || 'Failed to lock device';
    logger.error('SimpleMDM lockDevice error for UDID %s: %s', udid, msg);
    throw new Error(msg);
  }
};

/**
 * Unlock a device via SimpleMDM — disables Lost Mode.
 */
const unlockDevice = async (udid) => {
  const device = await findDeviceByUDID(udid);
  if (!device) throw new Error(`Device with UDID ${udid} not found in SimpleMDM`);

  const deviceId = device.id;

  try {
    // Disable Lost Mode first
    const response = await axios.post(
      `${SIMPLEMDM_BASE_URL}/devices/${deviceId}/lost_mode`,
      { disabled: true },
      getAuthConfig()
    );

    return {
      success: true,
      data: response.data,
      message: `Lost Mode disabled on device ${deviceId}`,
    };
  } catch (error) {
    // Fallback: clear passcode if lost mode wasn't active
    try {
      const fallback = await axios.post(
        `${SIMPLEMDM_BASE_URL}/devices/${deviceId}/clear_passcode`,
        {},
        getAuthConfig()
      );
      return {
        success: true,
        data: fallback.data,
        message: `Passcode cleared on device ${deviceId}`,
      };
    } catch (fallbackError) {
      const msg = fallbackError.response?.data?.errors?.[0] || fallbackError.message || 'Failed to unlock device';
      logger.error('SimpleMDM unlockDevice error for UDID %s: %s', udid, msg);
      throw new Error(msg);
    }
  }
};

/**
 * Get the current status of a device by UDID.
 */
const getDeviceStatus = async (udid) => {
  const device = await findDeviceByUDID(udid);
  if (!device) throw new Error(`Device with UDID ${udid} not found in SimpleMDM`);

  try {
    const response = await axios.get(
      `${SIMPLEMDM_BASE_URL}/devices/${device.id}`,
      getAuthConfig()
    );
    return { success: true, data: response.data };
  } catch (error) {
    const msg = error.response?.data?.errors?.[0] || error.message;
    throw new Error(msg);
  }
};

module.exports = { lockDevice, unlockDevice, getDeviceStatus };

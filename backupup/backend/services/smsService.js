const axios = require('axios');
const config = require('../config/env');

/**
 * SMS Service for sending OTP messages
 */
class SMSService {
  constructor() {
    this.apiUsername = process.env.SMS_API_USERNAME || config.sms?.apiUsername;
    this.apiPassword = process.env.SMS_API_PASSWORD || config.sms?.apiPassword;
    this.apiUrl = process.env.SMS_API_URL || config.sms?.apiUrl;
    this.testMode = process.env.SMS_TEST_MODE === 'true' || config.sms?.testMode || false;
    this.messageTemplate = process.env.SMS_MESSAGE_TEMPLATE || config.sms?.messageTemplate || 'Giriş kodunuz: {code}';
  }

  /**
   * Generate a 6-digit numeric OTP code
   * @returns {string} 6-digit OTP code
   */
  generateOTP() {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  /**
   * Send OTP via SMS
   * @param {string} phoneNumber - Recipient phone number
   * @param {string} otpCode - OTP code to send
   * @returns {Promise<boolean>} True if sent successfully
   */
  async sendOTP(phoneNumber, otpCode) {
    if (this.testMode) {
      console.log(`[SMS TEST MODE] Would send OTP to ${phoneNumber}: ${otpCode}`);
      return true;
    }

    try {
      const message = this.messageTemplate.replace('{code}', otpCode);

      console.log('Sending SMS with data:', {
        username: this.apiUsername,
        password: this.apiPassword ? '[REDACTED]' : 'undefined',
        Number: phoneNumber,
        Content: message,
        url: this.apiUrl
      });

      // The API expects a specific JSON format with HTTP Basic Auth
      const requestData = {
        type: 1,
        sendingType: 0,
        title: "Müteahhit Bilgi Portalı",
        content: message,
        number: phoneNumber,
        encoding: 0
      };

      console.log('Sending JSON request to SMS API:', requestData);

      const response = await axios.post(this.apiUrl, requestData, {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        auth: {
          username: this.apiUsername,
          password: this.apiPassword
        },
        timeout: 15000
      });

      console.log('SMS API response:', response.status, response.data);

      if (response.status === 200 && response.data) {
        console.log(`SMS sent to ${phoneNumber}: ${response.data}`);
        return true;
      } else {
        console.error('SMS API response error:', response.status, response.data);
        return false;
      }
    } catch (error) {
      console.error('SMS sending failed:', error.message);
      if (error.response) {
        console.error('SMS API error response:', error.response.status, error.response.data);
        console.error('SMS API error headers:', error.response.headers);

        // Check if it's an authentication issue
        if (error.response.status === 401) {
          console.error('Authentication failed. Please check SMS API credentials.');
        }
      }
      return false;
    }
  }

  /**
   * Validate phone number format (Turkish format)
   * @param {string} phoneNumber 
   * @returns {boolean} True if valid format
   */
  validatePhoneNumber(phoneNumber) {
    const turkishPhoneRegex = /^(\+90|0)?[5][0-9]{9}$/;
    return turkishPhoneRegex.test(phoneNumber);
  }

  /**
   * Normalize phone number to standard format
   * Handles spaces, different formats, and country codes
   * @param {string} phoneNumber
   * @returns {string} Normalized phone number (053xxxxxxxxx format)
   */
  normalizePhoneNumber(phoneNumber) {
    // Remove all non-digits and spaces
    let normalized = phoneNumber.replace(/[\s\-\(\)]/g, '');

    // Handle international format (remove country code if present)
    if (normalized.startsWith('+90')) {
      normalized = normalized.substring(3);
    } else if (normalized.startsWith('90') && normalized.length === 12) {
      normalized = normalized.substring(2);
    }

    // Ensure it starts with 0 for Turkish numbers
    if (!normalized.startsWith('0')) {
      normalized = '0' + normalized;
    }

    return normalized;
  }
}

module.exports = new SMSService();
const bcrypt = require('bcryptjs');
const config = require('../config/env');

/**
 * OTP Service for generating, storing, and verifying OTP codes
 */
class OTPService {
  constructor() {
    this.otpStore = new Map(); // In-memory store for OTPs (phone -> { codeHash, expiresAt, attempts })
    this.ttl = parseInt(process.env.SMS_OTP_TTL) || 300000; // 5 minutes default
    this.maxFailedAttempts = parseInt(process.env.SMS_MAX_FAILED_ATTEMPTS) || 3;
    this.lockoutDuration = parseInt(process.env.SMS_LOCKOUT_DURATION) || 1800000; // 30 minutes default
    
    // Cleanup expired OTPs every minute
    setInterval(() => this.cleanupExpiredOTPs(), 60000);
  }

  /**
   * Generate and store a new OTP for a phone number
   * @param {string} phoneNumber - Normalized phone number
   * @returns {Promise<{code: string, expiresAt: Date}>} OTP code and expiration
   */
  async generateAndStoreOTP(phoneNumber) {
    // Check if phone is locked
    if (this.isPhoneLocked(phoneNumber)) {
      throw new Error('PHONE_LOCKED');
    }

    // Generate 6-digit numeric OTP
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const saltRounds = 10;
    const codeHash = await bcrypt.hash(code, saltRounds);
    
    const expiresAt = new Date(Date.now() + this.ttl);
    
    this.otpStore.set(phoneNumber, {
      codeHash,
      expiresAt,
      attempts: 0,
      createdAt: new Date()
    });

    return { code, expiresAt };
  }

  /**
   * Verify OTP code for a phone number
   * @param {string} phoneNumber - Normalized phone number
   * @param {string} code - OTP code to verify
   * @returns {Promise<boolean>} True if valid
   */
  async verifyOTP(phoneNumber, code) {
    const otpData = this.otpStore.get(phoneNumber);
    
    // Check if OTP exists
    if (!otpData) {
      return false;
    }

    // Check if expired
    if (new Date() > otpData.expiresAt) {
      this.otpStore.delete(phoneNumber);
      return false;
    }

    // Check if locked
    if (this.isPhoneLocked(phoneNumber)) {
      return false;
    }

    // Verify code
    const isValid = await bcrypt.compare(code, otpData.codeHash);
    
    if (isValid) {
      // Valid OTP - remove from store
      this.otpStore.delete(phoneNumber);
      return true;
    } else {
      // Invalid OTP - increment attempts
      otpData.attempts++;
      
      // Lock if max attempts reached
      if (otpData.attempts >= this.maxFailedAttempts) {
        this.lockPhone(phoneNumber);
        this.otpStore.delete(phoneNumber);
      }
      
      return false;
    }
  }

  /**
   * Check if phone number is locked due to too many failed attempts
   * @param {string} phoneNumber 
   * @returns {boolean} True if locked
   */
  isPhoneLocked(phoneNumber) {
    const lockKey = `lock_${phoneNumber}`;
    const lockData = this.otpStore.get(lockKey);
    
    if (!lockData) {
      return false;
    }

    if (new Date() > lockData.expiresAt) {
      this.otpStore.delete(lockKey);
      return false;
    }

    return true;
  }

  /**
   * Lock phone number for specified duration
   * @param {string} phoneNumber 
   */
  lockPhone(phoneNumber) {
    const lockKey = `lock_${phoneNumber}`;
    const expiresAt = new Date(Date.now() + this.lockoutDuration);
    
    this.otpStore.set(lockKey, {
      expiresAt,
      lockedAt: new Date()
    });
  }

  /**
   * Get remaining time for OTP validity
   * @param {string} phoneNumber 
   * @returns {number} Milliseconds remaining, or 0 if expired/not found
   */
  getRemainingTime(phoneNumber) {
    const otpData = this.otpStore.get(phoneNumber);
    if (!otpData) {
      return 0;
    }

    const now = new Date();
    const expiresAt = new Date(otpData.expiresAt);
    return Math.max(0, expiresAt - now);
  }

  /**
   * Get remaining lockout time for phone number
   * @param {string} phoneNumber 
   * @returns {number} Milliseconds remaining, or 0 if not locked
   */
  getLockoutRemainingTime(phoneNumber) {
    const lockKey = `lock_${phoneNumber}`;
    const lockData = this.otpStore.get(lockKey);
    
    if (!lockData) {
      return 0;
    }

    const now = new Date();
    const expiresAt = new Date(lockData.expiresAt);
    return Math.max(0, expiresAt - now);
  }

  /**
   * Cleanup expired OTPs and locks
   */
  cleanupExpiredOTPs() {
    const now = new Date();
    
    for (const [key, value] of this.otpStore.entries()) {
      if (new Date(value.expiresAt) <= now) {
        this.otpStore.delete(key);
      }
    }
  }

  /**
   * Get OTP data for a phone number (for debugging/admin purposes)
   * @param {string} phoneNumber 
   * @returns {Object|null} OTP data or null
   */
  getOTPData(phoneNumber) {
    const data = this.otpStore.get(phoneNumber);
    if (!data) {
      return null;
    }

    return {
      attempts: data.attempts,
      expiresAt: data.expiresAt,
      createdAt: data.createdAt,
      remainingTime: this.getRemainingTime(phoneNumber)
    };
  }
}

module.exports = new OTPService();
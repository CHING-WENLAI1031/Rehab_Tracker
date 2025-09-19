const jwt = require('jsonwebtoken');
const { promisify } = require('util');

/**
 * JWT Utilities for token generation, verification, and management
 */

// Promisify jwt functions for better async/await support
const signAsync = promisify(jwt.sign);
const verifyAsync = promisify(jwt.verify);

class JWTUtils {
  constructor() {
    this.accessTokenSecret = process.env.JWT_SECRET || 'dev-secret-change-in-production';
    this.refreshTokenSecret = process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret-change-in-production';
    this.accessTokenExpiry = process.env.JWT_EXPIRE || '1h';
    this.refreshTokenExpiry = process.env.JWT_REFRESH_EXPIRE || '7d';

    // Validate configuration
    if (process.env.NODE_ENV === 'production' &&
        (this.accessTokenSecret.includes('dev') || this.refreshTokenSecret.includes('dev'))) {
      throw new Error('Production JWT secrets must be properly configured');
    }
  }

  /**
   * Generate access token for user
   * @param {Object} payload - User payload (id, role, email)
   * @param {String} expiresIn - Custom expiry time (optional)
   * @returns {Promise<String>} Access token
   */
  async generateAccessToken(payload, expiresIn = null) {
    try {
      const tokenPayload = {
        userId: payload.userId || payload.id,
        role: payload.role,
        email: payload.email,
        tokenType: 'access',
        iat: Math.floor(Date.now() / 1000)
      };

      const options = {
        expiresIn: expiresIn || this.accessTokenExpiry,
        issuer: 'rehab-tracker',
        audience: 'rehab-tracker-users'
      };

      return await signAsync(tokenPayload, this.accessTokenSecret, options);
    } catch (error) {
      throw new Error(`Token generation failed: ${error.message}`);
    }
  }

  /**
   * Generate refresh token for user
   * @param {Object} payload - User payload (id, role, email)
   * @returns {Promise<String>} Refresh token
   */
  async generateRefreshToken(payload) {
    try {
      const tokenPayload = {
        userId: payload.userId || payload.id,
        email: payload.email,
        tokenType: 'refresh',
        iat: Math.floor(Date.now() / 1000)
      };

      const options = {
        expiresIn: this.refreshTokenExpiry,
        issuer: 'rehab-tracker',
        audience: 'rehab-tracker-users'
      };

      return await signAsync(tokenPayload, this.refreshTokenSecret, options);
    } catch (error) {
      throw new Error(`Refresh token generation failed: ${error.message}`);
    }
  }

  /**
   * Generate both access and refresh tokens
   * @param {Object} user - User object with id, role, email
   * @returns {Promise<Object>} Object with accessToken and refreshToken
   */
  async generateTokenPair(user) {
    try {
      const payload = {
        userId: user._id || user.id,
        role: user.role,
        email: user.email
      };

      const [accessToken, refreshToken] = await Promise.all([
        this.generateAccessToken(payload),
        this.generateRefreshToken(payload)
      ]);

      return {
        accessToken,
        refreshToken,
        tokenType: 'Bearer',
        expiresIn: this.accessTokenExpiry
      };
    } catch (error) {
      throw new Error(`Token pair generation failed: ${error.message}`);
    }
  }

  /**
   * Verify access token
   * @param {String} token - JWT access token
   * @returns {Promise<Object>} Decoded token payload
   */
  async verifyAccessToken(token) {
    try {
      const decoded = await verifyAsync(token, this.accessTokenSecret, {
        issuer: 'rehab-tracker',
        audience: 'rehab-tracker-users'
      });

      // Verify token type
      if (decoded.tokenType !== 'access') {
        throw new Error('Invalid token type');
      }

      return decoded;
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        throw new Error('Access token expired');
      }
      if (error.name === 'JsonWebTokenError') {
        throw new Error('Invalid access token');
      }
      throw new Error(`Access token verification failed: ${error.message}`);
    }
  }

  /**
   * Verify refresh token
   * @param {String} token - JWT refresh token
   * @returns {Promise<Object>} Decoded token payload
   */
  async verifyRefreshToken(token) {
    try {
      const decoded = await verifyAsync(token, this.refreshTokenSecret, {
        issuer: 'rehab-tracker',
        audience: 'rehab-tracker-users'
      });

      // Verify token type
      if (decoded.tokenType !== 'refresh') {
        throw new Error('Invalid token type');
      }

      return decoded;
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        throw new Error('Refresh token expired');
      }
      if (error.name === 'JsonWebTokenError') {
        throw new Error('Invalid refresh token');
      }
      throw new Error(`Refresh token verification failed: ${error.message}`);
    }
  }

  /**
   * Decode token without verification (for debugging)
   * @param {String} token - JWT token
   * @returns {Object} Decoded token payload
   */
  decodeToken(token) {
    try {
      return jwt.decode(token);
    } catch (error) {
      throw new Error(`Token decoding failed: ${error.message}`);
    }
  }

  /**
   * Extract token from Authorization header
   * @param {String} authHeader - Authorization header value
   * @returns {String|null} Extracted token or null
   */
  extractTokenFromHeader(authHeader) {
    if (!authHeader) return null;

    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      return null;
    }

    return parts[1];
  }

  /**
   * Check if token is expired
   * @param {Object} decodedToken - Decoded JWT payload
   * @returns {Boolean} True if expired
   */
  isTokenExpired(decodedToken) {
    if (!decodedToken.exp) return false;
    const currentTime = Math.floor(Date.now() / 1000);
    return decodedToken.exp < currentTime;
  }

  /**
   * Get token expiration time in milliseconds
   * @param {Object} decodedToken - Decoded JWT payload
   * @returns {Number|null} Expiration timestamp in ms or null
   */
  getTokenExpiration(decodedToken) {
    if (!decodedToken.exp) return null;
    return decodedToken.exp * 1000;
  }

  /**
   * Get time until token expiration
   * @param {Object} decodedToken - Decoded JWT payload
   * @returns {Number|null} Time until expiration in milliseconds
   */
  getTimeUntilExpiration(decodedToken) {
    const expTime = this.getTokenExpiration(decodedToken);
    if (!expTime) return null;
    return Math.max(0, expTime - Date.now());
  }

  /**
   * Refresh access token using refresh token
   * @param {String} refreshToken - Valid refresh token
   * @returns {Promise<Object>} New access token data
   */
  async refreshAccessToken(refreshToken) {
    try {
      // Verify refresh token
      const decoded = await this.verifyRefreshToken(refreshToken);

      // Generate new access token with same payload
      const newAccessToken = await this.generateAccessToken({
        userId: decoded.userId,
        role: decoded.role,
        email: decoded.email
      });

      return {
        accessToken: newAccessToken,
        tokenType: 'Bearer',
        expiresIn: this.accessTokenExpiry
      };
    } catch (error) {
      throw new Error(`Token refresh failed: ${error.message}`);
    }
  }

  /**
   * Generate password reset token
   * @param {Object} user - User object
   * @returns {Promise<String>} Password reset token
   */
  async generatePasswordResetToken(user) {
    try {
      const payload = {
        userId: user._id || user.id,
        email: user.email,
        tokenType: 'password_reset',
        iat: Math.floor(Date.now() / 1000)
      };

      const options = {
        expiresIn: '1h', // Password reset tokens expire quickly
        issuer: 'rehab-tracker',
        audience: 'rehab-tracker-password-reset'
      };

      return await signAsync(payload, this.accessTokenSecret, options);
    } catch (error) {
      throw new Error(`Password reset token generation failed: ${error.message}`);
    }
  }

  /**
   * Verify password reset token
   * @param {String} token - Password reset token
   * @returns {Promise<Object>} Decoded token payload
   */
  async verifyPasswordResetToken(token) {
    try {
      const decoded = await verifyAsync(token, this.accessTokenSecret, {
        issuer: 'rehab-tracker',
        audience: 'rehab-tracker-password-reset'
      });

      if (decoded.tokenType !== 'password_reset') {
        throw new Error('Invalid token type');
      }

      return decoded;
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        throw new Error('Password reset token expired');
      }
      throw new Error(`Password reset token verification failed: ${error.message}`);
    }
  }
}

// Export singleton instance
module.exports = new JWTUtils();
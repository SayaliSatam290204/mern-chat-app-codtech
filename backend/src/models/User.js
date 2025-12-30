/**
 * Simple User helper utilities
 *
 * This project uses anonymous users (no auth). The helpers below
 * create lightweight user documents suitable for storing in MongoDB
 * and provide a transformation function for returning safe API data.
 */

/**
 * Create a new user document object.
 * @param {string} username - Display name for the user
 * @param {string} [avatar="👤"] - Optional avatar emoji/string
 * @returns {Object} New user document
 */
function createUserDoc(username, avatar = "👤") {
  return {
    username,
    avatar,
    bio: "",
    status: "online",
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

/**
 * Convert an internal user document into a response object.
 * In the future this can strip sensitive fields if auth is added.
 * @param {Object} user - User document from DB
 * @returns {Object} Sanitized user response
 */
function userToResponse(user) {
  // Currently the user doc contains no secrets so return as-is.
  // Keep this function so sanitization can be added later.
  return user;
}

module.exports = {
  createUserDoc,
  userToResponse,
};

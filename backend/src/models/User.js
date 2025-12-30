/**
 * User model for anonymous chat
 * No password or authentication required
 */

/**
 * Create a new user document
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
 * Convert user doc to safe response
 */
function userToResponse(user) {
  return user;
}

module.exports = {
  createUserDoc,
  userToResponse,
};

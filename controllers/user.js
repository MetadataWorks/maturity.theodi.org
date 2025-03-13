const cron = require("node-cron");
const User = require("../models/user"); // Import the Token model
const Project = require("../models/project");

// Load environment variables securely
require("dotenv").config({ path: "../config.env" });

// Local accounts
async function retrieveUserByEmail(email) {
  const user = await User.findOne({ email });
  return user;
}

// Schedule the task to run at 3:30 am UTC every day
cron.schedule(
  "30 3 * * *",
  async () => {
    console.log(
      "Running the scheduled task to delete local projects and accounts and reset password"
    );
    await updateDefaultPassword(generateRandomPassword(12));
    await deleteLocalProjectsAndAccounts();
  },
  {
    timezone: "UTC",
  }
);

// Function to create a new user
async function createNewUser({ firstName, lastName, email, password }) {
  try {
    let newUser = new User({ firstName, lastName, email, password });
    await newUser.save();
    return newUser;
  } catch (error) {
    throw error; // Propagate the error to the caller
  }
}

async function deleteUser(userId) {
  try {
    // Find the user by their ID and delete it
    const deletedUser = await User.findByIdAndDelete(userId);
    return deletedUser;
  } catch (error) {
    throw error; // Propagate the error to the caller
  }
}

module.exports = {
  retrieveUserByEmail,
  createNewUser,
  deleteUser,
};

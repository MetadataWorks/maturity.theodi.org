const Hubspot = require('../models/hubspot');

const isMember = async (req, res, next) => {
    const user = req.user;
    const userId = user._id; // Assuming user ID is available in req.user after authentication

    // 1. Look up the user in the HubSpot table to find if membershipStatus is "Active"
    const hubspotUser = await Hubspot.findOne({ userId });
    if (hubspotUser && hubspotUser.membershipStatus === "Active") {
        // If membershipStatus is active, proceed to the next middleware or route handler
        return next();
    } else {
        return res
          .status(403)
          .json({
            message: `You need to be a MDW member to access AI summaries.`,
          });
    }
}

module.exports = { isMember };

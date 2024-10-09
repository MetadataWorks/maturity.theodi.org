const Hubspot = require('../models/hubspot');
const User = require('../models/user');
const hubspot = require('@hubspot/api-client');
const projectController = require('../controllers/project');
const cron = require('node-cron');
const crypto = require('crypto');
const { json } = require('express');

const hubspotKey = process.env.HUBSPOT_API_KEY;

const hubspotClient = new hubspot.Client({ accessToken: hubspotKey })


/**
 * Computes a SHA256 hash of the given data.
 * @param {Object} data - The data to hash.
 * @returns {string} The hexadecimal hash string.
 */
const computeHash = (data) => {
    return crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex');
};

/**
 * Formats a JavaScript Date object to YYYY-MM-DD.
 * @param {Date} date - The date to format.
 * @returns {string} The formatted date string.
 */
const formatDate = (date) => {
    const d = new Date(date);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${year}-${month}-${day}`;
};

async function getHubspotUser(userId, email) {
    try {
        const contactSearchRequest = {
            filterGroups: [
                {
                    filters: [
                        {
                            propertyName: "email",
                            operator: "EQ",
                            value: email
                        }
                    ]
                }
            ],
            properties: ["email", "firstname", "lastname", "associatedcompanyid", "odi_membership__active_or_lapsed__", "odi_member_partner_type"]
        };

        const contactResponse = await hubspotClient.crm.contacts.searchApi.doSearch(contactSearchRequest);

        if (!contactResponse || !contactResponse.results || contactResponse.results.length === 0) {
            throw new Error("No contact found with the provided email.");
        }

        const companyId = contactResponse.results[0].properties.associatedcompanyid;
        const hubSpotId = contactResponse.results[0].id;
        let membershipStatus = contactResponse.results[0].properties.odi_membership__active_or_lapsed__;
        let membershipType = contactResponse.results[0].properties.odi_member_partner_type;
        let companyMembership = false;

        // If companyId is valid, fetch company details
        if (companyId) {
            try {
                const companySearchRequest = {
                    filterGroups: [
                        {
                            filters: [
                                {
                                    propertyName: "hs_object_id",
                                    operator: "EQ",
                                    value: companyId
                                }
                            ]
                        }
                    ],
                    properties: ["name", "odi_membership_status__active_or_lapsed__", "member_partner_type_org_"]
                };
                const companyResponse = await hubspotClient.crm.companies.searchApi.doSearch(companySearchRequest);

                if (companyResponse && companyResponse.results && companyResponse.results.length > 0) {
                    if (companyResponse.results[0].properties.odi_membership_status__active_or_lapsed__ === "Active") {
                        companyMembership = true;
                        membershipStatus = "Active";
                        membershipType = companyResponse.results[0].properties.member_partner_type_org_;
                    }
                }
            } catch (companyError) {
                console.warn("Error fetching company details:", companyError);
                // Continue without company details if there's an error fetching them
            }
        }

        // Check if a record with the hubSpotId already exists
        let existingRecord = await Hubspot.findOne({ hubSpotId });

        if (existingRecord) {
            // Update the existing record
            existingRecord.userId = userId;
            existingRecord.companyMembership = companyMembership;
            existingRecord.membershipStatus = membershipStatus;
            existingRecord.membershipType = membershipType;

            await existingRecord.save();
        } else {
            // Create a new record
            const newRecord = new Hubspot({
                userId,
                hubSpotId,
                companyMembership,
                membershipStatus,
                membershipType
            });

            await newRecord.save();
        }
    } catch (error) {
        console.error("Error in getHubspotUser:", error);
    }
}

async function getHubspotProfile(userId) {
    try {
        // Find the user record in the Hubspot table with the provided userId
        const hubspotProfile = await Hubspot.findOne({ userId });
        return hubspotProfile;
    } catch (error) {
        console.error("Error in getHubspotProfile:", error);
        throw error; // Rethrow the error to be handled elsewhere
    }
}

async function updateToolStatistics() {
    // Fetch all HubSpot profiles with populated userId
    const hubspotProfiles = await Hubspot.find({}).populate('userId');

    for (const profile of hubspotProfiles) {
        const user = await User.findById(profile.userId);

        if (!user) {
            console.warn(`User not found for HubSpot profile ID: ${profile.hubSpotId}`);
            continue;
        }

        // Fetch user's projects with populated assessments
        const userProjects = await projectController.getUserProjects(user._id);
        const projects = userProjects.ownedProjects;

        if (!projects || !Array.isArray(projects)) {
            console.warn(`No projects found for user ID: ${user._id}`);
            continue;
        }

        // Build the userData array using populated assessments
        const userData = projects.map(project => ({
            assessmentId: project._id,
            assessmentTitle: project.assessment?.title || 'Unknown Assessment',
            achievedLevel: project.assessmentData?.overallAchievedLevel ?? null,
            activityCompletionPercentage: project.assessmentData?.activityCompletionPercentage ?? null,
            statementCompletionPercentage: project.assessmentData?.statementCompletionPercentage ?? null,
            created: formatDate(project.created),
            lastModified: formatDate(project.lastModified)
        }));

        // Compute current hash
        const currentHash = computeHash(userData);

        // Compare with stored hash
        if (currentHash === profile.lastUpdatedHash) {
            console.log(`No changes detected for user ID: ${user._id}. Skipping update.`);
            continue;
        }

        // Calculate statistics
        const totalAssessments = projects.length;
        const completedAssessments = projects.filter(project => project.assessmentData?.statementCompletionPercentage === 100).length;

        // Prepare the data to be patched to HubSpot
        const patchData = {
            properties: {
                completed_assessments__maturity_: completedAssessments,
                first_login__maturity_: formatDate(user.firstLogin),
                last_login__maturity_: formatDate(user.lastLogin),
                login_count__maturity_: user.loginCount,
                total_assessments__maturity_: totalAssessments,
                json_data__maturity_: JSON.stringify(userData)
            }
        };

        // Update the HubSpot contact
        try {
            await hubspotClient.crm.contacts.basicApi.update(profile.hubSpotId, patchData);
            console.log(`HubSpot profile updated for user ID: ${user._id}`);
        } catch (hubspotError) {
            console.error(`Error updating HubSpot for user ID: ${user._id}:`, hubspotError);
            continue; // Skip updating the hash if HubSpot update fails
        }

        // Update the stored hash
        profile.lastUpdatedHash = currentHash;
        try {
            await profile.save();
            console.log(`Hash updated for user ID: ${user._id}`);
        } catch (saveError) {
            console.error(`Error saving hash for user ID: ${user._id}:`, saveError);
        }
    }

    console.log('Scheduled updateToolStatistics job completed.');
}

function initializeScheduledJobs() {
    // Schedule the job to run every hour
    cron.schedule('0 * * * *', () => {
        updateToolStatistics();
    });

    console.log('Scheduled updateToolStatistics job initialized to run every hour.');
}

module.exports = { getHubspotUser, getHubspotProfile, updateToolStatistics, initializeScheduledJobs };
const mongoose = require('mongoose');
const Project = require('../models/project');
const User = require('../models/user'); // Import the User model

async function getUserProjects(userId) {
    try {
        // Convert userId string to ObjectId
        const userIdObjectId = new mongoose.Types.ObjectId(userId);
        const user = await User.findById(userId);
        if (!user) {
            throw new Error("User not found");
        }
        const userEmail = user.email;

        // Find all projects where the user is the owner
        const ownedProjects = await Project.find({ owner: userIdObjectId });

        // Find all projects shared with the user
        const sharedProjects = await Project.find({ "sharedWith.user": userEmail });

        // Fetch owner names for shared projects only
        const sharedProjectsPromises = sharedProjects.map(async project => {
            const owner = await User.findById(project.owner);
            return {
                id: project._id,
                title: project.title,
                owner: owner ? owner.name : "Unknown", // Use owner's name or "Unknown" if not found
                lastModified: project.lastModified
            };
        });
        const filteredSharedProjects = await Promise.all(sharedProjectsPromises);


        return {
            ownedProjects: ownedProjects,
            sharedProjects: filteredSharedProjects
        };
    } catch (error) {
        throw error; // Propagate the error to the caller
    }
}

async function getProjectOwner(project) {
    try {
        // Validate that the project object has an owner field
        if (!project || !project.owner) {
            throw new Error("Invalid project object or missing owner field");
        }

        // Find the owner user by ID
        const owner = await User.findById(project.owner);
        if (!owner) {
            throw new Error("Owner not found");
        }

        // Return owner details
        return {
            id: owner._id,
            name: owner.name,
            email: owner.email
        };
    } catch (error) {
        console.error("Error retrieving project owner:", error);
        throw error; // Propagate the error to the caller
    }
}

module.exports = { getUserProjects, getProjectOwner };
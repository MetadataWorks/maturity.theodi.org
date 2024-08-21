const Project = require('../models/project');
const Assessment = require('../models/assessment');
const User = require('../models/user');
const { buildDocx } = require('../lib/docxBuilder');
const { parse } = require('json2csv');
const path = require('path');
const fs = require('fs');

async function getUserProjects(userId) {
    try {
        const user = await User.findById(userId);
        if (!user) throw new Error("User not found");

        const userEmail = user.email;

        const ownedProjects = await Project.find({ owner: userId }).lean();
        const sharedProjects = await Project.find({ "sharedWith.user": userEmail });

        const filteredSharedProjects = await Promise.all(
            sharedProjects.map(async (project) => {
                const owner = await User.findById(project.owner);
                return {
                    id: project._id,
                    title: project.title,
                    owner: owner ? owner.name : "Unknown",
                    lastModified: project.lastModified
                };
            })
        );

        // Cache to store fetched assessments
        const assessmentCache = {};

        // Helper function to get assessment and cache it
        async function getAssessmentById(assessmentId) {
            if (!assessmentCache[assessmentId]) {
                const assessment = await Assessment.findById(assessmentId).lean();
                if (assessment) {
                    delete assessment.activities; // Remove activities field
                    assessmentCache[assessmentId] = assessment;
                }
            }
            return assessmentCache[assessmentId];
        }

        // Populate assessment for each owned project
        for (const project of ownedProjects) {
            if (project.assessment) {
                project.assessment = await getAssessmentById(project.assessment);
            }
        }
        // Populate assessment for each owned project
        for (const project of filteredSharedProjects) {
            if (project.assessment) {
                project.assessment = await getAssessmentById(project.assessment);
            }
        }

        return { ownedProjects, sharedProjects: filteredSharedProjects };
    } catch (error) {
        throw error;
    }
}

async function getProjectById(projectId) {
    try {
        return await Project.findById(projectId);
    } catch (error) {
        throw new Error("Project not found");
    }
}

async function getProjectOwner(project) {
    try {
        if (!project || !project.owner) throw new Error("Invalid project object or missing owner field");
        const owner = await User.findById(project.owner);
        if (!owner) throw new Error("Owner not found");
        return { id: owner._id, name: owner.name, email: owner.email };
    } catch (error) {
        console.error("Error retrieving project owner:", error);
        throw error;
    }
}


async function createProject(projectData, userId) {
    try {
        // Assign the owner of the project
        projectData.owner = userId;

        // Fetch the selected assessment using the assessment ID provided in projectData
        const assessment = await Assessment.findById(projectData.assessment);

        if (!assessment) {
            throw new Error("Selected assessment not found");
        }

        // Clone the dimensions of the assessment into the project's assessmentData field
        projectData.assessmentData = {
            dimensions: assessment.dimensions
        };

        // Create a new project instance
        const project = new Project(projectData);

        // Save the project to the database
        return await project.save();
    } catch (error) {
        throw new Error("Error creating project: " + error.message);
    }
}

async function updateProject(projectId, projectData) {
    try {
        const updatedProject = await Project.findByIdAndUpdate(projectId, projectData, { new: true });
        if (!updatedProject) throw new Error("Project not found");
        return updatedProject;
    } catch (error) {
        throw new Error("Error updating project: " + error.message);
    }
}

async function deleteProject(projectId) {
    try {
        const deletedProject = await Project.findByIdAndDelete(projectId);
        if (!deletedProject) throw new Error("Project not found");
        return deletedProject;
    } catch (error) {
        throw new Error("Error deleting project: " + error.message);
    }
}

async function handleProjectExport(project, format, res) {
    try {
        switch (format) {
            case 'json':
                return res.json(project);
            case 'csv':
                const fields = ['consequence', 'outcome', 'impact', 'likelihood', 'role', 'action.description', 'action.date', 'action.stakeholder', 'action.KPI'];
                const opts = { fields };
                const csv = parse(project.unintendedConsequences, opts);
                res.setHeader('Content-Disposition', `attachment; filename=${project.title.replace(/\s+/g, '_').trim()}.csv`);
                res.setHeader('Content-Type', 'text/csv');
                return res.send(csv);
            case 'docx':
                const owner = await getProjectOwner(project);
                const metrics = await getUserProjectMetrics([project]); // Assuming getUserProjectMetrics is defined elsewhere
                const tempFilePath = await buildDocx(project, metrics, owner);
                const fileName = `${project.title.replace(/\s+/g, '_').trim()}.docx`;
                res.set('Content-Disposition', `attachment; filename="${fileName}"`);
                res.set('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
                return res.sendFile(path.resolve(tempFilePath), async (err) => {
                    if (!err) {
                        try {
                            await fs.promises.unlink(tempFilePath);
                        } catch (error) {
                            console.error("Error deleting temporary file:", error);
                        }
                    }
                });
            default:
                throw new Error("Unsupported export format");
        }
    } catch (error) {
        throw new Error("Error handling project export: " + error.message);
    }
}

async function addSharedUser(projectId, email) {
    try {
        const project = await getProjectById(projectId);
        if (!project) throw new Error("Project not found");
        project.sharedWith.push({ user: email });
        await project.save();
        return project;
    } catch (error) {
        throw new Error("Error adding shared user: " + error.message);
    }
}

async function removeSharedUser(projectId, userId) {
    try {
        const project = await getProjectById(projectId);
        if (!project) throw new Error("Project not found");
        project.sharedWith = project.sharedWith.filter(user => user.user !== userId);
        await project.save();
        return project;
    } catch (error) {
        throw new Error("Error removing shared user: " + error.message);
    }
}

module.exports = {
    getUserProjects,
    getProjectById,
    getProjectOwner,
    createProject,
    updateProject,
    deleteProject,
    handleProjectExport,
    addSharedUser,
    removeSharedUser
};
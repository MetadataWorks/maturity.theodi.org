const express = require('express');
const router = express.Router();
const projectController = require('../controllers/project');
const Assessment = require('../models/assessment');
const { ensureAuthenticated } = require('../middleware/auth'); // Assuming this middleware exists
const { loadProject, checkProjectAccess, checkProjectOwner } = require('../middleware/project');
const { generateDocxReport } = require('../lib/docxBuilder');
const { Document, Packer } = require('docx');
const fs = require('fs');
const path = require('path');

router.get('/', ensureAuthenticated, async (req, res, next) => {
    try {
        const userId = req.user._id;
        const acceptHeader = req.get('Accept');
        if (acceptHeader === 'application/json') {
            const userProjects = await projectController.getUserProjects(userId);
            return res.json(userProjects);
        } else {
            const page = { title: "Evaluations", link: "/projects" };
            res.locals.page = page;
            return res.render('pages/projects/view');
        }
    } catch (error) {
        console.log('projects error', error);
        next(error);
    }
});

router.get('/new', ensureAuthenticated, (req, res) => {
    const page = { title: "Project details", link: "projectDetails" };
    res.locals.page = page;
    res.render('pages/projects/new');
});

router.get('/:id', ensureAuthenticated, checkProjectAccess, async (req, res, next) => {
    try {
        const projectId = req.params.id;
        const acceptHeader = req.get('Accept');
        if (acceptHeader === 'application/json') {
            let project = await projectController.getProjectById(projectId);
            project = project.toObject();
            delete project.owner;
            delete project.sharedWith;
            return res.json(project);
        } else {
            let project = await projectController.getProjectById(projectId);
            let assessment = await Assessment.findById(project.assessment);
            const page = { title: "Edit Project", link: "/projects" };
            res.locals.page = page;
            res.locals.pathway = false;
            if (assessment.title === "Open Data Pathway (2015)") {
                console.log('pathway detected');
                res.locals.pathway = true;
            }
            return res.render('pages/projects/edit');
        }
    } catch (error) {
        console.log(error);
        next(error);
    }
});
router.get('/:id/report', ensureAuthenticated, checkProjectAccess, async (req, res, next) => {
    try {
        const projectId = req.params.id;
        const project = await projectController.getProjectById(projectId);
        const acceptHeader = req.get('Accept');

        if (acceptHeader === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
            let owner = await projectController.getProjectOwner(project);
            let template = "template";
            const assessmentId = project.assessment;
            const assessmentData = await Assessment.findById(assessmentId);
            if (assessmentData.source) {
                template = assessmentData.source
            }
            const tempFilePath = await generateDocxReport(project,owner,template);
            const fileName = `${project.title.replace(/\s+/g, '_').trim()}.docx`;
            //const buffer = await docx.Packer.toBuffer(doc);
            res.set('Content-Disposition', `attachment; filename="${fileName}"`);
            res.set('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
            res.sendFile(path.resolve(tempFilePath), async (err) => {
                if (err) {
                    console.error("Error sending file:", err);
                } else {
                    // Cleanup temporary file after sending
                    try {
                        await fs.promises.unlink(tempFilePath);
                    } catch (error) {
                        console.error("Error deleting temporary file:", error);
                    }
                }
            });
        } else {
            const page = { title: "Project Report", link: "/projects" };
            res.locals.page = page;
            return res.render('pages/projects/report');
        }
    } catch (error) {
        console.log(error);
        next(error);
    }
});

router.post('/', ensureAuthenticated, async (req, res) => {
    try {
        const userId = req.user._id;
        const project = await projectController.createProject(req.body, userId);
        res.status(201).json(project);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

router.put('/:id', ensureAuthenticated, checkProjectAccess, async (req, res) => {
    try {
        const projectId = req.params.id;
        const updatedProject = await projectController.updateProject(projectId, req.body);
        res.json(updatedProject);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

router.delete('/:id', ensureAuthenticated, checkProjectOwner, async (req, res) => {
    try {
        const projectId = req.params.id;
        const deletedProject = await projectController.deleteProject(projectId);
        res.json({ message: "Project deleted successfully" });
    } catch (error) {
        res.status(500).json({ message: "Internal server error" });
    }
});

router.get('/:id/sharedUsers', ensureAuthenticated, checkProjectAccess, async (req, res) => {
    try {
        const projectId = req.params.id;
        const project = await projectController.getProjectById(projectId);
        const sharedUsers = project.sharedWith.map(user => user.user);
        res.json({ sharedUsers });
    } catch (error) {
        res.status(500).json({ message: "Internal server error" });
    }
});

router.post('/:id/sharedUsers', ensureAuthenticated, checkProjectOwner, async (req, res) => {
    try {
        const projectId = req.params.id;
        const { email } = req.body;
        await projectController.addSharedUser(projectId, email);
        res.json({ message: "User added to the project successfully" });
    } catch (error) {
        res.status(500).json({ message: "Internal server error" });
    }
});

router.delete('/:id/sharedUsers/:userId', ensureAuthenticated, checkProjectOwner, async (req, res) => {
    try {
        const projectId = req.params.id;
        const userId = req.params.userId;
        await projectController.removeSharedUser(projectId, userId);
        res.json({ message: "Shared user removed from the project successfully" });
    } catch (error) {
        res.status(500).json({ message: "Internal server error" });
    }
});

module.exports = router;
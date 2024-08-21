const express = require('express');
const router = express.Router();
const projectController = require('../controllers/project');
const { ensureAuthenticated } = require('../middleware/auth'); // Assuming this middleware exists
const { loadProject, checkProjectAccess, checkProjectOwner } = require('../middleware/project');

router.get('/', ensureAuthenticated, async (req, res, next) => {
    try {
        const userId = req.session.passport.user.id;
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
            const project = await projectController.getProjectById(projectId);
            return res.json(project);
        } else {
            const page = { title: "Edit Project", link: "/projects" };
            res.locals.page = page;
            return res.render('pages/projects/edit');
        }
    } catch (error) {
        console.log(error);
        next(error);
    }
});

router.post('/', ensureAuthenticated, async (req, res) => {
    try {
        const userId = req.session.passport.user.id;
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
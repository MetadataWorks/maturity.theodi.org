const express = require('express');
const router = express.Router();
const assessmentsController = require('../controllers/assessment');
const { canAccessAssessment, canAdminAssessment } = require('../middleware/assessment');

// Route to either get all assessments or get a single assessment by title
router.get('/', async (req, res, next) => {
    if (req.query.title) {
        // If the title query parameter exists, get the assessment by title
        await assessmentsController.getAssessmentByTitle(req, res, next);
    } else {
        // Otherwise, get all assessments
        await assessmentsController.getAllAssessments(req, res, next);
    }
});

// Route to create a new assessment (no specific access control needed)
router.post('/', assessmentsController.createAssessment);

// Route to update an existing assessment by ID (with admin access control)
router.put('/:assessmentID', canAdminAssessment, assessmentsController.updateAssessment);

// Route to get a single assessment by ID as JSON (with access control)
router.get('/:assessmentID', canAccessAssessment, assessmentsController.getAssessmentById);

module.exports = router;
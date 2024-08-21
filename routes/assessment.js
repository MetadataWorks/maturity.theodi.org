const express = require('express');
const router = express.Router();
const assessmentsController = require('../controllers/assessment');
const { canAccessAssessment, canAdminAssessment } = require('../middleware/assessment');

// Route to get all assessments (filtered in the controller)
router.get('/', assessmentsController.getAllAssessments);

// Route to create a new assessment (no specific access control needed)
router.post('/', assessmentsController.createAssessment);

// Route to update an existing assessment by ID (with admin access control)
router.put('/:assessmentID', canAdminAssessment, assessmentsController.updateAssessment);

// Route to get a single assessment by ID as JSON (with access control)
router.get('/:assessmentID', canAccessAssessment, assessmentsController.getAssessmentById);

module.exports = router;
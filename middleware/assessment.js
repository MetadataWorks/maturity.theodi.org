const Assessment = require('../models/assessment'); // Import your Assessment model

// Middleware to check if the user can access an assessment (for GET requests)
const canAccessAssessment = async (req, res, next) => {
    try {
        const assessmentId = req.params.assessmentID;
        const userId = req.session.passport.user.id;
        const userEmail = req.session.passport.user.email;

        // Find the assessment by ID
        const assessment = await Assessment.findById(assessmentId);

        // If the assessment is not found, throw a 404 error
        if (!assessment) {
            const error = new Error("Assessment not found");
            error.status = 404;
            throw error;
        }

        // Check if the assessment is public
        if (assessment.public) {
            return next(); // Public assessment, allow access
        }

        // Check if the user is the owner of the assessment
        if (assessment.owner.equals(userId)) {
            return next(); // User is the owner, allow access
        }

        // Check if the assessment is shared with the user with a role of 'user' or 'admin'
        const sharedWithUser = assessment.sharedWith.find(user => user.email === userEmail);
        if (sharedWithUser && (sharedWithUser.role === 'user' || sharedWithUser.role === 'admin')) {
            return next(); // Assessment is shared with the user, allow access
        }

        // If the user does not have access, deny access
        const error = new Error("Unauthorized access");
        error.status = 403;
        throw error;
    } catch (error) {
        return next(error); // Pass error to the error handling middleware
    }
};

// Middleware to check if the user can admin (edit) an assessment (for PUT requests)
const canAdminAssessment = async (req, res, next) => {
    try {
        const assessmentId = req.params.assessmentID;
        const userId = req.session.passport.user.id;
        const userEmail = req.session.passport.user.email;

        // Find the assessment by ID
        const assessment = await Assessment.findById(assessmentId);

        // If the assessment is not found, throw a 404 error
        if (!assessment) {
            const error = new Error("Assessment not found");
            error.status = 404;
            throw error;
        }

        // Check if the user is the owner of the assessment
        if (assessment.owner.equals(userId)) {
            return next(); // User is the owner, allow access
        }

        // Check if the assessment is shared with the user with the role of 'admin'
        const sharedWithUser = assessment.sharedWith.find(user => user.email === userEmail);
        if (sharedWithUser && sharedWithUser.role === 'admin') {
            return next(); // User is an admin, allow access
        }

        // If the user does not have admin access, deny access
        const error = new Error("Unauthorized access");
        error.status = 403;
        throw error;
    } catch (error) {
        return next(error); // Pass error to the error handling middleware
    }
};

module.exports = { canAccessAssessment, canAdminAssessment };

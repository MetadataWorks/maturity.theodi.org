const Assessment = require('../models/assessment');

// GET / - Get all assessments (filtered by user's access)
exports.getAllAssessments = async (req, res) => {
  try {
    const userId = req.session.passport.user.id;
    const userEmail = req.session.passport.user.email;

    // Find assessments that are public, owned by the user, or shared with the user
    const assessments = await Assessment.find({
      $or: [
        { public: true },
        { owner: userId },
        { "sharedWith.email": userEmail }
      ]
    });

    if (req.accepts('html')) {
      res.locals.pageTitle = "View Asessments";
      res.render('pages/assessments/view');
    } else {
      return res.json(assessments);
    }

  } catch (error) {
    console.log(error);
    res.status(500).json({ message: 'Error retrieving assessments', error });
  }
};

// GET /:assessmentID - Get a single assessment by ID as JSON
exports.getAssessmentById = async (req, res) => {
  try {
    const assessmentId = req.params.assessmentID;

    // The canAccessAssessment middleware has already validated access
    const assessment = await Assessment.findById(assessmentId);

    res.json(assessment);
  } catch (error) {
    res.status(500).json({ message: 'Error retrieving assessment', error });
  }
};

// POST / - Create a new assessment
exports.createAssessment = async (req, res) => {
  try {
    const { title, description, owner, organisation, public } = req.body;

    const newAssessment = new Assessment({
      title,
      description,
      owner,
      organisation,
      public: public || false // Set the public field, defaulting to false if not provided
    });

    const savedAssessment = await newAssessment.save();
    res.status(201).json(savedAssessment);
  } catch (error) {
    res.status(400).json({ message: 'Error creating assessment', error });
  }
};

// PUT /:assessmentID - Update an assessment with dimensions, activities, etc.
exports.updateAssessment = async (req, res) => {
  try {
    const { assessmentID } = req.params;
    const updateData = req.body;

    const updatedAssessment = await Assessment.findByIdAndUpdate(
      assessmentID,
      updateData,
      { new: true, runValidators: true }
    );

    if (!updatedAssessment) {
      return res.status(404).json({ message: 'Assessment not found' });
    }

    res.json(updatedAssessment);
  } catch (error) {
    res.status(400).json({ message: 'Error updating assessment', error });
  }
};
const mongoose = require('mongoose');

const User = require('./models/user');
const Project = require('./models/project');

// Connect to MongoDB
mongoose.connect('mongodb://localhost:27017/odiMaturity', { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('Could not connect to MongoDB...', err));

// Function to update projects with user ObjectId
async function updateProjects() {
  try {
    // Fetch all projects
    const projects = await Project.find({});
    console.log(projects);

    for (const project of projects) {
      // Find user by tempUser field
      const user = await User.findOne({ _id: project.tempUser });
      if (user) {
        // Update project owner to user ObjectId
        project.owner = user._id;
        project.assessmentTemplate = "Pathway";
        project.title = project.title ?? "New Assessment";
        delete project.tempUser;
        await project.save();
        console.log(`Updated project ${project._id} with owner ${user._id}`);
      } else {
        console.log(`User with tempUser ${project.owner} not found`);
      }
    }
    console.log('Projects update completed');
  } catch (error) {
    console.error('Error updating projects:', error);
  } finally {
    // Disconnect from MongoDB
    mongoose.disconnect();
  }
}

// Run the update function
updateProjects();

const fs = require('fs');
const path = require('path');
const Assessment = require('../models/assessment'); // Adjust the path as needed

async function loadAssessments() {
  const assessmentsDir = path.join(__dirname, '../private', 'assessments');

  fs.readdir(assessmentsDir, async (err, files) => {
    if (err) {
      console.error('Error reading assessments directory:', err);
      return;
    }

    for (const file of files) {
      const filePath = path.join(assessmentsDir, file);

      // Ensure the file is a JSON file
      if (path.extname(file) !== '.json') continue;

      try {
        const rawData = fs.readFileSync(filePath, 'utf8');
        const assessmentData = JSON.parse(rawData);

        // Add the source (filename without extension) to the assessment data
        const source = path.basename(file, '.json');
        assessmentData.source = source;

        // Ensure organisation structure is correct
        if (!assessmentData.organisation ||
            !assessmentData.organisation.name ||
            !assessmentData.organisation.country ||
            !assessmentData.organisation.country.name ||
            !assessmentData.organisation.country.code ||
            !assessmentData.organisation.homePage) {
          console.error(`Invalid organisation data in ${file}`);
          continue;
        }

        // Upsert the assessment into the database
        await Assessment.findOneAndUpdate(
          { source: source }, // Find the document by source
          assessmentData,     // Update with the assessment data
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );

        console.log(`Loaded assessment from ${file}`);
      } catch (err) {
        console.error(`Error loading assessment from ${file}:`, err);
      }
    }
  });
}

module.exports = loadAssessments;
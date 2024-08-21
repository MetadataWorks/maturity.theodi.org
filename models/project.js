const mongoose = require('mongoose');

// Define the country schema
const countrySchema = new mongoose.Schema({
    name: {
        type: String
    },
    code: {
        type: String
    }
}, { _id: false }); // _id: false to prevent creation of an _id field in this subdocument

// Define the organisation schema
const organisationSchema = new mongoose.Schema({
    title: {
        type: String
    },
    country: {
        type: countrySchema,
        required: false
    }
}, { _id: false });

// Define the project schema
const projectSchema = new mongoose.Schema({
    owner: {
        type: mongoose.Schema.Types.ObjectId,
        required: true
    },
    sharedWith: [{
        user: {
            type: String
        }
    }],
    created: {
        type: Date,
        default: Date.now // Default value is the current date/time
    },
    lastModified: {
        type: Date,
        default: Date.now // Default value is the current date/time
    },
    title: {
        type: String,
        required: true
    },
    notes: {
        type: String
    },
    assessment: {
        type: mongoose.Schema.Types.ObjectId,
        required: true
    },
    assessmentData: {
        type: mongoose.Schema.Types.Mixed
    },
    organisation: {
        type: organisationSchema,
        required: false
    },
    tempUser: {
        type: String
    }
}, {
    collection: 'Projects' // Specify the collection name
});

// Middleware to update lastModified before saving the project
projectSchema.pre('save', function(next) {
    this.lastModified = new Date(); // Update lastModified to the current date/time
    next();
});

const Project = mongoose.model('Project', projectSchema);

module.exports = Project;
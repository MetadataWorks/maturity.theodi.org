const mongoose = require('mongoose');

// Define the schema for the sharedWith field
const sharedWithSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    match: [/.+@.+\..+/, 'Please enter a valid email address']
  },
  role: {
    type: String,
    enum: ['user', 'admin', ''],
    default: ''
  }
}, {
  _id: false // Prevent Mongoose from creating _id for subdocuments
});

// Define the statement schema
const statementSchema = new mongoose.Schema({
  text: {
    type: String
  },
  notes: {
    type: String
  },
  tags: [{
    type: String
  }],
  associatedLevel: {
    type: Number
  },
  positive: {
    type: Boolean
  }
}, { _id: false });

// Define the activity schema
const activitySchema = new mongoose.Schema({
  title: {
    type: String
  },
  statements: [statementSchema]
}, { _id: false });

// Define the dimension schema
const dimensionSchema = new mongoose.Schema({
  name: {
    type: String
  },
  activities: [activitySchema]
}, { _id: false });

// Define the organisation schema
const organisationSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  country: {
    name: {
      type: String,
      required: true
    },
    code: {
      type: String,
      required: true
    }
  },
  homePage: {
    type: String,
    validate: {
      validator: function(v) {
        return /^(https?|ftp):\/\/[^\s/$.?#].[^\s]*$/.test(v);
      },
      message: props => `${props.value} is not a valid URL!`
    },
    required: [true, 'Organisation homepage URL required']
  }
}, { _id: false });

// Define the assessment schema
const assessmentSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true
  },
  description: {
    type: String
  },
  owner: {
    type: String,
    required: true,
    match: [/.+@.+\..+/, 'Please enter a valid email address']
  },
  source: {
    type: String,
    unique: true
  },
  organisation: {
    type: organisationSchema,
    required: true
  },
  sharedWith: [sharedWithSchema], // Optional field for sharing assessments with others
  public: {
    type: Boolean,
    default: false, // Default value is false (not public)
    required: true
  },
  creationDate: {
    type: Date,
    default: Date.now,
    required: true
  },
  modifiedDate: {
    type: Date,
    default: Date.now,
    required: true
  },
  dimensions: [dimensionSchema]
}, {
  collection: 'Assessments',
  timestamps: { createdAt: 'creationDate', updatedAt: 'modifiedDate' } // Automatic handling of creation and modification dates
});

// Create the Assessment model
const Assessment = mongoose.model('Assessment', assessmentSchema);

module.exports = Assessment;
# ODI Maturity Assessment Tool

The **ODI Maturity Assessment Tool** is a web-based application designed to help organisations assess their maturity across various data-related domains. The tool currently includes the **Open Data Maturity Model** assessment, with upcoming models including the **Data Ethics Maturity Model** and the **Data Practices Maturity Assessment**.

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Available Assessments](#available-assessments)
- [Installation](#installation)
- [Running the Application](#running-the-application)
- [Usage](#usage)
- [Contributing](#contributing)
- [License](#license)

## Overview

The ODI Maturity Assessment Tool is designed to support organisations in understanding their current capabilities in managing and utilising data. By using this tool, organisations can assess their maturity levels, identify areas for improvement, and track progress over time.

## Features

- **Interactive Assessments**: Users can interact with assessments to evaluate their organisation's maturity.
- **Progress Tracking**: Track progress over time and view historical assessments.
- **Detailed Reporting**: Generate detailed reports that summarise the assessment results and provide actionable insights.
- **Customisable Assessments**: Upcoming features will allow for more customisation in assessments and evaluation criteria.

## Available Assessments

### 1. Open Data Maturity Model
This model assesses an organisation's maturity in publishing and using open data. It helps organisations understand where they are on their open data journey and what steps they need to take to progress.

### 2. Data Ethics Maturity Model (Coming Soon)
This model will help organisations assess their maturity in handling data ethically, ensuring that data practices are aligned with ethical standards.

### 3. Data Practices Maturity Assessment (Coming Soon)
This assessment will evaluate an organisation's data practices across key areas of data governance and management.

## Installation

### Prerequisites

Before installing the ODI Maturity Assessment Tool, ensure you have the following installed on your system:

- **Node.js** (v14.x or later)
- **npm** (v6.x or later)
- **MongoDB** (Ensure you have a running MongoDB instance)

### Step-by-Step Installation

1. **Clone the Repository**
   ```bash
   git clone https://github.com/yourusername/maturity.theodi.org.git
   cd omaturity.theodi.org
   ```

2. **Install Dependencies**
   Install the necessary Node.js packages by running:
   ```bash
   npm install
   ```

3. **Configure the Environment Variables**
   Create a `config.env` file in the root directory and add the following environment variables as well as login method:

   ```
   NODE_ENV=development
   PORT=3000
   MONGODB_URI=mongodb://localhost:27017/odi_maturity_tool
   SESSION_SECRET=your-secret-key
   ```

   Replace `your-secret-key` with a secure string.

## Running the Application

Once the installation is complete, you can start the application with:

```bash
npm start
```

The application will be accessible at `http://localhost:3000` by default.

## Usage

### Accessing Assessments

- **Open Data Maturity Model**: Navigate to the assessment section and select the Open Data Maturity Model to start the evaluation.
- **Upcoming Assessments**: Look out for updates that will introduce new assessments like the Data Ethics Maturity Model and Data Practices Maturity Assessment.

### Generating Reports

After completing an assessment, you can generate a detailed report. Reports can be downloaded in various formats, such as JSON or DOCX, for further analysis.

## Contributing

We welcome contributions from the community! If you'd like to contribute, please follow these steps:

1. Fork the repository.
2. Create a new branch (`git checkout -b feature/your-feature-name`).
3. Make your changes.
4. Commit your changes (`git commit -am 'Add new feature'`).
5. Push to the branch (`git push origin feature/your-feature-name`).
6. Create a new Pull Request.

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
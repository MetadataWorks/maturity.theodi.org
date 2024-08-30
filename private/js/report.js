function createReportTableHeadings(levelKeys) {
    const table = document.getElementById('report-table');
    const header = table.insertRow();

    const th = document.createElement('th');
    th.textContent = "";
    th.className = "dimensions";
    header.appendChild(th);

    levelKeys.forEach((level, index) => {
        const th = document.createElement('th');
        th.textContent = level;
        th.className = "level-" + (index + 1) + " level";
        header.appendChild(th);
    });
}

function createReportTableRows(assessmentData, levelKeys) {
    const table = document.getElementById('report-table');

    assessmentData.dimensions.forEach((dimension, dimensionIndex) => {
        const row = table.insertRow();
        row.className = "dimension-row";

        // Add the dimension name in the first cell with a plus button for collapse/expand
        const dimensionCell = row.insertCell();
        dimensionCell.className = "dimension-name";

        const plusButton = document.createElement('button');
        plusButton.textContent = '+';
        plusButton.className = 'toggle-activities';
        plusButton.dataset.dimensionIndex = dimensionIndex;
        plusButton.onclick = toggleActivities;
        dimensionCell.appendChild(plusButton);

        const dimensionNameSpan = document.createElement('span');
        dimensionNameSpan.textContent = dimension.name;
        dimensionCell.appendChild(dimensionNameSpan);

        // Add the percentage complete for each level in subsequent cells
        levelKeys.forEach((level, index) => {
            const levelCell = row.insertCell();
            if (dimension.userProgress && dimension.userProgress.levelCoveragePercent) {
                const levelProgress = dimension.userProgress.levelCoveragePercent.find(obj => obj[index + 1]);
                const percentage = levelProgress ? levelProgress[index + 1] : 0;
                if (percentage > 99) {
                    levelCell.textContent = "✔";
                    levelCell.classList.add('level-complete');
                } else {
                    levelCell.textContent = percentage ? `${percentage}%` : '-';
                }
                if (percentage > 0) {
                    changeCellOpacity(levelCell, percentage, "rgb(13,188,55)");
                    levelCell.classList.add('level-progress');
                }
            } else {
                levelCell.textContent = '-';
            }
            levelCell.classList.add("level-" + (index + 1));
        });

        // Create rows for activities under this dimension (hidden by default)
        dimension.activities.forEach(activity => {
            const activityRow = table.insertRow();
            activityRow.className = `activity-row dimension-${dimensionIndex}`;
            activityRow.style.display = 'none'; // Hide by default

            // Add activity name
            const activityCell = activityRow.insertCell();
            activityCell.textContent = activity.title;
            activityCell.className = "activity-name";

            // Add the percentage complete for each level in the subsequent cells for this activity
            levelKeys.forEach((level, index) => {
                const levelCell = activityRow.insertCell();
                if (activity.userProgress && activity.userProgress.levelCoveragePercent) {
                    const levelProgress = activity.userProgress.levelCoveragePercent.find(obj => obj[index + 1]);
                    const percentage = levelProgress ? levelProgress[index + 1] : 0;
                    levelCell.textContent = percentage ? `${percentage}%` : '-';
                    changeCellOpacity(levelCell, percentage, "rgb(13,188,55)");
                } else {
                    levelCell.textContent = '-';
                }
                levelCell.className = "level-" + (index + 1);
            });
        });
    });
}

function toggleActivities(event) {
    const dimensionIndex = event.target.dataset.dimensionIndex;
    const activityRows = document.querySelectorAll(`.activity-row.dimension-${dimensionIndex}`);

    activityRows.forEach(row => {
        if (row.style.display === 'none') {
            row.style.display = ''; // Show the row
            event.target.textContent = '-'; // Change the button to a minus
        } else {
            row.style.display = 'none'; // Hide the row
            event.target.textContent = '+'; // Change the button to a plus
        }
    });
}

function createDimensionDetails(dimension, levelKeys, dimensionIndex) {
    const section = document.createElement('section');
    section.className = 'dimension-details';
    section.id = `dimension-${dimensionIndex}`; // Set the ID for linking

    // Create a container to hold the title and level
    const titleLevelContainer = document.createElement('div');
    titleLevelContainer.className = 'title-level-container';

    // Dimension Title
    const title = document.createElement('h2');
    title.textContent = `Dimension: ${dimension.name}`;
    title.className = 'dimension-title';
    titleLevelContainer.appendChild(title);

    if (!dimension.userProgress) {
        const noDataText = document.createElement('p');
        noDataText.textContent = "No Data";
        noDataText.className = 'no-data-text'; // Optional: Add a class for styling the "No Data" text
        section.appendChild(titleLevelContainer);
        section.appendChild(noDataText);
        return section;
    }

    // Current Dimension Level
    const currentLevel = document.createElement('p');
    currentLevel.textContent = `Current Level: `;

    // Create a span to hold the level name with a class based on the achieved level
    const levelNameSpan = document.createElement('span');
    const levelName = levelKeys[dimension.userProgress.achievedLevel - 1];
    levelNameSpan.textContent = levelName;
    levelNameSpan.className = `level level-${dimension.userProgress.achievedLevel}`;

    // Append the span to the paragraph
    currentLevel.appendChild(levelNameSpan);
    currentLevel.className = 'dimension-level';
    titleLevelContainer.appendChild(currentLevel);

    section.appendChild(titleLevelContainer);

    // AI Response Placeholder
    const AIResponseParagraph = document.createElement('p');
    AIResponseParagraph.className = `ai-response`;
    section.appendChild(AIResponseParagraph);

    // Handle AI summary asynchronously
    getAIDimensionSummary(dimension)
        .then(summary => {
            AIResponseParagraph.innerHTML = summary;
        })
        .catch(error => {
            console.error('Error fetching AI dimension summary:', error);
            AIResponseParagraph.textContent = "Error fetching AI summary.";
        });

    // Dimension Heatmap
    const heatmap = document.createElement('div');
    heatmap.className = 'dimension-heatmap';
    createHeatmap(heatmap, dimension, levelKeys);
    section.appendChild(heatmap);

    return section;
}

function createActivityDetails(activity, dimensionName, levelKeys, dimensionIndex, activityIndex) {
    const section = document.createElement('section');
    section.className = 'activity-details';
    section.id = `activity-${dimensionIndex}-${activityIndex}`; // Set the ID for linking

    // Create a container to hold the title and level
    const titleLevelContainer = document.createElement('div');
    titleLevelContainer.className = 'title-level-container';

    // Activity Title
    const title = document.createElement('h3');
    title.textContent = `Activity: ${activity.title}`;
    title.className = 'activity-title';
    titleLevelContainer.appendChild(title);

    // Append the title and level container first
    section.appendChild(titleLevelContainer);

    if (!activity.userProgress) {
        const noDataText = document.createElement('p');
        noDataText.textContent = "No Data";
        noDataText.className = 'no-data-text'; // Optional: Add a class for styling the "No Data" text
        section.appendChild(noDataText);
        return section;
    }

    // Current Activity Level
    const currentLevel = document.createElement('p');
    currentLevel.textContent = `Current Level: `;
    currentLevel.className = 'activity-level';

    // Create a span to hold the level name with a class based on the achieved level
    const levelNameSpan = document.createElement('span');
    const levelName = levelKeys[activity.userProgress.achievedLevel - 1];
    levelNameSpan.textContent = levelName;
    levelNameSpan.className = `level level-${activity.userProgress.achievedLevel}`;

    // Append the span to the paragraph
    currentLevel.appendChild(levelNameSpan);
    titleLevelContainer.appendChild(currentLevel);

    // AI Response Placeholder
    const AIResponseParagraph = document.createElement('p');
    AIResponseParagraph.className = `ai-response`;
    section.appendChild(AIResponseParagraph);

    // Activity Heatmap
    const heatmap = document.createElement('div');
    heatmap.className = 'activity-heatmap';
    createHeatmap(heatmap, activity, levelKeys);
    section.appendChild(heatmap);

    // Questions and Answers
    createActivityQuestions(section, activity, levelKeys);

    // Handle AI summary asynchronously
    if (levelName) {
        // Start the async task without awaiting it
        getAIActivitySummary(activity, dimensionName, levelKeys)
            .then(summary => {
                AIResponseParagraph.innerHTML = summary;
            })
            .catch(error => {
                console.error('Error fetching AI summary:', error);
                AIResponseParagraph.textContent = "Error fetching AI summary.";
            });
    }

    return section;
}

function createActivityQuestions(section, activity, levelKeys) {
    const currentLevelQuestions = document.createElement('div');
    currentLevelQuestions.className = 'current-level-questions';
    currentLevelQuestions.innerHTML = '<h4>Current state at achieved level</h4>';

    const nextLevelQuestions = document.createElement('div');
    nextLevelQuestions.className = 'next-level-questions';
    nextLevelQuestions.innerHTML = '<h4>Progress towards next level</h4>';

    const higherLevelQuestions = document.createElement('div');
    higherLevelQuestions.className = 'higher-level-questions';
    higherLevelQuestions.innerHTML = '<h4>Answers/Notes from higher levels</h4>';

    const createQuestionsTable = (questionsDiv, statements, includeLevel = false) => {
        const table = document.createElement('table');
        table.className = 'questions-table';

        const headerRow = table.insertRow();

        // Adjust headers depending on whether the level column is included
        headerRow.innerHTML = `
            ${includeLevel ? '<th style="width: 15%;">Level</th>' : ''}
            <th style="width: 55%;">Question</th>
            <th style="width: 10%;">Achieved</th>
            <th style="width: 20%;">Notes</th>
        `;

        // Sort statements: correct answers first, then incorrect, then unanswered
        const sortedStatements = statements.sort((a, b) => {
            const aAnswered = a.userAnswer ? 1 : 0;
            const bAnswered = b.userAnswer ? 1 : 0;
            if (aAnswered !== bAnswered) return bAnswered - aAnswered;

            const aCorrect = a.userAnswer && a.userAnswer.answer === a.positive;
            const bCorrect = b.userAnswer && b.userAnswer.answer === b.positive;
            if (aCorrect !== bCorrect) return bCorrect - aCorrect;

            return 0;
        });

        sortedStatements.forEach(statement => {
            const row = table.insertRow();

            if (includeLevel) {
                const levelCell = row.insertCell();
                const levelName = levelKeys[statement.associatedLevel - 1];
                levelCell.textContent = levelName;
                levelCell.className = `level level-${statement.associatedLevel}`;
            }

            const questionCell = row.insertCell();
            questionCell.textContent = statement.text;

            const answerCell = row.insertCell();

            if (!statement.userAnswer) {
                answerCell.textContent = '-';
            } else if (statement.userAnswer.answer === statement.positive) {
                answerCell.innerHTML = `<span class="question-progress">✓</span>${statement.positive === false ? '<br><span class="question-answer">(FALSE)</span>' : ''}`;
            } else {
                answerCell.innerHTML = '<span class="question-progress">✗</span>';
            }

            const notesCell = row.insertCell();
            notesCell.textContent = statement.userAnswer && statement.userAnswer.notes ? statement.userAnswer.notes : '-';
        });

        questionsDiv.appendChild(table);
    };

    const currentLevelStatements = activity.statements.filter(statement => statement.associatedLevel === activity.userProgress.achievedLevel);
    const nextLevelStatements = activity.statements.filter(statement => statement.associatedLevel === activity.userProgress.achievedLevel + 1);
    const higherLevelStatements = activity.statements.filter(statement =>
        statement.associatedLevel > (activity.userProgress.achievedLevel + 1) &&
        (statement.userAnswer && (statement.userAnswer.answer !== undefined || statement.userAnswer.notes))
    );

    createQuestionsTable(currentLevelQuestions, currentLevelStatements, true);
    createQuestionsTable(nextLevelQuestions, nextLevelStatements, true);
    createQuestionsTable(higherLevelQuestions, higherLevelStatements, true); // Include level column

    section.appendChild(currentLevelQuestions);
    section.appendChild(nextLevelQuestions);
    section.appendChild(higherLevelQuestions);
}

function createExecutiveSummary() {
    // Handle AI summary asynchronously
    const section = document.getElementById('aiExecutiveSummary');
    const AIResponseParagraph = document.createElement('p');
    AIResponseParagraph.className = `ai-response`;
    section.appendChild(AIResponseParagraph);

    const heatmapHeading = document.createElement('h3');
    heatmapHeading.textContent = "Maturity heatmap";

    getAIExecutiveSummary()
        .then(summary => {
            AIResponseParagraph.innerHTML = summary;
            section.appendChild(heatmapHeading);
        })
        .catch(error => {
            console.error('Error fetching AI executive summary:', error);
            AIResponseParagraph.textContent = "Error fetching AI summary.";
        });
}

function createHeatmap(container, data, levelKeys) {
    // Implement the logic to create a heatmap for the dimension or activity
    const table = document.createElement('table');
    const headerRow = table.insertRow();
    levelKeys.forEach((level, index) => {
        const th = document.createElement('th');
        th.textContent = level;
        th.className = `level level-${index + 1}`; // Add class level-<number>
        headerRow.appendChild(th);
    });


    const dataRow = table.insertRow();
    levelKeys.forEach((level, index) => {
        const td = dataRow.insertCell();
        const levelProgress = data.userProgress.levelCoveragePercent.find(obj => obj[index + 1]);
        const percentage = levelProgress ? levelProgress[index + 1] : 0;
        if (percentage > 99) {
            td.textContent = "✔";
            td.classList.add('level-complete');
        } else {
            td.textContent = percentage ? `${percentage}%` : '-';
        }
        if (percentage > 0) {
            td.classList.add('level-progress');
            changeCellOpacity(td, percentage, "rgb(13,188,55)");
        }

    });

    container.appendChild(table);
}

function createOverallMaturitySection(assessmentData, levelKeys) {
    const overallSection = document.getElementById('overallProgress');

    // Create a container for the overall maturity level
    const overallLevelContainer = document.createElement('div');
    overallLevelContainer.className = 'overall-level-container';

    // Overall Maturity Level
    const overallLevel = document.createElement('div');

    if (assessmentData.overallAchievedLevel) {
        const overallLevelName = levelKeys[assessmentData.overallAchievedLevel - 1];
        overallLevel.textContent = overallLevelName;
        overallLevel.className = `level level-${assessmentData.overallAchievedLevel}`;
    } else {
        overallLevel.textContent = 'No Level Achieved';
        overallLevel.className = 'level level-none';
    }

    overallLevelContainer.appendChild(overallLevel);

    // Activity Completion Percentage
    const activityCompletion = document.createElement('p');
    activityCompletion.textContent = `Activity Completion: ${assessmentData.activityCompletionPercentage}%`;
    activityCompletion.className = 'activity-completion';

    // Statement Completion Percentage
    const statementCompletion = document.createElement('p');
    statementCompletion.textContent = `Statement Completion: ${assessmentData.statementCompletionPercentage}%`;
    statementCompletion.className = 'statement-completion';

    // Append elements to the section
    overallSection.appendChild(overallLevelContainer);
    overallSection.appendChild(activityCompletion);
    overallSection.appendChild(statementCompletion);
}

function createTableOfContents(assessmentData) {
    const tocSection = document.getElementById('tableOfContents');
    const tocList = document.createElement('ul');
    tocList.className = 'toc-list';

    assessmentData.dimensions.forEach((dimension, dimensionIndex) => {
        const dimensionItem = document.createElement('li');
        const dimensionLink = document.createElement('a');
        dimensionLink.href = `#dimension-${dimensionIndex}`;
        dimensionLink.textContent = dimension.name;
        dimensionItem.appendChild(dimensionLink);

        const activityList = document.createElement('ul');
        dimension.activities.forEach((activity, activityIndex) => {
            const activityItem = document.createElement('li');
            const activityLink = document.createElement('a');
            activityLink.href = `#activity-${dimensionIndex}-${activityIndex}`;
            activityLink.textContent = activity.title;
            activityItem.appendChild(activityLink);
            activityList.appendChild(activityItem);
        });

        dimensionItem.appendChild(activityList);
        tocList.appendChild(dimensionItem);
    });

    tocSection.appendChild(tocList);
}

function populateProjectMetadata(projectData) {
    const metadataSection = document.getElementById('projectMetadata');
    const metadataTable = document.createElement('table');
    metadataTable.className = 'metadata-table';

    const metadataFields = [
        { label: 'Project Title', value: projectData.title },
        { label: 'Organisation', value: projectData.organisation?.title },
        { label: 'Country', value: projectData.organisation.country?.name || "-" },
        { label: 'Created Date', value: new Date(projectData.created).toLocaleDateString() },
        { label: 'Last Modified', value: new Date(projectData.lastModified).toLocaleDateString() },
        { label: 'Notes', value: projectData.notes }
    ];

    metadataFields.forEach(field => {
        const row = metadataTable.insertRow();
        const cellLabel = row.insertCell(0);
        cellLabel.textContent = field.label;
        const cellValue = row.insertCell(1);
        cellValue.textContent = field.value;
    });

    metadataSection.appendChild(metadataTable);
}

function createNavItem(target,titleText) {
    const item = document.createElement('li');
    item.classList.add('nav-dimension-item'); // Add class for styling
    const title = document.createElement('a');
    title.textContent = titleText;
    title.classList.add('dimension-title');
    title.href = target;
    item.appendChild(title);
    return item;
}

function loadNavBar(data,projectId) {
    const dimensions = data.dimensions;
    const navList = document.getElementById('navList');


    const editItem = createNavItem('/projects/' + projectId,"<- Back to edit page");
    navList.appendChild(editItem);

    const topItem = createNavItem('#assessment-contriner',"Top");
    navList.appendChild(topItem);

    const downloadsItem = createNavItem('#downloads',"Downloads");
    navList.appendChild(downloadsItem);

    const executiveSummary = createNavItem('#executiveSummary',"Executive summary");
    navList.appendChild(executiveSummary);


    // Loop through each dimension to create the navigation structure
    dimensions.forEach((dimension, dimensionIndex) => {
        const dimensionItem = document.createElement('li');
        dimensionItem.classList.add('nav-dimension-item'); // Add class for styling

        const dimensionTitle = document.createElement('a');
        dimensionTitle.textContent = dimension.name;
        dimensionTitle.classList.add('dimension-title'); // Add class for styling
        dimensionTitle.href = `#dimension-${dimensionIndex}`; // Link to the dimension section
        dimensionItem.appendChild(dimensionTitle);

        const activityList = document.createElement('ul');
        dimension.activities.forEach((activity, activityIndex) => {
            const activityId = `activity-${dimensionIndex}-${activityIndex}`;
            const activityItem = document.createElement('li');
            activityItem.classList.add('nav-activity-item'); // Add class for styling

            const activityTitle = document.createElement('a');
            activityTitle.textContent = activity.title;
            activityTitle.classList.add('activity-title'); // Add class for styling
            activityTitle.href = `#${activityId}`; // Link to the activity section
            activityItem.appendChild(activityTitle);

            activityItem.setAttribute('id', 'nav-' + activityId);
            activityList.appendChild(activityItem);
        });

        dimensionItem.appendChild(activityList);
        navList.appendChild(dimensionItem);
    });
}

function toggleNav() {
    const nav = document.querySelector('.report-page nav');
    nav.classList.toggle('shrunk');
}

document.addEventListener('DOMContentLoaded', async () => {
    const urlParts = window.location.pathname.split('/');
    const projectId = urlParts[urlParts.length - 2];
    let levelKeys = ["Initial", "Repeatable", "Defined", "Managed", "Optimising"];

    if (projectId) {
        projectData = await loadProject(projectId);
        const assessmentData = projectData.assessmentData;

        if (assessmentData) {
            if (assessmentData.levels) {
                levelKeys = assessmentData.levels;
            }

            loadNavBar(assessmentData,projectId);
            populateProjectMetadata(projectData);
            createOverallMaturitySection(assessmentData,levelKeys);

            // Update the dimension and activity progress
            assessmentData.dimensions.forEach(dimension => {
                dimension.activities.forEach(activity => {
                    calculateLevelCoverage(activity);
                });
                updateDimensionProgress(dimension);
            });

            createExecutiveSummary();

            // Create the report table with headings and rows
            createReportTableHeadings(levelKeys);
            createReportTableRows(assessmentData, levelKeys);

            // Populate the table of contents
            // createTableOfContents(assessmentData);

            // Populate the detailed report sections for each dimension
            const reportSection = document.querySelector('.project-report');
            assessmentData.dimensions.forEach((dimension, dimensionIndex) => {
                // Add dimension details section
                const dimensionDetailsSection = createDimensionDetails(dimension, levelKeys, dimensionIndex);
                reportSection.appendChild(dimensionDetailsSection);

                // Add each activity's details under the corresponding dimension
                dimension.activities.forEach((activity, activityIndex) => {
                    const activityDetailsSection = createActivityDetails(activity, dimension.name, levelKeys, dimensionIndex, activityIndex);
                    reportSection.appendChild(activityDetailsSection);
                });
            });
            const navLinks = document.querySelectorAll('#navList a');
            navLinks.forEach(link => {
                // Only add the event listener if the href starts with "#"
                if (link.getAttribute('href').startsWith('#')) {
                    link.addEventListener('click', event => {
                        event.preventDefault();
                        const targetId = link.getAttribute('href').substring(1);
                        const targetElement = document.getElementById(targetId);
                        if (targetElement) {
                            window.scrollTo({
                                top: targetElement.offsetTop,
                                behavior: 'smooth'
                            });
                        }
                    });
                }
            });
        }
        // Add event listener to the download JSON button
        document.getElementById('downloadJSON').addEventListener('click', () => {
            downloadProjectDataAsJSON(projectData);
        });
        // Add event listener to the download JSON button
        document.getElementById("downloadDOCX").addEventListener("click", async () => {
            try {
                // Show an alert to inform users about updating the table of contents
                alert("Once the document has downloaded, you will need to update the table of contents to correct page numbering and titles.");

                // Fetch the document
                const response = await fetch(`/projects/${projectId}/report`, {
                    headers: {
                        "Accept": "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    }
                });

                const blob = await response.blob(); // Get the response as a Blob
                const url = URL.createObjectURL(blob);

                const link = document.createElement("a");
                link.href = url;
                link.download = projectData.title.replace(/\s+/g, "_").trim() + ".docx";
                document.body.appendChild(link); // Append the link to the document body
                link.click();
                document.body.removeChild(link); // Remove the link from the document body after clicking

                // Cleanup
                URL.revokeObjectURL(url);
            } catch (error) {
                console.error("Error downloading DOCX data:", error);
            }
        });
    } else {
        console.error('No project ID found in the URL');
    }
});

function downloadProjectDataAsJSON(projectData) {
    // Create a stripped-back version of the project data
    const strippedData = {
        title: projectData.title,
        notes: projectData.notes,
        created: projectData.created,
        lastModified: projectData.lastModified,
        organisation: projectData.organisation,
        assessmentData: projectData.assessmentData,
    };

    // Convert the stripped data to a JSON string
    const dataStr = JSON.stringify(strippedData, null, 2); // The '2' adds indentation for readability

    // Create a Blob from the JSON string
    const blob = new Blob([dataStr], { type: 'application/json' });

    // Create a link element and trigger a download
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${projectData.title || 'project-data'}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

async function getAIDimensionSummary(dimensionData) {
    try {
        // Extract the project ID from the URL or other relevant source
        const urlParts = window.location.pathname.split('/');
        const projectId = urlParts[urlParts.length - 2];

        // Prepare the query parameters for the request
        const queryParams = new URLSearchParams({
            dimensionName: dimensionData.name,
        });

        // Send a GET request to the server route
        const response = await fetch(`/projects/${projectId}/assistant/getDimensionSummary?${queryParams.toString()}`, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
            }
        });

        // Check if the response is successful
        if (!response.ok) {
            const errorData = await response.json();
            if (response.status === 403 && errorData.message === "You need to be an ODI member to access AI summaries") {
                return errorData.message;
            } else {
                throw new Error(`Failed to fetch AI executive summary: ${response.statusText}`);
            }
        }

        // Parse the JSON response
        const result = await response.json();

        // Return the AI summary from the response
        return result.summary;

    } catch (error) {
        console.error('Error fetching AI executive summary:', error);
        return 'Error fetching AI summary, try refreshing the page.';
    }
}

async function getAIActivitySummary(activityData) {
    try {
        // Extract the project ID from the URL or other relevant source
        const urlParts = window.location.pathname.split('/');
        const projectId = urlParts[urlParts.length - 2];

        // Prepare the query parameters for the request
        const queryParams = new URLSearchParams({
            activityTitle: activityData.title,
        });

        // Send a GET request to the server route
        const response = await fetch(`/projects/${projectId}/assistant/getActivitySummary?${queryParams.toString()}`, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
            }
        });

        // Check if the response is successful
        if (!response.ok) {
            const errorData = await response.json();
            if (response.status === 403 && errorData.message === "You need to be an ODI member to access AI summaries") {
                return errorData.message;
            } else {
                throw new Error(`Failed to fetch AI executive summary: ${response.statusText}`);
            }
        }
        // Parse the JSON response
        const result = await response.json();

        // Return the AI summary from the response
        return result.response;

    } catch (error) {
        console.error('Error fetching AI executive summary:', error);
        return 'Error fetching AI summary, try refreshing the page.';
    }
}

async function getAIExecutiveSummary() {
    try {
        // Extract the project ID from the URL or other relevant source
        const urlParts = window.location.pathname.split('/');
        const projectId = urlParts[urlParts.length - 2];

        // Send a GET request to the server route
        const response = await fetch(`/projects/${projectId}/assistant/getExecutiveSummary`, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
            }
        });

        // Check if the response is successful
        // If the response is not successful, handle it
        if (!response.ok) {
            const errorData = await response.json();
            if (response.status === 403 && errorData.message === "You need to be an ODI member to access AI summaries") {
                return errorData.message;
            } else {
                throw new Error(`Failed to fetch AI executive summary: ${response.statusText}`);
            }
        }

        // Parse the JSON response
        const result = await response.json();

        // Return the AI executive summary from the response
        return result.summary;

    } catch (error) {
        console.error('Error fetching AI executive summary:', error);
        return 'Error fetching AI summary, try refreshing the page.';
    }
}
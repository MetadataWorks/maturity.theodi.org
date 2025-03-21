function createReportTableHeadings(levelKeys) {
  const table = document.getElementById("report-table");
  const header = table.insertRow();

  const th = document.createElement("th");
  th.textContent = "";
  th.className = "dimensions";
  header.appendChild(th);

  levelKeys.forEach((level, index) => {
    const th = document.createElement("th");
    th.textContent = level;
    th.className = "level-" + (index + 1) + " level";
    header.appendChild(th);
  });
}

function createReportTableRows(assessmentData, levelKeys) {
  const table = document.getElementById("report-table");

  assessmentData.dimensions.forEach((dimension, dimensionIndex) => {
    const row = table.insertRow();
    row.className = "dimension-row";

    // Add the dimension name in the first cell with a plus button for collapse/expand
    const dimensionCell = row.insertCell();
    dimensionCell.className = "dimension-name";

    const plusButton = document.createElement("button");
    plusButton.textContent = "+";
    plusButton.className = "toggle-activities";
    plusButton.dataset.dimensionIndex = dimensionIndex;
    plusButton.onclick = toggleActivities;
    dimensionCell.appendChild(plusButton);

    const dimensionNameSpan = document.createElement("span");
    dimensionNameSpan.textContent = dimension.name;
    dimensionCell.appendChild(dimensionNameSpan);
    console.log(dimension.userProgress);

    // Add the percentage complete for each level in subsequent cells
    levelKeys.forEach((level, index) => {
      const levelCell = row.insertCell();

      if (
        dimension.userProgress &&
        dimension.userProgress.levelCoveragePercent
      ) {
        // Access levelCoveragePercent using the level key directly
        const levelProgress =
          dimension.userProgress.levelCoveragePercent[index + 1];
        console.log(levelProgress);
        const percentage = levelProgress ? levelProgress : 0;

        if (percentage >= 100) {
          levelCell.textContent = "✔";
          levelCell.classList.add("level-complete");
        } else {
          levelCell.textContent = percentage > 0 ? `${percentage}%` : "-";
        }

        if (percentage > 0) {
          changeCellOpacity(levelCell, percentage, "rgb(13,188,55)");
          levelCell.classList.add("level-progress");
        }
      } else {
        levelCell.textContent = "-";
      }

      levelCell.classList.add("level-" + (index + 1));
    });

    // Create rows for activities under this dimension (hidden by default)
    dimension.activities.forEach((activity) => {
      const activityRow = table.insertRow();
      activityRow.className = `activity-row dimension-${dimensionIndex}`;
      activityRow.style.display = "none"; // Hide by default

      // Add activity name
      const activityCell = activityRow.insertCell();
      activityCell.textContent = activity.title;
      activityCell.className = "activity-name";

      // Add the percentage complete for each level in the subsequent cells for this activity
      levelKeys.forEach((level, index) => {
        const levelCell = activityRow.insertCell();

        if (
          activity.userProgress &&
          activity.userProgress.levelCoveragePercent
        ) {
          // Access levelCoveragePercent using the level key directly
          const levelProgress =
            activity.userProgress.levelCoveragePercent[index + 1];
          const percentage = levelProgress ? levelProgress : 0;

          levelCell.textContent = percentage > 0 ? `${percentage}%` : "-";
          changeCellOpacity(levelCell, percentage, "rgb(13,188,55)");
        } else {
          levelCell.textContent = "-";
        }

        levelCell.classList.add("level-" + (index + 1));
      });
    });
  });
}

function toggleActivities(event) {
  const dimensionIndex = event.target.dataset.dimensionIndex;
  const activityRows = document.querySelectorAll(
    `.activity-row.dimension-${dimensionIndex}`
  );

  activityRows.forEach((row) => {
    if (row.style.display === "none") {
      row.style.display = ""; // Show the row
      event.target.textContent = "-"; // Change the button to a minus
    } else {
      row.style.display = "none"; // Hide the row
      event.target.textContent = "+"; // Change the button to a plus
    }
  });
}

function createDimensionDetails(dimension, levelKeys, dimensionIndex) {
  const section = document.createElement("section");
  section.className = "dimension-details";
  section.id = `dimension-${dimensionIndex}`; // Set the ID for linking

  // Create a container to hold the title and level
  const titleLevelContainer = document.createElement("div");
  titleLevelContainer.className = "title-level-container";

  // Dimension Title
  const title = document.createElement("h2");
  title.textContent = `Dimension: ${dimension.name}`;
  title.className = "dimension-title";
  titleLevelContainer.appendChild(title);

  if (!dimension.userProgress) {
    const noDataText = document.createElement("p");
    noDataText.textContent = "No Data";
    noDataText.className = "no-data-text"; // Optional: Add a class for styling the "No Data" text
    section.appendChild(titleLevelContainer);
    section.appendChild(noDataText);
    return section;
  }

  // Current Dimension Level
  const currentLevel = document.createElement("p");
  currentLevel.textContent = `Current Level: `;

  // Create a span to hold the level name with a class based on the achieved level
  const levelNameSpan = document.createElement("span");
  const levelName =
    levelKeys[dimension.userProgress.achievedLevel - 1] || "none";
  levelNameSpan.textContent = levelName;
  levelNameSpan.className = `level level-${dimension.userProgress.achievedLevel}`;

  // Append the span to the paragraph
  currentLevel.appendChild(levelNameSpan);
  currentLevel.className = "dimension-level";
  titleLevelContainer.appendChild(currentLevel);

  section.appendChild(titleLevelContainer);

  // AI Response Placeholder
  const AIResponseParagraph = document.createElement("p");
  AIResponseParagraph.className = `ai-response`;
  section.appendChild(AIResponseParagraph);

  // Handle AI summary asynchronously

  //   getAIDimensionSummary(dimension)
  //     .then((summary) => {
  //       AIResponseParagraph.innerHTML = summary;
  //     })
  //     .catch((error) => {
  //       console.error("Error fetching AI dimension summary:", error);
  //       AIResponseParagraph.textContent = "Error fetching AI summary.";
  //     });

  // Dimension Heatmap
  const heatmap = document.createElement("div");
  heatmap.className = "dimension-heatmap";
  createHeatmap(heatmap, dimension, levelKeys);
  section.appendChild(heatmap);

  return section;
}

function createActivityDetails(
  activity,
  dimensionName,
  levelKeys,
  dimensionIndex,
  activityIndex
) {
  const section = document.createElement("section");
  section.className = "activity-details";
  section.id = `activity-${dimensionIndex}-${activityIndex}`; // Set the ID for linking

  // Create a container to hold the title and level
  const titleLevelContainer = document.createElement("div");
  titleLevelContainer.className = "title-level-container";

  // Activity Title
  const title = document.createElement("h3");
  title.textContent = `Activity: ${activity.title}`;
  title.className = "activity-title";
  titleLevelContainer.appendChild(title);

  // Append the title and level container first
  section.appendChild(titleLevelContainer);

  if (!activity.userProgress) {
    const noDataText = document.createElement("p");
    noDataText.textContent = "No Data";
    noDataText.className = "no-data-text"; // Optional: Add a class for styling the "No Data" text
    section.appendChild(noDataText);
    return section;
  }

  // Current Activity Level
  const currentLevel = document.createElement("p");
  currentLevel.textContent = `Current Level: `;
  currentLevel.className = "activity-level";

  // Create a span to hold the level name with a class based on the achieved level
  const levelNameSpan = document.createElement("span");
  const levelName = levelKeys[activity.userProgress.achievedLevel - 1];
  levelNameSpan.textContent = levelName;
  levelNameSpan.className = `level level-${activity.userProgress.achievedLevel}`;

  // Append the span to the paragraph
  currentLevel.appendChild(levelNameSpan);
  titleLevelContainer.appendChild(currentLevel);

  // AI Response Placeholder
  const AIResponseParagraph = document.createElement("p");
  AIResponseParagraph.className = `ai-response`;
  section.appendChild(AIResponseParagraph);

  // Activity Heatmap
  const heatmap = document.createElement("div");
  heatmap.className = "activity-heatmap";
  createHeatmap(heatmap, activity, levelKeys);
  section.appendChild(heatmap);

  // Questions and Answers
  createActivityQuestions(section, activity, levelKeys);

  // Handle AI summary asynchronously

  if (levelName) {
    // Start the async task without awaiting it
    // getAIActivitySummary(activity, dimensionName, levelKeys)
    //   .then((summary) => {
    //     AIResponseParagraph.innerHTML = summary;
    //   })
    //   .catch((error) => {
    //     console.error("Error fetching AI summary:", error);
    //     AIResponseParagraph.textContent = "Error fetching AI summary.";
    //   });
  }

  return section;
}

function createActivityQuestions(section, activity, levelKeys) {
  // Create the table for all questions
  const table = document.createElement("table");
  table.className = "questions-table";

  // Create the header row
  const headerRow = table.insertRow();
  headerRow.innerHTML = `
        <th style="width: 40%;">Question</th>
        <th style="width: 30%;">Answer</th>
        <th style="width: 15%;">Level</th>
        <th style="width: 15%;">Notes</th>
    `;

  // Function to add a row for each question
  const createQuestionRow = (question) => {
    const row = table.insertRow();

    // Add question column
    const questionCell = row.insertCell();
    questionCell.textContent = question.text;

    // Add answer column
    const answerCell = row.insertCell();
    if (!question.userAnswer || question.userAnswer.text === undefined) {
      answerCell.textContent = "No Answer";
    } else {
      answerCell.textContent = question.userAnswer.text;
    }

    // Add level column
    const levelCell = row.insertCell();
    const levelName = levelKeys[question.userAnswer?.level - 1] || "No Level";
    levelCell.textContent = levelName;
    levelCell.className = `level level-${question.userAnswer?.level || "none"}`;

    // Add notes column
    const notesCell = row.insertCell();
    notesCell.textContent = question.userAnswer?.notes || "-";
  };

  // Iterate through the questions in the activity and add rows
  activity.questions.forEach((question) => {
    createQuestionRow(question);
  });

  // Append the questions container to the section
  section.appendChild(table);
}

function createExecutiveSummary() {
  // Handle AI summary asynchronously
  const section = document.getElementById("aiExecutiveSummary");
  const AIResponseParagraph = document.createElement("p");
  AIResponseParagraph.className = `ai-response`;
  section.appendChild(AIResponseParagraph);

  const heatmapHeading = document.createElement("h3");
  heatmapHeading.textContent = "Maturity heatmap";

  getAIExecutiveSummary()
    .then((summary) => {
      AIResponseParagraph.innerHTML = summary;
      section.appendChild(heatmapHeading);
    })
    .catch((error) => {
      console.error("Error fetching AI executive summary:", error);
      AIResponseParagraph.textContent = "Error fetching AI summary.";
    });
}

function createHeatmap(container, data, levelKeys) {
  // Create the table element
  const table = document.createElement("table");

  // Create the header row with level keys
  const headerRow = table.insertRow();
  levelKeys.forEach((level, index) => {
    const th = document.createElement("th");
    th.textContent = level;
    th.className = `level level-${index + 1}`; // Add class level-<number>
    headerRow.appendChild(th);
  });

  // Create the data row to show the heatmap for the levels
  const dataRow = table.insertRow();
  levelKeys.forEach((level, index) => {
    const td = dataRow.insertCell();

    // Access levelCoveragePercent using the level key directly
    const levelProgress = data.userProgress.levelCoveragePercent[index + 1];
    const percentage = levelProgress ? levelProgress : 0;

    // Display a checkmark if the percentage is 100%
    if (percentage >= 100) {
      td.textContent = "✔";
      td.classList.add("level-complete");
    } else {
      td.textContent = percentage > 0 ? `${percentage}%` : "-";
    }

    // Apply progress styling if percentage is greater than 0
    if (percentage > 0) {
      td.classList.add("level-progress");
      changeCellOpacity(td, percentage, "rgb(13,188,55)");
    }
  });

  // Append the table to the container
  container.appendChild(table);
}

function createOverallMaturitySection(assessmentData, levelKeys) {
  const overallSection = document.getElementById("overallProgress");

  // Create a container for the overall maturity level
  const overallLevelContainer = document.createElement("div");
  overallLevelContainer.className = "overall-level-container";

  // Overall Maturity Level
  const overallLevel = document.createElement("div");

  if (assessmentData.overallAchievedLevel) {
    const overallLevelName = levelKeys[assessmentData.overallAchievedLevel - 1];
    overallLevel.textContent = overallLevelName;
    overallLevel.className = `level level-${assessmentData.overallAchievedLevel}`;
  } else {
    overallLevel.textContent = "No Level Achieved";
    overallLevel.className = "level level-none";
  }

  overallLevelContainer.appendChild(overallLevel);

  // Activity Completion Percentage
  const activityCompletion = document.createElement("p");
  activityCompletion.textContent = `Activity Completion: ${assessmentData.activityCompletionPercentage}%`;
  activityCompletion.className = "activity-completion";

  // Question Completion Percentage (replacing Statement Completion)
  const questionCompletion = document.createElement("p");
  questionCompletion.textContent = `Question Completion: ${assessmentData.questionCompletionPercentage}%`;
  questionCompletion.className = "question-completion";

  // Append elements to the section
  overallSection.appendChild(overallLevelContainer);
  overallSection.appendChild(activityCompletion);
  overallSection.appendChild(questionCompletion);
}

function createTableOfContents(assessmentData) {
  const tocSection = document.getElementById("tableOfContents");
  const tocList = document.createElement("ul");
  tocList.className = "toc-list";

  assessmentData.dimensions.forEach((dimension, dimensionIndex) => {
    const dimensionItem = document.createElement("li");
    const dimensionLink = document.createElement("a");
    dimensionLink.href = `#dimension-${dimensionIndex}`;
    dimensionLink.textContent = dimension.name;
    dimensionItem.appendChild(dimensionLink);

    const activityList = document.createElement("ul");
    dimension.activities.forEach((activity, activityIndex) => {
      const activityItem = document.createElement("li");
      const activityLink = document.createElement("a");
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
  const metadataSection = document.getElementById("projectMetadata");
  const metadataTable = document.createElement("table");
  metadataTable.className = "metadata-table";

  const metadataFields = [
    { label: "Project Title", value: projectData.title },
    { label: "Organisation", value: projectData.organisation?.title },
    { label: "Country", value: projectData.organisation.country?.name || "-" },
    {
      label: "Created Date",
      value: new Date(projectData.created).toLocaleDateString(),
    },
    {
      label: "Last Modified",
      value: new Date(projectData.lastModified).toLocaleDateString(),
    },
    { label: "Notes", value: projectData.notes },
  ];

  metadataFields.forEach((field) => {
    const row = metadataTable.insertRow();
    const cellLabel = row.insertCell(0);
    cellLabel.textContent = field.label;
    const cellValue = row.insertCell(1);
    cellValue.textContent = field.value;
  });

  metadataSection.appendChild(metadataTable);
}

function createNavItem(target, titleText) {
  const item = document.createElement("li");
  item.classList.add("nav-dimension-item"); // Add class for styling
  const title = document.createElement("a");
  title.textContent = titleText;
  title.classList.add("dimension-title");
  title.href = target;
  item.appendChild(title);
  return item;
}

function loadNavBar(data, projectId) {
  const dimensions = data.dimensions;
  const navList = document.getElementById("navList");

  const editItem = createNavItem(
    "/projects/" + projectId,
    "← Back to edit page"
  );
  navList.appendChild(editItem);

  const topItem = createNavItem("#assessment-contriner", "Top");
  navList.appendChild(topItem);

  const downloadsItem = createNavItem("#downloads", "Downloads");
  navList.appendChild(downloadsItem);

  const executiveSummary = createNavItem(
    "#executiveSummary",
    "Executive summary"
  );
  navList.appendChild(executiveSummary);

  // Loop through each dimension to create the navigation structure
  dimensions.forEach((dimension, dimensionIndex) => {
    const dimensionItem = document.createElement("li");
    dimensionItem.classList.add("nav-dimension-item"); // Add class for styling

    const dimensionTitle = document.createElement("a");
    dimensionTitle.textContent = dimension.name;
    dimensionTitle.classList.add("dimension-title"); // Add class for styling
    dimensionTitle.href = `#dimension-${dimensionIndex}`; // Link to the dimension section
    dimensionItem.appendChild(dimensionTitle);

    const activityList = document.createElement("ul");
    dimension.activities.forEach((activity, activityIndex) => {
      const activityId = `activity-${dimensionIndex}-${activityIndex}`;
      const activityItem = document.createElement("li");
      activityItem.classList.add("nav-activity-item"); // Add class for styling

      const activityTitle = document.createElement("a");
      activityTitle.textContent = activity.title;
      activityTitle.classList.add("activity-title"); // Add class for styling
      activityTitle.href = `#${activityId}`; // Link to the activity section
      activityItem.appendChild(activityTitle);

      activityItem.setAttribute("id", "nav-" + activityId);
      activityList.appendChild(activityItem);
    });

    dimensionItem.appendChild(activityList);
    navList.appendChild(dimensionItem);
  });
}

function toggleNav() {
  const nav = document.querySelector(".report-page nav");
  const toggleButton = document.querySelector(".report-page .nav-toggle");
  nav.classList.toggle("shrunk");

  if (nav.classList.contains("shrunk")) {
    toggleButton.innerHTML = "&#8594;"; // Right arrow
  } else {
    toggleButton.innerHTML = "&#8592;"; // Left arrow
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  const urlParts = window.location.pathname.split("/");
  const projectId = urlParts[urlParts.length - 2];
  let levelKeys = ["Initial", "Repeatable", "Defined", "Managed", "Optimising"];

  if (projectId) {
    projectData = await loadProject(projectId);
    const assessmentData = projectData.assessmentData;

    if (assessmentData) {
      if (assessmentData.levels) {
        levelKeys = assessmentData.levels;
      }

      loadNavBar(assessmentData, projectId);
      populateProjectMetadata(projectData);
      createOverallMaturitySection(assessmentData, levelKeys);

      // Update the dimension and activity progress
      assessmentData.dimensions.forEach((dimension) => {
        dimension.activities.forEach((activity) => {
          calculateLevelCoverage(activity);
        });
        updateDimensionProgress(dimension);
      });

      // createExecutiveSummary();

        generateFullAIReport(
          projectId,
          assessmentData.dimensions,
          levelKeys
        ).then((summary) => {
          document.querySelector(".ai-loading")?.remove();

          // Inject executive summary content
          const section = document.getElementById("aiExecutiveSummary");
          const AIResponseParagraph = document.createElement("p");
          AIResponseParagraph.className = `ai-response`;
          AIResponseParagraph.innerHTML = summary;
          section.appendChild(AIResponseParagraph);

          const heatmapHeading = document.createElement("h3");
          heatmapHeading.textContent = "Maturity heatmap";
          section.appendChild(heatmapHeading);

          // Inject activity summaries (re-fetch them from server cache)
          assessmentData.dimensions.forEach(
            async (dimension, dimensionIndex) => {
              for (
                let activityIndex = 0;
                activityIndex < dimension.activities.length;
                activityIndex++
              ) {
                const activity = dimension.activities[activityIndex];
                try {
                  const queryParams = new URLSearchParams({
                    activityTitle: activity.title,
                    dimensionName: dimension.name,
                  });
                  const response = await fetch(
                    `/projects/${projectId}/assistant/getActivitySummary?${queryParams.toString()}`
                  );
                  const result = await response.json();

                  const id = `activity-${dimensionIndex}-${activityIndex}`;
                  const el = document.querySelector(`#${id} .ai-response`);
                  if (el) {
                    el.innerHTML = result.response;
                  }
                } catch (err) {
                  console.error("Error inserting activity summary:", err);
                }
              }

              // Fetch and inject dimension summary
              try {
                const dimResponse = await fetch(
                  `/projects/${projectId}/assistant/getDimensionSummary?dimensionName=${encodeURIComponent(
                    dimension.name
                  )}`
                );
                const dimResult = await dimResponse.json();

                const dimEl = document.querySelector(
                  `#dimension-${dimensionIndex} .ai-response`
                );
                if (dimEl) {
                  dimEl.innerHTML = dimResult.summary;
                }
              } catch (err) {
                console.error("Error inserting dimension summary:", err);
              }
            }
          );
        });

      // Create the report table with headings and rows
      createReportTableHeadings(levelKeys);
      createReportTableRows(assessmentData, levelKeys);

      // Populate the table of contents
      // createTableOfContents(assessmentData);

      // Populate the detailed report sections for each dimension
      const reportSection = document.querySelector(".project-report");
      assessmentData.dimensions.forEach((dimension, dimensionIndex) => {
        // Add dimension details section
        const dimensionDetailsSection = createDimensionDetails(
          dimension,
          levelKeys,
          dimensionIndex
        );
        reportSection.appendChild(dimensionDetailsSection);

        // Add each activity's details under the corresponding dimension
        dimension.activities.forEach((activity, activityIndex) => {
          const activityDetailsSection = createActivityDetails(
            activity,
            dimension.name,
            levelKeys,
            dimensionIndex,
            activityIndex
          );
          reportSection.appendChild(activityDetailsSection);
        });
      });
      const navLinks = document.querySelectorAll("#navList a");
      navLinks.forEach((link) => {
        // Only add the event listener if the href starts with "#"
        if (link.getAttribute("href").startsWith("#")) {
          link.addEventListener("click", (event) => {
            event.preventDefault();
            const targetId = link.getAttribute("href").substring(1);
            const targetElement = document.getElementById(targetId);
            if (targetElement) {
              window.scrollTo({
                top: targetElement.offsetTop,
                behavior: "smooth",
              });
            }
          });
        }
      });
    }
    // Add event listener to the download JSON button
    document.getElementById("downloadJSON").addEventListener("click", () => {
      downloadProjectDataAsJSON(projectData);
    });
    // Add event listener to the download JSON button
    document
      .getElementById("downloadDOCX")
      .addEventListener("click", async () => {
        try {
          // Show an alert to inform users about updating the table of contents
          alert(
            "Once the document has downloaded, you will need to update the table of contents to correct page numbering and titles."
          );

          // Fetch the document
          const response = await fetch(`/projects/${projectId}/report`, {
            headers: {
              Accept:
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            },
          });

          const blob = await response.blob(); // Get the response as a Blob
          const url = URL.createObjectURL(blob);

          const link = document.createElement("a");
          link.href = url;
          link.download =
            projectData.title.replace(/\s+/g, "_").trim() + ".docx";
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
    console.error("No project ID found in the URL");
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
  const blob = new Blob([dataStr], { type: "application/json" });

  // Create a link element and trigger a download
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${projectData.title || "project-data"}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

async function getAIDimensionSummary(dimensionData) {
  try {
    // Extract the project ID from the URL or other relevant source
    const urlParts = window.location.pathname.split("/");
    const projectId = urlParts[urlParts.length - 2];

    // Prepare the query parameters for the request
    const queryParams = new URLSearchParams({
      dimensionName: dimensionData.name,
    });

    // Send a GET request to the server route
    const response = await fetch(
      `/projects/${projectId}/assistant/getDimensionSummary?${queryParams.toString()}`,
      {
        method: "GET",
        headers: {
          Accept: "application/json",
        },
      }
    );

    // Check if the response is successful
    if (!response.ok) {
      const errorData = await response.json();
      if (
        response.status === 403 &&
        errorData.message ===
          "You need to be a MDW member to access AI summaries."
      ) {
        return errorData.message;
      } else {
        throw new Error(
          `Failed to fetch AI executive summary: ${response.statusText}`
        );
      }
    }

    // Parse the JSON response
    const result = await response.json();

    // Return the AI summary from the response
    return result.summary;
  } catch (error) {
    console.error("Error fetching AI executive summary:", error);
    return "Error fetching AI summary, try refreshing the page.";
  }
}

async function getAIActivitySummary(activityData, dimensionName) {
  try {
    // Extract the project ID from the URL or other relevant source
    const urlParts = window.location.pathname.split("/");
    const projectId = urlParts[urlParts.length - 2];

    // Prepare the query parameters for the request
    const queryParams = new URLSearchParams({
      activityTitle: activityData.title,
      dimensionName: dimensionName,
    });

    // Send a GET request to the server route
    const response = await fetch(
      `/projects/${projectId}/assistant/getActivitySummary?${queryParams.toString()}`,
      {
        method: "GET",
        headers: {
          Accept: "application/json",
        },
      }
    );

    // Check if the response is successful
    if (!response.ok) {
      const errorData = await response.json();
      if (
        response.status === 403 &&
        errorData.message ===
          "You need to be a MDW member to access AI summaries."
      ) {
        return errorData.message;
      } else {
        throw new Error(
          `Failed to fetch AI executive summary: ${response.statusText}`
        );
      }
    }
    // Parse the JSON response
    const result = await response.json();

    // Return the AI summary from the response
    return result.response;
  } catch (error) {
    console.error("Error fetching AI executive summary:", error);
    return "Error fetching AI summary, try refreshing the page.";
  }
}

async function getAIExecutiveSummary() {
  try {
    // Extract the project ID from the URL or other relevant source
    const urlParts = window.location.pathname.split("/");
    const projectId = urlParts[urlParts.length - 2];

    // Send a GET request to the server route
    const response = await fetch(
      `/projects/${projectId}/assistant/getExecutiveSummary`,
      {
        method: "GET",
        headers: {
          Accept: "application/json",
        },
      }
    );

    // Check if the response is successful
    // If the response is not successful, handle it
    if (!response.ok) {
      const errorData = await response.json();
      if (
        response.status === 403 &&
        errorData.message ===
          "You need to be a MDW member to access AI summaries."
      ) {
        return errorData.message;
      } else {
        throw new Error(
          `Failed to fetch AI executive summary: ${response.statusText}`
        );
      }
    }

    // Parse the JSON response
    const result = await response.json();

    // Return the AI executive summary from the response
    return result.summary;
  } catch (error) {
    console.error("Error fetching AI executive summary:", error);
    return "Error fetching AI summary, try refreshing the page.";
  }
}

// ==============================

// Only showing the changed part of the code for clarity. You can replace this into your full `report.js` file
// assuming you already have the rest of your working report.js as shared before.

async function generateFullAIReport(projectId, dimensions, levelKeys) {
    const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  
    // Let browser paint DOM before running heavy work
    await new Promise((resolve) => requestAnimationFrame(resolve));
  
    for (const dimension of dimensions) {
      // Add loader to dimension summary
      const dimIndex = dimensions.indexOf(dimension);
      const dimEl = document.querySelector(`#dimension-${dimIndex} .ai-response`);
      if (dimEl) {
        dimEl.innerHTML = '<span class="ai-loading">Generating summary...</span>';
      }
  
      await Promise.all(
        dimension.activities.map(async (activity, activityIndex) => {
          const activityId = `activity-${dimIndex}-${activityIndex}`;
          const activityEl = document.querySelector(`#${activityId} .ai-response`);
          if (activityEl) {
            activityEl.innerHTML = '<span class="ai-loading">Generating summary...</span>';
          }
  
          if (!activity.aiResponse || !activity.aiResponse.summary) {
            try {
              const queryParams = new URLSearchParams({
                activityTitle: activity.title,
                dimensionName: dimension.name,
              });
              const response = await fetch(`/projects/${projectId}/assistant/getActivitySummary?${queryParams.toString()}`);
              const result = await response.json();
              if (activityEl) {
                activityEl.innerHTML = result.response;
              }
            } catch (err) {
              console.error(`Error generating summary for ${activity.title}:`, err);
            }
          }
        })
      );
  
      if (!dimension.aiResponse || !dimension.aiResponse.summary) {
        try {
          const dimResponse = await fetch(`/projects/${projectId}/assistant/getDimensionSummary?dimensionName=${encodeURIComponent(dimension.name)}`);
          const dimResult = await dimResponse.json();
          if (dimEl) {
            dimEl.innerHTML = dimResult.summary;
          }
        } catch (err) {
          console.error("Error generating dimension summary:", err);
        }
      }
    }
  
    // Executive Summary Loader
    const execSection = document.getElementById("aiExecutiveSummary");
    const loadingMsg = document.createElement("p");
    loadingMsg.className = "ai-loading";
    loadingMsg.textContent = "Generating executive summary, please wait...";
    execSection.appendChild(loadingMsg);
  
    let summary = null;
    let attempts = 0;
    while (attempts < 5 && !summary) {
      try {
        const response = await fetch(`/projects/${projectId}/assistant/getExecutiveSummary`);
        if (response.status === 200) {
          const data = await response.json();
          summary = data.summary;
          break;
        } else if (response.status === 202) {
          console.log("Executive summary is still processing...");
        } else {
          const err = await response.json();
          throw new Error(err.error || "Unexpected error");
        }
      } catch (err) {
        console.error("Error polling executive summary:", err);
      }
  
      attempts++;
      await delay(3000);
    }
  
    loadingMsg.remove();
    return summary || "Executive summary not ready. Please refresh the page later.";
  }
  
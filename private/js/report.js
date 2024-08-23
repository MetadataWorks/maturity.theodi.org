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
        th.className = "level-" + (index + 1);
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
                levelCell.textContent = percentage ? `${percentage}%` : '-';
                if (percentage > 0) {
                    changeCellOpacity(levelCell, percentage, "rgb(13,188,55)");
                }
            } else {
                levelCell.textContent = '-';
            }
            levelCell.className = "level-" + (index + 1);
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
            assessmentData.dimensions.forEach(dimension => {
                // Update opacity of the table headers based on the existing project data
                dimension.activities.forEach(activity => {
                    calculateLevelCoverage(activity);
                });
                console.log(assessmentData);
                // Calculate and update dimension progress
                updateDimensionProgress(dimension);
            });
            createReportTableHeadings(levelKeys);
            createReportTableRows(assessmentData, levelKeys);
        }
    } else {
        console.error('No project ID found in the URL');
    }
});
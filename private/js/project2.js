let projectData = {};  // This will store the current state of the project

function updateProjectData(statement, activity) {
    const projectDimension = projectData.assessmentData.dimensions.find(d => d.activities.some(a => a.title === activity.title));
    const projectActivity = projectDimension.activities.find(a => a.title === activity.title);
    const projectStatement = projectActivity.statements.find(s => s.text === statement.text);

    projectStatement.userAnswer = {
        answer: statement.userAnswer.answer,
        notes: statement.userAnswer.notes
    };

    // Update activity completion
    projectActivity.completionPercentage = calculateActivityCompletion(projectActivity);
    updateActivityProgress(projectActivity);

    // Update overall completion
    // Calculate overall completion metrics
    const { activityCompletionPercentage, statementCompletionPercentage } = calculateOverallCompletion(projectData.assessmentData.dimensions);
    projectData.assessmentData.activityCompletionPercentage = activityCompletionPercentage;
    projectData.assessmentData.statementCompletionPercentage = statementCompletionPercentage;
}

function updateActivityProgress(activity) {
    const levelCoverage = calculateLevelCoverage(activity);
    const achievedLevel = calculateAchievedLevel(levelCoverage);

    activity.userProgress = {
        achievedLevel: achievedLevel,
        levelCoveragePercent: levelCoverage
    };

}

function updateDimensionProgress(dimension) {
    const levelTotals = {};
    let maxAchievedLevel = 0;

    // Initialize levelTotals with zeros for each level
    dimension.activities.forEach(activity => {
        activity.statements.forEach(statement => {
            const level = statement.associatedLevel;
            if (!levelTotals[level]) {
                levelTotals[level] = { total: 0, positive: 0 };
            }
            levelTotals[level].total += 1;
            if (statement.userAnswer && statement.userAnswer.answer === statement.positive) {
                levelTotals[level].positive += 1;
            }
        });

        // Track the maximum achieved level across activities
        if (activity.userProgress && activity.userProgress.achievedLevel > maxAchievedLevel) {
            maxAchievedLevel = activity.userProgress.achievedLevel;
        }
    });

    // Calculate the percentage of each level achieved across the dimension
    const levelCoveragePercent = Object.keys(levelTotals).map(level => {
        const { total, positive } = levelTotals[level];
        return { [level]: Math.round((positive / total) * 100) };
    });

    // Determine the dimension's achieved level
    let dimensionAchievedLevel = 0;
    for (const level in levelTotals) {
        if (levelTotals[level].positive === levelTotals[level].total) {
            dimensionAchievedLevel = parseInt(level);
        } else {
            break;
        }
    }

    // Update the dimension's userProgress in projectData
    dimension.userProgress = {
        achievedLevel: dimensionAchievedLevel,
        levelCoveragePercent: levelCoveragePercent
    };

    return dimension.userProgress;
}

function calculateLevelCoverage(activity) {
    const levelCoverage = [];
    const totalStatementsByLevel = {};

    // Initialize counters
    activity.statements.forEach(statement => {
        const level = statement.associatedLevel;
        if (!totalStatementsByLevel[level]) {
            totalStatementsByLevel[level] = { total: 0, positive: 0 };
        }
        totalStatementsByLevel[level].total += 1;
        if (statement.userAnswer && statement.userAnswer.answer === statement.positive) {
            totalStatementsByLevel[level].positive += 1;
        }
    });

    // Calculate coverage percentage for each level
    for (const level in totalStatementsByLevel) {
        const { total, positive } = totalStatementsByLevel[level];
        const levelProgress = Math.round((positive / total) * 100);
        levelCoverage.push({ [level]: levelProgress });

        const activityContainer = document.getElementById(activity.title.toLowerCase().replace(/\s+/g, '-')) || null;
        if (activityContainer) {
            const thElement = activityContainer.querySelector(`th.level-${level}`);
            // Track the maximum coverage
            if (thElement) {
                const minOpacity = 0.6; // 40%
                const opacity = minOpacity + (levelProgress / 100) * (1 - minOpacity); // Linear interpolation
                changeCellOpacity(thElement, opacity * 100); // Convert to percentage
            }
        }
    }

    return levelCoverage;
}

function calculateAchievedLevel(levelCoverage) {
    let achievedLevel = 0;

    for (const levelObj of levelCoverage) {
        const level = parseInt(Object.keys(levelObj)[0]);
        const coverage = levelObj[level];

        if (coverage === 100) {
            achievedLevel = level;
        } else {
            break;
        }
    }

    return achievedLevel;
}

function calculateActivityCompletion(activity) {
    const totalStatements = activity.statements.length;
    const completedStatements = activity.statements.filter(statement => statement.userAnswer && statement.userAnswer.answer !== undefined).length;
    return Math.round((completedStatements / totalStatements) * 100);
}

function calculateOverallCompletion(dimensions) {
    let totalActivities = 0;
    let completedActivities = 0;

    let totalStatements = 0;
    let completedStatements = 0;

    dimensions.forEach(dimension => {
        dimension.activities.forEach(activity => {
            totalActivities += 1;
            const activityCompletion = calculateActivityCompletion(activity);
            if (activityCompletion === 100) {
                completedActivities += 1;
            }

            // Accumulate statement completion
            totalStatements += activity.statements.length;
            completedStatements += activity.statements.filter(statement => statement.userAnswer && statement.userAnswer.answer !== undefined).length;
        });
    });

    const activityCompletionPercentage = Math.round((completedActivities / totalActivities) * 100);
    const statementCompletionPercentage = Math.round((completedStatements / totalStatements) * 100);

    return {
        activityCompletionPercentage,
        statementCompletionPercentage
    };
}

function updateProgressPie(activityId, percentage) {
    const pie = document.querySelector(`#nav-${activityId} .progress-pie`);
    if (pie) {
        pie.setAttribute('data-value', percentage);
        if (percentage > 0) {
            pie.classList.remove('hidden');
        }
        if (percentage > 99) {;
            // Add a class to show the tick mark
            pie.classList.add('complete');
        } else {
            // Remove the class if it's not 100%
            pie.classList.remove('complete');
        }
    }
}

function updateOverallProgressPie(percentage) {
    const overallPie = document.querySelector('#overall-progress .progress-pie');
    if (overallPie) {
        overallPie.setAttribute('data-value', percentage);
    }
}

async function saveProgress(projectData) {
    try {
        const response = await fetch(`/projects/${projectData._id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(projectData)
        });

        if (!response.ok) {
            throw new Error('Failed to save progress');
        }

        console.log('Progress saved successfully');
    } catch (error) {
        console.error('Error saving progress:', error);
    }
}

async function loadProject(projectId) {
    try {
        const response = await fetch(`/projects/${projectId}`, {
            headers: {
                'Accept': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error('Network response was not ok');
        }

        const data = await response.json();
        projectData = data; // Load the project data into the global variable
        return data;
    } catch (error) {
        console.error('Error loading project:', error);
        return null;
    }
}

function changeCellOpacity(element, percentage, overrideColor = null) {
    let r, g, b;

    if (overrideColor) {
        // If an override color is provided, use it
        const rgb = overrideColor.match(/\d+/g).map(Number);
        [r, g, b] = rgb;
    } else {
        // Get the current background color
        const currentColor = window.getComputedStyle(element).backgroundColor;

        // Extract the RGB values
        const rgba = currentColor.match(/rgba?\((\d+), (\d+), (\d+)(?:, (\d+(\.\d+)?))?\)/);

        if (rgba) {
            r = rgba[1];
            g = rgba[2];
            b = rgba[3];
        } else {
            // Fallback to black if no valid color is found
            r = g = b = 0;
        }
    }

    // Calculate the new alpha based on the percentage
    const minOpacity = 0.4; // Minimum opacity (40%)
    const newAlpha = minOpacity + (percentage / 100) * (1 - minOpacity);

    // Apply the new background color with the specified opacity
    element.classList.add("shaded");
    element.style.backgroundColor = `rgba(${r}, ${g}, ${b}, ${newAlpha})`;
}

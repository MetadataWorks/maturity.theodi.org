let projectData = {};  // This will store the current state of the project

function updateProjectData(question, dimension, activity) {
    // Find the correct dimension and activity by their names
    const projectDimension = projectData.assessmentData.dimensions.find(d => d.name === dimension.name);
    const projectActivity = projectDimension.activities.find(a => a.title === activity.title);

    // Find the corresponding question
    const projectQuestion = projectActivity.questions.find(q => q.text === question.text);

    // Update the user answer for the question with the selected level
    projectQuestion.userAnswer = {
        level: question.userAnswer.level, // Store the selected level
        text: question.statements[question.userAnswer.level-1].text, // Store the statement text
        notes: question.userAnswer.notes  // Store any notes added for the question
    };

    // Update activity completion based on the selected level
    projectActivity.completionPercentage = calculateActivityCompletion(projectActivity);
    updateActivityProgress(projectActivity);

    // Update dimension progress based on the updated activity
    updateDimensionProgress(projectDimension);

    // Calculate the overall achieved level for the entire assessment
    const overallAchievedLevel = calculateOverallAchievedLevel(projectData.assessmentData.dimensions);
    projectData.assessmentData.overallAchievedLevel = overallAchievedLevel;

    // Update overall completion metrics (replace statementCompletionPercentage with questionCompletionPercentage)
    const { activityCompletionPercentage, questionCompletionPercentage } = calculateOverallCompletion(projectData.assessmentData.dimensions);
    projectData.assessmentData.activityCompletionPercentage = activityCompletionPercentage;
    projectData.assessmentData.questionCompletionPercentage = questionCompletionPercentage;  // Store question completion percentage

    // Trigger debounced save
    debouncedSaveProgress(projectData);
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
    const levelTotals = {}; // To track totals for each level across the dimension
    let minAchievedLevel = null; // Track the lowest common achieved level across all activities

    // Iterate through activities to calculate level coverage
    dimension.activities.forEach(activity => {
        // Get the level coverage for this activity based on the user's selected answers
        const levelCoverage = calculateLevelCoverage(activity);
        const achievedLevel = calculateAchievedLevel(levelCoverage);

        // Track the minimum achieved level (the lowest common level across all activities)
        if (minAchievedLevel === null) {
            minAchievedLevel = achievedLevel;
        } else if (achievedLevel < minAchievedLevel) {
            minAchievedLevel = achievedLevel;
        }

        // Update the levelTotals for all levels (from 1 to 5)
        for (let level = 1; level <= 5; level++) {
            if (!levelTotals[level]) {
                levelTotals[level] = { total: 0, completed: 0 };
            }

            // For each level, accumulate totals for the entire dimension
            levelTotals[level].total += activity.questions.length;

            // For levels above the achieved level, count how many questions are answered at this level or above

            activity.questions.forEach(question => {
                if (question.userAnswer && question.userAnswer.level >= level) {
                    levelTotals[level].completed += 1;
                }
            });
        }
    });

    // Calculate the percentage of each level completed across the dimension
    const levelCoveragePercent = {};
    for (let level = 1; level <= 5; level++) {
        // For levels below or equal to the achieved level, set completion to 100%
        if (level <= minAchievedLevel) {
            levelCoveragePercent[level] = 100;
        } else {
            // For levels above the achieved level, calculate the actual percentage of questions completed
            const { total, completed } = levelTotals[level];
            levelCoveragePercent[level] = Math.round((completed / total) * 100);
        }
    }

    // Update the dimension's userProgress with the lowest common achieved level and level coverage percent
    dimension.userProgress = {
        achievedLevel: minAchievedLevel,
        levelCoveragePercent: levelCoveragePercent // Store as an object for better lookups
    };

    return dimension.userProgress;
}

function calculateLevelCoverage(activity) {
    const levelCoverage = {};
    const totalQuestions = activity.questions.length;

    // Initialize coverage object for each level
    activity.questions.forEach(question => {
        const level = question.userAnswer?.level;

        if (level !== undefined) {
            // Mark all levels up to and including the selected level as complete
            for (let i = 1; i <= level; i++) {
                if (!levelCoverage[i]) {
                    levelCoverage[i] = { total: 0, completed: 0 };
                }
                // For each question, mark it complete for this level
                levelCoverage[i].total = totalQuestions;
                levelCoverage[i].completed += 1;
            }
        }
    });

    // Calculate coverage percentage for each level
    for (const level in levelCoverage) {
        const { total, completed } = levelCoverage[level];
        const levelProgress = Math.round((completed / total) * 100);
        levelCoverage[level] = levelProgress;  // Store percentage directly
    }

    return levelCoverage;  // Return as an object
}

function calculateAchievedLevel(levelCoverage) {
    let achievedLevel = 0;

    // Iterate over each level in the levelCoverage object
    for (const level in levelCoverage) {
        const coverage = levelCoverage[level];

        // If the coverage for the level is 100%, set it as the achieved level
        if (coverage === 100) {
            achievedLevel = parseInt(level, 10); // Convert the level to an integer
        } else {
            break; // If coverage is less than 100%, stop iterating
        }
    }

    return achievedLevel;
}

function calculateOverallAchievedLevel(dimensions) {
    // Initialize with a high value and reduce it as we go through dimensions
    let overallAchievedLevel = Infinity;

    dimensions.forEach(dimension => {
        if (dimension.userProgress && dimension.userProgress.achievedLevel) {
            overallAchievedLevel = Math.min(overallAchievedLevel, dimension.userProgress.achievedLevel);
        } else {
            // If any dimension does not have an achieved level, the overall level cannot be determined
            overallAchievedLevel = 0;
        }
    });

    // If no level was common, set the overall achieved level to 0
    if (overallAchievedLevel === Infinity) {
        overallAchievedLevel = 0;
    }

    return overallAchievedLevel;
}

function calculateActivityCompletion(activity) {
    // Total number of questions in the activity
    const totalQuestions = activity.questions.length;

    // Number of completed questions where the user has selected a level
    const completedQuestions = activity.questions.filter(question => question.userAnswer && question.userAnswer.level !== undefined).length;

    // Calculate and return the completion percentage
    return totalQuestions > 0 ? Math.round((completedQuestions / totalQuestions) * 100) : 0;
}

function calculateOverallCompletion(dimensions) {
    let totalActivities = 0;
    let completedActivities = 0;

    let totalQuestions = 0;
    let completedQuestions = 0;

    // Iterate over dimensions and their activities
    dimensions.forEach(dimension => {
        dimension.activities.forEach(activity => {
            totalActivities += 1;
            const activityCompletion = calculateActivityCompletion(activity);
            if (activityCompletion === 100) {
                completedActivities += 1;
            }

            // Accumulate question completion
            totalQuestions += activity.questions.length;
            completedQuestions += activity.questions.filter(question => question.userAnswer && question.userAnswer.level !== undefined).length;
        });
    });

    const activityCompletionPercentage = totalActivities > 0 ? Math.round((completedActivities / totalActivities) * 100) : 0;
    const questionCompletionPercentage = totalQuestions > 0 ? Math.round((completedQuestions / totalQuestions) * 100) : 0;

    return {
        activityCompletionPercentage,
        questionCompletionPercentage
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
            console.log(response);
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

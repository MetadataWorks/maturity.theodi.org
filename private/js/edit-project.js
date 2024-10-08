let defaultActivity = "";

function renderAssessmentMetadata(data) {
    // Fetch the project schema
    fetch('/schemas/newProject.json')
    .then(response => response.json())
    .then(schema => {
        // Render the form with the original schema
        $('#dataForm').jsonForm({
            schema: schema.schema,
            form: schema.form,
            value: data,
            onSubmit: function (errors, values) {
                submitProjectForm(errors, values);
            }
        });
    });
    // Fetch the country list from the API
    fetch('/lib/countries.json')
    .then(response => response.json())
    .then(countries => {

        // Create the label and dropdown elements
        const countryLabel = $('<label for="countryDropdown" class="form-control">Organisation Location (Country)</label>');
        const countryDropdown = $('<select id="countryDropdown" class="form-control"></select>');
        countryDropdown.append('<option value="">Select a country</option>');

        // Populate the dropdown with country options
        countries.forEach(country => {
            countryDropdown.append(`<option value="${country.cca2}" data-name="${country.name.common}">${country.name.common}</option>`);
        });

        // Insert the label and dropdown into the form before the submit button
        $('.submit').before(countryLabel);
        $('.submit').before(countryDropdown);

        setTimeout(function() {
            $('input[name="organisation.country.name"]').parent().parent().hide();
            $('input[name="organisation.country.code"]').parent().parent().hide();
        }, 200);

        // Handle country selection
        $('#countryDropdown').change(function () {
            const selectedOption = $(this).find('option:selected');
            const countryName = selectedOption.data('name');
            const countryCode = selectedOption.val();

            $('input[name="organisation.country.name"]').val(countryName);
            $('input[name="organisation.country.code"]').val(countryCode);
        });
    })
    .catch(error => {
        console.error("Error fetching schema or country data:", error);
    });
}

function createAssessmentTable(dimension, levelKeys) {
    const container = document.getElementById('assessment-container');
    dimension.activities.forEach(activity => {
        const activityContainer = document.createElement('section');
        const dimensionPrefix = dimension.name.toLowerCase().replace(/\s+/g, '-');
        const activityId = dimensionPrefix + "-" + activity.title.toLowerCase().replace(/\s+/g, '-');
        activityContainer.setAttribute('id', activityId);
        activityContainer.className = 'activity';

        const activityHeading = document.createElement('h2');
        activityHeading.innerHTML = dimension.name + " / " + activity.title || "Dimension > Activity";
        activityContainer.appendChild(activityHeading);

        // Iterate over questions in each activity
        activity.questions.forEach(question => {
            const questionContainer = document.createElement('div');
            questionContainer.className = 'question-container';
            questionContainer.setAttribute('data-question', question.text);  // Add unique identifier

            // Display the question text and context above the table
            const questionTitle = document.createElement('h3');
            questionTitle.textContent = question.text;
            questionContainer.appendChild(questionTitle);

            if (question.context) {
                const questionContext = document.createElement('p');
                questionContext.textContent = question.context;
                questionContainer.appendChild(questionContext);
            }

            // Create table for each question
            const table = document.createElement('table');
            const header = table.insertRow();

            // Add levels as headers
            levelKeys.forEach((level, index) => {
                const th = document.createElement('th');
                th.textContent = (index + 1) + ": " + level;
                th.className = "level-" + (index + 1);
                header.appendChild(th);
            });

            const row = table.insertRow();

            // Initialize cells for each level
            const levelCells = {};
            levelKeys.forEach((level, index) => {
                levelCells[index + 1] = row.insertCell();
            });

            // Add statements directly to the <td> and apply selection logic
            question.statements.forEach(statement => {
                const cell = levelCells[statement.associatedLevel];
                cell.className = 'statement-container level-' + statement.associatedLevel;

                const statementSpan = document.createElement('span');
                statementSpan.className = 'statement';
                statementSpan.textContent = statement.text;
                cell.appendChild(statementSpan);

                const notesIcon = document.createElement('img');
                notesIcon.className = 'notes-icon';
                notesIcon.src = '/images/notes-icon.svg';
                notesIcon.alt = 'Notes Icon';
                notesIcon.style.display = statement.userAnswer && statement.userAnswer.notes ? 'inline' : 'none';
                cell.appendChild(notesIcon);

                // Restore user-selected level
                if (question.userAnswer && question.userAnswer.level === statement.associatedLevel) {
                    cell.classList.add('selected');
                }

                // Apply cleared class to levels below the selected level
                if (question.userAnswer && question.userAnswer.level > statement.associatedLevel) {
                    cell.classList.add('cleared');
                }

                // Add click event to <td> to select the statement
                cell.addEventListener('click', () => handleStatementSelection(question, statement.associatedLevel, dimension, activity));
            });

            // Append the table to the question container
            questionContainer.appendChild(table);

            // Add textarea for notes
            const notesTextarea = document.createElement('textarea');
            notesTextarea.className = 'notes-textarea';
            notesTextarea.placeholder = 'Add notes here...';
            notesTextarea.value = question.userAnswer && question.userAnswer.notes ? question.userAnswer.notes : '';
            notesTextarea.addEventListener('input', (event) => {
                question.userAnswer.notes = event.target.value;
            });
            questionContainer.appendChild(notesTextarea);

            activityContainer.appendChild(questionContainer);
        });

        container.appendChild(activityContainer);
    });
}

function openStatementModal(statement, notesIcon, dimension, activity) {
    const modal = document.getElementById('statement-modal');
    const modalStatement = document.getElementById('modal-statement');
    const modalContext = document.getElementById('modal-context');
    const modalTrueButton = document.getElementById('modal-true-button');
    const modalFalseButton = document.getElementById('modal-false-button');
    const modalNotesTextarea = document.getElementById('modal-notes');

    // Populate the modal with statement details
    modalStatement.textContent = statement.text;
    modalContext.textContent = statement.context || "";
    modalNotesTextarea.value = statement.userAnswer ? statement.userAnswer.notes : "";

    // Sync the modal buttons with the current state
    modalTrueButton.classList.toggle('selected', statement.userAnswer && statement.userAnswer.answer === true);
    modalFalseButton.classList.toggle('selected', statement.userAnswer && statement.userAnswer.answer === false);

    // Handle True button click
    modalTrueButton.onclick = () => {
        modalTrueButton.classList.add('selected');
        modalFalseButton.classList.remove('selected');
        handleStatementSelection(statement, true, dimension, activity);  // Pass dimension and activity
    };

    // Handle False button click
    modalFalseButton.onclick = () => {
        modalFalseButton.classList.add('selected');
        modalTrueButton.classList.remove('selected');
        handleStatementSelection(statement, false, dimension, activity);  // Pass dimension and activity
    };

    // Handle modal close event
    const closeModal = () => {
        if (!statement.userAnswer) {
            statement.userAnswer = {};
        }
        statement.userAnswer.notes = modalNotesTextarea.value;
        notesIcon.style.display = statement.userAnswer.notes.trim() ? 'inline' : 'none';
        updateProjectData(statement, dimension, activity);  // Pass dimension and activity
        modal.style.display = 'none';

        // Trigger debounced save
        debouncedSaveProgress(projectData);
    };

    // Close modal on close button click or outside click
    modal.querySelector('.close').onclick = closeModal;
    window.onclick = (event) => {
        if (event.target == modal) {
            closeModal();
        }
    };

    // Show the modal
    modal.style.display = 'block';
}

function handleStatementSelection(question, selectedLevel, dimension, activity) {
    // Update the userAnswer for the question with the selected level
    question.userAnswer = {
        level: selectedLevel,
        text: question.statements[selectedLevel-1].text,
        notes: question.userAnswer ? question.userAnswer.notes : ""
    };

    // Select only the statement cells within the relevant question table
    const questionContainer = document.querySelector(`[data-question="${question.text}"]`);  // Assuming each question container has a unique data attribute like data-question

    if (questionContainer) {
        // Deselect all statement cells within this question and apply 'cleared' for levels below the selected one
        const statementCells = questionContainer.querySelectorAll('.statement-container');
        statementCells.forEach(cell => {
            const levelClass = cell.className.match(/level-(\d+)/);

            if (levelClass) {
                const level = parseInt(levelClass[1]);

                if (level === selectedLevel) {
                    // Mark the selected statement cell
                    cell.classList.add('selected');
                    cell.classList.remove('cleared');
                } else if (level < selectedLevel) {
                    // Apply cleared to levels below the selected one
                    cell.classList.add('cleared');
                    cell.classList.remove('selected');
                } else {
                    // Remove any selection/clear state for levels above the selected one
                    cell.classList.remove('selected', 'cleared');
                }
            }
        });
    }

    // Update projectData with the user's selection in the context of the dimension and activity
    updateProjectData(question, dimension, activity);

    // Recalculate the completion percentage for the activity and update the progress pie
    const activityCompletion = calculateActivityCompletion(activity);
    const dimensionPrefix = dimension.name.toLowerCase().replace(/\s+/g, '-');
    const activityId = dimensionPrefix + "-" + activity.title.toLowerCase().replace(/\s+/g, '-');
    updateProgressPie(activityId, activityCompletion);

    // Trigger debounced save
    debouncedSaveProgress(projectData);
}

function submitProjectForm(errors, values) {
    if (errors) {
        const errorsObj = JSON.stringify(errors);
        $('#res').html('<p>Please correct the errors in your form</p>' +  errorsObj);
    } else {
        // Disable the submit button
        $('.submit').prop('disabled', true);
        // Display a message while submitting
        $('#res').html('<p>Submitting, please wait...</p>');

        // Define whether it's an add or edit operation based on the presence of data._id
        const postUrl = values._id ? `/projects/${values._id}` : '/projects';
        const method = values._id ? 'PUT' : 'POST';

        // Post the input object to the appropriate URL
        fetch(postUrl, {
            method: method,
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(values)
        })
        .then(response => response.json())
        .then(data => {
            // Handle response
            if (data._id) {
                // Re-enable the submit button
                $('.submit').prop('disabled', false);
                $('#res').html(`<p>Successfully ${method === 'PUT' ? 'updated' : 'created'} project with ID: ${data._id}</p>`);
            } else if (data.error) {
                $('#res').html(`<p>Error: ${data.error}</p>`);
            } else {
                $('#res').html('<p>Unknown error occurred</p>');
            }
        })
        .catch(error => {
            console.error('Error:', error);
            $('#res').html('<p>An error occurred while processing your request</p>');
        });
    }
}

function loadNavBar(data,projectId) {
    const dimensions = data.dimensions;
    const navList = document.getElementById('navList');

    const metadataItem = document.createElement('li');
    metadataItem.classList.add('nav-dimension-item'); // Add class for styling
    metadataItem.setAttribute('id', 'nav-metadata');
    const metadataTitle = document.createElement('span');
    metadataTitle.textContent = "Metadata";
    metadataTitle.classList.add('dimension-title');
    metadataItem.appendChild(metadataTitle);
    metadataItem.addEventListener('click', () => {
        showMetadata();
        updateHash("metadata");
    });
    navList.appendChild(metadataItem);

    dimensions.forEach(dimension => {
        const dimensionItem = document.createElement('li');
        dimensionItem.classList.add('nav-dimension-item'); // Add class for styling

        const dimensionTitle = document.createElement('span');
        dimensionTitle.textContent = dimension.name;
        dimensionTitle.classList.add('dimension-title'); // Add class for styling
        dimensionItem.appendChild(dimensionTitle);

        const activityList = document.createElement('ul');
        dimension.activities.forEach(activity => {
            const dimensionPrefix = dimension.name.toLowerCase().replace(/\s+/g, '-');
            const activityId = dimensionPrefix + "-" + activity.title.toLowerCase().replace(/\s+/g, '-');
            if (defaultActivity === "") {
                defaultActivity = activityId;
            }
            const activityItem = document.createElement('li');
            activityItem.classList.add('nav-activity-item'); // Add class for styling

            const activityTitle = document.createElement('span');
            activityTitle.textContent = activity.title;
            activityTitle.classList.add('activity-title'); // Add class for styling
            activityItem.appendChild(activityTitle);

            // Create progress pie chart
            const progressPie = document.createElement('div');
            progressPie.className = 'progress-pie transparent';
            completionPercentage = activity.completionPercentage || 0;
            progressPie.setAttribute('data-value', completionPercentage);
            if (completionPercentage < 1) {
                progressPie.classList.add('hidden');
            }
            if (completionPercentage > 99) {;
                // Add a class to show the tick mark
                progressPie.classList.add('complete');
            }
            activityItem.appendChild(progressPie);

            activityItem.setAttribute('id', 'nav-' + activityId);
            activityItem.addEventListener('click', () => {
                showActivity(activityId);
                updateHash(activityId);
            });
            activityList.appendChild(activityItem);
        });

        dimensionItem.appendChild(activityList);
        navList.appendChild(dimensionItem);
    });

    // Add Report item to the nav
    const reportItem = document.createElement('li');
    reportItem.classList.add('nav-dimension-item'); // Add class for styling
    reportItem.setAttribute('id', 'nav-metadata');
    const reportTitle = document.createElement('a');
    reportTitle.textContent = "Report";
    reportTitle.classList.add('dimension-title');
    reportTitle.href = '/projects/' + projectId+ '/report'; // Link to the report
    reportItem.appendChild(reportTitle);
    navList.appendChild(reportItem);

    // Add overall progress
    /*
    const overallProgressContainer = document.createElement('div');
    overallProgressContainer.className = 'overall-progress-container'; // Add class for styling

    const overallProgressTitle = document.createElement('span');
    overallProgressTitle.textContent = "Overall Progress";
    overallProgressTitle.classList.add('overall-progress-title'); // Add class for styling
    overallProgressContainer.appendChild(overallProgressTitle);

    const overallProgressPie = document.createElement('div');
    overallProgressPie.className = 'progress-pie transparent';
    overallProgressPie.setAttribute('data-value', data.completionPercentage || 0);
    overallProgressContainer.appendChild(overallProgressPie);

    document.getElementById('overall-progress').appendChild(overallProgressContainer);
    */
}

function showMetadata() {
    document.querySelectorAll('.activity').forEach(activity => {
        activity.classList.remove('active');
    });
    const selectedActivityNav = document.getElementById('nav-metadata');
    const selectedActivity = document.getElementById("metadata");
    selectedActivity.classList.add('active');
    selectedActivityNav.classList.add('active');
}

function showActivity(activityId) {
    document.getElementById("metadata").classList.remove('active');
    document.querySelectorAll('.activity').forEach(activity => {
        activity.classList.remove('active');
    });
    document.querySelectorAll('#navList li ul li').forEach(activity => {
        activity.classList.remove('active');
    });

    const selectedActivity = document.getElementById(activityId);
    const selectedActivityNav = document.getElementById('nav-' + activityId);
    if (selectedActivity) {
        selectedActivity.classList.add('active');
        selectedActivityNav.classList.add('active');
    }
}

function updateHash(activityId) {
    if (history.replaceState) {
        history.replaceState(null, null, `#${activityId}`);
    } else {
        location.hash = activityId;
    }

    const element = document.getElementById(activityId);
    if (element) {
        element.scrollIntoView({ behavior: 'smooth' });
    }
}

function toggleNav() {
    const nav = document.querySelector('.project nav');
    const toggleButton = document.querySelector('.project .nav-toggle');
    nav.classList.toggle('shrunk');

    if (nav.classList.contains('shrunk')) {
        toggleButton.innerHTML = '&#8594;'; // Right arrow
    } else {
        toggleButton.innerHTML = '&#8592;'; // Left arrow
    }
}

function debounce(func, wait) {
    let timeout;
    return function(...args) {
        const later = () => {
            clearTimeout(timeout);
            func.apply(this, args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

document.addEventListener('DOMContentLoaded', async () => {
    const urlParts = window.location.pathname.split('/');
    const projectId = urlParts[urlParts.length - 1];
    let levelKeys = ["Initial", "Repeatable", "Defined", "Managed", "Optimising"];

    if (projectId) {
        projectData = await loadProject(projectId);
        const assessmentData = projectData.assessmentData;

        renderAssessmentMetadata(projectData);
        loadNavBar(assessmentData,projectId);

        if (assessmentData) {
            if (assessmentData.levels) {
                levelKeys = assessmentData.levels;
            }
            assessmentData.dimensions.forEach(dimension => {
                createAssessmentTable(dimension, levelKeys);
                // Update opacity of the table headers based on the existing project data
                dimension.activities.forEach(activity => {
                    calculateLevelCoverage(activity);
                });

                // Calculate and update dimension progress
                updateDimensionProgress(dimension);
            });
        }
    } else {
        console.error('No project ID found in the URL');
    }

    const hash = location.hash.substring(1);
    if (hash) {
        showActivity(hash);
    } else {
        showActivity(defaultActivity);
    }
});

window.addEventListener('load', () => {
    const hash = location.hash.substring(1);
    if (hash) {
        showActivity(hash);
    } else {
        showActivity(defaultActivity);
    }
});

window.addEventListener('beforeunload', () => {
    saveProgress(projectData); // Ensure progress is saved before leaving
});

window.addEventListener('hashchange', () => {
    saveProgress(projectData); // Ensure progress is saved before navigating
});

// Debounced version of saveProgress
const debouncedSaveProgress = debounce(saveProgress, 2000);

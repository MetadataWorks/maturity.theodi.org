let defaultActivity = "";

function renderAssessmentMetadata(data) {
    console.log(data);
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
            $('input[name="organisation.country.name"]').prop('disabled', true);
            $('input[name="organisation.country.code"]').prop('disabled', true);
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
        const activityId = activity.title.toLowerCase().replace(/\s+/g, '-');
        activityContainer.setAttribute('id', activityId);
        activityContainer.className = 'activity';

        const activityHeading = document.createElement('h2');
        activityHeading.innerHTML = dimension.name + " / " + activity.title || "Dimension > Activity";
        activityContainer.appendChild(activityHeading);

        const table = document.createElement('table');
        const header = table.insertRow();

        levelKeys.forEach((level, index) => {
            const th = document.createElement('th');
            const levelIndex = index + 1;
            th.textContent = levelIndex + ": " + level;
            th.className = "level-" + (index + 1);
            header.appendChild(th);
        });

        const row = table.insertRow();

        // Initialize cells for each level
        const levelCells = {};
        levelKeys.forEach((level, index) => {
            levelCells[index + 1] = row.insertCell();
        });

        activity.statements.forEach(statement => {
            const cell = levelCells[statement.associatedLevel];

            const statementContainer = document.createElement('div');
            statementContainer.className = 'statement-container';
            statementContainer.classList.add("level-" + statement.associatedLevel);

            const bubble = document.createElement('div');
            bubble.className = 'statement-bubble positive-' + statement.positive;

            const statementSpan = document.createElement('span');
            statementSpan.className = 'statement';
            statementSpan.textContent = statement.text;
            bubble.appendChild(statementSpan);

            const notesIcon = document.createElement('img');
            notesIcon.className = 'notes-icon';
            notesIcon.style.display = 'none';
            notesIcon.src = '/images/notes-icon.svg';
            notesIcon.alt = 'Notes Icon';
            bubble.appendChild(notesIcon);

            const buttonContainer = document.createElement('div');
            buttonContainer.className = 'button-container';
            bubble.appendChild(buttonContainer);

            // True/False buttons that appear on hover or tap
            const trueButton = document.createElement('button');
            trueButton.textContent = 'True';
            trueButton.className = 'true-button';
            trueButton.onclick = (event) => {
                event.stopPropagation();
                handleStatementSelection(statement, true, activity);
            };

            const falseButton = document.createElement('button');
            falseButton.textContent = 'False';
            falseButton.className = 'false-button';
            falseButton.onclick = (event) => {
                event.stopPropagation();
                handleStatementSelection(statement, false, activity);
            };

            buttonContainer.appendChild(trueButton);
            buttonContainer.appendChild(falseButton);

            bubble.addEventListener('click', () => openStatementModal(statement, notesIcon, activity));

            // Restore user answer and notes if they exist
            if (statement.userAnswer) {
                if (statement.userAnswer.answer) {
                    bubble.classList.add('true-selected');
                } else {
                    bubble.classList.add('false-selected');
                }
                if (statement.userAnswer.notes) {
                    notesIcon.style.display = 'inline';
                }
            }

            statementContainer.appendChild(bubble);
            cell.appendChild(statementContainer);
        });

        activityContainer.appendChild(table);
        container.appendChild(activityContainer);

        if (defaultActivity === "") {
            defaultActivity = activityId;
        }
    });
}

function openStatementModal(statement, notesIcon, activity) {
    const modal = document.getElementById('statement-modal');
    const modalStatement = document.getElementById('modal-statement');
    const modalContext = document.getElementById('modal-context');
    const modalTrueButton = document.getElementById('modal-true-button');
    const modalFalseButton = document.getElementById('modal-false-button');
    const modalNotesTextarea = document.getElementById('modal-notes');

    modalStatement.textContent = statement.text;
    modalContext.textContent = statement.context || "";
    modalNotesTextarea.value = statement.userAnswer ? statement.userAnswer.notes : "";

    // Sync the modal buttons with the current state
    modalTrueButton.classList.toggle('selected', statement.userAnswer && statement.userAnswer.answer === true);
    modalFalseButton.classList.toggle('selected', statement.userAnswer && statement.userAnswer.answer === false);

    modalTrueButton.onclick = () => {
        modalTrueButton.classList.add('selected');
        modalFalseButton.classList.remove('selected');
        handleStatementSelection(statement, true, activity);
    };
    modalFalseButton.onclick = () => {
        modalFalseButton.classList.add('selected');
        modalTrueButton.classList.remove('selected');
        handleStatementSelection(statement, false, activity);
    };

    const closeModal = () => {
        if (!statement.userAnswer) {
            statement.userAnswer = {};
        }
        statement.userAnswer.notes = modalNotesTextarea.value;
        notesIcon.style.display = statement.userAnswer.notes.trim() ? 'inline' : 'none';
        updateProjectData(statement, activity);
        modal.style.display = 'none';

        // Trigger debounced save
        debouncedSaveProgress(projectData);
    };

    modal.querySelector('.close').onclick = closeModal;
    window.onclick = (event) => {
        if (event.target == modal) {
            closeModal();
        }
    };

    modal.style.display = 'block';
}

function handleStatementSelection(statement, isTrue, activity) {
    statement.userAnswer = {
        answer: isTrue,
        notes: statement.userNotes || ""
    };

    const bubbles = document.querySelectorAll('.statement-bubble');
    bubbles.forEach(bubble => {
        const statementSpan = bubble.querySelector('.statement');
        if (statementSpan.textContent === statement.text) {
            bubble.classList.toggle('true-selected', isTrue);
            bubble.classList.toggle('false-selected', !isTrue);
        }
    });

    // Update projectData with the user's selection
    updateProjectData(statement, activity);

    // Recalculate the completion percentage for the activity and update the pie
    const activityCompletion = calculateActivityCompletion(activity);
    updateProgressPie(activity.title.toLowerCase().replace(/\s+/g, '-'), activityCompletion);

    // Recalculate the overall completion percentage and update the overall pie
    // Calculate overall completion metrics
    //const { activityCompletionPercentage, statementCompletionPercentage } = calculateOverallCompletion(projectData.assessmentData.dimensions);
//    updateOverallProgressPie(overallCompletion);

    // Trigger debounced save
    debouncedSaveProgress(projectData);
}

function submitProjectForm(errors, values) {
    console.log(values);
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
            const activityId = activity.title.toLowerCase().replace(/\s+/g, '-');
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

    // Add Metadata item to the nav
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
}

function toggleNav() {
    const nav = document.querySelector('.project nav');
    nav.classList.toggle('shrunk');
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
let defaultActivity = "";
async function loadData() {
    try {
      const response = await fetch('/assessments/?title=Open Data Pathway (2015)');
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error loading assessment data:', error);
      return null;
    }
  }

async function loadAssessment(projectId) {
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
        renderAssessmentMetadata(data);
        loadAssessmentData(data);
    } catch (error) {
        console.error('Error loading assessment:', error);
        return null;
    }
}

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
                alert('Open Data Pathway is readonly as the model is considered legacy. Please consider using a newer maturity model.')
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

function createAssessmentTable(dimension,levelKeys) {
    const container = document.getElementById('assessment-container');
    console.log(dimension);
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
          th.textContent = level;
          th.className = "level-" + (index + 1);
          header.appendChild(th);
      });
      const row = table.insertRow();

      // Initialize cells for each level
      const levelCells = {};
      levelKeys.forEach((level, index) => {
        levelCells[index + 1] = row.insertCell();
      });

      const firstActiveLevel = Math.min(...activity.questions.map(q => q.associatedLevel));

      // Populate cells based on associatedLevel
      activity.questions.forEach(question => {
        const cell = levelCells[question.associatedLevel];

        const questionContainer = document.createElement('div');
        questionContainer.className = 'question-container';

        const label = document.createElement('label');
          label.textContent = question.text;

          questionContainer.appendChild(label);
          questionContainer.appendChild(document.createElement('br'));

          const notesTextarea = document.createElement('textarea');
          notesTextarea.className = 'question-notes';
          notesTextarea.placeholder = 'Add your notes here...';

          if (question.associatedLevel === firstActiveLevel) {
              questionContainer.classList.add("active");
          } else {
              questionContainer.classList.add("disabled");
              notesTextarea.disabled = true;
          }

          // Dynamically create buttons based on the answers in the JSON
          question.answers.forEach(answer => {
              const answerButton = document.createElement('button');
              answerButton.textContent = answer.text;
              answerButton.disabled = !questionContainer.classList.contains('active'); // Disable if not active
              answerButton.addEventListener('click', () => handleAnswerSelection(question, answer));

              questionContainer.appendChild(answerButton);
          });

          questionContainer.appendChild(notesTextarea);
          cell.appendChild(questionContainer);
      });

      activityContainer.appendChild(table);
      container.appendChild(activityContainer);

      if (defaultActivity === "") {
        defaultActivity = activityId;
      }
    });
}

function handleAnswerSelection(question, selectedAnswer) {
      // Find the row that contains this question
      const rows = Array.from(document.querySelectorAll('tr'));
      const row = rows.find(tr => {
          const labels = tr.querySelectorAll('label');
          return Array.from(labels).some(label => label.textContent === question.text);
      });

      if (!row) return;

      const table = row.closest('table');
      if (!table) return;

      // Get the cells from the row, skipping the first two cells (Activity and Score)
      const cells = Array.from(row.cells);

      // Get the associated level index
      const currentLevelIndex = question.associatedLevel - 1;

      // Find the correct question container within the current cell
      const currentCell = cells[currentLevelIndex];
      const questionContainers = Array.from(currentCell.querySelectorAll('.question-container'));
      const questionContainer = questionContainers.find(container =>
          container.querySelector('label').textContent === question.text
      );

      // Reset classes for the current question container
      questionContainer.classList.add('question-answered'); // Add class to the question block
      questionContainer.querySelectorAll('button').forEach(button => {
          button.disabled = true;
          button.classList.remove('selected'); // Remove any existing 'selected' class
      });

      // Highlight the selected answer
      questionContainer.querySelectorAll('button').forEach(button => {
          button.disabled = false;
          button.classList.remove('selected','red','green');
          if (button.textContent === selectedAnswer.text) {
              button.classList.add('selected'); // Add class to the selected button
              const selectedText = button.textContent;
              const answer = question.answers.find(ans => ans.text === selectedText);
              if (answer.positive) {
                  button.classList.add('green');
              } else {
                  button.classList.add('red');
              }
          }
      });

      const notesTextarea = questionContainer.querySelector('.question-notes');
      if (notesTextarea && selectedAnswer.notes) {
          notesTextarea.value = selectedAnswer.notes;
      }

      const allAnswered = Array.from(currentCell.querySelectorAll('.question-container'))
          .every(container => container.querySelector('.selected'));

      // Apply class based on the lowest score
      if (allAnswered) {
              // Gather scores from all answered questions in the current cell
          const scores = questionContainers
              .map(container => {
                  const selectedButton = container.querySelector('.selected');
                  if (selectedButton) {
                      const selectedText = selectedButton.textContent;
                      const answer = question.answers.find(ans => ans.text === selectedText);
                      return answer ? answer.score : null;
                  }
                  return null;
              })
              .filter(score => score !== null); // Filter out null scores

          // Determine the lowest score among answered questions
          const lowestScore = scores.length > 0 ? Math.min(...scores) : null;
          for (let i = currentLevelIndex + 1; i < cells.length; i++) {
              if (cells[i].querySelector('button')) {
                  cells[i].classList.remove('disabled');
                  cells[i].classList.add('active');
                  cells[i].querySelectorAll('textarea').forEach(textArea => textArea.disabled = false);
                  cells[i].querySelectorAll('button').forEach(button => button.disabled = false);
                  cells[i].querySelectorAll('.question-container').forEach(question => question.classList.remove('disabled'));
                  cells[i].querySelectorAll('.question-container').forEach(question => question.classList.add('active'));
                  break;
              }
          }
      }
      /*
      // Handle improvements
      if (selectedAnswer.improvements.length > 0) {
          let improvementText = 'Suggested Improvements:\n';
          selectedAnswer.improvements.forEach(improvement => {
              improvementText += `- ${improvement.notes}\n`;
          });
          alert(improvementText); // Display improvements as an alert or append to the UI
      }
      */
}

async function loadUserData(userId) {
      try {
          const response = await fetch(`Pathway/userData/users/${userId}.json`);
          if (!response.ok) {
              throw new Error('Failed to load user data');
          }
          const userData = await response.json();

          // Display user details
          const userDetailsDiv = document.querySelector('.user-details');
          if (userDetailsDiv) {
              userDetailsDiv.innerHTML = `
                  <p><strong>Name:</strong> ${userData.name || 'N/A'}</p>
                  <p><strong>Email:</strong> ${userData.email || 'N/A'}</p>
                  <p><strong>Sign-In Count:</strong> ${userData.sign_in_count || 'N/A'}</p>
                  <p><strong>Last Sign-In At:</strong> ${userData.last_sign_in_at || 'N/A'}</p>
                  <p><strong>Created At:</strong> ${userData.created_at || 'N/A'}</p>
                  <p><strong>Organisation:</strong> ${userData.organisation?.title || 'N/A'}</p>
              `;
          }
      } catch (error) {
          console.error('Error loading user data:', error);
      }
}

async function loadAssessmentData(savedAssessment) {
      const data = await loadData(); // Load the base assessment structure

      const assessmentDetailsDiv = document.querySelector('.assessment-details');
      if (assessmentDetailsDiv) {
          assessmentDetailsDiv.innerHTML = `
              <p><strong>Title:</strong> ${savedAssessment.title || 'N/A'}</p>
              <p><strong>Notes:</strong> ${savedAssessment.notes || 'N/A'}</p>
              <p><strong>Start Date:</strong> ${savedAssessment.start_date || 'N/A'}</p>
              <p><strong>Updated At:</strong> ${savedAssessment.updated_at || 'N/A'}</p>
              <p><strong>Completion Date:</strong> ${savedAssessment.completion_date || 'N/A'}</p>
          `;
      }

      // Extract the user ID and load user data
      const userId = savedAssessment.user?.id;
      if (userId) {
          await loadUserData(userId);
      }

      if (data) {
          data.dimensions.forEach(dimension => {
              dimension.activities.forEach(activity => {
                  // Find the corresponding activity in the saved assessment
                  const savedActivity = savedAssessment.assessmentData.activities.find(sa => sa.title === activity.title);
                  if (savedActivity) {
                      activity.questions.forEach(question => {
                          // Find the corresponding question in the saved activity
                          const savedQuestion = savedActivity.questions.find(sq => sq.text === question.text);
                          if (savedQuestion) {
                              // Mark the saved answer as selected
                              const savedAnswer = savedQuestion.answers[0];
                              if (savedAnswer) {
                                  handleAnswerSelection(question, savedAnswer);
                              }
                          }
                      });
                  }
              });
          });
      }
}

function loadNavBar(data,projectId) {

        const dimensions = data.dimensions;
        const navList = document.getElementById('navList');

        const metadataItem = document.createElement('li');
        metadataItem.classList.add('nav-dimension-item'); // Add class for styling
        metadataItem.classList.add('link'); // Add class for styling
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
            dimensionItem.textContent = dimension.name;

            const activityList = document.createElement('ul');
            dimension.activities.forEach(activity => {
                const activityId = activity.title.toLowerCase().replace(/\s+/g, '-');
                const activityItem = document.createElement('li');
                activityItem.textContent = activity.title;
                activityItem.setAttribute('id','nav-'+activityId);
                activityItem.addEventListener('click', () => {
                    showActivity(activityId);
                    updateHash(activityId);
                });
                activityList.appendChild(activityItem);
            });

            dimensionItem.appendChild(activityList);
            navList.appendChild(dimensionItem);
        });

        const downloadItem = document.createElement('li');
        downloadItem.classList.add('nav-dimension-item'); // Add class for styling
        downloadItem.classList.add('link'); // Add class for styling
        downloadItem.setAttribute('id', 'nav-download');
        const downloadTitle = document.createElement('span');
        downloadTitle.textContent = "Download data (JSON)";
        downloadTitle.classList.add('dimension-title');
        downloadItem.appendChild(downloadTitle);
        downloadItem.addEventListener('click', () => {
            downloadProjectDataAsJSON(projectId);
        });
        navList.appendChild(downloadItem);

}

async function downloadProjectDataAsJSON(projectId) {
    try {
        // Fetch the JSON data from the server
        const response = await fetch(`/projects/${projectId}`, {
            headers: {
                'Accept': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch JSON data: ${response.statusText}`);
        }

        // Parse the JSON data
        const data = await response.json();

        // Convert the JSON data to a string
        const jsonString = JSON.stringify(data, null, 2);

        // Create a Blob with the JSON data
        const blob = new Blob([jsonString], { type: 'application/json' });

        // Create a download link
        const url = URL.createObjectURL(blob);

        // Create an anchor element
        const link = document.createElement('a');
        link.href = url;
        link.download = `project_${projectId}.json`; // Set the desired file name

        // Programmatically click the link to trigger the download
        document.body.appendChild(link);
        link.click();

        // Clean up the URL object
        URL.revokeObjectURL(url);
        document.body.removeChild(link);

    } catch (error) {
        console.error('Error downloading JSON:', error);
    }
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

function showMetadata() {
    document.querySelectorAll('.activity').forEach(activity => {
        activity.classList.remove('active');
    });
    const selectedActivityNav = document.getElementById('nav-metadata');
    const selectedActivity = document.getElementById("metadata");
    selectedActivity.classList.add('active');
    selectedActivityNav.classList.add('active');
}

function updateHash(activityId) {
        if (history.replaceState) {
            history.replaceState(null, null, `#${activityId}`);
        } else {
            location.hash = activityId; // Fallback for older browsers
        }
}


// Show the activity based on the URL hash on load
window.addEventListener('load', () => {
    const hash = location.hash.substring(1); // Remove the '#' from the hash
    if (hash) {
        showActivity(hash);
    } else {
        showActivity(defaultActivity); // Default to the first activity
    }
});

function toggleNav() {
    const nav = document.querySelector('.project nav');
    nav.classList.toggle('shrunk');
}

document.addEventListener('DOMContentLoaded', async () => {
const urlParts = window.location.pathname.split('/');
const projectId = urlParts[urlParts.length - 1]; // Extract the project ID from the URL

let levelKeys = ["Initial", "Repeatable", "Defined", "Managed", "Optimising"];
const data = await loadData();
loadNavBar(data,projectId);

if (data) {
    if (data.levels) {
        levelKeys = data.levels;
    }
    data.dimensions.forEach(dimension => {
        createAssessmentTable(dimension,levelKeys)
    });
}

if (projectId) {
    await loadAssessment(projectId);
} else {
    console.error('No project ID found in the URL');
}

const hash = location.hash.substring(1); // Remove the '#' from the hash
if (hash) {
    showActivity(hash);
} else {
    showActivity(defaultActivity); // Default to the first activity
}
});
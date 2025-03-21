const express = require('express');
const router = express.Router({ mergeParams: true });
const { ensureAuthenticated } = require('../middleware/auth');
const { isMember } = require('../middleware/hubspot');
const { loadProject, checkProjectAccess } = require('../middleware/project');
const Project = require('../models/project');
const Assessment = require('../models/assessment');
const OpenAI = require("openai");
const crypto = require('crypto');

const model = process.env.OPENAI_MODEL || 'gpt-4';
const responseTokens = parseInt(process.env.OPENAI_RESPONSE_TOKENS, 10) || 500;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const MAX_WAIT_TIME = 30000; // 30 seconds
const RETRY_INTERVAL = 3000; // 3 seconds
const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

// Function to generate a hash from the user's answers
function generateHash(data) {
    const jsonString = JSON.stringify(data);
    return crypto.createHash('sha256').update(jsonString).digest('hex');
}

async function getAIReponse(prompt, tokens = responseTokens) {
    const completion = await openai.chat.completions.create({
        messages: [
            { role: 'system', content: 'You are a helpful AI assistant that is tasked with turning user answers to a maturity model into human readable summaries of progress and recommendations. Please ensure all responses are in British English spelling. Provide your responses as undeclared HTML.' },
            { role: 'user', content: prompt }
        ],
        model: model,
        max_tokens: tokens,
    });
    return completion.choices[0].message.content;
}

// Helper function to get AI activity summary
async function getAIActivitySummary(activity, dimensionName, levelKeys, assessmentTitle) {
    // 1. Generate the prompt
    const prompt = `
    A user has completed part of a ${assessmentTitle} for the section "${activity.title}" under the "${dimensionName}" part of the assessment. You can find the maturity assessment for just this section in JSON form below. Each activity has a number of question and associated statements a user can choose. The userAnswer object contains the level of the statement they chose as well as the text.

    ${JSON.stringify(activity, null, 2)}

    The levels of maturity are:
    ${levelKeys.map((key, index) => `${index + 1}: ${key}`).join("\n")}

    Create a short human-readable paragraph for this section that describes the areas which show maturity (progress so far) before then focusing on areas of improvement both to achieve the next level of maturity as well as overall. This summary will be placed within the correct section of the report so there is no need to mention the sections this review is for in your response. Start with the summary paragraph and DO NOT include a title or heading at the start.
    `;

    // 2. Make the request to OpenAI
    const response = await getAIReponse(prompt)

    // 3. Return the summary from OpenAI
    return response;
}

async function getOrGenerateActivitySummary(activity, dimensionName, levelKeys, assessmentTitle) {
    // 1. Check if userProgress exists
    if (!activity.userProgress || !activity.userProgress.achievedLevel) {
        // If there's no user progress, return a default message
        return `It is not possible to make any recommendations for ${activity.title} as no questions have been answered.`;
    }

    // 2. Generate the hash of the current user answers for questions
    const currentHash = generateHash(activity.questions.map(q => q.userAnswer));

    // 3. Check if the hash has changed
    if (activity.aiResponse && activity.aiResponse.hash === currentHash) {
        // The hash hasn't changed, return the cached response
        return activity.aiResponse.summary;
    }

    // 4. If the hash has changed or there's no summary, generate a new one
    const summary = await getAIActivitySummary(activity, dimensionName, levelKeys, assessmentTitle);

    // 5. Save the new summary and hash in the activity (optional, if you want to cache it)
    activity.aiResponse = {
        summary,
        hash: currentHash
    };

    // 6. Return the new summary
    return summary;
}

// Helper function to check if all dimension summaries exist
async function checkDimensionSummariesExist(projectData, dimensions) {
    for (const dimension of dimensions) {
        if (!dimension.aiResponse || !dimension.aiResponse.summary) {
            return false;
        }
    }
    return true;
}

// Route to get activity summary
router.get('/:id/assistant/getActivitySummary', ensureAuthenticated, checkProjectAccess, isMember, async (req, res) => {
    try {
        const projectId = req.params.id;
        const { activityTitle, dimensionName } = req.query;

        // 1. Retrieve the project data from the database
        const projectData = await Project.findById(projectId);
        if (!projectData) {
            return res.status(404).json({ error: 'Project not found' });
        }

        // 2. Retrieve the assessment details to get the title
        const assessmentId = projectData.assessment;
        const assessmentData = await Assessment.findById(assessmentId);
        if (!assessmentData) {
            return res.status(404).json({ error: 'Assessment not found' });
        }

        const assessmentTitle = assessmentData.title;

        // 3. Find the dimension by name
        const dimension = projectData.assessmentData.dimensions.find(dim => dim.name === dimensionName);

        if (!dimension) {
            return res.status(404).json({ error: 'Dimension not found' });
        }

        // 4. Find the activity by title within the dimension
        const activity = dimension.activities.find(act => act.title === activityTitle);

        if (!activity) {
            return res.status(404).json({ error: 'Activity not found' });
        }

        // 5. Create a deep copy of the activity object to remove notes before sending to AI
        const activityCopy = JSON.parse(JSON.stringify(activity));

        // 6. Remove notes from userAnswer in the activityCopy
        activityCopy.questions.forEach(question => {
            if (question.userAnswer && question.userAnswer.notes) {
                delete question.userAnswer.notes;
            }
        });

        // 7. Use the getOrGenerateActivitySummary function with the modified activityCopy
        let levelKeys = ["Initial", "Repeatable", "Defined", "Managed", "Optimising"];
        if (assessmentData.levels) {
            levelKeys = assessmentData.levels;
        }
        const summary = await getOrGenerateActivitySummary(activityCopy, dimension.name, levelKeys, assessmentTitle);

        // 8. Generate hash for the current activity state
        const activityHash = generateHash(activity.questions.map(q => q.userAnswer));

        // 9. Update the specific activity's aiResponse in the dimension
        const updateQuery = {
            _id: projectId,
            'assessmentData.dimensions.name': dimensionName,
            'assessmentData.dimensions.activities.title': activityTitle
        };

        const updateAction = {
            $set: {
                'assessmentData.dimensions.$[dim].activities.$[act].aiResponse': {
                    hash: activityHash,
                    summary: summary
                }
            }
        };

        const updateOptions = {
            arrayFilters: [
                { 'dim.name': dimensionName },
                { 'act.title': activityTitle }
            ],
            new: true
        };

        // 10. Perform the update
        await Project.findOneAndUpdate(updateQuery, updateAction, updateOptions);

        // 11. Send the summary as the response
        res.json({ response: summary });

    } catch (error) {
        console.error('Error generating activity summary:', error);
        res.status(500).json({ error: 'An error occurred while generating the summary' });
    }
});


// Route to get dimension summary
router.get('/:id/assistant/getDimensionSummary', ensureAuthenticated, checkProjectAccess, isMember, async (req, res) => {
    try {
        const projectId = req.params.id;
        const { dimensionName } = req.query;

        // 1. Retrieve the project data from the database
        const projectData = await Project.findById(projectId);
        if (!projectData) {
            return res.status(404).json({ error: 'Project not found' });
        }

        // 2. Retrieve the assessment details to get the title
        const assessmentId = projectData.assessment;
        const assessmentData = await Assessment.findById(assessmentId);
        if (!assessmentData) {
            return res.status(404).json({ error: 'Assessment not found' });
        }

        const assessmentTitle = assessmentData.title;

        // 3. Find the dimension by name
        const dimension = projectData.assessmentData.dimensions.find(dim => dim.name === dimensionName);
        if (!dimension) {
            return res.status(404).json({ error: 'Dimension not found' });
        }

        // 4. Prepare the level keys
        let levelKeys = ["Initial", "Repeatable", "Defined", "Managed", "Optimising"];
        if (assessmentData.levels) {
            levelKeys = assessmentData.levels;
        }

        // 5. Gather AI Summaries for each activity in the dimension
        const activitySummaries = [];
        for (const activity of dimension.activities) {
            const summary = await getOrGenerateActivitySummary(activity, dimension.name, levelKeys, assessmentTitle);
            activitySummaries.push({ title: activity.title, summary });
        }

        // 6. Generate a hash of the activity summaries to check for changes
        const summaryHash = generateHash(activitySummaries);

        // 7. Check if the dimension summary already exists and hasn't changed
        if (dimension.aiResponse && dimension.aiResponse.hash === summaryHash) {
            // The hash hasn't changed, return the cached response
            return res.json({ summary: dimension.aiResponse.summary });
        }

        // 8. Prepare the prompt with all activity summaries
        let prompt = `A user is completing a maturity assessment entitled ${assessmentTitle}. The following are the activity summaries for the activities under the dimension "${dimension.name}":\n\n`;

        activitySummaries.forEach(({ title, summary }) => {
            prompt += `Activity: ${title}\nSummary: ${summary}\n\n`;
        });

        prompt += "Create a summary of progress in this dimension and provide recommendations on next steps for the user. Start with the summary paragraph and DO NOT include a title or heading at the start.";

        // 9. Generate AI summary for the dimension
        const dimensionSummary = await getAIReponse(prompt);

        // 10. Generate a summary hash to track changes
        const dimensionUpdate = {
            'assessmentData.dimensions.$.aiResponse': {
                hash: summaryHash,
                summary: dimensionSummary
            }
        };

        // 11. Use findOneAndUpdate to update only the matching dimension by name
        await Project.findOneAndUpdate(
            { _id: projectId, 'assessmentData.dimensions.name': dimensionName },
            { $set: dimensionUpdate },
            { new: true }
        );

        // 12. Send the dimension summary as the response
        res.json({ summary: dimensionSummary });

    } catch (error) {
        console.error('Error generating dimension summary:', error);
        res.status(500).json({ error: 'An error occurred while generating the dimension summary' });
    }
});

// Route to get the executive summary
router.get('/:id/assistant/getExecutiveSummary', ensureAuthenticated, checkProjectAccess, isMember, async (req, res) => {
    try {
        const projectId = req.params.id;

        // 1. Retrieve the project data
        const projectData = await Project.findById(projectId);
        if (!projectData) {
            return res.status(404).json({ error: 'Project not found' });
        }

        // 2. Get the assessment details
        const assessmentId = projectData.assessment;
        const assessmentData = await Assessment.findById(assessmentId);
        if (!assessmentData) {
            return res.status(404).json({ error: 'Assessment not found' });
        }

        const assessmentTitle = assessmentData.title;
        const dimensions = projectData.assessmentData.dimensions;

        // ✅ Check if all dimension summaries exist
        const allReady = await checkDimensionSummariesExist(projectData, dimensions);
        if (!allReady) {
            return res.status(202).json({ message: 'Dimension summaries are still being processed. Try again shortly.' });
        }

        // 3. Collect dimension summaries
        const dimensionSummaries = dimensions.map(dim => ({
            name: dim.name,
            summary: dim.aiResponse.summary
        }));

        const summaryHash = generateHash(dimensionSummaries);

        // 4. Return cached version if hash hasn’t changed
        if (
            projectData.assessmentData.aiExecutiveSummary &&
            projectData.assessmentData.aiExecutiveSummary.hash === summaryHash
        ) {
            return res.json({ summary: projectData.assessmentData.aiExecutiveSummary.summary });
        }

        // 5. Generate the executive summary prompt
        let prompt = `A user is completing a maturity assessment entitled ${assessmentTitle}. The following are the dimension summaries:\n\n`;
        dimensionSummaries.forEach(({ name, summary }) => {
            prompt += `Dimension: ${name}\nSummary: ${summary}\n\n`;
        });
        prompt += "Create an executive summary that provides an overall assessment of the user's progress and offers recommendations for next steps. Start with the summary paragraph and DO NOT include a title or heading at the start.";

        // 6. Get AI response
        const executiveSummary = await getAIReponse(prompt, responseTokens * 2);

        // 7. Save the executive summary
        projectData.assessmentData.aiExecutiveSummary = {
            hash: summaryHash,
            summary: executiveSummary
        };
        projectData.markModified('assessmentData.aiExecutiveSummary');
        await projectData.save();

        // 8. Return the summary
        res.json({ summary: executiveSummary });

    } catch (error) {
        console.error('Error generating executive summary:', error);
        res.status(500).json({ error: 'An error occurred while generating the executive summary' });
    }
});


module.exports = router;
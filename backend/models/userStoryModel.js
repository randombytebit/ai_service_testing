const axios = require('axios');
const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const MODEL = "x-ai/grok-4";
const OUTPUT_DIR = path.join(__dirname, '..', '..', 'user_stories_outputs');

function createUserStoryPrompt(analysisReports, projectTitle) {
    const combinedAnalysis = analysisReports
        .map((report, index) => `
=== Analysis ${index + 1}: ${report.sourceFile || report.filename} ===
${report.fullAnalysis || report.data}
`)
        .join('\n');

    return `You are an expert business analyst. Based on the following functional and non-functional requirements analysis, generate a comprehensive user stories report.

Project Title: ${projectTitle}

${combinedAnalysis}

Generate user stories in the following format for EACH distinct user story:

Story Sequence: Story [number]
Story Role: [role/persona]
Story Title: [concise title]
Story Content: As a [role], I want to [action] so that [benefit/goal].
Story Source: Document
Referenced Documents: [source filename or "None"]

Rules:
1. Extract ALL user stories from the functional requirements
2. Each story should be atomic and independent
3. Use clear, consistent role names (e.g., Customer, Admin, User, etc.)
4. Ensure each story follows the "As a [role], I want to [action] so that [benefit]" format
5. Number stories sequentially starting from Story 1
6. Group related stories together
7. Do not add any preamble or conclusion, output ONLY the formatted stories
8. The user story should follow the project title. If it is not suitable for the project title, discard the story.
9. Start every story with "Story [number]" on its own line.

Output the user stories now:`;
}

async function generateUserStories(analysisReports, projectTitle) {
    if (!OPENROUTER_API_KEY) {
        throw new Error('OPENROUTER_API_KEY is not configured in environment variables');
    }

    const prompt = createUserStoryPrompt(analysisReports, projectTitle);

    try {
        const response = await axios.post(
            'https://openrouter.ai/api/v1/chat/completions',
            {
                model: MODEL,
                messages: [{ role: 'user', content: prompt }],
                temperature: 0.3
            },
            {
                headers: {
                    'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
                    'Content-Type': 'application/json',
                    'HTTP-Referer': 'http://localhost:3000',
                    'X-Title': 'User Story Generator'
                },
                timeout: 120000
            }
        );

        return response.data.choices[0].message.content.trim();
    } catch (error) {
        console.error('Grok API Error:', error.response?.data || error.message);
        throw new Error(`User story generation failed: ${error.response?.data?.error?.message || error.message}`);
    }
}

function saveUserStoryReport(projectTitle, userStoriesRaw, sourceFiles) {
    // Ensure output directory exists
    if (!fs.existsSync(OUTPUT_DIR)) {
        fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }

    // Timestamps
    const displayTimestamp = new Date().toLocaleString('en-US', {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        timeZone: 'Asia/Hong_Kong',
        timeZoneName: 'long'
    });

    const filenameTimestamp = new Date().toISOString().replace(/[:.]/g, '-');

    const baseName = `Project_User_Stories_Report-${filenameTimestamp}`;
    const txtFilename = `${baseName}.txt`;
    const pdfFilename = `${baseName}.pdf`;

    const txtPath = path.join(OUTPUT_DIR, txtFilename);
    const pdfPath = path.join(OUTPUT_DIR, pdfFilename);

    // === Parse raw LLM output into array of stories ===
    let userStories = [];

    if (typeof userStoriesRaw === 'string') {
        // Split by common patterns that separate stories
        const lines = userStoriesRaw.split('\n').map(line => line.trim());

        let currentStory = [];
        for (const line of lines) {
            // Detect start of a new story (e.g., "Story 1:", "Story Sequence: Story 5", etc.)
            if (/^Story \d+/i.test(line) || /^Story Sequence:/i.test(line)) {
                if (currentStory.length > 0) {
                    userStories.push(currentStory.join('\n').trim());
                    currentStory = [];
                }
            }
            if (line) {
                currentStory.push(line);
            }
        }
        // Push the last story
        if (currentStory.length > 0) {
            userStories.push(currentStory.join('\n').trim());
        }

        // Fallback: if no "Story X" markers found, split by double newlines
        if (userStories.length === 0) {
            userStories = userStoriesRaw
                .split(/\n\s*\n/)
                .map(s => s.trim())
                .filter(s => s.length > 0);
        }
    } else if (Array.isArray(userStoriesRaw)) {
        userStories = userStoriesRaw.map(s => s.trim());
    } else {
        throw new Error('Invalid userStories format: expected string or array');
    }

    // Remove empty stories
    userStories = userStories.filter(s => s.length > 0);

    if (userStories.length === 0) {
        console.warn('No user stories were parsed from LLM output');
        userStories = ['(No user stories generated)'];
    }

    // === Generate TXT Content ===
    const txtContent = `Project User Stories Report

Project Title: ${projectTitle}

Generated by Singularity AI: ${displayTimestamp}

Source Files:
${sourceFiles && sourceFiles.length > 0
        ? sourceFiles.map(f => `  - ${f}`).join('\n')
        : '  (None provided)'}

${'='.repeat(80)}

User Stories:
${userStories.map((story, index) => `${index + 1}. ${story}`).join('\n\n')}

${'='.repeat(80)}
End of Report
`;

    fs.writeFileSync(txtPath, txtContent, 'utf-8');
    console.log(`Saved TXT user story report: ${txtFilename}`);

    // === Generate PDF ===
    const doc = new PDFDocument({
        size: 'A4',
        margin: 50,
        info: {
            Title: `User Stories Report - ${projectTitle}`,
            Author: 'Singularity AI',
            CreationDate: new Date()
        }
    });

    const pdfStream = fs.createWriteStream(pdfPath);
    doc.pipe(pdfStream);

    // Header
    doc.fontSize(24).font('Helvetica-Bold').text('Project User Stories Report', { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(18).font('Helvetica').text(projectTitle, { align: 'center' });
    doc.moveDown(2);
    doc.fontSize(10).font('Helvetica-Oblique').text(`Generated by Singularity AI on ${displayTimestamp}`, { align: 'center' });
    doc.moveDown(3);

    // Source Files
    doc.fontSize(14).font('Helvetica-Bold').text('Source Files:');
    doc.moveDown(0.5);
    if (sourceFiles && sourceFiles.length > 0) {
        doc.fontSize(11).font('Helvetica').list(sourceFiles.map(f => f), { bulletRadius: 4, textIndent: 20 });
    } else {
        doc.font('Helvetica-Oblique').text('None provided');
    }

    doc.moveDown(3);

    // User Stories
    doc.fontSize(16).font('Helvetica-Bold').text('User Stories', { underline: true });
    doc.moveDown(1);

    userStories.forEach((story, index) => {
        doc.fontSize(12)
            .font('Helvetica-Bold')
            .text(`${index + 1}.`, { continued: true })
            .font('Helvetica')
            .text(` ${story}`, { indent: 20 });
        doc.moveDown(1);
    });

    doc.moveDown(4);
    doc.fontSize(10).font('Helvetica-Oblique').text('End of Report', { align: 'center' });

    doc.end();

    console.log(`Saved PDF user story report: ${pdfFilename}`);

    return {
        savedTxtFilename: txtFilename,
        savedPdfFilename: pdfFilename,
        txtPath,
        pdfPath,
        txtUrl: `/user_stories_outputs/${txtFilename}`,
        pdfUrl: `/user_stories_outputs/${pdfFilename}`,
        storyCount: userStories.length
    };
}

module.exports = { generateUserStories, saveUserStoryReport };
const express = require('express');
const router = express.Router();
const { generateUserStories, saveUserStoryReport } = require('../models/userStoryModel');

router.post('/generate-user-stories', async (req, res) => {
    try {
        const { analysisReports, projectTitle } = req.body;

        if (!analysisReports || !Array.isArray(analysisReports) || analysisReports.length === 0) {
            return res.status(400).json({
                error: 'No analysis reports provided.'
            });
        }

        if (!projectTitle || projectTitle.trim().length === 0) {
            return res.status(400).json({
                error: 'Project title is required.'
            });
        }

        const trimmedTitle = projectTitle.trim();

        console.log(`Generating user stories for project: "${trimmedTitle}"`);
        console.log(`Using ${analysisReports.length} analysis report(s)`);

        // Step 1: Get raw LLM output (string)
        const rawUserStoriesText = await generateUserStories(analysisReports, trimmedTitle);

        // Step 2: Extract source filenames
        const sourceFiles = analysisReports
            .map(r => r.sourceFile || r.filename || 'Unknown source')
            .filter(Boolean);

        // Step 3: Save report AND get parsed stories + file info
        const saveInfo = saveUserStoryReport(trimmedTitle, rawUserStoriesText, sourceFiles);

        res.json({
            success: true,
            message: 'User stories generated successfully',
            projectTitle: trimmedTitle,
            storyCount: saveInfo.storyCount || 'Unknown',
            sourceFiles,
            txtFile: saveInfo.savedTxtFilename,
            txtDownloadUrl: saveInfo.txtUrl,
            pdfFile: saveInfo.savedPdfFilename,
            pdfDownloadUrl: saveInfo.pdfUrl,
        });

    } catch (error) {
        console.error('User story generation error:', error);
        res.status(500).json({
            error: 'User story generation failed',
            details: error.message
        });
    }
});

module.exports = router;
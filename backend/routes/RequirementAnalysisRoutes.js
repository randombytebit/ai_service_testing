const express = require('express');
const router = express.Router();
const { analyzeFiles } = require('../models/grokModel');

router.post('/analyze', async (req, res) => {
    try {
        const { files, title } = req.body;

        if (!files || !Array.isArray(files) || files.length === 0) {
            return res.status(400).json({
                error: 'No files provided. Please select at least one file.'
            });
        }

        if (!title || title.trim().length === 0) {
            return res.status(400).json({
                error: 'Project title is required.'
            });
        }

        console.log(`Starting analysis for ${files.length} file(s) with title: "${title}"`);

        const results = await analyzeFiles(files, title.trim());

        res.json({
            success: true,
            results,
            title
        });
    } catch (error) {
        console.error('Analysis error:', error);
        res.status(500).json({
            error: 'Analysis failed',
            details: error.message
        });
    }
});

module.exports = router;
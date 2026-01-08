const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

const analysisOutputDir = path.join(__dirname, '..', '..', 'analysis_outputs');

router.get('/analysis-history', (req, res) => {
    try {
        if (!fs.existsSync(analysisOutputDir)) {
            return res.json([]);
        }

        const files = fs.readdirSync(analysisOutputDir)
            .filter(file => file.endsWith('.txt'))
            .map(file => {
                const filePath = path.join(analysisOutputDir, file);
                const stats = fs.statSync(filePath);
                const content = fs.readFileSync(filePath, 'utf-8');

                const titleMatch = content.match(/Project Title: (.+)/);
                const sourceMatch = content.match(/Source File: (.+)/);
                const analysisMatch = content.match(/ANALYSIS RESULT:\n-+\n([\s\S]+)\n-+/);

                return {
                    filename: file,
                    path: `/analysis_outputs/${file}`,
                    title: titleMatch ? titleMatch[1].trim() : 'Unknown',
                    sourceFile: sourceMatch ? sourceMatch[1].trim() : 'Unknown',
                    createdAt: stats.mtime,
                    size: (stats.size / 1024).toFixed(2) + ' KB',
                    analysisPreview: analysisMatch ? analysisMatch[1].substring(0, 200) + '...' : '',
                    fullAnalysis: analysisMatch ? analysisMatch[1] : ''
                };
            })
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        res.json(files);
    } catch (error) {
        console.error('Error fetching analysis history:', error);
        res.status(500).json({ error: 'Failed to fetch analysis history' });
    }
});

module.exports = router;
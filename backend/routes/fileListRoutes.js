const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

// Use __dirname to get the actual directory of this file, then go up to root
const rootDir = path.join(__dirname, '..', '..'); // Goes up from routes/ to backend/ to root/

console.log('Root directory resolved to:', rootDir);

// Helper function with better error handling
const listFiles = (dir, urlPrefix, extensions) => {
    console.log('Checking directory:', dir);
    console.log('Directory exists?', fs.existsSync(dir));

    if (!fs.existsSync(dir)) {
        console.log('Directory does not exist:', dir);
        return [];
    }

    const allFiles = fs.readdirSync(dir);
    console.log('All files in directory:', allFiles);

    const filtered = allFiles.filter(file =>
        extensions.some(ext => file.toLowerCase().endsWith(ext))
    );
    console.log('Filtered files:', filtered);

    return filtered.map(file => ({
        name: file,
        path: `${urlPrefix}/${file}`,
        size: (fs.statSync(path.join(dir, file)).size / (1024*1024)).toFixed(2) + ' MB'
    }));
};

// PDFs from outputs/
router.get('/files/pdfs', (req, res) => {
    console.log('=== PDF REQUEST ===');
    const dir = path.join(rootDir, 'outputs');
    const files = listFiles(dir, '/outputs', ['.pdf']);
    console.log('Returning', files.length, 'PDFs');
    res.json(files);
});

// Transcriptions (with preview)
router.get('/files/transcriptions', (req, res) => {
    console.log('=== TRANSCRIPTIONS REQUEST ===');
    const dir = path.join(rootDir, 'public', 'transcriptions');

    if (!fs.existsSync(dir)) {
        console.log('Transcriptions directory does not exist');
        return res.json([]);
    }

    const allFiles = fs.readdirSync(dir);
    console.log('All files:', allFiles);

    const files = allFiles
        .filter(f => f.toLowerCase().endsWith('.txt'))
        .map(file => {
            const filePath = path.join(dir, file);
            let preview = '';
            try {
                const content = fs.readFileSync(filePath, 'utf-8');
                preview = content.substring(0, 300) + (content.length > 300 ? '...' : '');
            } catch (e) {
                console.error('Error reading file:', file, e.message);
                preview = 'Preview unavailable';
            }
            return {
                name: file,
                path: `/transcriptions/${file}`,
                preview
            };
        });

    console.log('Returning', files.length, 'transcriptions');
    res.json(files);
});

module.exports = router;
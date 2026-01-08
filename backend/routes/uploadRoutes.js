const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const { preprocessAndTranscribe } = require('../models/audioModel');     // ← direct from model
const { convertDoc } = require('../controllers/docController');         // ← model-style function

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, '../../temp');
        fs.mkdirSync(uploadDir, { recursive: true });
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ storage });

router.post('/upload', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const { type } = req.body;

        if (!type || !['audio', 'document'].includes(type)) {
            return res.status(400).json({
                error: 'Missing or invalid "type". Must be "audio" or "document"'
            });
        }

        const ext = path.extname(req.file.originalname).toLowerCase();
        const validExtensions = {
            audio: ['.mp3', '.wav', '.m4a', '.ogg', '.flac', '.aac', '.mkv'],
            document: ['.doc', '.docx', '.pdf']
        };

        if (!validExtensions[type].includes(ext)) {
            fs.unlinkSync(req.file.path);
            return res.status(400).json({
                error: `Invalid file extension for "${type}". Allowed: ${validExtensions[type].join(', ')}`
            });
        }

        let result;

        if (type === 'audio') {
            // Call the MODEL function directly
            result = await preprocessAndTranscribe(req.file.path, req.file.originalname);
        } else if (type === 'document') {
            result = await convertDoc(req.file.path, req.file.originalname, ext);
        }

        // Clean up temp file
        fs.unlink(req.file.path, (err) => {
            if (err) console.error('Failed to delete temp file:', err);
        });

        res.json({
            success: true,
            type,
            message: 'File processed successfully',
            text: result.text || result.extractedText || result.transcribedText || '',
            audioUrl: type === 'audio' ? `/audio/${result.mp3Filename || result.audioFilename}` : null,
            mp3Filename: type === 'audio' ? result.mp3Filename : null,
            pdfUrl: type === 'document' ? result.pdfUrl : null,
            pdfFilename: type === 'document' ? result.pdfFilename : null,
            originalFilename: req.file.originalname,
        });

    } catch (error) {
        console.error('Upload processing error:', error);
        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlink(req.file.path, () => {});
        }
        res.status(500).json({
            error: 'Processing failed',
            details: error.message
        });
    }
});

module.exports = router;
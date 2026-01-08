const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const logger = require('morgan');
require('dotenv').config();
const cors = require('cors');
const rootDir = process.cwd();

const app = express();
app.use(cors());

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

const uploadRoutes = require('./routes/uploadRoutes');
const fileListRoutes = require('./routes/fileListRoutes');
const analysisRoutes = require('./routes/RequirementAnalysisRoutes');
const userStoryRoutes = require('./routes/userStoryRoutes');
const analysisHistoryRoutes = require('./routes/analysisHistoryRoutes');

app.use('/api', uploadRoutes);
app.use('/api', fileListRoutes);
app.use('/api', analysisRoutes);
app.use('/api', userStoryRoutes);
app.use('/api', analysisHistoryRoutes);

app.use('/outputs', express.static(path.join(rootDir, 'outputs')));
app.use('/audio', express.static(path.join(rootDir, 'public', 'audio')));
app.use('/transcriptions', express.static(path.join(rootDir, 'public', 'transcriptions')));
app.use('/analysis_outputs', express.static(path.join(rootDir, 'analysis_outputs')));
app.use('/user_stories_outputs', express.static(path.join(rootDir, 'user_stories_outputs')));

app.get('/', (req, res) => {
    res.json({
        message: 'LLM Project API is running!',
        endpoints: [
            'POST /api/upload',
            'POST /api/analyze',
            'POST /api/generate-user-stories',
            'GET /api/analysis-history'
        ]
    });
});

app.use((req, res, next) => {
    res.status(404).json({ error: 'Not Found' });
});

app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(err.status || 500).json({
        error: {
            message: err.message || 'Internal Server Error',
            ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
        }
    });
});

module.exports = app;
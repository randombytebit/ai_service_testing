const axios = require('axios');
const fs = require('fs');
const path = require('path');

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const MODEL = "x-ai/grok-4.1-fast";
const OUTPUT_DIR = path.join(__dirname, '..', '..', 'analysis_outputs');

const OUTPUT_BLOCK = `Project title: {title}

Functional Requirement
Role: User
Requirement ID: FR-{{id}}
Requirement Title: {{title}}
Requirement Description: {{desc}}
Accuracy: {{accuracy}}

Non-Functional Requirement
Role: User
Requirement ID: NFR-{{id}}
Requirement Title: {{title}}
Requirement Description: {{desc}}
Accuracy: {{accuracy}}`;

function createCOT6Prompt(documentContent, title) {
    return `You are an expert requirements analyst.
Define acceptance criteria, self-check completeness/consistency, then output **only** the blocks.

Title: ${title}

Document:
${documentContent}

${OUTPUT_BLOCK}`;
}

async function analyzeWithGrok(documentContent, title) {
    if (!OPENROUTER_API_KEY) {
        throw new Error('OPENROUTER_API_KEY is not configured in environment variables');
    }

    const prompt = createCOT6Prompt(documentContent, title);

    try {
        const response = await axios.post(
            'https://openrouter.ai/api/v1/chat/completions',
            {
                model: MODEL,
                messages: [{ role: 'user', content: prompt }],
                temperature: 0.0
            },
            {
                headers: {
                    'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
                    'Content-Type': 'application/json',
                    'HTTP-Referer': 'http://localhost:3000',
                    'X-Title': 'Requirements Analysis Tool'
                },
                timeout: 90000
            }
        );

        const analysisResult = response.data.choices[0].message.content.trim();

        return {
            prompt,
            analysis: analysisResult
        };
    } catch (error) {
        console.error('Grok API Error:', error.response?.data || error.message);
        throw new Error(`Grok analysis failed: ${error.response?.data?.error?.message || error.message}`);
    }
}

async function readFileContent(filePath) {
    const rootDir = path.join(__dirname, '..', '..');

    // Remove leading slash and construct full path
    let relativePath = filePath.replace(/^\//, '');

    // Map URL paths to actual file system paths
    if (relativePath.startsWith('transcriptions/')) {
        relativePath = path.join('public', relativePath);
    } else if (relativePath.startsWith('outputs/')) {
        // outputs/ is already correct
        relativePath = relativePath;
    }

    const fullPath = path.join(rootDir, relativePath);

    console.log('Attempting to read file:');
    console.log('  Original path:', filePath);
    console.log('  Relative path:', relativePath);
    console.log('  Full path:', fullPath);
    console.log('  File exists?', fs.existsSync(fullPath));

    if (!fs.existsSync(fullPath)) {
        throw new Error(`File not found: ${filePath}`);
    }

    const content = fs.readFileSync(fullPath, 'utf-8');
    console.log(`Loaded file: ${filePath} (${content.length} characters)`);
    return content.trim();
}

function saveAnalysisOutput(filename, title, prompt, analysis) {
    if (!fs.existsSync(OUTPUT_DIR)) {
        fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const cleanFilename = filename.replace(/\.[^/.]+$/, '');
    const outputFilename = `${cleanFilename}_${timestamp}.txt`;
    const outputPath = path.join(OUTPUT_DIR, outputFilename);

    const content = `ANALYSIS REPORT
${'='.repeat(80)}
Project Title: ${title}
Model: ${MODEL}
Timestamp: ${new Date().toLocaleString()}
Source File: ${filename}
${'='.repeat(80)}

PROMPT USED:
${'-'.repeat(80)}
${prompt}
${'-'.repeat(80)}

ANALYSIS RESULT:
${'-'.repeat(80)}
${analysis}
${'-'.repeat(80)}
`;

    fs.writeFileSync(outputPath, content, 'utf-8');
    console.log(`Saved analysis output: ${outputFilename}`);

    return {
        savedPath: outputPath,
        savedFilename: outputFilename,
        publicUrl: `/analysis_outputs/${outputFilename}`
    };
}

async function analyzeFiles(files, title) {
    const results = [];

    for (const filePath of files) {
        try {
            console.log(`Analyzing: ${filePath}`);
            const content = await readFileContent(filePath);
            const { prompt, analysis } = await analyzeWithGrok(content, title);

            const saveInfo = saveAnalysisOutput(
                path.basename(filePath),
                title,
                prompt,
                analysis
            );

            results.push({
                filename: path.basename(filePath),
                status: 'success',
                data: analysis,
                savedFile: saveInfo.savedFilename,
                downloadUrl: saveInfo.publicUrl
            });
        } catch (error) {
            console.error(`Error analyzing ${filePath}:`, error.message);
            results.push({
                filename: path.basename(filePath),
                status: 'error',
                error: error.message
            });
        }
    }

    return results;
}

module.exports = { analyzeFiles };
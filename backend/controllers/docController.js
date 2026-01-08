const path = require('path');
const fs = require('fs');
const { convertToPdf } = require('../models/docModel');

async function convertDoc(inputPath, originalFilename, ext) {
    const outputDir = path.join(__dirname, '../../outputs');
    fs.mkdirSync(outputDir, { recursive: true });

    const baseName = path.basename(originalFilename, path.extname(originalFilename));
    const pdfFilename = `${baseName}.pdf`;
    const outputPath = path.join(outputDir, pdfFilename);

    let pdfUrl = `/outputs/${pdfFilename}`;

    if (ext === '.pdf') {
        await fs.promises.rename(inputPath, outputPath);

        return {
            text: '',
            pdfUrl,
            pdfFilename,
        };
    } else {
        const result = await convertToPdf(inputPath, originalFilename);

        return {
            text: result.text || '',
            pdfUrl: result.pdfUrl || pdfUrl,
            pdfFilename: result.pdfFilename || pdfFilename,
        };
    }
}

module.exports = { convertDoc };
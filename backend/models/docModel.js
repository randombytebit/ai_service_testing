const path = require('path');
const fs = require('fs');
const docxConverter = require('docx-pdf');

async function convertToPdf(inputPath, originalFilename) {
    return new Promise((resolve, reject) => {
        // Define output folder (e.g., project_root/outputs/)
        const outputDir = path.join(__dirname, '../../outputs');
        fs.mkdirSync(outputDir, { recursive: true }); // create if not exists

        const baseName = path.basename(originalFilename, path.extname(originalFilename));
        const outputPath = path.join(outputDir, `${baseName}.pdf`);

        docxConverter(inputPath, outputPath, (err) => {
            if (err) {
                console.error('docx-pdf conversion error:', err);
                return reject(err);
            }

            resolve({
                pdfUrl: `/outputs/${path.basename(outputPath)}`, // URL for frontend download
                pdfFilename: path.basename(outputPath),
            });
        });
    });
}

module.exports = { convertToPdf };
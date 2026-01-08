const ffmpeg = require('fluent-ffmpeg');
const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');
const { pipeline } = require('@huggingface/transformers');
const fs = require('fs');
const path = require('path');
const { WaveFile } = require('wavefile');
const crypto = require('crypto');

ffmpeg.setFfmpegPath(ffmpegInstaller.path);

let whisper_transcriber = null;

async function getTranscriber() {
    if (!whisper_transcriber) {
        console.log('Model loading ...');
        whisper_transcriber = await pipeline('automatic-speech-recognition', 'Xenova/whisper-small', {
            quantized: true,
            progress_callback: (data) => console.log(`Loading: ${data.progress}% - ${data.status}`),
        });
        console.log('Model loaded !!!');
    }
    return whisper_transcriber;
}

async function preprocessAndTranscribe(inputPath, originalFilename) {
    // Generating Unique Filename
    const uniqueId = crypto.randomUUID();
    const cleanName = path.basename(originalFilename, path.extname(originalFilename));
    const savedMp3Filename = `${cleanName}_${uniqueId}.mp3`;
    const savedTxtFilename = `${cleanName}_${uniqueId}.txt`; // New TXT filename

    const savedMp3Path = path.join(__dirname, '../../public/audio', savedMp3Filename);
    const savedTxtPath = path.join(__dirname, '../../public/transcriptions', savedTxtFilename); // Adjust folder as needed
    const tempWavPath = path.join(__dirname, '../../temp', `temp_${uniqueId}.wav`);

    // Ensure the transcriptions directory exists
    const transcriptionsDir = path.join(__dirname, '../../public/transcriptions');
    if (!fs.existsSync(transcriptionsDir)) {
        fs.mkdirSync(transcriptionsDir, { recursive: true });
    }

    // Converting to high-quality MP3 and save permanently
    await new Promise((resolve, reject) => {
        ffmpeg(inputPath)
            .audioFrequency(16000)
            .audioChannels(1)
            .audioCodec('libmp3lame')
            .audioBitrate('128k')
            .format('mp3')
            .on('end', () => {
                console.log('Saved MP3 for user:', savedMp3Filename);
                resolve();
            })
            .on('error', reject)
            .save(savedMp3Path);
    });

    // Converting to WAV file for transcription
    await new Promise((resolve, reject) => {
        ffmpeg(inputPath)
            .audioFrequency(16000)
            .audioChannels(1)
            .audioCodec('pcm_s16le')
            .format('wav')
            .on('end', resolve)
            .on('error', reject)
            .save(tempWavPath);
    });

    // Load WAV and preprocess for Whisper
    const wavBuffer = fs.readFileSync(tempWavPath);
    const wav = new WaveFile(wavBuffer);
    wav.toBitDepth('32f');
    wav.toSampleRate(16000);
    let audioData = wav.getSamples();
    if (Array.isArray(audioData)) {
        if (audioData.length > 1) {
            const SCALING_FACTOR = Math.sqrt(2);
            for (let i = 0; i < audioData[0].length; i++) {
                audioData[0][i] = SCALING_FACTOR * (audioData[0][i] + audioData[1][i]) / 2;
            }
        }
        audioData = audioData[0];
    }

    // Transcribe using Whisper
    const model = await getTranscriber();
    const output = await model(audioData, {
        language: 'english',
        task: 'transcribe',
        chunk_length_s: 30,
        stride_length_s: 5,
    });

    const transcriptionText = output.text.trim();

    // Save transcription to .txt file
    fs.writeFileSync(savedTxtPath, transcriptionText, 'utf8');
    console.log('Saved transcription TXT:', savedTxtFilename);

    // Clean up temporary WAV file
    fs.unlinkSync(tempWavPath);

    // Return both MP3 and TXT info
    return {
        text: transcriptionText,
        mp3Filename: savedMp3Filename,
        audioUrl: `/audio/${savedMp3Filename}`,
        txtFilename: savedTxtFilename,
        transcriptionUrl: `/transcriptions/${savedTxtFilename}` // Public URL to access the TXT
    };
}

module.exports = { preprocessAndTranscribe };
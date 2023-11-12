const express = require('express');
const multer = require('multer');
const mongoose = require('mongoose');
const { Storage } = require('@google-cloud/storage');
const speech = require('@google-cloud/speech');
const language = require('@google-cloud/language');

const app = express();

mongoose.connect('mongodb://localhost/birds', { useNewUrlParser: true });

const upload = multer({ dest: 'uploads/' });

const BirdSoundSchema = new mongoose.Schema({
    name: String ,
    audioFile: Buffer,
    likes: Number,
});

const BirdSound = mongoose.model('BirdSound', BirdSoundSchema);

const storage = new Storage({
    projectId: 'new1-404909',
    keyFilename: 'keyfile_storage.json',
});

const speechClient = new speech.SpeechClient({
    projectId: 'new1-404909',
    keyFilename: 'keyfile_speech.json',
});

const languageClient = new language.LanguageServiceClient({
    projectId: 'new1-404909',
    keyFilename: 'keyfile_lang.json',
});

app.get('/', (req, res) => {
    res.render('index');
});

app.post('/upload', upload.single('audio'), async (req, res) => {
    const bucketName = 'bird-sound';
    const filename = req.file.originalname;
    const blob = storage.bucket(bucketName).file(filename);
    await blob.save(req.file.buffer);

    const config = {
        encoding: 'LINEAR16',
        sampleRateHertz: 16000,
        languageCode: 'en-US',
    };
    const audio = {
        content: req.file.buffer.toString('base64'),
    };
    const response = await speechClient.recognize(config, audio);
    const transcription = response[0].results[0].alternatives[0].transcript;

    const document = {
        content: transcription,
        type: 'PLAIN_TEXT',
    };
    const entities = await languageClient.analyzeEntities({ document });

    const birdKeywords = ['bird', 'chirp', 'tweet', 'song'];
    const hasBirdKeyword = entities.entities.some((entity) => {
        return birdKeywords.includes(entity.name.toLowerCase());
    });

    if (hasBirdKeyword) {
        const birdSound = new BirdSound({
            name: req.file.originalname,
            audioFile: req.file.buffer,
            likes: 0,
        });
        await birdSound.save();
    }

    res.redirect('/');
});

app.get('/like/:id', async (req, res) => {
    const birdSound = await BirdSound.findById(req.params.id);

    birdSound.likes++;
    await birdSound.save();

    res.redirect('/');
});

app.listen(80);
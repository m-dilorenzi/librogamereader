
let express = require('express'),
  bodyParser = require('body-parser'),
  port = process.env.PORT || 8080,
  parser = require('fast-xml-parser'),
  fs = require('fs'),
  path = require('path'),
  app = express();

var database_connection = require('./database_connection');

const fileNamePath = "./04.XML";
let alexaVerifier = require('alexa-verifier');
const { eventNames } = require('process');

app.listen(port);

console.log('Server is listening on port: ' + port);

const allChapters = convertToJson();

const SKILL_NAME = 'LibroGameReader';
const PAUSE = '<break time="0.3s" />'
const WHISPER = '<amazon:effect name="whispered"/>'

app.use(bodyParser.json({
    verify: function getRawBody(req, res, buf) {
        req.rawBody = buf.toString();
    }
}));

function requestVerifier(req, res, next) {
    alexaVerifier(
        req.headers.signaturecertchainurl,
        req.headers.signature,
        req.rawBody,
        function verificationCallback(err) {
        if (err) {
            res.status(401).json({
            message: 'Verification Failure',
            error: err
            });
        } else {
            next();
        }
        }
    );
}

function log() {
    if (true) {
        console.log.apply(console, arguments);
    }
}

app.post('/', requestVerifier, async function(req, res) {

    var id_request = req.body.session.user.userId;
    console.log('Richiesta da utente: '+id_request);
    var actual_chapter = await database_connection.getActualChapter(id_request)
    console.log('Ultimo capitolo letto: ' + actual_chapter);

    process.env.ACTUAL_CHAPTER = actual_chapter; 

    if (req.body.request.type === 'LaunchRequest') 
    {
        console.log('Open the skill...');
        res.json(helloMessage());
    } else if (req.body.request.type === 'SessionEndedRequest') 
    { 
        log('Session end...');
    } else if (req.body.request.type === 'IntentRequest') {
        switch (req.body.request.intent.name) 
        {
            case 'AMAZON.StopIntent':
                console.log('Exit from the skill...')
                res.json(stopAndExit());
                break;
            
            case 'getNextChapterIntent':
                console.log('Get new chapter...');
                var chapter = req.body.request.intent.slots.capitolo.value;
                res.json(getNewChapter(chapter, id_request));
                break;
            case 'readAgainIntent':
                console.log('Read again last chapter...');
                res.json(readAgainChapter(process.env.ACTUAL_CHAPTER));
                break;
            

            default:
        }
    }
});


function stopAndExit() 
{
    const speechOutput = 'Ciao, buona giornata e torna presto!';
    var jsonObj = buildResponse(speechOutput, true, '');
    return jsonObj;
}


function getNewChapter(chapter, id_request) 
{
    const allChapters = convertToJson();
    console.log('Try to get chapter...'+chapter);
    
    if(process.env.ACTUAL_CHAPTER != 0)
    { 
        if((chapter != process.env.ACTUAL_CHAPTER))
        {
            if(allChapters.chapters.chapter[(process.env.ACTUAL_CHAPTER-1)].nextChapters.nextChapter.length == undefined)
                var length = 1;
            else
                var length = allChapters.chapters.chapter[(process.env.ACTUAL_CHAPTER-1)].nextChapters.nextChapter.length;

            if(length != 1)
            {
                for(var i = 0; i < length; i++)
                {
                    if(chapter == allChapters.chapters.chapter[(process.env.ACTUAL_CHAPTER-1)].nextChapters.nextChapter[i])
                    {
                        process.env.ACTUAL_CHAPTER = chapter;
                        updateActualChapter(id_request, chapter);
                        var chapterToRead = allChapters.chapters.chapter[(process.env.ACTUAL_CHAPTER-1)].description;
                        const speechOutput = WHISPER + chapterToRead + PAUSE;
                        return buildResponseWithRepromt(speechOutput, false, '', '');
                    }
                }
                var speechOutput = 'Puoi proseguire solamente andando ai capitoli: ';
                for(var i = 0; i < length; i++)
                {
                    speechOutput += allChapters.chapters.chapter[(process.env.ACTUAL_CHAPTER-1)].nextChapters.nextChapter[i]+ ' ';
                }
                return buildResponseWithRepromt(speechOutput, false, '', '');
            }
            else
            {
                if(chapter == allChapters.chapters.chapter[(process.env.ACTUAL_CHAPTER-1)].nextChapters.nextChapter)
                {
                    process.env.ACTUAL_CHAPTER = chapter;
                    updateActualChapter(id_request, chapter);
                    var chapterToRead = allChapters.chapters.chapter[(process.env.ACTUAL_CHAPTER-1)].description;
                    const speechOutput = WHISPER + chapterToRead + PAUSE;
                    return buildResponseWithRepromt(speechOutput, false, '', '');
                }
                var speechOutput = 'Puoi proseguire solamente andando ai capitoli: '+allChapters.chapters.chapter[(process.env.ACTUAL_CHAPTER-1)].nextChapters.nextChapter;
                return buildResponseWithRepromt(speechOutput, false, '', '');
            }
        }
        else
        {  
            const speechOutput = 'Ti trovi già al capitolo '+chapter;
            return buildResponseWithRepromt(speechOutput, false, '', '');            
        }
    }
    else
    {
        if(chapter == 1)
        {
            process.env.ACTUAL_CHAPTER = chapter;
            updateActualChapter(id_request, chapter);
            var chapterToRead = allChapters.chapters.chapter[(chapter-1)].description;
            const speechOutput = WHISPER + chapterToRead + PAUSE;
            return buildResponseWithRepromt(speechOutput, false, '', '');   
        }
        else
        {
            const speechOutput = WHISPER + 'devi iniziare la lettura dal capitolo 1' + PAUSE;
            return buildResponseWithRepromt(speechOutput, false, '', '');
        }
    }
}

function readAgainChapter(chapter)
{
    const allChapters = convertToJson();
    console.log('Read again chapter '+chapter+'...');
    var chapterToRead = allChapters.chapters.chapter[(chapter-1)].description;
    const speechOutput = WHISPER + chapterToRead + PAUSE;
    return buildResponseWithRepromt(speechOutput, false, '', '');
}

function helloMessage()
{
    var speechOutput  = 'Ciao! Benvenuto su Libro Game Reader! Con questa skill potrai \
                        interagire con un libro gioco in maniera dinamica!';
    if(process.env.ACTUAL_CHAPTER == 0)
        speechOutput += ' Inizia ora a leggere il libro The Chasm of Doom, il quarto capitolo della \
        famosa serie Lupo Solitario! Pronuncia vai al capitolo 1 per iniziare la lettura!';
    else
        speechOutput += ' Riprendi la lettura dal capitolo '+process.env.ACTUAL_CHAPTER+'. Pronuncia rileggi\
        per riascoltarlo.';
    
    var jsonObj = buildResponseWithRepromt(speechOutput, false, '', '');
    return jsonObj;
}

function buildResponse(speechText, shouldEndSession, cardText) {

    const speechOutput = "<speak>" + speechText + "</speak>"
    var jsonObj = {
        "version": "1.0",
        "response": {
        "shouldEndSession": shouldEndSession,
        "outputSpeech": {
            "type": "SSML",
            "ssml": speechOutput
        },
        "card": {
            "type": "Simple",
            "title": SKILL_NAME,
            "content": cardText,
            "text": cardText
        }
        }
    }
    return jsonObj;
}

function buildResponseWithRepromt(speechText, shouldEndSession, cardText, reprompt) 
{
    const speechOutput = "<speak>" + speechText + "</speak>"
    var jsonObj = {
        "version": "1.0",
        "response": {
        "shouldEndSession": shouldEndSession,
        "outputSpeech": {
            "type": "SSML",
            "ssml": speechOutput
        },
        "card": {
        "type": "Simple",
        "title": SKILL_NAME,
        "content": cardText,
        "text": cardText
        },
        "reprompt": {
            "outputSpeech": {
                "type": "PlainText",
                "text": reprompt,
                "ssml": reprompt
            }
        }
    }
    }
    return jsonObj;
}

function convertToJson()
{
    const xmlData = fs.readFileSync(fileNamePath).toString();
    return parser.parse(xmlData);
}

function updateActualChapter(user_id, chapter)
{
    var queryString = 'UPDATE lastvisitedchapter SET actual_chapter = '+chapter+' WHERE user_id=\''+user_id+'\';';
    database_connection.pool.query(queryString, function(error) {
        if (error) {
            console.log(error);
            response.status(400).send(error);
        }
    });
}
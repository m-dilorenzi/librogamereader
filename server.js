
let express = require('express'),
  bodyParser = require('body-parser'),
  port = process.env.PORT || 8080,
  parser = require('fast-xml-parser'),
  fs = require('fs'),
  path = require('path'),
  app = express();

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

app.post('/', requestVerifier, function(req, res) {

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
                res.json(getNewChapter(chapter));
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


function getNewChapter(chapter) 
{
    const allChapters = convertToJson();
    console.log('Try to get chapter...'+chapter);
    if(process.env.ACTUAL_CHAPTER == 0)
        console.log('Possible next chapters: 1');
    else
        console.log('Possible next chapter: '+allChapters.chapters.chapter[(process.env.ACTUAL_CHAPTER-1)].nextChapters.nextChapter);
    
    if(process.env.ACTUAL_CHAPTER != 0)
    {
        if((chapter != process.env.ACTUAL_CHAPTER) && allChapters.chapters.chapter[(process.env.ACTUAL_CHAPTER-1)].nextChapters.nextChapter.includes(chapter) == true)
        {
            
            process.env.ACTUAL_CHAPTER = chapter;
            var chapterToRead = allChapters.chapters.chapter[(chapter-1)].description;
            const speechOutput = WHISPER + chapterToRead + PAUSE;
            return buildResponseWithRepromt(speechOutput, false, '', '');
            
        }
        else
        {
            var speechOutput = 'I capitoli con cui puoi proseguire sono ';
            for(var i = 0; i < allChapters.chapters.chapter[(process.env.ACTUAL_CHAPTER-1)].nextChapters.nextChapter.lenght; i++)
            {
                speechOutput += allChapters.chapters.chapter[(process.env.ACTUAL_CHAPTER-1)].nextChapters.nextChapter[i]+' ';
            }
            return buildResponseWithRepromt(speechOutput, false, '', '');
            
            if(chapter == process.env.ACTUAL_CHAPTER)
            {
                const speechOutput = 'Ti trovi già al capitolo '+chapter;
                return buildResponseWithRepromt(speechOutput, false, '', '');
            }
            else
            {
                const speechOutput = 'Non puoi proseguire andando al capitolo '+chapter;
                return buildResponseWithRepromt(speechOutput, false, '', '');
            }
            
        }
    }
    else
    {
        if(chapter == 1)
        {
            process.env.ACTUAL_CHAPTER = chapter;
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
    // console.log(jsonObj.chapters.chapter[0]);
}

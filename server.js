
let express = require('express'),
  bodyParser = require('body-parser'),
  port = process.env.PORT || 8080,
  app = express();
let alexaVerifier = require('alexa-verifier');

app.listen(port);

console.log('Server is listening on port: ' + port);

var isFisrtTime = true;

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

    // console.log(req);

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
    const speechOutput = WHISPER + ' qua ti leggerò il capitolo '+ chapter +' del tuo libro' + PAUSE;
    return buildResponseWithRepromt(speechOutput, false, '', '');
}

function helloMessage()
{
    const speechOutput  = 'Ciao! Benvenuto su LibreGameReader! Con questa skill potrai \
                        interagire con un libro gioco in maniera dinamica!';
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


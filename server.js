
let express = require('express'),
  bodyParser = require('body-parser'),
  port = process.env.PORT || 8080,
  app = express();
let alexaVerifier = require('alexa-verifier');

app.listen(port);

console.log('Server is listening on port: ' + port);

var isFisrtTime = true;

const SKILL_NAME = 'LibroGameReader';
const HELP_MESSAGE = 'Ora puoi implementare la vera struttura!';
const STOP_MESSAGE = 'Ciao, alla prossima!';
const PAUSE = '<break time="0.3s" />'
const WHISPER = '<amazon:effect name="whispered"/>'
const HELP_REPROMPT = 'What can I help you with?';

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

    if (req.body.request.type === 'LaunchRequest') {
        res.json(getNewChapter());
        isFisrtTime = false
    } else if (req.body.request.type === 'SessionEndedRequest') { /* ... */
        log("Session End")
    } else if (req.body.request.type === 'IntentRequest') {
        switch (req.body.request.intent.name) {
        case 'AMAZON.YesIntent':
            res.json(getNewChapter());
            break;
        case 'AMAZON.NoIntent':
            res.json(stopAndExit());
            break;
        case 'AMAZON.HelpIntent':
            res.json(help());
            break;
        default:

        }
    }
});

function handleDataMissing() 
{
     // return buildResponse(MISSING_DETAILS, true, null)
}

function stopAndExit() 
{
    const speechOutput = STOP_MESSAGE
    var jsonObj = buildResponse(speechOutput, true, "");
    isFisrtTime = true;
    return jsonObj;
}

function help() 
{
    const speechOutput = HELP_MESSAGE
    const reprompt = HELP_REPROMPT
    var jsonObj = buildResponseWithRepromt(speechOutput, false, "", reprompt);

    return jsonObj;
}

function getNewChapter() 
{
    console.log('Try to obtain new chapter');
    var welcomeSpeechOutput = 'Benvenuto su libro game reader! <break time="0.3s" />'
    if (!isFisrtTime) {
        welcomeSpeechOutput = '';
    }

    const tempOutput = WHISPER + HELP_MESSAGE + PAUSE;
    const speechOutput = welcomeSpeechOutput + tempOutput;
    
    return buildResponseWithRepromt(speechOutput, false, HELP_MESSAGE, '');
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


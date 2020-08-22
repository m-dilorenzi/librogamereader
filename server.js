// import modules
let express = require('express'),
  bodyParser = require('body-parser'),
  parser = require('fast-xml-parser'),
  fs = require('fs'),
  path = require('path'),
  app = express();

// import module used for checking Alexa requests
let alexaVerifier = require('alexa-verifier');
const { eventNames } = require('process');

// get database connection manager from external file
var database_connection = require('./database_connection');

// get by path the .XML file containing data 
const fileNamePath = "./04.XML";

// set the app entry point on the determinated port
let port = process.env.PORT || 8080;
app.listen(port);

console.log('Server is listening on port: ' + port);

// get all chapters from the .XML file
const allChapters = convertToJson();

// set values to build the Alexa skill response
const SKILL_NAME = 'LibroGameReader';
const PAUSE = '<break time="0.3s" />'
const WHISPER = '<amazon:effect name="whispered"/>'

// specify the system to use the JSON data format and get the body
// of the request
app.use(bodyParser.json({
    verify: function getRawBody(req, res, buf) {
        req.rawBody = buf.toString();
    }
}));

// function used to check if the request is actually from
// Alexa. This verification is required, if the developer 
// doesn't verify it, an error occurs. If the verification
// goes right, the function does nothing, otherwise notifies
// an error.
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

// entry point where all requests arrives
app.post('/', requestVerifier, async function(req, res) {

    // get the user unique id request. It will be used to
    // store the book progress in the Postgres database
    var id_request = req.body.session.user.userId;
    console.log('Richiesta da utente: '+id_request);

    // get all users already registered to the database
    var allUsers        = await database_connection.getAllUsers();

    // check if user is already registered to the database
    if(checkUsers(allUsers, id_request) == true)
    {
        // user already registered
        var actual_chapter  = await database_connection.getActualChapter(id_request);
        var last_chapter    = await database_connection.getLastChapter(id_request);
    }else{
        // new user
        var actual_chapter  = 0;
        var last_chapter    = 0;
    }

    // debug log used to verify the correctness of data 
    console.log('Penultimo capitolo letto: ' + last_chapter);    
    console.log('Ultimo capitolo letto:    ' + actual_chapter);
    process.env.ACTUAL_CHAPTER = actual_chapter; 


    // check what type of request the web service received
    if (req.body.request.type === 'LaunchRequest') 
    {
        // user opens the skill 
        console.log('Open the skill...');
        res.json(helloMessage());
    } else if (req.body.request.type === 'SessionEndedRequest') 
    {   
        // the skill will be closed directly from Alexa
        console.log('Session end...');
    } else if (req.body.request.type === 'IntentRequest') {

        switch (req.body.request.intent.name) 
        {
            case 'AMAZON.StopIntent':
                // user wants to close the skill
                console.log('Exit from the skill...')
                res.json(stopAndExit());
                break;
  
            case 'getNextChapterIntent':
                // user wants to get a new chapter
                console.log('Get new chapter...');
                var chapter = req.body.request.intent.slots.capitolo.value;
                res.json(getNewChapter(chapter, id_request));
                break;
            
            case 'getLastChapterIntent':
                // user wants to go back to the penultimate chapter he read
                // if the user is reading the first chapter or or he has yet 
                // to start reading the book, an error will be notified by Alexa
                if(process.env.ACTUAL_CHAPTER == 0 || process.env.ACTUAL_CHAPTER == 1)
                {
                    var speechOutput = 'Non puoi tornare al capitolo precedente!';
                    res.json(buildResponseWithRepromt(speechOutput, false, '', ''));
                }
                else{
                    res.json(getLastChapter(last_chapter, id_request));
                }
                break;
            
            case 'readAgainIntent':
                // user wants to read again the actual chapter
                console.log('Read again last chapter...');
                res.json(readAgainChapter(process.env.ACTUAL_CHAPTER));
                break;

            case 'getRandomNumberIntent':
                // user wants to get a random number in a specified interval
                console.log('Get random number...');
                var numInf = req.body.request.intent.slots.numInf.value;
                var numSup = req.body.request.intent.slots.numSup.value;
                res.json(getRandomNumber(numInf, numSup));
                break;
            
            case 'restartBookIntent':
                // the user wants to start reading the book all over again
                console.log('Restart book...');
                res.json(restartBook(1, id_request));
                break;

            default:
        }
    }
});

// function used to check if the user that made the request is already registered
// to the database. If it is already registered, it return 'true', otherwise, it
// returns 'false' and the new user is added to the database by the function
// addUser() 
function checkUsers(allUsers, id_request)
{
    var i;
    var exists = 0;
    for(var i = 0; i < allUsers.length; i++)
    {
        if(allUsers[i].user_id == id_request)
        {
            console.log('User already connected...');
            exists = 1;
        }
    }
    if(exists == 0)
    {
        addUser(id_request);
        return false;
    }else{
        return true;
    }
}

// function used to add the new user with his unique id_request to the database
// by performing an SQL query using the database_connection variable 
function addUser(id_request)
{
    console.log('Add new user...');
    var queryString = 'INSERT INTO lastvisitedchapter VALUES (\''+id_request+'\', 0, 0);';
    database_connection.pool.query(queryString, function(error) {
        if (error) {
            console.log(error);
            response.status(400).send(error);
        }
    });
}

// function used whem the user wants to quit the skill
function stopAndExit() 
{
    const speechOutput = 'Ciao, buona giornata e torna presto!';
    var jsonObj = buildResponse(speechOutput, true, '');
    return jsonObj;
}

// function used when the user wants to get a random number
// in the specified interval [numInf, numSup] 
function getRandomNumber(numInf, numSup)
{
    var number = Math.floor(Math.random() * (Number(numSup) - Number(numInf) + 1)) + Number(numInf);
    const speechOutput = WHISPER + 'Il tuo numero casuale tra ' + numInf + ' e ' + numSup + ' è ' + number;
    return buildResponseWithRepromt(speechOutput, false, '', '');
}

// function used when the user wants to get the penultimate chapter
function getLastChapter(chapter, id_request)
{
    const allChapters = convertToJson();
    process.env.ACTUAL_CHAPTER = chapter;
    // update into the database the actual chapter which will be the
    // penultimate chapter
    updateActualChapter(id_request, process.env.ACTUAL_CHAPTER);
    var chapterToRead = allChapters.chapters.chapter[(process.env.ACTUAL_CHAPTER-1)].description;
    const speechOutput = WHISPER + chapterToRead + PAUSE;
    return buildResponseWithRepromt(speechOutput, false, '', '');
}

// function used when the user wants to reading the book all over again
function restartBook(chapter, id_request)
{
    const allChapters = convertToJson();
    process.env.ACTUAL_CHAPTER = chapter;
    // update into the database the actual chapter which will be
    // the chapter number 1
    updateActualChapter(id_request, chapter);
    var chapterToRead = allChapters.chapters.chapter[(chapter-1)].description;
    const speechOutput = WHISPER + chapterToRead + PAUSE;
    return buildResponseWithRepromt(speechOutput, false, '', '');
}

// function used when the user wants to read again the actual chapter 
function readAgainChapter(chapter)
{
    const allChapters = convertToJson();
    console.log('Read again chapter '+chapter+'...');
    var chapterToRead = allChapters.chapters.chapter[(chapter-1)].description;
    const speechOutput = WHISPER + chapterToRead + PAUSE;
    return buildResponseWithRepromt(speechOutput, false, '', '');
}

// function used when the user open the skill. Tell the user what he can do
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

// function used to build the response send to Alexa. This function builds
// a response, and after Alexa has read it, the skill will be closed.
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

// function used to build the response send to Alexa. This function builds
// a response, and after Alexa has read it, the skill will remain open and the
// user will be able to specify other commands.
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

// function used to convert XML data to JSON object, which will be used
// to get data more easily. Return a JSON object.
function convertToJson()
{
    const xmlData = fs.readFileSync(fileNamePath).toString();
    return parser.parse(xmlData);
}

// function used to update the actual chapter into the Postgres database
// by performing a query with the database_connection variable
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

// function used to update the penultimate chapter into the Postgres database
// by performing a query with the database_connection variable
function updateLastChapter(user_id, chapter)
{
    var queryString = 'UPDATE lastvisitedchapter SET last_chapter = '+chapter+' WHERE user_id=\''+user_id+'\';';
    database_connection.pool.query(queryString, function(error) {
        if (error) {
            console.log(error);
            response.status(400).send(error);
        }
    });
}

// function used when the user wants to get a new chapter. The function checks
// if the specified chapter choosed by the user could be reached from the actual chapter.
// If the chapter can't be reached, Alexa tells the user which chapters can
// be reached.
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
                        updateLastChapter(id_request, process.env.ACTUAL_CHAPTER);
                        process.env.ACTUAL_CHAPTER = chapter;
                        updateActualChapter(id_request, chapter);
                        var chapterToRead = allChapters.chapters.chapter[(process.env.ACTUAL_CHAPTER-1)].description;
                        if(allChapters.chapters.chapter[(process.env.ACTUAL_CHAPTER-1)].flag_death == true)
                        { 
                            chapterToRead += ' Purtroppo non sei riuscito a concludere la tua avventura. Ricomincia il \
                            tuo percorso e scegli una strada diversa pronunciando ricomincia dall\'inizio!';
                            updateActualChapter(id_request, 0);
                            updateLastChapter(id_request, 0);
                        }
                        if(allChapters.chapters.chapter[(process.env.ACTUAL_CHAPTER-1)].flag_final == true)
                        { 
                            chapterToRead += ' Complimenti! Sei uscito vittorioso dalla tua avventura! Pronuncia stop per uscire dalla skill\
                            oppure prununcia ricomincia dal\'inizio per ricominciare la tua avventura percorrendo una strada diversa!';
                            updateActualChapter(id_request, 0);
                            updateLastChapter(id_request, 0);
                        }
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
                    updateLastChapter(id_request, process.env.ACTUAL_CHAPTER);
                    process.env.ACTUAL_CHAPTER = chapter;
                    updateActualChapter(id_request, chapter);
                    var chapterToRead = allChapters.chapters.chapter[(process.env.ACTUAL_CHAPTER-1)].description;
                    const speechOutput = WHISPER + chapterToRead + PAUSE;
                    if(allChapters.chapters.chapter[(process.env.ACTUAL_CHAPTER-1)].flag_death == true)
                    { 
                        chapterToRead += ' Purtroppo non sei riuscito a concludere la tua avventura. Ricomincia il \
                        tuo percorso e scegli una strada diversa pronunciando ricomincia dall\'inizio!';
                        updateActualChapter(id_request, 0);
                        updateLastChapter(id_request, 0);
                    }
                    if(allChapters.chapters.chapter[(process.env.ACTUAL_CHAPTER-1)].flag_final == true)
                    { 
                        chapterToRead += ' Complimenti! Sei uscito vittorioso dalla tua avventura! Pronuncia stop per uscire dalla skill\
                        oppure prununcia ricomincia dal\'inizio per ricominciare la tua avventura percorrendo una strada diversa!';
                        updateActualChapter(id_request, 0);
                        updateLastChapter(id_request, 0);
                    }
                    return buildResponseWithRepromt(speechOutput, false, '', '');
                }
                var speechOutput = 'Puoi proseguire solamente andando al capitolo: '+allChapters.chapters.chapter[(process.env.ACTUAL_CHAPTER-1)].nextChapters.nextChapter;
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
            updateLastChapter(id_request, 0);
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
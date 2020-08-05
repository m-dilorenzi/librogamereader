const express = require('express');
const { ExpressAdapter } = require('ask-sdk-express-adapter');

const app = express();
const skillBuilder = Alexa.SkillBuilders.custom();
const skill = skillBuilder.create();
const adapter = new ExpressAdapter(skill, true, true);

const PORT      = process.env.PORT;
const listener  = server.listen(PORT, () =>
    console.log(`The server is listening on port: ${listener.address().port}`)
);

app.post('/', adapter.getRequestHandlers(), function(req, res){
    console.log(req);
});

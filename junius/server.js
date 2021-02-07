var express = require('express');
var session = require('express-session');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var morgan = require('morgan');
var app = express();
const path = require("path");
var port = process.env.PORT || 8080;
var AWS = require("aws-sdk");
const DynamoDBStore = require('dynamodb-store');

var passport = require('passport');
var flash = require('connect-flash');

require('./config/passport')(passport);


app.use('/css',express.static(path.join(__dirname, '/public/css')));
app.use('/img',express.static(path.join(__dirname, '/public/img')));
app.use('/js',express.static(path.join(__dirname, '/public/js')));
app.use('/scss',express.static(path.join(__dirname, '/public/scss')));
app.use('/vendor',express.static(path.join(__dirname, '/public/vendor')));

app.use(morgan('dev'));
app.use(cookieParser());
app.use(bodyParser.urlencoded({
 extended: true
}));

app.set('view engine', 'ejs');


app.use(session({
 secret: 'justasecret',
 resave:true,
 saveUninitialized: true,
 store: new DynamoDBStore({
    table: {
        name: "sessions",
        hashKey: "id",
        hashPrefix: "",
        readCapacityUnits: 5,
        writeCapacityUnits: 5
    },
        dynamoConfig: {
          accessKeyId: '',
          secretAccessKey: '',
        region: "ap-southeast-1",
        endpoint: "http://dynamodb.ap-southeast-1.amazonaws.com"
    },
    keepExpired: false,
    touchInterval: 30000,
    ttl: 600000
  })
}));

app.use(passport.initialize());
app.use(passport.session());
app.use(flash());

require('./app/routes.js')(app, passport);



app.listen(port);
console.log("Port: " + port);

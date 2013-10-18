var express = require('express')
  , uuid = require('node-uuid')
  , connect = require('connect')
  , url = require('url')
  , engine = require('ejs-locals')
  , mysql = require('mysql')
  , _ = require('underscore')
  , moment = require('moment')
;

// Bus settings, modify this if need other kind
var settings = {};
settings.endpoint = "http://sbtest00.herokuapp.com/location";
settings.buses = [{"id": 201, "name": "France"},
		  {"id": 202, "name": "Germany"},
		  {"id": 203, "name": "Italy"},
		  {"id": 204, "name": "Netherlands"},
		  {"id": 205, "name": "Spain"},
		  {"id": 206, "name": "United Kingdom"},
		  {"id": 999, "name": "Taiwan"}
		 ];
settings.total = {"endpoint": settings.endpoint, "buses": settings.buses};

// Other settings
var tracking_table = process.env.MYSQL_TABLE
  , tokens = process.env.TOKENS.split(",")
;

// Set up database connection
var connection = mysql.createConnection({
  host     : process.env.MYSQL_HOST,
  user     : process.env.MYSQL_USER,
  password : process.env.MYSQL_PASS,
  database : process.env.MYSQL_DB
});
connection.connect(function(err) {
  if (err) {
      console.log(err);
      console.log("No connection, data won't be saved!");
  } else {
      console.log("Connected to backend database.");
  }
});


var app = express()
  , http = require('http')
  , server = http.createServer(app)
  , io = require('socket.io').listen(server)
;

// Can't do Websockets on Heroku, and failing with that?
io.configure(function () {
  io.set("transports", ["xhr-polling"]);
  io.set("polling duration", 10);
});

app.engine('ejs', engine);
app.set('views',__dirname + '/views');
app.set('view engine', 'ejs');
app.locals({
  _layoutFile: false
});

app.use(express.logger());
app.use(express.static('public'));
app.use(express.bodyParser());
app.use(express.cookieParser());
app.use(express.session({secret: process.env.SESSION_SECRET || 'akjsfkjs345$%VFDVGT%'}));
app.use(express.errorHandler());


var socket = io;

// Show frontend with basic map and incoming data
app.get('/', function(request, response) {
    var socket_id = uuid();

    response.render('home.ejs', {
	  layout: false,
          socket_id: socket_id,
          mapkey: process.env.GOOGLE_MAPS_KEY
        });

});

//Test socket.io by sending a random integer to the front interface
app.get('/test', function(request, response) {
  response.send('OK!');
  var randomnumber=Math.floor(Math.random()*11);
  socket.sockets.send(JSON.stringify({ my: 'data' , num: randomnumber}));
});

// Handle incoming data
app.post('/location', function(request, response) {
    var url_parts = url.parse(request.url, true);
    var query = url_parts.query;
    var data = request.body;
    // var retdata = {"data": data, "URLparams": query};

    var thistoken = query.oauth_token;
    var goodtoken = _.contains(tokens, thistoken);

    if (goodtoken) {
	savelog(data);
    };

    var retdata = {"data": data, "goodtoken": goodtoken};
    socket.sockets.send(JSON.stringify(retdata));
    response.send({result: 'okay'});
});

var savelog = function(data) {
    var locations = data.locations;
    for (var i = 0; i < locations.length; i++) {
	loc = locations[i]
	post  = {bus_id: loc.bus_id,
		 timestamp: moment(loc.sampled_at).unix(),
		 latitude: parseFloat(loc.latitude),
		 longitude: parseFloat(loc.longitude),
		};
	console.log(post);
	var query = connection.query('INSERT INTO '+tracking_table+' SET ?', post, function(err, result) {
	    // Done!
	});
	console.log(query.sql);
    }
};

// Distribute logging configuration
app.get('/logconf', function(request, response) {
  response.send(settings.total);
});

var port = process.env.PORT || 3000;
server.listen(port, function() {
  console.log("Listening on " + port);
});

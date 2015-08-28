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
settings.buses = [{"id": 2442, "name": "Belgium"},
		  {"id": 2435, "name": "Estonia"},
		  {"id": 2404, "name": "Germany"},
		  {"id": 2436, "name": "Italy"},
		  {"id": 2460, "name": "United Kingdom"},
		  {"id": 9999, "name": "Test!"}
		 ];
settings.total = {"endpoint": settings.endpoint, "buses": settings.buses};

// Other settings
var tracking_table = process.env.MYSQL_TABLE
  , tokens = process.env.TOKENS.split(",")
;
var db_config = {
  host     : process.env.MYSQL_HOST,
  user     : process.env.MYSQL_USER,
  password : process.env.MYSQL_PASS,
  database : process.env.MYSQL_DB
};

// Set up database connection
var connection;

// Handle disconnects, from https://github.com/felixge/node-mysql
function handleDisconnect() {
  connection = mysql.createConnection(db_config); // Recreate the connection, since
                                                  // the old one cannot be reused.

  connection.connect(function(err) {              // The server is either down
    if(err) {                                     // or restarting (takes a while sometimes).
      if(err.code === 'PROTOCOL_CONNECTION_LOST') {
        console.log('db reconnecting after idle timeout or server restart');
      } else {
        console.log('error when connecting to db:', err);
      }
      setTimeout(handleDisconnect, 2000); // We introduce a delay before attempting to reconnect,
    }                                     // to avoid a hot loop, and to allow our node script to
  });                                     // process asynchronous requests in the meantime.
                                          // If you're also serving http, display a 503 error.
  connection.on('error', function(err) {
    // Connection to the MySQL server is usually
    // lost due to either server restart, or a
    // connnection idle timeout (the wait_timeout
    // server variable configures this)
    // Silently
    if(err.code === 'PROTOCOL_CONNECTION_LOST') {
      console.log('db reconnecting after idle timeout or server restart');
      handleDisconnect();
    } else {
      console.log('db error', err);
      throw err;
    }
  });
}
handleDisconnect();

function dbKeepAlive() {
    connection.query('SELECT * FROM '+tracking_table+' LIMIT 1', function(err, result) {
        if (err) {
	   console.log("Keepalive query error: "+err);
        } else {
           console.log("Keepalive successful");
	}
    });
    setTimeout(dbKeepAlive, 45000);
}
dbKeepAlive();

var app = express()
  , http = require('http')
  , server = http.createServer(app)
  , io = require('socket.io').listen(server, { log: false })
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
	loc = locations[i];
	post  = {bus_id: loc.bus_id,
		 timestamp: moment(loc.sampled_at).unix(),
		 latitude: parseFloat(loc.latitude),
		 longitude: parseFloat(loc.longitude)
		};
	console.log(post);
	var query = connection.query('INSERT INTO '+tracking_table+' SET ?', post, function(err, result) {
	    if (err) {
		console.log("Log insert error: "+err);
	    }
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

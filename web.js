var express = require('express')
  , uuid = require('node-uuid')
  , connect = require('connect')
  , url = require('url')
  , engine = require('ejs-locals')
;


var app = express()
  , http = require('http')
  , server = http.createServer(app)
  , io = require('socket.io').listen(server)
;


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

app.get('/', function(request, response) {
    var socket_id = uuid();

    response.render('home.ejs', {
	  layout: false,
          socket_id: socket_id,
          mapkey: process.env.GOOGLE_MAPS_KEY
        });

});

app.get('/test', function(request, response) {
  response.send('OK!');
  var randomnumber=Math.floor(Math.random()*11);
  socket.sockets.send(JSON.stringify({ my: 'data' , num: randomnumber}));
});

app.post('/location', function(request, response) {
  var url_parts = url.parse(request.url, true);
  var query = url_parts.query;
  var data = request.body;
  var retdata = {"data": data, "URLparams": query};
  socket.sockets.send(JSON.stringify(retdata));
  response.send({result: 'okay'});
});

app.get('/logconf', function(request, response) {
  var endpoint = "http://sbtest00.herokuapp.com/location";
  var buses = [{"id": 101, "name": "Silicon Valley"},
               {"id": 102, "name": "Miami"},
               {"id": 103, "name": "Taipei"},
               {"id": 5000, "name": "Testing bus"}
              ];
  var resp = {"endpoint": endpoint, "buses": buses};
  response.send(resp);
});

var port = process.env.PORT || 3000;
server.listen(port, function() {
  console.log("Listening on " + port);
});

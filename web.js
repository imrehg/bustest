require.paths.unshift(__dirname + '/lib');

var express = require('express');
var uuid = require('node-uuid');
var connect = require('connect');

var app = express.createServer(
     connect.bodyParser(),
     express.logger(),
     express.static(__dirname + '/public')
     );
var io = require('socket.io');
var socket = io.listen(app);

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
  var data = request.body;
  socket.sockets.send(JSON.stringify(data));
  response.send({result: 'okay'});
});

app.get('/logconf', function(request, response) {
  var endpoint = "http://sbtest00.herokuapp.com/location";
  var buses = [{"id": "101", "name": "Silicon Valley"},
               {"id": "102", "name": "Miami"},
               {"id": "103", "name": "Taipei"},
               {"id": "XYZ", "name": "Testing bus"}
              ];
  var resp = {"endpoint": endpoint, "buses": buses};
  response.send(resp);
});

var port = process.env.PORT || 3000;
app.listen(port, function() {
  console.log("Listening on " + port);
});

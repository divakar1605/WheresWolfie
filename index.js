var express = require('express');
var app = express();
var http = require('http')
var server = http.createServer(app);
var io = require('socket.io')(server);

var players = [];
var connectedPlayerCount = 0;

var cities = require('./city_lists/cities.json');
var allCities = cities.capitals.concat(cities.majorCities);
var secretCity;

var gameState = Object.freeze({
  'RUNNING' : 1,
  'STARTING' : 2,
  'RESET' : 3
});

var currentState = gameState.STARTING;

server.listen(8080, function(){
  console.log('listening on port 8080');
});


app.use(express.static(__dirname + '/public'));

app.get('/', function(req, res){
  res.sendFile('index.html');
});


io.on('connection', function(socket){
  console.log('a user connected');
  connectedPlayerCount++;

  socket.emit('setup', { 'players' : players, 'cities' : cities });

  switch (currentState) {
    case gameState.STARTING :
      startGame();
      break;
    case gameState.RESET :
      socket.emit('resetting');
      break;
    case gameState.RUNNING :
      socket.emit('start');
      break;
  }

  socket.on('makeGuess', function(data) {

    let playerIdx = getPlayerIndex(data.name);
    if(playerIdx < 0) {
      // update playerIdx to where new player is added
      playerIdx = players.length;
      players.push({'name': data.name, 'score': 0});
      io.emit('new player', data.name);
    }

    let guessCity = findGuessCity(data.guess);

    if(guessCity === secretCity) {
      players[playerIdx].score++;

      // broadcast to everyone else that a player has won
      socket.broadcast.emit('game over', { 'winnerName' : data.name, 'secretCity' : secretCity });

      // send the win message to the winning player only
      socket.emit('win', {'playerName': data.name, 'cityName': secretCity.name, 'pos': secretCity.pos});

      //prepare to reset the game
      resetGame();

    } else if(guessCity !== null){
      let distance = calculateDistance(guessCity);
      socket.emit('guess response', {'name': guessCity.name, 'position': guessCity.pos, 'distance': distance});
    } else {
      socket.emit('invalid', data.guess);
    }
  });

  socket.on('disconnect', function(){
    console.log('a user disconnected');
    connectedPlayerCount--;

    // check if there are still players connected to the server
    if(connectedPlayerCount == 0) {
      currentState = gameState.STARTING;
    }
  });
});

function selectRandomCity(){
    var x = Math.floor((Math.random() * 99) + 1);

    console.log('Secret Location:  ' + allCities[x].name);

    gameRunning = true;
    return allCities[x];
}

function findGuessCity(guessCity) {
    var found = false;
    for (let i = 0; i < allCities.length; i++) {
        if (allCities[i].name.toLowerCase() === guessCity) {
            found = true;
            return allCities[i];
        }
    }
    if (found === false)
        return null;
}

function calculateDistance(guessCity) {
    var R = 6371; // Radius of the earth in km
    var dLat = deg2rad(secretCity.pos.lat - guessCity.pos.lat);  // deg2rad below
    var dLon = deg2rad(secretCity.pos.lng - guessCity.pos.lng);
    var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(deg2rad(secretCity.pos.lat)) * Math.cos(deg2rad(guessCity.pos.lat)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    var d = R * c; // Distance in km
    return d;
}

function deg2rad(deg) {
    return deg * (Math.PI / 180)
}

function getPlayerIndex(playerName) {
  for(let i=0; i<players.length; i++) {
    if(players[i].name === playerName){
      return i;
    }
  }
  // player doesn't exist
  return -1;
}

function startGame() {
  secretCity = selectRandomCity();
  io.emit('start');
  currentState = gameState.RUNNING;
}

function resetGame() {
  currentState = gameState.RESET;
  setTimeout(function() {
    startGame();
    currentState = gameState.RUNNING;
  }, 15000);
}

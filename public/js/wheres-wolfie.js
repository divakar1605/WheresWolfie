var map;
var mapMarkers = [];
var players = [];

var messages = {
  'start' : 'Wolfie has gone missing!! <br /><br />Can you help find him?',
  'win' : 'YOU WIN!!',
  'gameOver' : ' has found Wolfie! <br /><br /> Wolfie was hidden in ',
  'clear' : 'Clearing out the map for a new game now!',
  'reset' : 'Next round will begin shortly...',
  'invalid' : ' is not listed in our game!<br /><br />Please try another city'
};

//$('#playerScores').append('<tr><td>' + data.nameScore + '</td><td id=' + data.nameScore + '>' + 0 + '</td></tr>');

function initialize() {
    var mapProp = {
        center: new google.maps.LatLng(39.6, -101.7),
        zoom: 4,
        mapTypeId: google.maps.MapTypeId.ROADMAP
    };
    map = new google.maps.Map(document.getElementById("theMap"), mapProp);

}

function addEventListeners() {
  var input = document.getElementById("playerGuess");

  input.addEventListener("keyup", function(event) {
    // Number 13 is the "Enter" key on the keyboard
    if (event.keyCode === 13) {
      sendData();
    }
  });
}


function initConnection(socket) {

  socket.on('setup', function(data) {
    // create city list tables
    //TO DO

    clearInputFields(true, true);

    players = data;
    console.log(players);
    players.sort(function(a, b){
      return b.score - a.score;
    });

    //add score table if players exist
    if(players.length > 0) {
      updateScoreBoard();
    }
  });

  socket.on('start', function(){
    enableSubmitBtn();
    sendNotification(messages.start, 4000);//TBD - \n\nHe is in one of the cities listed on the sides')
  });

  socket.on('resetting', function(){
    disableSubmitBtn();
    sendNotification(messages.reset, 4000);
  });

  socket.on('guess response', function(data) {
    placeMarker(data.position, data.distance, false);
  });

  socket.on('invalid', function(data){
    sendNotification(data + messages.invalid, 4000);
  });

  socket.on('game over', function(data) {
    sendNotification(data.winnerName + messages.gameOver + data.secretCity.name.toUpperCase(), 4000);

    // show the location where wolfie was hidden
    placeMarker(data.secretCity.pos, 0, true);

    let winnerIdx = getPlayerIndex(data.winnerName);
    updateWinnerPosition(winnerIdx);

    updateScoreBoard();

    handleRoundEnd();
  });

  socket.on('new player', function(data) {
    players.push({'name': data, 'score': 0});
  });

  socket.on('win', function(data) {
    let winnerIdx = getPlayerIndex(data.playerName);
    updateWinnerPosition(winnerIdx);
    updateScoreBoard();
    placeMarker(data.pos, 0, true);
    sendNotification(messages.win, 4000);
    handleRoundEnd();
  });

}

function sendData() {
    var playerName = document.getElementById("playerName").value;
    var playerGuess = document.getElementById("playerGuess").value;
    playerGuess = playerGuess.toLowerCase();

    clearInputFields(false, true);

    socket.emit('makeGuess', {name: playerName, guess: playerGuess});
}

function placeMarker(position, distance, win) {
    var marker = new google.maps.Marker({
        position: position,
        map: map,
    });
    mapMarkers.push(marker);

    if (win === true) {
        marker.setIcon('../img/wolfie.png');
    }else {
        var infowindow = new google.maps.InfoWindow({
            content: 'distance: ' + distance.toFixed(2) + 'km'
        });
        google.maps.event.addListener(marker, 'click', function() {
            infowindow.open(map, marker);
        });
    }
}

function clearAllMarkers() {
    for (let i = 0; i < mapMarkers.length; i++) {
        mapMarkers[i].setMap(null);
    }
    mapMarkers = [];

}

function getPlayerIndex(playerName) {
  for(let i=0; i<players.length; i++) {
    if(players[i].name === playerName){
      return i;
    }
  }
}

function updateWinnerPosition(winnerIdx) {
  let winner = players[winnerIdx];
  winner.score++;

  players.splice(winnerIdx, 1);

  let newPos = findNewPosition(winner.score);
  players.splice(newPos, 0, winner);
}

function findNewPosition(score) {
  for(let i = 0; i<players.length; i++) {
    if(score > players[i].score) {
      return i;
    }
  }
  // didn't find a player with lower score than given, new position is last
  return players.length - 1;

}

function handleRoundEnd() {
  disableSubmitBtn();
  setTimeout(function() {
      sendNotification(messages.reset, 4000);
  }, 5000);
  setTimeout(function() {
      sendNotification(messages.clear, 4000);
      clearAllMarkers();
  }, 10000);
}

function disableSubmitBtn() {
  $('#submitBtn').prop("disabled",true);
}

function enableSubmitBtn() {
  $('#submitBtn').prop("disabled",false);
}

function clearInputFields(playerName, playerGuess){
  if(playerName === true)
    $('#playerName').val("");

  if(playerGuess === true)
    $('#playerGuess').val("");
}

function updateScoreBoard() {
  $('#playerScores').remove();
  createScoreBoard();
}

function createScoreBoard() {
  if(players[0].score > 0)
    $('#scores').append('<table id="playerScores"><tr><th>Name</th><th>Wins</th></tr></table>');

  let i = 0;
  players.forEach(function(player) {
    // Only show top 10
    if(i<10 && player.score > 0) {
      addPlayerToScoreBoard(player);
      i++;
    }
  });
}

function addPlayerToScoreBoard(player) {
  $('#playerScores').append('<tr><td>' + player.name + '</td><td>' + player.score + '</td></tr>');
}

function sendNotification(message, time) {
  var notificationBar = $('#notifications');
  notificationBar.addClass('show');
  notificationBar.html(message);
  setTimeout(function(){
    notificationBar.removeClass('show');
  }, time);
}

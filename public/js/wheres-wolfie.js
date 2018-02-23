var map;
var mapDefaults = [];
var mapMarkers = [];
var players = [];
var cities = [];
var currentGuesses = [];

var canSubmit = true;

var messages = {
  'start' : 'Wolfie has gone missing!! <br /><br />Can you help find him?',
  'win' : 'YOU WIN!!',
  'gameOver' : ' has found Wolfie! <br /><br /> Wolfie was hidden in ',
  'clear' : 'Clearing out the map for a new game now!',
  'reset' : 'Next round will begin shortly...',
  'invalid' : ' is not listed in our game!<br /><br />Please try another city'
};

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
      sendData(true);
    }
  });
}


function initConnection(socket) {

  socket.on('setup', function(data) {
    // create city list tables
    cities = data.cities;
    let capitalTable = $('#capitals');
    let majorCitiesTable = $('#majorCities');

    createTable(capitalTable, cities.capitals);
    createTable(majorCitiesTable, cities.majorCities);

    clearInputFields(true, true);

    players = data.players;
    if(players != undefined) {
      players.sort(function(a, b){
        return b.score - a.score;
      });
    }

    //add score table if players exist
    if(players != undefined && players.length > 0) {
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

  // normal guess response, DID NOT WIN
  socket.on('guess response', function(data) {

    setTableListColor(data.name, true, false);

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

  // special guess response, YOU WON!
  socket.on('win', function(data) {
    let winnerIdx = getPlayerIndex(data.playerName);
    updateWinnerPosition(winnerIdx);
    updateScoreBoard();

    placeMarker(data.pos, 0, true);
    setTableListColor(data.cityName, true, true);

    sendNotification(messages.win, 4000);
    handleRoundEnd();
  });

}

function sendData(clearGuess) {
  if(canSubmit == false)
    return;

  var playerName = document.getElementById("playerName").value;
  var playerGuess = document.getElementById("playerGuess").value;

  currentGuesses.push(playerGuess);

  playerGuess = playerGuess.toLowerCase();

  clearInputFields(false, clearGuess);

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
      clearInputFields(false, true);
      resetTableListColor();
  }, 10000);
}

function disableSubmitBtn() {
  canSubmit = false;
  $('#submitBtn').prop("disabled",true);
}

function enableSubmitBtn() {
  canSubmit = true;
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

function createTable(element, data) {

  let table = document.createElement('table');
  table.id = element.attr('id') + 'Table';
  table.classList.add('cityList');

  let headRow = document.createElement('tr');
  let tableHeading = document.createElement('th');
  tableHeading.colSpan = '4';
  tableHeading.innerHTML = element.attr('name');

  headRow.append(tableHeading);
  table.append(headRow);

  let headerRow = document.createElement('tr');
  for(let i=0; i<2; i++) {
    let stateHeader = document.createElement('th');
    stateHeader.innerHTML = 'State';
    let cityHeader = document.createElement('th');
    cityHeader.innerHTML = 'City';

    headerRow.append(stateHeader);
    headerRow.append(cityHeader);
  }

  table.append(headerRow);

  for(let i=0; i<data.length; i+=2) {
    let city1 = data[i];
    let city2 = data[i+1];
    addCityToTable(table, city1, city2);
  };

  element.append(table);
}

function addCityToTable(table, city1, city2) {
  let tableRow = document.createElement('tr');
  generateCityCols(tableRow, city1);
  generateCityCols(tableRow, city2);
  table.append(tableRow);
}

function generateCityCols(parentElement, city) {
  // remove spaces for the class name
  let className = city.name.split(' ').join('');

  let stateCol = document.createElement('td');
  stateCol.classList.add(className);
  stateCol.innerHTML = city.state;
  stateCol.addEventListener('click', function() {
    setGuess(city.name);
  });

  let cityCol = document.createElement('td');
  cityCol.classList.add(className);
  cityCol.innerHTML = city.name;
  cityCol.addEventListener('click', function() {
    setGuess(city.name);
  });

  parentElement.append(stateCol);
  parentElement.append(cityCol);

}

function setGuess(cityName) {
  if(canSubmit == false)
    return;
  $('#playerGuess').val(cityName);
  sendData(false);
}

function setTableListColor(cityName, addColor, win) {
  let className = cityName.split(' ').join('');
  let elements = document.getElementsByClassName(className);

  for(let i=0; i<elements.length; i++) {
    let element = elements[i];
    if(addColor) {
      if(win) {
        element.classList.add('correctGuess');
      } else {
        element.classList.add('incorrectGuess');
      }
    } else {
      element.classList.remove('correctGuess');
      element.classList.remove('incorrectGuess');
    }
  }
}

function resetTableListColor() {
  currentGuesses.forEach(function(cityName) {
    setTableListColor(cityName, false, false);
  });
}

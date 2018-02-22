var request = require('request');
var fs = require('fs');
var apiKey = '<YOUR API KEY>';

var timer = 0;


fs.readFile('cities.txt', function (err, data) {
   if (err) {
      return console.error(err);
   }

   var str = data.toString();
   let i = 0;
   let next = str.indexOf('\n', 0);

   var cityList = {
     'capitals' : [],
     'majorCities' : []
   };
   var state;
   var capitalNext = false;

   while(next != -1) {

     // remove \r from the end of the line
     let line = str.substring(i, next - 1);
     line.trim();


     i = next + 1;
     next = str.indexOf('\n', i);

     if(isState(line)) {
       state = getState(line);
       capitalNext = true;
     }else {
       // schedule timeout function at incremental times to avoid API reaching its quota of queries per sec
       timer += 100;

       // variables dedicated to timeout function
       // These are needed because state and capitalNext variables change outside of the timeout function.
       // So when our addCity tries accessing these values it gets the most updated values which are incorrect.
       let curState = state;
       let pushToCapitals = capitalNext;

       setTimeout(function(){
         addCity(line, curState, pushToCapitals, function(cityObj, pushToCapitals){
           if(pushToCapitals) {
             // We are on the capital line
             cityList['capitals'].push(cityObj);
           } else {
             // We are on a major city line (non-capital)
             cityList['majorCities'].push(cityObj);
           }
         });
       }, timer);

       // the next line after a capital is never another capital (will be state line or major city line)
       capitalNext = false;
     }
   }

   setTimeout(function() {
     let fileContent = JSON.stringify(cityList, null, 4);
     fs.writeFile('cities.json', fileContent, function (err) {
       if (err) throw err;
       console.log('Saved!');
     });
   }, 15000);


});

function isState(str) {
  return (str.indexOf('STATE') != -1);
}

function getState(str) {
  // format of state string : "STATE: <StateName>"
  let start = str.indexOf(':');
  start += 2;
  return str.substring(start, str.length);
}

function addCity(cityName, state, pushToCapitals, callback) {
  let address = cityName + '+' + state;
  address = address.split(' ').join('+');

  makeGeocodeRequest(address, function(location) {
    let cityObj = {'name' : cityName, 'pos' : location, 'state' : state};
    callback(cityObj, pushToCapitals);
  });
}

function makeGeocodeRequest(address, callback) {
  let url = 'https://maps.googleapis.com/maps/api/geocode/json?address=' + address + '&key=' + apiKey;

  request.get(url, function(error, response, body) {
    let json = JSON.parse(body);
    if(json.results[0] != undefined){
      callback(json.results[0].geometry.location);
    }
    else {
      console.log(json);
    }
  });

}

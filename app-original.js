//Application Includes
var express = require('express');
var path = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var static = require('node-static');
var http = require('http');
var dispatcher = require('httpdispatcher');
var path = require('path');
var fs = require('fs');
var $ = jQuery = require('jquery');
var async = require('async');
var Promise = require('bluebird');
var request = require('request');
var requirejs = require('requirejs');
var cors = require('cors');
require(__dirname + '/public/javascripts/jquery.csv.min.js');


//Rerouting to Webpages
var main = require('./routes/index');
var loginError = require('./routes/login');
var report = require('./routes/report');
var dRDetails = require('./routes/dRDetails');
var dRError = require('./routes/dRError');

var app = express();

//View Engine Set Up
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');
app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser('ecobee'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(path.join(__dirname, 'Demand Response Data')));


app.use(cors());

//Setting up cors
app.options('*', cors());
var corsOptions = {
  origin: 'https://api.ecobee.com/1/',
  methods: ['GET', 'PUT', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  preflightContinue: true
};


app.use('/', main);
app.use('/report', report);
app.use('/dRDetails', dRDetails);
app.use('/login', loginError);
app.use('/dRError', dRError);


//Login Check
app.use('/login', function(req, res) {
    var url = 'https://api.ecobee.com/1/register?format=json';
    req.header("Access-Control-Allow-Origin", "http:\\127.0.0.1:3000");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    
    //Request to register and obtain a token upon login
    request.post(url, {
        headers: {
            'Content-Type': 'application/json;charset=UTF-8'
        },
        body: {
            'userName': req.body.username,
            'password': req.body.password
        },
        json: true
    }, function (err, res2, data) {
        
        //Upon receiving a response
        if (data.token == undefined) {
            res.redirect('/login'); } 
        else { 
            token = data.token; 
            username = req.body.username;
            password = req.body.password;
            
            runProgram();
            res.redirect('/dRDetails');
        }
    });
});


//Get Demand Response Details
app.use('/generate', function(req, res) {
    req.header("Access-Control-Allow-Origin", "http:\\127.0.0.1:3000");
    
    
    var startTimeArray = req.body.startTime.split(':');
    var endTimeArray = req.body.endTime.split(':');
    
    array = [req.body.setName, req.body.dRName, req.body.date, startTimeArray[0], startTimeArray[1], endTimeArray[0], endTimeArray[1]];
    runProgram(array).then(function (err) {
        setName = req.body.setName;
        demandResponseName = req.body.dRName;
        startDate = req.body.date;
        if (startTimeArray[0] == '0') {startTimeArray[0] = '00'; }
        if (startTimeArray[1] == '0') {startTimeArray[1] = '00'; }
        if (endTimeArray[0] == '0') {endTimeArray[0] = '00'; }
        if (endTimeArray[1] == '0') {endTimeArray[1] = '00'; }
        startTime = startTimeArray[0] + ':' + startTimeArray[1];
        endTime = endTimeArray[0] + ':' + endTimeArray[1];
        
        dirDemandResponse = __dirname + "\\Demand Response Data\\" + demandResponseName + "\\";
        dirGraphs = dirDemandResponse + "Graphs\\";
        
        console.log(error);
        if(error == "" || error == "TypeError: Cannot read property '0' of undefined") { res.redirect('/report'); }
        else { res.render('dRError'); }
    });
});


//Demand Response Redirect
app.use('/dRRedirect', function(req, res) {
    res.redirect('/dRDetails');
});







// catch 404 and forward to error handler
app.use(function(req, res, next) {
    var err = new Error('Not Found');
    err.status = 404;
    next(err);
});

// error handlers

// development error handler
// will print stacktrace
if (app.get('env') === 'production') {
  app.use(function(err, req, res, next) {
    res.status(err.status || 500);
    res.render('error', {
      message: err.message,
      error: err
    });
  });
}


// production error handler
// no stacktraces leaked to user
app.use(function(err, req, res, next) {
  res.status(err.status || 500);
  res.render('error', {
    message: err.message,
    error: {}
  });
});






























//Main Program
//Note -> things to update and add:
// - Descriptinve error handling for all error types -- On it
// - Remove debugging code after ensuring everything works
// - Ensure no extra spaces in demand response name
// - What do we do about thermostats with empty fields? They do affect averages afterall
// - Universal Catch



var baselink = 'https://api.ecobee.com/1/';
var username = '';
var password = '';
setName = '';


//Demand Response Name, Data and Time (USER DEFINED)
demandResponseName = "";

startDate = "";
endDate = "";
startTime = "";
endTime = "";

startTimeHour = 0;
startTimeMinute = 0;
endTimeHour = 0;
endTimeMinute = 0;
var timezone = -4;
var timeInterval = 5;           //5 Minutes default API Generated Interval
var chartInterval = 15;         //15 Minutes for Charting
var startTimeInterval = 0;      //Interval 0 = 20:00:00 (timezone adjusted for -4 EDT), Interval 1 = 20:05:00 and so on
var endTimeInterval = 287;      //Max Interval is 287 for 19:50:00


//File Directories
dirDemandResponse = __dirname + "\\Demand Response Data\\" + demandResponseName + "\\";
dirGraphs = dirDemandResponse + "\\Graphs\\";
dirRawData = dirDemandResponse + "\\Raw\\";
dirCSVData = dirDemandResponse + "\\CSV\\";

//Cached Values
var thermostatList = "";                    //Saves all thermostats as string
var thermostatListRequest = [];             //Saves all thermostats in groups of 25
var participatingThermostats = "";          //Saves all participating thermostats as string
var nonParticipitatingThermostats = "";     //Saves all non participating thermostats as string
var optOutThermostats = "";                 //Saves all opt out thermostats as string
var kWFactorData = {};                      //Saves all kW factors as hash table

//Global Error
error = "";


//API Access token
function accessAPI() { 
    
    return new Promise(function (resolve, reject) {
        
        //Request to register and obtain a token upon login
        request.post(baselink + 'register?format=json', {
            headers: {
                'Content-Type': 'application/json;charset=UTF-8'
            },
            body: {
                'userName': username,
                'password': password
            },
            json: true
        }, function (err, res, data) {

            //Upon receiving a response
            if (data.token == undefined) { reject("Invalid Login Information"); } 
            else { var token = data.token; resolve(token); }
        });
    });
}



//Request to Get Thermostat List
function getDemandResponseThermostats(token) {
    
    return new Promise(function (resolve, reject) {
        
        //Request obtain list of thermostats based on SetName inserted
        request.get(baselink + 'hierarchy/set?format=json&body={"operation":"list","setPath":"/' + setName + '","recursive":true,"includeChildren"=true,"includePrivileges":false,"includeThermostats":true}', {
            headers: {
                'Content-Type': 'application/json;charset=UTF-8',
                'Authorization': 'Bearer '.concat(token)
            }
        }, function (err, res, data) {
            
            //Upon receiving a response
            if ((err) || (data == undefined)) { reject("The Set Name inserted is not available for this account. Please input a valid Set Name"); } 
            else { resolve(data); }
        });
    });
}



//Second Reqquest to get Thermostat Data
function getThermostatData(token, list) {
    
    return new Promise(function (resolve, reject) {
        
        var url = baselink + 'runtimeReport?format=json&body={"startDate":' + startDate + ',"startInterval":' + startTimeInterval + ',"endDate":' + endDate + ' ,"endInterval":' + endTimeInterval + ',"columns":"zoneCalendarEvent,zoneAveTemp,outdoorTemp,zoneCoolTemp,zoneHeatTemp,zoneHvacMode,zoneOccupancy,zoneHumidity,zoneHumidityLow,zoneHumidityHigh,auxHeat1,auxHeat2,auxHeat3,compCool1,compCool2,compHeat1,compHeat2,dehumidifier,dmOffset,economizer,fan,humidifier,outdoorHumidity","selection":{"selectionType":"thermostats","selectionMatch":"' + list + '"}}';
        
        //Request to register and obtain list of thermostats based on SetName inserted
        request.get(url, {
            headers: {
                'Content-Type': 'application/json;charset=UTF-8',
                'Authorization': 'Bearer '.concat(token)
            }
        }, function (err, res, data) {
            
            //Upon receiving a response
            if ((err) || (data == undefined)) { reject("Thermostat Data not properly obtained"); } 
            else { resolve(data); }
        });
    });
}



//Function to Save Files (Takes File name, File Directory, and Data to Save) ----- console.log
function saveFile(name, dir, data) {
    return new Promise(function (resolve, reject) {
        
        //Check if Base Directory exists; If not, then create directory
        if (!fs.existsSync(dirDemandResponse)) { fs.mkdirSync(dirDemandResponse); }
        
        //Check if Called Directory exists; If not, then create directory
        if (!fs.existsSync(dir)) { fs.mkdirSync(dir); } 

        //Write file to set directory
        fs.writeFile(dir + name, data, function (err) {
            if (err) { reject(name + " has not been properly saved. Please check if file is already open."); } 
            else { console.log(name + " saved to " + dir + name); resolve(name + " saved to " + dir + name); }
        });
    });
}



//Function to Calculate Start and End Intervals as a function of Time
function calculateIntervals() {
    return new Promise(function (resolve, reject) {
        
        //Adds one day to the start date and makes that the new end date
        var date = startDate.split("-");
        date[2] = (Number(date[2]) + 1).toFixed(0); //Increment date
        date = date.join("-");
        endDate = date;       
        
        //Add Time as a Global Variable
        var startTimeArray = [startTimeHour.toFixed(0), startTimeMinute.toFixed(0)];
        var endTimeArray = [endTimeHour.toFixed(0), endTimeMinute.toFixed(0)];
        if (startTimeArray[0] == '0') {startTimeArray[0] = '00'; }
        if (startTimeArray[1] == '0') {startTimeArray[1] = '00'; }
        if (endTimeArray[0] == '0') {endTimeArray[0] = '00'; }
        if (endTimeArray[1] == '0') {endTimeArray[1] = '00'; }
        startTime = startTimeArray[0] + ':' + startTimeArray[1];
        endTime = endTimeArray[0] + ':' + endTimeArray[1];
        
        //This math is hard to explain... There are 288 5-minute intervals in a day, and this figures out which interval the DR starts and ends
        if (startTimeHour > (24 + timezone)) {
            startTimeInterval = (startTimeHour - (24 + timezone)) * (60 / timeInterval);
        } else if (startTimeHour < (24 + timezone)) {
            startTimeInterval = 288 - ((24 + timezone) - startTimeHour) * (60 / timeInterval);
        } else if (startTimeHour === (24 + timezone)) {
            startTimeInterval = 0;
        }
        startTimeInterval += startTimeMinute / timeInterval;

        if (endTimeHour > (24 + timezone)) { 
            endTimeInterval = (endTimeHour - (24 + timezone)) * (60 / timeInterval);
        } else if (endTimeHour < (24 + timezone)) {
            endTimeInterval = 288 - ((24 + timezone) - endTimeHour) * (60 / timeInterval);
        } else if (endTimeHour === (24 + timezone)) {
            endTimeInterval = 0;
        }
        endTimeInterval += 1 + endTimeMinute / timeInterval;
        
        startTimeInterval.toFixed(0);
        endTimeInterval.toFixed(0);
        
        //If end interval is less than start, add a day to the start date        
        endDate = (endTimeInterval < startTimeInterval) ? endDate : startDate;
        
        resolve("Interval Calculation Completed Successfully");
    });
}



//Function to Differentiate Participation ---------------------------------- Remove Debugging Code
function participationData() {
    return new Promise(function (resolve, reject) {

        //Variable initialization (counter counts the total number of thermostats)
        var counter = 0, thermostatIDs = thermostatList.split(",");
        
        
        //Asynchronous loop to obtain each thermostat ID in the set name
        async.forEach(thermostatIDs, function (id, callback) {
            
            //Increment counter when thermostat is access
            counter++;
            
            //Thermostat specific CSV file
            var csvFile = dirCSVData + id + ".csv";
            
            //Read the file
            fs.readFile(csvFile, 'UTF-8', function (err, csv) {
                
                //Upon read file error
                if (err) { reject("Cannot access " + csvFile + ". Please ensure that file is in directory and closed."); }
                else {
                    //Grab file contents and parse to objects
                    $.csv.toObjects(csv, {}, function (err, data) {
                        if (err) { reject("Cannot parse " + csvFile + " correctly. Please ensure that file is formatted correctly and closed."); }
                        else {
                            var participationRows = 0;
                            
                            //Loop through each row and count participation. If row's calendar event field has the demand response name, it participated in that time
                            async.forEach(data, function (row, callback) {
                                if (row.zoneCalendarEvent == demandResponseName) {
                                    participationRows++;
                                }
                                callback(); //Next Row
                            }, function (err) {
                                
                                //After all rows were checked
                                if ((participationRows === data.length)) { participatingThermostats += id + ","; } 
                                else if ((participationRows === 0)) { nonParticipitatingThermostats += id + ","; } 
                                else if ((participationRows < data.length)) { optOutThermostats += id + ","; }
                                callback(); //Next Thermostat
                            });
                        }
                    });
                }
            });
        }, function (err) {
            //Upon completion of grabbing data for all thermostats
            if (err) { reject("Thermostat participation have not been successfully processed"); }
            else { resolve("Participation data for all " + counter + " thermostats successfully processed!"); }
        });
    });
}



//Participation Summary - Prints Number of Participating, Non Participating and Opt-Out Thermostats
function participationListCSV() {
    return new Promise(function (resolve, reject) {
        
        //Obtain arrays of all participation group types
        var participating = participatingThermostats.split(",");
        var nonParticipitating = nonParticipitatingThermostats.split(",");
        var optOut = optOutThermostats.split(",");

        //Obtain number of all thermostats (the -1 is due to a trailing comma)
        var participationSummaryCSV = "Group,Count\n";
        var participatingNumber = participating.length - 1;
        var nonParticipationNumber = nonParticipitating.length - 1;
        var optedOutNumber = optOut.length - 1;
        var totalThermostats = participatingNumber + nonParticipationNumber + optedOutNumber;

        //Append numbers to a CSV format for file saving
        participationSummaryCSV += "Participating," + participatingNumber + "\nNon Participating," + nonParticipationNumber + "\nOpt Out," + optedOutNumber + "\nTotal," + totalThermostats + "\n";

        resolve(participationSummaryCSV);
    });
}



//Function to Grab Thermostats from Heirarchy Document and Divide them into sets of 25
function getThermostatIDs(data) {
    return new Promise(function (resolve, reject) {
        
        //Parse Heirarchy CSV and obtain thermostat list
        var heirarchy = JSON.parse(data);
        thermostatList = heirarchy.sets[0].thermostats;
        thermostatList = thermostatList.join();

        //Turn list into array
        var allThermostats = thermostatList.split(',');
        var thermostatListString = "";
        var iteration = 0;
        var numberOfThermostats = 0;
        
        //Loop to go through all thermostats and add them as arrays in sets of 25
        async.forEach(allThermostats, function (id, callback) {
            iteration++;
            if (numberOfThermostats == 24) { //25 is request limit
                thermostatListRequest.push(thermostatListString.slice(0, -1));
                thermostatListString = "";
                numberOfThermostats = -1;
                thermostatListString += id + ",";
                numberOfThermostats++;
            } else if (iteration == allThermostats.length) {
                thermostatListString += id + ",";
                thermostatListRequest.push(thermostatListString.slice(0, -1));
            } else {
                thermostatListString += id + ",";
                numberOfThermostats++;
            }

            callback(); //Next
        }, function (err) {
            //When division into groups is complete
            if (err) { reject("Thermostat list have not been divided successfully"); }
            else { resolve(data); }
        });
    });
}

    

//Function to Generate CSVs for all Thermostats
function generateThermostatCSV(data) {
    return new Promise(function (resolve, reject) {
        
        //Initializing variables
        var thermostatData = data;
        var thermostatDataColumns = "date,time," + thermostatData.columns + ",kW,kWh";
        var numOfThermostats = thermostatData.reportList.length;
        var thermostatCSV = "",
            thermostatListCSV = "",
            numOfDataRows = 0,
            thermostatID = "";

        //For loop to populate CSV files for all thermostats
        for (var i = 0; i < numOfThermostats; i++) {
            
            //Obtain thermostat identifier and create the file name
            var thermostatID = thermostatData.reportList[i].thermostatIdentifier;
            var fileName = thermostatData.reportList[i].thermostatIdentifier + ".csv";
            
            //Append header row into csv files
            thermostatListCSV += thermostatData.reportList[i].thermostatIdentifier + "\n";
            thermostatCSV += thermostatDataColumns + "\n";
            numOfDataRows = thermostatData.reportList[i].rowCount;

            var hvacMode = [];
            
            //For loop to go through csv data and calculate kW and kWh based on duty cycle
            for (var j = 0; j < numOfDataRows; j++) {
                
                //Separate rows to check HVAC Mode
                hvacMode = (thermostatData.reportList[i].rowList[j].split(","))[7];
                thermostatCSV += thermostatData.reportList[i].rowList[j];
                
                //Check HVAC Mode to determine Duty Cycle; if on, the append kW from kWFactor for that thermostat and calculate kWh, otherwise it's 0 for both
                if ((hvacMode == "compressorCoolStage1On") || (hvacMode == "compressorCoolStage2On")) {
                    //This checks if thermostat ID exists in kWFactor list, otherwise it takes a default value
                     if ((thermostatID in kWFactorData)) { 
                         thermostatCSV += kWFactorData[thermostatID] + "," + (Number(kWFactorData[thermostatID]) * timeInterval / 60).toFixed(2);
                     }
                    else {
                        thermostatCSV += kWFactorData['999'] + "," + (Number(kWFactorData['999']) * timeInterval / 60).toFixed(2) ; 
                    }
                }
                else {
                    thermostatCSV += "0,0";
                }
                thermostatCSV += "\n";
            }
            
            //Save each thermostat
            saveFile(fileName, dirCSVData, thermostatCSV);

            //Reset Thermostat CSV to start new for another thermostat
            thermostatCSV = "";
        }
        resolve(thermostatListCSV); //Return thermostat list
    });
}


//Function to group data for graphing 
function getGraphCSVData(dataType, tempOrDutyCycleorLoad) {
    return new Promise(function (resolve, reject) {
        var fail = "Not enough " + dataType + " thermostats data to get " + tempOrDutyCycleorLoad + " data for demand response";
        var thermostatsFile = "";
        var thermostatDate = [],
            thermostatTime = [],
            zoneAveTemperature = [],
            zoneCoolTemperature = [],
            zoneHeatTemperature = [],
            kiloWatt = [],
            kiloWattHour = [],
            duty = 0,
            dutyCycle = [];
        var numberOfThermostats = 0,
            currentThermostat = "",
            graphDataCSV = "";

        if (tempOrDutyCycleorLoad == "Temperature") {
            graphDataCSV = "Date,Time,Average Temperature,Heat Temperature,Cool Temperature\n";
        } else if (tempOrDutyCycleorLoad == "Duty Cycle") {
            graphDataCSV = "Date,Time,Average Duty Cycle\n";
        } else if (tempOrDutyCycleorLoad == "Load") {
            graphDataCSV = "Date,Time,kW,kWh\n";
        } 
        else {
            reject("Invalid data type selection. Please choose either \"Temperature\" or \"Duty Cycle\" or \"Load\" for input parameters ");
        }

        if (dataType == "Participating") {
            thermostatsFile = dirDemandResponse + "Participating.csv";
        } else if (dataType == "Non Participating") {
            thermostatsFile = dirDemandResponse + "NonParticipating.csv";
        }

        fs.readFile(thermostatsFile, 'UTF-8', function (err, csv) {
            $.csv.toArrays(csv, {}, function (err, thermostats) {
                thermostats = thermostats.join().split(",");
                numberOfThermostats = thermostats.length;

                async.forEach(thermostats, function (id, callback) {
                    currentThermostat = dirCSVData + id + ".csv";

                    fs.readFile(currentThermostat, 'UTF-8', function (err, thermostatCSV) {
                        if (err) {
                            reject(fail);
                        } else {
                            $.csv.toObjects(thermostatCSV, {}, function (err, data) {

                                var rowNumber = 0;
                                async.forEach(data, function (row, callback) {
                                    if (zoneAveTemperature.length < data.length) {
                                        thermostatDate.push(row.date);
                                        thermostatTime.push(row.time);
                                        zoneAveTemperature.push(Number(row.zoneAveTemp));
                                        zoneCoolTemperature.push(Number(row.zoneCoolTemp));
                                        zoneHeatTemperature.push(Number(row.zoneHeatTemp));
                                        kiloWatt.push(Number(row.kW));
                                        kiloWattHour.push(Number(row.kWh));
                                        duty = ((row.zoneHvacMode == "compressorCoolStage1On") || (row.zoneHvacMode == "compressorCoolStage2On")) ? 100 : 0;
                                        dutyCycle.push(duty);
                                    } else {
                                        zoneAveTemperature[rowNumber] += Number(row.zoneAveTemp);
                                        zoneCoolTemperature[rowNumber] += Number(row.zoneCoolTemp);
                                        zoneHeatTemperature[rowNumber] += Number(row.zoneHeatTemp);
                                        kiloWatt[rowNumber] += (Number(row.kW));
                                        kiloWattHour[rowNumber] += (Number(row.kWh));
                                        duty = ((row.zoneHvacMode == "compressorCoolStage1On") || (row.zoneHvacMode == "compressorCoolStage2On")) ? 100 : 0;
                                        dutyCycle[rowNumber] += duty;
                                    }
                                    rowNumber++;
                                    callback(); //Next
                                }, function (err) {
                                    //When rows are done
                                    callback(); //Next
                                });
                            });
                        }
                    })
                }, function (err) {
                    //When all thermostats are done
                    var row = 0;
                    async.forEach(thermostatDate, function (date, callback) {
                        if (tempOrDutyCycleorLoad == "Temperature") {
                            graphDataCSV += thermostatDate[row] + "," + thermostatTime[row] + "," + (zoneAveTemperature[row] / numberOfThermostats).toFixed(1) + "," + (zoneHeatTemperature[row] / numberOfThermostats).toFixed(1) + "," + (zoneCoolTemperature[row] / numberOfThermostats).toFixed(1) + "\n";
                        } else if (tempOrDutyCycleorLoad == "Duty Cycle") {
                            graphDataCSV += thermostatDate[row] + "," + thermostatTime[row] + "," + (dutyCycle[row] / numberOfThermostats).toFixed(1) + "\n";
                        } else if (tempOrDutyCycleorLoad == "Load") {
                            graphDataCSV += thermostatDate[row] + "," + thermostatTime[row] + "," + (kiloWatt[row] / numberOfThermostats).toFixed(2) + "," + (kiloWattHour[row] / numberOfThermostats).toFixed(2) + "\n";
                        }
                        row++;
                        callback(); //Next
                    }, function (err) {
                        //When all temperatures are done
                        resolve(graphDataCSV);
                    });
                });
            });
        });
    });
}



//Function to group both Participating and Non-Participating chosen data [Load (kW and kWh) or Duty Cycles] into 1 CSV
function groupData(dataType) {
    return new Promise(function (resolve, reject) {
        
        //Initializing variables, arrays and csv files
        var thermostatDate = [], thermostatTime = [], participatingDutyCycle = [], nonParticipatingDutyCycle = [], participatingKW = [], participatingKWH = [],
            nonParticipatingKW = [], nonParticipatingKWH = [], participatingAveTemp = [], participatingCoolTemp = [], participatingHeatTemp = [], nonParticipatingAveTemp = [],
            nonParticipatingCoolTemp = [], nonParticipatingHeatTemp = [], participatingFilePath = "", nonParticipatingFilePath = "",
            csvFile = "Date,Time,Participating,Non Participating,Difference\n",
            csvFile2 = "Date,Time,Participating,Non Participating,Difference\n";
            
        //Statements to check which csv file to access for data
        if (dataType == "Load") {
            participatingFilePath = dirGraphs + "Non Participating Average Load.csv";
            nonParticipatingFilePath = dirGraphs + "Participating Average Load.csv";
        } else if (dataType == "Duty Cycle") {
            participatingFilePath = dirGraphs + "Non Participating Average Duty Cycle.csv";
            nonParticipatingFilePath = dirGraphs + "Participating Average Duty Cycle.csv";
        } else if (dataType == "Temperature") {
            participatingFilePath = dirGraphs + "Participating Temperatures.csv";
            nonParticipatingFilePath = dirGraphs + "Non Participating Temperatures.csv";
            csvFile = "Date,Time,Participating Average Temperature,Participating Heat Temperature,Participating Cool Temperature,Non Participating Average Temperature,Non Participating Heat Temperature,Non Participating Cool Temperature\n";
        }

        //Read Participating file (Either load or Duty Cycle) to grab data
        fs.readFile(participatingFilePath, 'UTF-8', function (err, participating) {
            
            //After reading file
            
            $.csv.toObjects(participating, {}, function (err, data) {
                async.forEach(data, function (row, callback) {
                    thermostatDate.push(row.Date);
                    thermostatTime.push(row.Time);
                    if (dataType == "Duty Cycle") {
                        participatingDutyCycle.push(row["Average Duty Cycle"]);
                    } else if (dataType == "Load") {
                        participatingKW.push(row["kW"]);
                        participatingKWH.push(row["kWh"]);
                    } else if (dataType == "Temperature") {
                        participatingAveTemp.push(row["Average Temperature"]);
                        participatingHeatTemp.push(row["Heat Temperature"]);
                        participatingCoolTemp.push(row["Cool Temperature"]);
                    }
                    callback(); //Next
                }, function (err) {
                    //Fields are updated
                    fs.readFile(nonParticipatingFilePath, 'UTF-8', function (err, nonParticipating) {
                        $.csv.toObjects(nonParticipating, {}, function (err, data2) {
                            async.forEach(data2, function (row, callback) {
                               if (dataType == "Duty Cycle") {
                                    nonParticipatingDutyCycle.push(row["Average Duty Cycle"]);
                                } else if (dataType == "Load") {
                                    nonParticipatingKW.push(row["kW"]);
                                    nonParticipatingKWH.push(row["kWh"]);
                                } else if (dataType == "Temperature") {
                                    nonParticipatingAveTemp.push(row["Average Temperature"]);
                                    nonParticipatingHeatTemp.push(row["Heat Temperature"]);
                                    nonParticipatingCoolTemp.push(row["Cool Temperature"]);
                                }
                                callback(); //Next
                            }, function (err) {
                                //After Rows are Populated
                                var row = 0;
                                var dataFields;
                                if (dataType == "Duty Cycle") {
                                    dataFields = participatingDutyCycle;
                                } else if (dataType == "Load") {
                                    dataFields = participatingKW;
                                } else if (dataType == "Temperature") {
                                    dataFields = participatingAveTemp;
                                }
                                async.forEach(dataFields, function (index, callback) {
                                    if (dataType == "Duty Cycle") {
                                        csvFile += thermostatDate[row] + "," + thermostatTime[row] + "," + participatingDutyCycle[row] + "," + nonParticipatingDutyCycle[row] + "," + (Number(nonParticipatingDutyCycle[row]) - Number(participatingDutyCycle[row])).toFixed(1) + "\n";
                                    } else if (dataType == "Load") {
                                        csvFile += thermostatDate[row] + "," + thermostatTime[row] + "," + participatingKW[row] + "," + nonParticipatingKW[row] + "," + (Number(nonParticipatingKW[row]) - Number(participatingKW[row])).toFixed(2) + "\n";
                                        csvFile2 += thermostatDate[row] + "," + thermostatTime[row] + "," + participatingKWH[row] + "," + nonParticipatingKWH[row] + "," + (Number(nonParticipatingKWH[row]) - Number(participatingKWH[row])).toFixed(2) + "\n";
                                    } else if (dataType == "Temperature") {
                                        csvFile += thermostatDate[row] + "," + thermostatTime[row] + "," + participatingAveTemp[row] + "," + participatingHeatTemp[row] + "," + participatingCoolTemp[row] + "," + nonParticipatingAveTemp[row] + "," + nonParticipatingHeatTemp[row] + "," + nonParticipatingCoolTemp[row] + "\n"; 
                                    }
                                    row++;
                                    callback(); //Next
                                }, function (err) {
                                    //After CSV is populated
                                    resolve([csvFile, csvFile2]);
                                });
                            });
                        });
                    });
                });
            });
        });
    });
}



//Row Averaging Function to have 15 minute intervals instead of 5 minute intervals
function averageRows(dataType) {
    return new Promise(function (resolve, reject) {
        
        //Initializing csvFile and arrays to populate
        var csvFile = "", date = [], time = [], participatingValues = [], nonParticipatingValues = [], differenceValues = [];
        
        //Add header to csvFile
        var graphDataCSV = "Date,Time,Participating,Non Participating,Difference\n";
            
        //Statements to check which csv file to access for data
        if (dataType == "Load kW") { 
            csvFile = dirGraphs + "Average Load (kW).csv";
        } else if (dataType == "Load kWh") {
            csvFile = dirGraphs + "Average Load (kWh).csv";
        } else if (dataType == "Duty Cycle") {
            csvFile = dirGraphs + "Average Duty Cycles.csv";
        } else {
            reject("Invalid data type selection. Please choose either \"Load kW\" or \"Load kWh\" or\"Duty Cycle\" for input parameters.");
        }

        //Checking if intervals are valid
        var currentInterval = timeInterval, wantedInterval = chartInterval,
            rowsInInterval = (wantedInterval > currentInterval) ? Math.floor(wantedInterval / currentInterval) : currentInterval;

        //Read CSV File for data
        fs.readFile(csvFile, 'UTF-8', function (err, csv) {
            
            //On read file error
            if (err) { reject("Cannot access " + csvFile + ". Please ensure that file is in directory and closed."); }
            else {
                //Convert csv data to objects
                $.csv.toObjects(csv, {}, function (err, data) {
                    
                    //Upon parsing CSV File to objects
                    if (err) { reject("Cannot parse " + csvFile + " data. Please ensure that file is in directory, formatted correctly and closed."); }
                    else {
                        
                        //Initializing variables and multipliers
                        var totalRows = data.length, currentRow = 0, counter = 1, participatingVal = 0, nonParticipatingVal = 0, differenceVal = 0;
                        var multiplier = (dataType == "Load kWh") ? rowsInInterval : 1;     //Only used for kWh to ensure correct intervals
                            
                        //Asynchronous Loop to sum and average data
                        async.forEach(data, function (row, callback) {
                            
                            //If current row is a factor of row interval (end addition and divide) and is not the last row
                            if ((currentRow % rowsInInterval) == 0 && (currentRow != data.length - 1)) {
                                date.push(row.Date);
                                time.push(row.Time);

                                //If it's not the first row then average and append to array
                                if (currentRow != 0) {
                                    participatingValues.push((Number(participatingVal) / counter).toFixed(2));
                                    nonParticipatingValues.push((Number(nonParticipatingVal) / counter).toFixed(2));
                                    differenceValues.push((Number(differenceVal) / counter).toFixed(2));
                                }

                                //Reset Counter and Sums
                                counter = 0; participatingVal = 0; nonParticipatingVal = 0; differenceVal = 0;
                            }
                            
                            //Add sums to arrays (multiple of Load kWh)
                            participatingVal += Number(row["Participating"]) * multiplier;
                            nonParticipatingVal += Number(row["Non Participating"]) * multiplier;
                            differenceVal += Number(row["Difference"]) * multiplier;

                            //If Current Row is Last Row, wrap up and average
                            if (currentRow == data.length - 1) {
                                participatingValues.push((Number(participatingVal) / (counter + 1)).toFixed(2));
                                nonParticipatingValues.push((Number(nonParticipatingVal) / (counter + 1)).toFixed(2));
                                differenceValues.push((Number(differenceVal) / (counter + 1)).toFixed(2));
                            }
                            
                            //Increment Row and Counter
                            currentRow++; counter++;
                            callback(); //Next

                        }, function (err) {
                            
                            //After looping through data and successfully averaging
                            if (err) { reject("Averaging rows for " + csvFile + " was not successful. Please check file formatting and ensure it is closed"); }
                            else {
                                
                                //Initialize Row Number
                                var rowNumber = 0;
                                
                                //Asyncrhonous loop to append data from arrays into csv
                                async.forEach(date, function (row, callback) {
                                    graphDataCSV += date[rowNumber] + "," + time[rowNumber] + "," + participatingValues[rowNumber] + "," + nonParticipatingValues[rowNumber] + "," + differenceValues[rowNumber] + "\n";
                                    rowNumber++;
                                    callback(); //Next
                                }, function (err) {
                                    
                                    //Upon finishing building the csv file
                                    if (err) { reject(csvFile + " was not successfully averaged. Please check file format and try again"); }
                                    else { resolve(graphDataCSV); }
                                });
                            }
                        });
                    }
                });
            }
        });
    });
}



//Get Thermostat Data (API Request) for each Thermostat Group
function getThermostatGroups(token) {
    
    return new Promise(function (resolve, reject) {
        
        //Variable Initialization
        var data, intermediateData = "", iteration = 0;
        
        //Asynchronous loop to obtain obtain thermostat groups (max of 25 thermostats per group)
        async.forEach(thermostatListRequest, function (list, callback) {
            
            //Request API for thermostat data on each group
            getThermostatData(token, list)
                .then(function (response) {
                
                    //When data is obtained and if the data is the first set
                    if (iteration == 0) {
                        
                        //Parse JSON and append to data
                        data = JSON.parse(response);
                        
                        //Increment Iteration
                        iteration = 1;
                        
                    } else {
                        
                        //If data is not the first set then filter unnecessary data
                        intermediateData = JSON.parse(response).reportList;
                        
                        //Asynchrnous loop to input append new data to old ones
                        async.forEach(intermediateData, function (row, callback) {
                            data.reportList.push(row);
                            callback(); //Next
                        }, function (err) {
                            
                            //After new data is appended to old data
                            if (err) { reject("Error in data obtained."); }
                        });
                    }
                    callback(); //Next
                })

        }, function (err) {
            
            //Upon obtaining data for all Thermostats
            if (err) { reject("Error importing data from API."); }
            else { resolve(data); }
        })
    });
}



//Import KW Factor for Each Thermostat
function importKWFactor() {
    
     return new Promise(function (resolve, reject) {
        
        //KW Factor File Name 
        var kWFactorFile = __dirname + "/public/data/kWFactor.csv";

         //Read file
        fs.readFile(kWFactorFile, 'UTF-8', function (err, csv) {
            //On read file error
            if (err) { reject( "Unable to locate kWFactor.csv within \'public\\data\\kwFactor.csv\'" ); } 
            else {
                //Convert CSV to 2D Array
                $.csv.toArrays(csv, {}, function (err, kWFactor) {
                
                //On conversion error
                    if (err) { reject("Error parsing kWFactor.csv. Please check file format and contents and try again."); }

                    //Eliminate header row
                    kWFactor = kWFactor.slice(1);

                    //Asynchronous loop to convert 2D array to hash table
                    async.forEach(kWFactor, function (kW, callback) {
                        kWFactorData[kW[0]] = kW[1]; 
                        callback(); //Next
                    }, function(err) {
                        
                        //Upon finishing parsing
                        if (err) { reject("Error parsing kWFactor.csv to hash table"); }
                        else { resolve("kWFactor.csv file successfully obtained and parsed."); }
                    });   
                });
            }
        });
     });
}



//Add Demand Response Data to global variables
function demandResponseData(details) {
    return new Promise(function (resolve, reject) {
        setName = details[0];
        demandResponseName = details[1];
        startDate = details[2];
        startTimeHour = Number(details[3]);
        startTimeMinute = Number(details[4]);
        endTimeHour = Number(details [5]);
        endTimeMinute = Number(details[6]);
        
        dirDemandResponse = __dirname + "\\Demand Response Data\\" + demandResponseName + "\\";
        dirGraphs = __dirname + "\\Demand Response Data\\" + demandResponseName + "\\Graphs\\";
        dirRawData = __dirname + "\\Demand Response Data\\" + demandResponseName + "\\Raw\\";
        dirCSVData = __dirname + "\\Demand Response Data\\" + demandResponseName + "\\CSV\\";   
        
        app.use(express.static(dirDemandResponse));
        app.use(express.static(dirGraphs));
        app.use(express.static(dirCSVData));
        app.use(express.static(dirRawData));
        
        resolve(true)
    });
}



//Main Program
function runProgram (details) {
    return new Promise(function (resolve, reject) {
            //Main Program Tree
            demandResponseData(details)
            .then(function (sucess) {
            accessAPI()
            .then(function (token) {
            getDemandResponseThermostats(token)
            .then(function (data) {
            getThermostatIDs(data)
            .then(function (data) {
            saveFile("HeirarchySet.json", dirRawData, data) //Writing the Heirarchy Set to File
            .then(function (success) {
            calculateIntervals()
            .then(function (calculation) {
            getThermostatGroups(token)
            .then(function (thermostatData) {
            saveFile("ThermostatData.json", dirRawData, data)
            .then(function (success) {
            importKWFactor()
            .then(function (success) {
            generateThermostatCSV(thermostatData)
            .then(function (thermostatListCSV) {
            saveFile("ThermostatList.csv", dirCSVData, thermostatListCSV)
            .then(function (success) {
            participationData()
            .then(function (success) {
            participationListCSV()
            .then(function (participationSummaryCSV) {
            saveFile("Participating.csv", dirDemandResponse, participatingThermostats.split(",").join("\n"))
            .then(function (success) {
            saveFile("NonParticipating.csv", dirDemandResponse, nonParticipitatingThermostats.split(",").join("\n"))
            .then(function (success) {
            saveFile("OptOut.csv", dirDemandResponse, optOutThermostats.split(",").join("\n"))
            .then(function (success) {
            saveFile("OptOut.csv", dirDemandResponse, optOutThermostats.split(",").join("\n"))
            .then(function (success) {
            saveFile("ChartParticipation.csv", dirGraphs, participationSummaryCSV)
            .then(function (success) {
            getGraphCSVData("Participating", "Temperature")
            .then(function (graphDataCSV) {
            saveFile("Participating Temperatures.csv", dirGraphs, graphDataCSV)
            .then(function (success) {
            getGraphCSVData("Non Participating", "Temperature")
            .then(function (graphDataCSV) {
            saveFile("Non Participating Temperatures.csv", dirGraphs, graphDataCSV)
            .then(function (success) {
            getGraphCSVData("Participating", "Duty Cycle")
            .then(function (graphDataCSV) {
            saveFile("Participating Average Duty Cycle.csv", dirGraphs, graphDataCSV)
            .then(function (success) {
            getGraphCSVData("Non Participating", "Duty Cycle")
            .then(function (graphDataCSV) {
            saveFile("Non Participating Average Duty Cycle.csv", dirGraphs, graphDataCSV)
            .then(function (success) {
            getGraphCSVData("Participating", "Load")
            .then(function (graphDataCSV) {
            saveFile("Participating Average Load.csv", dirGraphs, graphDataCSV)
            .then(function (success) {
            getGraphCSVData("Non Participating", "Load")
            .then(function (graphDataCSV) {
            saveFile("Non Participating Average Load.csv", dirGraphs, graphDataCSV)
            .then(function (success) {
            groupData("Temperature")
            .then(function (temperatures) {
            saveFile("ChartTemperatures.csv", dirGraphs, temperatures[0])
            .then(function (success) {
            groupData("Duty Cycle")
            .then(function (dutyCylceCSV) {
            saveFile("Average Duty Cycles.csv", dirGraphs, dutyCylceCSV[0])
            .then(function (success) {
            groupData("Load")
            .then(function (loadFiles) {
            saveFile("Average Load (kW).csv", dirGraphs, loadFiles[0]);
            saveFile("Average Load (KWh).csv", dirGraphs, loadFiles[1])
            .then(function (success) {
            averageRows("Duty Cycle")
            .then(function (graphDataCSV) {
            saveFile("ChartDutyCycles.csv", dirGraphs, graphDataCSV)
            averageRows("Load kW")
            .then(function (graphDataCSV) {
            saveFile("ChartLoadkW.csv", dirGraphs, graphDataCSV)
            averageRows("Load kWh")
            .then(function (graphDataCSV) {
            saveFile("ChartLoadkWh.csv", dirGraphs, graphDataCSV)
            })
            .catch(function (err) { error = err; })})
            .catch(function (err) { error = err; })})
            .catch(function (err) { error = err; })})
            .catch(function (err) { error = err; })})
            .catch(function (err) { error = err; })})
            .catch(function (err) { error = err; })})
            .catch(function (err) { error = err; })})
            .catch(function (err) { error = err; })})
            .catch(function (err) { error = err; })})
            .catch(function (err) { error = err; })})
            .catch(function (err) { error = err; })})
            .catch(function (err) { error = err; })})
            .catch(function (err) { error = err; })})
            .catch(function (err) { error = err; })})
            .catch(function (err) { error = err; })})
            .catch(function (err) { error = err; })})
            .catch(function (err) { error = err; })})
            .catch(function (err) { error = err; })})
            .catch(function (err) { error = err; })})
            .catch(function (err) { error = err; })})
            .catch(function (err) { error = err; })})
            .catch(function (err) { error = err; })})
            .catch(function (err) { error = err; })})
            .catch(function (err) { error = err; })})
            .catch(function (err) { error = err; })})
            .catch(function (err) { error = err; })})
            .catch(function (err) { error = err; })})
            .catch(function (err) { error = err; })})
            .catch(function (err) { error = err; })})
            .catch(function (err) { error = err; })})
            .catch(function (err) { error = err; })})
            .catch(function (err) { error = err; })})
            .catch(function (err) { error = err; })})
            .catch(function (err) { error = err; })})
            .catch(function (err) { error = err; })})
            .catch(function (err) { error = err; })})
            .catch(function (err) { error = err; })}).then( function () { resolve(true); })
            .catch(function (err) { error = err; })
    });
}



module.exports = app;
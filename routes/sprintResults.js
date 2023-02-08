const express = require("express");
const router = express.Router();
const path = require("path");

let MySQLConfiguration = require("../connection.js");

//Supported Function
function formattedResultsRow(row)
{
    return { 
        number : row.number.toString(),
        position : (row.position != null) ? row.position.toString() : "N/D",
        positionText : row.positionText,
        points : row.points.toString(),
        Driver : {
            driverId: row.driverRef,
            permanentNumber : (row.driverNumber != null) ? row.driverNumber.toString() : "",
            code : (row.code != null) ? row.code : "",
            url: row.driverUrl, 
            givenName : row.forename,
            familyName : row.surname,
            dateOfBirth : row.dob,
            nationality : row.nationality
        },
        Constructor : {
            constructorId: row.constructorRef, 
            url: row.constructorUrl, 
            name : row.constructorName, 
            nationality : row.constructorNationality
        },
        grid : row.grid.toString(),
        laps : row.laps.toString(),
        status : row.status,
        Time : {
            millis : (row.milliseconds != null) ? row.milliseconds.toString() : "",
            time : (row.time != null) ? row.time : ""
        },
        FastestLap : {
            rank : (row.rank != null) ? row.rank.toString() : "N/D",
            lap : (row.fastestLap != null) ? row.fastestLap.toString() : "N/D",
            Time : {
                time : (row.fastestLapTime != null) ? row.fastestLapTime : ""
            },
            AverageSpeed : {
                units : "kph",
                speed : (row.fastestLapSpeed != null) ? row.fastestLapSpeed : "N/D"
            }
        }
    }
}

function heading(row)
{
    return {
        season : row.year.toString(),
        round : row.round.toString(),
        url : row.raceUrl,
        raceName : row.raceName,
        Circuit : {
            circuitId : row.circuitRef,
            url : row.url,
            circuitName : row.name,
            Location : {
                lat : row.lat.toString(),
                long : row.lng.toString(),
                alt : (row.alt != null) ?  row.alt.toString() : "N/D",
                locality : row.location,
                country : row.country
            }
        },
        date : row.raceDate,
        time : (row.raceTime != null) ? row.raceTime + "Z" : "N/D",
        SprintResults : [formattedResultsRow(row)]
    };
}

function formattedRace(rows)
{
    let currentYear = 0;
    let currentRound = 0;
    let sprintResults = [];

    rows.forEach((row) => {
        if(row.year != currentYear || row.round != currentRound)
        {
            currentYear = row.year;
            currentRound = row.round;
            sprintResults.push(heading(row));
            //console.log(currentYear + " " + currentRound);
        }
        else
        {
            sprintResults[sprintResults.length - 1].SprintResults.push(formattedResultsRow(row));
        }
    });
    return sprintResults;
}

router.get("", (req,res) => {

    let offset = (typeof req.query.offset != 'undefined') ? parseInt(req.query.offset) : 0;
    let limit = (typeof req.query.limit != 'undefined') ? parseInt(req.query.limit) : MySQLConfiguration.defaultLimit();

    //START
    let year = null;
    let round = null;
    let constructor = null;
    let circuit = null;
    let driver = null;
    let grid = null;
    let result = null;
    let fastest = null;
    let status = null;
    let driverStandings = null;
    let constructorStandings = null;

    for (const key in req.query) 
    {
        if(key != "offset" && key != "limit" && key != "sql")
        {
            switch(key)
            {
                case "year" : (req.query[key] == "current") ? year = new Date().getFullYear().toString() : year = req.query[key]; break;
                case "round" : round = req.query[key]; break;
                case "constructor" : constructor = req.query[key]; break;
                case "circuit" : circuit = req.query[key]; break;
                case "driver" : driver = req.query[key]; break;
                case "grid" : grid = req.query[key]; break;
                case "result" : result = req.query[key]; break;
                case "fastest" : fastest = req.query[key]; break;
                case "status" : status = req.query[key]; break;
                case "driverStandings" : driverStandings = req.query[key]; break;
                case "constructorStandings" : constructorStandings = req.query[key]; break;
                default : res.status(400).send("Bad Request: Check the get params").end(); return; break;
            }
        }
    }

    if(driverStandings || constructorStandings)
    {
        res.status(400).send("Bad Request: Results queries do not support standings qualifiers.").end();
        return;
    }

    let sql =  `SELECT races.year, races.round, races.name AS 'raceName', DATE_FORMAT(races.date, '%Y-%m-%d') AS 'raceDate', DATE_FORMAT(races.time, '%H:%i:%S') AS 'raceTime', races.url AS 'raceUrl', 
                circuits.circuitRef, circuits.name, circuits.location, circuits.country, circuits.url, circuits.lat, circuits.lng, circuits.alt,
                sprintResults.*,
                drivers.driverRef, drivers.number 'driverNumber', drivers.code, drivers.forename, drivers.surname, DATE_FORMAT(drivers.dob, '%Y-%m-%d') AS 'dob', drivers.nationality, drivers.url AS 'driverUrl',
                status.statusId, status.status,
                constructors.constructorRef, constructors.name AS 'constructorName', constructors.nationality AS 'constructorNationality', constructors.url AS 'constructorUrl'
                FROM races, circuits, sprintResults, drivers, constructors, status
                WHERE races.circuitId=circuits.circuitId AND races.raceId=sprintResults.raceId AND sprintResults.driverId=drivers.driverId AND sprintResults.constructorId=constructors.constructorId AND sprintResults.statusId=status.statusId`;

    //Set the join
    if(year) sql += ` AND races.year='${year}'`;
    if(round) sql += ` AND races.round='${round}'`;
    if(circuit) sql += ` AND circuits.circuitRef='${circuit}'`;
    if(constructor) sql += ` AND constructors.constructorRef='${constructor}'`;
    if(driver) sql += ` AND drivers.driverRef='${driver}'`;
    if(status) sql += ` AND sprintResults.statusId='${status}'`;
    if(grid) sql += ` AND sprintResults.grid='${grid}'`;
    if(result) sql += ` AND sprintResults.positionText='${result}'`;
    sql += ` ORDER BY races.year, races.round, sprintResults.positionOrder LIMIT ${offset}, ${limit}`;


    const conn = MySQLConfiguration.getMySQLConnection();
    conn.query(sql,(err,rows,fields) => {
        if(err){
            console.log("Failed to query for " + __filename.slice(__filename.lastIndexOf(path.sep)+1) + ": "+ err);
            res.status(400).send({error : err.sqlMessage, sql: err.sql}).end();
            return;
        }
        if(req.query.sql=="true")
        {
            res.status(200).send(sql).end();
            return;
        }

        let json = {
            "MRData":{
                "limit":limit.toString(),
                "offset":offset.toString(),
                "RaceTable" : {}
            }
        };

        if(circuit)
            json.MRData.RaceTable.circuitId = circuit;
        if(driver)
            json.MRData.RaceTable.driverId = driver;
        if(constructor)
            json.MRData.RaceTable.constructorId = constructor;
        if(grid)
            json.MRData.RaceTable.grid = grid;
        if(result)
            json.MRData.RaceTable.result = result;
        if(fastest)
            json.MRData.RaceTable.fastest = fastest;
        if(status)
            json.MRData.RaceTable.status = status;
        if(year)
            json.MRData.RaceTable.season = year;
        if(round)
            json.MRData.RaceTable.round = round;

        json.MRData.RaceTable.Races = formattedRace(rows);

        res.json(json);
    });
});
module.exports = router;
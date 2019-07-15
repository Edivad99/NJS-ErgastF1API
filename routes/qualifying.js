const express = require("express");
const router = express.Router();
const path = require("path");

let MySQLConfiguration = require("../connection.js");

//Supported Function
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
        date : row.date,
        time : (row.time != null) ? row.time + "Z" : "N/D",
        QualifyingResults : [formattedQualifyingRow(row)]
    };
}

function formattedQualifyingRow(row)
{
    return { 
        number : row.number.toString(),
        position : row.position.toString(),
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
        Q1 : (row.q1 != null) ? row.q1: "",
        Q2 : (row.q2 != null) ? row.q2 : "",
        Q3 : (row.q3 != null) ? row.q3 : ""
    }
}

function formattedQualifying(rows)
{
    let currentYear = 0;
    let currentRound = 0;
    let QualifyingResults = [];

    rows.forEach((row) => {
        if(row.year != currentYear || row.round != currentRound)
        {
            currentYear = row.year;
            currentRound = row.round;
            QualifyingResults.push(heading(row));
            console.log(currentYear + " " + currentRound);
        }
        else
        {
            QualifyingResults[QualifyingResults.length - 1].QualifyingResults.push(formattedQualifyingRow(row));
        }
    });
    return QualifyingResults;
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
        res.status(400).send("Bad Request: Qualifying queries do not support standings qualifiers.").end();
        return;
    }

    let sql =  `SELECT races.year, races.round, races.name AS 'raceName', DATE_FORMAT(races.date, '%Y-%m-%d') AS 'date', DATE_FORMAT(races.time, '%H:%i:%S') AS 'time', races.url AS 'raceUrl', circuits.*,
                qualifying.number, qualifying.position, qualifying.q1, qualifying.q2, qualifying.q3,
                drivers.driverRef, drivers.number 'driverNumber', drivers.code, drivers.forename, drivers.surname, DATE_FORMAT(drivers.dob, '%Y-%m-%d') AS 'dob', drivers.nationality, drivers.url AS 'driverUrl',
                constructors.constructorRef, constructors.name AS 'constructorName', constructors.nationality AS 'constructorNationality', constructors.url AS 'constructorUrl'
                FROM races, circuits, qualifying, drivers, constructors`;

    if(grid || result || status || fastest) sql += ", results";

    sql += " WHERE races.circuitId=circuits.circuitId AND qualifying.raceId=races.raceId AND qualifying.driverId=drivers.driverId AND qualifying.constructorId=constructors.constructorId";

    //Set the join
    if(grid || result || status || fastest) sql += " AND results.raceId=qualifying.raceId AND results.driverId=qualifying.driverId AND results.constructorId=qualifying.constructorId ";
    if(year) sql += ` AND races.year='${year}'`;
    if(round) sql += ` AND races.round='${round}'`;
    if(circuit) sql += ` AND circuits.circuitRef='${circuit}'`;
    if(constructor) sql += ` AND constructors.constructorRef='${constructor}'`;
    if(driver) sql += ` AND drivers.driverRef='${driver}'`;
    if(status) sql += ` AND results.statusId='${status}'`;
    if(grid) sql += ` AND results.grid='${grid}'`;
    if(fastest) sql += ` AND results.rank='${fastest}'`;
    if(result) sql += ` AND results.positionText='${result}'`;
    sql += ` ORDER BY races.year, races.round, qualifying.position LIMIT ${offset}, ${limit}`;

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

        json.MRData.RaceTable.Races = formattedQualifying(rows);

        res.json(json);
    });
});
module.exports = router;
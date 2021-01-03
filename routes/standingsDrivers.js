const express = require("express");
const router = express.Router();
const path = require("path");

let MySQLConfiguration = require("../connection.js");

//Supported Function

function formattedDriverStandings(row)
{
    return { 
        position : row.position.toString(),
        positionText : row.positionText,
        points : row.points.toString(),
        wins : row.wins.toString(),
        Driver : {
            driverId : row.driverRef,
            permanentNumber : (row.number != null) ? row.number.toString() : "",
            code : (row.code != null) ? row.code : "",
            url : row.url,
            givenName : row.forename,
            familyName : row.surname,
            dateOfBirth : row.dob,
            nationality : row.nationality
        }
    };
}

function heading(row)
{
    return {
        season : row.year.toString(),
        round : row.round.toString(),
        DriverStandings : [formattedDriverStandings(row)]
    };
}

function formattedStandings(rows)
{
    let currentYear = 0;
    let DriverStandings = [];

    rows.forEach((row) => {
        if(row.year != currentYear)
        {
            currentYear = row.year;
            DriverStandings.push(heading(row));
            //console.log(currentYear);
        }
        else
        {
            DriverStandings[DriverStandings.length - 1].DriverStandings.push(formattedDriverStandings(row));
        }
    });
    return DriverStandings;
}

function getConstructors(year,round,driverId,callback)
{
    let sql =  `SELECT DISTINCT c.constructorRef, c.name, c.nationality, c.url 
                FROM constructors c, results re, races ra, drivers d
                WHERE re.raceId=ra.raceId  AND c.constructorId=re.constructorId AND ra.year=${year} AND ra.round<=${round} AND re.driverId=d.driverId AND d.driverRef='${driverId}';`;
    const conn = MySQLConfiguration.getMySQLConnection();
    let constructors =[];
    conn.query(sql,(err,rows,fields) => {
        if(err){
            console.log("Failed to query for " + __filename.slice(__filename.lastIndexOf(path.sep)+1) + ": "+ err);
            res.status(400).send({error : err.sqlMessage, sql: err.sql}).end();
            return;
        }
        rows.forEach(row => {
            constructors.push({
                constructorId : row.constructorRef,
                url : row.url,
                name : row.name,
                nationality : row.nationality
            });
        });
        return callback(constructors);
    });
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

    if(constructor || constructorStandings || circuit || grid || fastest || result || status)
    {
        res.status(400).send("Bad Request: The qualifiers specified are not supported.").end();
        return;
    }

    let sql =  `SELECT DISTINCT drivers.driverId, drivers.driverRef, drivers.number, drivers.code, drivers.forename, drivers.surname, DATE_FORMAT(drivers.dob, '%Y-%m-%d') AS 'dob', drivers.nationality,
                drivers.url, driverStandings.points, driverStandings.position, driverStandings.positionText, driverStandings.wins, races.year, races.round
                FROM drivers, driverStandings, races
                WHERE driverStandings.raceId=races.raceId AND driverStandings.driverId=drivers.driverId`;

    if(driverStandings) sql += ` AND driverStandings.positionText='${driverStandings}'`;
    if(driver) sql += ` AND drivers.driverRef='${driver}'`;
    if(year) sql += ` AND races.year='${year}'`;
    if(round)
    {
        sql += ` AND races.round='${round}'`;
    }
    else
    {
        if(year)
        {
            sql += ` AND races.round=(SELECT MAX(round) FROM driverStandings, races WHERE driverStandings.raceId=races.raceId AND races.year='${year}')`;
        }
        else
        {
            sql += " AND (races.year, races.round) IN (SELECT year, MAX(round) FROM races GROUP BY year)";
        }
    }

    sql += ` ORDER BY races.year, driverStandings.position LIMIT ${offset}, ${limit}`;

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
                "StandingsTable" : {}
            }
        };

        if(driver)
            json.MRData.StandingsTable.driverId = driver;
        if(year)
            json.MRData.StandingsTable.season = year;
        if(round)
            json.MRData.StandingsTable.round = round;
        if(driverStandings)
            json.MRData.StandingsTable.driverStandings = driverStandings;

        json.MRData.StandingsTable.StandingsLists = formattedStandings(rows);
        res.json(json);
    });
});
/*json.MRData.StandingsTable.StandingsLists[0].DriverStandings.forEach(driver => {
                let year = json.MRData.StandingsTable.StandingsLists[0].season;
                let round = json.MRData.StandingsTable.StandingsLists[0].round;
                //driver.Constructor = getConstructors(year,round,driver.Driver.driverId);
                getConstructors(year,round,driver.Driver.driverId,function(result){
                    driver.Constructors = result;
                });
                console.log(driver);
            });*/
module.exports = router;
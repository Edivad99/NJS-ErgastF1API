const express = require("express");
const router = express.Router();
const path = require("path");

let MySQLConfiguration = require("../connection.js");

//Supported Function
function formattedRaces(rows)
{
    if(rows.length > 0)
    {
        return { 
            season : rows[0].year.toString(),
            round : rows[0].round.toString(),
            url: rows[0].url,
            raceName : rows[0].name,
            Circuit : {
                circuitId : rows[0].circuitRef,
                url : rows[0].circuitUrl,
                circuitName : rows[0].circuitName,
                Location : {
                    lat : rows[0].lat.toString(),
                    long : rows[0].lng.toString(),
                    alt :  (rows[0].alt != null) ? rows[0].alt.toString() : "N/D",
                    locality : rows[0].location,
                    country : rows[0].country
                }
            },
            date : rows[0].date,
            time : rows[0].time + "Z",
            Pitstops : formattedPitStops(rows)
        };
    }
    else
        return {};
}

function formattedPitStops(row)
{
    const pitstops = row.map((row) => {
        return { 
            driverId: row.driverRef, 
            lap: row.lap.toString(), 
            stop : row.stop.toString(), 
            time : row.time, 
            duration : row.duration 
        };
    });
    return pitstops;
}

//API 2.0

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
    let pitstop = null;
    let laps = null;

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
                case "pitstop" : pitstop = req.query[key]; break;
                case "laps" : laps = req.query[key]; break;
                default : res.status(400).send("Bad Request: Check the get params").end(); return; break;
            }
        }
    }

    if(driverStandings || constructorStandings)
    {
        res.status(400).send("Bad Request: Pit stop queries do not support standings qualifiers.").end();
        return;
    }
    if(circuit || grid || fastest || result || status || constructor)
    {
        res.status(400).send("Bad Request: Pit stop queries do not support the specified qualifiers.").end();
        return;
    }
    if(!year || !round)
    {
        res.status(400).send("Bad Request: Pit stop queries require a season and round to be specified.").end();
        return;
    }

    let sql =  `SELECT races.year, races.round, races.name, DATE_FORMAT(races.date, '%Y-%m-%d') AS 'date', DATE_FORMAT(races.time, '%H:%i:%S') AS 'time', races.url,
                circuits.*, drivers.driverRef, pitStops.stop, pitStops.lap, pitStops.time, pitStops.duration 
                FROM pitStops, races, circuits, drivers
                WHERE races.circuitId=circuits.circuitId AND pitStops.driverId=drivers.driverId AND pitStops.raceId=races.raceId AND races.year='${year}' AND races.round='${round}'`;

    if(driver) sql += ` AND drivers.driverRef='${driver}'`;
    if(pitstop) sql += ` AND pitStops.stop='${pitstop}'`;
    if(laps) sql += ` AND pitStops.lap='${laps}'`;
    sql += ` ORDER BY pitStops.time LIMIT ${offset}, ${limit}`;

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
                "RaceTable" : {
                    "season" : year,
                    "round" : round
                }
            }
        };

        if(driver!=null)
            json.MRData.RaceTable.driverId = driver;
        if(pitstop)
            json.MRData.RaceTable.stop = pitstop;
        if(laps)
            json.MRData.RaceTable.lap = laps;
        json.MRData.RaceTable.Races = [formattedRaces(rows)];
        res.json(json);
    });
});
module.exports = router;
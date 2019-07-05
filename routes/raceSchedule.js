const express = require("express");
const router = express.Router();
const path = require("path");

let MySQLConfiguration = require("../connection.js");

//Supported Function
function formattedRaces(rows)
{
    return rows.map((row) => {
        return { 
            season : row.year.toString(),
            round : row.round.toString(),
            url: row.url,
            raceName : row.raceName,
            Circuit : {
                circuitId : row.circuitRef,
                url : row.url,
                circuitName : row.name,
                Location : {
                    lat : row.lat.toString(),
                    long : row.lng.toString(),
                    alt :  (row.alt != null) ? row.alt.toString() : "N/D",
                    locality : row.location,
                    country : row.country
                }
            },
            date : row.date,
            time : row.time + "Z"
        };
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

    if(driverStandings || constructorStandings)
    {
        res.status(400).send("Bad Request: Race queries do not support standings qualifiers.").end();
        return;
    }

    let sql = "SELECT races.year, races.round, races.name AS 'raceName', DATE_FORMAT(races.date, '%Y-%m-%d') AS 'date', DATE_FORMAT(races.time, '%H:%i:%S') AS 'time', races.url AS 'raceURL', circuits.* FROM races, circuits";

    if(driver || constructor || grid || result || status || fastest) sql += ", results re";
    if(driver) sql += ", drivers";
    if(constructor) sql += ", constructors";

    sql += " WHERE races.circuitId=circuits.circuitId";
    //Set the join
    if(year) sql += ` AND races.year='${year}'`;
    if(round) sql += ` AND races.round='${round}'`;
    if(circuit) sql += ` AND circuits.circuitRef='${circuit}'`;
    if(driver || constructor || grid || result || status || fastest) sql += " AND races.raceId=results.raceId";
    if(constructor) sql += ` AND results.constructorId=constructors.constructorId AND constructors.constructorRef='${constructor}'`;
    if(driver) sql += ` AND results.driverId=drivers.driverId AND drivers.driverRef='${driver}'`;
    if(status) sql += ` AND results.statusId='${status}'`;
    if(grid) sql += ` AND results.grid='${grid}'`;
    if(fastest) sql += ` AND results.rank='${fastest}'`;
    if(result) sql += ` AND results.positionText='${result}'`;
    sql += ` ORDER BY races.year, races.round LIMIT ${offset}, ${limit}`;

    const conn = MySQLConfiguration.getMySQLConnection();
    conn.query(sql,(err,rows,fields) => {
        if(err){
            console.log("Failed to query for " + __filename.slice(__filename.lastIndexOf(path.sep)+1) + ": "+ err);
            res.status(400).send({error : err.sqlMessage, sql: err.sql}).end();
            return;
        }
        if(req.query.sql=="true")
        {
            res.status(200).send({sql: sql}).end();
            return;
        }

        let json = {
            "MRData":{
                "limit":limit.toString(),
                "offset":offset.toString(),
                RaceTable : {}
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
        json.MRData.RaceTable.Races = formattedRaces(rows);
        res.json(json);
    });

});
module.exports = router;
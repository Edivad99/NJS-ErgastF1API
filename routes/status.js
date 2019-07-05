const express = require("express");
const router = express.Router();
const path = require("path");

let MySQLConfiguration = require("../connection.js");

//Supported Function
function formattedStatus(row)
{
    const status = row.map((row) => {
        return { 
            statusId : row.statusId.toString(),
            count : row.num.toString(),
            status : row.status
        };
    });
    return status;
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
        res.status(400).send("Bad Request: Status queries do not support standings qualifiers.").end();
        return;
    }

    let sql = "SELECT DISTINCT status.statusId, status.status, COUNT(*) AS 'num' FROM status, results";
    if(year || round || circuit) sql += ", races";
    if(driver) sql += ", drivers"
    if(constructor) sql += ", constructors";
    if(circuit) sql += ", circuits";
    sql += " WHERE TRUE";

    //Set the join
    if(status) sql += ` AND status.statusId='${status}'`;
    sql += " AND results.statusId=status.statusId";
    if(year || round || circuit) sql += " AND results.raceId=races.raceId";
    if(constructor) sql += ` AND results.constructorId=constructors.constructorId AND constructors.constructorRef='${constructor}'`;
    if(driver) sql += ` AND results.driverId=drivers.driverId AND drivers.driverRef='${driver}'`;
    if(circuit) sql += ` AND races.circuitId=circuits.circuitId AND circuits.circuitRef='${circuit}'`;
    if(grid) sql += ` AND results.grid='${grid}'`;
    if(fastest) sql += ` AND results.rank='${fastest}'`;
    if(result) sql += ` AND results.positionText='${result}'`;
    if(year) sql += ` AND races.year='${year}'`;
    if(round) sql += ` AND races.round='${round}'`;

    sql += ` GROUP BY status.statusId ORDER BY status.statusId LIMIT ${offset}, ${limit}`;
    
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
                "StatusTable" : {}
            }
        };

        if(circuit)
            json.MRData.StatusTable.circuitId = circuit;
        if(driver)
            json.MRData.StatusTable.driverId = driver;
        if(constructor)
            json.MRData.StatusTable.constructorId = constructor;
        if(grid)
            json.MRData.StatusTable.grid = grid;
        if(result)
            json.MRData.StatusTable.result = result;
        if(fastest)
            json.MRData.StatusTable.fastest = fastest;
        if(status)
            json.MRData.StatusTable.status = status;
        if(year)
            json.MRData.StatusTable.season = year;
        if(round)
            json.MRData.StatusTable.round = round;
        
        json.MRData.StatusTable.Status = formattedStatus(rows);
        res.json(json);
    });
});
module.exports = router;
const express = require("express");
const router = express.Router();
const path = require("path");

let MySQLConfiguration = require("../connection.js");

//Supported Function
function formattedDriver(row)
{
    const driver = row.map((row) => {
        return { 
            driverId: row.driverRef,
            permanentNumber : (row.number != null) ? row.number.toString() : "",
            code : (row.code != null) ? row.code : "",
            url: row.url, 
            givenName : row.forename,
            familyName : row.surname,
            dateOfBirth : row.date,
            nationality : row.nationality
        };
    });
    return driver;
}

// /drivers
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

    if((driverStandings || constructorStandings) && (circuit || grid || result || status))
    {
        res.status(400).send("Bad Request: Cannot combine standings with circuit, grid, result or status qualifiers.").end();
        return;
    }

    let sql = "SELECT DISTINCT drivers.*,DATE_FORMAT(dob, '%Y-%m-%d') AS 'date' FROM drivers ";
    if(year || constructor || status || grid || result || circuit || fastest) sql += ", results";
    if(year || circuit || driverStandings || constructorStandings) sql += ", races";
    if(driverStandings || constructorStandings) sql += ", driverStandings"
    if(constructorStandings) sql += ", constructorStandings";
    if(circuit) sql += ", circuits";
    if(constructor) sql += ", constructors";

    sql+= " WHERE TRUE";
    //Set the join
    if(driverStandings || constructorStandings)
    {
        if(year || constructor) sql += " AND drivers.driverId=results.driverId";
        if(year) sql += " AND results.raceId=races.raceId";
        if(constructor) sql += ` AND results.constructorId=constructors.constructorId AND constructors.constructorRef='${constructor}'`;
        if(driver) sql += ` AND drivers.driverRef='${driver}'`;

        if(driverStandings) sql += ` AND driverStandings.positionText='${driverStandings}'`;
        if(driverStandings || constructorStandings) sql += " AND driverStandings.raceId=races.raceId";
        if(driverStandings || constructorStandings) sql += " AND drivers.driverId=driverStandings.driverId";
        if(constructorStandings) sql += ` AND constructorStandings.raceId=races.raceId AND constructorStandings.positionText='${constructorStandings}'`;
        if(constructor && constructorStandings) sql += " AND constructors.constructorId=constructorStandings.constructorId";
    }
    else
    {
        if(year || constructor || status || grid || result || circuit || fastest) sql += " AND drivers.driverId=results.driverId";
        if(year || circuit) sql += " AND results.raceId=races.raceId";
        if(circuit) sql += ` AND races.circuitId=circuits.circuitId AND circuits.circuitRef='${circuit}'`;
        if(constructor) sql += ` AND results.constructorId=constructors.constructorId AND constructors.constructorRef='${constructor}'`;
        if(status) sql += ` AND results.statusId='${status}'`;
        if(grid) sql += ` AND results.grid='${grid}'`;
        if(fastest) sql += ` AND results.rank='${fastest}'`;
        if(result) sql += ` AND results.positionText='${result}'`;
        if(driver) sql += ` AND drivers.driverRef='${driver}'`;
    }

    if(year) sql += ` AND races.year='${year}'`;
    if(round)
    {
        sql += ` AND races.round='${round}'`;
    }
    else
    {
        if(driverStandings || constructorStandings)
        {
            if(year)
            {
                sql += ` AND races.round=(SELECT MAX(round) FROM races WHERE races.year='${year}')`;
            }
            else
            {
                sql += " AND (races.year, races.round) IN (SELECT year, MAX(round) FROM races GROUP BY year)";
            }
        }
    }
    sql += ` ORDER BY drivers.surname LIMIT ${offset}, ${limit}`;
    
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
                "DriverTable" : {}
            }
        };

        if(circuit)
            json.MRData.DriverTable.circuitId = circuit;
        if(driver)
            json.MRData.DriverTable.driverId = driver;
        if(constructor)
            json.MRData.DriverTable.constructorId = constructor;
        if(grid)
            json.MRData.DriverTable.grid = grid;
        if(result)
            json.MRData.DriverTable.result = result;
        if(fastest)
            json.MRData.DriverTable.fastest = fastest;
        if(status)
            json.MRData.DriverTable.status = status;
        if(year)
            json.MRData.DriverTable.season = year;
        if(round)
            json.MRData.DriverTable.round = round;
        if(constructorStandings)
            json.MRData.DriverTable.constructorStandings = constructorStandings;
        if(driverStandings)
            json.MRData.DriverTable.driverStandings = driverStandings;
        
        json.MRData.DriverTable.Drivers = formattedDriver(rows);
        res.json(json);
    });
});
module.exports = router;
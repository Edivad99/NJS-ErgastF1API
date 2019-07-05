const express = require("express");
const router = express.Router();
const path = require("path");

let MySQLConfiguration = require("../connection.js");


//Supported Function
function formattedConstructor(row)
{
    const constructor = row.map((row) => {
        return { 
            constructorId: row.constructorRef, 
            url: row.url, 
            name : row.name, 
            nationality : row.nationality 
        };
    });
    return constructor;
}
// /constructors
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

    let sql = `SELECT DISTINCT constructors.* FROM constructors`;
    if(year || driver || status || grid || result || circuit || fastest) sql += ", results";
    if(year || circuit || driverStandings || constructorStandings) sql += ", races";
    if(driverStandings || (constructorStandings && driver)) sql += ", driverStandings"
    if(constructorStandings) sql += ", constructorStandings";
    if(circuit) sql += ", circuits";
    if(driver) sql += ", drivers";
    
    sql+= " WHERE TRUE";
    //Set the join
    if(year || driver || status || grid || result || circuit || fastest) sql += ` AND constructors.constructorId = results.constructorId`;
    if(year || circuit) sql += " AND results.raceId=races.raceId";
    if(circuit) sql += ` AND races.circuitId=circuits.circuitId AND circuits.circuitRef='${circuit}'`;
    if(driver) sql += ` AND results.driverId=drivers.driverId AND drivers.driverRef='${driver}'`;
    if(status) sql += ` AND results.statusId='${status}'`;
    if(grid) sql += ` AND results.grid='${grid}'`;
    if(fastest) sql += ` AND results.rank='${fastest}'`;
    if(result) sql += ` AND results.positionText='${result}'`;
    if(constructor) sql += ` AND constructors.constructorRef='${constructor}'`;

    if(driverStandings) sql += ` AND driverStandings.positionText='${driverStandings}' AND driverStandings.constructorId=constructors.constructorId`;
    if(driverStandings || (constructorStandings && driver)) sql += ` AND driverStandings.raceId=races.raceId`;
    if((driverStandings || constructorStandings) && driver) sql += ` AND drivers.driverId=driverStandings.driverId`;
    if(constructorStandings) sql += ` AND constructorStandings.positionText='${constructorStandings}' AND constructorStandings.constructorId=constructors.constructorId AND constructorStandings.raceId=races.raceId`;
    if(constructorStandings && driver) sql += ` AND driverStandings.constructorId=constructorStandings.constructorId`;

    
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
                sql += ` AND races.round=(SELECT MAX(round) FROM races WHERE races.year='${year}')`;
            else
                sql += ` AND (races.year, races.round) IN (SELECT year, MAX(round) FROM races GROUP BY year)`;
        }
    }
    sql += ` ORDER BY constructors.name LIMIT ${offset}, ${limit}`;

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
                "ConstructorTable" : {}
            }
        };

        if(circuit)
            json.MRData.ConstructorTable.circuitId = circuit;
        if(driver)
            json.MRData.ConstructorTable.driverId = driver;
        if(constructor)
            json.MRData.ConstructorTable.constructorId = constructor;
        if(grid)
            json.MRData.ConstructorTable.grid = grid;
        if(result)
            json.MRData.ConstructorTable.result = result;
        if(fastest)
            json.MRData.ConstructorTable.fastest = fastest;
        if(status)
            json.MRData.ConstructorTable.status = status;
        if(year)
            json.MRData.ConstructorTable.season = year;
        if(round)
            json.MRData.ConstructorTable.round = round;
        if(constructorStandings)
            json.MRData.ConstructorTable.constructorStandings = constructorStandings;
        if(driverStandings)
            json.MRData.ConstructorTable.driverStandings = driverStandings;
        
        json.MRData.ConstructorTable.Constructors = formattedConstructor(rows);
        res.json(json);
    });
});
module.exports = router;
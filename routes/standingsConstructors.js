const express = require("express");
const router = express.Router();
const path = require("path");

let MySQLConfiguration = require("../connection.js");

//Supported Function
function formattedConstructorStandings(row)
{
    return { 
        position : row.position.toString(),
        positionText : row.positionText,
        points : row.points.toString(),
        wins : row.wins.toString(),
        Constructor : {
            constructorId : row.constructorRef,
            url : row.url,
            name : row.name,
            nationality : row.nationality
        }
    };
}

function heading(row)
{
    return {
        season : row.year.toString(),
        round : row.round.toString(),
        ConstructorStandings : [formattedConstructorStandings(row)]
    };
}

function formattedStandings(rows)
{
    let currentYear = 0;
    let ConstructorStandings = [];

    rows.forEach((row) => {
        if(row.year != currentYear)
        {
            currentYear = row.year;
            ConstructorStandings.push(heading(row));
            //console.log(currentYear);
        }
        else
        {
            ConstructorStandings[ConstructorStandings.length - 1].ConstructorStandings.push(formattedConstructorStandings(row));
        }
    });
    return ConstructorStandings;
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

    if(driver || driverStandings || circuit || grid || fastest || result || status)
    {
        res.status(400).send("Bad Request: The qualifiers specified are not supported.").end();
        return;
    }

    let sql = `SELECT constructors.constructorRef, constructors.name, constructors.nationality, constructors.url, constructorStandings.points,
                constructorStandings.position, constructorStandings.positionText, constructorStandings.wins, races.year, races.round
                FROM constructors, constructorStandings, races
                WHERE constructorStandings.raceId=races.raceId AND constructorStandings.constructorId=constructors.constructorId`;
    
    if(constructorStandings) sql += ` AND constructorStandings.positionText='${constructorStandings}'`;
    if(constructor) sql += ` AND constructors.constructorRef='${constructor}'`;
    if(year) sql += ` AND races.year='${year}'`;
    if(round)
    {
        sql += ` AND races.round='${round}'`;
    }
    else
    {
        if(year)
            sql += ` AND races.round=(SELECT MAX(round) FROM driverStandings, races WHERE driverStandings.raceId=races.raceId AND races.year='${year}')`;
        else
            sql += " AND (races.year, races.round) IN (SELECT year, MAX(round) FROM races GROUP BY year)";
    }

    sql += ` ORDER BY races.year, constructorStandings.position LIMIT ${offset}, ${limit}`;

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
                "StandingsTable" : {}
            }
        };

        
        if(constructor)
            json.MRData.StandingsTable.constructorId = constructor;
        if(year)
            json.MRData.StandingsTable.season = year;
        if(round)
            json.MRData.StandingsTable.round = round;
        if(constructorStandings)
            json.MRData.StandingsTable.constructorStandings = constructorStandings;

        json.MRData.StandingsTable.StandingsLists = formattedStandings(rows);
        res.json(json);
    });
});
module.exports = router;
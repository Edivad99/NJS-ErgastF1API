const express = require("express");
const app = express();
const cors = require("cors");

const morgan = require("morgan");
app.use(morgan("dev"));
const PORT = 8732;

app.use(cors()); //TODO: make this configurable to limit access to known consumers?

const routesDrivers = require("./routes/drivers.js");
const routesConsturctors = require("./routes/constructors.js");
const routesPitStop = require("./routes/pitstops.js");
const routesLaps = require("./routes/laps.js");
const routesStandingConstructors = require("./routes/standingsConstructors.js");
const routesStandingDrivers = require("./routes/standingsDrivers.js");
const routesRaceSchedule = require("./routes/raceSchedule.js");
const routesStatus = require("./routes/status.js");
const routesCircuit = require("./routes/circuits.js");
const routesSeason = require("./routes/season.js");
const routesQualifying = require("./routes/qualifying.js");
const routesRaceResults = require("./routes/raceResults.js");

//add Filters
app.use("/drivers", routesDrivers);//DONE
app.use("/constructors", routesConsturctors);//DONE
app.use("/pitstops", routesPitStop);//DONE
app.use("/laps", routesLaps);//DONE
app.use("/standings/constructors", routesStandingConstructors);//DONE
app.use("/standings/drivers",routesStandingDrivers);//DONE BUT THE PART OF CONSTRUCTORS IS MISSING
app.use("/races",routesRaceSchedule);//DONE
app.use("/status",routesStatus);//DONE
app.use("/circuits", routesCircuit);//DONE
app.use("/seasons",routesSeason);//DONE
app.use("/qualifying",routesQualifying);//DONE
app.use("/results",routesRaceResults);//DONE

//TODO: add last and next params


app.get("", (req,res) => {
    res.status(200).send("Hi!");
});

app.use(function(req, res, next) {
    res.status(404).send("<h3>Bad Request</h3>");
});

app.listen(PORT,() => {
    console.log(`Server is listening on port ${PORT}`);
});
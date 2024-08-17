const winston = require("winston");

const now = new Date().toISOString();

// Turn into windows friendly file name
// 2021-06-30T15:00:00.000Z -> 2021-06-30T15-00-00-000Z
const windowsFriendlyNow = now.replace(/:/g, "-").replace(".", "-");

const logger = winston.createLogger({
  level: "info",
  format: winston.format.combine(
    winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss.SSS" }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({
      filename: `./logs/${windowsFriendlyNow}.log`,
    }),
  ],
});

function setBody(req, res, context, next) {
  // Set empirisN in the url query
  const url = new URL(req.url);

  req.url = url.toString();

  req.body = JSON.stringify({
    empiris_0: {},
    empiris_1: {},
  });

  return next();
}

let i = 0;

function trackResponseTimeWithoutQueueTime(req, res, context, events, done) {
  // Ignore the first 10 requests as warm-up
  if (i++ < 10) {
    return done();
  }

  const {
    processId: empiris0ProcessId,
    isColdStart: empiris0IsColdStart,
    duration: empiris0Duration,
  } = JSON.parse(res.body).empiris_0;

  const {
    processId: empiris1ProcessId,
    isColdStart: empiris1IsColdStart,
    duration: empiris1Duration,
  } = JSON.parse(res.body).empiris_1;

  // Idling in milliseconds
  const idlingInQueue = parseFloat(res.headers["idling-in-queue"]);

  const lambda0ResponseTime = parseFloat(res.headers["lambda0-response-time"]);

  events.emit("histogram", `empiris_0_response_time`, empiris0Duration);
  events.emit("histogram", `empiris_0_idling_queue`, idlingInQueue);

  const lambda1ResponseTime = parseFloat(res.headers["lambda1-response-time"]);

  logger.info(
    `A - Response Time: ${empiris0Duration}ms, processId: ${empiris0ProcessId}, isColdStart: ${empiris0IsColdStart}, idlingInQueue: ${idlingInQueue}ms | B - Response Time: ${empiris1Duration}ms, processId: ${empiris1ProcessId}, isColdStart: ${empiris1IsColdStart}, idlingInQueue: ${idlingInQueue}ms`
  );

  events.emit("histogram", `empiris_1_response_time`, empiris1Duration);
  events.emit("histogram", `empiris_1_idling_queue`, idlingInQueue);

  return done();
}

module.exports = { trackResponseTimeWithoutQueueTime, setBody };

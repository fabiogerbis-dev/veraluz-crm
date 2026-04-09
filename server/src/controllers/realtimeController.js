const { subscribeToRealtimeStream } = require("../services/realtimeService");

function stream(req, res) {
  subscribeToRealtimeStream(req, res, req.user);
}

module.exports = {
  stream,
};

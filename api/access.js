// Retired — logins were removed in V25. Kept only so old deploys do not 404.
module.exports = function handler(req, res) { res.statusCode = 302; res.setHeader("Location", "/"); res.end(); };

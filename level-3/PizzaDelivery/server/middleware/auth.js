const jwt = require("jsonwebtoken");

function verifyAdmin(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      message: "Access denied. Admin login required.",
    });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (decoded.role !== "admin") {
      return res.status(403).json({
        message: "Admin access required.",
      });
    }

    req.admin = decoded;
    next();
  } catch {
    return res.status(401).json({
      message: "Invalid or expired token. Please log in again.",
    });
  }
}

module.exports = verifyAdmin;

const jwt = require("jsonwebtoken");

const auth = (req, res, next) => {
  try {
    // Check if Authorization header exists
    if (!req.headers.authorization) {
      return res.status(401).json({ message: "No authorization header" });
    }

    const token = req.headers.authorization.split(" ")[1];
    if (!token) {
      return res.status(401).json({ message: "No token provided" });
    }

    // Verify the token
    const decodedToken = jwt.verify(token, process.env.JWT_SECRET);

    // Log the decoded token for debugging
    console.log("Auth middleware decoded token:", decodedToken);

    // Set the user object on the request with _id property
    // This ensures compatibility whether the token has id or _id
    req.user = {
      _id: decodedToken.id || decodedToken._id,
      ...decodedToken,
    };

    console.log("User set in request:", req.user);

    next();
  } catch (error) {
    console.error("Auth middleware error:", error);
    return res.status(401).json({ message: "Authentication failed" });
  }
};

module.exports = auth;

const ensureAuthenticated = (req, res, next) => {
    if (req.isAuthenticated())
      return next();
    else
    return res.redirect("/auth/local");
  };

  const redirectIfAuthenticated = (req, res, next) => {
    if (req.isAuthenticated()) {
      return res.redirect("/projects"); // ✅ Redirect to dashboard if already logged in
    }
    next();
  };

  const pageNotFound = (req, res, next) => {
    if (!req.isAuthenticated()) {
      return res.redirect("/auth/local");
    }
    const page = {
      title: "404 Not Found"
    };
    res.locals.page = page;
    const error = new Error("Not Found");
    error.status = 404;
    next(error);
  }

  const errorHandlingMiddleware = (err, req, res, next) => {
    // Default status code for unhandled errors
    let statusCode = 500;
    let errorMessage = "Internal Server Error";
    // Check if the error has a specific status code and message
    if (err.status) {
        statusCode = err.status;
        errorMessage = err.message;
    }
    const page = {
      title: "Error"
    };
    res.locals.page = page;
  
    // Log the error stack trace
    //console.error(err.stack);
  
    // Content negotiation based on request Accept header
    const acceptHeader = req.get('Accept');
  
    if (acceptHeader === 'application/json') {
        // Respond with JSON
        res.status(statusCode).json({ message: errorMessage });
    } else {
        // Respond with HTML (rendering an error page)
        res.status(statusCode).render('errors/error', { statusCode, errorMessage });
    }
  };

module.exports = { ensureAuthenticated, pageNotFound, errorHandlingMiddleware, redirectIfAuthenticated };
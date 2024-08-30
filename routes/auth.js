// authRoutes.js

const express = require('express');
const passport = require('../passport'); // Require the passport module

const { deleteLocalProjectsAndAccounts, retrieveOrCreateUser, updateDefaultPassword, getDefaultPassword } = require('../controllers/user');
const { getHubspotUser, getHubspotProfile } = require('../controllers/hubspot');
const { ensureAuthenticated } = require('../middleware/auth');
const { getUserProjects } = require('../controllers/project');

const router = express.Router();

async function processLogin(req, res) {
  try {
    const profile = req.session.passport ? req.session.passport.user : req.session.user;
    const user = await retrieveOrCreateUser(profile);

    // Update last login data
    user.lastLoginFormatted = user.lastLogin.toLocaleString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric' });
    user.lastLogin = new Date();
    user.loginCount = user.loginCount + 1;

    // Save the user
    await user.save();

    req.session.passport.user.id = user._id;

    if (req.session.authMethod !== 'local') {
      await getHubspotUser(user._id,user.email);
    }

  } catch (error) {
    console.log(error);
  }
}

// Authentication route for Google
router.get('/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

// Authentication route for Django
router.get('/django',
  passport.authenticate('django')
);

// Callback endpoint for Google authentication
router.get('/google/callback',
  passport.authenticate('google', { failureRedirect: '/error' }),
  async (req, res) => {
    req.session.authMethod = 'google';
    // Successful authentication, redirect to profile page or wherever needed
    await processLogin(req);
    res.redirect('/projects');
  }
);

// Callback endpoint for Django authentication
router.get('/django/callback',
  passport.authenticate('django', { failureRedirect: '/error' }),
  async (req, res) => {
    req.session.authMethod = 'django';
    await processLogin(req);
    res.redirect('/projects');
  }
);

// Authentication route for local accounts
router.post('/local',
  passport.authenticate('local', { failureRedirect: '/login', failureFlash: true }),
  async (req, res) => {
    req.session.authMethod = 'local';
    await processLogin(req);
    res.redirect('/projects');
  }
);

// Render local login page
router.get('/local', (req, res) => {
  res.render('pages/auth/localLogin', {
    page: {
      title: 'Local Login',
      link: '/login'
    }
  });
});

// Route to render reset password page for local users
router.get('/local/reset-password', ensureAuthenticated,  (req, res) => {
  res.render('pages/auth/changeLocalPassword', {
    page: {
      title: 'Reset Local Account Password',
      link: '/reset-password'
    }
  });
});

// Get local password
router.get('/local/password', ensureAuthenticated, async (req, res) => {
  let currentPassword = await getDefaultPassword();
  res.json({ currentPassword: currentPassword });
});

// Route to handle password reset
router.post('/local/password', ensureAuthenticated, async (req, res, next) => {
  const { newPassword } = req.body;
  try {
    // Delete all local projects and accounts before updating the password
    await deleteLocalProjectsAndAccounts();

    // Update local accounts password
    await updateDefaultPassword(newPassword);

    res.status(200).json({ message: 'Password reset successfully and previous local users and projects deleted.' });
  } catch (error) {
    console.log(error);
    res.status(500).send('Internal Server Error');
  }
});

router.get('/profile', ensureAuthenticated, async (req, res) => {
  res.locals.userProfile = await retrieveOrCreateUser(res.locals.user);
  res.locals.userProfile.hubspot = await getHubspotProfile(res.locals.userProfile.id);
  const page = {
    title: "Profile page",
    link: "/profile"
  };
  res.locals.page = page;
  res.render('pages/auth/profile');
});

router.delete('/profile', ensureAuthenticated, async (req, res, next) => {
  try {
      // Get the user ID from the authenticated user
      const userId = req.session.passport.user.id;

      // Check if the user has any projects
      const userProjects = await getUserProjects(userId);
      const ownedProjects = userProjects.ownedProjects;

      if (ownedProjects.length === 0) {
          // If the user has no projects, delete the user
          await deleteUser(userId)
          res.status(200).json({ message: "User deleted successfully." });
      } else {
          // If the user has projects, send a message indicating deletion is not allowed
          res.status(403).json({ error: "User cannot be deleted because they have projects. Please delete all owned projects first." });
      }
  } catch (error) {
      next(error);
  }
});

module.exports = router;
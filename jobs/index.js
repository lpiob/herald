const path = require('path');

module.exports = [
  { 
    name: "refreshUsersAtStart",
    path: path.join(__dirname, 'refreshUsers.js')
  },
  { 
    name: "refreshUsers2h",
    interval: "every 2 hours",
    path: path.join(__dirname, 'refreshUsers.js')
  }
];

// vim: set shiftwidth=2 softtabstop=2 expandtab:
//

const { App } = require('@slack/bolt');
const { parentPort } = require('worker_threads');
const advisoryLock = require('advisory-lock');
const mutex = advisoryLock.default(process.env.DATABASE_URL)("refreshUsers");
var HeraldDb = require('../models/HeraldDb');
const app = new App({
  clientId: process.env.SLACK_CLIENT_ID,
  clientSecret: process.env.SLACK_CLIENT_SECRET,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  stateSecret: process.env.SLACK_STATE_SECRET,
  scopes: ["chat:write", "users:read"],
});

async function listUsers(token) {
  return await fetchUsers(user => {
    if (user.is_bot) return false;
    if (user.is_ultra_restricted) return false;
    if (user.profile.guest_expiration_ts) return false;   // skip active guests
    if ('guest_invited_by' in user.profile) return false; // skip inactive guests
    return true;
  }, token);
}

async function fetchUsers(filterCondition, token) {
  let cursor;
  const users = [];

  do {
    const result = await app.client.users.list({
      token: token,
      cursor: cursor
    });

    const filteredUsers = result.members.filter(filterCondition);
    users.push(...filteredUsers);
    cursor = result.response_metadata.next_cursor;
  } while (cursor);

  return users;
}


async function main(){
  var promises = []
  const lock = await mutex.tryLock();
  if (!lock) {
    // console.log("Could not aquire lock, exiting.");
  } else {
    // let's do the job
    var db = new HeraldDb().getInstance();
    
    var taskStatus;
    // slackTopicUpdate
    // we repeat that for every SlackInstallation that has a designatedchannel
    const installs = await db.SlackInstallation.findAll({where: {designatedchannel: {[db.Op.ne]: null}}});
    for (const install of installs) {
      taskStatus = await db.PeriodicTask.findOne({where: {name: 'refreshUsers:'+install.key}});
      if (!taskStatus || taskStatus.lastExecution < Date.now() - 2 * 60*60*1000) { // >2h, effectively every 3 hours
        promises.push(updateSlackUserState(install.key));
        promises.push(db.PeriodicTask.upsert({name: 'refreshUsers:'+install.key, lastExecution: Date.now()}));
      }
    }
  }
  await Promise.all(promises)
  parentPort.postMessage('done');
}

main();

async function updateSlackUserState(installation){
  var db = new HeraldDb().getInstance();
  // fetch the designated channel from the slackinstallations sequelize model
  const slackInstallation = await db.SlackInstallation.findOne({where: {key: installation}});
  if (!slackInstallation || !slackInstallation.designatedchannel) {
    console.error("No designated channel for installation ", installation);
    return Promise.resolve(); 
  }

  // fetch users from db
  const dbUsers = await db.sequelize.query(
      `
       SELECT
        "slackId",
        "currentState",
        "lastStateChange",
        "lastAnnouncement" 
      FROM userstates 
      WHERE "slackTeamId"=:installation
      `,
      {
        replacements: { installation: installation, },
        type: db.sequelize.QueryTypes.SELECT
      }
    )
  const dbUsersDict = dbUsers.reduce((acc, user) => {
    acc[user.slackId] = user;
    return acc;
  }, {});


  // fetch the current active users from Slack
  const slackUsers = await listUsers(slackInstallation.installation.bot.token);
  for (const su of slackUsers) {    
    //console.log(user.id, user.team_id, user.profile.real_name, user.profile.title);
    if (!su.blocked && !su.deleted && !(su.id in dbUsersDict)) {
      console.log(su.id, "registered as new user in init state");
      await db.UserStates.upsert({
        slackId: su.id,
        slackTeamId: su.team_id,
        currentState: "init", // see README.md for description
        lastStateChange: Date.now()
      });
    } else if (!su.blocked && !su.deleted && su.id in dbUsersDict && !su.is_invited_user && dbUsersDict[su.id].currentState=="init") {
      console.log(su.id, "state change init->active");
      await db.UserStates.upsert({
        slackId: su.id,
        slackTeamId: su.team_id,
        currentState: "active", // see README.md for description
        lastStateChange: Date.now()
      });
      // send a welcome message!
      await app.client.chat.postMessage({
        token: slackInstallation.installation.bot.token,
        channel: slackInstallation.designatedchannel,
        text: `:peepoenter: <@${su.id}>`
      });
    } else if ((su.blocked || su.deleted) && su.id in dbUsersDict && dbUsersDict[su.id].currentState=="active") {
      console.log(su.id, "state change active->inactive");
      await db.UserStates.upsert({
        slackId: su.id,
        slackTeamId: su.team_id,
        currentState: "inactive", // see README.md for description
        lastStateChange: Date.now()
      });
      // send a farewell message!
      await app.client.chat.postMessage({
        token: slackInstallation.installation.bot.token,
        channel: slackInstallation.designatedchannel,
        text: `:peepoexit: <@${su.id}>`
      });

    } else if (!su.blocked && !su.deleted && su.id in dbUsersDict && dbUsersDict[su.id].currentState=="inactive") {
      console.log(su.id, "state change inactive->active");
      await db.UserStates.upsert({
        slackId: su.id,
        slackTeamId: su.team_id,
        currentState: "active", // see README.md for description
        lastStateChange: Date.now()
      });
      // send a welcome back message!
      await app.client.chat.postMessage({
        token: slackInstallation.installation.bot.token,
        channel: slackInstallation.designatedchannel,
        text: `:peepoenter: <@${su.id}>`
      });
    }
  }

  await db.PeriodicTask.upsert({name: "refreshUsers:"+installation, lastExecution: Date.now()});
  return Promise.resolve();
}


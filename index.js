const { App } = require('@slack/bolt');

var Bree = require('bree');
const bree = new Bree({
  // will read job definitions from jobs/index.js
});

(async () => {
  await bree.start();
})();

var SlackInstalls = require('./models/SequelizeInstallationStore');  

const app = new App({
  clientId: process.env.SLACK_CLIENT_ID,
  clientSecret: process.env.SLACK_CLIENT_SECRET,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  stateSecret: process.env.SLACK_STATE_SECRET,
  installerOptions: {
    directInstall: true // allow installation directly at /slack/install
  },
  installationStore: { 
    storeInstallation: async (installation) => {
      if (installation.isEnterpriseInstall && installation.enterprise !== undefined) {
        return await SlackInstalls.set(installation.enterprise.id, installation);
      }
      if (installation.team !== undefined) {
        return await SlackInstalls.set(installation.team.id, installation);
      }
      throw new Error('Failed saving installation data to installationStore');
    },
    fetchInstallation: async (installQuery) => {
      if (installQuery.isEnterpriseInstall && installQuery.enterpriseId !== undefined) {
        return await SlackInstalls.get(installQuery.enterpriseId);
      }
      if (installQuery.teamId !== undefined) {
        return await SlackInstalls.get(installQuery.teamId);
      }
      throw new Error('Failed fetching installation');
    },
    deleteInstallation: async (installQuery) => {
      if (installQuery.isEnterpriseInstall && installQuery.enterpriseId !== undefined) {
        return await SlackInstalls.delete(installQuery.enterpriseId);
      }
      if (installQuery.teamId !== undefined) {
        return await SlackInstalls.delete(installQuery.teamId);
      }  
      throw new Error('Failed to delete installation');
    },
  },
  scopes: ["chat:write", "users:read"],
});

(async () => {
  // Start your app
  await app.start(process.env.PORT || 3000);
  console.log('⚡️ Bolt app is running!');

  //console.log(await listAllUsers());

})();

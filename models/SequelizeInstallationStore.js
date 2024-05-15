// Based on
// https://slack.dev/bolt-js/concepts#authorization
// https://github.com/seratch/slack-bolt-extensions/blob/main/packages/bolt-sequelize/src/SequelizeInstallationStore.ts

var HeraldDb = require('../models/HeraldDb');
var db = new HeraldDb().getInstance();
db.connect();

const database = {
  async get(key) { 
    const value = await db.SlackInstallation.findOne({ where: { key: key } });
    return value.installation;
  },
  async delete(key) {
    await db.SlackInstallation.destroy({ where: { key: key } });
    return true;
  },
  async set(key, value) {
    await db.SlackInstallation.upsert({ key: key, installation: value });
    return true;
  }
};

module.exports = database;


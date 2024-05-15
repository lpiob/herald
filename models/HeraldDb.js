// vim: set shiftwidth=2 softtabstop=2 expandtab:

const { Sequelize, DataTypes, Op } = require('sequelize');

class HeraldDb {
  constructor() {
    var sequelize = new Sequelize(process.env.DATABASE_URL, {
      pool: {
        max: 5,
        min: 1
      }
    });

    const UserStates = sequelize.define('userstates', {
      slackId: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      slackTeamId: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      currentState: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      lastStateChange: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      lastAnnouncement: {
        type: DataTypes.DATE,
        allowNull: true,
      }
    },{
        indexes: [
          {
            unique: true,
            fields: ['slackId', 'slackTeamId'],
          }
        ]
    });

    const PeriodicTask = sequelize.define('periodictask', {
      name: {
        type: DataTypes.STRING,
        allowNull: false,
        primaryKey: true
      },
      lastExecution: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },
      state: {
        type: DataTypes.JSONB,
        allowNull: true
      }
    });
    
    const SlackInstallation = sequelize.define('slackinstallation', {
      key: {
        type: DataTypes.STRING,
        allowNull: false,
        primaryKey: true
      },
      installation: {
        type: DataTypes.JSONB,
        allowNull: false,
      },
      designatedchannel: {
        type: DataTypes.STRING,
        allowNull: true
      }
    });

    this.UserStates = UserStates;
    this.PeriodicTask = PeriodicTask;
    this.SlackInstallation = SlackInstallation;
    this.sequelize = sequelize;
    this.Op = Op; // sequelize operators, https://sequelize.org/docs/v6/core-concepts/model-querying-basics/
  }


  async connect() {
    try {
      await this.sequelize.authenticate();
      console.log('DB connection has been established successfully.');
    } catch (error) {
      console.error('Unable to connect to the database:', error);
    }

    // create and sync tables
    try {
      await this.sequelize.sync();
    } catch (error) {
      console.error('Unable to sync tables:', error);
    }
  }
}

class Singleton {

  constructor() {
      if (!Singleton.instance) {
          Singleton.instance = new HeraldDb();
      }
  }

  getInstance() {
      return Singleton.instance;
  }

}

module.exports = Singleton;
  

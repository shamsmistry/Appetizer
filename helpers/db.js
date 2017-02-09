var mysql = require('mysql');
var Sequelize = require('sequelize');

var sequelizeConnection = new Sequelize(process.env.DB_DATABASE_NAME, process.env.DB_USERNAME, process.env.DB_PASSWORD, {
    host: process.env.DB_HOSTNAME,
    dialect: 'mysql',
    define: {
        timestamps: false
    },
    dialectOptions: {
        multipleStatements: true
    },
    logging: false,
    pool: {
        max: 15,
        min: 0,
        idle: 10000
    }
});

exports.sequelizeConn = function connectSequelize() {
    return sequelizeConnection;
};

var sequelizeConnect = this.sequelizeConn();

sequelizeConnect.sync(
    {
        force: false
    }
);

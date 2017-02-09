//import modules
var helpers = require('../helpers/helpers');
var config = require('../config');
var clasAllTables = require('../models/alltables');
var chalk = require('chalk');

//instances
var objAllTables = clasAllTables.allTables;

exports.toastNotifications = function (arr) {
    var notifications = objAllTables.notifications.notifications();
    return notifications.bulkCreate(arr).then(function (data) {
        
        //console.log(chalk.yellow('######################## Notification Inserted count : ', data.length));

        if (data.length > 0) {
            var emitObj = {
                notification: arr
            };
            
            //push notification to client through socket
            helpers.emitNotificationViaSocket(process.env.SOCKET_SERVER_PUBLIC_IP, process.env.SOCKET_SERVER_PORT, 'api/emit/notification', emitObj);

            return true;
        }
        else {
            return false;
        }
    })
}

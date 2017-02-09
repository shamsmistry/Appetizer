//#############################################################
//##################### Requiring Files #######################
//#############################################################

var Promise = require("bluebird");
var pushConfig = require('../config/push_config');
var pushWoosh = require('pushwoosh');
var pushClient = new pushWoosh(pushConfig.credentials.applicationCode, pushConfig.credentials.apiToken);

//###############################################################
//###################### Public Methods #########################
//###############################################################

exports.sendPush = function (pushObj) {

    /*
        pushObj = {
            data: pushNotification.message,         //Text
            token: pushNotification.deviceToken     //Array
            details:{id:user_id , screen_type}
        }
    */

    if (pushObj.details != null) {
        var config = {
            "send_date": "now",
            "ignore_user_timezone": true,
            "content": pushObj.data,
            "data": { 'params': { "state": pushObj.details.state, id: pushObj.details.id } },
            "devices": pushObj.token
        };
    }
    else {
        var config = {
            "send_date": "now",
            "ignore_user_timezone": true,
            "content": pushObj.data,
            "devices": pushObj.token
        };
    }

    if (pushObj.token.length > 1) {
        pushClient.sendMessage(config).then(function (data) {
            //data.status_code
        });
    }
    else if (pushObj.token.length == 1) {
        pushClient.sendMessage(config).then(function (data) {
            //data.status_code
        });
    }
     else {
         console.log("PUSH NOTIFICATION NOT AVAILABLE FOR THIS PERSON");
     }
}
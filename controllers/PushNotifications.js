//#############################################################
//##################### Requiring Files #######################
//#############################################################

//npm
var validator = require('validator');
var chalk = require('chalk');
var pushWoosh = require('../lib/PushWoosh');

//others
var db = require('../helpers/db');
var helpers = require('../helpers/helpers');
var config = require('../config');
var classAllTables = require('../models/alltables');

//instances
var sequelize = db.sequelizeConn();
var objAllTables = classAllTables.allTables;

//#############################################################
//########################### APIs ############################
//#############################################################

exports.subscribe = function (req, res) {

    helpers.getActiveSession(req)
        .then(function (sessionUser) {
            if (sessionUser.type == 'Recognized') {

                var sessions = objAllTables.sessions.sessions();
                sessions.update({device_subscription_token: req.body.device_subscription_token}, {
                    where: {
                        token: req.headers.token,
                        status: 'ACTIVE'
                    }
                })
                    .then(function (updatedRows) {
                        if (updatedRows[0] == 1) {
                            res.send(200, {meta: {status: 200, message: 'OK'}});
                        }
                        else {
                            res.send(500, {meta: {status: 500, message: 'unexpected error'}});
                        }
                    });

            }
            else {
                res.send(401, {meta: {status: 401, message: 'invalid token'}});
            }
        })
        .error(function (err) {
            res.send(500, {meta: {status: 500, message: 'unexpected error'}, details: err});
        });
};


exports.chatNotification = function (req, res) {

    //send push notifications
    var pushData = {};
    pushData.actor_user = req.body.senderId || null
    pushData.chatMessage = req.body.content || null;
    pushData.uid = req.body.receiverId || null;
    pushData.type = req.body.type || null;
    pushData.conversationId = req.body.conversationId || null;

    pushNotifications(pushData);
    res.send(200);

};

var pushNotifications = exports.pushNotifications = function (notification_info) {

    //############################## Documentation ##############################
    //object to be received
    //PushNotificationObj = {
    //    uid: [],
    //    actor_user: 1,
    //    type: 'PROGRESS_UPDATE',
    //    }
    //};
    //############################## Documentation ##############################
    
    var pushNotification_obj = {};
    //Passing -1 because relation with session user is not required
    return helpers.getUserMini(notification_info.actor_user, -1, false)
        .then(function (user) {
            pushNotification_obj.actor_user = user.name;
            pushNotification_obj.uid = user.uid;


        }).then(function () {

            return getTokensById(notification_info.uid)
                .then(function (usersNotify) {
                    
                    if (notification_info.type == 'GOAL_FOLLOWED') {

                        pushNotification_obj.details = {id: notification_info.goal_id, state: 'goal'};
                        pushNotification_obj.data = pushNotification_obj.actor_user + ' followed your goal';
                    }
                    else if (notification_info.type == 'USER_FOLLOWED') {

                        pushNotification_obj.details = {id: pushNotification_obj.uid, state: 'profile'};
                        pushNotification_obj.data = pushNotification_obj.actor_user + '  followed your profile';

                    }
                    else if (notification_info.type == 'PROGRESS_UPDATED') {

                        pushNotification_obj.details = {id: notification_info.post_id, state: 'post'};
                        pushNotification_obj.data = pushNotification_obj.actor_user + ' has updated the goal progress';

                    }
                    else if (notification_info.type == 'CONTRIBUTION') {

                        if (notification_info.isMentioned == true) {

                            pushNotification_obj.details = {id: notification_info.post_id, state: 'post'};
                            pushNotification_obj.data = pushNotification_obj.actor_user + ' mentioned  you in a contribution';

                        }
                        else {
                            pushNotification_obj.details = {id: notification_info.post_id, state: 'post'};
                            pushNotification_obj.data = pushNotification_obj.actor_user + ' has contributed on a goal';

                        }

                    }
                    else if (notification_info.type == 'MILESTONE_CREATED') {

                        pushNotification_obj.details = {id: notification_info.post_id, state: 'post'};
                        pushNotification_obj.data = pushNotification_obj.actor_user + ' added a new milestone on a goal';

                    }
                    else if (notification_info.type == 'MILESTONE_COMPLETED') {

                        pushNotification_obj.details = {id: notification_info.post_id, state: 'post'};
                        pushNotification_obj.data = pushNotification_obj.actor_user + ' achieved a new milestone on a goal';

                    }
                    else if (notification_info.type == 'COMMENT') {

                        pushNotification_obj.details = {id: notification_info.post_id, state: 'post-comments'};
                        pushNotification_obj.data = pushNotification_obj.actor_user + ' has commented on an activity ';

                       /* if (notification_info.isMentioned == true) {

                              pushNotification_obj.details = {id: notification_info.post_id, state: 'post-comments'};                           
			      pushNotification_obj.data = pushNotification_obj.actor_user + ' mentioned you in a comment ';

                        }
                        else {
                            pushNotification_obj.details = {id: notification_info.post_id, state: 'post-comments'};
                            pushNotification_obj.data = pushNotification_obj.actor_user + ' has commented on an activity ';

                        }*/

                    }
                    else if (notification_info.type == 'MOTIVATE_ON_POST') {

                        pushNotification_obj.details = {id: notification_info.post_id, state: 'post'};
                        pushNotification_obj.data = pushNotification_obj.actor_user + ' motivated on your post ';

                    }
                    else if (notification_info.type == 'MOTIVATE_ON_GOAL') {

                        pushNotification_obj.details = {id: notification_info.goal_id, state: 'goal'};
                        pushNotification_obj.data = pushNotification_obj.actor_user + ' motivated on your goal ';

                    }
                    else if (notification_info.type == 'LINK_GOAL') {

                        pushNotification_obj.details = {id: notification_info.goal_id, state: 'goal'};
                        pushNotification_obj.data = pushNotification_obj.actor_user + ' has linked with your goal ';

                    }
                    else if (notification_info.type == 'STATUS_UPDATE') {

                        if (notification_info.isMentioned == true) {
                            pushNotification_obj.details = {id: notification_info.post_id, state: 'posts-comments'};
                            pushNotification_obj.data = pushNotification_obj.actor_user + ' mentioned you in a post ';
                        }

                    }
                    else if (notification_info.type == 'USER_FOLLOW_REQUEST_CREATED') {

                    }
                    else if (notification_info.type == 'USER_FOLLOW_REQUEST_ACCEPTED') {

                    }
                    else if (notification_info.type == 'CHAT_MESSAGE') {
                        pushNotification_obj.details = {id: notification_info.conversationId, state: 'chatmain.chat-convo'};
                        pushNotification_obj.data = pushNotification_obj.actor_user + ' sent you a message "' + notification_info.chatMessage + '"';
                    }
                    else {
                        throw new Error('Unknown activity Type');
                    }

                    pushNotification_obj.token = usersNotify;
                    pushWoosh.sendPush(pushNotification_obj);

                })

        })

}

function getTokensById(usersToNotify) {

    var deviceTokens = [];
    var sessionUsers = objAllTables.sessions.sessions();
    return sessionUsers.findAll({
        where: {uid: usersToNotify, status: 'ACTIVE'},
        attributes: ['device_subscription_token']
    })
        .then(function (usersTokens) {
            for (var i = 0; i < usersTokens.length; i++) {
                if (usersTokens[i].dataValues.device_subscription_token != null) {
                    var tokens = usersTokens[i].dataValues.device_subscription_token;
                    deviceTokens.push(tokens);
                }
            }
            return deviceTokens;
        })

}
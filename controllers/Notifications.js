//import modules
var clasAllTables = require('../models/alltables');
var helpers = require('../helpers/helpers');
var validator = require('validator');
var Promise = require("bluebird");
var config = require('../config');
var emailConfig = require('../config/email_config');
var utils = require('../helpers/Utils');
var db = require('../helpers/db');
var validate = require("validate.js");
var chalk = require('chalk');
var validate = require("validate.js");
var _ = require("lodash");

//instances
var objAllTables = clasAllTables.allTables;

//#############################################################
//############# Notification Type Handlers  ###################
//#############################################################

function CONTRIBUTION(actor_uid, activity_id, activity_type, goal_id, post_id) {

    //############################## Documentation ############################## 
    //add activity into the notification of users, who follow the goal on which contribution was made
    //also the users who follow the goal
    //and the owner of the goal
    //############################## Documentation ############################## 

    //final arrays of users to receive notification
    var users_ToastNotifications = [];
    //var old_users_EmailNotifications = [];
    var users_EmailNotifications = {
        all: [],
        owners: [],
        followers: [],
        linkers: []
    };
    var users_MobileNotifications = [];

    var users_Mentioned = [];

    var _queryResults;

    return getMentionedusers_Post(post_id)
        //get mentioned users
        .then(function (mentioned_uid) {
            users_Mentioned = mentioned_uid;
        })
        //get contribution users
        .then(function () {

            //contribution notification receivers
            var sqlSelectUids = "(SELECT uid, 'OWNER' AS `relation` FROM `goals` WHERE goal_id = {0} and `status` = 'ACTIVE')\
                            UNION\
                            (SELECT follower_uid as uid, 'FOLLOWER' AS `relation` FROM goal_followers WHERE goal_id = {0} and `status` = 'ACTIVE')\
                            UNION\
                            (SELECT uid, 'LINKER' AS `relation` FROM `goal_linked` WHERE to_goal_id = {0} and `status` = 'ACTIVE')".format(goal_id);

            var sequelize = db.sequelizeConn();

            return sequelize.query(sqlSelectUids, {
                type: sequelize.QueryTypes.SELECT
            }).then(function (_uids) {    //check for same uids in both arrays
                _queryResults = _uids;
                var users_toFilter = [];

                // for (var i = 0; i < uidList.length; i++) {

                //     //if mentioned users list does not contain this uid, keep it in Contribution list
                //     //else, remove it from Contribution list, and keep it in mentioned users list
                //     if (!users_Mentioned.contains(users_Mentioned, uidList[i].uid)) {
                //         users_toFilter.push(uidList[i].uid);
                //     }
                // }


                _(_uids).forEach(function (value) {
                    //if mentioned users list does not contain this uid, keep it in Contribution list
                    //else, remove it from Contribution list, and keep it in mentioned users list
                    if (!users_Mentioned.contains(users_Mentioned, value.uid))
                        users_toFilter.push(value.uid);
                });

                return users_toFilter;
            });
        }).then(function (users_toFilter) { //check for CONTRIBUTION

            return filterNotification(actor_uid, activity_type, 'CONTRIBUTION', null, goal_id, users_toFilter).then(function (usersContribution) {

                if (usersContribution.users_toast.length > 0) {
                    // Merge both arrays and get unique items

                    //for web
                    users_ToastNotifications = users_ToastNotifications.concat(usersContribution.users_toast).unique();

                    //for email
                    _(usersContribution.users_email).forEach(function (value) {

                        users_EmailNotifications.all.push(value);

                        var relation = _.head(_.filter(_queryResults, function (o) {
                            return o.uid == value;
                        })).relation;

                        switch (relation) {
                            case 'OWNER':
                                users_EmailNotifications.owners.push(value);
                                break;
                            case 'FOLLOWER':
                                users_EmailNotifications.followers.push(value);
                                break;
                            case 'LINKER':
                                users_EmailNotifications.linkers.push(value);
                                break;
                        }
                    });
                    //users_EmailNotifications = users_EmailNotifications.concat(usersContribution.users_email).unique();

                    //for mobile
                    users_MobileNotifications = users_MobileNotifications.concat(usersContribution.users_mobile).unique();
                }
                return;
            });
        })
        //sending notifications - Contribution
        .then(function () {
            //Sending Contribution notifications
            var data = [];
            var created = helpers.getUnixTimeStamp();
            for (var i = 0; i < users_ToastNotifications.length; i++) {
                data.push({
                    uid: users_ToastNotifications[i],
                    activity_id: activity_id,
                    created: created
                });
            }

            //send toast notifications
            var toast = require('./ToastNotifications.js');
            toast.toastNotifications(data);

            //send email notifications
            var emailData = {};
            emailData.To_uid = users_EmailNotifications;
            emailData.actor_user = actor_uid;
            emailData.type = 'CONTRIBUTION';
            emailData.data = {
                goal_id: goal_id,
                post_id: post_id
            };

            var email = require('./EmailNotifications.js');
            email.emailNotifications(emailData);


            //send push notifications
            var pushData = {};
            pushData.uid = users_MobileNotifications;
            pushData.type = 'CONTRIBUTION';
            pushData.actor_user = actor_uid;
            pushData.post_id = post_id;


            //send mobile notifications
            var push = require('./PushNotifications.js');
            push.pushNotifications(pushData);

            return;
        })
        //sending notifications - Mentioned Contribution
        .then(function () {
            USERMENTION_POST(activity_id, activity_type, actor_uid, users_Mentioned, null, null);
        });
}

function USERMENTION_POST(activity_id, activity_type, actor_uid, mentioned_users, goal_id, post_id) {

    //############################## Documentation ##############################
    //
    //############################## Documentation ##############################

    //final arrays of users to receive notification
    var users_ToastNotifications = [];
    var users_EmailNotifications = [];
    var users_MobileNotifications = [];

    if (activity_type == 'CONTRIBUTION') {
        return new Promise(function (resolve) {

            return filterNotification(actor_uid, activity_type, 'USERMENTIONED', null, null, mentioned_users)
                .then(function (usersMentioned) {

                    if (usersMentioned.users_toast.length > 0) {
                        // Merge both arrays and get unique items

                        //for web
                        users_ToastNotifications = users_ToastNotifications.concat(usersMentioned.users_toast).unique();

                        //for email
                        users_EmailNotifications = users_EmailNotifications.concat(usersMentioned.users_email).unique();

                        //for mobile
                        users_MobileNotifications = users_MobileNotifications.concat(usersMentioned.users_mobile).unique();
                    }

                    resolve(null);
                });
        })
            //sending notifications - Contribution
            .then(function () {
                //Sending Contribution notifications
                var data = [];
                var created = helpers.getUnixTimeStamp();
                for (var i = 0; i < users_ToastNotifications.length; i++) {
                    data.push({
                        uid: users_ToastNotifications[i],
                        activity_id: activity_id,
                        type: 'USERMENTION',
                        created: created
                    });
                }

                //############################## Send Toast Notifications ##############################
                var toast = require('./ToastNotifications.js');
                toast.toastNotifications(data);

                //############################## Send Email Notifications ##############################
                var emailData = {};
                emailData.To_uid = users_EmailNotifications;
                emailData.actor_user = actor_uid;
                emailData.type = 'CONTRIBUTION';
                emailData.data = {
                    isMentioned: true,
                    goal_id: goal_id,
                    post_id: post_id
                };

                //var email = require('./EmailNotifications.js');
                //email.emailNotifications(emailData);

                //############################## Send Mobile Notifications ##############################
                var pushData = {};
                pushData.uid = users_MobileNotifications;
                pushData.type = 'CONTRIBUTION';
                pushData.actor_user = actor_uid;
                pushData.post_id = post_id;
                pushData.isMentioned = true


                //send mobile notifications
                var push = require('./PushNotifications.js');
                push.pushNotifications(pushData);
            });

    }
    else if (activity_type == 'MILESTONE_CREATED') {


        return new Promise(function (resolve) {

            return filterNotification(actor_uid, activity_type, 'USERMENTIONED', post_id, goal_id, mentioned_users)
                .then(function (usersMentioned) {

                    if (usersMentioned.users_toast.length > 0) {
                        // Merge both arrays and get unique items

                        //for web
                        users_ToastNotifications = users_ToastNotifications.concat(usersMentioned.users_toast).unique();

                        //for email
                        users_EmailNotifications = users_EmailNotifications.concat(usersMentioned.users_email).unique();

                        //for mobile
                        users_MobileNotifications = users_MobileNotifications.concat(usersMentioned.users_mobile).unique();
                    }

                    resolve(null);
                });
        })
            //sending notifications - Contribution
            .then(function () {
                //Sending Contribution notifications
                var data = [];
                var created = helpers.getUnixTimeStamp();
                for (var i = 0; i < users_ToastNotifications.length; i++) {
                    data.push({
                        uid: users_ToastNotifications[i],
                        activity_id: activity_id,
                        type: 'USERMENTION',
                        created: created
                    });
                }

                //############################## Send Toast Notifications ##############################
                var toast = require('./ToastNotifications.js');
                toast.toastNotifications(data);

                //############################## Send Email Notifications ##############################
                var emailData = {};
                emailData.To_uid = users_EmailNotifications;
                emailData.actor_user = actor_uid;
                emailData.type = 'MILESTONE_CREATED';
                emailData.data = {
                    isMentioned: true,
                    goal_id: goal_id,
                    post_id: post_id
                };

                //var email = require('./EmailNotifications.js');
                //email.emailNotifications(emailData);

                //############################## Send Mobile Notifications ##############################
                //var push = require('../PushNotifications.js');
            });

    }
    else if (activity_type == 'MILESTONE_COMPLETED') {


        return new Promise(function (resolve) {

            return filterNotification(actor_uid, activity_type, 'USERMENTIONED', post_id, goal_id, mentioned_users)
                .then(function (usersMentioned) {

                    if (usersMentioned.users_toast.length > 0) {
                        // Merge both arrays and get unique items

                        //for web
                        users_ToastNotifications = users_ToastNotifications.concat(usersMentioned.users_toast).unique();

                        //for email
                        users_EmailNotifications = users_EmailNotifications.concat(usersMentioned.users_email).unique();

                        //for mobile
                        users_MobileNotifications = users_MobileNotifications.concat(usersMentioned.users_mobile).unique();
                    }

                    resolve(null);
                });
        })
            //sending notifications - Contribution
            .then(function () {
                //Sending Contribution notifications
                var data = [];
                var created = helpers.getUnixTimeStamp();
                for (var i = 0; i < users_ToastNotifications.length; i++) {
                    data.push({
                        uid: users_ToastNotifications[i],
                        activity_id: activity_id,
                        type: 'USERMENTION',
                        created: created
                    });
                }

                //############################## Send Toast Notifications ##############################
                var toast = require('./ToastNotifications.js');
                toast.toastNotifications(data);

                //############################## Send Email Notifications ##############################
                var emailData = {};
                emailData.To_uid = users_EmailNotifications;
                emailData.actor_user = actor_uid;
                emailData.type = 'MILESTONE_COMPLETED';
                emailData.data = {
                    isMentioned: true,
                    goal_id: goal_id,
                    post_id: post_id
                };

                //var email = require('./EmailNotifications.js');
                //email.emailNotifications(emailData);

                //############################## Send Mobile Notifications ##############################
                //var push = require('../PushNotifications.js');
            });

    }
    else if (activity_type == 'SHARE_GOAL') {


        return new Promise(function (resolve) {

            return filterNotification(actor_uid, activity_type, 'USERMENTIONED', post_id, goal_id, mentioned_users)
                .then(function (usersMentioned) {

                    if (usersMentioned.users_toast.length > 0) {
                        // Merge both arrays and get unique items

                        //for web
                        users_ToastNotifications = users_ToastNotifications.concat(usersMentioned.users_toast).unique();

                        //for email
                        users_EmailNotifications = users_EmailNotifications.concat(usersMentioned.users_email).unique();

                        //for mobile
                        users_MobileNotifications = users_MobileNotifications.concat(usersMentioned.users_mobile).unique();
                    }

                    resolve(null);
                });
        })
            //sending notifications - Contribution
            .then(function () {
                //Sending Contribution notifications
                var data = [];
                var created = helpers.getUnixTimeStamp();
                for (var i = 0; i < users_ToastNotifications.length; i++) {
                    data.push({
                        uid: users_ToastNotifications[i],
                        activity_id: activity_id,
                        type: 'USERMENTION',
                        created: created
                    });
                }

                //############################## Send Toast Notifications ##############################
                var toast = require('./ToastNotifications.js');
                toast.toastNotifications(data);

                //############################## Send Email Notifications ##############################
                var emailData = {};
                emailData.To_uid = users_EmailNotifications;
                emailData.actor_user = actor_uid;
                emailData.type = 'SHARE_GOAL';
                emailData.data = {
                    isMentioned: true,
                    goal_id: goal_id,
                    post_id: post_id
                };

                //var email = require('./EmailNotifications.js');
                //email.emailNotifications(emailData);

                //############################## Send Mobile Notifications ##############################
                //var push = require('../PushNotifications.js');
            });

    }
    else if (activity_type == 'SHARE_POST') {


        return new Promise(function (resolve) {

            return filterNotification(actor_uid, activity_type, 'USERMENTIONED', post_id, goal_id, mentioned_users)
                .then(function (usersMentioned) {

                    if (usersMentioned.users_toast.length > 0) {
                        // Merge both arrays and get unique items

                        //for web
                        users_ToastNotifications = users_ToastNotifications.concat(usersMentioned.users_toast).unique();

                        //for email
                        users_EmailNotifications = users_EmailNotifications.concat(usersMentioned.users_email).unique();

                        //for mobile
                        users_MobileNotifications = users_MobileNotifications.concat(usersMentioned.users_mobile).unique();
                    }

                    resolve(null);
                });
        })
            //sending notifications - Contribution
            .then(function () {
                //Sending Contribution notifications
                var data = [];
                var created = helpers.getUnixTimeStamp();
                for (var i = 0; i < users_ToastNotifications.length; i++) {
                    data.push({
                        uid: users_ToastNotifications[i],
                        activity_id: activity_id,
                        type: 'USERMENTION',
                        created: created
                    });
                }

                //############################## Send Toast Notifications ##############################
                var toast = require('./ToastNotifications.js');
                toast.toastNotifications(data);

                //############################## Send Email Notifications ##############################
                var emailData = {};
                emailData.To_uid = users_EmailNotifications;
                emailData.actor_user = actor_uid;
                emailData.type = 'SHARE_POST';
                emailData.data = {
                    isMentioned: true,
                    goal_id: goal_id,
                    post_id: post_id
                };

                //var email = require('./EmailNotifications.js');
                //email.emailNotifications(emailData);

                //############################## Send Mobile Notifications ##############################
                //var push = require('../PushNotifications.js');
            });


    }
    else if (activity_type == 'PROGRESS_UPDATED') {

        return new Promise(function (resolve) {

            return filterNotification(actor_uid, activity_type, 'USERMENTIONED', post_id, goal_id, mentioned_users)
                .then(function (usersMentioned) {

                    if (usersMentioned.users_toast.length > 0) {
                        // Merge both arrays and get unique items

                        //for web
                        users_ToastNotifications = users_ToastNotifications.concat(usersMentioned.users_toast).unique();

                        //for email
                        users_EmailNotifications = users_EmailNotifications.concat(usersMentioned.users_email).unique();

                        //for mobile
                        users_MobileNotifications = users_MobileNotifications.concat(usersMentioned.users_mobile).unique();
                    }

                    resolve(null);
                });
        })
            //sending notifications - Contribution
            .then(function () {
                //Sending Contribution notifications
                var data = [];
                var created = helpers.getUnixTimeStamp();
                for (var i = 0; i < users_ToastNotifications.length; i++) {
                    data.push({
                        uid: users_ToastNotifications[i],
                        activity_id: activity_id,
                        type: 'USERMENTION',
                        created: created
                    });
                }

                //############################## Send Toast Notifications ##############################
                var toast = require('./ToastNotifications.js');
                toast.toastNotifications(data);

                //############################## Send Email Notifications ##############################
                var emailData = {};
                emailData.To_uid = users_EmailNotifications;
                emailData.actor_user = actor_uid;
                emailData.type = 'PROGRESS_UPDATED';
                emailData.data = {
                    isMentioned: true,
                    goal_id: goal_id,
                    post_id: post_id
                };

                //var email = require('./EmailNotifications.js');
                //email.emailNotifications(emailData);

                //############################## Send Mobile Notifications ##############################
                //var push = require('../PushNotifications.js');
            });




    }
    else if (activity_type == 'STATUS_UPDATE') {

        return new Promise(function (resolve) {

            return filterNotification(actor_uid, activity_type, 'USERMENTIONED', post_id, null, users_Mentioned)
                //Uid List for mentioned users
                .then(function (usersMentionedInStatusUpdate) {

                    if (usersMentionedInStatusUpdate.users_toast.length > 0) {
                        // Merge both arrays and get unique items

                        //for web
                        users_ToastNotifications = users_ToastNotifications.concat(usersMentionedInStatusUpdate.users_toast).unique();

                        //for email
                        users_EmailNotifications = users_EmailNotifications.concat(usersMentionedInStatusUpdate.users_email).unique();

                        //for mobile
                        users_MobileNotifications = users_MobileNotifications.concat(usersMentionedInStatusUpdate.users_mobile).unique();
                    }
                    resolve(users_ToastNotifications);
                });
        })
            //Sending Mentioned Notification
            .then(function (users_ToastNotifications) {

                var data = [];
                var created = helpers.getUnixTimeStamp();
                for (var i = 0; i < users_ToastNotifications.length; i++) {
                    data.push({
                        uid: users_ToastNotifications[i],
                        activity_id: activity_id,
                        created: created,
                        type: "USERMENTION"
                    });
                }

                var toast = require('./ToastNotifications.js');
                toast.toastNotifications(data);


                //send email notifications
                //var emailData = {};
                //emailData.To_uid = users_EmailNotifications;
                //emailData.actor_user = actor_uid;
                //emailData.type = 'STATUS_UPDATE';
                //emailData.data = {
                //    post_id: post_id
                //};

                //var email = require('./EmailNotifications.js');
                //email.emailNotifications(emailData);


                //############################## Send Mobile Notifications ##############################
                var pushData = {};
                pushData.uid = users_MobileNotifications;
                pushData.type = 'STATUS_UPDATE';
                pushData.actor_user = actor_uid;
                pushData.post_id = post_id;
                pushData.isMentioned = true


                //send mobile notifications
                var push = require('./PushNotifications.js');
                push.pushNotifications(pushData);
            });
    } else {

    }
}

function USERMENTION_COMMENTS(activity_id, activity_type, actor_uid, mentioned_users, post_id) {

    //############################## Documentation ##############################
    //
    //############################## Documentation ##############################

    //final arrays of users to receive notification
    var users_ToastNotifications = [];
    var users_EmailNotifications = [];
    var users_MobileNotifications = [];

    if (activity_type == 'COMMENT') {
        return new Promise(function (resolve) {

            return filterNotification(actor_uid, activity_type, 'USERMENTIONED', post_id, null, mentioned_users)
                .then(function (usersMentioned) {

                    if (usersMentioned.users_toast.length > 0) {
                        // Merge both arrays and get unique items

                        //for web
                        users_ToastNotifications = users_ToastNotifications.concat(usersMentioned.users_toast).unique();

                        //for email
                        users_EmailNotifications = users_EmailNotifications.concat(usersMentioned.users_email).unique();

                        //for mobile
                        users_MobileNotifications = users_MobileNotifications.concat(usersMentioned.users_mobile).unique();
                    }

                    resolve(null);
                });
        })
            //sending notifications - Contribution
            .then(function () {
                //Sending Contribution notifications
                var data = [];
                var created = helpers.getUnixTimeStamp();
                for (var i = 0; i < users_ToastNotifications.length; i++) {
                    data.push({
                        uid: users_ToastNotifications[i],
                        activity_id: activity_id,
                        type: 'USERMENTION',
                        created: created
                    });
                }

                //############################## Send Toast Notifications ##############################
                var toast = require('./ToastNotifications.js');
                toast.toastNotifications(data);

                //############################## Send Email Notifications ##############################
                var emailData = {};
                emailData.To_uid = users_EmailNotifications;
                emailData.actor_user = actor_uid;
                emailData.type = 'COMMENT';
                emailData.data = {
                    isMentioned: true,
                    post_id: post_id
                };

                //var email = require('./EmailNotifications.js');
                //email.emailNotifications(emailData);

                //############################## Send Mobile Notifications ##############################
                var pushData = {};
                pushData.uid = users_MobileNotifications;
                pushData.type = 'COMMENT';
                pushData.actor_user = actor_uid;
                pushData.post_id = post_id;
                pushData.isMentioned = true;



                //send mobile notifications
                var push = require('./PushNotifications.js');
                push.pushNotifications(pushData);
            });

    }
    else if (activity_type == 'REPLY_ON_POSTCOMMENT') {


        return new Promise(function (resolve) {

            return filterNotification(actor_uid, activity_type, 'USERMENTIONED', post_id, null, mentioned_users)
                .then(function (usersMentioned) {

                    if (usersMentioned.users_toast.length > 0) {
                        // Merge both arrays and get unique items

                        //for web
                        users_ToastNotifications = users_ToastNotifications.concat(usersMentioned.users_toast).unique();

                        //for email
                        users_EmailNotifications = users_EmailNotifications.concat(usersMentioned.users_email).unique();

                        //for mobile
                        users_MobileNotifications = users_MobileNotifications.concat(usersMentioned.users_mobile).unique();
                    }

                    resolve(null);
                });
        })
            //sending notifications - Contribution
            .then(function () {
                //Sending Contribution notifications
                var data = [];
                var created = helpers.getUnixTimeStamp();
                for (var i = 0; i < users_ToastNotifications.length; i++) {
                    data.push({
                        uid: users_ToastNotifications[i],
                        activity_id: activity_id,
                        type: 'USERMENTION',
                        created: created
                    });
                }

                //############################## Send Toast Notifications ##############################
                var toast = require('./ToastNotifications.js');
                toast.toastNotifications(data);

                //############################## Send Email Notifications ##############################
                var emailData = {};
                emailData.To_uid = users_EmailNotifications;
                emailData.actor_user = actor_uid;
                emailData.type = 'REPLY_ON_POSTCOMMENT';
                emailData.data = {
                    isMentioned: true,
                    goal_id: goal_id,
                    post_id: post_id
                };

                //var email = require('./EmailNotifications.js');
                //email.emailNotifications(emailData);

                //############################## Send Mobile Notifications ##############################
                //var push = require('../PushNotifications.js');
            });

    }


}

function GOAL_FOLLOWED(actor_uid, activity_id, activity_type, goal_id, post_id) {

    //final arrays of users to receive notification
    var users_ToastNotifications = [];
    var users_EmailNotifications = [];
    var users_MobileNotifications = [];

    var goals = objAllTables.goals.goals();
    return goals.findOne({
        attributes: ['uid'],
        where: {
            goal_id: goal_id
        }
    })
        .then(function (uidList) {
            return filterNotification(actor_uid, activity_type, 'GOAL_FOLLOWED', null, goal_id, [uidList.dataValues.uid])
                .then(function (uidListToNotify_GoalFollowed) {

                    if (uidListToNotify_GoalFollowed.users_toast.length > 0) {
                        // Merge both arrays and get unique items
                        users_ToastNotifications = users_ToastNotifications.concat(uidListToNotify_GoalFollowed.users_toast).unique();

                        users_EmailNotifications = users_EmailNotifications.concat(uidListToNotify_GoalFollowed.users_email).unique();

                        users_MobileNotifications = users_MobileNotifications.concat(uidListToNotify_GoalFollowed.users_mobile).unique();
                    }
                    return;
                });
        })
        .then(function () {
            var data = [];
            var created = helpers.getUnixTimeStamp();
            for (var i = 0; i < users_ToastNotifications.length; i++) {
                data.push({
                    uid: users_ToastNotifications[i],
                    activity_id: activity_id,
                    created: created
                });
            }

            //send toast notifications
            var toast = require('./ToastNotifications.js');
            toast.toastNotifications(data);


            //send email notifications
            var emailData = {};
            emailData.To_uid = users_EmailNotifications;
            emailData.actor_user = actor_uid;
            emailData.type = 'GOAL_FOLLOWED';
            emailData.data = {
                goal_id: goal_id,
                post_id: post_id
            };


            var email = require('./EmailNotifications.js');
            email.emailNotifications(emailData);

            //send push notifications
            var pushData = {};
            pushData.uid = users_MobileNotifications;
            pushData.type = 'GOAL_FOLLOWED';
            pushData.actor_user = actor_uid;
            pushData.goal_id = goal_id;



            //send mobile notifications
            var push = require('./PushNotifications.js');
            push.pushNotifications(pushData);
        });


};

function USER_FOLLOWED(actor_uid, activity_id, activity_type, followed_uid, post_id) {

    //final arrays of users to receive notification
    var users_ToastNotifications = [];
    var users_EmailNotifications = [];
    var users_MobileNotifications = [];

    return new Promise(function (resolve) {

        return filterNotification(actor_uid, activity_type, 'USER_FOLLOWED', null, null, [followed_uid]).then(function (uidListToNotify_UserFollowed) {

            if (uidListToNotify_UserFollowed.users_toast.length > 0) {
                // Merge both arrays and get unique items
                users_ToastNotifications = users_ToastNotifications.concat(uidListToNotify_UserFollowed.users_toast).unique();

                users_EmailNotifications = users_EmailNotifications.concat(uidListToNotify_UserFollowed.users_email).unique();

                users_MobileNotifications = users_MobileNotifications.concat(uidListToNotify_UserFollowed.users_mobile).unique();
            }

            resolve(users_ToastNotifications);
        });
    })
        .then(function () {

            var data = [];
            var created = helpers.getUnixTimeStamp();
            for (var i = 0; i < users_ToastNotifications.length; i++) {
                data.push({
                    uid: users_ToastNotifications[i],
                    activity_id: activity_id,
                    created: created
                });
            }

            //send toast notifications
            var toast = require('./ToastNotifications.js');
            toast.toastNotifications(data);


            //send email notifications
            var emailData = {};
            emailData.To_uid = users_EmailNotifications;
            emailData.actor_user = actor_uid;
            emailData.type = 'USER_FOLLOWED';
            emailData.data = {
                post_id: post_id
            };

            var email = require('./EmailNotifications.js');
            email.emailNotifications(emailData);


            //send push notifications
            var pushData = {};
            pushData.uid = users_MobileNotifications;
            pushData.type = 'USER_FOLLOWED';
            pushData.actor_user = actor_uid;



            //send mobile notifications
            var push = require('./PushNotifications.js');
            push.pushNotifications(pushData);
        });

};

function MILESTONE_CREATED(actor_uid, activity_id, activity_type, goal_id, post_id, milestone_id) {

    //final arrays of users to receive notification
    var users_ToastNotifications = [];
    var users_EmailNotifications = [];
    var users_MobileNotifications = [];

    var users_Mentioned = [];

    return getMentionedusers_Post(post_id)
        //get mentioned users
        .then(function (mentioned_uid) {
            users_Mentioned = mentioned_uid;
        })
        .then(function () {
            var sequelize = db.sequelizeConn();
            //final array of users to receive notification
            var sqlSelectUids = "(SELECT follower_uid as uid, 'FOLLOWER' AS `relation` FROM `goal_followers` where goal_id ={0} and `status` = 'ACTIVE')\
                                UNION\
                                (select uid, 'LINKER' AS `relation` from goal_linked where to_goal_id = {0} and `status`= 'ACTIVE')".format(goal_id);

            return sequelize.query(sqlSelectUids, {
                type: sequelize.QueryTypes.SELECT
            })
                .then(function (uidList) {
                    var users_toFilter = [];

                    for (var i = 0; i < uidList.length; i++) {
                        //if mentioned users list does not contain this uid, keep it in Contribution list
                        //else, remove it from Contribution list, and keep it in mentioned users list
                        if (!users_Mentioned.contains(users_Mentioned, uidList[i].uid)) {
                            users_toFilter.push(uidList[i].uid);
                        }
                    }
                    return users_toFilter;
                });
        })
        //Filter Users for Milestone Notifications
        .then(function (users_toFilter) {

            return filterNotification(actor_uid, activity_type, 'MILESTONE_CREATED', null, goal_id, users_toFilter)
                .then(function (uidListToNotify_Milestone) {

                    if (uidListToNotify_Milestone.users_toast.length > 0) {
                        // Merge both arrays and get unique items

                        //for web
                        users_ToastNotifications = users_ToastNotifications.concat(uidListToNotify_Milestone.users_toast).unique();

                        //for email
                        users_EmailNotifications = users_EmailNotifications.concat(uidListToNotify_Milestone.users_email).unique();

                        //for mobile
                        users_MobileNotifications = users_MobileNotifications.concat(uidListToNotify_Milestone.users_mobile).unique();
                    }

                    return;

                });

        })
        //Sending Milestone Created Notifications
        .then(function () {
            var data = [];
            var created = helpers.getUnixTimeStamp();
            for (var i = 0; i < users_ToastNotifications.length; i++) {
                data.push({
                    uid: users_ToastNotifications[i],
                    activity_id: activity_id,
                    created: created
                });
            }
            //send toast notifications

            var toast = require('./ToastNotifications.js');
            toast.toastNotifications(data);


            //send email notifications
            var emailData = {};
            emailData.To_uid = users_EmailNotifications;
            emailData.actor_user = actor_uid;
            emailData.type = 'MILESTONE_CREATED';
            emailData.data = {
                goal_id: goal_id,
                post_id: post_id,
                milestone_id: milestone_id
            };

            var email = require('./EmailNotifications.js');
            email.emailNotifications(emailData);

            //send push notifications
            var pushData = {};
            pushData.uid = users_MobileNotifications;
            pushData.type = 'MILESTONE_CREATED';
            pushData.actor_user = actor_uid;
            pushData.post_id = post_id;


            //send mobile notifications
            var push = require('./PushNotifications.js');
            push.pushNotifications(pushData);
        })
        //Sending Mentioned Notifications
        .then(function () {
            USERMENTION_POST(activity_id, activity_type, actor_uid, users_Mentioned, goal_id, post_id);
        })

};

function MILESTONE_COMPLETED(actor_uid, activity_id, activity_type, goal_id, post_id, milestone_id) {

    //final arrays of users to receive notification
    var users_ToastNotifications = [];
    var users_EmailNotifications = [];
    var users_MobileNotifications = [];
    var users_Mentioned = [];

    return getMentionedusers_Post(post_id)
        //get mentioned users
        .then(function (mentioned_uid) {
            users_Mentioned = mentioned_uid;
        })
        .then(function () {

            var sequelize = db.sequelizeConn();
            //final array of users to receive notification
            var usersToNotify = [];
            var sqlSelectUids = "(SELECT follower_uid as uid, 'FOLLOWER' AS `relation` FROM `goal_followers` where goal_id ={0} and `status` = 'ACTIVE')\
                            UNION\
                            (select uid, 'LINKER' AS `relation` from goal_linked where to_goal_id = {0} and `status`= 'ACTIVE')".format(goal_id);

            return sequelize.query(sqlSelectUids, {
                type: sequelize.QueryTypes.SELECT
            }).then(function (uidList) {

                var users_toFilter = [];
                for (var i = 0; i < uidList.length; i++) {
                    //if mentioned users list does not contain this uid, keep it in Contribution list
                    //else, remove it from Contribution list, and keep it in mentioned users list
                    if (!users_Mentioned.contains(users_Mentioned, uidList[i].uid)) {
                        users_toFilter.push(uidList[i].uid);
                    }
                }
                return users_toFilter;
            });

        })
        //Filter Users
        .then(function (users_toFilter) {

            return filterNotification(actor_uid, activity_type, 'MILESTONE_COMPLETED', null, goal_id, users_toFilter)

                .then(function (uidListToNotify_Milestone_Completed) {

                    if (uidListToNotify_Milestone_Completed.users_toast.length > 0) {
                        // Merge both arrays and get unique items
                        users_ToastNotifications = users_ToastNotifications.concat(uidListToNotify_Milestone_Completed.users_toast).unique();

                        users_EmailNotifications = users_EmailNotifications.concat(uidListToNotify_Milestone_Completed.users_email).unique();

                        users_MobileNotifications = users_MobileNotifications.concat(uidListToNotify_Milestone_Completed.users_mobile).unique();
                    }

                    return;
                });


        })
        //Sending Milestone Notifications
        .then(function () {
            var data = [];
            var created = helpers.getUnixTimeStamp();
            for (var i = 0; i < users_ToastNotifications.length; i++) {
                data.push({
                    uid: users_ToastNotifications[i],
                    activity_id: activity_id,
                    created: created
                });
            }

            var toast = require('./ToastNotifications.js');
            toast.toastNotifications(data);


            //send email notifications
            var emailData = {};
            emailData.To_uid = users_EmailNotifications;
            emailData.actor_user = actor_uid;
            emailData.type = 'MILESTONE_COMPLETED';
            emailData.data = {
                goal_id: goal_id,
                post_id: post_id,
                milestone_id: milestone_id
            };

            var email = require('./EmailNotifications.js');
            email.emailNotifications(emailData);

            //send push notifications
            var pushData = {};
            pushData.uid = users_MobileNotifications;
            pushData.type = 'MILESTONE_COMPLETED';
            pushData.actor_user = actor_uid;
            pushData.post_id = post_id;


            //send mobile notifications
            var push = require('./PushNotifications.js');
            push.pushNotifications(pushData);
        })
        //Sending Mentioned Notifications
        .then(function () {
            USERMENTION_POST(activity_id, activity_type, actor_uid, users_Mentioned, goal_id, post_id);
        })
};

function MOTIVATE_ON_POST(actor_uid, activity_id, activity_type, post_id) {

    //final arrays of users to receive notification
    var users_ToastNotifications = [];
    var users_EmailNotifications = [];
    var users_MobileNotifications = [];

    var posts = objAllTables.posts.posts();
    return posts.findOne({
        attributes: ['uid'],
        where: {
            id: post_id
        }
    })
        .then(function (post) {
            return filterNotification(actor_uid, activity_type, 'MOTIVATE_ON_POST', post_id, null, [post.dataValues.uid])
                .then(function (uidListToNotify_Motivate) {

                    if (uidListToNotify_Motivate.users_toast.length > 0) {
                        // Merge both arrays and get unique items
                        users_ToastNotifications = users_ToastNotifications.concat(uidListToNotify_Motivate.users_toast).unique();

                        users_EmailNotifications = users_EmailNotifications.concat(uidListToNotify_Motivate.users_email).unique();

                        users_MobileNotifications = users_MobileNotifications.concat(uidListToNotify_Motivate.users_mobile).unique();
                    }
                    return;
                });
        })
        .then(function () {
            var data = [];
            var created = helpers.getUnixTimeStamp();
            for (var i = 0; i < users_ToastNotifications.length; i++) {
                data.push({
                    uid: users_ToastNotifications[i],
                    activity_id: activity_id,
                    created: created
                });
            }

            var toast = require('./ToastNotifications.js');
            toast.toastNotifications(data);

            //########################### No email on "MOTIVATE_ON_POST" #############################
            //send email notifications
            /*var emailData = {};
            emailData.To_uid = users_EmailNotifications;
            emailData.actor_user = actor_uid;
            emailData.type = 'MOTIVATE_ON_POST';
            emailData.data = {
                post_id: post_id
            };
    
            var email = require('./EmailNotifications.js');
            email.emailNotifications(emailData);*/
            //########################### No email on "MOTIVATE_ON_POST" #############################

            //send push notifications
            var pushData = {};
            pushData.uid = users_MobileNotifications;
            pushData.type = 'MOTIVATE_ON_POST';
            pushData.actor_user = actor_uid;
            pushData.post_id = post_id;

            //send mobile notifications
            var push = require('./PushNotifications.js');
            push.pushNotifications(pushData);
        });

};

function MOTIVATE_ON_GOAL(actor_uid, activity_id, activity_type, goal_id) {

    //final arrays of users to receive notification
    var users_ToastNotifications = [];
    var users_EmailNotifications = [];
    var users_MobileNotifications = [];

    var goals = objAllTables.goals.goals();

    return goals.findOne({
        attributes: ['uid'],
        where: {
            goal_id: goal_id
        }
    })
        .then(function (goal) {
            return filterNotification(actor_uid, activity_type, 'MOTIVATE_ON_GOAL', null, goal_id, [goal.dataValues.uid])
                .then(function (uidListToNotify_Motivate) {

                    if (uidListToNotify_Motivate.users_toast.length > 0) {
                        // Merge both arrays and get unique items
                        users_ToastNotifications = users_ToastNotifications.concat(uidListToNotify_Motivate.users_toast).unique();

                        users_EmailNotifications = users_EmailNotifications.concat(uidListToNotify_Motivate.users_email).unique();

                        users_MobileNotifications = users_MobileNotifications.concat(uidListToNotify_Motivate.users_mobile).unique();
                    }

                    return;
                });
        })
        .then(function () {
            var data = [];
            var created = helpers.getUnixTimeStamp();
            for (var i = 0; i < users_ToastNotifications.length; i++) {
                data.push({
                    uid: users_ToastNotifications[i],
                    activity_id: activity_id,
                    created: created
                });
            }

            var toast = require('./ToastNotifications.js');
            toast.toastNotifications(data);

            //########################### No email on "MOTIVATE_ON_GOAL" #############################
            //send email notifications
            /*var emailData = {};
            emailData.To_uid = users_EmailNotifications;
            emailData.actor_user = actor_uid;
            emailData.type = 'MOTIVATE_ON_GOAL';
            emailData.data = {
                goal_id: goal_id,
    
            };
    
            var email = require('./EmailNotifications.js');
            email.emailNotifications(emailData);*/
            //########################### No email on "MOTIVATE_ON_GOAL" #############################

            var pushData = {};
            pushData.uid = users_MobileNotifications;
            pushData.type = 'MOTIVATE_ON_GOAL';
            pushData.actor_user = actor_uid;
            pushData.goal_id = goal_id;

            //send mobile notifications
            var push = require('./PushNotifications.js');
            push.pushNotifications(pushData);
        });


};

function SHARE_GOAL(actor_uid, activity_id, activity_type, post_id, goal_id) {

    //final arrays of users to receive notification
    var users_ToastNotifications = [];
    var users_EmailNotifications = [];
    var users_MobileNotifications = [];

    var users_Mentioned = [];

    return getMentionedusers_Post(post_id)
        //get mentioned users
        .then(function (mentioned_uid) {
            users_Mentioned = mentioned_uid;
        })
        .then(function () {
            var goals = objAllTables.goals.goals();
            return goals.findOne({
                attributes: ['uid'],
                where: {
                    goal_id: goal_id
                }
            })
                .then(function (goalUser) {
                    var users_toFilter = [];

                    for (var i = 0; i < goalUser.length; i++) {
                        //if mentioned users list does not contain this uid, keep it in Contribution list
                        //else, remove it from Contribution list, and keep it in mentioned users list
                        if (!users_Mentioned.contains(users_Mentioned, goalUser.dataValues[i].uid)) {
                            users_toFilter.push(goalUser.dataValues[i].uid);
                        }
                    }
                    return users_toFilter;
                })


        })
        //Filter User
        .then(function (users_toFilter) {

            return filterNotification(actor_uid, activity_type, 'SHARE_GOAL', post_id, goal_id, users_toFilter)
                .then(function (uidListToNotify_ShareGoal) {

                    if (uidListToNotify_ShareGoal.users_toast.length > 0) {
                        // Merge both arrays and get unique items
                        users_ToastNotifications = users_ToastNotifications.concat(uidListToNotify_ShareGoal.users_toast).unique();

                        users_EmailNotifications = users_EmailNotifications.concat(uidListToNotify_ShareGoal.users_email).unique();

                        users_MobileNotifications = users_MobileNotifications.concat(uidListToNotify_ShareGoal.users_mobile).unique();
                    }
                    return;
                });

        })
        //Sending Share Goal Notifications
        .then(function () {
            //Sending share goal notification
            var data = [];
            var created = helpers.getUnixTimeStamp();
            for (var i = 0; i < users_ToastNotifications.length; i++) {
                data.push({
                    uid: users_ToastNotifications[i],
                    activity_id: activity_id,
                    created: created
                });
            }

            var toast = require('./ToastNotifications.js');
            toast.toastNotifications(data);

            //send email notifications
            var emailData = {};
            emailData.To_uid = users_EmailNotifications;
            emailData.actor_user = actor_uid;
            emailData.type = 'SHARE_GOAL';
            emailData.data = {
                goal_id: goal_id,
                post_id: post_id
            };

            var email = require('./EmailNotifications.js');
            email.emailNotifications(emailData);

            //send mobile notifications
            //var push = require('../PushNotifications.js');

        })
        //Sending M<entioned Notifications
        .then(function () {
            USERMENTION_POST(activity_id, activity_type, actor_uid, users_Mentioned, goal_id, post_id);
        })

};

function SHARE_POST(actor_uid, activity_id, activity_type, post_id) {

    //final arrays of users to receive notification
    var users_ToastNotifications = [];
    var users_EmailNotifications = [];
    var users_MobileNotifications = [];
    var users_Mentioned = [];

    return getMentionedusers_Post(post_id)
        //get mentioned users
        .then(function (mentioned_uid) {
            users_Mentioned = mentioned_uid;
        })

        .then(function () {
            var posts = objAllTables.posts.posts();
            return posts.findOne({
                attributes: ['uid'],
                where: {
                    id: post_id
                }
            })
                .then(function (post) {

                    var users_toFilter = [];

                    for (var i = 0; i < post.length; i++) {
                        //if mentioned users list does not contain this uid, keep it in Contribution list
                        //else, remove it from Contribution list, and keep it in mentioned users list
                        if (!users_Mentioned.contains(users_Mentioned, post.dataValues[i].uid)) {
                            users_toFilter.push(post.dataValues[i].uid);
                        }
                    }
                    return users_toFilter;

                })

        })
        //Filter User
        .then(function (users_toFilter) {

            return filterNotification(actor_uid, activity_type, 'SHARE_POST', post_id, null, users_toFilter)
                .then(function (uidListToNotify_SharePost) {

                    if (uidListToNotify_SharePost.users_toast.length > 0) {
                        // Merge both arrays and get unique items
                        users_ToastNotifications = usersToNotify.concat(uidListToNotify_SharePost.users_toast).unique();

                        users_EmailNotifications = usersToNotify_email.concat(uidListToNotify_SharePost.users_email).unique();

                        users_MobileNotifications = usersToNotify_mobile.concat(uidListToNotify_SharePost.users_mobile).unique();
                    }
                    return;
                });
        })
        //Sending Notifications Share Post
        .then(function () {
            //Sending share post notification
            var data = [];
            var created = helpers.getUnixTimeStamp();
            for (var i = 0; i < users_ToastNotifications.length; i++) {
                data.push({
                    uid: users_ToastNotifications[i],
                    activity_id: activity_id,
                    created: created
                });
            }

            var toast = require('./ToastNotifications.js');
            toast.toastNotifications(data);

            //send email notifications
            var emailData = {};
            emailData.To_uid = users_EmailNotifications;
            emailData.actor_user = actor_uid;
            emailData.type = 'SHARE_POST';
            emailData.data = {
                post_id: post_id
            };

            var email = require('./EmailNotifications.js');
            email.emailNotifications(emailData);

            //send mobile notifications
            //var push = require('../PushNotifications.js');

        })
        //Senidng Mentioned Notifications
        .then(function () {
            USERMENTION_POST(activity_id, activity_type, actor_uid, users_Mentioned, null, post_id);
        })
};

function LINK_GOAL(actor_uid, activity_id, activity_type, post_id, to_goal_id, from_goal_id) {

    //final arrays of users to receive notification
    var users_ToastNotifications = [];
    var users_EmailNotifications = [];
    var users_MobileNotifications = [];

    var goals = objAllTables.goals.goals();

    return goals.findOne({
        attributes: ['uid'],
        where: {
            goal_id: to_goal_id
        }
    })
        .then(function (goal) {

            return filterNotification(actor_uid, activity_type, 'LINK_GOAL', post_id, to_goal_id, [goal.dataValues.uid])
                .then(function (uidListToNotify_LinkGoal) {

                    if (uidListToNotify_LinkGoal.users_toast.length > 0) {
                        // Merge both arrays and get unique items
                        users_ToastNotifications = users_ToastNotifications.concat(uidListToNotify_LinkGoal.users_toast).unique();

                        users_EmailNotifications = users_EmailNotifications.concat(uidListToNotify_LinkGoal.users_email).unique();

                        users_MobileNotifications = users_MobileNotifications.concat(uidListToNotify_LinkGoal.users_mobile).unique();
                    }
                    return;
                });
        })
        .then(function () {
            var data = [];
            var created = helpers.getUnixTimeStamp();
            for (var i = 0; i < users_ToastNotifications.length; i++) {
                data.push({
                    uid: users_ToastNotifications[i],
                    activity_id: activity_id,
                    created: created
                });
            }

            var toast = require('./ToastNotifications.js');
            toast.toastNotifications(data);

            //send email notifications
            var emailData = {};
            emailData.To_uid = users_EmailNotifications;
            emailData.actor_user = actor_uid;
            emailData.type = 'LINK_GOAL';
            emailData.data = {
                to_goal_id: to_goal_id,
                post_id: post_id,
                from_goal_id: from_goal_id
            };

            var email = require('./EmailNotifications.js');
            email.emailNotifications(emailData);


            //send push notifications
            var pushData = {};
            pushData.uid = users_MobileNotifications;
            pushData.type = 'LINK_GOAL';
            pushData.actor_user = actor_uid;
            pushData.goal_id = from_goal_id;

            //send mobile notifications
            var push = require('./PushNotifications.js');
            push.pushNotifications(pushData);
        });
};

function STATUS_UPDATE(actor_uid, activity_id, activity_type, post_id, goal_id) {

    return getMentionedusers_Post(post_id)
        //get mentioned users
        .then(function (mentioned_uid) {
            users_Mentioned = mentioned_uid;
            return users_Mentioned;
        })
        //Notification Mention User
        .then(function (users_Mentioned) {
            USERMENTION_POST(activity_id, activity_type, actor_uid, users_Mentioned, goal_id, post_id);
        });
};

function PROGRESS_UPDATED(actor_uid, activity_id, activity_type, goal_id, post_id) {

    //final arrays of users to receive notification
    var users_ToastNotifications = [];
    var old_users_EmailNotifications = [];
    var users_EmailNotifications = {
        all: [],
        followers: [],
        linkers: []
    };
    var users_MobileNotifications = [];
    var users_Mentioned = [];

    var _queryResults;

    return getMentionedusers_Post(post_id)
        //get mentioned users
        .then(function (mentioned_uid) {
            users_Mentioned = mentioned_uid;
        })
        .then(function () {


            var sequelize = db.sequelizeConn();
            var sqlSelectUids = "(SELECT follower_uid as uid, 'FOLLOWER' AS `relation` FROM `goal_followers` where goal_id ={0} and `status` = 'ACTIVE')\
                                UNION\
                                (select uid, 'LINKER' AS `relation` from goal_linked where to_goal_id = {0} and `status`= 'ACTIVE')".format(goal_id);

            return sequelize.query(sqlSelectUids, {
                type: sequelize.QueryTypes.SELECT
            }).then(function (_uids) {
                _queryResults = _uids;
                var users_toFilter = [];

                // for (var i = 0; i < uidList.length; i++) {
                //     //if mentioned users list does not contain this uid, keep it in Contribution list
                //     //else, remove it from Contribution list, and keep it in mentioned users list
                //     if (!users_Mentioned.contains(users_Mentioned, uidList[i].uid)) {
                //         users_toFilter.push(uidList[i].uid);
                //     }
                // }

                _(_uids).forEach(function (value) {
                    //if mentioned users list does not contain this uid, keep it in Contribution list
                    //else, remove it from Contribution list, and keep it in mentioned users list
                    if (!users_Mentioned.contains(users_Mentioned, value.uid))
                        users_toFilter.push(value.uid);
                });

                return users_toFilter;
            })
        })
        .then(function (users_toFilter) {

            return filterNotification(actor_uid, activity_type, 'PROGRESS_UPDATED', null, goal_id, users_toFilter)
                .then(function (uidListToNotify_ProgressUpdated) {

                    if (uidListToNotify_ProgressUpdated.users_toast.length > 0) {
                        // Merge both arrays and get unique items
                        users_ToastNotifications = users_ToastNotifications.concat(uidListToNotify_ProgressUpdated.users_toast).unique();

                        //for email
                        _(uidListToNotify_ProgressUpdated.users_email).forEach(function (value) {

                            users_EmailNotifications.all.push(value);

                            var relation = _.head(_.filter(_queryResults, function (o) {
                                return o.uid == value;
                            })).relation;

                            switch (relation) {
                                case 'FOLLOWER':
                                    users_EmailNotifications.followers.push(value);
                                    break;
                                case 'LINKER':
                                    users_EmailNotifications.linkers.push(value);
                                    break;
                            }
                        });
                        //users_EmailNotifications = users_EmailNotifications.concat(uidListToNotify_ProgressUpdated.users_email).unique();

                        users_MobileNotifications = users_MobileNotifications.concat(uidListToNotify_ProgressUpdated.users_mobile).unique();
                    }
                    return users_ToastNotifications;
                });

        })

        //Sending progress notifications
        .then(function (users_ToastNotifications) {
            var data = [];
            var created = helpers.getUnixTimeStamp();
            for (var i = 0; i < users_ToastNotifications.length; i++) {
                data.push({
                    uid: users_ToastNotifications[i],
                    activity_id: activity_id,
                    created: created
                });
            }

            var toast = require('./ToastNotifications.js');
            toast.toastNotifications(data);


            //send email notifications
            var emailData = {};
            emailData.To_uid = users_EmailNotifications;
            emailData.actor_user = actor_uid;
            emailData.type = 'PROGRESS_UPDATED';
            emailData.data = {
                goal_id: goal_id,
                post_id: post_id
            };

            var email = require('./EmailNotifications.js');
            email.emailNotifications(emailData);


            //send push notifications
            var pushData = {};
            pushData.uid = users_MobileNotifications;
            pushData.type = 'PROGRESS_UPDATED';
            pushData.actor_user = actor_uid;
            pushData.post_id = post_id;

            //send mobile notifications
            var push = require('./PushNotifications.js');
            push.pushNotifications(pushData);
        })
        .then(function () {
            USERMENTION_POST(activity_id, activity_type, actor_uid, users_Mentioned, goal_id, post_id);
        });
};

function COMMENT(actor_uid, activity_id, activity_type, post_id) {

    //final arrays of users to receive notification
    var users_ToastNotifications = [];
    var users_EmailNotifications = [];
    var users_MobileNotifications = [];

    var users_Mentioned = [];

    return getMentionedusers_COMMENT(post_id)
        //get mentioned users
        .then(function (mentioned_uid) {
            users_Mentioned = mentioned_uid;
        })
        .then(function () {
            var selectUIDs = objAllTables.post_followers.post_followers();
            return selectUIDs.findAll({
                attributes: ['uid'],
                where: {
                    status: 'ACTIVE',
                    post_id: post_id
                }
            })
                .then(function (uidList) {

                    var users_toFilter = [];
                    for (var i = 0; i < uidList.length; i++) {
                        //if mentioned users list does not contain this uid, keep it in Contribution list
                        //else, remove it from Contribution list, and keep it in mentioned users list
                        if (!users_Mentioned.contains(users_Mentioned, uidList[i].uid)) {
                            users_toFilter.push(uidList[i].uid);
                        }
                    }
                    return users_toFilter;
                });

        })
        .then(function (users_toFilter) {

            return filterNotification(actor_uid, activity_type, 'COMMENT', post_id, null, users_toFilter)
                .then(function (uidListToNotify_Comment) {

                    if (uidListToNotify_Comment.users_toast.length > 0) {

                        // Merge both arrays and get unique items
                        users_ToastNotifications = users_ToastNotifications.concat(uidListToNotify_Comment.users_toast).unique();

                        users_EmailNotifications = users_EmailNotifications.concat(uidListToNotify_Comment.users_email).unique();

                        users_MobileNotifications = users_MobileNotifications.concat(uidListToNotify_Comment.users_mobile).unique();
                    }
                    return;
                })
        })
        //Sending progress notifications
        .then(function () {
            var data = [];
            var created = helpers.getUnixTimeStamp();
            for (var i = 0; i < users_ToastNotifications.length; i++) {
                data.push({
                    uid: users_ToastNotifications[i],
                    activity_id: activity_id,
                    created: created
                });
            }

            var toast = require('./ToastNotifications.js');
            toast.toastNotifications(data);


            //send push notifications
            var pushData = {};
            pushData.uid = users_MobileNotifications;
            pushData.type = 'COMMENT';
            pushData.actor_user = actor_uid;
            pushData.post_id = post_id;



            //send mobile notifications
            var push = require('./PushNotifications.js');
            push.pushNotifications(pushData);
        })
        .then(function () {
            USERMENTION_COMMENTS(activity_id, activity_type, actor_uid, users_Mentioned, post_id)
        });
};

function REPLY_ON_POSTCOMMENT(actor_uid, activity_id, activity_type, post_id) {

    //final arrays of users to receive notification
    var users_ToastNotifications = [];
    var users_EmailNotifications = [];
    var users_MobileNotifications = [];

    var users_Mentioned = [];

    return getMentionedusers_REPLY_COMMENT(post_id)
        //get mentioned users
        .then(function (mentioned_uid) {
            users_Mentioned = mentioned_uid;
        })
        .then(function () {
            var selectUIDs = objAllTables.post_followers.post_followers();
            return selectUIDs.findAll({
                attributes: ['uid'],
                where: {
                    status: 'ACTIVE',
                    post_id: post_id
                }
            }).then(function (uidList) {

                var users_toFilter = [];
                for (var i = 0; i < uidList.length; i++) {
                    //if mentioned users list does not contain this uid, keep it in Contribution list
                    //else, remove it from Contribution list, and keep it in mentioned users list
                    if (!users_Mentioned.contains(users_Mentioned, uidList[i].uid)) {
                        users_toFilter.push(uidList[i].uid);
                    }
                }
                return users_toFilter;
            });

        }).then(function (users_toFilter) {

            return filterNotification(actor_uid, activity_type, 'REPLY_ON_POSTCOMMENT', post_id, null, users_toFilter)
                .then(function (uidListToNotify_CommentReply) {

                    if (uidListToNotify_Motivate.users_toast.length > 0) {
                        // Merge both arrays and get unique items
                        users_ToastNotifications = users_ToastNotifications.concat(uidListToNotify_CommentReply.users_toast).unique();

                        users_EmailNotifications = users_EmailNotifications.concat(uidListToNotify_CommentReply.users_email).unique();

                        users_MobileNotifications = users_MobileNotifications.concat(uidListToNotify_CommentReply.users_mobile).unique();
                    }
                    return users_ToastNotifications;

                })
        })
        .then(function (users_ToastNotifications) {
            var data = [];
            var created = helpers.getUnixTimeStamp();
            for (var i = 0; i < users_ToastNotifications.length; i++) {
                data.push({
                    uid: users_ToastNotifications[i],
                    activity_id: activity_id,
                    created: created
                });
            }
            var toast = require('./ToastNotifications.js');
            toast.toastNotifications(data);


            //send email notifications
            var emailData = {};
            emailData.To_uid = users_EmailNotifications;
            emailData.actor_user = actor_uid;
            emailData.type = 'REPLY_ON_POSTCOMMENT';
            emailData.data = {
                post_id: post_id
            };

            var email = require('./EmailNotifications.js');
            email.emailNotifications(emailData);

            //send mobile notifications
            //var push = require('../PushNotifications.js');
        })
        .then(function () {
            USERMENTION_COMMENTS(activity_id, activity_type, actor_uid, users_Mentioned, post_id)
        });
};

function USER_FOLLOW_REQUEST_CREATED(actor_uid, to_uid) {
    //TODO EMAIL, PUSH NOTIFICATION
    return new Promise(function (resolve, error) {
        var created = helpers.getUnixTimeStamp();
        var data = [];
        data.push({
            uid: to_uid,
            details: actor_uid,
            type: 'USER_FOLLOW_REQUEST_CREATED',
            created: created
        });
        //send toast notifications
        var toast = require('./ToastNotifications.js');
        toast.toastNotifications(data);
        resolve(data);
    });

}

function USER_FOLLOW_REQUEST_ACCEPTED(actor_uid, to_uid) {
    //TODO EMAIL, PUSH NOTIFICATION

    return new Promise(function (resolve, error) {
        var created = helpers.getUnixTimeStamp();
        var data = [];
        data.push({
            uid: actor_uid,     //requester
            details: to_uid,    //request accepter
            type: 'USER_FOLLOW_REQUEST_ACCEPTED',
            created: created
        });
        //send toast notifications
        var toast = require('./ToastNotifications.js');
        toast.toastNotifications(data);
        resolve(data);
    });
}

//#############################################################
//###################### Public Methods  ######################
//#############################################################

exports.createNotifications = function (notification_info) {

    /*obj = {
     -activity_id:
     -actor_uid:
     -activity_type:
     post_id:               null
     -goal_id:               null
     -notification_type:
     users:

     type: 'CONTRIBUTION',
     };*/

    if (notification_info.activity_type == 'LOGIN') {

    }
    else if (notification_info.activity_type == 'GOAL_FOLLOWED') {
        GOAL_FOLLOWED(notification_info.actor_uid, notification_info.activity_id, notification_info.activity_type, notification_info.goal_id, notification_info.post_id);
    }
    else if (notification_info.activity_type == 'USER_FOLLOWED') {
        USER_FOLLOWED(notification_info.actor_uid, notification_info.activity_id, notification_info.activity_type, notification_info.followed_uid, notification_info.post_id);
    }
    else if (notification_info.activity_type == 'PROGRESS_UPDATED') {
        PROGRESS_UPDATED(notification_info.actor_uid, notification_info.activity_id, notification_info.activity_type, notification_info.goal_id, notification_info.post_id);
    }
    else if (notification_info.activity_type == 'CONTRIBUTION') {
        CONTRIBUTION(notification_info.actor_uid, notification_info.activity_id, notification_info.activity_type, notification_info.goal_id, notification_info.post_id);
    }
    else if (notification_info.activity_type == 'MILESTONE_CREATED') {
        MILESTONE_CREATED(notification_info.actor_uid, notification_info.activity_id, notification_info.activity_type, notification_info.goal_id, notification_info.post_id, notification_info.milestone_id);
    }
    else if (notification_info.activity_type == 'MILESTONE_COMPLETED') {
        MILESTONE_COMPLETED(notification_info.actor_uid, notification_info.activity_id, notification_info.activity_type, notification_info.goal_id, notification_info.post_id, notification_info.milestone_id);
    }
    else if (notification_info.activity_type == 'COMMENT') {
        COMMENT(notification_info.actor_uid, notification_info.activity_id, notification_info.activity_type, notification_info.post_id);
    }
    else if (notification_info.activity_type == 'REPLY_ON_POSTCOMMENT') {
        REPLY_ON_POSTCOMMENT(notification_info.actor_uid, notification_info.activity_id, notification_info.activity_type, notification_info.post_id);
    }
    else if (notification_info.activity_type == 'MOTIVATE_ON_POST') {
        MOTIVATE_ON_POST(notification_info.actor_uid, notification_info.activity_id, notification_info.activity_type, notification_info.post_id);
    }
    else if (notification_info.activity_type == 'MOTIVATE_ON_GOAL') {
        MOTIVATE_ON_GOAL(notification_info.actor_uid, notification_info.activity_id, notification_info.activity_type, notification_info.goal_id);
    }
    else if (notification_info.activity_type == 'SHARE_GOAL') {
        SHARE_GOAL(notification_info.actor_uid, notification_info.activity_id, notification_info.activity_type, notification_info.post_id, notification_info.goal_id);
    }
    else if (notification_info.activity_type == 'SHARE_POST') {
        SHARE_POST(notification_info.actor_uid, notification_info.activity_id, notification_info.activity_type, notification_info.post_id);
    }
    else if (notification_info.activity_type == 'LINK_GOAL') {
        LINK_GOAL(notification_info.actor_uid, notification_info.activity_id, notification_info.activity_type, notification_info.post_id, notification_info.to_goal_id, notification_info.from_goal_id);
    }
    else if (notification_info.activity_type == 'STATUS_UPDATE') {
        STATUS_UPDATE(notification_info.actor_uid, notification_info.activity_id, notification_info.activity_type, notification_info.post_id);
    }
    else if (notification_info.activity_type == 'USERMENTIONED') {

    }
    else if (notification_info.activity_type == 'USER_FOLLOW_REQUEST_CREATED') {
        USER_FOLLOW_REQUEST_CREATED(notification_info.actor_uid, notification_info.to_uid)
    }
    else if (notification_info.activity_type == 'USER_FOLLOW_REQUEST_ACCEPTED') {
        USER_FOLLOW_REQUEST_ACCEPTED(notification_info.actor_uid, notification_info.to_uid);
    }

    //method end
    return;
};

exports.checkAndAddUserToPostFollowers = function (post_id, uid) {
    var post_followers = objAllTables.post_followers.post_followers();
    return post_followers.findOrCreate({
        where: {
            post_id: post_id,
            uid: uid
        },
        defaults: {
            status: 'ACTIVE',
            created: helpers.getUnixTimeStamp()
        }
    }).spread(function (post, created) {
        if (created == false) {
            return true;
        } else {
            return true;
        }
    }).catch(function (err) {
        console.error('in catch - Notifications.checkAndAddUserToPostFollowers', err);
        return false;
    });
}

//#############################################################
//###################### Reusables  ###########################
//#############################################################

var titleGenerator = exports.titleGenerator = function titleGenerator(title) {
    //function titleGenerator(title) {

    var entities = [];
    var finalText = "";
    var data = {};

    for (var i = 0; i < title.length; i++) {
        var object = title[i];
        for (key in object) {
            if (object.hasOwnProperty("bold")) {
                entities.push({ offset: finalText.length, length: object[key].length });
                finalText += object[key] + ' ';
            }
            else {
                finalText += object[key] + ' ';
            }
        }
    }

    var final = finalText.trim();
    data.text = final;
    data.entities = entities;

    return data;
}

function getNotifications(notificationsObj, SessionUser) {

    //convert object to array
    var notificationsList = Object.keys(notificationsObj).map(function (key) { return notificationsObj[key] });

    return new Promise(function (resolve, reject) {
        //render objects from notification list
        var notifications = [];

        // loop through the data retrieved from database and generate notification objects
        var promiseFor = Promise.method(function (condition, action, value) {
            if (!condition(value)) return value;
            return action(value).then(promiseFor.bind(null, condition, action));
        });

        promiseFor(function (count) {
            return count < notificationsList.length;
        }, function (count) {
            //######################### loop body (start) #########################
            var notification_info = notificationsList[count];

            var actors_total = notification_info.otherActorsCount;

            //######################### render objects (start) #########################

            if (notification_info.activity_type == 'GOAL_FOLLOWED') {

                //set common values of notification object
                var notification_obj = {};
                notification_obj.id = notification_info.n_id;
                notification_obj.read = notification_info.read;
                notification_obj.created = notification_info.created;
                notification_obj.type = notification_info.activity_type;    //set 'activity type' as 'notification type' by default

                //get goal object to get its name
                return helpers.GetGoalMini(notification_info.source_id, null, SessionUser.uid)
                    .then(function (goal) {
                        notification_obj.goal = goal;
                        return notification_obj;
                    })
                    //adding notifying user object
                    .then(function (notification_obj) {
                        return helpers.getUserMini(notification_info.actor_uid, SessionUser.uid, false)
                            .then(function (user) {

                                notification_obj.actor_user = user;
                                return notification_obj;
                            });
                    })
                    //adding other properties of object
                    .then(function (notification_obj) {
                        if (notification_info.otherActorsCount > 0)
                            notificationData = [{ "bold": notification_obj.actor_user.name }, { "regular": "and" }, { "bold": notification_info.otherActorsCount + " others" }, { "regular": "followed your goal" }];
                        else
                            notificationData = [{ "bold": notification_obj.actor_user.name }, { "regular": "followed your goal" }, { "bold": notification_obj.goal.name }];

                        //create text according to notification type
                        notification_obj.title = titleGenerator(notificationData);

                        notification_obj.contextId = contextId_Create({ source_id: notification_info.source_id, activity_type: notification_info.activity_type });
                        notification_obj.contextId_d = contextId_Get(notification_obj.contextId);

                        //notification location
                        notification_obj.link = notification_obj.goal.link;

                        //notification details
                        notification_obj.details = { id: notification_obj.goal.id, screen_type: 'goal' };

                        //delete goal object after getting link and name
                        delete notification_obj.goal;

                        //push object to final array
                        notifications.push(notification_obj);

                        //continue the loop
                        return ++count;

                    });

            }
            else if (notification_info.activity_type == 'USER_FOLLOWED') {

                //set common values of notification object
                var notification_obj = {};
                notification_obj.id = notification_info.n_id;
                notification_obj.read = notification_info.read;
                notification_obj.created = notification_info.created;
                notification_obj.type = notification_info.activity_type;    //set 'activity type' as 'notification type' by default

                //adding notifying user object
                return helpers.getUserMini(notification_info.actor_uid, SessionUser.uid, false)
                    .then(function (user) {

                        notification_obj.actor_user = user;
                        return notification_obj;
                    })
                    //adding other properties of object
                    .then(function (notification_obj) {

                        if (notification_info.otherActorsCount > 0)
                            notificationData = [{ "bold": notification_obj.actor_user.name }, { "regular": "and" }, { "bold": notification_info.otherActorsCount + " others" }, { "regular": "followed your profile" }];
                        else
                            notificationData = [{ "bold": notification_obj.actor_user.name }, { "regular": "followed your profile" }];

                        //create text according to notification type
                        notification_obj.title = titleGenerator(notificationData);

                        //create context id
                        notification_obj.contextId = contextId_Create({ id: notification_info.n_id, activity_type: notification_info.activity_type });
                        notification_obj.contextId_d = contextId_Get(notification_obj.contextId);

                        //notification location
                        notification_obj.link = notification_obj.actor_user.link;

                        //notification details
                        notification_obj.details = { id: notification_obj.actor_user.uid, screen_type: 'user' };

                        //push object to final array
                        notifications.push(notification_obj);

                        //continue the loop
                        return ++count;

                    });

            }
            else if (notification_info.activity_type == 'CONTRIBUTION') {

                //set common values of notification object
                var notification_obj = {};
                notification_obj.id = notification_info.n_id;
                notification_obj.read = notification_info.read;
                notification_obj.created = notification_info.created;
                notification_obj.type = notification_info.activity_type;    //set 'activity type' as 'notification type' by default

                //if user was mentioned in contribution, changed the notification type
                if (notification_info.notification_type == 'USERMENTION')
                    notification_obj.type = "MENTIONED_CONTRIBUTION";

                //get goal to get its name
                return helpers.GetGoalMini(notification_info.parent_id, null, SessionUser.uid)
                    .then(function (goal) {
                        notification_obj.goal = goal;
                        return notification_obj;
                    })
                    //adding notifying user object
                    .then(function (notification_obj) {
                        return helpers.getUserMini(notification_info.actor_uid, SessionUser.uid, false)
                            .then(function (user) {

                                notification_obj.actor_user = user;
                                return notification_obj;
                            });
                    })
                    //adding other properties of object
                    .then(function (notification_obj) {

                        if (notification_obj.type == "MENTIONED_CONTRIBUTION") {
                            if (notification_info.otherActorsCount == 1)
                                notificationData = [{ "bold": notification_obj.actor_user.name }, { "regular": "and" }, { "bold": notification_info.otherActorsCount + " other " }, { "regular": "mentioned you in a contribution" }];
                            else if (notification_info.otherActorsCount > 1)
                                notificationData = [{ "bold": notification_obj.actor_user.name }, { "regular": "and" }, { "bold": notification_info.otherActorsCount + " others" }, { "regular": "mentioned you in a contribution" }];
                            else
                                notificationData = [{ "bold": notification_obj.actor_user.name }, { "regular": "mentioned you in a contribution" }];

                            //create text according to notification type
                            notification_obj.title = titleGenerator(notificationData);
                        }
                        else {
                            if (notification_info.otherActorsCount > 0)
                                notificationData = [{ "bold": notification_obj.actor_user.name }, { "regular": "and" }, { "bold": notification_info.otherActorsCount + " others" }, { "regular": "contributed on goal" }, { "bold": notification_obj.goal.name }];
                            else
                                notificationData = [{ "bold": notification_obj.actor_user.name }, { "regular": "contributed on goal" }, { "bold": notification_obj.goal.name }];

                            //create text according to notification type
                            notification_obj.title = titleGenerator(notificationData);
                        }

                        //create context id
                        notification_obj.contextId = contextId_Create({ parent_id: notification_info.parent_id, activity_type: notification_info.activity_type, parent_type: "GOAL" });
                        notification_obj.contextId_d = contextId_Get(notification_obj.contextId);

                        //notification location
                        notification_obj.link = new Array(config.webURL.domain, 'activity', notification_info.source_id).toURL();

                        //notification details
                        notification_obj.details = { id: notification_info.source_id, screen_type: 'post' };

                        //delete goal object after getting its name
                        delete notification_obj.goal;

                        //push object to final array
                        notifications.push(notification_obj);

                        //continue the loop
                        return ++count;

                    });

            }
            else if (notification_info.activity_type == 'PROGRESS_UPDATED') {

                //set common values of notification object
                var notification_obj = {};
                notification_obj.id = notification_info.n_id;
                notification_obj.read = notification_info.read;
                notification_obj.created = notification_info.created;
                notification_obj.type = notification_info.activity_type;    //set 'activity type' as 'notification type' by default

                //if user was mentioned in progress, changed the notification type
                if (notification_info.notification_type == "USERMENTION")
                    notification_obj.type = "MENTIONED_PROGRESS";

                //adding notifying user object
                return helpers.getUserMini(notification_info.actor_uid, SessionUser.uid, false)
                    .then(function (user) {

                        notification_obj.actor_user = user;
                        return notification_obj;
                    })
                    //adding other properties of object
                    .then(function (notification_obj) {

                        //create text according to notification type
                        if (notification_obj.type == "MENTIONED_PROGRESS") {
                            if (notification_info.otherActorsCount > 0)
                                notificationData = [{ "bold": notification_obj.actor_user.name }, { "regular": "and" }, { "bold": notification_info.otherActorsCount + " others" }, { "regular": "mentioned you in a progess" }];
                            else
                                notificationData = [{ "bold": notification_obj.actor_user.name }, { "regular": "mentioned you in a progess" }];

                            //create text according to notification type
                            notification_obj.title = titleGenerator(notificationData);
                        }
                        else {
                            notificationData = [{ "bold": notification_obj.actor_user.name }, { "regular": "has updated the progess" }];

                            //create text according to notification type
                            notification_obj.title = titleGenerator(notificationData);
                        }

                        //create context id
                        notification_obj.contextId = contextId_Create({ parent_id: notification_info.parent_id, activity_type: notification_info.activity_type, parent_type: "GOAL" });
                        notification_obj.contextId_d = contextId_Get(notification_obj.contextId);

                        //notification location
                        notification_obj.link = new Array(config.webURL.domain, 'activity', notification_info.source_id).toURL();

                        //notification details
                        notification_obj.details = { id: notification_info.source_id, screen_type: 'post' };

                        //push object to final array
                        notifications.push(notification_obj);

                        //continue the loop
                        return ++count;

                    });

            }
            else if (notification_info.activity_type == 'MILESTONE_CREATED') {

                //set common values of notification object
                var notification_obj = {};
                notification_obj.id = notification_info.n_id;
                notification_obj.read = notification_info.read;
                notification_obj.created = notification_info.created;
                notification_obj.type = notification_info.activity_type;    //set 'activity type' as 'notification type' by default

                //if user was mentioned in milestone, changed the notification type
                if (notification_info.notification_type == "USERMENTION")
                    notification_obj.type = "MENTIONED_IN_MILESTONE_CREATED";


                //get goal to get its name
                return helpers.GetGoalMini(notification_info.parent_id, null, SessionUser.uid)
                    .then(function (goal) {
                        notification_obj.goal = goal;
                        return notification_obj;
                    })
                    //adding notifying user object
                    .then(function (notification_obj) {
                        return helpers.getUserMini(notification_info.actor_uid, SessionUser.uid, false)
                            .then(function (user) {

                                notification_obj.actor_user = user;
                                return notification_obj;
                            });
                    })
                    //adding other properties of object
                    .then(function (notification_obj) {

                        //create text according to notification type
                        if (notification_obj.type == "MENTIONED_IN_MILESTONE_CREATED") {
                            if (notification_info.otherActorsCount > 0)
                                notificationData = [{ "bold": notification_obj.actor_user.name }, { "regular": "and" }, { "bold": notification_info.otherActorsCount + " others" }, { "regular": "mentioned you in a milestone on goal" }, { "bold": notification_obj.goal.name }];
                            else
                                notificationData = [{ "bold": notification_obj.actor_user.name }, { "regular": "mentioned you in a milestone" }];

                            //create text according to notification type
                            notification_obj.title = titleGenerator(notificationData);
                        }
                        else {
                            notificationData = [{ "bold": notification_obj.actor_user.name }, { "regular": "has created a new Milestone on goal" }, { "bold": notification_obj.goal.name }];

                            //create text according to notification type
                            notification_obj.title = titleGenerator(notificationData);
                        }

                        //notification location
                        notification_obj.link = new Array(config.webURL.domain, 'activity', notification_info.post_id).toURL();

                        //notification details
                        notification_obj.details = { id: notification_info.post_id, screen_type: 'post' };

                        //create context id
                        notification_obj.contextId = contextId_Create({ parent_id: notification_info.parent_id, activity_type: notification_info.activity_type });
                        notification_obj.contextId_d = contextId_Get(notification_obj.contextId);

                        //delete goal object after getting its name
                        delete notification_obj.goal;

                        //push object to final array
                        notifications.push(notification_obj);

                        //continue the loop
                        return ++count;

                    });
            }
            else if (notification_info.activity_type == 'MILESTONE_COMPLETED') {

                //set common values of notification object
                var notification_obj = {};
                notification_obj.id = notification_info.n_id;
                notification_obj.read = notification_info.read;
                notification_obj.created = notification_info.created;
                notification_obj.type = notification_info.activity_type;    //set 'activity type' as 'notification type' by default

                //if user was mentioned in milestone, changed the notification type
                if (notification_info.notification_type == "USERMENTION")
                    notification_obj.type = "MENTIONED_IN_MILESTONE_COMPLETED";


                //get goal to get its name
                return helpers.GetGoalMini(notification_info.parent_id, null, SessionUser.uid)
                    .then(function (goal) {
                        notification_obj.goal = goal;
                        return notification_obj;
                    })
                    //adding notifying user object
                    .then(function (notification_obj) {
                        return helpers.getUserMini(notification_info.actor_uid, SessionUser.uid, false)
                            .then(function (user) {

                                notification_obj.actor_user = user;
                                return notification_obj;
                            });
                    })
                    //adding other properties of object
                    .then(function (notification_obj) {

                        //create text according to notification type
                        if (notification_obj.type == "MENTIONED_IN_MILESTONE_COMPLETED") {
                            if (notification_info.otherActorsCount > 0)
                                notificationData = [{ "bold": notification_obj.actor_user.name }, { "regular": "and" }, { "bold": notification_info.otherActorsCount + " others" }, { "regular": "mentioned you while completing a milestone on goal" }, { "bold": notification_obj.goal.name }];
                            else
                                notificationData = [{ "bold": notification_obj.actor_user.name }, { "regular": "mentioned you while completing a milestone on goal" }, { "bold": notification_obj.goal.name }];

                            //create text according to notification type
                            notification_obj.title = titleGenerator(notificationData);
                        }
                        else {
                            notificationData = [{ "bold": notification_obj.actor_user.name }, { "regular": "has completed a milestone on goal" }, { "bold": notification_obj.goal.name }];

                            //create text according to notification type
                            notification_obj.title = titleGenerator(notificationData);
                        }

                        //notification location
                        notification_obj.link = new Array(config.webURL.domain, 'activity', notification_info.post_id).toURL();

                        //notification details
                        notification_obj.details = { id: notification_info.post_id, screen_type: 'post' };

                        //create context id
                        notification_obj.contextId = contextId_Create({ parent_id: notification_info.parent_id, activity_type: notification_info.activity_type });
                        notification_obj.contextId_d = contextId_Get(notification_obj.contextId);

                        //delete goal object after getting its name
                        delete notification_obj.goal;

                        //push object to final array
                        notifications.push(notification_obj);

                        //continue the loop
                        return ++count;

                    });

            }
            else if (notification_info.activity_type == 'MOTIVATE_ON_POST') {

                //set common values of notification object
                var notification_obj = {};
                notification_obj.id = notification_info.n_id;
                notification_obj.read = notification_info.read;
                notification_obj.created = notification_info.created;
                notification_obj.type = notification_info.activity_type;    //set 'activity type' as 'notification type' by default

                //adding notifying user object
                return helpers.getUserMini(notification_info.actor_uid, SessionUser.uid, false)
                    .then(function (user) {

                        notification_obj.actor_user = user;
                        return notification_obj;
                    })
                    //adding other properties of object
                    .then(function (notification_obj) {

                        if (notification_info.otherActorsCount > 0)
                            notificationData = [{ "bold": notification_obj.actor_user.name }, { "regular": "and" }, { "bold": notification_info.otherActorsCount + " others" }, { "regular": "motivated on your post" }];
                        else
                            notificationData = [{ "bold": notification_obj.actor_user.name }, { "regular": "motivated on your post" }];

                        //create text according to notification type
                        notification_obj.title = titleGenerator(notificationData);

                        //notification location
                        notification_obj.link = new Array(config.webURL.domain, 'activity', notification_info.parent_id).toURL();

                        //notification details
                        notification_obj.details = { id: notification_info.parent_id, screen_type: 'post' };

                        //create context id
                        notification_obj.contextId = contextId_Create({ parent_id: notification_info.parent_id, activity_type: notification_info.activity_type, parent_type: "POST" });
                        notification_obj.contextId_d = contextId_Get(notification_obj.contextId);


                        //push object to final array
                        notifications.push(notification_obj);

                        //continue the loop
                        return ++count;

                    });

            }
            else if (notification_info.activity_type == 'MOTIVATE_ON_GOAL') {

                //set common values of notification object
                var notification_obj = {};
                notification_obj.id = notification_info.n_id;
                notification_obj.read = notification_info.read;
                notification_obj.created = notification_info.created;
                notification_obj.type = notification_info.activity_type;    //set 'activity type' as 'notification type' by default

                //get goal object to get its link
                return helpers.GetGoalMini(notification_info.parent_id, null, SessionUser.uid)
                    .then(function (goal) {
                        notification_obj.goal = goal;
                        return notification_obj;
                    })
                    //adding notifying user object
                    .then(function (notification_obj) {
                        return helpers.getUserMini(notification_info.actor_uid, SessionUser.uid, false)
                            .then(function (user) {

                                notification_obj.actor_user = user;
                                return notification_obj;
                            });
                    })
                    //adding other properties of object
                    .then(function (notification_obj) {

                        if (notification_info.otherActorsCount > 0)
                            notificationData = [{ "bold": notification_obj.actor_user.name }, { "regular": "and" }, { "bold": notification_info.otherActorsCount + " others" }, { "regular": "motivated on your goal" }, { "bold": notification_obj.goal.name }];
                        else
                            notificationData = [{ "bold": notification_obj.actor_user.name }, { "regular": " has motivated your goal" }, { "bold": notification_obj.goal.name }];

                        //create text according to notification type
                        notification_obj.title = titleGenerator(notificationData);

                        //notification location
                        notification_obj.link = notification_obj.goal.link;

                        //notification details
                        notification_obj.details = { id: notification_obj.goal.id, screen_type: 'goal' };

                        //create context id
                        notification_obj.contextId = contextId_Create({ parent_id: notification_info.parent_id, activity_type: notification_info.activity_type, parent_type: "GOAL" });
                        notification_obj.contextId_d = contextId_Get(notification_obj.contextId);

                        //delete goal object after getting its link
                        delete notification_obj.goal;

                        //push object to final array
                        notifications.push(notification_obj);

                        //continue the loop
                        return ++count;

                    });

            }
            else if (notification_info.activity_type == 'SHARE_GOAL') {

                //set common values of notification object
                var notification_obj = {};
                notification_obj.id = notification_info.n_id;
                notification_obj.read = notification_info.read;
                notification_obj.created = notification_info.created;
                notification_obj.type = notification_info.activity_type;	//set 'activity type' as 'notification type' by default

                //if user was mentioned in share goal post, changed the notification type
                if (notification_info.notification_type == 'USERMENTION')
                    notification_obj.type = "MENTIONED_IN_SHARE_GOAL";

                //get goal object to get its name
                return helpers.GetGoalMini(notification_info.source_id, null, SessionUser.uid)
                    .then(function (goal) {
                        notification_obj.goal = goal;
                        return notification_obj;
                    })
                    //adding notifying user object
                    .then(function (notification_obj) {
                        return helpers.getUserMini(notification_info.actor_uid, SessionUser.uid, false)
                            .then(function (user) {

                                notification_obj.actor_user = user;
                                return notification_obj;
                            });
                    })
                    //adding other properties of object
                    .then(function (notification_obj) {
                        if (notification_obj.type == "MENTIONED_IN_SHARE_GOAL") {
                            if (notification_info.otherActorsCount > 0)
                                notificationData = [{ "bold": notification_obj.actor_user.name }, { "regular": "and" }, { "bold": notification_info.otherActorsCount + " others" }, { "regular": "mentioned you in a post" }];
                            else
                                notificationData = [{ "bold": notification_obj.actor_user.name }, { "regular": "mentioned you in a post" }];

                            //create text according to notification type
                            notification_obj.title = titleGenerator(notificationData);
                        }
                        else {
                            if (actors_total > 0)
                                notificationData = [{ "bold": notification_obj.actor_user.name }, { "regular": "and" }, { "bold": actors_total + " others" }, { "regular": "have shared your goal" }, { "bold": notification_obj.goal.name }];
                            else
                                notificationData = [{ "bold": notification_obj.actor_user.name }, { "regular": "has shared your goal" }, { "bold": notification_obj.goal.name }];

                            //create text according to notification type
                            notification_obj.title = titleGenerator(notificationData);
                        }

                        //notification location
                        notification_obj.link = new Array(config.webURL.domain, 'activity', notification_info.post_id).toURL();

                        //notification details
                        notification_obj.details = { id: notification_info.post_id, screen_type: 'post' };

                        //create context id
                        notification_obj.contextId = contextId_Create({ parent_id: notification_info.parent_id, activity_type: notification_info.activity_type });
                        notification_obj.contextId_d = contextId_Get(notification_obj.contextId);

                        //delete goal object after getting its link
                        delete notification_obj.goal;

                        //push object to final array
                        notifications.push(notification_obj);

                        //continue the loop
                        return ++count;
                    });

            }
            else if (notification_info.activity_type == 'SHARE_POST') {

                //set common values of notification object
                var notification_obj = {};
                notification_obj.id = notification_info.n_id;
                notification_obj.read = notification_info.read;
                notification_obj.created = notification_info.created;
                notification_obj.type = notification_info.activity_type;	//set 'activity type' as 'notification type' by default

                //if user was mentioned in share post, change the notification type
                if (notification_info.notification_type == 'USERMENTION')
                    notification_obj.type = "MENTIONED_IN_SHARE_POST";

                //adding notifying user object
                return helpers.getUserMini(notification_info.actor_uid, SessionUser.uid, false)
                    .then(function (user) {

                        notification_obj.actor_user = user;
                        return notification_obj;
                    })
                    //adding other properties of object
                    .then(function (notification_obj) {

                        if (notification_obj.type == "MENTIONED_IN_SHARE_POST") {
                            if (notification_info.otherActorsCount > 0)
                                notificationData = [{ "bold": notification_obj.actor_user.name }, { "regular": "and" }, { "bold": notification_info.otherActorsCount + " others" }, { "regular": "mentioned you in a post" }];
                            else
                                notificationData = [{ "bold": notification_obj.actor_user.name }, { "regular": "mentioned you in a post" }];

                            //create text according to notification type
                            notification_obj.title = titleGenerator(notificationData);
                        }
                        else {
                            if (notification_info.otherActorsCount > 0)
                                notificationData = [{ "bold": notification_obj.actor_user.name }, { "regular": "and" }, { "bold": actors_total + " others" }, { "regular": "has shared your post" }];
                            else
                                notificationData = [{ "bold": notification_obj.actor_user.name }, { "regular": "has shared your post" }];

                            //create text according to notification type
                            notification_obj.title = titleGenerator(notificationData);
                        }

                        //notification location
                        notification_obj.link = new Array(config.webURL.domain, 'activity', notification_info.post_id).toURL();

                        //notification details
                        notification_obj.details = { id: notification_info.post_id, screen_type: 'post' };

                        //create context id
                        notification_obj.contextId = contextId_Create({ parent_id: notification_info.parent_id, activity_type: notification_info.activity_type });
                        notification_obj.contextId_d = contextId_Get(notification_obj.contextId);

                        //push object to final array
                        notifications.push(notification_obj);

                        //continue the loop
                        return ++count;

                    });

            }
            else if (notification_info.activity_type == 'LINK_GOAL') {

                //set common values of notification object
                var notification_obj = {};
                notification_obj.id = notification_info.n_id;
                notification_obj.read = notification_info.read;
                notification_obj.created = notification_info.created;
                notification_obj.type = notification_info.activity_type; //Ser default notification type to activity type

                //get source goal
                return helpers.GetGoalMini(notification_info.source_id, null, SessionUser.uid)
                    .then(function (goal) {
                        notification_obj.source_goal = goal;
                        return notification_obj;
                    })
                    //get target goal
                    .then(function (notification_obj) {
                        return helpers.GetGoalMini(notification_info.parent_id, null, SessionUser.uid)
                            .then(function (goal) {
                                notification_obj.target_goal = goal;
                                return notification_obj;
                            })
                    })
                    //adding notifying user object
                    .then(function (notification_obj) {
                        return helpers.getUserMini(notification_info.actor_uid, SessionUser.uid, false)
                            .then(function (user) {

                                notification_obj.actor_user = user;
                                return notification_obj;
                            });
                    })
                    //adding other properties of object
                    .then(function (notification_obj) {

                        //create text according to notification type
                        if (notification_info.otherActorsCount > 0)
                            notificationData = [{ "bold": notification_obj.actor_user.name }, { "regular": "and" }, { "bold": notification_info.otherActorsCount + " others" }, { "regular": "linked their goals to your goal" }, { "bold": notification_obj.target_goal.name }];
                        else
                            notificationData = [{ "bold": notification_obj.actor_user.name }, { "regular": "linked a goal" }, { "bold": notification_obj.source_goal.name }, { "regular": "to your goal" }, { "bold": notification_obj.target_goal.name }];

                        notification_obj.title = titleGenerator(notificationData);

                        //notification location
                        notification_obj.link = notification_obj.source_goal.link;

                        //notification details
                        notification_obj.details = { id: notification_obj.source_goal.id, screen_type: 'goal' };

                        //create context id
                        notification_obj.contextId = contextId_Create({ parent_id: notification_info.parent_id, activity_type: notification_info.activity_type, parent_type: "GOAL" });
                        notification_obj.contextId_d = contextId_Get(notification_obj.contextId);

                        //deleting goal objects after getting their properties
                        delete notification_obj.source_goal;
                        delete notification_obj.target_goal;

                        //push object to final array
                        notifications.push(notification_obj);

                        //continue the loop
                        return ++count;
                    });

            }
            else if (notification_info.activity_type == 'COMMENT') {

                //set common values of notification object
                var notification_obj = {};
                notification_obj.id = notification_info.n_id;
                notification_obj.read = notification_info.read;
                notification_obj.created = notification_info.created;
                notification_obj.type = notification_info.activity_type;	//set 'activity type' as 'notification type' by default

                //if user was mentioned in comment, change the notification type
                if (notification_info.notification_type == 'USERMENTION')
                    notification_obj.type = "MENTIONED_IN_COMMENT";

                //adding notifying user object
                return helpers.getUserMini(notification_info.actor_uid, SessionUser.uid, false)
                    .then(function (user) {

                        notification_obj.actor_user = user;
                        return notification_obj;
                    })
                    //adding other properties of object
                    .then(function (notification_obj) {

                        //create text according to notification type
                        if (notification_obj.type == "MENTIONED_IN_COMMENT") {
                            if (notification_info.otherActorsCount > 0)
                                notificationData = [{ "bold": notification_obj.actor_user.name }, { "regular": "and" }, { "bold": actors_total + " others" }, { "regular": "commented on an activity" }];
                            //notificationData = [{ "bold": notification_obj.actor_user.name }, { "regular": "and" }, { "bold": notification_info.otherActorsCount + " others" }, { "regular": "mentioned you in their comments" }];
                            else
                                notificationData = [{ "bold": notification_obj.actor_user.name }, { "regular": "mentioned you in a comment" }];

                            //create text according to notification type
                            notification_obj.title = titleGenerator(notificationData);
                        }
                        else {
                            if (notification_info.otherActorsCount > 0)
                                notificationData = [{ "bold": notification_obj.actor_user.name }, { "regular": "and" }, { "bold": actors_total + " others" }, { "regular": "commented on an activity" }];
                            else
                                notificationData = [{ "bold": notification_obj.actor_user.name }, { "regular": "commented on an activity" }];

                            //create text according to notification type
                            notification_obj.title = titleGenerator(notificationData);
                        }

                        //create context id
                        notification_obj.contextId = contextId_Create({ parent_id: notification_info.parent_id, activity_type: notification_info.activity_type, parent_type: "POST" });
                        notification_obj.contextId_d = contextId_Get(notification_obj.contextId);

                        //notification location
                        notification_obj.link = new Array(config.webURL.domain, 'activity', notification_info.parent_id).toURL();

                        //notification details
                        notification_obj.details = { id: notification_info.parent_id, screen_type: 'comment' };

                        //push object to final array
                        notifications.push(notification_obj);

                        //continue the loop
                        return ++count;
                    });

            }
            else if (notification_info.activity_type == 'REPLY_ON_POSTCOMMENT') {

                //set common values of notification object
                var notification_obj = {};
                notification_obj.id = notification_info.n_id;
                notification_obj.read = notification_info.read;
                notification_obj.created = notification_info.created;
                notification_obj.type = notification_info.activity_type;	//set 'activity type' as 'notification type' by default

                //if user was mentioned in a reply on comment, change the notification type
                if (notification_info.notification_type == 'USERMENTION')
                    notification_obj.type = "MENTIONED_IN_REPLY_COMMENT";

                //adding notifying user object
                return helpers.getUserMini(notification_info.actor_uid, SessionUser.uid, false)
                    .then(function (user) {

                        notification_obj.actor_user = user;
                        return notification_obj;
                    })
                    //adding other properties of object
                    .then(function (notification_obj) {
                        //create text according to notification type
                        if (notification_obj.type == "MENTIONED_IN_REPLY_COMMENT") {
                            if (notification_info.otherActorsCount > 0)
                                notificationData = [{ "bold": notification_obj.actor_user.name }, { "regular": "and" }, { "bold": notification_info.otherActorsCount + " others" }, { "regular": "mentioned you in their replies" }];
                            else
                                notificationData = [{ "bold": notification_obj.actor_user.name }, { "regular": "mentioned you in a reply" }];

                            //create text according to notification type
                            notification_obj.title = titleGenerator(notificationData);
                        }
                        else {
                            if (notification_info.otherActorsCount > 0)
                                notificationData = [{ "bold": notification_obj.actor_user.name }, { "regular": "and" }, { "bold": actors_total + " others" }, { "regular": "replied on a comment" }];
                            else
                                notificationData = [{ "bold": notification_obj.actor_user.name }, { "regular": "reply on a comment" }];

                            //create text according to notification type
                            notification_obj.title = titleGenerator(notificationData);
                        }
                        //notification location
                        notification_obj.link = new Array(config.webURL.domain, 'activity', notification_info.parent_id).toURL();

                        //notification details
                        notification_obj.details = { id: notification_info.parent_id, screen_type: 'comment' };

                        //create context id
                        notification_obj.contextId = contextId_Create({ parent_id: notification_info.parent_id, activity_type: notification_info.activity_type, parent_type: "POST" });
                        notification_obj.contextId_d = contextId_Get(notification_obj.contextId);

                        //push object to final array
                        notifications.push(notification_obj);

                        //continue the loop
                        return ++count;

                    });

            }
            else if (notification_info.activity_type == 'STATUS_UPDATE') {

                //set common values of notification object
                var notification_obj = {};
                notification_obj.id = notification_info.n_id;
                notification_obj.read = notification_info.read;
                notification_obj.created = notification_info.created;
                notification_obj.type = notification_info.activity_type;	//set 'activity type' as 'notification type' by default

                //if user was mentioned in post, change the notification type
                if (notification_info.notification_type == 'USERMENTION')
                    notification_obj.type = "MENTIONED_STATUS";

                //adding notifying user object
                return helpers.getUserMini(notification_info.actor_uid, SessionUser.uid, false)
                    .then(function (user) {

                        notification_obj.actor_user = user;
                        return notification_obj;
                    })
                    //adding other properties of object
                    .then(function (notification_obj) {

                        //create text according to notification type
                        if (notification_obj.type == "MENTIONED_STATUS") {
                            if (notification_info.otherActorsCount > 0)
                                notificationData = [{ "bold": notification_obj.actor_user.name }, { "regular": "and" }, { "bold": notification_info.otherActorsCount + " others" }, { "regular": "mentioned you in their status" }];
                            else
                                notificationData = [{ "bold": notification_obj.actor_user.name }, { "regular": "mentioned you in a post" }];

                            //create text according to notification type
                            notification_obj.title = titleGenerator(notificationData);
                        }
                        else {
                            notificationData = [{ "bold": notification_obj.actor_user.name }, { "regular": "has updated status" }];

                            //create text according to notification type
                            notification_obj.title = titleGenerator(notificationData);
                        }

                        //create context id
                        notification_obj.contextId = contextId_Create({ parent_id: notification_info.parent_id, activity_type: notification_info.activity_type, parent_type: "POST" });
                        notification_obj.contextId_d = contextId_Get(notification_obj.contextId);

                        //notification location
                        notification_obj.link = new Array(config.webURL.domain, 'activity', notification_info.source_id).toURL();

                        //notification details
                        notification_obj.details = { id: notification_info.source_id, screen_type: 'post' };

                        //push object to final array
                        notifications.push(notification_obj);

                        //continue the loop
                        return ++count;

                    });

            }
            else if (notification_info.activity_type == 'USER_FOLLOW_REQUEST_CREATED') {

                //set common values of notification object
                var notification_obj = {};
                notification_obj.id = notification_info.n_id;
                notification_obj.read = notification_info.read;
                notification_obj.created = notification_info.created;
                notification_obj.type = notification_info.notification_type;

                return helpers.getUserMini(notification_info.detail_uid, SessionUser.uid, false)
                    .then(function (user) {

                        notification_obj.actor_user = user;
                        return notification_obj;
                    });

                //create text of notification type
                if (notification_info.otherActorsCount > 0)
                    notificationData = [{ "bold": notification_obj.actor_user.name }, { "regular": "and" }, { "bold": notification_info.otherActorsCount + " others" }, { "regular": "requested for follow" }];
                else
                    notificationData = [{ "bold": notification_obj.actor_user.name }, { "regular": "has request for follow" }];

                //create text according to notification type
                notification_obj.title = titleGenerator(notificationData);


                //create context id
                notification_obj.contextId = contextId_Create({ activity_type: notification_info.activity_type });
                notification_obj.contextId_d = contextId_Get(notification_obj.contextId);

                //notification location
                notification_obj.link = new Array(config.webURL.domain, notification_info.actor_user.link).toURL();

                //push object to final array
                notifications.push(notification_obj);

                //continue the loop
                return ++count;



            }
            else if (notification_info.activity_type == 'USER_FOLLOW_REQUEST_ACCEPTED') {

                //set common values of notification object
                var notification_obj = {};
                notification_obj.id = notification_info.n_id;
                notification_obj.read = notification_info.read;
                notification_obj.created = notification_info.created;
                notification_obj.type = notification_info.notification_type;

                return helpers.getUserMini(notification_info.detail_uid, SessionUser.uid, false)
                    .then(function (user) {

                        notification_obj.actor_user = user;
                        return notification_obj;
                    });

                //create text of notification type
                if (notification_info.otherActorsCount > 0)
                    notificationData = [{ "bold": notification_obj.actor_user.name }, { "regular": "and" }, { "bold": notification_info.otherActorsCount + " others" }, { "regular": "has accepted your follow request" }];
                else
                    notificationData = [{ "bold": notification_obj.actor_user.name }, { "regular": "has accepted your follow request" }];

                //create text according to notification type
                notification_obj.title = titleGenerator(notificationData);


                //create context id
                notification_obj.contextId = contextId_Create({ activity_type: notification_info.activity_type });
                notification_obj.contextId_d = contextId_Get(notification_obj.contextId);

                //notification location
                notification_obj.link = new Array(config.webURL.domain, notification_info.actor_user.link).toURL();

                //push object to final array
                notifications.push(notification_obj);

                //continue the loop
                return ++count;



            }

            //continue the loop
            else {
                return new Promise(function (resolve) {
                    //return ++count;
                    resolve(++count);
                });
            }

            //######################### render objects (end) #########################

            //######################### loop body (end) #########################
        }, 0)
            .then(function () {
                resolve(notifications);
            });
    });
}

function filterNotification(actorId, activityType, notificationType, postId, goalId, userList) {

    //function filterNotification(obj) {

    //var object_to_filter = {};
    //object_to_filter.actor_uid = actor_uid;
    //object_to_filter.activity_id = activity_id;
    //object_to_filter.activity_type = activity_type;
    //object_to_filter.notification_type = 'CONTRIBUTION';
    //object_to_filter.goal_id = goal_id;
    //object_to_filter.users = uidListContributionNotification;

    // obj = {actor_uid,activity_id, activity_type, post_id, goal_id,notification_type, users };

    //if array is empty, do not proceed
    if (userList.length == 0) {
        return new Promise(function (resolve) {
            resolve({
                "users_toast": [],
                "users_email": [],
                "users_mobile": []
            });
        });
    }

    //var actorId = obj.actor_uid;
    //var activityType = obj.activity_type;
    //var postId = obj.post_id;
    //var goalId = obj.goal_id;
    //var notificationType = obj.notification_type;
    //var userList = obj.users;

    var finalUsersList = {};    //will contain three arrays
    var finalUniqueArray = [];
    //separating arrays by notification types
    finalUsersList.users_toast = [];
    finalUsersList.users_email = [];
    finalUsersList.users_mobile = [];

    var sequelize = db.sequelizeConn();
    var Query = "SELECT nUser.uid, nUser.toast as toast, nUser.mobile as mobile, nUser.email as email\
                from user_notification_settings nUser\
                JOIN default_notification_types nTypes on nTypes.id = nUser.type_id\
                WHERE nTypes.type = '{0}' AND nTypes.`status` = 'ACTIVE'\
                AND uid IN ({1})".format(notificationType, userList.toString());

    return sequelize.query(Query, {
        type: sequelize.QueryTypes.SELECT
    })
        .then(function (data) {

            for (var i = 0; i < data.length; i++) {

                //web notifications
                if (data[i].toast == 1)
                    finalUsersList.users_toast.push(data[i].uid);

                //email notifications
                if (data[i].email == 1)
                    finalUsersList.users_email.push(data[i].uid);

                //mobile notifications
                if (data[i].mobile == 1)
                    finalUsersList.users_mobile.push(data[i].uid);
            }

            return finalUsersList;
        })
        //if actor user is in the list of Users
        .then(function () {

            finalUniqueArray = finalUsersList.users_toast.concat(finalUsersList.users_mobile.concat(finalUsersList.users_email)).unique();

            if (finalUsersList.users_toast.length == 0 && finalUsersList.users_email.length == 0 && finalUsersList.users_mobile.length == 0)
                throw new Error('Users Empty');

            //remove actor user from list
            for (var i = 0; i < finalUsersList.users_toast.length; i++) {
                if (actorId == finalUsersList.users_toast[i])
                    finalUsersList.users_toast.splice(i, 1);
            }
            for (var i = 0; i < finalUsersList.users_email.length; i++) {
                if (actorId == finalUsersList.users_email[i])
                    finalUsersList.users_email.splice(i, 1);
            }
            for (var i = 0; i < finalUsersList.users_mobile.length; i++) {
                if (actorId == finalUsersList.users_mobile[i])
                    finalUsersList.users_mobile.splice(i, 1);
            }
            return finalUsersList;
        })
        // Filter Users that have not muted actor
        .then(function () {

            if (finalUsersList.users_toast.length == 0 && finalUsersList.users_email.length == 0 && finalUsersList.users_mobile.length == 0)
                throw new Error('Users Empty');

            var user_mute = objAllTables.user_mute.user_mute();
            return user_mute.findAll({
                where: {
                    uid: finalUniqueArray,
                    mute_uid: actorId,
                    status: 'ACTIVE'
                }
            })
                .then(function (users) {
                    //remove mute users from array
                    for (var i = 0; i < users.length; i++) {
                        //Users.push(users[i].dataValues.uid);
                        for (var j = 0; j < finalUsersList.users_toast.length; j++) {
                            if (users[i].dataValues.uid == finalUsersList.users_toast[j])
                                finalUsersList.users_toast.splice(j, 1);
                        }
                        for (var j = 0; j < finalUsersList.users_email.length; j++) {
                            if (users[i].dataValues.uid == finalUsersList.users_email[j])
                                finalUsersList.users_email.splice(j, 1);
                        }
                        for (var j = 0; j < finalUsersList.users_mobile.length; j++) {
                            if (users[i].dataValues.uid == finalUsersList.users_mobile[j])
                                finalUsersList.users_mobile.splice(j, 1);
                        }

                    }

                    return finalUsersList;
                });
        })
        // Filter Users that have not muted post
        .then(function () {

            if (finalUsersList.users_toast.length == 0 && finalUsersList.users_email.length == 0 && finalUsersList.users_mobile.length == 0)
                throw new Error('Users Empty');

            if (postId == null)
                return finalUsersList;
            else {
                var post_followers = objAllTables.post_followers.post_followers();

                return post_followers.findAll({
                    where: {
                        uid: finalUniqueArray,
                        post_id: postId,
                        status: {
                            $ne: 'ACTIVE'
                        }
                    }
                })
                    .then(function (users) {
                        //remove mute users from array
                        for (var i = 0; i < users.length; i++) {
                            for (var j = 0; j < finalUsersList.users_toast.length; j++) {
                                if (users[i].dataValues.uid == finalUsersList.users_toast[j])
                                    finalUsersList.users_toast.splice(j, 1);
                            }
                            for (var j = 0; j < finalUsersList.users_email.length; j++) {
                                if (users[i].dataValues.uid == finalUsersList.users_email[j])
                                    finalUsersList.users_email.splice(j, 1);
                            }
                            for (var j = 0; j < finalUsersList.users_mobile.length; j++) {
                                if (users[i].dataValues.uid == finalUsersList.users_mobile[j])
                                    finalUsersList.users_mobile.splice(j, 1);
                            }

                        }
                        return finalUsersList;
                    });
            }
        })
        //if activity is goal related
        .then(function () {

            if (finalUsersList.users_toast.length == 0 && finalUsersList.users_email.length == 0 && finalUsersList.users_mobile.length == 0)
                throw new Error('Users Empty');

            if (typeof goalId == 'undefined' || goalId == null)
                return finalUsersList;

            var goalRelatedTypes = ["GOAL_CREATED", "PROGRESS_UPDATED", "CONTRIBUTION", "GOAL_ACHEIVED", "GOAL_FOLLOWED", "MILESTONE_CREATED", "MILESTONE_COMPLETED", "LINK_GOAL", "MOTIVATE_ON_GOAL", "SHARE_GOAL"];

            if (finalUsersList.users_toast.contains(goalRelatedTypes, activityType) || finalUsersList.users_email.contains(goalRelatedTypes, activityType) || finalUsersList.users_mobile.contains(goalRelatedTypes, activityType)) {

                var goal_mute = objAllTables.goal_mute.goal_mute();
                return goal_mute.findAll({
                    where: {
                        uid: finalUniqueArray,
                        goal_id: goalId,
                        status: 'ACTIVE'
                    }
                })
                    .then(function (users) {

                        //remove mute goal from array
                        for (var i = 0; i < users.length; i++) {
                            //Users.push(users[i].dataValues.uid);
                            for (var j = 0; j < finalUsersList.users_toast.length; j++) {
                                if (users[i] == finalUsersList.users_toast[j])
                                    finalUsersList.users_toast.splice(j, 1);
                            }
                            for (var j = 0; j < finalUsersList.users_email.length; j++) {
                                if (users[i].dataValues.uid == finalUsersList.users_email[j])
                                    finalUsersList.users_email.splice(j, 1);
                            }
                            for (var j = 0; j < finalUsersList.users_mobile.length; j++) {
                                if (users[i].dataValues.uid == finalUsersList.users_mobile[j])
                                    finalUsersList.users_mobile.splice(j, 1);
                            }
                        }
                        return finalUsersList;
                    });
            }
            else
                return finalUsersList;
        })
        .catch(function (Err) {
            if (Err.message == 'Users Empty')
                return finalUsersList;
            else
                throw new Error(Err);
        })
        .error(function (err) {
            throw new Error(err);
        });

}

function addUserToPostFollowers(post_id, uid) {
    var post_followers = objAllTables.post_followers.post_followers();

    return post_followers.findOrCreate({
        where: {
            post_id: post_id,
            uid: uid
        },
        defaults: {
            created: helpers.getUnixTimeStamp()
        }
    }).spread(function (postFollower, created) {

        if (created === false) {
            if (postFollower.dataValues.status == 'DELETED') {
                return post_followers.update({
                    status: 'ACTIVE',
                    updated: helpers.getUnixTimeStamp()
                }, {
                        where: {
                            id: postFollower.dataValues.id
                        }
                    }).then(function (updated) {
                        return true;
                    });
            } else {
                return true;
            }
        } else {
            return true;
        }
    }).catch(function (err) {
        console.error('Error occurred', err);
    });
}

function removeUserFromPostFollowers(post_id, uid) {
    var post_followers = objAllTables.post_followers.post_followers();

    return post_followers.findOne({
        where: {
            post_id: post_id,
            uid: uid,
            status: 'ACTIVE'
        }
    })
        .then(function (postFollower) {

            if (postFollower.dataValues.status == 'ACTIVE') {
                return post_followers.update({
                    status: 'DELETED',
                    updated: helpers.getUnixTimeStamp()
                }, {
                        where: {
                            id: postFollower.dataValues.id
                        }
                    })
                    .then(function (updated) {
                        return true;
                    });
            } else {
                return true;
            }
        }).catch(function (err) {
            console.error('Error occurred', err);
        });
}

function getMentionedusers_Post(post_id) {

    var mentioned_uid = [];
    var mentioned_post = objAllTables.mentioned_post.mentioned_post();

    return mentioned_post.findAll({
        where: { post_id: post_id, status: 'ACTIVE' },
        attributes: ['mentioned_uid']
    })
        .then(function (mentionIds) {

            for (var k = 0; k < mentionIds.length; k++) {
                mentioned_uid.push(mentionIds[k]['dataValues'].mentioned_uid);
            }
            return mentioned_uid;

        });
}

function contextId_Create(data) {
    return utils.aesAlogrithm.encryption(data);
}

function contextId_Get(cipherText) {
    return utils.aesAlogrithm.decryption(cipherText);
}

function getMentionedusers_COMMENT(post_id) {

    var mentioned_uid = [];
    var mentioned_comment = objAllTables.mentioned_comment.mentioned_comment();

    return mentioned_comment.findAll({
        where: { post_id: post_id, status: 'ACTIVE' },
        attributes: ['mentioned_uid']
    })
        .then(function (mentionIds) {

            for (var k = 0; k < mentionIds.length; k++) {
                mentioned_uid.push(mentionIds[k]['dataValues'].mentioned_uid);
            }
            return mentioned_uid;

        });
}

function getMentionedusers_REPLY_COMMENT(post_id) {

    var mentioned_uid = [];
    var mentioned_reply_comment = objAllTables.mentioned_reply_comment.mentioned_reply_comment();

    return mentioned_reply_comment.findAll({
        where: { post_id: post_id, status: 'ACTIVE' },
        attributes: ['mentioned_uid']
    })
        .then(function (mentionIds) {

            for (var k = 0; k < mentionIds.length; k++) {
                mentioned_uid.push(mentionIds[k]['dataValues'].mentioned_uid);
            }
            return mentioned_uid;

        });
}


//#############################################################
//###################### APIs (Start)  ########################
//#############################################################

exports.postFollow = function (req, res) {

    //######################### Validations (Rules) #########################
    var constraints = {
        "params.id": {
            presence: true
        }
    };

    validate.async(req, constraints).then(success, error);

    function success() {
        helpers.GetActiveSession_ORM(req)
            .then(function (SessionUser) {
                if (SessionUser != null) {

                    return addUserToPostFollowers(req.params.id, SessionUser.uid).then(function (success) {
                        if (success) {
                            res.send(200, {
                                meta: {
                                    status: 200,
                                    message: 'success'
                                }
                            });
                        } else {
                            res.send(500, {
                                meta: {
                                    status: 500,
                                    message: 'could not follow post, an unknown error occurred'
                                }
                            });
                        }
                    });
                }
                //session user is null
                else {
                    res.send({
                        meta: {
                            status: 401,
                            message: 'user is not logged in or invalid token'
                        }
                    });
                }
            })
            .catch(function (err) {
                res.send(500, {
                    meta: {
                        status: 500,
                        message: 'internal server error'
                    },
                    details: err
                });
            });
    }

    function error(errors) {
        if (errors instanceof Error) {
            // This means an exception was thrown from a validator
            res.send("An error ocurred in validation", errors);
        } else {
            res.send({ meta: { status: 401, message: 'validation errors' }, errors: errors });
        }
    }
};

exports.postUnFollow = function (req, res) {

    helpers.GetActiveSession_ORM(req)
        .then(function (SessionUser) {
            if (SessionUser != null) {

                return removeUserFromPostFollowers(req.params.id, SessionUser.uid).then(function (success) {
                    if (success) {
                        res.send(200, {
                            meta: {
                                status: 200,
                                message: 'success'
                            }
                        });
                    } else {
                        res.send(500, {
                            meta: {
                                status: 500,
                                message: 'could not un-follow post, an unknown error occurred'
                            }
                        });
                    }
                });
            }
            //session user is null
            else {
                res.send({
                    meta: {
                        status: 401,
                        message: 'user is not logged in or invalid token'
                    }
                });
            }
        })
        .catch(function (err) {
            res.send(500, {
                meta: {
                    status: 500,
                    message: 'internal server error'
                },
                details: err
            });
        });
};

exports.get = function (req, res) {

    helpers.GetActiveSession_ORM(req)
        .then(function (SessionUser) {
            if (SessionUser != null) {

                var pagination = utils.pagination(req);
                //######################### Create Feed (start) #########################

                return new Promise(function (resolve) {

                    //get notifications list
                    var query_GetFeedList = "CAll sp_GetNotifications({0}, {1}, {2})".format(SessionUser.uid, pagination.offset, pagination.limit);

                    var sequelize = db.sequelizeConn();

                    return sequelize.query(query_GetFeedList, { type: sequelize.QueryTypes.SELECT })
                        .then(function (notifications) {
                            resolve(notifications);
                        });
                })
                    .then(function (notificationList) {

                        var notifications = notificationList[0];
                        var unseen = notificationList[1][0].unseen;

                        //render objects from notifications list
                        return getNotifications(notifications, SessionUser)
                            .then(function (notifications) {

                                var data = {};
                                if (notifications.length > 0)
                                    data = {
                                        unseen: unseen,
                                        notifications: notifications
                                    };
                                else
                                    data = {
                                        unseen: 0,
                                        notifications: []
                                    };
                                return data;
                            });
                    })
                    .then(function (data) {

                        var response = {
                            meta: {
                                status: 200,
                                message: 'success'
                            },
                            data: data
                        };
                        res.send(response);
                    });

                //######################### Create Notification (End) ###########################
            } else {
                res.send({
                    meta: {
                        status: 401,
                        message: 'user is not logged in or invalid token'
                    }
                });
            }
        })
        .error(function (err) {
            res.send({
                meta: {
                    status: 500,
                    message: 'unexpected error'
                },
                details: err
            });
        }).catch(function (err) {
            res.send({
                meta: {
                    status: 500,
                    message: 'unexpected error'
                },
                details: err
            });
        });
};

exports.seen = function (req, res) {
    helpers.GetActiveSession_ORM(req)
        .then(function (SessionUser) {
            if (SessionUser != null) {

                var notifications = objAllTables.notifications.notifications();
                notifications.update({
                    seen: 1
                }, {
                        where: {
                            uid: SessionUser.uid,
                            status: {
                                $ne: 'DELETED'
                            }
                        }
                    })
                    .then(function (updated) {
                        res.send(200, { meta: { status: 200, message: 'success' } })
                    })
            }
            else {
                res.send({ meta: { status: 401, message: 'user is not logged in or invalid token' } });
            }

        })
        .error(function (err) {
            res.send(500, { meta: { status: 500, message: 'unexpected error' }, details: err })
        });
};

exports.read = function (req, res) {

    var query;
    var constraints = {
        "params.id": {
            presence: true,
        }
    };

    validate.async(req, constraints).then(success, error);

    function success() {
        helpers.GetActiveSession_ORM(req)
            .then(function (SessionUser) {

                //var notificationContext =  contextId_Get(req.params.id);
                try {
                    var notificationContext = contextId_Get(req.params.id);

                } catch (e) {
                    res.send(401, { meta: { status: 401, message: 'Wrong context id' } });
                    return
                }

                if (notificationContext.activity_type == 'COMMENT' || notificationContext.activity_type == 'REPLY_ON_POSTCOMMENT' || notificationContext.activity_type == 'MOTIVATE_ON_POST') {

                    query = "UPDATE notifications n\
                             JOIN user_activity a ON n.activity_id = a.id\
                             SET n.seen = 1,\
                                n.`read` = 1\
                            WHERE\
                            a.activity_type = '{0}'\
                            AND a.parent_id = {1}\
                            AND a.parent_type = 'POST'\
                            AND n.uid = {2}".format(notificationContext.activity_type, notificationContext.parent_id, SessionUser.uid);

                } else if (notificationContext.activity_type == 'PROGRESS_UPDATED' || notificationContext.activity_type == 'CONTRIBUTION' || notificationContext.activity_type == 'MOTIVATE_ON_GOAL' || notificationContext.activity_type == 'LINK_GOAL') {

                    query = "UPDATE notifications n\
                             JOIN user_activity a ON n.activity_id = a.id\
                             SET n.seen = 1,\
                                n.`read` = 1\
                            WHERE\
                            a.activity_type = '{0}'\
                            AND a.parent_id = {1}\
                            AND a.parent_type = 'GOAL'\
                            AND n.uid = {2}".format(notificationContext.activity_type, notificationContext.parent_id, SessionUser.uid);

                } else if (notificationContext.activity_type == 'MILESTONE_CREATED' || notificationContext.activity_type == 'MILESTONE_COMPLETED' || notificationContext.activity_type == 'SHARE_GOAL' || notificationContext.activity_type == 'SHARE_POST') {

                    query = "UPDATE notifications n\
                             JOIN user_activity a ON n.activity_id = a.id\
                             SET n.seen = 1,\
                                n.`read` = 1\
                            WHERE\
                            a.activity_type = '{0}'\
                            AND a.parent_id = {1}\
                            AND n.uid = {2}".format(notificationContext.activity_type, notificationContext.parent_id, SessionUser.uid);



                } else if (notificationContext.activity_type == 'GOAL_FOLLOWED') {

                    query = "UPDATE notifications n\
                             JOIN user_activity a ON n.activity_id = a.id\
                             SET n.seen = 1,\
                                n.`read` = 1\
                            WHERE\
                            a.activity_type = '{0}'\
                            AND a.source_id = {1}\
                            AND n.uid = {2}".format(notificationContext.activity_type, notificationContext.source_id, SessionUser.uid);

                } else if (notificationContext.activity_type == 'USER_FOLLOWED') {

                    query = "UPDATE notifications n\
                             JOIN user_activity a ON n.activity_id = a.id\
                             SET n.seen = 1,\
                                n.`read` = 1\
                            WHERE\
                            a.activity_type = '{0}'\
                            AND n.id = {1}\
                            AND n.uid = {2}".format(notificationContext.activity_type, notificationContext.id, SessionUser.uid);

                } else if (notificationContext.activity_type == 'USER_FOLLOW_REQUEST_CREATED' || notificationContext.activity_type == 'USER_FOLLOW_REQUEST_ACCEPTED') {


                } else {
                    res.send(401, { meta: { status: 401, message: 'Invalid context id' } });
                }

                //Debugging --------------------------------------------
                if (query == null || query == "") {
                    throw new Error("activity type: " + notificationContext.activity_type + "id: " + notificationContext.id + "source_id: " + notificationContext.source_id +
                        "parent_id: " + notificationContext.parent_id + "uid: " + SessionUser.uid);

                }

                var sequelize = db.sequelizeConn();
                sequelize.query(query)
                    .then(function (result) {
                        if (result != null) {
                            res.send(200, { meta: { status: 200, message: 'success' } });
                        } else {
                            res.send(404, { meta: { status: 404, message: 'Not found' } });
                        }
                    });

            }).catch(function (err) {
                if (err.message != "break chain") { console.error("Query Empty"); }
                /*   res.send(500, { meta: { status: 500, message: 'Unhandled exception' }, details: err });*/

            })
            .error(function (err) {
                res.send(500, { meta: { status: 500, message: 'unexpected error' }, details: err });
            });
    }

    function error(errors) {
        if (errors instanceof Error) {
            // This means an exception was thrown from a validator
            res.send({ meta: { status: 401, message: 'An error ocuured in validator' }, errors: errors });
        }
        else {
            res.send({ meta: { status: 401, message: 'validation errors' }, errors: errors });
        }
    }
};
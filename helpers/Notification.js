
var _ = require('lodash');
var Promise = require("bluebird");
var models = require('../models');
var utils = require('../helpers/Utils');
var config = require('../config');
var User = require('../models/User');
var Goal = require('../models/Goal');

Notification = function(session_uid){
    if (_.isInteger(session_uid))
        this.session_uid = parseInt(session_uid);
    else
        throw new Error('INVALID_TYPE, only integer is allowed');
}
module.exports = Notification;
Notification.prototype.pagination = {
    offset: 0,
    limit: 5
}

Notification.get = function(session_uid, pagination){
    var _query = 'CALL sp_GetNotifications( {0},{1},{2} )'.format(session_uid, pagination.offset, pagination.limit);
    console.time("notification-query-time");
    return models.sequelize.query(_query, { type: models.sequelize.QueryTypes.SELECT }).then(function(notificationsObject){
        console.timeEnd("notification-query-time");
        return queryExtractor(notificationsObject, true, session_uid).then(function(_notifications){
            return _notifications;
        })
        //return notificationsObject;
    });
}


function queryExtractor(_notifications, titleRequiredOnly, session_uid) {

    var notificationRenderedList = [];

    if (_.isEmpty(_notifications)) {
        return new Promise(function(resolve, reject){
            resolve([]);
        })
    }
    var notifications = _notifications[0];
    var unseen = _notifications[1][0].unseen;
    return new Promise(function(resolve){
        _.forEach(notifications, function(value, key){
            var notificationsObj = createNotification(value);
            notificationRenderedList.push(notificationsObj);
        });
        resolve(notificationRenderedList);
    }).then(function(notificationRenderedList){
            return getObjectsAndLinks(notificationRenderedList,titleRequiredOnly, session_uid).then(function(result){
                var finalResult = {};
                finalResult.seen = unseen;
                finalResult.notifications = result;
                return finalResult;
            });
        });

}

// HELPER FUNCTIONS
function createNotification(notification){

    //common objects, found in every notifications
    var notification_obj = {};
    notification_obj.id = notification.n_id;
    notification_obj.read = notification.read;
    notification_obj.created = notification.created;
    notification_obj.type = notification.activity_type;    //set 'activity type' as 'notification type' by default
    notification_obj.otherActorsCount = notification.otherActorsCount;

    if(notification.activity_type == 'GOAL_FOLLOWED'){

        notification_obj.goal_id = notification.source_id;
        notification_obj.actor_user_id = notification.actor_uid;

        notification_obj.contextId = contextId_Create({ source_id: notification.source_id,  activity_type: notification.activity_type});
        notification_obj.contextId_d = contextId_Get(notification_obj.contextId);

        notification_obj.details = { id: notification.source_id, screen_type: 'goal' };

        return notification_obj;

    }
    else if(notification.activity_type == 'USER_FOLLOWED'){

        notification_obj.actor_user_id = notification.actor_uid;

        notification_obj.contextId = contextId_Create({ id: notification.n_id, activity_type: notification.activity_type});
        notification_obj.contextId_d = contextId_Get(notification_obj.contextId);

        notification_obj.details = { id: notification.actor_uid, screen_type: 'user' };

        return notification_obj;

    }
    else if (notification.activity_type == 'CONTRIBUTION') {

        notification_obj.goal_id = notification.parent_id;
        notification_obj.actor_user_id = notification.actor_uid;

        if (notification.notification_type == 'USERMENTION')
            notification_obj.type = "MENTIONED_CONTRIBUTION";

        notification_obj.contextId = contextId_Create({ parent_id: notification.parent_id, activity_type: notification.activity_type, parent_type: "GOAL" });
        notification_obj.contextId_d = contextId_Get(notification_obj.contextId);

        notification_obj.link = new Array(config.webURL.domain, 'activity', notification.source_id).toURL();
        notification_obj.details = { id: notification.source_id, screen_type: 'post' };
        return notification_obj

    }
    else if (notification.activity_type == 'PROGRESS_UPDATED') {

        if (notification.notification_type == "USERMENTION")
            notification_obj.type = "MENTIONED_PROGRESS";

        notification_obj.actor_user_id = notification.actor_uid;
        notification_obj.contextId = contextId_Create({ parent_id: notification.parent_id, activity_type: notification.activity_type, parent_type: "GOAL" });
        notification_obj.contextId_d = contextId_Get(notification_obj.contextId);

        notification_obj.link = new Array(config.webURL.domain, 'activity', notification.source_id).toURL();
        notification_obj.details = { id: notification.source_id, screen_type: 'post' };
        return notification_obj

    }
    else if (notification.activity_type == 'MILESTONE_CREATED') {

        if (notification.notification_type == "USERMENTION")
            notification_obj.type = "MENTIONED_IN_MILESTONE_CREATED";

        notification_obj.goal_id = notification.parent_id;
        notification_obj.actor_user_id = notification.actor_uid;

        notification_obj.link = new Array(config.webURL.domain, 'activity', notification.post_id).toURL();
        //notification details
        notification_obj.details = { id: notification.post_id, screen_type: 'post' };

        //create context id
        notification_obj.contextId = contextId_Create({ parent_id: notification.parent_id, activity_type: notification.activity_type });
        notification_obj.contextId_d = contextId_Get(notification_obj.contextId);
        return notification_obj;

    }
    else if (notification.activity_type == 'MILESTONE_COMPLETED') {

        if (notification.notification_type == "USERMENTION")
            notification_obj.type = "MENTIONED_IN_MILESTONE_COMPLETED";

        notification_obj.goal_id = notification.parent_id;
        notification_obj.actor_user_id = notification.actor_uid;

        notification_obj.link = new Array(config.webURL.domain, 'activity', notification.post_id).toURL();

        //notification details
        notification_obj.details = { id: notification.post_id, screen_type: 'post' };

        //create context id
        notification_obj.contextId = contextId_Create({ parent_id: notification.parent_id, activity_type: notification.activity_type });
        notification_obj.contextId_d = contextId_Get(notification_obj.contextId);
        return notification_obj;

    }
    else if (notification.activity_type == 'MOTIVATE_ON_POST') {
        notification_obj.actor_user_id = notification.actor_uid;

        //notification location
        notification_obj.link = new Array(config.webURL.domain, 'activity', notification.parent_id).toURL();

        //notification details
        notification_obj.details = { id: notification.parent_id, screen_type: 'post' };

        //create context id
        notification_obj.contextId = contextId_Create({ parent_id: notification.parent_id, activity_type: notification.activity_type, parent_type: "POST" });
        notification_obj.contextId_d = contextId_Get(notification_obj.contextId);

        return notification_obj;
    }
    else if (notification.activity_type == 'MOTIVATE_ON_GOAL') {
        notification_obj.goal_id = notification.parent_id;
        notification_obj.actor_user_id = notification.actor_uid;

        //notification details
        notification_obj.details = { id: notification_obj.goal_id, screen_type: 'goal' };

        //create context id
        notification_obj.contextId = contextId_Create({ parent_id: notification.parent_id, activity_type: notification.activity_type, parent_type: "GOAL" });
        notification_obj.contextId_d = contextId_Get(notification_obj.contextId);

        return notification_obj;
    }
    else if (notification.activity_type == 'SHARE_GOAL') {

        if (notification.notification_type == 'USERMENTION')
            notification_obj.type = "MENTIONED_IN_SHARE_GOAL";

        notification_obj.goal_id = notification.source_id;
        notification_obj.actor_user_id = notification.actor_uid;

        notification_obj.link = new Array(config.webURL.domain, 'activity', notification.post_id).toURL();

        //notification details
        notification_obj.details = { id: notification.post_id, screen_type: 'post' };

        //create context id
        notification_obj.contextId = contextId_Create({ parent_id: notification.parent_id, activity_type: notification.activity_type });
        notification_obj.contextId_d = contextId_Get(notification_obj.contextId);

        return notification_obj;
    }
    else if (notification.activity_type == 'SHARE_POST') {
        //if user was mentioned in share post, change the notification type
        if (notification.notification_type == 'USERMENTION')
            notification_obj.type = "MENTIONED_IN_SHARE_POST";

        notification_obj.actor_user_id = notification.actor_uid;

        //notification location
        notification_obj.link = new Array(config.webURL.domain, 'activity', notification.post_id).toURL();
        //notification details
        notification_obj.details = { id: notification.post_id, screen_type: 'post' };

        //create context id
        notification_obj.contextId = contextId_Create({ parent_id: notification.parent_id, activity_type: notification.activity_type });
        notification_obj.contextId_d = contextId_Get(notification_obj.contextId);

        return notification_obj;
    }
    else if (notification.activity_type == 'LINK_GOAL') {

        notification_obj.source_goal_id =  notification.source_id;
        notification_obj.target_goal_id = notification.parent_id

        //notification details
        notification_obj.details = { id: notification.source_id, screen_type: 'goal' };
        notification_obj.actor_user_id =  notification.actor_uid;
        //create context id
        notification_obj.contextId = contextId_Create({ parent_id: notification.parent_id, activity_type: notification.activity_type, parent_type: "GOAL" });
        notification_obj.contextId_d = contextId_Get(notification_obj.contextId);

        return notification_obj;
    }
    else if (notification.activity_type == 'COMMENT') {

        if (notification.notification_type == 'USERMENTION')
            notification_obj.type = "MENTIONED_IN_COMMENT";

        notification_obj.actor_user_id =  notification.actor_uid;

        //create context id
        notification_obj.contextId = contextId_Create({ parent_id: notification.parent_id, activity_type: notification.activity_type, parent_type: "POST" });
        notification_obj.contextId_d = contextId_Get(notification_obj.contextId);

        //notification location
        notification_obj.link = new Array(config.webURL.domain, 'activity', notification.parent_id).toURL();

        //notification details
        notification_obj.details = { id: notification.parent_id, screen_type: 'comment' };

        return notification_obj;
    }
    else if (notification.activity_type == 'REPLY_ON_POSTCOMMENT') {

        if (notification.notification_type == 'USERMENTION')
            notification_obj.type = "MENTIONED_IN_REPLY_COMMENT";

        notification_obj.actor_user_id =  notification.actor_uid;

        //notification location
        notification_obj.link = new Array(config.webURL.domain, 'activity', notification.parent_id).toURL();

        //notification details
        notification_obj.details = { id: notification.parent_id, screen_type: 'comment' };

        //create context id
        notification_obj.contextId = contextId_Create({ parent_id: notification.parent_id, activity_type: notification.activity_type, parent_type: "POST" });
        notification_obj.contextId_d = contextId_Get(notification_obj.contextId);

        return notification_obj;
    }
    else if (notification.activity_type == 'STATUS_UPDATE') {

        if (notification.notification_type == 'USERMENTION')
            notification_obj.type = "MENTIONED_STATUS";

        notification_obj.actor_user_id = notification.actor_uid;

        //create context id
        notification_obj.contextId = contextId_Create({ parent_id: notification.parent_id, activity_type: notification.activity_type, parent_type: "POST" });
        notification_obj.contextId_d = contextId_Get(notification_obj.contextId);

        //notification location
        notification_obj.link = new Array(config.webURL.domain, 'activity', notification.source_id).toURL();

        //notification details
        notification_obj.details = { id: notification.source_id, screen_type: 'post' };
        return notification_obj;
    }
    else if (notification.activity_type == 'USER_FOLLOW_REQUEST_CREATED') {
        notification_obj.actor_user_id =  notification.detail_uid;

        //create context id
        notification_obj.contextId = contextId_Create({ activity_type: notification.activity_type });
        notification_obj.contextId_d = contextId_Get(notification_obj.contextId);

        return notification_obj;
    }
    else if (notification.activity_type == 'USER_FOLLOW_REQUEST_ACCEPTED') {

        notification_obj.actor_user_id = notification.detail_uid;

        //create context id
        notification_obj.contextId = contextId_Create({ activity_type: notification.activity_type });
        notification_obj.contextId_d = contextId_Get(notification_obj.contextId);

        return notification_obj;
    }
}

function getObjectsAndLinks(notificationRenderedList, titleRequiredOnly, session_uid){

    var actor_user_ids = _.compact(_.uniq(_.map(notificationRenderedList, _.iteratee('actor_user_id'))));
    var input = {
        basic: ['name', 'username', 'link'],
        profile: ['small', 'medium']
    };
    return User.getList(input, actor_user_ids, session_uid).then(function(userObjectsList){
        _.forEach(notificationRenderedList, function(value, key){
            value.actor_user = _.head(_.filter(userObjectsList, function (o) { return o.uid == value.actor_user_id; }));
            if(['USER_FOLLOWED','USER_FOLLOW_REQUEST_CREATED','USER_FOLLOW_REQUEST_ACCEPTED'].indexOf(value.type) > -1){
                value.link = value.actor_user.link;
            }

        });
        return notificationRenderedList;
    }).then(function(notificationRenderedList){

        var goal_ids = _.compact(_.uniq(_.map(notificationRenderedList, _.iteratee('goal_id'))));
        var source_ids = _.compact(_.uniq(_.map(notificationRenderedList, _.iteratee('source_goal_id'))));
        var target_ids = _.compact(_.uniq(_.map(notificationRenderedList, _.iteratee('target_goal_id'))));
        var goalInput =  { basic: ['name', 'status', 'privacy', 'link'], user: { basic: ['name', 'username', 'email', 'link'],profile: ['small', 'medium'] } };
        return Goal.getList(goalInput, _.concat(goal_ids, source_ids, target_ids), session_uid).then(function(goalObjectsList){
            _.forEach(notificationRenderedList, function(value, key){
                value.name = _.head(_.filter(goalObjectsList, function (o) { return o.id == value.goal_id; }));
                if(['GOAL_FOLLOWED','MOTIVATE_ON_GOAL'].indexOf(value.type) > -1){
                    var goal = _.head(_.filter(goalObjectsList, function (o) { return o.id == value.goal_id; }));
                    value.link = goal.link;
                }
                else if('LINK_GOAL' == value.type){
                    var linked_goal_source = _.head(_.filter(goalObjectsList, function (o) { return o.id == value.source_goal_id; }));
                    var linked_goal_target = _.head(_.filter(goalObjectsList, function (o) { return o.id == value.target_goal_id; }));
                    value.source_goal = linked_goal_source;
                    value.target_goal = linked_goal_target;

                    value.link = linked_goal_target.link;

                }
                //create title
                if (titleRequiredOnly !== false) {
                    value.title = titleExtractor(value);
                    var toBeRemoved = ['goal', 'linked_goal_source', 'source_goal','target_goal','source_goal_id','target_goal_id','otherActorsCount','name'];
                    _.forEach(toBeRemoved, function(r,k){
                        delete value[r];
                    })
                }
            });

            return notificationRenderedList;
        })
    })
}


function contextId_Create(data) {
    return utils.aesAlogrithm.encryption(data);
}

function contextId_Get(cipherText) {
    return utils.aesAlogrithm.decryption(cipherText);
}
// -------

function titleExtractor(notification) {
    var titleData = [];

    if(notification.type == 'GOAL_FOLLOWED'){
        if(notification.otherActorsCount > 0)
            titleData = [{ "bold": notification.actor_user.name }, { "regular":"and"  }, { "bold": notification.otherActorsCount + " other" }, { "regular":"followed your goal"  }];
        else
            titleData = [{ "bold": notification.actor_user.name }, { "regular": "followed your goal" }, { "bold": notification.name}];
    }
    else if(notification.type == 'USER_FOLLOWED'){
        if(notification.otherActorsCount > 0)
            titleData = [{ "bold": notification.actor_user.name }, { "regular":"and"  }, { "bold": notification.otherActorsCount + " other" }, { "regular":"followed your profile"  }];
        else
            titleData = [{ "bold": notification.actor_user.name }, { "regular": "followed your profile" }];
    }
    else if (notification.type == 'CONTRIBUTION') {
        if (notification.otherActorsCount > 0)
            titleData = [{ "bold": notification.actor_user.name }, { "regular": "and" }, { "bold": notification.otherActorsCount + " others" }, { "regular": "contributed on goal" }, { "bold": notification.name }];
        else
            titleData = [{ "bold": notification.actor_user.name }, { "regular": "contributed on goal" }, { "bold": notification.name }];
    }
    else if(notification.type == 'MENTIONED_CONTRIBUTION'){
        if (notification.otherActorsCount == 1)
            titleData = [{ "bold": notification.actor_user.name }, { "regular": "and" }, { "bold": notification.otherActorsCount + " other " }, { "regular": "mentioned you in a contribution" }];
        else if (notification.otherActorsCount > 1)
            titleData = [{ "bold": notification.actor_user.name }, { "regular": "and" }, { "bold": notification.otherActorsCount + " others" }, { "regular": "mentioned you in a contribution" }];
        else
            titleData = [{ "bold": notification.actor_user.name }, { "regular": "mentioned you in a contribution" }];
    }
    else if (notification.type == 'PROGRESS_UPDATED') {
        titleData = [{ "bold": notification.actor_user.name }, { "regular": "has updated the progess" }];
    }
    else if (notification.type == "MENTIONED_PROGRESS"){
        if (notification.otherActorsCount > 0)
            titleData = [{ "bold": notification.actor_user.name }, { "regular": "and" }, { "bold": notification.otherActorsCount + " others" }, { "regular": "mentioned you in a progess" }];
        else
            titleData = [{ "bold": notification.actor_user.name }, { "regular": "mentioned you in a progess" }];
    }
    else if (notification.type == 'MILESTONE_CREATED') {
        titleData = [{ "bold": notification.actor_user.name }, { "regular": "has created a new Milestone on goal" }, { "bold": notification.name }];
    }
    else if(notification.type == "MENTIONED_IN_MILESTONE_CREATED") {
        if (notification.otherActorsCount > 0)
            titleData = [{ "bold": notification.actor_user.name }, { "regular": "and" }, { "bold": notification.otherActorsCount + " others" }, { "regular": "mentioned you in a milestone on goal" }, { "bold": notification.goal.name }];
        else
            titleData = [{ "bold": notification.actor_user.name }, { "regular": "mentioned you in a milestone" }];
    }
    else if (notification.type == 'MILESTONE_COMPLETED') {
        titleData = [{ "bold": notification.actor_user.name }, { "regular": "has completed a milestone on goal" }, { "bold": notification.name }];
    }
    else if (notification.type == "MENTIONED_IN_MILESTONE_COMPLETED"){
        if (notification.otherActorsCount > 0)
            titleData = [{ "bold": notification.actor_user.name }, { "regular": "and" }, { "bold": notification.otherActorsCount + " others" }, { "regular": "mentioned you while completing a milestone on goal" }, { "bold": notification.goal.name }];
        else
            titleData = [{ "bold": notification.actor_user.name }, { "regular": "mentioned you while completing a milestone on goal" }, { "bold": notification.name }];
    }
    else if (notification.type == 'MOTIVATE_ON_POST') {
        if (notification.otherActorsCount > 0)
            titleData = [{ "bold": notification.actor_user.name }, { "regular": "and" }, { "bold": notification.otherActorsCount + " others" }, { "regular": "motivated on your post" }];
        else
            titleData = [{ "bold": notification.actor_user.name }, { "regular": "motivated on your post" }];
    }
    else if (notification.type == 'MOTIVATE_ON_GOAL') {
        if (notification.otherActorsCount > 0)
            titleData = [{ "bold": notification.actor_user.name }, { "regular": "and" }, { "bold": notification.otherActorsCount + " others" }, { "regular": "motivated on your goal" }, { "bold": notification.goal.name }];
        else
            titleData = [{ "bold": notification.actor_user.name }, { "regular": " has motivated your goal" }, { "bold": notification.name }];
    }
    else if (notification.type == 'SHARE_GOAL') {
        if (notification.otherActorsCount > 0)
            titleData = [{ "bold": notification.actor_user.name }, { "regular": "and" }, { "bold": notification.otherActorsCount + " others" }, { "regular": "have shared your goal" }, { "bold": notification.goal.name }];
        else
            titleData = [{ "bold": notification.actor_user.name }, { "regular": "has shared your goal" }, { "bold": notification.name }];
    }
    else if (notification.type == "MENTIONED_IN_SHARE_GOAL") {
        if (notification.otherActorsCount > 0)
            titleData = [{ "bold": notification.actor_user.name }, { "regular": "and" }, { "bold": notification.otherActorsCount + " others" }, { "regular": "mentioned you in a post" }];
        else
            titleData = [{ "bold": notification.actor_user.name }, { "regular": "mentioned you in a post" }];
    }
    else if (notification.type == 'SHARE_POST') {
        if (notification.otherActorsCount > 0)
            titleData = [{ "bold": notification.actor_user.name }, { "regular": "and" }, { "bold": notification.otherActorsCount + " others" }, { "regular": "has shared your post" }];
        else
            titleData = [{ "bold": notification.actor_user.name }, { "regular": "has shared your post" }];
    }
    else if (notification.type == "MENTIONED_IN_SHARE_POST"){
        if (notification.otherActorsCount > 0)
            titleData = [{ "bold": notification.actor_user.name }, { "regular": "and" }, { "bold": notification.otherActorsCount + " others" }, { "regular": "mentioned you in a post" }];
        else
            titleData = [{ "bold": notification.actor_user.name }, { "regular": "mentioned you in a post" }];
    }
    else if (notification.type == 'LINK_GOAL') {
        if (notification.otherActorsCount > 0)
            titleData = [{ "bold": notification.actor_user.name }, { "regular": "and" }, { "bold": notification.otherActorsCount + " others" }, { "regular": "linked their goals to your goal" }, { "bold": notification.target_goal.name }];
        else
            titleData = [{ "bold": notification.actor_user.name }, { "regular": "linked a goal" }, { "bold": notification.source_goal.name }, { "regular": "to your goal" }, { "bold": notification.target_goal.name }];

    }
    else if (notification.type == 'COMMENT') {
        if (notification.otherActorsCount > 0)
            titleData = [{ "bold": notification.actor_user.name }, { "regular": "and" }, { "bold": notification.otherActorsCount + " others" }, { "regular": "commented on an activity" }];
        else
            titleData = [{ "bold": notification.actor_user.name }, { "regular": "commented on an activity" }];
    }
    else if (notification.type == 'MENTIONED_IN_COMMENT'){
        if (notification.otherActorsCount > 0)
            titleData = [{ "bold": notification.actor_user.name }, { "regular": "and" }, { "bold": notification.otherActorsCount + " others" }, { "regular": "commented on an activity" }];
        else
            titleData = [{ "bold": notification.actor_user.name }, { "regular": "mentioned you in a comment" }];
    }
    else if (notification.type == 'REPLY_ON_POSTCOMMENT') {
        if (notification.otherActorsCount > 0)
            titleData = [{ "bold": notification.actor_user.name }, { "regular": "and" }, { "bold": notification.otherActorsCount + " others" }, { "regular": "replied on a comment" }];
        else
            titleData = [{ "bold": notification.actor_user.name }, { "regular": "reply on a comment" }];
    }
    else if (notification.type == 'STATUS_UPDATE') {
        titleData = [{ "bold": notification.actor_user.name }, { "regular": "has updated status" }];
    }
    else if (notification.type == "MENTIONED_STATUS"){
        if (notification.otherActorsCount > 0)
            titleData = [{ "bold": notification.actor_user.name }, { "regular": "and" }, { "bold": notification.otherActorsCount + " others" }, { "regular": "mentioned you in their status" }];
        else
            titleData = [{ "bold": notification.actor_user.name }, { "regular": "mentioned you in a post" }];
    }
    else if (notification.type == 'USER_FOLLOW_REQUEST_CREATED') {
        //create text of notification type
        if (notification.otherActorsCount > 0)
            titleData = [{"bold": notification.actor_user.name}, {"regular": "and"}, {"bold": notification.otherActorsCount + " others"}, {"regular": "requested for follow"}];
        else
            titleData = [{"bold": notification.actor_user.name}, {"regular": "has request for follow"}];
    }
    else if (notification.type == 'USER_FOLLOW_REQUEST_ACCEPTED') {
        if (notification.otherActorsCount > 0)
            titleData = [{"bold": notification.actor_user.name}, {"regular": "and"}, {"bold": notification.otherActorsCount + " others"}, {"regular": "has accepted your follow request"}];
        else
            titleData = [{"bold": notification_obj.actor_user.name}, {"regular": "has accepted your follow request"}];
    }

    return titleGenerator(titleData);

}

function titleGenerator(data) {
    var entities = [];
    var finalText = "";
    _.forEach(data, function(partials, key){
        _.forEach(partials, function(singlePartial, key){
            if (_.eq(key, 'bold')) {
                entities.push({ offset: finalText.length, length: singlePartial.length});
            }
            finalText += singlePartial + ' ';
        })
    })
    return {text: finalText.trim(), entities: entities};
}

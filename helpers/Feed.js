//###############################################################
//######################### Require #############################
//###############################################################

var models = require('../models');
var User = require('../models/User');
var Goal = require('../models/Goal');
var Post = require('../models/Post');
var Milestone = require('../models/Milestone');

var _ = require('lodash');
var Promise = require("bluebird");

var sequelize = require('../helpers/db').sequelizeConn(); // Require by SP and sequelize.literal where ever used

//###############################################################
//######################## Constructor ##########################
//###############################################################

Feed = function (session_uid) {
    this.session_uid = _.isNull(session_uid) ? -1 : parseInt(session_uid);
}

module.exports = Feed;

//###############################################################
//######################## Properties ###########################
//###############################################################

Feed.prototype.pagination = {
    offset: 0,
    limit: 5
}

//###############################################################
//###################### Static Methods #########################
//###############################################################

Feed.dashboard = function (input, session_uid, pagination) {
    var query = 'CALL sp_GetFeed({0}, {1}, {2}, {3}, {4}, {5});'.format(session_uid, 0, 0, 0, pagination.offset, pagination.limit);
    console.time("dashboard-feed-query-time");
    return sequelize.query(query, { type: sequelize.QueryTypes.SELECT }).then(function (feedList) {
        console.timeEnd("dashboard-feed-query-time");

        return queryExtractor(input, feedList[0], false, session_uid).then(function(_feeds) {
            return _feeds;
        }).then(function(_feeds){
            timeValues = _.compact(_.uniq(_.map(feedList[0], _.iteratee('created'))));
            var start = _.min(timeValues); // first row time
            var end = _.max(timeValues) // last row time
            return Feed.consolidatedFollowFeed(start, end, session_uid, 'both').then(function(renderedFollowFeed){
                return _feeds.concat(renderedFollowFeed);
            })
        })
    })
}

Feed.consolidatedFollowFeed = function(start, end, session_uid, type, offset, limit) {
    var offset = offset || 0;
    var limit = limit || 4;

    switch(type) {
        case 'USER_FOLLOWED':
            var activity_type = ['USER_FOLLOWED'];
            break;
        case 'GOAL_FOLLOWED':
            var activity_type = ['GOAL_FOLLOWED'];
            break;
        default:
            var activity_type = ['USER_FOLLOWED', 'GOAL_FOLLOWED'];
            break;
    }
    console.time("follow-feed-query-time");
    return models.user_activity.findAll({ 
        attributes: [[sequelize.fn('SUBSTRING_INDEX', sequelize.fn('GROUP_CONCAT', sequelize.literal("user_activity.uid SEPARATOR ','")), sequelize.literal("',', 2")), 'uids'], [sequelize.fn('count', sequelize.col('user_activity.uid')), 'total'], 'source_id', 'activity_type'],
        where: {activity_type: activity_type, created : {$between: [start, end]}, status: 'ACTIVE' }, 
        group: ['activity_type', 'source_id'], 
        include: [ { model:models.user_feed, where: { uid: session_uid}} ],
        order: 'user_activity.created DESC',
        offset : offset,
        limit: limit
    }).then(function(_followFeed){
        console.timeEnd("follow-feed-query-time");
        if (!_.isEmpty(_followFeed)) {
            return followUserAndGoalFeed(_followFeed, start, end, session_uid).then(function(renderedFollowFeed){
                return renderedFollowFeed;
            })
        } else {
            return [];
        }
    })
}

Feed.expandNetworkUpdate = function(session_uid, startTime, endTime, activityType, offset, limit) {
    return Feed.consolidatedFollowFeed(startTime, endTime, session_uid, activityType, offset, limit).then(function (_result) {
        return _result.length > 0 ? _result[0] : [];
    });
}

Feed.expandNetworkUpdateUsers = function(session_uid, startTime, endTime, activityType, followTo, offset, limit) {
    return sequelize.query("CALL sp_ConsolidatedFollowFeedUserList({0}, {1}, {2}, '{3}', {4}, {5}, {6}) ".format(session_uid, startTime, endTime, activityType, followTo, offset, limit)).then(function (result) {
        //generate array of uids
        var uids_array = _.compact(_.uniq(_.map(result, _.iteratee('uid'))));

        //get list of users
        return User.getList({basic: ['name'], profile: ['small'], me: ['following']}, uids_array, session_uid).then(function (users) {
            return users;
        });
    });
}

Feed.goal = function (input, gid, session_uid, pagination) {
    var gid = parseInt(gid);
    if (!_.isInteger(gid)) {
        throw new Error('INVALID_TYPE, only integer or string is allowed');
    }

    var sequelize = require('../helpers/db').sequelizeConn();
    console.time("goal-feed-query-time");
    return models.user_activity.findAll({where: {$or:[
                {parent_id: gid, status: 'ACTIVE', activity_type: {$in: ['PROGRESS_UPDATED', 'MILESTONE_CREATED', 'MILESTONE_COMPLETED']}, $and:[sequelize.literal('CheckPrivacy_Goal({0}, parent_id) = 1'.format(session_uid))]},
                {source_id: gid, status: 'ACTIVE', activity_type: {$in: ['GOAL_CREATED', 'LINK_GOAL', 'GOAL_ACHIEVED', 'GOAL_IMAGE_UPDATED']}, $and:[sequelize.literal('CheckPrivacy_Goal({0}, source_id) = 1'.format(session_uid))]}
                ]}, order: 'created DESC', offset: pagination.offset, limit: pagination.limit})
    .then(function(feedList){
        console.timeEnd("goal-feed-query-time");
        return queryExtractor(input, feedList, false, session_uid).then(function(_feeds) {
            return _feeds;
        });
    });
}

Feed.goalContributions = function (input, gid, session_uid, pagination) {
    var gid = parseInt(gid);
    if (!_.isInteger(gid)) {
        throw new Error('INVALID_TYPE, only integer or string is allowed');
    }

    var sequelize = require('../helpers/db').sequelizeConn();
    console.time("contributions-feed-query-time");
    return models.user_activity.findAll({where: {
                parent_id: gid, status: 'ACTIVE', activity_type: {$in: ['CONTRIBUTION']}, $and:[sequelize.literal('CheckPrivacy_Goal({0}, parent_id) = 1'.format(session_uid))]}
                , order: 'created DESC', offset: pagination.offset, limit: pagination.limit})
    .then(function(feedList){
        console.timeEnd("contributions-feed-query-time");
        return queryExtractor(input, feedList, false, session_uid).then(function(_feeds) {
            return _feeds;
        });
    });
}

Feed.profileActivities = function(input, filter, uid, titleOnly, session_uid, pagination) {
    var activity_type = [];
    var titleOnly = titleOnly || false;

    switch(filter) {
        case 'post':
            activity_type = ['STATUS_UPDATE', 'PROFILE_PICTURE_UPDATED', 'PROFILE_COVER_UPDATED', 'ALBUM'];
            break;
        case 'goal':
            activity_type = ['GOAL_CREATED', 'CONTRIBUTION', 'PROGRESS_UPDATED', 'GOAL_ACHIEVED', 'MILESTONE_CREATED', 'MILESTONE_COMPLETED', 'GOAL_IMAGE_UPDATED'];
            break;
        case 'goal-post':
            activity_type = ['STATUS_UPDATE', 'PROFILE_PICTURE_UPDATED', 'PROFILE_COVER_UPDATED', 'ALBUM', 'GOAL_CREATED', 'PROGRESS_UPDATED', 'GOAL_ACHIEVED', 'MILESTONE_CREATED', 'MILESTONE_COMPLETED', 'GOAL_IMAGE_UPDATED'];
            break;
        case 'interactions':
            activity_type = ['GOAL_FOLLOWED', 'LINK_GOAL', 'MOTIVATE_ON_GOAL', 'CONTRIBUTION', 'MOTIVATE_ON_POST', 'COMMENT', 'USER_FOLLOWED'];
            break;
        case 'all':
            activity_type = ['GOAL_CREATED', 'STATUS_UPDATE', 'PROFILE_PICTURE_UPDATED', 'PROFILE_COVER_UPDATED', 'ALBUM', 'PROGRESS_UPDATED', 'GOAL_FOLLOWED', 'GOAL_ACHIEVED', 'LINK_GOAL', 'CONTRIBUTION', 'USER_FOLLOWED', 'MILESTONE_CREATED', 'MILESTONE_COMPLETED', 'GOAL_IMAGE_UPDATED'];
            break;
        default:
            activity_type = ['STATUS_UPDATE'];
            break;
    }
    console.time("profile-feed-query-time");
    return models.user_activity.findAll({ 
        order: 'id DESC', 
        where: { activity_type: activity_type, uid: uid, status: 'ACTIVE', $and: [sequelize.literal("COALESCE(parent_type,'') <> 'ALBUM'"), sequelize.literal('CheckPrivacy_Post({0}, post_id) = 1'.format(session_uid))] }, 
        offset: pagination.offset, limit: pagination.limit })
    .then(function (feedList) {
        console.timeEnd("profile-feed-query-time");
        return queryExtractor(input, feedList, titleOnly, session_uid).then(function(_feeds) {
            return _feeds;
        })
    });
}

Feed.linkedGoal = function (input, gid, session_uid, pagination) {
    var gid = parseInt(gid);
    if (!_.isInteger(gid)) {
        throw new Error('INVALID_TYPE, only integer or string is allowed');
    }

    console.time("contributions-feed-query-time");
    return models.user_activity.findAll({where: {
                parent_id: {$in: [sequelize.literal("SELECT to_goal_id FROM goals INNER JOIN goal_linked ON goals.goal_id = from_goal_id INNER JOIN goals as linker_goal ON linker_goal.goal_id = to_goal_id WHERE goals.goal_id = {0} AND goal_linked.status = 'ACTIVE' AND (linker_goal.status = 'ACTIVE' OR linker_goal.status = 'COMPLETED')".format(gid))]}, 
                status: 'ACTIVE', 
                activity_type: {$in: ['PROGRESS_UPDATED', 'CONTRIBUTION', 'MILESTONE_CREATED', 'MILESTONE_COMPLETED']}, 
                $and:[sequelize.literal('CheckPrivacy_Goal({0}, parent_id) = 1'.format(session_uid))]
            }, order: 'created DESC', offset: pagination.offset, limit: pagination.limit})
    .then(function(feedList){
        console.timeEnd("contributions-feed-query-time");
        return queryExtractor(input, feedList, false, session_uid).then(function(_feeds) {
            return _feeds;
        });
    });
}

//###############################################################
//##################### Private Functions #######################
//###############################################################

function queryExtractor(input, _feeds, titleRequiredOnly, session_uid) {

    var allUsers = null,
        UserIds = [],
        allPosts = null,
        allMilestones = null,
        MilestoneIds = [],
        PostIds = [],
        allGoals = null,
        GoalIds = [];

    var finalRes = [];

    if (_.isEmpty(_feeds)) {
        return new Promise(function(resolve, reject){
            resolve([]);
        })
    }

    return new Promise(function(resolve, reject){
        // here you extract all ids of goals, posts and users
        _.forEach(_feeds, function(value, key){
            // collecting goal ids
            if (['PROGRESS_UPDATED', 'CONTRIBUTION', 'MILESTONE_CREATED', 'MILESTONE_COMPLETED', 'MOTIVATE_ON_GOAL', 'LINK_GOAL'].indexOf(value.activity_type) > -1) {
                GoalIds.push(value.parent_id)
            }
            if (['GOAL_CREATED', 'GOAL_ACHIEVED', 'GOAL_FOLLOWED', 'GOAL_IMAGE_UPDATED', 'LINK_GOAL'].indexOf(value.activity_type) > -1) {
                GoalIds.push(value.source_id)
            }

            // collecting post ids
            if (['ALBUM', 'STATUS_UPDATE', 'GOAL_ACHIEVED', 'GOAL_CREATED', 'MILESTONE_CREATED', 'MILESTONE_COMPLETED', 'PROFILE_COVER_UPDATED', 'PROFILE_PICTURE_UPDATED', 'GOAL_IMAGE_UPDATED', 'LINK_GOAL' ].indexOf(value.activity_type) > -1) {
                PostIds.push(value.post_id)
            }

            if (['CONTRIBUTION', 'PROGRESS_UPDATED', 'MOTIVATE_ON_GOAL' ].indexOf(value.activity_type) > -1) {
                PostIds.push(value.source_id)
            }

            if (['COMMENT'].indexOf(value.activity_type) > -1) {
                PostIds.push(value.parent_id)
            }

            if (['USER_FOLLOWED'].indexOf(value.activity_type) > -1) {
                UserIds.push(value.source_id)
            }

            // collecting milestones ids
            if (['MILESTONE_CREATED', 'MILESTONE_COMPLETED'].indexOf(value.activity_type) > -1) {
                MilestoneIds.push(value.source_id);
            }
        })
        UserIds = _.concat(UserIds, _.compact(_.uniq(_.map(_feeds, _.iteratee('uid')))));
        PostIds = _.compact(_.uniq(PostIds));
        GoalIds = _.compact(_.uniq(GoalIds));
        MilestoneIds = _.compact(_.uniq(MilestoneIds));

        resolve(_feeds);
    })
    .then(function (_feeds) {
        if (!_.isEmpty(UserIds) && _.isObject(input.user)) {
            return User.getList(input.user, UserIds, session_uid).then(function (users) {
                allUsers = users;
                return _feeds;
            })
        } else {
            return _feeds;
        }
    }).then(function (_feeds) {
        if (!_.isEmpty(PostIds) && _.isObject(input.post)) {
            return Post.getList(input.post, PostIds, session_uid).then(function (posts) {
            	allPosts = posts
                return _feeds;
            })
        } else {
            return _feeds;
        }
    }).then(function (_feeds) {
    	if (!_.isEmpty(GoalIds) && _.isObject(input.goal)) {
            return Goal.getList(input.goal, GoalIds, session_uid).then(function (goals) {
            	allGoals = goals
                return _feeds;
            })
        } else {
            return _feeds;
        }
    }).then(function (_feeds) {
        if (!_.isEmpty(MilestoneIds) && _.isObject(input.milestone)) {
            return Milestone.getList(input.milestone, MilestoneIds, session_uid).then(function (milestones) {
                allMilestones = milestones
                return _feeds;
            })
        } else {
            return _feeds;
        }
    }).then(function (_feeds) {
    	_.forEach(_feeds, function(value, key){
    		var single = {}
    		single.id = value.activity_id;

    		single.user = _.head(_.filter(allUsers, function (o) { return o.uid == value.uid; }));

    		single.post = _.head(_.filter(allPosts, function (o) { 
                if (['ALBUM', 'STATUS_UPDATE', 'GOAL_ACHIEVED', 'GOAL_CREATED', 'MILESTONE_CREATED', 'MILESTONE_COMPLETED', 'PROFILE_COVER_UPDATED', 'PROFILE_PICTURE_UPDATED', 'GOAL_IMAGE_UPDATED', 'LINK_GOAL' ].indexOf(value.activity_type) > -1) {
                    return o.id == value.post_id;
                } else if (['CONTRIBUTION', 'PROGRESS_UPDATED', 'MOTIVATE_ON_GOAL' ].indexOf(value.activity_type) > -1) {
                    return o.id == value.source_id;
                } else if (['COMMENT'].indexOf(value.activity_type) > -1) {
                    return o.id == value.parent_id;
                } else {
                    return false;
                }
            }));

    		single.goal = _.head(_.filter(allGoals, function (o) { 
                if (['PROGRESS_UPDATED', 'CONTRIBUTION', 'MILESTONE_CREATED', 'MILESTONE_COMPLETED', 'MOTIVATE_ON_GOAL'].indexOf(value.activity_type) > -1) {
                    return o.id == value.parent_id;
                } else if (['GOAL_CREATED', 'GOAL_FOLLOWED', 'GOAL_ACHIEVED', 'GOAL_IMAGE_UPDATED'].indexOf(value.activity_type) > -1) {
                    return o.id == value.source_id;
                } else {
                    return false;
                }
            }));

            single.milestone = _.head(_.filter(allMilestones, function (o) { 
                if (['MILESTONE_CREATED', 'MILESTONE_COMPLETED'].indexOf(value.activity_type) > -1) {
                    return o.id == value.source_id;
                } else {
                    return false;
                }
            }));

            if (['LINK_GOAL'].indexOf(value.activity_type) > -1) {
                single.goal_from = _.head(_.filter(allGoals, function (o) {
                    return o.id == value.source_id;
                }));

                single.goal_to = _.head(_.filter(allGoals, function (o) {
                    return o.id == value.parent_id;
                }));
            }

            if (['USER_FOLLOWED'].indexOf(value.activity_type) > -1) {
                single.user_from = _.head(_.filter(allUsers, function (o) {
                    return o.uid == value.uid;
                }));

                single.user_to = _.head(_.filter(allUsers, function (o) {
                    return o.uid == value.source_id;
                }));
                delete single.user;
            }

    		single.feed_type = value.activity_type;
            single.title = titleExtractor(single);

            if (titleRequiredOnly === true) {
                toBeRemoved = ['user', 'user_to', 'user_from', 'goal', 'goal_from', 'goal_to', 'post'];
                _.forEach(toBeRemoved, function(r,k){
                    delete single[r];
                });
            }

    		finalRes.push(single);
    	})
    	return finalRes;

    }).then(function (_feeds) {
    	return _feeds;
    });
}

function titleExtractor(_singlefeed) {
    var titleData = [];
    switch(_singlefeed.feed_type) {
        case 'STATUS_UPDATE':
            titleData.push({ "bold": _singlefeed.user.name });
            if (_.isObject(_singlefeed.post.fetched_url)) {
                titleData.push({ "regular": "shared a link" });
            } else {
                titleData.push({ "regular": "shared a post" });
            }
            var extractMentionedUserRegex = /@[[0-9]+[:]([\w\s]+)]/g;
            var postText = _singlefeed.post.text.replace(extractMentionedUserRegex, "$1").trim();
            titleData.push({"bold": _.truncate(postText, {'length': 24, 'separator': /,? +/ })});
            break;
        case 'ALBUM':
            titleData = [{ "bold": _singlefeed.user.name }, { "regular": "shared images" }];
            break;
        case 'GOAL_ACHIEVED':
            titleData = [{ "bold": _singlefeed.user.name }, { "regular": "achieved a goal" }, { "bold": _singlefeed.goal.name.replace(/"([^"]+(?="))"/g, '$1') }];
            break;
        case 'GOAL_CREATED':
            titleData = [{ "bold": _singlefeed.user.name }, { "regular": "added a new goal" }, { "bold": _singlefeed.goal.name.replace(/"([^"]+(?="))"/g, '$1') }];
            break;
        case 'MILESTONE_CREATED':
            titleData = [{ "bold": _singlefeed.user.name }, { "regular": "added a new milestone on" }, { "bold": _singlefeed.goal.name.replace(/"([^"]+(?="))"/g, '$1') }];
            break;
        case 'MILESTONE_COMPLETED':
            titleData = [{ "bold": _singlefeed.user.name }, { "regular": "completed a milestone of" }, { "bold": _singlefeed.goal.name.replace(/"([^"]+(?="))"/g, '$1') }];
            break;
        case 'PROFILE_COVER_UPDATED':
            titleData = [{ "bold": _singlefeed.user.name }, { "regular": "updated profile cover" }];
            break;
        case 'PROFILE_PICTURE_UPDATED':
            titleData = [{ "bold": _singlefeed.user.name }, { "regular": "updated profile image" }];
            break;
        case 'GOAL_IMAGE_UPDATED':
            titleData = [{ "bold": _singlefeed.user.name }, { "regular": "updated goal image of" }, { "bold": _singlefeed.goal.name.replace(/"([^"]+(?="))"/g, '$1') }];
            break;
        case 'LINK_GOAL':
            titleData = [{ "bold": _singlefeed.user.name }, { "regular": "linked" }, { "bold": _singlefeed.goal_to.name.replace(/"([^"]+(?="))"/g, '$1') }, { "regular": "goal with" }, { "bold": _singlefeed.goal_from.name.replace(/"([^"]+(?="))"/g, '$1') }, { "regular": "goal" }];
            break;
        case 'GOAL_FOLLOWED':
            titleData = [{ "bold": _singlefeed.user.name }, { "regular": "has followed goal" }, { "bold": _singlefeed.goal.name.replace(/"([^"]+(?="))"/g, '$1') }];
            break;
        case 'USER_FOLLOWED':
            titleData = [{ "bold": _singlefeed.user_from.name }, { "regular": "has followed" }, { "bold": _singlefeed.user_to.name.replace(/"([^"]+(?="))"/g, '$1') }, { "regular": "profile" }];
            break;
        case 'PROGRESS_UPDATED':
            titleData = [{ "bold": _singlefeed.user.name }, { "regular": "added a progress on" }, { "bold": _singlefeed.goal.name.replace(/"([^"]+(?="))"/g, '$1') }];
            break;
        case 'CONTRIBUTION':
            titleData = [{ "bold": _singlefeed.user.name }, { "regular": "has made a contribution on" }, { "bold": _singlefeed.goal.name.replace(/"([^"]+(?="))"/g, '$1') }];
            break; 
        default:
            break;
    }

    return titleGenerator(titleData);
}

function titleGenerator(data) {
    var entities = [];
    var finalText = "";

    _.forEach(data, function(partials, key){
        _.forEach(partials, function(singlePartial, key){
            if (_.eq(key, 'bold')) {
                entities.push({ offset: finalText.length, length: singlePartial.length });
            }
            finalText += singlePartial + ' ';
        })
    })
    return {text: finalText.trim(), entities: entities};
}

function followUserAndGoalFeed(_followFeed, start, end, session_uid){
    var allUsers = null,
        UserIds = [],
        allGoals = null,
        GoalIds = [];

    var finalRes = [];
    if (_.isEmpty(_followFeed)) {
        return new Promise(function(resolve, reject){
            resolve([]);
        })
    }
    return new Promise(function(resolve, reject){
        _.forEach(_followFeed, function(value, key){
            if (['GOAL_FOLLOWED'].indexOf(value.activity_type) > -1) {
                GoalIds.push(value.source_id)
            }
            if (['USER_FOLLOWED'].indexOf(value.activity_type) > -1) {
                UserIds.push(value.source_id)
            }
            var from_uids = _.map(value.get('uids').split(","), function(value){
                return parseInt(value, 10);
            })
            UserIds = _.concat(UserIds, from_uids);
        })

        resolve(_followFeed);
    }).then(function(_followFeed){
        if (!_.isEmpty(UserIds)) {
            return User.getList({basic:['name'], profile: ['small'], me: ['following']}, UserIds, session_uid).then(function (users) {
                allUsers = users;
                return _followFeed;
            });
        } else {
            return _followFeed;
        }
    }).then(function(_followFeed){
        if (!_.isEmpty(GoalIds)) {
            return Goal.getList({basic:['name'], me:['following', 'motivate'], cover: ['medium', 'large', 'xlarge'], user: {basic:['name'], profile: ['small'], me: ['following']}}, GoalIds, session_uid).then(function (goals) {
                allGoals = goals
                return _followFeed;
            })
        } else {
            return _followFeed;
        }
    }).then(function(_followFeed){
        var userfollow = {};
        userfollow.feed_type = "USER_FOLLOWED_NETWORK";
        userfollow.list = [];

        var goalfollow = {};
        goalfollow.feed_type = "GOAL_FOLLOWED_NETWORK";
        goalfollow.list = [];

        goalfollow.startTime = userfollow.startTime = start;
        goalfollow.endTime = userfollow.endTime = end;
        
        _.forEach(_followFeed, function(single, key){
            var each = {}
            var users_from = _.map(single.get('uids').split(","), function(value){
                return parseInt(value, 10);
            }); 
            each.users_from = _.filter(allUsers, function (o) { 
                return (_.indexOf(users_from, o.uid) != -1) ? true : false;
            });
            if (['USER_FOLLOWED'].indexOf(single.activity_type) > -1) {
                each.user_to = _.head(_.filter(allUsers, function (o) { return o.uid == single.source_id;}));
                each.totalUsersCount = single.get('total');
                userfollow.list.push(each);
            }
            if (['GOAL_FOLLOWED'].indexOf(single.activity_type) > -1) {
                each.goal = _.head(_.filter(allGoals, function (o) { return o.id == single.source_id;}));
                each.totalUsersCount = single.get('total');
                goalfollow.list.push(each);
            }

        });
        if (userfollow.list.length > 0) { finalRes.push(userfollow) }
        if (goalfollow.list.length > 0) { finalRes.push(goalfollow) }
        return finalRes;
    })
}


//import modules
var clasAllTables = require('../models/alltables');
var helpers = require('../helpers/helpers');
var validator = require('validator');
var Promise = require("bluebird");
var config = require('../config');
var db = require('../helpers/db');
var utils = require('../helpers/Utils');
var validate = require("validate.js");
var chalk = require('chalk');
var User = require('../models/User');

//instances
var objAllTables = clasAllTables.allTables;



exports.get = function (req, res) {

    var constraints = {
        "params.startTime": { presence: false, numericality: { noStrings: false } },
        "params.endTime": { presence: false, numericality: { noStrings: false } },
        "params.activityType": { presence: false, inclusion: { within: ['USER_FOLLOWED', 'GOAL_FOLLOWED'], message: 'only user_followed and goal_followed is allowed' } }
    };

    validate.async(req, constraints).then(success, error);

    function success() {
        helpers.GetActiveSession_ORM(req).then(function (SessionUser) {
            if (SessionUser != null) {
                var data = {};
                var pagination = utils.pagination(req);

                var getFollowFeedRangeValues = getFollowFeedRange(pagination.offset, pagination.limit);
                //######################### Create Feed (start) #########################
                return new Promise(function (resolve) {

                    //expanding network update feed, specfic feed users list
                    if ((typeof req.params.startTime != 'undefined' && req.params.startTime != "") && (typeof req.params.endTime != 'undefined' && req.params.endTime != "")
                        && (typeof req.params.followTo != 'undefined' && req.params.followTo != "")) {
                        return consolidate_followFeedList(SessionUser, req.params.startTime, req.params.endTime, req.params.activityType, req.params.followTo, pagination.offset, pagination.limit)
                            .then(function (result) {
                                if (result != null) {
                                    result.startTime = req.params.startTime;
                                    result.endTime = req.params.endTime;
                                    res.send(200, { meta: { status: 200, message: 'success' }, data: result });
                                    res.end();
                                }
                                else
                                    res.send(200, { meta: { status: 200, message: 'success' }, data: [] });
                            });
                        //throw new Error('break chain');
                    }
                    //expanding network update feed
                    else if ((typeof req.params.startTime != 'undefined' && req.params.startTime != "") && (typeof req.params.endTime != 'undefined' && req.params.endTime != "")) {
                        return consolidateFollowFeed(SessionUser, req.params.startTime, req.params.endTime, req.params.activityType, pagination.offset, pagination.limit).then(function (result) {
                            if (result != null) {

                                console.log('######################### in response', result);
                                result.startTime = req.params.startTime;
                                result.endTime = req.params.endTime;
                                res.send(200, { meta: { status: 200, message: 'success' }, data: result });
                                res.end();
                            }
                            else
                                res.send(200, { meta: { status: 200, message: 'success' }, data: {} });
                        });
                        //throw new Error('break chain');
                    }

                    //get feed
                    var sequelize = db.sequelizeConn();
                    console.log('#######################################################################################');

                    return sequelize.query('CALL sp_GetFeed({0}, {1}, {2}, {3}, {4},{5});'
                        .format(SessionUser.uid, getFollowFeedRangeValues.fetchConsolidateFollowFeed, getFollowFeedRangeValues.start, getFollowFeedRangeValues.end, pagination.offset, pagination.limit)
                        , { type: sequelize.QueryTypes.SELECT })
                        .then(function (feedList) {
                            console.log('this is ', feedList.length);
                            resolve(feedList);
                        });
                }).then(function (feedList) {

                    if (feedList.length > 1 && Object.keys(feedList[0]).length > 0) {
                        var feedRegular = Object.keys(feedList[0]).map(function (key) { return feedList[0][key] });

                        //render objects from feed list
                        var feedController = require('../controllers/feed');
                        return feedController.renderObjects(feedRegular, SessionUser)
                            .then(function (feed) {
                                data = feed;    //array of regular feed
                                return feedList;
                            });
                    }

                    return feedList; //will work like ELSE

                }).then(function (feedList) {
                    if (feedList.length == 3) {
                        var feedNetwork = Object.keys(feedList[1]).map(function (key) { return feedList[1][key] });

                        return consolidateFollowFeed(SessionUser, feedNetwork[0].startTime, feedNetwork[0].endTime, 'USER_FOLLOWED', 0, 2)
                            .then(function (feed) {
                                if (feed != null)
                                    data.push(feed);   //merge with regular feed array
                                return feedList;
                            });

                        //consolidateFollowFeed(SessionUser.uid, feedNetwork[0].startTime, feedNetwork[0].endTime, 'GOAL_FOLLOWED', 0, 2);
                    }

                    return feedList; //will work like ELSE

                }).then(function (feedList) {

                    if (feedList.length == 3) {
                        var feedNetwork = Object.keys(feedList[1]).map(function (key) { return feedList[1][key] });

                        return consolidateFollowFeed(SessionUser, feedNetwork[0].startTime, feedNetwork[0].endTime, 'GOAL_FOLLOWED', 0, 2)
                            .then(function (feed) {
                                if (feed != null)
                                    data.push(feed);   //merge with regular feed array
                                return feedList;
                            });

                        //consolidateFollowFeed(SessionUser.uid, feedNetwork[0].startTime, feedNetwork[0].endTime, 'GOAL_FOLLOWED', 0, 2);
                    }

                    return feedList; //will work like ELSE

                }).then(function () {

                    if (getFollowFeedRangeValues.fetchConsolidateFollowFeed) {
                        //Get last value from array which is goal_consolidate_follow_feed
                        var lastValue = data.pop();
                        //Get second last value from array which is user__consolidate_follow_feed
                        var secondLastValue = data.pop();
                        //add values where they belongs, through index
                        data.splice(getFollowFeedRangeValues.index, 0, lastValue);
                        data.splice(getFollowFeedRangeValues.index, 0, secondLastValue);
                    }

                    res.send(200, { meta: { status: 200, message: "success" }, data: data });
                });

                //######################### Create Feed (End) ###########################
            }
            else {
                res.send(401, { meta: { status: 401, message: 'user is not logged in or invalid token' } });
            }
        })/*.error(function (err) {
            res.send(500, { meta: { status: 500, message: 'unexpected error' }, details: err });
        }).catch(function (err) {
            if (err.message != 'break chain')
                res.send(500, { meta: { status: 500, message: 'unexpected error' }, details: err });
        });*/
    }

    function error(err) {
        res.send(500, { meta: { status: 500, message: 'unexpected error' }, details: err });
    }

    function consolidateFollowFeed(sessionUser, startTime, endTime, activityType, offset, limit) {

        var sequalize = db.sequelizeConn();
        console.log('##########################################################');
        return sequalize.query("CALL sp_ConsolidatedFollowFeed({0}, {1}, {2}, '{3}', {4}, {5}) ".format(sessionUser.uid, startTime, endTime, activityType, offset, limit)).then(function (result) {
            return consolidated_followFeed(result, activityType, sessionUser).then(function (_result) {

                if (_result == null)
                    return null;

                _result.startTime = startTime;
                _result.endTime = endTime;
                //console.log('consolidated_followFeed result', _result);
                return _result;
            });
        });
    }

    function consolidate_followFeedList(sessionUser, startTime, endTime, activityType, followTo, offset, limit) {
        var sequalize = db.sequelizeConn();
        return sequalize.query("CALL sp_ConsolidatedFollowFeedUserList({0}, {1}, {2}, '{3}', {4}, {5}, {6}) ".format(sessionUser.uid, startTime, endTime, activityType, followTo, offset, limit))
            .then(function (result) {

                //generate array of uids
                var uids_array = [];
                for (var i = 0; i < result.length; i++) {
                    uids_array.push(result[i].uid);
                }

                //get list of users
                return helpers.getUserList(uids_array, sessionUser.uid).then(function (final) {
                    return final;
                });
            });
    }

    function getFollowFeedRange(offset, limit) {
        // range of the feeds to get
        var range = 7;

        var feedsTo = limit + offset;
        var feedFrom = offset;
        //start and end if feed is divisible by range number
        var start = feedFrom;
        var end = feedsTo;
        var index = null;
        var fetchConsolidateFollowFeed = false;

        for (var i = 0; i < limit; i++) {
            //get the current number
            var current = i + feedFrom;

            if (current + i === 0)
                continue;

            else if (current % range === 0) {
                end = current;
                //appearedIndex = i;
                start = current - range;
                fetchConsolidateFollowFeed = true;
                index = i;
            }
        }
        var result = { start: start, end: end, fetchConsolidateFollowFeed: fetchConsolidateFollowFeed, index: index };
        return result;

    }
};


//#############################################################
//########################## APIs #############################
//#############################################################

exports.get_old = function (req, res) {

    helpers.GetActiveSession_ORM(req)
        .then(function (SessionUser) {
            if (SessionUser != null) {

                var data = {};
                var pagination = utils.pagination(req);
                //######################### Create Feed (start) #########################

                return new Promise(function (resolve) {



                    /* var query_GetFeedList = "SELECT\
                                                 feed.id ` feed_id`,\
                                                 activity.id ` activity_id`,\
                                                 activity.uid,\
                                                 activity.activity_type,\
                                                 activity.source_id,\
                                                 activity.parent_id,\
                                                 activity.parent_type,\
                                                 activity.post_id\
                                             FROM\
                                                 `user_feed` feed\
                                             JOIN user_activity activity ON feed.activity_id = activity.id\
                                             WHERE\
                                                 feed.uid = {0}\
                                             AND feed.STATUS = 'ACTIVE'\
                                             AND activity.STATUS = 'ACTIVE'\
                                             AND CASE WHEN activity.activity_type in ('PROGRESS_UPDATED', 'CONTRIBUTION') THEN CheckPrivacy_Post({0}, activity.source_id) = 1 ELSE CheckPrivacy_Post({0}, activity.post_id) = 1 END\
                                             ORDER BY\
                                                 activity.created DESC\
                                             limit {1},{2}".format(SessionUser.uid, pagination.offset, pagination.limit);*/
                    //     activity.id DESC\
                    var sequelize = db.sequelizeConn();
                    return sequelize.query('CALL sp_GetFeed(3,15,5);'.format(SessionUser.uid, pagination.offset, pagination.limit), { type: sequelize.QueryTypes.SELECT })
                        .then(function (Userfeed) {
                            resolve(Userfeed);
                        });
                }).then(function (feedList) {

                    if (feedList.length == 2) {
                        var userFeed = Object.keys(feedList[0]).map(function (key) {
                            return feedList[0][key]
                        });
                    }

                    else if (feedList.length == 3) {

                        var userFeed = Object.keys(feedList[0]).map(function (key) {
                            return feedList[0][key]
                        });

                    }

                    //render objects from feed list
                    var feedController = require('../controllers/feed');
                    return feedController.renderObjects(userFeed, SessionUser)
                        .then(function (feed) {
                            console.log('received method');
                            data.feed = feed;
                            return feedList;
                        });


                }).then(function (feedList) {

                    if (feedList.length == 3) {

                        var sequelize = db.sequelizeConn();
                        return sequelize.query("CALL sp_ConsolidatedFollowFeed({0},{1},{2},'{3}',{4},{5});".format(SessionUser.uid, feedList[1][0].startTime, feedList[1][0].endTime, 'USER_FOLLOWED', pagination.offset, pagination.limit), { type: sequelize.QueryTypes.SELECT })
                            .then(function (UserConsolidatedFeedList) {
                                var feed_time = {};
                                feed_time.start = feedList[1][0].startTime;
                                feed_time.end = feedList[1][0].endTime;
                                var ConsolidatedFeedList = Object.keys(UserConsolidatedFeedList[0]).map(function (key) {
                                    return UserConsolidatedFeedList[0][key]
                                });
                                ConsolidatedFeedList.push(feed_time);
                                console.log(ConsolidatedFeedList);
                                return ConsolidatedFeedList;
                            });


                    }


                }).then(function (feed) {
                    console.log('sending response');
                    res.send(200, { meta: { status: 200, message: "success" }, data: feed });
                    console.log('response sent');
                });

                //######################### Create Feed (End) ###########################
            }
            else {
                res.send({ meta: { status: 401, message: 'user is not logged in or invalid token' } });
            }
        })
        .error(function (err) {
            res.send({ meta: { status: 500, message: 'unexpected error' }, details: err });
        })
        .catch(function (err) {
            res.send({ meta: { status: 500, message: 'unexpected error' }, details: err });
        });
};

exports.getGoalFeed = function (req, res) {

    helpers.getActiveSession(req)
        .then(function (SessionUser) {

            if (SessionUser.type == 'Recognized' || SessionUser.type == 'UnRecognized') {
                var pagination = utils.pagination(req);

                //######################### Create Feed (start) #########################

                return new Promise(function (resolve) {

                    //get feed list
                    var query_GetFeedList = "SELECT\
                                                activity.id `activity_id`,\
                                                activity.uid,\
                                                    activity.activity_type,\
                                                    activity.source_id,\
                                                    activity.parent_id,\
                                                    activity.parent_type,\
                                                    activity.post_id\
                                                FROM \
                                                    user_activity activity\
                                                WHERE\
                                                    (activity.parent_id = {0} and activity.status = 'ACTIVE' and CheckPrivacy_Goal({3},{0}) = 1 and activity.activity_type IN ('PROGRESS_UPDATED', 'MILESTONE_CREATED', 'MILESTONE_COMPLETED'))\
                                                    OR\
                                                    (activity.source_id = {0} and activity.status = 'ACTIVE' and CheckPrivacy_Goal({3},{0}) = 1 and activity.activity_type IN ('GOAL_CREATED', 'LINK_GOAL', 'GOAL_ACHIEVED', 'GOAL_IMAGE_UPDATED'))\
                                                ORDER BY\
                                                activity.created DESC\
                                                limit {1},{2}".format(req.params.id, pagination.offset, pagination.limit, SessionUser.uid);

                    var sequelize = db.sequelizeConn();
                    return sequelize.query(query_GetFeedList, {
                        type: sequelize.QueryTypes.SELECT
                    })
                        .then(function (feedList) {
                            resolve(feedList);
                        });
                }).then(function (feedList) {

                    //render objects from feed list
                    var feedController = require('../controllers/feed');
                    return feedController.renderObjects(feedList, SessionUser)
                        .then(function (feed) {
                            console.log('################ goal feed - received');
                            return feed;
                        });

                }).then(function (feed) {
                    console.log('################ goal feed - sending response');
                    res.send(200, { meta: { status: 200, message: "success" }, data: feed });
                    console.log('################ goal feed - response sent');
                });

                //######################### Create Feed (End) ###########################
            }
            else {
                res.send({ meta: { status: 401, message: 'user is not logged in or invalid token' } });
            }
        })
        .error(function (err) {
            res.send({ meta: { status: 500, message: 'unexpected error' }, details: err });
        })
        .catch(function (err) {
            res.send(500, { meta: { status: 500, message: 'unexpected error' }, details: err });
        });
};

exports.getGoalContributionFeed = function (req, res) {
    var constraints = {
        "params.id": {
            presence: true
        }
    };


    validate.async(req, constraints).then(success, error);

    function success() {
        helpers.getActiveSession(req)
            .then(function (SessionUser) {
                if (SessionUser.type == 'Recognized' || SessionUser.type == 'UnRecognized') {


                    var pagination = utils.pagination(req);
                    //######################### Create Feed (start) #########################

                    return new Promise(function (resolve) {

                        //get feed list
                        var query_GetFeedList = "SELECT\
												activity.id ` activity_id`,\
												activity.uid,\
												activity.activity_type,\
												activity.source_id,\
												activity.parent_id,\
												activity.parent_type,\
												activity.post_id\
											FROM\
												user_activity activity\
											WHERE\
												activity.parent_id = {0} and activity.status = 'ACTIVE' and CheckPrivacy_Goal({3},{0}) = 1 and activity.activity_type IN('CONTRIBUTION')\
											ORDER BY\
												activity.id DESC\
											limit {1},{2}".format(req.params.id, pagination.offset, pagination.limit, SessionUser.uid);

                        var sequelize = db.sequelizeConn();
                        return sequelize.query(query_GetFeedList, {
                            type: sequelize.QueryTypes.SELECT
                        })
                            .then(function (feedList) {
                                resolve(feedList);
                            });
                    }).then(function (feedList) {

                        //render objects from feed list
                        var feedController = require('../controllers/feed');
                        return feedController.renderObjects(feedList, SessionUser)
                            .then(function (feed) {
                                console.log('################ goal feed - received');
                                return feed;
                            });

                    }).then(function (feed) {
                        console.log('################ goal feed - sending response');
                        res.send(200, { meta: { status: 200, message: "success" }, data: feed });
                        console.log('################ goal feed - response sent');
                    });

                    //######################### Create Feed (End) ###########################

                }
                else {
                    res.send({ meta: { status: 401, message: 'user is not logged in or invalid token' } });
                }
            })
            .error(function (err) {
                res.send({ meta: { status: 500, message: 'unexpected error' }, details: err });
            })
            .catch(function (err) {
                res.send(500, { meta: { status: 500, message: 'unexpected error' }, details: err });
            });
    }
    function error(errors) {
        if (errors instanceof Error) {
            // This means an exception was thrown from a validator
            res.send({ meta: { status: 401, message: 'An error ocuured in validator' }, errors: errors });
        } else {
            res.send({ meta: { status: 401, message: 'validation errors' }, errors: errors });
        }
    }
};

exports.getOwnFeed = function (req, res) {

    helpers.GetActiveSession_ORM(req)
        .then(function (SessionUser) {
            if (SessionUser != null) {

                var pagination = utils.pagination(req);
                //######################### Create Feed (start) #########################

                return new Promise(function (resolve) {

                    //get feed list
                    var query_GetFeedList = "SELECT\
                                                    activity.id `activity_id`,\
                                                    activity.uid,\
                                                    activity.activity_type,\
                                                    activity.source_id,\
                                                    activity.parent_id,\
                                                    activity.parent_type,\
                                                    activity.post_id\
                                                FROM\
                                                    user_activity activity\
                                                WHERE\
                                                    activity.uid = {0} and activity.status = 'ACTIVE'\
                                                ORDER BY\
                                                    activity.id DESC\
                                                     limit {1},{2}".format(SessionUser.uid, pagination.offset, pagination.limit);

                    var sequelize = db.sequelizeConn();
                    return sequelize.query(query_GetFeedList, {
                        type: sequelize.QueryTypes.SELECT
                    })
                        .then(function (feedList) {
                            resolve(feedList);
                        });
                }).then(function (feedList) {

                    //render objects from feed list
                    var feedController = require('../controllers/feed');
                    return feedController.renderObjects(feedList, SessionUser)
                        .then(function (feed) {
                            console.log('################ goal feed - received');
                            return feed;
                        });

                }).then(function (feed) {
                    console.log('################ goal feed - sending response');
                    res.send(200, { meta: { status: 200, message: "success" }, data: feed });
                    console.log('################ goal feed - response sent');
                });

                //######################### Create Feed (End) ###########################

            }
            else {
                res.send({ meta: { status: 401, message: 'user is not logged in or invalid token' } });
            }
        })
        .error(function (err) {
            res.send({ meta: { status: 500, message: 'unexpected error' }, details: err });
        })
        .catch(function (err) {
            res.send(500, { meta: { status: 500, message: 'unexpected error' }, details: err });
        });
};

exports.getUserActivities = function (req, res) {

    var constraints = {
        "params.username": {
            presence: true
        }
    };

    validate.async(req, constraints).then(success, error);

    function success() {
        helpers.getActiveSession(req)
            .then(function (sessionUser) {
                if (sessionUser.type == 'Recognized' || sessionUser.type == 'UnRecognized') {

                    //######################### Validations (Start) ###########################
                    var type = 'full';

                    if (req.query.type == null || typeof req.query.type == 'undefined' || req.query.type == '')
                        type = 'full';
                    else if (req.query.type == 'mini' || req.query.type == 'full')
                        type = req.query.type;
                    else {
                        res.send(401, { meta: { status: 401, message: 'invalid "type", it should be "full" or "mini"' } });
                        throw new Error('break chain');
                    }

                    var userName = req.params.username;
                    var pagination = utils.pagination(req);

                    //######################### Validations (End) ###########################

                    //if (type == 'mini') {
                    //    var data = [

                    //        {
                    //            "feed_type": "CONTRIBUTION",
                    //            "text": "Faizan has contributed on goal abc",
                    //            "entities": [{
                    //                    "offset": 0,
                    //                    "limit": 6
                    //                }, {
                    //                    "offset": 32,
                    //                    "limit": 3
                    //                }]
                    //        }, 
                    //        {
                    //            "feed_type": "MILESTONE_CREATED",
                    //            "text": "Zeeshan has added a milestone on goal xyz",
                    //            "entities": [{
                    //                    "offset": 0,
                    //                    "limit": 7
                    //                }, {
                    //                    "offset": 38,
                    //                    "limit": 3
                    //                }]
                    //        },
                    //        {
                    //            "feed_type": "GOAL_CREATED",
                    //            "text": "Shaharyar has created a goal xyz",
                    //            "entities": [{
                    //                    "offset": 0,
                    //                    "limit": 9
                    //                }, {
                    //                    "offset": 30,
                    //                    "limit": 3
                    //                }]
                    //        }
                    //    ];

                    //    res.send(200, { meta: { status: 200, message: 'success - static response' }, data: data });
                    //    return;
                    //}

                    var uId = userName;
                    //checking if the username is of session user or if uid is of session user

                    new Promise(function (resolve, reject) {
                        if (isNaN(userName)) {
                            //fetching uid for this username
                            utils.getUid(userName).then(function (uid) {
                                if (uid == -1) {
                                    res.send(404, { meta: { status: 404, message: 'user not found' } });
                                    throw new Error('break promise chain');
                                }
                                resolve(uid);
                            });
                        }
                        else {
                            resolve(uId);
                        }
                    })
                        .then(function (uId) {

                            var activity_type = [];
                            if (type == 'mini') {
                                activity_type = ['PROGRESS_UPDATED', 'CONTRIBUTION', 'GOAL_ACHIEVED', 'GOAL_FOLLOWED', 'USER_FOLLOWED'];
                            }
                            else if (req.query.filter == 'post') {
                                activity_type = ['STATUS_UPDATE', 'PROFILE_PICTURE_UPDATED', 'PROFILE_COVER_UPDATED', 'ALBUM'];
                            }
                            else if (req.query.filter == 'goal') {
                                activity_type = ['GOAL_CREATED', 'CONTRIBUTION', 'PROGRESS_UPDATED', 'GOAL_ACHIEVED', 'MILESTONE_CREATED', 'MILESTONE_COMPLETED', 'GOAL_IMAGE_UPDATED'];
                            }
                            else if (req.query.filter == 'goal-post') {
                                activity_type = ['STATUS_UPDATE', 'PROFILE_PICTURE_UPDATED', 'PROFILE_COVER_UPDATED', 'ALBUM', 'GOAL_CREATED', 'PROGRESS_UPDATED', 'GOAL_ACHIEVED', 'MILESTONE_CREATED', 'MILESTONE_COMPLETED', 'GOAL_IMAGE_UPDATED'];
                            }
                            else if (req.query.filter == 'interactions') {
                                activity_type = ['GOAL_FOLLOWED', 'LINK_GOAL', 'MOTIVATE_ON_GOAL', 'CONTRIBUTION', 'MOTIVATE_ON_POST', 'COMMENT', 'USER_FOLLOWED'];
                            }
                            else {
                                activity_type = ['STATUS_UPDATE'];
                            }

                            //######################### Create Feed (start) #########################

                            //get feed list
                            var clasAllTables = require('../models/alltables');
                            var sequelize = db.sequelizeConn();
                            var UserActivity = clasAllTables.allTables.user_activity.user_activity();
                            return UserActivity.findAll({ order: 'id DESC', where: { activity_type: activity_type, uid: uId, status: 'ACTIVE', $and: [sequelize.literal("COALESCE(parent_type,'') <> 'ALBUM'"), sequelize.literal('CheckPrivacy_Post({0}, post_id) = 1'.format(sessionUser.uid))] }, offset: pagination.offset, limit: pagination.limit })
                                .then(function (feedList) {
                                    return feedList;
                                });

                        }).then(function (feedList) {

                            //render objects from feed list
                            var feedController = require('../controllers/feed');
                            return feedController.renderObjects(feedList, sessionUser)
                                .then(function (feed) {
                                    return feed;
                                });

                        }).then(function (feed) {
                            res.send(200, { meta: { status: 200, message: "success" }, data: feed });
                        });

                    //######################### Create Feed (End) ###########################

                }
                else {
                    res.send(401, { meta: { status: 401, message: 'user is not logged in or invalid token' } });
                }
            })
            .error(function (err) {
                if (err.message != 'break chain')
                    res.send(500, { meta: { status: 500, message: 'unexpected error' }, details: err });
            })
            .catch(function (err) {
                if (err.message != 'break chain')
                    res.send(500, { meta: { status: 500, message: 'unexpected error' }, details: err });
            });
    }

    function error(errors) {
        if (errors instanceof Error) {
            // This means an exception was thrown from a validator
            res.send(401, { meta: { status: 401, message: 'An error ocuured in validator' }, errors: errors });
        }
        else {
            res.send(401, { meta: { status: 401, message: 'validation errors' }, errors: errors });
        }
    }
};

exports.getLinkedGoalFeed = function (req, res) {

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

                    var pagination = utils.pagination(req);
                    //######################### Create Feed (start) #########################

                    return new Promise(function (resolve) {

                        //get feed list
                        var query_GetLinkedFeedList = "SELECT activity.id `activity_id`, activity.uid, activity.activity_type, activity.source_id, activity.parent_id, activity.parent_type, activity.post_id\
                                                        FROM\
                                                            user_activity activity\
                                                        WHERE\
                                                            activity.parent_id IN (\
                                                                select to_goal_id from goals\
                                                                inner join goal_linked on goals.goal_id = from_goal_id\
                                                                inner join goals as linker_goal on linker_goal.goal_id = to_goal_id\
                                                                where goals.goal_id = {0} and goal_linked.status = 'ACTIVE' and (linker_goal.status = 'ACTIVE' OR linker_goal.status = 'COMPLETED')\
                                                            )\
                                                            and activity.activity_type IN ('PROGRESS_UPDATED', 'MILESTONE_CREATED', 'MILESTONE_COMPLETED', 'CONTRIBUTION')\
                                                        ORDER BY\
                                                            activity.id DESC\
                                                            limit {1},{2}".format(req.params.id, pagination.offset, pagination.limit);

                        var sequelize = db.sequelizeConn();
                        return sequelize.query(query_GetLinkedFeedList, {
                            type: sequelize.QueryTypes.SELECT
                        })
                            .then(function (feedList) {
                                resolve(feedList);
                            });
                    }).then(function (feedList) {

                        //render objects from feed list
                        var feedController = require('../controllers/feed');
                        return feedController.renderObjects(feedList, SessionUser)
                            .then(function (feed) {
                                console.log('################ goal feed - received');
                                return feed;
                            });

                    }).then(function (feed) {
                        console.log('################ goal feed - sending response');
                        res.send(200, { meta: { status: 200, message: "success" }, data: feed });
                        console.log('################ goal feed - response sent');
                    });

                    //######################### Create Feed (End) ###########################

                }
                else {
                    res.send({ meta: { status: 401, message: 'user is not logged in or invalid token' } });
                }
            })
            .error(function (err) {
                res.send({ meta: { status: 500, message: 'unexpected error' }, details: err });
            })
            .catch(function (err) {
                res.send(500, { meta: { status: 500, message: 'unexpected error' }, details: err });
            });
    }

    function error(errors) {
        if (errors instanceof Error) {
            // This means an exception was thrown from a validator
            res.send({ meta: { status: 401, message: 'An error ocuured in validator' }, errors: errors });
        } else {
            res.send({ meta: { status: 401, message: 'validation errors' }, errors: errors });
        }
    }
};

//#############################################################
//###################### Reusables  ###########################
//#############################################################

//takes list of feed and render them into JSON objects
exports.renderObjects_old = function (feedList, SessionUser) {

    var notifications = require('./Notifications.js');

    return new Promise(function (resolve, reject) {
        //render objects from feed list
        var feed = [];

        // loop through the goal ids and get goal objects
        var promiseFor = Promise.method(function (condition, action, value) {
            if (!condition(value)) return value;
            return action(value).then(promiseFor.bind(null, condition, action));
        });

        promiseFor(function (count) {
            return count < feedList.length;
        }, function (count) {
            //######################### loop body (start) #########################

            var feed_activity = feedList[count];

            //######################### render objects (start) #########################

            if (feed_activity.activity_type == 'GOAL_CREATED') {

                var feed_obj = {};
                feed_obj.id = feed_activity.activity_id;
                feed_obj.feed_type = feed_activity.activity_type;

                return helpers.GetGoal(feed_activity.source_id, null, SessionUser.uid)
                    .then(function (goal) {

                        feed_obj.goal = goal;
                        return feed_obj;
                    })
                    .then(function (feed_obj) {
                        return helpers.getPost(feed_activity.post_id, true, SessionUser.uid)
                            .then(function (post) {
                                feed_obj.post = post;

                                feed.push(feed_obj);

                                return ++count;
                            });
                    });
            }
            else if (feed_activity.activity_type == 'STATUS_UPDATE') {

                var feed_obj = {};
                feed_obj.id = feed_activity.activity_id;
                feed_obj.feed_type = feed_activity.activity_type;

                return helpers.getPost(feed_activity.post_id, true, SessionUser.uid)
                    .then(function (post) {

                        feed_obj.post = post;

                        feed.push(feed_obj);

                        return ++count;
                    });
            }
            //its a duplicate of "STATUS_UPDATE" currently
            else if (feed_activity.activity_type == 'ALBUM') {

                var feed_obj = {};
                feed_obj.id = feed_activity.activity_id;
                feed_obj.feed_type = feed_activity.activity_type;

                return helpers.getPost(feed_activity.post_id, true, SessionUser.uid)
                    .then(function (post) {

                        feed_obj.post = post;

                        feed.push(feed_obj);

                        return ++count;
                    });
            }
            else if (feed_activity.activity_type == 'COMMENT') {

                var feed_obj = {};
                feed_obj.id = feed_activity.activity_id;
                feed_obj.feed_type = feed_activity.activity_type;

                return helpers.getPost(feed_activity.parent_id, true, SessionUser.uid)
                    .then(function (post) {

                        feed_obj.post = post;

                        feed.push(feed_obj);

                        return ++count;
                    });
            }
            else if (feed_activity.activity_type == 'REPLY_ON_POSTCOMMENT') {

                var feed_obj = {};
                feed_obj.id = feed_activity.activity_id;
                feed_obj.feed_type = feed_activity.activity_type;

                return helpers.getPost(feed_activity.parent_id, true, SessionUser.uid)
                    .then(function (post) {

                        feed_obj.post = post;

                        feed.push(feed_obj);

                        return ++count;
                    });
            }
            else if (feed_activity.activity_type == 'GOAL_FOLLOWED') {

                var feed_obj = {};
                feed_obj.id = feed_activity.activity_id;
                feed_obj.feed_type = feed_activity.activity_type;

                return helpers.GetGoal(feed_activity.source_id, null, SessionUser.uid)
                    .then(function (goal) {
                        feed_obj.goal = goal;
                        return feed_obj;
                    })
                    .then(function (feed_obj) {
                        return helpers.getPost(feed_activity.post_id, true, SessionUser.uid)
                            .then(function (post) {

                                feed_obj.post = post;
                                return feed_obj;
                            });
                    })
                    .then(function (feed_obj) {
                        return helpers.GetUser_ORM(feed_activity.uid, SessionUser.uid)
                            .then(function (user) {

                                feed_obj.user = user;
                                return feed_obj;
                            });
                    })
                    .then(function (feed_obj) {

                        var titleData = [{ "bold": feed_obj.user.name }, { "regular": "followed a goal" }, { "bold": feed_obj.goal.name }];

                        feed_obj.title = notifications.titleGenerator(titleData);

                        feed.push(feed_obj);
                        return ++count;
                    });
            }
            else if (feed_activity.activity_type == 'USER_FOLLOWED') {

                var feed_obj = {};
                feed_obj.id = feed_activity.activity_id;
                feed_obj.feed_type = feed_activity.activity_type;

                return helpers.GetUser_ORM(feed_activity.uid, SessionUser.uid)
                    .then(function (user) {

                        feed_obj.user_from = user;
                        return feed_obj;
                    })
                    .then(function (feed_obj) {
                        return helpers.GetUser_ORM(feed_activity.source_id, SessionUser.uid)
                            .then(function (user) {

                                feed_obj.user_to = user;
                                return feed_obj;
                            });
                    })
                    .then(function (feed_obj) {
                        return helpers.getPost(feed_activity.post_id, true, SessionUser.uid)
                            .then(function (post) {

                                feed_obj.post = post;
                                return feed_obj;
                            });
                    })
                    .then(function (feed_obj) {

                        var titleData = [{ "bold": feed_obj.user_from.name }, { "regular": "followed" }, { "bold": feed_obj.user_to.name + "'s" }, { "regular": "profile" }];

                        feed_obj.title = notifications.titleGenerator(titleData);

                        feed.push(feed_obj);
                        return ++count;
                    });
            }
            else if (feed_activity.activity_type == 'LINK_GOAL') {

                var feed_obj = {};
                feed_obj.id = feed_activity.activity_id;
                feed_obj.feed_type = feed_activity.activity_type;

                return helpers.GetGoal(feed_activity.source_id, null, SessionUser.uid)
                    .then(function (goal) {

                        feed_obj.goal_from = goal;
                        return feed_obj;
                    })
                    .then(function (feed_obj) {
                        return helpers.GetGoal(feed_activity.parent_id, null, SessionUser.uid)
                            .then(function (goal) {
                                feed_obj.goal_to = goal;
                                return feed_obj;
                            });
                    })
                    .then(function (feed_obj) {
                        return helpers.getPost(feed_activity.post_id, true, SessionUser.uid)
                            .then(function (post) {

                                feed_obj.post = post;

                                feed.push(feed_obj);

                                return ++count;
                            });
                    });
            }
            else if (feed_activity.activity_type == 'CONTRIBUTION') {

                var feed_obj = {};
                feed_obj.id = feed_activity.activity_id;
                feed_obj.feed_type = feed_activity.activity_type;

                return helpers.GetGoal(feed_activity.parent_id, null, SessionUser.uid)
                    .then(function (goal) {

                        feed_obj.goal = goal;
                        return feed_obj;
                    })
                    .then(function (feed_obj) {
                        return helpers.getPost(feed_activity.source_id, true, SessionUser.uid)
                            .then(function (post) {

                                feed_obj.post = post;
                                return feed_obj;
                            });
                    })
                    .then(function (feed_obj) {

                        var titleData = [{ "bold": feed_obj.post.user.name }, { "regular": "contributed on" }, { "bold": feed_obj.goal.name }];

                        feed_obj.title = notifications.titleGenerator(titleData);

                        feed.push(feed_obj);
                        return ++count;
                    });
            }
            else if (feed_activity.activity_type == 'PROGRESS_UPDATED') {

                var feed_obj = {};
                feed_obj.id = feed_activity.activity_id;
                feed_obj.feed_type = feed_activity.activity_type;

                return helpers.GetGoal(feed_activity.parent_id, null, SessionUser.uid)
                    .then(function (goal) {

                        feed_obj.goal = goal;
                        return feed_obj;
                    })
                    .then(function (feed_obj) {
                        return helpers.getPost(feed_activity.source_id, true, SessionUser.uid)
                            .then(function (post) {
                                feed_obj.post = post;
                                return feed_obj;
                            });
                    })
                    .then(function (feed_obj) {

                        var titleData = [{ "bold": feed_obj.post.user.name }, { "regular": "added a progress on" }, { "bold": feed_obj.goal.name }];

                        feed_obj.title = notifications.titleGenerator(titleData);

                        feed.push(feed_obj);
                        return ++count;
                    });
            }
            else if (feed_activity.activity_type == 'MILESTONE_CREATED' || feed_activity.activity_type == 'MILESTONE_COMPLETED') {

                var feed_obj = {};
                feed_obj.id = feed_activity.activity_id;
                feed_obj.feed_type = feed_activity.activity_type;

                return helpers.GetGoal(feed_activity.parent_id, null, SessionUser.uid)
                    .then(function (goal) {

                        feed_obj.goal = goal;
                        return feed_obj;
                    })
                    .then(function (feed_obj) {
                        var milestone = objAllTables.milestone.milestone();
                        return milestone.findOne({ where: { id: feed_activity.source_id } })//status: {$ne: 'DELETED'}
                            .then(function (milestone) {
                                feed_obj.milestone = milestone;
                                return feed_obj;
                            });
                    })
                    .then(function (feed_obj) {
                        return helpers.getPost(feed_activity.post_id, true, SessionUser.uid)
                            .then(function (post) {

                                feed_obj.post = post;

                                feed.push(feed_obj);

                                return ++count;
                            });
                    });
            }
            else if (feed_activity.activity_type == 'GOAL_ACHIEVED') {

                var feed_obj = {};
                feed_obj.id = feed_activity.activity_id;
                feed_obj.feed_type = feed_activity.activity_type;

                return helpers.GetGoal(feed_activity.source_id, null, SessionUser.uid)
                    .then(function (goal) {

                        feed_obj.goal = goal;
                        return feed_obj;
                    })
                    .then(function (feed_obj) {
                        return helpers.getPost(feed_activity.post_id, true, SessionUser.uid)
                            .then(function (post) {

                                feed_obj.post = post;
                                return feed_obj;
                            });
                    })
                    .then(function (feed_obj) {

                        var titleData = [{ "bold": feed_obj.post.user.name }, { "regular": "achieved a goal" }, { "bold": feed_obj.goal.name }];

                        feed_obj.title = notifications.titleGenerator(titleData);

                        feed.push(feed_obj);
                        return ++count;
                    });
            }
            else if (feed_activity.activity_type == 'SHARE_GOAL') {

                var feed_obj = {};
                feed_obj.id = feed_activity.activity_id;
                feed_obj.feed_type = feed_activity.activity_type;

                return helpers.GetGoal(feed_activity.source_id, null, SessionUser.uid)
                    .then(function (goal) {
                        feed_obj.goal = goal;
                        return feed_obj;
                    })
                    .then(function (feed_obj) {
                        return helpers.getPost(feed_activity.post_id, true, SessionUser.uid)
                            .then(function (post) {
                                feed_obj.post = post;
                                feed.push(feed_obj);
                                return ++count;
                            });
                    });

            } else if (feed_activity.activity_type == 'SHARE_POST') {

                var feed_obj = {};
                feed_obj.id = feed_activity.activity_id;
                feed_obj.feed_type = feed_activity.activity_type;

                return helpers.getPost(feed_activity.source_id, null, SessionUser.uid)
                    .then(function (post) {
                        feed_obj.sharedPost = post;
                        return feed_obj;
                    })
                    .then(function (feed_obj) {
                        return helpers.getPost(feed_activity.post_id, true, SessionUser.uid)
                            .then(function (post) {
                                feed_obj.post = post;
                                feed.push(feed_obj);
                                return ++count;
                            });
                    });

            } else if (feed_activity.activity_type == 'PROFILE_PICTURE_UPDATED') {

                var feed_obj = {};
                feed_obj.id = feed_activity.activity_id;
                feed_obj.feed_type = feed_activity.activity_type;

                return helpers.getPost(feed_activity.post_id, true, SessionUser.uid)
                    .then(function (post) {

                        feed_obj.post = post;

                        feed.push(feed_obj);

                        return ++count;
                    });
            }
            else if (feed_activity.activity_type == 'PROFILE_COVER_UPDATED') {

                var feed_obj = {};
                feed_obj.id = feed_activity.activity_id;
                feed_obj.feed_type = feed_activity.activity_type;

                return helpers.getPost(feed_activity.post_id, true, SessionUser.uid)
                    .then(function (post) {

                        feed_obj.post = post;

                        feed.push(feed_obj);

                        return ++count;
                    });

            }
            else if (feed_activity.activity_type == 'GOAL_IMAGE_UPDATED') {

                var feed_obj = {};
                feed_obj.id = feed_activity.activity_id;
                feed_obj.feed_type = feed_activity.activity_type;

                return helpers.GetGoal(feed_activity.source_id, null, SessionUser.uid)
                    .then(function (goal) {
                        feed_obj.goal = goal;
                        return feed_obj;
                    })
                    .then(function (feed_obj) {
                        return helpers.getPost(feed_activity.post_id, true, SessionUser.uid)
                            .then(function (post) {
                                feed_obj.post = post;
                                feed.push(feed_obj);
                                return ++count;
                            });
                    });

            }
            else {
                return new Promise(function (resolve) {
                    resolve(++count);
                });
            }

            //######################### render objects (end) #########################

            //######################### loop body (end) #########################
        }, 0)
            .then(function () {
                resolve(feed);
            });
    });
};


exports.renderObjects = function (feedList, SessionUser) {

    var notifications = require('./Notifications.js');

    return new Promise(function (resolve, reject) {
        //render objects from feed list
        var feed = [];

        // loop through the goal ids and get goal objects
        var promiseFor = Promise.method(function (condition, action, value) {
            if (!condition(value)) return value;
            return action(value).then(promiseFor.bind(null, condition, action));
        });

        promiseFor(function (count) {
            return count < feedList.length;
        }, function (count) {
            //######################### loop body (start) #########################

            var feed_activity = feedList[count];

            //######################### render objects (start) #########################

            if (feed_activity.activity_type == 'GOAL_CREATED') {

                var feed_obj = {};
                feed_obj.id = feed_activity.activity_id;
                feed_obj.feed_type = feed_activity.activity_type;

                return helpers.GetGoal(feed_activity.source_id, null, SessionUser.uid)
                    .then(function (goal) {

                        feed_obj.goal = goal;
                        return feed_obj;
                    })
                    .then(function (feed_obj) {
                        return helpers.getPost(feed_activity.post_id, true, SessionUser.uid)
                            .then(function (post) {
                                feed_obj.post = post;

                                feed.push(feed_obj);

                                return ++count;
                            });
                    });
            }
            else if (feed_activity.activity_type == 'STATUS_UPDATE') {

                var feed_obj = {};
                feed_obj.id = feed_activity.activity_id;
                feed_obj.feed_type = feed_activity.activity_type;

                return helpers.getPost(feed_activity.post_id, true, SessionUser.uid)
                    .then(function (post) {

                        feed_obj.post = post;

                        feed.push(feed_obj);

                        return ++count;
                    });
            }
            //its a duplicate of "STATUS_UPDATE" currently
            else if (feed_activity.activity_type == 'ALBUM') {

                var feed_obj = {};
                feed_obj.id = feed_activity.activity_id;
                feed_obj.feed_type = feed_activity.activity_type;

                return helpers.getPost(feed_activity.post_id, true, SessionUser.uid)
                    .then(function (post) {

                        feed_obj.post = post;

                        feed.push(feed_obj);

                        return ++count;
                    });
            }
            else if (feed_activity.activity_type == 'COMMENT') {

                var feed_obj = {};
                feed_obj.id = feed_activity.activity_id;
                feed_obj.feed_type = feed_activity.activity_type;

                return helpers.getPost(feed_activity.parent_id, true, SessionUser.uid)
                    .then(function (post) {

                        feed_obj.post = post;

                        feed.push(feed_obj);

                        return ++count;
                    });
            }
            else if (feed_activity.activity_type == 'REPLY_ON_POSTCOMMENT') {

                var feed_obj = {};
                feed_obj.id = feed_activity.activity_id;
                feed_obj.feed_type = feed_activity.activity_type;

                return helpers.getPost(feed_activity.parent_id, true, SessionUser.uid)
                    .then(function (post) {

                        feed_obj.post = post;

                        feed.push(feed_obj);

                        return ++count;
                    });
            }
            else if (feed_activity.activity_type == 'GOAL_FOLLOWED') {

                var input = {
                    basic: ['name', 'username', 'email', 'link'],
                    profile: ['small', 'medium']
                };


                var feed_obj = {};
                var feed_obj_users = [];
                feed_obj.id = feed_activity.activity_id;
                feed_obj.feed_type = feed_activity.activity_type;

                return helpers.GetGoal(feed_activity.source_id, null, SessionUser.uid)
                    .then(function (goal) {
                        feed_obj.goal = goal;
                        return feed_obj;
                    })
                    .then(function (feed_obj) {
                        return helpers.getPost(feed_activity.post_id, true, SessionUser.uid)
                            .then(function (post) {

                                feed_obj.post = post;
                                return feed_obj;
                            });
                    })
                    .then(function (feed_obj) {

                        if (feed_activity.count > 1) {
                            return Promise.map(feed_activity.last_two, function (uid) {

                                // return helpers.GetUser_ORM(feed_activity.source_id, uid)
                                //     .then(function (user) {
                                //         feed_obj_users.push(user);
                                //     });

                                var _user = new User(feed_activity.source_id, uid);
                                return _user.get(input)
                                    .then(function (user) {

                                        feed_obj_users.push(user[0]);
                                    });

                            }).then(function () {
                                feed_obj.user = feed_obj_users;
                                return feed_obj;
                            })

                        }
                        else {

                            // return helpers.GetUser_ORM(feed_activity.uid, SessionUser.uid)
                            //     .then(function (user) {
                            //         feed_obj.user = user;
                            //         return feed_obj;
                            //     });

                            var _user = new User(feed_activity.uid, SessionUser.uid);
                            return _user.get(input)
                                .then(function (user) {
                                    feed_obj.user = user[0];
                                    return feed_obj;
                                });


                        }
                    })
                    .then(function (feed_obj) {

                        var titleData = [{ "bold": feed_obj.user.name }, { "regular": "followed a goal" }, { "bold": feed_obj.goal.name }];

                        feed_obj.title = notifications.titleGenerator(titleData);

                        feed.push(feed_obj);
                        return ++count;
                    });
            }
            else if (feed_activity.activity_type == 'USER_FOLLOWED') {

                var input = {
                    basic: ['name', 'username', 'email', 'link'],
                    profile: ['small', 'medium'],
                    // cover: ['small', 'medium'],
                    //me: ['follower', 'following', 'mutual', 'mute'],
                    //location: true,
                    // stats: {
                    //     connections: ['followers', 'followings'],
                    //     goals: ['total', 'linked', 'following']
                    // }
                };


                var feed_obj = {};
                feed_obj.id = feed_activity.activity_id;
                feed_obj.feed_type = feed_activity.activity_type;

                // return helpers.GetUser_ORM(feed_activity.uid, SessionUser.uid)
                //     .then(function (user) {

                //         feed_obj.user_from = user;
                //         return feed_obj;
                //     })


                var _user = new User(feed_activity.uid, SessionUser.uid);
                return _user.get(input)
                    .then(function (user) {
                        feed_obj.user_from = user[0];
                        return feed_obj;
                    })
                    .then(function (feed_obj) {

                        // return helpers.GetUser_ORM(feed_activity.source_id, SessionUser.uid)
                        //     .then(function (user) {

                        //         feed_obj.user_to = user;
                        //         return feed_obj;
                        //     });


                        var _user = new User(feed_activity.source_id, SessionUser.uid);
                        return _user.get(input)
                            .then(function (user) {
                                feed_obj.user_to = user[0];
                                return feed_obj;
                            })

                    })
                    .then(function (feed_obj) {
                        return helpers.getPost(feed_activity.post_id, true, SessionUser.uid)
                            .then(function (post) {

                                feed_obj.post = post;
                                return feed_obj;
                            });
                    })
                    .then(function (feed_obj) {

                        var titleData = [{ "bold": feed_obj.user_from.name }, { "regular": "followed" }, { "bold": feed_obj.user_to.name + "'s" }, { "regular": "profile" }];

                        feed_obj.title = notifications.titleGenerator(titleData);

                        feed.push(feed_obj);
                        return ++count;
                    });

            }
            else if (feed_activity.activity_type == 'LINK_GOAL') {

                var feed_obj = {};
                feed_obj.id = feed_activity.activity_id;
                feed_obj.feed_type = feed_activity.activity_type;

                return helpers.GetGoal(feed_activity.source_id, null, SessionUser.uid)
                    .then(function (goal) {

                        feed_obj.goal_from = goal;
                        return feed_obj;
                    })
                    .then(function (feed_obj) {
                        return helpers.GetGoal(feed_activity.parent_id, null, SessionUser.uid)
                            .then(function (goal) {
                                feed_obj.goal_to = goal;
                                return feed_obj;
                            });
                    })
                    .then(function (feed_obj) {
                        return helpers.getPost(feed_activity.post_id, true, SessionUser.uid)
                            .then(function (post) {

                                feed_obj.post = post;

                                feed.push(feed_obj);

                                return ++count;
                            });
                    });
            }
            else if (feed_activity.activity_type == 'CONTRIBUTION') {

                var feed_obj = {};
                feed_obj.id = feed_activity.activity_id;
                feed_obj.feed_type = feed_activity.activity_type;

                return helpers.GetGoal(feed_activity.parent_id, null, SessionUser.uid)
                    .then(function (goal) {

                        feed_obj.goal = goal;
                        return feed_obj;
                    })
                    .then(function (feed_obj) {
                        return helpers.getPost(feed_activity.source_id, true, SessionUser.uid)
                            .then(function (post) {

                                feed_obj.post = post;
                                return feed_obj;
                            });
                    })
                    .then(function (feed_obj) {

                        var titleData = [{ "bold": feed_obj.post.user.name }, { "regular": "contributed on" }, { "bold": feed_obj.goal.name }];

                        feed_obj.title = notifications.titleGenerator(titleData);

                        feed.push(feed_obj);
                        return ++count;
                    });
            }
            else if (feed_activity.activity_type == 'PROGRESS_UPDATED') {

                var feed_obj = {};
                feed_obj.id = feed_activity.activity_id;
                feed_obj.feed_type = feed_activity.activity_type;

                return helpers.GetGoal(feed_activity.parent_id, null, SessionUser.uid)
                    .then(function (goal) {

                        feed_obj.goal = goal;
                        return feed_obj;
                    })
                    .then(function (feed_obj) {
                        return helpers.getPost(feed_activity.source_id, true, SessionUser.uid)
                            .then(function (post) {
                                feed_obj.post = post;
                                return feed_obj;
                            });
                    })
                    .then(function (feed_obj) {

                        var titleData = [{ "bold": feed_obj.post.user.name }, { "regular": "added a progress on" }, { "bold": feed_obj.goal.name }];

                        feed_obj.title = notifications.titleGenerator(titleData);

                        feed.push(feed_obj);
                        return ++count;
                    });
            }
            else if (feed_activity.activity_type == 'MILESTONE_CREATED' || feed_activity.activity_type == 'MILESTONE_COMPLETED') {

                var feed_obj = {};
                feed_obj.id = feed_activity.activity_id;
                feed_obj.feed_type = feed_activity.activity_type;

                return helpers.GetGoal(feed_activity.parent_id, null, SessionUser.uid)
                    .then(function (goal) {

                        feed_obj.goal = goal;
                        return feed_obj;
                    })
                    .then(function (feed_obj) {
                        var milestone = objAllTables.milestone.milestone();
                        return milestone.findOne({ where: { id: feed_activity.source_id } })//status: {$ne: 'DELETED'}
                            .then(function (milestone) {
                                feed_obj.milestone = milestone;
                                return feed_obj;
                            });
                    })
                    .then(function (feed_obj) {
                        return helpers.getPost(feed_activity.post_id, true, SessionUser.uid)
                            .then(function (post) {

                                feed_obj.post = post;

                                feed.push(feed_obj);

                                return ++count;
                            });
                    });
            }
            else if (feed_activity.activity_type == 'GOAL_ACHIEVED') {

                var feed_obj = {};
                feed_obj.id = feed_activity.activity_id;
                feed_obj.feed_type = feed_activity.activity_type;

                return helpers.GetGoal(feed_activity.source_id, null, SessionUser.uid)
                    .then(function (goal) {

                        feed_obj.goal = goal;
                        return feed_obj;
                    })
                    .then(function (feed_obj) {
                        return helpers.getPost(feed_activity.post_id, true, SessionUser.uid)
                            .then(function (post) {

                                feed_obj.post = post;
                                return feed_obj;
                            });
                    })
                    .then(function (feed_obj) {

                        var titleData = [{ "bold": feed_obj.post.user.name }, { "regular": "achieved a goal" }, { "bold": feed_obj.goal.name }];

                        feed_obj.title = notifications.titleGenerator(titleData);

                        feed.push(feed_obj);
                        return ++count;
                    });
            }
            else if (feed_activity.activity_type == 'SHARE_GOAL') {

                var feed_obj = {};
                feed_obj.id = feed_activity.activity_id;
                feed_obj.feed_type = feed_activity.activity_type;

                return helpers.GetGoal(feed_activity.source_id, null, SessionUser.uid)
                    .then(function (goal) {
                        feed_obj.goal = goal;
                        return feed_obj;
                    })
                    .then(function (feed_obj) {
                        return helpers.getPost(feed_activity.post_id, true, SessionUser.uid)
                            .then(function (post) {
                                feed_obj.post = post;
                                feed.push(feed_obj);
                                return ++count;
                            });
                    });

            } else if (feed_activity.activity_type == 'SHARE_POST') {

                var feed_obj = {};
                feed_obj.id = feed_activity.activity_id;
                feed_obj.feed_type = feed_activity.activity_type;

                return helpers.getPost(feed_activity.source_id, null, SessionUser.uid)
                    .then(function (post) {
                        feed_obj.post = post;
                        return feed_obj;
                    })
                    .then(function (feed_obj) {
                        return helpers.getPost(feed_activity.post_id, true, SessionUser.uid)
                            .then(function (post) {
                                feed_obj.parent_post = post;
                                feed.push(feed_obj);
                                return ++count;
                            });
                    });

            } else if (feed_activity.activity_type == 'PROFILE_PICTURE_UPDATED') {

                var feed_obj = {};
                feed_obj.id = feed_activity.activity_id;
                feed_obj.feed_type = feed_activity.activity_type;

                return helpers.getPost(feed_activity.post_id, true, SessionUser.uid)
                    .then(function (post) {

                        feed_obj.post = post;

                        feed.push(feed_obj);

                        return ++count;
                    });
            }
            else if (feed_activity.activity_type == 'PROFILE_COVER_UPDATED') {

                var feed_obj = {};
                feed_obj.id = feed_activity.activity_id;
                feed_obj.feed_type = feed_activity.activity_type;

                return helpers.getPost(feed_activity.post_id, true, SessionUser.uid)
                    .then(function (post) {

                        feed_obj.post = post;

                        feed.push(feed_obj);

                        return ++count;
                    });

            }
            else if (feed_activity.activity_type == 'GOAL_IMAGE_UPDATED') {

                var feed_obj = {};
                feed_obj.id = feed_activity.activity_id;
                feed_obj.feed_type = feed_activity.activity_type;

                return helpers.GetGoal(feed_activity.source_id, null, SessionUser.uid)
                    .then(function (goal) {
                        feed_obj.goal = goal;
                        return feed_obj;
                    })
                    .then(function (feed_obj) {
                        return helpers.getPost(feed_activity.post_id, true, SessionUser.uid)
                            .then(function (post) {
                                feed_obj.post = post;
                                feed.push(feed_obj);
                                return ++count;
                            });
                    });

            }
            else {
                return new Promise(function (resolve) {
                    resolve(++count);
                });
            }

            //######################### render objects (end) #########################

            //######################### loop body (end) #########################
        }, 0)
            .then(function () {
                resolve(feed);
            });
    });
};


/*
 uid:            who performed activity
 activity_type:  type of activity
 source_id:      id of object on which the activity was performed
 parent_id:      id of parent object of source object
 parent_type:    type of parent e.g. GOAL, POST
 post_id:        id generated
 */
exports.createActivity = function (uid, activity_type, source_id, parent_id, parent_type, post_id, isFeed, isNotification) {

    var user_activity = objAllTables.user_activity.user_activity();
    var feedController = require('../controllers/feed');
    var notificationsController = require('../controllers/Notifications');
    var users = objAllTables.users.users();

    var feed_info = {};
    var activity_info = {};
    var notification_info = {};
    var activity;

    if (activity_type == 'GOAL_CREATED') {
        feed_info['type'] = 'USER';

        activity_info.post_id = post_id;
        activity_info.addToPostFollowers = true;

        activity = {
            uid: uid,
            activity_type: activity_type,
            source_id: source_id,
            post_id: post_id
        };
    }
    else if (activity_type == 'PROGRESS_UPDATED') {
        feed_info.type = 'GOAL_&_USER';
        feed_info.goal_id = parent_id;

        activity_info.post_id = source_id;
        activity_info.addToPostFollowers = true;

        activity = {
            uid: uid,
            activity_type: activity_type,
            source_id: source_id,
            parent_id: parent_id,
            parent_type: parent_type,
            post_id: post_id
        };

        notification_info = {
            actor_uid: uid,
            activity_type: activity_type,
            type: null,
            goal_id: parent_id,
            post_id: source_id
        };
    }
    else if (activity_type == 'CONTRIBUTION') {
        feed_info.type = 'GOAL_&_USER';
        feed_info.goal_id = parent_id;

        activity_info.post_id = source_id;
        activity_info.addToPostFollowers = true;

        activity = {
            uid: uid,
            activity_type: activity_type,
            source_id: source_id,
            parent_id: parent_id,
            parent_type: parent_type,
            post_id: post_id
        };


        notification_info = {
            actor_uid: uid,
            activity_type: activity_type,
            type: null,
            goal_id: parent_id,
            post_id: source_id
        };
    }
    else if (activity_type == 'GOAL_ACHIEVED') {
        feed_info.type = 'GOAL_&_USER';
        feed_info.goal_id = source_id;

        activity_info.post_id = source_id;
        activity_info.addToPostFollowers = true;

        activity = {
            uid: uid,
            activity_type: activity_type,
            source_id: source_id,
            post_id: post_id
        };
    }
    else if (activity_type == 'GOAL_FOLLOWED') {
        feed_info.type = 'GOAL_&_USER';
        feed_info.goal_id = source_id;
        activity = {
            uid: uid,
            activity_type: activity_type,
            source_id: source_id,
            post_id: post_id
        };

        notification_info = {
            actor_uid: uid,
            activity_type: activity_type,
            type: null,
            goal_id: source_id,
            post_id: post_id
        };
    }
    else if (activity_type == 'USER_FOLLOWED') {
        feed_info.type = 'USER';
        activity = {
            uid: uid,
            activity_type: activity_type,
            source_id: source_id,
            post_id: post_id
        };

        notification_info = {
            actor_uid: uid,
            activity_type: activity_type,
            type: null,
            post_id: post_id,
            followed_uid: source_id
        };
    }
    else if (activity_type == 'MILESTONE_CREATED') {
        feed_info.type = 'GOAL_&_USER';
        feed_info.goal_id = parent_id;

        activity_info.post_id = post_id;
        activity_info.addToPostFollowers = true;

        activity = {
            uid: uid,
            activity_type: activity_type,
            source_id: source_id,
            parent_id: parent_id,
            parent_type: parent_type,
            post_id: post_id
        };

        notification_info = {
            actor_uid: uid,
            activity_type: activity_type,
            type: null,
            post_id: post_id,
            goal_id: parent_id,
            milestone_id: source_id
        };
    }
    else if (activity_type == 'MILESTONE_COMPLETED') {
        feed_info.type = 'GOAL_&_USER';
        feed_info.goal_id = parent_id;

        activity_info.post_id = post_id;
        activity_info.addToPostFollowers = true;

        activity = {
            uid: uid,
            activity_type: activity_type,
            source_id: source_id,
            parent_id: parent_id,
            parent_type: parent_type,
            post_id: post_id
        };

        notification_info = {
            actor_uid: uid,
            activity_type: activity_type,
            type: null,
            post_id: post_id,
            goal_id: parent_id,
            milestone_id: source_id
        };
    }
    else if (activity_type == 'COMMENT') {
        feed_info.type = 'POSTFOLLOW';
        feed_info.post_id = parent_id;

        activity_info.addToPostFollowers = true;
        activity_info.post_id = parent_id;

        activity = {
            uid: uid,
            activity_type: activity_type,
            source_id: source_id,
            parent_id: parent_id,
            parent_type: parent_type
        };

        notification_info = {
            actor_uid: uid,
            activity_type: activity_type,
            type: null,
            post_id: parent_id
        };
    }
    else if (activity_type == 'REPLY_ON_POSTCOMMENT') {
        feed_info.type = 'POSTFOLLOW';
        feed_info.post_id = post_id;

        activity_info.addToPostFollowers = true;
        activity_info.post_id = parent_id;

        activity = {
            uid: uid,
            activity_type: activity_type,
            source_id: source_id,
            parent_id: parent_id,
            parent_type: parent_type
        };

        notification_info = {
            actor_uid: uid,
            activity_type: activity_type,
            type: null,
            post_id: parent_id
        };
    }
    else if (activity_type == 'STATUS_UPDATE') {
        feed_info.type = 'USER';

        activity_info.post_id = post_id;
        activity_info.addToPostFollowers = true;

        activity = {
            uid: uid,
            activity_type: activity_type,
            source_id: source_id,
            parent_id: parent_id,
            parent_type: parent_type,
            post_id: post_id
        };

        notification_info = {
            actor_uid: uid,
            activity_type: activity_type,
            post_id: post_id
        };
    }
    else if (activity_type == 'MOTIVATE_ON_POST') {
        feed_info.type = 'NONE';

        activity = {
            uid: uid,
            activity_type: activity_type,
            source_id: source_id,
            parent_id: parent_id,
            parent_type: parent_type
        };

        notification_info = {
            actor_uid: uid,
            activity_type: activity_type,
            type: null,
            post_id: parent_id
        };
    }
    else if (activity_type == 'MOTIVATE_ON_GOAL') {
        feed_info.type = 'NONE';

        activity = {
            uid: uid,
            activity_type: activity_type,
            parent_id: parent_id,
            source_id: source_id,
            parent_type: parent_type
        };

        notification_info = {
            actor_uid: uid,
            activity_type: activity_type,
            type: null,
            goal_id: parent_id
        };
    }
    else if (activity_type == 'SHARE_GOAL') {
        feed_info.type = 'USER';
        activity_info.post_id = post_id;

        activity_info.addToPostFollowers = true;

        activity = {
            uid: uid,
            activity_type: activity_type,
            source_id: source_id,
            post_id: post_id
        };

        notification_info = {
            actor_uid: uid,
            activity_type: activity_type,
            type: null,
            post_id: post_id,
            goal_id: source_id
        };
    }
    else if (activity_type == 'SHARE_POST') {
        feed_info.type = 'USER';

        activity_info.post_id = post_id;
        activity_info.addToPostFollowers = true;

        activity = {
            uid: uid,
            activity_type: activity_type,
            source_id: source_id,
            post_id: post_id
        };

        notification_info = {
            actor_uid: uid,
            activity_type: activity_type,
            type: null,
            post_id: post_id
        };
    }
    else if (activity_type == 'GOAL_TIMELINE_UPDATED') {
        feed_info['type'] = 'GOAL_&_USER';
        feed_info['goal_id'] = source_id;
        activity = {
            uid: uid,
            activity_type: activity_type,
            source_id: source_id,
            post_id: post_id
        };
    }
    else if (activity_type == 'GOAL_IMAGE_UPDATED') {
        feed_info['type'] = 'GOAL_&_USER';
        feed_info['goal_id'] = source_id;

        activity_info.post_id = post_id;
        activity_info.addToPostFollowers = true;

        activity = {
            uid: uid,
            activity_type: activity_type,
            source_id: source_id,
            post_id: post_id
        };
    }
    else if (activity_type == 'GOAL_DESCRIPTION_UPDATED') {
        feed_info['type'] = 'GOAL_&_USER';
        feed_info['goal_id'] = source_id;
        activity = {
            uid: uid,
            activity_type: activity_type,
            source_id: source_id,
            post_id: post_id
        };
    }
    else if (activity_type == 'GOAL_NAME_UPDATED') {
        feed_info['type'] = 'GOAL_&_USER';
        feed_info['goal_id'] = source_id;
        activity = {
            uid: uid,
            activity_type: activity_type,
            source_id: source_id,
            post_id: post_id
        };
    }
    else if (activity_type == 'GOAL_INTEREST_UPDATED') {
        feed_info['type'] = 'GOAL_&_USER';
        feed_info['goal_id'] = source_id;
        activity = {
            uid: uid,
            activity_type: activity_type,
            source_id: source_id,
            post_id: post_id
        };
    }
    else if (activity_type == 'PROFILE_PICTURE_UPDATED') {
        feed_info.type = 'USER';

        activity_info.post_id = post_id;
        activity_info.addToPostFollowers = true;

        activity = {
            uid: uid,
            activity_type: activity_type,
            source_id: source_id,
            post_id: post_id
        };
    }
    else if (activity_type == 'PROFILE_COVER_UPDATED') {
        feed_info.type = 'USER';

        activity_info.post_id = post_id;
        activity_info.addToPostFollowers = true;

        activity = {
            uid: uid,
            activity_type: activity_type,
            source_id: source_id,
            post_id: post_id
        };
    }
    else if (activity_type == 'LINK_GOAL') {
        feed_info['type'] = 'GOAL_&_USER';
        feed_info['goal_id'] = parent_id;
        activity = {
            uid: uid,
            activity_type: activity_type,
            source_id: source_id,
            parent_id: parent_id,
            parent_type: parent_type,
            post_id: post_id
        };

        notification_info = {
            actor_uid: uid,
            activity_type: activity_type,
            type: null,
            post_id: post_id,
            from_goal_id: source_id,
            to_goal_id: parent_id
        };
    }
    else if (activity_type == 'ALBUM') {
        feed_info.type = 'USER';

        activity_info.addToPostFollowers = true;

        activity = {
            uid: uid,
            activity_type: activity_type,
            source_id: source_id,
            post_id: post_id
        };

        // notification_info = {
        //     actor_uid: uid,
        //     activity_type: activity_type,
        //     type: null,
        //     post_id: post_id,
        //     goal_id: parent_id
        // };
    }

    //add "created" activity object
    activity.created = helpers.getUnixTimeStamp();

    //create activity
    return user_activity.create(activity)
        .then(function (createdActivity) {
            if (createdActivity != null) {
                var activity_id = createdActivity.dataValues.id;
                activity_info.activity_id = createdActivity.dataValues.id;

                return activity_info;
            }
            else {
                new Error('could not create activity');
            }
        })
        .then(function (activity_info) {
            if (activity_info.addToPostFollowers == true) {
                return notificationsController.checkAndAddUserToPostFollowers(activity_info.post_id, uid)
                    .then(function (result) {

                        if (result == false) {
                            new Error('Error Occurred in - notificationsController.checkAndAddUserToPostFollowers');
                        }

                        return activity_info;
                    });
            }
            else {
                return activity_info;
            }
        })
        .then(function (activity_info) {
            //generate feed from activity (if not false)
            if (isFeed != false) {
                feedController.createFeed(uid, activity_info.activity_id, feed_info);
            }

            //create notifications (if not false)
            if (isFeed != false) {
                notification_info.activity_id = activity_info.activity_id;
                notificationsController.createNotifications(notification_info);
            }
        })
    //.catch(function (err) {
    //    console.log('######################### Error - error in activity creation', err);
    //});
};

//#############################################################
//######################### Feed ##############################
//#############################################################

exports.createFeed = function (uid, activity_id, feed_info) {

    var user_activity = objAllTables.user_activity.user_activity();
    var user_feed = objAllTables.user_feed.user_feed();
    var users = objAllTables.users.users();
    var unixTimeStamp = helpers.getUnixTimeStamp();

    var sequelize = db.sequelizeConn();

    var query;

    //generate query
    if (feed_info.type == 'USER') {
        //add activity into the feed of users, who follow the user performed the activity

        query = "INSERT into user_feed(uid, activity_id, `status`, `created`)\
                (SELECT {0} as uid, {1} as activity_id, 'ACTIVE' as `status`, {2} as created)\
                UNION\
                (SELECT uid, {1} as activity_id, 'ACTIVE' as `status`, {2} as created FROM user_followers WHERE follows_uid = {0} and `status` = 'ACTIVE')".format(uid, activity_id, unixTimeStamp);

        return sequelize.query(query)
            .then(function (createdFeed) {
                //created feed for users
            });
    }
    else if (feed_info.type == 'GOAL') {
        //add activity into the feed of users, who follow the goal on which the activity was performed (and also the goal owner)

        query = "INSERT into user_feed(uid, activity_id, `status`, `created`)\
                (SELECT {0} as uid, {1} as activity_id, 'ACTIVE' as `status`, {2} as created)\
                UNION\
                (SELECT follower_uid as uid, {1} as activity_id, 'ACTIVE' as `status`, {2} as created FROM goal_followers WHERE goal_id = {3} and `status` = 'ACTIVE')\
                UNION\
                (SELECT g.uid as uid, {1} as activity_id, 'ACTIVE' as `status`, {2} as created FROM goals g WHERE g.goal_id = {3} and g.`status` = 'ACTIVE')".format(uid, activity_id, unixTimeStamp, feed_info.goal_id);

        return sequelize.query(query)
            .then(function (createdFeed) {
                //created feed for users
            });
    }
    else if (feed_info.type == 'GOAL_&_USER') {
        //add activity into the feed of users, who follow the user performed the activity
        //the users who follow the goal
        //the actor who performed activity
        //the goal owner

        query = "INSERT into user_feed(uid, activity_id, `status`, `created`)\
                (SELECT {0} as uid, {1} as activity_id, 'ACTIVE' as `status`, {2} as created)\
                UNION\
                (SELECT uid, {1} as activity_id, 'ACTIVE' as `status`, {2} as created FROM user_followers WHERE follows_uid = {0} and `status` = 'ACTIVE')\
                UNION\
                (SELECT follower_uid as uid, {1} as activity_id, 'ACTIVE' as `status`, {2} as created FROM goal_followers WHERE goal_id = {3} and `status` = 'ACTIVE')\
                UNION\
                (SELECT uid, {1} as activity_id, 'ACTIVE' as `status`, {2} as created FROM `goals` WHERE goal_id = {3} and `status` = 'ACTIVE')".format(uid, activity_id, unixTimeStamp, feed_info.goal_id);

        return sequelize.query(query)
            .then(function (createdFeed) {
                //created feed for users
            });
    }
    else if (feed_info.type == 'NONE') {
        return;
    }
    else if (feed_info.type == 'POSTFOLLOW') {
        //check and add user to post followers, and add this activity into the feed of post followers, and user followers

        /*var notificationsController = require('../controllers/notifications');
        return notificationsController.checkAndAddUserToPostFollowers(feed_info.post_id, uid)
            .then(function (result) {

                if (result == false) {
                    new Error('Error Occurred in - notificationsController.checkAndAddUserToPostFollowers');
                }

                query = "INSERT into user_feed(uid, activity_id, `status`, `created`)\
                   (SELECT uid, {1} as activity_id, 'ACTIVE' as `status`, {2} as created FROM user_followers WHERE follows_uid = {0} and `status` = 'ACTIVE')\
                   UNION\
                   (select uid, {1} as activity_id, 'ACTIVE' as `status`, {2} as created from post_followers WHERE post_id = {3} and `status` = 'ACTIVE')".format(uid, activity_id, unixTimeStamp, feed_info.post_id);

                return sequelize.query(query)
                    .then(function (createdFeed) {
                        //created feed for users
                    });
            });*/

        query = "INSERT into user_feed(uid, activity_id, `status`, `created`)\
                   (SELECT uid, {1} as activity_id, 'ACTIVE' as `status`, {2} as created FROM user_followers WHERE follows_uid = {0} and `status` = 'ACTIVE')\
                   UNION\
                   (select uid, {1} as activity_id, 'ACTIVE' as `status`, {2} as created from post_followers WHERE post_id = {3} and `status` = 'ACTIVE')".format(uid, activity_id, unixTimeStamp, feed_info.post_id);

        return sequelize.query(query)
            .then(function (createdFeed) {
                //created feed for users
            });
    }

    /*return sequelize.query(query)
     .then(function (createdFeed) {
     //created feed for users
     });*/
};




function consolidated_followFeed(feedList, activityType, sessionUser) {


    var input = {
        basic: ['name', 'username', 'email', 'link'],
        profile: ['small', 'medium']
    };


    var feed_finalObj = {};
    feed_finalObj.list = [];

    if (activityType == 'USER_FOLLOWED') {

        feed_finalObj.feed_type = 'USER_FOLLOWED_NETWORK';

        var users = objAllTables.users.users();
        return Promise.map(feedList, function (_feed) {

            var feed_single_obj = {};
            //feed_single_obj.uid_to = _feed.follow_to;
            feed_single_obj.users_from = [];    //list of users who followed the profile
            feed_single_obj.totalUsersCount = _feed.total_count;    //total users who followed

            return users.findAll({
                where: { uid: JSON.parse('[' + _feed.follow_from + ']') },
                attributes: ['uid', 'username', 'first_name', 'middle_name', 'last_name']
            }).then(function (users_array) {

                for (var j = 0; j < users_array.length; j++) {
                    feed_single_obj.users_from.push(users_array[j].dataValues);
                }

                //data fixing
                for (var i = 0; i < feed_single_obj.users_from.length; i++) {

                    //generate name
                    var name;
                    if (!validator.isNull(feed_single_obj.users_from[i].first_name)) {
                        name = feed_single_obj.users_from[i].first_name;
                    }
                    if (!validator.isNull(feed_single_obj.users_from[i].middle_name)) {
                        name += ' ' + feed_single_obj.users_from[i].middle_name;
                    }
                    if (!validator.isNull(feed_single_obj.users_from[i].last_name)) {
                        name += ' ' + feed_single_obj.users_from[i].last_name;
                    }
                    feed_single_obj.users_from[i].name = name;

                    //generate url
                    feed_single_obj.users_from[i].link = new Array(config.webURL.domain, feed_single_obj.users_from[i].username).toURL();
                }
                return feed_single_obj;

            }).then(function () {   //user to

                // return helpers.getUserMini2(_feed.follow_to, sessionUser.uid)
                //     .then(function (user) {
                //         feed_single_obj.user_to = user;
                //         return feed_single_obj;
                //     });

                var _user = new User(_feed.follow_to, sessionUser.uid);
                return _user.get(input)
                    .then(function (user) {
                         feed_single_obj.user_to = user[0];
                       return feed_single_obj;
                    });




            }).then(function (feed_single_obj) {    //generate title
                //for (var k = 0; k < feed_single_obj.users_from.length; k++) {

                var k = 0;

                if (feed_single_obj.totalUsersCount == 1) {
                    var titleData = [{ "bold": feed_single_obj.users_from[k].name }, { "regular": "followed" }, { "bold": feed_single_obj.user_to.name + "'s" }, { "regular": "profile" }];

                } else if (feed_single_obj.totalUsersCount == 2) {

                    var otherCount = feed_single_obj.totalUsersCount - 1;
                    var titleData = [{ "bold": feed_single_obj.users_from[k].name }, { "regular": "and" }, { "bold": feed_single_obj.users_from[k + 1].name }, { "regular": "followed" }, { "bold": feed_single_obj.user_to.name }, { "regular": "profile" }];

                } else if (feed_single_obj.totalUsersCount == 3) {

                    var otherCount = feed_single_obj.totalUsersCount - 2;
                    var titleData = [{ "bold": feed_single_obj.users_from[k].name }, { "regular": "," }, { "bold": feed_single_obj.users_from[k + 1].name }, { "regular": "and" }, { "bold": otherCount + " other" }, { "regular": "followed" }, { "bold": feed_single_obj.user_to.name }, { "regular": "profile" }];

                } else if (feed_single_obj.totalUsersCount == 4) {

                    var otherCount = feed_single_obj.totalUsersCount - 3;
                    var titleData = [{ "bold": feed_single_obj.users_from[k].name }, { "regular": "," }, { "bold": feed_single_obj.users_from[k + 1].name }, { "regular": "," }, { "bold": feed_single_obj.users_from[k + 2].name }, { "regular": "and" }, { "bold": otherCount + " other" }, { "regular": "followed" }, { "bold": feed_single_obj.user_to.name }, { "regular": "profile" }];

                } else if (feed_single_obj.totalUsersCount == 5) {

                    var otherCount = feed_single_obj.totalUsersCount - 3;
                    var titleData = [{ "bold": feed_single_obj.users_from[k].name }, { "regular": "," }, { "bold": feed_single_obj.users_from[k + 1].name }, { "regular": "," }, { "bold": feed_single_obj.users_from[k + 2].name }, { "regular": "and" }, { "bold": otherCount + " others" }, { "regular": "followed" }, { "bold": feed_single_obj.user_to.name }, { "regular": "profile" }];

                } else {
                    var titleData = [{ "bold": feed_single_obj.users_from[k].name }, { "regular": "," }, { "bold": feed_single_obj.users_from[k + 1].name }, { "regular": "," }, { "bold": feed_single_obj.users_from[k + 2].name }, { "regular": "and" }, { "bold": otherCount + " others" }, { "regular": "followed" }, { "bold": feed_single_obj.user_to.name }, { "regular": "profile" }];
                }
                //}

                feed_single_obj.title = titleGenerator(titleData);

                return feed_single_obj;
            }).then(function (feed_single_obj) {
                feed_finalObj.list.push(feed_single_obj);
            });

        }).then(function () {
            if (feed_finalObj.list.length == 0)
                return null;
            else
                return feed_finalObj;
        });
    }

    else if (activityType == 'GOAL_FOLLOWED') {

        feed_finalObj.feed_type = 'GOAL_FOLLOWED_NETWORK';

        var users = objAllTables.users.users();
        return Promise.map(feedList, function (_feed) {

            var feed_single_obj = {};
            feed_single_obj.users_from = [];    //list of users who followed the profile
            feed_single_obj.totalUsersCount = _feed.total_count;    //total users who followed

            return users.findAll({
                where: { uid: JSON.parse('[' + _feed.follow_from + ']') },
                attributes: ['uid', 'username', 'first_name', 'middle_name', 'last_name']
            }).then(function (users_array) {

                for (var j = 0; j < users_array.length; j++) {
                    feed_single_obj.users_from.push(users_array[j].dataValues);
                }

                //data fixing
                for (var i = 0; i < feed_single_obj.users_from.length; i++) {

                    //generate name
                    var name;
                    if (!validator.isNull(feed_single_obj.users_from[i].first_name)) {
                        name = feed_single_obj.users_from[i].first_name;
                    }
                    if (!validator.isNull(feed_single_obj.users_from[i].middle_name)) {
                        name += ' ' + feed_single_obj.users_from[i].middle_name;
                    }
                    if (!validator.isNull(feed_single_obj.users_from[i].last_name)) {
                        name += ' ' + feed_single_obj.users_from[i].last_name;
                    }
                    feed_single_obj.users_from[i].name = name;

                    //generate url
                    feed_single_obj.users_from[i].link = new Array(config.webURL.domain, feed_single_obj.users_from[i].username).toURL();
                }
                return feed_single_obj;

            }).then(function () {
                return helpers.GetGoal(_feed.follow_to, null, sessionUser.uid)
                    .then(function (goal) {
                        feed_single_obj.goal = goal;
                        return feed_single_obj;
                    })

            }).then(function (feed_single_obj) {    //generate title

                var k = 0;

                if (feed_single_obj.totalUsersCount == 1) {
                    var titleData = [{ "bold": feed_single_obj.users_from[k].name }, { "regular": "followed" }, { "bold": feed_single_obj.goal.user.name + "'s" }, { "regular": "goal" }];

                } else if (feed_single_obj.totalUsersCount == 2) {

                    var otherCount = feed_single_obj.totalUsersCount - 1;
                    var titleData = [{ "bold": feed_single_obj.users_from[k].name }, { "regular": "and" }, { "bold": feed_single_obj.users_from[k + 1].name }, { "regular": "followed" }, { "bold": feed_single_obj.goal.user.name }, { "regular": "goal" }];

                } else if (feed_single_obj.totalUsersCount == 3) {

                    var otherCount = feed_single_obj.totalUsersCount - 2;
                    var titleData = [{ "bold": feed_single_obj.users_from[k].name }, { "regular": "," }, { "bold": feed_single_obj.users_from[k + 1].name }, { "regular": "and" }, { "bold": otherCount + " other" }, { "regular": "followed" }, { "bold": feed_single_obj.goal.user.name }, { "regular": "goal" }];

                } else if (feed_single_obj.totalUsersCount == 4) {

                    var otherCount = feed_single_obj.totalUsersCount - 3;
                    var titleData = [{ "bold": feed_single_obj.users_from[k].name }, { "regular": "," }, { "bold": feed_single_obj.users_from[k + 1].name }, { "regular": "," }, { "bold": feed_single_obj.users_from[k + 2].name }, { "regular": "and" }, { "bold": otherCount + " other" }, { "regular": "followed" }, { "bold": feed_single_obj.goal.user.name }, { "regular": "goal" }];

                } else if (feed_single_obj.totalUsersCount == 5) {

                    var otherCount = feed_single_obj.totalUsersCount - 3;
                    var titleData = [{ "bold": feed_single_obj.users_from[k].name }, { "regular": "," }, { "bold": feed_single_obj.users_from[k + 1].name }, { "regular": "," }, { "bold": feed_single_obj.users_from[k + 2].name }, { "regular": "and" }, { "bold": otherCount + " others" }, { "regular": "followed" }, { "bold": feed_single_obj.goal.user.name }, { "regular": "goal" }];

                } else {
                    var titleData = [{ "bold": feed_single_obj.users_from[k].name }, { "regular": "," }, { "bold": feed_single_obj.users_from[k + 1].name }, { "regular": "," }, { "bold": feed_single_obj.users_from[k + 2].name }, { "regular": "and" }, { "bold": otherCount + " others" }, { "regular": "followed" }, { "bold": feed_single_obj.goal.user.name }, { "regular": "goal" }];
                }


                feed_single_obj.title = titleGenerator(titleData);

                return feed_single_obj;
            }).then(function (feed_single_obj) {
                feed_finalObj.list.push(feed_single_obj);
            });

        }).then(function () {
            if (feed_finalObj.list.length == 0)
                return null;
            else
                return feed_finalObj;
        });
    }
}


function consolidated_GoalfollowFeed_notinuse(feedList, activityType, sessionUser) {

    var feed_finalObj = {};
    feed_finalObj.feeds = [];

    if (activityType == 'GOAL_FOLLOWED') {

        feed_finalObj.type = 'GOAL_FOLLOWED';

        var users = objAllTables.users.users();
        return Promise.map(feedList, function (_feed) {

            var feed_single_obj = {};
            feed_single_obj.users_from = [];    //list of users who followed the profile
            feed_single_obj.totalUsersCount = _feed.total_count;    //total users who followed

            return users.findAll({
                where: { uid: JSON.parse('[' + _feed.follow_from + ']') },
                attributes: ['uid', 'username', 'first_name', 'middle_name', 'last_name']
            }).then(function (users_array) {

                for (var j = 0; j < users_array.length; j++) {
                    feed_single_obj.users_from.push(users_array[j].dataValues);
                }

                //data fixing
                for (var i = 0; i < feed_single_obj.users_from.length; i++) {

                    //generate name
                    var name;
                    if (!validator.isNull(feed_single_obj.users_from[i].first_name)) {
                        name = feed_single_obj.users_from[i].first_name;
                    }
                    if (!validator.isNull(feed_single_obj.users_from[i].middle_name)) {
                        name += ' ' + feed_single_obj.users_from[i].middle_name;
                    }
                    if (!validator.isNull(feed_single_obj.users_from[i].last_name)) {
                        name += ' ' + feed_single_obj.users_from[i].last_name;
                    }
                    feed_single_obj.users_from[i].name = name;

                    //generate url
                    feed_single_obj.users_from[i].link = new Array(config.webURL.domain, feed_single_obj.users_from[i].username).toURL();
                }
                return feed_single_obj;

            }).then(function () {   //user to
                return helpers.getUserMini(_feed.follow_to, sessionUser.uid)
                    .then(function (user) {
                        feed_single_obj.user_to = user;
                        return feed_single_obj;
                    });

            }).then(function () {
                return helpers.GetGoal(_feed.source_id, null, sessionUser.uid)
                    .then(function (goal) {
                        feed_single_obj.goal = goal;
                        return feed_single_obj;
                    })

            }).then(function () {
                return helpers.getPost(_feed.post_id, true, sessionUser.uid)
                    .then(function (post) {
                        feed_single_obj.post = post;
                        return feed_single_obj;
                    });

            }).then(function (feed_single_obj) {    //generate title


                var k = 0;

                if (feed_single_obj.totalUsersCount == 1) {
                    var titleData = [{ "bold": feed_single_obj.users_from[k].name }, { "regular": "followed" }, { "bold": feed_single_obj.user_to.name + "'s" }, { "regular": "goal" }, { "bold": feed_single_obj.goal.name }];

                } else if (feed_single_obj.totalUsersCount == 2) {

                    var otherCount = feed_single_obj.totalUsersCount - 1;
                    var titleData = [{ "bold": feed_single_obj.users_from[k].name }, { "regular": "and" }, { "bold": feed_single_obj.users_from[k + 1].name }, { "regular": "followed" }, { "bold": feed_single_obj.user_to.name }, { "regular": "goal" }, { "bold": feed_single_obj.goal.name }];

                } else if (feed_single_obj.totalUsersCount == 3) {

                    var otherCount = feed_single_obj.totalUsersCount - 2;
                    var titleData = [{ "bold": feed_single_obj.users_from[k].name }, { "regular": "," }, { "bold": feed_single_obj.users_from[k + 1].name }, { "regular": "and" }, { "bold": otherCount + " other" }, { "regular": "followed" }, { "bold": feed_single_obj.user_to.name }, { "regular": "goal" }, { "bold": feed_single_obj.goal.name }];

                } else if (feed_single_obj.totalUsersCount == 4) {

                    var otherCount = feed_single_obj.totalUsersCount - 3;
                    var titleData = [{ "bold": feed_single_obj.users_from[k].name }, { "regular": "," }, { "bold": feed_single_obj.users_from[k + 1].name }, { "regular": "," }, { "bold": feed_single_obj.users_from[k + 2].name }, { "regular": "and" }, { "bold": otherCount + " other" }, { "regular": "followed" }, { "bold": feed_single_obj.user_to.name }, { "regular": "goal" }, { "bold": feed_single_obj.goal.name }];

                } else if (feed_single_obj.totalUsersCount == 5) {

                    var otherCount = feed_single_obj.totalUsersCount - 3;
                    var titleData = [{ "bold": feed_single_obj.users_from[k].name }, { "regular": "," }, { "bold": feed_single_obj.users_from[k + 1].name }, { "regular": "," }, { "bold": feed_single_obj.users_from[k + 2].name }, { "regular": "and" }, { "bold": otherCount + " others" }, { "regular": "followed" }, { "bold": feed_single_obj.user_to.name }, { "regular": "goal" }, { "bold": feed_single_obj.goal.name }];

                } else {
                    var titleData = [{ "bold": feed_single_obj.users_from[k].name }, { "regular": "," }, { "bold": feed_single_obj.users_from[k + 1].name }, { "regular": "," }, { "bold": feed_single_obj.users_from[k + 2].name }, { "regular": "and" }, { "bold": otherCount + " others" }, { "regular": "followed" }, { "bold": feed_single_obj.user_to.name }, { "regular": "goal" }, { "bold": feed_single_obj.goal.name }];
                }


                feed_single_obj.title = titleGenerator(titleData);

                return feed_single_obj;
            }).then(function (feed_single_obj) {
                feed_finalObj.feeds.push(feed_single_obj);
            });

        }).then(function () {
            return feed_finalObj;
        });
    }
}

var titleGenerator = exports.titleGenerator = function titleGenerator(title) {

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
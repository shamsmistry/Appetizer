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
var Feed = require('../helpers/Feed');
var _ = require('lodash');

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
        helpers.getActiveSession(req).then(function (SessionUser) {
            if (SessionUser.type == 'Recognized') {
                var pagination = utils.pagination(req);

                //expanding network update feed, specfic feed users list
                if ((typeof req.params.startTime != 'undefined' && req.params.startTime != "") && (typeof req.params.endTime != 'undefined' && req.params.endTime != "")
                    && (typeof req.params.followTo != 'undefined' && req.params.followTo != "")) {

                    Feed.expandNetworkUpdateUsers(SessionUser.uid, req.params.startTime, req.params.endTime, req.params.activityType, req.params.followTo, pagination.offset, pagination.limit)
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
                }
                //expanding network update feed
                else if ((typeof req.params.startTime != 'undefined' && req.params.startTime != "") && (typeof req.params.endTime != 'undefined' && req.params.endTime != "")) {
                    Feed.expandNetworkUpdate(SessionUser.uid, req.params.startTime, req.params.endTime, req.params.activityType, pagination.offset, pagination.limit).then(function (result) {
                        if (result != null) {

                            result.startTime = req.params.startTime;
                            result.endTime = req.params.endTime;
                            res.send(200, { meta: { status: 200, message: 'success' }, data: result });
                            res.end();
                        }
                        else
                            res.send(200, { meta: { status: 200, message: 'success' }, data: {} });
                    });
                }
                //normal dashboard feed
                else {

                    var input = {
                        goal: {
                            basic: ['name', 'status', 'privacy', 'link'],
                            user: {
                                basic: ['name', 'username', 'email', 'link'],
                                profile: ['small', 'medium'],
                            },
                            me: ["following", "motivate", "linked", "mute"],
                            cover: ['medium', 'large', 'xlarge'],
                            stats: ['followers', 'motivations', 'contributions', 'linkers', 'views', 'achievers'],
                            tags: true,
                        },
                        user: {
                            basic: ['name', 'username', 'email', 'link'],
                            profile: ['small', 'medium'],
                        },
                        post: {
                            basic: ['text', 'status'],
                            user: {
                                basic: ['name', 'username', 'email', 'link'],
                                profile: ['small', 'medium'],
                            },
                            me: ["following", "motivate"],
                            stats: ['motivations', 'comments', 'views'],
                            location: true,
                            embeddedUrl: true,
                            comment: {
                                basic: ['text'],
                                image: true,
                                user: {
                                    basic: ['name', 'username', 'email', 'link'],
                                    profile: ['small', 'medium'],
                                },
                                limit: [0, 2],
                                order: ['asc']
                            }
                        },
                        milestone: {
                            basic: ['text', 'status']
                        }
                    };

                    Feed.dashboard(input, SessionUser.uid, pagination).then(function (data) {
                        res.send(200, { meta: { status: 200, message: "OK" }, data: data });
                    });
                }
            }
            else {
                res.send(401, { meta: { status: 401, message: 'Unauthorized' } });
            }
        })
            // .error(function (err) {
            //     res.send({ meta: { status: 500, message: 'unexpected error' }, details: err });
            // })
            // .catch(function (err) {
            //     res.send(500, { meta: { status: 500, message: 'unexpected error' }, details: err });
            // });
    }

    function error(err) {
        res.send(500, { meta: { status: 500, message: 'unexpected error' }, details: err });
    }
};

exports.getGoalFeed = function (req, res) {

    var constraints = {
        "params.id": {
            presence: true
        }
    };

    validate.async(req, constraints).then(function () {
        helpers.getActiveSession(req).then(function (SessionUser) {
            if (SessionUser.type == 'Recognized' || SessionUser.type == 'UnRecognized') {
                var pagination = utils.pagination(req);
                var input = {
                    goal: {
                        basic: ['name', 'status', 'privacy', 'link'],
                        me: ["following", "motivate", "linked", "mute"],
                        cover: ['medium', 'large', 'xlarge'],
                        user: {
                            basic: ['name', 'username', 'email', 'link'],
                            profile: ['small', 'medium'],
                        },
                    },
                    user: {
                        basic: ['name', 'username', 'email', 'link'],
                        profile: ['small', 'medium'],
                    },
                    post: {
                        basic: ['text', 'status'],
                        user: {
                            basic: ['name', 'username', 'email', 'link'],
                            profile: ['small', 'medium'],
                        },
                        me: ["following", "motivate"],
                        stats: ['motivations', 'comments', 'views'],
                        location: true,
                        embeddedUrl: true,
                        comment: {
                            basic: ['text'],
                            image: true,
                            user: {
                                basic: ['name', 'username', 'email', 'link'],
                                profile: ['small', 'medium'],
                            },
                            limit: [0, 2],
                            order: ['asc']
                        }
                    },
                    milestone: {
                        basic: ['text', 'status']
                    }
                }
                Feed.goal(input, parseInt(req.params.id), SessionUser.uid, pagination).then(function (data) {
                    res.send(200, { meta: { status: 200, message: "OK" }, data: data });
                })
            } else {
                res.send({ meta: { status: 401, message: 'Unauthorized' } });
            }
        })
            .error(function (err) {
                res.send({ meta: { status: 500, message: 'unexpected error' }, details: err });
            })
            .catch(function (err) {
                res.send(500, { meta: { status: 500, message: 'unexpected error' }, details: err });
            });
    }, function () {
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
        helpers.getActiveSession(req).then(function (SessionUser) {
            if (SessionUser.type == 'Recognized' || SessionUser.type == 'UnRecognized') {
                var pagination = utils.pagination(req);
                var input = {
                    goal: {
                        basic: ['name', 'status', 'privacy', 'link']
                    },
                    user: {
                        basic: ['name', 'username', 'email', 'link'],
                        profile: ['small', 'medium'],
                    },
                    post: {
                        basic: ['text', 'status'],
                        user: {
                            basic: ['name', 'username', 'email', 'link'],
                            profile: ['small', 'medium'],
                        },
                        me: ["following", "motivate"],
                        stats: ['motivations', 'comments', 'views'],
                        location: true,
                        embeddedUrl: true,
                        comment: {
                            basic: ['text'],
                            image: true,
                            user: {
                                basic: ['name', 'username', 'email', 'link'],
                                profile: ['small', 'medium'],
                            },
                            limit: [0, 2],
                            order: ['asc']
                        }
                    },
                    milestone: {
                        basic: ['text', 'status']
                    }
                }
                Feed.goalContributions(input, parseInt(req.params.id), SessionUser.uid, pagination).then(function (data) {
                    res.send(200, { meta: { status: 200, message: "OK" }, data: data });
                })
            } else {
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

exports.getUserActivities = function (req, res) {

    var constraints = {
        "params.username": {
            presence: true
        }
    };

    validate.async(req, constraints).then(success, error);

    function success() {
        helpers.getActiveSession(req).then(function (SessionUser) {
            if (SessionUser.type == 'Recognized' || SessionUser.type == 'UnRecognized') {

                var feedType = _.compact([req.query.type]);
                var pagination = utils.pagination(req);
                new Promise(function (resolve, reject) {
                    return new User(req.params.username, SessionUser.uid).get({ basic: ['uid'] })
                        .then(function (user) {
                            resolve(user[0]);
                        })
                }).then(function (user) {
                    if ((_.indexOf(feedType, 'mini')) > -1) {
                        var titleOnly = true;
                        var input = {
                            goal: {
                                basic: ['name', 'status', 'privacy', 'link']
                            },
                            user: {
                                basic: ['name', 'username', 'email', 'link']
                            },
                            post: {
                                basic: ['text', 'status'],
                                embeddedUrl: true
                            }
                        }
                    } else {
                        var titleOnly = false;
                        var input = {
                            goal: {
                                basic: ['name', 'status', 'privacy', 'link'],
                                user: {
                                    basic: ['name', 'username', 'email', 'link'],
                                    profile: ['small', 'medium'],
                                },
                                me: ["following", "motivate", "linked", "mute"],
                                cover: ['medium', 'large', 'xlarge'],
                                stats: ['followers', 'motivations', 'contributions', 'linkers', 'views', 'achievers'],
                                tags: true
                            },
                            user: {
                                basic: ['name', 'username', 'email', 'link'],
                                profile: ['small', 'medium'],
                                me: ['follower', 'following', 'mutual', 'mute'],
                                stats: {
                                    connections: ['followers', 'followings'],
                                    goals: ['total', 'linked', 'following']
                                }
                            },
                            post: {
                                basic: ['text', 'status'],
                                user: {
                                    basic: ['name', 'username', 'email', 'link'],
                                    profile: ['small', 'medium'],
                                },
                                me: ["following", "motivate"],
                                stats: ['motivations', 'comments', 'views'],
                                location: true,
                                embeddedUrl: true,
                                comment: {
                                    basic: ['text'],
                                    image: true,
                                    user: {
                                        basic: ['name', 'username', 'email', 'link'],
                                        profile: ['small', 'medium'],
                                    },
                                    limit: [0, 2],
                                    order: ['asc']
                                }
                            },
                            milestone: {
                                basic: ['text', 'status']
                            }
                        }
                    };

                    Feed.profileActivities(input, req.query.filter, user.uid, titleOnly, SessionUser.uid, pagination).then(function (data) {
                        res.send(200, { meta: { status: 200, message: "success" }, data: data });
                    })
                })
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
        helpers.getActiveSession(req).then(function (SessionUser) {
            if (SessionUser.type == 'Recognized' || SessionUser.type == 'UnRecognized') {

                var pagination = utils.pagination(req);

                var input = {
                    goal: {
                        basic: ['name', 'status', 'privacy', 'link'],
                        user: {
                            basic: ['name', 'username', 'email', 'link'],
                            profile: ['small', 'medium'],
                        },
                        me: ["following", "motivate", "linked", "mute"],
                        cover: ['medium', 'large', 'xlarge'],
                        stats: ['followers', 'motivations', 'contributions', 'linkers', 'views', 'achievers'],
                        tags: true,
                    },
                    user: {
                        basic: ['name', 'username', 'email', 'link'],
                        profile: ['small', 'medium'],
                    },
                    post: {
                        basic: ['text', 'status'],
                        user: {
                            basic: ['name', 'username', 'email', 'link'],
                            profile: ['small', 'medium'],
                        },
                        me: ["following", "motivate"],
                        stats: ['motivations', 'comments', 'views'],
                        location: true,
                        embeddedUrl: true,
                        comment: {
                            basic: ['text'],
                            image: true,
                            user: {
                                basic: ['name', 'username', 'email', 'link'],
                                profile: ['small', 'medium'],
                            },
                            limit: [0, 2],
                            order: ['asc']
                        }
                    },
                    milestone: {
                        basic: ['text', 'status']
                    }
                }
                Feed.linkedGoal(input, parseInt(req.params.id), SessionUser.uid, pagination).then(function (data) {
                    res.send(200, { meta: { status: 200, message: "success" }, data: data });
                })

            } else {
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

/* OLD Function and not in use */

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
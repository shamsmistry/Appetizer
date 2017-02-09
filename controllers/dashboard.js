//#############################################################
//######################### Import  ###########################
//#############################################################

//import modules
var Promise = require("bluebird");
var validator = require('validator');
var validate = require("validate.js");

//classes
var clasAllTables = require('../models/alltables');
var helpers = require('../helpers/helpers');
var db = require('../helpers/db');
var config = require('../config');
var utils = require('../helpers/Utils');
var Goal = require('../models/Goal');
var User = require('../models/User');

var _ = require('lodash');

//instances
var objAllTables = clasAllTables.allTables;
var sequelize = db.sequelizeConn();

//#############################################################
//########################## APIs  ############################
//#############################################################

exports.linkedGoals = function(req, res) {

    var goalInput = {
        basic: ['name', 'status', 'privacy', 'link'],
        user: {
            basic: ['name', 'username', 'email', 'link'],
            profile: ['small', 'medium']
        },
        me: ["following", "motivate", "linked", "mute"],
        cover: ['medium', 'large', 'xlarge'],
        stats: ['followers', 'motivations', 'contributions', 'linkers', 'views', 'achievers'],
        tags: true,
        location: true
    };

    // ######################### Validations (Rules) #########################
    var constraints = {
        "params.username": {
            presence: true
        }
    };

    // ######################### Validations (Attributes) #########################

    validate.async(req, constraints).then(success, error);

    function success() {
        helpers.getActiveSession(req).then(function(SessionUser) {
            if (SessionUser.type == 'Recognized') {
                new Promise(function (resolve, reject) {
                    return new User(req.params.userName, SessionUser.uid).get({basic:['uid']})
                    .then(function(user){
                        resolve(user[0]);
                    })
                }).then(function(user) {

                    var query = "SELECT from_goal_id AS goal_id FROM goal_linked gl WHERE gl.uid = {0} and status='ACTIVE'".format(user.uid);
                    sequelize.query(query, { type: sequelize.QueryTypes.SELECT }).then(function(goals) {

                        var goal_ids = _.uniq(_.map(IDs, _.iteratee('goal_id')));
                        Goal.getList(goalInput, goal_ids , SessionUser.uid ).then(function(data){
                            res.send({ meta: { status: 200, message: 'success' }, data: { goals: data } })
                        })

                    })
                    .error(function(err) {
                        return { meta: { status: 401, message: err } };
                    })
                })
            } else {
                return { meta: { status: 4001, message: "Unauthorized" } };
            }
        })
        .error(function(err) {
            res.send({ meta: { status: 500, message: 'unexpected error' } });
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
}

exports.achievedLinkedGoals = function(req, res) {

    //######################### Validations (Rules) #########################
    var constraints = {
        "params.id": {
            presence: true,
            numericality: {
                noStrings: false
            }
        }
    };

    //######################### Validations (Attributes) #########################


    validate.async(req, constraints).then(success, error);

    function success() {
        helpers.getActiveSession(req).then(function(SessionUser) {
            if (SessionUser.type == 'Recognized' || SessionUser.type == 'UnRecognized') {
                var id = parseInt(req.params.id);

                var query = "SELECT gl.from_goal_id AS goal_id FROM goals g\
                            JOIN goal_linked gl ON g.goal_id = gl.to_goal_id\
                            WHERE gl.to_goal_id = {0}\
                            AND gl. STATUS = 'ACTIVE'\
                            AND (SELECT status FROM goals WHERE goal_id = gl.from_goal_id) = 'COMPLETED'\
                            ORDER BY g.updated AND g.created".format(req.params.id);
                sequelize.query(query, { type: sequelize.QueryTypes.SELECT })
                .then(function (goals) {
                    var goal_ids = _.uniq(_.map(goals, _.iteratee('goal_id')));
                    Goal.getList(goalInput, goal_ids , SessionUser.uid ).then(function(data){
                        res.send({ meta: { status: 200, message: 'success' }, data: { goals: data } })
                    })
                }).error(function(err) {
                    return { meta: { status: 405, message: 'Bad Request' } };
                });

            } else {
                return { meta: { status: 401, message: 'Unauthorized' } };
            }
        })
        .error(function(err) {
            res.send({ meta: { status: 500, message: 'unexpected error' } });
        });
        
    }

    function error(errors) {
        if (errors instanceof Error) {
            res.send({ meta: { status: 401, message: 'An error ocuured in validator' }, errors: errors });
        } else {
            res.send({ meta: { status: 401, message: 'validation errors' }, errors: errors });
        }
    }

};

exports.suggestUsers = function(req, res) {

    /**
     * Suggest Users
     * By Mutual Tags, FOF and by similar name profiles
     */

    helpers.getActiveSession(req).then(function(SessionUser) {
        if (SessionUser.type == 'Recognized') {
            var query;

            var keyword = req.query.by || "tag";
            var pagination = utils.pagination(req);

            var usersList = {}


            query = "SELECT * from (SELECT user_interest_tags.uid, count(*) as matches from user_interest_tags\
                        INNER JOIN (SELECT * FROM user_interest_tags where uid = {0} and status = 'ACTIVE') myinterest\
                        ON user_interest_tags.tag_id = myinterest.tag_id \
                        WHERE user_interest_tags.uid <> {0} and user_interest_tags.`status` = 'ACTIVE' GROUP BY user_interest_tags.uid ORDER BY matches DESC) as interestuser\
                        WHERE uid NOT IN (select follows_uid from user_followers where uid = {0} and status = 'ACTIVE' ) limit {1},{2} ".format(SessionUser.uid, pagination.offset, pagination.limit)


            if (keyword == "onboarding") {

                query = "SELECT DISTINCT uid, matches from ( SELECT uid,10000 AS matches FROM users_promoted where uid <> {0} AND is_suggested = 1 AND status ='ACTIVE' UNION  SELECT user_interest_tags.uid, count(*) as matches from user_interest_tags\
                            INNER JOIN (SELECT * FROM user_interest_tags where uid = {0} and status = 'ACTIVE') myinterest\
                            ON user_interest_tags.tag_id = myinterest.tag_id \
                            WHERE user_interest_tags.uid <> {0} and user_interest_tags.`status` = 'ACTIVE' GROUP BY user_interest_tags.uid ORDER BY matches DESC, uid ASC) as interestuser\
                            WHERE uid NOT IN (select follows_uid from user_followers where uid = {0} and status = 'ACTIVE' ) limit {1},{2} ".format(SessionUser.uid, pagination.offset, pagination.limit)

            }

            if (keyword == 'fof') {

                query = "SELECT count(*) AS matches, f2.follows_uid AS uid FROM user_followers f1\
                            INNER JOIN user_followers f2 ON f1.follows_uid = f2.uid\
                            WHERE f1.uid = {0} AND f1. STATUS = 'ACTIVE'\
                            AND f2.follows_uid NOT IN (SELECT follows_uid FROM user_followers WHERE uid = {0} AND STATUS = 'ACTIVE')\
                            AND f2.follows_uid <> {0}\
                            AND f2.follows_uid NOT IN (SELECT ignored_uid FROM suggested_users_ignored WHERE uid = {0})\
                            GROUP BY f2.follows_uid ORDER BY matches DESC LIMIT {1},{2}".format(SessionUser.uid, pagination.offset, pagination.limit)
            }

            if (keyword == 'profile') {
                query = " SELECT *, 0 AS matches FROM users WHERE MATCH (first_name,last_name) AGAINST ('{1}') AND uid <> {0} AND users.account_verified = 1 ORDER BY RAND() LIMIT {2},{3}".format(SessionUser.uid, SessionUser.first_name, pagination.offset, pagination.limit)

            }

            sequelize.query(query, { type: sequelize.QueryTypes.SELECT }).then(function(users) {
                var uids = _.uniq(_.map(users, _.iteratee('uid')));
                var input = {
                    basic: ['name', 'username', 'email', 'link', 'created'],
                    profile: ['small', 'medium'],
                    me: ['follower', 'following', 'mutual', 'mute'],
                    location: true,
                };
                User.getList(input, uids , SessionUser.uid ).then(function(_users){
                    _.forEach(_users, function (value, key) {
                        _.forEach(users, function (v, k) {
                            if (value.uid == v.uid) {
                                value.matches = v.matches;
                            }
                        });
                        
                    });
                    res.send(200, { meta: { status: 200, message: 'success' }, data: _users });
                })
            })
        } else {
            res.send(401, { meta: { status: 401, message: 'User is not logged in invalid token' } });
        }
    })
    .error(function(err) {
        res.send(500, { meta: { status: 500, message: 'unexpected error' } });
    });
};

exports.ignore_suggested_user = function(req, res) {
    helpers.getActiveSession(req).then(function(SessionUser) {
        if (SessionUser.type == 'Recognized') {
            var ignored_uid = req.body.uid;
            var SuggestedUsersIgnored = objAllTables.suggested_users_ignored.suggested_users_ignored();
            return SuggestedUsersIgnored.findOrCreate({
                where: { uid: SessionUser.uid, ignored_uid: ignored_uid },
                defaults: { created: helpers.getUnixTimeStamp() }
            }).then(function(result) {
                res.send(200, { meta: { status: 200, message: 'OK' } });
            })
        } else {
            res.send(401, { meta: { status: 401, message: 'Unauthorized' } });
        }
    })
    .error(function(err) {
        res.send(500, { meta: { status: 500, message: 'unexpected error' } });
    });
}

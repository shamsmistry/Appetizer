//import modules
var clasAllTables = require('../models/alltables');
var Promise = require("bluebird");
var helpers = require('../helpers/helpers');
var db = require('../helpers/db');
var validator = require('validator');
var valid = require('../helpers/valid');
var chalk = require('chalk');
var sequelize = db.sequelizeConn();
var _ = require('lodash');

var validate = require("validate.js");
var arrayUniq = require('array-uniq');

//instances
var objAllTables = clasAllTables.allTables;
var utils = require('../helpers/Utils');
var config = require('../config');
var Goal = require('../models/Goal');
var User = require('../models/User');


//APIs

/**
 * @api {get} /settings/privacy Request Privacy scope list
 * @apiName GetPrivacySettings
 *
 * @apiSuccessExample Success-Response:
 *     HTTP/1.1 200 OK
 *     {
 *          "meta": {
 *              "status": 200,
 *              "message": "OK"
 *          },
 *          "data": [{
 *              "_id": 1,
 *              "scope": "Public",
 *              "description": "Visible by anyone and anywhere",
 *              "status": "ACTIVE",
 *              "gen_by": "SYSTEM",
 *              "created": null
 *          }, {
 *              "_id": 2,
 *              "scope": "Only Followers",
 *              "description": "Those profiles that follow you",
 *              "status": "ACTIVE",
 *              "gen_by": "SYSTEM",
 *              "created": null
 *          }, {
 *              "_id": 3,
 *              "scope": "Follows Me Back",
 *              "description": "Those profiles that follow you back",
 *              "status": "ACTIVE",
 *              "gen_by": "SYSTEM",
 *              "created": null
 *          }]
 *      }
 *
 * @apiError AccessTokenError Invalid Access Token Provided.
 *
 * @apiErrorExample Unauthorized-Response:
 *     HTTP/1.1 401 Unauthorized
 *     {
 *       "meta": {
 *           status: 401,
 *           message: "Invalid Access Token"
 *       }
 *     }
 *     
 * @apiErrorExample Error-Response:
 *     HTTP/1.1 500 Internal Server Error
 *     {
 *       "meta": {
 *           status: 500,
 *           message: "Internal Server Error"
 *       }
 *     }
 */
exports.getGoalPrivacyScopeList = function (req, res) {
    var PrivacyTable = objAllTables.privacy_scope.privacy_scope();

    PrivacyTable.findAll({
        where: { status: 'ACTIVE' }
    })
        .then(function (goal_privacy_scope) {
            res.send(200, { meta: { status: 200, message: 'OK' }, data: goal_privacy_scope });
        });
};

//Get
exports.getGoalPrivacyScopeList_old = function (req, res) {

    /*
     if Session is active,
     then send response
     else through 401 error
     */
    helpers.GetActiveSession_ORM(req)
        .then(function (SessionUser) {
            if (SessionUser != null) {

                var PrivacyTable = objAllTables.privacy_scope.privacy_scope();

                PrivacyTable.findAll()
                    .then(function (goal_privacy_scope) {
                        res.send({ meta: { status: 200, message: 'success' }, data: goal_privacy_scope });
                    });
            }
            else {
                res.send({ meta: { status: 401, message: 'User is not logged in invalid token' } });
            }
        })
        .error(function (err) {
            res.send({ meta: { status: 500, message: 'unexpected error' } });
        });
};

exports.getGoal = function (req, res) {

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

        return helpers.getActiveSession(req)
            .then(function (sessionUser) {

                if (sessionUser.type == 'Recognized' || sessionUser.type == 'UnRecognized') {

                    //check goal Privacy, if session user access to this GOAL
                    return utils.checkGoalPrivacy(sessionUser.uid, parseInt(req.params.id))
                        .then(function (response) {
                            //accessible
                            if (response == 1) {
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
                                Goals = new Goal(parseInt(req.params.id), sessionUser.uid);
                                Goals.get(goalInput).then(function (goal) {
                                    res.send(200, { meta: { status: 200, message: 'success' }, data: { goal: goal } });
                                    utils.viewsCount(sessionUser.uid, req.params.id, "GOAL", req);
                                    helpers.increment_update_GoalStats(parseInt(req.params.id), 'views');
                                })
                                // .error(function (err) {
                                //     res.send(500, { meta: { status: 500, message: 'error - unexpected error (getting goal or saving view count)' }, details: err });
                                // })
                                // .catch(function (err) {
                                //     res.send(500, { meta: { status: 500, message: 'catch - unexpected error (getting goal or saving view count)' }, details: err });
                                // });
                            }
                            //no access
                            else if (response == 0) {
                                res.send(401, { meta: { status: 401, message: 'error' }, message: 'goal is private' });
                            }
                            //doesn't exist
                            else if (response == 404) {
                                res.send(404, { meta: { status: 404, message: 'error' }, message: 'goal not found' });
                            }
                            //unexpected response
                            else {
                                res.send(500, { meta: { status: 500, message: 'unexpted response from CheckPrivacy_User() database function' } });
                            }
                        });
                }
                else
                    res.send(401, { meta: { status: 401, message: 'user is not logged in invalid token' } });
            })
            .error(function (err) {
                res.send(500, { meta: { status: 500, message: 'unexpected error (authentication error)' }, details: err });
            })
            .catch(function (err) {
                res.send(500, { meta: { status: 500, message: 'unexpected error (authentication error)' }, details: err });
            });
    }
    function error(errors) {
        if (errors instanceof Error) {
            // This means an exception was thrown from a validator
            res.send(401, { meta: { status: 401, message: 'An error ocuured in validator' }, errors: errors });
        } else {
            res.send(401, { meta: { status: 401, message: 'validation errors' }, errors: errors });
        }
    }
};

exports.getAllGoalByUser = function (req, res) {

    //######################### Validations (Rules) #########################
    var constraints = {
        "params.userName": {
            presence: true
        }
    };

    validate.async(req, constraints).then(success, error);

    function success() {

        helpers.getActiveSession(req)
            .then(function (SessionUser) {
                if (SessionUser.type == 'Recognized' || SessionUser.type == 'UnRecognized') {
                    var pagination = utils.pagination(req);

                    new Promise(function (resolve, reject) {
                        return new User(req.params.userName, SessionUser.uid).get({ basic: ['uid'] })
                            .then(function (user) {
                                resolve(user[0]);
                            })
                    }).then(function (user) {
                        // GetGoals                    
                        helpers.getAllGoalsbyUserId(user.uid, 'NewestToOldest', SessionUser.uid, 'DEFAULT', pagination.offset, pagination.limit)
                            .then(function (goals) {
                                res.send(200, { meta: { status: 200, message: 'success' }, data: { goals: goals } });
                            });
                    });
                }
                else {
                    res.send(401, { meta: { status: 401, message: 'invalid token' } });
                }
            })
            .error(function (err) {
                res.send(500, { meta: { status: 500, message: 'unexpected error' } });
            })
            .catch(function (err) {
                res.send(500, { meta: { status: 500, message: 'unexpected error' } });
            });
    }

    function error(errors) {
        if (errors instanceof Error) {
            // This means an exception was thrown from a validator
            res.send(401, { meta: { status: 401, message: 'validation errors' }, errors: errors });
        }
        else {
            res.send(401, { meta: { status: 401, message: 'validation errors' }, errors: errors });
        }
    }
};

exports.getMyGoals = function (req, res) {

    var sorting = req.query.sorting || 'NewestToOldest';
    helpers.getActiveSession(req)
        .then(function (SessionUser) {
            if (SessionUser.type == 'Recognized') {

                var pagination = utils.pagination(req);
                //list type
                var type;
                if (req.query.type != null && req.query.type == 'LIST') {
                    type = 'LIST';
                }
                else {
                    type = 'DEFAULT';
                }

                //######################### Validations (end) #########################

                helpers.getAllGoalsbyUserId(SessionUser.uid, sorting, SessionUser.uid, type, pagination.offset, pagination.limit)
                    .then(function (goals) {

                        if (type == 'LIST')
                            return goals;
                        else
                            return new Promise(function (resolve, reject) {

                                // loop through the goal ids and get goal objects
                                var promiseFor = Promise.method(function (condition, action, value) {
                                    if (!condition(value)) return value;
                                    return action(value).then(promiseFor.bind(null, condition, action));
                                });

                                promiseFor(function (count) {
                                    return count < goals.length;
                                }, function (count) {
                                    //######################### loop body (start) #########################

                                    var milestone = objAllTables.milestone.milestone();
                                    return milestone.findAll({
                                        where: {
                                            goal_id: goals[count].id,
                                            status: { $ne: 'DELETED' }
                                        }
                                    }).then(function (milestones) {
                                        if (milestones != null) {
                                            goals[count].milestones = milestones;
                                        }

                                        return ++count;
                                    });

                                    //######################### loop body (end) #########################
                                }, 0).then(function () {
                                    resolve(goals);
                                });
                            });
                    }).then(function (goals) {
                        res.send(200, { meta: { status: 200, message: 'Success' }, data: goals });
                    });
            } else {
                res.send({ meta: { status: 401, message: 'User is not logged in or invalid token' } });
            }
        })
        .error(function (err) {
            res.send({ meta: { status: 500, message: 'linkagoal server internal error' }, details: err });
        });
};

exports.getMyGoalsByOtherGoalId = function (req, res) {

    var constraints = {
        "params.gid": {
            presence: true,
            numericality: {
                noStrings: false
            }
        }
    };

    //######################### Validations (Attributes) #########################

    validate.async(req, constraints).then(success, error);

    function success() {
        var to_goal = parseInt(req.params.gid);

        helpers.GetActiveSession_ORM(req)
            .then(function (SessionUser) {

                if (SessionUser != null) {

                    var queryKeyword = req.query.q || '';
                    queryKeyword = queryKeyword.trimSpace().makeSQLInjectionSafe();

                    var pagination = utils.pagination(req);
                    var Goals = objAllTables.goals.goals();
                    var query = { uid: SessionUser.uid, status: { $in: ['ACTIVE', 'COMPLETED'] } };

                    //if search is available, add it into WHERE clause
                    if (queryKeyword != '') {
                        query.goal_name = { like: '' + queryKeyword + '%' };
                    }

                    return Goals.findAll({
                        offset: pagination.offset, limit: pagination.limit,
                        where: query,
                        attributes: [['goal_id', 'id'], ['goal_name', 'name'],
                            [
                                sequelize.literal("(SELECT COUNT(*) FROM goal_linked WHERE goal_linked.from_goal_id = goals.goal_id AND goal_linked.to_goal_id = {0} AND goal_linked.`status` = 'ACTIVE')".format(to_goal)),
                                'isLinked'
                            ]
                        ],
                        order: 'isLinked DESC'
                    }).then(function (data) {
                        res.send(200, { meta: { status: 200, message: 'success' }, data: data });
                    });
                }
                else {
                    res.send(401, { meta: { status: 401, message: 'invalid token' } });
                }
            }).error(function (err) {
                res.send(500, { meta: { status: 500, message: 'unexpected error' } });
            });
    }

    function error(errors) {
        if (errors instanceof Error) {
            // This means an exception was thrown from a validator
            res.send(401, { meta: { status: 401, message: 'An error ocuured in validator' }, errors: errors });
        } else {
            res.send(401, { meta: { status: 401, message: 'validation errors' }, errors: errors });
        }
    }

};

exports.getLinkedAchieved = function (req, res) {

    if (validator.isNull(req.params.id)) {
        res.send({ meta: { status: 401, message: 'goal id can not be null' } });
    } else if (validator.isInt(req.params.id)) {

        helpers.GetActiveSession_ORM(req)
            .then(function (SessionUser) {
                if (SessionUser != null) {
                    //res.send(req.params.id);
                    var db = require('../helpers/db');
                    var sequelize = db.sequelizeConn();

                    var query = "select goal_id from goals g where (g.goal_id in(SELECT from_goal_id FROM `goal_linked` where to_goal_id = {0}) and g.`status`='COMPLETED')".format(req.params.id);
                    sequelize.query(query, { type: sequelize.QueryTypes.SELECT })
                        .then(function (ids) {
                            //res.send({data: ids});
                            var Ids = [];
                            for (var i = 0; i < ids.length; i++)
                                Ids.push(ids[i].goal_id);

                            new Promise(function (resolve, reject) {
                                helpers.getGoalList(Ids, SessionUser.uid, true).then(function (result) {
                                    resolve(result);
                                });
                            })
                                .then(function (goals) {
                                    res.send({ meta: { status: 200, message: 'success' }, data: { goals: goals } });
                                });


                        });

                }
                else
                    res.send({ meta: { status: 401, message: 'user is not logged in invalid token' } });
            })
            .error(function (err) {
                res.send({ meta: { status: 500, message: 'internal error' } });
            });
    } else {
        res.send({ meta: { status: 401, message: 'goal id must be an interger' } });
    }
};

//Goal
exports.create_old = function (req, res) {

    helpers.GetActiveSession_ORM(req)
        .then(function (SessionUser) {
            if (SessionUser != null) {
                if (SessionUser.permissions.Goal.create == 1) {
                    var errors = [];
                    var tableUserFileUploads = objAllTables.user_file_uploads.user_file_uploads();
                    var goal_start_date;
                    var goal_end_date;
                    var specifUsers = [];

                    //######################### Validations (start) #########################
                    if (validator.isNull(SessionUser.uid)) {
                        errors.push(helpers.generateErrorObject(1001, 'uid', 'uid is null'));
                    }
                    //if "scope_id" is null, error
                    //if its not null, check if its integer
                    //if its integer, check if its in range
                    if (typeof req.body.scope_id == 'undefined') {
                        errors.push(helpers.generateErrorObject(1001, 'scope_id', 'privacy scope id undefined'));
                    }
                    else if (validator.isNull(req.body.scope_id)) {
                        errors.push(helpers.generateErrorObject(1001, 'scope_id', 'privacy scope id not provided'));
                    }
                    else if (!validator.isNumeric(req.body.scope_id)) {
                        errors.push(helpers.generateErrorObject(1001, 'scope_id', 'privacy scope id is not int'));
                    }
                    else if (+req.body.scope_id > 5 || +req.body.scope_id < 1) {  //because "privacy_scope" table has 5 values
                        errors.push(helpers.generateErrorObject(1001, 'scope_id', 'invalid privacy scope id (not in range of 1 - 5)'));
                    }
                    else if (+req.body.scope_id == 4 && Array.isArray(req.body.users) == false) {
                        errors.push(helpers.generateErrorObject(1001, 'scope_id', 'specific user must be an array'));
                    }

                    else if (+req.body.scope_id == 4 && req.body.users.length == 0) {
                        errors.push(helpers.generateErrorObject(1001, 'scope_id', 'specific user array must be greater than 0'));
                    }
                    //if start or end dates exist, check if they are in 'ISO8601'
                    //else respond with error
                    //if they do not exist, set "start date" as today and "end date" as null
                    if (typeof req.body.g_start_date == 'undefined') {
                        goal_start_date = new Date().toISOString();
                    }
                    else if (validator.isNull(req.body.g_start_date)) {
                        goal_start_date = new Date().toISOString();
                    }
                    else if (!validator.isISO8601(req.body.g_start_date)) {
                        errors.push(helpers.generateErrorObject(1001, 'g_start_date', 'goal start date is not a valid date format ISO8601 (yyyy-mm-dd)'));
                    }
                    else {
                        goal_start_date = req.body.g_start_date;
                    }
                    //end date
                    if (typeof req.body.g_end_date == 'undefined') {
                        goal_end_date = null;
                    }
                    else if (validator.isNull(req.body.g_end_date)) {
                        goal_end_date = null;
                    }
                    else if (!validator.isISO8601(req.body.g_end_date)) {
                        errors.push(helpers.generateErrorObject(1001, 'g_end_date', 'goal end date is not a valid date format ISO8601 (yyyy-mm-dd)'));
                    }
                    else if (req.body.g_end_date < req.body.g_start_date) {
                        errors.push(helpers.generateErrorObject(1001, 'g_end_date', 'goal end date cannot be less than goal started date'));
                    }
                    else {
                        goal_end_date = req.body.g_end_date;
                    }
                    //category_id
                    if (typeof req.body.category_id == 'undefined') {
                        errors.push(helpers.generateErrorObject(1001, 'category_id', 'category id is undefined'));
                    }
                    else if (validator.isNull(req.body.category_id)) {
                        errors.push(helpers.generateErrorObject(1001, 'category_id', 'category id not provided'));
                    }
                    else if (!validator.isNumeric(req.body.category_id)) {
                        errors.push(helpers.generateErrorObject(1001, 'category_id', 'invalid category id'));
                    }
                    //description
                    // if (typeof req.body.goal_description == 'undefined') {
                    //     errors.push(helpers.generateErrorObject(1001, 'goal_description', 'goal description minimum limit is 1, and maximum limit is 140'));
                    // }
                    // else if (validator.isNull(req.body.goal_description.toString().trim())) {
                    //     errors.push(helpers.generateErrorObject(1001, 'goal_description', 'goal description minimum limit is 1, and maximum limit is 140'));
                    // }
                    // else if (req.body.goal_name.toString().trim().length == 0 || req.body.goal_name.toString().trim().length > 140) {
                    //     errors.push(helpers.generateErrorObject(1001, 'goal_description', 'goal description minimum limit is 1, and maximum limit is 140'));
                    // }
                    //name
                    if (typeof req.body.goal_name == 'undefined') {
                        errors.push(helpers.generateErrorObject(1001, 'goal_name', 'goal name minimum limit is 1, and maximum limit is 90'));
                    }
                    else if (validator.isNull(req.body.goal_name.toString().trim())) {
                        errors.push(helpers.generateErrorObject(1001, 'goal_name', 'goal name minimum limit is 1, and maximum limit is 90'));
                    }
                    else if (req.body.goal_name.toString().trim().length == 0 || req.body.goal_name.toString().trim().length > 90) {
                        errors.push(helpers.generateErrorObject(1001, 'goal_name', 'goal name minimum limit is 1, and maximum limit is 90'));
                    }
                    //user defined location
                    if (typeof req.body.userDefinedLocation == 'undefined') {
                        req.body.userDefinedLocation = null;
                    }
                    //######################### Validations (end) #########################

                    //######################### Create Goal (start) #########################
                    //if no errors found, proceed and create goal
                    if (errors.length == 0) {

                        //getting location id
                        helpers.insertLocation(req).then(function (locationId) {

                            var Goals = objAllTables.goals.goals();

                            //if media is attach
                            var fileId = null;
                            if (!validator.isNull(req.body.attach_id))
                                fileId = req.body.attach_id;
                            //console.log('####################### before promise');
                            return new Promise(function (resolve) {
                                //console.log('####################### location obj', req.body.userDefinedLocation);
                                //insert if location available
                                if (req.body.userDefinedLocation != null) {
                                    //console.log('####################### location is not null');
                                    return helpers.insertUserLocation(req)
                                        .then(function (userDefinedLocation) {
                                            //return userDefinedLocation.id;
                                            resolve(userDefinedLocation.id);
                                        });
                                }
                                else
                                    resolve(null);
                            })
                                .then(function (userDefinedLocation) {
                                    console.log('####################### creating goal');

                                    return Goals.create({
                                        uid: SessionUser.uid,
                                        goal_name: req.body.goal_name,
                                        goal_description: req.body.goal_description || null,
                                        g_start_date: goal_start_date,
                                        g_end_date: goal_end_date,
                                        goal_type: 'BASIC',
                                        goal_image_id: null,
                                        //default_goal_image_id: defaultImageId,
                                        category_id: req.body.category_id,
                                        scope_id: req.body.scope_id,
                                        status: 'ACTIVE',
                                        flag: 0,
                                        created: helpers.getUnixTimeStamp(),
                                        location_id: locationId,
                                        user_location: userDefinedLocation
                                    })
                                        //check if goal created successfully
                                        .then(function (createdGoal) {
                                            //if goal created successfully
                                            if (createdGoal == null)
                                                new Error('could not create goal');

                                            return createdGoal;
                                        });
                                })
                                //if goal has user defined image, verify it
                                .then(function (createdGoal) {
                                    if (fileId != null) {
                                        //if goal has user defined image, verify it
                                        var dataArray = {
                                            'fileId': fileId,
                                            'uId': SessionUser.uid,
                                            'goalId': createdGoal['dataValues'].goal_id,
                                            'reqFrom': 'GOAL'
                                        };

                                        console.log('####################### calling utility server');

                                        return utils.requestServer(process.env.FILE_SERVER_PRIVATE_IP, process.env.FILE_SERVER_PORT, '/verify/media-id', 'POST', dataArray, '1.0.0')
                                            .then(function (result) {
                                                console.log('####################### got response from file server');
                                                console.log('####################### then result', result);
                                                if (result) {
                                                    return createdGoal;
                                                } else {
                                                    new Error('goal image verification failed');
                                                }
                                            });
                                    }
                                    else {
                                        return createdGoal;
                                    }
                                })
                                //insert privacy
                                .then(function (createdGoal) {
                                    if (createdGoal.dataValues.scope_id == 4) {


                                        return utils.insertSpecificUserPrivacy(createdGoal.dataValues.goal_id, req.body.users, SessionUser.uid, 'GOAL')
                                            .then(function (result) {
                                                if (result) {
                                                    return createdGoal;
                                                }
                                                else {
                                                    new Error('Cannot Insert User Specific Goal');
                                                }
                                            });
                                    }
                                    else {
                                        return createdGoal;
                                    }
                                })
                                //create post, record activity, generate feed
                                .then(function (createdGoal) {
                                    //get created goal
                                    var data = {};
                                    var goal_id = createdGoal['dataValues'].goal_id;

                                    //######################### Extracting Tags (start) #########################
                                    //var extracting = extractingTags(req.body.tags,goal_id);
                                    extractingTags(req.body.tags, goal_id).then(function () {
                                        return;
                                    }).then(function () {

                                        //######################### Extracting Tags (end) #########################
                                        helpers.GetGoal(goal_id, null, SessionUser['uid'])
                                            .then(function (goal) {

                                                data['goal'] = goal;
                                                //######################### Create Post (start) #########################
                                                var posts = require('../controllers/posts');
                                                //uid, text, media_id, fetched_url_id, scope_id, post_type, parent_id, req
                                                return posts.createPost(SessionUser.uid, '', null, null, 1, 'GOAL_CREATED', data.goal.id, req)
                                                    .then(function (postObj) {
                                                        data.feed_type = 'GOAL_CREATED';
                                                        data.post = postObj.post;

                                                        //get proper object
                                                        return helpers.getPost(data.post.id, true, SessionUser.uid)
                                                            .then(function (post) {
                                                                data.post = post;
                                                                res.send({
                                                                    meta: { status: 200, message: 'Success' },
                                                                    data: data
                                                                });
                                                                return data;
                                                            });
                                                    })
                                                    .error(function (err) {
                                                        res.send({
                                                            meta: {
                                                                status: 401,
                                                                message: 'An error occurred while creating a Post for the progress.'
                                                            }, details: err
                                                        });
                                                    });
                                                //######################### Create Post (end) #########################
                                            })
                                            //######################### Record Activity (start) #########################
                                            .then(function (data) {
                                                //record activity and generate feed
                                                var feedController = require('../controllers/feed');

                                                //uid, activity_type, source_id, parent_id, parent_type, post_id)
                                                feedController.createActivity(SessionUser.uid, 'GOAL_CREATED', data.goal.id, null, null, data.post.id, true, true);
                                            });
                                        //######################### Record Activity (end) #########################
                                    });


                                }).error(function () {
                                    res.send({
                                        meta: {
                                            status: 401,
                                            message: 'An error occurred while creating a goal.'
                                        }
                                    });
                                });
                            /*.catch(function (err) {
                             res.send({
                             meta: {
                             status: 401,
                             message: 'Caught an exception while creating a goal.'
                             }, details: err
                             });
                             });*/

                            //######################### Create Goal (end) #########################

                        });//location id
                    }
                    //validation errors exist, send response
                    else {
                        res.send(401, { meta: { status: 401, message: 'validation errors' }, errors: errors });
                    }

                }
                else
                    res.send({ meta: { status: 403, message: 'permission denied' } });
            }
            else {
                res.send({ meta: { status: 401, message: 'User is not logged in or invalid token' } });
            }
        })
        .error(function (err) {
            res.send({ meta: { status: 500, message: 'linkagoal server internal error' }, details: err });
        });
};

exports.create = function (req, res) {

    var datePattern = /^([\+-]?\d{4}(?!\d{2}\b))((-?)((0[1-9]|1[0-2])(\3([12]\d|0[1-9]|3[01]))?|W([0-4]\d|5[0-2])(-?[1-7])?|(00[1-9]|0[1-9]\d|[12]\d{2}|3([0-5]\d|6[1-6])))([T\s]((([01]\d|2[0-3])((:?)[0-5]\d)?|24\:?00)([\.,]\d+(?!:))?)?(\17[0-5]\d([\.,]\d+)?)?([zZ]|([\+-])([01]\d|2[0-3]):?([0-5]\d)?)?)?)?$/;

    //######################### Validations (Rules) #########################
    var constraints = {
        "body": {
            presence: true
        },
        "body.scope_id": {
            presence: true,
            numericality: {
                onlyInteger: true,
                greaterThan: 0,
                lessThanOrEqualTo: 5
            }
        },
        "body.category_id": {
            presence: true,
            numericality: {
                onlyInteger: true
            },
            inclusion: {
                within: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
                message: "category_id should be in [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]"
            }
        },
        "body.goal_name": {
            presence: true,
            length: {
                minimum: 1,
                maximum: 90
            }
        }
    };

    validate.async(req, constraints).then(success, error);

    function success() {

        helpers.getActiveSession(req)
            .then(function (SessionUser) {
                if (SessionUser.type == 'Recognized' || SessionUser.type == 'UnRecognized') {
                    if (SessionUser.permissions.Goal.create == 1) {
                        var errors = [];
                        var tableUserFileUploads = objAllTables.user_file_uploads.user_file_uploads();
                        var goal_start_date;
                        var goal_end_date;

                        //######################### Validations (start) #########################
                        if (+req.body.scope_id == 4 && Array.isArray(req.body.users) == false) {
                            errors.push(helpers.generateErrorObject(1001, 'scope_id', 'specific user must be an array'));
                        }

                        else if (+req.body.scope_id == 4 && req.body.users.length == 0) {
                            errors.push(helpers.generateErrorObject(1001, 'scope_id', 'specific user array must be greater than 0'));
                        }
                        //if start or end dates exist, check if they are in 'ISO8601'
                        //else respond with error
                        //if they do not exist, set "start date" as today and "end date" as null
                        if (validate.isEmpty(req.body.startDate) == true) {
                            goal_start_date = new Date().toISOString();

                        }
                        else if (valid.iso8601(req.body.startDate) == false) {
                            errors.push(helpers.generateErrorObject(1001, 'g_start_date', 'goal start date is not a valid date format ISO8601 (yyyy-mm-dd)'));
                        }
                        else {
                            goal_start_date = req.body.startDate;
                        }
                        //end date
                        if (validate.isEmpty(req.body.endDate) == true) {
                            goal_end_date = null;

                        }
                        else if (valid.iso8601(req.body.endDate) == false) {
                            errors.push(helpers.generateErrorObject(1001, 'g_end_date', 'goal end date is not a valid date format ISO8601 (yyyy-mm-dd)'));
                        }
                        else if (req.body.g_end_date < req.body.startDate) {
                            errors.push(helpers.generateErrorObject(1001, 'g_end_date', 'goal end date cannot be less than goal started date'));
                        }
                        else {
                            goal_end_date = req.body.endDate;
                        }

                        //user defined location
                        if (typeof req.body.userDefinedLocation == 'undefined') {
                            req.body.userDefinedLocation = null;
                        }
                        //######################### Validations (end) #########################

                        //######################### Create Goal (start) #########################
                        //if no errors found, proceed and create goal
                        if (errors.length == 0) {

                            //getting location id
                            helpers.insertLocation(req).then(function (locationId) {

                                var Goals = objAllTables.goals.goals();

                                //if media is attach
                                var fileId = null;


                                if (!valid.isNull(req.body.attach_id))
                                    fileId = req.body.attach_id;
                                //console.log('####################### before promise');
                                return new Promise(function (resolve) {
                                    //console.log('####################### location obj', req.body.userDefinedLocation);
                                    //insert if location available
                                    if (req.body.userDefinedLocation != null) {
                                        //console.log('####################### location is not null');
                                        return helpers.insertUserLocation(req)
                                            .then(function (userDefinedLocation) {
                                                //return userDefinedLocation.id;
                                                resolve(userDefinedLocation.id);
                                            });
                                    }
                                    else
                                        resolve(null);
                                })
                                    .then(function (userDefinedLocation) {
                                        console.log('####################### creating goal');

                                        return Goals.create({
                                            uid: SessionUser.uid,
                                            goal_name: req.body.goal_name,
                                            goal_description: req.body.goal_description || null,
                                            g_start_date: goal_start_date,
                                            g_end_date: goal_end_date,
                                            goal_type: 'BASIC',
                                            goal_image_id: null,
                                            //default_goal_image_id: defaultImageId,
                                            category_id: req.body.category_id,
                                            scope_id: req.body.scope_id,
                                            status: 'ACTIVE',
                                            flag: 0,
                                            created: helpers.getUnixTimeStamp(),
                                            location_id: locationId,
                                            user_location: userDefinedLocation
                                        })
                                            //check if goal created successfully
                                            .then(function (createdGoal) {
                                                //if goal created successfully
                                                if (createdGoal == null)
                                                    new Error('could not create goal');
                                                return createdGoal;
                                            });
                                    })
                                    //if goal has user defined image, verify it
                                    .then(function (createdGoal) {
                                        if (fileId != null) {
                                            //if goal has user defined image, verify it
                                            var dataArray = {
                                                'fileId': fileId,
                                                'uId': SessionUser.uid,
                                                'goalId': createdGoal['dataValues'].goal_id,
                                                'reqFrom': 'GOAL'
                                            };

                                            console.log('####################### calling utility server');

                                            return utils.requestServer(process.env.FILE_SERVER_PRIVATE_IP, process.env.FILE_SERVER_PORT, '/verify/media-id', 'POST', dataArray, '1.0.0')
                                                .then(function (result) {
                                                    console.log('####################### got response from file server');
                                                    console.log('####################### then result', result);
                                                    if (result) {
                                                        return createdGoal;
                                                    } else {
                                                        new Error('goal image verification failed');
                                                    }
                                                });
                                        }
                                        else {
                                            return createdGoal;
                                        }
                                    })
                                    //insert privacy
                                    .then(function (createdGoal) {
                                        if (createdGoal.dataValues.scope_id == 4) {


                                            return utils.insertSpecificUserPrivacy(createdGoal.dataValues.goal_id, req.body.users, SessionUser.uid, 'GOAL')
                                                .then(function (result) {
                                                    if (result) {
                                                        return createdGoal;
                                                    }
                                                    else {
                                                        new Error('Cannot Insert User Specific Goal');
                                                    }
                                                });
                                        }
                                        else {
                                            return createdGoal;
                                        }
                                    })
                                    //create post, record activity, generate feed
                                    .then(function (createdGoal) {
                                        //get created goal
                                        var data = {};
                                        var goal_id = createdGoal['dataValues'].goal_id;

                                        //######################### Extracting Tags (start) #########################
                                        //var extracting = extractingTags(req.body.tags,goal_id);
                                        extractingTags(req.body.tags, goal_id).then(function () {
                                            return;
                                        }).then(function () {

                                            //######################### Extracting Tags (end) #########################
                                            return helpers.GetGoal(goal_id, null, SessionUser['uid'])
                                                .then(function (goal) {

                                                    data['goal'] = goal;
                                                    //######################### Create Post (start) #########################
                                                    var posts = require('../controllers/posts');
                                                    //uid, text, media_id, fetched_url_id, scope_id, post_type, parent_id, req
                                                    return posts.createPost(SessionUser.uid, '', null, null, 1, 'GOAL_CREATED', data.goal.id, req)
                                                        .then(function (postObj) {
                                                            data.feed_type = 'GOAL_CREATED';
                                                            data.post = postObj.post;

                                                            //get proper object
                                                            return helpers.getPost(data.post.id, true, SessionUser.uid)
                                                                .then(function (post) {
                                                                    data.post = post;
                                                                    res.send({ meta: { status: 200, message: 'Success' }, data: data });
                                                                    return data;
                                                                }).then(function (data) {
                                                                    helpers.increment_update_UserStats(SessionUser.uid, 'goals');
                                                                    helpers.addGoal_ToGoalStats(data.goal.id);

                                                                    return data;
                                                                });
                                                        })
                                                        .error(function (err) {
                                                            res.send(401, { meta: { status: 401, message: 'An error occurred while creating a Post for the progress.' }, details: err });
                                                        });
                                                    //######################### Create Post (end) #########################
                                                })
                                                //######################### Record Activity (start) #########################
                                                .then(function (data) {
                                                    //record activity and generate feed
                                                    var feedController = require('../controllers/feed');

                                                    //uid, activity_type, source_id, parent_id, parent_type, post_id)
                                                    feedController.createActivity(SessionUser.uid, 'GOAL_CREATED', data.goal.id, null, null, data.post.id, true, true);
                                                });
                                            //######################### Record Activity (end) #########################
                                        });


                                    }).error(function () {
                                        res.send({
                                            meta: {
                                                status: 401,
                                                message: 'An error occurred while creating a goal.'
                                            }
                                        });
                                    });
                                /*.catch(function (err) {
                                 res.send({
                                 meta: {
                                 status: 401,
                                 message: 'Caught an exception while creating a goal.'
                                 }, details: err
                                 });
                                 });*/

                                //######################### Create Goal (end) #########################

                            });//location id
                        }
                        //validation errors exist, send response
                        else {
                            res.send(401, { meta: { status: 401, message: 'validation errors' }, errors: errors });
                        }

                    }
                    else
                        res.send({ meta: { status: 403, message: 'permission denied' } });
                }
                else {
                    res.send({ meta: { status: 401, message: 'User is not logged in or invalid token' } });
                }
            })
            .error(function (err) {
                res.send({ meta: { status: 500, message: 'linkagoal server internal error' }, details: err });
            });

    }

    function error(errors) {
        if (errors instanceof Error) {
            // This means an exception was thrown from a validator
            res.send(401, { meta: { status: 401, message: 'An error occurred in validator' }, errors: errors });
        } else {
            res.send(401, { meta: { status: 401, message: 'validation errors' }, errors: errors });
        }
    }

};


function extractingTags(tags, goal_id) {
    tags = tags || '';
    //split and get extracted tags from goals
    var extractedTags = helpers.splitGetHashTag(tags);
    //loop through array of tags
    return Promise.map(extractedTags, function (count) {
        return helpers.getTagid(count)
            .then(function (tag) {
                if (tag != null) {
                    var Goals_Tag = objAllTables.goals_tags.goals_tags();
                    Goals_Tag.create({
                        goal_id: goal_id,
                        tag_id: tag.get('tag_id'),
                        status: 'ACTIVE',
                        gen_by: 'USER',
                        created: helpers.getUnixTimeStamp()
                    });
                }
                return ++count;
            });
    });
}

exports.update_old = function (req, res) {

    //######################### Validations (Rules) #########################
    var constraints = {
        "params.id": {
            presence: true,
            numericality: {
                noStrings: false
            }
        }
    };

    validate.async(req, constraints).then(success, error);

    function success() {
        helpers.GetActiveSession_ORM(req)
            .then(function (SessionUser) {
                if (SessionUser != null) {
                    var goal_id = parseInt(req.params.id);
                    var chekCon = false;
                    var obj = req.body;

                    var goals = objAllTables.goals.goals();
                    return goals.findOne({ where: { goal_id: goal_id, uid: SessionUser.uid } })
                        .then(function (goal) {
                            if (goal == null) {
                                res.send(404, { meta: { status: 404, message: 'Not Found' } });
                                throw new Error("break chain");
                            }
                            else if (goal.dataValues.status != 'ACTIVE' && goal.dataValues.status != 'COMPLETED') {
                                res.send(404, { meta: { status: 404, message: 'Not Found' } });
                                throw new Error("break chain");
                            }
                            else if (goal != null) {

                                var count = Object.keys(obj).length;
                                var query = "Update goals set ";
                                var i = 0;
                                var flag = 0;
                                for (var key in obj) {
                                    i = i + 1;
                                    if (obj.hasOwnProperty(key)) {
                                        //key == 'goal_name' || key == 'goal_description' || key == 'category_id'
                                        //key == 'g_start_date' || key == 'g_end_date'
                                        if (key == 'goal_name') {
                                            if (i <= count && flag == 1)
                                                query = query + ",";
                                            flag = 1;
                                            query += "goal_name='{0}' ".format(obj[key]);
                                        }
                                        if (key == 'goal_description') {
                                            if (i <= count && flag == 1)
                                                query = query + ",";
                                            flag = 1;
                                            query += "goal_description='{0}' ".format(obj[key]);
                                        }
                                        if (key == 'category_id') {
                                            if (i <= count && flag == 1)
                                                query = query + ",";
                                            flag = 1;
                                            query += "category_id='{0}' ".format(obj[key]);
                                        }
                                        /*if (key == 'goal_image_id') {
                                            if (i <= count && flag == 1)
                                                query = query + ",";
                                            flag = 1;
                                            query += "goal_image_id={0} ".format(obj[key]);
                                            chekCon = true;
                                        }*/
                                        if (key == 'scope_id') {
                                            if (i <= count && flag == 1)
                                                query = query + ",";
                                            flag = 1;
                                            query += "scope_id={0} ".format(obj[key]);
                                        }
                                        if (key == 'g_start_date') {
                                            if (i <= count && flag == 1)
                                                query = query + ",";
                                            flag = 1;
                                            query += "g_start_date={0} ".format(obj[key]);
                                        }
                                        if (key == 'goal_end_date') {
                                            if (i <= count && flag == 1)
                                                query = query + ",";
                                            flag = 1;
                                            query += "goal_end_date={0} ".format(obj[key]);
                                        }
                                        /*uid: SessionUser.uid,
                                            goal_name: req.body.goal_name,
                                            goal_description: req.body.goal_description,
                                            g_start_date: goal_start_date,
                                            g_end_date: goal_end_date,
                                            goal_type: 'BASIC',
                                            goal_image_id: null,
                                            //default_goal_image_id: defaultImageId,
                                            category_id: req.body.category_id,
                                            scope_id: req.body.scope_id,
                                            status: 'ACTIVE',
                                            flag: 0,
                                            created: helpers.getUnixTimeStamp(),
                                            location_id: locationId*/
                                    }
                                }


                                if (flag != 0) {
                                    query = query + " where goal_id = " + goal_id;
                                    var sequelize = db.sequelizeConn();
                                    sequelize.query(query).spread(function (results, metadata) {
                                        return;
                                    }).then(function () {
                                        if (typeof req.body.tags != "undefined") {
                                            var goalsTag = objAllTables.goals_tags.goals_tags();
                                            return goalsTag.update({ status: 'INACTIVE' }, { where: { goal_id: goal_id, status: 'ACTIVE' } }).then(function (result) {
                                                return extractingTags(req.body.tags, goal_id).then(function (result) {
                                                    return;
                                                });
                                            });
                                        }
                                        else
                                            return;
                                    })
                                        .then(function () {
                                            helpers.GetGoalMini(parseInt(req.params.id))
                                                .then(function (goal) {
                                                    res.send(200, { meta: { status: 200, message: 'Success' }, data: goal });
                                                })
                                        })
                                        .error(function (err) {
                                            res.send(500, { meta: { status: 500, message: 'internal error (query)' }, details: err });
                                        });
                                }
                                else
                                    res.send({ meta: { status: 400, message: 'goal not updated' } });
                            }
                            else
                                res.send(404, { meta: { status: 404, message: 'Goal Not Found' } });
                        }).catch(function (err) {
                            if (err.message != "break chain")
                                res.send(500, { meta: { status: 500, message: 'Unhandled exception' }, details: err });
                        });
                }
                else
                    res.send(401, { meta: { status: 401, message: 'user is not logged in invalid token' } });
            })
            .error(function (err) {
                res.send(500, { meta: { status: 500, message: 'internal error' }, details: err });
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

exports.update = function (req, res) {

    //######################### Validations (Rules) #########################
    var constraints = {
        "params.id": {
            presence: true,
            numericality: {
                noStrings: false
            }
        }
    };

    validate.async(req, constraints).then(success, error);

    function success() {
        helpers.GetActiveSession_ORM(req)
            .then(function (SessionUser) {
                if (SessionUser != null) {
                    var goal_id = parseInt(req.params.id);
                    var obj = req.body;

                    var goals = objAllTables.goals.goals();
                    return goals.findOne({ where: { goal_id: goal_id, uid: SessionUser.uid } })
                        .then(function (goal) {

                            //if goal not found
                            if (goal == null) {
                                res.send(404, { meta: { status: 404, message: 'Not Found' } });
                                throw new Error("break chain");
                            }
                            //if goal is not ACTIVE
                            else if (goal.dataValues.status != 'ACTIVE' && goal.dataValues.status != 'COMPLETED') {
                                res.send(404, { meta: { status: 404, message: 'Not Found' } });
                                throw new Error("break chain");
                            }

                            //generate update query
                            var query = {};
                            for (var key in obj) {
                                if (obj.hasOwnProperty(key)) {

                                    if (key == 'goal_name') {
                                        query.goal_name = obj[key];
                                    }
                                    else if (key == 'goal_description') {
                                        query.goal_description = obj[key];
                                    }
                                    else if (key == 'category_id') {
                                        query.category_id = obj[key];
                                    }
                                    else if (key == 'scope_id') {
                                        query.scope_id = obj[key];
                                    }
                                    else if (key == 'startDate') {
                                        query.g_start_date = obj[key];
                                    }
                                    else if (key == 'endDate') {
                                        query.g_end_date = obj[key];
                                    }
                                }
                            }

                            //if query is empty
                            if (Object.keys(query).length === 0 && JSON.stringify(query) === JSON.stringify({})) { //check for empty object
                                res.send(403, { meta: { status: 403, message: 'query was empty' } });
                                throw new Error("break chain");
                            }

                            //update goal
                            var goals = objAllTables.goals.goals();
                            goals.update(query, {
                                where: {
                                    goal_id: goal_id
                                }
                            })
                                //check if update was successfull
                                .then(function (rowsUpdated) {

                                    if (rowsUpdated != 1) {
                                        res.send(500, { meta: { status: 500, message: 'update failed - error unknown' }, details: { updateQuery: query } });
                                        throw new Error("break chain");
                                    }

                                    return;
                                })
                                //update goal tags
                                .then(function () {

                                    if (typeof req.body.tags != "undefined") {
                                        var goalsTag = objAllTables.goals_tags.goals_tags();
                                        return goalsTag.update({ status: 'INACTIVE' }, { where: { goal_id: goal_id, status: 'ACTIVE' } }).then(function (result) {
                                            return extractingTags(req.body.tags, goal_id).then(function (result) {
                                                return;
                                            });
                                        });
                                    }
                                    else
                                        return;
                                })
                                .then(function () {
                                    helpers.GetGoalMini(parseInt(req.params.id))
                                        .then(function (goal) {
                                            res.send(200, { meta: { status: 200, message: 'Success' }, data: goal });
                                        })
                                });
                        });
                }
                else
                    res.send(401, { meta: { status: 401, message: 'user is not logged in invalid token' } });
            })
            .catch(function (err) {
                if (err.message != "break chain")
                    res.send(500, { meta: { status: 500, message: 'Unhandled exception' }, details: err });
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

exports.delete_old = function (req, res) {

    var goal_id = parseInt(req.params.id);
    //######################### Validations (Rules) #########################
    var constraints = {
        id: {
            presence: true,
            numericality: {
                noStrings: true
            }
        }
    };

    //######################### Validations (Attributes) #########################
    var attributes = {
        id: goal_id
    };

    validate.async(attributes, constraints).then(success, error);

    /*
     delete if goal exists, and session user owns that goal
     */
    function success() {
        helpers.GetActiveSession_ORM(req)
            .then(function (SessionUser) {
                if (SessionUser != null) {
                    if (SessionUser.permissions.Goal.delete == 1) {
                        var sequelize = db.sequelizeConn();
                        sequelize.query('CALL sp_DeleteGoalAndChild({0});').format(goal_id)
                            .then(function (response) {
                                if (response[0].TRUE == 1) {
                                    res.send(200, { meta: { status: 200, message: 'success' } });
                                }
                            }).error(function (err) {
                                res.send(500, { meta: { status: 500, message: 'Internel Error', data: err } });
                            });
                    }
                    else {
                        res.send(403, { meta: { status: 403, message: 'permission denied' } });
                    }
                }
                else {
                    res.send(401, { meta: { status: 401, message: 'user is not logged in or invalid token' } });
                }
            })
            .error(function (err) {
                res.send(500, { meta: { status: 500, message: 'unexpected error' } });
            });
    }

    function error(errors) {
        if (errors instanceof Error) {
            // This means an exception was thrown from a validator
            res.send(401, { meta: { status: 401, message: 'An error ocuured in validator' }, errors: errors });
        } else {
            res.send(401, { meta: { status: 401, message: 'validation errors' }, errors: errors });
        }
    }
};

exports.delete = function (req, res) {

    //######################### Validations (Rules) #########################
    var constraints = {
        "params.id": {
            presence: true,
            numericality: {
                noStrings: false
            }
        }
    };

    validate.async(req, constraints).then(success, error);

    //######################### Success #########################
    function success() {

        helpers.getActiveSession(req)
            .then(function (sessionUser) {

                if (sessionUser.type == 'Recognized') {

                    //check permission
                    if (sessionUser.permissions.Goal.delete != 1) {
                        res.send(403, { meta: { status: 403, message: 'permission denied' } });
                        throw new Error('break chain');
                    }

                    //start deletion process

                    var goals = objAllTables.goals.goals();

                    return goals.findOne({
                        where: { goal_id: req.params.id /*, status: 'ACTIVE'*/ },
                        attributes: ['uid', 'status']
                    })
                        //check goal security
                        .then(function (goal) {
                            if (goal == null || goal.status == 'DELETED' || goal.status == 'USERDEACTIVATED') {
                                res.send(404, { meta: { status: 404, message: 'Not Found' } });
                                throw new Error('break chain');
                            }
                            else if (goal.uid != sessionUser.uid) {
                                res.send(401, { meta: { status: 401, message: 'Unauthorized - session user doesn\'t own the goal' } });
                                throw new Error('break chain');
                            }
                            else {
                                return goal;
                            }
                        })
                        //delete goal
                        .then(function (goal) {
                            var sequelize = db.sequelizeConn();
                            sequelize.query('CALL sp_DeleteGoalAndChild({0});'.format(req.params.id))
                                .then(function (response) {
                                    if (response[0].TRUE == 1) {
                                        res.send(200, { meta: { status: 200, message: 'success' } });
                                        helpers.decrement_update_UserStats(sessionUser.uid, 'goals');
                                    }
                                    else {
                                        res.send(500, { meta: { status: 500, message: 'could not delete. an error occured in stored procedure' } });
                                    }
                                });
                        });
                }
                else {
                    res.send(401, { meta: { status: 401, message: 'user is not logged in or invalid token' } });
                }
            })
            .error(function (err) {
                res.send(500, { meta: { status: 500, message: 'unknown error - error' }, details: err });
            })
            .catch(function (err) {
                if (err.message != 'break chain')
                    res.send(500, { meta: { status: 500, message: 'unknown error - catch' }, details: err });
            });
    }

    //######################### Validations Failed #########################
    function error(errors) {
        if (errors instanceof Error) {
            // This means an exception was thrown from a validator
            res.send(401, { meta: { status: 401, message: 'An error ocuured in validator' }, errors: errors });
        } else {
            res.send(401, { meta: { status: 401, message: 'validation errors' }, errors: errors });
        }
    }
};




//#####################################################################
//######################## Motivations on Goal ########################
//#####################################################################

//GOAL Stats
exports.getMotivationCount = function (req, res) {

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
    //var attributes = {
    //    id: goal_id
    //};

    validate.async(req, constraints).then(success, error);

    function success() {
        helpers.GetActiveSession_ORM(req).then(function (sessionUser) {
            //session is active, user has been authenticated
            if (sessionUser != null) {
                var goal_id = req.params.id;

                var Goal = objAllTables.goals.goals();
                Goal.findOne({ where: { goal_id: req.params.id } })
                    .then(function (goalFound) {

                        if (goalFound == null)
                            res.send({ status: 404, message: 'Goal not found' });
                        else {
                            var Motivations = objAllTables.goal_motivate.goal_motivate();
                            /*Motivations.findAndCountAll({ where: { goal_id: req.params.gid ,status : 'ACTIVE'}, attributes:['uid'] }).then(function(projects) {
                                 console.log('count ' , projects.count);
    
                                 res.send({meta: {status: 200, message: 'Success'}, goal : {motivationCount : projects}});
                                 })*/
                            var db = require('../helpers/db');
                            var seq = db.sequelizeConn();
                            var query = "select u.uid,u.first_name from users as u,\
                                    (SELECT `uid` FROM `goal_motivate` AS `goal_motivate` WHERE `goal_motivate`.`goal_id` = " + req.params.id + " AND `goal_motivate`.`status` = 'ACTIVE') as IdTable\
                                    where u.uid=IdTable.uid";
                            seq.query(query, { model: Motivations })
                                .then(function (result_query) {
                                    res.send({
                                        meta: { status: 200, message: 'Success' },
                                        data: {
                                            count: result_query.length,
                                            motivatedBy: result_query
                                        }
                                    });
                                })
                                .error(function (err) {
                                    res.send({
                                        meta: { status: 401, message: 'unexpected error (query)' },
                                        details: err
                                    });
                                });
                        }
                    });

            }
            //user is not logged in, or provided incorrect or expired token
            else {
                res.send({ meta: { status: 401, message: 'user is not logged or invalid token' } });
            }
        }).error(function (err) {
            res.send({ meta: { status: 500, message: 'internal error' }, details: err });
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

exports.shareGoal = function (req, res) {
    //######################### Validations (Rules) #########################
    var constraints = {
        "params.id": {
            presence: true,
            numericality: {
                noStrings: false
            }
        },
        "body": {
            presence: true
        },
        "body.scope_id": {
            presence: true,
            numericality: {
                onlyInteger: true,
                greaterThan: 0,
                lessThanOrEqualTo: 5
            }
        }

    };

    //######################### Validations (Attributes) #########################
    //var attributes = {
    //    id: postId
    //};

    validate.async(req, constraints).then(success, error);

    function success() {
        helpers.GetActiveSession_ORM(req).then(function (sessionUser) {
            //session is active, user has been authenticated
            if (sessionUser != null) {

                var errors = [];

                if (+req.body.scope_id == 4 && (typeof req.body.users == 'undefined' || req.body.users == null || Array.isArray(req.body.users) == false)) {
                    errors.push(helpers.generateErrorObject(1001, 'scope_id', 'specific user must be an array'));
                }
                else if (+req.body.scope_id == 4 && req.body.users.length == 0) {
                    errors.push(helpers.generateErrorObject(1001, 'users', 'specific user array must be greater than 0'));
                }

                if (errors.length == 0) {
                    //check privacy before sharing goals
                    checkPrivacyOnGoal(req.params.id, sessionUser.uid).then(function (result) {
                        if (result == false) {
                            res.send(401, { meta: { status: 401, message: 'cannot share becuase of privacy' } });
                            return;
                        }
                        else {
                            var data = {};
                            var goalId = req.params.id;
                            var text = req.body.txt || '';
                            //######################### Create Post (start) #########################
                            var posts = require('../controllers/posts');
                            //uid, text, media_id, fetched_url_id, scope_id, post_type, parent_id, req
                            return posts.createPost(sessionUser.uid, text, null, null, req.body.scope_id, 'SHARE_GOAL', goalId, req)
                                .then(function (postObj) {
                                    data.post = postObj.post;
                                    return data;
                                })
                                .then(function (data) {
                                    return helpers.getPost(data.post.id, true, sessionUser.uid)
                                        .then(function (post) {
                                            return helpers.GetGoalMini(goalId).then(function (goalObj) {
                                                data.post = post;
                                                data.goal = goalObj;
                                                res.send({ meta: { status: 200, message: 'Success' }, data: data });
                                                return data;
                                            });
                                        });
                                }).then(function (data) {
                                    console.log("Test");
                                    //######################### Record Activity (start) #########################
                                    //record activity and generate feed
                                    var feedController = require('../controllers/feed');
                                    //uid, activity_type, source_id, parent_id, parent_type, post_id)
                                    feedController.createActivity(sessionUser.uid, 'SHARE_GOAL', goalId, '', '', data.post.id, true, true);

                                    //######################### Record Activity (end) #########################*/

                                });
                        }
                    });
                }
                else {
                    res.send(401, { meta: { status: 401, message: 'validation errors' }, errors: errors });
                }
            }
            else {
                res.send(401, { meta: { status: 401, message: 'Unauthorized' } });
            }

        }).catch(function (err) {
            if (err.message != "break chain") {
                res.send({ meta: { status: 401, message: err } });
            }
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

    function checkPrivacyOnGoal(goal_id, uid) {
        var sequelize = db.sequelizeConn();
        return sequelize.query('SELECT CheckPrivacy_Goal({0}, {1}) as result'.format(uid, goal_id)).then(function (result) {
            if (result[0][0].result === 1) {
                return true;
            }
            else {
                return false;
            }
        });
    }
};

exports.addMotivation = function (req, res) {
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
    //var attributes = {
    //    id: goal_id
    //};

    validate.async(req, constraints).then(success, error);

    function success() {
        helpers.GetActiveSession_ORM(req).then(function (sessionUser) {
            //session is active, user has been authenticated
            if (sessionUser != null) {
                var goal_id = parseInt(req.params.id);


                if (sessionUser.permissions.Motivate.create == 1) {

                    var Goal = objAllTables.goals.goals();
                    Goal.findOne({ where: { goal_id: req.params.id, status: { $ne: 'DELETED' } } })//check for not equals to 'DELETED' against given goal_id
                        .then(function (goalFound) {
                            var data = {};
                            if (goalFound == null)
                                res.send({ meta: { status: 404, message: 'goal not found' } });
                            else {
                                var Motivations = objAllTables.goal_motivate.goal_motivate();
                                Motivations.findOrCreate({
                                    where: {
                                        uid: sessionUser.uid,
                                        goal_id: goal_id,
                                    },
                                    defaults: {
                                        created: helpers.getUnixTimeStamp(),
                                        status: 'ACTIVE'
                                    }
                                }).spread(function (motivation, created) {

                                    if (created == false) {
                                        data.goalmotivationId = motivation['dataValues']._id;
                                        data.goalId = goal_id;
                                        data.uid = sessionUser.uid;

                                        if (motivation['dataValues'].status == 'ACTIVE') {
                                            throw new Error('abort-promise');
                                        }
                                        else if (motivation['dataValues'].status == 'INACTIVE') {
                                            return Motivations.update({
                                                status: 'ACTIVE', created: helpers.getUnixTimeStamp()
                                            }, {
                                                    where: {
                                                        uid: sessionUser.uid,
                                                        goal_id: goal_id
                                                    }
                                                })
                                                .then(function () {
                                                    res.send({ meta: { status: 200, message: 'Goal Motivation status updated' } });
                                                    return data;
                                                });
                                        }

                                    }
                                    else {
                                        data.goalmotivationId = motivation['dataValues']._id;
                                        data.goalId = goal_id;
                                        data.uid = sessionUser.uid;
                                        res.send({ meta: { status: 200, message: 'Goal Motivation created' } });
                                        return data;
                                    }
                                })
                                    //######################### Record Activity (start) #########################
                                    .then(function (data) {
                                        //record activity and generate feed
                                        var feedController = require('../controllers/feed');
                                        //uid, activity_type, source_id, parent_id, parent_type, post_id)
                                        feedController.createActivity(sessionUser.uid, 'MOTIVATE_ON_GOAL', data.goalmotivationId, data.goalId, 'GOAL', null);

                                        helpers.increment_update_GoalStats(data.goalId, 'motivations');
                                        //######################### Record Activity (end) #########################*/
                                    }).catch(function (err) {
                                        if (err = "abort-promise") {
                                            res.send({ meta: { status: 401, message: 'Goal Motivation Already exist' } });
                                        } else {
                                            res.send({ meta: { status: 500, message: 'Error' }, details: err });
                                        }
                                    }); //adding or updating motivation (end of "then")

                            }
                        });
                }
                else
                    res.send({ meta: { status: 403, message: 'permission denied' } });
            }
            //user is not logged in, or provided incorrect or expired token
            else {
                res.send({ meta: { status: 401, message: 'user is not logged or invalid token' } });
            }
        }).error(function (err) {
            res.send({ meta: { status: 500, message: 'internal error' }, details: err });
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

exports.deleteMotivation = function (req, res) {

    //######################### Validations (Rules) #########################
    var constraints = {
        "params.id": {
            presence: true,
            numericality: {
                noStrings: false
            }
        }
    };

    validate.async(req, constraints).then(success, error);

    function success() {

        helpers.getActiveSession(req)
            .then(function (sessionUser) {

                if (sessionUser.type == 'Recognized') {
                    //check permission
                    if (sessionUser.permissions.Milestones.delete != 1) {
                        res.send(403, { meta: { status: 403, message: 'permission denied' } });
                        throw new Error('break chain');
                    }
                    var sequelize = db.sequelizeConn();
                    sequelize.query('CALL sp_DeleteMotivationGoal({0},{1});'.format(sessionUser.uid, req.params.id))
                        .then(function (response) {
                            if (response[0].TRUE == 1) {
                                res.send(200, { meta: { status: 200, message: 'success' } });
                                helpers.decrement_update_GoalStats(req.params.id, 'motivations');
                            }
                            else {
                                res.send(500, { meta: { status: 500, message: 'could not delete. an error occured in stored procedure' } });
                            }
                        });
                }
                else {
                    res.send(401, { meta: { status: 401, message: 'user is not logged in or invalid token' } });
                }
            })
            .error(function (err) {
                res.send(500, { meta: { status: 500, message: 'internal error' }, details: err });
            })
            .catch(function (err) {
                if (err.message != 'break chain')
                    res.send(500, { meta: { status: 500, message: 'unknown error - catch' }, details: err });
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

//Recheck if it is used
exports.getAchieveGoal = function (req, res) {

    //######################### Validations (Rules) #########################
    var constraints = {
        "params.id": {
            presence: true,
            numericality: {
                noStrings: false
            }
        }
    };

    ////######################### Validations (Attributes) #########################
    //var attributes = {
    //    id: goal_id
    //};

    validate.async(req, constraints).then(success, error);


    function success() {
        helpers.GetActiveSession_ORM(req)
            .then(function (SessionUser) {
                if (SessionUser != null) {
                    var goal_id = req.params.id;

                    //res.send(req.params.id);
                    //var query = "SELECT count(*) FROM `goals` where `status` = 'COMPLETED' and goal_id =" +  ;
                    var Achieve = objAllTables.goals.goals();
                    Achieve.findOne({ where: { status: 'COMPLETED', goal_id: req.params.id } }).then(function (result) {
                        //console.log('count : ',project);
                        if (result == null)
                            res.send({ meta: { status: 200, message: 'Success' }, data: { goal: { achieve: 0 } } });
                        else
                            res.send({ meta: { status: 200, message: 'Success' }, data: { goal: { achieve: 1 } } });
                    })
                }
                else
                    res.send({ meta: { status: 401, message: 'user is not logged in invalid token' } });
            })
            .error(function (err) {
                res.send({ meta: { status: 500, message: 'internal error' } });
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

exports.achieveGoal = function (req, res) {

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
        helpers.GetActiveSession_ORM(req)
            .then(function (SessionUser) {
                if (SessionUser != null) {
                    var goal_id = parseInt(req.params.id);

                    var goals = objAllTables.goals.goals();

                    goals.update({
                        status: 'COMPLETED',
                        completed: helpers.getUnixTimeStamp()
                    }, {
                            where: {
                                uid: SessionUser.uid,
                                goal_id: req.params.id,
                                status: 'ACTIVE'
                            }
                        })
                        //check if goal successfully achieved
                        .then(function (rowsUpdated) {
                            if (rowsUpdated[0] == 1) {  //if 1 row updated
                                return helpers.GetGoal(req.params.id, null, SessionUser.uid)
                                    .then(function (goal) {
                                        var data = {};
                                        data.goal = goal;
                                        return data;
                                    });
                            }
                            else {
                                throw new Error('goal not found');
                            }
                        })
                        //create post and upload image (if exists)
                        .then(function (data) {
                            //check if image is attached or not
                            var fileId = null;
                            if (typeof req.body != 'undefined' && typeof req.body.attach_id != 'undefined' && req.body.attach_id != null)
                                fileId = [req.body.attach_id];  //if image is attached, create an array for image

                            //check if "text" is available
                            var text = req.body.text || '';

                            //######################### Create Post (start) #########################
                            var posts = require('../controllers/posts');
                            //uid, text, media_id, fetched_url_id, scope_id, post_type, parent_id, req
                            return posts.createPost(SessionUser.uid, text, fileId, null, 1, 'GOAL_ACHIEVED', data.goal.id, req)
                                .then(function (postObj) {
                                    data['post'] = postObj.post;

                                    if (fileId != null) {
                                        //upload pic
                                        var userFileUploads = objAllTables.user_file_uploads.user_file_uploads();
                                        return userFileUploads.update({
                                            parent_id: postObj.id,
                                            updated: helpers.getUnixTimeStamp()
                                        }, {
                                                where: {
                                                    id: fileId
                                                }
                                            })
                                            .then(function () {
                                                return data;
                                            });
                                    }
                                    else {
                                        return data;
                                    }
                                })
                                .error(function (err) {
                                    res.send(401, {
                                        meta: {
                                            status: 401,
                                            message: 'An error occurred while creating a Post for the goal achieve.'
                                        }, details: err
                                    });
                                });
                            //######################### Create Post (end) #########################
                        })
                        //send response
                        .then(function (data) {
                            res.send(200, { meta: { status: 200, message: 'Success' }, data: data });
                            return data;
                        })
                        .then(function (data) {
                            //######################### Record Activity (start) #########################
                            //record activity and generate feed
                            var feedController = require('../controllers/feed');

                            //uid, activity_type, source_id, parent_id, parent_type, post_id)
                            feedController.createActivity(SessionUser.uid, 'GOAL_ACHIEVED', data.goal.id, null, null, data.post.id, true, true);
                            //######################### Record Activity (end) ###########################
                        })
                        .error(function (err) {
                            res.send(500, { meta: { status: 500, message: 'error in achieving goal' }, details: err });
                        })
                        .catch(function (err) {
                            if (err.message == 'goal not found') {
                                console.log(chalk.red('######################### in catch', err));
                                res.send(404, { meta: { status: 404, message: 'not found' } });
                            }
                            else {
                                res.send(500, { meta: { status: 500, message: 'exception in achieving goal' }, details: err });
                            }
                        });
                }
                else
                    res.send(401, { meta: { status: 401, message: 'User is not logged in invalid token' } });
            })
            .error(function (err) {
                res.send(500, { meta: { status: 500, message: 'error in achieving goal' }, details: err });
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

//#####################################################################
//############################ Follow Goal ############################
//#####################################################################

exports.followGoal = function (req, res) {

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
    //var attributes = {
    //    id: goal_id
    //};

    validate.async(req, constraints).then(success, error);

    var goal_id = parseInt(req.params.id);
    function success() {
        helpers.GetActiveSession_ORM(req).then(function (sessionUser) {
            //Session is active, user has been authenticated
            if (sessionUser != null) {
                //Check if user has permission to create goal
                if (sessionUser.permissions.Goal_Follow.create) {

                    //Check Goal With Privacy
                    var goals = objAllTables.goals.goals();
                    goals.findOne({
                        where: {
                            goal_id: req.params.id,
                            status: { $ne: 'DELETED' },
                            $and: [sequelize.literal('CheckPrivacy_Goal({0}, {1}) = 1'.format(sessionUser.uid, req.params.id))]
                        }
                    })
                        .then(function (goal) {
                            if (goal != null) {
                                //Check Session User owns this Goal
                                if (goal.uid != sessionUser.uid) {

                                    //Check Session User Follows the Goal
                                    var goal_follower = objAllTables.goal_followers.goal_followers();
                                    goal_follower.findOne({
                                        where: { $and: [{ goal_id: goal.goal_id }, { follower_uid: sessionUser.uid }] }
                                    }).then(function (goalFollowed) {
                                        if (goalFollowed != null) {
                                            //if Already Followed And status is "Active",
                                            if (goalFollowed['status'] == 'ACTIVE') {
                                                res.send(401, { meta: { status: 401, message: 'Already Followed' } });

                                            }
                                            else {
                                                //if Already Followed And status is "INACTIVE" Then Change ACTIVE,
                                                goal_follower.update({ status: 'ACTIVE' }, { where: { follower_uid: sessionUser.uid, goal_id: goal.goal_id, status: 'INACTIVE' } })
                                                    .then(function (result) {

                                                        if (result[0] != 1) {
                                                            res.send(500, { meta: { status: 500, message: 'Error in re-following' } });
                                                            throw new Error('break promise chain');
                                                        }

                                                        //######################### Create Post (start) #########################
                                                        var data = {};
                                                        data.goal_id = goal.goal_id;

                                                        var posts = require('../controllers/posts');
                                                        //uid, text, media_id, fetched_url_id, scope_id, post_type, parent_id, req
                                                        return posts.createPost(sessionUser.uid, '', null, null, 1, 'GOAL_FOLLOWED', data.goal_id, req)
                                                            .then(function (postObj) {
                                                                data['post'] = postObj.post;
                                                                res.send({ meta: { status: 200, message: 'Success' }, data: data });
                                                                return data;
                                                            })

                                                            //######################### Create Post (end) #########################

                                                            //######################### Record Activity (start) #########################
                                                            .then(function (data) {
                                                                //record activity and generate feed
                                                                var feedController = require('../controllers/feed');

                                                                //uid, activity_type, source_id, parent_id, parent_type, post_id)
                                                                feedController.createActivity(sessionUser.uid, 'GOAL_FOLLOWED', data.goal_id, null, null, data.post.id);
                                                                helpers.increment_update_UserStats(sessionUser.uid, 'goal_followings');
                                                                helpers.increment_update_GoalStats(goal_id, 'followers');
                                                            })
                                                            //######################### Record Activity (end) #########################
                                                            .error(function (err) {
                                                                res.send(500, { meta: { status: 500, message: 'An error occurred while creating a Post for the goal follow' }, details: err });
                                                            });
                                                    });

                                            }
                                        }
                                        else {
                                            //Insert New into Goal Follower
                                            goal_follower.create({
                                                goal_id: goal.goal_id,
                                                follower_uid: sessionUser.uid,
                                                status: 'ACTIVE',
                                                created: helpers.getUnixTimeStamp()

                                            }).then(function (goal) {

                                                //######################### Create Post (start) #########################
                                                var data = {};
                                                data.goal_id = goal.goal_id;

                                                var posts = require('../controllers/posts');
                                                //uid, text, media_id, fetched_url_id, scope_id, post_type, parent_id, req
                                                return posts.createPost(sessionUser.uid, '', null, null, 1, 'GOAL_FOLLOWED', data.goal_id, req)
                                                    .then(function (postObj) {
                                                        data['post'] = postObj.post;
                                                        res.send(200, { meta: { status: 200, message: 'New Goal Followed' }, data: data });
                                                        return data;
                                                    })
                                                    //######################### Create Post (end) #########################

                                                    //######################### Record Activity (start) #########################
                                                    .then(function (data) {
                                                        //record activity and generate feed
                                                        var feedController = require('../controllers/feed');

                                                        //uid, activity_type, source_id, parent_id, parent_type, post_id)
                                                        feedController.createActivity(sessionUser.uid, 'GOAL_FOLLOWED', data.goal_id, null, null, data.post.id, true, true);
                                                    }).then(function (data) {
                                                        helpers.increment_update_UserStats(sessionUser.uid, 'goal_followings');
                                                        helpers.increment_update_GoalStats(goal_id, 'followers');
                                                    })
                                                    //######################### Record Activity (end) #########################
                                                    .error(function (err) {
                                                        res.send(500, { meta: { status: 500, message: 'An error occurred while creating a Post for goal follow' }, details: err });
                                                    });

                                            });

                                        }
                                    });

                                } else {
                                    res.send(401, { meta: { status: 401, message: 'you cannot follow your own goal' } });
                                }
                            } else {
                                res.send(404, { meta: { status: 404, message: 'Goal Not Found' } });
                            }
                        });
                } else
                    //user doesn't have permission
                    res.send(403, { meta: { status: 403, message: 'permission denied' } });
            } else {
                //user is not logged in, or provided incorrect or expired token
                res.send(401, { meta: { status: 401, message: 'user is not logged or invalid token' } });
            }
        }).error(function (err) {
            res.send(500, { meta: { status: 500, message: err } });
        });
    }

    function error(errors) {
        if (errors instanceof Error) {
            // This means an exception was thrown from a validator
            res.send(401, { meta: { status: 401, message: 'An error ocuured in validator' }, errors: errors });
        } else {
            res.send(401, { meta: { status: 401, message: 'validation errors' }, errors: errors });
        }
    }
};

exports.unfollowGoal_old = function (req, res) {

    var goal_id = parseInt(req.params.id);
    //######################### Validations (Rules) #########################
    var constraints = {
        id: {
            presence: true,
            numericality: {
                noStrings: true
            }
        }
    };

    //######################### Validations (Attributes) #########################
    var attributes = {
        id: goal_id
    };

    validate.async(attributes, constraints).then(success, error);

    function success() {
        helpers.GetActiveSession_ORM(req).then(function (sessionUser) {
            //session is active, user has been authenticated
            if (sessionUser != null) {
                if (sessionUser.permissions.Goal_Follow.delete == 1) {
                    var goals = objAllTables.goals.goals();
                    goals.findOne({ where: { goal_id: req.params.id } })
                        .then(function (goal) {
                            //if "uid" is not null, proceed anc check if parmetere user  owns this goal
                            if (goal != null) {
                                if (goal.status != 'DELETED') {
                                    if (goal.uid != sessionUser.uid) {
                                        var goal_follower = objAllTables.goal_followers.goal_followers();
                                        goal_follower.findOne({
                                            where: {
                                                $and: [
                                                    {
                                                        goal_id: goal.goal_id
                                                    },
                                                    {
                                                        follower_uid: sessionUser.uid
                                                    }
                                                ]
                                            }
                                        }).then(function (goalFollowed) {
                                            if (goalFollowed != null) {
                                                if (goalFollowed['status'] == 'ACTIVE') {

                                                    goal_follower.update({
                                                        status: 'INACTIVE'
                                                    }, {
                                                            where: {
                                                                $and: [
                                                                    {
                                                                        goal_id: goal.goal_id

                                                                    },
                                                                    {
                                                                        follower_uid: sessionUser.uid
                                                                    }
                                                                ]
                                                            }
                                                        }).then(function (result) {
                                                            res.send({ meta: { status: 200, message: 'Goal UnFollowed' } });
                                                        });

                                                } else {
                                                    res.send({
                                                        meta: {
                                                            status: 401,
                                                            message: 'Already Goal unFollowed'
                                                        }
                                                    });
                                                }
                                            } else {
                                                res.send({ meta: { status: 200, message: 'First Follow Goal' } });

                                            }
                                        });
                                    }
                                    else
                                        res.send({
                                            meta: {
                                                status: 401,
                                                message: 'you cannot unfollow your own goal'
                                            }
                                        });
                                }
                                else
                                    res.send({ meta: { status: 404, message: 'goal not found' } });
                            }
                            else {
                                res.send({ meta: { status: 404, message: 'goal not found' } });
                            }
                        });


                }
                else
                    res.send({ meta: { status: 403, message: 'permission denied' } });
            }
            //user is not logged in, or provided incorrect or expired token
            else {
                res.send({ meta: { status: 401, message: 'user is not logged or invalid token' } });
            }
        }).error(function (err) {
            res.send({ meta: { status: 500, message: err } });
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

exports.unfollowGoal = function (req, res) {

    //######################### Validations (Rules) #########################
    var constraints = {
        "params.id": {
            presence: true,
            numericality: {
                noStrings: false
            }
        }
    };

    validate.async(req, constraints).then(success, error);

    function success() {
        helpers.getActiveSession(req).then(function (sessionUser) {

            if (sessionUser.type == 'Recognized') {

                if (sessionUser.permissions.Goal_Follow.delete != 1) {
                    res.send(403, { meta: { status: 403, message: 'permission denied' } });
                    throw new Error('break promise chain');
                }

                var goal_id = parseInt(req.params.id);

                var goals = objAllTables.goals.goals();
                goals.findOne({ where: { goal_id: req.params.id } })
                    .then(function (goal) {

                        if (goal == null) {
                            res.send(404, { meta: { status: 404, message: 'goal not found' } });
                            throw new Error('break promise chain');
                        }
                        else if (goal.status != 'ACTIVE') {
                            res.send(404, { meta: { status: 404, message: 'goal not found' } });
                            throw new Error('break promise chain');
                        }
                        else {
                            return
                        }
                    })
                    .then(function () {

                        return sequelize.query('call sp_GoalUnfollow({0}, {1});'.format(sessionUser.uid, goal_id), { type: sequelize.QueryTypes.SELECT }).then(function (result) {

                            //extract code from result
                            var responseCode = -1;

                            if (result.length == 3) {
                                responseCode = result[0][0].result;
                            }
                            else {
                                responseCode = result[2][0].result;
                            }

                            //generate response
                            if (responseCode == 200) {
                                res.send(200, { meta: { status: 200, message: 'success' } });
                            }
                            else if (responseCode == 401) {
                                res.send(404, { meta: { status: 404, message: 'not following' } });
                            }
                            else if (responseCode == 404) {
                                res.send(404, { meta: { status: 404, message: 'goal not found' } });
                            }
                            else if (responseCode == 500) {
                                res.send(500, { meta: { status: 500, message: 'error in stored procedure' } });
                            }
                            else {
                                res.send(500, { meta: { status: 500, message: 'unexpected response from stored procedure' } });
                            }
                        });

                    })

            }
            //user is not logged in, or provided incorrect or expired token
            else {
                res.send(401, { meta: { status: 401, message: 'user is not logged or invalid token' } });
            }
        }).error(function (err) {
            if (err.message != 'break promise chain')
                res.send(500, { meta: { status: 500, message: err } });
        }).catch(function (err) {
            if (err.message != 'break promise chain')
                res.send(500, { meta: { status: 500, message: err } });
        });
    }

    function error(errors) {
        if (errors instanceof Error) {
            // This means an exception was thrown from a validator
            res.send(401, { meta: { status: 401, message: 'An error ocuured in validator' }, errors: errors });
        } else {
            res.send(401, { meta: { status: 401, message: 'validation errors' }, errors: errors });
        }
    }
};

//#####################################################################
//############################# Link Goal #############################
//#####################################################################
exports.link = function (req, res) {

    //######################### Validations (Rules) #########################
    var constraints = {
        "body.fromGoalId": {
            presence: true,
            numericality: {
                noStrings: false
            }
        },
        "params.id": {
            presence: true,
            numericality: {
                noStrings: false
            }
        }

    };


    validate.async(req, constraints).then(success, error);


    /*
     if Session is active,
     then check if this user created this goal(the goal he wants to link)
     then check if goal is linked or not
     if linked, unlink it now
     else throw error
     else through 401 error
     */
    function success() {
        helpers.GetActiveSession_ORM(req)
            .then(function (SessionUser) {
                if (SessionUser != null) {

                    var goals = objAllTables.goals.goals();
                    var goal_linked = objAllTables.goal_linked.goal_linked();
                    var fromGoalID = parseInt(req.body.fromGoalId);
                    var toGoalID = parseInt(req.params.id);

                    if (SessionUser.permissions.Goal_Link.create == 1) {

                        goals.findOne({
                            where: {
                                goal_id: fromGoalID,
                                uid: SessionUser.uid,
                                $and: [sequelize.literal('CheckPrivacy_Goal({0}, {1}) = 1'.format(SessionUser.uid, toGoalID))]
                            }
                        })
                            .then(function (goalResult) {
                                return goalResult;
                            }).then(function (goalResult) {
                                if (goalResult != null) {
                                    goal_linked.findOne({
                                        where: {
                                            $and: [
                                                {
                                                    from_goal_id: fromGoalID
                                                },
                                                {
                                                    to_goal_id: toGoalID
                                                }
                                            ]
                                        }
                                    }).then(function (goalLinkedResult) {
                                        return goalLinkedResult;
                                    }).then(function (goalLinkedResult) {
                                        if (goalLinkedResult != null) {
                                            if (goalLinkedResult['dataValues']['status'] == 'INACTIVE') {
                                                goal_linked.update({
                                                    status: 'ACTIVE',
                                                    updated: helpers.getUnixTimeStamp()
                                                }, {
                                                        where: {
                                                            $and: [
                                                                {
                                                                    from_goal_id: fromGoalID
                                                                },
                                                                {
                                                                    to_goal_id: toGoalID
                                                                }
                                                            ]
                                                        }
                                                    }).then(function (updateResult) {
                                                        if (updateResult == 1) {    //if "1" row is updated
                                                            res.send({ meta: { status: 200, message: 'Success (re-linked successfully)' } });

                                                            //feed here
                                                        } else {
                                                            res.send({
                                                                meta: { status: 401, message: 'UnSuccessfull in (re-linking)' }
                                                            });
                                                        }
                                                    }).error(function (err) {
                                                        res.send({
                                                            meta: { status: 401, message: 'An error occurred while re-linking to goal.' }, details: err
                                                        });
                                                    });
                                            }//if its ACTIVE, then respond with error 'Already linked'
                                            else if (goalLinkedResult['status'] == 'ACTIVE') {
                                                res.send({ meta: { status: 401, message: 'Already linked' } });
                                            }
                                        }
                                        //if this is first time linking to this goal, insert with ACTIVE status
                                        else {
                                            goal_linked.create({
                                                from_goal_id: fromGoalID,
                                                to_goal_id: toGoalID,
                                                uid: SessionUser.uid,
                                                status: 'ACTIVE',
                                                created: helpers.getUnixTimeStamp()
                                            }).then(function (insertResult) {
                                                if (insertResult['dataValues']['_id'] != null) {

                                                    var data = {};
                                                    return helpers.GetGoal(fromGoalID, null, SessionUser.uid)
                                                        .then(function (fromGoal) {
                                                            data.fromGoal = fromGoal;
                                                            return data;
                                                        })
                                                        .then(function (data) {

                                                            return helpers.GetGoal(toGoalID, null, SessionUser.uid)
                                                                .then(function (toGoal) {
                                                                    data.toGoal = toGoal;
                                                                    return data;
                                                                });
                                                        })
                                                        .then(function (data) {
                                                            //######################### Create Post (start) #########################
                                                            var posts = require('../controllers/posts');
                                                            //uid, text, media_id, fetched_url_id, scope_id, post_type, parent_id, req
                                                            return posts.createPost(SessionUser.uid, '', null, null, 1, 'LINK_GOAL', data.toGoal.id, req)
                                                                .then(function (postObj) {
                                                                    data['post'] = postObj.post;
                                                                    res.send(200, {
                                                                        meta: { status: 200, message: 'Success (linked successfully)' },
                                                                        data: { data: data }
                                                                    });
                                                                });
                                                            //######################### Create Post (end) #########################
                                                        })
                                                        //######################### Record Activity (start) #########################
                                                        .then(function () {
                                                            //record activity and generate feed
                                                            var feedController = require('../controllers/feed');

                                                            //uid, activity_type, source_id, parent_id, parent_type, post_id)
                                                            feedController.createActivity(SessionUser.uid, 'LINK_GOAL', data.fromGoal.id, data.toGoal.id, 'GOAL', data.post.id, true, true);

                                                            helpers.increment_update_GoalStats(data.fromGoal.id, 'links_forward');
                                                            helpers.increment_update_GoalStats(data.toGoal.id, 'links_backward');
                                                        });
                                                    //######################### Record Activity (end) #########################

                                                } else {
                                                    res.send(401, { meta: { status: 401, message: 'linking failed, an error occurred' } });
                                                }
                                            }).error(function (err) {
                                                res.send(401, { meta: { status: 401, message: "Error in Linking Goal" }, details: err });
                                            });
                                        }
                                    }).error(function (error) {
                                        res.send(401, { meta: { status: 401, message: "An error occurred in checking if goal is already linked or not" } });
                                    });
                                } else {
                                    res.send(401, { meta: { status: 401, message: 'Goal Not Found' } });
                                }
                            }).error(function () {
                                res.send(401, { meta: { status: 401, message: 'An error occurred in checking if session user owns the goal' } });
                            });
                    }
                    else
                        res.send(403, { meta: { status: 403, message: 'Permission denied' } });
                }
                else {
                    res.send(401, { meta: { status: 401, message: 'User is not logged in or invalid token' } });
                }
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

exports.unlink_old = function (req, res) {

    var goals = objAllTables.goals.goals();
    var goal_linked = objAllTables.goal_linked.goal_linked();
    var fromGoalID = parseInt(req.body.fromGoalId);
    var toGoalID = parseInt(req.params.id);

    //######################### Validations (Rules) #########################
    var constraints = {
        fromGoalId: {
            presence: true,
            numericality: {
                noStrings: true
            }
        },
        id: {
            presence: true,
            numericality: {
                noStrings: true
            }
        }

    };

    //######################### Validations (Attributes) #########################
    var attributes = {
        fromGoalId: fromGoalID,
        id: toGoalID
    };

    validate.async(attributes, constraints).then(success, error);


    /*
     if Session is active,
     then check if this user created this goal(the goal want to unlink)
     then check if goal is linked or not
     if linked, unlink it now
     else throw error
     else through 401 error
     */


    function success() {
        helpers.GetActiveSession_ORM(req)
            .then(function (SessionUser) {
                if (SessionUser != null) {
                    if (SessionUser.permissions.Goal_Link.delete == 1) {

                        goals.findOne({
                            where: {
                                $and: [
                                    {
                                        goal_id: fromGoalID
                                    },
                                    {
                                        uid: SessionUser.uid
                                    }
                                ]
                            }
                        }).then(function (goalResult) {
                            return goalResult;
                        }).then(function (goalResult) {
                            if (goalResult != null) {
                                //it means user owns this goal
                                //check if linked, then update status to INACTIVE, if not linked before, respond with error 'not linked'
                                goal_linked.findOne({
                                    where: {
                                        $and: [
                                            {
                                                from_goal_id: fromGoalID
                                            },
                                            {
                                                to_goal_id: toGoalID
                                            }
                                        ]
                                    }
                                }).then(function (goalLinkedResult) {
                                    return goalLinkedResult;
                                }).then(function (goalLinkedResult) {

                                    //check if if its linked or not
                                    if (goalLinkedResult != null) {
                                        //if it is linked, unlink it by updating status 'INACTIVE'
                                        if (goalLinkedResult['dataValues']['status'] == 'ACTIVE') {
                                            goal_linked.update({
                                                status: 'INACTIVE',
                                                updated: helpers.getUnixTimeStamp()
                                            }, {
                                                    where: {
                                                        $and: [
                                                            {
                                                                from_goal_id: fromGoalID
                                                            },
                                                            {
                                                                to_goal_id: toGoalID
                                                            }
                                                        ]
                                                    }
                                                }).then(function (updateResult) {
                                                    if (updateResult == 1) {
                                                        res.send({
                                                            meta: {
                                                                status: 200,
                                                                message: 'Success (unlinked successfully)'
                                                            }
                                                        });
                                                    }
                                                    else {
                                                        res.send({
                                                            meta: {
                                                                status: 401,
                                                                message: 'Linked Goal not found'
                                                            }
                                                        });
                                                    }
                                                }).error(function (updateError) {
                                                    res.send({
                                                        status: 401,
                                                        message: 'an error occurred while unlinking to goal.'
                                                    });
                                                });
                                        }//if its INACTIVE, then respond with error 'Already unlinked'
                                        else if (goalLinkedResult['dataValues']['status'] == 'INACTIVE') {
                                            res.send({
                                                meta: {
                                                    status: 401,
                                                    message: 'Already unlinked'
                                                }
                                            });
                                        }
                                    } //goal is not linked, so it can not be unlinked, send response with error 'not linked'
                                    else {
                                        res.send({
                                            meta: {
                                                status: 401,
                                                message: 'not linked'
                                            }
                                        });
                                    }
                                }).error(function (err) {
                                    res.send({
                                        meta: {
                                            status: 401,
                                            message: 'error'
                                        }, details: err
                                    });
                                });
                            }
                            else {
                                res.send({
                                    meta: {
                                        status: 401,
                                        message: 'Session user does not own this goal'
                                    }
                                });
                            }
                        }).error(function (err) {
                            res.send({
                                meta: {
                                    status: 401,
                                    message: 'error'
                                }, details: err
                            });
                        });
                    }
                    else
                        res.send({ meta: { status: 403, message: 'permission denied' } });
                }

                else {
                    res.send({
                        meta: {
                            status: 401,
                            message: 'User is not logged in or invalid token'
                        }
                    });

                }
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


exports.unlink = function (req, res) {

    var constraints = {
        "params.fromGoalId": {
            presence: true,
            numericality: {
                noStrings: false
            }
        },
        "params.id": {
            presence: true,
            numericality: {
                noStrings: false
            }
        }
    };

    validate.async(req, constraints).then(success, error);

    function success() {

        helpers.getActiveSession(req)
            .then(function (sessionUser) {
                if (sessionUser.type == 'Recognized') {

                    //check permission
                    if (sessionUser.permissions.Goal_Link.delete != 1) {
                        res.send(403, { meta: { status: 403, message: 'permission denied' } });
                        throw new Error('break promise chain');
                    }

                    var fromGoalID = parseInt(req.params.fromGoalId);
                    var toGoalID = parseInt(req.params.id);

                    var goals = objAllTables.goals.goals();
                    goals.findOne({
                        where: {
                            goal_id: fromGoalID,
                            uid: sessionUser.uid,
                            $and: [sequelize.literal('CheckPrivacy_Goal({0}, {1}) = 1'.format(sessionUser.uid, toGoalID))]
                        }
                    }).then(function (goal) {    //check goal access and ownership

                        if (goal == null) {
                            res.send(404, { meta: { status: 404, message: 'not found' } });
                            throw new Error('break promise chain');
                        }

                        return;
                    }).then(function () {     //check goal link

                        var goal_linked = objAllTables.goal_linked.goal_linked();
                        return goal_linked.findOne({
                            where: { from_goal_id: fromGoalID, to_goal_id: toGoalID }
                        }).then(function (goal_linked) {

                            if (goal_linked == null) {
                                res.send(404, { meta: { status: 404, message: 'no link found' } });
                                throw new Error('break promise chain');
                            }
                            else if (goal_linked.dataValues.uid != sessionUser.uid) {
                                res.send(401, { meta: { status: 401, message: "session user doesn't own the goal" } });
                                throw new Error('break promise chain');
                            }
                            else if (goal_linked.dataValues.status == 'INACTIVE') {
                                res.send(404, { meta: { status: 404, message: 'no link found - already unlinked' } });
                                throw new Error('break promise chain');
                            }

                            return goal_linked;
                        });
                    }).then(function (goal_linked) {

                        return sequelize.query('CALL sp_GoalUnlink({0},{1});'.format(fromGoalID, toGoalID))
                            .then(function (response) {

                                if (response[0].result == 200) {
                                    res.send(200, { meta: { status: 200, message: 'success' } });
                                    throw new Error('break promise chain');
                                }
                                else if (response[0].result == 401) {
                                    res.send(404, { meta: { status: 404, message: 'link is not active - sp response' } });
                                    throw new Error('break promise chain');
                                }
                                else if (response[0].result == 404) {
                                    res.send(404, { meta: { status: 404, message: 'no link found - sp response' } });
                                    throw new Error('break promise chain');
                                }
                                else if (response[0].result == 500) {
                                    res.send(500, { meta: { status: 500, message: 'unhandled response - sp response' } });
                                    throw new Error('break promise chain');
                                }
                            });

                    });

                }
                else {
                    res.send(401, { meta: { status: 401, message: 'user is not logged in or invalid token' } });
                }
            }).catch(function (err) {
                if (err.message != 'break promise chain')
                    res.send(500, { meta: { status: 500, message: 'internal server error' }, details: err });
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

// This API is Not In Use
exports.getGoalList = function (req, res) {

    var constraints = {
        "params.id": {
            presence: true
        }
    };


    validate.async(req, constraints).then(success, error);

    function success() {
        helpers.GetListGoal(req.params.id)
            .then(function (result) {
                res.send(result);
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

//for getting user's Linked Goals
exports.getUserLinkedGoals = function (req, res) {

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


    //######################### Validations (Rules) #########################
    var constraints = {
        "params.username": {
            presence: true
        }
    };

    //######################### Validations (Attributes) #########################
    validate.async(req, constraints).then(success, error);

    function success() {
        helpers.getActiveSession(req).then(function (SessionUser) {
            if (SessionUser != null) {
                var userName = req.params.username;

                var obj = req.body;
                new Promise(function (resolve, reject) {
                    return new User(req.params.username, SessionUser.uid).get({ basic: ['uid'] })
                        .then(function (user) {
                            resolve(user[0]);
                        })
                }).then(function (user) {
                    var goal_linked = objAllTables.goal_linked.goal_linked();

                    goal_linked.findAll({ where: { uid: user.uid }, status: 'ACTIVE' }).then(function (IDs) {
                        var goal_ids = _.uniq(_.map(IDs, _.iteratee('to_goal_id')));
                        if (goal_ids.length > 0) {
                            Goal.getList(goalInput, goal_ids, SessionUser.uid).then(function (data) {
                                res.send({
                                    meta: { status: 200, message: 'success' },
                                    data: { goals: data }
                                });
                            })
                        } else {
                            res.send({ meta: { status: 405, message: 'user has no linked goals yet' } });
                        }
                    })
                });
            }
            else
                res.send({ meta: { status: 401, message: 'user is not logged in invalid token' } });
        })
            .error(function (err) {
                res.send({ meta: { status: 500, message: 'internal error' }, details: err });
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

//get session user linked goals with a goal
exports.getLinkedGoalsMe = function (req, res) {


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
        helpers.GetActiveSession_ORM(req)
            .then(function (SessionUser) {
                if (SessionUser != null) {
                    var goal_id = parseInt(req.params.id);

                    var goal_linked = objAllTables.goal_linked.goal_linked();
                    goal_linked.findAll({ where: { to_goal_id: goal_id, uid: SessionUser.uid, status: 'ACTIVE' } })
                        .then(function (IDs) {
                            var goal_ids = _.uniq(_.map(IDs, _.iteratee('from_goal_id')));
                            if (goal_ids.length > 0) {
                                Goal.getList(goalInput, goal_ids, SessionUser.uid).then(function (goals) {
                                    res.send({ meta: { status: 200, message: 'success' }, data: { goals: goals } });
                                })
                            } else {
                                res.send({ meta: { status: 405, message: 'user has no linked goals yet' } });
                            }
                        })
                }
                else
                    res.send({ meta: { status: 401, message: 'user is not logged in invalid token' } });
            })
            .error(function (err) {
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
};

exports.getLinkedGoals = function (req, res) {

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

    //######################### Validations (Rules) #########################
    var constraints = {
        "params.id": {
            presence: true,
            numericality: {
                noStrings: false
            }
        }
    };

    validate.async(req, constraints).then(success, error);

    function success() {
        helpers.GetActiveSession_ORM(req)
            .then(function (SessionUser) {
                if (SessionUser != null) {
                    var goal_id = parseInt(req.params.id);

                    var pagination = utils.pagination(req);

                    var goal_linked = objAllTables.goal_linked.goal_linked();
                    goal_linked.findAll({ where: { from_goal_id: goal_id }, offset: pagination.offset, limit: pagination.limit, status: 'ACTIVE' })
                        .then(function (IDs) {
                            var goal_ids = _.uniq(_.map(IDs, _.iteratee('to_goal_id')));
                            if (goal_ids.length > 0) {
                                Goal.getList(goalInput, goal_ids, SessionUser.uid).then(function (goals) {
                                    res.send({ meta: { status: 200, message: 'success' }, data: { goals: goals } });
                                })
                            } else {
                                res.send({ meta: { status: 200, message: 'user has no linked goals yet' }, data: { goals: [] } });
                            }
                        })
                }
                else
                    res.send(401, { meta: { status: 401, message: 'user is not logged in invalid token' } });
            })
            .error(function (err) {
                res.send(500, { meta: { status: 500, message: 'unexpected error' } });
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

exports.getGoalReport = function (req, res) {

    var constraints = {
        "params.id": {
            presence: true,
            numericality: {
                noStrings: false
            }
        }
    };

    //######################### Validations (Attributes) #########################
    //var attributes = {
    //    id: goal_id
    //};

    validate.async(req, constraints).then(success, error);


    function success() {
        res.send(200, { meta: { status: 200, message: 'success' } });
    }

    function error(errors) {
        if (errors instanceof Error) {
            // This means an exception was thrown from a validator
            console.err("An error ocurred", errors);
        } else {
            res.send({ meta: { status: 401, message: 'validation errors' }, errors: errors });
        }
    }
};

//#####################################################################
//############################### Mute ################################
//#####################################################################

exports.goalMute = function (req, res) {
    var goalId = req.params.id;

    var constraints = {
        "params.id": {
            presence: true
        }
    };

    validate.async(req, constraints).then(success, error);

    function success() {

        helpers.GetActiveSession_ORM(req).then(function (sessionUser) {
            if (sessionUser != null) {
                var goal_mute = objAllTables.goal_mute.goal_mute();
                goal_mute.findOrCreate({
                    where: {
                        uid: sessionUser.uid,
                        goal_id: goalId,
                    },
                    defaults: {
                        created: helpers.getUnixTimeStamp(),
                        status: 'ACTIVE'
                    }
                }).spread(function (goal_mute, created) {
                    res.send(200, { meta: { status: 200, message: 'success' } })
                })
            }
            else {
                res.send(401, { meta: { status: 401, message: 'Unauthorized' } });
            }
        }).error(function (err) {
            res.send({ meta: { status: 401, message: err } });
        });
    }
    function error(errors) {
        if (errors instanceof Error) {
            // This means an exception was thrown from a validator
            console.err("An error ocurred", errors);
        } else {
            res.send({ meta: { status: 401, message: 'validation errors' }, errors: errors });
        }
    };

};

exports.goalUnMute = function (req, res) {
    var goalId = req.params.id;
    helpers.GetActiveSession_ORM(req).then(function (sessionUser) {
        if (sessionUser != null) {
            var goal_mute = objAllTables.goal_mute.goal_mute();
            goal_mute.update({
                status: 'INACTIVE', created: helpers.getUnixTimeStamp()
            }, {
                    where: {
                        uid: sessionUser.uid,
                        goal_id: goalId
                    }
                })

            res.send(200, { meta: { status: 200, message: 'success' } });
        }
        else {
            res.send(401, { meta: { status: 401, message: 'Unauthorized' } });
        }
    }).error(function (err) {
        res.send(401, { meta: { status: 401, message: err } });
    });

};

//#####################################################################
//############################## Media ################################
//#####################################################################

exports.goalUpdateCover = function (req, res) {

    //######################### Validations (Rules) #########################
    var constraints = {
        "body": {
            presence: true
        },
        "body.attach_id": {
            presence: true,
            numericality: {
                noString: true
            }
        },

        "params.id": {
            presence: true,
            numericality: {
                noStrings: false
            }
        }
    };

    //######################### Validations (Attributes) #########################
    /*   var attributes = {
     id: goalId,
     attach_id: attachId
     };*/

    validate.async(req, constraints).then(success, error);

    function success() {
        helpers.GetActiveSession_ORM(req).then(function (sessionUser) {
            if (sessionUser != null) {

                var goalID = req.params.id;
                var attachId = [req.body.attach_id];
                var data = {};

                var goalsCheck = objAllTables.goals.goals();
                goalsCheck.findOne({
                    where: { goal_id: goalID, uid: sessionUser.uid, status: { $ne: 'DELETED' } }
                })
                    .then(function (result) {

                        if (result != null) {

                            //######################### Create Post (start) #########################
                            var posts = require('../controllers/posts');
                            //uid, text, media_id, fetched_url_id, scope_id, post_type, parent_id, req

                            return posts.createPost(sessionUser.uid, "", attachId, null, 1, 'GOAL_IMAGE_UPDATED', goalID, req)
                                .then(function (postObj) {

                                    if (postObj.post != null) {

                                        data.post = postObj.post.dataValues;
                                        //get post object
                                        return helpers.getPost(data.post.id, true, sessionUser.uid)
                                            .then(function (post) {
                                                data.post = post;
                                                res.send(200, {
                                                    meta: { status: 200, message: 'Success' },
                                                    data: data
                                                });
                                            });
                                    }
                                    else {
                                        res.send(500, { meta: { status: 500, message: 'internel error' } });
                                    }
                                    //######################### Create Post (end) #########################
                                }).then(function () {
                                    var goalsUpdate = objAllTables.goals.goals();
                                    return goalsUpdate.update({ updated: helpers.getUnixTimeStamp(), goal_image_id: attachId }
                                        , { where: { goal_id: goalID, uid: sessionUser.uid } })
                                        .then(function (rowsUpdated) {
                                        });

                                }).then(function () {
                                    //######################### Record Activity (start) #########################                                
                                    //record activity and generate feed
                                    var feedController = require('../controllers/feed');

                                    feedController.createActivity(sessionUser.uid, 'GOAL_IMAGE_UPDATED', goalID, null, null, data.post.id);
                                    //######################### Record Activity (end) #########################
                                });
                        }
                        else {
                            res.send(404, { meta: { status: 404, message: "Not Autorized Goal" } });
                        }
                    })

            } else {
                res.send(401, { meta: { status: 401, message: 'Unauthorized' } });
            }
        })
            .error(function (err) {
                res.send(500, { meta: { status: 500, message: 'in error' }, details: err });
            })
            .catch(function (err) {
                res.send(500, { meta: { status: 500, message: 'in catch' }, details: err });
            });
    }

    function error(errors) {
        if (errors instanceof Error) {
            // This means an exception was thrown from a validator
            res.send({ meta: { status: 401, message: 'An error occurred in validator' }, errors: errors });
        }
        else {
            res.send({ meta: { status: 401, message: 'validation errors' }, errors: errors });
        }
    }
};

//#####################################################################
//############################## Suggest ##############################
//#####################################################################

//suggestion for linking goals, based on interest and reverse linking
exports.goalLinkingSuggestion = function (req, res) {

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
    //var attributes = {
    //    goalId: goalId
    //};

    validate.async(req, constraints).then(success, error);

    function success() {
        helpers.GetActiveSession_ORM(req)
            .then(function (SessionUser) {
                if (SessionUser != null) {
                    var goalId = parseInt(req.params.id);

                    var goalsTags = objAllTables.goals_tags.goals_tags();
                    var goalIdsArray = [];
                    return new Promise(function (resolve) {
                        //fetching linkedGoalsIds from provided goalId
                        return helpers.getLinkedGoalIds(goalId)
                            .then(function (linkedGoalsIds) { // linkedGoalIds are array of goalIds
                                resolve(linkedGoalsIds);
                            })
                    })
                        .then(function (linkedGoalsIds) {
                            //now fetching goals based on interest from provided goalId
                            goalsTags.findAll({
                                where: {
                                    goal_id: goalId,
                                    status: 'ACTIVE'
                                }
                            }).then(function (goalsInterest) {
                                if (goalsInterest[0] != null) {
                                    //now iterate over each goals interest's tag id to find goals
                                    var promiseFor = Promise.method(function (condition, action, value) {
                                        if (!condition(value)) return value;
                                        return action(value).then(promiseFor.bind(null, condition, action));
                                    });

                                    promiseFor(function (count) {
                                        return count < goalsInterest.length;
                                    }, function (count) {
                                        //fetching interestGoalIds from tag_id not including the respective goal
                                        return helpers.getGoalIdFromTags(goalsInterest[count].dataValues.tag_id, goalId)
                                            .then(function (interestGoalIds) { // interestGoalIds are array of goalIds
                                                goalIdsArray.push(interestGoalIds);
                                                return ++count;
                                            });
                                    }, 0)
                                        .then(function () {
                                            //converting interestGoalIds multi-dimensional array to single array
                                            // then merge with linkedGoalIds array
                                            // and removing duplicate GOAL IDs from array
                                            var mergedArray = arrayUniq(linkedGoalsIds.concat(helpers.multiArrayToSingleArray(goalIdsArray)));
                                            if (mergedArray.length > 0) {
                                                return new Promise(function (resolveIt) {
                                                    //getting goals object against provided goal ids array
                                                    return helpers.returnGoalObjects(mergedArray, SessionUser)
                                                        .then(function (goalsObj) {
                                                            resolveIt(goalsObj);
                                                        })
                                                })
                                                    .then(function (goalIdsObj) {
                                                        res.send({
                                                            meta: {
                                                                status: 200,
                                                                message: 'Goal Ids for linking suggestion',
                                                                data: goalIdsObj
                                                            }
                                                        });
                                                    })
                                            } else {
                                                res.send({
                                                    meta: {
                                                        status: 401,
                                                        message: 'No Goal Ids found for linking suggestion',
                                                        data: []
                                                    }
                                                });
                                            }
                                        });
                                } else {
                                    //if goal have no interest so find suggestion only linking bases
                                    if (linkedGoalsIds.length > 0) {
                                        return new Promise(function (resolveIt) {
                                            //getting goals object against provided goal ids array
                                            return helpers.returnGoalObjects(linkedGoalsIds, SessionUser)
                                                .then(function (goalsObj) {
                                                    resolveIt(goalsObj);
                                                })
                                        })
                                            .then(function (goalIdsObj) {
                                                res.send({
                                                    meta: {
                                                        status: 200,
                                                        message: 'Goal Ids for linking suggestions',
                                                        data: goalIdsObj
                                                    }
                                                });
                                            })
                                    } else {
                                        res.send({
                                            meta: {
                                                status: 401,
                                                message: 'No Goal Ids found for linking suggestions',
                                                data: []
                                            }
                                        });
                                    }
                                }
                            });
                        });
                }
                else {
                    res.send({
                        meta: {
                            status: 401,
                            message: 'User is not logged in or invalid token'
                        }
                    });

                }
            });
    }

    function error(errors) {
        if (errors instanceof Error) {
            // This means an exception was thrown from a validator
            res.send({ meta: { status: 401, message: 'An error occured in validator' }, errors: errors });
        } else {
            res.send({ meta: { status: 401, message: 'validation errors' }, errors: errors });
        }
    }

};


//get suggested goals based on user "interests" with pagination 
exports.getSuggestedGoal = function (req, res) {

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

    helpers.getActiveSession(req)
        .then(function (sessionUser) {
            if (sessionUser.type == 'Recognized') {

                //pagination
                var pagination = utils.pagination(req);

                //query
                var query = "SELECT DISTINCT\
                            g.goal_id\
                        FROM\
                            goals g\
                        JOIN goals_tags gt ON g.goal_id = gt.goal_id\
                        JOIN user_interest_tags ut ON gt.tag_id = ut.tag_id\
                        WHERE\
                            ut.uid = {0}\
                        AND ut.`status` = 'ACTIVE'\
                        AND g.uid <> {0}\
                        AND g.goal_id NOT IN(SELECT goal_id from goal_followers where follower_uid = {0} and `status` = 'ACTIVE')\
                        AND CheckPrivacy_Goal({0}, g.goal_id) = 1\
                        LIMIT {1}, {2} ".format(sessionUser.uid, pagination.offset, pagination.limit);

                //execuate query
                return sequelize.query(query, { type: sequelize.QueryTypes.SELECT })
                    .then(function (goalIds) {
                        var goalIds_array = _.uniq(_.map(goalIds, _.iteratee('goal_id')));
                        Goal.getList(goalInput, goalIds_array, sessionUser.uid).then(function (goals) {
                            res.send(200, { meta: { status: 200, message: 'OK' }, data: goals });

                        })
                    });
            }
            else if (sessionUser.type == 'UnRecognized') {
                res.send(401, { meta: { status: 401, message: 'user is not logged in' } });
            }
            else {
                res.send(401, { meta: { status: 401, message: 'invalid token' } });
            }
        })
        .error(function (err) {
            res.send(500, { meta: { status: 500, message: 'unexpected error - in error' }, details: err });
        })
        .catch(function (err) {
            res.send(500, { meta: { status: 500, message: 'unexpected error - in catch' }, details: err });
        });
};

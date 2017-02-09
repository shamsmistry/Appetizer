var clasAllTables = require('../models/alltables');
var helpers = require('../helpers/helpers');
var maxmind = require('maxmind');
var validator = require('validator');
var Promise = require("bluebird");
var db = require('../helpers/db');
var posts = require('../controllers/posts');
var validate = require("validate.js");
var utils = require('../helpers/Utils');

var objAllTables = clasAllTables.allTables;

exports.create = function (req, res) {
    //######################### Validations (Rules) #########################
    var constraints = {
        "body": {
            presence: true
        },
        "body.attach_id": {
            presence: false,
            numericality: {
                noStrings: false
            }
        },
        "body.fetched_url_id":{
            presence: false,
            numericality: {
                noStrings: false
            }
        },
        "body.text": {
            presence: false
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
        helpers.GetActiveSession_ORM(req)
        .then(function (SessionUser) {
            if (SessionUser != null) {
                if (SessionUser.permissions.Contribution.create == 1) {
                    var errors = [];
                    var data = {};
                    
                    if ((typeof req.body.text == 'undefined' || validator.isNull(req.body.text) || req.body.text == "") 
                        && 
                        (typeof req.body.attach_id == 'undefined') && (typeof req.body.fetched_url_id == 'undefined')) {
                        errors.push(helpers.generateErrorObject(1001, 'text', 'can not be null/empty'));
                        errors.push(helpers.generateErrorObject(1001, 'fetched_url_id', 'fetched_url_id must be a valid int'));
                        errors.push(helpers.generateErrorObject(1001, 'attach_id', 'attach_id must be a valid int'));
                    }
                    else if ((typeof req.body.attach_id == 'undefined' || validator.isNull(req.body.attach_id) || req.body.attach_id == "")) {
                        req.body.attach_id = null;
                    }
                    
                    var text = req.body.text || '';
                    
                    if (errors.length == 0) {
                        
                        //check goal Privacy, if session user access to this GOAL
                        return utils.checkGoalPrivacy(SessionUser.uid, parseInt(req.params.id))
                        .then(function (response) {
                            
                            //accessible
                            if (response == 1) {
                                //######################### Create Post (start) #########################
                                var posts = require('../controllers/posts');
                                //uid, text, media_id, fetched_url_id, scope_id, post_type, parent_id, req
                                return posts.createPost(SessionUser.uid, text, [req.body.attach_id], req.body.fetched_url_id, 1, 'CONTRIBUTION', parseInt(req.params.id), req)
                                .then(function (postObj) {
                                    
                                    data['post'] = postObj.post.dataValues;
                                    
                                    //get post object
                                    return helpers.getPost(data.post.id, true, SessionUser.uid)
                                    .then(function (post) {
                                        
                                        data.post = post;
                                        res.send(200, { meta: { status: 200, message: 'Success' }, data: data });
                                    });

                                //######################### Create Post (end) #########################
                                })
                            }
                            //no access
                            else if (response == 0) {
                                res.send(401, { meta: { status: 401, message: 'error' }, message: 'goal is private' });
                                throw new Error('break promise chain');
                            }
                            //doesn't exist
                            else if (response == 404) {
                                res.send(404, { meta: { status: 404, message: 'error' }, message: 'goal not found' });
                                throw new Error('break promise chain');
                            }
                            //unexpected response
                            else {
                                res.send(500, { meta: { status: 500, message: 'unexpted response from CheckPrivacy_Goal() database function' } });
                                throw new Error('break promise chain');
                            }
                        })
                        //######################### Record Activity (start) #########################
                        .then(function () {
                            //record activity and generate feed
                            var feedController = require('../controllers/feed');
                            
                            //uid, activity_type, source_id, parent_id, parent_type, post_id)
                            feedController.createActivity(SessionUser.uid, 'CONTRIBUTION', data.post.id, parseInt(req.params.id), 'GOAL', null, true, true);
                            helpers.increment_update_GoalStats( parseInt(req.params.id), 'contributions');
                        })
                        //######################### Record Activity (end) #########################
                        .catch(function (err) {
                            if (err.message == '404')
                                res.send(404, { meta: { status: 404, message: 'not found' } });
                            else
                                throw err;
                        });
                    } 
                    else {
                        res.send(401, { meta: { status: 401, message: 'validation errors' }, errors: errors });
                    }
                }
                else
                    res.send(403, { meta: { status: 403, message: 'permission denied' } });
            }
            else {
                res.send(401, { meta: { status: 401, message: 'User is not logged in or invalid token' } });
            }
        })
        .error(function (err) {
            res.send(500, { meta: { status: 500, message: 'unexpected error' }, details: err });
        })
        .catch(function (err) {
            //it means reponse has ben sent and exception was thrown intentionally
            if (err.message == 'break promise chain') {
                return;
            }
            else
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

//not in use - replaced with "feed.getGoalContributionFeed"
exports.getAll = function (req, res) {
    
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
        helpers.GetActiveSession_ORM(req)
            .then(function (SessionUser) {
            if (SessionUser != null) {
                
                var query = "SELECT id FROM `posts` WHERE post_type = 'CONTRIBUTION' and parent_id = {0}".format(goal_id);
                
                var sequelize = db.sequelizeConn();
                sequelize.query(query, { type: sequelize.QueryTypes.SELECT })
                        .then(function (contributionIDs) {
                    var CONTRIBUTIONS = [];
                    // loop through the goal ids and get goal objects
                    var promiseFor = Promise.method(function (condition, action, value) {
                        if (!condition(value)) return value;
                        return action(value).then(promiseFor.bind(null, condition, action));
                    });
                    
                    promiseFor(function (count) {
                        return count < contributionIDs.length;
                    }, function (count) {
                        return helpers.getPost(contributionIDs[count].id, true, SessionUser.uid)
                                    .then(function (contribution) {
                            CONTRIBUTIONS.push(contribution);
                            return ++count;
                        })
                    }, 0)
                                .then(function () {
                        res.send({ meta: { status: 200, message: 'success' }, data: CONTRIBUTIONS });
                    }
                    );
                });

            }
            else {
                res.send({ meta: { status: 401, message: 'User is not logged in or invalid token' } });
            }
        })
            .error(function (err) {
            res.send({ meta: { status: 500, message: 'unexpected error' }, details: err });
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
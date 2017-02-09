//#############################################################
//##################### Requiring Files #######################
//#############################################################

//npm
var maxmind = require('maxmind');
var validator = require('validator');
var Promise = require("bluebird");
var validate = require("validate.js");

//classes
var db = require('../helpers/db');
var helpers = require('../helpers/helpers');
var posts = require('../controllers/posts');
var clasAllTables = require('../models/alltables');

//instances
var objAllTables = clasAllTables.allTables;

//#############################################################
//########################### APIs ############################
//#############################################################

exports.create = function (req, res) {
    
    //######################### Validations (Rules) #########################
    var constraints = {
        
        "body": {
            presence: true
        },
        
        "body.text": {
            presence: true,
            length: {
                minimum: 1,
                maximum: 150,
                message: "milestone can not contain less than 1 or more than 150 characters"
            }
        },
        "params.gid": {
            presence: true,
            numericality: {
                noStrings: false
            }
        },
        "body.seq_number": {
            presence: true
        }
    };
    
    validate.async(req, constraints).then(success, error);
    
    
    function success() {
        helpers.getActiveSession(req).then(function(SessionUser) {
            if (SessionUser.type == 'Recognized') {
                
                var text = req.body.text;
                var goal_id = parseInt(req.params.gid);
                var seq_number = req.body.seq_number;
                
                if (SessionUser.permissions.Milestones.create == 1) {
                    var goals = objAllTables.goals.goals();
                    goals.findOne({
                        where: { uid: SessionUser.uid, goal_id: req.params.gid }
                    }).then(function (result) {
                        if (result != null) {
                           if(result.dataValues.status != 'ACTIVE' && result.dataValues.status != 'COMPLETED'){
                               res.send(404, { meta: { status: 404, message: 'Not Found' } });
                               throw new Error("break chain");
                           }
                            var milestone = objAllTables.milestone.milestone();
                            milestone.create({
                                text: req.body.text,
                                status: 'ACTIVE',
                                goal_id: req.params.gid,
                                uid: SessionUser.uid,
                                seq_number: req.body.seq_number,
                                created: helpers.getUnixTimeStamp()
                            })
                            .then(function (createdMilestone) {
                                
                                var data = {};
                                data['milestone'] = createdMilestone.dataValues;
                                
                                return data;
                            }).then(function (data) {
                                
                                //######################### Create Post (start) #########################
                                var posts = require('../controllers/posts');
                                //uid, text, media_id, fetched_url_id, scope_id, post_type, parent_id, req
                                return posts.createPost(SessionUser.uid, '', null, null, 1, 'MILESTONE_CREATED', data.milestone.id, req)
                                .then(function (postObj) {
                                    data['post'] = postObj.post;
                                    return helpers.getPost(data['post'].id, true, SessionUser.uid)
                                    .then(function (post) {
                                        data['post'] = post;
                                        res.send(200, { meta: { status: 200, message: 'Success' }, data: data });
                                    });
                                })
                                //######################### Create Post (end) #########################
                                //})
                                //######################### Record Activity (start) #########################
                                .then(function () {
                                    //record activity and generate feed
                                    var feedController = require('../controllers/feed');
                                    
                                    //uid, activity_type, source_id, parent_id, parent_type, post_id)
                                    feedController.createActivity(SessionUser.uid, 'MILESTONE_CREATED', data.milestone.id, data.milestone.goal_id, 'GOAL', data.post.id, true, true);
                                    helpers.increment_update_GoalStats(data.milestone.goal_id, 'milestones');
                                });
                                //######################### Record Activity (end) #########################
                            })
                            .error(function () {
                                res.send(401, { meta: { status: 401, message: 'An error occurred while creating a Milestone.' } });
                            });
                        } else {
                            res.send(401, { meta: { status: 401, message: 'Operation not allowed, Session user does not own this goal' } });
                        }
                    }).catch(function(err){
                        if (err.message != 'break chain')
                            res.send(500, { meta: { status: 500, message: 'Unhandled exception' }, details: err });
                    });
                } else {
                    res.send(403, { meta: { status: 403, message: 'permission denied' } });
                }
            } else {
                res.send(401, { meta: { status: 401, message: 'User is not logged in or invalid token' } });
            }
        })
        .error(function (err) {
            res.send(500, { meta: { status: 500, message: 'unexpected error' }, details: err });
        })
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

exports.getAll = function (req, res) {
    
    //######################### Validations (Rules) #########################
    var constraints = {
        "params.gid": {
            presence: true,
            numericality: {
                noStrings: false
            }
        }
    };
    
    //######################### Validations (Attributes) #########################
    //var attributes = {
    //    gid: goal_id
    //};
    
    validate.async(req, constraints).then(success, error);
    
    function success() {
        helpers.getActiveSession(req).then(function(SessionUser) {
            if (SessionUser.type == 'Recognized' || SessionUser.type == 'UnRecognized') {
                var goal_id = parseInt(req.params.gid);
                
                var milestone = objAllTables.milestone.milestone();
                milestone.findAll({ where: { goal_id: req.params.gid, status: { $ne: 'DELETED' } } })
                        .then(function (result) {
                    if (result != null)
                        res.send({ meta: { status: 200, message: 'Success' }, data: result });
                    else
                        res.send({ meta: { status: 404, message: 'No milestone found against the id provided' } });
                });
            } else {
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
        
        helpers.getActiveSession(req).then(function (SessionUser) {
            if (SessionUser.type == 'Recognized') {
                
                if (SessionUser.permissions.Milestones.delete != 1) {
                    res.send(403, { meta: { status: 403, message: 'permission denied' } });
                    throw new Error('break chain');
                }
                
                //start deletion process
                var milestone = objAllTables.milestone.milestone();
                
                milestone.findOne({
                    where: { id: req.params.id /*, status: 'ACTIVE'*/ },
                    attributes: ['uid', 'goal_id', 'status']
                })
                //check milestone security
                .then(function (milestone) {
                    if (milestone == null || milestone.status == 'DELETED' || milestone.status == 'USERDEACTIVATED') {
                        res.send(404, { meta: { status: 404, message: 'Not Found' } });
                        throw new Error('break chain');
                    }
                    else if (milestone.uid != SessionUser.uid) {
                        res.send(401, { meta: { status: 401, message: 'Unauthorized - session user doesn\'t own the milestone' } });
                        throw new Error('break chain');
                    }
                    else {
                        return milestone;
                    }
                })
                //get goal
                .then(function (milestone) {
                    var goals = objAllTables.goals.goals();
                    
                    return goals.findOne({
                        where: { goal_id: milestone.goal_id /*, status: 'ACTIVE'*/ },
                        attributes: ['uid', 'status', 'goal_id']
                    })
                    .then(function (goal) {
                        return goal;
                    });
                })
                //check goal security
                .then(function (goal) {
                    if (goal == null || goal.status == 'DELETED' || goal.status == 'USERDEACTIVATED') {
                        res.send(404, { meta: { status: 404, message: 'Not Found' } });
                        throw new Error('break chain');
                    }
                    else if (goal.uid != SessionUser.uid) {
                        res.send(401, { meta: { status: 401, message: 'Unauthorized - session user doesn\'t own the goal, so the milestone' } });
                        throw new Error('break chain');
                    }
                    else if (goal.status == 'COMPLETED') {
                        res.send(401, { meta: { status: 401, message: 'Unauthorized - can\'t delete after achieving the goal' } });
                        throw new Error('break chain');
                    }
                    else {
                        return goal;
                    }
                })
                //delete milestone
                .then(function (goal) {
                    var sequelize = db.sequelizeConn();
                    sequelize.query('CALL sp_DeleteMilestoneAndChild({0});'.format(req.params.id))
                    .then(function (response) {
                        if (response[0].TRUE == 1) {
                            res.send(200, { meta: { status: 200, message: 'success' } });

                            helpers.decrement_update_GoalStats(goal.goal_id, 'milestones')
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

exports.complete = function (req, res) {
    
    var id = parseInt(req.params.id);
    //######################### Validations (Rules) #########################
    var constraints = {
        id: {
            presence: true
        }
    };
    
    //######################### Validations (Attributes) #########################
    var attributes = {
        id: id
    };
    
    validate.async(attributes, constraints).then(success, error);
    
    function success() {
        helpers.getActiveSession(req).then(function (SessionUser) {
            if (SessionUser.type == 'Recognized') {
                var milestone = objAllTables.milestone.milestone();
                milestone.findOne({
                    where: {
                        id: req.params.id,
                        uid: SessionUser.uid,
                        status: 'ACTIVE'
                    }
                }).then(function (Milestone) {
                    if (Milestone != null) {
                        
                        milestone.update({
                            status: 'COMPLETED',
                            finished_at: helpers.getUnixTimeStamp()
                        }, {
                            where: {
                                id: req.params.id,
                                uid: SessionUser.uid,
                                status: 'ACTIVE'
                            }
                        }).then(function (updatedMilestone) {
                            if (updatedMilestone == 1) {
                                var data = {};
                                
                                var milestone = objAllTables.milestone.milestone();
                                return milestone.findOne({
                                    where: { id: req.params.id, status: { $ne: 'DELETED' } }
                                })
                                .then(function (milestone) {
                                    
                                    //.then(function (milestone) {
                                    data.milestone = milestone.dataValues;
                                    //}).then(function () {
                                    
                                    //check if image is attached or not
                                    var fileId = [];
                                    if (typeof req.body != 'undefined' && typeof req.body.attach_id != 'undefined' && req.body.attach_id != null)
                                        fileId = [req.body.attach_id];  //if image is attached, create an array for image
                                    
                                    //check if "text" is available
                                    var text = req.body.text || '';
                                    
                                    //######################### Create Post (start) #########################
                                    var posts = require('../controllers/posts');
                                    //uid, text, media_id, fetched_url_id, scope_id, post_type, parent_id, req
                                    return posts.createPost(SessionUser.uid, text, fileId, null, 1, 'MILESTONE_COMPLETED', data.milestone.id, req)
                                                    .then(function (postObj) {
                                        data['post'] = postObj.post;
                                        return helpers.getPost(data['post'].id, true, SessionUser.uid)
                                                            .then(function (post) {
                                            data['post'] = post;
                                            res.send(200, { meta: { status: 200, message: 'Success' }, data: data });
                                        });
                                    });
                                    //######################### Create Post (end) #########################
                                })
                                //######################### Record Activity (start) #########################
                                .then(function () {
                                    //record activity and generate feed
                                    var feedController = require('../controllers/feed');
                                    
                                    //uid, activity_type, source_id, parent_id, parent_type, post_id)
                                    feedController.createActivity(SessionUser.uid, 'MILESTONE_COMPLETED', data.milestone.id, data.milestone.goal_id, 'GOAL', data.post.id, true, true);
                                });
                                //######################### Record Activity (end) #########################
                            } else {
                                res.send(404, { meta: { status: 404, message: 'milestone not found' } });
                            }
                        })
                        .error(function (err) {
                            res.send(401, { meta: { status: 401, message: 'an error occured while updating milestone' }, details: err });
                        });
                    } else {
                        res.send(404, { meta: { status: 404, message: 'no active milestone found, or session user does not own this goal' } });
                    }
                });
            } else {
                res.send(401, { meta: { status: 401, message: 'user is not logged in or invalid token' } });
            }
        })
        .error(function (err) {
            res.send(500, { meta: { status: 500, message: 'unexpected error' }, details: err });
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
    
    //######################### Success #########################
    function success() {
        
        helpers.getActiveSession(req).then(function (SessionUser) {
            if (SessionUser.type == 'Recognized') {
                
                if (SessionUser.permissions.Milestones.edit != 1) {
                    res.send(403, { meta: { status: 403, message: 'permission denied' } });
                    throw new Error('break chain');
                }
                
                //start deletion process
                var milestone = objAllTables.milestone.milestone();
                
                milestone.findOne({
                    where: { id: req.params.id /*, status: 'ACTIVE'*/ },
                    attributes: ['uid', 'goal_id', 'status']
                })
                //check milestone security
                .then(function (milestone) {
                    if (milestone == null || milestone.status == 'DELETED' || milestone.status == 'USERDEACTIVATED') {
                        res.send(404, { meta: { status: 404, message: 'Not Found' } });
                        throw new Error('break chain');
                    }
                    else if (milestone.uid != SessionUser.uid) {
                        res.send(401, { meta: { status: 401, message: 'Unauthorized - session user doesn\'t own the milestone' } });
                        throw new Error('break chain');
                    }
                    else if (milestone.status == 'COMPLETED') {
                        res.send(401, { meta: { status: 401, message: 'Unauthorized - can\'t edit after achieving the milestone' } });
                        throw new Error('break chain');
                    }
                    else {
                        return milestone;
                    }
                })
                //get goal
                .then(function (milestone) {
                    var goals = objAllTables.goals.goals();
                    
                    return goals.findOne({
                        where: { goal_id: milestone.goal_id /*, status: 'ACTIVE'*/ },
                        attributes: ['uid', 'status']
                    })
                    .then(function (goal) {
                        return goal;
                    });
                })
                //check goal security
                .then(function (goal) {
                    if (goal == null || goal.status == 'DELETED' || goal.status == 'USERDEACTIVATED') {
                        res.send(404, { meta: { status: 404, message: 'Not Found' } });
                        throw new Error('break chain');
                    }
                    else if (goal.uid != SessionUser.uid) {
                        res.send(401, { meta: { status: 401, message: 'Unauthorized - session user doesn\'t own the goal, so the milestone' } });
                        throw new Error('break chain');
                    }
                    else if (goal.status == 'COMPLETED') {
                        res.send(401, { meta: { status: 401, message: 'Unauthorized - can\'t edit after achieving the goal' } });
                        throw new Error('break chain');
                    }
                    else {
                        return goal;
                    }
                }).then(function () { // edit milestone
                    
                    var milestone_updateObj = {
                        text: req.body.text
                    };
                    
                    if (typeof req.body.seq_number != "undefined" && req.body.seq_number != null && !isNaN(req.body.seq_number)) {
                        milestone_updateObj.seq_number = parseInt(req.body.seq_number);
                    }
                    
                    milestone.update(milestone_updateObj, { where: { id: req.params.id } }).then(function (updated) {
                        if (updated == 1) {
                            res.send(200, { meta: { status: 200, message: 'Success' } });
                        } else {
                            res.send(500, { meta: { status: 500, message: 'could not update. an error occured while updating' } });
                        }
                    });
                });
            } else {
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
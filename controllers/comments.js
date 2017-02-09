//#############################################################
//##################### Requiring Files #######################
//#############################################################

//npm
var validator = require('validator');
var Promise = require("bluebird");
var validate = require("validate.js");
var valid = require('../helpers/valid');

//others
var clasAllTables = require('../models/alltables');
var helpers = require('../helpers/helpers');
var config = require('../config');
//var commentsController = require("./comments");
var db = require('../helpers/db');
var utils = require('../helpers/Utils');

//instances
var sequelize = db.sequelizeConn();
var objAllTables = clasAllTables.allTables;

var Comment = require('../models/Comment');
var models = require('../models');
var _ = require('lodash');

//#############################################################
//########################## APIs #############################
//#############################################################

exports.createPostComments = function (req, res) {
    
    var finalArray = [];
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
        "body.comment_txt": {
            presence: false
        },
        "body.fetched_url_id" : {
            presence : false,
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
                
                if (validator.equals(req.body.comment_type, 'TEXT') || validator.equals(req.body.comment_type, 'AUDIO') || validator.equals(req.body.comment_type, 'VIDEO') || validator.equals(req.body.comment_type, 'IMAGE')) {
                    
                    var posts = objAllTables.posts.posts();
                    posts.findOne({
                        where: {
                            id: req.params.id, 
                            status: { $ne: 'DELETED' }, 
                            $and: [sequelize.literal('CheckPrivacy_Post({0}, {1}) = 1'.format(sessionUser.uid, req.params.id))]
                        }
                    })
                    .then(function (post) {
                        if (post != null) {
                            var comments = objAllTables.comments.comments();
                            
                            var errors = [];
                            var data = {};
                            
                            if ((typeof req.body.comment_txt == 'undefined' || valid.isNull(req.body.comment_txt) == true || req.body.comment_txt.trimSpace() == "")
                                && (typeof req.body.fetched_url_id == 'undefined')
                                && 
                                (typeof req.body.attach_id == 'undefined')) {
                                errors.push(helpers.generateErrorObject(1001, 'comment_txt', 'can not be null/empty or only spaces'));
                                errors.push(helpers.generateErrorObject(1001, 'fetched_url_id', 'fetched_url_id must be a valid int'));
                                errors.push(helpers.generateErrorObject(1001, 'attach_id', 'attach_id must be a valid int'));
                            }
                            else if ((typeof req.body.attach_id == 'undefined' || validator.isNull(req.body.attach_id) || req.body.attach_id == "")) {
                                req.body.attach_id = null;
                            }
                            
                            if (errors.length == 0) {
                                var commentText = req.body.comment_txt || '';
                                comments.create({
                                    parent_id: parseInt(req.params.id),   //post id
                                    uid: sessionUser.uid,
                                    comment_txt: commentText,
                                    parent_type: 'POST',
                                    comment_type: req.body.comment_type,
                                    fetched_url_id: req.body.fetched_url_id,
                                    file_id: req.body.attach_id,
                                    scope: 'PUBLIC',
                                    status: 'ACTIVE',
                                    created: helpers.getUnixTimeStamp()
                                })
                                .then(function (comment) {
                                        
                                    if (comment != null) {
                                        //GET Mentioned User List
                                        return utils.getMentionedUserId(commentText, sessionUser.uid)
                                            .then(function (result) {
                                            for (var i = 0; i < result.mentionUser.length; i++) {
                                                if (result['mentionUser'][i].validated == true) {
                                                    finalArray.push({ uid: result['mentionUser'][i].uid , finalName: result['mentionUser'][i].finalName });
                                                }
                                            }
                                            return comment;
                                        });
                                    }
                                    else {
                                        new Error({ error: 'comment could not be created', values: { file_id: req.body.attach_id, comment_txt: commentText, comment_type: req.body.comment_type } });
                                    }
                                })
                                .then(function (comment) {
                                    if (req.body.attach_id != null) {
                                        
                                        //set comment as uploaded image's parent
                                        var tableUserFileUploads = objAllTables.user_file_uploads.user_file_uploads();
                                        return tableUserFileUploads.update({
                                            parent_id: comment.dataValues.id,
                                            updated: helpers.getUnixTimeStamp()
                                        }, {
                                            where: {
                                                id: req.body.attach_id
                                            }
                                        }).then(function (update) {
                                            if (update >= 1) {
                                                return comment;
                                            } else {
                                                new Error({ error: 'comment created, error occurred while updating fileId', values: { file_id: fileId, comment_txt: commentText, comment_type: req.body.comment_type } });
                                            }
                                        });
                                    } 
                                    else {
                                        return comment;
                                    }
                                })
                                /*.then(function (comment) {
                                    //create comment object
                                    return helpers.fixComment(comment)
                                    .then(function (comment) {
                                        res.send(200, { meta: { status: 200, message: 'Success' }, data: comment });
                                        
                                        return comment;
                                    });

                                })*/
                                .then(function (comment) {
                                    //Inserting into mentioned_comment
                                    return new Promise(function (resolve, reject) {
                                        //Mentioned User List Insertion
                                        var promiseFor = Promise.method(function (condition, action, value) {
                                            if (!condition(value)) return value;
                                            return action(value).then(promiseFor.bind(null, condition, action));
                                        });
                                        
                                        promiseFor(function (count) {
                                            return count < finalArray.length;
                                        }, function (count) {
                                            //######################### loop body (start) #########################
                                            
                                            var mentioned_comment = objAllTables.mentioned_comment.mentioned_comment();
                                            return mentioned_comment.findOrCreate({
                                                where: {
                                                    uid: sessionUser.uid,
                                                    mentioned_uid: finalArray[count].uid,
                                                    comment_id: comment.id
                                                },
                                                defaults: {
                                                    created: helpers.getUnixTimeStamp(),
                                                    status: 'ACTIVE',
                                                    post_id: req.params.id,
                                                    mentioned_name: finalArray[count].finalName,
                                                    comment_id: comment.id
                                                }
                                            }).spread(function (updated, created) {
                                                
                                                return ++count;
                                            })

                                        //######################### loop body (end) #########################
                                        }, 0)
                                        .then(function () {
                                            resolve(comment);
                                        });
                                    });
                                    
                                    //return comment

                                })
                                .then(function (comment) {
                                    //create comment object
                                    helpers.fixComment(comment)
                                    .then(function (commentObj) {
                                        res.send(200, { meta: { status: 200, message: 'Success' }, data: commentObj });
                                        
                                        return commentObj;
                                    });

                                    return comment;
                                })
                                //######################### Record Activity (start) #########################
                                .then(function (comment) {
                                    //record activity and generate feed
                                    var feedController = require('../controllers/feed');
                                    
                                    //uid, activity_type, source_id, parent_id, parent_type, post_id)
                                    feedController.createActivity(sessionUser.uid, 'COMMENT', comment.id, req.params.id, 'POST', null, true, true);

                                    helpers.increment_update_PostStats(req.params.id, 'comments');
                                })
                                //######################### Record Activity (end) #########################
                                /*.catch(function (err) {
                                    res.send(401, { meta: { status: 401, message: 'an error occurred on posting a comment' }, details: err });
                                });*/
                            }
                            else {
                                res.send(401, { meta: { status: 401, message: 'validation errors' }, errors: errors });

                            }
                        }
                        else
                            res.send(404, { meta: { status: 404, message: 'Post not found ' } });
                    });
                }
                //comment Type validation failed
                else {
                    res.send(401, { meta: { status: 401, message: 'comment Type Not matched' } });
                }
            }
            //session user is null
            else {
                res.send(401, { meta: { status: 401, message: 'user is not logged in or invalid token' } });
            }
        })
        .error(function (err) {
            res.send(500, { meta: { status: 500, message: 'linkagoal server internal error' } });
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

exports.updatePostComments = function (req, res) {
    
    //######################### Validations (Rules) #########################
    var constraints = {
        "body": {
            presence: true
        },
        "body.attach_id": {
            presence: false
        },
        
        "body.comment_txt": {
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
                if (validator.equals(req.body.comment_type, 'TEXT') || validator.equals(req.body.comment_type, 'AUDIO') || validator.equals(req.body.comment_type, 'VIDEO') || validator.equals(req.body.comment_type, 'IMAGE')) {
                    
                    var comments = objAllTables.comments.comments();
                    comments.findOne({
                        where: {
                            id: req.params.id,
                            uid: SessionUser.uid,
                            status: { $ne: 'DELETED' },
                            parent_type: 'POST'
                        }
                    }).then(function (comment) {
                        if (comment != null) {
                            if (comment.dataValues.uid == SessionUser.uid) {
                                
                                if (req.body.attach_id != null) {
                                    comments.update({
                                        comment_txt: req.body.comment_txt,
                                        comment_type: req.body.comment_type,
                                        fetched_url_id: req.body.fetched_url_id,
                                        file_id: req.body.attach_id,
                                        updated: helpers.getUnixTimeStamp()
                                    }, {
                                        where: {
                                            id: req.params.id
                                        }

                                    }).then(function (data) {
                                        if (data == 1) {
                                            var tableUserFileUploads = objAllTables.user_file_uploads.user_file_uploads();
                                            tableUserFileUploads.update({
                                                parent_id: req.params.id,
                                                updated: helpers.getUnixTimeStamp()
                                            }, {
                                                where: {
                                                    id: req.body.attach_id
                                                }
                                            }).then(function (update) {
                                                if (update == 1) {
                                                    res.send({ meta: { status: 200, message: 'Success' } });
                                                } else {
                                                    res.send({
                                                        meta: {
                                                            status: 401,
                                                            message: 'an error occurred while updating comment'
                                                        }
                                                    });
                                                }
                                            });
                                        } else {
                                            res.send({
                                                meta: {
                                                    status: 401,
                                                    message: 'an error occurred while updating comment'
                                                }
                                            });
                                        }
                                    }).error(function (data) {
                                        res.send({
                                            meta: {
                                                status: 401,
                                                message: 'an error occurred while updating comment'
                                            }
                                        });
                                    });
                                }
                                else {
                                    comments.update({
                                        comment_txt: req.body.comment_txt,
                                        comment_type: req.body.comment_type,
                                        fetched_url_id: req.body.fetched_url_id,
                                        updated: helpers.getUnixTimeStamp()
                                    }, {
                                        where: {
                                            id: req.params.id
                                        }

                                    }).then(function (data) {
                                        if (data == 1) {
                                            res.send({ meta: { status: 200, message: 'Success' } });
                                        } else {
                                            res.send({
                                                meta: {
                                                    status: 401,
                                                    message: 'an error occurred while updating comment'
                                                }
                                            });
                                        }
                                    }).error(function (data) {
                                        res.send({
                                            meta: {
                                                status: 401,
                                                message: 'an error occurred while updating comment'
                                            }
                                        });
                                    });
                                }
                            }
                            else
                                res.send({ meta: { status: 403, message: 'Session user does not own this comment' } });
                        }
                        else
                            res.send({ meta: { status: 404, message: 'comment not found' } });
                    });
                }

                else {
                    res.send({ meta: { status: 401, message: 'comment type not satisfied' } });
                }
            }
            //session user is null
            else {
                res.send({ meta: { status: 401, message: 'user is not logged in or invalid token' } });
            }
        })
        .error(function (err) {
            res.send({ meta: { status: 500, message: 'linkagoal server internal error' } });
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

exports.deletePostComments = function (req, res) {
    
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
                
                //check owner ship
                var comments = objAllTables.comments.comments();
                
                return comments.findOne({
                    where: { id: req.params.id, status: 'ACTIVE' },
                    attributes: ['uid','parent_id']
                })
                //security checks
                .then(function (comment) {
                    if (comment == null) {
                        res.send(404, { meta: { status: 404, message: 'Not Found' } });
                        throw new Error('break chain');
                    }
                    else if (comment.uid != sessionUser.uid) {
                        //check if session user is Post Owner

                        var posts = objAllTables.posts.posts();
                        
                        return posts.findOne({
                            where: { id: comment.parent_id, status: 'ACTIVE' },
                            attributes: ['uid']
                        })
                        //security checks
                        .then(function (post) {
                            if (post == null) {
                                res.send(404, { meta: { status: 404, message: 'Post Not Found' } });
                                throw new Error('break chain');
                            }
                            else if (post.uid == sessionUser.uid) {
                                return comment;
                            }
                            else {
                                res.send(401, { meta: { status: 401, message: 'Unauthorized - session user doesn\'t own the comment' } });
                                throw new Error('break chain');
                            }
                        });
                    }
                    else {
                        return comment;
                    }
                })
                //delete comment
                .then(function (comment) {
                    var sequelize = db.sequelizeConn();
                    sequelize.query('CALL sp_DeleteCommentAndChild({0});'.format(req.params.id))
                    .then(function (response) {
                        if (response[0].TRUE == 1) {
                            res.send(200, { meta: { status: 200, message: 'success ' } });

                            helpers.decrement_update_PostStats(comment.parent_id , 'comments')
                        }
                        else {
                            res.send(500, { meta: { status: 500, message: 'could not delete. an error occured in stored procedure' } });
                        }
                    });
                });
            }
            else {
                res.send(401, { meta: { status: 401, message: 'Unauthorized - session expired' } });
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

exports.getAllComments = function (req, res) {
    
    var constraints = {
        "params.id": {
            presence: true
        }
    };
    
    validate.async(req, constraints).then(success, error);
    
    function success() {
        
        helpers.getActiveSession(req)
        .then(function (sessionUser) {
            if (sessionUser.type == 'Recognized' || sessionUser.type == 'UnRecognized') {

                var pagination  = utils.pagination(req);

                var input = { basic: ['text', 'created'], user: { user_basic: ['name', 'username', 'email', 'link'],
                    profile: ['small', 'medium'], }, image: ['small', 'medium'],  embeddedUrl: true };
                //######################### Get Comments (start) #########################
                models.comments.findAll( { attributes : ['id'], where : { parent_id : req.params.id, status: 'ACTIVE' }, offset: pagination.offset, limit: pagination.limit, order: 'id DESC' }).then(function(IDs){
                    var ids = _.compact(_.uniq(_.map(IDs, _.iteratee('id'))));

                    Comment.getList(input, ids, sessionUser.uid).then(function(comments){
                        comments = _.orderBy(comments, ['id'], ['asc']);
                        res.send(200, { meta: { status: 200, message: 'success' }, data: comments });
                    });
                });
                //######################### Get Comments (End) ###########################               
            }
            else {
                res.send(401, { meta: { status: 401, message: 'invalid token' } });
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

exports.getAllComments_old = function (req, res) {

    var constraints = {
        "params.id": {
            presence: true
        }
    };

    validate.async(req, constraints).then(success, error);

    function success() {

        helpers.getActiveSession(req)
            .then(function (sessionUser) {
                if (sessionUser.type == 'Recognized' || sessionUser.type == 'UnRecognized') {


                    var pagination = utils.pagination(req);

                    //######################### Get Comments (start) #########################

                    helpers.getPostComments(req.params.id, sessionUser.uid, pagination.offset, pagination.limit)
                        .then(function (comments) {
                            res.send(200, { meta: { status: 200, message: 'success' }, data: comments });
                        });
                    //######################### Get Comments (End) ###########################
                }
                else {
                    res.send(401, { meta: { status: 401, message: 'invalid token' } });
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
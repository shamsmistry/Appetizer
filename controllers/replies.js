//import modules
var helpers = require('../helpers/helpers');
var validator = require('validator');
var Promise = require("bluebird");
var validate = require("validate.js");
var config = require('../config');
var repliesController = require("./replies");

//instances
var clasAllTables = require('../models/alltables');
var objAllTables = clasAllTables.allTables;
var utilityFile = require('../helpers/Utils');

//Replies on Post

exports.createPostCommentReplies = function (req, res) {
    var finalArray=[];
   //######################### Validations (Rules) #########################
    var constraints = {
        
        "body": {
            presence: true
            },
        "params.id": {
            presence: true,
            numericality: {
                noStrings: false
            }
        }
    };

    //######################### Validations (Attributes) #########################
    //var attributes = {
    //    id: commentId
    //};

    validate.async(req, constraints).then(success, error);

    function success() {
        helpers.GetActiveSession_ORM(req)
            .then(function (SessionUser) {
                if (SessionUser != null) {
                var commentId = parseInt(req.params.id);
    
                    var data = {};

                    var comments = objAllTables.comments.comments();
                    comments.findOne({
                        where: {
                            id: commentId,
                            status: {$ne: 'DELETED'},
                            parent_type: 'POST'
                        }
                    })
                        .then(function (comment) {

                            if (comment != null) {
                                data.commentId = comment.dataValues.id;
                                data.postId = comment.dataValues.parent_id;

                                var post_replies = objAllTables.post_replies.post_replies();
                                return post_replies.create({
                                    parent_id: commentId,
                                    uid: SessionUser.uid,
                                    reply: req.body.reply,
                                    status: 'ACTIVE',
                                    created: helpers.getUnixTimeStamp()
                                })
                                .then(function (createdReply) {
                                    data.replyId = createdReply.dataValues._id;
                                    res.send({meta: {status: 200, message: 'Success'}, data: createdReply});
                                    return data;

                                }).then(function(){
                                        //GET Mentioned User List
                                        return utilityFile.getMentionedUserId(req.body.reply, SessionUser.uid)
                                            .then(function(result){
                                                for(var i =0;i<result.mentionUser.length;i++){
                                                    if(result['mentionUser'][i].validated == true )
                                                    {
                                                        finalArray.push({uid:result['mentionUser'][i].uid ,finalName:result['mentionUser'][i].finalName});
                                                    }
                                                }
                                                return data;
                                            });
                                });
                            }
                            else {
                                res.send({meta: {status: 404, message: 'comment not found'}});
                                throw new Error('abort promise chain');
                            }
                        }).then(function(data){

                            //Inserting into mentioned_comment_reply
                            new Promise(function (resolve, reject) {
                                //Mentioned User List Insertion
                                var promiseFor = Promise.method(function (condition, action, value) {
                                    if (!condition(value)) return value;
                                    return action(value).then(promiseFor.bind(null, condition, action));
                                });

                                promiseFor(function (count) {
                                    return count < finalArray.length;
                                }, function (count) {
                                    //######################### loop body (start) #########################

                                    var mentioned_reply_comment = objAllTables.mentioned_reply_comment.mentioned_reply_comment();
                                    return  mentioned_reply_comment.findOrCreate({
                                        where: {
                                            uid: SessionUser.uid,
                                            mentioned_uid: finalArray[count].uid,
                                            reply_id:data.replyId
                                        },
                                        defaults: {
                                            created: helpers.getUnixTimeStamp(),
                                            status: 'ACTIVE',
                                            post_id: data.postId,
                                            mentioned_name: finalArray[count].finalName,
                                            reply_id:data.replyId
                                        }
                                    }).spread(function (updated, created) {

                                        return ++count;
                                    })

                                    //######################### loop body (end) #########################
                                }, 0)
                                    .then(function () {
                                        resolve(finalArray);

                                    });
                            });

                            return data

                        })
                        //######################### Record Activity (start) #########################
                        .then(function (data) {
                            //record activity and generate feed
                            var feedController = require('../controllers/feed');

                            //uid, activity_type, source_id, parent_id, parent_type, post_id)
                            feedController.createActivity(SessionUser.uid, 'REPLY_ON_POSTCOMMENT', data.replyId, data.postId, 'POST', null, false, false);
                        })
                        //######################### Record Activity (end) #########################
                        //handle errors
                        .catch(function (err) {
                            console.log(err);
                            if (err.message === 'abort promise chain') {
                                // just swallow error because chain was intentionally aborted
                                /*res.send({meta: {status: 200, message: 'no goals are tagged with this tag'},data: data});*/
                                res.end();
                            }
                            else {
                                // else let the error bubble up because it's coming from somewhere else
                                res.send({meta: {status: 500, message: 'internal error'}, details: err});
                            }
                        });
                }
                //session user is null
                else {
                    res.send({meta: {status: 401, message: 'user is not logged in or invalid token'}});
                }
            })
            .error(function (err) {
                res.send({meta: {status: 500, message: 'linkagoal server internal error'}});
            });
    }

    function error(errors) {
        if (errors instanceof Error) {
            // This means an exception was thrown from a validator
            res.send({meta: {status: 401, message: 'An error ocuured in validator'}, errors: errors});
        } else {
            res.send({meta: {status: 401, message: 'validation errors'}, errors: errors});
        }
    }
}

exports.updatePostCommentReplies = function (req, res) {
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
    //    id: replyId
    //};

    validate.async(req, constraints).then(success, error);

    function success() {
        helpers.GetActiveSession_ORM(req)
            .then(function (SessionUser) {
            if (SessionUser != null) {
                    var replyId = parseInt(req.params.id);
    

                    var post_replies = objAllTables.post_replies.post_replies();
                    post_replies.findOne({
                        where: {
                            _id: replyId,
                            status: {$ne: 'DELETED'}

                        }
                    }).then(function (reply) {
                        if (reply != null) {

                            if (reply.dataValues.uid == SessionUser.uid) {
                                post_replies.update({
                                    reply: req.body.reply,
                                    updated: helpers.getUnixTimeStamp()
                                }, {
                                    where: {
                                        _id: replyId
                                    }
                                })
                                    .then(function (data) {
                                        if (data == 1) {
                                            res.send({meta: {status: 200, message: 'Success'}});
                                        }
                                        else
                                            res.send({meta: {status: 400, message: 'Error'}});
                                    })
                                    .error(function () {
                                        res.send({
                                            meta: {
                                                status: 401,
                                                message: 'errror occured while updating the reply'
                                            }
                                        });
                                    });
                            }
                            else
                                res.send({meta: {status: 403, message: 'Session User does not own this reply'}});
                        }
                        else
                            res.send({meta: {status: 404, message: 'reply not found'}});
                    })

                }
                //session user is null
                else {
                    res.send({meta: {status: 401, message: 'user is not logged in or invalid token'}});
                }
            })
            .error(function (err) {
                res.send({meta: {status: 500, message: 'linkagoal server internal error'}});
            });
    }

    function error(errors) {
        if (errors instanceof Error) {
            // This means an exception was thrown from a validator
            res.send({meta: {status: 401, message: 'An error ocuured in validator'}, errors: errors});
        } else {
            res.send({meta: {status: 401, message: 'validation errors'}, errors: errors});
        }
    }
}

exports.deletePostCommentReplies_Old = function (req, res) {
    var replyId = parseInt(req.params.id);
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
        id: replyId
    };

    validate.async(attributes, constraints).then(success, error);

    function success() {
        helpers.GetActiveSession_ORM(req)
            .then(function (SessionUser) {
                if (SessionUser != null) {

                    var post_replies = objAllTables.post_replies.post_replies();
                    post_replies.findOne({
                        where: {
                            _id: replyId,
                            status: {$ne: 'DELETED'}
                        }
                    }).then(function (reply) {
                        //checking if user own`s this reply
                        if (reply != null) {
                            if (reply.dataValues.uid == SessionUser.uid) {
                                return repliesController.deleteReply(replyId)
                                    .then(function (result) {
                                        if (result == true) {
                                            res.send({meta: {status: 200, message: 'Success'}});
                                        } else {
                                            res.send({
                                                meta: {
                                                    status: 401,
                                                    message: 'errror occured while deleting the reply'
                                                }
                                            });
                                        }
                                    })
                            } else {

                                //checking user own's this comment on which this reply was give
                                var comments = objAllTables.comments.comments();
                                comments.findOne({
                                    where: {
                                        id: reply.dataValues.parent_id
                                    }
                                }).then(function (comment) {
                                    if (comment != null) {
                                        if (comment.uid == SessionUser.uid) {
                                            return repliesController.deleteReply(replyId)
                                                .then(function (result) {
                                                    if (result == true) {
                                                        res.send({meta: {status: 200, message: 'Success'}});
                                                    } else {
                                                        res.send({
                                                            meta: {
                                                                status: 401,
                                                                message: 'errror occured while deleting the reply'
                                                            }
                                                        });
                                                    }
                                                });
                                        } else {
                                            var posts = objAllTables.posts.posts();
                                            posts.findOne({
                                                where: {
                                                    id: comment.dataValues.parent_id
                                                }
                                            })
                                                .then(function (post) {
                                                    if (post != null) {
                                                        if (post.uid == SessionUser.uid) {
                                                            return repliesController.deleteReply(replyId)
                                                                .then(function (result) {
                                                                    if (result == true) {
                                                                        res.send({
                                                                            meta: {
                                                                                status: 200,
                                                                                message: 'Success'
                                                                            }
                                                                        });
                                                                    } else {
                                                                        res.send({
                                                                            meta: {
                                                                                status: 401,
                                                                                message: 'errror occured while deleting the reply'
                                                                            }
                                                                        });
                                                                    }
                                                                })
                                                        }
                                                        else {
                                                            res.send({
                                                                meta: {
                                                                    status: 403,
                                                                    message: 'Session user does not own this reply or comment on which reply was given or  post on which comment was done'
                                                                }
                                                            });
                                                        }
                                                    } else {
                                                        res.send({
                                                            meta: {
                                                                status: 403,
                                                                message: 'Session user does not own this reply or comment on which reply was given or  post on which comment was done'
                                                            }
                                                        });
                                                    }
                                                })
                                        }
                                    } else {
                                        res.send({
                                            meta: {
                                                status: 403,
                                                message: 'Session user does not own this reply or comment on which reply was given or  post on which comment was done'
                                            }
                                        });
                                    }
                                })
                            }
                        }
                        else
                            res.send({meta: {status: 404, message: 'reply not found'}});
                    })
                }
                //session user is null
                else {
                    res.send({meta: {status: 401, message: 'user is not logged in or invalid token'}});
                }
            })
            .error(function (err) {
                res.send({meta: {status: 500, message: 'linkagoal server internal error'}});
            });
    }

    function error(errors) {
        if (errors instanceof Error) {
            // This means an exception was thrown from a validator
            res.send({meta: {status: 401, message: 'An error ocuured in validator'}, errors: errors});
        } else {
            res.send({meta: {status: 401, message: 'validation errors'}, errors: errors});
        }
    }
}

exports.deletePostCommentReplies = function (req, res) {
    var replyId = parseInt(req.params.id);
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
        id: replyId
    };

    validate.async(attributes, constraints).then(success, error);

    function success() {
        helpers.GetActiveSession_ORM(req)
            .then(function (SessionUser) {
                if (SessionUser != null) {

                    var sequelize = db.sequelizeConn();
                    sequelize.query('CALL sp_DeleteReplyOnPost({0});').format(replyId)
                        .then(function (response) {
                            if (response[0].TRUE == 1) {
                                res.send({meta: {status: 200, message: 'success (user Blocked)'}});
                            }
                        }).error(function (err) {
                            res.send({meta: {status: 500, message: 'Internel Error', data: err}});
                        });
                }
                //session user is null
                else {
                    res.send({meta: {status: 401, message: 'user is not logged in or invalid token'}});
                }
            })
            .error(function (err) {
                res.send({meta: {status: 500, message: 'linkagoal server internal error'}});
            });
    }

    function error(errors) {
        if (errors instanceof Error) {
            // This means an exception was thrown from a validator
            res.send({meta: {status: 401, message: 'An error ocuured in validator'}, errors: errors});
        } else {
            res.send({meta: {status: 401, message: 'validation errors'}, errors: errors});
        }
    }
}

exports.getAllPostCommentReplies = function (req, res) {
    
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
                
                var errors = [];
                
                //######################### Validations (start) #########################
                var limit;
                var offset;
                
                //offset
                if (validator.isNull(req.query.offset))
                    offset = config.pagination.offset;
                else if (validator.isInt(req.query.offset))
                    offset = req.query.offset;
                else
                    errors.push(helpers.generateErrorObject(1001, 'offset', 'offset is not a valid integer'));
                
                //limit
                if (validator.isNull(req.query.limit))
                    limit = config.pagination.limit;
                else if (validator.isInt(req.query.offset))
                    limit = req.query.limit;
                else
                    errors.push(helpers.generateErrorObject(1001, 'limit', 'limit is not a valid integer'));
                
                //######################### Validations (end) #########################
                
                //if no errors found, proceed and create goal
                if (errors.length == 0) {
                    //######################### Get Post Comment Replies (start) #########################
                    
                    helpers.getPostCommentsReplies(req.params.id, SessionUser.uid, offset, limit)
                        .then(function (replies) {
                        if (replies.length > 0) {
                            res.send({ meta: { status: 200, message: 'success' }, data: replies });
                        } else {
                            res.send({ meta: { status: 401, message: 'no replies found for this comment' } });
                        }
                    });

                    //######################### Get Post Comment Replies (End) ###########################
                }
                //validation errors exist, send response
                else {
                    res.send({ meta: { status: 401, message: 'validation errors' }, errors: errors });
                }
            }
            else {
                res.send({ meta: { status: 401, message: 'user is not logged in or invalid token' } });
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

exports.deleteReply = function (replyId) {
    return new Promise(function (resolve) {
        var post_replies = objAllTables.post_replies.post_replies();
        return post_replies.update({
            status: 'DELETED'
        }, {
            where: {
                _id: replyId
            }
        })
            .then(function (data) {
                if (data == 1) {
                    resolve(true);
                }
                else {
                    resolve(false);
                }
            })
            .error(function () {
                resolve(false);
            });
    })
        .then(function (result) {
            return result;
        });
}

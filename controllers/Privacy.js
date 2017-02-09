//import modules
var clasAllTables = require('../models/alltables');
var helpers = require('../helpers/helpers');
var maxmind = require('maxmind');
var validator = require('validator');
var Promise = require("bluebird");
var db = require('../helpers/db');
var Utils = require('../helpers/Utils');

var validate = require("validate.js");
var config = require('../config');
var users = require('./user');
var objAllTables = clasAllTables.allTables;
var sequelize = db.sequelizeConn();



exports.changeGoalPrivacy = function (req,res){

    var constraints = {
        "body": {
            presence: true
        },
        "body.scope_id": {
            "presence": true,
            "numericality": {
                noString: true
            }
        }
    };

    validate.async(req, constraints).then(success, error);


    function success() {
        var goals = objAllTables.goals.goals();
        helpers.GetActiveSession_ORM(req)
            .then(function (SessionUser) {
                    if (SessionUser != null) {

                        var errors = [];
                        if (+req.body.scope_id > 5 || +req.body.scope_id < 1) {  //because "privacy_scope" table has 5 values
                            errors.push(helpers.generateErrorObject(1001, 'scope_id', 'invalid privacy scope id (not in range of 1 - 5)'));
                        }
                        else if (+req.body.scope_id == 4 && Array.isArray(req.body.users) == false ) {
                            errors.push(helpers.generateErrorObject(1001,'scope_id', 'specific user must be an array'));
                        }

                        else if (+req.body.scope_id == 4 && req.body.users.length == 0 ) {
                            errors.push(helpers.generateErrorObject(1001,'scope_id', 'specific user array must be greater than 0'));
                        }

                        if (errors.length == 0) {

                            /*goals.update({scope_id: req.body.scope_id}, {
                                where: {goal_id: req.params.id,
                                uid: SessionUser.uid,
                                status: {$ne: 'DELETED'}
                            }}).then(function (result) {
                                if (result == 1) {
                                    res.send(200, {meta: {status: 200, message: 'Privacy Has been Changed'}});
                                } else {
                                    res.send(400, {meta: {status: 400, message: 'Error'}});
                                }
                            });*/
                            goals.findOne({ where : { goal_id: req.params.id,uid: SessionUser.uid,status : 'ACTIVE' } }).then(function(goal){
                                if(goal == null){
                                    res.send(404, {meta: {status: 404, message: 'No goal found'}});
                                }
                                else{
                                    var sequelize = db.sequelizeConn();
                                    sequelize.query('CALL sp_ChangePrivacy_Goal( {0},{1} )'.format(req.params.id,req.body.scope_id)).then(function(result){
                                        res.send(200, {meta: {status: 200, message: 'Privacy Has been Changed'}});
                                    });
                                }
                            });
                        } 
                        else {
                            res.send(401, { meta: { status: 401, message: 'validation errors' }, errors: errors });
                        }

                    }
                    else {
                        res.send(401, {meta: {status: 401, message: 'user is not logged in invalid token'}});
                    }

            }).error(function (err) {
                res.send(500, {meta: {status: 500, message: 'internal error'}, details: err});
            });
    }

    function error(errors) {
        if (errors instanceof Error) {
            // This means an exception was thrown from a validator
            res.send(401, { meta: { status: 401, message: 'An error occurred in validator' }, errors: errors });
        } else {
            res.send(401, { meta: { status: 401, message: 'validation errors' }, errors: errors });
        }
    };
};

exports.changePostPrivacy = function (req, res) {
    var constraints = {
        "body": {
            presence: true
        },
        "body.scope_id": {
            "presence": true,
            "numericality": {
                noString: true
            }
        }
    };
    validate.async(req, constraints).then(success, error);
    
    function success() {
        helpers.GetActiveSession_ORM(req).
            then(function (sessionUser) {
            if (sessionUser != null) {
                var SessionId = sessionUser.uid;
                var tablePost = objAllTables.posts.posts();
                
                var errors = [];
                if (+req.body.scope_id > 5 || +req.body.scope_id < 1) {  //because "privacy_scope" table has 5 values
                    errors.push(helpers.generateErrorObject(1001, 'scope_id', 'invalid privacy scope id (not in range of 1 - 5)'));
                }
                else if (+req.body.scope_id == 4 && Array.isArray(req.body.users) == false) {
                    errors.push(helpers.generateErrorObject(1001, 'scope_id', 'specific user must be an array'));
                }

                else if (+req.body.scope_id == 4 && req.body.users.length == 0) {
                    errors.push(helpers.generateErrorObject(1001, 'scope_id', 'specific user array must be greater than 0'));
                }
                
                if (errors.length == 0) {
                    /*return tablePost.update({
                        scope_id: req.body.scope_id
                    }, {
                        where: {
                            uid: SessionId,
                            id : req.params.id,
                            post_type : {
                                $notIn : ['CONTRIBUTION', 'MILESTONE_CREATED', 'MILESTONE_COMPLETED', 'GOAL_CREATED', 'PROGRESS_UPDATED', 'GOAL_ACHIEVED', 'GOAL_FOLLOWED', 'GOAL_IMAGE_UPDATED', 'LINK_GOAL', 'PROFILE_PICTURE_UPDATED', 'PROFILE_COVER_UPDATED']
                            },
                            status : {
                                $ne : 'Deleted'
                            }
                        }
                    }).then(function (result) {
                        if (result == 1) {
                            res.send(200, { meta: { status: 200, message: "privacy has been changed" } });
                        } else {
                            res.send(400, { meta: { status: 400, message: 'Error' } });
                        }
                    })*/
                    tablePost.findOne( {where: { uid: SessionId, id : req.params.id,status : 'ACTIVE' }} ).then(function(post){
                        if(post == null){
                            res.send(404, { meta : {status : 404, message : 'post not found'} });
                            throw new Error('break chain');
                        }

                        else if (post.post_type == 'STATUS_UPDATE' &&  post.media_id != null) {
                            var user_file_upload = objAllTables.user_file_uploads.user_file_uploads();
                            return user_file_upload.findOne({ where: { post_id: req.params.id, status: 'ACTIVE' } })
                                .then(function (result) {
                                    //post not found
                                    if (result == null) {
                                        res.send(404, {meta: {status: 404, message: 'post not found'}});
                                        throw new Error('break chain');
                                    }
                                    //privacy cannot be change
                                    else if (result.album_id == null){
                                        res.send(401, {meta: {status: 401, message: 'privacy not changed'}});
                                        throw new Error('break chain');
                                    }
                                    else{
                                        return;
                                    }
                                });
                        }
                        else if(post.post_type == 'CONTRIBUTION' || post.post_type == 'MILESTONE_CREATED' ||
                            post.post_type =='MILESTONE_COMPLETED' || post.post_type == 'GOAL_CREATED' || post.post_type == 'PROGRESS_UPDATED' || post.post_type == 'GOAL_ACHIEVED'
                            || post.post_type == 'GOAL_FOLLOWED' || post.post_type == 'GOAL_IMAGE_UPDATED' || post.post_type == 'LINK_GOAL' || post.post_type == 'PROFILE_PICTURE_UPDATED'
                            || post.post_type == 'PROFILE_COVER_UPDATED'){
                            res.send(401, {meta: {status: 401, message: 'privacy of this post cannot be changed'}});
                            throw new Error('break chain');
                        }
                        else{
                            return;
                        }
                    }).then(function() {
                        var sequelize = db.sequelizeConn();
                        sequelize.query('CALL sp_ChangePrivacy_Post({0},{1})'.format(req.params.id, req.body.scope_id)).then(function (result) {
                            if (result[0].resultUpdatePrivacy == 200) {
                                res.send(200, {meta: {status: 200, message: "privacy has been changed"}});
                            }
                            else if (result[0].resultUpdatePrivacy == 201) {
                                res.send(200, {meta: {status: 200, message: "privacy has been changed"}});
                            }
                            else {
                                res.send(401, {meta: {status: 401, message: 'privacy not changed'}});
                            }
                        });
                    }).catch(function(err){
                        if(err.message != 'break chain')
                            res.send(500, {meta: {status: 500, message: 'privacy not changed'}, details : err});
                    });
                }
                else {
                    res.send(401, { meta: { status: 401, message: 'validation errors' }, errors: errors });
                }
            }
            else {
                res.send(401, { meta: { status: 401, message: 'User is not logged in or invalid token' } });
            }
        });
    }
    
    function error(errors) {
        if (errors instanceof Error) {
            // This means an exception was thrown from a validator
            res.send(401, { meta: { status: 401, message: 'An error occurred in validator' }, errors: errors });
        } else {
            res.send(401, { meta: { status: 401, message: 'validation errors' }, errors: errors });
        }
    };
};

exports.changeProfilePrivacy = function(req,res){
    var constraints = {
        "body": {
            presence: true
        },
        "body.privacy_type": {
            "presence": true,
            inclusion:{
                within: ['PUBLIC','PRIVATE'],
                message:'Value must be PUBLIC or PRIVATE'
            }
        }
    };
    validate.async(req, constraints).then(success, error);

    function success(){
        helpers.GetActiveSession_ORM(req)
            .then(function (SessionUser) {
                if (SessionUser != null){
                    var  tableUser = objAllTables.users.users();
                   return  tableUser.findOne({where: {uid : SessionUser.uid}, attributes: ['privacy_type']
                    })
                       .then(function(result){
                     /* console.log("PPPP",result.dataValues['privacy_type']);*/
                      if(result.dataValues['privacy_type'] == 'PRIVATE'&& req.body.privacy_type == 'PUBLIC'){

                       var userFollowRequest = objAllTables.user_follow_request.user_follow_request();
                         return userFollowRequest.update({status: 'CANCELLED'},{ where: {uid : SessionUser.uid}
                          }).then(function(){
                             var tableUser = objAllTables.users.users();
                             return  tableUser.update({privacy_type: req.body.privacy_type},{where: {uid : SessionUser.uid}
                             })
                                 .then(function(updateResult){
                                     if (updateResult==1){
                                          res.send(200, {status: 200, message: 'privacy changed successfully'});
                                     }
                                })

                            })


                      }
                      else if(result.dataValues['privacy_type'] == 'PUBLIC'&& req.body.privacy_type == 'PRIVATE'){

                              var tableUser = objAllTables.users.users();
                              tableUser.update({privacy_type: req.body.privacy_type},{where: {uid : SessionUser.uid}
                              }).then(function(updateResult){
                                  if (updateResult==1){
                                      res.send(200, {status: 200, message: 'privacy changed successfully'});
                                  }
                              })
                      }
                      else{
                          res.send(409, {status: 409, message: 'Same privacy'});
                          return null;
                      }

                    })

                }
                else {
                    res.send({meta: {status: 401, message: 'user is not logged in invalid token'}});
                }

            }).error(function (err) {
                res.send({meta: {status: 500, message: 'internal error'}, details: err});
            });

    }

    function error(errors) {
        if (errors instanceof Error) {
            // This means an exception was thrown from a validator
            res.send({ meta: { status: 401, message: 'An error occurred in validator' }, errors: errors });
        } else {
            res.send({ meta: { status: 401, message: 'validation errors' }, errors: errors });
        }
    };

}

function updateSpecificUserPrivacy (post_id, uidArray, sessionId, type){

    var userArray=[];
    var tableUserBlock = objAllTables.user_block.user_block();
    var tablePrivacySpecificPost = objAllTables.privacy_specific_post.privacy_specific_post();
    var tablePrivacySpecificGoal = objAllTables.privacy_specific_goal.privacy_specific_goal();
    //Validation Check UserBlock
    return tableUserBlock.findAll({
        attributes: ['blocked_uid'],
        where: {$or: [{uid: sessionId, blocked_uid: {$in: uidArray}}, {blocked_uid: sessionId, uid: {$in: uidArray}}]}
    })
        .then(function (blockUser) {
            if(blockUser.length > 0 ){
                for (var i = 0; i < blockUser.length; i++) {
                    for (var j = 0; j < uidArray.length; j++) {
                        if (blockUser[i].dataValues.blocked_uid == uidArray[j]) {
                            uidArray.splice(j, 1);
                        }
                    }
                }
                return uidArray;
            }
            else {
                return uidArray;
            }
        }).then(function(users) {

            if (type == 'POST') {

                //Update Post
                return tablePrivacySpecificPost.update({status: 'INACTIVE'}, {
                    where: {allowed_uid: {$in: users}, post_id: post_id, status: 'ACTIVE'}
                }).then(function (updateResult) {
                    return users;
                }).then(function (users) {

                    //Insert Users for SpecificPost
                    for (var i = 0; i < users.length; i++) {
                        userArray.push({
                            post_id: post_id,
                            allowed_uid: users[i],
                            created: helpers.getUnixTimeStamp()
                        })
                    }
                    return tablePrivacySpecificPost.bulkCreate(userArray)
                        .then(function () {
                        })

                })


            } else if (type == 'GOAL') {

                //Update Goal
                return tablePrivacySpecificGoal.update({status: 'INACTIVE'}, {
                    where: {allowed_uid: {$in: users}, goal_id: post_id, status: 'ACTIVE'}
                }).then(function (updateResult) {
                    return users;
                }).then(function (users) {

                    //Insert Users for SpecificPost
                    for (var i = 0; i < users.length; i++) {
                        userArray.push({
                            post_id: post_id,
                            allowed_uid: users[i],
                            created: helpers.getUnixTimeStamp()
                        })
                    }
                    return tablePrivacySpecificGoal.bulkCreate(userArray)
                        .then(function () {
                        })

                })
                
            } else{
                return null;
            }
        })
}
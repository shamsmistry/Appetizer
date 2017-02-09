//requiring files
var helpers = require('../helpers/helpers');
var config = require('../config');
var classAllTables = require('../models/alltables');
var objAllTables = classAllTables.allTables;

//requiring npms
var Promise = require("bluebird");

var maxmind = require('maxmind');
var validator = require('validator');
var db = require('../helpers/db');
var Utils = require('../helpers/Utils');

//NOT NEED
//var path = require('path');
var validate = require("validate.js");
var sequelize = db.sequelizeConn();

//get album
exports.getAlbum = function(req, res) {
    
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
        .then(function(sessionUser) {
            if (sessionUser.type == 'Recognized' || sessionUser.type == 'UnRecognized') {
                    
                var limit = null;
                
                if (req.query.limit != null && typeof req.query.limit != 'undefined' && !isNaN(req.query.limit))
                    limit = parseInt(req.query.limit);
                                             
                helpers.getPostAlbumObject(req.params.id, limit)
                .then(function (album) {
                    res.send(200, { meta: { status: 200, message: 'success' }, album: album });
                });             
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

//function for showing all albums
//to users from which user will select
//any image for  profile/cover/goal
exports.showAlbum = function (req, res) {
    var libraryOf = req.params.libraryof;
    if (libraryOf != null) {
        
        var pagination = Utils.pagination(req);
        
        var imageAlbum = {};
        var tableAlbum = objAllTables.album.album();
        tableAlbum.findAll({
            where: {
                $and: [
                    {
                        name: libraryOf
                    },
                    {
                        type: 'IMAGE'
                    },
                    {
                        gen_by: 'ADMIN'
                    },
                    {
                        belongs_to: 'DEFAULT'
                    }
                ]
            }
        }).then(function (albumData) {
            if (albumData.length > 0) {
                var albumId = albumData[0]['dataValues']['id'];
                var user_file_uploads = objAllTables.user_file_uploads.user_file_uploads();
                return user_file_uploads.findAll({
                    attributes: ['id', 'post_id'], where: { album_id: albumId },
                    offset: pagination.offset,
                    limit: pagination.limit
                })
                    .then(function (result) {
                    if (result != null) {
                        var mediaObj = [];
                        var promiseFor = Promise.method(function (condition, action, value) {
                            if (!condition(value)) return value;
                            return action(value).then(promiseFor.bind(null, condition, action));
                        });
                        
                        promiseFor(function (count) {
                            return count < result.length;
                        }, function (count) {
                            return helpers.getMediaObject(result[count].dataValues.id)
                                    .then(function (media) {
                                media.fileId = result[count].dataValues.id;
                                media.post_id = result[count].dataValues.post_id;
                                mediaObj.push(media);
                                return ++count;
                            });

                        }, 0)
                                .then(function () {
                            if (mediaObj.length > 0) {
                                imageAlbum['media'] = mediaObj;
                                res.send({
                                    meta: { status: 200, message: 'Suggested Image Library' },
                                    data: {
                                        images: imageAlbum['media']
                                    }
                                });
                            }
                            else {
                                res.send(200, {
                                    "meta": {
                                        "status": 200,
                                        "message": "OK"
                                    },
                                    "data": []
                                });
                            }
                        });
                    }
                    else
                        return post;
                });

            } else {
                res.send(405, { meta: { status: 405, message: 'Invalid Parameters' } });
            }
        });
       
    }
    else if (libraryOf == null) {
        res.send(405, { meta: { status: 405, message: 'Invalid Parameters' } })
    }
    else {
        res.send(405, { meta: { status: 401, message: 'Parameters required' } });
    }
};

//function for showing user's all Image Albums
exports.getUserAllImage = function (req, res) {
    
    function error(errors) {
        if (errors instanceof Error) {
            // This means an exception was thrown from a validator
            console.err("unhandled error in - /users/:username/images - getUserAllImage", errors);
        } else {
            res.send(401, { meta: { status: 401, message: 'validation errors' }, errors: errors });
        }
    }
    
    //######################### Validations (Rules) #########################
    var constraints = {
        "params.username": {
            presence: true,
        }
    };
    
    
    validate.async(req, constraints).then(success, error);
    
    function success() {

        helpers.getActiveSession(req)
        .then(function (sessionUser) {
            if (sessionUser.type == 'Recognized' || sessionUser.type == 'UnRecognized') {
                
                var userName = req.params.username;
                var pagination = Utils.pagination(req);
                
                new Promise(function (resolve, reject) {
                    if (!Utils.isNumber(userName)) {
                        Utils.getUid(userName).then(function (uid) {
                            if (uid == -1) {
                                res.send(404, { meta: { status: 404, message: 'user not found' } });
                                throw new Error('break promise chain');
                            }
                            resolve(uid);
                        });
                    } else {
                        resolve(userName);
                    }
                }).then(function (uId) {
                    if (uId != null) {
                        var imageAlbum = [];
                        var user_file_uploads = objAllTables.user_file_uploads.user_file_uploads();
                        return user_file_uploads.findAll(
                            {
                                attributes: ['id', 'post_id'],
                                where: {
                                    $and: [
                                        {
                                            uid: uId
                                        },
                                        {
                                            filetype: 'IMAGE'
                                        },
                                        {
                                            parent_type: ["GOAL", "POST", "USERPROFILE", "USERCOVER"]
                                        },
                                        {
                                            status: 'ACTIVE'
                                        },
                                        {
                                            post_id: { $ne: null }
                                        },
                                        sequelize.literal('CheckPrivacy_Post({0}, post_id) = 1'.format(sessionUser.uid))
                                    ]

                                },
                                order: [['id', 'DESC']],
                                offset: pagination.offset, limit: pagination.limit
                                    
                            })
                                .then(function (result) {
                            if (result != null) {
                                var mediaObj = [];
                                var promiseFor = Promise.method(function (condition, action, value) {
                                    if (!condition(value)) return value;
                                    return action(value).then(promiseFor.bind(null, condition, action));
                                });
                                
                                promiseFor(function (count) {
                                    return count < result.length;
                                }, function (count) {
                                    return helpers.getMediaObject(result[count].dataValues.id)
                                                .then(function (media) {
                                        media.fileId = result[count].dataValues.id;
                                        media.post_id = result[count].dataValues.post_id;
                                        mediaObj.push(media);
                                        return ++count;
                                    });

                                }, 0)
                                            .then(function () {
                                    if (mediaObj.length > 0) {
                                        imageAlbum['media'] = mediaObj;
                                        res.send({
                                            meta: { status: 200, message: 'Suggested Image Library' },
                                            data: {
                                                images: imageAlbum['media']
                                            }
                                        });
                                    }
                                    else {
                                        res.send(200, {
                                            "meta": {
                                                "status": 200,
                                                "message": "OK"
                                            },
                                            "data": []
                                        });
                                    }
                                        
                                });
                            }
                            else
                                return post;
                        });


                    } else {
                        res.send(404, { meta: { status: 404, message: 'Not Found' } });
                    }
                });               
                
            }
            //user is not logged in, or provided incorrect or expired token
            else {
                res.send(401, { meta: { status: 401, message: 'invalid token' } });
            }
        })
        .error(function (err) {
            res.send(401, { meta: { status: 401, message: err } });
        })
        .catch(function (err) {
            res.send(401, { meta: { status: 401, message: err } });
        });
    }
};

//function for showing user's all Video Albums
exports.getUserAllVideo = function (req, res) {
    
    function error(errors) {
        if (errors instanceof Error) {
            // This means an exception was thrown from a validator
            console.err("An error ocurred", errors);
        } else {
            res.send({ meta: { status: 401, message: 'validation errors' }, errors: errors });
        }
    }
    
    
    //######################### Validations (Rules) #########################
    var constraints = {
        "params.username": {
            presence: true,
        }
    };
    
    ////######################### Validations (Attributes) #########################
    //var attributes = {
    //    username: userName,
    //};
    
    validate.async(req, constraints).then(success, error);
    
    function success() {
        helpers.GetActiveSession_ORM(req).then(function (sessionUser) {
            //session is active, user has been authenticated
            if (sessionUser != null) {
                
                var userName = req.params.username;
                var pagination = Utils.pagination(req);
                
                new Promise(function (resolve, reject) {
                    if (!Utils.isNumber(userName)) {
                        Utils.getUid(userName).then(function (uid) {
                            if (uid == -1) {
                                res.send(404, { meta: { status: 404, message: 'user not found' } });
                                throw new Error('break promise chain');
                            }
                            resolve(uid);
                        });
                    } else {
                        resolve(userName);
                    }
                }).then(function (uId) {
                    if (uId != null) {
                        var videosAlbum = [];
                        var user_file_uploads = objAllTables.user_file_uploads.user_file_uploads();
                        return user_file_uploads.findAll(
                            {
                                attributes: ['id', 'post_id'],
                                where: {
                                    $and: [
                                        {
                                            uid: uId
                                        },
                                        {
                                            filetype: 'VIDEO'
                                        },
                                        {
                                            parent_type: "POST"
                                        },
                                        {
                                            status: 'ACTIVE'
                                        },
                                        {
                                            post_id: { $ne: null }
                                        }
                                    ]
                                },
                                order: [['id', 'DESC']],
                                offset: pagination.offset,
                                limit: pagination.limit
                            })
                                .then(function (result) {
                            if (result != null) {
                                
                                var mediaObj = [];
                                var promiseFor = Promise.method(function (condition, action, value) {
                                    if (!condition(value)) return value;
                                    return action(value).then(promiseFor.bind(null, condition, action));
                                });
                                
                                promiseFor(function (count) {
                                    return count < result.length;
                                }, function (count) {
                                    return helpers.getMediaObject(result[count].dataValues.id)
                                                .then(function (media) {
                                        media.fileId = result[count].dataValues.id;
                                        media.post_id = result[count].dataValues.post_id;
                                        mediaObj.push(media);
                                        return ++count;
                                    });

                                }, 0)
                                            .then(function () {
                                    if (mediaObj.length > 0) {
                                        videosAlbum['media'] = mediaObj;
                                        res.send({
                                            meta: { status: 200, message: 'Suggested Video Library' },
                                            data: {
                                                videos: videosAlbum['media']
                                            }
                                        });
                                    } else {
                                        res.send(200, {
                                            "meta": {
                                                "status": 200,
                                                "message": "OK"
                                            },
                                            "data": []
                                        });
                                    }

                                       
                                });
                            }
                            else
                                return post;
                        });


                    } else {
                        res.send(404, { meta: { status: 404, message: 'Not Found' } });
                    }
                });
                
            }
            //user is not logged in, or provided incorrect or expired token
            else {
                res.send(401, { meta: { status: 401, message: 'Unauthorized' } });
            }
        })
        .error(function (err) {
            res.send({ meta: { status: 401, message: err } });
        })
        .catch(function (err) {
            res.send({ meta: { status: 401, message: err } });
        });
    }
};

//function for showing user's all Audio Albums
exports.getUserAllAudio = function (req, res) {
    
    function error(errors) {
        if (errors instanceof Error) {
            // This means an exception was thrown from a validator
            console.err("An error ocurred", errors);
        } else {
            res.send({ meta: { status: 401, message: 'validation errors' }, errors: errors });
        }
    }
    
    
    
    //######################### Validations (Rules) #########################
    var constraints = {
        "params.username": {
            presence: true,
        }
    };
    
    //######################### Validations (Attributes) #########################
    //var attributes = {
    //    username: userName,
    //};
    
    validate.async(req, constraints).then(success, error);
    
    function success() {
        helpers.GetActiveSession_ORM(req).then(function (sessionUser) {
            //session is active, user has been authenticated
            if (sessionUser != null) {
                var userName = req.params.username;
                var pagination = Utils.pagination(req);
                
                new Promise(function (resolve, reject) {
                    if (!Utils.isNumber(userName)) {
                        Utils.getUid(userName).then(function (uid) {
                            if (uid == -1) {
                                res.send(404, { meta: { status: 404, message: 'user not found' } });
                                throw new Error('break promise chain');
                            }
                            resolve(uid);
                        });
                    } else {
                        resolve(userName);
                    }
                }).then(function (uId) {
                    if (uId != null) {
                        var audiosAlbum = [];
                        var user_file_uploads = objAllTables.user_file_uploads.user_file_uploads();
                        return user_file_uploads.findAll(
                            {
                                attributes: ['id', 'post_id'],
                                where: {
                                    $and: [
                                        {
                                            uid: uId
                                        },
                                        {
                                            filetype: 'AUDIO'
                                        },
                                        {
                                            parent_type: "POST"
                                        },
                                        {
                                            status: 'ACTIVE'
                                        },
                                        {
                                            post_id: { $ne: null }
                                        }
                                    ]
                                },
                                order: [['id', 'DESC']],
                                offset: pagination.offset,
                                limit: pagination.limit
                            })
                                .then(function (result) {
                            if (result != null) {
                                var mediaObj = [];
                                var promiseFor = Promise.method(function (condition, action, value) {
                                    if (!condition(value)) return value;
                                    return action(value).then(promiseFor.bind(null, condition, action));
                                });
                                
                                promiseFor(function (count) {
                                    return count < result.length;
                                }, function (count) {
                                    return helpers.getMediaObject(result[count].dataValues.id)
                                                .then(function (media) {
                                        media.fileId = result[count].dataValues.id;
                                        media.post_id = result[count].dataValues.post_id;
                                        mediaObj.push(media);
                                        return ++count;
                                    });

                                }, 0)
                                            .then(function () {
                                    if (mediaObj.length > 0) {
                                        audiosAlbum['media'] = mediaObj;
                                        res.send(200, {
                                            meta: { status: 200, message: 'Suggested Audio Library' },
                                            data: {
                                                audio: audiosAlbum['media']
                                            }
                                        });
                                    } else {
                                        res.send(200, {
                                            "meta": {
                                                "status": 200,
                                                "message": "OK"
                                            },
                                            "data": []
                                        });
                                    }
                                });
                            }
                            else
                                return post;
                        });


                    } else {
                        res.send(404, { meta: { status: 404, message: 'Not Found' } });
                    }
                });
            }
            //user is not logged in, or provided incorrect or expired token
            else {
                res.send(401, { meta: { status: 401, message: 'Unauthorized' } });
            }
        }).error(function (err) {
            res.send({ meta: { status: 401, message: err } });
        });
    }
};

//function for showing goal's all Image Albums
exports.getGoalAllImage = function (req, res) {
    
    var constraints = {
        "params.gid": {
            presence: true
        }
    };
    
    
    validate.async(req, constraints).then(success, error);
    
    function success() {
        helpers.GetActiveSession_ORM(req).then(function (sessionUser) {
            //session is active, user has been authenticated
            if (sessionUser != null) {
                var goalID = req.params.gid;
                var pagination = Utils.pagination(req);
                var imageAlbum = [];
                var user_file_uploads = objAllTables.user_file_uploads.user_file_uploads();
                var query = "SELECT u.id, u.post_id from user_file_uploads as u INNER JOIN\
                        posts as p on p.id = u.post_id and p.post_type in('CONTRIBUTION','MILESTONE_CREATED','MILESTONE_COMPLETED','GOAL_CREATED','PROGRESS_UPDATED','GOAL_ACHIEVED','GOAL_FOLLOWED','SHARE_GOAL','GOAL_IMAGE_UPDATED','LINK_GOAL' )\
                         and p.parent_id={0} and u.fileType = 'IMAGE' order by u.id desc limit {1} OFFSET {2}".format(goalID, pagination.limit, pagination.offset);
                
                return sequelize.query(query, { type: sequelize.QueryTypes.SELECT })
                        .then(function (result1) {
                    var result = [];
                    for (var i = 0; i < result1.length; i++) {
                        result.push({ dataValues: { id: result1[i].id, post_id: result1[i].post_id } });
                    }
                    return result;
                })

                        .then(function (result) {
                    console.log(result);
                    if (result != null) {
                        var mediaObj = [];
                        var promiseFor = Promise.method(function (condition, action, value) {
                            if (!condition(value)) return value;
                            return action(value).then(promiseFor.bind(null, condition, action));
                        });
                        
                        promiseFor(function (count) {
                            return count < result.length;
                        }, function (count) {
                            return helpers.getMediaObject(result[count].dataValues.id)
                                .then(function (media) {
                                media.fileId = result[count].dataValues.id;
                                media.post_id = result[count].dataValues.post_id;
                                mediaObj.push(media);
                                return ++count;
                            });

                        }, 0)
                            .then(function () {
                            if (mediaObj.length > 0) {
                                imageAlbum['media'] = mediaObj;
                                res.send({
                                    meta: { status: 200, message: 'Suggested Image Library' },
                                    data: {
                                        images: imageAlbum['media']
                                    }
                                });
                            }
                            else {
                                res.send(200, {
                                    "meta": {
                                        "status": 200,
                                        "message": "OK"
                                    },
                                    "data": []
                                });
                            }
                        });
                    }
                    else
                        return post;
                });
                

            }
        //user is not logged in, or provided incorrect or expired token
            else {
                res.send(401, { meta: { status: 401, message: 'Unauthorized' } });
            }
        })
        .error(function (err) {
            res.send({ meta: { status: 401, message: err } });
        })
        .catch(function (err) {
            res.send({ meta: { status: 401, message: err } });
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

//function for showing goal's all Video Albums
exports.getGoalAllVideo = function (req, res) {
    
    var constraints = {
        "params.gid": {
            presence: true
        }
    };
    
    
    validate.async(req, constraints).then(success, error);
    
    function success() {
        
        helpers.GetActiveSession_ORM(req).then(function (sessionUser) {
            //session is active, user has been authenticated
            if (sessionUser != null) {
                var goalID = req.params.gid;
                var pagination = Utils.pagination(req);
                
                var videoAlbum = [];
                var user_file_uploads = objAllTables.user_file_uploads.user_file_uploads();
                
                var query = "SELECT u.id,u.post_id from user_file_uploads as u INNER JOIN\
                        posts as p on p.id = u.post_id and p.post_type in('CONTRIBUTION','MILESTONE_CREATED','MILESTONE_COMPLETED','GOAL_CREATED','PROGRESS_UPDATED','GOAL_ACHIEVED','GOAL_FOLLOWED','SHARE_GOAL','GOAL_IMAGE_UPDATED','LINK_GOAL' )\
                         and p.parent_id={0} and u.filetype = 'VIDEO' order by u.id desc limit {1} OFFSET {2}".format(goalID, pagination.limit, pagination.offset);
                
                return sequelize.query(query, { type: sequelize.QueryTypes.SELECT })
                        .then(function (result1) {
                    var result = [];
                    for (var i = 0; i < result1.length; i++) {
                        result.push({ dataValues: { id: result1[i].id, post_id: result1[i].post_id } });
                    }
                    return result;
                })
                        .then(function (result) {
                    if (result != null) {
                        var mediaObj = [];
                        var promiseFor = Promise.method(function (condition, action, value) {
                            if (!condition(value)) return value;
                            return action(value).then(promiseFor.bind(null, condition, action));
                        });
                        
                        promiseFor(function (count) {
                            return count < result.length;
                        }, function (count) {
                            return helpers.getMediaObject(result[count].dataValues.id)
                                .then(function (media) {
                                media.fileId = result[count].dataValues.id;
                                media.post_id = result[count].dataValues.post_id;
                                mediaObj.push(media);
                                return ++count;
                            });

                        }, 0)
                            .then(function () {
                            if (mediaObj.length > 0) {
                                videoAlbum['media'] = mediaObj;
                                res.send({
                                    meta: { status: 200, message: 'Suggested Video Library' },
                                    data: {
                                        videos: videoAlbum['media']
                                    }
                                });
                                return;
                            }
                            else {
                                res.send(200, {
                                    "meta": {
                                        "status": 200,
                                        "message": "OK"
                                    },
                                    "data": []
                                });
                            }
                              
                        });
                    }
                    else
                        return post;
                });

            }
        //user is not logged in, or provided incorrect or expired token
            else {
                res.send(401, { meta: { status: 401, message: 'Unauthorized' } });
            }
        }).error(function (err) {
            res.send({ meta: { status: 401, message: err } });
        })
        .catch(function (err) {
            res.send({ meta: { status: 401, message: err } });
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

//function for showing goal's all Audio Albums
exports.getGoalAllAudio = function (req, res) {
    var constraints = {
        "params.gid": {
            presence: true
        }
    };
    
    
    validate.async(req, constraints).then(success, error);
    
    function success() {
        helpers.GetActiveSession_ORM(req).then(function (sessionUser) {
            //session is active, user has been authenticated
            if (sessionUser != null) {
                var goalID = req.params.gid;
                var pagination = Utils.pagination(req);
                
                var audioAlbum = [];
                var user_file_uploads = objAllTables.user_file_uploads.user_file_uploads();
                var query = "SELECT u.id, u.post_id from user_file_uploads as u INNER JOIN\
                        posts as p on p.id = u.post_id and p.post_type in('CONTRIBUTION','MILESTONE_CREATED','MILESTONE_COMPLETED','GOAL_CREATED','PROGRESS_UPDATED','GOAL_ACHIEVED','GOAL_FOLLOWED','SHARE_GOAL','GOAL_IMAGE_UPDATED','LINK_GOAL' )\
                         and p.parent_id={0} and u.filetype = 'AUDIO' order by u.id desc limit {1} OFFSET {2}".format(goalID, pagination.limit, pagination.offset);
                
                return sequelize.query(query, { type: sequelize.QueryTypes.SELECT })
                        .then(function (result1) {
                    var result = [];
                    for (var i = 0; i < result1.length; i++) {
                        result.push({ dataValues: { id: result1[i].id, post_id: result1[i].post_id } });
                    }
                    return result;
                })
                        .then(function (result) {
                    if (result != null) {
                        var mediaObj = [];
                        var promiseFor = Promise.method(function (condition, action, value) {
                            if (!condition(value)) return value;
                            return action(value).then(promiseFor.bind(null, condition, action));
                        });
                        
                        promiseFor(function (count) {
                            return count < result.length;
                        }, function (count) {
                            return helpers.getMediaObject(result[count].dataValues.id)
                                .then(function (media) {
                                media.fileId = result[count].dataValues.id;
                                media.post_id = result[count].dataValues.post_id;
                                mediaObj.push(media);
                                return ++count;
                            });

                        }, 0)
                            .then(function () {
                            if (mediaObj.length > 0) {
                                audioAlbum['media'] = mediaObj;
                                res.send({
                                    meta: { status: 200, message: 'Suggested Audio Library' },
                                    data: {
                                        audio: audioAlbum['media']
                                    }
                                });
                            } else {
                                res.send(200, {
                                    "meta": {
                                        "status": 200,
                                        "message": "OK"
                                    },
                                    "data": []
                                });
                            }
                        });
                    }
                    else
                        return post;
                });
            }
        //user is not logged in, or provided incorrect or expired token
            else {
                res.send(401, { meta: { status: 401, message: 'Unauthorized' } });
            }
        }).error(function (err) {
            res.send({ meta: { status: 401, message: err } });
        }).catch(function (err) {
            res.send({ meta: { status: 401, message: err } });
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
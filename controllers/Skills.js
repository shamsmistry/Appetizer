var clasAllTables = require('../models/alltables');
var helpers = require('../helpers/helpers');
var maxmind = require('maxmind');
var validator = require('validator');
var Promise = require("bluebird");
var db = require('../helpers/db');
var Utils = require('../helpers/Utils');
var validate = require("validate.js");
var config = require('../config');
var objAllTables = clasAllTables.allTables;
var sequelize = db.sequelizeConn();

exports.get = function (req, res) {
    
    var constraints = {
        "params.username": {
            presence: true
        }
    };
    
    validate.async(req, constraints).then(success, error);
    function success() {
        
        helpers.getActiveSession(req).then(function (SessionUser) {
            //session is active, user has been authenticated
            if (SessionUser.type == 'Recognized' || SessionUser.type == 'UnRecognized') {
                
                var userName = req.params.username;
                return Utils.getUid(userName).then(function (uId) {
                    
                    if (uId >= 0) {
                        var user_profileuid = uId;

                        var query = "Select CheckPrivacy_User({0},{1}) as result".format(SessionUser.uid, user_profileuid);
                        return sequelize.query(query, { type: sequelize.QueryTypes.SELECT })
                        .then(function (response) {
                            
                            //full access
                            if (response[0].result == 1) {
                                var tableUserSkills = objAllTables.user_skills.user_skills();
                                var uId = userName;
                                var pagination = Utils.pagination(req);
                                    
                                    if (uId != null) {
                                        
                                        tableUserSkills.findAll({
                                            where: {
                                                $and: [
                                                    {
                                                        uid: uId
                                                    },
                                                    {
                                                        status: 'ACTIVE'
                                                    }
                                                ]
                                            },
                                            offset: pagination.offset, limit: pagination.limit
                                        }).then(function (userSkillsData) {
                                            if (userSkillsData.length > 0) {
                                                res.send({
                                                    meta: {
                                                        status: 200,
                                                        message: 'success'
                                                    },
                                                    data: userSkillsData
                                                });
                                            }
                                            else {
                                                res.send({
                                                    meta: {
                                                        status: 401,
                                                        message: 'no skills found'
                                                    }
                                                });
                                            }
                                        }).error(function (error) {
                                            res.send({
                                                meta: {
                                                    status: 404,
                                                    message: 'error: no skills found'
                                                }
                                            });
                                        });
                                    }
                                    else {
                                        res.send(404, { meta: { status: 404, message: 'user not found' } });
                                    }
                            }
                            //user has partial access to profile, so skills can not be seen
                            else if (response[0].result == 0) {
                                res.send(401, { meta: { status: 401, message: 'error' }, message: 'This User has private profile or the User is blocked' });
                            }                          
                            //user has no access to profile
                            else if (response[0].result == -1) {
                                res.send(401, { meta: { status: 401, message: 'error' }, message: 'This User has private profile or the User is blocked' });
                            }
                            //profile doesn't exist
                            else if (response[0].result == 404) {
                                res.send(404, { meta: { status: 404, message: 'error' }, message: 'profile not found' });
                            }
                            //upexpected response
                            else {
                                res.send(500, { meta: { status: 500, message: 'unexpted response from CheckPrivacy_User() database function' } });
                            }
                        });
                    }
                    else {
                        res.send(404, { meta: { status: 404, message: 'user does not exists' } });
                    }
                });


            }
            //user is not logged in, or provided incorrect or expired token
            else {
                res.send({ meta: { status: 401, message: 'user is not logged or invalid token' } });
            }

        })
            .error(function (err) {
            res.send({ meta: { status: 500, message: 'linkagoal server internel error' } });
        })
            .catch(function (err) {
                res.send({ meta: { status: 500, message: 'linkagoal server internel error' } });
            });
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

exports.create = function (req, res) {
    var userName = req.params.username;
    var Skills = req.body.skills;
    var Status = req.body.status;
    
    //######################### Validations (Rules) #########################
    var constraints = {
        "params.username": {
            presence: true
        },
        "body.skills": {
            presence: true
        },
        "body.status": {
            presence: true
        }
    };
    
    //######################### Validations (Attributes) #########################
    //var attributes = {
    //    username: userName,
    //    skills: Skills,
    //    status: Status
    //};
    
    
    validate.async(req, constraints).then(success, error);
    
    function success() {

        helpers.getActiveSession(req).then(function(SessionUser) {
            if (SessionUser.type == 'Recognized') {
                //checking if the username is of session user or if uid is of session user
                if (userName == sessionUser['username'] || userName == sessionUser['uid']) {
                    var tableUserSkills = objAllTables.user_skills.user_skills();
                    
                    var uId = userName;
                    new Promise(function (resolve, reject) {
                        if (isNaN(userName)) {
                            //fetching uid for this username
                            helpers.getUidByUsername(userName).then(function (uid) {
                                if (uid != null) {
                                    uId = uid;
                                    resolve(uId);
                                }
                            });
                        }
                        else {
                            res.send({ meta: { status: 401, message: 'no username or uid provided' } });
                        }
                    }).then(function (uId) {
                        //checking, is the history is already exist for this user
                        tableUserSkills.findOne({
                            where: {
                                $and: [
                                    {
                                        uid: uId
                                    },
                                    {
                                        skills: Skills
                                    },
                                    {
                                        status: 'ACTIVE'
                                    }
                                ]
                            }
                        }).then(function (userResult) {
                            return userResult;
                        }).then(function (userResult) {
                            if (userResult == null) {
                                //username is available, now register the user
                                tableUserSkills.create({
                                    uid: uId,
                                    skills: Skills,
                                    created: helpers.getUnixTimeStamp(),
                                    updated: helpers.getUnixTimeStamp(),
                                    status: 'ACTIVE'
                                }).then(function () {
                                    res.send({
                                        meta: {
                                            status: 200,
                                            message: "user skill added successfully"
                                        }
                                    });
                                }).error(function () {
                                    res.send({
                                        meta: {
                                            status: 401,
                                            message: "error in adding user skill"
                                        }
                                    });
                                });
                            } else {
                                res.send({
                                    meta: {
                                        status: 401,
                                        message: "skill is already exist for this user"
                                    }
                                });
                            }
                        }).error(function (error) {
                            res.send({
                                meta: {
                                    status: 401,
                                    message: "error in adding user skill"
                                }
                            });
                        });
                    });
                } else {
                    res.send({ meta: { status: 401, message: 'not allowed' } });
                }
            } else {
                res.send({ meta: { status: 401, message: 'Unauthorized' } });
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
    }
};

exports.update = function (req, res) {
    helpers.getActiveSession(req).then(function(SessionUser) {
        if (SessionUser.type == 'Recognized') {

            var userName = req.params.username;
            //checking if the username is of session user or if uid is of session user
            if (userName == sessionUser['username'] || userName == sessionUser['uid']) {
                var tableUserSkills = objAllTables.user_skills.user_skills();
                var userSkillsId = req.body.userskills_id;
                var skills = req.body.skills;
                var uId = userName;
                new Promise(function (resolve, reject) {
                    if (isNaN(userName)) {
                        //fetching uid for this username
                        helpers.getUidByUsername(userName).then(function (uid) {
                            if (uid != null) {
                                uId = uid;
                                resolve(uId);
                            }
                        });
                    }
                    else {
                        res.send({ meta: { status: 401, message: 'no username or uid provided' } });
                    }
                }).then(function (uId) {
                    tableUserSkills.findOne({
                        where: {
                            $and: [
                                {
                                    uid: uId
                                },
                                {
                                    skills: skills
                                },
                                {
                                    status: 'ACTIVE'
                                }
                            ]
                        }
                    }).then(function (userResult) {
                        return userResult;
                    }).then(function (userResult) {
                        if (userResult == null) {
                            tableUserSkills.update({
                                skills: skills,
                                updated: helpers.getUnixTimeStamp()
                            }, {
                                where: {
                                    $and: [
                                        {
                                            userskills_id: userSkillsId
                                        },
                                        {
                                            uid: uId
                                        },
                                        {
                                            status: 'ACTIVE'
                                        }
                                    ]
                                }
                            }).then(function (updateResult) {
                                if (updateResult == 1) {
                                    res.send({
                                        meta: {
                                            status: 200,
                                            message: 'user skill successfully updated'
                                        }
                                    });
                                }
                                else {
                                    res.send({
                                        meta: {
                                            status: 401,
                                            message: 'an error occurred while updating user skill'
                                        }
                                    });
                                }
                            }).error(function (error) {
                                res.send({
                                    meta: {
                                        status: 401,
                                        message: 'an error occurred while updating user skill'
                                    }
                                });
                            });
                        } else {
                            res.send({
                                meta: {
                                    status: 401,
                                    message: "this skill is already exist for this user"
                                }
                            });
                        }
                    }).error(function (updateError) {
                        res.send({
                            status: 401,
                            message: 'an error occurred while updating user skill'
                        });
                    });
                });
            } else {
                res.send({ meta: { status: 401, message: 'not allowed' } });
            }
        } else {
            res.send({ meta: { status: 401, message: 'Unauthorized' } });
        }
    }).error(function (err) {
        res.send({ meta: { status: 401, message: err } });
    });
};

exports.delete = function (req, res) {
    helpers.getActiveSession(req).then(function(SessionUser) {
        if (SessionUser.type == 'Recognized') {
            var tableUserSkills = objAllTables.user_skills.user_skills();
            var userName = req.params.username;
            var skillsUserId = req.params.userskills_id;
            var uId = userName;
            //checking if the username is of session user or if uid is of session user
            if (userName == sessionUser['username'] || userName == sessionUser['uid']) {
                new Promise(function (resolve, reject) {
                    if (isNaN(userName)) {
                        //fetching uid for this username
                        helpers.getUidByUsername(userName).then(function (uid) {
                            if (uid != null) {
                                uId = uid;
                                resolve(uId);
                            }
                        });
                    }
                    else {
                        res.send({ meta: { status: 401, message: 'no username or uid provided' } });
                    }
                }).then(function (uId) {
                    tableUserSkills.update({
                        status: 'DELETED'
                    }, {
                        where: {
                            $and: [
                                {
                                    userskills_id: skillsUserId
                                },
                                {
                                    uid: uId
                                },
                                {
                                    status: 'ACTIVE'
                                }
                            ]
                        }
                    }).then(function (updateResult) {
                        if (updateResult == 1) {
                            res.send({
                                meta: {
                                    status: 200,
                                    message: 'user skill successfully deleted'
                                }
                            });
                        }
                        else {
                            res.send({
                                meta: {
                                    status: 401,
                                    message: 'this skill is already deleted for this user'
                                }
                            });
                        }
                    }).error(function (deleteError) {
                        res.send({
                            status: 401,
                            message: 'an error occurred while deleting user skills'
                        });
                    });
                });
            }
            else {
                res.send({ meta: { status: 401, message: 'not allowed' } });
            }
        } else {
            res.send({ meta: { status: 401, message: 'user is not logged or invalid token' } });
        }
    }).error(function (err) {
        res.send({ meta: { status: 401, message: err } });
    })
};
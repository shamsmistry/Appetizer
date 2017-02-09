//import modules
var clasAllTables = require('../models/alltables');
var helpers = require('../helpers/helpers');
var maxmind = require('maxmind');
var validator = require('validator');
var Promise = require("bluebird");
var Utils = require('../helpers/Utils');
var validate = require("validate.js");
var objAllTables = clasAllTables.allTables;
var config = require('../config');
var db = require('../helpers/db');
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
                return Utils.getUid(userName).then(function (result) {
                    if (result >= 0) {
                        
                        var user_profileuid = result;
                        
                        var query = "Select CheckPrivacy_User({0},{1}) as result".format(SessionUser.uid, user_profileuid);
                        return sequelize.query(query, { type: sequelize.QueryTypes.SELECT })
                        .then(function (response) {
                            
                            //full access
                            if (response[0].result == 1) {
                                var tableUserWorkHistory = objAllTables.user_work_history.user_work_history();
                                var OrganizationModel = objAllTables.OrganizationModel.OrganizationModel();
                                var uId = userName;
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
                                        resolve(uId);
                                    }
                                })
                                    .then(function (uId) {
                                    if (uId != null) {
                                        tableUserWorkHistory.belongsTo(OrganizationModel, {
                                            foreignKey: 'organization_id',
                                            constraints: false
                                        })
                                        tableUserWorkHistory.findAll({
                                            attributes: ['_id', 'position', 'from_year', 'to_year', 'is_working'],
                                            where: { status: 'ACTIVE', uid: uId },
                                            include: [{ model: OrganizationModel, attributes: ['name','created'], required: true }],
                                            offset: pagination.offset, limit: pagination.limit,
                                            order: [['created', 'DESC']]
                                        })
                                            .then(function (userEducationData) {
                                            res.send({ meta: { status: 200, message: 'OK' }, data: userEducationData });
                                        }).error(function (error) {
                                            res.send(400, { meta: { status: 400, message: 'Bad Request' } });
                                        });
                                    } 
                                    else {
                                        res.send(404, { meta: { status: 404, message: 'Not Found' } });
                                    }
                                });
                            }
                            //user has partial access to profile, so work can not be seen
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
                        })
                    }
                    else {
                        res.send(404, { meta: { status: 404, message: 'user does not exists' } });
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
        .error(function (err) {
            res.send({ meta: { status: 401, message: err } });
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

exports.create = function (req, res) {

    //######################### Validations (Rules) #########################
    var constraints = {
        "params.username": {
            presence: true
        },
        "body": {
            presence: true
        },
        "body.organization.name": {
            presence: true
        },
        "body.position": {
            presence: true
        }
    };

    validate.async(req, constraints).then(success, error);

    function error(errors) {
        if (errors instanceof Error) {
            // This means an exception was thrown from a validator
            res.send(500, { meta: { status: 500, message: 'internal error' }, details: errors });
        }
        else {
            var errorCodes = [];
            if (typeof errors['params.username'] != 'undefined')
                errorCodes.push({ code: 1001, message: 'Username cannot be empty' });
            if (typeof errors['body.organization.name'] != 'undefined')
                errorCodes.push({ code: 1002, message: 'Organization name cannot be empty' });
            if (typeof errors['body.position'] != 'undefined')
                errorCodes.push({ code: 1003, message: 'Position cannot be empty' });

            res.send(401, { meta: { status: 401, message: 'validation errors' }, errors: errorCodes });
        }
    }

    function success() {
        helpers.GetActiveSession_ORM(req).then(function (sessionUser) {
            //session is active, user has been authenticated
            if (sessionUser != null) {
                var userName = req.params.username;
                
                var errors = [];
                
                var OrganizationModel = objAllTables.OrganizationModel.OrganizationModel();
                
                //checking if the username is of session user or if uid is of session user
                if (userName == sessionUser['username'] || userName == sessionUser['uid']) {
                    var tableUserWorkHistory = objAllTables.user_work_history.user_work_history();
                    var organizationName = req.body.organization.name;
                    var position = req.body.position;
                    var fromYear = req.body.from_year || null;
                    var toYear = req.body.to_year || null;
                    var is_working = req.body.is_working || 0;
                    new Promise(function (resolve, reject) {
                        if (userName != null) {
                            //fetching uid for this username
                            /*helpers.getUidByUsername(userName).then(function (uid) {
                             if (uid != null) {
                             uId = uid;
                             resolve(uId);
                             }
                             });*/
                            resolve(sessionUser['uid']);
                        } else {
                            res.send(401, { meta: { status: 401, message: 'Unauthorized' } });
                        }
                    }).then(function (uId) {
                        return OrganizationModel.findOrCreate({
                            where: { name: organizationName },
                            defaults: { created: helpers.getUnixTimeStamp() }
                        }).then(function (organization) {
                            return organization;
                        }).then(function (organization) {
                            tableUserWorkHistory.create({
                                uid: sessionUser['uid'],
                                organization_id: organization[0].dataValues.id,
                                position: position,
                                from_year: fromYear,
                                to_year: toYear,
                                is_working: is_working,
                                created: helpers.getUnixTimeStamp(),
                                updated: helpers.getUnixTimeStamp(),
                                status: 'ACTIVE'
                            }).then(function (result) {
                                res.send(200, { meta: { status: 200, message: "OK" }, data: { _id: result._id } });
                            }).error(function () {
                                res.send(405, { meta: { status: 405, message: "Bad Request" } });
                            });
                        })
                    })
                } else {
                    res.send(401, { meta: { status: 401, message: 'Unauthorized' } });
                }
            } else {
                res.send({ meta: { status: 401, message: 'user is not logged or invalid token' } });
            }
        }).error(function (err) {
            res.send({ meta: { status: 401, message: err } });
        });
    }
};

exports.update = function (req, res) {
    
    var constraints = {
        "params.username": {
            presence: true
        },
        "body": {
            presence: true
        },
        "body.organization.name": {
            presence: true
        },
        "body.position": {
            presence: true
        }
    };
    
    validate.async(req, constraints).then(success, error);
    
    function success() {
        helpers.GetActiveSession_ORM(req).then(function (sessionUser) {

            //session is active, user has been authenticated
            if (sessionUser != null) {

                var userName = req.params.username;
                //checking if the username is of session user or if uid is of session user
                if (userName == sessionUser['username'] || userName == sessionUser['uid']) {
                    
                    var OrganizationModel = objAllTables.OrganizationModel.OrganizationModel();
                    
                    var tableUserWorkHistory = objAllTables.user_work_history.user_work_history();
                    var worksId = req.params.id;
                    var organizationName = req.body.organization.name;
                    var position = req.body.position;
                    var fromYear = req.body.from_year || null;
                    var toYear = req.body.to_year || null;
                    var is_working = req.body.is_working || 0;
                    
                    return OrganizationModel.findOrCreate({
                        where: { name: organizationName },
                        defaults: { created: helpers.getUnixTimeStamp() }
                    })
                    .then(function (organization, created) {
                        return organization;
                    })
                    .then(function (organization) {
                        if (organization.length > 0) {
                            var organizationId = organization[0].dataValues.id;

                            tableUserWorkHistory.findOne({
                                where: { _id: worksId, uid: sessionUser['uid'], status: 'ACTIVE' }
                            })
                            .then(function (work) {
                                if (work != null) {
                                 
                                    tableUserWorkHistory.update({
                                        organization_id: organizationId,
                                        position: position,
                                        from_year: fromYear,
                                        to_year: toYear,
                                        is_working: is_working,
                                        updated: helpers.getUnixTimeStamp()
                                    }, {
                                        where: {
                                            _id: worksId
                                        }
                                    }).then(function (updateResult) {
                                        if (updateResult == 1) {
                                            res.send(200, { meta: { status: 200, message: 'User education history successfully updated' } });
                                        }
                                        else {
                                            res.send(405, { meta: { status: 405, message: 'an error occurred while updating user works history' } });
                                        }
                                    })
                                    .error(function (error) {
                                        res.send(405, { meta: { status: 405, message: 'an error occurred while updating user works history' } });
                                    });
                                }
                                else {
                                    res.send(404, { meta: { status: 404, message: "work history not found" } });
                                }
                            })
                            .error(function (updateError) {
                                res.send(401, { status: 401, message: 'an error occurred while updating user works history' });
                            });
                        }

                    });
                }
                else {
                    res.send(401, { meta: { status: 401, message: 'not allowed' } });
                }
            }
            //user is not logged in, or provided incorrect or expired token
            else {
                res.send(401, { meta: { status: 401, message: 'user is not logged or invalid token' } });
            }
        })
        .error(function (err) {
            res.send(401, { meta: { status: 401, message: err } });
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
    helpers.GetActiveSession_ORM(req).then(function (sessionUser) {
        //session is active, user has been authenticated
        if (sessionUser != null) {
            
            var errors = [];
            //######################### Validations (start) #########################
            
            // Validation will be on username and ID
            
            //######################### Validations (end) ####################################
            
            if (errors.length == 0) {
                var tableUserWorkHistory = objAllTables.user_work_history.user_work_history();
                var userName = req.params.username;
                var id = req.params.id;
                var uId = userName;
                //checking if the username is of session user or if uid is of session user
                if (userName == sessionUser['username'] || userName == sessionUser['uid']) {
                    new Promise(function (resolve, reject) {
                        if (!Utils.isNumber(userName)) {
                            helpers.getUidByUsername(userName).then(function (uid) {
                                if (uid != null) {
                                    uId = uid;
                                    resolve(uId);
                                }
                                else {
                                    resolve(null);
                                }
                            });
                        } else {
                            resolve(uId);
                        }
                    }).then(function (uId) {
                        console.log(id, uId);
                        tableUserWorkHistory.update({ status: 'DELETED' }, { where: { $and: [{ _id: id }, { uid: uId }] } }).then(function (updateResult) {
                            res.send(200, { meta: { status: 200, message: 'OK' } });
                        }).error(function (err) {
                            res.send({ status: 400, message: 'Bad Request', errors: err });
                        });
                    });
                }
                else {
                    res.send({ meta: { status: 401, message: 'Unauthorized' } });
                }
            } else {
                res.send({ meta: { status: 400, message: 'Bad Request' }, errors: errors });
            }
        }
        //user is not logged in, or provided incorrect or expired token
        else {
            res.send({ meta: { status: 401, message: 'Unauthorized' } });
        }
    }).error(function (err) {
        res.send({ meta: { status: 401, message: err } });
    })
};
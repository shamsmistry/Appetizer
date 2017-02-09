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
    
    // Validations (Rules)
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
                
                return Utils.getUid(userName)
                .then(function (result) {
                    if (result >= 0) {
                        
                        var user_profileuid = result;
                        
                        var query = "Select CheckPrivacy_User({0},{1}) as result".format(SessionUser.uid, user_profileuid);
                        return sequelize.query(query, { type: sequelize.QueryTypes.SELECT })
                        .then(function (response) {
                            
                            //full access
                            if (response[0].result == 1) {
                                var tableUserEducationHistory = objAllTables.user_education_history.user_education_history();
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
                                }).then(function (uId) {
                                    if (uId != null) {
                                        tableUserEducationHistory.belongsTo(OrganizationModel, { foreignKey: 'organization_id' })
                                        tableUserEducationHistory.findAll({
                                            attributes: ['id', 'program', 'major', 'from_year', 'to_year', 'type', 'graduated'],
                                            where: { status: 'ACTIVE', uid: uId },
                                            include: [{ model: OrganizationModel, attributes: ['id', 'name','created'], required: true }],
                                            offset: pagination.offset, limit: pagination.limit,
                                            order: [['created', 'DESC']]
                                        })
                                            .then(function (userEducationData) {
                                            res.send(200, { meta: { status: 200, message: 'OK' }, data: userEducationData });
                                        }).error(function (error) {
                                            res.send(405, { meta: { status: 405, message: 'Bad Request' } });
                                        });
                                    } 
                                    else {
                                        res.send(404, { meta: { status: 404, message: 'Not Found' } });
                                    }
                                });
                            }
                            //user has partial access to profile, so education can not be seen
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
            res.send({ meta: { status: 401, message: 'An error ocuured in validator' }, errors: errors });
        } else {
            res.send({ meta: { status: 401, message: 'validation errors' }, errors: errors });
        }
    }
};

exports.create = function (req, res) {
    var userName = req.params.username;
    function error(errors) {
        if (errors instanceof Error) {
            // This means an exception was thrown from a validator
            res.send(500, { meta: { status: 500, message: 'internal error' }, details: errors });
        }
        else {
            var errorCodes = [];
            console.log(errors);
            if (typeof errors['params.username'] != 'undefined')
                errorCodes.push({ code: 1001, message: 'Username cannot be empty' });
            if (typeof errors['body.organization.name'] != 'undefined')
                errorCodes.push({ code: 1002, message: 'Organization name cannot be empty' });
            if (typeof errors['body.program'] != 'undefined')
                errorCodes.push({ code: 1003, message: 'Program cannot be empty' });
            if (typeof errors['body.major'] != 'undefined')
                errorCodes.push({ code: 1004, message: 'Major cannot be empty' });
            if (typeof errors['body.type'] != 'undefined')
                errorCodes.push({ code: 1005, message: "Type must be in 'UNIVERSITY', 'SCHOOL', 'HIGH SCHOOL'" });

            res.send(401, { meta: { status: 401, message: 'validation errors' }, errors: errorCodes });
        }
    }
    
    // Validations (Rules)
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
        "body.program": {
            presence: true
        },
        "body.major": {
            presence: true
        },
        "body.type": {
            presence: true,
            inclusion: {
                within: ['UNIVERSITY', 'SCHOOL', 'HIGH SCHOOL'],
                message: "This type is not allowed"
            }
        }
    };
    
    validate.async(req, constraints).then(success, error);
    
    function success() {
        helpers.GetActiveSession_ORM(req)
        .then(function (sessionUser) {
            //session is active, user has been authenticated
            if (sessionUser != null) {
                
                
                var OrganizationModel = objAllTables.OrganizationModel.OrganizationModel();
                
                //checking if the username is of session user or if uid is of session user
                if (userName == sessionUser['username'] || userName == sessionUser['uid']) {
                    var tableUserEducationHistory = objAllTables.user_education_history.user_education_history();
                    var organizationName = req.body.organization.name;
                    var program = req.body.program;
                    var major = req.body.major;
                    var fromYear = req.body.from_year || null;
                    var toYear = req.body.to_year || null;
                    var type = req.body.type;
                    var graduated = req.body.graduated;
                    var uId = userName;
                    
                    new Promise(function (resolve, reject) {
                        console.log(userName);
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
                        return OrganizationModel.findOrCreate({
                            where: { name: organizationName },
                            defaults: { created: helpers.getUnixTimeStamp() }
                        }).then(function (organization) {
                            return organization;
                        }).then(function (organization) {
                            tableUserEducationHistory.create({
                                uid: sessionUser['uid'],
                                organization_id: organization[0].dataValues.id,
                                program: program,
                                major: major,
                                from_year: fromYear,
                                to_year: toYear,
                                type: type,
                                graduated: graduated,
                                created: helpers.getUnixTimeStamp(),
                                updated: helpers.getUnixTimeStamp(),
                                status: 'ACTIVE'
                            }).then(function (result) {
                                res.send(200, { meta: { status: 200, message: "OK" }, data: { id: result.id } });
                            }).error(function () {
                                res.send(405, { meta: { status: 405, message: "Bad Request" } });
                            });
                        });
                    })
                } else {
                    res.send(401, { meta: { status: 401, message: 'Unauthorized' } });
                }

            }
            //user is not logged in, or provided incorrect or expired token
            else {
                res.send({ meta: { status: 401, message: 'user is not logged or invalid token' } });
            }
        }).error(function (err) {
            res.send({ meta: { status: 401, message: err } });
        });
    }
};

exports.oldupdate = function (req, res) {
    helpers.GetActiveSession_ORM(req).then(function (sessionUser) {
        //session is active, user has been authenticated
        if (sessionUser != null) {
            var userName = req.params.username;
            
            var errors = [];
            //######################### Validations (start) #########################
            
            if (validator.isNull(req.params.username)) {
                errors.push(helpers.generateErrorObject(1001, 'username', 'username is null'));
            } else if (typeof req.params.username == undefined) {
                errors.push(helpers.generateErrorObject(1001, 'username', 'username is empty'));
            }
            
            if (validator.isNull(req.body.type)) {
                errors.push(helpers.generateErrorObject(1001, 'type', "type is null. Value must be one of 'UNIVERSITY', 'HIGH SCHOOL', 'MIDDLE SCHOOL' or 'SCHOOL'"));
            } else if (typeof req.body.type == undefined) {
                errors.push(helpers.generateErrorObject(1001, 'type', "type is empty. Value must be one of 'UNIVERSITY', 'HIGH SCHOOL', 'MIDDLE SCHOOL' or 'SCHOOL'"));
            }
            else if (req.body.type != 'UNIVERSITY' && req.body.type != 'HIGH SCHOOL' && req.body.type != 'SCHOOL' && req.body.type != 'MIDDLE SCHOOL') {
                errors.push(helpers.generateErrorObject(1001, 'type', "Value must be one of 'UNIVERSITY', 'HIGH SCHOOL', 'MIDDLE SCHOOL' or 'SCHOOL'"));
            }
            
            if (validator.isNull(req.body.graduated)) {
                errors.push(helpers.generateErrorObject(1001, 'graduated', "graduated is null. Value must be 'YES' or 'NO'"));
            } else if (typeof req.body.graduated == undefined) {
                errors.push(helpers.generateErrorObject(1001, 'graduated', "graduated is empty. Value must be 'YES' or 'NO'"));
            }
            else if (req.body.graduated != 'YES' && req.body.graduated != 'NO') {
                errors.push(helpers.generateErrorObject(1001, 'graduated', "Value must be 'YES' or 'NO'"));
            }
            
            if (validator.isNull(req.body.to_year)) {
                errors.push(helpers.generateErrorObject(1001, 'to_year', 'to_year is null'));
            } else if (!validator.isISO8601(req.body.to_year)) {
                errors.push(helpers.generateErrorObject(1001, 'to_year', 'to_year date is not a valid date format ISO8601 (yyyy-mm-dd)'));
            }
            
            if (validator.isNull(req.params.id)) {
                errors.push(helpers.generateErrorObject(1001, 'id', 'id is null. Value must be integer'));
            } else if (typeof req.params.id == undefined) {
                errors.push(helpers.generateErrorObject(1001, 'id', 'id is empty. Value must be integer'));
            } else if (!validator.isNumeric(req.params.id)) {
                errors.push(helpers.generateErrorObject(1001, 'id', 'Value must be integer'));
            }
            
            //######################### Validations (end) #########################
            
            if (errors.length == 0) {
                console.log("A");
                //checking if the username is of session user or if uid is of session user
                if (userName == sessionUser['username'] || userName == sessionUser['uid']) {
                    console.log("B");
                    var tableUserEducationHistory = objAllTables.user_education_history.user_education_history();
                    var eduID = req.params.id;
                    var organizationName = req.body.organization_name;
                    var program = req.body.program;
                    var major = req.body.major;
                    var fromYear = req.body.from_year;
                    var toYear = req.body.to_year;
                    var type = req.body.type;
                    var graduated = req.body.graduated;
                    var uId = userName;
                    
                    new Promise(function (resolve, reject) {
                        if (isNaN(userName)) {
                            //fetching uid for this username
                            helpers.getUidByUsername(userName).then(function (uid) {
                                if (uid != null) {
                                    uId = uid;
                                    console.log("TEXT" + uId);
                                    resolve(uId);

                                }
                            });
                        }
                        else {
                            res.send({ meta: { status: 401, message: 'no username or uid provided' } });
                        }
                    }).then(function (uId) {
                        console.log(uId);
                        var OrganizationModel = objAllTables.OrganizationModel.OrganizationModel();
                        return OrganizationModel.findOrCreate({
                            where: { name: organizationName },
                            defaults: { created: helpers.getUnixTimeStamp() }
                        }).then(function (organization) {
                            return organization;
                        }).then(function (organization) {
                            return tableUserEducationHistory.update({
                                uid: sessionUser['uid'],
                                organization_id: organization[0].dataValues.id,
                                program: program,
                                major: major,
                                from_year: fromYear,
                                to_year: toYear,
                                type: type,
                                graduated: graduated,
                                updated: helpers.getUnixTimeStamp()
                            }, { where: { id: eduID, uid: uId, status: 'ACTIVE' } })
                                    .then(function (updateResult) {
                                if (updateResult == 1) {
                                    res.send({
                                        meta: {
                                            status: 200,
                                            message: 'User education history successfully updated'
                                        }
                                    });
                                }
                                else {
                                    res.send({
                                        meta: {
                                            status: 404,
                                            message: 'Not Found'
                                        }
                                    });
                                }
                            }).error(function () {
                                res.send(405, { meta: { status: 405, message: "Bad Request" } });
                            });
                        });

                    }).error(function (updateError) {
                        res.send({
                            status: 401,
                            message: 'An error occurred while updating user education history'
                        });
                    });
                } else {
                    res.send({ meta: { status: 401, message: 'validation errors' }, errors: errors });
                }
            }
        }
        else {
            //user is not logged in, or provided incorrect or expired token
            res.send({ meta: { status: 401, message: 'user is not logged or invalid token' } });
        }
    })
    .error(function (err) {
        res.send({ meta: { status: 500, message: 'linkagoal server internel error' } });
    });
};

exports.delete = function (req, res) {
    helpers.GetActiveSession_ORM(req).then(function (sessionUser) {
        
        var errors = [];
        if (sessionUser != null) {
            var tableUserEducationHistory = objAllTables.user_education_history.user_education_history();
            var userName = req.params.username;
            var eduID = req.params.id;
            var uId = userName;
            
            if (errors.length == 0) {
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
                        tableUserEducationHistory.update({ status: 'DELETED' }, { where: { $and: [{ id: eduID }, { uid: uId }] } }).then(function (updateResult) {
                            res.send({ meta: { status: 200, message: 'OK' } });
                        }).error(function (deleteError) {
                            res.send(400, { status: 400, message: 'Bad Request' });
                        });
                    });
                } else {
                    res.send(401, { meta: { status: 401, message: 'Unauthorized' } });
                }
            } else {
                res.send(400, { meta: { status: 400, message: 'Validations errors' }, errors: errors });
            }
        }
        //user is not logged in, or provided incorrect or expired token
        else {
            res.send(401, { meta: { status: 401, message: 'Unauthorized' } });
        }
    }).error(function (err) {
        res.send(400, { meta: { status: 400, message: 'Bad Request' } });
    });
};

exports.update = function (req, res) {
    
    // Before using it we must add the parse and format functions
    // Here is a sample implementation using moment.js
    validate.extend(validate.validators.datetime, {
        // The value is guaranteed not to be null or undefined but otherwise it
        // could be anything.
        parse: function (value, options) {
            return new Date(Date.parse(value));;
        },
        // Input is a unix timestamp
        format: function (value, options) {
            var format = "yyyy-mm-dd";
            return value;
        }
    });
    
    var constraints = {
        "body": {
            presence: true
        },
        "params.username": {
            presence: true
        },
        "params.id": {
            presence: true,
            numericality: {
                noStrings: false
            }
        },  
        "body.type": {
            presence: true,
            inclusion: {
                within: ["UNIVERSITY", "HIGH SCHOOL", "SCHOOL", "MIDDLE SCHOOL"],
                message: "Value must be one of 'UNIVERSITY', 'HIGH SCHOOL', 'MIDDLE SCHOOL' or 'SCHOOL'"
            }
        },
        "body.graduated": {
            presence: true,
            inclusion: {
                within: [1, 0],
                message: "Value must be '1' or '0' as integer"
            }
        },
        "body.to_year": {
            presence: true,
            datetime: { dateOnly: true, message: "date is not a valid date format ISO8601 (yyyy-mm-dd)" }
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
                    
                    var tableUserEducationHistory = objAllTables.user_education_history.user_education_history();
                    var eduID = req.params.id;
                    var organizationName = req.body.organization.name;
                    var program = req.body.program;
                    var major = req.body.major;
                    var fromYear = req.body.from_year;
                    var toYear = req.body.to_year;
                    var type = req.body.type;
                    var uId = userName;
                    
                    //verify uid/username
                    new Promise(function (resolve, reject) {
                        
                        return Utils.getUid(userName)
                        .then(function (uid) {
                            if (uid == -1)
                                throw new Error('invalid user');
                            
                            resolve(uid);
                        });
                    })
                    .then(function (uId) {
                        
                        var OrganizationModel = objAllTables.OrganizationModel.OrganizationModel();
                        return OrganizationModel.findOrCreate({
                            where: { name: organizationName },
                            defaults: { created: helpers.getUnixTimeStamp() }
                        })
                        .then(function (organization) {
                            
                            return tableUserEducationHistory.update({
                                uid: sessionUser['uid'],
                                organization_id: organization[0].dataValues.id,
                                program: program,
                                major: major,
                                from_year: fromYear,
                                to_year: toYear,
                                type: type,
                                graduated: req.body.graduated,
                                updated: helpers.getUnixTimeStamp()
                            }, { where: { id: eduID, uid: uId, status: 'ACTIVE' } })
                            .then(function (updateResult) {
                                if (updateResult == 1)
                                    res.send(200, { meta: { status: 200, message: 'User education history successfully updated' } });
                                else
                                    res.send(404, { meta: { status: 404, message: 'Not Found' } });
                            })
                            .error(function () {
                                res.send(405, { meta: { status: 405, message: "Bad Request" } });
                            });
                        });

                    })
                    .error(function (updateError) {
                        res.send(401, { status: 401, message: 'An error occurred while updating user education history' });
                    });
                }
                else {
                    res.send(401, { meta: { status: 401, message: 'unauthorized' } });
                }
            }
            else {
                //user is not logged in, or provided incorrect or expired token
                res.send(401, { meta: { status: 401, message: 'user is not logged or invalid token' } });
            }
        })
        .error(function (err) {
            res.send(500, { meta: { status: 500, message: 'linkagoal server internel error' } });
        })
        .catch(function (err) {
            if (err.message == 'invalid user')
                res.send(405, { meta: { status: 405, message: 'no username or uid provided' } });
            else
                res.send(500, { meta: { status: 500, message: 'linkagoal server internel error' } });
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

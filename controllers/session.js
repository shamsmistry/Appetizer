//###############################################################
//######################### Require #############################
//###############################################################

var clasAllTables = require('../models/alltables');
var objAllTables = clasAllTables.allTables;
var helpers = require('../helpers/helpers');
var validator = require('validator');
var validate = require("validate.js");
var Utils = require('../helpers/Utils');
var db = require('../helpers/db');

//###############################################################
//########################### APIs ##############################
//###############################################################

exports.logout = function (req, res) {

    //######################### Validations (Rules) #########################
    var constraints = {
        "headers.token": {
            presence: true
        }
    };

    validate.async(req, constraints).then(success, error);

    function success() {

        helpers.getActiveSession(req).then(function (SessionUser) {
            if (SessionUser.type == 'Recognized') {
                var tableSession = objAllTables.sessions.sessions();
                tableSession.destroy({
                    where: {
                        $and: [
                            { uid: SessionUser.uid },
                            { token: req.headers.token }
                        ]
                    }
                })
                    .then(function (result) {
                        if (result >= 1) {
                            res.send(200, { meta: { status: 200, message: 'OK' } });
                        } else {
                            res.send(405, { meta: { status: 405, message: 'Error' } });
                        }
                    });

            } else {
                res.send(401, { meta: { status: 401, message: 'Unauthorized' } });
            }
        }).error(function (err) {
            res.send({ meta: { status: 401, message: err } });
        });
    }

    function error(errors) {
        if (errors instanceof Error) {
            console.err("An error ocurred", errors);
        } else {
            res.send({ meta: { status: 401, message: 'validation errors' }, errors: errors });
        }
    };
}

exports.login = function (req, res) {

    function error(errors) {
        if (errors instanceof Error) {
            // This means an exception was thrown from a validator
            console.err("An error ocurred", errors);
        }
        else {
            var errorCodes = [];
            if (typeof errors['body.username'] != 'undefined')
                errorCodes.push({ code: 1001, message: 'Username/Email can not be empty' });
            if (typeof errors['body.password'] != 'undefined')
                errorCodes.push({ code: 1002, message: 'Password can not be empty' });
            res.send(401, { meta: { status: 401, message: 'validation errors' }, errors: errorCodes });
        }
    };

    //######################### Validations (Rules) #########################
    var constraints = {

        "headers": {
            presence: true
        },
        "body.username": {
            presence: true
        },
        "body.password": {
            presence: true
        }
    };

    //######################### Validations (Attributes) #########################

    validate.async(req, constraints).then(success, error);

    function success() {

        //extract values
        var xclientid = req.headers['x-client-id'];

        var uuid = req.body.uuid;
        //var device_subscription_token = req.body.device_subscription_token;
        var platform = req.body.platform;
        var platform_version = req.body.platform_version;
        var model = req.body.model;
        var mobile = req.body.mobile;
        var isRetina = req.body.isRetina;
        var screen_width = req.body.screen_width;
        var screen_height = req.body.screen_height;
        var useragent = req.body.useragent;

        var tableUsers = objAllTables.users.users();
        var tableSession = objAllTables.sessions.sessions();

        //var md5 = require('md5');
        //var password = md5(req.body.password);
        var password = helpers.hashPassword(req.body.password);
        var userName = req.body.username;
        var clientId = '';
        var clientSecret = '';


        tableUsers.findOne({
            where: {
                $or: [
                    {
                        username: userName
                    },
                    {
                        user_email: userName
                    }
                ],
                $and: [
                    {
                        password: password
                    }
                ]
            }
        })
            .then(function (loginData) {
                if (loginData == null) {
                    var errorCodes = [];
                    errorCodes.push({ code: 1003, message: 'Invalid Username/Password' });
                    res.send(401, { meta: { status: 401, message: 'Username/Email and password do not match to any account' }, errors: errorCodes });
                    throw new Error('intentional exception');
                }
                else if (loginData.dataValues.status == 'DELETED') {
                    res.send(404, { meta: { status: 404, message: 'user not exists' }, errors: { code: 1005, message: 'User does not Exist' } });
                    throw new Error('intentional exception');
                }
                // else if (loginData.dataValues.status == 'USERDEACTIVATED') {
                //     var useruid = loginData['dataValues']['uid'];
                //     var sequelize = db.sequelizeConn();

                //     return sequelize.query('CALL sp_UserReActivate({0});'.format(useruid))
                //         .then(function (response) {
                //             return loginData;
                //         }).error(function (err) {
                //             res.send(401, {meta: {status: 401, message: 'an error occurred while account activating'}});
                //         });
                // }
                else {
                    return loginData;
                }
            })
            .then(function (loginData) {

                var uId = loginData['dataValues']['uid'];
                var token = Utils.generateToken(uId);
                return tableSession.findAll({
                    where: {
                        $and: [
                            {
                                uId: uId
                            },
                            {
                                clientid: xclientid
                            },
                            {
                                status: 'ACTIVE'
                            }
                        ]
                    }
                })
                    .then(function (isSessionExist) {
                        return isSessionExist;
                    })
                    .then(function (isSessionExist) {

                        if (isSessionExist.length == 0) {
                            //Now generate token from HMAC and
                            // Create a new Session by inserting into Session
                            clientId = helpers.generateClientId();
                            clientSecret = helpers.generateClientSecret(uId);

                            return helpers.insertLocation(req)
                                .then(function (locationId) {

                                    return tableSession.create({
                                        uid: uId,
                                        clientid: clientId,
                                        clientsecret: clientSecret,
                                        token: token,
                                        uuid: uuid,
                                        platform: platform,
                                        platform_version: platform_version,
                                        model: model,
                                        mobile: mobile,
                                        isRetina: isRetina,
                                        screen_width: screen_width,
                                        screen_height: screen_height,
                                        useragent: useragent,
                                        created: helpers.getUnixTimeStamp(),
                                        expireTime: helpers.getUnixTimeStamp_adddays(1),  //add 1 day to current date
                                        locationId: locationId
                                    })


                                })
                                .then(function () {
                                    //Updating Last Login
                                    var tableUsers = objAllTables.users.users();
                                    tableUsers.update({
                                        last_login: helpers.getUnixTimeStamp()
                                    }, {
                                            where: { uid: uId }

                                        }).then(function (lastLogin) {

                                        });
                                })
                                .then(function () {
                                    //Returning user object
                                    return helpers.GetUser_ORM(uId, uId).then(function (profile) {
                                        res.send(200, {
                                            meta: { status: 200, message: 'success' },
                                            data: {
                                                credentials: {
                                                    client_id: clientId,
                                                    client_secret: clientSecret,
                                                    token: token
                                                }, user: profile
                                            }
                                        });
                                        res.end();

                                        throw new Error('intentional exception');


                                    });
                                })
                        }
                        else {
                            return isSessionExist;
                        }

                    })
                    .then(function (isSessionExist) {

                        //Return sessionClient id and and sessionClientSecret for active sessions
                        var clientId = isSessionExist[0]['dataValues'].clientid;
                        var clientSecret = isSessionExist[0]['dataValues'].clientsecret;

                        //Updadting Last Login
                        var tableUsers = objAllTables.users.users();
                        tableUsers.update({
                            last_login: helpers.getUnixTimeStamp()
                        }, {
                                where: { uid: uId }

                            })
                            .then(function (lastLogin) {

                            })
                            .then(function () {
                                //Returning user object
                                return helpers.GetUser_ORM(uId, uId).then(function (profile) {
                                    res.send(200,
                                        {
                                            meta: {
                                                status: 200,
                                                message: 'success (re-login)'
                                            },
                                            data: {
                                                credentials: {
                                                    client_id: clientId,
                                                    client_secret: clientSecret,
                                                    token: isSessionExist[0]['dataValues'].token
                                                },
                                                user: profile
                                            }
                                        }
                                    );
                                });
                            })

                    })
            }).error(function (err) {
                res.send(500, { meta: { status: 500, message: 'unexpected Error' }, details: err });
            }).catch(function (err) {
                if (err.message != 'intentional exception') {
                    res.send(500, { meta: { status: 500, message: "intentional exception" }, details: err });
                }
            })
    }
};

exports.verifyToken = function (req, res) {
    var newToken = req.headers.token;
    var tableSession = objAllTables.sessions.sessions();
    tableSession.findOne({ where: { token: newToken } }).then(function (result) {
        if (result != null) {
            res.send(200, { meta: { status: 200, message: 'success' } });
        } else {
            res.send(404, { meta: { status: 404, message: 'Not Found' } });
        }

    });
};
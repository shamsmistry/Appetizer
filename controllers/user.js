//import modules
var clasAllTables = require('../models/alltables');
var helpers = require('../helpers/helpers');
var maxmind = require('maxmind');
var validator = require('validator');
var Promise = require("bluebird");
var db = require('../helpers/db');
var Utils = require('../helpers/Utils');

var validate = require("validate.js");
var helpers = require('../helpers/helpers');
var config = require('../config');
var users = require('./user');
var objAllTables = clasAllTables.allTables;
var sequelize = db.sequelizeConn();

exports.getUserProfile = function (req, res) {

    function error(errors) {
        if (errors instanceof Error) {
            // This means an exception was thrown from a validator
            console.err("An error ocurred", errors);
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

    //######################### Validations (Attributes) #########################

    validate.async(req, constraints).then(success, error);

    function success() {

        helpers.getActiveSession(req).then(function (SessionUser) {

            //session is active, user has been authenticated
            if (SessionUser.type == 'Recognized' || SessionUser.type == 'UnRecognized') {

                var username_param = req.params.username;
                return Utils.getUid(username_param).then(function (uid) {

                    if (uid != -1) {
                        var query = "Select CheckPrivacy_User({0}, {1}) as result".format(SessionUser.uid, uid);
                        return sequelize.query(query, { type: sequelize.QueryTypes.SELECT })
                            .then(function (response) {
                                //Public or Private Profile
                                if (response[0].result == 1 || response[0].result == 0) {
                                    var isProtected = (response[0].result == 1) ? 0 : 1;

                                    var input = {
                                        basic: ['name', 'username', 'email', 'link', 'created'],
                                        profile: ['small', 'medium'],
                                        cover: ['small', 'medium'],
                                        me: ['follower', 'following', 'mutual', 'mute'],
                                    };

                                    if (isProtected == 0) {
                                        input.location = true;
                                        input.stats = {
                                            connections: ['followers', 'followings'],
                                            goals: ['total', 'linked', 'following']
                                        }
                                    }

                                    var _user = new User(parseInt(uid), SessionUser.uid);
                                    _user.get(input)
                                        .then(function (_result) {
                                            var userProfile = _result[0];
                                            userProfile.isProtected = isProtected;
                                            res.send(200, { meta: { status: 200, message: 'success' }, data: userProfile });
                                        });
                                    Utils.viewsCount(SessionUser.uid, uid, "USER_PROFILE", req)
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
                    else
                        res.send(404, { meta: { status: 404, message: 'user does not exists' } });
                });
            }
            else
                res.send(401, { meta: { status: 401, message: 'invalid token' } });
        })
            .error(function (err) {
                res.send(500, { meta: { status: 500, message: "internal outer error" }, details: err });
            })
            .catch(function (err) {
                res.send(500, { meta: { status: 500, message: "internal outer error" }, details: err });
            });
    }
};

exports.update = function (req, res) {

    //######################### Validations (Rules) #########################
    var constraints = {
        "params.username": {
            presence: true
        }
    };

    //######################### Validations (Attributes) #########################
    //var attributes = {
    //    username: userName
    //};

    validate.async(req, constraints).then(success, error);

    function success() {
        helpers.GetActiveSession_ORM(req)
            .then(function (SessionUser) {
                if (SessionUser != null) {
                    var userName = req.params.username;

                    var obj = req.body;
                    new Promise(function (resolve, reject) {
                        if (isNaN(userName)) {
                            //fetching uid for this username
                            helpers.getUidByUsername(userName).then(function (uid) {
                                if (uid != null) {
                                    resolve(uid);
                                }
                            });
                        }
                        else {
                            resolve(userName);
                        }
                    })
                        .then(function (uId) {
                            if (uId == SessionUser.uid)
                                return uId;
                            else
                                new Error('abort promise chain');
                        })
                        .then(function () {
                            //insert if location available
                            if (req.body.userDefinedLocation != null) {
                                return helpers.insertUserLocation(req)
                                    .then(function (userDefinedLocation) {
                                        return userDefinedLocation.id;
                                    });
                            }
                            else
                                return null;
                        })
                        .then(function (isLocationPresent) {

                            var count = Object.keys(obj).length;
                            var query = {};
                            var i = 0;
                            var flag = 0;
                            for (var key in obj) {
                                i = i + 1;
                                if (obj.hasOwnProperty(key)) {
                                    //|| key == 'bio' || key == 'dob' || key == 'dob_show' || key == 'gender' )
                                    if (key == 'name') {
                                        var humanname = require('humanname');
                                        var splitted_name = humanname.parse(req.body.name);

                                        flag = 1;
                                        query.first_name = splitted_name.firstName;
                                        query.last_name = splitted_name.lastName;
                                    }
                                    if (key == 'bio') {
                                        flag = 1;
                                        query.bio = obj[key];
                                    }
                                    if (key == 'dob') {
                                        flag = 1;
                                        query.dob = obj[key];
                                    }
                                    if (key == 'dob_show') {
                                        flag = 1;
                                        query.dob_show = obj[key];
                                    }
                                    if (key == 'timezone') {
                                        flag = 1;
                                        query.timezone = obj[key];
                                    }
                                    if (key == 'gender') {
                                        flag = 1;
                                        query.gender = obj[key];
                                    }
                                    if (key == 'country_id') {
                                        flag = 1;
                                        query.country_id = obj[key];
                                    }
                                    /*if (key == 'privacy_type') {
                                     flag = 1;
                                     query.privacy_type = obj[key];
                                     }*/
                                    //if (key == 'profile_image_id') {
                                    //    flag = 1;
                                    //    query.profile_image_id = obj[key];
                                    //}
                                    //if (key == 'cover_image_id') {
                                    //    flag = 1;
                                    //    query.cover_image_id = obj[key];
                                    //}
                                    if (key == 'website') {
                                        flag = 1;
                                        query.web_url = obj[key];
                                    }
                                }
                            }
                            if (isLocationPresent != null && isLocationPresent != 0) {
                                flag = 1;
                                query.user_location = isLocationPresent;
                            }
                            if (flag != 0) {
                                var users = objAllTables.users.users();
                                users.update(query, {
                                    where: {
                                        uid: SessionUser.uid
                                    }
                                }).spread(function (results, metadata) {
                                    res.send({ meta: { status: 200, message: 'Success' } });
                                })
                                    .error(function (err) {
                                        res.send({
                                            meta: { status: 500, message: 'internal error (query)' },
                                            details: err
                                        });
                                    });
                            }
                            else
                                res.send({ meta: { status: 400, message: 'profile not updated' } });
                        })
                        //handle errors
                        .catch(function (err) {
                            if (err.message === 'abort promise chain') {
                                // just swallow error because chain was intentionally aborted
                                res.send(403, {
                                    meta: {
                                        status: 403,
                                        message: 'session user can update only his own profile'
                                    }
                                });
                                res.end();
                            }
                            else {
                                // else let the error bubble up because it's coming from somewhere else
                                res.send({ meta: { status: 500, message: 'internal error' }, details: err });
                            }
                        });
                }
                else
                    res.send({ meta: { status: 401, message: 'user is not logged in invalid token' } });
            })
            .error(function (err) {
                res.send({ meta: { status: 500, message: 'internal error' }, details: err });
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

exports.register = function (req, res) {

    //this regex is written at 3 places throughout the project
    var pattern = /^(?=.{3,20}$)[A-Za-z][A-Za-z0-9]+(?:[.|_][A-Za-z0-9]+)*$/;

    //######################### Validations (Rules) #########################
    /*
     RULES FOR USERNAME REGEX
     ########################################################
     Usernames can consist of lowercase and capitals
     Usernames can consist of alphanumeric characters
     Usernames can consist of underscore and hyphens
     Cannot start with numbers
     Cannot be only numbers
     Cannot be two underscores or two dots in a row
     Cannot have a underscore or dot at the start or end
     Minimum limit is 3
     maximum limit is 20
     #############################################################
     */
    var constraints = {
        "body.username": {
            presence: true,
            format: pattern
        },
        "body.password": {
            presence: true,
            length: {
                minimum: 6,
                message: "must be at least 6 characters"
            }
        },
        "body.user_email": {
            presence: true,
            email: true
        },
        "body.name": {
            presence: true
        },
        "body.gender": {
            presence: false,
            inclusion: {
                within: ['male', 'female', 'MALE', 'FEMALE'],
                message: "Gender value must be in 'male' or 'female'"
            }
        }
    };

    validate.async(req, constraints).then(success, error);

    function success(attributes) {

        //Implementation in ORM
        var tableUsers = objAllTables.users.users();
        var tableUserFileUploads = objAllTables.user_file_uploads.user_file_uploads();
        var userName = req.body.username;
        var userEmail = req.body.user_email;
        var message = "";
        var passWord = req.body.password;
        var Name = req.body.name;
        var invitation_id = req.body.invitation_id || false;

        tableUsers.findOne({
            where: {
                $or: [
                    {
                        username: userName
                    },
                    {
                        user_email: userEmail
                    }
                ]
            }
        }).then(function (result) {
            if (result == null) {
                //fetching default profile image id
                var defaultProfileImageId = "";
                var defaultCoverImageId = "";
                tableUserFileUploads.findOne({
                    where: {
                        $and: [
                            {
                                parent_type: 'DEFAULTUSERPROFILE'
                            },
                            {
                                status: 'ACTIVE'
                            }
                        ]
                    },
                    attributes: ['id']
                }).then(function (id) {
                    if (id != null) {
                        defaultProfileImageId = id['dataValues']['id'];
                    }
                    else {
                        defaultProfileImageId = "";
                    }

                    //fetching default cover image id
                    tableUserFileUploads.findOne({
                        where: {
                            $and: [
                                {
                                    parent_type: 'DEFAULTUSERCOVER'
                                },
                                {
                                    status: 'ACTIVE'
                                }
                            ]
                        },
                        attributes: ['id']
                    }).then(function (id) {

                        if (id != null) {
                            defaultCoverImageId = id['dataValues']['id'];
                        }
                        else {
                            defaultCoverImageId = "";
                        }

                        //break "name" into "first_name", "middle_name", "last_name"
                        var humanname = require('humanname');
                        var splitted_name = humanname.parse(req.body.name);

                        //var regexEmojiChecker = /(^[a-zA-Z_.,-]+(\s*[a-zA-Z]+)*$)|(^$)/g;
                        var regexEmojiChecker = /(^[a-zA-Z]+(\s*[a-zA-Z]+)*$)|(^$)/g;


                        if (!(regexEmojiChecker.test(splitted_name.firstName)) || splitted_name.firstName == '') {
                            var errorCodes = [];
                            errorCodes.push({ code: 1007, message: 'first name cannot contains emoji or special characters expect(. , -) and numbers' });
                            res.send(401, { meta: { status: 401, message: "Error in Registering User" }, errors: errorCodes });
                            return;
                        }
                        regexEmojiChecker = /(^[a-zA-Z_.,-]+(\s*[a-zA-Z]+)*$)|(^$)/g;
                        if (!(regexEmojiChecker.test(splitted_name.lastName))) {
                            var errorCodes = [];
                            errorCodes.push({ code: 1008, message: 'last name cannot contains emoji or special characters expect(. , -) and numbers' });
                            res.send(401, { meta: { status: 401, message: "Error in Registering User" }, errors: errorCodes });
                            return;
                        }
                        //hashed password
                        //var md5 = require('md5');
                        //var password = md5(req.body.password);
                        var password = helpers.hashPassword(req.body.password);

                        var gender = '';
                        if (typeof req.body.gender != "undefined" && req.body.gender != null)
                            gender = req.body.gender.toUpperCase();

                        helpers.insertLocation(req).then(function (locationId) {
                            var registerObj = {
                                username: req.body.username,
                                user_email: req.body.user_email,
                                email_valid: false,
                                first_name: splitted_name.firstName,
                                middle_name: '',
                                last_name: splitted_name.lastName,
                                lang: 'en',
                                created: helpers.getUnixTimeStamp(),
                                bio: '',
                                gender: gender,
                                dob: '',
                                dob_show: 'PUBLIC',
                                password: password,
                                status: 'ACTIVE',
                                account_verified: false,
                                role_id: 3,
                                country_id: 0,
                                country_id_guess: 'GUESS', // change it to dynamic
                                username_by: "SYSTEM",
                                default_image_id: defaultProfileImageId,
                                default_cover_image_id: defaultCoverImageId,
                                location_id: locationId
                            };

                            if (typeof req.body.social_id != 'undefined') {
                                var socialID = forSocialNetworkRegisters(req.body.social_id, registerObj);
                                if (socialID.invalid_social_id == true) {
                                    return res.send(401, {
                                        meta: {
                                            status: 401,
                                            message: 'social id is invalid, cannot signup'
                                        }
                                    });
                                }
                            }
                            //username is available, now register the user
                            tableUsers.create(registerObj).then(function (user) {
                                if (user != null) {

                                    if (invitation_id !== false) {
                                        var invitationsTbl = objAllTables.invitations.invitations();
                                        var invitationsAcceptedTbl = objAllTables.invitations_accepted.invitations_accepted();
                                        invitationsTbl.findOne({ invitation_id: invitation_id }).then(function (inviter) {
                                            if (inviter !== null)
                                                invitationsAcceptedTbl.create({
                                                    uid: inviter.get('uid'),
                                                    invitee_uid: user.get('uid'),
                                                    created: helpers.getUnixTimeStamp()
                                                })
                                        })
                                    }

                                    //creating albums
                                    helpers.createAlbum(user['dataValues'].uid, 'Photos', 'IMAGE', 'SYSTEM', 'DEFAULT');
                                    helpers.createAlbum(user['dataValues'].uid, 'Videos', 'VIDEO', 'SYSTEM', 'DEFAULT');
                                    helpers.createAlbum(user['dataValues'].uid, 'Audios', 'AUDIO', 'SYSTEM', 'DEFAULT');

                                    //assign permissions
                                    helpers.assignPermissions(user['dataValues'].uid);

                                    //assign notification settings
                                    helpers.assignNotifications(user['dataValues'].uid);

                                    res.send(200, { meta: { status: 200, message: "User created successfully" } });

                                    //send WELCOME email
                                    var email = require('./EmailNotifications.js');
                                    email.emailNotifications_Personal({
                                        to_uid: user['dataValues'].uid,
                                        type: 'WELCOME'
                                    });

                                    //send VERIFICATION email
                                    Utils.sendVerificationEmail(user['dataValues'].uid, user['dataValues'].user_email, user['dataValues'].first_name);

                                    //if it was invitation
                                    if (typeof req.params.invitation != "undefined" && req.params.invitation != null) {
                                        invite(req.params.invitation);
                                    }
                                }
                                else {
                                    res.send(401, {
                                        meta: { status: 401, message: "Error in Registering User" },
                                        details: error
                                    });
                                }
                            }).error(function (error) {
                                res.send(401, { meta: { status: 401, message: "Error in Registering User" }, details: error });
                            });
                        });
                    });
                });
            }
            else {
                var errorCodes = [];

                if (result['dataValues']['username'].toLowerCase() == userName.toLowerCase())
                    errorCodes.push({ code: 1005, message: 'Username already exists' });
                if (result['dataValues']['user_email'].toLowerCase() == userEmail.toLowerCase())
                    errorCodes.push({ code: 1006, message: 'Email already exists' });

                res.send(401, { meta: { status: 401, message: 'duplication errors' }, errors: errorCodes });
            }
        }).error(function (error) {
            res.send(500, { meta: { status: 500, message: "Error in Registering User" }, details: error });
        });
    }

    function error(errors) {

        if (errors instanceof Error) {
            // This means an exception was thrown from a validator
            res.send(500, { meta: { status: 500, message: 'internal error' }, details: errors });
        }
        else {
            var errorCodes = [];

            if (typeof errors['body.username'] != 'undefined')
                errorCodes.push({ code: 1001, message: 'Username is invalid' });
            if (typeof errors['body.password'] != 'undefined')
                errorCodes.push({ code: 1002, message: 'Password must be atleast 6 characters long' });
            if (typeof errors['body.user_email'] != 'undefined')
                errorCodes.push({ code: 1003, message: 'Email is invalid' });
            if (typeof errors['body.name'] != 'undefined')
                errorCodes.push({ code: 1004, message: 'Name must not be empty' });
            if (typeof errors['body.gender'] != 'undefined')
                errorCodes.push({
                    code: 1005,
                    message: "Gender value must be in 'male' or 'female' complete lowercase or complete uppercase"
                });

            res.send(401, { meta: { status: 401, message: 'validation errors' }, errors: errorCodes });
        }
    }

    function invite(invite_id_hashed) {
        var invite_id = Utils.decode_Hashids(invite_id_hashed);

        if (!isNaN(invite_id)) {
            var contacts = objAllTables.contacts.contacts();
            contacts.update({ status: 'ACCEPTED' }, { where: { id: invite_id } });
        }
    }
};
function forSocialNetworkRegisters(social_id, registerObj) {
    var Hashids = require("hashids"), hashids = new Hashids(config.encryption.salt, config.encryption.size);
    var decodedID = hashids.decode(social_id);

    if (decodedID[1] == 0) {
        //facebook
        return registerObj.fb_uid = '' + decodedID[0];
    }
    else if (decodedID[1] == 1) {
        //twitter
        return registerObj.tw_uid = '' + decodedID[0];
    }
    else {
        //invalid
        return { invalid_social_id: true };
    }
}

//FOLLOW
exports.unfollowUser = function (req, res) {

    var userName = req.params.userName;
    //######################### Validations (Rules) #########################
    var constraints = {
        username: {
            presence: true
        }
    };

    //######################### Validations (Attributes) #########################
    var attributes = {
        username: userName

    };

    validate.async(attributes, constraints).then(success, error);

    function success() {
        helpers.GetActiveSession_ORM(req).then(function (sessionUser) {
            //session is active, user has been authenticated
            if (sessionUser != null) {

                if (sessionUser.permissions.User_Follow.delete == 1) {

                    if (validator.isNull(req.params.userName)) {
                        res.send(401, { meta: { status: 401, message: 'User Name can not be null' } });
                    }
                    else {
                        var uId = userName;
                        new Promise(function (resolve, reject) {
                            if (isNaN(userName)) {
                                helpers.getUidByUsername(userName).then(function (uid) {
                                    if (uid != null) {
                                        uId = uid;
                                        resolve(uId);
                                    }
                                    else {
                                        res.send(404, { "meta": { "status": 404, "message": "user not found" } });
                                    }
                                });
                            }
                            else {
                                resolve(uId);
                            }
                        }).then(function (uId) {

                            if (uId != null) {
                                if (sessionUser.uid == uId)
                                    res.send(401, {
                                        meta: {
                                            status: 401,
                                            message: 'you cannot follow/unfollow yourself'
                                        }
                                    });
                                else {
                                    user_unfollow_multiple(sessionUser.uid, [uId])
                                        .then(function (data) {
                                            if (data.success.length == 1) {
                                                res.send(200, { meta: { status: 200, message: 'success' } });
                                                helpers.decrement_update_UserStats(sessionUser.uid, 'followings');
                                                helpers.decrement_update_UserStats(uId, 'followers');

                                            }
                                            else if (data.failed.length == 1) {
                                                res.send(data.failed[0].code, {
                                                    meta: {
                                                        status: data.failed[0].code,
                                                        message: data.failed.message
                                                    }
                                                });
                                            }
                                            else {
                                                res.send(500, {
                                                    meta: {
                                                        status: 500,
                                                        message: data.failed[0].message
                                                    }
                                                });
                                            }
                                        }).catch(function (err) {
                                            res.send(500, { meta: { status: 500, message: err } });
                                        });
                                }
                            }
                            else {
                                res.send(401, { meta: { status: 401, message: 'user does not exists' } });
                            }
                        });
                    }
                }
                else
                    res.send(403, { meta: { status: 403, message: 'permission denied' } });
            }
            //user is not logged in, or provided incorrect or expired token
            else {
                res.send(401, { meta: { status: 401, message: 'user is not logged or invalid token' } });
            }
        }).error(function (err) {
            res.send(500, { meta: { status: 500, message: err } });
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

exports.getUserFollowing = function (req, res) {
    /*
     if Session is active,
     return the Users followed by the UserId/username provided
     else throw error
     else through 401
     */


    //######################### Validations (Rules) #########################
    var constraints = {
        "params.username": {
            presence: true
        }
    };

    //######################### Validations (Attributes) #########################
    //var attributes = {
    //    username: userName
    //};

    validate.async(req, constraints).then(success, error);

    function success() {
        helpers.GetActiveSession_ORM(req).then(function (sessionUser) {
            //session is active, user has been authenticated
            if (sessionUser != null) {
                var userName = req.params.username;

                var uId = userName;
                //checking if the username is of session user or if uid is of session user

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
                        resolve(uId);
                    }
                }).then(function (uId) {
                    //if "uid" is not null, proceed and get his profile
                    if (uId != null) {
                        var followers = objAllTables.user_followers.user_followers();
                        followers.findAll({
                            where: { uid: uId, status: 'ACTIVE' },
                            attributes: ['follows_uid']
                        }).then(function (followerIds) {
                            if (followerIds.length > 0) {
                                var promiseFor = Promise.method(function (condition, action, value) {
                                    if (!condition(value)) return value;
                                    return action(value).then(promiseFor.bind(null, condition, action));
                                });
                                var USERS = [];
                                promiseFor(function (count) {
                                    return count < followerIds.length;
                                }, function (count) {
                                    return helpers.GetUser_ORM(followerIds[count].follows_uid, sessionUser.uid)
                                        .then(function (User) {
                                            USERS.push(User);
                                            return ++count;
                                        });
                                }, 0)
                                    .then(function () {
                                        res.send({
                                            meta: { status: 200, message: 'success' },
                                            data: { following_count: followerIds.length, following: USERS }
                                        });
                                    });
                            }
                            else
                                res.send({
                                    meta: { status: 404, message: 'Not following any user' }
                                });

                        })
                    }
                    else
                        res.send({ status: 401, message: 'user does not exists' });
                });

            }
            //user is not logged in, or provided incorrect or expired token
            else {
                res.send({ meta: { status: 401, message: 'user is not logged or invalid token' } });
            }
        }).error(function (err) {
            res.send({ meta: { status: 500, message: err } });
        });
    }


    function error(errors) {
        if (errors instanceof Error) {
            // This means an exception was thrown from a validator
            res.send(401, { meta: { status: 401, message: 'validation  errors' }, errors: errors });
        } else {
            res.send(401, { meta: { status: 401, message: 'validation errors' }, errors: errors });
        }
    }

};

exports.getUserFollowers = function (req, res) {

    //######################### Validations (Rules) #########################
    var constraints = {
        "params.username": {
            presence: true
        }
    };

    //######################### Validations (Attributes) #########################
    //var attributes = {
    //    username: userName
    //};

    /*
     if Session is active,
     return the followers against the UserId/username provided
     else throw error
     else through 401 error
     */
    validate.async(req, constraints).then(success, error);
    function success() {
        helpers.GetActiveSession_ORM(req).then(function (sessionUser) {
            //session is active, user has been authenticated
            if (sessionUser != null) {
                var userName = req.params.username;

                var uId = userName;
                //checking if the username is of session user or if uid is of session user
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
                        resolve(uId);
                    }
                }).then(function (uId) {
                    //if "uid" is not null, proceed and get followers list
                    if (uId != null) {
                        var followers = objAllTables.user_followers.user_followers();
                        followers.findAll({
                            where: { follows_uid: uId, status: 'ACTIVE' },
                            attributes: ['uid']
                        }).then(function (followerIds) {
                            if (followerIds.length > 0) {
                                var promiseFor = Promise.method(function (condition, action, value) {
                                    if (!condition(value)) return value;
                                    return action(value).then(promiseFor.bind(null, condition, action));
                                });
                                var USERS = [];
                                promiseFor(function (count) {
                                    return count < followerIds.length;
                                }, function (count) {
                                    return helpers.GetUser_ORM(followerIds[count].uid, sessionUser.uid)
                                        .then(function (User) {
                                            USERS.push(User);
                                            return ++count;
                                        });
                                }, 0)
                                    .then(function () {
                                        res.send({
                                            meta: { status: 200, message: 'success' },
                                            data: { followers_count: followerIds.length, followers: USERS }
                                        });
                                    });
                            }
                            else
                                res.send({
                                    meta: { status: 404, message: 'followers not found' }
                                });

                        })


                    }
                    else
                        res.send({ meta: { status: 401, message: 'user does not exists' } });
                });

            }
            //user is not logged in, or provided incorrect or expired token
            else {
                res.send({ meta: { status: 401, message: 'user is not logged or invalid token' } });
            }
        }).error(function (err) {
            res.send({ meta: { status: 500, message: err } });
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

//FULL name
exports.getFullName = function (req, res) {
    helpers.GetActiveSession_ORM(req).then(function (sessionUser) {
        //session is active, user has been authenticated
        if (sessionUser != null) {
            var userName = req.params.username;
            var uId = userName;
            //checking if the username is of session user or if uid is of session user

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
                    resolve(uId);
                }
            }).then(function (uId) {
                helpers.GetUser_ORM(uId, sessionUser['uid'])
                    .then(function (userProfile) {
                        res.send({
                            meta: { status: 200, message: 'success' },
                            data: {
                                firstname: userProfile['first_name'],
                                middlename: userProfile['middle_name'],
                                lastname: userProfile['last_name'],
                            }
                        });
                    });
            });

        }
        //user is not logged in, or provided incorrect or expired token
        else {
            res.send({ meta: { status: 401, message: 'user is not logged or invalid token' } });
        }
    }).error(function (err) {
        res.send({ meta: { status: 500, message: err } });
    });
};

exports.updateFullName = function (req, res) {
    var tableUsers = objAllTables.users.users();
    helpers.GetActiveSession_ORM(req)
        .then(function (sessionUser) {
            //session is active, user has been authenticated
            if (sessionUser != null) {
                var userName = req.params.username;
                var firstName = req.body.first_name;
                var middleName = req.body.middle_name;
                var lastName = req.body.last_name;
                var uId = userName;
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
                        if (middleName != null && middleName != "") {
                            tableUsers.update({
                                first_name: firstName,
                                middle_name: middleName,
                                last_name: lastName,
                                updated: helpers.getUnixTimeStamp()
                            }, {
                                    where: {
                                        $and: [
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
                                                message: 'Fullname updated successfully'
                                            }
                                        });
                                    }
                                    else {
                                        res.send({
                                            meta: {
                                                status: 401,
                                                message: 'An error occurred while updating user fields'
                                            }
                                        });
                                    }
                                }).error(function (error) {
                                    res.send({
                                        meta: {
                                            status: 401,
                                            message: 'An error occurred while updating user fields'
                                        }
                                    });
                                });
                        }
                        else {
                            tableUsers.update({
                                first_name: firstName,
                                last_name: lastName,
                                updated: helpers.getUnixTimeStamp()
                            }, {
                                    where: {
                                        $and: [
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
                                                message: 'Fullname updated successfully'
                                            }
                                        });
                                    }
                                    else {
                                        res.send({
                                            meta: {
                                                status: 401,
                                                message: 'An error occurred while updating user fields'
                                            }
                                        });
                                    }
                                }).error(function (error) {
                                    res.send({
                                        meta: {
                                            status: 401,
                                            message: 'An error occurred while updating user fields'
                                        }
                                    });
                                });
                        }
                    });
                }
                else {
                    res.send({ meta: { status: 401, message: 'not allowed' } });
                }
            }
            //user is not logged in, or provided incorrect or expired token
            else {
                res.send({ meta: { status: 401, message: 'user is not logged or invalid token' } });
            }
        }).error(function (err) {
            res.send({ meta: { status: 401, message: err } });
        });
};

//bio
exports.getUserBio = function (req, res) {
    helpers.GetActiveSession_ORM(req).then(function (sessionUser) {
        //session is active, user has been authenticated
        if (sessionUser != null) {
            var tableUsers = objAllTables.users.users();
            var userName = req.params.username;
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
                    //if "uid" is not null, proceed and get his profile
                    if (uId != null) {
                        helpers.GetUser_ORM(uId, sessionUser['uid'])
                            .then(function (userProfile) {
                                res.send({
                                    meta: { status: 200, message: 'success' },
                                    bio: userProfile['bio']
                                });
                            });
                    }
                    else {
                        res.send({ status: 401, message: 'user does not exists' });
                    }
                });
            }
            else {
                res.send({ meta: { status: 401, message: 'not allowed' } });
            }
        }
        //user is not logged in, or provided incorrect or expired token
        else {
            res.send({ meta: { status: 401, message: 'user is not logged or invalid token' } });
        }
    }).error(function (err) {
        res.send({ meta: { status: 401, message: err } });
    });
};

exports.updateUserBio = function (req, res) {

    helpers.GetActiveSession_ORM(req).then(function (sessionUser) {
        //session is active, user has been authenticated
        if (sessionUser != null) {
            var userName = req.params.username;
            //checking if the username is of session user or if uid is of session user
            if (userName == sessionUser['username'] || userName == sessionUser['uid']) {
                var tableUsers = objAllTables.users.users();
                var uId = userName;
                var bio = req.body.bio;
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
                    tableUsers.findOne({
                        where: {
                            $and: [
                                {
                                    uid: uId
                                },
                                {
                                    bio: bio
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
                            tableUsers.update({
                                bio: bio,
                                updated: helpers.getUnixTimeStamp()
                            }, {
                                    where: {
                                        $and: [
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
                                                message: 'user bio successfully updated'
                                            }
                                        });
                                    }
                                    else {
                                        res.send({
                                            meta: {
                                                status: 401,
                                                message: 'an error occurred while updating user bio'
                                            }
                                        });
                                    }
                                }).error(function (error) {
                                    res.send({
                                        meta: {
                                            status: 401,
                                            message: 'an error occurred while updating user education history'
                                        }
                                    });
                                });
                        } else {
                            res.send({
                                meta: {
                                    status: 401,
                                    message: "user bio is already exist"
                                }
                            });
                        }
                    }).error(function (updateError) {
                        res.send({
                            status: 401,
                            message: 'an error occurred while updating user bio'
                        });
                    });
                });
            }
            else {
                res.send({ meta: { status: 401, message: 'not allowed' } });
            }
        }
        //user is not logged in, or provided incorrect or expired token
        else {
            res.send({ meta: { status: 401, message: 'user is not logged or invalid token' } });
        }
    }).error(function (err) {
        res.send({ meta: { status: 401, message: err } });
    });
};

//contact
exports.getUserContact = function (req, res) {
    helpers.GetActiveSession_ORM(req).then(function (sessionUser) {
        //session is active, user has been authenticated
        if (sessionUser != null) {
            var userName = req.params.username;
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
                    //if "uid" is not null, proceed and get his profile
                    if (uId != null) {
                        helpers.GetUser_ORM(uId, sessionUser['uid'])
                            .then(function (userProfile) {
                                res.send({
                                    meta: { status: 200, message: 'success' },
                                    contact: {
                                        social: userProfile['social'],
                                        website: 'https://www.google.com.pk/',
                                        email: userProfile['user_email']
                                    }

                                });
                            });
                    }
                    else
                        res.send({ status: 401, message: 'user does not exists' });
                });
            }
            else {
                res.send({ meta: { status: 401, message: 'not allowed' } });
            }
        }
        //user is not logged in, or provided incorrect or expired token
        else {
            res.send({ meta: { status: 401, message: 'user is not logged or invalid token' } });
        }
    }).error(function (err) {
        res.send({ meta: { status: 401, message: err } });
    });
};

exports.addUserContact = function (req, res) {
    var userName = req.params.username;
    helpers.GetActiveSession_ORM(req)
        .then(function (sessionUser) {
            //session is active, user has been authenticated
            if (sessionUser != null) {
                //checking if the username is of session user or if uid is of session user
                if (userName == sessionUser['username'] || userName == sessionUser['uid']) {
                    var tableUsers = objAllTables.users.users();
                    var user_email = req.body.user_email;
                    var tw_id = req.body.tw_id;
                    var fb_id = req.body.fb_id;
                    var gp_uid = req.body.gp_uid;
                    var web_url = req.body.web_url;
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

                        //username is available, now register the user
                        tableUsers.create({
                            user_email: organizationID,
                            program: program,
                            major: major,
                            from_year: fromYear,
                            to_year: toYear,
                            type: type,
                            graduated: graduated,
                            created: helpers.getUnixTimeStamp(),
                            updated: helpers.getUnixTimeStamp(),
                            status: status
                        }).then(function () {
                            res.send({
                                meta: {
                                    status: 200,
                                    message: "user education history registered successfully"
                                }
                            });
                        }).error(function () {
                            res.send({
                                meta: {
                                    status: 401,
                                    message: "error in registering user education history"
                                }
                            });
                        });


                    });
                }
                else {
                    res.send({ meta: { status: 401, message: 'not allowed' } });
                }
            }
            //user is not logged in, or provided incorrect or expired token
            else {
                res.send({ meta: { status: 401, message: 'user is not logged or invalid token' } });
            }
        }).error(function (err) {
            res.send({ meta: { status: 401, message: err } });
        });
};

exports.updateUserContact = function (req, res) {
    helpers.GetActiveSession_ORM(req).then(function (sessionUser) {
        //session is active, user has been authenticated
        if (sessionUser != null) {
            var userName = req.params.username;
            //checking if the username is of session user or if uid is of session user
            if (userName == sessionUser['username'] || userName == sessionUser['uid']) {
                var tableUsers = objAllTables.users.users();
                var userName = req.params.username;
                var userEmail = req.body.user_email;
                var twitterUid = req.body.tw_uid;
                var facebookUid = req.body.fb_uid;
                var googlePlusUId = req.body.gp_uid;
                var webUrl = req.body.web_url;
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
                    tableUsers.update({
                        user_email: userEmail,
                        tw_uid: twitterUid,
                        fb_uid: facebookUid,
                        gp_uid: googlePlusUId,
                        web_url: webUrl,
                        updated: helpers.getUnixTimeStamp()
                    },
                        {
                            where: {
                                $and: [
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
                                        message: 'user contacts updated'
                                    }
                                });
                            }
                            else {
                                res.send({
                                    meta: {
                                        status: 401,
                                        message: 'an error occurred while updating user contacts'
                                    }
                                });
                            }
                        }).error(function (error) {
                            res.send({
                                meta: {
                                    status: 401,
                                    message: 'an error occurred while updating user contacts'
                                }
                            });
                        });
                });
            }
            else {
                res.send({ meta: { status: 401, message: 'not allowed' } });
            }
        }
        //user is not logged in, or provided incorrect or expired token
        else {
            res.send({ meta: { status: 401, message: 'user is not logged or invalid token' } });
        }
    }).error(function (err) {
        res.send({ meta: { status: 401, message: err } });
    });
};

exports.deleteUserContact = function (req, res) {
    helpers.GetActiveSession_ORM(req).then(function (sessionUser) {
        //session is active, user has been authenticated
        if (sessionUser != null) {
            var userName = req.params.username;
            //checking if the username is of session user or if uid is of session user
            if (userName == sessionUser['username'] || userName == sessionUser['uid']) {
                var tableUsers = objAllTables.users.users();
                var userName = req.params.username;
                var userEmail = req.body.user_email;
                var twitterUid = req.body.tw_uid;
                var facebookUid = req.body.fb_uid;
                var googlePlusUId = req.body.gp_uid;
                var webUrl = req.body.web_url;
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
                    tableUsers.update({
                        user_email: userEmail,
                        tw_uid: twitterUid,
                        fb_uid: facebookUid,
                        gp_uid: googlePlusUId,
                        web_url: webUrl,
                        updated: helpers.getUnixTimeStamp()
                    },
                        {
                            where: {
                                $and: [
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
                                        message: 'user contacts deleted'
                                    }
                                });
                            }
                            else {
                                res.send({
                                    meta: {
                                        status: 401,
                                        message: 'an error occurred while deleted user contacts'
                                    }
                                });
                            }
                        }).error(function (error) {
                            res.send({
                                meta: {
                                    status: 401,
                                    message: 'an error occurred while deleted user contacts'
                                }
                            });
                        });
                });
            }
            else {
                res.send({ meta: { status: 401, message: 'not allowed' } });
            }
        }
        //user is not logged in, or provided incorrect or expired token
        else {
            res.send({ meta: { status: 401, message: 'user is not logged or invalid token' } });
        }
    }).error(function (err) {
        res.send({ meta: { status: 401, message: err } });
    });
};

//interest
exports.getInterest = function (req, res) {

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

                    //var tableUserInterestTags = objAllTables.user_interest_tags.user_interest_tags();
                    var tableTags = objAllTables.tags.tags();
                    var userName = req.params.username;
                    var uId = userName;
                    var pagination = Utils.pagination(req);

                    var errors = [];


                    //checking if the username is of session user or if uid is of session user
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
                            resolve(uId);
                        }
                    }).then(function (uId) {

                        if (sessionUser.type == 'UnRecognized')
                            var query = "SELECT\
                                        0 as `isMyInterest`, ut.uid, ut.tag_id, t.tagname\
                                    FROM\
                                        user_interest_tags ut JOIN tags t\
                                        ON ut.tag_id = t.tag_id\
                                    WHERE\
                                        ut.uid = {0} and ut.`status` = 'ACTIVE'\
                                    LIMIT {1}, {2}".format(uId, pagination.offset, pagination.limit);
                        else
                            var query = "SELECT\
                                        (SELECT COUNT(*) FROM `user_interest_tags` mt WHERE  mt.tag_id = ut.tag_id AND mt.uid = {0}) AS `isMyInterest`\
                                        , ut.uid, ut.tag_id, t.tagname\
                                    FROM user_interest_tags ut JOIN tags t\
                                        ON ut.tag_id = t.tag_id WHERE ut.uid = {1} and ut.`status` = 'ACTIVE' and t.`status` = 'ACTIVE'\
                                    LIMIT {2}, {3}".format(sessionUser.uid, uId, pagination.offset, pagination.limit);


                        return sequelize.query(query, { type: sequelize.QueryTypes.SELECT })
                            .then(function (interestData) {

                                if (interestData != null) {
                                    var finalData = [];
                                    for (var i = 0; i < interestData.length; i++) {

                                        finalData.push({
                                            id: interestData[i]['tag_id'],
                                            name: interestData[i]['tagname'],
                                            isMyInterest: interestData[i]['isMyInterest']
                                        });

                                    }
                                    res.send(200, { meta: { status: 200, message: 'success' }, data: finalData });
                                }
                                else {
                                    res.send(200, { meta: { status: 200, message: 'Not Found' }, data: [] });
                                }
                            });
                    });
                }
                //user is not logged in, or provided incorrect or expired token
                else {
                    res.send(401, { meta: { status: 401, message: 'invalid token' } });
                }
            })
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

exports.addInterest = function (req, res) {


    //######################### Validations (Rules) #########################
    var constraints = {
        "body": {
            presence: true
        },

        "params.username": {
            presence: true
        },
        "body.tag_id": {
            presence: true
        }
    };

    //######################### Validations (Attributes) #########################
    //var attributes = {
    //    username: userName,
    //    tag_id: tagId
    //};

    validate.async(req, constraints).then(success, error);


    function success() {
        helpers.GetActiveSession_ORM(req)
            .then(function (sessionUser) {
                //session is active, user has been authenticated
                if (sessionUser != null) {
                    var userName = req.params.username;
                    var tagId = req.body.tag_id;

                    //checking if the username is of session user or if uid is of session user
                    if (userName == sessionUser['username'] || userName == sessionUser['uid']) {
                        var tableUserInterestTags = objAllTables.user_interest_tags.user_interest_tags();
                        var uId = userName;
                        new Promise(function (resolve, reject) {
                            if (!Utils.isNumber(userName)) {
                                helpers.getUidByUsername(userName).then(function (uid) {
                                    if (uid != null) {
                                        uId = uid;
                                        resolve(uId);
                                    } else {
                                        resolve(null);
                                    }
                                });
                            } else {
                                resolve(uId);
                            }
                        }).then(function (uId) {
                            //checking, is the history is already exist for this user
                            tableUserInterestTags.findOne({
                                where: {
                                    $and: [
                                        {
                                            uid: uId
                                        },
                                        {
                                            tag_id: tagId
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
                                    tableUserInterestTags.create({
                                        uid: uId,
                                        tag_id: tagId,
                                        created: helpers.getUnixTimeStamp(),
                                        updated: helpers.getUnixTimeStamp(),
                                        status: 'ACTIVE'
                                    }).then(function () {
                                        res.send({
                                            meta: {
                                                status: 200,
                                                message: "user interest added successfully"
                                            }
                                        });
                                    }).error(function () {
                                        res.send({
                                            meta: {
                                                status: 401,
                                                message: "error in adding user interest"
                                            }
                                        });
                                    });
                                } else {
                                    res.send({
                                        meta: {
                                            status: 401,
                                            message: "interest already exist"
                                        }
                                    });
                                }
                            }).error(function (error) {
                                res.send({
                                    meta: {
                                        status: 401,
                                        message: "error in adding user interest"
                                    }
                                });
                            });
                        });
                    }
                    else {
                        res.send({ meta: { status: 401, message: 'not allowed' } });
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

    function error(errors) {
        if (errors instanceof Error) {
            // This means an exception was thrown from a validator
            res.send("An error ocurred in validation", errors);
        } else {
            res.send({ meta: { status: 401, message: 'validation errors' }, errors: errors });
        }
    }
};

exports.updateInterest = function (req, res) {
    helpers.GetActiveSession_ORM(req).then(function (sessionUser) {
        //session is active, user has been authenticated
        if (sessionUser != null) {
            var userName = req.params.username;
            //checking if the username is of session user or if uid is of session user
            if (userName == sessionUser['username'] || userName == sessionUser['uid']) {
                var tableUserInterestTags = objAllTables.user_interest_tags.user_interest_tags();
                var id = req.body.id;
                var tagId = req.body.tag_id;
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
                    tableUserInterestTags.findOne({
                        where: {
                            $and: [
                                {
                                    uid: uId
                                },
                                {
                                    tag_id: tagId
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
                            tableUserInterestTags.update({
                                tag_id: tagId,
                                updated: helpers.getUnixTimeStamp()
                            }, {
                                    where: {
                                        $and: [
                                            {
                                                id: id
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
                                                message: 'user interest successfully updated'
                                            }
                                        });
                                    }
                                    else {
                                        res.send({
                                            meta: {
                                                status: 401,
                                                message: 'an error occured while updating interest'
                                            }
                                        });
                                    }
                                }).error(function (error) {
                                    res.send({
                                        meta: {
                                            status: 401,
                                            message: 'an error occured while updating interest'
                                        }
                                    });
                                });
                        } else {
                            res.send({
                                meta: {
                                    status: 401,
                                    message: "interest already exist"
                                }
                            });
                        }
                    }).error(function (updateError) {
                        res.send({
                            status: 401,
                            message: 'an error occured while updating interest'
                        });
                    });
                });
            }
            else {
                res.send({ meta: { status: 401, message: 'not allowed' } });
            }
        }
        //user is not logged in, or provided incorrect or expired token
        else {
            res.send({ meta: { status: 401, message: 'user is not logged or invalid token' } });
        }
    }).error(function (err) {
        res.send({ meta: { status: 401, message: err } });
    });
};

exports.deleteInterest = function (req, res) {

    var userName = req.params.username;
    var id = req.params.id;

    //######################### Validations (Rules) #########################
    var constraints = {
        username: {
            presence: true,
        },
        id: {
            presence: true
        }
    };

    //######################### Validations (Attributes) #########################
    var attributes = {
        username: userName,
        id: id
    };

    validate.async(attributes, constraints).then(success, error);

    function success() {
        helpers.GetActiveSession_ORM(req).then(function (sessionUser) {
            //session is active, user has been authenticated
            if (sessionUser != null) {
                var userName = req.params.username;
                //checking if the username is of session user or if uid is of session user
                if (userName == sessionUser['username'] || userName == sessionUser['uid']) {
                    var tableUserInterestTags = objAllTables.user_interest_tags.user_interest_tags();

                    var uId = userName;
                    new Promise(function (resolve, reject) {
                        if (!Utils.isNumber(userName)) {
                            helpers.getUidByUsername(userName).then(function (uid) {
                                if (uid != null) {
                                    uId = uid;
                                    resolve(uId);
                                } else {
                                    resolve(null);
                                }
                            });
                        } else {
                            resolve(uId);
                        }
                    }).then(function (uId) {
                        tableUserInterestTags.update({ status: 'INACTIVE', updated: helpers.getUnixTimeStamp() }, {
                            where: {
                                $and: [
                                    {
                                        tag_id: id
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
                                        message: 'user interest successfully deleted'
                                    }
                                });
                            }
                            else {
                                res.send({
                                    meta: {
                                        status: 401,
                                        message: 'No User Tag found'
                                    }
                                });
                            }
                        }).error(function (error) {
                            res.send({
                                meta: {
                                    status: 401,
                                    message: 'an error occured while deleting interest'
                                }
                            });
                        });
                    });
                }
                else {
                    res.send({ meta: { status: 401, message: 'not allowed' } });
                }
            }
            //user is not logged in, or provided incorrect or expired token
            else {
                res.send({ meta: { status: 401, message: 'user is not logged or invalid token' } });
            }
        }).error(function (err) {
            res.send({ meta: { status: 500, message: err } });
        });
    }


    function error(errors) {
        if (errors instanceof Error) {
            // This means an exception was thrown from a validator
            res.send("An error ocurred in validation", errors);
        } else {
            res.send({ meta: { status: 401, message: 'validation errors' }, errors: errors });
        }
    }

};

//email
exports.getEmailAddress = function (req, res) {
    helpers.GetActiveSession_ORM(req).then(function (sessionUser) {
        //session is active, user has been authenticated
        if (sessionUser != null) {
            var userName = req.params.username;
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
                    //if "uid" is not null, proceed and get his profile
                    if (uId != null) {
                        helpers.GetUser_ORM(uId, sessionUser['uid'])
                            .then(function (userProfile) {
                                res.send({
                                    meta: { status: 200, message: 'success' },
                                    email_address: userProfile['user_email']
                                });
                            });
                    }
                    else
                        res.send({ status: 401, message: 'user does not exists' });
                });
            }
            else {
                res.send({ meta: { status: 401, message: 'not allowed' } });
            }
        }
        //user is not logged in, or provided incorrect or expired token
        else {
            res.send({ meta: { status: 401, message: 'user is not logged or invalid token' } });
        }
    }).error(function (err) {
        res.send({ meta: { status: 500, message: err } });
    });
};

exports.updateEmailAddress = function (req, res) {
    helpers.GetActiveSession_ORM(req).then(function (sessionUser) {
        //session is active, user has been authenticated
        if (sessionUser != null) {
            var userName = req.params.username;
            //checking if the username is of session user or if uid is of session user
            if (userName == sessionUser['username'] || userName == sessionUser['uid']) {
                var tableUser = objAllTables.users.users();
                var userEmailAddress = req.body.user_email;
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
                    tableUser.update({
                        user_email: userEmailAddress,
                        updated: helpers.getUnixTimeStamp()
                    }, {
                            where: {
                                $and: [
                                    {
                                        uid: uId
                                    }
                                ]
                            }
                        }).then(function (updateResult) {
                            if (updateResult == 1) {
                                res.send({
                                    meta: {
                                        status: 200,
                                        message: 'user email address successfully updated'
                                    }
                                });
                            }
                            else {
                                res.send({
                                    meta: {
                                        status: 401,
                                        message: 'an error occured while updating user email address'
                                    }
                                });
                            }
                        }).error(function (error) {
                            res.send({
                                meta: {
                                    status: 401,
                                    message: 'an error occured while updating user email address'
                                }
                            });
                        });
                });
            }
            else {
                res.send({ meta: { status: 401, message: 'not allowed' } });
            }
        }
        //user is not logged in, or provided incorrect or expired token
        else {
            res.send({ meta: { status: 401, message: 'user is not logged or invalid token' } });
        }
    }).error(function (err) {
        res.send({ meta: { status: 500, message: err } });
    });
};

//deactivate
exports.deactivateUserAccount_old = function (req, res) {

    //######################### Validations (Rules) #########################
    var constraints = {
        "params.userName": {
            presence: true
        }
    };

    //######################### Validations (Attributes) #########################
    //var attributes = {
    //    userName: userName
    //};

    validate.async(req, constraints).then(success, error);

    function success() {
        helpers.GetActiveSession_ORM(req)
            .then(function (sessionUser) {
                //session is active, user has been authenticated
                if (sessionUser != null) {
                    var userName = req.params.userName;

                    //checking if the username is of session user or if uid is of session user
                    if (userName == sessionUser['username'] || userName == sessionUser['uid']) {


                        var tableUsers = objAllTables.users.users();
                        var status = 'DEACTIVATED';
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
                                res.send(401, { meta: { status: 401, message: 'no username or uid provided' } });
                            }
                        }).then(function (uId) {
                            tableUsers.findOne({
                                where: {
                                    $and: [
                                        {
                                            uid: uId
                                        },
                                        {
                                            status: 'DEACTIVATED'
                                        }
                                    ]
                                }
                            }).then(function (userResult) {
                                return userResult;
                            }).then(function (userResult) {
                                if (userResult == null) {

                                    var sequelize = db.sequelizeConn();
                                    sequelize.query('CALL sp_UserDeactivate({0});'.format(sessionUser.uid))
                                        .then(function (response) {
                                            res.send(200, {
                                                meta: {
                                                    status: 200,
                                                    message: 'account deactivated successfully'
                                                }
                                            });
                                        }).error(function (err) {
                                            res.send(401, {
                                                meta: {
                                                    status: 401,
                                                    message: 'an error occurred while account deactivating'
                                                }
                                            });
                                        });
                                } else {
                                    res.send(401, { meta: { status: 401, message: "already deactivated" } });
                                }
                            }).error(function (updateError) {
                                res.send(401, {
                                    status: 401,
                                    message: 'an error occurred while account deactivating'
                                });
                            });
                        });
                    }
                    else {
                        res.send(401, { meta: { status: 401, message: 'you can only deactivate your account' } });
                    }
                }
                //user is not logged in, or provided incorrect or expired token
                else {
                    res.send(401, { meta: { status: 401, message: 'user is not logged or invalid token' } });
                }
            }).error(function (err) {
                res.send(500, { meta: { status: 500, message: err } });
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

exports.deactivateUserAccount = function (req, res) {

    //######################### Validations (Rules) #########################
    var constraints = {
        "body.option_id": {
            presence: true,
            numericality: {
                noStrings: false
            },
            inclusion: {
                within: ['1', '2', '3', '4', '5', '6'],
                message: "must select an option among (1, 2, 3, 4, 5, 6)"
            }
        }
    };

    validate.async(req, constraints).then(success, error);

    function success() {

        helpers.getActiveSession(req)
            .then(function (sessionUser) {
                if (sessionUser.type == 'Recognized') {

                    //######################### conditional validations #########################
                    var data = {};

                    var option_id = parseInt(req.body.option_id);
                    if (option_id >= 1 && option_id <= 5) {
                        data = {
                            uid: sessionUser.uid,
                            option_id: req.body.option_id,
                            created: helpers.getUnixTimeStamp()
                        };
                    }
                    else if (option_id == 6 && (typeof req.body.details != 'undefined' && req.body.details != null && req.body.details.trim() != "")) {
                        data = {
                            uid: sessionUser.uid,
                            option_id: req.body.option_id,
                            details: req.body.details,
                            created: helpers.getUnixTimeStamp()
                        };
                    }
                    else {
                        res.send(401, {
                            meta: {
                                status: 401,
                                message: "details can not be empty when option_id '6' is selected"
                            }
                        });
                        throw new Error('intentional exception');
                    }

                    //######################### proceed to deactivation #########################
                    //submit deactivation form
                    var userdeactivate = objAllTables.userdeactivate.userdeactivate();
                    return userdeactivate.create(data).then(function (created) {
                        if (created == null) {
                            res.send(500, {
                                meta: {
                                    status: 500,
                                    message: "an error occured while saving deactivation form"
                                }
                            });
                            throw new Error('intentional exception');
                        }

                        return;
                    }).
                        then(function () {
                            var sequelize = db.sequelizeConn();
                            sequelize.query('CALL sp_UserDeactivate({0});'.format(sessionUser.uid))
                                .then(function (response) {
                                    res.send(200, { meta: { status: 200, message: 'account deactivated successfully' } });
                                }).error(function (err) {
                                    res.send(401, {
                                        meta: {
                                            status: 401,
                                            message: 'an error occurred while account deactivating'
                                        }
                                    });
                                });
                        })
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
        }
        else {
            res.send(401, { meta: { status: 401, message: 'validation errors' }, errors: errors });
        }
    }
};

exports.deleteUserAccount = function (req, res) {

    //######################### Validations (Rules) #########################
    var constraints = {
        "body.option_id": {
            presence: true,
            numericality: {
                noStrings: false
            },
            inclusion: {
                within: ['1', '2', '3', '4', '5', '6'],
                message: "must select an option among (1, 2, 3, 4, 5, 6)"
            }
        }
    };

    validate.async(req, constraints).then(success, error);

    function success() {

        helpers.getActiveSession(req)
            .then(function (sessionUser) {
                if (sessionUser.type == 'Recognized') {

                    //######################### conditional validations #########################
                    var data = {};

                    var option_id = parseInt(req.body.option_id);
                    if (option_id >= 1 && option_id <= 5) {
                        data = {
                            uid: sessionUser.uid,
                            option_id: req.body.option_id,
                            created: helpers.getUnixTimeStamp()
                        };
                    }
                    else if (option_id == 6 && (typeof req.body.details != 'undefined' && req.body.details != null && req.body.details.trim() != "")) {
                        data = {
                            uid: sessionUser.uid,
                            option_id: req.body.option_id,
                            details: req.body.details,
                            created: helpers.getUnixTimeStamp()
                        };
                    }
                    else {
                        res.send(401, {
                            meta: {
                                status: 401,
                                message: "details can not be empty when option_id '6' is selected"
                            }
                        });
                        throw new Error('intentional exception');
                    }

                    //######################### proceed to deactivation #########################
                    //submit deactivation form
                    var userdeactivate = objAllTables.userdeactivate.userdeactivate();
                    return userdeactivate.create(data).then(function (created) {
                        if (created == null) {
                            res.send(500, {
                                meta: {
                                    status: 500,
                                    message: "an error occured while saving deactivation form"
                                }
                            });
                            throw new Error('intentional exception');
                        }

                        return;
                    }).then(function () {
                        var sequelize = db.sequelizeConn();
                        sequelize.query('CALL sp_UserDeactivate({0});'.format(sessionUser.uid))
                            .then(function (response) {
                                res.send(200, { meta: { status: 200, message: 'account deactivated successfully' } });
                            }).error(function (err) {
                                res.send(401, {
                                    meta: {
                                        status: 401,
                                        message: 'an error occurred while account deactivating'
                                    }
                                });
                            });
                    })


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
        }
        else {
            res.send(401, { meta: { status: 401, message: 'validation errors' }, errors: errors });
        }
    }
};


//reset password
exports.changePassword = function (req, res) {

    var constraints = {
        "body": {
            presence: true
        },
        "body.oldpassword": {
            presence: true
        },
        "body.newpassword": {
            presence: true,
            length: {
                minimum: 6,
                message: "must be at least 6 characters"
            }
        },
        "body.confirmnewpassword": {
            presence: true,
            length: {
                minimum: 6,
                message: "must be at least 6 characters"
            }
        }
    };

    validate.async(req, constraints).then(success, error);

    function success() {
        helpers.GetActiveSession_ORM(req).then(function (sessionUser) {
            //session is active, user has been authenticated
            if (sessionUser != null) {

                var md5 = require('md5');

                if (req.body.newpassword != req.body.confirmnewpassword) {
                    res.send(401, {
                        meta: { status: 401, message: 'New Passwords do not match' },
                        errors: { code: 1005, message: 'New Passwords do not match' }
                    });
                }
                else {
                    //hashed the new password, than update
                    //var newPassword = md5(req.body.newpassword);
                    //var oldPassword = md5(req.body.oldpassword);
                    var newPassword = helpers.hashPassword(req.body.newpassword);
                    var oldPassword = helpers.hashPassword(req.body.oldpassword);

                    return updatePassword(sessionUser.uid, newPassword, oldPassword)
                        .then(function (updateResult) {
                            if (updateResult == true) {
                                res.send(200, { meta: { status: 200, message: 'password changed successfully' } });
                                return;
                            }
                            else {
                                res.send(401, {
                                    meta: { status: 401, message: 'failed to change password' },
                                    errors: { code: 1006, message: ' Password is incorrect' }
                                });
                                return;
                            }
                        });
                }
            }
            //user is not logged in, or provided incorrect or expired token
            else {
                res.send(401, {
                    meta: { status: 401, message: 'user is not logged or invalid token' },
                    errors: { code: 1007, message: 'user is not logged or invalid token' }
                });
                return;
            }
        }).error(function (err) {
            res.send(401, { meta: { status: 401, message: err } });
            return;
        });
    }

    function error(errors) {
        if (errors instanceof Error) {
            // This means an exception was thrown from a validator
            res.send(401, { meta: { status: 401, message: 'An error ocuured in validator' }, errors: errors });

        }
        else {

            var errorCodes = [];

            if (typeof errors['body.oldpassword'] != 'undefined')
                errorCodes.push({ code: 1001, message: 'Password must be atleast 6 characters long' });
            if (typeof errors['body.newpassword'] != 'undefined')
                errorCodes.push({ code: 1002, message: 'Password must be atleast 6 characters long' });
            if (typeof errors['body.confirmnewpassword'] != 'undefined')
                errorCodes.push({ code: 1003, message: 'Password must be atleast 6 characters long' });

            res.send(401, { meta: { status: 401, message: 'validation errors' }, errors: errorCodes });

        }
        return;
    }
};

exports.forgetPassword = function (req, res) {

    //######################### Validations (Rules) #########################
    var constraints = {
        "body": {
            presence: true
        },
        "body.user_email": {
            presence: true
        }
    };

    validate.async(req, constraints).then(success, error);

    function success() {

        var users = objAllTables.users.users();
        return users.findOne({
            where: { user_email: req.body.user_email, status: 'ACTIVE' }
        })
            //check whether user exists
            .then(function (user) {
                if (user == null) {
                    res.send(404, { meta: { status: 404, message: "not found" } });
                    throw new Error('break promise chain');
                }
                //else if (user.account_verified != true) {
                //    res.send(401, { meta: { status: 401, message: "account is not verified" } });
                //    throw new Error('break promise chain');
                //}

                return user.dataValues.uid;
            })
            //get hashed code
            .then(function (uid) {

                //generate unique and hashed verification key
                return helpers.getHashedVerificationKey(uid, 'password')
                    .then(function (hashedVerificationKey) {
                        return { uid: uid, code: hashedVerificationKey };
                    });

            })
            //save code to db
            .then(function (data) {

                var tableUserPasswordVerification = objAllTables.user_password_verification.user_password_verification();
                return tableUserPasswordVerification.create({
                    uid: data.uid,
                    verification_key: data.code,
                    expirytime: '72',
                    status: 'ACTIVE',
                    created: helpers.getUnixTimeStamp()
                })
                    .then(function (insertedData) {
                        if (insertedData == null) {
                            res.send(401, { meta: { status: 401, message: "error while saving code in database" } });
                            throw new Error('break promise chain');
                        }

                        return data;
                    });

            })
            //send email
            .then(function (data) {

                //hyperLink will be like: "http://linkagoal.com/account/forgetpassword/:hashedVerificationKey"
                var hyperLink = new Array(config.baseUrl.domain, 'account', 'forgot', data.code).toURL();
                res.send(200, { meta: { status: 200, message: "email sent" } });

                var email = require('./EmailNotifications.js');
                return email.emailNotifications_Personal({
                    to_uid: data.uid,
                    type: 'RESET_PASSWORD',
                    data: { reset_password_link: hyperLink }
                });
            })
            .catch(function (err) {
                if (err.message == 'break promise chain') {
                    return
                }
                else {
                    res.send(500, { meta: { status: 500, message: "unknown error" } });
                    return;
                }
            });
    }

    function error(errors) {
        if (errors instanceof Error) {
            // This means an exception was thrown from a validator
            res.send(401, { meta: { status: 401, message: 'validation errors' }, errors: errors });
        }
        else {
            res.send(401, { meta: { status: 401, message: 'validation errors' }, errors: errors });
        }
        return;
    }
};

exports.verifyForgetPassword = function (req, res) {

    var constraints = {
        "params": {
            presence: true,
        },
        "params.verificationkey": {
            presence: true,
        }
    };

    //######################### Validations (Attributes) #########################
    validate.async(req, constraints).then(success, error);

    function success() {
        var hashedVerificationKey = req.params.verificationkey;
        var tableUserPasswordVerification = objAllTables.user_password_verification.user_password_verification();
        tableUserPasswordVerification.findAll({
            where: {
                $and: [
                    {
                        verification_key: hashedVerificationKey
                    },
                    {
                        status: 'ACTIVE'
                    }
                ]
            }
        }).then(function (userVerificationData) {
            //if key found as "ACTIVE"
            if (userVerificationData.length > 0) {
                var currentTime = helpers.getUnixTimeStamp();
                var createdTime = userVerificationData[0]['dataValues']['created'];
                var timeDiff = (currentTime - createdTime) / 3600;
                var expiryTime = userVerificationData[0]['dataValues']['expirytime'];

                //token is expired
                if (timeDiff > expiryTime) {
                    res.send(401, { meta: { status: 401, message: 'Verification Key is Expired' } });
                    return users.updateVerificationTable('user_password_verification', hashedVerificationKey, 'INACTIVE');
                }
                else {
                    //token is verified, change its status to CLICKED
                    return users.updateVerificationTable('user_password_verification', hashedVerificationKey, 'CLICKED')
                        .then(function (updateResult) {
                            if (updateResult) {
                                res.send(200, {
                                    meta: { status: 200, message: 'Key has been verified' },
                                    data: {
                                        verificationKey: hashedVerificationKey
                                    }
                                });
                                return;
                            } else {
                                res.send(401, { meta: { status: 401, message: 'Error occured in verification of key' } });
                                return;
                            }
                        });
                }
            }
            //when no ACTIVE key found
            else {
                res.send(401, { meta: { status: 401, message: 'Verification Key is not Correct' } });
                return;
            }
        });
    }

    function error(errors) {
        if (errors instanceof Error) {
            // This means an exception was thrown from a validator
            res.send(401, {
                meta: {
                    status: 401,
                    message: 'An error ocuured in validator'
                }, errors: errors
            });
            return;
        } else {
            res.send(401, {
                meta: { status: 401, message: 'validation errors' },
                errors: errors
            });
            return;
        }
    }
};

function updatePassword(uId, newPassword, oldPassword) {

    var queryCondition = {};

    if (oldPassword == null) //forgot password sscenario
        queryCondition = { uid: uId, status: 'ACTIVE' };
    else    //change password scenario
        queryCondition = { uid: uId, password: oldPassword, status: 'ACTIVE' };

    return new Promise(function (resolveResult) {
        var tableUsers = objAllTables.users.users();
        tableUsers.update({
            password: newPassword,
            updated: helpers.getUnixTimeStamp()
        }, {
                where: queryCondition
            })
            .then(function (updateResult) {
                if (updateResult == 1) {

                    //========= SEND EMAIL OF CHANGE PASSWORD ========== //
                    Utils.changePasswordEmail(uId);
                    //========= SEND EMAIL OF CHANGE PASSWORD ========== //

                    resolveResult(true);
                }
                else {
                    resolveResult(false);
                }
            });
    })
        .then(function (update) {
            if (update == true) {
                return true;
            } else {
                return false;
            }
        });
}

//reset password
exports.resetPassword = function (req, res) {

    var constraints = {
        "body": {
            presence: true
        },
        "body.newpassword": {
            presence: true,
            length: {
                minimum: 6,
                message: "must be at least 6 characters"
            }
        },
        "body.confirmnewpassword": {
            presence: true,
            length: {
                minimum: 6,
                message: "must be at least 6 characters"
            }
        },
        "body.verificationkey": {
            presence: true
        }
    };

    validate.async(req, constraints).then(success, error);

    function success() {
        //var md5 = require('md5');
        if (req.body.newpassword != req.body.confirmnewpassword) {
            res.send(401, { meta: { status: 401, message: 'Passwords do not match' } });
            return;
        }
        else {
            //now first check if the verificationkey is valid and not expire
            //if  valid and not expire than reset the password other wise send
            //try again message
            var hashedVerificationKey = req.body.verificationkey;
            var tableUserPasswordVerification = objAllTables.user_password_verification.user_password_verification();
            tableUserPasswordVerification.findAll({
                where: { verification_key: hashedVerificationKey, status: 'CLICKED' }
            }).then(function (userVerificationData) {

                if (userVerificationData.length > 0) {
                    var currentTime = helpers.getUnixTimeStamp();
                    var createdTime = userVerificationData[0]['dataValues']['created'];
                    var timeDiff = (currentTime - createdTime) / 3600;
                    var expiryTime = userVerificationData[0]['dataValues']['expirytime'];
                    var uId = userVerificationData[0]['dataValues']['uid'];

                    //check token expiration
                    if (timeDiff > expiryTime) {
                        res.send(401, { meta: { status: 401, message: 'Verification Key is Expired' } });
                        return users.updateVerificationTable('user_password_verification', hashedVerificationKey, 'INACTIVE');
                    }
                    else {
                        //hashed the new password, than update
                        var newPassword = helpers.hashPassword(req.body.newpassword); // md5(req.body.newpassword);

                        return updatePassword(uId, newPassword)
                            .then(function (updateResult) {
                                if (updateResult == true) {
                                    res.send(200, { status: 200, message: 'password reset successfully' });
                                    return users.updateVerificationTable('user_password_verification', hashedVerificationKey, 'INACTIVE');
                                }
                                else {
                                    res.send(401, { status: 401, message: 'failed to reset password' });
                                    return;
                                }
                            });
                    }
                }
                else {
                    res.send(401, { meta: { status: 401, message: 'Verification Key is not Correct' } });
                    return;
                }
            });
        }
    }

    function error(errors) {
        if (errors instanceof Error) {
            // This means an exception was thrown from a validator
            res.send(401, {
                meta: {
                    status: 401,
                    message: 'An error ocuured in validator'
                }, errors: errors
            });
            return;
        } else {
            res.send(401, {
                meta: { status: 401, message: 'validation errors' },
                errors: errors
            });
            return;
        }
    }
};

//user EMAIL verification
exports.userVerification = function (req, res) {

    var SessionUser;
    helpers.GetActiveSession_ORM(req)
        .then(function (sessionUser) {

            if (sessionUser == null) {
                res.send(401, { status: 401, message: 'user is not logged in or invalid token' });
                throw new Error('break promise chain');
            }

            SessionUser = sessionUser;
            return;
        })
        .then(function () {

            //return new Promise(function (resolveEmail) {
            var userEmail = null;
            var users = objAllTables.users.users();

            //fetch the user_email now
            return users.findAll({
                where: { uid: SessionUser.uid }
            })
                .then(function (userData) {

                    if (userData.length == 0) {
                        res.send(404, { status: 404, message: 'user not found' });
                        throw new Error('break promise chain');
                    }
                    else if (userData[0]['dataValues']['user_email'] == null) {
                        res.send(401, { status: 401, message: 'email not found' });
                        throw new Error('break promise chain');
                    }
                    else if (userData[0]['dataValues']['account_verrified'] == 1) {
                        res.send(401, { status: 401, message: 'already verified' });
                        throw new Error('break promise chain');
                    }
                    else {
                        return;
                    }
                });
        })
        .then(function () {
            return Utils.sendVerificationEmail(SessionUser.uid, SessionUser.user_email, SessionUser.name)
                .then(function (response) {
                    if (response == true) {
                        res.send(200, { meta: { status: 200, message: "Check your Email" } });
                    }
                    else {
                        res.send(500, { status: 500, message: 'unhandled exception' });
                    }
                });
        })
        .catch(function (err) {
            if (err.message == 'break promise chain')
                return;
            else {
                res.send(500, { status: 500, message: err.message });
            }
        });

};

exports.userVerification_old = function (req, res) {

    var SessionUser;
    helpers.GetActiveSession_ORM(req)
        .then(function (sessionUser) {

            if (sessionUser == null) {
                res.send(401, { status: 401, message: 'user is not logged in or invalid token' });
                throw new Error('break promise chain');
            }

            SessionUser = sessionUser;
            return;
        })
        .then(function () {

            //return new Promise(function (resolveEmail) {
            var userEmail = null;
            var users = objAllTables.users.users();

            //fetch the user_email now
            return users.findAll({
                where: { uid: SessionUser.uid }
            })
                .then(function (userData) {

                    if (userData.length == 0) {
                        res.send(404, { status: 404, message: 'user not found' });
                        throw new Error('break promise chain');
                    }
                    else if (userData[0]['dataValues']['user_email'] == null) {
                        res.send(401, { status: 401, message: 'email not found' });
                        throw new Error('break promise chain');
                    }
                    else if (userData[0]['dataValues']['account_verrified'] == 1) {
                        res.send(401, { status: 401, message: 'already verified' });
                        throw new Error('break promise chain');
                    }
                    else {
                        return;
                    }
                });
        })
        //get code
        .then(function () {

            //generate unique and hashed verification key
            return helpers.getHashedVerificationKey(SessionUser.uid, 'email')
                .then(function (hashedVerificationKey) {
                    return hashedVerificationKey;
                });
        })
        //save code in db
        .then(function (hashedVerificationKey) {

            //so first save this in table and then
            //embed this in hyperlink and
            //email to the user
            var tableUserEmailVerification = objAllTables.user_email_verification.user_email_verification();
            return tableUserEmailVerification.create({
                uid: SessionUser.uid,
                verification_key: hashedVerificationKey,
                expirytime: '24',
                status: 'ACTIVE',
                created: helpers.getUnixTimeStamp()
            })
                .then(function (insertedData) {
                    //apply insert check here
                    if (insertedData == null) {
                        res.send(500, {
                            status: 500,
                            message: 'hashed code insertion into db was not successful. after insertion error'
                        });
                        throw new Error('break promise chain');
                    }

                    return hashedVerificationKey;
                })
                .catch(function (err) {
                    res.send(500, {
                        meta: { status: 500, message: "error while inserting hashed code into db" },
                        details: err
                    });
                    return;
                });

        })
        //send email
        .then(function (hashedVerificationKey) {

            //hyperLink will be like following
            // "http://linkagoal.com/account/verify/:hashedVerificationKey"
            //var hyperLink = new Array(config.baseUrl.apiServer, 'account', 'verify', hashedVerificationKey).toURL();

            var hyperLink = config.baseUrl.apiServer + 'account/verify/' + hashedVerificationKey;
            res.send(200, { meta: { status: 200, message: "Check your Email" } });

            var email = require('./EmailNotifications.js');
            return email.emailNotifications_Personal({
                to_uid: SessionUser.uid,
                type: 'VERIFICATION_EMAIL',
                data: { verify_email_link: hyperLink }
            });
        })
        .catch(function (err) {
            if (err.message == 'break promise chain')
                return;
            else
                throw err;
        });

};

//verification of hyperlink
exports.verifyHyperLink = function (req, res) {

    var constraints = {
        "params": {
            presence: true
        },
        "params.verificationkey": {
            presence: true,
        }
    };

    //######################### Validations (Attributes) #########################
    validate.async(req, constraints).then(success, error);

    function success() {
        var hashedVerificationKey = req.params.verificationkey || null;
        var tableUserEmailVerification = objAllTables.user_email_verification.user_email_verification();
        tableUserEmailVerification.findAll({
            where: {
                $and: [
                    {
                        verification_key: hashedVerificationKey
                    },
                    {
                        status: 'ACTIVE'
                    }
                ]
            }
        }).then(function (userVerificationData) {
            if (userVerificationData.length > 0) {
                var currentTime = helpers.getUnixTimeStamp();
                var createdTime = userVerificationData[0]['dataValues']['created'];
                var timeDiff = (currentTime - createdTime) / 3600;
                var expiryTime = userVerificationData[0]['dataValues']['expirytime'];
                if (timeDiff > expiryTime) {
                    return users.updateVerificationTable('user_email_verification', hashedVerificationKey, 'INACTIVE')
                        .then(function (updateResult) {
                            if (updateResult) {
                                res.send(401, {
                                    meta: {
                                        status: 401,
                                        message: 'Verification Key is Expire, Try Again with new Verification Key'
                                    }
                                });
                                return;
                            } else {
                                res.send(401, {
                                    meta: {
                                        status: 401,
                                        message: 'User Account Verification Failed, Try Again with new Verification Key'
                                    }
                                });
                                return;
                            }
                        });
                } else {
                    // update the user's account_verified and user's email_valid status to 1 from 0
                    var uId = userVerificationData[0]['dataValues']['uid'];
                    var tableUsers = objAllTables.users.users();
                    tableUsers.update({
                        account_verified: 1,
                        email_valid: 1,
                        updated: helpers.getUnixTimeStamp()
                    }, {
                            where: {
                                uid: uId
                            }
                        })
                        .then(function (updateResult) {
                            //hence verificationkey is utilize so
                            // now update the verificationkey status to inactive
                            if (updateResult >= 1) {
                                users.updateVerificationTable('user_email_verification', hashedVerificationKey, 'INACTIVE')
                                    .then(function (updateVerificationResult) {
                                        if (updateVerificationResult) {
                                            res.send(200, {
                                                meta: {
                                                    status: 200,
                                                    message: 'User Account Verified Successfully'
                                                }
                                            });
                                            return;
                                        } else {
                                            res.send(401, {
                                                meta: {
                                                    status: 401,
                                                    message: 'User Account Verification Failed, Try Again with new Verification Key'
                                                }
                                            });
                                            return;
                                        }
                                    })
                            } else {
                                res.send(401, {
                                    meta: {
                                        status: 401,
                                        message: 'User Account Verification Failed, Try Again with new Verification Key'
                                    }
                                });
                                return;
                            }
                        });
                }
            } else {
                res.send(401, {
                    meta: {
                        status: 401,
                        message: 'Verification Key is not Correct'
                    }
                });
                return;
            }
        });
    }

    function error(errors) {
        if (errors instanceof Error) {
            // This means an exception was thrown from a validator
            res.send(401, {
                meta: {
                    status: 401,
                    message: 'An error ocuured in validator'
                }, errors: errors
            });
        } else {
            res.send(401, {
                meta: { status: 401, message: 'validation errors' },
                errors: errors
            });
        }
    }
};

//User defined location - not in use
exports.saveUserDefinedLocation = function (req, res) {
    var tableUserDefinedLocation = objAllTables.user_defined_location.user_defined_location();
    return tableUserDefinedLocation.findOrCreate({
        where: {
            $and: {
                street_number: req.body.userDefinedLocation.street_number,
                route: req.body.userDefinedLocation.route,
                locality: req.body.userDefinedLocation.locality,
                administrative_area_level_1: req.body.userDefinedLocation.administrative_area_level_1,
                country: req.body.userDefinedLocation.country,
                postal_code: req.body.userDefinedLocation.postal_code,
                status: 'ACTIVE',
                latitude: req.body.userDefinedLocation.latitude,
                longitude: req.body.userDefinedLocation.longitude
            }
        },
        defaults: {
            street_number: req.body.userDefinedLocation.street_number,
            route: req.body.userDefinedLocation.route,
            locality: req.body.userDefinedLocation.locality,
            administrative_area_level_1: req.body.userDefinedLocation.administrative_area_level_1,
            country: req.body.userDefinedLocation.country,
            postal_code: req.body.userDefinedLocation.postal_code,
            status: 'ACTIVE',
            created: helpers.getUnixTimeStamp(),
            latitude: req.body.userDefinedLocation.latitude,
            longitude: req.body.userDefinedLocation.longitude
        }
    })
        .spread(function (user, created) {
            res.send(
                {
                    meta: { status: 200, message: 'Success' },
                    data: {
                        id: user.id,
                        street_number: user.street_number,
                        route: user.route,
                        locality: user.locality,
                        administrative_area_level_1: user.administrative_area_level_1,
                        country: user.country,
                        postal_code: user.postal_code,
                        latitude: req.body.userDefinedLocation.latitude,
                        longitude: req.body.userDefinedLocation.longitude
                    }
                }
            );
        })
        .error(function () {
            res.send({ meta: { status: 404, message: 'Error Occured' }, data: {} });
        });
};

exports.notificationSettings = function (req, res) {

    helpers.getActiveSession(req).then(function (SessionUser) {
        if (SessionUser.type == "Recognized") {
            var Query = "SELECT settings.id,types.type,settings.toast,settings.mobile,settings.email\
                     FROM user_notification_settings as settings JOIN default_notification_types as types\
                      ON settings.type_id= types.id\
                where settings.uid ={0} ".format(SessionUser.uid);

            sequelize.query(Query, { type: sequelize.QueryTypes.SELECT }).then(function (data) {
                res.send(200, { meta: { status: 200, message: 'success' }, data: data });
            })
        } else {
            res.send(401, { meta: { status: 401, message: 'Unauthorized' } });
        }
    })
        .error(function (err) {
            res.send({ meta: { status: 500, message: 'unexpected error' } });
        });

};

exports.updateNotificationSettings = function (req, res) {

    helpers.getActiveSession(req).then(function (SessionUser) {
        if (SessionUser.type == "Recognized") {

            var user_notification_settings = objAllTables.user_notification_settings.user_notification_settings();
            var id = req.body.id;

            var tempObj = req.body;
            for (var key in tempObj) {
                if (key != 'mobile' && key != 'toast' && key != 'email') {
                    delete tempObj[key];
                }
            }

            return user_notification_settings.update(tempObj, { where: { id: id } })
                .then(function (data) {
                    if (data == 1)
                        res.send(200, { meta: { status: 200, message: 'success' } });
                    else
                        res.send(500, { meta: { status: 500, message: 'already exists' } });
                });
        } else {
            res.send({ meta: { status: 401, message: 'user is not logged in or invalid token' } });
        }
    })
        .error(function (err) {
            res.send({ meta: { status: 500, message: 'unexpected error' } });
        })
        .catch(function (err) {
            res.send({ meta: { status: 500, message: 'unexpected error' } });
        });

};

exports.userMute = function (req, res) {

    var uId = req.params.username;


    var constraints = {
        "params.username": {
            presence: true
        }
    };

    validate.async(req, constraints).then(success, error);

    function success() {
        helpers.getActiveSession(req).then(function (SessionUser) {
            if (SessionUser.type == "Recognized") {
                new Promise(function (resolve, reject) {
                    return new User(req.params.userName, SessionUser.uid).get({ basic: ['uid'] })
                        .then(function (user) {
                            resolve(user[0]);
                        })
                }).then(function (user) {
                    if (user.uid != SessionUser.uid) {
                        var user_mute = objAllTables.user_mute.user_mute();
                        return user_mute.findOrCreate({
                            where: {
                                mute_uid: user.uid,
                                uid: SessionUser.uid
                            },
                            defaults: {
                                status: "ACTIVE",
                                created: helpers.getUnixTimeStamp(),
                                updated: helpers.getUnixTimeStamp()
                            }
                        }).spread(function (userMute, created) {
                            if (created == false) {
                                if (userMute['dataValues'].status = "INACTIVE") {
                                    user_mute.update({
                                        status: 'ACTIVE', created: helpers.getUnixTimeStamp(), updated: helpers.getUnixTimeStamp()
                                    }, { where: { uid: SessionUser.uid, mute_uid: user.uid } }).then(function () {
                                        res.send(200, { meta: { status: 200, message: 'success' } });
                                    });
                                }
                                else
                                    res.send(200, { meta: { status: 200, message: 'success' } });
                            }
                            else {
                                res.send(200, { meta: { status: 200, message: 'success' } });
                            }
                        })
                    } else {
                        res.send(401, { meta: { status: 401, message: 'Unauthorized' } });
                    }
                })
            } else {
                res.send(401, { meta: { status: 401, message: 'Unauthorized' } });
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
            res.send({
                meta: { status: 401, message: 'validation errors' },
                errors: errors
            });
        }
    };
};

exports.getUserReport = function (req, res) {

    var constraints = {
        "params.username": {
            presence: true
        }
    };

    validate.async(req, constraints).then(success, error);


    function success() {

        res.send(200, { meta: { status: 200, message: 'success' } });
    }


    function error(errors) {
        if (errors instanceof Error) {
            // This means an exception was thrown from a validator
            res.send({
                meta: { status: 401, message: 'An error ocuured in validator' },
                errors: errors
            });
        } else {
            res.send({
                meta: { status: 401, message: 'validation errors' },
                errors: errors
            });
        }
    }
};

exports.userBlock = function (req, res) {
    var uidBlock = req.params.username;

    //######################### Validations (Rules) #########################
    var constraints = {
        "params.username": {
            presence: true
        }
    };

    //######################### Validations (Attributes) #########################

    validate.async(req, constraints).then(success, error);


    function success() {

        helpers.getActiveSession(req).then(function (SessionUser) {
            if (SessionUser.type == 'Recognized') {
                new Promise(function (resolve, reject) {
                    return new User(req.params.username, SessionUser.uid).get({ basic: ['uid'] })
                        .then(function (user) {
                            resolve(user[0]);
                        })
                }).then(function (user) {

                    var sequelize = db.sequelizeConn();

                    sequelize.query('CALL sp_UserBlock({0},{1});'.format(SessionUser.uid, user.uid)).then(function (data) {
                        if (data[0].result == 200) {
                            res.send(200, { "meta": { "status": 200, "message": "success" } });
                        }
                        else if (data[0].result == -1) {
                            res.send(404, { "meta": { "status": 404, "message": "not found" } });
                        }
                        else if (data[0].result == 404) {
                            res.send(404, { "meta": { "status": 404, "message": "not found" } });
                        }
                        else if (data[0].result == 401) {
                            res.send(404, { "meta": { "status": 404, "message": "already blocked" } });
                        }
                        else if (data[0].result == 500) {
                            res.send(500, { "meta": { "status": 500, "message": "unknown error in stored procedure" } });
                        } else {
                            res.send(500, { "meta": { "status": 500, "message": "unexpected response from procedure" } });
                        }
                    }).error(function (err) {
                        res.send(500, { meta: { status: 500, message: 'Internel Error', data: err } });
                    });
                })

            } else {
                res.send(401, { meta: { status: 401, message: 'Unauthorized' } });
            }
        }).error(function (err) {
            res.send(401, { meta: { status: 401, message: err } });
        });
    }

    function error(errors) {
        if (errors instanceof Error) {
            // This means an exception was thrown from a validator
            console.err("An error ocurred", errors);
        } else {
            res.send(401, { meta: { status: 401, message: 'validation errors' }, errors: errors });
        }
    };
};

exports.userUnblock = function (req, res) {
    helpers.getActiveSession(req).then(function (SessionUser) {
        if (SessionUser.type == 'Recognized') {
            new Promise(function (resolve, reject) {
                return new User(req.params.username, SessionUser.uid).get({ basic: ['uid'] })
                    .then(function (user) {
                        resolve(user[0]);
                    })
            }).then(function (user) {
                var user_block = objAllTables.user_block.user_block();
                return user_block.update(
                    { status: 'INACTIVE', created: helpers.getUnixTimeStamp() },
                    { where: { uid: SessionUser.uid, blocked_uid: user.uid } }
                );
            })
            res.send(200, { meta: { status: 200, message: 'success' } });
        } else {
            res.send(401, { meta: { status: 401, message: 'Unauthorized' } });
        }
    }).error(function (err) {
        res.send({ meta: { status: 401, message: err } });
    });
};

exports.userUnMute = function (req, res) {

    helpers.getActiveSession(req).then(function (SessionUser) {
        if (SessionUser.type == 'Recognized') {
            new Promise(function (resolve, reject) {
                return new User(req.params.username, SessionUser.uid).get({ basic: ['uid'] })
                    .then(function (user) {
                        resolve(user[0]);
                    })
            }).then(function (user) {
                var user_mute = objAllTables.user_mute.user_mute();
                return user_mute.update({
                    status: 'INACTIVE', created: helpers.getUnixTimeStamp()
                }, { where: { uid: SessionUser.uid, mute_uid: user.uid } })
            })
            res.send(200, { meta: { status: 200, message: 'success' } });
        } else {
            res.send(401, { meta: { status: 401, message: 'Unauthorized' } });
        }
    }).error(function (err) {
        res.send({ meta: { status: 401, message: err } });
    });
};
//testing functions
//exports.generateHashIdToken = function (req, res) {
//    Utils.generateToken();
//}*/
exports.getSessions_old = function (req, res) {

    helpers.GetActiveSession_ORM(req).then(function (sessionUser) {
        //session is active, user has been authenticated
        if (sessionUser != null) {


            //checking if the username is of session user or if uid is of session user

            //if "uid" is not null, proceed and get his profile
            if (sessionUser.uid != null) {
                var sessions = objAllTables.sessions.sessions();
                sessions.findAll({
                    where: { uid: sessionUser.uid, status: 'ACTIVE' },
                    attributes: ['SessionId', 'uid', 'useragent', 'clientid', 'clientsecret', 'os', 'osVersion', 'browserName', 'browserMajorVersion', 'browserFullVersion', 'mobile', 'isRetina', 'isHighDensity', 'flashVersion', 'cookies', 'screenSize', 'fullUserAgent', 'created', 'expireTime', 'locationId']
                }).then(function (sessionsIds) {

                    res.send(200, {
                        meta: { status: 200, message: 'success' },
                        sessions: sessionsIds
                    });
                })
            }
            else
                res.send({ status: 401, message: 'Session does not exists' });

        }
        //user is not logged in, or provided incorrect or expired token
        else {
            res.send(401, {
                meta: {
                    status: 401,
                    message: 'user is not logged or invalid token'
                }
            });
        }
    }).error(function (err) {
        res.send(500, { meta: { status: 500, message: 'internal error' }, details: err });
    });
};

exports.getSessions = function (req, res) {

    helpers.getActiveSession(req).then(function (SessionUser) {
        if (SessionUser.type == "Recognized") {

            var sessions = objAllTables.sessions.sessions();
            var locations = objAllTables.location.location();

            locations.hasMany(sessions, { foreignKey: 'locationId' });
            sessions.belongsTo(locations, { foreignKey: 'locationId' });

            sessions.findAll({
                where: { uid: SessionUser.uid, status: 'ACTIVE' },
                attributes: ['SessionId', 'uid', 'clientid', 'clientsecret', 'token', 'status', 'uuid', 'device_subscription_token', 'platform', 'platform_version', 'model', 'mobile', 'isRetina', 'screen_width', 'screen_height', 'useragent', 'created', 'expireTime', 'locationId'],
                include: [{
                    model: locations,
                    attributes: ['ip', 'countryCode', 'countryName', 'region', 'city', 'postalCode', 'latitude', 'longitude', 'dmaCode', 'areaCode', 'metroCode', 'continentCode', 'regionName'],
                    required: false
                }]
            }).then(function (sessionsIds) {
                res.send(200, { meta: { status: 200, message: 'OK' }, sessions: sessionsIds });
            })

        } else {
            res.send(401, { meta: { status: 401, message: 'Unauthorized' } });
        }
    }).error(function (err) {
        res.send(500, { meta: { status: 500, message: 'internal error' }, details: err });
    });

};

exports.killSessions = function (req, res) {

    helpers.getActiveSession(req).then(function (SessionUser) {
        if (SessionUser.type == "Recognized") {

            var SId = parseInt(req.params.id);

            var sessions = objAllTables.sessions.sessions();
            sessions.update({ status: 'INACTIVE' }, { where: { SessionId: SId, uid: sessionUser.uid, status: 'ACTIVE' } })
                .then(function (rowsUpdated) {
                    if (rowsUpdated == 1) {
                        res.send(200, { status: 200, message: 'success' });
                    }
                    else if (rowsUpdated == 0) {
                        res.send(404, { status: 404, message: 'unsuccessful' });
                    } else {
                        res.send(200, { status: 200, message: 'success' });
                    }
                })
        } else {
            res.send(401, { meta: { status: 401, message: 'Unauthorized' } });
        }
    }).error(function (err) {
        res.send(500, { meta: { status: 500, message: 'internal error' }, details: err });
    });

};

exports.userUpdateProfile = function (req, res) {

    //######################### Validations (Rules) #########################
    var constraints = {
        "body": {
            presence: true
        },
        "body.attach_id": {
            presence: true,
            numericality: {
                noString: true
            }
        }
    };

    //######################### Validations (Attributes) #########################
    /*   var attributes = {
     id: goalId,
     attach_id: attachId
     };*/

    validate.async(req, constraints).then(success, error);

    function success() {
        helpers.GetActiveSession_ORM(req).then(function (sessionUser) {
            if (sessionUser != null) {

                var attachId = [req.body.attach_id];
                var data = {};

                //######################### Create Post (start) #########################
                var posts = require('../controllers/posts');

                //uid, text, media_id, fetched_url_id, scope_id, post_type, parent_id, req
                return posts.createPost(sessionUser.uid, "", attachId, null, 1, 'PROFILE_PICTURE_UPDATED', null, req)
                    .then(function (postObj) {

                        if (postObj.post != null) {

                            data.post = postObj.post.dataValues;
                            //get post object
                            return helpers.getPost(data.post.id, true, sessionUser.uid)
                                .then(function (post) {
                                    data.post = post;
                                    res.send(200, {
                                        meta: { status: 200, message: 'Success' },
                                        data: data
                                    });
                                });
                        }
                        //######################### Create Post (end) #########################
                    }).then(function () {
                        var usersUpdate = objAllTables.users.users();
                        return usersUpdate.update({
                            updated: helpers.getUnixTimeStamp(),
                            profile_image_id: attachId
                        }
                            , { where: { uid: sessionUser.uid } })
                            .then(function (rowsUpdated) {
                            });

                    }).then(function () {
                        //######################### Record Activity (start) #########################
                        //record activity and generate feed
                        var feedController = require('../controllers/feed');

                        feedController.createActivity(sessionUser.uid, 'PROFILE_PICTURE_UPDATED', sessionUser.uid, null, null, data.post.id, true, true);
                        //######################### Record Activity (end) #########################
                    });
            }
            else {
                res.send(401, { meta: { status: 401, message: 'Unauthorized' } });
            }
        }).error(function (err) {
            res.send(401, { meta: { status: 401, message: err } });
        });

    }

    function error(errors) {
        if (errors instanceof Error) {
            // This means an exception was thrown from a validator
            res.send(401, {
                meta: {
                    status: 401,
                    message: 'An error occurred in validator'
                }, errors: errors
            });
        } else {
            res.send(401, {
                meta: { status: 401, message: 'validation errors' },
                errors: errors
            });
        }
    }
};

exports.userUpdateCover = function (req, res) {


    //######################### Validations (Rules) #########################
    var constraints = {
        "body": {
            presence: true
        },
        "body.attach_id": {
            presence: true,
            numericality: {
                noString: true
            }
        }
    };

    //######################### Validations (Attributes) #########################
    /*   var attributes = {
     id: goalId,
     attach_id: attachId
     };*/

    validate.async(req, constraints).then(success, error);

    function success() {
        helpers.GetActiveSession_ORM(req).then(function (sessionUser) {
            if (sessionUser != null) {

                var attachId = [req.body.attach_id];
                var data = {};

                //######################### Create Post (start) #########################
                var posts = require('../controllers/posts');
                //uid, text, media_id, fetched_url_id, scope_id, post_type, parent_id, req

                return posts.createPost(sessionUser.uid, "", attachId, null, 1, 'PROFILE_COVER_UPDATED', null, req)
                    .then(function (postObj) {
                        if (postObj.post != null) {

                            data.post = postObj.post.dataValues;
                            //get post object
                            return helpers.getPost(data.post.id, true, sessionUser.uid)
                                .then(function (post) {
                                    data.post = post;
                                    res.send(200, {
                                        meta: { status: 200, message: 'Success' },
                                        data: data
                                    });
                                });
                        }
                        //######################### Create Post (end) #########################
                    }).then(function () {
                        var usersUpdate = objAllTables.users.users();
                        usersUpdate.update({
                            updated: helpers.getUnixTimeStamp(),
                            cover_image_id: attachId
                        }
                            , { where: { uid: sessionUser.uid } })
                            .then(function (rowsUpdated) {
                            });

                    }).then(function () {
                        //######################### Record Activity (start) #########################
                        //record activity and generate feed
                        var feedController = require('../controllers/feed');

                        feedController.createActivity(sessionUser.uid, 'PROFILE_COVER_UPDATED', sessionUser.uid, null, null, data.post.id, true, true);
                        //######################### Record Activity (end) #########################
                    });
            } else {
                res.send(401, { meta: { status: 401, message: 'Unauthorized' } });
            }
        }).error(function (err) {
            res.send(401, { meta: { status: 401, message: err } });
        });

    }

    function error(errors) {
        if (errors instanceof Error) {
            // This means an exception was thrown from a validator
            res.send({
                meta: { status: 401, message: 'An error occurred in validator' },
                errors: errors
            });
        } else {
            res.send({
                meta: { status: 401, message: 'validation errors' },
                errors: errors
            });
        }
    }

};

exports.mentionedUsers = function (req, res) {

    var text = req.body.text;
    helpers.GetActiveSession_ORM(req)
        .then(function (sessionUser) {
            if (sessionUser != null) {

                return Utils.getMentionedUserId(text, 3)
                    .then(function (mentionedUsers) {
                        res.send(mentionedUsers);

                        for (var i = 0; i < mentionedUsers.mentionUser.length; i++) {

                            if (mentionedUsers.mentionUser[i].validated == true) {

                                var mentioned_post = objAllTables.mentioned_post.mentioned_post();
                                return mentioned_post.findOrCreate({
                                    where: {
                                        uid: sessionUser.uid,
                                        mentioned_id: mentionedUsers.mentionUser[i].uid,
                                        status: 'ACTIVE',
                                        post_id: 1,
                                        mentioned_name: mentionedUsers.mentionUser[i].finalName,
                                    },
                                    defaults: {
                                        created: helpers.getUnixTimeStamp()
                                    }
                                }).then(function (mentioned_post, created) {
                                })
                            }
                        }
                    });

            } else {
                res.send(401, { meta: { status: 401, message: 'Unauthorized' } });
            }
        }).error(function (err) {
            res.send({ meta: { status: 401, message: err } });
        });
};

exports.updateVerificationTable = function (table, hashedVerificationKey, statusToBeSet) {
    return new Promise(function (resolveUpdating) {
        if (table == 'user_email_verification') {
            var tableUserEmailVerification = objAllTables.user_email_verification.user_email_verification();
            tableUserEmailVerification.update({
                status: statusToBeSet,
            }, {
                    where: {
                        verification_key: hashedVerificationKey
                    }
                }).then(function (updateResult) {
                    if (updateResult >= 1) {
                        resolveUpdating('true');
                    } else {
                        resolveUpdating('false');
                    }
                })
        }
        else if (table == 'user_password_verification') {
            var tableUserPasswordVerification = objAllTables.user_password_verification.user_password_verification();
            tableUserPasswordVerification.update({
                status: statusToBeSet,
            }, {
                    where: {
                        verification_key: hashedVerificationKey
                    }
                }).then(function (updateResult) {
                    if (updateResult >= 1) {
                        resolveUpdating('true');
                    } else {
                        resolveUpdating('false');
                    }
                })
        }
    })
        .then(function (updateResult) {

            if (updateResult == 'true') {
                return true;
            } else {
                return false;
            }
        });
};

exports.about = function (req, res) {
    var constraints = {
        "params": {
            presence: true
        },
        "params.id": {
            presence: true
        }
    };

    validate.async(req, constraints).then(success, error);
    function success() {
        helpers.getActiveSession(req)
            .then(function (SessionUser) {
                if (SessionUser.type == 'Recognized' || SessionUser.type == 'UnRecognized') {
                    var uId = req.params.id;
                    var tableUsers = objAllTables.users.users();
                    var tableWorkHistory = objAllTables.user_work_history.user_work_history();
                    var tableEducation = objAllTables.user_education_history.user_education_history();
                    var tableUserDefinedLocation = objAllTables.user_defined_location.user_defined_location();

                    var query = "Select CheckPrivacy_User({0},{1}) as a".format(SessionUser.uid, uId);
                    return sequelize.query(query, { type: sequelize.QueryTypes.SELECT })
                        .then(function (response) {
                            if (response[0].a == 1 || response[0].a == 0) {
                                return tableUsers.findAll({
                                    where: { uid: uId },
                                    attributes: ['uid', 'bio', 'location_id']
                                })
                                    .then(function (tableUsersData) {
                                        if (tableUsersData.length > 0) {
                                            //resolveUser(tableUsersData[0].dataValues);
                                            return tableUsersData[0].dataValues;
                                        } else {
                                            //resolveUser(null);
                                            return null;
                                        }


                                    });
                            }
                            else {
                                //resolveUser(null);
                                return null;
                            }

                        })
                        .then(function (userProfile) {
                            if (userProfile == null) {
                                throw new Error('User not found');
                            }
                            else {
                                if (userProfile.user_location != null && userProfile.user_location != 0) {
                                    return tableUserDefinedLocation.findOne({
                                        where: { id: userProfile.user_location }
                                    })
                                        .then(function (tableUserDefinedLocation) {
                                            userProfile.location = tableUserDefinedLocation;
                                            return userProfile;
                                        });
                                }
                                else {
                                    userProfile.location = {};
                                    return userProfile;
                                }
                            }

                        })
                        .then(function (userProfile) {

                            return tableWorkHistory.findAll({
                                where: { uid: uId },
                                order: [['_id', 'DESC']],
                                limit: 2
                            }).then(function (tableWorkHistory) {

                                userProfile.workHistory = [];

                                if (tableWorkHistory.length > 0) {
                                    userProfile.workHistory = tableWorkHistory;
                                }
                                return userProfile;
                            });


                        })
                        .then(function (userProfile) {

                            return tableEducation.findAll({
                                where: { uid: uId },
                                order: [['id', 'DESC']],
                                limit: 2
                            }).then(function (tableEducation) {
                                userProfile.educationHistory = [];
                                if (tableEducation.length > 0) {
                                    userProfile.educationHistory = tableEducation;
                                }
                                return userProfile;
                            });

                        })
                        .then(function (userProfile) {

                            res.send(200, { meta: { status: 200, message: 'OK' }, data: userProfile });
                        })
                        .catch(function (err) {
                            if (err == 'User not found') {
                                res.send(404, { meta: { status: 404, message: 'Not Found' } });
                            }
                            else {

                                res.send(500, {
                                    meta: {
                                        status: 500,
                                        message: 'Unknown Error/User may be block or private'
                                    }, details: err
                                });
                            }
                        })

                }
                else
                    res.send({ meta: { status: 401, message: 'User is not logged or invalid token' } });

            })
            .error(function (err) {
                res.send({ meta: { status: 500, message: err } });
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

exports.hoverCard = function (req, res) {
    function error(errors) {
        if (errors instanceof Error) {
            // This means an exception was thrown from a validator
            console.err("An error ocurred", errors);
        } else {
            res.send({ meta: { status: 401, message: 'validation errors' }, errors: errors });
        }
    }

    //var userName = req.params.username

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
        helpers.GetActiveSession_ORM(req)
            .then(function (SessionUser) {
                //session is active, user has been authenticated

                if (validator.isNull(req.params.username)) {
                    res.send({ meta: { status: 401, message: 'username can not be null' } });
                }
                /*else if(validator.isNumeric(req.params.username)){
                 res.send({meta:{status: 401, message: 'username can not be integer'}});
                 }*/

                if (SessionUser != null) {
                    var username_param = req.params.username;
                    //if "username" is not a number (it means its a "username", otherwise it will be "uid")
                    //so first "uid" will be fetched based on "username"
                    //then his profile will be generated w.r.t. to the Session user
                    if (isNaN(username_param)) {
                        //get "uid" by "username"
                        var users = objAllTables.users.users();
                        return users.findOne({
                            where: { username: username_param },
                            attributes: ['uid']
                        }).then(function (uid) {

                            var user_profileuid = uid['dataValues'].uid;
                            //if "uid" is not null, proceed and get his profile
                            if (uid != null) {
                                helpers.GetUser_ORM(uid['uid'], SessionUser['uid'])
                                    .then(function (userProfile) {
                                        res.send({ meta: { status: 200, message: 'success' }, data: userProfile });
                                    });
                            }
                            else
                                res.send({ meta: { status: 404, message: 'user does not exists' } });
                        })
                    }
                    else if (!isNaN(username_param)) {
                        var uid = parseInt(username_param);
                        helpers.GetUser_ORM(uid, SessionUser['uid'])
                            .then(function (userProfile) {
                                if (userProfile != null)
                                    res.send({ meta: { status: 200, message: 'success' }, data: userProfile });
                                else
                                    res.send({ meta: { status: 401, message: 'user does not exists' } });
                            });
                    }
                    else
                        res.send({ meta: { status: 401, message: 'no username or uid provided' } });
                }
                //user is not logged in, or provided incorrect or expired token
                else
                    res.send({ meta: { status: 401, message: 'User is not logged or invalid token' } });
            })
            .error(function (err) {
                res.send({ meta: { status: 500, message: err } });
            });
    }
};

//#############################################################
//##################### User Follow Invitations ###############
//#############################################################

exports.getAllInvitations = function (req, res) {
    var finalObj = {};
    helpers.getActiveSession(req)
        .then(function (sessionUser) {
            if (sessionUser.type == 'Recognized') {

                var query = "select * from (\
                SELECT id,uid_requester FROM `user_follow_request` where uid = {0} AND status='ACTIVE' limit {1} OFFSET {2}) as invitations,\
                (select count(seen) as unseen from user_follow_request where uid = {0} and seen=0 AND status='ACTIVE') as unseen".format(sessionUser.uid, config.pagination.limit, config.pagination.offset);

                sequelize.query(query, { type: sequelize.QueryTypes.SELECT })
                    .then(function (result) {
                        var invitation = [];
                        var finalObj = {};
                        for (var i = 0; i < result.length; i++) {
                            invitation.push({ id: result[i].id, uid_requester: result[i].uid_requester });
                        }
                        finalObj.unseen = result[0].unseen;
                        finalObj.invitations = invitation;
                        res.send({ meta: { status: 200, message: 'success' }, data: finalObj });
                    });


            }
            else
                res.send(401, { meta: { status: 401, message: 'user is not logged in invalid token' } });
        });

};

exports.viewRequest = function (req, res) {

    helpers.getActiveSession(req)
        .then(function (sessionUser) {
            if (sessionUser.type == 'Recognized') {

                var user_follow_request = objAllTables.user_follow_request.user_follow_request();
                user_follow_request.update({
                    seen: 1, created: helpers.getUnixTimeStamp()
                }, {
                        where: {
                            uid: sessionUser.uid,
                            status: 'ACTIVE'
                        }
                    })
                    .then(function (rowsUpdated) {
                        res.send(200, { meta: { status: 200, message: 'Success' } });

                    });
            }
            else
                res.send(401, { meta: { status: 401, message: 'user is not logged in invalid token' } });
        });

};

exports.requestActive_old = function (req, res) {


    //######################### Validations (Rules) #########################
    var constraints = {
        "params.uid": {
            presence: true,
            numericality: {
                noString: false
            }
        }
    };

    validate.async(req, constraints).then(success, error);

    function success() {
        helpers.getActiveSession(req)
            .then(function (sessionUser) {
                if (sessionUser.type == 'Recognized') {

                    //UPDATE REQUEST
                    var userFollowRequest = objAllTables.user_follow_request.user_follow_request();
                    return userFollowRequest.update({ status: 'ACCEPTED' }, {
                        where: { uid: sessionUser.uid, uid_requester: req.params.uid, status: 'ACTIVE' }
                    })
                        .then(function (rowsUpdated) {
                            if (rowsUpdated != 1) {
                                res.send(404, { meta: { status: 404, message: 'Request Not Found' } });
                                throw new Error('break promise chain');
                            }

                            return;

                        })
                        .then(function () {
                            //CHECK FOLLOW IF NOT THEN FORCEFULLY FOLLOW
                            user_follow_multiple(req.params.uid, [sessionUser.uid], req, 5, true)
                                .then(function (result) {
                                    //if follow was not successful
                                    if (result.success.length != 1) {
                                        res.send(result.failed[0].httpCode, {
                                            meta: {
                                                status: result.failed[0].httpCode,
                                                message: result.failed[0].message
                                            }
                                        });
                                        throw new Error('break promise chain');
                                    }

                                    else {
                                        res.send(200, { meta: { status: 200, message: 'Accepted ' } });
                                    }

                                    return;

                                });

                        })
                        .then(function () {
                            //DELETE NOTIFICATION
                            var user_notification = objAllTables.notifications.notifications();
                            return user_notification.update({ status: 'DELETED' }, {
                                where: {
                                    uid: sessionUser.uid,
                                    type: 'USER_FOLLOW_REQUEST_CREATED',
                                    details: req.params.uid,
                                    status: 'ACTIVE'
                                }
                            });

                            return;

                        }).then(function () {
                            //CREATE NOTIFICATION
                            var notification = require('../controllers/Notifications');
                            var notificationObject = {
                                actor_uid: sessionUser.uid,
                                to_uid: req.params.uid, //requester ID
                                activity_type: 'USER_FOLLOW_REQUEST_ACCEPTED'
                            };
                            notification.createNotifications(notificationObject);
                        })
                }
                else
                    res.send(401, { meta: { status: 401, message: 'user is not logged in invalid token' } });

            }).catch(function (error) {
                if (error == "break promise chain") {
                    res.send(500, { meta: { status: 500, message: 'Unhandled Exception' } });
                }

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

exports.requestActive = function (req, res) {


    //######################### Validations (Rules) #########################
    var constraints = {
        "params.uid": {
            presence: true,
            numericality: {
                noString: false
            }
        }
    };

    validate.async(req, constraints).then(success, error);

    function success() {
        helpers.getActiveSession(req)
            .then(function (sessionUser) {
                if (sessionUser.type == 'Recognized') {

                    user_follow_multiple_accept(sessionUser.uid, [req.params.uid], req, 5)
                        .then(function (result) {
                            if (result.success.length == 0) {
                                //ERROR
                                res.send(result.failed[0].httpCode, {
                                    meta: {
                                        status: result.failed[0].httpCode,
                                        message: result.failed[0].message
                                    }
                                });
                                throw new Error('break promise chain');
                            }
                            else {
                                res.send(200, { meta: { status: 200, message: 'OK' } });

                            }
                        });
                }
                else
                    res.send(401, { meta: { status: 401, message: 'user is not logged in invalid token' } });

            }).catch(function (error) {
                if (error.message != "break promise chain") {
                    res.send(500, { meta: { status: 500, message: 'Unhandled Exception' }, details: error });
                }

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


exports.requestRejected = function (req, res) {

    //######################### Validations (Rules) #########################
    var constraints = {
        "params.uid": {
            presence: true,
            numericality: {
                noString: false
            }
        }
    };

    validate.async(req, constraints).then(success, error);

    function success() {
        helpers.getActiveSession(req)
            .then(function (sessionUser) {
                if (sessionUser.type == 'Recognized') {

                    user_follow_multiple_reject(sessionUser.uid, [req.params.uid]).then(function (result) {
                        if (result.success.length == 0) {
                            res.send(401, { meta: { status: 401, message: 'user request cannot be reject' } });
                        }
                        else {
                            res.send(200, { meta: { status: 200, message: 'success' }, details: result.success });
                        }
                    });
                }
                else
                    res.send(401, { meta: { status: 401, message: 'user is not logged in invalid token' } });
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

exports.multipleRequestRejected = function (req, res) {
    //######################### Validations (Rules) #########################
    var constraints = {
        "body.requesters_uid": {
            presence: true,
        }
    };

    validate.async(req, constraints).then(success, error);

    function success() {
        helpers.getActiveSession(req)
            .then(function (sessionUser) {
                if (sessionUser.type == 'Recognized') {

                    var requesters_uid = req.body.requesters_uid;
                    user_follow_multiple_reject(sessionUser.uid, requesters_uid).then(function (result) {
                        res.send(200, { meta: { status: 200, message: 'success' }, details: result });
                    });
                }
                else
                    res.send(401, { meta: { status: 401, message: 'user is not logged in invalid token' } });
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


exports.requestCancel = function (req, res) {
    //######################### Validations (Rules) #########################
    var constraints = {
        "params.uid": {
            presence: true,
            numericality: {
                noString: false
            }
        }
    };

    validate.async(req, constraints).then(success, error);

    function success() {
        helpers.getActiveSession(req)
            .then(function (sessionUser) {
                if (sessionUser.type == 'Recognized') {
                    user_follow_multiple_cancelled(sessionUser.uid, [req.params.uid]).then(function (result) {
                        if (result.success.length == 0) {
                            res.send(401, { meta: { status: 401, message: 'user request cannot cancel' } });
                        }
                        else {
                            res.send(200, { meta: { status: 200, message: 'success' }, details: result.success });
                        }
                    });
                }
                else
                    res.send(401, { meta: { status: 401, message: 'user is not logged in invalid token' } });
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

exports.multipleRequestCancelled = function (req, res) {
    //######################### Validations (Rules) #########################
    var constraints = {
        "body.requestees_uid": {
            presence: true,
        }
    };

    validate.async(req, constraints).then(success, error);

    function success() {
        helpers.getActiveSession(req)
            .then(function (sessionUser) {
                if (sessionUser.type == 'Recognized') {

                    var requestees_uid = req.body.requestees_uid;
                    user_follow_multiple_cancelled(sessionUser.uid, requestees_uid).then(function (result) {
                        res.send(200, { meta: { status: 200, message: 'success' }, details: result });
                    });
                }
                else
                    res.send(401, { meta: { status: 401, message: 'user is not logged in invalid token' } });
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

exports.followUser = function (req, res) {

    var userName = req.params.userName;

    function error(errors) {
        if (errors instanceof Error) {
            // This means an exception was thrown from a validator
            res.send({ meta: { status: 401, message: 'An error occured in validator' }, errors: errors });
        } else {
            res.send({ meta: { status: 401, message: 'validation errors' }, errors: errors });
        }
    }

    //######################### Validations (Rules) #########################
    var constraints = {
        "params.userName": {
            presence: true
        }
    };

    validate.async(req, constraints).then(success, error);

    function success() {
        return helpers.getActiveSession(req)
            .then(function (sessionUser) {

                if (sessionUser.permissions.User_Follow.create != 1) {
                    res.send(403, { meta: { status: 403, message: 'permission denied' } });
                    throw new Error('break promise chain');
                }

                if (sessionUser.type == 'Recognized') {

                    Utils.getUid(userName)
                        .then(function (uid) {
                            if (uid == -1) {
                                res.send(404, { meta: { status: 404, message: 'user not found' } });
                                throw new Error('break promise chain');
                            }

                            return uid;
                        })
                        .then(function (uid) {
                            return user_follow_multiple(sessionUser.uid, [uid], req, 5, false).then(function (result) {
                                //if follow was not successful
                                if (result.success.length != 1) {
                                    res.send(result.failed[0].httpCode, {
                                        meta: {
                                            status: result.failed[0].httpCode,
                                            message: result.failed[0].message
                                        }
                                    });
                                    throw new Error('break promise chain');
                                }

                                else if (result.success[0].code == 201) {
                                    res.send(result.success[0].httpCode, {
                                        meta: {
                                            status: result.success[0].httpCode,
                                            message: 'follow request created'
                                        }
                                    });
                                    throw new Error('break promise chain');
                                }

                                var data = { post: result.success[0].data.post, user_to: uid };
                                return data;
                            });
                        })
                        .then(function (data) {

                            return helpers.GetUser_ORM(data.user_to, sessionUser.uid)
                                .then(function (user) {
                                    data.user_to = user;
                                    return data;
                                })
                                .then(function (data) {
                                    return helpers.getPost(data.post.id, false, sessionUser.uid)
                                        .then(function (post) {
                                            data.post = post;
                                            return data;
                                        });
                                });
                        })
                        .then(function (data) {
                            res.send(200, { meta: { status: 200, message: 'OK' }, data: data });
                            return data;
                        }).then(function (data) {
                            helpers.increment_update_UserStats(sessionUser.uid, 'followings');
                            helpers.increment_update_UserStats(data.user_to.uid, 'followers');
                        });
                }
                else {
                    res.send(401, { meta: { status: 401, message: 'unauthorized user' } });
                }

            })
            .error(function (err) {
                res.send(500, { meta: { status: 500, message: 'unexpected error' } });
            })
            .catch(function (err) {
                if (err.message == "Already following") {
                    res.send(500, { meta: { status: 500, message: 'Already following' } });
                }
                else if (err.message == "Rollback due to error in procedure") {
                    res.send(500, { meta: { status: 500, message: "Rollback due to error in procedure" } });
                }
                else {
                    res.send(500, { meta: { status: 500, message: "Error", err: err } });
                }
            });

    }
};

exports.multifollowUser = function (req, res) {

    function error(errors) {
        if (errors instanceof Error) {
            // This means an exception was thrown from a validator
            res.send(401, { meta: { status: 401, message: 'An error occured in validator' }, errors: errors });
        } else {
            res.send(401, { meta: { status: 401, message: 'validation errors' }, errors: errors });
        }
    }

    //######################### Validations (Rules) #########################
    var constraints = {
        "body.follower_ids": {
            presence: true
        },
        "params.feedLimit": {
            presence: true,
            numericality: {
                noStrings: false
            }
        }
    };

    validate.async(req, constraints).then(success, error);

    function success() {

        return helpers.getActiveSession(req)
            .then(function (sessionUser) {

                if (sessionUser.type == 'Recognized') {

                    if (sessionUser.permissions.User_Follow.create != 1) {
                        res.send(403, { meta: { status: 403, message: 'permission denied' } });
                        throw new Error('break promise chain');
                    }

                    if (validate.isArray(req.body.follower_ids) != true) {
                        res.send(401, { meta: { status: 401, message: 'follow_ids is not a valid array' } });
                        throw new Error('break promise chain');
                    }
                    else if (req.body.follower_ids.length == 0) {
                        res.send(401, { meta: { status: 401, message: 'follow_ids array can not be empty' } });
                        throw new Error('break promise chain');
                    }

                    var feedLimits = parseInt(req.params.feedLimit);
                    var follow_ids = req.body.follower_ids;

                    user_follow_multiple(sessionUser.uid, follow_ids, req, feedLimits, false).then(function (result) {

                        if (result.success.length == 0) {
                            res.send(result.failed[0].httpCode, {
                                meta: {
                                    status: result.failed[0].httpCode,
                                    message: result.failed[0].message
                                }
                            });
                            throw new Error('break promise chain');
                        }
                        res.send(200, { meta: { status: 200, message: 'OK' }, details: result });

                    }).then(function () {
                        for (var i = 0; i < follow_ids.length; i++) {
                            helpers.increment_update_UserStats(sessionUser.uid, 'followings').then(function () {
                                helpers.increment_update_UserStats(follow_ids[i], 'followers');
                            });
                        }
                    });

                } else {
                    res.send(401, { meta: { status: 401, message: 'Unauthorized' } });
                }
            })
            .error(function (err) {
                res.send(500, { meta: { status: 500, message: 'Error Occured' } });
            })
        /*.catch(function (err) {
         if(err.message != 'break promise chain')
         res.send(500, {meta: {status: 500, message: "Error Occured", err: err}});
         });*/
    }
};

exports.multiUnfollowUser = function (req, res) {
    function error(errors) {
        if (errors instanceof Error) {
            // This means an exception was thrown from a validator
            res.send({ meta: { status: 401, message: 'An error occured in validator' }, errors: errors });
        } else {
            res.send({ meta: { status: 401, message: 'validation errors' }, errors: errors });
        }
    }

    //######################### Validations (Rules) #########################
    var constraints = {
        "body.follow_ids": {
            presence: true
        }
    };

    validate.async(req, constraints).then(success, error);

    function success() {
        return helpers.getActiveSession(req)
            .then(function (sessionUser) {
                var follow_ids = req.body.follow_ids;
                if (sessionUser.type == 'Recognized' && sessionUser.permissions.User_Follow.create == 1) {
                    user_unfollow_multiple(sessionUser.uid, follow_ids).then(function (result) {
                        res.send(200, { meta: { status: 200, message: 'OK' }, data: result });
                    });
                    for (var i = 0; i < follow_ids.length; i++) {
                        helpers.decrement_update_UserStats(sessionUser.uid, 'followings').then(function () {
                            helpers.decrement_update_UserStats(follow_ids[i], 'followers');
                        });
                    }

                } else {
                    res.send(401, { meta: { status: 401, message: 'Unauthorized' } });
                }
            })
            .error(function (err) {
                res.send(500, { meta: { status: 500, message: 'Error Occured' } });
            })
            .catch(function (err) {
                res.send(500, { meta: { status: 500, message: "Error Occured", err: err } });
            });
    }
};

//#############################################################
//############### Reusable Follow Notifications ###############
//#############################################################

//not in use
function userFollowNotificationAndFeeds(uid, sessionUser, req) {

    var data = {};
    //Check for Direct Follow
    var sequelize = db.sequelizeConn();
    return sequelize.query('CALL sp_UserFollow({0},{1});'.format(sessionUser, uid))
        .then(function (response) {
            if (response[0].result == 200) {

                //######################### Create Post (start) #########################
                var posts = require('../controllers/posts');
                //uid, text, media_id, fetched_url_id, scope_id, post_type, parent_id, req
                return posts.createPost(sessionUser, '', null, null, 1, 'USER_FOLLOWED', uid, req)
                    .then(function (postObj) {
                        data.post = postObj.post;
                        return data;
                    })
                    .then(function (data) {
                        return helpers.GetUser_ORM(uid, sessionUser)
                            .then(function (user) {

                                data.user_to = user;
                                return data;
                            });
                    })
                    .then(function (data) {
                        return helpers.getPost(data.post.id, true, sessionUser)
                            .then(function (post) {
                                data.post = post;
                                return data;
                            });
                    })

                    //######################### Create Post (end) #########################

                    //######################### Record Activity (start) #########################
                    .then(function (data) {
                        //record activity and generate feed
                        var feedController = require('../controllers/feed');

                        //uid, activity_type, source_id, parent_id, parent_type, post_id)
                        feedController.createActivity(sessionUser, 'USER_FOLLOWED', uid, null, null, data.post.id, true, true);

                        //Returning to call function
                        return data;

                        //######################### Record Activity (end) #########################
                    });
            }
            else if (response[0].result == 401) {

                throw new Error("Already following");

            }
            else if (response[0].result == 500) {

                throw new Error("Rollback due to error in procedure");
            }
        });
}

exports.validateUsernameEmail = function (req, res) {

    var isUsername = (req && req.body && req.body.username && (req.body.username != "")) ? true : false
    var isEmail = (req && req.body && req.body.email && (req.body.email != "")) ? true : false

    var constraints = {
        "body.username": {
            //presence: true,
            format: /^(?=.{3,20}$)[A-Za-z][A-Za-z0-9]+(?:[.|_][A-Za-z0-9]+)*$/
        },
        "body.email": {
            //presence: true,
            email: true
        }
    };

    validate.async(req, constraints).then(success, error);

    //var username = req.body.username;
    //var email = req.body.user_email;

    function success() {
        helpers.GetActiveSession_ORM(req)
            .then(function (SessionUser) {
                if (SessionUser != null) {

                    var errors = [];
                    var username = '';
                    var email = '';

                    //checks
                    if (isUsername == true) {
                        username = req.body.username;
                    } else {
                        errors.push({ code: 1001, message: 'Username is null ' });
                    }

                    if (isEmail == true) {
                        email = req.body.email;
                    } else {
                        errors.push({ code: 1001, message: 'Email is null ' });
                    }

                    if (isUsername || isEmail) {
                        getValidationReport(email, username)
                            .then(function (result) {

                                if (result.email == 1 || result.username == 1) {

                                    var data = {};

                                    if (result.email == 1)
                                        errors.push({ code: 1001, message: 'Email is already taken ' });
                                    if (result.username == 1)
                                        errors.push({ code: 1001, message: 'Username is already taken ' });

                                    res.send(401, { meta: { status: 401, message: "updated failed" }, data: errors });
                                    return;
                                }
                                else {
                                    res.send(200, { meta: { success: 200, message: "success" }, data: result });
                                }

                            });
                    } else {
                        res.send(401, { meta: { status: 401 }, data: errors });
                    }

                }
                else {
                    res.send(401, { meta: { status: 401, message: 'User is not logged in invalid token' } });
                }
            })
            .error(function (err) {
                res.send(500, { meta: { status: 500, message: 'unexpected error' } });
            })
            .catch(function (err) {
                res.send(500, { meta: { status: 500, message: 'unexpected error' } });
            });
    }

    function error(err) {
        res.send(401, { meta: { status: 401, message: "violating constraint" }, data: err });
    }
}

exports.changeUsernameEmail_old = function (req, res) {

    var isUsername = (req && req.body && req.body.username) ? true : false
    var isEmail = (req && req.body && req.body.email) ? true : false

    var constraints = {
        "body.username": {
            //presence: isEmail,
            format: /^(?=.{3,20}$)[A-Za-z][A-Za-z0-9]+(?:[.|_][A-Za-z0-9]+)*$/
        },
        "body.email": {
            //presence: isUsername,
            email: true
        }
    };

    validate.async(req, constraints).then(success, error);

    function success() {
        helpers.GetActiveSession_ORM(req)
            .then(function (SessionUser) {
                if (SessionUser != null) {

                    var username = '';
                    var email = '';

                    //checks
                    if (isUsername == true)
                        username = req.body.username;
                    if (isEmail == true)
                        email = req.body.email;

                    //input validation
                    getValidationReport(email, username)
                        .then(function (result) {

                            if (result.email == 1 || result.username == 1) {

                                var data = {};

                                if (result.email == 1)
                                    data.email = 'email already taken';
                                if (result.username == 1)
                                    data.username = 'username already taken';

                                res.send(401, { meta: { status: 401, message: "updated failed" }, data: data });
                                return;
                            }
                            else {
                                var updateObj = {};
                                //if email available
                                if (isEmail == true && result.email == 0) {
                                    updateObj.user_email = email;
                                    updateObj.account_verified = 0;
                                }
                                //if username available
                                if (isUsername == true && result.username == 0)
                                    updateObj.username = username;
                                //update
                                if (Object.keys(updateObj).length !== 0 && JSON.stringify(updateObj) !== JSON.stringify({})) {

                                    var users = objAllTables.users.users();
                                    users.update(updateObj, { where: { uid: SessionUser.uid } })
                                        .then(function () {
                                            res.send(200, { meta: { status: 200, message: "success" } });
                                            return;
                                        });
                                }
                                else {
                                    res.send(403, { meta: { status: 403, message: "bad request" } });
                                    return;
                                }
                            }
                        });
                }
                else {
                    res.send(401, { meta: { status: 401, message: 'User is not logged in invalid token' } });
                }
            })
            .error(function (err) {
                res.send(500, { meta: { status: 500, message: 'unexpected error' } });
            }).catch(function (err) {
                res.send(500, { meta: { status: 500, message: 'unexpected error' } });
            });
    }

    function error(err) {
        res.send(401, { meta: { status: 401, message: "violating constraint" }, data: err });
    }
}


exports.changeUsernameEmail = function (req, res) {

    var constraints = {
        "body": {
            presence: true
        },
        "body.password": {
            presence: true
        }
    };


    var username = null;
    var email = null;
    var password = null;

    //Check Body Params
    if ((req && req.body && req.body.username) ? true : false == true)
        username = req.body.username;
    if ((req && req.body && req.body.email) ? true : false == true)
        email = req.body.email;
    if ((req && req.body && req.body.password) ? true : false == true)
        password = req.body.password;


    validate.async(req, constraints).then(success, error);


    function success() {

        helpers.getActiveSession(req)
            .then(function (sessionUser) {
                if (sessionUser.type == 'Recognized') {

                    validateUser(username, email, password, sessionUser.uid)
                        .then(function (data) {
                            return data;
                        })
                        .then(function (data) {
                            if (data.result == true) {

                                var updateUser = {};
                                if (username != null)
                                    updateUser.username = username;

                                if (email != null) {
                                    updateUser.user_email = email;

                                }
                                else {
                                    email = sessionUser.user_email;
                                }


                                return sequelize.transaction(function (t) {
                                    var updateUser = {};
                                    if (username != null)
                                        updateUser.username = username;

                                    if (email != null)
                                        updateUser.user_email = email;

                                    var Users = objAllTables.users.users();
                                    return Users.update(updateUser, {
                                        where: {
                                            uid: sessionUser.uid,
                                            status: 'ACTIVE'
                                        }, transaction: t
                                    }).then(function (rowsUpdated) {


                                        return Utils.sendVerificationEmail(sessionUser.uid, email, sessionUser.first_name)
                                            .then(function (data) {
                                                if (data == false) {
                                                    throw new Error('Failed Email');
                                                }
                                                res.send(200, { meta: { status: 200, message: "success" } });
                                            });


                                    }).then(function (result) {
                                        // Transaction has been committed
                                        // result is whatever the result of the promise chain returned to the transaction callback
                                    })

                                }).catch(function (err) {
                                    res.send({ message: err.message })
                                })
                            }
                            else {
                                res.send(401, { meta: { status: 401 }, data: data });
                            }
                        })

                } else {
                    res.send(401, { meta: { status: 401 }, message: 'user is not logged in or invalid token' });
                }
            })
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


function validateUser(username, email, password, uid) {

    var errors = [];
    var final = {};

    var newPassword = helpers.hashPassword(password);

    var constraints = {
        "username": {
            format: /^(?=.{3,20}$)[A-Za-z][A-Za-z0-9]+(?:[.|_][A-Za-z0-9]+)*$/
        },
        "email": {
            email: true
        }
    };


    return validate.async({ username: username, email: email }, constraints).then(success, error);

    function success() {

        if (username != null || email != null) {
            var query = "select * from\
                (SELECT count(*) as userName_validate from users where username = '{0}') as username,\
                (SELECT count(*) as userEmail_validate from users where user_email = '{1}') as email,\
                (SELECT count(*) as userPassword_validate from users where `password`='{2}' AND uid = '{3}')as password".format(username, email, newPassword, uid)

            return sequelize.query(query, { type: sequelize.QueryTypes.SELECT })
                .then(function (data) {


                    if (data[0].userName_validate == 1) {
                        errors.push({ code: 1001, message: 'Username is already Exist' });
                    }
                    if (data[0].userEmail_validate == 1) {
                        errors.push({ code: 1002, message: 'Email is already Exist' });
                    }
                    if (data[0].userPassword_validate == 0) {
                        errors.push({ code: 1002, message: 'Incorrect Password' });
                    }

                    if (data[0].userName_validate == 0 && data[0].userPassword_validate == 1) {
                        final.result = true;
                    }
                    if (data[0].userEmail_validate == 0 && data[0].userPassword_validate == 1) {
                        final.result = true;
                    }
                    if (errors.length > 0) {
                        final.result = false;
                        final.errors = errors;

                    } else if (data[0].userName_validate == 0 && data[0].userEmail_validate == 0 && data[0].userPassword_validate == 1) {
                        final.result = true;
                    }

                    return final;
                });
        } else {
            return null;
        }

    }

    function error(errors) {
        if (errors instanceof Error) {
            // This means an exception was thrown from a validator
            console.err("An error ocurred", errors);
        }
        else {
            var errorCodes = [];
            if (typeof errors['username'] != 'undefined')
                errorCodes.push({ code: 1001, message: 'Username is invalid' });
            if (typeof errors['email'] != 'undefined')
                errorCodes.push({ code: 1002, message: 'Email is invalid' });

        }
        return errorCodes;

    }
}


//Get Validation Of Username And Email Private Method
var getValidationReport = function (email, username) {
    var query = "select  \
                    case when (SELECT count(user_email) > 0 from users where user_email = \'{0}\') \
                    then 1 else 0\
                    end as 'email' ,\
                    case when (SELECT count(username) > 0 from users where username= \'{1}\')\
                    then 1 end as 'username'".format(email, username);
    return sequelize.query(query).then(function (result) {
        var isEmailExist = result[0][0].email == 1 ? 1 : 0;
        var isUsernameExist = result[0][0].username == 1 ? 1 : 0;
        return {
            username: isUsernameExist, email: isEmailExist
        };
    });
}

//#############################################################
//############### Reusables ###############
//#############################################################

/*
 @param: uid int[]
 @param: session_uid int
 */
function user_unfollow_multiple(session_uid, uid) {
    var success = [];
    var failed = [];
    return Promise.map(uid, function (uidResult) {
        return sequelize.query('call sp_UserUnfollow({0}, {1});'.format(session_uid, uidResult), { type: sequelize.QueryTypes.SELECT }).then(function (result) {

            //extract code from result
            var responseCode = -1;

            if (result.length == 3) {
                responseCode = result[0][0].result;
            }
            else {
                responseCode = result[2][0].result;
            }

            //generate response
            if (responseCode == 200) {
                success.push({ code: responseCode, message: 'success', uid: uidResult });
            }
            else if (responseCode == 401) {
                failed.push({ code: responseCode, message: 'already unfollowed', uid: uidResult });
            }
            else if (responseCode == 404) {
                failed.push({ code: responseCode, message: 'not found', uid: uidResult });
            }
            else if (responseCode == 500) {
                failed.push({ code: responseCode, message: 'unexpected error', uid: uidResult });
            }
            else {
                failed.push({ code: responseCode, message: 'unexpected error', uid: uidResult });
            }
        })
            .error(function (err) {
                return { failed: failed, success: success };
            });
    }).then(function () {
        return { failed: failed, success: success };
    })
        .
        catch(function (err) {
            return { failed: failed, success: success };
        });
}

/*
 @param: uid int[]
 @param: session_uid int
 */
function user_unfollow_multiple_bidirectional(session_uid, uid) {
    var success = [];
    var failed = [];
    return Promise.map(uid, function (uidResult) {
        return sequelize.query('call sp_UserUnfollow({0}, {1});'.format(uidResult, session_uid), { type: sequelize.QueryTypes.SELECT }).then(function (result) {

            //extract code from result
            var responseCode = -1;

            if (result.length == 3) {
                responseCode = result[0][0].result;
            }
            else {
                responseCode = result[2][0].result;
            }

            //generate response
            if (responseCode == 200) {
                success.push({ code: responseCode, message: 'success', uid: uidResult });
            }
            else if (responseCode == 401) {
                failed.push({ code: responseCode, message: 'already unfollowed', uid: uidResult });
            }
            else if (responseCode == 404) {
                failed.push({ code: responseCode, message: 'not found', uid: uidResult });
            }
            else if (responseCode == 500) {
                failed.push({ code: responseCode, message: 'unexpected error', uid: uidResult });
            }
            else {
                failed.push({ code: responseCode, message: 'unexpected error', uid: uidResult });
            }
        }).error(function (err) {
            return { failed: failed, success: success };
        });
    }).then(function () {
        return { failed: failed, success: success };
    }).catch(function (err) {
        console.error(failed, success);
        return { failed: failed, success: success };
    });
}

/*
 @param: uid int[]
 @param: session_uid int
 */
function user_follow_multiple(session_uid, uid, req, feedLimit, forceFollow) {
    var success = [];
    var failed = [];


    //instances
    var notification = require('../controllers/Notifications');
    var posts = require('../controllers/posts');
    var feedController = require('../controllers/feed');

    //initiate follow process
    return Promise.map(uid, function (uidResult) {
        return sequelize.query('call sp_UserFollow({0},{1},{2},{3})'.format(session_uid, uidResult, feedLimit, forceFollow)).then(function (result) {
            if (result[0].result == 200) {

                //######################### Create Post (start) #########################
                //uid, text, media_id, fetched_url_id, scope_id, post_type, parent_id, req
                return posts.createPost(session_uid, '', null, null, 1, 'USER_FOLLOWED', uidResult, req)
                    .then(function (postObj) {
                        var data = {};
                        data.post = postObj.post;
                        return data;
                    })
                    //######################### Create Post (end) #########################

                    //######################### Record Activity (start) #########################
                    .then(function (data) {

                        //uid, activity_type, source_id, parent_id, parent_type, post_id)
                        feedController.createActivity(session_uid, 'USER_FOLLOWED', uidResult, null, null, data.post.id, true, true);

                        //Returning to call function
                        return data;

                        //######################### Record Activity (end) #########################
                    }).then(function (data) {
                        success.push({ httpCode: 200, code: 200, message: 'success', uid: uidResult, data: data });
                    });

            }
            else if (result[0].result == 201) {
                var notificationObject = {
                    actor_uid: session_uid,
                    to_uid: uidResult,
                    activity_type: 'USER_FOLLOW_REQUEST_CREATED'
                };
                notification.createNotifications(notificationObject);
                success.push({ httpCode: 200, code: 201, message: 'request created', uid: uidResult });
            }
            else if (result[0].result == 209) {
                failed.push({ httpCode: 401, code: 209, message: 'request already created', uid: uidResult });
            }
            else if (result[0].result == 401) {
                failed.push({ httpCode: 401, code: 401, message: 'block', uid: uidResult });
            }
            else if (result[0].result == 404) {
                failed.push({ httpCode: 404, code: 404, message: 'user not found', uid: uidResult });
            }
            else if (result[0].result == 409) {
                failed.push({ httpCode: 401, code: 409, message: 'already followed', uid: uidResult });
            }
            else if (result[0].result == 500) {
                failed.push({ httpCode: 500, code: 500, message: 'unexpected error in sp', uid: uidResult });
            }
            else {
                failed.push({ httpCode: 500, code: 500, message: 'unhandled response', uid: uidResult });
            }
        });
    }).then(function () {
        return { failed: failed, success: success };
    }).catch(function (err) {
        console.error(failed, success);
        return { failed: failed, success: success };
    });
}

/* session_uid = int
 uid_requestser = int Array
 req = req object
 feedLimit = int*/

function user_follow_multiple_accept(session_uid, uid_requester, req, feedLimit) {

    var failed = [];
    var success = [];

    //Instances
    var userFollowRequest = objAllTables.user_follow_request.user_follow_request();
    var user_notification = objAllTables.notifications.notifications();
    var notification = require('../controllers/Notifications');

    return Promise.map(uid_requester, function (uidResult) {

        //Accept request
        return userFollowRequest.update({ status: 'ACCEPTED' }, {
            where: { uid: session_uid, uid_requester: uidResult, status: 'ACTIVE' }
        })
            .then(function (rowsUpdated) {
                if (rowsUpdated != 1) {
                    failed.push({ httpCode: 404, code: 404, message: 'Request Not Found' });
                    throw new Error('break promise chain');
                }
                return;
            })
            .then(function () {

                return user_follow_multiple(uidResult, [session_uid], req, feedLimit, true)
                    .then(function (data) {
                        if (data.failed.length != 0) {
                            failed.push(data.failed[0]);
                            throw new Error("break promise chain");

                        }
                        success.push({ httpCode: 200, code: 200, message: 'success' });
                        return;
                    })
            })
            //Delete notification of Create request
            .then(function () {
                return user_notification.update({ status: 'DELETED' }, {
                    where: {
                        uid: session_uid,
                        type: 'USER_FOLLOW_REQUEST_CREATED',
                        details: uidResult,
                        status: 'ACTIVE'
                    }
                });
            })
            //Create Notification of Accept request
            .then(function () {
                var notificationObject = {
                    actor_uid: session_uid,
                    to_uid: uidResult, //requester ID
                    activity_type: 'USER_FOLLOW_REQUEST_ACCEPTED'
                };
                return notification.createNotifications(notificationObject);
            })
            .catch(function (err) {
                if (err.message == "break promise chain") {
                    //already added to failed array
                } else {
                    throw err;
                }
            });


    }).then(function () {
        return { failed: failed, success: success };
    });


}

function user_follow_multiple_reject(session_uid, requesters_uid) {
    var UserFollowerRequest = objAllTables.user_follow_request.user_follow_request();
    var Notifications = objAllTables.notifications.notifications();

    var success = [];
    var failed = [];

    return Promise.map(requesters_uid, function (reqUid) {
        return UserFollowerRequest.findAll({
            attributes: ['uid_requester'],
            where: { status: 'ACTIVE', uid: session_uid, uid_requester: reqUid }
        }).then(function (result) {
            if (result == null || result.length == 0) {
                failed.push({
                    httpCode: 401,
                    code: 401,
                    message: 'user request cannot rejected',
                    uid: session_uid,
                    uid_requester: reqUid
                });
            }
            else {
                return UserFollowerRequest.update({ status: 'REJECTED' }, {
                    where: { uid: session_uid, uid_requester: reqUid }
                }).then(function (result) {
                    if (result.length != 1) {
                        failed.push({
                            httpCode: 401,
                            code: 401,
                            message: 'update failed',
                            uid: session_uid,
                            uid_requester: reqUid
                        });
                    }
                    else {
                        success.push({
                            httpCode: 200,
                            code: 200,
                            message: 'success',
                            uid: session_uid,
                            uid_requester: reqUid
                        });
                        Notifications.update({ status: 'DELETED' }, {
                            where: {
                                type: 'USER_FOLLOW_REQUEST_CREATED',
                                uid: session_uid,
                                details: reqUid
                            }
                        });
                    }
                });
            }
        });
    }).then(function () {
        var response = { success: success, failed: failed };
        return response;
    });
}

function user_follow_multiple_cancelled(session_uid, requestee_uid) {
    var UserFollowerRequest = objAllTables.user_follow_request.user_follow_request();
    var Notifications = objAllTables.notifications.notifications();

    var success = [];
    var failed = [];

    return Promise.map(requestee_uid, function (reqUid) {
        return UserFollowerRequest.findAll({
            attributes: ['uid'],
            where: { status: 'ACTIVE', uid: reqUid, uid_requester: session_uid }
        }).then(function (result) {
            if (result == null || result.length == 0) {
                failed.push({
                    httpCode: 401,
                    code: 401,
                    message: 'user request cannot cancel',
                    requestee: reqUid,
                    uid: session_uid
                });
            }
            else {
                return UserFollowerRequest.update({ status: 'CANCELLED' }, {
                    where: { uid: reqUid, uid_requester: session_uid }
                }).then(function (result) {
                    if (result.length != 1) {
                        failed.push({
                            httpCode: 401,
                            code: 401,
                            message: 'update failed',
                            uid: session_uid,
                            requestee: reqUid
                        });
                    }
                    else {
                        success.push({
                            httpCode: 200,
                            code: 200,
                            message: 'success',
                            uid: session_uid,
                            requestee: reqUid
                        });
                        Notifications.update({ status: 'DELETED' }, {
                            where: {
                                type: 'USER_FOLLOW_REQUEST_CREATED',
                                uid: reqUid,
                                details: session_uid
                            }
                        });
                    }
                });
            }
        });
    }).then(function () {
        var response = { success: success, failed: failed };
        return response;
    });
}


//user delete
exports.delete = function (req, res) {
    var userId = parseInt(req.params.id) || null;
    var typeToDelete = req.params.type || 'user_and_session';
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
        id: userId
    };

    validate.async(attributes, constraints).then(success, error);

    function success() {
        helpers.getActiveSession(req)
            .then(function (sessionUser) {
                if (sessionUser.type == 'Recognized') {

                    //######################### start user delete #########################

                    return new Promise(function (firstPromiseResolve) {

                        if (typeToDelete == 'user_and_session') {
                            //update user status to 'Deleting' in user table
                            return deleteUser_AndSession(userId)
                                .then(function (responseCode) {
                                    if (responseCode == 200) {
                                        firstPromiseResolve('TRUE');
                                    }
                                    else {
                                        firstPromiseResolve('FALSE');
                                    }
                                });
                        }
                        else if (typeToDelete == 'goal_un_follow') {
                            //update user status to 'Deleting' in user table
                            return deleteUser_GoalUnFollow(userId)
                                .then(function (responseCode) {
                                    if (responseCode == 200) {
                                        firstPromiseResolve('TRUE');
                                    }
                                    else {
                                        firstPromiseResolve('FALSE');
                                    }
                                });
                        }

                        else if (typeToDelete == 'goal_un_link') {
                            //update user status to 'Deleting' in user table
                            return deleteUser_GoalUnLink(userId)
                                .then(function (responseCode) {
                                    if (responseCode == 200) {
                                        firstPromiseResolve('TRUE');
                                    }
                                    else {
                                        firstPromiseResolve('FALSE');
                                    }
                                });
                        }

                        else if (typeToDelete == 'user_un_follow') {
                            //update user status to 'Deleting' in user table
                            return deleteUser_UserUnFollow(userId)
                                .then(function (responseCode) {
                                    if (responseCode == 200) {
                                        firstPromiseResolve('TRUE');
                                    }
                                    else {
                                        firstPromiseResolve('FALSE');
                                    }
                                });
                        }

                        else if (typeToDelete == 'goal_and_child') {
                            //update user status to 'Deleting' in user table
                            return deleteUser_GoalAndChild(userId)
                                .then(function (responseCode) {
                                    if (responseCode == 200) {
                                        firstPromiseResolve('TRUE');
                                    }
                                    else {
                                        firstPromiseResolve('FALSE');
                                    }
                                });
                        }

                        else if (typeToDelete == 'post_and_child') {
                            //update user status to 'Deleting' in user table
                            return deleteUser_PostAndChild(userId)
                                .then(function (responseCode) {
                                    if (responseCode == 200) {
                                        firstPromiseResolve('TRUE');
                                    }
                                    else {
                                        firstPromiseResolve('FALSE');
                                    }
                                });
                        }

                        else if (typeToDelete == 'comment_and_child') {
                            //update user status to 'Deleting' in user table
                            return deleteUser_CommentAndChild(userId)
                                .then(function (responseCode) {
                                    if (responseCode == 200) {
                                        firstPromiseResolve('TRUE');
                                    }
                                    else {
                                        firstPromiseResolve('FALSE');
                                    }
                                });
                        }

                        else if (typeToDelete == 'user_and_child') {
                            //update user status to 'Deleting' in user table
                            return deleteUser_AndChild(userId)
                                .then(function (responseCode) {
                                    if (responseCode == 200) {
                                        firstPromiseResolve('TRUE');
                                    }
                                    else {
                                        firstPromiseResolve('FALSE');
                                    }
                                });
                        }

                        else {

                        }
                    })
                        .then(function (firstPromiseReult) {
                            if (firstPromiseReult == 'TRUE') {
                                res.send(200, { meta: { status: 200, message: 'user account deleted successfully' } });
                            }
                            else {
                                res.send(401, {
                                    meta: {
                                        status: 401,
                                        message: 'an error occurred while deleting user account'
                                    }
                                });
                            }
                        })
                }
                else {
                    res.send(401, { meta: { status: 401, message: 'invalid token' } });
                }
            }
            )
            .error(function (err) {
                res.send(500, { meta: { status: 500, message: 'unexpected error' }, details: err });
            });
    }

    function error(errors) {
        if (errors instanceof Error) {
            // This means an exception was thrown from a validator
            res.send({ meta: { status: 401, message: 'An error occurred in validator' }, errors: errors });
        } else {
            res.send({ meta: { status: 401, message: 'validation errors' }, errors: errors });
        }
    }
};


//revert user delete
exports.revertDelete = function (req, res) {
    var userId = parseInt(req.params.id) || null;
    var typeToDelete = req.params.type || 'user_and_session';
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
        id: userId
    };

    validate.async(attributes, constraints).then(success, error);

    function success() {

        //######################### start user delete #########################

        return new Promise(function (firstPromiseResolve) {

            if (typeToDelete == 'user_and_session') {
                //update user status to 'Deleting' in user table
                return revert_deleteUser_AndSession(userId)
                    .then(function (responseCode) {
                        if (responseCode == 200) {
                            firstPromiseResolve('TRUE');
                        }
                        else {
                            firstPromiseResolve('FALSE');
                        }
                    });
            }
            else if (typeToDelete == 'goal_un_follow') {
                //update user status to 'Deleting' in user table
                return deleteUser_GoalUnFollow(userId)
                    .then(function (responseCode) {
                        if (responseCode == 200) {
                            firstPromiseResolve('TRUE');
                        }
                        else {
                            firstPromiseResolve('FALSE');
                        }
                    });
            }

            else if (typeToDelete == 'goal_un_link') {
                //update user status to 'Deleting' in user table
                return deleteUser_GoalUnLink(userId)
                    .then(function (responseCode) {
                        if (responseCode == 200) {
                            firstPromiseResolve('TRUE');
                        }
                        else {
                            firstPromiseResolve('FALSE');
                        }
                    });
            }

            else if (typeToDelete == 'user_un_follow') {
                //update user status to 'Deleting' in user table
                return deleteUser_UserUnFollow(userId)
                    .then(function (responseCode) {
                        if (responseCode == 200) {
                            firstPromiseResolve('TRUE');
                        }
                        else {
                            firstPromiseResolve('FALSE');
                        }
                    });
            }

            else if (typeToDelete == 'goal_and_child') {
                //update user status to 'Deleting' in user table
                return deleteUser_GoalAndChild(userId)
                    .then(function (responseCode) {
                        if (responseCode == 200) {
                            firstPromiseResolve('TRUE');
                        }
                        else {
                            firstPromiseResolve('FALSE');
                        }
                    });
            }

            else if (typeToDelete == 'post_and_child') {
                //update user status to 'Deleting' in user table
                return deleteUser_PostAndChild(userId)
                    .then(function (responseCode) {
                        if (responseCode == 200) {
                            firstPromiseResolve('TRUE');
                        }
                        else {
                            firstPromiseResolve('FALSE');
                        }
                    });
            }

            else if (typeToDelete == 'comment_and_child') {
                //update user status to 'Deleting' in user table
                return deleteUser_CommentAndChild(userId)
                    .then(function (responseCode) {
                        if (responseCode == 200) {
                            firstPromiseResolve('TRUE');
                        }
                        else {
                            firstPromiseResolve('FALSE');
                        }
                    });
            }

            else if (typeToDelete == 'user_and_child') {
                //update user status to 'Deleting' in user table
                return deleteUser_AndChild(userId)
                    .then(function (responseCode) {
                        if (responseCode == 200) {
                            firstPromiseResolve('TRUE');
                        }
                        else {
                            firstPromiseResolve('FALSE');
                        }
                    });
            }
        })
            .then(function (firstPromiseReult) {
                if (firstPromiseReult == 'TRUE') {
                    res.send(200, { meta: { status: 200, message: 'user account reverted successfully' } });
                }
                else {
                    res.send(401, {
                        meta: {
                            status: 401,
                            message: 'an error occurred while reverting user account'
                        }
                    });
                }
            })
    }


    function error(errors) {
        if (errors instanceof Error) {
            // This means an exception was thrown from a validator
            res.send({ meta: { status: 401, message: 'An error occurred in validator' }, errors: errors });
        } else {
            res.send({ meta: { status: 401, message: 'validation errors' }, errors: errors });
        }
    }
};

////#############################################################
////############### User Delete Local Functions #################
////#############################################################


function deleteUser_AndSession(userId) {
    return new Promise(function (resolve) {
        var sequelize = db.sequelizeConn();
        var responseCode = -1;
        sequelize.query('CALL sp_DeleteUserAndSession({0});'.format(userId))
            .then(function (result) {
                responseCode = result[0].result;
                resolve(responseCode);
            })
            .error(function (err) {
                responseCode = 500;
                resolve(responseCode);
            });
    })
        .then(function (result) {
            return result;
        });
};

function revert_deleteUser_AndSession(userId) {
    return new Promise(function (resolve) {
        var sequelize = db.sequelizeConn();
        var responseCode = -1;
        sequelize.query('CALL sp_Revert_DeleteUserAndSession({0});'.format(userId))
            .then(function (result) {
                responseCode = result[0].result;
                resolve(responseCode);
            })
            .error(function (err) {
                responseCode = 500;
                resolve(responseCode);
            });
    })
        .then(function (result) {
            return result;
        });
};

exports.onBoarding = function (req, res) {
    helpers.getActiveSession(req).then(function (SessionUser) {
        if (SessionUser.type == "Recognized") {
            var Users = objAllTables.users.users();
            Users.update({ onboarding_web: 1 }, { where: { uid: SessionUser.uid } }).then(function (updateResult) {
                if (updateResult == 1) {
                    res.send(200, { meta: { status: 200, message: 'Success' } });
                } else {
                    res.send(401, { meta: { status: 401, message: 'Failed' } });
                }
            })
        } else {
            res.send(401, { meta: { status: 401, message: 'user is not logged in or invalid token' } });
        }
    }).catch(function (err) {
        res.send(500, { meta: { status: 500, message: 'internal server error' }, details: err });
    });
};
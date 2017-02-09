//###############################################################
//######################### Require #############################
//###############################################################

var Promise = require("bluebird");
var http = require('http');
var Hashids = require("hashids");
var crypto = require('crypto');
var config = require('../config');
var clasAllTables = require('../models/alltables');
var validator = require('validator');
var objAllTables = clasAllTables.allTables;
var db = require('../helpers/db');
var helpers = require('../helpers/helpers');
var sequelize = db.sequelizeConn();
var chalk = require('chalk');
var requestModule = require('request');
var _ = require('lodash');

//###############################################################
//######################### Utility #############################
//###############################################################

//requesting network server
exports.requestServerViaPost = function (url, requestMethod, contentType, dataObj, apiVersion) {
    return new Promise(function (resolve) {
        requestModule({
            method: requestMethod,
            uri: url,
            headers: {
                'x-api-version': apiVersion,
                'content-type': contentType
            },
            json: dataObj
        }, function (error, response, body) {
            if (error) {
                resolve('FALSE');
            } else {
                resolve('TRUE');
            }
        })

    })
        .then(function (result) {
            return result;
        });
};

exports.requestServer = function (host, port, path, requestMethod, dataArray, version) {
    return new Promise(function (resolve) {
        var options = {
            host: host,
            port: port,
            path: path,
            method: requestMethod,
            headers: {
                'x-api-version': version,
                'file-id': dataArray.fileId,
                'user-id': dataArray.uId,
                'goal-id': dataArray.goalId,
                'req-from': dataArray.reqFrom,
                'Content-Type': "application/json"
            }
        };
        var req = http.request(options, function (resp) {
            resp.setEncoding('utf8');
            resp.on('data', function (result, res) {
                if (result) {
                    resolve(true);
                } else {
                    resolve(false);
                }
            });
        }).on("error", function (e) {
            resolve(false);
        });
        req.end();
    })
        .then(function (result) {
            return result;
        });
};

exports.pagination = function (req) {
    var errors = [];

    var limit;
    var offset;
    //offset
    if (req.query.offset == null || typeof req.query.offset == 'undefined' || req.query.offset == '')
        offset = config.pagination.offset;
    else if (!isNaN(req.query.offset)) //if its a number
        offset = req.query.offset;
    else
        errors.push(helpers.generateErrorObject(1001, 'offset', 'offset is not a valid integer'));

    //limit
    if (req.query.limit == null || typeof req.query.limit == 'undefined' || req.query.limit == '')
        limit = config.pagination.limit;
    else if (!isNaN(req.query.limit)) //if its a number
        limit = req.query.limit;
    else
        errors.push(helpers.generateErrorObject(1001, 'limit', 'limit is not a valid integer'));

    if (errors.length != 0) {
        throw new Error({ message: 'in pagination', details: errors });
    } else {
        var obj = {
            limit: parseInt(limit),
            offset: parseInt(offset)
        };
        return obj;
    }
};

var isNumber = exports.isNumber = function (o) {
    return !isNaN(o - 0) && o !== null && o !== "" && o !== false;
}

//###############################################################
//###################### User Mention ###########################
//###############################################################

exports.getMentionedUserId = function (text, sessionUid) {

    var regex = /[@[0-9]+[:]([a-z|A-Z ]+)]/g;
    //var text = "@[12332:wasiq] hello Pakistan! @[12222:hamza khan] hello @[1556:junaid]";
    var idSeprator = /[0-9]+/g;
    var displaySeprator = /([a-z|A-Z ]+)/g;
    var pattern = text.match(regex) || [];
    var uidList = [];
    var textCopy = text;

    //return if empty
    if (pattern.length == 0) {
        return new Promise(function (resolve) {
            resolve({ oldtext: text, updatedtext: text, simple: text, mentionUser: uidList });
        });
    }


    for (var i = 0; i < pattern.length; i++) {
        if (pattern[i].match(idSeprator) && pattern[i].match(displaySeprator)) {

            uidList.push({
                uid: pattern[i].match(idSeprator)[0],
                displayName: pattern[i].match(displaySeprator)[0],
                pattern: pattern[i],
                validated: false
            });
        }
    }

    //creating array to validate from database
    var uidArrayForDb = [];
    for (var j = 0; j < uidList.length; j++)
        uidArrayForDb.push(uidList[j].uid);

    var query = " SELECT u.uid,u.first_name,u.middle_name,u.last_name FROM  users u WHERE u.uid NOT IN(SELECT DISTINCT\
                    CASE WHEN uid = {0} THEN\
                    blocked_uid\
                    WHEN uid <> {0} THEN\
                    uid\
                    END AS 'uid' FROM   user_block WHERE`status` = 'ACTIVE'\
                    AND((uid IN ({1}) AND blocked_uid = {0})\
                    OR(uid = {0} AND blocked_uid IN ({1}) ))\
                    )AND u.uid IN ({1})".format(sessionUid, uidArrayForDb.toString());

    return sequelize.query(query, { type: sequelize.QueryTypes.SELECT })
        .then(function (uidListDB) {
            //fixing name from database
            for (var i = 0; i < uidListDB.length; i++) {
                for (j = 0; j < uidList.length; j++) {

                    if (uidListDB[i].uid == uidList[j].uid) {

                        //user exists in database
                        uidList[j].validated = true;

                        //getting DB name
                        var fullName;
                        var firstname = uidListDB[i].first_name;
                        var middlename = uidListDB[i].middle_name;
                        var last_name = uidListDB[i].last_name;

                        if (!validator.isNull(uidListDB[i].first_name)) {
                            fullName = uidListDB[i].first_name;
                        }
                        if (!validator.isNull(uidListDB[i].middle_name)) {
                            fullName += ' ' + uidListDB[i].middle_name;
                        }
                        if (!validator.isNull(uidListDB[i].last_name)) {
                            fullName += ' ' + uidListDB[i].last_name;
                        }

                        //validating name
                        if (fullName == uidList[j].displayName ||
                            firstname == uidList[j].displayName ||
                            middlename == uidList[j].displayName ||
                            last_name == uidList[j].displayName) {

                            uidList[j].finalName = uidList[j].displayName;
                            uidList[j].new_pattern = "@[" + uidList[j].uid + ":" + uidList[j].finalName + "]";
                        } else {
                            uidList[j].finalName = fullName;
                            uidList[j].new_pattern = "@[" + uidList[j].uid + ":" + uidList[j].finalName + "]";

                        }

                    }

                }
            }
            // Replacing pattern with text
            for (var i = 0; i < uidList.length; i++) {
                if (uidList[i].validated) {
                    textCopy = textCopy.replace(pattern[i], uidList[i].new_pattern);
                } else {
                    textCopy = textCopy.replace(pattern[i], uidList[i].displayName);
                }
            }

            // Copy of simple text
            var simpleText = textCopy;
            for (var j = 0; j < uidList.length; j++) {
                simpleText = simpleText.replace(uidList[j].new_pattern, uidList[j].finalName);
            }
            return { oldtext: text, updatedtext: textCopy, simple: simpleText, mentionUser: uidList };

        });

};

//###############################################################
//######################## Privacy ##############################
//###############################################################

exports.insertSpecificUserPrivacy = function (id, uid_array, sessionId, type) {
    var tableUserBlock = objAllTables.user_block.user_block();
    var tablePrivacySpecificPost = objAllTables.privacy_specific_post.privacy_specific_post();
    var tablePrivacySpecificGoal = objAllTables.privacy_specific_goal.privacy_specific_goal();

    return tableUserBlock.findAll({
        attributes: ['blocked_uid'],
        where: { $or: [{ uid: sessionId, blocked_uid: { $in: uid_array } }, { blocked_uid: sessionId, uid: { $in: uid_array } }] }
    })
        .then(function (result) {
            if (result.length > 0) {
                for (var i = 0; i < result.length; i++) {
                    for (var j = 0; j < uid_array.length; j++) {
                        if (result[i].dataValues.blocked_uid == uid_array[j]) {
                            uid_array.splice(j, 1);
                        }
                    }
                }
                return uid_array;
            } else {
                return uid_array;
            }
        })
        .then(function (uidArray) {
            var thumbArray = [];
            if (uidArray.length == 0) {
                throw new Error('Empty Array');
            } else {
                if (type == 'POST') {

                    for (var i = 0; i < uidArray.length; i++) {
                        thumbArray.push({
                            post_id: id,
                            allowed_uid: uidArray[i],
                            created: helpers.getUnixTimeStamp()
                        })
                    }
                    return tablePrivacySpecificPost.bulkCreate(thumbArray)
                        .then(function () {
                            return true;
                        });
                } else if (type == 'GOAL') {
                    for (var i = 0; i < uidArray.length; i++) {
                        thumbArray.push({
                            goal_id: id,
                            allowed_uid: uidArray[i],
                            created: helpers.getUnixTimeStamp()
                        })
                    }
                    return tablePrivacySpecificGoal.bulkCreate(thumbArray)
                        .then(function () {
                            return true;
                        });
                }

            }


        })
        .then(function (result) {
            return result;
        })
        .catch(function (err) {
            if (err.message == "Empty Array") {
                return true;
            } else {
                throw err;
            }
        });
};

exports.updateSpecificUserPrivacy = function (id, uidArray, sessionId, type) {
    var tableUserBlock = objAllTables.user_block.user_block();
    var tablePrivacySpecificPost = objAllTables.privacy_specific_post.privacy_specific_post();
    var tablePrivacySpecificGoal = objAllTables.privacy_specific_goal.privacy_specific_goal();
    return tableUserBlock.findAll({
        attributes: ['blocked_uid'],
        where: { $or: [{ uid: sessionId, blocked_uid: { $in: uidArray } }, { blocked_uid: sessionId, uid: { $in: uidArray } }] }
    })
        .then(function (result) {
            if (result.length > 0) {
                for (var i = 0; i < result.length; i++) {
                    for (var j = 0; j < uidArray.length; j++) {
                        if (result[i].dataValues.blocked_uid == uidArray[j]) {
                            uidArray.splice(j, 1);
                        }
                    }
                }
                return uidArray;
            } else {
                return uidArray;
            }
        })
        .then(function (uidArray) {

            var allowedUidarray = []; //array for the sending the status to be Inactive
            var insertThumbArray = []; // array for the new record to be inserted
            var activeUpdateArray = []; //rray for the sending the status to be Active
            if (uidArray.length == 0) {
                throw new Error('Empty Array');
            } else {
                if (type == 'POST') {
                    return tablePrivacySpecificPost.findAll({
                        attributes: ['allowed_uid', 'status'],
                        where: { post_id: id }
                    }).then(function (result) {
                        var arr = [];
                        for (var i = 0; i < uidArray.length; i++) {
                            arr[i] = uidArray[i];
                        }
                        if (result.length > 0) {

                            for (var i = 0; i < result.length; i++) {
                                allowedUidarray.push(result[i].dataValues.allowed_uid);
                                for (var j = 0; j < uidArray.length; j++) {
                                    if (result[i].dataValues.allowed_uid == uidArray[j]) {

                                        uidArray.splice(j, 1);

                                    }
                                }
                            }

                            for (var i = 0; i < arr.length; i++) {

                                for (var j = 0; j < allowedUidarray.length; j++) {
                                    if (arr[i] == allowedUidarray[j]) {

                                        allowedUidarray.splice(j, 1);

                                    }
                                }
                            }

                            for (var i = 0; i < result.length; i++) {

                                for (var j = 0; j < arr.length; j++) {
                                    if ((result[i].dataValues.allowed_uid == arr[j]) && (result[i].dataValues.status == 'INACTIVE')) {

                                        activeUpdateArray.push(arr[j]);

                                    }
                                }
                            }

                            for (var i = 0; i < uidArray.length; i++) {
                                insertThumbArray.push({
                                    post_id: id,
                                    allowed_uid: uidArray[i],
                                    created: helpers.getUnixTimeStamp()
                                })
                            }

                            //update status to Inactive
                            return tablePrivacySpecificPost.update({
                                status: 'INACTIVE'
                            }, {
                                    where: {
                                        allowed_uid: { $in: allowedUidarray }
                                    }
                                })
                                //insert new rows
                                .then(function () {
                                    return tablePrivacySpecificPost.bulkCreate(insertThumbArray)
                                        //update status to Active
                                        .then(function () {
                                            return tablePrivacySpecificPost.update({
                                                status: 'ACTIVE'
                                            }, {
                                                    where: {
                                                        allowed_uid: { $in: activeUpdateArray }
                                                    }
                                                })
                                                .then(function () {
                                                    return true;
                                                });

                                        });
                                })
                                .then(function (result) {
                                    return result;
                                });
                        }
                    });

                } else if (type == 'GOAL') {
                    return tablePrivacySpecificGoal.findAll({
                        attributes: ['allowed_uid', 'status'],
                        where: { goal_id: id }
                    }).then(function (result) {
                        var arr = [];
                        for (var i = 0; i < uidArray.length; i++) {
                            arr[i] = uidArray[i];
                        }
                        if (result.length > 0) {

                            for (var i = 0; i < result.length; i++) {
                                allowedUidarray.push(result[i].dataValues.allowed_uid);
                                for (var j = 0; j < uidArray.length; j++) {
                                    if (result[i].dataValues.allowed_uid == uidArray[j]) {
                                        uidArray.splice(j, 1);
                                    }
                                }
                            }

                            for (var i = 0; i < arr.length; i++) {

                                for (var j = 0; j < allowedUidarray.length; j++) {
                                    if (arr[i] == allowedUidarray[j]) {
                                        allowedUidarray.splice(j, 1);
                                    }
                                }
                            }

                            for (var i = 0; i < result.length; i++) {

                                for (var j = 0; j < arr.length; j++) {
                                    if ((result[i].dataValues.allowed_uid == arr[j]) && (result[i].dataValues.status == 'INACTIVE')) {
                                        activeUpdateArray.push(arr[j]);
                                    }
                                }
                            }

                            for (var i = 0; i < uidArray.length; i++) {
                                insertThumbArray.push({
                                    goal_id: id,
                                    allowed_uid: uidArray[i],
                                    created: helpers.getUnixTimeStamp()
                                });
                            }

                            //update status to Inactive
                            return tablePrivacySpecificGoal.update({
                                status: 'INACTIVE'
                            }, {
                                    where: {
                                        allowed_uid: { $in: allowedUidarray }
                                    }
                                })
                                //insert new rows
                                .then(function () {
                                    return tablePrivacySpecificGoal.bulkCreate(insertThumbArray)
                                        //update status to Active
                                        .then(function () {
                                            return tablePrivacySpecificGoal.update({
                                                status: 'ACTIVE'
                                            }, {
                                                    where: {
                                                        allowed_uid: { $in: activeUpdateArray }
                                                    }
                                                })
                                                .then(function () {
                                                    return true;
                                                });

                                        });
                                })
                                .then(function (result) {
                                    return result;
                                });
                        }
                    });
                }
            }
        })
        .then(function (result) {
            return result;
        })
        .catch(function (err) {
            if (err.message == "Empty Array") {
                return true;
            } else {
                throw err;
            }
        });;
};

exports.checkGoalPrivacy = function (session_uid, goal_id) {

    return sequelize.query("Select CheckPrivacy_Goal({0},{1}) as isAllowed".format(session_uid, goal_id), { type: sequelize.QueryTypes.SELECT })
        .then(function (result) {
            if (result.length > 0 && result[0].isAllowed == 1) {
                return 1;
            } else if (result.length > 0 && result[0].isAllowed == 404) {
                return 404;
            } else {
                return 0;
            }
        });
};

exports.checkPostPrivacy = function (session_uid, post_id) {

    return sequelize.query("Select case when CheckPrivacy_POST({0},{1}) = true then 1 else 0 end as isAllowed".format(session_uid, post_id), { type: sequelize.QueryTypes.SELECT })
        .then(function (result) {
            console.log(result);
            if (result.length > 0 && result[0].isAllowed == 1) {
                return true;
            } else {
                return false;
            }
        });
};

//###############################################################
//###################### Email Related ##########################
//###############################################################

exports.changePasswordEmail = function (uId) {
    var email = require("../controllers/EmailNotifications.js");
    return email.emailNotifications_Personal({ to_uid: uId, type: 'PASSWORD_CHANGE_EMAIL' });
};

var validateEmail = exports.validateEmail = function (o) {
    var re = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
    return re.test(o);
};

var validateEmailList = exports.validateEmailList = function (o) {
    var validEmails = []
    if (!_.isArray(o)) return validEmails;
    _(o).forEach(function (email) {
        if (validateEmail(email)) {
            validEmails.push(email.toLowerCase())
        }
    })
    return validEmails;
};

exports.sendVerificationEmail = function (uid, useremail, name) {

    //generate unique and hashed verification key
    return helpers.getHashedVerificationKey(uid, 'email')
        .then(function (hashedVerificationKey) {
            return hashedVerificationKey;
        })
        //save code in db
        .then(function (hashedVerificationKey) {

            //so first save this in table and then
            //embed this in hyperlink and
            //email to the user
            var tableUserEmailVerification = objAllTables.user_email_verification.user_email_verification();
            return tableUserEmailVerification.create({
                uid: uid,
                verification_key: hashedVerificationKey,
                expirytime: '24',
                status: 'ACTIVE',
                created: helpers.getUnixTimeStamp()
            })
                .then(function (insertedData) {
                    //if insertion failed
                    if (insertedData == null) {
                        throw new Error('hashed code insertion into db was not successful. after insertion error');
                    }

                    return hashedVerificationKey;
                });
        })
        //send email
        .then(function (hashedVerificationKey) {

            //hyperLink will be like following
            // "http://linkagoal.com/account/verify/:hashedVerificationKey"
            //var hyperLink = new Array(config.baseUrl.apiServer, 'account', 'verify', hashedVerificationKey).toURL();

            var hyperLink = new Array(config.baseUrl.domain, 'verify', hashedVerificationKey).toURL();

            var email = require('../controllers/EmailNotifications.js');
            return email.emailNotifications_Personal({
                to_uid: uid,
                type: 'VERIFICATION_EMAIL',

                data: { useremail: useremail, verify_email_link: hyperLink, name: name }
            })
                .then(function () {
                    return true;
                });
        }).catch(function () {
            return false;
        });
};

//###############################################################
//######################### Hashing #############################
//###############################################################

exports.generateHashedVerificationKey = function (id) {
    return new Promise(function (resolveVerificationKey) {
        //generate with random number and hash this with hashId
        var hashids = new Hashids(config.encryption.salt, config.encryption.size);
        var randomNumber = Math.floor((Math.random() * 50000) + 1);
        var currentTime = helpers.getUnixTimeStamp();
        var verificationKey = randomNumber + currentTime;
        var hashedVerificationKey = hashids.encode(parseInt(id), verificationKey);
        resolveVerificationKey(hashedVerificationKey);
    })
        .then(function (hashedVerificationKey) {
            return hashedVerificationKey;
        });
};

exports.generateToken = function (id) {
    var hashids = new Hashids(config.encryption.salt, config.encryption.size);
    var timestamp = Math.floor(Date.now() / 1000);
    return hashids.encode(parseInt(id), timestamp);
};

//context id
exports.aesAlogrithm = function () {

    var algorithm = config.notificationContextIdEncryption.algorithm;
    var password = config.notificationContextIdEncryption.key;

    return {
        encryption: function (text) {
            text = JSON.stringify(text);
            var cipher = crypto.createCipher(algorithm, password);
            var crypted = cipher.update(text, 'utf8', 'hex');
            crypted += cipher.final('hex');
            return crypted;
        },

        decryption: function (encrytpedData) {
            var decipher = crypto.createDecipher(algorithm, password);
            var dec = decipher.update(encrytpedData, 'hex', 'utf8');
            dec += decipher.final('utf8');
            return JSON.parse(dec);
        }
    }
} ();

//encodes int and int[] using "Hashids"
exports.encode_Hashids = function (id) {
    if (!(Object.prototype.toString.call(id) === '[object Array]')) {
        id = parseInt(id);
    }
    var hashids = new Hashids(config.encryption.salt, config.encryption.size);
    return hashids.encode(id);
};

//decodes int and int[] using "Hashids"
exports.decode_Hashids = function (hashed_id) {
    var hashids = new Hashids(config.encryption.salt, config.encryption.size);
    return hashids.decode(hashed_id);
};

//###############################################################
//########################## Mix ################################
//###############################################################

exports.viewsCount = function (session_uid, target_id, target_type, req) {
    helpers.insertLocation(req)
        .then(function (id) {

            if (target_type == "GOAL") {
                var views_goal = objAllTables.views_goal.views_goal();
                views_goal.create({
                    uid: session_uid,
                    goal_id: target_id,
                    location_id: id,
                    created: helpers.getUnixTimeStamp()
                }).then(function () { })


            } else if (target_type == "POST") {

                var views_post = objAllTables.views_post.views_post();
                views_post.create({
                    uid: session_uid,
                    post_id: target_id,
                    location_id: id,
                    created: helpers.getUnixTimeStamp()
                }).then(function () { })


            } else if (target_type == "USER_PROFILE") {

                var views_user_profile = objAllTables.views_user_profile.views_user_profile();
                views_user_profile.create({
                    uid: session_uid,
                    uid_profile: target_id,
                    location_id: id,
                    created: helpers.getUnixTimeStamp()
                }).then(function () {
                    helpers.increment_update_UserStats(target_id, 'views')
                })
            }

        })

};

exports.fixTags = function (tags) {
    //using "Promise.map" to achieve concurrency
    return Promise.map(tags, function (tag) {
        //remove "dataValues"
        tag = tag.dataValues || tag;
        return tag;
    })
        //get stats
        .map(function (tag) {

            tag.stats = {};
            var stats = tag.stats;
            var interestedUsersTags = objAllTables.user_interest_tags.user_interest_tags();

            return interestedUsersTags.findAndCountAll({ where: { tag_id: tag.tag_id, status: 'ACTIVE' } })
                .then(function (count) {
                    stats.user_followers = count.count;
                    return tag;
                });
        })
        //getting image media object
        .map(function (tag) {
            //if "image" is not required
            if (typeof tag.image_id == 'undefined' || tag.image_id == null)
                return tag;

            //get "image object" of tag image
            return helpers.getMediaObject(tag.image_id)
                .then(function (mediaObj) {
                    tag.image = helpers.getMediaObject_Fix(mediaObj, null, ['small', 'medium']);
                    return tag;
                });
        })
        //getting banner media object
        .map(function (tag) {
            //if "banner" is not required
            if (typeof tag.bannerImage_id == 'undefined' || tag.bannerImage_id == null)
                return tag;

            //get "banner object" of tag image
            return helpers.getMediaObject(tag.bannerImage_id)
                .then(function (mediaObj) {
                    /*console.log(chalk.yellow('banner image - mediaobj ####################################################################### '));
                     console.log(mediaObj);
                     console.log(chalk.yellow('banner image - mediaobj.source #######################################################################'));
                     console.log(mediaObj.files[0].source);*/

                    tag.banner = helpers.getMediaObject_Fix(mediaObj, null, ['medium']);
                    return tag;
                });
        })
        //delete extra keys
        .map(function (tag) {
            delete tag.image_id;
            delete tag.bannerImage_id;

            return tag;
        })
        .then(function () {
            return tags;
        })
};

exports.getUid = function (uid) {
    if (isNaN(uid)) {
        //get "uid" by "username"
        var users = objAllTables.users.users();
        return users.findOne({
            where: { username: uid },
            attributes: ['uid']
        }).then(function (uid) {
            if (uid == null) {
                return -1;
            } else {
                return uid['dataValues'].uid;
            }
        });
    } else {
        return new Promise(function (resolver) {
            resolver(uid);
        });
    }
};

exports.fileLog = function (info) {
    var SimpleNodeLogger = require('simple-node-logger'),
        opts = {
            logFilePath: "logs/log.txt",
            timestampFormat: 'YYYY-MM-DD HH:mm:ss.SSS'
        },
        log = SimpleNodeLogger.createSimpleFileLogger(opts)
    //log = SimpleNodeLogger.createSimpleLogger( opts);
    log.info('\n -------------------------- Incoming Data ----------------- \n', JSON.stringify(info), ' created at ', new Date().toJSON());
};

//###############################################################
//###################### Query String ###########################
//###############################################################

/**
 * [APIQueryParser description]
 * @param {[type]} q [String Query]
 * This function is not in use (there is a bug in this function on last should be an array)
 */
var APIQueryParser = exports.APIQueryParser = function (q) {
    // Turn custom format into JSON text format, and then parse it.
    // In that object, find nested objects that could be turned into array.
    console.log(q)
    return (function flagsToArray(obj) {
        // Collect keys with nested objects.
        var nested = Object.keys(obj).filter(key => obj[key] !== true);
        // For those, call this function recursively
        nested.forEach(key => obj[key] = flagsToArray(obj[key]));
        // If no nesting, then turn this into an array

        return nested.length ? obj : Object.keys(obj);
    })(JSON.parse('{' +
        q.replace(/\|/g, ',') // treat '|' as ','
            .replace(/"/g, '\"') // escape any double quotes
            .replace(/([^,|\[\]]+)/g, '"$1"') // wrap terms in double quotes
            .replace(/"\[/g, '":[') // insert colon for assignment of arrays
            .replace(/"([,\]])/g, '":true$1') // insert `true` assignment for atomic term
            .replace(/\[/g, "{").replace(/\]/g, "}") // replace array notation with object notation
        + '}'));
}

/**
 * [QueryParser description]
 * @param {[type]} query [String]
 * This function generates the query based on the string
 * Currently this function not in use, if you use this function remove this line
 */
var QueryParser = exports.QueryParser = function (query) {
    var n, tree = {},
        node = tree,
        stk = [],
        sym = '',
        sz = (query += ',').length;

    for (n = 0; n < sz; n++) {
        switch (query[n]) {
            case '|':
            case ',':
                sym && (node[sym] = true);
                break;

            case '[':
                stk.push(node);
                node = node[sym] = {};
                break;

            case ']':
                sym && (node[sym] = true);
                node = stk.pop();
                break;

            default:
                sym += query[n];
                continue;
        }
        sym = '';
    }
    return tree;
}
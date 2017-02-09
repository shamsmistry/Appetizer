//###############################################################
//######################### Require #############################
//###############################################################

var md5 = require('md5');
var random = require('random-js');
var clasAllTables = require('../models/alltables');
var db = require('../helpers/db');
var helpers = require('../helpers/helpers');
var Promise = require("bluebird");
var validator = require('validator');
var multiparty = require('multiparty');
var fsExtra = require('fs-extra');
var fs = require('fs');
var deleteFile = require('delete');
var path = require('path');
var imageInfo = require('imageinfo');
var speakingurl = require('speakingurl');
var Utils = require('../helpers/Utils');
var chalk = require('chalk');
var User = require('../models/User');
var _ = require('lodash');
var mkdirp = require('mkdir-promise');

//for generating guid and using hmac
var uuid = require('node-uuid');
var crypto = require("crypto");
var Hashids = require("hashids");

var objAllTables = clasAllTables.allTables;
var config = require('../config');
var sequelize = db.sequelizeConn();

//###############################################################
//######################### Reusable ############################
//###############################################################

exports.hashPassword = function (password) {
    var crypto = require('crypto');

    var sha1Hash = crypto.createHash('sha1');
    sha1Hash.update(password);

    password = sha1Hash.digest('hex');
    return password;
};

exports.getActiveSession = function (req) {
    //################### Validations ################### 
    if ((typeof req.headers == 'undefined' || req.headers == null)
        || (typeof req.headers.token == 'undefined' || req.headers.token == null)) {

        return new Promise(function (resolve) {
            resolve({ uid: -1, type: 'UnRecognized' });
        });

    }
    else {
        //################### Code ################### 
        var token = req.headers.token;

        var model = require('../models');

        var userSession = null;
        var permissions = {
            Goal: { read: 1, create: 1, edit: 1, "delete": 1 },
            Contribution: { read: 1, create: 1, edit: 1, "delete": 1 },
            Comment: { read: 1, create: 1, edit: 1, "delete": 1 },
            Milestones: { read: 1, create: 1, edit: 1, "delete": 1 },
            Progress: { read: 1, create: 1, edit: 1, "delete": 1 },
            Tag: { read: 1, create: 1, edit: 1, "delete": 1 },
            Category: { read: 1, create: 1, edit: 1, "delete": 1 },
            Sub_Category: { read: 1, create: 1, edit: 1, "delete": 1 },
            HotNewGoals: { read: 1, create: 1, edit: 0, "delete": 1 },
            Popular_Goals: { read: 1, create: 1, edit: 0, "delete": 1 },
            Featured_User: { read: 1, create: 1, edit: 0, "delete": 1 },
            Post: { read: 1, create: 1, edit: 1, "delete": 1 },
            Role: { read: 1, create: 1, edit: 1, "delete": 1 },
            Permission: { read: 1, create: 1, edit: 1, "delete": 1 },
            Motivate: { read: 1, create: 1, edit: 0, "delete": 1 },
            ThumbsUp: { read: 1, create: 1, edit: 0, "delete": 1 },
            ThumbsDown: { read: 1, create: 1, edit: 0, "delete": 1 },
            Goal_Follow: { read: 1, create: 1, edit: 0, "delete": 1 },
            User_Follow: { read: 1, create: 1, edit: 0, "delete": 1 },
            Upload_Image: { read: 1, create: 1, edit: 0, "delete": 1 },
            Upload_Video: { read: 1, create: 1, edit: 0, "delete": 1 },
            Upload_Audio: { read: 1, create: 1, edit: 0, "delete": 1 },
            Interest: { read: 1, create: 1, edit: 0, "delete": 1 },
            Goal_Link: { read: 1, create: 1, edit: 0, "delete": 1 },
            User_Block: { read: 1, create: 1, edit: 0, "delete": 1 },
            Mute_User: { read: 1, create: 1, edit: 0, "delete": 1 },
            Mute_Goal: { read: 1, create: 1, edit: 0, "delete": 1 },
            Flag: { read: 1, create: 1, edit: 0, "delete": 1 }
        };


        // var redis = require('redis');
        // var client = redis.createClient();
        // var getAsync = Promise.promisify(client.get);
        // 
        // console.time("RedisSession");
        // return getAsync.call(client, 'session').then(function(reply) {
        //     if (reply != null) {
        //         userSession = JSON.parse(reply)
        //         userSession.permissions = permissions;
        //         userSession.type = 'Recognized';
        //         console.timeEnd("RedisSession");
        //         return userSession;
        //     } else {
        //         return model.sessions.findOne({attributes:['clientid', 'clientsecret', 'token'], where: {status: 'ACTIVE', token: token}, include: {attributes:['uid','user_email'].concat([[sequelize.literal("CONCAT_WS(' ', first_name, last_name)"), 'name']]), model: model.users, where: {status: 'ACTIVE'}}}).then(function(session){
        //             if (session != null) {
        //                 var user = session.get().user.get();                
        //                 userSession = _.merge(user, {
        //                     clientid : session.get('clientid'),
        //                     clientsecret : session.get('clientsecret'),
        //                     token : session.get('token')
        //                 });
        //                 client.set(['session', JSON.stringify(userSession)]);
        //                 userSession.permissions = permissions;
        //                 userSession.type = 'Recognized';
        //                 return userSession;
        //             } else {
        //                 throw new Error('Invalid token');
        //             }
        //         }).error(function (err) {
        //             console.log(chalk.red('ERROR in helpers.getActiveSession (in error)'));
        //             return { type: 'InvalidToken' };
        //         })
        //         .catch(function (err) {
        //             console.log(chalk.red('ERROR in helpers.getActiveSession (in catch)'));
        //             return { type: 'InvalidToken' };
        //         });
        //     }
        // });


        return model.sessions.findOne({ attributes: ['clientid', 'clientsecret', 'token'], where: { status: 'ACTIVE', token: token }, include: { attributes: ['uid', 'username', 'user_email'].concat([[sequelize.literal("CONCAT_WS(' ', first_name, last_name)"), 'name']]), model: model.users, where: { status: 'ACTIVE' } } }).then(function (session) {
            if (session != null) {
                var user = session.get().user.get();
                userSession = _.merge(user, {
                    clientid: session.get('clientid'),
                    clientsecret: session.get('clientsecret'),
                    token: session.get('token')
                });
                userSession.permissions = permissions;
                userSession.type = 'Recognized';
                return userSession;
            } else {
                throw new Error('Invalid token');
            }
        })
            .error(function (err) {
                console.log(chalk.red('ERROR in helpers.getActiveSession (in error)'));
                return { type: 'InvalidToken' };
            })
            .catch(function (err) {
                console.log(chalk.red('ERROR 2 in helpers.getActiveSession (in catch)'));
                return { type: 'InvalidToken' };
            });
    }
};

exports.GetActiveSession_ORM = function (req) {
    var token = req.headers.token;
    //var token = '05e84840fa8a6d491c571d4bc82ed9ca';
    var sequelize = db.sequelizeConn();

    //get user data on the basis of "token"
    var sqlQueryGetUserByToken = "SELECT users.uid, sessions.ClientId, sessions.ClientSecret, sessions.Token from users JOIN sessions\
                    on users.uid = sessions.uid\
                    WHERE sessions.Token = '{0}'".format(token);

    //return Promise
    return sequelize.query(sqlQueryGetUserByToken, { type: sequelize.QueryTypes.SELECT })
        .then(function (uid) {
            return uid;
        })
        .then(function (uid) {
            if (uid[0] != null) {
                var uidSession = uid[0]['uid'];

                return helpers.GetUser_ORM(uidSession, uidSession)
                    .then(function (user) {
                        return user;
                    });
            }
        })
        .error(function (err) {
            return { meta: { status: 401, message: err } };
        });
};

exports.getUidByUsername = function (username) {
    //validate "username"
    if (username != null && username != "") {
        //get "uid" by "username"
        var users = objAllTables.users.users();

        return users.findOne({
            where: { username: username },
            attributes: ['uid']
        }).then(function (uid) {
            //if "uid" is not null, return
            if (uid != null) {
                return uid['uid'];
            }
            else
                return null;
        }).error(function (err) {
            return null;
        });
    }
    else {
        return new Promise(function (reject) {
            reject(null);
        });
    }
};

exports.getAllGoalsbyUserId = function (uid, sorting, uidSession, type, offset, limit) {
    var sequelize = db.sequelizeConn();
    var sqlqueryGoals = "";

    // Oldest to Newest
    if (sorting == 'OldestToNewest')
        sqlqueryGoals = "SELECT\
                            goal_id\
                        FROM\
                            goals\
                        WHERE\
                            uid = {0}\
                            AND (goals. STATUS = 'ACTIVE' OR goals. STATUS = 'COMPLETED')\
                            AND CheckPrivacy_Goal({3},goal_id)\
                        ORDER BY\
                            created ASC limit {1},{2}".format(uid, offset, limit, uidSession);

    //Most Contributions
    else if (sorting == 'MostContributions')
        sqlqueryGoals = "SELECT g.goal_id from posts p Right JOIN goals g\
                        on p.parent_id = g.goal_id AND p.post_type = 'CONTRIBUTION' AND p.`status`='ACTIVE'\
                        AND (g.`status`='ACTIVE' OR g.status = 'COMPLETED')\
                        WHERE g.uid = {0}\
                        AND CheckPrivacy_Goal({3},goal_id)\
                        GROUP BY g.goal_id\
                        ORDER BY COUNT(p.id) DESC limit {1},{2} ".format(uid, offset, limit, uidSession);

    // Newest Contributions
    else if (sorting == 'NewestContributions')
        sqlqueryGoals = "SELECT g.goal_id from posts p Right JOIN goals g\
                on p.parent_id = g.goal_id AND p.post_type = 'CONTRIBUTION' AND p.`status`='ACTIVE'\
                AND (g.`status`='ACTIVE' OR g.status = 'COMPLETED')\
                WHERE g.uid = {0}\
                AND CheckPrivacy_Goal({3},goal_id)\
                GROUP BY g.goal_id\
                ORDER BY max(p.created) DESC limit {1},{2}".format(uid, offset, limit, uidSession);

    // Newest to oldest
    else if (sorting == 'NewestToOldest')
        sqlqueryGoals = "SELECT\
                            goal_id\
                        FROM\
                            goals\
                        WHERE\
                            uid = {0}\
                            AND (goals. STATUS = 'ACTIVE' OR goals. STATUS = 'COMPLETED')\
                            AND CheckPrivacy_Goal({3},goal_id)\
                        ORDER BY\
                            created DESC limit {1},{2}".format(uid, offset, limit, uidSession);

    //get goal Ids based on the sorting criteria
    return sequelize.query(sqlqueryGoals, { type: sequelize.QueryTypes.SELECT })
        .then(function (goals) {
            var goalIds_array = _.uniq(_.map(goals, _.iteratee('goal_id')));
            if (goalIds_array.length > 0) {
                if (type == 'DEFAULT') {
                    var goalInput = {
                        basic: ['name', 'status', 'privacy', 'link'],
                        user: {
                            basic: ['name', 'username', 'email', 'link'],
                            profile: ['small', 'medium']
                        },
                        me: ["following", "motivate", "linked", "mute"],
                        cover: ['medium', 'large', 'xlarge'],
                        stats: ['followers', 'motivations', 'contributions', 'linkers', 'views', 'achievers'],
                        tags: true,
                        location: true
                    };
                } else if (type == 'LIST') {
                    var goalInput = {
                        basic: ['name', 'status', 'privacy', 'link'],
                        cover: ['medium', 'large', 'xlarge']
                    };
                }
                return Goal.getList(goalInput, goalIds_array, uidSession).then(function (goals) {
                    //sort result by array of goal ids
                    _.forEach(goalIds_array, function (value, key) {
                        goalIds_array[key] = _.head(_.filter(goals, function (o) { return o.id == value; }));
                    });

                    //return
                    return goalIds_array;
                })
            }
            else {
                return new Promise(function (resolve, reject) {
                    resolve([]);
                });
            }
        });
};

exports.goalContributions = function (goalId, type, sessionId) {
    var sequelize = db.sequelizeConn();

    return new Promise(function (Outresolve, Outreject) {
        return new Promise(function (resolve, reject) {
            var myQuery = "";
            if (type == 'GOAL')
                myQuery = "select c.contribution_id as id,c.contribution_txt as text,\
                            CONCAT('http://linkagoal.local/' , user.username , '/goal/',c.parent_id,'/',REPLACE(goal.goal_name, ' ', '-'),'/contribution/',c.contribution_id) as link,\
                            c.contribution_type as type,\
                            c.created as timestamp, c.uid,\
                            file_id as file_id\
                            from contribution c,users as user,goals as goal\
                            where c.parent_type = '{1}' and c.status='ACTIVE' and c.parent_id={0} and c.uid=user.uid  and c.parent_id=goal.goal_id".format(goalId, type);
            else if (type == 'PROGRESS')
                myQuery = "select c.contribution_id as id,c.contribution_txt as text,\
                            CONCAT('http://linkagoal.local/' , user.username , '/goal/progress/',c.parent_id,'/',REPLACE(gs.steps, ' ', '-'),'/contribution/',c.contribution_id) as link,\
                            c.contribution_type as type,\
                            c.created as timestamp, c.uid,\
                            file_id as file_id\
                            from contribution c,users as user,goal_step as gs\
                            where c.parent_type = '{1}' and c.status='ACTIVE' and c.parent_id={0} and c.uid=user.uid  and c.parent_id=gs._id".format(goalId, type);

            return sequelize.query(myQuery, { type: sequelize.QueryTypes.SELECT })
                .then(function (contribution) {
                    if (contribution != null) {
                        // CALL GETGOAL
                        var CONTRIBUTION = [];
                        var promiseFor = Promise.method(function (condition, action, value) {
                            if (!condition(value)) return value;
                            return action(value).then(promiseFor.bind(null, condition, action));
                        });

                        promiseFor(function (count) {
                            return count < contribution.length;
                        }, function (count) {

                            //attaching media object
                            return new Promise(function (resolve) {
                                var fileId = contribution[count]['file_id'];
                                helpers.getMediaObject(fileId)
                                    .then(function (mediaObj) {
                                        contribution[count]['media'] = mediaObj;
                                        resolve(contribution[count]);
                                    });
                            })
                                .then(function (mediaObjResult) {
                                    //attaching miniUser object
                                    return helpers.getUserMini(mediaObjResult.uid, sessionId, true)
                                        .then(function (User) {
                                            delete mediaObjResult.uid;
                                            mediaObjResult['user'] = User;
                                            CONTRIBUTION.push(mediaObjResult);
                                            return ++count;
                                        });
                                })


                        }, 0)
                            .then(function () {
                                resolve(CONTRIBUTION);
                            }
                            );
                    }
                    else
                        resolve('No Contribution found against the goal id provided');
                });
        })
            .then(function (contributions) {
                var promiseFor = Promise.method(function (condition, action, value) {
                    if (!condition(value)) return value;
                    return action(value).then(promiseFor.bind(null, condition, action));
                });
                var GoalContributions = [];
                promiseFor(function (index) {
                    return index < contributions.length;
                }, function (index) {

                    var query = "select * from\
                                (SELECT count(*) as Up FROM `contribution_rating` where contribution_id = {0} and thumb_action='UP' ) as UpTable ,\
                                (SELECT count(*) as Down FROM `contribution_rating` where contribution_id = {0} and thumb_action='DOWN') as DownTable".format(contributions[index].id);
                    return sequelize.query(query, { type: sequelize.QueryTypes.SELECT })
                        .then(function (stats) {
                            contributions[index]['stats'] = stats[0];
                            GoalContributions.push(contributions[index]);
                            return ++index;
                        });

                }, 0)
                    .then(function () {
                        Outresolve(GoalContributions);
                    });

            });
    })
        .then(function (result) {
            return result;
        });
};

exports.getUnixTimeStamp = function () {
    return Math.floor(Date.now() / 1000);
};

exports.getUnixTimeStamp_adddays = function (days) {
    var today = new Date();
    var tomorrow = new Date(today);
    var converted_time = tomorrow.setDate(today.getDate() + days);
    return Math.floor(converted_time / 1000);
};

exports.multiArrayToSingleArray = function (givenArray) {

    if (givenArray.length > 0) {
        var singleArray = [];
        for (var i = 0; i < givenArray.length; i++) {
            for (var x = 0; x < givenArray[i].length; x++) {
                singleArray.push(givenArray[i][x]);
            }
        }
        return singleArray;
    } else {
        return givenArray;
    }
};

//get audio listen counts
//if uId is set to null search total count
//other wise count on behalf of uId
exports.getAudioListenCount = function (uId, audioFileId) {
    var sequelize = db.sequelizeConn();
    return new Promise(function (resolveCount) {
        if (uId == null) {
            var sqlQueryGetCounts = "SELECT count(*) as listen_count from listen_audio up where up.audio_file_id = {0}".format(audioFileId);
        } else {
            var sqlQueryGetCounts = "SELECT count(*) as listen_count from listen_audio up where up.uid = {0} AND up.audio_file_id = {1}".format(uId, audioFileId);
        }
        return sequelize.query(sqlQueryGetCounts, { type: sequelize.QueryTypes.SELECT })
            .then(function (counts) {
                resolveCount(counts[0]['listen_count']);
            })
            .error(function (err) {
                resolveCount(null);
            });
    })
        .then(function (viewsCount) {
            return viewsCount;
        });
};

//get video view counts
//if uId is set to null search total count
//other wise count on behalf of uId
exports.getVideoViewCount = function (uId, videoFileId) {
    var sequelize = db.sequelizeConn();
    return new Promise(function (resolveCount) {
        if (uId == null) {
            var sqlQueryGetCounts = "SELECT count(*) as views from views_video up where up.video_file_id = {0}".format(videoFileId);
        } else {
            var sqlQueryGetCounts = "SELECT count(*) as views from views_video up where up.uid = {0} AND up.video_file_id = {1} as views".format(uId, videoFileId);
        }
        return sequelize.query(sqlQueryGetCounts, { type: sequelize.QueryTypes.SELECT })
            .then(function (counts) {
                resolveCount(counts[0]['views']);
            })
            .error(function (err) {
                resolveCount(null);
            });
    })
        .then(function (viewsCount) {
            return viewsCount;
        });
};

//request to Socket server for emit notifications function
exports.emitNotificationViaSocket = function (host, port, api, chatObj) {
    var method = 'POST';
    var contentType = 'application/json';
    var apiVersion = '1.0.0';
    var url = 'http://' + host + ':' + port + '/' + api;
    Utils.requestServerViaPost(url, method, contentType, chatObj, apiVersion)
        .then(function (result) {
            return result;
        });
};

//###############################################################
//######################### Objects #############################
//###############################################################

exports.GetUser_ORM = function (uidSession, uidUserIsViewing) {
    var dbConnection = require('../helpers/db');
    var sequelize = db.sequelizeConn();
    var users = objAllTables.users.users();

    //returning Promise to the caller function
    return users.findOne({
        where: { uid: uidSession },
        attributes: ['uid', 'username', 'user_email', 'account_verified', 'first_name', 'middle_name', 'last_name', 'bio', 'gender', 'dob', 'dob_show', 'profile_image_id', 'cover_image_id', 'default_image_id', 'default_cover_image_id', 'last_login', 'status', 'created', 'user_location', 'web_url', 'onboarding_web']
    })
        //user basic profile
        .then(function (userBasicProfile) {

            //console.log(userBasicProfile);

            if (userBasicProfile == null) {
                throw new Error('not found');
            }
            else if (userBasicProfile.dataValues.status != 'ACTIVE') {
                throw new Error('not active');
            }

            userBasicProfile = userBasicProfile['dataValues'];

            var name;
            if (!validator.isNull(userBasicProfile['first_name'])) {
                name = userBasicProfile['first_name'];
            }
            if (!validator.isNull(userBasicProfile['middle_name'])) {
                name += ' ' + userBasicProfile['middle_name'];
            }
            if (!validator.isNull(userBasicProfile['last_name'])) {
                name += ' ' + userBasicProfile['last_name'];
            }

            userBasicProfile['name'] = name;

            //generate url
            userBasicProfile.link = new Array(config.webURL.domain, userBasicProfile.username).toURL();

            //if user is viewing his own profile, only then show his "email" "dob_show", if not, remove it
            if (uidSession != uidUserIsViewing) {
                delete userBasicProfile['user_email'];
                delete userBasicProfile['dob_show'];
            }
            if (userBasicProfile['dob_show'] == 'PUBLIC') {
                delete userBasicProfile['dob'];
            }
            //change key "account_verified" to "verified"
            userBasicProfile['verified'] = userBasicProfile['account_verified'];
            delete userBasicProfile['account_verified'];

            //change key "web_url" to "website"
            userBasicProfile['website'] = userBasicProfile['web_url'];
            delete userBasicProfile['web_url'];

            return userBasicProfile;
        })
        //user profile and cover image/default-image
        .then(function (userBasicProfile) {

            return new Promise(function (resolve) {
                if (userBasicProfile.profile_image_id != null) {
                    return helpers.getMediaObject(userBasicProfile.profile_image_id).then(function (mediaObj) {
                        userBasicProfile.profile = getMediaObject_Fix(mediaObj, 'PROFILE', ['medium', 'large']);
                        resolve(userBasicProfile);
                    });
                }
                else {
                    userBasicProfile.profile = getMediaObject_Fix(null, 'PROFILE', ['medium', 'large']);
                    resolve(userBasicProfile);
                }
            })
                .then(function (userBasicProfile) {
                    if (userBasicProfile.cover_image_id != null) {
                        return helpers.getMediaObject(userBasicProfile.cover_image_id).then(function (mediaObj) {
                            userBasicProfile.cover = getMediaObject_Fix(mediaObj, 'PROFILE_COVER', ['medium', 'large']);
                            return userBasicProfile;
                        });
                    }
                    else {
                        userBasicProfile.cover = getMediaObject_Fix(null, 'PROFILE_COVER', ['medium', 'large']);
                        return userBasicProfile;
                    }
                });
        })
        //user social media info
        .then(function (userBasicProfile) {
            userBasicProfile.social = {};

            //change key "web_url" to "website"
            userBasicProfile.social.website = userBasicProfile.web_url;
            delete userBasicProfile.web_url;

            return userBasicProfile;
        })
        //user connections
        .then(function (userBasicProfile) {
            var sqlQueryGetConnections = "SELECT COUNT(*) as following,\
                (SELECT COUNT(*) FROM user_followers where follows_uid = {0} and `status` = 'ACTIVE') as followers,\
                (SELECT count(*) from views_user_profile up where up.uid_profile = {0}) as views\
                FROM user_followers WHERE uid = {1} and `status` = 'ACTIVE'".format(uidSession, uidSession);

            return sequelize.query(sqlQueryGetConnections, { type: sequelize.QueryTypes.SELECT })
                .then(function (connections) {

                    userBasicProfile['stats'] = {};

                    userBasicProfile['stats']['connections'] = {
                        followingCount: connections[0]['following'],
                        followersCount: connections[0]['followers'],
                        views: connections[0]['views']
                    };

                    return userBasicProfile;
                })
                .error(function (err) {
                    return { meta: { status: 401, message: err } };
                });
        })
        //mutual connections
        /*.then(function (userBasicProfile) {
         if (uidSession != uidUserIsViewing && uidUserIsViewing != -1) {
         var sqlQueryGetConnections = "SELECT followings.uid\
         from (SELECT a.follows_uid as uid FROM `user_followers` as a where uid ={0} and status = 'ACTIVE') as followings INNER JOIN\
         (select uid from user_followers where follows_uid = {1} and status = 'ACTIVE') as followers\
         on followings.uid = followers.uid".format(uidUserIsViewing, uidSession);

         return sequelize.query(sqlQueryGetConnections, { type: sequelize.QueryTypes.SELECT })
         .then(function (connections) {
         var dataConnection = [];
         userBasicProfile['mutualFollowings'] = [];
         for (var i = 0; i < connections.length; i++) {
         dataConnection.push(connections[i].uid);
         }

         return helpers.getUserListMini(dataConnection, uidUserIsViewing)
         .then(function (result) {
         return result;
         })
         .then(function (users) {
         userBasicProfile['mutualFollowings'] = users;
         return userBasicProfile;
         });

         });
         }
         else {
         return userBasicProfile;
         }
         })*/
        //user goals stats
        .then(function (userBasicProfile) {
            var sqlQueryGetGoalStats = "SELECT \
            (SELECT count(*) FROM goals WHERE uid = {0} AND (`status` = 'COMPLETED' OR `status` = 'ACTIVE')) AS total_goals,\
                (SELECT count(*) FROM goal_linked WHERE uid = {0} AND `status` = 'ACTIVE') AS linked,\
                (SELECT count(*) FROM goal_followers WHERE follower_uid = {0} AND `status` = 'ACTIVE') AS following".format(uidSession);

            return sequelize.query(sqlQueryGetGoalStats, { type: sequelize.QueryTypes.SELECT }).then(function (goal_stats) {

                userBasicProfile['stats']['goal'] = {
                    total: goal_stats[0]['total_goals'],
                    linked: goal_stats[0]['linked'],
                    following: goal_stats[0]['following']
                };

                return userBasicProfile;
            })
                .error(function (err) {
                    return { meta: { status: 401, message: err } };
                });
        })
        //"me" object
        .then(function (userBasicProfile) {

            //get user relation only if both user ids are not same "uidSession" and "uidUserIsViewing"
            if (uidSession != uidUserIsViewing && uidUserIsViewing != -1) {

                //get "me" object
                var sqlQueryGetMeObject = "SELECT (COALESCE((SELECT 1 FROM user_followers WHERE  uid = {0} and follows_uid = {1} and status = 'ACTIVE'), 0)) as 'isFollower',\
                (COALESCE((SELECT 1 FROM user_followers WHERE uid = {1} and follows_uid = {0} and status = 'ACTIVE'), 0)) as 'isFollowing',\
                (COALESCE((SELECT 1 FROM user_mute WHERE uid = {1} and mute_uid = {0} and status = 'ACTIVE'), 0)) as 'isMute'".format(uidSession, uidUserIsViewing);

                return sequelize.query(sqlQueryGetMeObject, { type: sequelize.QueryTypes.SELECT })
                    .then(function (resultMeFollowers) {
                        userBasicProfile['me'] = {
                            isFollowing: resultMeFollowers[0]['isFollowing'],
                            isFollower: resultMeFollowers[0]['isFollower'],
                            isMuted: resultMeFollowers[0]['isMute']
                        };

                        return userBasicProfile;
                    }).error(function (err) {
                        return { meta: { status: 401, message: err } };
                    });
            }
            else {
                return userBasicProfile;
            }
        })
        //get invitation
        .then(function (userBasicProfile) {
            if (uidSession != uidUserIsViewing && uidUserIsViewing != -1) {

                var user_follow_request = objAllTables.user_follow_request.user_follow_request();
                return user_follow_request.findOne({
                    where: {
                        $and: [
                            {
                                uid: uidSession
                            },
                            {
                                uid_requester: uidUserIsViewing
                            },
                            {
                                status: 'ACTIVE'
                            }
                        ]
                    }
                }).then(function (result) {
                    var request = {};
                    if (result != null) {
                        request.id = result['dataValues'].id;
                        request.status = result['dataValues'].status;
                        userBasicProfile.me['invitations'] = request;
                        return userBasicProfile;
                    }
                    else {
                        userBasicProfile.me['invitations'] = {};
                        return userBasicProfile;
                    }
                });
            }
            else {
                return userBasicProfile;
            }
        })
        //get user defined location
        .then(function (userBasicProfile) {
            if (userBasicProfile.user_location != null && userBasicProfile.user_location != 0) {
                var tableUserDefinedLocation = objAllTables.user_defined_location.user_defined_location();
                return tableUserDefinedLocation.findOne({
                    where: { id: userBasicProfile.user_location }
                }).then(function (location) {
                    userBasicProfile.location = location;
                    return userBasicProfile;
                });
            }
            else {
                userBasicProfile.location = {};
                return userBasicProfile;
            }
        })
        // Embedding roles
        .then(function (userBasicProfile) {
            // if (uidSession != -1) {
            if (uidSession == uidUserIsViewing) {

                var query = "SELECT CAST(up.`read` AS unsigned int) as `read` ,CAST(up.`create` AS unsigned int) as `create`,\
                            CAST(up.`edit` AS unsigned int) as `edit`,CAST(up.`delete` AS unsigned int) as `delete`,p.permission_name\
                            FROM `user_permission` up join all_permission p\
                            on up.permission_id= p.id\
                            where up.uid = {0}".format(uidSession);
                return sequelize.query(query, { type: sequelize.QueryTypes.SELECT }).then(function (permissions) {
                    var result = {};
                    for (var i = 0; i < permissions.length; i++) {

                        result[permissions[i].permission_name] = {
                            read: permissions[i].read,
                            create: permissions[i].create,
                            edit: permissions[i].edit,
                            delete: permissions[i].delete
                        };
                    }
                    userBasicProfile['permissions'] = result;
                    return userBasicProfile;
                });

            }
            else
                return userBasicProfile;
        })
        .error(function (err) {
            throw new Error(err);
        })
        .catch(function (err) {

            if (err.message == 'not found' || err.message == 'not active') {
                //console.error(chalk.red('User Full Profile - ' + err.message + ' - uid: ' + uidSession));

                return null;
            }
            else
                throw new Error(err);
        });
    ;
};

exports.getUser_PrivateBasic = function (uidSession) {
    var dbConnection = require('../helpers/db');
    var sequelize = db.sequelizeConn();
    var users = objAllTables.users.users();

    return users.findOne({
        where: { uid: uidSession },
        attributes: ['privacy_type', 'username', 'uid', 'user_email', 'first_name', 'middle_name', 'last_name', 'bio', 'gender', 'dob', 'dob_show', 'user_location', 'web_url']
    })
        .then(function (userBasicProfile) {
            userBasicProfile = userBasicProfile['dataValues'];

            var name;
            if (!validator.isNull(userBasicProfile['first_name'])) {
                name = userBasicProfile['first_name'];
                delete userBasicProfile['first_name'];
            }
            else {
                delete userBasicProfile['first_name'];
            }
            if (!validator.isNull(userBasicProfile['middle_name'])) {
                name += ' ' + userBasicProfile['middle_name'];
                delete userBasicProfile['middle_name'];
            }
            else {
                delete userBasicProfile['middle_name'];
            }
            if (!validator.isNull(userBasicProfile['last_name'])) {
                name += ' ' + userBasicProfile['last_name'];
                delete userBasicProfile['last_name'];
            }
            else {
                delete userBasicProfile['last_name'];
            }

            userBasicProfile['name'] = name;

            return userBasicProfile;
        })
        .then(function (userBasicProfile) {
            if (userBasicProfile.user_location != null && userBasicProfile.user_location != 0) {
                var tableUserDefinedLocation = objAllTables.user_defined_location.user_defined_location();
                return tableUserDefinedLocation.findOne({
                    where: { id: userBasicProfile.user_location }
                }).then(function (location) {
                    userBasicProfile['location'] = location;
                    delete userBasicProfile['user_location'];
                    return userBasicProfile;
                });
            }
            else {
                userBasicProfile['location'] = {};
                delete userBasicProfile['user_location'];
                return userBasicProfile;
            }
        });
};

exports.getUserMini = function (uidSession, uidUserIsViewing, isRelationObject) {
    var dbConnection = require('../helpers/db');
    var sequelize = db.sequelizeConn();
    var users = objAllTables.users.users();

    //returning Promise to the caller function
    return users.findOne({
        where: { uid: uidSession },
        attributes: ['uid', 'username', 'first_name', 'middle_name', 'last_name', 'profile_image_id', 'cover_image_id', 'default_image_id', 'user_location']
    })
        //user basic profile
        .then(function (userBasicProfile) {

            userBasicProfile = userBasicProfile['dataValues'];

            var name;
            if (!validator.isNull(userBasicProfile['first_name'])) {
                name = userBasicProfile['first_name'];
            }
            if (!validator.isNull(userBasicProfile['middle_name'])) {
                name += ' ' + userBasicProfile['middle_name'];
            }
            if (!validator.isNull(userBasicProfile['last_name'])) {
                name += ' ' + userBasicProfile['last_name'];
            }

            userBasicProfile.name = name;

            //generate url
            userBasicProfile.link = new Array(config.webURL.domain, userBasicProfile.username).toURL();

            return userBasicProfile;
        })
        //user profile image, cover image and thumb to media object
        .then(function (userBasicProfile) {
            return new Promise(function (resolve) {

                if (userBasicProfile.profile_image_id != null) {
                    return helpers.getMediaObject(userBasicProfile.profile_image_id).then(function (mediaObj) {
                        userBasicProfile.profile = getMediaObject_Fix(mediaObj, 'PROFILE', ['small', 'medium']);
                        resolve(userBasicProfile);
                    });
                }
                //build default profile media
                else {
                    userBasicProfile.profile = getMediaObject_Fix(null, 'PROFILE', ['small', 'medium']);
                    resolve(userBasicProfile);
                }
            });
        })
        //get user defined location
        .then(function (userBasicProfile) {
            if (userBasicProfile.user_location != null && userBasicProfile.user_location != 0) {
                var tableUserDefinedLocation = objAllTables.user_defined_location.user_defined_location();
                return tableUserDefinedLocation.findOne({
                    where: { id: userBasicProfile.user_location }
                }).then(function (location) {
                    userBasicProfile.location = location;
                    return userBasicProfile;
                });
            }
            else {
                userBasicProfile.location = {};
                return userBasicProfile;
            }
        })
        //"me" object
        .then(function (userBasicProfile) {

            //get user relation only if both user ids are not same "uidSession" and "uidUserIsViewing"
            if (uidSession != uidUserIsViewing && uidUserIsViewing != -1 && isRelationObject == true) {

                var sqlQueryGetMeObject = "SELECT (COALESCE((SELECT 1 FROM user_followers WHERE  uid = {0} and follows_uid = {1} and status = 'ACTIVE'), 0)) as 'isFollower',\
                (COALESCE((SELECT 1 FROM user_followers WHERE uid = {1} and follows_uid = {0} and status = 'ACTIVE'), 0)) as 'isFollowing',\
                (COALESCE((SELECT 1 FROM user_mute WHERE uid = {1} and mute_uid = {0} and status = 'ACTIVE'), 0)) as 'isMute'".format(uidSession, uidUserIsViewing);

                return sequelize.query(sqlQueryGetMeObject, { type: sequelize.QueryTypes.SELECT })
                    .then(function (resultMeFollowers) {
                        userBasicProfile['me'] = {
                            isFollowing: resultMeFollowers[0]['isFollowing'],
                            isFollower: resultMeFollowers[0]['isFollower'],
                            isMuted: resultMeFollowers[0]['isMute']
                        };

                        return userBasicProfile;
                    })
                    .error(function (err) {
                        return { meta: { status: 401, message: err } };
                    });
            }
            else {
                return userBasicProfile;
            }
        })
        //return user object
        .then(function (userBasicProfile) {
            //delete extra "keys"
            delete userBasicProfile.first_name;
            delete userBasicProfile.middle_name;
            delete userBasicProfile.last_name;
            delete userBasicProfile.profile_image_id;
            delete userBasicProfile.cover_image_id;
            delete userBasicProfile.default_image_id;
            delete userBasicProfile.user_location;

            //return
            return userBasicProfile;
        });
};

exports.getUserMini2 = function (uidSession, uidUserIsViewing) {
    var dbConnection = require('../helpers/db');
    var sequelize = db.sequelizeConn();
    var users = objAllTables.users.users();

    //returning Promise to the caller function
    return users.findOne({
        where: { uid: uidSession },
        attributes: ['uid', 'username', 'user_email', 'account_verified', 'first_name', 'middle_name', 'last_name', 'bio', 'gender', 'dob', 'dob_show', 'profile_image_id', 'cover_image_id', 'default_image_id', 'default_cover_image_id', 'last_login', 'status', 'created', 'user_location', 'web_url', 'onboarding_web']
    })
        //user basic profile
        .then(function (userBasicProfile) {

            if (userBasicProfile == null) {
                throw new Error('not found');
            }
            else if (userBasicProfile.dataValues.status != 'ACTIVE') {
                throw new Error('not active');
            }

            userBasicProfile = userBasicProfile['dataValues'];

            var name;
            if (!validator.isNull(userBasicProfile['first_name'])) {
                name = userBasicProfile['first_name'];
            }
            if (!validator.isNull(userBasicProfile['middle_name'])) {
                name += ' ' + userBasicProfile['middle_name'];
            }
            if (!validator.isNull(userBasicProfile['last_name'])) {
                name += ' ' + userBasicProfile['last_name'];
            }

            userBasicProfile['name'] = name;

            //generate url
            userBasicProfile.link = new Array(config.webURL.domain, userBasicProfile.username).toURL();

            //if user is viewing his own profile, only then show his "email" "dob_show", if not, remove it
            if (uidSession != uidUserIsViewing) {
                delete userBasicProfile['user_email'];
                delete userBasicProfile['dob_show'];
            }
            if (userBasicProfile['dob_show'] == 'PUBLIC') {
                delete userBasicProfile['dob'];
            }
            //change key "account_verified" to "verified"
            userBasicProfile['verified'] = userBasicProfile['account_verified'];
            delete userBasicProfile['account_verified'];

            //change key "web_url" to "website"
            userBasicProfile['website'] = userBasicProfile['web_url'];
            delete userBasicProfile['web_url'];

            return userBasicProfile;
        })
        //user profile and cover image/default-image
        .then(function (userBasicProfile) {

            return new Promise(function (resolve) {
                if (userBasicProfile.profile_image_id != null) {
                    return helpers.getMediaObject(userBasicProfile.profile_image_id).then(function (mediaObj) {
                        userBasicProfile.profile = getMediaObject_Fix(mediaObj, 'PROFILE', ['small', 'medium']);
                        resolve(userBasicProfile);
                    });
                }
                else {
                    userBasicProfile.profile = getMediaObject_Fix(null, 'PROFILE', ['small', 'medium']);
                    resolve(userBasicProfile);
                }
            });
        })
        //"me" object
        .then(function (userBasicProfile) {

            //get user relation only if both user ids are not same "uidSession" and "uidUserIsViewing"
            if (uidSession != uidUserIsViewing && uidUserIsViewing != -1) {

                //get "me" object
                var sqlQueryGetMeObject = "SELECT (COALESCE((SELECT 1 FROM user_followers WHERE  uid = {0} and follows_uid = {1} and status = 'ACTIVE'), 0)) as 'isFollower',\
                (COALESCE((SELECT 1 FROM user_followers WHERE uid = {1} and follows_uid = {0} and status = 'ACTIVE'), 0)) as 'isFollowing',\
                (COALESCE((SELECT 1 FROM user_mute WHERE uid = {1} and mute_uid = {0} and status = 'ACTIVE'), 0)) as 'isMute'".format(uidSession, uidUserIsViewing);

                return sequelize.query(sqlQueryGetMeObject, { type: sequelize.QueryTypes.SELECT })
                    .then(function (resultMeFollowers) {
                        userBasicProfile['me'] = {
                            isFollowing: resultMeFollowers[0]['isFollowing'],
                            isFollower: resultMeFollowers[0]['isFollower'],
                            isMuted: resultMeFollowers[0]['isMute']
                        };

                        return userBasicProfile;
                    })
                    .error(function (err) {
                        return { meta: { status: 401, message: err } };
                    });
            }
            else {
                return userBasicProfile;
            }
        })
        .error(function (err) {
            throw new Error(err);
        })
        .catch(function (err) {

            if (err.message == 'not found' || err.message == 'not active') {
                //console.error('User Mini Profile 2 - ' + err.message + ' - uid: ' + uidSession);

                return null;
            }
            else
                throw new Error(err);
        });
};

exports.GetGoal = function (goal_id, username, uidSession) {
    var input = {
        basic: ['name', 'username', 'email', 'link'],
        profile: ['small', 'medium'],
        cover: ['small', 'medium'],
        me: ['follower', 'following', 'mutual', 'mute'],
        location: true,
        stats: {
            connections: ['followers', 'followings'],
            goals: ['total', 'linked', 'following']
        }
    };



    var sequelize = db.sequelizeConn();
    var sqlQueryGetGoal;

    //if username is null, search by goal_id only
    if (username == null) {
        sqlQueryGetGoal = "SELECT\
                    goals.uid as uid,\
                    users.username,\
                    goal_id as id,\
                    goal_name as name,\
                    scope_id as scope_id,\
                    goals.goal_description as description,\
                    goals.category_id,\
                    goals.status as status,\
                    goals.g_start_date as start_date,\
                    goals.g_end_date as end_date,\
                    goals.created as created,\
                    goals.completed as completed,\
                    goals.updated as lastupdated,\
                    goals.goal_image_id as goal_image_id,\
                    goals.default_goal_image_id as default_goal_image_id,\
                    goals.user_location\
                FROM\
                    goals join users\
                    on goals.uid = users.uid\
                WHERE\
                    goals.goal_id = {0}\
                    and (goals.status = 'ACTIVE' or goals.status = 'COMPLETED')".format(goal_id);
    }
    else {
        //check if goal belongs to provided username or not
        sqlQueryGetGoal = "SELECT\
                    goals.uid as uid,\
                    users.username,\
                    goal_id as id,\
                    goal_name as name,\
                    scope_id as scope_id,\
                    goals.goal_description as description,\
                    goals.category_id,\
                    goals.status as status,\
                    goals.g_start_date as start_date,\
                    goals.g_end_date as end_date,\
                    goals.created as created,\
                    goals.completed as completed,\
                    goals.updated as lastupdated,\
                    goals.goal_image_id as goal_image_id,\
                    goals.default_goal_image_id as default_goal_image_id,\
                    goals.user_location\
                FROM\
                    goals join users\
                    on goals.uid = users.uid\
                WHERE\
                    goals.goal_id = {0}\
                    and users.username = '{1}'\
                    and (goals.status = 'ACTIVE' or goals.status = 'COMPLETED')".format(goal_id, username);
    }
    //return Promise
    return sequelize.query(sqlQueryGetGoal, { type: sequelize.QueryTypes.SELECT })
        .then(function (goal) {
            if (goal.length > 0) {
                goal = goal[0];
                goal.link = new Array(config.webURL.domain, (goal.username), 'goal', goal.id, speakingurl(goal.name)).toURL();

                return goal;
            }
            else {
                new Error({ status: 404, message: 'Not Found' });
            }
        })
        //appending media object
        .then(function (goal) {
            return new Promise(function (resolve) {

                if (goal.goal_image_id != null) {
                    return helpers.getMediaObject(goal.goal_image_id)
                        .then(function (mediaObj) {
                            goal.cover = getMediaObject_Fix(mediaObj, 'GOAL_COVER', ['small', 'medium', 'large', 'xlarge']);
                            resolve(goal);
                        });
                }
                else {
                    goal.cover = getMediaObject_Fix(null, 'GOAL_COVER', ['small', 'medium', 'large', 'xlarge']);
                    resolve(goal);
                }
            })
                .then(function (goalMedia) {
                    return goal;
                })
        })
        //get goal stats
        .then(function (goal) {
            var sqlGoalStats = "SELECT  * FROM\
                (SELECT count(*) AS motivations FROM goal_motivate gm JOIN goals g ON g.goal_id = gm.goal_id WHERE g.goal_id = {0} AND gm.status = 'ACTIVE') AS LIKES ,\
                (SELECT count(*) AS linkers FROM goal_linked gl JOIN goals g ON g.goal_id = gl.to_goal_id WHERE g.goal_id = {0} and gl.status = 'ACTIVE') AS LINKERS ,\
                (SELECT count(*) AS achievers FROM goal_linked gl JOIN goals g ON g.goal_id = gl.from_goal_id WHERE g.goal_id = {0} AND g.status = 'COMPLETED') AS ACHIEVERS ,\
                (SELECT count(*) AS contribution FROM posts p WHERE p.parent_id = {0} AND p.post_type = 'CONTRIBUTION' AND p.`status` = 'ACTIVE') AS CONTRIBUTION,\
                (SELECT count(*) AS followers FROM goal_followers f WHERE f.goal_id = {0} AND f.`status` = 'ACTIVE') AS FOLLOWERS,\
                (SELECT count(*) AS views from views_goal WHERE goal_id = {0}) AS VIEWS".format(goal_id);

            return sequelize.query(sqlGoalStats, { type: sequelize.QueryTypes.SELECT })
                .then(function (goalStats) {
                    goalStats = goalStats[0];
                    goal['stats'] = goalStats;

                    return goal;
                });
        })
        //attach "me" object
        .then(function (goal) {
            //get goal me object
            if (uidSession != -1) {  //it will be "-1" if it is not available
                var sqlGoalMe = "SELECT * FROM\
                                (SELECT CASE WHEN count(*) > 0 THEN 1 ELSE 0 END AS isMotivatedByMe FROM goal_motivate goalM WHERE goalM.goal_id = {0} AND goalM.uid = {1} AND STATUS = 'ACTIVE') AS isMotivatedByMe,\
                                (SELECT CASE WHEN count(*) > 0 THEN 1 ELSE 0 END AS isGoalFollower FROM goal_followers goalF WHERE goalF.goal_id = {0} AND goalF.follower_uid = {1} AND STATUS = 'ACTIVE') AS isGoalFollower,\
                                (SELECT CASE WHEN count(*) > 0 THEN 1 ELSE 0 END AS isGoalLinker FROM goal_linked gl WHERE gl.to_goal_id = {0} AND gl.uid = {1} AND STATUS = 'ACTIVE') AS isGoalLinker ,\
                                (SELECT CASE WHEN count(*) > 0 THEN 1 ELSE 0 END AS contribution FROM posts p WHERE p.parent_id = {0} AND p.post_type = 'CONTRIBUTION' AND p.`status` = 'ACTIVE') AS isGoalCompleted,\
                                (SELECT CASE WHEN count(*) > 0 THEN 1 ELSE 0 END AS isMutedByMe FROM goal_mute m WHERE m.goal_id = {0} AND m.uid = {1} AND STATUS = 'ACTIVE') AS isMutedByMe".format(goal_id, uidSession);

                return sequelize.query(sqlGoalMe, { type: sequelize.QueryTypes.SELECT })
                    .then(function (goalMe) {
                        goalMe = goalMe[0];
                        goalMe['isMotivated'] = goalMe.isMotivatedByMe;
                        goalMe['isCompleted'] = goalMe.isGoalCompleted;
                        goalMe['isFollower'] = goalMe.isGoalFollower;
                        goalMe['isLinked'] = goalMe.isGoalLinker;
                        goalMe['isMuted'] = goalMe.isMutedByMe;
                        delete goalMe.isMotivatedByMe;
                        delete goalMe.isGoalCompleted;
                        delete goalMe.isGoalFollower;
                        delete goalMe.isGoalLinker;
                        delete goalMe.isMutedByMe;
                        goal['me'] = goalMe;

                        return goal;
                    });
            }
            else {
                //return goal;
                return new Promise(function (reject) {
                    reject(goal);
                });
            }
        })
        //get goal tags if session is active get tags according to the active session user
        .then(function (goal) {
            var sqlGoalTags;

            if (uidSession != -1)
                // sqlGoalTags = " SELECT tag_id as id, (SELECT tagname from tags t where t.tag_id = gt.tag_id) as name,1 AS `isMyInterest`\
                //                     FROM `goals_tags` gt WHERE gt.goal_id = {0} AND gt.tag_id IN(SELECT tag_id FROM `user_interest_tags`ut WHERE uid = {1})\
                //                     UNION SELECT tag_id as id, (SELECT tagname from tags t where t.tag_id = gt.tag_id) as name,0 AS `isMyInterest`\
                //                     FROM `goals_tags` gt WHERE gt.goal_id = {0} AND gt.tag_id NOT IN(SELECT tag_id FROM `user_interest_tags`ut WHERE uid = {1})".format(goal_id, uidSession);
                sqlGoalTags = " SELECT\
                                tag_id as id,\
                                (SELECT tagname from tags t where t.tag_id = gt.tag_id) as name,\
                                1 AS `isMyInterest`\
                            FROM `goals_tags` gt\
                                WHERE gt.goal_id = {0} AND gt.`status` = 'ACTIVE' AND gt.tag_id IN (SELECT tag_id FROM `user_interest_tags`ut WHERE uid = {1})\
                            UNION\
                            SELECT\
                                tag_id as id,\
                                (SELECT tagname from tags t where t.tag_id = gt.tag_id) as name,\
                                0 AS `isMyInterest`\
                            FROM `goals_tags` gt\
                                WHERE gt.goal_id = {0} AND gt.`status` = 'ACTIVE' AND gt.tag_id NOT IN(SELECT tag_id FROM `user_interest_tags`ut WHERE uid = {1})".format(goal_id, uidSession);
            else
                sqlGoalTags = " SELECT tags.tag_id as id, tagname as name FROM goals_tags JOIN tags\
                                ON goals_tags.tag_id = tags.tag_id WHERE goals_tags.goal_id = {0} AND goals_tags.`status` = 'ACTIVE'".format(goal_id);

            return sequelize.query(sqlGoalTags, { type: sequelize.QueryTypes.SELECT })
                .then(function (goalTags) {
                    goal['tags'] = goalTags;

                    return goal;
                });
        })
        //attach user object
        .then(function (goal) {

            // return helpers.getUserMini(goal.uid, uidSession, true)
            //     .then(function (user) {
            //         goal.user = user;
            //         return goal;
            //     });

            var _user = new User(goal.uid, uidSession);
            return _user.get(input)
                .then(function (user) {
                    goal.user = user[0];
                    return goal;
                });


        })
        //get user defined location
        .then(function (goal) {
            if (goal.user_location != null && goal.user_location != 0) {

                var tableUserDefinedLocation = objAllTables.user_defined_location.user_defined_location();
                return tableUserDefinedLocation.findOne({
                    where: { id: goal.user_location }
                })
                    .then(function (location) {
                        goal.location = location;
                        return goal;
                    });
            }
            else {
                goal.location = {};
                return goal;
            }
        })
        //return user object
        .then(function (goal) {
            //delete extra "keys"
            delete goal.uid;
            delete goal.username;
            //delete goal.goal_image_id;
            //delete goal.default_goal_image_id;

            return goal;
        })
        .error(function (err) {
            return null;
        })
        .catch(function (err) {
            return null;
        });
};

exports.GetGoalMini = function (goal_id) {
    var sequelize = db.sequelizeConn();
    var sqlQueryGetGoal;

    sqlQueryGetGoal = "SELECT\
                    goals.uid as uid,\
                    users.username,\
                    goal_id as id,\
                    goal_name as name,\
                    scope_id as scope_id,\
                    goal_description as description,\
                    goals.category_id,\
                    goals.status as status,\
                    goals.g_start_date as start_date,\
                    goals.g_end_date as end_date,\
                    goals.created as created,\
                    goals.updated as lastupdated,\
                    goals.goal_image_id as goal_image_id,\
                    goals.default_goal_image_id as default_goal_image_id,\
                    goals.user_location\
                FROM\
                    goals join users\
                    on goals.uid = users.uid\
                WHERE\
                    goals.goal_id = {0}\
                    and (goals.status = 'ACTIVE' or goals.status = 'COMPLETED')".format(goal_id);

    //return Promise
    return sequelize.query(sqlQueryGetGoal, { type: sequelize.QueryTypes.SELECT })
        .then(function (goal) {
            if (goal.length > 0) {
                goal = goal[0];
                goal.link = new Array(config.webURL.domain, (goal.username), 'goal', goal.id, speakingurl(goal.name)).toURL();

                return goal;
            }
            else {
                new Error({ status: 404, message: 'Not Found' });
            }
        })
        //appending media object
        .then(function (goal) {
            return new Promise(function (resolve) {
                if (goal.goal_image_id != null) {
                    return helpers.getMediaObject(goal.goal_image_id)
                        .then(function (mediaObj) {
                            goal.cover = getMediaObject_Fix(mediaObj, 'GOAL_COVER', ['medium', 'large', 'xlarge']);
                            resolve(goal);
                        });
                }
                else {
                    goal.cover = getMediaObject_Fix(null, 'GOAL_COVER', ['medium', 'large', 'xlarge']);
                    resolve(goal);
                }
            })
                .then(function (goalMedia) {
                    return goal;
                })
        })
        //get user defined location
        .then(function (goal) {
            if (goal.user_location != null && goal.user_location != 0) {
                var tableUserDefinedLocation = objAllTables.user_defined_location.user_defined_location();
                return tableUserDefinedLocation.findOne({
                    where: { id: goal.user_location }
                })
                    .then(function (location) {
                        goal.location = location;
                        return goal;
                    });
            }
            else {
                goal.location = {};
                return goal;
            }
        })
        //return goal object
        .then(function (goal) {
            //delete extra "keys"
            delete goal.uid;
            delete goal.username;
            delete goal.start_date;
            delete goal.end_date;
            delete goal.created;
            delete goal.lastupdated;
            delete goal.goal_image_id;
            delete goal.default_goal_image_id;
            //return
            return goal;
        })
        .error(function (err) {
            new Error({ status: 404, message: 'Not Found' });
        })
        .catch(function (err) {
            return null;
        });
};

exports.getGoal_parametric = function (goal_id, username, uidSession, fields) {
    var sequelize = db.sequelizeConn();
    var sqlQueryGetGoal;

    //if username is null, search by goal_id only
    if (username == null) {
        sqlQueryGetGoal = "SELECT\
                    goals.uid as uid,\
                    users.username,\
                    goal_id as id,\
                    goal_name as name,\
                    scope_id as scope_id,\
                    goals.goal_description as description,\
                    goals.status as status,\
                    goals.g_start_date as start_date,\
                    goals.g_end_date as end_date,\
                    goals.created as created,\
                    goals.updated as lastupdated,\
                    goals.goal_image_id as goal_image_id,\
                    goals.default_goal_image_id as default_goal_image_id,\
                    goals.user_location\
                FROM\
                    goals join users\
                    on goals.uid = users.uid\
                WHERE\
                    goals.goal_id = {0}\
                    and (goals.status = 'ACTIVE' or goals.status = 'COMPLETED')".format(goal_id);
    }
    else {
        //check if goal belongs to provided username or not
        sqlQueryGetGoal = "SELECT\
                    goals.uid as uid,\
                    users.username,\
                    goal_id as id,\
                    goal_name as name,\
                    scope_id as scope_id,\
                    goals.goal_description as description,\
                    goals.status as status,\
                    goals.g_start_date as start_date,\
                    goals.g_end_date as end_date,\
                    goals.created as created,\
                    goals.updated as lastupdated,\
                    goals.goal_image_id as goal_image_id,\
                    goals.default_goal_image_id as default_goal_image_id,\
                    goals.user_location\
                FROM\
                    goals join users\
                    on goals.uid = users.uid\
                WHERE\
                    goals.goal_id = {0}\
                    and users.username = '{1}'\
                    and (goals.status = 'ACTIVE' or goals.status = 'COMPLETED')".format(goal_id, username);
    }
    //return Promise
    return sequelize.query(sqlQueryGetGoal, { type: sequelize.QueryTypes.SELECT })
        .then(function (goal) {
            if (goal.length > 0) {
                goal = goal[0];
                goal.link = new Array(config.webURL.domain, (goal.username), 'goal', goal.id, speakingurl(goal.name)).toURL();

                return goal;
            }
            else {
                new Error({ status: 404, message: 'Not Found' });
            }
        })
        //appending media object
        .then(function (goal) {
            return new Promise(function (resolve) {

                if (goal.goal_image_id != null) {
                    return helpers.getMediaObject(goal.goal_image_id)
                        .then(function (mediaObj) {
                            goal.cover = getMediaObject_Fix(mediaObj, 'GOAL_COVER', ['small', 'medium', 'large', 'xlarge']);
                            resolve(goal);
                        });
                }
                else {
                    goal.cover = getMediaObject_Fix(null, 'GOAL_COVER', ['small', 'medium', 'large', 'xlarge']);
                    resolve(goal);
                }
            })
                .then(function (goalMedia) {
                    return goal;
                })
        })
        //get goal stats
        .then(function (goal) {
            var sqlGoalStats = "SELECT  * FROM\
                (SELECT count(*) AS motivations FROM goal_motivate gm JOIN goals g ON g.goal_id = gm.goal_id WHERE g.goal_id = {0} AND gm.status = 'ACTIVE') AS LIKES ,\
                (SELECT count(*) AS linkers FROM goal_linked gl JOIN goals g ON g.goal_id = gl.to_goal_id WHERE g.goal_id = {0} and gl.status = 'ACTIVE') AS LINKERS ,\
                (SELECT count(*) AS achievers FROM goal_linked gl JOIN goals g ON g.goal_id = gl.from_goal_id WHERE g.goal_id = {0} AND g.status = 'COMPLETED') AS ACHIEVERS ,\
                (SELECT count(*) AS contribution FROM posts p WHERE p.parent_id = {0} AND p.post_type = 'CONTRIBUTION' AND p.`status` = 'ACTIVE') AS CONTRIBUTION,\
                (SELECT count(*) AS followers FROM goal_followers f WHERE f.goal_id = {0} AND f.`status` = 'ACTIVE') AS FOLLOWERS,\
                (SELECT count(*) AS views from views_goal WHERE goal_id = {0}) AS VIEWS".format(goal_id);

            return sequelize.query(sqlGoalStats, { type: sequelize.QueryTypes.SELECT })
                .then(function (goalStats) {
                    goalStats = goalStats[0];
                    goal['stats'] = goalStats;

                    return goal;
                });
        })
        //attach "me" object
        .then(function (goal) {
            //get goal me object
            if (uidSession != -1) {  //it will be "-1" if it is not available
                var sqlGoalMe = "SELECT * FROM\
                                (SELECT CASE WHEN count(*) > 0 THEN 1 ELSE 0 END AS isMotivatedByMe FROM goal_motivate goalM WHERE goalM.goal_id = {0} AND goalM.uid = {1} AND STATUS = 'ACTIVE') AS isMotivatedByMe,\
                                (SELECT CASE WHEN count(*) > 0 THEN 1 ELSE 0 END AS isGoalFollower FROM goal_followers goalF WHERE goalF.goal_id = {0} AND goalF.follower_uid = {1} AND STATUS = 'ACTIVE') AS isGoalFollower,\
                                (SELECT CASE WHEN count(*) > 0 THEN 1 ELSE 0 END AS isGoalLinker FROM goal_linked gl WHERE gl.to_goal_id = {0} AND gl.uid = {1} AND STATUS = 'ACTIVE') AS isGoalLinker ,\
                                (SELECT CASE WHEN count(*) > 0 THEN 1 ELSE 0 END AS contribution FROM posts p WHERE p.parent_id = {0} AND p.post_type = 'CONTRIBUTION' AND p.`status` = 'ACTIVE') AS isGoalCompleted,\
                                (SELECT CASE WHEN count(*) > 0 THEN 1 ELSE 0 END AS isMutedByMe FROM goal_mute m WHERE m.goal_id = {0} AND m.uid = {1} AND STATUS = 'ACTIVE') AS isMutedByMe".format(goal_id, uidSession);

                return sequelize.query(sqlGoalMe, { type: sequelize.QueryTypes.SELECT })
                    .then(function (goalMe) {
                        goalMe = goalMe[0];
                        goalMe['isMotivated'] = goalMe.isMotivatedByMe;
                        goalMe['isCompleted'] = goalMe.isGoalCompleted;
                        goalMe['isFollower'] = goalMe.isGoalFollower;
                        goalMe['isLinked'] = goalMe.isGoalLinker;
                        goalMe['isMuted'] = goalMe.isMutedByMe;
                        delete goalMe.isMotivatedByMe;
                        delete goalMe.isGoalCompleted;
                        delete goalMe.isGoalFollower;
                        delete goalMe.isGoalLinker;
                        delete goalMe.isMutedByMe;
                        goal['me'] = goalMe;

                        return goal;
                    });
            }
            else {
                //return goal;
                return new Promise(function (reject) {
                    reject(goal);
                });
            }
        })
        //get goal tags if session is active get tags according to the active session user
        .then(function (goal) {
            var sqlGoalTags;

            if (uidSession != -1)
                sqlGoalTags = " SELECT tag_id as id, (SELECT tagname from tags t where t.tag_id = gt.tag_id) as name,1 AS `isMyInterest`\
                                FROM `goals_tags` gt WHERE gt.goal_id = {0} AND gt.tag_id IN(SELECT tag_id FROM `user_interest_tags`ut WHERE uid = {1})\
                                UNION SELECT tag_id as id, (SELECT tagname from tags t where t.tag_id = gt.tag_id) as name,0 AS `isMyInterest`\
                                FROM `goals_tags` gt WHERE gt.goal_id = {0} AND gt.tag_id NOT IN(SELECT tag_id FROM `user_interest_tags`ut WHERE uid = {1})".format(goal_id, uidSession);
            else
                sqlGoalTags = " SELECT tags.tag_id as id, tagname FROM goals_tags JOIN tags\
                                ON goals_tags.tag_id = tags.tag_id WHERE goals_tags.goal_id = {0} AND goals_tags.`status` = 'ACTIVE'".format(goal_id);

            return sequelize.query(sqlGoalTags, { type: sequelize.QueryTypes.SELECT })
                .then(function (goalTags) {
                    goal['tags'] = goalTags;

                    return goal;
                });
        })
        //attach user object
        .then(function (goal) {
            return helpers.getUserMini(goal.uid, uidSession, true)
                .then(function (user) {
                    goal.user = user;
                    return goal;
                });
        })
        //get user defined location
        .then(function (goal) {
            if (goal.user_location != null && goal.user_location != 0) {

                var tableUserDefinedLocation = objAllTables.user_defined_location.user_defined_location();
                return tableUserDefinedLocation.findOne({
                    where: { id: goal.user_location }
                }).then(function (location) {
                    goal.location = location;
                    return goal;
                });
            }
            else {
                goal.location = {};
                return goal;
            }
        })
        //return user object
        .then(function (goal) {
            //delete extra "keys"
            delete goal.uid;
            delete goal.username;
            //delete goal.goal_image_id;
            //delete goal.default_goal_image_id;

            return goal;
        })
        .error(function (err) {
            return null;
        })
        .catch(function (err) {
            return null;
        });
};

exports.GetListGoal = function (goal_id) {
    var goals = objAllTables.goals.goals();
    return goals.findOne({
        attributes: ['goal_id', 'goal_name', 'goal_image_id', 'default_goal_image_id'],
        where: { goal_id: goal_id }
    })
        .then(function (goal) {
            var goalImageId = goal['goal_image_id'];
            var defaultGoalImageId = goal['default_goal_image_id'];
            goal.dataValues['id'] = goal.dataValues['goal_id'];
            goal.dataValues['name'] = goal.dataValues['goal_name'];

            delete goal.dataValues['goal_id'];
            delete goal.dataValues['goal_name'];
            delete goal.dataValues['goal_image_id'];
            delete goal.dataValues['default_goal_image_id'];

            if (goalImageId != null) {
                return helpers.getMediaObject(goalImageId).then(function (mediaObj) {
                    goal.dataValues['media'] = mediaObj;
                    return goal;
                });
            } else if (defaultGoalImageId != null) {
                return helpers.getMediaObject(defaultGoalImageId).then(function (mediaObj) {
                    goal.dataValues['media'] = mediaObj;
                    return goal;
                });
            }
            else
                return goal;
        })
};

//media object
exports.getMediaObject = function (fileId) {

    if (fileId == null) {
        return new Promise(function (resolve) {
            resolve({});
        })
    }

    var tableUserFileUploads = objAllTables.user_file_uploads.user_file_uploads();
    var tableImagesThumbs = objAllTables.images_thumbs.images_thumbs();
    var tableFileCompressions = objAllTables.file_compressions.file_compressions();
    var mediaObject = {
        files: "",
        info: ""
    };
    var dataArray = [];
    var fileObject = {};
    var baseUrl = config.baseUrl.fileServer;
    var uploadPath = config.path.uploadPath;
    return new Promise(function (resolveMediaObject) {
        return tableUserFileUploads.findAll({
            where: {
                $and: [
                    {
                        id: fileId
                    },
                    {
                        status: 'ACTIVE'
                    }
                ]
            }
        })
            .then(function (fileData) {
                if (fileData.length > 0) {
                    //all fields value
                    //which are fetched from
                    //user_file_uploads table
                    var parentId = fileData[0]['dataValues']['parent_id'];
                    var albumId = fileData[0]['dataValues']['album_id'];
                    var parentType = fileData[0]['dataValues']['parent_type'];
                    var fileType = fileData[0]['dataValues']['filetype'];
                    var uId = fileData[0]['dataValues']['uid'];
                    var mediaUrl = fileData[0]['dataValues']['media_url'];
                    var extension = fileData[0]['dataValues']['extension'];
                    var width = fileData[0]['dataValues']['width'];
                    var height = fileData[0]['dataValues']['height'];
                    var duration = fileData[0]['dataValues']['duration'];
                    var filePath = fileData[0]['dataValues']['path'];
                    var filePostId = fileData[0]['dataValues']['post_id'];
                    var totalFiles = fileData.length;


                    return new Promise(function (resolveFileObject) {
                        //now checking the filetype
                        if (fileType == 'IMAGE') {

                            //if filetype is IMAGE
                            //fetch images thumb data
                            var smallThumbParameter = config.thumbName.small;
                            var mediumThumbParameter = config.thumbName.medium;
                            var largeThumbParameter = config.thumbName.large;
                            var xLargeThumbParameter = config.thumbName.xlarge;
                            var squareThumbParameter = config.thumbName.square;
                            var originalImageFileParameter = config.thumbName.original;

                            //declaring and initializing variables
                            //for Image File
                            var original = baseUrl + config.path.uploadPath + fileId + '/' + originalImageFileParameter + mediaUrl + extension;
                            var small, medium, large, square, xLarge = "";
                            return tableImagesThumbs.findAll({
                                where: {
                                    $and: [
                                        {
                                            image_id: fileId
                                        },
                                        {
                                            status: 'ACTIVE'
                                        }
                                    ]
                                }
                            })
                                .then(function (thumbData) {
                                    if (thumbData != null) {
                                        //if thumbData is not null
                                        //then iterate on each thumb
                                        //to fetch its properties
                                        var objLength = thumbData.length;
                                        var promiseFor = Promise.method(function (condition, action, value) {
                                            if (!condition(value)) return value;
                                            return action(value).then(promiseFor.bind(null, condition, action));
                                        });
                                        promiseFor(function (counter) {
                                            return counter < objLength;
                                        }, function (counter) {
                                            return new Promise(function (resolveImageThumbLoop) {
                                                if (thumbData[counter].dataValues.sizetype == 'SMALL') {
                                                    small = baseUrl + uploadPath + fileId + '/' + smallThumbParameter + mediaUrl + extension;
                                                }
                                                else if (thumbData[counter].dataValues.sizetype == 'MEDIUM') {
                                                    medium = baseUrl + uploadPath + fileId + '/' + mediumThumbParameter + mediaUrl + extension;
                                                }
                                                else if (thumbData[counter].dataValues.sizetype == 'LARGE') {
                                                    large = baseUrl + uploadPath + fileId + '/' + largeThumbParameter + mediaUrl + extension;
                                                }
                                                else if (thumbData[counter].dataValues.sizetype == 'XLARGE') {
                                                    xLarge = baseUrl + uploadPath + fileId + '/' + xLargeThumbParameter + mediaUrl + extension;
                                                }
                                                else if (thumbData[counter].dataValues.sizetype == 'SQUARE') {
                                                    square = baseUrl + uploadPath + fileId + '/' + squareThumbParameter + mediaUrl + extension;
                                                }
                                                resolveImageThumbLoop(null);
                                            })
                                                .then(function () {
                                                    return ++counter;
                                                });
                                        }, 0)
                                            .then(function () {
                                                //now creating image file object
                                                fileObject = {
                                                    "type": fileType,
                                                    "fileId": fileId,
                                                    "postId": filePostId,
                                                    "views": 0,
                                                    "source": {}
                                                };

                                                if (original) {
                                                    fileObject.source.original = {
                                                        "src": original
                                                    };
                                                }
                                                if (square) {
                                                    fileObject.source.square = {
                                                        "src": square
                                                    };
                                                }
                                                if (small) {
                                                    fileObject.source.small = {
                                                        "src": small
                                                    };
                                                }
                                                if (medium) {
                                                    fileObject.source.medium = {
                                                        "src": medium
                                                    };
                                                }
                                                if (large) {
                                                    fileObject.source.large = {
                                                        "src": large
                                                    };
                                                }
                                                if (xLarge) {
                                                    fileObject.source.xlarge = {
                                                        "src": xLarge
                                                    };
                                                }

                                                resolveFileObject(fileObject);
                                            });
                                    }
                                    else {
                                        resolveFileObject(fileObject);
                                    }
                                })
                        }
                        else if (fileType == 'VIDEO') {

                            //declaring and initializing variables
                            //for video File
                            var sdVideoFilePath = "";
                            var hdVideoFilePath = "";
                            var thumbOne = "";
                            var thumbTwo = "";
                            var videoSDFileParameter = config.thumbName.videoSDDir;
                            var videoHDFileParameter = config.thumbName.videoHDDir;

                            var thumbOneDir = config.thumbName.videoThumbOneDir;
                            var thumbTwoDir = config.thumbName.videoThumbTwoDir;
                            var thumbOneSuffix = config.videoConfig.thumbOneSuffix;
                            var thumbTwoSuffix = config.videoConfig.thumbTwoSuffix;
                            var videoThumbExtension = config.videoConfig.thumbExtension;

                            var viewsCount = 0;

                            return new Promise(function (resolveVideoFile) {
                                return tableImagesThumbs.findAll({
                                    where: {
                                        $and: [
                                            {
                                                image_id: fileId
                                            },
                                            {
                                                status: 'ACTIVE'
                                            }
                                        ]
                                    }
                                })
                                    .then(function (thumbData) {
                                        if (thumbData != null) {
                                            var objLength = thumbData.length;
                                            var promiseFor = Promise.method(function (condition, action, value) {
                                                if (!condition(value)) return value;
                                                return action(value).then(promiseFor.bind(null, condition, action));
                                            });
                                            promiseFor(function (counter) {
                                                return counter < objLength;
                                            }, function (counter) {
                                                return new Promise(function (resolveVideoThumb) {
                                                    if (thumbData[counter].dataValues.sizetype == '_1' || thumbData[counter].dataValues.sizetype == '_2' || thumbData[counter].dataValues.sizetype == '_3' || thumbData[counter].dataValues.sizetype == '_4') {
                                                        thumbOne = baseUrl + uploadPath + fileId + '/' + thumbOneDir + mediaUrl + thumbOneSuffix + videoThumbExtension;
                                                        thumbTwo = baseUrl + uploadPath + fileId + '/' + thumbTwoDir + mediaUrl + thumbTwoSuffix + videoThumbExtension;
                                                    }
                                                    resolveVideoThumb(null);
                                                })
                                                    .then(function () {
                                                        return ++counter;
                                                    });
                                            }, 0)
                                                .then(function () {
                                                    return tableFileCompressions.findAll({
                                                        where: {
                                                            $and: [
                                                                {
                                                                    file_id: fileId
                                                                },
                                                                {
                                                                    status: 'ACTIVE'
                                                                }
                                                            ]
                                                        }
                                                    })
                                                        .then(function (compressFileData) {
                                                            if (compressFileData != null) {
                                                                var objLength = compressFileData.length;
                                                                var promiseFor = Promise.method(function (condition, action, value) {
                                                                    if (!condition(value)) return value;
                                                                    return action(value).then(promiseFor.bind(null, condition, action));
                                                                });
                                                                promiseFor(function (counter) {
                                                                    return counter < objLength;
                                                                }, function (counter) {
                                                                    return new Promise(function (resolveVideoFileLoop) {
                                                                        if (compressFileData[counter].dataValues.sizetype == 'SD') {
                                                                            sdVideoFilePath = baseUrl + uploadPath + fileId + '/' + videoSDFileParameter + mediaUrl + extension;
                                                                        } else if (compressFileData[counter].dataValues.sizetype == 'HD') {
                                                                            hdVideoFilePath = baseUrl + uploadPath + fileId + '/' + videoHDFileParameter + mediaUrl + extension;
                                                                        }
                                                                        resolveVideoFileLoop(null);
                                                                    })
                                                                        .then(function () {
                                                                            return ++counter;
                                                                        });
                                                                }, 0)
                                                                    .then(function () {
                                                                        //fetching count of this file
                                                                        return new Promise(function (resolveViewCount) {
                                                                            return helpers.getVideoViewCount(null, fileId)
                                                                                .then(function (counts) {
                                                                                    if (counts != null) {
                                                                                        viewsCount = counts;
                                                                                        resolveViewCount(viewsCount);
                                                                                    }
                                                                                });
                                                                        })
                                                                            .then(function (viewsCount) {
                                                                                //now creating video file object
                                                                                fileObject = {
                                                                                    "type": fileType,
                                                                                    "fileId": fileId,
                                                                                    "postId": filePostId,
                                                                                    "views": viewsCount,
                                                                                    "source": {},
                                                                                    "thumbs": {
                                                                                        "one": thumbOne,
                                                                                        "two": thumbTwo
                                                                                    }
                                                                                };

                                                                                if (sdVideoFilePath) {
                                                                                    fileObject.source.sd = {
                                                                                        format: 'video/' + config.ffmpegConfig.videoFormat,
                                                                                        src: sdVideoFilePath
                                                                                    };
                                                                                }
                                                                                if (hdVideoFilePath) {
                                                                                    fileObject.source.hd = {
                                                                                        format: 'video/' + config.ffmpegConfig.videoFormat,
                                                                                        src: hdVideoFilePath
                                                                                    };
                                                                                }
                                                                                resolveVideoFile(fileObject);
                                                                            });
                                                                    })
                                                            } else {
                                                                resolveVideoFile(fileObject);
                                                            }

                                                        });
                                                })
                                        } else {
                                            resolveVideoFile(fileObject);
                                        }
                                    });
                            })
                                .then(function (fileObject) {
                                    resolveFileObject(fileObject);
                                })

                        }
                        else if (fileType == 'AUDIO') {
                            var originalAudioFileParameter = config.thumbName.original;
                            var audioFilePath = baseUrl + config.path.uploadPath + fileId + '/' + originalAudioFileParameter + mediaUrl + extension;
                            var listenCount = 0;
                            //fetching count of this file
                            return new Promise(function (resolveListenCount) {
                                return helpers.getAudioListenCount(null, fileId)
                                    .then(function (counts) {
                                        if (counts != null) {
                                            listenCount = counts;
                                            resolveListenCount(listenCount);
                                        }
                                    });
                            })
                                .then(function (listenCount) {
                                    //now creating audio file object
                                    fileObject = {
                                        "type": fileType,
                                        "fileId": fileId,
                                        "postId": filePostId,
                                        "views": listenCount,
                                        "source": {
                                            "format": 'audio/' + config.audioConfig.format,
                                            "source": audioFilePath
                                        }
                                    };
                                    resolveFileObject(fileObject);
                                });
                        }
                    })
                        .then(function (fileObj) {
                            dataArray.push(fileObj);
                            mediaObject.files = dataArray;
                            mediaObject.info = {
                                totalFiles: totalFiles,
                                postLink: null,
                                albumLink: null
                            };
                            resolveMediaObject(mediaObject);
                        });
                } else {
                    resolveMediaObject(mediaObject);
                }
            });
    })
        .then(function (result) {
            //console.log(chalk.yellow('in MEDIA OBJECT - END'));
            return result;
        });
}

//fix media object for 'PROFILE', 'PROFILE_COVER', 'GOAL_COVER'
var getMediaObject_Fix = exports.getMediaObject_Fix = function (image, imageType, sizes) {

    // console.log(chalk.yellow('in fix media - START'));
    // console.log('image', image);
    // console.log('imageType', imageType);
    // console.log('sizes', sizes);
    // console.log(chalk.yellow('in fix media - START'));

    var media = {};

    //if nothing is provided
    if ((image == null ||
        (Object.keys(image).length === 0 && JSON.stringify(image) === JSON.stringify({}))) //check for empty object
        && imageType == null) {
        return {};
    }

    //if image is available
    if (image != null) {
        if (sizes.indexOf('small') > -1 && (typeof image.files[0].source.small != "undefined")) {
            media.small = image.files[0].source.small.src;
        }
        if (sizes.indexOf('medium') > -1 && (typeof image.files[0].source.medium != "undefined")) {
            media.medium = image.files[0].source.medium.src;
        }
        if (sizes.indexOf('large') > -1 && (typeof image.files[0].source.large != "undefined")) {
            media.large = image.files[0].source.large.src;
        }
        if (sizes.indexOf('original') > -1 && (typeof image.files[0].source.original != "undefined")) {
            media.original = image.files[0].source.original.src;
        }
        if (sizes.indexOf('xlarge') > -1 && (typeof image.files[0].source.xlarge != "undefined")) {
            media.xlarge = image.files[0].source.xlarge.src;
        }
    }
    //image is not available, it means DEFAULT image is required
    else {
        //profile picture
        if (imageType == 'PROFILE') {
            if (sizes.indexOf('small') > -1) {
                media.small = config.baseUrl.fileServer + config.path.uploadPath + config.path.defaultFolderPath + config.path.profilePath + config.thumbName.small + config.defaultImages.profile;
            }
            if (sizes.indexOf('medium') > -1) {
                media.medium = config.baseUrl.fileServer + config.path.uploadPath + config.path.defaultFolderPath + config.path.profilePath + config.thumbName.medium + config.defaultImages.profile;
            }
            if (sizes.indexOf('large') > -1) {
                media.large = config.baseUrl.fileServer + config.path.uploadPath + config.path.defaultFolderPath + config.path.profilePath + config.thumbName.large + config.defaultImages.profile;
            }
            if (sizes.indexOf('original') > -1) {
                media.original = config.baseUrl.fileServer + config.path.uploadPath + config.path.defaultFolderPath + config.path.profilePath + config.thumbName.original + config.defaultImages.profile;
            }
        }
        //profile cover
        else if (imageType == 'PROFILE_COVER') {
            if (sizes.indexOf('small') > -1) {
                media.small = config.baseUrl.fileServer + config.path.uploadPath + config.path.defaultFolderPath + config.path.coverPath + config.thumbName.small + config.defaultImages.cover;
            }
            if (sizes.indexOf('medium') > -1) {
                media.medium = config.baseUrl.fileServer + config.path.uploadPath + config.path.defaultFolderPath + config.path.coverPath + config.thumbName.medium + config.defaultImages.cover;
            }
            if (sizes.indexOf('large') > -1) {
                media.large = config.baseUrl.fileServer + config.path.uploadPath + config.path.defaultFolderPath + config.path.coverPath + config.thumbName.large + config.defaultImages.cover;
            }
            if (sizes.indexOf('original') > -1) {
                media.original = config.baseUrl.fileServer + config.path.uploadPath + config.path.defaultFolderPath + config.path.coverPath + config.thumbName.original + config.defaultImages.cover;
            }
        }
        //goal cover image
        else if (imageType == 'GOAL_COVER') {
            if (sizes.indexOf('small') > -1) {
                media.small = config.baseUrl.fileServer + config.path.uploadPath + config.path.defaultFolderPath + config.path.goalFilePath + config.thumbName.small + config.defaultImages.goal;
            }
            if (sizes.indexOf('medium') > -1) {
                media.medium = config.baseUrl.fileServer + config.path.uploadPath + config.path.defaultFolderPath + config.path.goalFilePath + config.thumbName.medium + config.defaultImages.goal;
            }
            if (sizes.indexOf('large') > -1) {
                media.large = config.baseUrl.fileServer + config.path.uploadPath + config.path.defaultFolderPath + config.path.goalFilePath + config.thumbName.large + config.defaultImages.goal;
            }
            if (sizes.indexOf('original') > -1) {
                media.original = config.baseUrl.fileServer + config.path.uploadPath + config.path.defaultFolderPath + config.path.goalFilePath + config.thumbName.original + config.defaultImages.goal;
            }
            if (sizes.indexOf('xlarge') > -1) {
                media.xlarge = config.baseUrl.fileServer + config.path.uploadPath + config.path.defaultFolderPath + config.path.goalFilePath + config.thumbName.xlarge + config.defaultImages.goal;
            }
        }
        else {
            return media;
        }
    }

    return media;
};

exports.getMediaObject_old = function (fileId) {
    var tableUserFileUploads = objAllTables.user_file_uploads.user_file_uploads();
    var tableImagesThumbs = objAllTables.images_thumbs.images_thumbs();
    var tableFileCompressions = objAllTables.file_compressions.file_compressions();
    var mediaObject = [];
    var type = 'otherthanuser';
    var baseUrl = config.baseUrl.fileServer;
    var uploadPath = config.path.uploadPath;
    var smallThumbParameter = config.thumbName.small;
    var mediumThumbParameter = config.thumbName.medium;
    var largeThumbParameter = config.thumbName.large;
    var xLargeThumbParameter = config.thumbName.xlarge;
    var squareThumbParameter = config.thumbName.square;
    var originalFileParameter = config.thumbName.original;
    var videoSDFileParameter = config.thumbName.videoCompressSD;
    var videoHDFileParameter = config.thumbName.videoCompressHD;
    return new Promise(function (Outresolve, Outreject) {
        tableUserFileUploads.findAll({
            where: {
                $and: [
                    {
                        id: fileId
                    },
                    {
                        status: 'ACTIVE'
                    }
                ]
            }
        })
            .then(function (fileData) {
                if (fileData.length > 0) {
                    var parentId = fileData[0]['dataValues']['parent_id'];
                    var albumId = fileData[0]['dataValues']['album_id'];
                    var parentType = fileData[0]['dataValues']['parent_type'];
                    var fileType = fileData[0]['dataValues']['filetype'];
                    var uId = fileData[0]['dataValues']['uid'];
                    var mediaUrl = fileData[0]['dataValues']['media_url'];
                    var extension = fileData[0]['dataValues']['extension'];
                    var width = fileData[0]['dataValues']['width'];
                    var height = fileData[0]['dataValues']['height'];
                    var duration = fileData[0]['dataValues']['duration'];
                    var videoThumbExtension = fileData[0]['dataValues']['videothumbextension'];
                    var filePath = fileData[0]['dataValues']['path'];

                    if (fileType == 'IMAGE') {
                        var original = baseUrl + config.path.uploadPath + fileId + '/' + originalFileParameter + mediaUrl + extension;
                        var small = "";
                        var medium = "";
                        var large = "";
                        var square = "";
                        var xLarge = "";
                        var smallWidth, mediumWidth, largeWidth, xLargeWidth, squareWidth = 0;
                        var smallHeight, mediumHeight, largeHeight, xLargeHeight, squareHeight = 0;

                        return new Promise(function (resolve, Outreject) {
                            return tableImagesThumbs.findAll({
                                where: {
                                    $and: [
                                        {
                                            image_id: fileId
                                        },
                                        {
                                            status: 'ACTIVE'
                                        }
                                    ]
                                }
                            })
                                .then(function (thumbData) {
                                    if (thumbData != null) {
                                        var objLength = thumbData.length;
                                        var promiseFor = Promise.method(function (condition, action, value) {
                                            if (!condition(value)) return value;
                                            return action(value).then(promiseFor.bind(null, condition, action));
                                        });
                                        promiseFor(function (counter) {
                                            return counter < objLength;
                                        }, function (counter) {
                                            return new Promise(function (resolve) {
                                                if (thumbData[counter].dataValues.sizetype == 'SMALL') {
                                                    smallWidth = thumbData[counter].dataValues.width;
                                                    smallHeight = thumbData[counter].dataValues.height;
                                                    small = baseUrl + uploadPath + fileId + '/' + smallThumbParameter + mediaUrl + extension;
                                                }
                                                else if (thumbData[counter].dataValues.sizetype == 'MEDIUM') {
                                                    mediumWidth = thumbData[counter].dataValues.width;
                                                    mediumHeight = thumbData[counter].dataValues.height;
                                                    medium = baseUrl + uploadPath + fileId + '/' + mediumThumbParameter + mediaUrl + extension;
                                                }
                                                else if (thumbData[counter].dataValues.sizetype == 'LARGE') {
                                                    largeWidth = thumbData[counter].dataValues.width;
                                                    largeHeight = thumbData[counter].dataValues.height;
                                                    large = baseUrl + uploadPath + fileId + '/' + largeThumbParameter + mediaUrl + extension;
                                                }
                                                else if (thumbData[counter].dataValues.sizetype == 'XLARGE') {
                                                    xLargeWidth = thumbData[counter].dataValues.width;
                                                    xLargeHeight = thumbData[counter].dataValues.height;
                                                    xLarge = baseUrl + uploadPath + fileId + '/' + xLargeThumbParameter + mediaUrl + extension;
                                                }
                                                else if (thumbData[counter].dataValues.sizetype == 'SQUARE') {
                                                    squareWidth = thumbData[counter].dataValues.width;
                                                    squareHeight = thumbData[counter].dataValues.height;
                                                    square = baseUrl + uploadPath + fileId + '/' + squareThumbParameter + mediaUrl + extension;
                                                }
                                                resolve(null);
                                            })
                                                .then(function () {
                                                    return ++counter;
                                                });
                                        }, 0)
                                            .then(function () {
                                                if (parentType == 'GOAL' || parentType == 'DEFAULTGOAL') {
                                                    type = 'otherthanuser';

                                                    mediaObject = {
                                                        "square": {
                                                            "label": "Square",
                                                            "width": squareWidth,
                                                            "height": squareHeight,
                                                            "source": square
                                                        },
                                                        "small": {
                                                            "label": "Small",
                                                            "width": smallWidth,
                                                            "height": smallHeight,
                                                            "source": small
                                                        },
                                                        "medium": {
                                                            "label": "Medium",
                                                            "width": mediumWidth,
                                                            "height": mediumHeight,
                                                            "source": medium
                                                        },
                                                        "large": {
                                                            "label": "Large",
                                                            "width": largeWidth,
                                                            "height": largeHeight,
                                                            "source": large
                                                        },
                                                        "xlarge": {
                                                            "label": "XLarge",
                                                            "width": xLargeWidth,
                                                            "height": xLargeHeight,
                                                            "source": xLarge
                                                        },
                                                        "original": {
                                                            "label": "Original",
                                                            "width": width,
                                                            "height": height,
                                                            "source": original
                                                        }
                                                    };

                                                }
                                                else if (parentType == 'CONTRIBUTE') {
                                                    type = 'otherthanuser';
                                                    mediaObject = {
                                                        "square": {
                                                            "label": "Square",
                                                            "width": squareWidth,
                                                            "height": squareHeight,
                                                            "source": square
                                                        },
                                                        "small": {
                                                            "label": "Small",
                                                            "width": smallWidth,
                                                            "height": smallHeight,
                                                            "source": small
                                                        },
                                                        "medium": {
                                                            "label": "Medium",
                                                            "width": mediumWidth,
                                                            "height": mediumHeight,
                                                            "source": medium
                                                        },
                                                        "large": {
                                                            "label": "Large",
                                                            "width": largeWidth,
                                                            "height": largeHeight,
                                                            "source": large
                                                        },
                                                        "original": {
                                                            "label": "Original",
                                                            "width": width,
                                                            "height": height,
                                                            "source": original
                                                        }
                                                    };
                                                }
                                                else if (parentType == 'POST') {
                                                    mediaObject = {
                                                        "square": {
                                                            "label": "Square",
                                                            "width": squareWidth,
                                                            "height": squareHeight,
                                                            "source": square
                                                        },
                                                        "small": {
                                                            "label": "Small",
                                                            "width": smallWidth,
                                                            "height": smallHeight,
                                                            "source": small
                                                        },
                                                        "medium": {
                                                            "label": "Medium",
                                                            "width": mediumWidth,
                                                            "height": mediumHeight,
                                                            "source": medium
                                                        },
                                                        "large": {
                                                            "label": "Large",
                                                            "width": largeWidth,
                                                            "height": largeHeight,
                                                            "source": large
                                                        },
                                                        "original": {
                                                            "label": "Original",
                                                            "width": width,
                                                            "height": height,
                                                            "source": original
                                                        }
                                                    };
                                                }
                                                else if (parentType == 'COMMENT') {
                                                    type = 'otherthanuser';
                                                    mediaObject = {
                                                        "square": {
                                                            "label": "Square",
                                                            "width": squareWidth,
                                                            "height": squareHeight,
                                                            "source": square
                                                        },
                                                        "small": {
                                                            "label": "Small",
                                                            "width": smallWidth,
                                                            "height": smallHeight,
                                                            "source": small
                                                        },
                                                        "medium": {
                                                            "label": "Medium",
                                                            "width": mediumWidth,
                                                            "height": mediumHeight,
                                                            "source": medium
                                                        },
                                                        "large": {
                                                            "label": "Large",
                                                            "width": largeWidth,
                                                            "height": largeHeight,
                                                            "source": large
                                                        },
                                                        "original": {
                                                            "label": "Original",
                                                            "width": width,
                                                            "height": height,
                                                            "source": original
                                                        }
                                                    };
                                                }
                                                else if (parentType == 'USERPROFILE' || parentType == 'DEFAULTUSERPROFILE') {
                                                    mediaObject = {
                                                        "square": {
                                                            "label": "Square",
                                                            "width": squareWidth,
                                                            "height": squareHeight,
                                                            "source": square
                                                        },
                                                        "small": {
                                                            "label": "Small",
                                                            "width": smallWidth,
                                                            "height": smallHeight,
                                                            "source": small
                                                        },
                                                        "medium": {
                                                            "label": "Medium",
                                                            "width": mediumWidth,
                                                            "height": mediumHeight,
                                                            "source": medium
                                                        },
                                                        "large": {
                                                            "label": "Large",
                                                            "width": largeWidth,
                                                            "height": largeHeight,
                                                            "source": large
                                                        },
                                                        "original": {
                                                            "label": "Original",
                                                            "width": width,
                                                            "height": height,
                                                            "source": original
                                                        }
                                                    };
                                                }
                                                else if (parentType == 'USERCOVER' || parentType == 'DEFAULTUSERCOVER') {

                                                    mediaObject = {
                                                        "square": {
                                                            "label": "Square",
                                                            "width": squareWidth,
                                                            "height": squareHeight,
                                                            "source": square
                                                        },
                                                        "small": {
                                                            "label": "Small",
                                                            "width": smallWidth,
                                                            "height": smallHeight,
                                                            "source": small
                                                        },
                                                        "medium": {
                                                            "label": "Medium",
                                                            "width": mediumWidth,
                                                            "height": mediumHeight,
                                                            "source": medium
                                                        },
                                                        "large": {
                                                            "label": "Large",
                                                            "width": largeWidth,
                                                            "height": largeHeight,
                                                            "source": large
                                                        },
                                                        "original": {
                                                            "label": "Original",
                                                            "width": width,
                                                            "height": height,
                                                            "source": original
                                                        }
                                                    };
                                                }
                                                else if (parentType == 'CATEGORY') {
                                                    type = 'otherthanuser';

                                                    mediaObject = {
                                                        "square": {
                                                            "label": "Square",
                                                            "width": squareWidth,
                                                            "height": squareHeight,
                                                            "source": square
                                                        },
                                                        "small": {
                                                            "label": "Small",
                                                            "width": smallWidth,
                                                            "height": smallHeight,
                                                            "source": small
                                                        },
                                                        "medium": {
                                                            "label": "Medium",
                                                            "width": mediumWidth,
                                                            "height": mediumHeight,
                                                            "source": medium
                                                        }
                                                    };
                                                }
                                                else if (parentType == 'SUBCATEGORY') {
                                                    type = 'otherthanuser';

                                                    mediaObject = {
                                                        "square": {
                                                            "label": "Square",
                                                            "width": squareWidth,
                                                            "height": squareHeight,
                                                            "source": square
                                                        },
                                                        "small": {
                                                            "label": "Small",
                                                            "width": smallWidth,
                                                            "height": smallHeight,
                                                            "source": small
                                                        },
                                                        "medium": {
                                                            "label": "Medium",
                                                            "width": mediumWidth,
                                                            "height": mediumHeight,
                                                            "source": medium
                                                        }
                                                    };
                                                }
                                                else if (parentType == 'BANNER') {
                                                    type = 'otherthanuser';

                                                    mediaObject = {
                                                        "square": {
                                                            "label": "Square",
                                                            "width": squareWidth,
                                                            "height": squareHeight,
                                                            "source": square
                                                        },
                                                        "medium": {
                                                            "label": "Medium",
                                                            "width": mediumWidth,
                                                            "height": mediumHeight,
                                                            "source": medium
                                                        },
                                                        "large": {
                                                            "label": "Large",
                                                            "width": largeWidth,
                                                            "height": largeHeight,
                                                            "source": large
                                                        }
                                                    };
                                                }
                                                else if (parentType == 'LIBRARY') {
                                                    type = 'otherthanuser';
                                                    if (xLargeWidth > 0 && xLargeHeight > 0) {
                                                        mediaObject = {
                                                            "square": {
                                                                "label": "Square",
                                                                "width": squareWidth,
                                                                "height": squareHeight,
                                                                "source": square
                                                            },
                                                            "small": {
                                                                "label": "Small",
                                                                "width": smallWidth,
                                                                "height": smallHeight,
                                                                "source": small
                                                            },
                                                            "medium": {
                                                                "label": "Medium",
                                                                "width": mediumWidth,
                                                                "height": mediumHeight,
                                                                "source": medium
                                                            },
                                                            "large": {
                                                                "label": "Large",
                                                                "width": largeWidth,
                                                                "height": largeHeight,
                                                                "source": large
                                                            },
                                                            "xlarge": {
                                                                "label": "XLarge",
                                                                "width": xLargeWidth,
                                                                "height": xLargeHeight,
                                                                "source": xLarge
                                                            },
                                                            "original": {
                                                                "label": "Original",
                                                                "width": width,
                                                                "height": height,
                                                                "source": original
                                                            }
                                                        };
                                                    } else {
                                                        mediaObject = {
                                                            "square": {
                                                                "label": "Square",
                                                                "width": squareWidth,
                                                                "height": squareHeight,
                                                                "source": square
                                                            },
                                                            "small": {
                                                                "label": "Small",
                                                                "width": smallWidth,
                                                                "height": smallHeight,
                                                                "source": small
                                                            },
                                                            "medium": {
                                                                "label": "Medium",
                                                                "width": mediumWidth,
                                                                "height": mediumHeight,
                                                                "source": medium
                                                            },
                                                            "large": {
                                                                "label": "Large",
                                                                "width": largeWidth,
                                                                "height": largeHeight,
                                                                "source": large
                                                            },
                                                            "original": {
                                                                "label": "Original",
                                                                "width": width,
                                                                "height": height,
                                                                "source": original
                                                            }
                                                        };
                                                    }

                                                }
                                                resolve(mediaObject);
                                            })
                                    } else {
                                        resolve(mediaObject);
                                    }

                                });
                        })
                            .then(function (mediaObject) {
                                return mediaObject;
                            });
                    }
                    else if (fileType == 'VIDEO') {
                        var sdVideoFilePath = "";
                        var hdVideoFilePath = "";

                        var thumbOne = "";
                        var thumbTwo = "";
                        var thumbThree = "";
                        var thumbFour = "";

                        var thumbOneParameter = config.thumbName.videoThumbOne;
                        var thumbTwoParameter = config.thumbName.videoThumbTwo;
                        var thumbThreeParameter = config.thumbName.videoThumbThree;
                        var thumbFourParameter = config.thumbName.videoThumbFour;
                        var videoThumbExtension = config.videoConfig.thumbExtension;
                        return new Promise(function (resolve, Outreject) {
                            return tableImagesThumbs.findAll({
                                where: {
                                    $and: [
                                        {
                                            image_id: fileId
                                        },
                                        {
                                            status: 'ACTIVE'
                                        }
                                    ]
                                }
                            })
                                .then(function (thumbData) {
                                    if (thumbData != null) {
                                        var objLength = thumbData.length;
                                        var promiseFor = Promise.method(function (condition, action, value) {
                                            if (!condition(value)) return value;
                                            return action(value).then(promiseFor.bind(null, condition, action));
                                        });
                                        promiseFor(function (counter) {
                                            return counter < objLength;
                                        }, function (counter) {
                                            return new Promise(function (resolve) {
                                                if (thumbData[counter].dataValues.sizetype == '_1' || thumbData[counter].dataValues.sizetype == '_2' || thumbData[counter].dataValues.sizetype == '_3' || thumbData[counter].dataValues.sizetype == '_4') {
                                                    thumbOne = baseUrl + uploadPath + fileId + '/' + thumbOneParameter + mediaUrl + videoThumbExtension;
                                                    thumbTwo = baseUrl + uploadPath + fileId + '/' + thumbTwoParameter + mediaUrl + videoThumbExtension;
                                                    thumbThree = baseUrl + uploadPath + fileId + '/' + thumbThreeParameter + mediaUrl + videoThumbExtension;
                                                    thumbFour = baseUrl + uploadPath + fileId + '/' + thumbFourParameter + mediaUrl + videoThumbExtension;
                                                }
                                                resolve(null);
                                            })
                                                .then(function () {
                                                    return ++counter;
                                                });
                                        }, 0)
                                            .then(function () {
                                                return tableFileCompressions.findAll({
                                                    where: {
                                                        $and: [
                                                            {
                                                                file_id: fileId
                                                            },
                                                            {
                                                                status: 'ACTIVE'
                                                            }
                                                        ]
                                                    }
                                                })
                                                    .then(function (compressFileData) {
                                                        if (compressFileData != null) {
                                                            var objLength = compressFileData.length;
                                                            var promiseFor = Promise.method(function (condition, action, value) {
                                                                if (!condition(value)) return value;
                                                                return action(value).then(promiseFor.bind(null, condition, action));
                                                            });
                                                            promiseFor(function (counter) {
                                                                return counter < objLength;
                                                            }, function (counter) {
                                                                return new Promise(function (resolve) {
                                                                    if (compressFileData[counter].dataValues.sizetype == 'SD') {
                                                                        sdVideoFilePath = baseUrl + uploadPath + fileId + '/' + videoSDFileParameter + mediaUrl + extension;
                                                                    } else if (compressFileData[counter].dataValues.sizetype == 'HD') {
                                                                        hdVideoFilePath = baseUrl + uploadPath + fileId + '/' + videoHDFileParameter + mediaUrl + extension;
                                                                    }
                                                                    resolve(null);
                                                                })
                                                                    .then(function () {
                                                                        return ++counter;
                                                                    });
                                                            }, 0)
                                                                .then(function () {
                                                                    //fetching count of this file
                                                                    var viewsCount = 0;
                                                                    helpers.getVideoViewCount(null, fileId)
                                                                        .then(function (counts) {
                                                                            if (counts != null) {
                                                                                viewsCount = counts;
                                                                            }
                                                                        });
                                                                    mediaObject = {
                                                                        "videos": {
                                                                            "SD": {
                                                                                "label": "SD",
                                                                                "length": 12121,
                                                                                "width": 640,
                                                                                "height": 320,
                                                                                "format": 'video/' + config.ffmpegConfig.videoFormat,
                                                                                "source": sdVideoFilePath
                                                                            },
                                                                            "HD": {
                                                                                "label": "HD",
                                                                                "length": 12121,
                                                                                "width": 1280,
                                                                                "height": 720,
                                                                                "format": 'video/' + config.ffmpegConfig.videoFormat,
                                                                                "source": hdVideoFilePath
                                                                            },
                                                                            "screenshots": {
                                                                                "label": "screenshots",
                                                                                "width": 320,
                                                                                "height": 240,
                                                                                "source_1": thumbOne,
                                                                                "source_2": thumbTwo,
                                                                                "source_3": thumbThree,
                                                                                "source_4": thumbFour
                                                                            },
                                                                            "viewsCount": viewsCount
                                                                        }
                                                                    };
                                                                    resolve(mediaObject);
                                                                })
                                                        } else {
                                                            resolve(mediaObject);
                                                        }

                                                    });
                                            })
                                    } else {
                                        resolve(mediaObject);
                                    }

                                });
                        })
                            .then(function (mediaObject) {
                                return mediaObject;
                            });
                    }
                    else if (fileType == 'AUDIO') {
                        var audioFilePath = baseUrl + config.path.uploadPath + fileId + '/' + originalFileParameter + mediaUrl + extension;
                        var listenCount = 0;
                        //fetching count of this file
                        helpers.getAudioListenCount(null, fileId)
                            .then(function (counts) {
                                if (counts != null) {
                                    listenCount = counts;
                                }
                            });
                        mediaObject = {
                            "audio": {
                                "length": duration,
                                "source": audioFilePath,
                                "listenCount": listenCount
                            }
                        };
                    }
                }
                return mediaObject;
            }
            )
            .
            then(function (result) {
                Outresolve(result);
            });
    })
        .then(function (result) {
            return result;
        });
};

//get collage/album object
exports.getPostAlbumObject = function (albumId, imageLimit) {
    var baseUrl = config.baseUrl.fileServer;
    var uploadPath = config.path.uploadPath;
    var filePostId = null;
    var numberOfFiles = 0;
    var postAlbumObject = {
        files: "",
        info: ""
    };
    var dataArray = [];
    var fileObject = {};
    //code for Collages

    return new Promise(function (resolvePostAlbumObj) {
        if (albumId != null) {
            var tableUserFileUploads = objAllTables.user_file_uploads.user_file_uploads();
            var tableImagesThumbs = objAllTables.images_thumbs.images_thumbs();
            var tableFileCompressions = objAllTables.file_compressions.file_compressions();
            return tableUserFileUploads.findAll({
                where: {
                    $and: [
                        {
                            album_id: albumId
                        },
                        {
                            parent_type: 'POST'
                        },
                        {
                            status: 'ACTIVE'
                        }
                    ]
                }
            })
                //generating objects
                .then(function (fileData) {

                    numberOfFiles = fileData.length;
                    var limit = 0;
                    if (numberOfFiles > 0) {
                        if (imageLimit != null) {
                            //here imageLimit is not null so
                            //if imageLimit is greater than fileIds length than
                            //assign fileIds length to limit otherwise limit is equals
                            //to given imageLimit
                            limit = parseInt(imageLimit) > numberOfFiles ? numberOfFiles : imageLimit;
                        } else if (imageLimit == null) {
                            limit = numberOfFiles;
                        }
                        var promiseForFileIds = Promise.method(function (condition, action, value) {
                            if (!condition(value)) return value;
                            return action(value).then(promiseForFileIds.bind(null, condition, action));
                        });

                        promiseForFileIds(function (inc) {
                            return inc < limit
                        }, function (inc) {
                            return new Promise(function (resolveFileIds) {
                                //all fields value
                                //which are fetched from
                                //user_file_uploads table
                                var fileId = fileData[inc]['dataValues']['id'];
                                var parentId = fileData[inc]['dataValues']['parent_id'];
                                var albumId = fileData[inc]['dataValues']['album_id'];
                                var parentType = fileData[inc]['dataValues']['parent_type'];
                                var fileType = fileData[inc]['dataValues']['filetype'];
                                var uId = fileData[inc]['dataValues']['uid'];
                                var mediaUrl = fileData[inc]['dataValues']['media_url'];
                                var extension = fileData[inc]['dataValues']['extension'];
                                var width = fileData[inc]['dataValues']['width'];
                                var height = fileData[inc]['dataValues']['height'];
                                var duration = fileData[inc]['dataValues']['duration'];
                                var filePath = fileData[inc]['dataValues']['path'];
                                filePostId = fileData[inc]['dataValues']['post_id'];
                                //now checking the filetype
                                if (fileType == 'IMAGE') {
                                    //if filetype is IMAGE
                                    //fetch images thumb data
                                    var smallThumbParameter = config.thumbName.small;
                                    var mediumThumbParameter = config.thumbName.medium;
                                    var largeThumbParameter = config.thumbName.large;
                                    var xLargeThumbParameter = config.thumbName.xlarge;
                                    var squareThumbParameter = config.thumbName.square;
                                    var originalImageFileParameter = config.thumbName.original;

                                    //declaring and initializing variables
                                    //for Image File
                                    var original = baseUrl + config.path.uploadPath + fileId + '/' + originalImageFileParameter + mediaUrl + extension;
                                    var small, medium, large, square, xLarge = "";
                                    return tableImagesThumbs.findAll({
                                        where: {
                                            $and: [
                                                {
                                                    image_id: fileId
                                                },
                                                {
                                                    status: 'ACTIVE'
                                                }
                                            ]
                                        }
                                    })
                                        .then(function (thumbData) {
                                            if (thumbData != null) {
                                                //if thumbData is not null
                                                //then iterate on each thumb
                                                //to fetch its properties
                                                var objLength = thumbData.length;
                                                var promiseFor = Promise.method(function (condition, action, value) {
                                                    if (!condition(value)) return value;
                                                    return action(value).then(promiseFor.bind(null, condition, action));
                                                });
                                                promiseFor(function (counter) {
                                                    return counter < objLength;
                                                }, function (counter) {
                                                    return new Promise(function (resolveImageThumbLoop) {
                                                        if (thumbData[counter].dataValues.sizetype == 'SMALL') {
                                                            small = baseUrl + uploadPath + fileId + '/' + smallThumbParameter + mediaUrl + extension;
                                                        }
                                                        else if (thumbData[counter].dataValues.sizetype == 'MEDIUM') {
                                                            medium = baseUrl + uploadPath + fileId + '/' + mediumThumbParameter + mediaUrl + extension;
                                                        }
                                                        else if (thumbData[counter].dataValues.sizetype == 'LARGE') {
                                                            large = baseUrl + uploadPath + fileId + '/' + largeThumbParameter + mediaUrl + extension;
                                                        }
                                                        else if (thumbData[counter].dataValues.sizetype == 'XLARGE') {
                                                            xLarge = baseUrl + uploadPath + fileId + '/' + xLargeThumbParameter + mediaUrl + extension;
                                                        }
                                                        else if (thumbData[counter].dataValues.sizetype == 'SQUARE') {
                                                            square = baseUrl + uploadPath + fileId + '/' + squareThumbParameter + mediaUrl + extension;
                                                        }
                                                        resolveImageThumbLoop(null);
                                                    })
                                                        .then(function () {
                                                            return ++counter;
                                                        });
                                                }, 0)
                                                    .then(function () {
                                                        //then of inner for loop
                                                        //now creating image file object
                                                        if (parentType == 'POST') {
                                                            fileObject = {
                                                                "type": fileType,
                                                                "fileId": fileId,
                                                                "postId": filePostId,
                                                                "views": 0,
                                                                "source": {}
                                                            };

                                                            if (original) {
                                                                fileObject.source.original = {
                                                                    "src": original
                                                                };
                                                            }
                                                            if (square) {
                                                                fileObject.source.square = {
                                                                    "src": square
                                                                };
                                                            }
                                                            if (small) {
                                                                fileObject.source.small = {
                                                                    "src": small
                                                                };
                                                            }
                                                            if (medium) {
                                                                fileObject.source.medium = {
                                                                    "src": medium
                                                                };
                                                            }
                                                            if (large) {
                                                                fileObject.source.large = {
                                                                    "src": large
                                                                };
                                                            }
                                                            if (xLarge) {
                                                                fileObject.source.xlarge = {
                                                                    "src": xLarge
                                                                };
                                                            }
                                                        }
                                                        resolveFileIds(fileObject);
                                                    });
                                            }
                                            else {
                                                resolveFileIds(fileObject);
                                            }
                                        })
                                }
                                else if (fileType == 'VIDEO') {

                                    //declaring and initializing variables
                                    //for video File
                                    var sdVideoFilePath = "";
                                    var hdVideoFilePath = "";
                                    var thumbOne = "";
                                    var thumbTwo = "";
                                    var videoSDFileParameter = config.thumbName.videoSDDir;
                                    var videoHDFileParameter = config.thumbName.videoHDDir;

                                    var thumbOneDir = config.thumbName.videoThumbOneDir;
                                    var thumbTwoDir = config.thumbName.videoThumbTwoDir;
                                    var thumbOneSuffix = config.videoConfig.thumbOneSuffix;
                                    var thumbTwoSuffix = config.videoConfig.thumbTwoSuffix;
                                    var videoThumbExtension = config.videoConfig.thumbExtension;

                                    var viewsCount = 0;

                                    return new Promise(function (resolveVideoFile) {
                                        return tableImagesThumbs.findAll({
                                            where: {
                                                $and: [
                                                    {
                                                        image_id: fileId
                                                    },
                                                    {
                                                        status: 'ACTIVE'
                                                    }
                                                ]
                                            }
                                        })
                                            .then(function (thumbData) {
                                                if (thumbData != null) {
                                                    var objLength = thumbData.length;
                                                    var promiseFor = Promise.method(function (condition, action, value) {
                                                        if (!condition(value)) return value;
                                                        return action(value).then(promiseFor.bind(null, condition, action));
                                                    });
                                                    promiseFor(function (counter) {
                                                        return counter < objLength;
                                                    }, function (counter) {
                                                        return new Promise(function (resolveVideoThumb) {
                                                            if (thumbData[counter].dataValues.sizetype == '_1' || thumbData[counter].dataValues.sizetype == '_2' || thumbData[counter].dataValues.sizetype == '_3' || thumbData[counter].dataValues.sizetype == '_4') {
                                                                thumbOne = baseUrl + uploadPath + fileId + '/' + thumbOneDir + mediaUrl + thumbOneSuffix + videoThumbExtension;
                                                                thumbTwo = baseUrl + uploadPath + fileId + '/' + thumbTwoDir + mediaUrl + thumbTwoSuffix + videoThumbExtension;
                                                            }
                                                            resolveVideoThumb(null);
                                                        })
                                                            .then(function () {
                                                                return ++counter;
                                                            });
                                                    }, 0)
                                                        .then(function () {
                                                            return tableFileCompressions.findAll({
                                                                where: {
                                                                    $and: [
                                                                        {
                                                                            file_id: fileId
                                                                        },
                                                                        {
                                                                            status: 'ACTIVE'
                                                                        }
                                                                    ]
                                                                }
                                                            })
                                                                .then(function (compressFileData) {
                                                                    if (compressFileData != null) {
                                                                        var objLength = compressFileData.length;
                                                                        var promiseFor = Promise.method(function (condition, action, value) {
                                                                            if (!condition(value)) return value;
                                                                            return action(value).then(promiseFor.bind(null, condition, action));
                                                                        });
                                                                        promiseFor(function (counter) {
                                                                            return counter < objLength;
                                                                        }, function (counter) {
                                                                            return new Promise(function (resolveVideoFileLoop) {
                                                                                if (compressFileData[counter].dataValues.sizetype == 'SD') {
                                                                                    sdVideoFilePath = baseUrl + uploadPath + fileId + '/' + videoSDFileParameter + mediaUrl + extension;
                                                                                } else if (compressFileData[counter].dataValues.sizetype == 'HD') {
                                                                                    hdVideoFilePath = baseUrl + uploadPath + fileId + '/' + videoHDFileParameter + mediaUrl + extension;
                                                                                }
                                                                                resolveVideoFileLoop(null);
                                                                            })
                                                                                .then(function () {
                                                                                    return ++counter;
                                                                                });
                                                                        }, 0)
                                                                            .then(function () {
                                                                                //fetching count of this file
                                                                                return new Promise(function (resolveViewCount) {
                                                                                    return helpers.getVideoViewCount(null, fileId)
                                                                                        .then(function (counts) {
                                                                                            if (counts != null) {
                                                                                                viewsCount = counts;
                                                                                                resolveViewCount(viewsCount);
                                                                                            }
                                                                                        });
                                                                                })
                                                                                    .then(function (viewsCount) {
                                                                                        //now creating video file object
                                                                                        fileObject = {
                                                                                            "type": fileType,
                                                                                            "fileId": fileId,
                                                                                            "postId": filePostId,
                                                                                            "views": viewsCount,
                                                                                            "source": {},
                                                                                            "thumbs": {
                                                                                                "one": thumbOne,
                                                                                                "two": thumbTwo
                                                                                            }
                                                                                        };

                                                                                        if (sdVideoFilePath) {
                                                                                            fileObject.source.sd = {
                                                                                                format: 'video/' + config.ffmpegConfig.videoFormat,
                                                                                                src: sdVideoFilePath
                                                                                            };
                                                                                        }
                                                                                        if (hdVideoFilePath) {
                                                                                            fileObject.source.hd = {
                                                                                                format: 'video/' + config.ffmpegConfig.videoFormat,
                                                                                                src: hdVideoFilePath
                                                                                            };
                                                                                        }
                                                                                        resolveVideoFile(fileObject);
                                                                                    });
                                                                            })
                                                                    } else {
                                                                        resolveVideoFile(fileObject);
                                                                    }

                                                                });
                                                        })
                                                } else {
                                                    resolveVideoFile(fileObject);
                                                }
                                            });
                                    })
                                        .then(function (fileObject) {
                                            resolveFileIds(fileObject);
                                        })

                                }
                                else if (fileType == 'AUDIO') {
                                    var originalAudioFileParameter = config.thumbName.original;
                                    var audioFilePath = baseUrl + config.path.uploadPath + fileId + '/' + originalAudioFileParameter + mediaUrl + extension;
                                    var listenCount = 0;
                                    //fetching count of this file
                                    return new Promise(function (resolveListenCount) {
                                        return helpers.getAudioListenCount(null, fileId)
                                            .then(function (counts) {
                                                if (counts != null) {
                                                    listenCount = counts;
                                                    resolveListenCount(listenCount);
                                                }
                                            });
                                    })
                                        .then(function (listenCount) {
                                            //now creating audio file object
                                            fileObject = {
                                                "type": fileType,
                                                "fileId": fileId,
                                                "postId": filePostId,
                                                "views": listenCount,
                                                "source": {
                                                    "format": 'audio/' + config.audioConfig.format,
                                                    "source": audioFilePath
                                                }
                                            };
                                            resolveFileIds(fileObject);
                                        });
                                }
                                else {
                                    resolveFileIds(fileObject);
                                }
                            })
                                .then(function () {
                                    //then of promise
                                    dataArray.push(fileObject);
                                    return ++inc;
                                })

                        }, 0)
                            .then(function () {
                                //then of outer for loop
                                postAlbumObject.files = dataArray;
                                postAlbumObject.info = {
                                    totalFiles: numberOfFiles,
                                    postLink: new Array(config.webURL.domain, 'activity', filePostId).toURL(),
                                    albumLink: new Array(config.webURL.domain, 'album', albumId).toURL(),
                                    post_id: filePostId,
                                    album_id: albumId
                                };
                                resolvePostAlbumObj(postAlbumObject);
                            });
                    }
                    else {
                        resolvePostAlbumObj(postAlbumObject);
                    }
                });
        } else {
            return postAlbumObject;
        }
    })
        //return to calling function
        .then(function (postAlbumObj) {
            return postAlbumObj;
        });

};

//get collage/album object
exports.getPostAlbumObject_old = function (albumId, imageLimit) {

    var tableUserFileUploads = objAllTables.user_file_uploads.user_file_uploads();
    var tableImagesThumbs = objAllTables.images_thumbs.images_thumbs();
    var baseUrl = config.baseUrl.fileServer;
    var uploadPath = config.path.uploadPath;
    var smallThumbParameter = config.thumbName.small;
    var mediumThumbParameter = config.thumbName.medium;
    var largeThumbParameter = config.thumbName.large;
    var xLargeThumbParameter = config.thumbName.xlarge;
    var squareThumbParameter = config.thumbName.square;
    var originalFileParameter = config.thumbName.original;
    if (imageLimit != 'null') {
        //code for Collages
        var mediaObject = {
            "images": [],
            "link": '',
            "totalImages": ''
        };
        var imagesLength = '';
        return new Promise(function (resolvePostAlbumObj) {
            if (albumId != null) {
                var tableUserFileUploads = objAllTables.user_file_uploads.user_file_uploads();
                return tableUserFileUploads.findAll({
                    where: {
                        $and: [
                            {
                                album_id: albumId
                            },
                            {
                                parent_type: 'POST'
                            },
                            {
                                status: 'ACTIVE'
                            }
                        ]
                    }
                })
                    //generating objects
                    .then(function (fileData) {
                        imagesLength = fileData.length;
                        if (imagesLength > 0) {
                            //here if limit is greater than fileIds length than
                            //assign fileIds length to limit other limit is equals
                            //to given imageLimit
                            var limit = parseInt(imageLimit) > imagesLength ? imagesLength : imageLimit;
                            var promiseForFileIds = Promise.method(function (condition, action, value) {
                                if (!condition(value)) return value;
                                return action(value).then(promiseForFileIds.bind(null, condition, action));
                            });

                            promiseForFileIds(function (inc) {
                                return inc < limit
                            }, function (inc) {
                                return new Promise(function (resolveFileIds) {
                                    var fileId = fileData[inc]['dataValues']['id'];
                                    var post_id = fileData[inc]['dataValues']['post_id']; // it is Post id
                                    var albumId = fileData[inc]['dataValues']['album_id'];
                                    var parentType = fileData[inc]['dataValues']['parent_type']; // it is Post
                                    var fileType = fileData[inc]['dataValues']['filetype'];
                                    var uId = fileData[inc]['dataValues']['uid'];
                                    var mediaUrl = fileData[inc]['dataValues']['media_url'];
                                    var extension = fileData[inc]['dataValues']['extension'];
                                    var width = fileData[inc]['dataValues']['width'];
                                    var height = fileData[inc]['dataValues']['height'];
                                    var duration = fileData[inc]['dataValues']['duration'];
                                    var videoThumbExtension = fileData[inc]['dataValues']['videothumbextension'];
                                    var filePath = fileData[inc]['dataValues']['path'];
                                    if (fileType == 'IMAGE') {
                                        var original = baseUrl + config.path.uploadPath + fileId + '/' + originalFileParameter + mediaUrl + extension;
                                        var small = "";
                                        var medium = "";
                                        var large = "";
                                        var square = "";
                                        var xLarge = "";
                                        var smallWidth, mediumWidth, largeWidth, xLargeWidth, squareWidth = 0;
                                        var smallHeight, mediumHeight, largeHeight, xLargeHeight, squareHeight = 0;

                                        return new Promise(function (resolve, Outreject) {
                                            return tableImagesThumbs.findAll({
                                                where: {
                                                    $and: [
                                                        {
                                                            image_id: fileId
                                                        },
                                                        {
                                                            status: 'ACTIVE'
                                                        }
                                                    ]
                                                }
                                            })
                                                .then(function (thumbData) {
                                                    if (thumbData != null) {
                                                        var objLength = thumbData.length;
                                                        var promiseFor = Promise.method(function (condition, action, value) {
                                                            if (!condition(value)) return value;
                                                            return action(value).then(promiseFor.bind(null, condition, action));
                                                        });
                                                        promiseFor(function (counter) {
                                                            return counter < objLength;
                                                        }, function (counter) {
                                                            return new Promise(function (resolve) {
                                                                if (thumbData[counter].dataValues.sizetype == 'SMALL') {
                                                                    smallWidth = thumbData[counter].dataValues.width;
                                                                    smallHeight = thumbData[counter].dataValues.height;
                                                                    small = baseUrl + uploadPath + fileId + '/' + smallThumbParameter + mediaUrl + extension;
                                                                }
                                                                else if (thumbData[counter].dataValues.sizetype == 'MEDIUM') {
                                                                    mediumWidth = thumbData[counter].dataValues.width;
                                                                    mediumHeight = thumbData[counter].dataValues.height;
                                                                    medium = baseUrl + uploadPath + fileId + '/' + mediumThumbParameter + mediaUrl + extension;
                                                                }
                                                                else if (thumbData[counter].dataValues.sizetype == 'LARGE') {
                                                                    largeWidth = thumbData[counter].dataValues.width;
                                                                    largeHeight = thumbData[counter].dataValues.height;
                                                                    large = baseUrl + uploadPath + fileId + '/' + largeThumbParameter + mediaUrl + extension;
                                                                }
                                                                else if (thumbData[counter].dataValues.sizetype == 'SQUARE') {
                                                                    squareWidth = thumbData[counter].dataValues.width;
                                                                    squareHeight = thumbData[counter].dataValues.height;
                                                                    square = baseUrl + uploadPath + fileId + '/' + squareThumbParameter + mediaUrl + extension;
                                                                }
                                                                else if (thumbData[counter].dataValues.sizetype == 'XLARGE') {
                                                                    xLargeWidth = thumbData[counter].dataValues.width;
                                                                    xLargeHeight = thumbData[counter].dataValues.height;
                                                                    xLarge = baseUrl + uploadPath + fileId + '/' + xLargeThumbParameter + mediaUrl + extension;
                                                                }
                                                                resolve(null);
                                                            })
                                                                .then(function () {
                                                                    return ++counter;
                                                                });
                                                        }, 0)
                                                            .then(function () {
                                                                if (parentType == 'POST') {
                                                                    var imageObj = {
                                                                        "small": {
                                                                            "label": "Small",
                                                                            "width": smallWidth,
                                                                            "height": smallHeight,
                                                                            "source": small
                                                                        },
                                                                        "medium": {
                                                                            "label": "Medium",
                                                                            "width": mediumWidth,
                                                                            "height": mediumHeight,
                                                                            "source": medium
                                                                        },
                                                                        "square": {
                                                                            "label": "square",
                                                                            "width": squareWidth,
                                                                            "height": squareHeight,
                                                                            "source": square
                                                                        },
                                                                        "original": {
                                                                            "label": "Original",
                                                                            "width": width,
                                                                            "height": height,
                                                                            "source": original
                                                                        },
                                                                        "link": new Array(config.webURL.domain, 'activity', post_id).toURL()
                                                                    };
                                                                }
                                                                mediaObject['images'].push(imageObj);
                                                                resolve(mediaObject);
                                                            })
                                                    } else {
                                                        resolve(mediaObject);
                                                    }
                                                });
                                        })
                                            .then(function (mediaObject) {
                                                resolveFileIds(mediaObject);
                                            });
                                    }
                                    else {
                                        resolveFileIds(mediaObject);
                                    }
                                })
                                    .then(function () {
                                        //then of promise
                                        return ++inc;
                                    })

                            }, 0)
                                .then(function () {
                                    //then of loop
                                    //mediaObject.link = config.baseUrl.apiServer + "post/album/:albumid";
                                    mediaObject.link = new Array(config.webURL.domain, 'album', albumId).toURL();
                                    mediaObject.totalImages = imagesLength;
                                    resolvePostAlbumObj(mediaObject);
                                });
                        }
                        else {
                            resolvePostAlbumObj(mediaObject);
                        }
                    });
            }
        })
            //return to calling function
            .then(function (postAlbumObj) {
                return postAlbumObj;
            });
    }
    else if (imageLimit == 'null') {
        //code for Albums
        var mediaObject = {
            "images": []
        };
        return new Promise(function (resolvePostAlbumObj) {
            if (albumId != null) {
                return tableUserFileUploads.findAll({
                    where: {
                        $and: [
                            {
                                album_id: albumId
                            },
                            {
                                parent_type: 'POST'
                            },
                            {
                                status: 'ACTIVE'
                            }
                        ]
                    }
                })
                    //generating objects
                    .then(function (fileData) {
                        var imagesLength = fileData.length;
                        if (imagesLength > 0) {
                            var promiseForFileIds = Promise.method(function (condition, action, value) {
                                if (!condition(value)) return value;
                                return action(value).then(promiseForFileIds.bind(null, condition, action));
                            });

                            promiseForFileIds(function (inc) {
                                return inc < imagesLength
                            }, function (inc) {
                                return new Promise(function (resolveFileIds) {
                                    var fileId = fileData[inc]['dataValues']['id'];
                                    var post_id = fileData[inc]['dataValues']['post_id']; // it is Post id
                                    var albumId = fileData[inc]['dataValues']['album_id'];
                                    var parentType = fileData[inc]['dataValues']['parent_type']; // it is Post
                                    var fileType = fileData[inc]['dataValues']['filetype'];
                                    var uId = fileData[inc]['dataValues']['uid'];
                                    var mediaUrl = fileData[inc]['dataValues']['media_url'];
                                    var extension = fileData[inc]['dataValues']['extension'];
                                    var width = fileData[inc]['dataValues']['width'];
                                    var height = fileData[inc]['dataValues']['height'];
                                    var duration = fileData[inc]['dataValues']['duration'];
                                    var videoThumbExtension = fileData[inc]['dataValues']['videothumbextension'];
                                    var filePath = fileData[inc]['dataValues']['path'];
                                    if (fileType == 'IMAGE') {
                                        var original = baseUrl + config.path.uploadPath + fileId + '/' + originalFileParameter + mediaUrl + extension;
                                        var small = "";
                                        var medium = "";
                                        var large = "";
                                        var square = "";
                                        var xLarge = "";
                                        var smallWidth, mediumWidth, largeWidth, xLargeWidth, squareWidth = 0;
                                        var smallHeight, mediumHeight, largeHeight, xLargeHeight, squareHeight = 0;

                                        return new Promise(function (resolve, Outreject) {
                                            return tableImagesThumbs.findAll({
                                                where: {
                                                    $and: [
                                                        {
                                                            image_id: fileId
                                                        },
                                                        {
                                                            status: 'ACTIVE'
                                                        }
                                                    ]
                                                }
                                            })
                                                .then(function (thumbData) {
                                                    if (thumbData != null) {
                                                        var objLength = thumbData.length;
                                                        var promiseFor = Promise.method(function (condition, action, value) {
                                                            if (!condition(value)) return value;
                                                            return action(value).then(promiseFor.bind(null, condition, action));
                                                        });
                                                        promiseFor(function (counter) {
                                                            return counter < objLength;
                                                        }, function (counter) {
                                                            return new Promise(function (resolve) {
                                                                if (thumbData[counter].dataValues.sizetype == 'SMALL') {
                                                                    smallWidth = thumbData[counter].dataValues.width;
                                                                    smallHeight = thumbData[counter].dataValues.height;
                                                                    small = baseUrl + uploadPath + fileId + '/' + smallThumbParameter + mediaUrl + extension;
                                                                }
                                                                else if (thumbData[counter].dataValues.sizetype == 'MEDIUM') {
                                                                    mediumWidth = thumbData[counter].dataValues.width;
                                                                    mediumHeight = thumbData[counter].dataValues.height;
                                                                    medium = baseUrl + uploadPath + fileId + '/' + mediumThumbParameter + mediaUrl + extension;
                                                                }
                                                                else if (thumbData[counter].dataValues.sizetype == 'LARGE') {
                                                                    largeWidth = thumbData[counter].dataValues.width;
                                                                    largeHeight = thumbData[counter].dataValues.height;
                                                                    large = baseUrl + uploadPath + fileId + '/' + largeThumbParameter + mediaUrl + extension;
                                                                }
                                                                else if (thumbData[counter].dataValues.sizetype == 'SQUARE') {
                                                                    squareWidth = thumbData[counter].dataValues.width;
                                                                    squareHeight = thumbData[counter].dataValues.height;
                                                                    square = baseUrl + uploadPath + fileId + '/' + squareThumbParameter + mediaUrl + extension;
                                                                }
                                                                else if (thumbData[counter].dataValues.sizetype == 'XLARGE') {
                                                                    xLargeWidth = thumbData[counter].dataValues.width;
                                                                    xLargeHeight = thumbData[counter].dataValues.height;
                                                                    xLarge = baseUrl + uploadPath + fileId + '/' + xLargeThumbParameter + mediaUrl + extension;
                                                                }
                                                                resolve(null);
                                                            })
                                                                .then(function () {
                                                                    return ++counter;
                                                                });
                                                        }, 0)
                                                            .then(function () {
                                                                if (parentType == 'POST') {
                                                                    var imageObj = {
                                                                        "small": {
                                                                            "label": "Small",
                                                                            "width": smallWidth,
                                                                            "height": smallHeight,
                                                                            "source": small
                                                                        },
                                                                        "medium": {
                                                                            "label": "Medium",
                                                                            "width": mediumWidth,
                                                                            "height": mediumHeight,
                                                                            "source": medium
                                                                        },
                                                                        "square": {
                                                                            "label": "square",
                                                                            "width": squareWidth,
                                                                            "height": squareHeight,
                                                                            "source": square
                                                                        },
                                                                        "original": {
                                                                            "label": "Original",
                                                                            "width": width,
                                                                            "height": height,
                                                                            "source": original
                                                                        },
                                                                        "link": new Array(config.webURL.domain, 'activity', post_id).toURL()
                                                                    };
                                                                }
                                                                mediaObject["images"].push(imageObj);
                                                                resolve(mediaObject);
                                                            })
                                                    } else {
                                                        resolve(mediaObject);
                                                    }
                                                });
                                        })
                                            .then(function (mediaObject) {
                                                resolveFileIds(mediaObject);
                                            });
                                    }
                                    else {
                                        resolveFileIds(mediaObject);
                                    }
                                })
                                    .then(function () {
                                        //then of promise
                                        return ++inc;
                                    })

                            }, 0)
                                .then(function () {
                                    //then of loop
                                    resolvePostAlbumObj(mediaObject);
                                });
                        }
                        else {
                            resolvePostAlbumObj(mediaObject);
                        }
                    });
            }
        })
            //return to calling function
            .then(function (postAlbumObj) {
                return postAlbumObj;
            });
    }
};

exports.getPost = function (id, isComments, sessionId) {

    var input = {
        basic: ['name', 'username', 'email', 'link'],
        profile: ['small', 'medium'],
        // me: ['follower', 'following'],
    };

    var posts = objAllTables.posts.posts();
    var sequelize = db.sequelizeConn();

    return posts.findOne({ where: { id: id, status: 'ACTIVE' } })
        .then(function (post) {
            if (post != null) {
                post = post.dataValues;
                post.link = new Array(config.webURL.domain, 'activity', post.id).toURL();
                // return helpers.getUserMini(post.uid, sessionId, true)
                //     .then(function (user) {
                //         post['user'] = user;
                //         return post;
                //     });
                var _user = new User(post.uid, sessionId);
                return _user.get(input)
                    .then(function (user) {
                        post['user'] = user[0];
                        return post;
                    });

            }
            else {
                new Error('post not found');
            }
        })
        //add media
        .then(function (post) {

            var postMediaType;

            //if post is album, return album
            if (post.post_type == 'ALBUM') {
                return helpers.getPostAlbumObject(post.parent_id, 6)
                    .then(function (album) {

                        post.media = album;
                        post.contentType = "IMAGE";
                        return post;
                    });
            }
            //if post wasn't album
            else {

                var user_file_uploads = objAllTables.user_file_uploads.user_file_uploads();
                return user_file_uploads.findAll({
                    attributes: ['id'],
                    where: {
                        post_id: post.id
                        //parent_type: 'POST'
                    }
                })
                    .then(function (postMedia) {
                        if (postMedia.length > 0) {

                            return helpers.getMediaObject(postMedia[0].dataValues.id)
                                .then(function (media) {

                                    if (media.hasOwnProperty("audio"))
                                        postMediaType = "AUDIO";
                                    else if (media.hasOwnProperty("videos"))
                                        postMediaType = "VIDEO";
                                    else
                                        postMediaType = "IMAGE";

                                    post.contentType = postMediaType;
                                    post.media = media;
                                    return post;
                                });
                        }
                        else {
                            post.contentType = "TEXT";
                            return post;
                        }
                    });
            }
        })
        //Add mentioned List
        .then(function (post) {
            return mentionedUserListPost(id)
                .then(function (list) {
                    post.mentionList = list;
                    return post;
                });
        })
        //add stats
        .then(function (post) {
            var sqlGoalStats = "SELECT  * FROM\
                (SELECT count(*) AS motivations FROM post_motivate gm JOIN posts g ON g.id = gm.post_id WHERE g.id = {0} AND gm. STATUS = 'ACTIVE') AS LIKES ,\
                (SELECT count(*) AS comments FROM comments c JOIN posts g ON g.id = c.parent_id WHERE g.id = {0} AND c.parent_type = 'POST' AND c. STATUS = 'ACTIVE') AS COMMENTS,\
                (SELECT count(*) AS views from views_post where post_id = {0}) AS VIEWS".format(post.id);
            return sequelize.query(sqlGoalStats, { type: sequelize.QueryTypes.SELECT })
                .then(function (postStats) {
                    postStats = postStats[0];
                    post['stats'] = postStats;
                    return post;
                });
        })
        //add me object
        .then(function (post) {
            if (sessionId != -1) {  //it will be "-1" if it is not available
                var sqlPostMe = "SELECT ( SELECT * FROM( SELECT CASE WHEN count(*)> 0 THEN 1 ELSE 0 END AS isMotivatedByMe FROM post_motivate goalM\
                                WHERE goalM.post_id= {0} AND goalM.uid = {1} AND STATUS = 'ACTIVE') AS isMotivatedByMe ) as isMotivated,\
                                (SELECT * FROM( SELECT CASE WHEN count(*)> 0 THEN 1 ELSE 0 END AS isFollowedByme FROM post_followers pf\
                                WHERE pf.post_id = {0} AND pf.uid = {1} AND STATUS = 'ACTIVE') AS isFollowedByme ) as isFollower".format(post.id, sessionId);

                return sequelize.query(sqlPostMe, { type: sequelize.QueryTypes.SELECT })
                    .then(function (postMe) {

                        postMe = postMe[0];
                        post['me'] = postMe;
                        return post;
                    });
            }
            else {
                //return goal;
                return new Promise(function (reject) {
                    reject(post);
                });
            }
        })
        //add comments
        .then(function (post) {

            if (isComments == true) {
                return helpers.getPostComments(post.id, sessionId, 0, 2)
                    .then(function (comments) {
                        if (comments != null) {
                            post.comments = comments;
                            return post;
                        }
                        else {
                            post.comments = [];
                            return post;
                        }
                    });
            }
            else {
                post.comments = [];
                return post;
            }
        })
        //add "fetched url" object if exists
        .then(function (post) {

            if (post.fetched_url_id != null) {

                return helpers.getFetchedUrlData(post.fetched_url_id)
                    .then(function (urlData) {
                        if (urlData != null)
                            post.fetched_url = urlData;
                        else
                            post.fetched_url = {};
                        return post;
                    });
            }
            else {
                post.fetched_url = {};
                return post;
            }
        })
        //add user defined location
        .then(function (post) {
            if (post.user_defined_location_id != null && post.user_defined_location_id != 0) {
                var tableUserDefinedLocation = objAllTables.user_defined_location.user_defined_location();
                return tableUserDefinedLocation.findOne({
                    where: { id: post.user_defined_location_id }
                })
                    .then(function (location) {
                        post.location = location;
                        return post;
                    });
            }
            else {
                post.location = {};
                return post;
            }
        })
        //catch exception
        .catch(function (err) {
            console.log(chalk.red('Error in "helpers.getPost method', err));
            return null;
        });
};

exports.getPosts = function (parentId, type, isUserObject, isContributions, sessionId) {
    console.log('sessionId abc', sessionId);
    var posts = objAllTables.posts.posts();
    return posts.findAll({
        attributes: ['id'],
        where: { parent_id: parentId, status: 'ACTIVE', post_type: type }
    }).then(function (posts) {

        if (posts != null) {
            var POSTS = [];
            var promiseFor = Promise.method(function (condition, action, value) {
                if (!condition(value)) return value;
                return action(value).then(promiseFor.bind(null, condition, action));
            });

            return promiseFor(function (count) {
                return count < posts.length;
            }, function (count) {
                //COMMENTS.push(ids[count]);
                return helpers.getPost(posts[count].dataValues.id, isUserObject, isContributions, sessionId)
                    .then(function (result) {
                        POSTS.push(result);
                        return ++count;

                    })

            }, 0)
                .then(function () {
                    return POSTS;
                });
        }
        else
            return null;
    });
};

exports.getPostComments = function (postId, sessionId, offset, limit) {

    var comments = objAllTables.comments.comments();
    //Check UserBlock in comment
    return comments.findAll({
        where: {
            parent_id: postId, status: 'ACTIVE', $and: [
                sequelize.literal('CheckUserBlocked(uid,{0}) = 0'.format(sessionId))]
        },
        attributes: ['id', 'parent_id', 'uid', 'comment_txt', 'comment_type', 'fetched_url_id', 'file_id', 'created', 'updated'],
        offset: offset, limit: limit,
        order: [['created', 'DESC']]
    }).then(function (comments) {

        comments = comments.reverse();	//reversing array

        var CommentsList = [];
        var promiseFor = Promise.method(function (condition, action, value) {
            if (!condition(value)) return value;
            return action(value).then(promiseFor.bind(null, condition, action));
        });

        return promiseFor(function (count) {
            return count < comments.length;
        }, function (count) {

            return helpers.fixComment(comments[count])
                .then(function (comment) {
                    if (comment != null)
                        CommentsList.push(comment);
                    return ++count;
                })

        }, 0)
            .then(function () {
                return CommentsList;
            });
    });
};

exports.getPostCommentsReplies = function (commentId, sessionId, offset, limit) {

    var postCommentReplies = objAllTables.post_replies.post_replies();
    return postCommentReplies.findAll({
        where: { parent_id: commentId, status: 'ACTIVE' },
        attributes: ['_id', 'parent_id', 'uid', 'reply', 'status', 'created', 'updated'],
        offset: offset, limit: limit
    }).then(function (postCommentReplies) {

        var postCommentRepliesList = [];
        var promiseFor = Promise.method(function (condition, action, value) {
            if (!condition(value)) return value;
            return action(value).then(promiseFor.bind(null, condition, action));
        });

        return promiseFor(function (count) {
            return count < postCommentReplies.length;
        }, function (count) {

            return helpers.fixPostCommentReplies(postCommentReplies[count])
                .then(function (reply) {
                    if (reply != null)
                        postCommentRepliesList.push(reply);
                    return ++count;
                })

        }, 0)
            .then(function () {
                return postCommentRepliesList;
            });
    });
};

exports.fixComment = function (comment) {
    var commentFixed = {};
    commentFixed.id = comment.id;
    //commentFixed.post_id = comment.parent_id;
    commentFixed.comment = comment.comment_txt;
    commentFixed.scope = comment.scope;
    commentFixed.created = comment.created;
    commentFixed.file_id = comment.file_id;     //will be deleted after the media object attachment

    return helpers.getUserMini(comment.uid, null, false)
        .then(function (user) {
            commentFixed.user = user;
        })
        //add media object
        .then(function () {
            if (comment.file_id != null) {
                return helpers.getMediaObject(comment.file_id)
                    .then(function (mediaObj) {
                        commentFixed.image = helpers.getMediaObject_Fix(mediaObj, null, ['small', 'medium']);
                        return commentFixed;
                    });
            }
            else {
                return commentFixed;
            }
        })
        //add fetched url object
        .then(function () {
            if (comment.fetched_url_id != null) {

                return helpers.getFetchedUrlData(comment.fetched_url_id)
                    .then(function (urlData) {
                        if (urlData != null)
                            commentFixed.fetched_url = urlData;
                        else
                            commentFixed.fetched_url = {};
                        return commentFixed;
                    });
            }
            else {
                commentFixed.fetched_url = {};
                return commentFixed;
            }
        })
        //Add Mention List
        .then(function (commentFixed) {
            return mentionedUserListComment(comment.id)
                .then(function (list) {
                    commentFixed.mentionList = list;
                    return commentFixed;
                });
        });
};

exports.fixPostCommentReplies = function (reply) {
    var replyFixed = {};
    replyFixed.id = reply.id;
    replyFixed.reply = reply.reply;
    replyFixed.created = reply.created;

    return helpers.getUserMini(reply.uid, null, false)
        .then(function (user) {
            replyFixed.user = user;
            return replyFixed;

        })
};

exports.getCreatedMilestoneWithPost = function (milestone_id, sessionId) {

    var posts = objAllTables.posts.posts();
    return posts.findOne({ attributes: ['id'], where: { post_type: 'MILESTONE_CREATED', parent_id: milestone_id } })
        .then(function (post_id) {

            var milestone = objAllTables.milestone.milestone();
            return milestone.findOne({
                attributes: ['id', 'uid', 'goal_id', 'text', 'status', 'seq_number', 'created'],
                where: { id: milestone_id, status: { $ne: 'DELETED' } }
            })
                .then(function (MilestoneObj) {

                    if (MilestoneObj != null) {
                        //fixing object
                        var Milestone = {};
                        Milestone.id = MilestoneObj.dataValues.id;
                        Milestone.goal_id = MilestoneObj.dataValues.goal_id;
                        Milestone.text = MilestoneObj.dataValues.text;
                        Milestone.isCompleted = MilestoneObj.dataValues.status == 'COMPLETED';
                        Milestone.status = MilestoneObj.dataValues.status;
                        Milestone.created = MilestoneObj.dataValues.created;

                        //post link
                        Milestone.link = new Array(config.webURL.domain, 'activity', post_id.dataValues.id).toURL();

                        return Milestone;
                    }
                    //milestone not found
                    else
                        return null;
                });
        });

};

exports.getCompletedMilestoneWithPost = function (milestone_id, sessionId) {

    var posts = objAllTables.posts.posts();
    return posts.findOne({ attributes: ['id'], where: { post_type: 'MILESTONE_COMPLETED', parent_id: milestone_id } })
        .then(function (post_id) {

            var milestone = objAllTables.milestone.milestone();
            return milestone.findOne({
                attributes: ['id', 'uid', 'goal_id', 'text', 'status', 'seq_number', 'created'],
                where: { id: milestone_id, status: { $ne: 'DELETED' } }
            })
                .then(function (MilestoneObj) {

                    if (MilestoneObj != null) {
                        //fixing object
                        var Milestone = {};
                        Milestone.id = MilestoneObj.dataValues.id;
                        Milestone.goal_id = MilestoneObj.dataValues.goal_id;
                        Milestone.text = MilestoneObj.dataValues.text;
                        Milestone.isCompleted = MilestoneObj.dataValues.status == 'COMPLETED';
                        Milestone.status = MilestoneObj.dataValues.status;
                        Milestone.created = MilestoneObj.dataValues.created;

                        Milestone.link = new Array(config.webURL.domain, 'activity', post_id.dataValues.id).toURL();

                        return helpers.getPost(post_id.dataValues.id, false, sessionId)
                            .then(function (post) {

                                Milestone.post = post;
                                return Milestone;

                            });
                    }
                    //milestone not found
                    else
                        return null;
                });
        });

};

exports.getContribution = function (id, isComments, sessionId, limitOfReplies) {

    var contribution = objAllTables.contribution.contribution();
    var sequelize = db.sequelizeConn();
    var myQuery = "select c.contribution_id as id,c.contribution_txt as text,\
                            c.contribution_type as type,\
                            c.created as timestamp, c.uid,\
                            file_id as file_id\
                            from contribution c\
                            where c.contribution_id = '{0}' and c.status='ACTIVE'".format(id);
    return sequelize.query(myQuery, { type: sequelize.QueryTypes.SELECT })
        //return contribution.findOne({where: {contribution_id: id, status: 'ACTIVE'}})
        .then(function (Contribution) {
            if (Contribution != null) {
                //fix object
                var uid = Contribution[0].uid;

                //attaching media
                var fileId = Contribution[0].file_id;
                return helpers.getMediaObject(fileId)
                    .then(function (mediaObj) {
                        Contribution[0]['media'] = mediaObj;

                        //attaching user mini profile
                        return helpers.getUserMini(uid, sessionId, true)
                            .then(function (User) {
                                Contribution[0].user = User;
                                return Contribution;
                            });
                    });
            }
            else
                return null;
        })
        .then(function (Contribution) {
            // return Contribution;
            if (Contribution != null) {

                var query = '';
                if (limitOfReplies == null)
                    query = "SELECT _id as id,parent_id,uid,discussion as comment,parent_type,status,created,updated FROM `discussion` where parent_id={0}".format(Contribution[0].id);
                else
                    query = "SELECT _id as id,parent_id,uid,discussion as comment,parent_type,status,created,updated FROM `discussion` where parent_id={0} LIMIT 2".format(Contribution[0].id);
                return sequelize.query(query, { type: sequelize.QueryTypes.SELECT })
                    .then(function (comments) {
                        var promiseFor = Promise.method(function (condition, action, value) {
                            if (!condition(value)) return value;
                            return action(value).then(promiseFor.bind(null, condition, action));
                        });

                        return promiseFor(function (count) {
                            return count < comments.length;
                        }, function (count) {

                            return helpers.getUserMini(comments[count].uid, sessionId, true)
                                .then(function (user) {
                                    comments[count]['user'] = user;
                                    return ++count;
                                })

                        }, 0)
                            .then(function () {
                                //attaching comments
                                Contribution[0]['comments'] = comments
                                return Contribution;
                            });
                    })
            }
            else
                return null;
        });

};

exports.getGoalList = function (IDs, sessionId, getUser) {

    return new Promise(function (resolve, reject) {
        var GOALS = [];
        // loop through the goal ids and get goal objects
        var promiseFor = Promise.method(function (condition, action, value) {
            if (!condition(value)) return value;
            return action(value).then(promiseFor.bind(null, condition, action));
        });

        promiseFor(function (count) {
            return count < IDs.length;
        }, function (count) {
            return helpers.GetGoal(IDs[count], null, sessionId)
                .then(function (Goal) {
                    if (Goal != null)
                        GOALS.push(Goal);
                    return ++count;
                });
        }, 0)
            .then(function () {
                resolve(GOALS);
            }
            );
    });
};

exports.getUserList = function (IDs, sessionId) {

    return new Promise(function (resolve, reject) {
        var USERS = [];
        // loop through the goal ids and get goal objects
        var promiseFor = Promise.method(function (condition, action, value) {
            if (!condition(value)) return value;
            return action(value).then(promiseFor.bind(null, condition, action));
        });

        promiseFor(function (count) {
            return count < IDs.length;
        }, function (count) {
            return helpers.GetUser_ORM(IDs[count], sessionId)
                .then(function (User) {
                    USERS.push(User);
                    return ++count;
                });
        }, 0)
            .then(function () {
                resolve(USERS);
            }
            );
    });
};

exports.getUserListMini = function (IDs, sessionId, isRelationObject) {

    return new Promise(function (resolve, reject) {
        var USERS = [];
        // loop through the goal ids and get goal objects
        var promiseFor = Promise.method(function (condition, action, value) {
            if (!condition(value)) return value;
            return action(value).then(promiseFor.bind(null, condition, action));
        });

        promiseFor(function (count) {
            return count < IDs.length;
        }, function (count) {
            return helpers.getUserMini(IDs[count], sessionId, isRelationObject)
                .then(function (User) {
                    USERS.push(User);
                    return ++count;
                });
        }, 0)
            .then(function () {
                resolve(USERS);
            }
            );
    });
};

exports.generateErrorObject = function (code, field, message) {
    var error = {
        code: code,
        field: field,
        message: message
    };

    return error;
};

exports.insertLocation = function (req) {
    try {
        //var clientIP = req.connection.remoteAddress;
        //clientIP = clientIP.replace('::ffff:', '');

        var clientIP;

        // console.log(chalk.yellow('client IP'));
        // console.log('client IP', req.connection.remoteAddress);

        //check if its not localhost
        if (req.connection.remoteAddress != "::1" && req.connection.remoteAddress != "::ffff:127.0.0.1") {
            clientIP = req.connection.remoteAddress.replace('::ffff:', '');
            //clientIP = req.connection.remoteAddress;
        }
        else {
            //throw new Error('its localhost');
            return new Promise(function (resolve) {
                resolve(null);
            });
        }

        var maxmind = require('maxmind');

        var path = config.maxmind.path;

        maxmind.init(path);
        var locationObj = maxmind.getLocation(clientIP);

        var location = objAllTables.location.location();

        return location.create({
            ip: clientIP,
            countryCode: locationObj.countryCode,
            countryName: locationObj.countryName,
            region: locationObj.region,
            city: locationObj.city,
            postalCode: locationObj.postalCode,
            latitude: locationObj.latitude,
            longitude: locationObj.longitude,
            dmaCode: locationObj.dmaCode,
            areaCode: locationObj.areaCode,
            metroCode: locationObj.metroCode,
            continentCode: locationObj.continentCode,
            regionName: locationObj.regionName
        }).then(function (row) {
            return row.id;
        });
    }
    catch (err) {
        return new Promise(function () {
            return null;
        });
    }
};

exports.insertUserLocation = function (req) {

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
                formatted_address: req.body.userDefinedLocation.formatted_address,
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
            formatted_address: req.body.userDefinedLocation.formatted_address,
            status: 'ACTIVE',
            created: helpers.getUnixTimeStamp(),
            latitude: req.body.userDefinedLocation.latitude,
            longitude: req.body.userDefinedLocation.longitude
        }
    }).spread(function (location, created) {
        return {
            id: location.id,
            street_number: location.street_number,
            route: location.route,
            locality: location.locality,
            administrative_area_level_1: location.administrative_area_level_1,
            country: location.country,
            postal_code: location.postal_code,
            formatted_address: location.formatted_address,
            latitude: req.body.userDefinedLocation.latitude,
            longitude: req.body.userDefinedLocation.longitude
        };
    });
};

exports.getTime = function (UTC_time, timezone) {
    var time = UTC_time + timezone;
    var humanReadable = new Date(time).toISOString();
    var obj = { created: UTC_time, epochTime: time, dateTime: humanReadable };
    return obj;
};

//get "fetched url" object
exports.getFetchedUrlData_old = function (id) {
    if (id != null) {
        var tableFetchedUrlData = objAllTables.fetched_url_data.fetched_url_data();
        var imageObject = {};
        var resultData = {};
        return tableFetchedUrlData.findOne({
            where: { id: id, status: 'ACTIVE' }
        })
            .then(function (data) {
                if (data != null) {
                    if (data.imageName != null) {
                        imageObject = {
                            "medium": {
                                "source": config.baseUrl.fileServer + config.path.downloadPath + data.dataValues.id + '/' + config.thumbName.medium + data.dataValues.imageName + data.dataValues.imageExtension
                            }
                        };
                    }
                    resultData = {
                        id: data.dataValues.id,
                        url: data.dataValues.url,
                        host: data.dataValues.host,
                        scheme: data.dataValues.scheme,
                        title: data.dataValues.title,
                        description: data.dataValues.description,
                        image: imageObject
                    };
                    return resultData;
                } else {
                    return resultData = {};
                }
            }).error(function (err) {
                return resultData = {};
            });
    }
};

exports.getFetchedUrlData_old_2 = function (id) {
    if (id != null) {
        var tableFetchedUrlData = objAllTables.fetched_url_data.fetched_url_data();
        var imageObject = {};
        var thumbObject = {};
        var resultData = {};

        return tableFetchedUrlData.findOne({
            where: {
                $and: [
                    {
                        id: id
                    },
                    {
                        status: 'ACTIVE'
                    }
                ]
            }
        }).then(function (data) {
            if (data != null) {
                if (data.imageName != null) {
                    imageObject = {
                        "medium": {
                            "source": config.baseUrl.fileServer + config.path.downloadPath + data.dataValues.id + '/' + config.thumbName.medium + data.dataValues.imageName + data.dataValues.imageExtension
                        }
                    }
                    thumbObject = config.baseUrl.fileServer + config.path.downloadPath + data.dataValues.id + '/' + config.thumbName.medium + data.dataValues.imageName + data.dataValues.imageExtension;
                }
                resultData = {
                    id: data.dataValues.id,
                    url: data.dataValues.url,
                    host: data.dataValues.host,
                    scheme: data.dataValues.scheme,
                    title: data.dataValues.title,
                    description: data.dataValues.description,
                    image: imageObject,
                    thumb: thumbObject,
                    provider: data.dataValues.provider
                };
                return resultData;
            } else {
                return resultData = {};
            }
        }).error(function (err) {
            return resultData = {};
        });
    }
};

exports.getFetchedUrlData = function (id) {
    if (id != null) {
        var tableFetchedUrlData = objAllTables.fetched_url_data.fetched_url_data();
        var imageObject = {};
        var thumbObject = {};
        var resultData = {};

        return tableFetchedUrlData.findOne({
            where: {
                $and: [
                    {
                        id: id
                    },
                    {
                        status: 'ACTIVE'
                    }
                ]
            }
        }).then(function (data) {
            if (data != null) {
                if (data.imageName != null) {
                    imageObject = {
                        "medium": {
                            "source": config.baseUrl.fileServer + config.path.downloadPath + data.dataValues.id + '/' + config.thumbName.medium + data.dataValues.imageName + data.dataValues.imageExtension
                        }
                    }
                    thumbObject = config.baseUrl.fileServer + config.path.downloadPath + data.dataValues.id + '/' + config.thumbName.medium + data.dataValues.imageName + data.dataValues.imageExtension;
                }
                resultData = {
                    id: data.dataValues.id,
                    url: data.dataValues.url,
                    host: data.dataValues.host,
                    scheme: data.dataValues.scheme,
                    title: data.dataValues.title,
                    description: data.dataValues.description,
                    image: imageObject,
                    thumb: thumbObject,
                    provider: data.dataValues.provider
                };
                return resultData;
            } else {
                return resultData = {};
            }
        }).error(function (err) {
            return resultData = {};
        });
    }
};

//###############################################################
//######################### Reusable ############################
//###############################################################

exports.getTagid = function (tagname) {
    var Tags = objAllTables.tags.tags();
    return Tags.findOrCreate({
        where: {
            tagname: tagname
        },
        defaults: {
            //properties to be created
            category_id: 1,
            tagname: tagname,
            IsSubCategory: 0,
            icon_class: 'tags',
            description: 'new_tags',
            created: helpers.getUnixTimeStamp()
        }
    }).spread(function (tag, created) {
        return tag
    });
};

exports.getHashTag = function getHashTags(text) {
    // duplicates not implemented user array store not implemented
    var regex = /(?:#)([a-zA-Z|_\d]+)/ig; // for tags
    var matches = [];
    var match;
    while ((match = regex.exec(text))) {
        matches.push(match[1]);
    }
    return matches;
};

exports.splitGetHashTag = function (tagsStreams) {
    // split tags from stream and than extract tags from it
    var tags = tagsStreams.split(', ');
    var regex = /(?:#)([a-zA-Z|_\d]+)/ig; // for tags
    var matches = [];
    var match;
    for (var i = 0; i < tags.length; i++) {
        while ((match = regex.exec(tags[i]))) {
            matches.push(match[1]);
        }
    }
    return _.uniqBy(matches);
};

exports.getUserId = function getUserId(text) {
    var regex = /(?:^|[^a-zA-Z0-9_@!@#$%&*])(?:(?:@|@)(?!\/))([a-zA-Z0-9/_]{1,15})(?:\b(?!@|@)|$)/ig; //For username
    var matches = [];
    var match;
    while ((match = regex.exec(text))) {
        matches.push(match[1]);
    }

    return matches;

};

exports.createAlbum = function (uid, name, type, generatedBy, belongsTo) {
    //create album by uid
    //e.g. creates album when user upload multiple images in Creating Post

    var albumTable = objAllTables.album.album();
    return albumTable.create({
        uid: uid,
        name: name,
        type: type,
        gen_by: generatedBy,
        belongs_to: belongsTo
    })
        .then(function (insertedData) {
            if (insertedData != null) {
                return insertedData;
            } else {
                return null;
            }
        })
        .error(function () {
            return null;
        });
};

exports.assignNotifications = function (uid) {

    var time = helpers.getUnixTimeStamp();
    var sqlQuery = "INSERT INTO user_notification_settings (uid,type_id,toast,mobile,email,created)\
                    select {0},id,1,1,1,{1} from default_notification_types ".format(uid, time);

    sequelize.query(sqlQuery)
        .then(function (notifi) {
            return notifi;
        })
        .error(function () {
            return null;
        });

};

exports.assignPermissions = function (uid) {

    var time = helpers.getUnixTimeStamp();
    var sqlQuery = "INSERT INTO user_permission (uid, permission_id, `read`, `create`, `edit`, `delete`)\
                    SELECT {0}, id, `read`, `create`, `edit`, `delete` FROM all_permission;".format(uid);

    sequelize.query(sqlQuery)
        .then(function (perm) {
            return perm;
        })
        .error(function () {
            return null;
        });

};

//fetching goalIdsArray from tag_id not including the provided goal id
exports.getGoalIdFromTags = function (tagId, goalId) {
    //console.log('tagId', tagId);
    var Tags = objAllTables.goals_tags.goals_tags();
    var goalIds = [];
    return Tags.findAll({
        where: {
            tag_id: tagId,
            goal_id: { $ne: goalId },
            status: 'ACTIVE'
        },
    }).then(function (result) {
        if (result[0] != null) {
            for (var i = 0; i < result.length; i++) {
                goalIds.push(result[i].dataValues.goal_id);
            }
            return goalIds;
        } else {
            return goalIds;
        }
    })
};

//returns goal ids which are linked with provided goal id
exports.getLinkedGoalIds = function (goalId) {
    var goal_linked = objAllTables.goal_linked.goal_linked();
    return goal_linked.findAll({ where: { from_goal_id: goalId }, status: 'ACTIVE' })
        .then(function (result) {
            var goal_ids = [];
            if (result != null) {
                for (var i = 0; i < result.length; i++) {
                    goal_ids.push(result[i].dataValues.to_goal_id);
                }
                return goal_ids;
            } else {
                return goal_ids;
            }
        });
};

//#####################################################################
//############################# Session ###############################
//#####################################################################

//generate client-id
exports.generateClientId = function () {
    var nowDate = Date.now();
    return uuid.v1([{ msecs: nowDate }]);
};

//generate client-secret
exports.generateClientSecret = function (id) {
    var uId = id;
    var unixTime = Date.now();
    var value = uId.toString() + unixTime.toString();
    return md5(value);
};

//#####################################################################
//############################ Hashing ################################
//#####################################################################

//function return hashed verification-key
//it will use for both for verification
//and reset of User email / password
//@param = verificationOf (email || password)
exports.getHashedVerificationKey = function (id, verificationOf) {
    return new Promise(function (resolveVerificationKey) {
        //generate hashed verification key
        Utils.generateHashedVerificationKey(id)
            .then(function (hashedVerificationKey) {
                //now if hashedVerificationKey is not null
                //make a check whether is unique in table
                //by checking status of it
                //if unique than return other wise call
                //the getHashedVerificationKey
                if (verificationOf == 'email') {
                    var tableUserEmailVerification = objAllTables.user_email_verification.user_email_verification();
                    tableUserEmailVerification.findAll({
                        where: {
                            verification_key: hashedVerificationKey,
                            status: 'ACTIVE'
                        }
                    }).then(function (findResult) {
                        if (findResult.length > 0) {
                            resolveVerificationKey('generate_again');
                        } else {
                            resolveVerificationKey(hashedVerificationKey);
                        }
                    });
                } else if (verificationOf == 'password') {
                    var tableUserPasswordVerification = objAllTables.user_password_verification.user_password_verification();
                    tableUserPasswordVerification.findAll({
                        where: {
                            verification_key: hashedVerificationKey,
                            status: 'ACTIVE'
                        }
                    }).then(function (findResult) {
                        if (findResult.length > 0) {
                            resolveVerificationKey('generate_again');
                        } else {
                            resolveVerificationKey(hashedVerificationKey);
                        }
                    });
                }
            });
    })
        .then(function (hashedVerificationKey) {
            if (hashedVerificationKey == 'generate_again') {
                //apply recursion here afterwards
                return Utils.generateHashedVerificationKey(id)
                    .then(function (newHashedKey) {
                        return newHashedKey;
                    });
            } else {
                return hashedVerificationKey;
            }
        });
}

//results the album id, of user id and file type provided
exports.getUserDefaultAlbumId = function (uId, fileType) {
    var tableAlbum = objAllTables.album.album();
    return tableAlbum.find({
        where: {
            $and: [
                {
                    uid: uId
                },
                {
                    name: fileType
                },
                {
                    gen_by: 'SYSTEM'
                },
                {
                    belongs_to: 'DEFAULT'
                }
            ]
        }
    }).then(function (albumData) {
        if (albumData != null) {
            if (albumData['dataValues']['id'] > 0) {
                return albumData['dataValues']['id'];
            } else {
                return false;
            }
        } else {
            return false;
        }
    });
};

//#####################################################################
//######################### Stats Counters ############################
//#####################################################################

exports.increment_update_PostStats = function (post_id, actionAt) {
    var model = require('../models');
    var PostStats = model.post_stats;

    return PostStats.findOne({ where: { post_id: post_id } }).then(function (found) {
        if (found != null) {
            return found.increment([actionAt], { by: 1 }).then(function (updated) {
                return updated;
            });
        }
        else {
            var obj = {};
            obj.post_id = post_id;
            if (actionAt == 'posts')
                return PostStats.create({ post_id: post_id }, { fields: ['post_id'] });
            else if (actionAt == 'motivations')
                obj.motivations = 1;
            else if (actionAt == 'comments')
                obj.comments = 1;
            else if (actionAt == 'shares')
                obj.shares = 1;
            else if (actionAt == 'views')
                obj.views = 1;

            return PostStats.create(obj, { fields: ['post_id', actionAt] })
        }
    });
}

exports.decrement_update_PostStats = function (post_id, actionAt) {
    var model = require('../models');
    var PostStats = model.post_stats;
    return PostStats.findOne({ where: { post_id: post_id } }).then(function (found) {
        return found;
    }).then(function (found) {
        if (found != null) {
            return found.decrement([actionAt], { by: 1 }).then(function (updated) {
                return updated;
            });
        }
    });
}

exports.addGoal_ToGoalStats = function (goal_id) {
    var model = require('../models');
    var GoalStats = model.goal_stats;
    return GoalStats.create({ goal_id: goal_id }, { fields: ['goal_id'] });
}

exports.increment_update_GoalStats = function (goal_id, actionAt) {
    var model = require('../models');
    var GoalStats = model.goal_stats;
    return GoalStats.findOne({ where: { goal_id: goal_id } }).then(function (found) {
        if (found != null) {
            return found.increment([actionAt], { by: 1 }).then(function (updated) {
                return updated;
            });
        }
        else {
            var obj = {};
            obj.goal_id = goal_id;
            if (actionAt == 'followers')
                obj.followers = 1;
            else if (actionAt == 'links_forward')
                obj.links_forward = 1;
            else if (actionAt == 'links_backward')
                obj.links_backward = 1;
            else if (actionAt == 'motivations')
                obj.motivations = 1;
            else if (actionAt == 'contributions')
                obj.contributions = 1;
            else if (actionAt == 'milestones')
                obj.milestones = 1;
            else if (actionAt == 'views')
                obj.views = 1;
            return GoalStats.create(obj, { fields: ['goal_id', actionAt] })
        }
    });
}

exports.decrement_update_GoalStats = function (goal_id, actionAt) {
    var model = require('../models');
    var GoalStats = model.goal_stats;
    return GoalStats.findOne({ where: { goal_id: goal_id } }).then(function (found) {
        return found;
    }).then(function (found) {
        if (found != null) {
            return found.decrement([actionAt], { by: 1 }).then(function (updated) {
                return updated;
            });
        }
    });
}

exports.increment_update_UserStats = function (uid, actionAt) {
    var model = require('../models');
    var UserStats = model.user_stats;
    return UserStats.findOne({ where: { uid: uid } }).then(function (found) {
        return found;
    }).then(function (found) {
        if (found != null) {
            return found.increment([actionAt], { by: 1 }).then(function (updated) {
                return updated;
            });
        }
        else {
            var obj = {};
            obj.uid = uid;
            if (actionAt == 'followers')
                obj.followers = 1;
            else if (actionAt == 'followings')
                obj.followings = 1;
            else if (actionAt == 'goals')
                obj.goals = 1;
            else if (actionAt == 'views')
                obj.views = 1;
            else if (actionAt == 'goal_followings')
                obj.goal_followings = 1;

            return UserStats.create(obj, { fields: ['uid', actionAt] }).then(function (insertedStats) {
                return insertedStats;
            });
        }
    });
}

exports.decrement_update_UserStats = function (uid, actionAt) {
    var model = require('../models');
    var UserStats = model.user_stats;
    //var UserStats = objAllTables.user_stats.user_stats();
    return UserStats.findOne({ where: { uid: uid } }).then(function (found) {
        return found;
    }).then(function (found) {
        if (found != null) {
            return found.decrement([actionAt], { by: 1 }).then(function (updated) {
                return updated;
            });
        }
    });
}

//#####################################################################
//######################### User Mention ##############################
//#####################################################################

function mentionedUserListPost(post_id) {

    var query = "SELECT mp.mentioned_uid AS uid, mp.mentioned_name AS `name`, users.username,\
                    /*users.first_name, users.middle_name, users.last_name,*/\
                    CheckPrivacy_Post(mp.mentioned_uid,mp.post_id)AS 'canAccess'\
                    FROM\
                    mentioned_post mp\
                    JOIN users ON mp.mentioned_uid = users.uid\
                    where mp.`status` = 'ACTIVE'\
                    AND mp.post_id = {0}\
                    AND users.`status`='ACTIVE'".format(post_id);

    return sequelize.query(query, { type: sequelize.QueryTypes.SELECT })
        .then(function (mentionIds) {
            return mentionIds;
        });
}

function mentionedUserListComment(comment_id) {

    var query = "SELECT mp.mentioned_uid AS uid, mp.mentioned_name AS `name`, users.username,\
                    /*users.first_name, users.middle_name, users.last_name,*/\
                    CheckPrivacy_Post(mp.mentioned_uid,mp.post_id)AS 'canAccess'\
                    FROM\
                    mentioned_comment mp\
                    JOIN users ON mp.mentioned_uid = users.uid\
                    where mp.`status` = 'ACTIVE'\
                    AND mp.comment_id = {0}\
                    AND users.`status`='ACTIVE'".format(comment_id);

    return sequelize.query(query, { type: sequelize.QueryTypes.SELECT })
        .then(function (mentionIds) {
            return mentionIds;
        });
}

function mentionedUserListReplyComment(reply_id) {

    var query = "SELECT mp.mentioned_uid AS uid, mp.mentioned_name AS `name`, users.username,\
                    /*users.first_name, users.middle_name, users.last_name,*/\
                    CheckPrivacy_Post(mp.mentioned_uid,mp.post_id)AS 'canAccess'\
                    FROM\
                    mentioned_reply_comment mp\
                    JOIN users ON mp.mentioned_uid = users.uid\
                    where mp.`status` = 'ACTIVE'\
                    AND mp.reply_id = {1}\
                    AND users.`status`='ACTIVE'".format(reply_id);

    return sequelize.query(query, { type: sequelize.QueryTypes.SELECT })
        .then(function (mentionIds) {
            return mentionIds;
        });
}
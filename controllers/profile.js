//###############################################################
//######################### Require #############################
//###############################################################

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

var models = require('../models');
var Users = require('../models/User');
var _ = require('lodash');

//###############################################################
//########################### APIs ##############################
//###############################################################

exports.userConnection = function (req, res) {
    var finalObject = {};
    var uId;
    var constraints = {
        "params.username": {
            presence: true
        }
    };

    validate.async(req, constraints).then(success, error);

    function success() {
        helpers.getActiveSession(req)
            .then(function (SessionUser) {

                if (SessionUser.type == 'Recognized' || SessionUser.type == 'UnRecognized') {

                    /*if((!isNaN(req.params.username) && parseInt(req.params.username) == SessionUser.uid)
                     ||req.body.username == SessionUser.username)
                     userId = SessionUser.uid;
                     else{

                     }*/

                    //checking if the username is of session user ouser if uid is of session user
                    var userId = req.params.username;
                    return Utils.getUid(userId).then(function (userid) {

                        if (userid > 0) {
                            //uId = userid;
                            var query = "Select CheckPrivacy_User({0},{1}) as result".format(SessionUser.uid, userid);
                            return sequelize.query(query, { type: sequelize.QueryTypes.SELECT })
                                .then(function (response) {

                                    if (response[0].result == 1) {

                                        var finalObject = {};
                                        var following = {};
                                        var follower = {};
                                        var mutual = {};
                                        var pagination = Utils.pagination(req);

                                        var input = {
                                            basic: ['name', 'username', 'link'],
                                            profile: ['small', 'medium'],
                                            //cover: ['small', 'medium'],
                                            me: ['follower', 'following', 'mute'],
                                            //location: true,
                                            /*stats: {
                                                connections: ['followers', 'followings'],
                                                goals: ['total', 'linked', 'following']
                                            }*/
                                        };

                                        var _user = new User(userid, SessionUser.uid);
                                        _user.pagination = pagination;


                                        _user.stats().then(function (stats) {
                                            follower.count = stats.followers;
                                            following.count = stats.followings;
                                        }).then(function () {
                                            _user.getFollowings(input).then(function (followings) {
                                                following.users = followings;
                                                finalObject.followings = following;
                                            }).then(function (followers) {
                                                _user.getFollowers(input).then(function (followers) {
                                                    follower.users = followers;
                                                    finalObject.followers = follower;
                                                }).then(function () {
                                                    var sqlQueryGetConnections = "SELECT followings.uid\
                                                                    from (SELECT a.follows_uid as uid FROM `user_followers` as a where uid ={0} and status = 'ACTIVE') as followings INNER JOIN\
                                                                    (select uid from user_followers where follows_uid = {1} and status = 'ACTIVE') as followers\
                                                                    on followings.uid = followers.uid".format(SessionUser.uid, userid);
                                                    sequelize.query(sqlQueryGetConnections, { type: sequelize.QueryTypes.SELECT }).then(function (mutuals) {
                                                        var mutualList = _(mutuals).map(function (o) {
                                                            return o.uid;
                                                        }).value();
                                                        return mutualList;
                                                    }).then(function (mutualList) {
                                                        //var _user = new User(mutualList, SessionUser.uid);
                                                        //_user.pagination = pagination;
                                                        User.getList(input, mutualList, SessionUser.uid).then(function (userList) {
                                                            mutual.users = userList;
                                                            finalObject.mutualFollowings = mutual;

                                                            var sqlQueryGetConnections = "SELECT count(followings.uid) as a\
                                                                    from (SELECT a.follows_uid as uid FROM `user_followers` as a where uid ={0} and status = 'ACTIVE') as followings INNER JOIN\
                                                                    (select uid from user_followers where follows_uid = {1} and status = 'ACTIVE') as followers\
                                                                    on followings.uid = followers.uid".format(SessionUser.uid, userid);
                                                            return sequelize.query(sqlQueryGetConnections, { type: sequelize.QueryTypes.SELECT })
                                                                .then(function (connections) {
                                                                    finalObject.mutualFollowings.count = connections[0].a;
                                                                    res.send(200, { meta: { status: 200, message: 'success' }, data: finalObject });
                                                                });
                                                        });
                                                    });
                                                });
                                            });
                                        });
                                    }
                                    //user is blocked
                                    else if (response[0].result == -1) {
                                        res.send(401, { meta: { status: 401, message: 'no access' } });
                                    }
                                    //user is private
                                    else if (response[0].result == 0) {
                                        res.send(401, { meta: { status: 401, message: 'no access' } });
                                    }
                                    //doesn't exist
                                    else if (response[0].result == 404) {
                                        res.send(404, { meta: { status: 404, message: 'not found' } });
                                    }
                                    //unexpected response
                                    else {
                                        res.send(500, { meta: { status: 500, message: 'unexpected response from database code' } });
                                    }
                                });
                        }
                        else {
                            return null;
                        }
                    })

                }
                else {
                    res.send({ meta: { status: 401, message: 'user is not logged or invalid token' } });
                }
            })
            .error(function (err) {
                res.send({ meta: { status: 500, message: err } });
            })
            .catch(function (err) {
                res.send({ meta: { status: 500, message: err } });
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

}

exports.followers = function (req, res) {
    var finalObject = {};
    var constraints = {
        "params.username": {
            presence: true
        }
    };

    validate.async(req, constraints).then(success, error);

    function success() {
        helpers.getActiveSession(req)
            .then(function (SessionUser) {
                if (SessionUser.type == 'Recognized' || SessionUser.type == 'UnRecognized') {
                    var pagination = Utils.pagination(req)
                    var userId = req.params.username;
                    return Utils.getUid(userId).then(function (userid) {
                        if (userid >= 0) {
                            uId = userid;

                            var query = "Select CheckPrivacy_User({0},{1}) as result".format(SessionUser.uid, userid);
                            return sequelize.query(query, { type: sequelize.QueryTypes.SELECT })
                                .then(function (response) {

                                    if (response[0].result == 1) {
                                        var input = {
                                            basic: ['name', 'username', 'link'],
                                            profile: ['small', 'medium'],
                                            me: ['follower', 'following']
                                        };

                                        var _user = new Users(userid, SessionUser.uid);
                                        _user.pagination = pagination;
                                        _user.getFollowers(input).then(function (data) {
                                            return data;
                                        }).then(function (data) {
                                            _user.stats().then(function (stats) {
                                                var dataWithTotalCount = { followers: { count: stats.followers, users: data } };
                                                res.send(200, { meta: { status: 200, message: "success" }, data: dataWithTotalCount });
                                            });
                                        });

                                    }
                                    //user is blocked
                                    else if (response[0].result == -1) {
                                        res.send(401, { meta: { status: 401, message: 'no access' } });
                                    }
                                    //user is private
                                    else if (response[0].result == 0) {
                                        res.send(401, { meta: { status: 401, message: 'no access' } });
                                    }
                                    //doesn't exist
                                    else if (response[0].result == 404) {
                                        res.send(404, { meta: { status: 404, message: 'not found' } });
                                    }
                                    //unexpected response
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
                else {
                    res.send({ meta: { status: 401, message: 'user is not logged or invalid token' } });
                }

            })
            .error(function (err) {
                res.send({ meta: { status: 500, message: err } });
            })
            .catch(function (err) {
                res.send({ meta: { status: 500, message: err } });
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

}

exports.followings = function (req, res) {
    var finalObject = {};
    var constraints = {
        "params.username": {
            presence: true
        }
    };

    validate.async(req, constraints).then(success, error);

    function success() {
        helpers.getActiveSession(req)
            .then(function (SessionUser) {
                if (SessionUser.type == 'Recognized' || SessionUser.type == 'UnRecognized') {

                    var userId = req.params.username;
                    return Utils.getUid(userId).then(function (userid) {
                        if (userid >= 0) {

                            var pagination = Utils.pagination(req);
                            var query = "Select CheckPrivacy_User({0},{1}) as result".format(SessionUser.uid, userid);
                            return sequelize.query(query, { type: sequelize.QueryTypes.SELECT })
                                .then(function (response) {

                                    if (response[0].result == 1) {
                                        var input = {
                                            basic: ['name', 'username', 'link'],
                                            profile: ['small', 'medium'],
                                            me: ['follower', 'following']
                                        };
                                        
                                        var _user = new Users(userid, SessionUser.uid);
                                        _user.pagination = pagination;
                                        _user.getFollowings(input).then(function (data) {
                                            return data;
                                        }).then(function (data) {
                                            _user.stats().then(function (stats) {
                                                var dataWithTotalCount = { followings: { count: stats.followings, users: data } };
                                                res.send(200, { meta: { status: 200, message: "success" }, data: dataWithTotalCount });
                                            });
                                        });
                                    }
                                    //user is blocked
                                    else if (response[0].result == -1) {
                                        res.send(401, { meta: { status: 401, message: 'no access' } });
                                    }
                                    //user is private
                                    else if (response[0].result == 0) {
                                        res.send(401, { meta: { status: 401, message: 'no access' } });
                                    }
                                    //doesn't exist
                                    else if (response[0].result == 404) {
                                        res.send(404, { meta: { status: 404, message: 'not found' } });
                                    }
                                    //unexpected response
                                    else {
                                        res.send(500, { meta: { status: 500, message: 'unexpected response from CheckPrivacy_User() database function' } });
                                    }
                                });
                        }
                        else {
                            res.send(404, { meta: { status: 404, message: 'user does not exists' } });
                        }
                    });
                }
                else {
                    res.send({ meta: { status: 401, message: 'user is not logged or invalid token' } });
                }

            })
            .error(function (err) {
                res.send({ meta: { status: 500, message: err } });
            })
            .catch(function (err) {
                res.send({ meta: { status: 500, message: err } });
            });
    }

    function error(errors) {
        if (errors instanceof Error) {
            // This means an exception was thrown from a validator
            console.err("An error ocurred", errors);
        }
        else {
            res.send({ meta: { status: 401, message: 'validation errors' }, errors: errors });
        }
    }
}

exports.mutual = function (req, res) {
    var finalObject = {};
    var user_profileuid;
    var constraints = {
        "params.username": {
            presence: true
        }
    };

    validate.async(req, constraints).then(success, error);

    function success() {
        helpers.getActiveSession(req)
            .then(function (SessionUser) {
                if (SessionUser.type == 'Recognized' || SessionUser.type == 'UnRecognized') {

                    var userId = req.params.username;
                    return Utils.getUid(userId).then(function (userid) {

                        if (userid == -1) {
                            res.send(404, { meta: { status: 404, message: 'user not found' } });
                            throw new Error('break promise chain');
                        }

                        //assign uid to public variable
                        user_profileuid = userid;

                        var query = "Select CheckPrivacy_User({0},{1}) as a".format(SessionUser.uid, user_profileuid);
                        return sequelize.query(query, { type: sequelize.QueryTypes.SELECT })
                            .then(function (response) {

                                //full access
                                if (response[0].a == 1) {

                                    return user_profileuid;
                                }
                                //user is blocked
                                else if (response[0].result == -1) {
                                    res.send(401, { meta: { status: 401, message: 'no access' } });
                                    throw new Error('break promise chain');
                                }
                                //user is private
                                else if (response[0].result == 0) {
                                    res.send(401, { meta: { status: 401, message: 'no access' } });
                                    throw new Error('break promise chain');
                                }
                                //doesn't exist
                                else if (response[0].result == 404) {
                                    res.send(404, { meta: { status: 404, message: 'not found' } });
                                    throw new Error('break promise chain');
                                }
                                //unexpected response
                                else {
                                    res.send(500, { meta: { status: 500, message: 'unexpted response from CheckPrivacy_User() database function' } });
                                    throw new Error('break promise chain');
                                }
                            });

                    })
                        .then(function (uId) {
                            if (SessionUser.uid != user_profileuid && user_profileuid != -1) {

                                console.log(user_profileuid);
                                var mutualFollowings = {};

                                var pagination = Utils.pagination(req);

                                var sqlQueryGetConnections = "SELECT followings.uid\
                                        from (SELECT a.follows_uid as uid FROM `user_followers` as a where uid ={0} and status = 'ACTIVE') as followings INNER JOIN\
                                        (select uid from user_followers where follows_uid = {1} and status = 'ACTIVE') as followers\
                                        on followings.uid = followers.uid limit {2} offset {3}".format(SessionUser.uid, uId, pagination.limit, pagination.offset);

                                return sequelize.query(sqlQueryGetConnections, { type: sequelize.QueryTypes.SELECT })
                                    .then(function (connections) {
                                        var dataConnection = [];
                                        for (var i = 0; i < connections.length; i++) {
                                            dataConnection.push(connections[i].uid);
                                        }
                                        return helpers.getUserListMini(dataConnection, SessionUser.uid, true)
                                            .then(function (result) {
                                                return result;
                                            })
                                            .then(function (users) {
                                                mutualFollowings.users = users;
                                                finalObject.mutualFollowings = mutualFollowings;
                                                return finalObject;
                                            });

                                    });

                            }
                            else {
                                finalObject.mutualFollowings = {};
                                return finalObject;
                            }
                        })
                        .then(function (finalObject) {
                            if (SessionUser.uid != user_profileuid && user_profileuid != -1) {
                                var sqlQueryGetConnections = "SELECT count(followings.uid) as a\
                                        from (SELECT a.follows_uid as uid FROM `user_followers` as a where uid ={0} and status = 'ACTIVE') as followings INNER JOIN\
                                        (select uid from user_followers where follows_uid = {1} and status = 'ACTIVE') as followers\
                                        on followings.uid = followers.uid".format(SessionUser.uid, user_profileuid);

                                return sequelize.query(sqlQueryGetConnections, { type: sequelize.QueryTypes.SELECT })
                                    .then(function (connections) {
                                        finalObject.mutualFollowings.count = connections[0].a;
                                        res.send(200, { meta: { status: 200, message: "success" }, data: finalObject });
                                    });
                            }
                            else {
                                finalObject.mutualFollowings.users = [];
                                finalObject.mutualFollowings.count = 0;
                                res.send(200, { meta: { status: 200, message: "success" }, data: finalObject });
                            }
                        }).catch(function (err) {
                            //it means reponse has ben sent and exception was thrown intentionally
                            if (err.message == 'break promise chain') {
                                return;
                            }
                            else
                                res.send(500, { meta: { status: 500, message: 'unexpected error' }, details: err });
                        });

                }
                else {
                    res.send({ meta: { status: 401, message: 'user is not logged or invalid token' } });
                }

            })
            .error(function (err) {
                res.send({ meta: { status: 500, message: err } });
            })
            .catch(function (err) {
                res.send({ meta: { status: 500, message: err } });
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

}

exports.basic = function (req, res) {
    helpers.getActiveSession(req)
        .then(function (SessionUser) {
            if (SessionUser.type == 'Recognized') {
                return helpers.getUser_PrivateBasic(SessionUser.uid)
                    .then(function (basicPrivate) {
                        if (basicPrivate != null) {
                            res.send(200, { meta: { status: 200, message: "success" }, data: basicPrivate });
                        }
                        else {
                            res.send(404, { meta: { status: 404, message: 'user does not exists' } });
                        }
                    });
            }
            else {
                res.send({ meta: { status: 401, message: 'user is not logged or invalid token' } });
            }
        });
}
//#############################################################
//##################### Requiring Files #######################
//#############################################################

//npm
var maxmind = require('maxmind');
var path = require('path');
var validate = require("validate.js");
var validator = require('validator');
var Promise = require("bluebird");
var _ = require('lodash');

//others
var clasAllTables = require('../models/alltables');
var helpers = require('../helpers/helpers');
var db = require('../helpers/db');
var helpers = require('../helpers/helpers');
var config = require('../config');
var utils = require('../helpers/Utils');

var models = require('../models');
var Users = require('../models/User');
var Goal = require('../models/Goal');
var Post = require('../models/Post');
//instances
var objAllTables = clasAllTables.allTables;
var sequelize = db.sequelizeConn();

//#############################################################
//########################## APIs #############################
//#############################################################

exports.getPostMotivator_old = function (req, res) {
    var postID = req.params.id;

    helpers.getActiveSession(req)
        .then(function (SessionUser) {
            if (SessionUser.type == 'Recognized' || SessionUser.type == 'UnRecognized') {

                var pagination = utils.pagination(req);

                var postMotivate = objAllTables.post_motivate.post_motivate();

                //fetch uids list
                postMotivate.findAll({ where: { status: 'ACTIVE', post_id: postID }, attributes: ['uid'], offset: pagination.offset, limit: pagination.limit, order: 'created DESC' })
                    .then(function (IDs) {
                        //generate uids array
                        var uids_array = [];
                        for (var i = 0; i < IDs.length; i++)
                            uids_array.push(IDs[i].uid);

                        //get users objects list
                        new Promise(function (resolve) {
                            helpers.getUserList(uids_array, SessionUser.uid).then(function (result) {
                                resolve(result);
                            });
                        }).then(function (users) {
                            res.send(200, { meta: { status: 200, message: 'success' }, data: { users: users } });
                        });
                    });
            }
            else {
                res.send(401, { meta: { status: 401, message: 'invalid token' } });
            }

        }).error(function (err) {
            res.send(500, { meta: { status: 500, message: err } });
        }).catch(function (err) {
            res.send(500, { meta: { status: 500, message: err } });
        });
}

exports.getPostMotivator = function (req, res) {
    var postID = parseInt(req.params.id);

    helpers.getActiveSession(req)
        .then(function (SessionUser) {
            if (SessionUser.type == 'Recognized' || SessionUser.type == 'UnRecognized') {

                var query = "Select CheckPrivacy_Post({0},{1}) as result".format(SessionUser.uid, postID);
                return sequelize.query(query, { type: sequelize.QueryTypes.SELECT }).then(function(result){
                    if(result[0].result == 1){
                        var pagination = utils.pagination(req);

                        var _post = new Post(postID, SessionUser.uid);
                        _post.pagination = {
                            offset: pagination.offset,
                            limit: pagination.limit
                        }
                        var input = {
                            basic: ['name', 'username', 'link'],
                            profile: ['small', 'medium'],
                            me: ['follower', 'following', 'mutual', 'mute'],
                            location: true
                        };                        
                        _post.motivators(input).then(function(data){
                            res.send(200, { meta : { status : 200, message: 'success'}, data : {users: data}});
                        })
                    }
                    else if (result[0].result == -1) {
                        res.send(401, { meta: { status: 401, message: 'no access' } });
                    }
                    else if (result[0].result == 0){
                        res.send(401, { meta: { status: 401, message: 'no access' } });
                    }
                    else if (result[0].result == 404) {
                        res.send(404, { meta: { status: 404, message: 'not found' } });
                    }
                    else {
                        res.send(500, { meta: { status: 500, message: 'unexpted response from CheckPrivacy_User() database function' } });
                    }
                });

            }
            else {
                res.send(401, { meta: { status: 401, message: 'invalid token' } });
            }

        }).error(function (err) {
            res.send(500, { meta: { status: 500, message: err } });
        }).catch(function (err) {
            res.send(500, { meta: { status: 500, message: err } });
        });
}

exports.getGoalMotivator_old = function (req, res) {
    var goalID = req.params.gid;
    helpers.getActiveSession(req)
        .then(function (SessionUser) {

            if (SessionUser.type == 'Recognized' || SessionUser.type == 'UnRecognized') {

                var pagination = utils.pagination(req);
                var goalMotivate = objAllTables.goal_motivate.goal_motivate();

                //fetch uids list
                goalMotivate.findAll({
                    where: { status: 'ACTIVE', goal_id: goalID }, attributes: ['uid'], offset: pagination.offset, limit: pagination.limit
                })
                    .then(function (IDs) {
                        //generate uids array
                        var uids_array = [];
                        for (var i = 0; i < IDs.length; i++)
                            uids_array.push(IDs[i].uid);

                        //get users objects list
                        new Promise(function (resolve) {
                            helpers.getUserList(uids_array, SessionUser.uid).then(function (result) {
                                resolve(result);
                            });
                        })
                            .then(function (users) {
                                res.send({ meta: { status: 200, message: 'success' }, data: { users: users } });
                            });

                    });
            }
            else {
                res.send(401, { meta: { status: 401, message: 'invalid token' } });
            }
        })
        .error(function (err) {
            res.send({ meta: { status: 500, message: err } });
        })
        .catch(function (err) {
            res.send({ meta: { status: 500, message: err } });
        });
}

exports.getGoalMotivator = function (req, res) {
    var goal_id = parseInt(req.params.gid);
    helpers.getActiveSession(req).then(function (SessionUser) {
            if (SessionUser.type == 'Recognized' || SessionUser.type == 'UnRecognized') {

                var query = "Select CheckPrivacy_Goal({0},{1}) as result".format(SessionUser.uid, goal_id);
                return sequelize.query(query, { type: sequelize.QueryTypes.SELECT }).then(function(result){
                    if(result[0].result == 1){
                        var pagination = utils.pagination(req);
                        var Goals = new Goal(goal_id, SessionUser.uid);
                        Goals.pagination = {
                            offset: pagination.offset,
                            limit: pagination.limit
                        }
                        var input = {
                            basic: ['name', 'username', 'link'],
                            profile: ['small', 'medium'],
                            me: ['follower', 'following', 'mutual', 'mute'],
                            location: true
                        };                        
                        Goals.motivators(input).then(function(data){
                            res.send(200, { meta : { status : 200, message: 'success'}, data : {users: data}});
                        })
                    }
                    else if( result[0].result == 0){
                        res.send(401, { meta: { status: 401, message: 'no access' } });
                    }
                    else if (result[0].result == -1){
                        res.send(401, { meta: { status: 401, message: 'no access' } });
                    }
                    else if (result[0].result == 404){
                        res.send(404, { meta: { status: 404, message: 'not found' } });
                    }
                    else{
                        res.send(500, { meta: { status: 500, message: 'unexpted response from CheckPrivacy_User() database function' } });
                    }
                });
            }
            else {
                res.send(401, { meta: { status: 401, message: 'invalid token' } });
            }
        })
        .error(function (err) {
            res.send({ meta: { status: 500, message: err } });
        })
        .catch(function (err) {
            res.send({ meta: { status: 500, message: err } });
        });
}

exports.getGoalContributor = function (req, res) {
    var goalID = req.params.gid;
    helpers.getActiveSession(req).then(function (SessionUser) {

        if (SessionUser.type == 'Recognized' || SessionUser.type == 'UnRecognized') {
            var pagination = utils.pagination(req);

            var sqlQuery = "select DISTINCT posts.uid from posts join goals on posts.parent_id = {0} AND (goals.status='ACTIVE' OR 'COMPLETED') AND post_type = 'contribution' limit {1} offset {2}".format(goalID, pagination.limit, pagination.offset);
            sequelize.query(sqlQuery, { type: sequelize.QueryTypes.SELECT }).then(function (users) {

                var input = {
                    basic: ['name', 'username', 'email', 'link', 'created'],
                    profile: ['small', 'medium'],
                    me: ['follower', 'following', 'mute'],
                };

                var uids = _.uniq(_.map(users, _.iteratee('uid')));

                Users.getList(input, uids, SessionUser.uid).then(function(data) {
                    res.send(200, { meta : { status : 200, message: 'success'}, data : {users: data}});
                });

            });
        }
        else {
            res.send(401, { meta: { status: 401, message: 'invalid token' } });
        }
    }).error(function (err) {
        res.send({ meta: { status: 500, message: err } });
    }).catch(function (err) {
        res.send({ meta: { status: 500, message: err } });
    });
}

exports.getGoalFollowers = function (req, res) {

    helpers.getActiveSession(req).then(function (SessionUser) {
        if (SessionUser.type == 'Recognized' || SessionUser.type == 'UnRecognized') {
            var pagination = utils.pagination(req);
            var goalFollowers = objAllTables.goal_followers.goal_followers();
            var goal_id = parseInt(req.params.gid);
            //fetch uids list
            //goalFollowers.findAll({
            models.goal_followers.findAll({
                where: { status: 'ACTIVE', goal_id: goal_id },
                attributes: [['follower_uid', 'uid']],
                limit: pagination.limit,
                offset: pagination.offset
            }).then(function (users) {
                
                var input = {
                    basic: ['name', 'username', 'email', 'link', 'created'],
                    profile: ['small', 'medium'],
                    me: ['follower', 'following', 'mute'],
                };

                var uids = _.uniq(_.map(users, _.iteratee('uid')));

                Users.getList(input, uids, SessionUser.uid).then(function(data) {
                    res.send(200, { meta : { status : 200, message: 'success'}, data : {users: data}});
                });

            });
        }
        else {
            res.send(401, { meta: { status: 401, message: 'invalid token' } });
        }

    })
    .error(function (err) {
        res.send(500, { meta: { status: 500, message: err } });
    })
    .catch(function (err) {
        res.send(500, { meta: { status: 500, message: err } });
    });
};

exports.getGoalLinkers = function (req, res) {
    
    helpers.getActiveSession(req).then(function (SessionUser) {

        if (SessionUser.type == 'Recognized' || SessionUser.type == 'UnRecognized') {
            var pagination = utils.pagination(req);
            var goalLinker = objAllTables.goal_linked.goal_linked();
            var goal_id = req.params.gid;
            //fetch uids list
            goalLinker.findAll({
                where: { status: 'ACTIVE', to_goal_id: goal_id },
                attributes: ['uid'],
                limit: pagination.limit,
                offset: pagination.offset
            }).then(function (users) {
                var input = {
                    basic: ['name', 'username', 'email', 'link', 'created'],
                    profile: ['small', 'medium'],
                    me: ['follower', 'following', 'mute'],
                };

                var uids = _.uniq(_.map(users, _.iteratee('uid')));

                Users.getList(input, uids, SessionUser.uid).then(function(data) {
                    res.send(200, { meta : { status : 200, message: 'success'}, data : {users: data}});
                });
            });
        } else {
            res.send(401, { meta: { status: 401, message: 'invalid token' } });
        }
        
    })
    .error(function (err) {
        res.send({ meta: { status: 500, message: err } });
    })
    .catch(function (err) {
        res.send({ meta: { status: 500, message: err } });
    });
};

exports.getGoalMute = function (req, res) {

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

    helpers.getActiveSession(req).then(function (SessionUser) {
        if (SessionUser.type == 'Recognized') {
            var pagination = utils.pagination(req);

            var goal_mute = objAllTables.goal_mute.goal_mute();
            goal_mute.findAll({
                where: { status: 'ACTIVE', uid: SessionUser.uid },
                attributes: ['goal_id'],
                limit: pagination.limit,
                offset: pagination.offset
            })
            .then(function (goals) {
                var goal_ids = _.uniq(_.map(goals, _.iteratee('goal_id')));
                Goal.getList(goalInput, goal_ids , SessionUser.uid ).then(function(data){
                    res.send({ meta: { status: 200, message: 'success' }, data: { goals: data } })
                })
            });
        }
        else {
            res.send(401, { meta: { status: 401, message: 'invalid token' } });
        }
    })
    .error(function (err) {
        res.send({ meta: { status: 500, message: err } });
    })
    .catch(function (err) {
        res.send({ meta: { status: 500, message: err } });
    });
};

exports.getUserBlock = function (req, res) {
    helpers.getActiveSession(req).then(function (SessionUser) {

        if (SessionUser.type == 'Recognized') {

            var pagination = utils.pagination(req);

            var user_block = objAllTables.user_block.user_block();
            user_block.findAll({ where: { status: 'ACTIVE', uid: SessionUser.uid }, attributes: [['blocked_uid','uid']], limit: pagination.limit, offset: pagination.offset })
                .then(function (users) {
                    var uids = _.uniq(_.map(users, _.iteratee('uid')));

                    var input = {
                        basic: ['name', 'username', 'email', 'link', 'created'],
                        profile: ['small', 'medium']
                    };

                    Users.getList(input, uids, SessionUser.uid).then(function(data) {
                        res.send(200, { meta : { status : 200, message: 'success'}, data : {users: data}});
                    });
                });
        }
        else {
            res.send(401, { meta: { status: 401, message: 'Unauthorized' } });
        }
    })
    .error(function (err) {
        res.send(500, { meta: { status: 500, message: 'unknown error - error' }, details: err });
    })
    .catch(function (err) {
        res.send(500, { meta: { status: 500, message: 'unknown error - catch' }, details: err });
    });
};

exports.getUserMute = function (req, res) {
    helpers.getActiveSession(req).then(function (SessionUser) {

        if (SessionUser.type == 'Recognized') {

            var pagination = utils.pagination(req);

            var user_mute = objAllTables.user_mute.user_mute();
            user_mute.findAll({ 
                where: { status: 'ACTIVE', uid: SessionUser.uid }, 
                attributes: [['mute_uid', 'uid']], 
                limit: pagination.limit, offset: pagination.offset 
            }).then(function (users) {
                var input = {
                    basic: ['name', 'username', 'email', 'link', 'created'],
                    profile: ['small', 'medium'],
                    cover: ['small', 'medium'],
                    me: ['follower', 'following', 'mutual', 'mute'],
                    location: true,
                    stats: {
                        connections: ['followers', 'followings'],
                        goals: ['total', 'linked', 'following']
                    }
                };

                var uids = _.uniq(_.map(users, _.iteratee('uid')));

                Users.getList(input, uids, SessionUser.uid).then(function(data) {
                    res.send(200, { meta : { status : 200, message: 'success'}, data : {users: data}});
                });

            });
        } else {
            res.send(401, { meta: { status: 401, message: 'Unauthorized' } });
        }
    })
    .error(function (err) {
        res.send(500, { meta: { status: 500, message: 'unknown error - error' }, details: err });
    })
    .catch(function (err) {
        res.send(500, { meta: { status: 500, message: 'unknown error - catch' }, details: err });
    });
};
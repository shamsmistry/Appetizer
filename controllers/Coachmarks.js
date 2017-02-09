//import modules
var clasAllTables = require('../models/alltables');
var Promise = require("bluebird");
var helpers = require('../helpers/helpers');
var validator = require('validator');
var url = require('url');
var db = require('../helpers/db');

//instances
var objAllTables = clasAllTables.allTables;

//#############################################################
//###################### APIs (Start)  ########################
//#############################################################

exports.index_1_0 = function (req, res) {
    helpers.getActiveSession(req).then(function(SessionUser) {
        if (SessionUser.type == 'Recognized') {
            
            var data = {};
            
            var queryObject = url.parse(req.url, true).query;
            var offset = 0;
            var limit = 10;
            
            if (queryObject.hasOwnProperty('offset')) { offset = queryObject.offset; }
            if (queryObject.hasOwnProperty('limit')) { limit = queryObject.limit; }
            
            var Coachmarks = objAllTables.CoachmarksModel.Coachmarks();
            var UsersCoachmarks = objAllTables.UsersCoachmarksModel.UsersCoachmarks();
                        
            return Coachmarks.findAll({
                order: '_id DESC', attributes: ['_id', 'name', 'description', 'type', 'button'],
                offset: offset, limit: limit
            })
            .then(function (coachmarks) {
                return coachmarks;
            })
            .then(function (data) {
                if (data.length == 0) { data = false; }
                res.send(200, { meta: { status: 200, message: 'success' }, data: data });
            });
        } else {
            res.send(401, { meta: { status: 401, message: 'user is not logged in or invalid token' } });
        }
    })
    .error(function (err) {
        res.send(500, { meta: { status: 500, message: 'Internal Error' }, errors: err });
    });
}

/* For creating  Coachmarks */
exports.create_1_0 = function (req, res) {
    var Coachmarks = objAllTables.CoachmarksModel.Coachmarks();
    
    var coachmark = {
        name: req.body.name,
        description: req.body.description,
        type: req.body.type,
        button: req.body.button,
        created: helpers.getUnixTimeStamp()
    };
    
    Coachmarks.create(coachmark)
    .then(function (coachmark) {
        res.send(200, { meta: { status: 200, message: 'success' }, data: coachmark });
    })
    .error(function (err) {
        res.send(500, { meta: { status: 500, message: 'Internal Error' }, errors: err });
    });
}

/* For creating  Users Coachmarks */
exports.gotIt_1_0 = function (req, res) {

    helpers.getActiveSession(req).then(function(SessionUser) {
        if (SessionUser.type == 'Recognized') {
            var UsersCoachmarks = objAllTables.UsersCoachmarksModel.UsersCoachmarks();
            var Coachmarks = objAllTables.CoachmarksModel.Coachmarks();
            var cm_id = parseInt(req.params.id);
            var uid = SessionUser.uid;
            var sequelize = db.sequelizeConn();
            var data = {};
            
            var userscoachmark = {
                coachmark_id: cm_id,
                uid: uid,
            }
            
            return Coachmarks.findAndCountAll({
                where: { _id: userscoachmark.coachmark_id }
            })
            .then(function (result) {
                if (result.count == 1) {
                    return UsersCoachmarks.findAndCountAll({
                        where: { coachmark_id: userscoachmark.coachmark_id, uid: userscoachmark.uid }
                    })
                    .then(function (result) {
                        
                        if (result.count == 0) {
                            UsersCoachmarks.create({ coachmark_id: userscoachmark.coachmark_id, uid: userscoachmark.uid, created_at: new Date() })
                            .then(function (coachmark) {
                                res.send(200, { meta: { status: 200, message: 'success' }, data: coachmark });
                            })
                            .error(function (err) {
                                res.send(500, { meta: { status: 500, message: 'Internal Error' }, errors: err });
                            });
                        } else {
                            res.send(401, { meta: { status: 401, message: 'Already exist' } });
                        }
                    });
                } 
                else {
                    res.send(401, { meta: { status: 401, message: 'Coachmark doesnt exist' } });
                }
            })
            .error(function (err) {
                res.send(500, { meta: { status: 500, message: 'unknown error' }, details: err });
            });
        }
        else {
            res.send(401, { meta: { status: 401, message: 'Unauthorized' } });
        }
    })
}

/* For Showing coachmarks by Uid */
exports.my_1_0 = function (req, res) {
    helpers.getActiveSession(req).then(function(SessionUser) {
        if (SessionUser.type == 'Recognized') {
            
            var sequelize = db.sequelizeConn();
            var data = {};
            var uid = SessionUser.uid;
            
            var sqlQueryGetUserByToken = "select _id, (select count(*) from users_coachmarks where uid = {0} and users_coachmarks. coachmark_id = coachmarks._id ) as seen, name, description, type, button from coachmarks".format(uid);
            
            //return Promise
            return sequelize.query(sqlQueryGetUserByToken, { type: sequelize.QueryTypes.SELECT })
            .then(function (coachmarks) {
                res.send(200, { meta: { status: 200, message: 'OK' }, data: coachmarks });
            })
            .error(function (err) {
                res.send(500, { meta: { status: 500, message: 'unknown error' }, details: err });
            });
        }
        else {
            res.send(401, { meta: { status: 401, message: 'user is not logged in or invalid token' } });
        }
    });
}

/* For showing Coachmark by coachmark id*/
exports.show_1_0 = function (req, res) {
    helpers.getActiveSession(req).then(function(SessionUser) {
        if (SessionUser.type == 'Recognized') {
            
            var data = {};
            var queryObject = url.parse(req.url, true).query;
            var offset = 0;
            var limit = 10;
            
            if (queryObject.hasOwnProperty('offset')) { offset = queryObject.offset; }
            if (queryObject.hasOwnProperty('limit')) { limit = queryObject.limit; }
            
            var Coachmarks = objAllTables.CoachmarksModel.Coachmarks();
                        
            return Coachmarks.findAll({
                order: '_id DESC', attributes: ['_id', 'name', 'description', 'type', 'button'],
                offset: offset, limit: limit, where : { _id: req.params.id }
            }).then(function (coachmarks) {
                return coachmarks;
            }).then(function (data) {
                if (data.length == 0) { data = false; }
                res.send({ meta: { status: 200, message: 'success' }, data: data });
            });

        } 
        else {
            res.send(401, { meta: { status: 401, message: 'user is not logged in or invalid token' } });
        }
    })
    .error(function (err) {
        res.send(500, { meta: { status: 500, message: 'Internal Error' }, errors: err });
    });
}

/* To edit Coachmark */
exports.update_1_0 = function (req, res) {

    var Coachmarks = objAllTables.CoachmarksModel.Coachmarks();
    var offset = 0;
    var limit = 1;    
        
    var coachmark = {
        name: req.body.name,
        description: req.body.description,
        type: req.body.type,
        button: req.body.button
    };
    
    Coachmarks.update(coachmark
                        , { where: { _id : req.params.id } })
    .then(function (affectedRows) {
        res.send(200, { meta: { status: 200, message: 'success' } });
    })
    .error(function (err) {
        res.send(500, { meta: { status: 500, message: 'Internal Error' }, errors: err });
    });
}

/* To deleting a Coachmark */
exports.destroy_1_0 = function (req, res) {
    var Coachmarks = objAllTables.CoachmarksModel.Coachmarks();
    
    return Coachmarks.destroy({ where: { _id: req.params.id } })    
    .then(function () {
        res.send(200, { meta: { status: 200, message: 'success' } });
    })
    .error(function (err) {
        res.send(500, { meta: { status: 500, message: 'Internal Error' }, errors: err });
    });
}
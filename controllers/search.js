var configFile = require('../config');
var clasAllTables = require('../models/alltables');
var Promise = require("bluebird");
var helpers = require('../helpers/helpers');
var validator = require('validator');
var db = require('../helpers/db');
var sequelize = db.sequelizeConn();
var config = require('../config');
var searchController = require('../controllers/search');
var utils = require('../helpers/Utils');
var Goal = require('../models/Goal');
var User = require('../models/User');
var _ = require('lodash');


//#####################################################################
//############################### APIs ################################
//#####################################################################

exports.searchTags = function (req, res) {
    
    helpers.getActiveSession(req)
        .then(function (sessionUser) {
        
        if (sessionUser.type == 'Recognized' || sessionUser.type == 'UnRecognized') {
            var queryKeyword = req.query.q || '';
            
            // if(queryKeyword.charAt(0) == '%23' || queryKeyword.charAt(0) == '#')
            //         queryKeyword = queryKeyword.substr(1);

            queryKeyword = queryKeyword.trimSpace().makeSQLInjectionSafe();
            var pagination = utils.pagination(req);
            
            if (queryKeyword != null) {
                
                var MainTags = clasAllTables.allTables.tags.tags();
                return MainTags.findAll({
                    offset : pagination.offset, limit: pagination.limit,
                    attributes: ['tag_id', 'tagname', 'default_color'].concat([
                        [
                            sequelize.literal('(SELECT COUNT(`user_interest_tags`.`tag_id`) FROM `user_interest_tags` WHERE `user_interest_tags`.`tag_id` = `tags`.`tag_id` AND user_interest_tags.uid = {0})'.format(sessionUser.uid)),
                            'isMyInterest'
                        ]
                    ]), where : { tagname: { like: '%' + queryKeyword + '%' } }
                })
                .then(function (tags) {
                        res.send({ meta: { status: 200 }, message: "success", data: tags });
                        //res.send({ meta: { status: 200 }, message: "success", data: { tags: tags, goals: [], users: [] }});
                })
                .error(function (err) {
                    res.send(500, { meta: { status: 500, message: 'unexpected error' } });
                });
            }
            else {
                res.send(401, { meta: { status: 401, message: 'invalid token' } });
            }
        }
        else {
            res.send(401, { meta: { status: 401, message: 'User is not logged in or invalid token' } });
        }
    })
   .error(function (err) {
        res.send(500, { meta: { status: 500, message: 'unexpected error' } });
    });
};

exports.searchGoals = function (req, res) {
    
    helpers.getActiveSession(req)
        .then(function (sessionUser) {
        
        if (sessionUser.type == 'Recognized' || sessionUser.type == 'UnRecognized') {
            
            var queryKeyword = req.query.q || '';
            queryKeyword = queryKeyword.trimSpace().makeSQLInjectionSafe();
            var pagination = utils.pagination(req);
            
            if (queryKeyword != null) {
                searchController.searchGoalsWithQuery(sessionUser, queryKeyword, pagination.limit, pagination.offset)
                .then(function (goals) {

                    res.send(200, { meta: { status: 200 }, message: "success", data: goals });
                            
                }).error(function (err) {
                    res.send(500, { meta: { status: 500, message: 'unexpected error' } });
                });
            }
            else {
                res.send(400, { meta: { status: 400, message: 'keyword required to be search for' } });
            }
        }
        else {
            res.send(401, { meta: { status: 401, message: 'User is not logged in or invalid token' } });
        }
    })
   .error(function (err) {
        res.send(500, { meta: { status: 500, message: 'unexpected error' } });
    });
};

exports.searchUsers = function (req, res) {
    
    helpers.getActiveSession(req)
        .then(function (sessionUser) {
        
        if (sessionUser.type == 'Recognized' || sessionUser.type == 'UnRecognized') {
            
            var queryKeyword = req.query.q || '';
            // if(queryKeyword.charAt(0) == '%40' || queryKeyword.charAt(0) == '@')
            //     queryKeyword = queryKeyword.substr(1);

            queryKeyword = queryKeyword.trimSpace().makeSQLInjectionSafe();
            var pagination = utils.pagination(req);
            
            if (queryKeyword != null) {
                searchController.searchUsersWithQuery(sessionUser, queryKeyword, pagination.limit, pagination.offset)
                .then(function (users) {
                      res.send({ meta: { status: 200 }, message: "success", data: users });
                      //res.send({ meta: { status: 200 }, message: "success", data: { tags: [], goals: [], users: users }});
                }).error(function (err) {
                    res.send(500, { meta: { status: 500, message: 'unexpected error' } });
                });
            } 
            else {
                res.send(401, { meta: { status: 401, message: 'keyword required to be search for' } });
            }
        }
        else {
            res.send(401, { meta: { status: 401, message: 'User is not logged in or invalid token' } });
        }
    })
   .error(function (err) {
        res.send(500, { meta: { status: 500, message: 'unexpected error' } });
    });
};

exports.searchAll = function (req, res) {
    
    helpers.getActiveSession(req)
        .then(function (sessionUser) {
        
        if (sessionUser.type == 'Recognized' || sessionUser.type == 'UnRecognized') {
            
            var qWord = req.query.q || '';
            var pagination = utils.pagination(req);
            
            //var queryKeyword = helpers.trimSpace(qWord);
            var queryKeyword = qWord.trimSpace().makeSQLInjectionSafe();
            var searchResult = [
                {
                    data: {
                        tags: {},
                        goals: {},
                        users: {}
                    }
                }
            ];
            if (queryKeyword != null) {
                return new Promise(function (resolve) {

                    var regex = /\w{2,1000}/g;
                    var keywordList = queryKeyword.match(regex);
                    var finalQueryKeywords = '';

                    if(keywordList != null){
                        for(var i= 0, len = keywordList.length; i<len ; i++){
                            finalQueryKeywords += " +"+keywordList[i];
                        }
                    }else{
                        res.send(401 , { meta : { status : 401 , message : 'length is less than the required length'} } );
                        return;
                    }
                    finalQueryKeywords = finalQueryKeywords.trim();

                    var MainTags = clasAllTables.allTables.tags.tags();
                    return MainTags.findAll({
                        offset: pagination.offset, limit: pagination.limit,
                        attributes: ['tag_id', 'tagname', 'default_color'].concat([
                            [
                                sequelize.literal('(SELECT COUNT(`user_interest_tags`.`tag_id`) FROM `user_interest_tags` WHERE `user_interest_tags`.`tag_id` = `tags`.`tag_id` AND user_interest_tags.uid = {0})'.format(sessionUser.uid)),
                                'isMyInterest'
                            ]
                        ]), where : { tagname: { like: '%' + queryKeyword + '%' } }
                    })
                .then(function (resolveTags) {
                        //search goals
                        return new Promise(function (resolveGoals) {
                            return searchController.searchGoalsWithQuery(sessionUser, finalQueryKeywords, pagination.limit, pagination.offset)
                                .then(function (goals) {
                                resolveGoals(goals);
                            });
                        })
                    .then(function (resolveGoals) {
                            //search users
                            return new Promise(function (resolveUsers) {
                                return searchController.searchUsersWithQuery(sessionUser, finalQueryKeywords, pagination.limit, pagination.offset).then(function (users) {
                                    resolveUsers(users);
                                });
                            })
                        .then(function (resolveUsers) {
                                searchResult = [
                                    {
                                        data: {
                                            tags: resolveTags,
                                            goals: resolveGoals,
                                            users: resolveUsers
                                        }
                                    }
                                ]
                                resolve(searchResult[0].data);
                            });
                        });
                    });
                }).then(function (searchResult) {
                    res.send(200, { meta: { status: 200 }, message: "success", data: searchResult });
                });
            } 
            else {
                res.send(401, { meta: { status: 401, message: 'keyword required to be search for' } });
            }
        }
        else {
            res.send(401, { meta: { status: 401, message: 'User is not logged in or invalid token' } });
        }
    })
    .error(function (err) {
        res.send(500, { meta: { status: 500, message: 'unexpected error' } });
    });
};

//#####################################################################
//########################### REUSABLES ###############################
//#####################################################################

exports.searchTagsWithQuery = function (queryKeyword, setLimit, setOffset) {
    
    //queryKeyword = queryKeyword.startsWith('#') ? queryKeyword.replace('#', '') : queryKeyword;

    var querySearchTags;
    querySearchTags = "SELECT  tag_id as id, tagname FROM `tags`\
                            WHERE isFeatured = 0 and `status` = 'ACTIVE' and tagname like '{0}%'\
                            ORDER BY tagname\
                            limit {1} offset {2}".format(queryKeyword, setLimit, setOffset);
    
    var sequelize = db.sequelizeConn();
    return sequelize.query(querySearchTags, { type: sequelize.QueryTypes.SELECT })
        .then(function (tags) {
        return tags;
    }).error(function (err) {
        return err;
    });
};

exports.searchGoalsWithQuery = function (SessionUser, queryKeyword, setLimit, setOffset) {

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

    var query = "SELECT * FROM (SELECT goal_id FROM goals WHERE (goals.status='ACTIVE' OR goals.status='COMPLETED') AND MATCH (goal_name) AGAINST ('{0}' IN BOOLEAN MODE) AND goals.uid = {1}\
                 UNION\
                 SELECT goal_id FROM goals WHERE (goals.status='ACTIVE' OR goals.status='COMPLETED') AND MATCH (goal_name) AGAINST ('{0}' IN BOOLEAN MODE) AND (CheckPrivacy_Goal({1}, goal_id) = 1)) as searchgoals LIMIT {2},{3};".format(queryKeyword, SessionUser.uid, setOffset, setLimit);
    
    //search query
    return sequelize.query(query, { type: sequelize.QueryTypes.SELECT }).then(function (goals) {
        var goal_ids = _.uniq(_.map(goals, _.iteratee('goal_id')));
        return Goal.getList(goalInput, goal_ids , SessionUser.uid ).then(function(data){
            return data;
        })
    })
    .error(function (err) {
        return err;
    });
};

exports.searchUsersWithQuery = function (SessionUser, queryKeyword, setLimit, setOffset) {

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

    var query = "SELECT * FROM (\
                    SELECT users.uid, MATCH (first_name, middle_name, last_name) AGAINST ('{0}*' IN BOOLEAN MODE) as `rel` FROM users left join user_followers on users.uid = user_followers.follows_uid WHERE user_followers.uid = {1} AND user_followers.status = 'ACTIVE' AND users.status = 'ACTIVE' AND MATCH (first_name, middle_name, last_name) AGAINST ('{0}*' IN BOOLEAN MODE)\
                    UNION\
                    SELECT users.uid, MATCH (first_name, middle_name, last_name) AGAINST ('{0}*' IN BOOLEAN MODE) as `rel` FROM users left join user_followers on users.uid = user_followers.uid WHERE user_followers.follows_uid = {1}  AND user_followers.status = 'ACTIVE' AND users.status = 'ACTIVE' AND MATCH (first_name, middle_name, last_name) AGAINST ('{0}*' IN BOOLEAN MODE)\
                    UNION\
                    SELECT users.uid, MATCH (first_name, middle_name, last_name) AGAINST ('{0}*' IN BOOLEAN MODE) as `rel` FROM users where users.status = 'ACTIVE' AND MATCH (first_name, middle_name, last_name) AGAINST ('{0}*' IN BOOLEAN MODE)\
                    ) as t where CheckPrivacy_User({1}, uid) = 1  ORDER BY `rel` DESC LIMIT {2},{3}".format(queryKeyword, SessionUser.uid, setOffset, setLimit);

    return sequelize.query(query, { type: sequelize.QueryTypes.SELECT }).then(function (users) {
        var uids = _.uniq(_.map(users, _.iteratee('uid')));
        return User.getList(input, uids , SessionUser.uid ).then(function(data){
            return data;
        })
    })
    .error(function (err) {
        return err;
    });
};

exports.searchUsersWithPriority = function (req, res) {
    
    helpers.getActiveSession(req).then(function (SessionUser) {
        var qWord = req.query.q || '';
        var queryKeyword = qWord.trimSpace().makeSQLInjectionSafe();
        var pagination = utils.pagination(req);

        if (_.eq(SessionUser.type, "Recognized") && queryKeyword != null) {
            // 1000MS - Very Slow Query
            var query = "SELECT uid, username,CONCAT(first_name,' ',middle_name,' ' , last_name) as \"name\", \
                    CASE WHEN connections.uid IN(select follows_uid from user_followers where uid = {0}) THEN 1 \
                    WHEN uid IN(select uid from user_followers where follows_uid = {0}) \
                    THEN 2 ELSE 3 END AS 'relation' \
                    FROM (SELECT * FROM users \
                    WHERE (uid IN(SELECT follows_uid FROM user_followers WHERE uid = {0} AND `status` = 'ACTIVE'))\
                    OR (uid IN(SELECT uid FROM user_followers WHERE follows_uid = {0} AND `status` = 'ACTIVE'))) as connections \
                    WHERE (Lower(Concat(first_name, ' ', middle_name, ' ', last_name)) OR Lower(Concat(first_name ,' ', last_name))  \
                    LIKE Lower('{1}%') ) OR username = '{1}' ORDER BY 'relation' LIMIT {2} OFFSET {3}".format(SessionUser.uid, queryKeyword, pagination.limit, pagination.offset);
            
            sequelize.query(query, { type: sequelize.QueryTypes.SELECT }).then(function (users) {

                var input = {
                    basic: ['name', 'username', 'email', 'link', 'created'],
                    profile: ['small', 'medium'],
                    me: ['follower', 'following', 'mutual', 'mute'],
                };

                var uids = _.uniq(_.map(users, _.iteratee('uid')));

                User.getList(input, uids, SessionUser.uid).then(function(data) {
                    res.send(200, { meta : { status : 200, message: 'success'}, data : data});
                });
            })
        } else {
            res.send(401, { meta: { status: 401 , message: 'Unauthorized' } })
        }
    })
    .catch(function (err) {
        res.send(401, { meta: { status: 401 , message: 'Unauthorized' } })
    })
    .error(function (err) {
        res.send(500, { meta: { status: 500, message: 'unexpected error' } });
    });


};

//###############################################################
//######################### Require #############################
//###############################################################

var clasAllTables = require('../models/alltables');
var Promise = require("bluebird");
var helpers = require('../helpers/helpers');
var validator = require('validator');
var config = require('../config');
var Utils = require('../helpers/Utils');
var chalk = require('chalk');
var models = require('../models');
var Media = require('../models/Media');
var User = require('../models/User');
var Goal = require('../models/Goal');
var Category = require('../models/Category');
var _ = require('lodash');

//others
var db = require('../helpers/db');
var utils = require('../helpers/Utils');
//instances
var sequelize = db.sequelizeConn();
var objAllTables = clasAllTables.allTables;

//###############################################################
//########################### APIs ##############################
//###############################################################

exports.explore_old = function (req, res) {

    console.log('===========================');

    /*
        get top 6 categories
        get top 6 hot new goals
        get top 6 popular goals
        get top 6 featured users
    */

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

    var userInput = {
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

    helpers.getActiveSession(req)
        .then(function (sessionUser) {
            if (sessionUser.type == 'Recognized' || sessionUser.type == 'UnRecognized') {

                var explore = {};

                var hot_new_goals = objAllTables.hot_new_goals.hot_new_goals();
                return hot_new_goals.findAll({
                    where: {
                        status: 'ACTIVE',
                        $and: [sequelize.literal('CheckPrivacy_Goal({0}, goal_id) = 1'.format(sessionUser.uid))]
                    },
                    attributes: ['goal_id'],
                    limit: 6,
                    order: [sequelize.fn('RAND')]
                }).then(function (IDs) {

                    var goal_ids = [];
                    for (var i = 0; i < IDs.length; i++)
                        goal_ids.push(IDs[i].goal_id);

                    return new Promise(function (resolve, reject) {
                        // var _goal = new Goal(goal_ids , sessionUser.uid);
                        console.time('hot_new_goals');  //###################################
                        Goal.getList(goalInput, goal_ids, sessionUser.uid).then(function (data) {
                            console.timeEnd('hot_new_goals');   //###################################
                            resolve(data);
                        });
                        //return helpers.getGoalList(goal_ids, sessionUser.uid, true).then(function(result) {
                        //    resolve(result);
                        //});
                    }).then(function (hotnewgoals) {
                        explore['hotNewGoals'] = hotnewgoals;
                        return explore;
                    });
                }).then(function (explore) {
                    var popular_goals = objAllTables.popular_goals.popular_goals();
                    return popular_goals.findAll({
                        where: {
                            status: 'ACTIVE',
                            $and: [sequelize.literal('CheckPrivacy_Goal({0}, goal_id) = 1'.format(sessionUser.uid))]
                        },
                        attributes: ['goal_id'],
                        limit: 6,
                        order: [sequelize.fn('RAND')]
                    }).then(function (popularIDs) {

                        var popular_goal_ids = [];
                        for (var i = 0; i < popularIDs.length; i++)
                            popular_goal_ids.push(popularIDs[i].goal_id);
                        return new Promise(function (resolve, reject) {
                            console.time('popular_goals');  //###################################
                            Goal.getList(goalInput, popular_goal_ids, sessionUser.uid).then(function (data) {
                                console.timeEnd('popular_goals');  //###################################
                                resolve(data);
                            })
                            //return helpers.getGoalList(popular_goal_ids, sessionUser.uid, true).then(function(result) {
                            //    resolve(result);
                            //});
                        }).then(function (goals) {
                            explore['popularGoals'] = goals;
                            return explore;
                        });

                    })
                }).then(function (explore) {

                    // var featuredUsers = objAllTables.featured_users.featured_users();
                    return models.featured_users.findAll({
                        where: {
                            status: 'ACTIVE',
                            $and: [sequelize.literal('CheckPrivacy_User({0}, uid) = 1'.format(sessionUser.uid))]
                        },
                        attributes: ['uid'],
                        limit: 6,
                        order: [sequelize.fn('RAND')]
                    }).then(function (IDs) {

                        //generate uids array
                        var uids_array = [];
                        for (var i = 0; i < IDs.length; i++)
                            uids_array.push(IDs[i].uid);

                        //get users objects list
                        return new Promise(function (resolve) {
                            // return helpers.getUserList(uids_array, sessionUser.uid).then(function(result) {
                            //     resolve(result);
                            // });
                            //var _user = new User(uids_array , sessionUser.uid);
                            console.time('featured_users');  //###################################
                            User.getList(userInput, uids_array, sessionUser.uid).then(function (data) {
                                console.timeEnd('featured_users');  //###################################
                                resolve(data);
                            });

                        }).then(function (users) {
                            explore['featuredUsers'] = users;
                            return explore;
                        });
                    });
                }).then(function (exlpore) {
                    //get top 5 categories
                    var CATEGORIES = [];
                    //Old Scenario
                    return new Promise(function (resolve) {
                        var categories = objAllTables.default_category.default_category();
                        return categories.findAll({ limit: 15 })
                            .then(function (Categories) {
                                if (Categories.length > 0) {
                                    console.time('Categories');  //###################################
                                    var categoriesControllers = require('./categories');

                                    var promiseFor = Promise.method(function (condition, action, value) {
                                        if (!condition(value)) return value;
                                        return action(value).then(promiseFor.bind(null, condition, action));
                                    });

                                    promiseFor(function (count) {
                                        return count < Categories.length;
                                    }, function (count) {

                                        return categoriesControllers.fixCategory(Categories[count])
                                            .then(function (fixedCategory) {
                                                CATEGORIES.push(fixedCategory);
                                                return ++count;
                                            });

                                    }, 0)
                                        .then(function () {
                                            console.timeEnd('Categories');  //###################################
                                            exlpore['categories'] = CATEGORIES;
                                            resolve(exlpore);
                                        });
                                } else {
                                    exlpore['categories'] = CATEGORIES;
                                    resolve(exlpore);
                                }
                            });
                    })
                        .then(function (exploreObject) {
                            return exploreObject;
                        });
                })
                    .then(function (explore) {
                        res.send(200, { meta: { status: 200, message: 'success' }, data: explore });
                    });
            } else {
                res.send(401, { meta: { status: 401, message: 'user is not logged in or invalid token' } });
            }
        })
        .error(function (err) {
            res.send(500, { meta: { status: 500, message: 'internal error' }, errors: err });
        });
};

exports.explore = function (req, res) {
    /*
     get all categories
     get random 6 hot new goals
     get random 6 popular goals
     get random 6 featured users
     */

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

    var userInput = {
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

    helpers.getActiveSession(req).then(function (SessionUser) {
        console.log("====================================")
        if (SessionUser.type == 'Recognized' || SessionUser.type == 'UnRecognized') {

            var explore = {};
            var stars = {};
            var pagination = utils.pagination(req);
            new Promise(function(resolve, reject){
                models.hot_new_goals.findAll({ where: { status: 'ACTIVE', $and: [sequelize.literal('CheckPrivacy_Goal({0}, goal_id) = 1'.format(SessionUser.uid))] },
                    attributes: ['goal_id'],
                    limit: 12,
                    order: 'created_at DESC',
                    raw: true
                }).then(function(goals){
                    explore['hotNewGoals'] = _.slice(_.shuffle(_.compact(_.uniq(_.map(goals, _.iteratee('goal_id'))))), 0, 6);
                    resolve();
                })   
                
            }).then(function(){
                return models.popular_goals.findAll({ where: { status: 'ACTIVE', $and: [sequelize.literal('CheckPrivacy_Goal({0}, goal_id) = 1'.format(SessionUser.uid))] },
                    attributes: ['goal_id'],
                    limit: 12,
                    order: 'created_at DESC',
                    raw: true
                }).then(function(goals){
                    explore['popularGoals'] = _.slice(_.shuffle(_.compact(_.uniq(_.map(goals, _.iteratee('goal_id'))))), 0, 6);
                    return ;
                })
            }).then(function(){
                return models.featured_users.findAll({ where: { status: 'ACTIVE', $and: [sequelize.literal('CheckPrivacy_User({0}, uid) = 1'.format(SessionUser.uid))] },
                    attributes: ['uid'],
                    limit: 12,
                    order: 'featured_date DESC',
                    raw: true
                }).then(function(users){
                    explore['featuredUsers'] = _.compact(_.uniq(_.map(users, _.iteratee('uid'))));
                    return ;
                });  
            }).then(function(){
                return models.default_category.findAll( { attributes: ['category_id'], where: { status : 'ACTIVE'} }).then(function(categories){
                    return category_ids =  _.uniq(_.map(categories, _.iteratee('category_id')));
                }).then(function(category_ids){
                    Category.pagination = pagination;
                    var input = {
                        basic: ['name', 'link', 'color'],
                        image: ['medium', 'large'],
                    };
                    return Category.getList(input, category_ids, SessionUser.uid).then(function (categories) {
                        explore['categories'] = categories;
                    });
                })
            }).then(function(){
                return Goal.getList(goalInput, _.concat(explore['hotNewGoals'], explore['popularGoals']), SessionUser.uid).then(function(goalsList){
                    _.forEach(explore.hotNewGoals, function(value, key){
                        explore.hotNewGoals[key] = _.head(_.filter(goalsList, function (o) { return o.id == value; }));
                    });
                    _.forEach(explore.popularGoals, function(value, key){
                        explore.popularGoals[key] = _.head(_.filter(goalsList, function (o) { return o.id == value; }));
                    });
                });
            }).then(function(){
                return User.getList(userInput, explore['featuredUsers'], SessionUser.uid).then(function (data) {
                    return data;
                }).then(function (users) {
                    explore['featuredUsers'] = users;
                });
            }).then(function(){
                res.send(200, { meta: { status: 200, message: 'success' }, data: explore });
                console.log("====================================")
            })
        } else {
            res.send(401, { meta: { status: 401, message: 'user is not logged in or invalid token' } });
        }
    })
    .error(function (err) {
        res.send(500, { meta: { status: 500, message: 'internal error' }, errors: err });
    });
};

exports.getPopularGoals = function (req, res) {

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

    helpers.getActiveSession(req).then(function (sessionUser) {
        if (sessionUser.type == 'Recognized' || sessionUser.type == 'UnRecognized') {

            var pagination = Utils.pagination(req);

            var popularGoals = objAllTables.popular_goals.popular_goals();
            popularGoals.findAll({
                where: {
                    status: 'ACTIVE',
                    $and: [
                        sequelize.literal('CheckPrivacy_Goal({0}, goal_id) = 1'.format(sessionUser.uid))
                    ]
                },
                attributes: ['goal_id'],
                offset: pagination.offset,
                limit: pagination.limit,
                order: 'created_at DESC, goal_id ASC'
            }).then(function (IDs) {
                var goal_ids = [];
                for (var i = 0; i < IDs.length; i++)
                    goal_ids.push(IDs[i].goal_id);
                new Promise(function (resolve, reject) {

                    Goal.getList(goalInput, goal_ids, sessionUser.uid).then(function (data) {
                        resolve(data);
                    })
                    //helpers.getGoalList(goal_ids, sessionUser.uid, true).then(function(result) {
                    //    resolve(result);
                    //});
                })
                    .then(function (goals) {
                        res.send({ meta: { status: 200, message: 'success' }, data: { goals: goals } });
                    });

            });
        } else {
            res.send(401, { meta: { status: 401, message: 'user is not logged in or invalid token' } });
        }
    }).error(function (err) {
        res.send(500, { meta: { status: 500, message: 'unexpected error' } });
    }).catch(function (err) {
        res.send(500, { meta: { status: 500, message: 'unexpected error' } });
    });
};

exports.getHotNewGoals = function (req, res) {

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


    helpers.getActiveSession(req)
        .then(function (sessionUser) {
            if (sessionUser.type == 'Recognized' || sessionUser.type == 'UnRecognized') {

                var pagination = Utils.pagination(req);

                var hotNewGoals = objAllTables.hot_new_goals.hot_new_goals();
                hotNewGoals.findAll({
                    where: {
                        status: 'ACTIVE',
                        $and: [
                            sequelize.literal('CheckPrivacy_Goal({0}, goal_id) = 1'.format(sessionUser.uid))
                        ]
                    },
                    attributes: ['goal_id'],
                    offset: pagination.offset,
                    limit: pagination.limit,
                    order: 'created_at DESC, goal_id ASC'
                })
                    .then(function (IDs) {
                        var goal_ids = [];
                        for (var i = 0; i < IDs.length; i++)
                            goal_ids.push(IDs[i].goal_id);
                        new Promise(function (resolve, reject) {

                            Goal.getList(goalInput, goal_ids, sessionUser.uid).then(function (data) {
                                resolve(data);
                            })
                            //helpers.getGoalList(goal_ids, sessionUser.uid, true).then(function(result) {
                            //    resolve(result);
                            //});
                            //
                        })
                            .then(function (goals) {
                                res.send(200, { meta: { status: 200, message: 'success' }, data: { goals: goals } });
                            });
                    });
            } else {
                res.send(401, { meta: { status: 401, message: 'user is not logged in or invalid token' } });
            }
        })
        .error(function (err) {
            res.send(500, { meta: { status: 500, message: 'unexpected error' } });
        })
        .catch(function (err) {
            res.send(500, { meta: { status: 500, message: 'unexpected error' } });
        });
};

exports.getFeaturedUsers = function (req, res) {

    helpers.getActiveSession(req)
        .then(function (sessionUser) {
            if (sessionUser.type == 'Recognized' || sessionUser.type == 'UnRecognized') {

                var pagination = Utils.pagination(req);

                var featuredUsers = objAllTables.featured_users.featured_users();

                //fetch uids list
                featuredUsers.findAll({
                    where: {
                        status: 'ACTIVE',
                        $and: [
                            sequelize.literal('CheckPrivacy_User({0}, uid) = 1'.format(sessionUser.uid))
                        ]
                    },
                    attributes: ['uid'],
                    offset: pagination.offset,
                    limit: pagination.limit,
                    order: 'featured_date DESC, uid ASC'
                })
                    .then(function (IDs) {

                        //generate uids array
                        var uids_array = [];
                        for (var i = 0; i < IDs.length; i++)
                            uids_array.push(IDs[i].uid);

                        //get users objects list
                        new Promise(function (resolve) {
                            // helpers.getUserList(uids_array, sessionUser.uid).then(function(result) {
                            //     resolve(result);
                            // });
                            //var _user = new User
                            //var _user = new User(uids_array , sessionUser.uid);
                            User.getList(userInput, uids_array, sessionUser.uid).then(function (data) {
                                resolve(data);
                            });
                        })
                            .then(function (users) {
                                res.send(200, { meta: { status: 200, message: 'success' }, data: { users: users } });
                            });
                    });
            } else {
                res.send(401, { meta: { status: 401, message: 'user is not logged in or invalid token' } });
            }
        })
        .error(function (err) {
            res.send(500, { meta: { status: 500, message: 'in error' }, details: err });
        })
        .catch(function (err) {
            res.send(500, { meta: { status: 500, message: 'in catch' }, details: err });
        });
};

exports.getFeaturedTags = function (req, res) {

    helpers.getActiveSession(req).then(function (sessionUser) {
        if (sessionUser.type == 'Recognized' || sessionUser.type == 'UnRecognized') {
            var pagination = Utils.pagination(req);
            pagination.limit = 10;

            models.tags.findAll({
                attributes: ['tag_id', 'tagname', 'isFeatured', 'isDisplayable', 'icon_class', 'default_color', 'description', 'question', 'image_id', 'bannerImage_id', 'action_text'].concat([
                    [
                        sequelize.literal('(SELECT COUNT(`user_interest_tags`.`tag_id`) FROM `user_interest_tags` WHERE `user_interest_tags`.`tag_id` = `tags`.`tag_id` AND user_interest_tags.uid = {0})'.format(sessionUser.uid)),
                        'isMyInterest'
                    ]
                ]),
                where: { status: 'ACTIVE', isFeatured: true },
                offset: pagination.offset,
                limit: pagination.limit
            }).then(function (tags) {
                var mediaObj = new Media();
                var media_ids = []
                media_ids = _.concat(media_ids, _.compact(_.uniq(_.map(tags, _.iteratee('image_id')))));
                media_ids = _.concat(media_ids, _.compact(_.uniq(_.map(tags, _.iteratee('bannerImage_id')))));
                mediaObj.id = media_ids;
                return mediaObj.get().then(function (media_array) {
                    _.forEach(tags, function (value, key) {
                        value.image = _.head(_.filter(media_array, function (o) { return o.id == value.image_id; }));
                        value.banner = _.head(_.filter(media_array, function (o) { return o.id == value.bannerImage_id; }));
                    });
                    return tags;
                })
            }).then(function(tags){
                res.send(200, { meta: { status: 200, message: "success" }, data: tags });
            })

        } else {
            res.send(401, { meta: { status: 401, message: 'Unauthorized' } });
        }
    })
        .error(function (err) {
            res.send(500, { meta: { status: 500, message: "internal server error" }, details: err });
        }).catch(function (err) {
            res.send(500, { meta: { status: 500, message: "internal server error - in catch" }, details: err });
        });
};

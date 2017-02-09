//###############################################################
//######################### Require #############################
//###############################################################

var valid = require('../helpers/valid');
var config = require('../config');
var Promise = require("bluebird");
var models = require('../models');
var Media = require('../models/Media');
var _ = require('lodash');
var sequelize = require('sequelize');

//###############################################################
//######################## Constructor ##########################
//###############################################################

User = function (uid, session_uid) {

    /*
        uid: must be a valid integer, username can also be passed here
    */

    if ((/^(?:-1|\d+)$/gm).test(uid))
        this.uid = _.isInteger(uid) ? uid : parseInt(uid);
    else if (_.isString(uid))
        this.username = uid;
    else
        throw new Error('INVALID_TYPE, only integer or string is allowed');


    if (session_uid != null)
        this.session_uid = session_uid;
}

module.exports = User;

//###############################################################
//######################## Properties ###########################
//###############################################################

User.prototype.pagination = {
    offset: 0,
    limit: 5
}

//###############################################################
//###################### Static Methods #########################
//###############################################################

//get User/users
User.getList = function (input, uids, session_uid) {
    var user = { uid: uids };

    if (session_uid != null)
        user.session_uid = session_uid;

    return queryExecutor(input, user);
}

//###############################################################
//###################### Public Methods #########################
//###############################################################

//get User/users
User.prototype.get = function (input) {
    var that = this;
    return queryExecutor(input, that);
}

//get User Follower List
User.prototype.getFollowers = function (input) {

    var that = this;

    var followers = [];

    return models.user_followers.findAll({
        where: { status: 'ACTIVE', follows_uid: this.uid },
        offset: this.pagination.offset,
        limit: this.pagination.limit
    }).then(function (userFollowersList) {

        _.forEach(userFollowersList, function (value, key) {
            followers.push(value.uid)
        });

    }).then(function () {

        return User.getList(input, followers, that.session_uid ? that.session_uid : null)
            .then(function (data) {
                return data;
            });

    });
}

//get User Following List
User.prototype.getFollowings = function (input) {

    var that = this;

    var userFollowings = [];
    return models.user_followers.findAll({
        where: { status: 'ACTIVE', uid: this.uid },
        offset: this.pagination.offset,
        limit: this.pagination.limit
    }).then(function (result) {
        _.forEach(result, function (value, key) {
            userFollowings.push(value.follows_uid);
        })

    }).then(function () {
        return User.getList(input, userFollowings, that.session_uid ? that.session_uid : null)
            .then(function (data) {
                return data;
            });
    });
}

//get User Media
User.prototype.getMedia = function () {
    return models.user_file_uploads.findAll({
        where: { status: 'ACTIVE', uid: 1 },
        include: [{ model: models.images_thumbs }]
    })
        .then(function (result) { });
}

//get Location
User.prototype.stats = function () {

    return models.user_stats.findOne({
        where: { uid: this.uid }
    }).then(function (result) {
        return result;
    });

}

//get Location
User.prototype.getLocation = function () {

    return models.users.findOne({
        where: { status: 'ACTIVE', uid: 1 },
        include: [{ model: models.user_defined_location }]
    })
        .then(function (result) {
            return result;
        });

}

User.prototype.getMutual = function () {

    return models.users.findAll({
        where: { status: 'ACTIVE' },
        include: [{ model: models.user_followers, where: { uid: 1 } }]
    }).then(function (result) {

    })

}

//###############################################################
//##################### Private Functions #######################
//###############################################################

//render function for raw data
function render(_this, rawData) {

    var users = [];

    if (!Array.isArray(rawData))
        rawData = new Array(rawData);

    return Promise.map(rawData, function (_user) {

        //create instance(s) depend on data
        var user = rawData.length == 1 ? _this : new User(_user.uid);

        //uid
        if (!_this.uid)
            user.uid = _user.uid;

        //session uid
        if (user.session_uid)
            delete user.session_uid;
        
        //name
        var name;
        if (!valid.isNull(_user.first_name))
            name = _user.first_name;
        if (!valid.isNull(_user.middle_name))
            name += ' ' + _user.middle_name;
        if (!valid.isNull(_user.last_name))
            name += ' ' + _user.last_name;
        user.name = name;

        //link
        user.link = new Array(config.webURL.domain, _user.username).toURL();

        //user id
        if (_user.uid)
            user.uid = _user.uid;

        //user_name
        if (_user.username)
            user.username = _user.username;

        //account verification
        if (_user.account_verified)
            user.verified = _user.account_verified;

        //user biography
        if (_user.bio)
            user.bio = _user.bio;

        //user gender
        if (_user.gender)
            user.gender = _user.gender;

        //user_login
        if (_user.last_login)
            user.last_login = _user.last_login;

        //user_status
        if (_user.status)
            user.status = _user.status;

        //user_web
        if (_user.web_url)
            user.website = _user.web_url;

        //user_onboarding status
        if (_user.onboarding_web)
            user.onboarding_web = _user.onboarding_web;

        //joining date
        if (_user.created)
            user.created = _user.created;

        //privacy
        if (_user.privacy)
            user.privacy = _user.privacy;

        //if user is viewing his own profile, only then show his "email" "dob_show"
        if (_user.uid == _this.session_uid) {
            user.user_email = _user.user_email;
            user.dob_show = _user.dob_show;
            user.dob = _user.dob;
        }

        if (_user.dob_show == 'PUBLIC')
            user.dob = _user.dob;

        //me
        if (_user.isFollower != null || _user.isFollowing != null || _user.isMute != null) {
            user.me = {};

            if (_user.isFollower != null)
                user.me.isFollower = _user.isFollower;
            if (_user.isFollowing != null)
                user.me.isFollowing = _user.isFollowing;
            if (_user.isMute != null)
                user.me.isMute = _user.isMute;
        }

        //location
        if (_user.user_defined_location)
            user.location = _user.user_defined_location;

        //stats
        if (_user.user_stat) {

            user.stats = {};
            
            //connection stats
            if (_.isInteger(_user.user_stat.followers) || _.isInteger(_user.user_stat.followings)) {
                user.stats.connections = {};

                //followers
                if (_.isInteger(_user.user_stat.followers)) {
                    user.stats.connections.followers = _user.user_stat.followers || 0;
                    user.stats.connections.followersCount = _user.user_stat.followers || 0;
                }

                //followings
                if (_.isInteger(_user.user_stat.followings)) {
                    user.stats.connections.followings = _user.user_stat.followings || 0;
                    user.stats.connections.followingCount = _user.user_stat.followings || 0;
                }

                if (_.isInteger(_user.user_stat.views)) {
                    user.stats.connections.views = _user.user_stat.views || 0;
                }
            }

            //views
            if (_.isInteger(_user.user_stat.views)) {
                user.stats.views = _user.user_stat.views || 0;
            }

            //goal stats
            if (_.isInteger(_user.user_stat.goals) || _.isInteger(_user.user_stat.goal_followings)) {
                user.stats.goal = {};

                //goals
                if (_.isInteger(_user.user_stat.goals)) {
                    user.stats.goal.goals = _user.user_stat.goals || 0;
                    user.stats.goal.total = _user.user_stat.goals || 0;
                }

                //goal followings
                if (_.isInteger(_user.user_stat.goal_followings)) {
                    user.stats.goal.goal_followings = _user.user_stat.goal_followings || 0;
                    user.stats.goal.following = _user.user_stat.goal_followings || 0;
                }
            }
        }

        // Profile Image
        if (_user.profile)
            user.profile = _user.profile

        // Cover Image
        if (_user.cover)
            user.cover = _user.cover;

        users.push(user);
        return;

    }).then(function () {
        return users;
    });
}

//executes sequelize query and merge media into it
function queryExecutor(input, that) {
    //get query
    var _query = queryGenerator(input, that);

    //execute query
    return models.users.findAll(_query).then(function (_usersRaw) {

        //if no user was found
        if (_.isEmpty(_usersRaw))
            return [];

        //if user found
        if (_.has(input, 'profile') || _.has(input, 'cover')) {
            var mediaObj = new Media();
            media_ids = []
            if(_.has(input, 'profile')) {
                media_ids = _.concat(media_ids, _.compact(_.uniq(_.map(_usersRaw, _.iteratee('profile_image_id')))));
            }
            if(_.has(input, 'cover')) {
                media_ids = _.concat(media_ids, _.compact(_.uniq(_.map(_usersRaw, _.iteratee('cover_image_id')))));
            }
            mediaObj.id = media_ids;
            return mediaObj.get().then(function (media_array) {

                _.forEach(_usersRaw, function (value, key) {
                    if(_.has(input, 'profile')) {
                        value.profile = _.head(_.filter(media_array, function (o) { return o.id == value.profile_image_id; }));
                    }
                    if(_.has(input, 'cover')) {
                        value.cover = _.head(_.filter(media_array, function (o) { return o.id == value.cover_image_id; }));
                    }
                });

                _.forEach(_usersRaw, function (value, key) {
                    if(_.has(input, 'profile') && typeof value.profile == "undefined") {
                        value.profile = new Media().defaults.profile;
                    }
                    if(_.has(input, 'cover') && typeof value.cover == "undefined") {
                        value.cover = new Media().defaults.cover;
                    }
                });

                return _usersRaw;
            });
        } else {
            return _usersRaw;
        }

    }).then(function (_usersRaw) {
        return render(that, _usersRaw);
    });;
}

//generates sequelize query
function queryGenerator(input, that) {

    //parse input
    var _queryModels = inputParser(input, that);

    //add "get user" condition into query
    if (that.uid != null)
        _queryModels.users.where.uid = that.uid;
    else
        _queryModels.users.where.username = that.username;

    //create sequelize query
    var _query = {
        where: _queryModels.users.where,
        attributes: _queryModels.users.attributes,
        include: _.values(_.omit(_queryModels, 'users')),
    };

    return _query;
}

//parses json input - parametric query
function inputParser(input, that) {

    var query_models = {};

    for (var key in input) {

        if (!input.hasOwnProperty(key)) {
            //The current property is not a direct property of input
            continue;
        } else if (input[key] instanceof Array) {

            if (key == 'basic') {
                query_models.users = {
                    where: { status: 'ACTIVE' },
                    attributes: ['uid', 'username', 'bio', 'user_email', 'account_verified', 'first_name', 'middle_name', 'last_name', 'created']
                };

                //add privacy
            } else if (key == 'profile') {
                query_models.users.attributes.push('profile_image_id');

                //var profile = new Media();
                //query_models.profile = profile.getQuery(input[key], 'profile');
            } else if (key == 'cover') {
                query_models.users.attributes.push('cover_image_id');

                // var cover = new Media();
            } else if (key == 'connections') {
                query_models.user_stats = {
                    attributes: ['followers', 'followings', 'views', 'goals', 'goal_followings'],
                    model: models.user_stats
                };
            } else if (key == 'me' && that.session_uid != null && that.session_uid != that.uid) {
                //field parsing
                _(input[key]).forEach(function (value) {
                    if (value == 'follower')
                        query_models.users.attributes.push([sequelize.literal('fn_userRelation_isFollower({0}, users.`uid`)'.format(that.session_uid)), 'isFollower']);
                    else if (value == 'following')
                        query_models.users.attributes.push([sequelize.literal('fn_userRelation_isFollowing({0}, users.`uid`)'.format(that.session_uid)), 'isFollowing']);
                    else if (value == 'mute')
                        query_models.users.attributes.push([sequelize.literal('fn_userRelation_isMute({0}, users.`uid`)'.format(that.session_uid)), 'isMute']);
                });
            }
        } else if (typeof input[key] !== 'null' && typeof input[key] === 'object') {  //if nested input
            var obj = inputParser(input[key]);
            query_models = _.assign(query_models, obj);
        } else if (typeof input[key] === "boolean") {
            if (key == 'location') {
                query_models.users.attributes.push('user_location');
                query_models.user_defined_location = { model: models.user_defined_location, attributes: ['id', 'formatted_address', 'locality', 'administrative_area_level_1' ,'country']  };
            }
        }
    }

    return query_models;
}

//###############################################################
//########################### Test ##############################
//###############################################################

User.prototype.final = function () {

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

    return queryExecutor(input);
}

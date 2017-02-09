//###############################################################
//######################### Require #############################
//###############################################################

var config = require('../config');
var _ = require('lodash');
var Media = require('../models/Media');
var User = require('../models/User');
var Tag = require('../models/Tag');
var models = require('../models');
var Promise = require("bluebird");
var speakingurl = require('speakingurl');

//###############################################################
//######################## Constructor ##########################
//###############################################################

Goal = function (goal_id, session_uid) {

    /*
        id: must be a valid integer
    */

    if (_.isInteger(goal_id))
        this.id = goal_id;
    else
        throw new Error('INVALID_TYPE, only integer is allowed');

    if (session_uid != null)
        this.session_uid = session_uid;
}

module.exports = Goal;

//###############################################################
//######################## Properties ###########################
//###############################################################

Goal.prototype.pagination = {
    offset: 0,
    limit: 5
}

//###############################################################
//###################### Static Methods #########################
//###############################################################

//get goal/goals
Goal.getList = function (input, goal_ids, session_uid) {

    var goals = { id: goal_ids };

    if (session_uid != null)
        goals.session_uid = session_uid;

    return queryExecutor(input, goals);
}

//###############################################################
//###################### Public Methods #########################
//###############################################################

Goal.prototype.get = function (input) {
    return queryExecutor(input, this).then(function (goal) {
        return goal[0];
    });
}

Goal.prototype.followers = function (input) {

    var that = this;
    var goalfollowers = [];

    return models.goal_followers.findAll({
        where: { status: 'ACTIVE', goal_id: this.id },
        offset: this.pagination.offset, limit: this.pagination.limit
    }).then(function (goalFollowersList) {

        _.forEach(goalFollowersList, function (value, key) {
            goalfollowers.push(value.follower_uid)
        });

    }).then(function () {

        return User.getList(input, goalfollowers, that.session_uid ? that.session_uid : null)
            .then(function (data) {
                return data;
            });
    });
}

Goal.prototype.motivators = function (input) {

    var that = this;
    var goalMotivator = [];

    return models.goal_motivate.findAll({
        where: { status: 'ACTIVE', goal_id: this.id },
        offset: this.pagination.offset, limit: this.pagination.limit
    }).then(function (goalMotivatorList) {
        _.forEach(goalMotivatorList, function (value, key) {
            goalMotivator.push(value.uid)
        });

    }).then(function () {
        return User.getList(input, goalMotivator, that.session_uid ? that.session_uid : null)
            .then(function (data) {
                return data;
            });
    });
}

Goal.prototype.linkers = function (input) {

    var that = this;
    var goalLinkers = [];

    return models.goal_linked.findAll({
        attributes: [[sequelize.literal("DISTINCT `uid` "), 'uid']],
        where: { status: 'ACTIVE', to_goal_id: this.id },
        offset: this.pagination.offset, limit: this.pagination.limit
    }).then(function (goalLinkedList) {

        _.forEach(goalLinkedList, function (value, key) {
            goalLinkers.push(value.uid)
        });

    }).then(function () {
        return User.getList(input, goalLinkers, that.session_uid ? that.session_uid : null)
            .then(function (data) {
                return data;
            });
    });
}

Goal.prototype.backwardLinked = function (input) {

    var that = this;
    var goalLinked = [];

    return models.goal_linked.findAll({
        attributes: ['from_goal_id'],
        where: { status: 'ACTIVE', to_goal_id: this.id },
        offset: this.pagination.offset, limit: this.pagination.limit
    }).then(function (goalLinkedList) {
        _.forEach(goalLinkedList, function (value, key) {
            goalLinked.push(value.from_goal_id)
        });

    }).then(function () {

    });
}

Goal.prototype.forwardLinked = function (input) {

    var that = this;
    var goalLinked = [];

    return models.goal_linked.findAll({
        attributes: ['to_goal_id'],
        where: { status: 'ACTIVE', from_goal_id: this.id },
        offset: this.pagination.offset, limit: this.pagination.limit
    }).then(function (goalLinkedList) {

        _.forEach(goalLinkedList, function (value, key) {
            goalLinked.push(value.to_goal_id)
        });

    }).then(function () {

    });
}

//###############################################################
//##################### Private Functions #######################
//###############################################################

//render function for raw data
function render(_this, rawData) {

    var goals = [];

    if (!Array.isArray(rawData))
        rawData = new Array(rawData);

    return Promise.map(rawData, function (_goal) {

        //create instance(s) depend on data
        var goal = rawData.length == 1 ? _this : new Goal(_goal.goal_id);

        //id
        goal.id = _goal.goal_id;

        //session uid
        if (goal.session_uid)
            delete goal.session_uid;

        //link
        if (_goal.user)
            goal.link = new Array(config.webURL.domain, (_goal.user.username), 'goal', _goal.goal_id, speakingurl(_goal.goal_name)).toURL();

        //goal name
        if (_goal.goal_name)
            goal.name = _goal.goal_name;

        //goal description
        if (_goal.goal_description)
            goal.description = _goal.goal_description;

        //user id
        if (_goal.uid)
            goal.uid = _goal.uid;

        //user_status
        if (_goal.status)
            goal.status = _goal.status;

        //joining date
        if (_goal.created)
            goal.created = _goal.created;

        //privacy status
        if (_goal.scope_id)
            goal.scope_id = _goal.scope_id;

        //category
        if (_goal.category_id)
            goal.category_id = _goal.category_id;

        //start date
        if (_goal.g_start_date)
            goal.start_date = _goal.g_start_date;

        //end date
        if (_goal.g_end_date)
            goal.end_date = _goal.g_end_date;

        //completion date
        if (_goal.completed)
            goal.completed = _goal.completed;

        if (_goal.user_location)
            goal.user_location = _goal.user_location;

        if (_goal.status)
            goal.status = _goal.status;

        //cover
        if (_goal.goal_image_id == null)
            goal.cover = new Media().defaults.goal;
        if (_goal.goal_image_id)
            goal.cover = _goal.cover;

        //stats
        if (_goal.goal_stat) {

            goal.stats = {};

            // goal folllowers
            if (_.isInteger(_goal.goal_stat.followers))
                goal.stats.followers = _goal.goal_stat.followers || 0;

            //goal motivators
            if (_.isInteger(_goal.goal_stat.motivations))
                goal.stats.motivations = _goal.goal_stat.motivations || 0;

            //goal contributors
            if (_.isInteger(_goal.goal_stat.contributions))
                goal.stats.contributions = _goal.goal_stat.contributions || 0;

            //goal linker
            if (_.isInteger(_goal.goal_stat.links))
                goal.stats.linkers = _goal.goal_stat.links_backward || 0;

            //goal viewers
            if (_.isInteger(_goal.goal_stat.views))
                goal.stats.views = _goal.goal_stat.views || 0;

            //goal achievers
            if (_.isInteger(_goal.goal_stat.achievers))
                goal.stats.achievers = _goal.goal_stat.achievers || 0;
        }

        //user
        if (_goal.user) {
            goal.user = _goal.user;
        }

        //me
        if (_goal.isFollower != null || _goal.isMotivate != null || _goal.isMute != null || _goal.isLinked != null) {
            goal.me = {};

            if (_goal.isFollower != null)
                goal.me.isFollower = _goal.isFollower;
            if (_goal.isMotivate != null)
                goal.me.isMotivated = _goal.isMotivate;
            if (_goal.isMute != null)
                goal.me.isMute = _goal.isMute;
            if (_goal.isLinked != null)
                goal.me.isLinked = _goal.isLinked;
        }

        //tags
        if (_goal.goals_tags) {
            goal.tags = _goal.goals_tags;
        }
        
        //location
        if (_goal.location)
            goal.location = _goal.location;

        //location
        if (_goal.user_defined_location)
            goal.location = _goal.user_defined_location;
        else
            goal.location = {};

        goals.push(goal);
        return;

    }).then(function () {
        return goals;
    });
}

//executes sequelize query and merge media into it
function queryExecutor(input, that) {
    var _query = queryGenerator(input, that);

    //execute goal query
    return models.goals.findAll(_query).then(function (_goalsRaw) {

        //if no goal was found
        if (_.isEmpty(_goalsRaw))
            return [];

        //if goal found
        if (_.has(input, 'cover')) {
            var mediaObj = new Media();
            mediaObj.id = _.compact(_.uniq(_.map(_goalsRaw, _.iteratee('goal_image_id'))));
            return mediaObj.get().then(function (media_array) {
                _.forEach(_goalsRaw, function (value, key) {
                    value.cover = _.head(_.filter(media_array, function (o) { return o.id == value.goal_image_id; }));
                });
                return _goalsRaw;
            })
        } else {
            return _goalsRaw;
        }
    }).then(function (_goalsRaw) {
        if (_.isObject(input.user)) {
            var uids = _.compact(_.uniq(_.map(_goalsRaw, _.iteratee('uid'))));
            return User.getList(input.user, uids, that.session_uid).then(function (users) {
                _.forEach(_goalsRaw, function (value, key) {
                    value.user = _.head(_.filter(users, function (o) { return o.uid == value.uid; }));
                });
                return _goalsRaw;
            })
        } else {
            return _goalsRaw;
        }
    }).then(function (_goalsRaw) {
        var goalTagsObject = _.compact(_.uniq(_.map(_goalsRaw, _.iteratee('goals_tags'))));
        if(goalTagsObject.length > 0){
            var tag_ids = _.compact(_.uniq(_.map(goalTagsObject[0], _.iteratee('tag_id'))));
            var input = {
                basic: ['name', 'color', 'link', 'isMyInterest']
            }
            return Tag.getList(input, tag_ids,that.session_uid).then(function(tags){
                _.forEach(_goalsRaw, function (value, key) {
                    value.goals_tags = tags;
                });
                return _goalsRaw;
            });
        }
        else{
            return _goalsRaw;
        }

    }).then(function(_goalsRaw){
        return render(that, _goalsRaw);
    });

}

//generates sequelize query
function queryGenerator(input, that) {

    //parse input
    var _queryModels = inputParser(input, that);

    //add "get user" condition into query
    if (that.goal_id != null)
        _queryModels.goals.where.goal_id = that.id;


    //create sequelize query
    var _query = {
        where: _queryModels.goals.where,
        attributes: _queryModels.goals.attributes,
        include: _.values(_.omit(_queryModels, 'goals')),
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
        }

        else if (input[key] instanceof Array) {

            if (key == 'basic') {
                query_models.goals = {
                    where: { status: ['ACTIVE', 'COMPLETED'], goal_id: that.id },
                    attributes: ['goal_id', 'goal_name', 'goal_description', 'status', 'created', 'completed', 'g_end_date', 'g_start_date', 'updated', 'scope_id', 'category_id'],
                };
            }

            else if (key == 'cover') {
                query_models.goals.attributes.push('goal_image_id');
            }

            else if (key == 'stats') {
                query_models.goal_stats = {
                    model: models.goal_stats
                };
            }

            else if (key == 'me') {
                _(input[key]).forEach(function (value) {
                    if (value == 'following') {
                        query_models.goals.attributes.push([models.sequelize.literal('fn_goalRelation_isFollowing({0}, goals.goal_id)'.format(that.session_uid)), 'isFollower']);
                    } else if (value == 'mute') {
                        query_models.goals.attributes.push([models.sequelize.literal('fn_goalRelation_isMute({0}, goals.goal_id)'.format(that.session_uid)), 'isMute']);
                    } else if (value == 'motivate') {
                        query_models.goals.attributes.push([models.sequelize.literal('fn_goalRelation_isMotivate({0}, goals.goal_id)'.format(that.session_uid)), 'isMotivate']);
                    } else if (value == 'linked') {
                        query_models.goals.attributes.push([models.sequelize.literal('fn_goalRelation_isLinker({0}, goals.goal_id)'.format(that.session_uid)), 'isLinked']);
                    }
                });
            }
        }

        else if (typeof input[key] !== 'null' && typeof input[key] === 'object') {  //for nested input

            if (key == 'user') {
                query_models.goals.attributes.push('uid');
            }
            else {
                var obj = inputParser(input[key], that);
                query_models = _.assign(query_models, obj);
            }
        }
        //tags
        else if (typeof input[key] === "boolean" && key == 'tags') {
            query_models.goals_tags = { required: false, model: models.goals_tags, where: { status: 'ACTIVE' } }
            //query_models.goals_tags = { required: false, model: models.goals_tags, where: { status: 'ACTIVE' }, include: [{ model: models.tags }] }

        }

        else if (typeof input[key] === "boolean" && key == 'location') {
            if (key == 'location') {
                query_models.goals.attributes.push('user_location');
                query_models.user_defined_location = { model: models.user_defined_location, attributes: ['id', 'formatted_address', 'locality', 'administrative_area_level_1', 'country'] };
            }
        }
    }

    return query_models;
}

//###############################################################
//########################### Test ##############################
//###############################################################

Goal.prototype.final = function () {

    var input = {
        basic: ['name', 'status', 'privacy', 'link'],
        user: {
            basic: ['name', 'username', 'email', 'link'],
            profile: ['small', 'medium'],
        },
        me: ["following", "motivate", "linked", "mute"],
        cover: ['medium', 'large', 'xlarge'],
        stats: ['followers', 'motivations', 'contributions', 'linkers', 'views', 'achievers'],
        tags: true,
        location: true
    };

    return queryExecutor(input);
}

//complete query - for refernece
Goal.prototype.completeQuery = function () {

    var goal_id = this.id;

    var finalGoal = {};
    var session_uid = this.session_uid;

    return models.goals.findAll({
        attributes: ['goal_id', 'uid', 'goal_name', 'goal_description', 'g_start_date', 'g_end_date', 'goal_image_id', 'category_id', 'created', 'scope_id', 'completed'],
        where: { goal_id: goal_id, status: 'ACTIVE' }
    })
        .then(function (goalObj) {
            finalGoal.goal = goalObj[0];
            return finalGoal;
        }).then(function (goal) {
            return models.goal_stats.findOne({ where: { goal_id: goal_id } }).then(function (stats) {
                finalGoal.stats = stats;
                return finalGoal;
            }).then(function (newGoal) {

                var _media = new Media(newGoal.goal.goal_image_id);
                return _media.get().then(function (media) {
                    finalGoal.cover = media;
                    return finalGoal;
                }).then(function () {
                    var input = {
                        basic: ['name', 'username', 'link'],
                        profile: ['small'],
                        me: ['follower', 'following', 'mutual', 'mute']
                    };
                    var _user = new User(finalGoal.goal.uid);
                    return _user.get(input).then(function (user) {
                        finalGoal.user = user[0];
                        return finalGoal;
                    }).then(function () {
                        var meAboutGoal = 'SELECT fn_goalRelation_isFollowing( {0},{1} ) as isFollowing, fn_goalRelation_isMotivate({0}, {1}) as isMotivate, fn_goalRelation_isMute({0}, {1}) as isMute'.format(session_uid, goal_id);
                        return models.sequelize.query(meAboutGoal).then(function (me) {
                            finalGoal.me = me[0][0];
                            return finalGoal;
                        }).then(function () {
                            return models.goals_tags.findAll({ where: { goal_id: goal_id } }).then(function (tags) {
                                finalGoal.tags = tags;
                                return finalGoal
                            });
                        });
                    });
                });
            });
        });
}
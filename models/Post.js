//###############################################################
//######################### Require #############################
//###############################################################

var _ = require('lodash');
var Media = require('../models/Media');
var User = require('../models/User');
var Comment = require('../models/Comment');
var models = require('../models');
var Promise = require("bluebird");
var sequelize = require('../helpers/db').sequelizeConn();

//###############################################################
//######################## Constructor ##########################
//###############################################################

Post = function (post_id, session_uid) {

    if (_.isInteger(post_id))
        this.id = post_id;
    else
        throw new Error('INVALID_TYPE, only integer is allowed');

    if (session_uid != null)
        this.session_uid = session_uid;
}

module.exports = Post;

//###############################################################
//######################## Properties ###########################
//###############################################################

Post.prototype.pagination = {
    offset: 0,
    limit: 5
}

//###############################################################
//###################### Static Methods #########################
//###############################################################

/**
 * [getList This function is use to get multiple post by IDs]
 * @param  {[Object]} input         [parameteric call]
 * @param  {[Array]} post_ids       [Post Ids]
 * @param  {[Int]} session_uid      [Session ID]
 * @return {[Promise]}              [description]
 */
Post.getList = function (input, post_ids, session_uid) {

    var posts = { id: post_ids };

    if (session_uid != null)
        posts.session_uid = session_uid;

    return queryExecutor(input, posts);
}

//###############################################################
//###################### Public Methods #########################
//###############################################################

Post.prototype.get = function (input) {
    return queryExecutor(input, this);
}

Post.prototype.followers = function (input) {

    var that = this;
    var postfollowers = [];

    return models.post_followers.findAll({
        where: { status: 'ACTIVE', post_id: this.id },
        offset: this.pagination.offset,
        limit: this.pagination.limit
    }).then(function (postFollowersList) {

        _.forEach(postFollowersList, function (value, key) {
            postfollowers.push(value.uid)
        });

    }).then(function () {
        return User.getList(input, postfollowers, that.session_uid ? that.session_uid : null).then(function (data) {
            return data;
        });
    });
}

Post.prototype.motivators = function (input) {

    var that = this;
    var postMotivators = [];

    return models.post_motivate.findAll({
        where: { status: 'ACTIVE', post_id: that.id },
        offset: that.pagination.offset,
        limit: that.pagination.limit
    }).then(function (postMotivatorList) {
        _.forEach(postMotivatorList, function (value, key) {
            postMotivators.push(value.uid)
        });

    }).then(function () {
        return User.getList(input, postMotivators, that.session_uid ? that.session_uid : null).then(function (data) {
            return data;
        });
    });
}

//###############################################################
//##################### Private Functions #######################
//###############################################################

//render function for raw data
function render(_this, rawData) {

    var posts = [];

    if (!Array.isArray(rawData))
        rawData = new Array(rawData);

    return Promise.map(rawData, function (_post) {

        //create instance(s) depend on data
        var post = rawData.length == 1 ? _this : new Post(_post.id);

        //id
        post.id = _post.id;

        //session uid
        if (post.session_uid)
            delete post.session_uid;

        //link
        if (_post.id)
            post.link = new Array(process.env.WEB_SERVER_URL, 'activity', _post.id).toURL();

        //post text
        post.text = _post.text || "";

        //user_status
        if (_post.status)
            post.status = _post.status;

        //created date
        if (_post.created)
            post.created = _post.created;

        //privacy status
        if (_post.scope_id)
            post.scope_id = _post.scope_id;

        // Post Media
        if (_post.media)
            post.media = _post.media;

        //post location set by user
        if (_post.user_location)
            post.user_location = _post.user_location;

        //post type
        if (_post.post_type)
            post.post_type = _post.post_type

        //shared URL meta
        if (_post.fetched_url) {
            post.fetched_url = _.pick(_post.fetched_url, ['id', 'url', 'host', 'title', 'description', 'scheme', 'provider', 'image', 'thumb']);
        }

        //stats
        if (_post.post_stat) {
            post.stats = {};
            // Motivators
            post.stats.motivations = _post.post_stat.motivations || 0;
            // Comments
            post.stats.comments = _post.post_stat.comments || 0;
            // Views
            post.stats.views = _post.post_stat.views || 0;
        }

        //mentioned users list
        if (_post.mentionList) {
            post.mentionList = _post.mentionList;
        }

        //user
        if (_post.user) {
            post.user = _post.user;
        }

        //me
        if (_post.isFollower != null || _post.isMotivate != null) {
            post.me = {};

            if (_post.isFollower != null)
                post.me.isFollower = _post.isFollower;
            if (_post.isMotivate != null)
                post.me.isMotivated = _post.isMotivate;
        }

        if (_.eq(_post.post_type, "ALBUM")) {
            post.parent_id = _post.parent_id;
        }

        //location
        post.location = _post.user_defined_location || {};

        post.comments = _post.comments || [];

        posts.push(post);
        return;

    }).then(function () {
        return posts;
    });
}

//executes sequelize query and merge media into it
function queryExecutor(input, that) {
    var _query = queryGenerator(input, that);

    //execute post query
    return models.posts.findAll(_query).then(function (_postsRaw) {
        if (_.isEmpty(_postsRaw)) return [];

        return _postsRaw;
    }).then(function (_postsRaw) { //IMAGES 
        return Promise.map(_postsRaw, function (_post) {
            var id = 0;
            var image = "NOTALBUM"
            if (!_.isNull(_post.media_id)) {
                id = _post.id;
            } else if (_.isNull(_post.media_id) && _post.post_type == 'ALBUM' && !_.isNull(_post.parent_id)) {
                id = _post.parent_id;
            } else {
                return _post;
            }
            return Media.getPostImages(id, _post.post_type).then(function (post_media) {
                _post.media = _.head(_.filter(post_media, function (o) {
                    return o.id == id;
                })).media;
                return _post;
            });
        });
    }).then(function (_postsRaw) { //USERS 
        if (!_.isObject(input.user)) return _postsRaw;

        var uids = _.compact(_.uniq(_.map(_postsRaw, _.iteratee('uid'))));
        var input_user = { basic: ['name', 'username', 'link'], profile: ['small', 'medium'] };
        return User.getList(input_user, uids, this.session_uid).then(function (users) {
            _.forEach(_postsRaw, function (value, key) {
                value.user = _.head(_.filter(users, function (o) { return o.uid == value.uid; }));
            });

            return _postsRaw;
        })
    }).then(function (_postsRaw) { //MENTIONED USERS 
        var PostIds = _.compact(_.uniq(_.map(_postsRaw, _.iteratee('id'))));

        var userInput = {
            basic: ['name', 'username', 'link'],
            profile: ['small']
        };

        return models.mentioned_post.findAll({ attributes: ['mentioned_uid', 'post_id'], where: { post_id: PostIds } }).then(function (post_mentions) {
            var Users = _.compact(_.uniq(_.map(post_mentions, _.iteratee('mentioned_uid'))));
            if (!_.isEmpty(Users)) {
                return User.getList(userInput, Users, that.session_uid ? that.session_uid : null).then(function (users) {
                    _.forEach(_postsRaw, function (value, key) {
                        value.mentionList = []
                        _.forEach(post_mentions, function (mention, k) {
                            if (value.id == mention.post_id) {
                                value.mentionList.push(_.head(_.filter(users, function (o) { return o.uid == mention.mentioned_uid; })))
                            }
                        })
                    });
                    return _postsRaw;
                })
            } else {
                _.forEach(_postsRaw, function (value, key) {
                    value.mentionList = []
                })
                return _postsRaw;
            }
        })
    }).then(function (_postsRaw) { //COMMENTS
        if (!_.isObject(input.comment)) return _postsRaw;

        //get comment ids
        var post_ids = _.compact(_.uniq(_.map(_postsRaw, _.iteratee('id'))));
        return models.comments.findAll({
            attributes: [[sequelize.fn('SUBSTRING_INDEX', sequelize.fn('GROUP_CONCAT', sequelize.literal("id ORDER BY created DESC SEPARATOR ','")), sequelize.literal("',', {0}".format(input.comment.limit[1]))), 'cids'], 'parent_id'],
            where: { status: 'ACTIVE', parent_id: post_ids, parent_type: 'POST' },
            group: ['parent_id'],
            //offset: input.comment.limit[0],
            //limit: input.comment.limit[1]
        }).then(function (ids) {

            //retun empty aray if no comment was found
            if (_.isEmpty(ids))
                return [];

            //split the grouped ids and create an array
            var comment_ids = [];
            _.forEach(ids, function (value, key) {
                comment_ids = _.concat(comment_ids, value.get('cids').split(","));
            });

            return comment_ids;

        }).then(function (comment_ids) {

            //retun _postsRaw as it is if no comment was found
            if (_.isEmpty(comment_ids))
                return _postsRaw;

            //get comment objects
            return Comment.getList(input.comment, comment_ids, that.session_uid).then(function (_comments) {

                _.forEach(_postsRaw, function (value, key) {
                    value.comments = _.filter(_comments, function (o) { return o.post_id == value.id; });
                });

                return _postsRaw;
            });

        })
    }).then(function (_postsRaw) { // RENDER OBJECTS
        return render(that, _postsRaw);
    });
}

//generates sequelize query
function queryGenerator(input, that) {

    //parse input
    var _queryModels = inputParser(input, that);

    //add "get post" condition into query
    if (that.id != null)
        _queryModels.posts.where.id = that.id;

    //create sequelize query
    var _query = {
        where: _queryModels.posts.where,
        attributes: _queryModels.posts.attributes,
        include: _.values(_.omit(_queryModels, 'posts')),
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
                query_models.posts = {
                    where: { status: ['ACTIVE'] },
                    attributes: ['id', 'uid', 'text', 'user_defined_location_id', 'post_type', 'scope_id', 'media_id', 'parent_id', 'created', 'status']
                };
            }

            else if (key == 'stats') {
                query_models.post_stats = {
                    model: models.post_stats
                };
            }

            //this is me is about post and user relations
            else if (key == 'me' && that.session_uid != null) {
                _(input[key]).forEach(function (value) {
                    if (value == 'following')
                        query_models.posts.attributes.push([models.sequelize.literal('fn_postRelation_isFollowing({0}, posts.id)'.format(that.session_uid)), 'isFollower']);
                    else if (value == 'motivate')
                        query_models.posts.attributes.push([models.sequelize.literal('fn_postRelation_isMotivate({0}, posts.id)'.format(that.session_uid)), 'isMotivate']);
                });
            }
        }

        else if (typeof input[key] !== 'null' && typeof input[key] === 'object') { //for nested input

            if (key == 'user') {
                query_models.posts.attributes.push('uid');
            }
            else if (key == 'comment') {
                continue;
            }
            else {
                var obj = inputParser(input[key], that);
                query_models = _.assign(query_models, obj);
            }
        }

        else if (typeof input[key] === "boolean") {
            if (key == 'embeddedUrl') {
                query_models.posts.attributes.push('fetched_url_id');
                query_models.fetched_url = { model: models.fetched_url, attributes: ['id', 'title', 'description', 'url', 'host', 'provider', 'scheme', 'imagePath', 'imageThumbSize', 'imageName', 'imageExtension'] };
            }
            else if (key == 'location') {
                query_models.posts.attributes.push('user_defined_location_id');
                query_models.user_defined_location = { model: models.user_defined_location, attributes: ['id', 'formatted_address', 'locality', 'administrative_area_level_1', 'country'] };
            }
        }
    }

    return query_models;
}
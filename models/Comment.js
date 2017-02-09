//###############################################################
//######################### Require #############################
//###############################################################

var _ = require('lodash');
var Promise = require("bluebird");
var models = require('../models');
var Media = require('../models/Media');
var User = require('../models/User');

//###############################################################
//######################## Constructor ##########################
//###############################################################

Comment = function (id, session_uid) {

    if (_.isInteger(id))
        this.id = id;
    else
        throw new Error('INVALID_TYPE, only integer is allowed');

    if (session_uid != null)
        this.session_uid = session_uid;
}

module.exports = Comment;

//###############################################################
//######################## Properties ###########################
//###############################################################

Comment.prototype.pagination = {
    offset: 0,
    limit: 5
}

//###############################################################
//###################### Static Methods #########################
//###############################################################

//get comment/comments
Comment.getList = function (input, comment_ids, session_uid) {

    var comments = { id: comment_ids };

    if (session_uid != null)
        comments.session_uid = session_uid;

    return queryExecutor(input, comments);
}

//###############################################################
//###################### Public Methods #########################
//###############################################################

Comment.prototype.get = function (input) {
    return queryExecutor(input, this);
}

//###############################################################
//##################### Private Functions #######################
//###############################################################

//render function for raw data
function render(_this, rawData) {

    var comments = [];

    if (!Array.isArray(rawData))
        rawData = new Array(rawData);

    return Promise.map(rawData, function (_comment) {

        //create instance(s) depend on data
        var comment = rawData.length == 1 ? _this : new Comment(_comment.id);

        //id
        if (_comment.id)
            comment.id = _comment.id;

        //post_id
        if (_comment.parent_id)
            comment.post_id = _comment.parent_id;

        if (_comment.comment_txt)
            comment.comment = _comment.comment_txt;

        if (_comment.parent_type)
            comment.parent_type = _comment.parent_type;

        if (_comment.status)
            comment.status = _comment.status;

        if (_comment.comment_type)
            comment.comment_type = _comment.comment_type;

        //created date
        if (_comment.created)
            comment.created = _comment.created;

        //mentioned users list
        if (_comment.mentionList)
            comment.mentionList = _comment.mentionList;

        //shared URL meta
        if (_comment.fetched_url) {
            comment.fetched_url = _.pick(_comment.fetched_url, ['id', 'url', 'host', 'title', 'description', 'scheme', 'provider', 'image', 'thumb']);
        }
        if (_comment.file_id) {
            comment.file_id = _comment.file_id;
        }
        if (_comment.image) {
            comment.image = _comment.image;
        }
        //user
        if (_comment.user) {
            comment.user = _comment.user;
        }
        comments.push(comment);
        return;

    }).then(function () {
        return comments;
    });
}

//executes sequelize query and merge media into it
function queryExecutor(input, that) {
    var _query = queryGenerator(input, that);

    //execute goal query
    return models.comments.findAll(_query).then(function (_commentRaw) {

        //if no goal was found
        if (_.isEmpty(_commentRaw))
            return [];

        var mediaObj = new Media();
        mediaObj.id = _.compact(_.uniq(_.map(_commentRaw, _.iteratee('file_id'))));

        return mediaObj.get().then(function (media_array) {
            _.forEach(_commentRaw, function (value, key) {
                value.image = _.head(_.filter(media_array, function (o) { return o.id == value.file_id; }));
            });
            return _commentRaw;
        });

    }).then(function (_commentRaw) {
        //USERS
        var uids = _.compact(_.uniq(_.map(_commentRaw, _.iteratee('uid'))));

        var input_user = { basic: ['name', 'username', 'link'], profile: ['small', 'medium'] };
        return User.getList(input_user, uids, null).then(function (users) {
            _.forEach(_commentRaw, function (value, key) {
                value.user = _.head(_.filter(users, function (o) { return o.uid == value.uid; }));
            });

            return _commentRaw;
        });
    }).then(function (_commentRaw) {
        //MENTIONED USERS
        var CommentsIds = _.compact(_.uniq(_.map(_commentRaw, _.iteratee('id'))));
        if (!_.isEmpty(CommentsIds)) {
            return models.mentioned_comment.findAll({ attributes: ['mentioned_uid', 'comment_id'], where: { comment_id: CommentsIds } }).then(function (comment_mentions) {
                var Users = _.compact(_.uniq(_.map(comment_mentions, _.iteratee('mentioned_uid'))));
                if (!_.isEmpty(Users)) {

                    var userInput = {
                        basic: ['name', 'username', 'link'],
                        profile: ['small', 'medium'],
                    };

                    return User.getList(userInput, Users, null).then(function (users) {
                        _.forEach(_commentRaw, function (value, key) {
                            value.mentionList = []
                            _.forEach(comment_mentions, function (mention, k) {
                                if (value.id == mention.comment_id) {
                                    value.mentionList.push(_.head(_.filter(users, function (o) { return o.uid == mention.mentioned_uid; })))
                                }
                            })
                        });
                        return _commentRaw;
                    })
                } else {
                    _.forEach(_commentRaw, function (value, key) { // temporary for current mobile app and web
                        value.mentionList = [];
                    });  // temporary for current mobile app and web
                    return _commentRaw;
                }
            })
        } else {
            return _commentRaw;
        }
    }).then(function (_commentRaw) {
        return render(that, _commentRaw);
    });

}

//generates sequelize query
function queryGenerator(input, that) {

    //parse input
    var _queryModels = inputParser(input, that);
    //add "get user" condition into query
    if (that.id != null)
        _queryModels.comments.where.id = that.id;

    //create sequelize query
    var _query = {
        where: _queryModels.comments.where,
        attributes: _queryModels.comments.attributes,
        include: _.values(_.omit(_queryModels, 'comments')),
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
                query_models.comments = {
                    where: { status: ['ACTIVE'], id: that.id },
                    attributes: ['id', 'parent_id', 'comment_txt', 'parent_type', 'comment_type', 'status', 'created'],
                };
            }
        }

        else if (typeof input[key] !== 'null' && typeof input[key] === 'object') {  //for nested input

            if (key == 'user') {
                query_models.comments.attributes.push('uid');
            }
            else {
                var obj = inputParser(input[key], that);
                query_models = _.assign(query_models, obj);
            }
        }

        else if (typeof input[key] === "boolean") {
            if (key == 'embeddedUrl') {
                query_models.comments.attributes.push('fetched_url_id');
                query_models.fetched_url = { model: models.fetched_url, attributes: ['id', 'title', 'description', 'url', 'host', 'provider', 'scheme', 'imagePath', 'imageThumbSize', 'imageName', 'imageExtension'] };
            }
            else if (key == 'image') {
                query_models.comments.attributes.push('file_id');
            }
        }
    }

    return query_models;
}

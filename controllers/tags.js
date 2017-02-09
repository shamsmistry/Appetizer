var clasAllTables = require('../models/alltables');
var objAllTables = clasAllTables.allTables;
var helpers = require('../helpers/helpers');
var db = require('../helpers/db');
var validator = require('validator');
var Promise = require("bluebird");
var config = require('../config');
var speakingurl = require('speakingurl');
var validate = require("validate.js");
var utils = require('../helpers/Utils');
var _ = require('lodash');

exports.getTag = function(id, isSubCategory, sessionId, limit, offset) {

    var seq = db.sequelizeConn();
    var sqlQuery = "";
    if (isSubCategory == true)
        sqlQuery = "SELECT t.tag_id as 'id'\
        , t.tagname as 'name'\
        , CONCAT('categories/', cat.category_route, '/',\
        REPLACE(t.tagname, ' ', '-')) as 'link'\
        , t.icon_class as 'icon'\
        , t.description as 'description' \
        , t.image_id as 'image_id'\
        , t.category_id as 'category_id'\
    FROM tags t\
    JOIN default_category cat \
    on cat.category_id = t.category_id \
    WHERE t.tag_id = {0} AND IsSubCategory = 1".format(id);

    else
        sqlQuery = "SELECT t.tag_id as 'id'\
        , t.tagname as 'name'\
        , CONCAT('categories/', cat.category_route, '/',\
        REPLACE(t.tagname, ' ', '-')) as 'link'\
        , t.icon_class as 'icon'\
        , t.description as 'description' \
         , t.image_id as 'image_id'\
        , t.category_id as 'category_id'\
    FROM tags t\
    JOIN default_category cat \
    on cat.category_id = t.category_id \
    WHERE t.tag_id = {0}".format(id);


    var tags = objAllTables.tags.tags();
    return seq.query(sqlQuery, { model: tags })
        .then(function(tag) {
            if (tag.length > 0) {
                tag = tag[0].dataValues;
                var fileId = tag.image_id;
                return new Promise(function(resolve) {
                        //attaching media
                        return helpers.getMediaObject(fileId)
                            .then(function(mediaObj) {
                                tag['media'] = mediaObj;
                                resolve(tag);
                            });
                    })
                    .then(function(tag) {
                        // embedding goals
                        var GoalTags = objAllTables.goals_tags.goals_tags();
                        return GoalTags.findAll({
                            offset: offset,
                            limit: limit,
                            where: { tag_id: tag.id, status: 'ACTIVE' }
                        }).then(function(IDS) {
                            var goal_ids = [];
                            for (var i = 0; i < IDS.length; i++)
                                goal_ids.push(IDS[i].goal_id);
                            return helpers.getGoalList(goal_ids, sessionId, true)
                                .then(function(goals) {
                                    tag['goals'] = goals;
                                    return tag;
                                })
                        });
                    });

            } else {
                return tag;
            }
        });
};

exports.getAll = function(req, res) {
    /*
     get all tags, if no tags found respond with 404
     */
    var seq = db.sequelizeConn();
    var sqlQueryGetAllTags = "SELECT tag_id as id, tagname FROM `tags` WHERE and `status` = 'ACTIVE'";
    seq.query(sqlQueryGetAllTags)
        .then(function(tag) {
            if (tag.length > 0) {
                res.send({ meta: { status: 200, message: "Success" }, data: tag[0] });
            } else {
                res.send({ meta: { status: 404, message: "no tags found" } });
            }
        }).error(function(err) {
            res.send({ meta: { status: 500, message: "linkagoal server internal error" } });
        });
};

exports.searchTags = function(keyword, limit, offset) {

    var querySearchTags;
    querySearchTags = "SELECT  tag_id as id, tagname FROM `tags`\
                            WHERE `status` = 'ACTIVE' and tagname like '%{0}%'\
                            limit {1} offset {2}".format(keyword, limit, offset);

    /*} else {
     console.log("second");
     querySearchTags = "SELECT  tag_id as id, tagname FROM `tags`\
     WHERE IsSubCategory = 0 and `status` = 'ACTIVE' and tagname like '%{0}%'\
     limit {1} offset {2}".format(keyword, newoffset, newlimit);

     }*/

    var sequelize = db.sequelizeConn();
    return sequelize.query(querySearchTags, { type: sequelize.QueryTypes.SELECT })
        .then(function(tags) {
            return tags;
        }).error(function(err) {
            new Error(err);
        });
};

exports.search = function(req, res) {

    var suggestion = req.query.suggestion;
    var pagination = utils.pagination(req);
    /* if (validator.isNull(suggestion)) {
     errors.push(helpers.generateErrorObject(1001, 'keyword', 'no keyword provided to search'));
     }
     else if (validator.contains(suggestion.toString().trim(), ' ')) {
     errors.push(helpers.generateErrorObject(1001, 'keyword', 'keyword can not contain space character'));
     }
     else if (validator.isLength(suggestion.toString().trim(), 0, 2)) {
     errors.push(helpers.generateErrorObject(1001, 'keyword', 'search does not work for word having less than 3 characters'));
     }*/

    var tags = require('../controllers/tags');

    tags.searchTags(suggestion, pagination.limit, pagination.offset)
        .then(function(tags) {
            if (tags != null && tags.length > 0)
                res.send({ meta: { status: 200 }, message: "success", data: tags });
            else
                res.send({ meta: { status: 404, message: 'no tags found' } });
        }).error(function(err) {
            res.send({ meta: { status: 500, message: 'unexpected error' } });
        }).catch(function(err) {
            res.send({ meta: { status: 500, message: 'unexpected error' } });
        });

};

exports.getGoalsOnTag = function(req, res) {

    var constraints = {
        "params.tagname": {
            presence: true,
        }
    };

    validate.async(req, constraints).then(success, error);

    function success() {
        helpers.getActiveSession(req).then(function (SessionUser) {
            if (_.eq(SessionUser.type, 'Recognized') || _.eq(SessionUser.type, 'UnRecognized')) {

                var tagName = req.params.tagname || "";
                tagName = tagName.trimSpace().makeSQLInjectionSafe();
                var data = {};
                data.tag = {};
                data.goals = [];

                var pagination = utils.pagination(req);

                if (tagName != null) {
                    var sequelize = db.sequelizeConn();

                    var sqlQuery = "SELECT \
                                    NULL as goal_id, t.tag_id, t.tagname, t.isFeatured, t.isDisplayable, t.icon_class,\
                                    t.default_color, t.description, t.question, t.image_id, t.bannerImage_id, t.action_text\
                                from \
                                    tags t\
                                WHERE \
                                    t.`status` = 'ACTIVE' and LOWER(t.tagname) = LOWER('{0}')\
                                UNION\
                                SELECT * FROM ( \
                                SELECT \
                                    gt.goal_id, NULL as tag_id, NULL as tagname, NULL as isFeatured, NULL as isDisplayable, NULL as icon_class, NULL as default_color, NULL as description, NULL as question, NULL as image_id, NULL as bannerImage_id, NULL as action_text \
                                    FROM \
                                    tags t \
                                LEFT JOIN goals_tags gt \
                                    on gt.tag_id = t.tag_id\
                                WHERE \
                                    t.`status` = 'ACTIVE' and gt.`status` = 'ACTIVE' and LOWER(t.tagname) = LOWER('{0}') ORDER BY goal_id DESC LIMIT {1}, {2}) as fn ".format(tagName, pagination.offset, pagination.limit);

                    sequelize.query(sqlQuery, { type: sequelize.QueryTypes.SELECT }).then(function(goalsList) {
                            if (goalsList.length > 0) {
                                //build "tag" object from result
                                //var tag = {};
                                return utils.fixTags([goalsList[0]]).then(function(result) {
                                    data.tag = result[0];
                                    return goalsList;
                                })
                            } else {
                                data.tag = { tagname: tagName };
                                throw new Error('abort promise chain');
                            }
                        }).then(function(goalsList) {

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
                            var goal_ids = _.compact(_.uniq(_.map(goalsList, _.iteratee('goal_id'))));
                            if (goal_ids.length > 0) {
                                return Goal.getList(goalInput, goal_ids , SessionUser.uid ).then(function(goals){
                                    data.goals = goals;
                                    return data;
                                })
                            } else {
                                data.goals = [];
                                return data;
                            }
                        })
                        .then(function(data) {
                            res.send(200, { meta: { status: 200, message: 'success' }, data: data });
                        })
                        .catch(function(err) {
                            if (err.message === 'abort promise chain') {
                                res.send(200, { meta: { status: 200, message: 'no goals are tagged with this tag' }, data: data });
                            } else {
                                res.send(500, { meta: { status: 500, message: 'internal error' }, details: err });
                            }
                        });
                } else {
                    res.send({ meta: { status: 401, message: 'keyword required to be search for' } });
                }
            }
        });
    }

    function error(errors) {
        if (errors instanceof Error) {
            // This means an exception was thrown from a validator
            res.send(401, { meta: { status: 401, message: 'An error ocuured in validator' }, errors: errors });
        } else {
            res.send(401, { meta: { status: 401, message: 'validation errors' }, errors: errors });
        }
    }
};

exports.edit = function(req, res) {

    var constraints = {
        "params.id": {
            presence: true,
            numericality: {
                noStrings: false
            }
        },
        "body.tagname": {
            presence: false,
            length: {
                minimum: 1,
                maximum: 60
            }
        },
        "body.isFeatured": {
            presence: false,
            numericality: {
                onlyInteger: true
            }
        },
        "body.isDisplayable": {
            presence: false,
            numericality: {
                onlyInteger: true
            }
        },
        "body.default_color": {
            presence: false,
            length: {
                is: 7
            }
        },
        "question": {
            presence: false,
            length: {
                maximum: 255
            }
        },
        "body.bannerImage_id": {
            presence: false,
            numericality: {
                onlyInteger: true
            }
        },
        "body.action_text": {
            presence: false,
            length: {
                maximum: 255
            }
        }
    };
    validate.async(req, constraints).then(success, error);

    function success() {
        helpers.getActiveSession(req)
            .then(function(sessionUser) {
                if (sessionUser.type == 'Recognized') {
                    var tags = objAllTables.tags.tags();

                    return tags.update(req.body, {
                            where: { tag_id: parseInt(req.params.id), status: 'ACTIVE' }
                        })
                        .then(function(rowsAffected) {
                            if (rowsAffected[0] == 1) {
                                res.send(200, { meta: { status: 200, message: 'OK' } });
                            } else {
                                res.send(500, {
                                    meta: { status: 500, message: 'could not update' },
                                    details: 'updated rows ' + rowsAffected[0]
                                });
                            }
                        });
                }
                //session user is null
                else {
                    res.send(401, { meta: { status: 401, message: 'user is not logged in or invalid token' } });
                }
            }).error(function(err) {
                res.send(500, { meta: { status: 500, message: 'internal error' }, details: err });
            })
            .catch(function(err) {
                res.send(500, { meta: { status: 500, message: 'internal error' }, details: err });
            });;
    }

    function error(err) {
        res.send(401, { status: 401, message: err })
    }
};

exports.insertUserTags = function(req, res) {

    var constraints = {
        "body.tags": {
            presence: true
        }
    }

    validate.async(req, constraints).then(success, error);

    function success() {
        helpers.getActiveSession(req).then(function (SessionUser) {
            if (SessionUser.type == 'Recognized') {
                var tags = req.body.tags || '',
                    myNewTags = [],
                    myNewTagIds = [];

                var extractedTags = helpers.splitGetHashTag(tags);
                new Promise.map(extractedTags, function(tagname) {
                    return helpers.getTagid(tagname).then(function(tag) {
                        if (tag != null) {
                            myNewTags.push(tag)
                            myNewTagIds.push(tag.get('tag_id'))
                        }
                        return myNewTags;
                    });
                }).then(function(result) {
                    var UserInterestTagsTbl = objAllTables.user_interest_tags.user_interest_tags();
                    var tagsResults = [];
                    if (!_.isEmpty(myNewTagIds))
                        return UserInterestTagsTbl.findAll({ where: { tag_id: myNewTagIds, uid: SessionUser.uid } }).then(function(result) {

                            var foundTags = [];
                            _(result).forEach(function(value) {
                                foundTags.push(value.get('tag_id'))
                            });

                            newTags = _.uniqBy(_.differenceBy(myNewTagIds, foundTags));

                            var Insertion = [];
                            _(newTags).forEach(function(v) {
                                Insertion.push({ uid: SessionUser.uid, tag_id: v, status: 'ACTIVE', created: helpers.getUnixTimeStamp(), updated: helpers.getUnixTimeStamp() })
                            })

                            return UserInterestTagsTbl.bulkCreate(Insertion).then(function(result) {
                                return UserInterestTagsTbl.update({ status: 'ACTIVE', updated: helpers.getUnixTimeStamp() }, { where: { $and: [{ tag_id: foundTags }, { uid: SessionUser.uid }] } });
                            });
                        }).then(function(result) {
                            _(myNewTags).forEach(function(t) {
                                tagsResults.push({id:t.tag_id, name: t.tagname, isMyInterest:1 })
                            })
                            return tagsResults;
                        }).then(function(tags) {
                            res.send(200, { meta: { status: 200, message: 'OK' }, data: tags })
                        })
                    else
                        res.send(405, { meta: { status: 405, message: 'Bad Request' } })
                });
            } else {
                res.send({ meta: { status: 401, message: 'Unauthorized' } });
            }
        })
        .error(function(err) {
            res.send({ meta: { status: 500, message: 'Unexpected Error' }, details: err });
        });
    }

    function error(err) {
        res.send(405, { status: 405, message: "Bad Request" });
    }
}

exports.getTagInfo = function(req, res) {

    var constraints = {
        "params.id": {
            presence: true,
            numericality: {
                noStrings: false
            }
        },
    }

    validate.async(req, constraints).then(success, error);

    function success() {
        var tag_id = req.params.id;

        var UserInterestTagsTbl = objAllTables.user_interest_tags.user_interest_tags();
        var TagsTbl = objAllTables.tags.tags();
        var sequelize = db.sequelizeConn();

        TagsTbl.hasMany(UserInterestTagsTbl, { as: 'users', foreignKey: 'tag_id' });

        helpers.getActiveSession(req).then(function(SessionUser) {
            if (SessionUser.type == 'Recognized' || SessionUser.type == 'UnRecognized') {
                TagsTbl.findOne({
                    attributes: ['tag_id', 'tagname', 'isFeatured', 'isDisplayable', 'description', ].concat([
                        [
                            sequelize.literal('(SELECT COUNT(`user_interest_tags`.`tag_id`) FROM `user_interest_tags` WHERE `user_interest_tags`.`tag_id` = `tags`.`tag_id` AND user_interest_tags.uid = {0})'.format(SessionUser.uid)),
                            'isMyInterest'
                        ],
                        [
                            sequelize.literal('(SELECT COUNT(`user_interest_tags`.`tag_id`) FROM `user_interest_tags` WHERE `user_interest_tags`.`tag_id` = `tags`.`tag_id` AND `user_interest_tags`.`status` = "ACTIVE")'),
                            'followers'
                        ],
                        [
                            sequelize.literal('(SELECT COUNT(`goals_tags`.`tag_id`) FROM `goals_tags` WHERE `goals_tags`.`tag_id` = `tags`.`tag_id` AND `goals_tags`.`status` = "ACTIVE")'),
                            'goals'
                        ]
                    ]),
                    include: [{ as: 'users', model: UserInterestTagsTbl, offset: 0, limit: 3, order: 'created DESC', where: { status: 'ACTIVE' } }],
                    where: { tag_id: tag_id }
                }).then(function(tag) {
                    if (tag != null)
                        return new Promise.map(tag.users, function(v) {
                            return helpers.getUserMini(v.uid, SessionUser.uid, true).then(function(user) {
                                v.dataValues = user;
                            });
                        }).then(function(users) {
                            return tag;
                        })
                }).then(function(tag) {
                    res.send(200, { meta: { status: 200, message: 'OK' }, data: tag })
                })
            }
        })
    }

    function error(err) {
        res.send(401, { status: 401, message: err })
    }
}

exports.getTagUsers = function(req, res) {
    var constraints = {
        "params.id": {
            presence: true,
            numericality: {
                noStrings: false
            }
        }
    }

    validate.async(req, constraints).then(function() {
        var tag_id = req.params.id;
        var pagination = utils.pagination(req);
        var UserInterestTagsTbl = objAllTables.user_interest_tags.user_interest_tags();

        helpers.getActiveSession(req).then(function(SessionUser) {
            if (SessionUser.type == 'Recognized' || SessionUser.type == 'UnRecognized') {
                UserInterestTagsTbl.findAll({ where: { tag_id: tag_id, status: 'ACTIVE' }, offset: pagination.offset, limit: pagination.limit, order: 'created DESC' }).then(function(users) {
                    if (users != null)
                        return new Promise.map(users, function(u) {
                            return helpers.getUserMini(u.uid, SessionUser.uid, true).then(function(user) {
                                u.dataValues = user;
                            });
                        }).then(function() {
                            return users;
                        })
                }).then(function(users) {
                    res.send(200, { meta: { status: 200, message: 'OK' }, data: users })
                })
            }
        })
    }, function(err) {
        res.send(401, { status: 401, message: err })
    });
}

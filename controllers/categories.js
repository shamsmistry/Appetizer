var clasAllTables = require('../models/alltables');
var helpers = require('../helpers/helpers');
var db = require('../helpers/db');
var models = require('../models');

//npm
var Promise = require("bluebird");
var validator = require('validator');
var categories = require('../controllers/categories');
var config = require('../config');
var tags = require('../controllers/tags');
var validate = require("validate.js");

var Utils = require('../helpers/Utils');
var chalk = require('chalk');
var _ = require('lodash');

var objAllTables = clasAllTables.allTables;
var sequelize = db.sequelizeConn();

exports.getCategory = function (id, sort, getCategoryAssociatedTags, getGoals, sessionId, pagination) {

    var seq = db.sequelizeConn();
    var tableCategories = objAllTables.default_category.default_category(); //Import ORM default_category model

    var condition = {};
    if (validator.isInt(id)) {
        condition = { category_id: id }
    } else {
        condition = { category_route: id }
    }

    return tableCategories.findOne({ where: condition }).then(function (category) {
        if (category == null) {
            throw new Error("Category not found");
        }
        return categories.fixCategory(category).then(function (fixedCategory) {
            return fixedCategory;
        });
    }).then(function (category) {
        //get subcategories
        if (getCategoryAssociatedTags == true) {

            var sqlQuery = "SELECT t.tag_id as 'id'\
                                ,t.tagname as 'name'\
                                ,CONCAT('category/', c.category_route, '/', REPLACE(t.tagname, ' ', '-')) as 'link'\
                                ,t.icon_class as 'icon_class'\
                                ,t.default_color as 'color'\
                                ,t.description as 'description'\
                                ,(SELECT COUNT(`user_interest_tags`.`tag_id`) FROM `user_interest_tags` WHERE `user_interest_tags`.`tag_id` = `t`.`tag_id` AND user_interest_tags.uid = {0}) as isMyInterest\
                                ,t.image_id as 'image_id'\
                                ,t.created as 'timestamp'\
                            FROM category_tags ct\
                            JOIN default_category c\
                            ON c.category_id = ct.category_id\
                            JOIN tags t\
                            ON ct.tag_id = t.tag_id\
                            WHERE ct.category_id = {1} and ct.`status` = 'ACTIVE'".format(sessionId, category.id);

            var sequelize = db.sequelizeConn();
            return sequelize.query(sqlQuery, { type: sequelize.QueryTypes.SELECT })
                .then(function (associatedTags) {
                    return new Promise(function (resolve) {
                        if (associatedTags != null) {
                            var promiseFor = Promise.method(function (condition, action, value) {
                                if (!condition(value)) return value;
                                return action(value).then(promiseFor.bind(null, condition, action));
                            });
                            promiseFor(function (count) {
                                return count < associatedTags.length;
                            }, function (count) {
                                //attaching media object
                                return new Promise(function (resolve) {
                                    var fileId = associatedTags[count].image_id;
                                    return helpers.getMediaObject(fileId).then(function (mediaObj) {
                                            //associatedTags[count].media = mediaObj;
                                            associatedTags[count].media = helpers.getMediaObject_Fix(mediaObj, null, ['small', 'medium']);
                                            resolve(associatedTags[count]);
                                        });
                                }).then(function () {
                                    return ++count;
                                })
                            }, 0).then(function () {
                                category['tags'] = associatedTags;
                                resolve(category);
                            });
                        }
                    }).then(function (category) {
                        return category
                    });
                });
        }
        else {
            return category;
        }
    }).then(function (category) {
        //get goals if any bemongs to this category
            if (getGoals == true) {
                //var Goals = objAllTables.goals.goals();
                return models.goals.findAll({
                    where: {
                        category_id: category.id, $and: [
                            sequelize.literal('CheckPrivacy_Goal({0}, goal_id) = 1'.format(sessionId))]
                    },
                    offset: pagination.offset, limit: pagination.limit,
                    order: 'goal_id DESC'
                }).then(function (IDS) {
                    var goal_ids = [];
                    for (var i = 0; i < IDS.length; i++)
                        goal_ids.push(IDS[i].goal_id);

                    return helpers.getGoalList(goal_ids, sessionId, true).then(function (goals) {
                            //category['dataValues']['goals'] = goals;
                            category['goals'] = goals;
                            return category;
                        });
                });
            }
            else
                return category;

        }).catch(function (err) {
            if (err.message == "Category not found") {
                return false;
            }
        });
};

exports.fixCategory = function (category) {

    var categoryFixedObject = {};
    return new Promise(function (resolveFixCategoryObject) {

        //fix category object here an
        //then resolve it to then
        //for appending tags information in it

        categoryFixedObject.id = category.category_id;
        categoryFixedObject.name = category.category_name;
        categoryFixedObject.link = new Array(config.webURL.domain, 'category', category.category_route).toURL();
        categoryFixedObject.icon = category.default_icon;
        categoryFixedObject.message = category.custom_message;
        categoryFixedObject.color = category.default_color;

        return helpers.getMediaObject(category.default_image_id)
            .then(function (mediaObj) {
                categoryFixedObject.image = helpers.getMediaObject_Fix(mediaObj, null, ['small', 'medium']);
                resolveFixCategoryObject(category);
            });
    })
        .then(function (category) {

            //checking if category object contains 'tags' key
            if ('undefined' !== typeof category['tags']) {
                var tagFixedArray = [];
                var tagsLength = 0;
                tagsLength = category.tags.length;

                //checking if category object contains tags
                if (tagsLength > 0) {

                    //hence category contains tags
                    //so first finds whether tags contains
                    //images if contain images than
                    //append to image object and return
                    //other wise return tags

                    return new Promise(function (resolveTagArray) {
                        var promiseFor = Promise.method(function (condition, action, value) {
                            if (!condition(value)) return value;
                            return action(value).then(promiseFor.bind(null, condition, action));
                        });

                        promiseFor(function (count) {
                            return count < tagsLength;
                        }, function (count) {

                            return new Promise(function (resolve) {

                                //here attaching media in each tag of
                                //respective category, also fixing each tag object
                                var tagFixedObject = {};
                                tagFixedObject.id = category.tags[count].dataValues.tag_id;
                                tagFixedObject.name = category.tags[count].dataValues.tagname;
                                tagFixedObject.default_color = category.tags[count].dataValues.default_color;
                                tagFixedObject.isMyInterest = category.tags[count].dataValues.isMyInterest;
                                tagFixedObject.media = {};  // object where tag image object will be append
                                var tagImageId = category.tags[count].dataValues.image_id;

                                //attaching media object in tags
                                return helpers.getMediaObject(tagImageId)
                                    .then(function (mediaObj) {

                                        //here attaching media in each tag,
                                        //also pushing each fixed tag object
                                        //to tag array in order to append in
                                        //respective category

                                        tagFixedObject.image = helpers.getMediaObject_Fix(mediaObj, null, ['small', 'medium']);
                                        tagFixedArray.push(tagFixedObject);
                                        resolve(null);
                                    });
                            })
                                .then(function () {
                                    return ++count;
                                })
                        }, 0)
                            .then(function () {
                                //now appending the fixed tag objects array
                                //to category
                                categoryFixedObject.tags = tagFixedArray;
                                resolveTagArray(categoryFixedObject);
                            });
                    })
                        .then(function (categoryFixedObject) {

                            //hence category object is complete
                            //with tags and its media
                            //so return category object back
                            return categoryFixedObject;
                        });
                } else {
                    //hence category not contain
                    //tags so return fixed category object back
                    categoryFixedObject.tags = category.tags;
                    return categoryFixedObject;
                }
            } else {

                return categoryFixedObject;
            }
        });

};

exports.fixTagObject = function (tag) {


    return new Promise(function (resolve, reject) {
        newTagObject = {}
        newTagObject.id = tag.tag_id;
        newTagObject.name = tag.tagname;
        newTagObject.color = tag.default_color;
        newTagObject.media = {};

        resolve(newTagObject);

    });

    // return helpers.getMediaObject(tag.image_id).then(function (image_media) {
    //     newTagObject.media.image = image_media;
    //     return newTagObject;
    // });
};

exports.getAllCategoriesWithSubcategories = function (req, res) {

    var sort = req.query.sort;
    var category_id = req.params.id;
    var sessionId = null;

    helpers.GetActiveSession_ORM(req)
        .then(function (SessionUser) {

            if (SessionUser != null)
                sessionId = SessionUser.uid;
            else
                sessionId = -1;

            var tableCategories = objAllTables.default_category.default_category();
            var category_tags = objAllTables.category_tags.category_tags();
            var MainTags = objAllTables.tags.tags();

            var CategoriesTags = tableCategories.belongsToMany(MainTags, {
                as: 'tags',
                through: category_tags,
                foreignKey: 'category_id'
            });

            var Tags = MainTags.belongsToMany(tableCategories, {
                through: category_tags,
                foreignKey: 'tag_id'
            });

            return tableCategories.findAll({
                limit: 9, offset: 0,
                order: 'category_id ASC',
                attributes: ['category_id', 'category_name', 'category_route', 'default_image_id', 'default_color'],
                include: [{
                    association: CategoriesTags, attributes: ['tag_id', 'tagname', 'default_color', 'image_id'].concat([
                        [
                            sequelize.literal('(SELECT COUNT(`user_interest_tags`.`tag_id`) FROM `user_interest_tags` WHERE `user_interest_tags`.`tag_id` = `tags`.`tag_id` AND user_interest_tags.uid = {0})'.format(sessionId)),
                            'isMyInterest'
                        ]
                    ])
                    , through: { attributes: [] }
                }]
            })
                .then(function (Categories) {
                    return Categories;
                })
                .then(function (Categories) {
                    var CATEGORIES = [];
                    if (Categories.length > 0) {
                        Promise.each(Categories, function (categoryObj) {
                            return categories.fixCategory(categoryObj)
                                .then(function (fixedCategory) {
                                    CATEGORIES.push(fixedCategory);
                                });
                        }).then(function (result) {
                            res.send({ meta: { status: 200, message: 'success' }, data: CATEGORIES });
                        });
                    } else {
                        res.send({ meta: { status: 404, message: 'No categories exists' } });
                    }
                });

        })
        .error(function (err) {
            res.send({ meta: { status: 500, message: 'unexpected error' }, details: err });
        });
}

//#############################################################
//########################### APIs ############################
//#############################################################

exports.getCategories = function (req, res) {

    var sort = req.query.sort;
    var category_id = req.params.id;

    helpers.GetActiveSession_ORM(req)
        .then(function (SessionUser) {
            var sessionId;

            if (SessionUser != null)
                sessionId = SessionUser.uid;
            else
                sessionId = -1;

            var tableCategories = objAllTables.default_category.default_category();
            var CATEGORIES = [];
            tableCategories.findAll().then(function (Categories) {
                if (Categories.length > 0) {
                    var promiseFor = Promise.method(function (condition, action, value) {
                        if (!condition(value)) return value;
                        return action(value).then(promiseFor.bind(null, condition, action));
                    });

                    promiseFor(function (count) {
                        return count < Categories.length;
                    }, function (count) {

                        return categories.fixCategory(Categories[count])
                            .then(function (fixedCategory) {

                                CATEGORIES.push(fixedCategory);
                                return ++count;
                            });

                    }, 0)
                        .then(function () {
                            res.send(200, { meta: { status: 200, message: 'success' }, data: CATEGORIES });
                        }
                        );
                }
                else {
                    res.send(404, { meta: { status: 404, message: 'No categories exists' } });
                }

            })
                .error(function (err) {
                    res.send(500, { meta: { status: 500, message: 'linkagoal server internal error' } });
                });
        })
        .error(function (err) {
            res.send(500, { meta: { status: 500, message: 'unexpected error' }, details: err });
        });
}

exports.getCategoryById = function (req, res) {

    var constraints = {
        "params.id": {
            presence: true
        }
    };

    validate.async(req, constraints).then(success, error);

    function success() {
        helpers.getActiveSession(req).then(function (SessionUser) {

            if (SessionUser.type == 'Recognized' || SessionUser.type == 'UnRecognized') {

                var sort = req.query.sort;
                var category_id = (req.params.id);
                var pagination = Utils.pagination(req);
                var response = {}

                _category = new Category(category_id, SessionUser.uid);

                new Promise(function(resolve, reject){ // Get Category
                    var input = {
                        basic: ['link', 'color', 'icon', 'message']
                    }
                    return _category.get(input).then(function(_singleCategory){
                        if (!_.isEmpty(_singleCategory)) {
                            response = _singleCategory[0];
                            _category.id = _singleCategory[0].id;
                        }
                        resolve();
                    })
                }).then(function(){
                    if (_.isEmpty(response)) return [];
                    var input = {
                        basic: ['name', 'color', 'link', 'isMyInterest']
                    }
                    return _category.getTags(input).then(function(_tags){
                        response.tags = _tags;
                        return;
                    })
                }).then(function(){
                    if (_.isEmpty(response)) return [];
                    return models.goals.findAll({
                        attributes : ['goal_id'],
                        where: {
                            category_id: _category.id, $and: [sequelize.literal('CheckPrivacy_Goal({0}, goal_id) = 1'.format(SessionUser.uid))]
                        },
                        offset: pagination.offset, limit: pagination.limit,
                        order: 'goal_id DESC'
                    }).then(function (goals) {
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
                        };
                        var goalIds = _.compact(_.uniq(_.map(goals, _.iteratee('goal_id'))));
                        return Goal.getList(goalInput, goalIds, SessionUser.uid).then(function(goalsList){
                            // both can be used for ordering
                            //response.goals = _.orderBy(goalsList, ['id'], ['desc']);
                            response.goals = [];
                            // For same order as goals were fetched
                            _.forEach(goalIds, function(value, key){
                                response.goals[key] = _.head(_.filter(goalsList, function (o) { return o.id == value; }));
                            });
                        });
                    });
                }).then(function(){
                    if (!_.isEmpty(response)) {
                        res.send(200, { meta: { status: 200, message: 'Success' }, data: response });
                    } else {
                        res.send(404, { meta: { status: 404, message: 'Not Found' } });
                    }
                })
            }
            //validation errors exist, send response
            else {
                res.send(401, { meta: { status: 401, message: 'validation errors' }, errors: errors });
            }
        })
        .error(function (err) {
            res.send(500, { meta: { status: 500, message: 'unexpected error' }, details: err });
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
}

exports.getGoalsByCategoryAndTag = function (req, res) {

    var constraints = {
        "params.tag": {
            presence: true,
        },
        "params.categoryName": {
            presence: true
        }
    };

    validate.async(req, constraints).then(success, error);

    function success() {

        //var subcategory_id = req.params.id;
        helpers.getActiveSession(req).then(function (SessionUser) {
            if (SessionUser.type == 'Recognized' || SessionUser.type == 'UnRecognized') {

                var errors = [];
                var category_parameter = req.params.categoryName;
                var tagName_parameter = req.params.tag;

                var pagination = Utils.pagination(req);

                var response = {};
                var goalIds = [];

                var sqlQuery = "SELECT g.goal_id, t.tag_id\
                            FROM goals g\
                            JOIN default_category cat\
                                on cat.category_id = g.category_id\
                            JOIN goals_tags gt\
                                on gt.goal_id = g.goal_id\
                            JOIN tags t\
                                on t.tag_id = gt.tag_id\
                            WHERE cat.category_name = '{0}' AND t.tagname = '{1}' AND t.`status` = 'ACTIVE' AND gt.`status` = 'ACTIVE' AND CheckPrivacy_Goal({4}, g.goal_id) = 1\
                            LIMIT {2}, {3}".format(category_parameter, tagName_parameter, pagination.offset, pagination.limit, SessionUser.uid);

                var sequelize = db.sequelizeConn();
                return sequelize.query(sqlQuery, { type: sequelize.QueryTypes.SELECT })
                    //check query results
                    .then(function (goals) {
                        if (_.isEmpty(goals)) return [];
                        goalIds = _.compact(_.uniq(_.map(goals, _.iteratee('goal_id'))));
                        _tag = new Tag(goals[0].tag_id, SessionUser.uid);
                            var input = {
                                basic: ['name', 'color', 'link', 'isMyInterest'],
                                image: ['small', 'medium'],
                                banner: ['small', 'medium']
                            }
                        return _tag.get(input).then(function(tag){
                            response.tag = tag[0];
                            return;
                        })
                    }).then(function () {
                        if (_.isEmpty(response)) return [];
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
                        };
                        return Goal.getList(goalInput, goalIds, SessionUser.uid).then(function(goalsList){
                            // both can be used for ordering
                            //response.goals = _.orderBy(goalsList, ['id'], ['desc']);
                            response.goals = [];
                            // For same order as goals were fetched
                            _.forEach(goalIds, function(value, key){
                                response.goals[key] = _.head(_.filter(goalsList, function (o) { return o.id == value; }));
                            });
                        });
                    })
                    //send response
                    .then(function () {
                        if (!_.isEmpty(response)) {
                            res.send(200, { meta: { status: 200, message: 'Success' }, data: response });
                        } else {
                            res.send(404, { meta: { status: 404, message: 'Not Found' } });
                        }
                    })
                    .catch(function (err) {
                        res.send(500, { meta: { status: 500, message: 'internal error' }, details: err });
                    });
            }
            //validation errors exist, send response
            else {
                res.send(401, { meta: { status: 401, message: 'user is not logged in or invalid token' } });
            }
        })
        .error(function (err) {
            res.send(500, { meta: { status: 500, message: 'unexpected error' }, details: err });
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
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

Category = function (id, session_uid) {

    /*
        id: must be a valid integer
    */

    if ((/^(?:-1|\d+)$/gm).test(id))
        this.id = _.isInteger(id) ? id : parseInt(id);
    else if (_.isString(id))
        this.category_name = id;
    else
        throw new Error('INVALID_TYPE, only integer or string is allowed');

    if (session_uid != null)
        this.session_uid = session_uid;
}

module.exports = Category;

//###############################################################
//######################## Properties ###########################
//###############################################################

Category.prototype.pagination = {
    offset: 0,
    limit: 5
}

//###############################################################
//###################### Static Methods #########################
//###############################################################

//get goal/goals
Category.getList = function (input, category_ids, session_uid) {

    var category = { id: category_ids };

    if (session_uid != null)
        category.session_uid = session_uid;

    return queryExecutor(input, category);
}

Category.prototype.getTags = function (input) {

    return models.category_tags.findAll({
        attributes: ['tag_id'],
        where: { status: 'ACTIVE', category_id: this.id },
        order: 'created DESC'
    }).then(function (tagList) {
        tagIds = _.compact(_.uniq(_.map(tagList, _.iteratee('tag_id'))));
        return Tag.getList(input, tagIds, this.session_uid).then(function (_tags) {
            return _tags;
        })
    })

}

//###############################################################
//###################### Public Methods #########################
//###############################################################

Category.prototype.get = function (input) {
    return queryExecutor(input, this);
}

//###############################################################
//##################### Private Functions #######################
//###############################################################

//render function for raw data
function render(_this, rawData) {

    var categories = [];

    if (!Array.isArray(rawData))
        rawData = new Array(rawData);

    return Promise.map(rawData, function (_category) {

        //create instance(s) depend on data
        var category = rawData.length == 1 ? _this : new Category(_category.category_id);

        //id
        if (!_this.id)
            category.id = _category.category_id;

        //link
        category.link = new Array(config.webURL.domain, 'category', _category.category_route).toURL();

        //icon
        if (_category.default_icon)
            category.icon = _category.default_icon;

        //name
        if (_category.category_name)
            category.name = _category.category_name;

        //message
        if (_category.custom_message)
            category.message = _category.custom_message;

        //color
        if (_category.default_color)
            category.color = _category.default_color;

        //image
        if (_category.image)
            category.image = _category.image;

        //banner
        if (_category.banner)
            category.banner = _category.banner;

        //tags
        // if (_category.goals_tags) {
        //     var tags = [];
        //     for (var i = 0; i < _category.goals_tags.length; i++) {
        //         var tag = {}
        //         tag.tag_id = _category.goals_tags[i].tag.tag_id;
        //         tag.tag_name = _category.goals_tags[i].tag.tagname;
        //         tags.push(tag);
        //     }
        //     goal.tags = tags;
        // }

        categories.push(category);
        return;

    }).then(function () {
        return categories;
    });
}

//executes sequelize query and merge media into it
function queryExecutor(input, that) {
    var _query = queryGenerator(input, that);

    //execute category query
    return models.default_category.findAll(_query).then(function (_categoriesRaw) {

        //if no category was found
        if (_.isEmpty(_categoriesRaw))
            return [];

        //if category found
        var mediaObj = new Media();

        mediaObj.id = _.concat(
            _.compact(_.uniq(_.map(_categoriesRaw, _.iteratee('default_image_id')))),
            _.compact(_.uniq(_.map(_categoriesRaw, _.iteratee('banner_id'))))
        );
        //get media objects and attach to category object
        return mediaObj.get().then(function (media_array) {
            _.forEach(_categoriesRaw, function (value, key) {
                value.image = _.head(_.filter(media_array, function (o) { return o.id == value.default_image_id; }));
                value.banner = _.head(_.filter(media_array, function (o) { return o.id == value.banner_id; }));
            });

            return _categoriesRaw;
        }).then(function (_categoriesRaw) {
            return render(that, _categoriesRaw);
        });
    });

}

//generates sequelize query
function queryGenerator(input, that) {

    //parse input
    var _queryModels = inputParser(input, that);

    //add get category by id condition if "id" is available
    if (that.id != null)
        _queryModels.default_category.where.category_id = that.id;
    else
        _queryModels.default_category.where.category_name = that.category_name;

    //create sequelize query
    // var _query = {
    //     where: _queryModels.goals.where,
    //     attributes: _queryModels.goals.attributes,
    //     include: _.values(_.omit(_queryModels, 'goals')),
    // };

    return _queryModels.default_category;

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
                query_models.default_category = {
                    where: { status: ['ACTIVE'] },
                    attributes: ['category_id', 'category_name'],
                };

                _(input[key]).forEach(function (value) {
                    if (value == 'link')
                        query_models.default_category.attributes.push('category_route');
                    else if (value == 'color')
                        query_models.default_category.attributes.push('default_color');
                    else if (value == 'icon')
                        query_models.default_category.attributes.push('default_icon');
                    else if (value == 'message')
                        query_models.default_category.attributes.push('custom_message');
                });
            }

            else if (key == 'image') {
                query_models.default_category.attributes.push('default_image_id');
            }

            else if (key == 'banner') {
                query_models.default_category.attributes.push('banner_id');
            }
        }

        else if (typeof input[key] !== 'null' && typeof input[key] === 'object') {  //for nested input

            var obj = inputParser(input[key], that);
            query_models = _.assign(query_models, obj);
        }
    }

    return query_models;
}

//import modules
var clasAllTables = require('../models/alltables');
var Promise = require("bluebird");
var helpers = require('../helpers/helpers');
var validator = require('validator');
var url = require('url') ;

//instances
var objAllTables = clasAllTables.allTables;

//APIs
exports.index_1_0 = function (req, res) {

    var data = {};

    var queryObject = url.parse(req.url,true).query;
    var offset = 0;
    var limit = 10;
    if (queryObject.hasOwnProperty('offset')) { offset = queryObject.offset; }
    if (queryObject.hasOwnProperty('limit')) { limit = queryObject.limit; }


    var ResourceCenter = objAllTables.ResourceCenterModel.ResourceCenter();
    var ResourceCenterTags = objAllTables.ResourceCenterTagsModel.ResourceCenterTags();
    var MainTags = objAllTables.tags.tags();

    var ArticleTags = ResourceCenter.belongsToMany( MainTags, {
        as: 'tags',                    
        through: ResourceCenterTags,
        foreignKey: 'resource_id'
    });

    var Tags =  MainTags.belongsToMany(ResourceCenter, {
        through: ResourceCenterTags,
        foreignKey: 'tag_id'
    });

    return ResourceCenter.findAll(  {order: 'resource_id DESC', attributes: ['resource_id', 'title','content_block1','route'],
                                    include: [{ association: ArticleTags , attributes: ['tag_id','tagname'], through: { attributes: []} }],
                                    offset: offset, limit: limit }).then(function (articles) {                    
        return articles;
    }).then(function (data) {
        if (data.length == 0) { data = false; }
        res.send({meta: {status: 200, message: 'success'}, data: data});
    });
}

/* For creating Article in Resource Center */
exports.create_1_0 = function (req, res) {
    var ResourceCenter = objAllTables.ResourceCenterModel.ResourceCenter();
    var ResourceCenterTags = objAllTables.ResourceCenterTagsModel.ResourceCenterTags();
    var getSlug = require('speakingurl');

    var article = {
        title: req.body.title,
        content_block1: req.body.content_block1,
        content_block2: req.body.content_block2,
        route: getSlug(req.body.title)
    }
    var tag_ids = req.body.tag_ids;

    ResourceCenter.create({ title: article.title, content_block1: article.content_block1, content_block2: article.content_block2, route:article.route, created_at: new Date() }).then(function(article) {
        var tags = [];
        for (i = 0; i < tag_ids.length; ++i) {
            tags.push({ resource_id: article.resource_id, tag_id: tag_ids[i]});
        }
        return ResourceCenterTags.bulkCreate(tags)
    })
    .then(function () {
        res.send(200, {meta: {status: 200, message: 'success'}});
    })
    .error(function (err) {
        res.send({meta: {status: 500, message: 'Internal Error'}, errors: err});
    });
}

/* For Showing an article */
exports.show_1_0 = function (req, res) {

    var data = {};

    var ResourceCenter = objAllTables.ResourceCenterModel.ResourceCenter();
    var ResourceCenterTags = objAllTables.ResourceCenterTagsModel.ResourceCenterTags();
    var MainTags = objAllTables.tags.tags();

    var ArticleTags = ResourceCenter.belongsToMany( MainTags, {
        as: 'tags',                    
        through: ResourceCenterTags,
        foreignKey: 'resource_id'
    });

    var Tags =  MainTags.belongsToMany(ResourceCenter, {
        through: ResourceCenterTags,
        foreignKey: 'tag_id'
    });

    return ResourceCenter.findAll(  {order: 'resource_id DESC', attributes: ['resource_id', 'title','content_block1','content_block2','route'],
                                    include: [{ association: ArticleTags , attributes: ['tag_id','tagname'], through: { attributes: []} }],
                                    where : {resource_id:req.params.id} }).then(function (articles) {                    
        return articles;
    }).then(function (data) {
        if (data.length == 0) { data = false; }
        res.send({meta: {status: 200, message: 'success'}, data: data});
    });
}

/* For getting data for editing an article */
exports.edit_1_0 = function (req, res) {

    res.send(405, {meta: {status: 405, message: 'Method not allowed'}});
}

/* To edit an article */
exports.update_1_0 = function (req, res) {
    var ResourceCenter = objAllTables.ResourceCenterModel.ResourceCenter();
    var ResourceCenterTags = objAllTables.ResourceCenterTagsModel.ResourceCenterTags();

    var getSlug = require('speakingurl');

    var article = {
        title: req.body.title,
        content_block1: req.body.content_block1,
        content_block2: req.body.content_block2,
        route: getSlug(req.body.title)
    }
    var tag_ids = req.body.tag_ids;

    ResourceCenter.update({ title: article.title, content_block1: article.content_block1, content_block2: article.content_block2, route:article.route }
                            , { where: { resource_id : req.params.id }} ).then(function(affectedRows) {

        return ResourceCenterTags.destroy({where: {resource_id: req.params.id }}).then(function () {
            var tags = [];
            for (i = 0; i < tag_ids.length; ++i) {
                tags.push({ resource_id: req.params.id, tag_id: tag_ids[i]});
            }
            return ResourceCenterTags.bulkCreate(tags)
        })
    })
    .then(function () {
        res.send(200, {meta: {status: 200, message: 'success'}});
    })
    .error(function (err) {
        res.send({meta: {status: 500, message: 'Internal Error'}, errors: err});
    });
}

/* To deleting an article */
exports.destroy_1_0 = function (req, res) {
    var ResourceCenter = objAllTables.ResourceCenterModel.ResourceCenter();
    var ResourceCenterTags = objAllTables.ResourceCenterTagsModel.ResourceCenterTags();

    return ResourceCenter.destroy({where: {resource_id: req.params.id }}).then(function () {
        return ResourceCenterTags.destroy({where: {resource_id: req.params.id }})
    }).then(function () {
        res.send(200, {meta: {status: 200, message: 'success'}});
    }).error(function (err) {
        res.send({meta: {status: 500, message: 'Internal Error'}, errors: err});
    });
}

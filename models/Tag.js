//###############################################################
//######################### Require #############################
//###############################################################

var valid = require('../helpers/valid');
var config = require('../config');
var Promise = require("bluebird");
var models = require('../models');
var _ = require('lodash');


Tag = function(id, session_uid){

    if ((/^(?:-1|\d+)$/gm).test(id))
        this.id = _.isInteger(id) ? id : parseInt(id);
    else if (_.isString(id))
        this.name = id;
    else
        throw new Error('INVALID_TYPE, only integer or string is allowed');

    if (session_uid != null)
        this.session_uid = session_uid;
}

module.exports = Tag;

Tag.prototype.pagination = {
    offset: 0,
    limit: 5
}

Tag.prototype.get = function(input){
    return queryExecutor(input, this);
}

Tag.getList = function(input, ids, session_uid){
    var tag = { id: ids };

    if (session_uid != null)
        tag.session_uid = session_uid;

    return queryExecutor(input, tag);
}

function render(that, rawData){
    var tags = [];
    var _this = {};
    _.forEach(rawData, function (_tag, key) {
        
        var tag = rawData.length == 1 ? _this : new Tag(_tag.tag_id);
        //tag = _tag;
        if(_tag.tag_id)
            tag.id = _tag.tag_id;
        if(_tag.tagname)
            tag.name = _tag.tagname;
        if(_tag.default_color)
            tag.color = _tag.default_color;

        if(_tag.dataValues.isMyInterest > 0) {
            tag.isMyInterest = 1;
        } else {
            tag.isMyInterest = 0;
        }

        if (_tag.image)
            tag.image = _tag.image;

        if (_tag.banner)
            tag.banner = _tag.banner;
        tags.push(tag);
    });

   return tags;
}


function queryExecutor(input, that){
    var _query = queryGenerator(input, that);

   return models.tags.findAll(_query).then(function(_tagsRaw){
        //if no tags was found
        if (_.isEmpty(_tagsRaw))
            return [];

        if (_.has(input, 'image') || _.has(input, 'banner')) { //Tag Media
            var mediaObj = new Media();
            media_ids = []
            if(_.has(input, 'image')) {
                media_ids = _.concat(media_ids, _.compact(_.uniq(_.map(_tagsRaw, _.iteratee('image_id')))));
            }
            if(_.has(input, 'banner')) {
                media_ids = _.concat(media_ids, _.compact(_.uniq(_.map(_tagsRaw, _.iteratee('bannerImage_id')))));
            }
            mediaObj.id = media_ids;
            return mediaObj.get().then(function (media_array) {
                _.forEach(_tagsRaw, function (value, key) {
                    if(_.has(input, 'image')) {
                        value.image = _.head(_.filter(media_array, function (o) { return o.id == value.image_id; }));
                    }
                    if(_.has(input, 'banner')) {
                        value.banner = _.head(_.filter(media_array, function (o) { return o.id == value.bannerImage_id; }));
                    }
                });
                return _tagsRaw;
            });

        } else {
            return _tagsRaw;
        }
    }).then(function(_tagsRaw){
        return render(that, _tagsRaw);
    })
}

function queryGenerator(input, that){
    var _queryModels = inputParser(input, that);
    if (that.id != null)
        _queryModels.tags.where.tag_id = that.id;
    else
        _queryModels.tags.where.tagname = models.sequelize.where(models.sequelize.fn('lower', models.sequelize.col('tagname')), that.name.toLowerCase() );

    var _query = {
        where: _queryModels.tags.where,
        attributes: _queryModels.tags.attributes,
        include: _.values(_.omit(_queryModels, 'tags'))
    };

    return _query;
}

function inputParser(input, that){
    var query_models = {};
    query_models.tags = { attributes : ['tag_id','tagname', 'default_color', 'image_id', 'bannerImage_id'],
        where : {status : 'ACTIVE'}
    };
    if((typeof that.session_uid != 'undefined' || that.session_uid != null) && that.session_uid != -1){
        query_models.tags.attributes.push(
            [models.sequelize.literal('(SELECT COUNT(`user_interest_tags`.`tag_id`) FROM `user_interest_tags` WHERE `user_interest_tags`.`tag_id` = `tags`.`tag_id` AND user_interest_tags.uid = {0})'
                .format(that.session_uid))
                , 'isMyInterest']);
        //query_models.user_interest_tags = { required: false, model : models.user_interest_tags, where : { uid : that.session_uid} }
    }

    return query_models;

}
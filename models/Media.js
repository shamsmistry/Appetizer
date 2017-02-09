//###############################################################
//######################### Require #############################
//###############################################################

var _ = require('lodash');
var config = require('../config');
var models = require('../models');
var Promise = require("bluebird");

//###############################################################
//######################## Constructor ##########################
//###############################################################

Media = function (id) {
    if (id != null)
        this.id = id;
    else
        this.id = [];
}

module.exports = Media;

//###############################################################
//######################## Properties ###########################
//###############################################################

Media.prototype.defaults = {

    profile: {
        small: config.baseUrl.fileServer + config.path.uploadPath + config.path.defaultFolderPath + config.path.profilePath + config.thumbName.small + config.defaultImages.profile,
        medium: config.baseUrl.fileServer + config.path.uploadPath + config.path.defaultFolderPath + config.path.profilePath + config.thumbName.medium + config.defaultImages.profile,
        large: config.baseUrl.fileServer + config.path.uploadPath + config.path.defaultFolderPath + config.path.profilePath + config.thumbName.large + config.defaultImages.profile,
        original: config.baseUrl.fileServer + config.path.uploadPath + config.path.defaultFolderPath + config.path.profilePath + config.thumbName.original + config.defaultImages.profile
    },
    cover: {
        small: config.baseUrl.fileServer + config.path.uploadPath + config.path.defaultFolderPath + config.path.coverPath + config.thumbName.small + config.defaultImages.cover,
        medium: config.baseUrl.fileServer + config.path.uploadPath + config.path.defaultFolderPath + config.path.coverPath + config.thumbName.medium + config.defaultImages.cover,
        large: config.baseUrl.fileServer + config.path.uploadPath + config.path.defaultFolderPath + config.path.coverPath + config.thumbName.large + config.defaultImages.cover,
        original: config.baseUrl.fileServer + config.path.uploadPath + config.path.defaultFolderPath + config.path.coverPath + config.thumbName.original + config.defaultImages.cover
    },
    goal: {
        small: config.baseUrl.fileServer + config.path.uploadPath + config.path.defaultFolderPath + config.path.goalFilePath + config.thumbName.small + config.defaultImages.goal,
        medium: config.baseUrl.fileServer + config.path.uploadPath + config.path.defaultFolderPath + config.path.goalFilePath + config.thumbName.medium + config.defaultImages.goal,
        large: config.baseUrl.fileServer + config.path.uploadPath + config.path.defaultFolderPath + config.path.goalFilePath + config.thumbName.large + config.defaultImages.goal,
        xlarge: config.baseUrl.fileServer + config.path.uploadPath + config.path.defaultFolderPath + config.path.goalFilePath + config.thumbName.xlarge + config.defaultImages.goal,
        original: config.baseUrl.fileServer + config.path.uploadPath + config.path.defaultFolderPath + config.path.goalFilePath + config.thumbName.original + config.defaultImages.goal
    }
}

//###############################################################
//###################### Public Methods #########################
//###############################################################

Media.prototype.get = function (_media) {

    //############## Future Use ################
    //if media is passed, render only
    // if(_media) {
    //     return new Promise(function () {
    //         return render(_media);
    //     });
    // }

    //else get the media and render it
    return models.user_file_uploads.findAll({
        where: { status: 'ACTIVE', id: this.id },
        include: [{ model: models.images_thumbs }]
    }).then(function (result) {
        return render(result);
    });
}

Media.getPostImages = function (id, type) {
    var where = {}
    if (type == "ALBUM") {
        where = { status: 'ACTIVE', album_id: id }
    } else {
        where = { status: 'ACTIVE', post_id: id }
    }

    //else get the media and render it
    return models.user_file_uploads.findAll({
        where: where,
        include: [{ model: models.images_thumbs }]
    }).then(function (result) {
        return postMediaRender(result, id);
    });
}

//###############################################################
//###################### Private Methods ########################
//###############################################################

function render(_media) {

    var media_array = [];

    _.forEach(_media, function (image) {
        var media = {};
        media.id = image.id;
        _.forEach(image.images_thumbs, function (thumb, key) {
            var key = thumb.sizetype.toLowerCase();
            media[key] = process.env.FILE_SERVER_URL + 'resources/uploads' + '/' + image.id + '/thumb/' + key + '/' + image.media_url + image.extension;
        });
        media_array.push(media);
    });

    //return new Promise(function () { return media_array.length == 1 ? media_array[0] : media_array; });
    // return media_array.length == 1 ? media_array[0] : media_array;
    return media_array;
}

function postMediaRender(_media, id) {

    var media = {};
    media.id = id;
    media.media = {};
    media.media.files = [];
    media.media.info = {};
    

    if(_media.length == 1) {
        media.media.info = {albumLink: null, postLink: null, totalFiles : 1};
    } else {
        media.media.info = {albumLink: "/album/{0}".format(id), album_id : id, postLink: null, totalFiles : _media.length};
    }

    var counter = 0;
    _.forEach(_media, function (image) {
        if (counter == 6) return false;

        counter = counter + 1;
        var singleMedia = {}
        singleMedia.type = "IMAGE"; 
        singleMedia.fileId = image.id;
        singleMedia.postId = image.post_id;
        singleMedia.source = {}
        _.forEach(image.images_thumbs, function (thumb, key) {
            var key = thumb.sizetype.toLowerCase();
            singleMedia.source[key] = {}
            singleMedia.source[key].src = process.env.FILE_SERVER_URL + 'resources/uploads' + '/' + image.id + '/thumb/' + key + '/' + image.media_url + image.extension;
        });
        media.media.files.push(singleMedia);
    });
    return {media: media};
}

//###############################################################
//########################### Test ##############################
//###############################################################

//not in use
Media.prototype.getQuery = function (fields, alias) {
    /*
        fields: mandatory
        alias:  optional
    */
    var conditions = [{ status: 'ACTIVE' }];

    //field parsing
    _(fields).forEach(function (value) {
        if (value == 'small')
            conditions = _.union(conditions, [{ sizetype: 'SMALL' }]);
        else if (value == 'medium')
            conditions = _.union(conditions, [{ sizetype: 'MEDIUM' }]);
        else if (value == 'large')
            conditions = _.union(conditions, [{ sizetype: 'LARGE' }]);
        else if (value == 'xlarge')
            conditions = _.union(conditions, [{ sizetype: 'XLARGE' }]);
        else if (value == 'square')
            conditions = _.union(conditions, [{ sizetype: 'SQUARE' }]);
    });

    //query
    var query = {
        where: { status: 'ACTIVE' },
        model: models.user_file_uploads, include: [{ model: models.images_thumbs, attributes: ['path', 'sizetype'] }]
    };

    //set alias
    if (alias != null)
        query.as = alias;

    return query;
}
var clasAllTables = require('../models/alltables');
var objAllTables = clasAllTables.allTables;
var helpers = require('../helpers/helpers');
var db = require('../helpers/db');
var validator = require('validator');
var Promise = require("bluebird");
var utilityFile = require('../helpers/Utils');
var http = require('http');
var valid = require('../helpers/valid');

var validate = require("validate.js");

//#####################################################################
//############################## Reusable #############################
//#####################################################################

exports.createPost = function (uid, text, media_id, fetched_url_id, scope_id, post_type, parent_id, req) {
    var data = {};
    var finalArray = [];//For mentioned User
    var mediaId = null;
    if (media_id != null) {
        mediaId = media_id.length > 0 ? media_id[0] : null;
    }

    //getting location id
    return helpers.insertLocation(req)
        .then(function (locationId) {
            data.locationId = locationId;
            return data;
        })
        .then(function (data) {
            return utilityFile.getMentionedUserId(text, uid)
                .then(function (result) {

                    for (var i = 0; i < result.mentionUser.length; i++) {
                        if (result['mentionUser'][i].validated == true) {
                            finalArray.push({
                                uid: result['mentionUser'][i].uid,
                                finalName: result['mentionUser'][i].finalName
                            });
                        }
                    }
                    data.textSearchable = result.simple;
                    data.simpleText = result.oldtext;
                    return data;
                });

        })
        .then(function (data) {

            //user defined location
            if (typeof req.body == 'undefined') {
                req.body = {};
            }
            if (typeof req.body.userDefinedLocation == 'undefined') {
                req.body.userDefinedLocation = null;
                data.userDefinedLocation = null;
            }

            //insert if location available
            if (req.body.userDefinedLocation != null) {
                return helpers.insertUserLocation(req)
                    .then(function (userDefinedLocation) {
                        data.userDefinedLocation = userDefinedLocation.id;
                        return data;
                    });
            }
            else
                return data;
        })
        .then(function (data) {

            var Posts = objAllTables.posts.posts();

            //if text is not null and mediaIdArray length equals to zero

            if (mediaId == null) {

                return Posts.create({
                    uid: uid,
                    text: data.simpleText,
                    textSearchable: data.textSearchable,
                    media_id: mediaId,
                    fetched_url_id: fetched_url_id,
                    scope_id: scope_id,
                    post_type: post_type,
                    created: helpers.getUnixTimeStamp(),
                    status: 'ACTIVE',
                    parent_id: parent_id,
                    location_id: data.locationId,
                    user_defined_location_id: data.userDefinedLocation
                })
                    //post privacy
                    .then(function (createdPost) {

                        if (createdPost.dataValues.scope_id == 4) {


                            return utilityFile.insertSpecificUserPrivacy(createdPost.dataValues.id, req.body.users, uid, 'POST')
                                .then(function (result) {
                                    if (result) {
                                        return createdPost;
                                    }
                                    else {
                                        new Error('Cannot Insert into User Specific Post');
                                    }
                                });
                        }
                        else {
                            return createdPost;
                        }

                    }).then(function (post) {
                        if (post != null)
                            return {post: post};
                        else
                            return {error: 'could not create post'};
                    }).error(function (err) {
                        return {error: err};

                    }).then(function (post) {
                        if (post != null) {
                            helpers.increment_update_PostStats(post.post.dataValues.id, 'posts');
                            return new Promise(function (resolve, reject) {
                                //Mentioned User List Insertion
                                var promiseFor = Promise.method(function (condition, action, value) {
                                    if (!condition(value)) return value;
                                    return action(value).then(promiseFor.bind(null, condition, action));
                                });

                                promiseFor(function (count) {
                                    return count < finalArray.length;
                                }, function (count) {
                                    //######################### loop body (start) #########################

                                    var mentioned_post = objAllTables.mentioned_post.mentioned_post();
                                    return mentioned_post.findOrCreate({
                                        where: {
                                            uid: uid,
                                            mentioned_uid: finalArray[count].uid,
                                            post_id: post.post.dataValues.id
                                        },
                                        defaults: {
                                            created: helpers.getUnixTimeStamp(),
                                            status: 'ACTIVE',
                                            post_id: post.post.dataValues.id,
                                            mentioned_name: finalArray[count].finalName
                                        }
                                    }).spread(function (updated, created) {

                                        return ++count;
                                    })


                                    //######################### loop body (end) #########################
                                }, 0).then(function () {
                                    resolve(post);
                                });
                            });
                        }
                        else
                            return {error: 'could not create post'};
                    })

            }
            //if a single media is attached with post
            else if (mediaId != null) {

                var tableUserFileUploads = objAllTables.user_file_uploads.user_file_uploads();
                return tableUserFileUploads.find({
                    where: {
                        id: parseInt(mediaId)
                    }
                })
                    .then(function (fileData) {

                        var fileType = null;
                        if (fileData != null) {
                            fileType = fileData.dataValues.filetype;
                            if (fileType == 'IMAGE') {
                                fileType = 'Photos';
                            }
                            else if (fileType == 'VIDEO') {
                                fileType = 'Videos';
                            }
                            else if (fileType == 'AUDIO') {
                                fileType = 'Audios';
                            }
                            //fetching user's default album id which is to be updated with user_file_upload table
                            return helpers.getUserDefaultAlbumId(uid, fileType)
                                .then(function (resultValue) {
                                    var albumId = null;
                                    if (resultValue != false) {
                                        albumId = resultValue;

                                        //*******************creating post
                                        return Posts.create({
                                            uid: uid,
                                            text: data.simpleText,
                                            textSearchable: data.textSearchable,
                                            media_id: mediaId,
                                            fetched_url_id: fetched_url_id,
                                            scope_id: scope_id,
                                            post_type: post_type,
                                            created: helpers.getUnixTimeStamp(),
                                            status: 'ACTIVE',
                                            parent_id: parent_id,
                                            location_id: data.locationId,
                                            user_defined_location_id: data.userDefinedLocation
                                        })
                                            //post privacy
                                            .then(function (createdPost) {
                                                if (+createdPost.dataValues.scope_id == 4) {
                                                    return utilityFile.insertSpecificUserPrivacy(createdPost.dataValues.id, req.body.users, uid, 'POST')
                                                        .then(function (result) {
                                                            if (result) {
                                                                return createdPost;
                                                            }
                                                            else {
                                                                new Error('Cannot Insert into User Specific Post');
                                                            }
                                                        });
                                                }
                                                else {
                                                    return createdPost;
                                                }

                                            })
                                            .then(function (post) {
                                                //start post create
                                                if (post != null) {
                                                    var postId = post['dataValues'].id;
                                                    helpers.increment_update_PostStats(postId, 'posts');
                                                    //updating the "parent_id" as "post_id" in "user_file_uploads table"
                                                    return tableUserFileUploads.update({
                                                        album_id: albumId,
                                                        //parent_id: postId,
                                                        post_id: postId,
                                                        updated: helpers.getUnixTimeStamp()
                                                    }, {
                                                        where: {
                                                            id: parseInt(media_id[0])
                                                        }
                                                    }).then(function (update) {
                                                        if (update == 1) {
                                                            return {post: post};
                                                        } else {
                                                            //#################### WARNING #########################
                                                            //we have to rollback created post in this case
                                                            return {error: 'could not create post'};
                                                        }
                                                    });
                                                }
                                                else {
                                                    return {error: 'could not create post'};
                                                }
                                                //end post create
                                            }).then(function (post) {

                                                if (post != null) {
                                                    return new Promise(function (resolve, reject) {
                                                        //Mentioned User List Insertion
                                                        var promiseFor = Promise.method(function (condition, action, value) {
                                                            if (!condition(value)) return value;
                                                            return action(value).then(promiseFor.bind(null, condition, action));
                                                        });

                                                        promiseFor(function (count) {
                                                            return count < finalArray.length;
                                                        }, function (count) {
                                                            //######################### loop body (start) #########################
                                                            var mentioned_post = objAllTables.mentioned_post.mentioned_post();
                                                            return mentioned_post.findOrCreate({
                                                                where: {
                                                                    uid: uid,
                                                                    mentioned_uid: finalArray[count].uid,
                                                                    post_id: post.post.dataValues.id
                                                                },
                                                                defaults: {
                                                                    created: helpers.getUnixTimeStamp(),
                                                                    status: 'ACTIVE',
                                                                    post_id: post.post.dataValues.id,
                                                                    mentioned_name: finalArray[count].finalName
                                                                }
                                                            }).spread(function (updated, created) {
                                                                return ++count;
                                                            })

                                                            //######################### loop body (end) #########################
                                                        }, 0).then(function () {
                                                            resolve(post);

                                                        });
                                                    });
                                                }
                                            });
                                        //******************* creating post
                                    }
                                    else {
                                        return {error: 'could not create post'};
                                    }
                                });
                        } else {
                            //return {error: 'file id is not a valid file type'};
                            return {error: 'file id is not a valid file type'};
                        }
                    });
            }
            else {
                return {error: 'internal error'};
            }
        })
    //.catch(function (err) {
    //    console.log('######################### in catch - in createPost', err);
    //    return {error: "unknown error"};
    //})
    /*.error(function (err) {
     return { error: "failed in location insertion" };
     });//location id*/
};

//#####################################################################
//############################# Post APIs #############################
//#####################################################################

exports.create = function (req, res) {


    //######################### Validations (Rules) #########################
    var constraints = {
        "body": {
            presence: true
        },
        "body.scope_id": {
            presence: true,
            numericality: {
                onlyInteger: true,
                greaterThan: 0,
                lessThanOrEqualTo: 5
            }
        },
        "body.attach_id": {
            presence: false
        },
        "body.fetched_url_id": {
            numericality: {
                onlyInteger: true
            }
        }
    };

    validate.async(req, constraints).then(success, error);

    function success() {

        helpers.getActiveSession(req)
            .then(function (SessionUser) {

                if (SessionUser.type == 'Recognized') {
                    var errors = [];

                    if ((typeof req.body.text == 'undefined' || valid.isNull(req.body.text) == true || req.body.text == "")
                        && (typeof req.body.fetched_url_id == 'undefined' || valid.isNull(req.body.fetched_url_id))
                        && (typeof req.body.attach_id == 'undefined' || valid.isNull(req.body.attach_id) )) {
                        errors.push(helpers.generateErrorObject(1001, 'text', 'text must not be null/empty'));
                        errors.push(helpers.generateErrorObject(1001, 'fetched_url_id', 'fetched_url_id must be a valid int'));
                        errors.push(helpers.generateErrorObject(1001, 'attach_id', 'attach_id must be a valid int'));
                    }
                    else if ((typeof req.body.attach_id == 'undefined' || valid.isNull(req.body.attach_id) == true || req.body.attach_id == "")) {
                        req.body.attach_id = null;
                    }
                    if (+req.body.scope_id == 4 && (typeof req.body.users == 'undefined' || req.body.users == null || Array.isArray(req.body.users) == false)) {
                        errors.push(helpers.generateErrorObject(1001, 'scope_id', 'specific user must be an array'));
                    }
                    else if (+req.body.scope_id == 4 && req.body.users.length == 0) {
                        errors.push(helpers.generateErrorObject(1001, 'users', 'specific user array must be greater than 0'));
                    }

                    if (errors.length == 0) {

                        if (SessionUser.permissions.Post.create == 1) {
                            var mediaId = req.body.attach_id;
                            console.log('================================== received media id from front end - req.body.attach_id', req.body.attach_id);
                            var text = req.body.text || '';

                            var posts = require('../controllers/posts');
                            var createdPostsArray = []; // contains created post ids list when album uploaded
                            var albumId = -1;

                            //record activity and generate feed
                            var feedController = require('../controllers/feed');

                            //if text is not null and mediaIdArray length equals to zero
                            return new Promise(function (resolvePostCreated) {
                                if (mediaId == null || mediaId.length == 0) {
                                    console.log('\n###################### POST create API - in condition 1 - mediaId == null || mediaId.length == 0\n');
                                    return posts.createPost(SessionUser.uid, text, null, req.body.fetched_url_id, req.body.scope_id, 'STATUS_UPDATE', null, req)
                                        .then(function (postCreatedDone) {
                                            //createdPostsArray.push(postCreatedDone.post.id);
                                            feedController.createActivity(SessionUser.uid, 'STATUS_UPDATE', postCreatedDone.post.id, null, null, postCreatedDone.post.id, true, true);
                                            resolvePostCreated(postCreatedDone);
                                        });
                                }
                                //if text is not null or null and mediaIdArray length is equals to 1
                                else if (mediaId.length == 1) {
                                    console.log('\n###################### POST create API - in condition 2 - mediaId.length == 1\n');
                                    return posts.createPost(SessionUser.uid, text, [mediaId[0]], req.body.fetched_url_id, req.body.scope_id, 'STATUS_UPDATE', null, req)
                                        .then(function (postCreatedDone) {
                                            //createdPostsArray.push(postCreatedDone.post.id);
                                            feedController.createActivity(SessionUser.uid, 'STATUS_UPDATE', postCreatedDone.post.id, null, null, postCreatedDone.post.id, true, true);
                                            resolvePostCreated(postCreatedDone);
                                        });
                                }
                                //if text is not null or null and mediaIdArray length is greater than 1
                                else if (mediaId.length > 1) {
                                    console.log('\n###################### POST create API - in condition 3 - mediaId.length > 1\n');

                                    //First check whether the array contains IMAGE IDs or not than create Album
                                    //other wise send the response immediately
                                    var mediaArrayLength = mediaId.length;
                                    var tableUserFileUploads = objAllTables.user_file_uploads.user_file_uploads();
                                    return tableUserFileUploads.findAndCountAll({
                                        where: {
                                            $and: [
                                                {id: mediaId}, // giving complete array here
                                                {filetype: 'IMAGE'}
                                            ]
                                        }
                                    }).then(function (result) {
                                        var imageIdsCount = result.count;
                                        if (imageIdsCount != mediaArrayLength) {
                                            //return {error: 'all ids are not of type IMAGE'};
                                            resolvePostCreated({error: 'all ids are not of type IMAGE'});
                                        } else {
                                            // create album
                                            return helpers.createAlbum(SessionUser.uid, null, 'IMAGE', 'USER', 'CUSTOM')
                                                .then(function (album) {
                                                    if (album != null) {
                                                        albumId = album['dataValues'].id;
                                                        //its a counter of updated rows against newly created post
                                                        var updatedRows = 0;
                                                        return new Promise(function (resolve) {
                                                            var tableUserFileUploads = objAllTables.user_file_uploads.user_file_uploads();
                                                            // Loop through the media Ids Array and Creates Posts
                                                            var mediaIdsLoop = Promise.method(function (condition, action, value) {
                                                                if (!condition(value)) return value;
                                                                return action(value).then(mediaIdsLoop.bind(null, condition, action));
                                                            });

                                                            mediaIdsLoop(function (count) {
                                                                return count < mediaArrayLength
                                                            }, function (count) {
                                                                console.log('+++++++++++++_----------------- mediaId[count]', mediaId[count]);
                                                                return posts.createPost(SessionUser.uid, '', [mediaId[count]], req.body.fetched_url_id, req.body.scope_id, 'STATUS_UPDATE', null, req)
                                                                    .then(function (post) {
                                                                        console.log("BREAAAAAAKKKKKKK IN MULTIPLE -----------", post);
                                                                        if (post != null) {
                                                                            post = post.post;
                                                                            var postId = post.id;
                                                                            createdPostsArray.push(postId);

                                                                            //record activity
                                                                            //feedController.createActivity(SessionUser.uid, 'ALBUM', albumId, null, null, post.id);

                                                                            //updating the "parent_id" as "post_id" in "user_file_uploads" table
                                                                            return tableUserFileUploads.update({
                                                                                //parent_id: postId,
                                                                                album_id: albumId,
                                                                                parent_type: 'POST',
                                                                                post_id: postId,
                                                                                updated: helpers.getUnixTimeStamp()
                                                                            }, {
                                                                                where: {
                                                                                    id: mediaId[count]
                                                                                }
                                                                            }).then(function (update) {
                                                                                if (update == 1) {
                                                                                    updatedRows++;
                                                                                }
                                                                                return ++count;
                                                                            });
                                                                        }
                                                                        else {
                                                                            //return {error: 'could not create post'};
                                                                            resolvePostCreated({error: 'could not create post'});
                                                                        }
                                                                    });
                                                            }, 0)
                                                                .then(function () {
                                                                    //if all rows were IMAGE and they have been updated successfully
                                                                    if (updatedRows == mediaArrayLength) {

                                                                        //creating group-post i-e post with type "ALBUM"
                                                                        return posts.createPost(SessionUser.uid, text, null, req.body.fetched_url_id, req.body.scope_id, 'ALBUM', albumId, req)
                                                                            .then(function (post) {
                                                                                if (post != null) {
                                                                                    post = post.post.dataValues;
                                                                                    //get post object
                                                                                    // helpers.getPost(post.id, true, SessionUser.uid)
                                                                                    //     .then(function (post) {
                                                                                    //         res.send({meta: {status: 200, message: 'Success'}, data: post});
                                                                                    //     });

                                                                                    return post;
                                                                                }
                                                                            })
                                                                            .then(function (post) {
                                                                                feedController.createActivity(SessionUser.uid, 'ALBUM', albumId, null, null, post.id, true, true);
                                                                                resolvePostCreated({post: post});
                                                                            });
                                                                    }
                                                                    else {
                                                                        resolve({error: 'invalid IMAGE type found'});
                                                                    }
                                                                });
                                                        });
                                                    }
                                                    else {
                                                        //return {error: 'could not create album'};
                                                        resolvePostCreated({error: 'could not create album'});
                                                    }
                                                }
                                            );
                                        }
                                    });
                                }
                                else {
                                    resolvePostCreated({error: "validations failed"});
                                }
                            })
                                //extract data from post, record activity
                                .then(function (post) {
                                    console.log('\n###################### POST create API - posts created - extracting data from post\n');
                                    //uid, text, mediaId, fetched_url_id, scope_id, post_type, parent_id, req
                                    if (post.post != null) {
                                        post = post.post;
                                        var postId = post.id;

                                        //get extracted tags from post text
                                        var extractedTags = helpers.getHashTag(text);
                                        var userId = helpers.getUserId(text);

                                        // Loop through the extracted Tags Array
                                        var promiseFor = Promise.method(function (condition, action, value) {
                                            if (!condition(value)) return value;
                                            return action(value).then(promiseFor.bind(null, condition, action));
                                        });

                                        promiseFor(function (count) {
                                            return count < extractedTags.length;
                                        }, function (count) {

                                            return helpers.getTagid(extractedTags[count])
                                                .then(function (tag) {

                                                    var Posts_Tag = objAllTables.posts_tag.posts_tag();
                                                    Posts_Tag.create({
                                                        post_id: postId,
                                                        tag_id: tag.get('tag_id'),
                                                        status: 'ACTIVE',
                                                        gen_by: 'USER',
                                                        created: helpers.getUnixTimeStamp()
                                                    });
                                                    return ++count;
                                                });
                                        }, 0)
                                            .then(function () {
                                                return helpers.getPost(postId, true, SessionUser.uid)
                                                    .then(function (postObj) {
                                                        res.send(200, {
                                                            meta: {status: 200, message: 'Success'},
                                                            data: postObj
                                                        });
                                                    });
                                            });
                                    }
                                    else {
                                        res.send(500, {
                                            meta: {status: 500, message: 'unexpected error'},
                                            details: post.error
                                        });
                                    }
                                })
                                //if it was album
                                .then(function () {
                                    //######################### Record Activity (start) #########################
                                    for (var i = 0; i < createdPostsArray.length; i++) {
                                        feedController.createActivity(SessionUser.uid, 'STATUS_UPDATE', createdPostsArray[i], albumId, 'ALBUM', createdPostsArray[i], false, false);
                                    }
                                    //######################### Record Activity (end) #########################
                                })
                                .error(function (err) {
                                    res.send(500, {meta: {status: 500, message: 'unexpected error'}, details: err});
                                });
                        }
                    } else {
                        res.send(401, {meta: {status: 401, message: 'validation errors'}, errors: errors});
                    }
                } else {
                    res.send(401, {meta: {status: 401, message: 'User is not logged in or invalid token'}});
                }
            })
            .error(function (err) {
                res.send(500, {meta: {status: 500, message: 'unexpected error'}});
            });
    }

    function error(errors) {
        if (errors instanceof Error) {
            // This means an exception was thrown from a validator
            res.send(401, {meta: {status: 401, message: 'An error occurred in validator'}, errors: errors});
        } else {
            res.send(401, {meta: {status: 401, message: 'validation errors'}, errors: errors});
        }
    }

};

exports.update = function (req, res) {

    var constraints = {
        "params.id": {
            presence: true

        },
        "body.scope_id": {
            presence: true,
            numericality: {
                noString: true
            }
        },
        "body.text": {
            presence: true
        },
        "body.media_id": {
            presence: true
        },
        "body.post_type": {
            presence: true
        },
        "body.status": {
            presence: true
        }

    };


    validate.async(req, constraints).then(success, error);
    function success() {
        helpers.GetActiveSession_ORM(req)
            .then(function (SessionUser) {
                if (SessionUser != null) {

                    var errors = [];


                    //######################### Validations (start) #########################
                    //if (validator.isNull(req.params.id)) {
                    //    errors.push(helpers.generateErrorObject(1001, 'posts_id', 'posts_id is null. It should be integer'));
                    //} else if (req.params.id == undefined) {
                    //    errors.push(helpers.generateErrorObject(1001, 'posts_id', 'posts_id is empty. It should be integer'));
                    //} else if (!validator.isNumeric(req.params.id)) {
                    //    errors.push(helpers.generateErrorObject(1001, 'posts_id', 'posts_id should be integer'));
                    //}

                    //if (validator.isNull(req.body.scope_id)) {
                    //    errors.push(helpers.generateErrorObject(1001, 'scope_id', 'scope_id is null. It should be integer'));
                    //} else if (req.body.scope_id == undefined) {
                    //    errors.push(helpers.generateErrorObject(1001, 'scope_id', 'scope_id is empty. It should be integer'));
                    //} else if (!validator.isNumeric(req.body.scope_id)) {
                    //    errors.push(helpers.generateErrorObject(1001, 'scope_id', 'scope_id should be integer'));
                    //}

                    //if (!validator.isNull(req.body.fetched_url_id) && !validator.isNumeric(req.body.fetched_url_id)) {
                    //    errors.push(helpers.generateErrorObject(1001, 'fetched_url_id', 'it should be integer'));
                    //}
                    //######################### Validations (end) #########################

                    //if (errors.length == 0) {

                    if (SessionUser.permissions.Post.edit == 1) {

                        var postId = req.params.id;
                        var postsText = req.body.text;
                        var mediaIdArray = req.body.media_id;
                        var fetchedUrlId = req.body.fetched_url_id;
                        var scopeId = req.body.scope_id;
                        var postsType = req.body.post_type;
                        var tablePosts = objAllTables.posts.posts();
                        var posts = require('../controllers/posts');

                        if (validator.isNull(postId)) {
                            res.send({meta: {status: 401, message: 'post id can not be empty/null'}});
                        }
                        else if (validator.isNull(postsText)) {
                            res.send({meta: {status: 401, message: 'post content is empty/null'}});
                        }

                        //if text is not null and mediaIdArray length equals to zero
                        else if (postsText != '' && mediaIdArray.length == 0) {

                            tablePosts.update({
                                text: postsText,
                                media_id: null,
                                fetched_url_id: fetchedUrlId,
                                scope_id: scopeId,
                                post_type: postsType,
                                updated: helpers.getUnixTimeStamp(),
                                status: req.body.status

                            }, {
                                where: {
                                    id: postId
                                }
                            }).then(function (data) {
                                if (data == 1)
                                    res.send({meta: {status: 200, message: 'Success'}});
                                else
                                    res.send({meta: {status: 404, message: 'Post not found'}});
                            })
                                .error(function (err) {
                                    res.send({
                                        meta: {status: 401, message: 'An error occurred while updating post.'},
                                        details: err
                                    });
                                });
                        }

                        //if text is not null or null and mediaIdArray length equals to 1
                        else if (mediaIdArray.length == 1 && (postsText != '' || postsText == '')) {
                            tablePosts.update({
                                text: postsText,
                                media_id: null,
                                fetched_url_id: fetchedUrlId,
                                scope_id: scopeId,
                                post_type: postsType,
                                updated: helpers.getUnixTimeStamp(),
                                status: req.body.status
                            }, {
                                where: {
                                    id: postId
                                }
                            }).then(function (post) {
                                //updating the post_id in user_file_uploads table
                                var tableUserFileUploads = objAllTables.user_file_uploads.user_file_uploads();
                                tableUserFileUploads.update({
                                    parent_id: postId,
                                    updated: helpers.getUnixTimeStamp()
                                }, {
                                    where: {
                                        id: mediaArrayLength[0]
                                    }
                                }).then(function (update) {
                                    if (update >= 1) {
                                        res.send({meta: {status: 200, message: 'Sucess'}, data: post});
                                    } else {
                                        res.send({meta: {status: 401, message: 'Error'}});
                                    }
                                });
                            });
                        }

                        //if text is not null or null and mediaIdArray length greater than 1
                        else if (mediaIdArray.length > 1 && (postsText != '' || postsText != '')) {

                            // First check whether the array contains IMAGE IDs or not than
                            var mediaArrayLength = mediaIdArray.length;
                            var tableUserFileUploads = objAllTables.user_file_uploads.user_file_uploads();
                            tableUserFileUploads.findAndCountAll({
                                where: {
                                    $and: [
                                        {id: mediaIdArray},
                                        {filetype: 'IMAGE'}
                                    ]
                                }
                            }).then(function (result) {
                                var imageIdsCount = result.count;
                                if (imageIdsCount < mediaArrayLength) {
                                    res.send(402, {meta: {status: 402, message: 'Invalid Request'}});
                                } else {
                                    // create album
                                    return posts.createAlbum(SessionUser.uid, null, 'IMAGE', 'USER')
                                        .then(function (album) {
                                            if (album != false) {
                                                return album;
                                            } else {
                                                res.send(500, {meta: {status: 500, message: 'unexpected error'}});
                                            }
                                        }).then(function (album) {
                                            var albumId = album['dataValues'].id;
                                            tablePosts.update({
                                                text: postsText,
                                                media_id: null,
                                                fetched_url_id: fetchedUrlId,
                                                scope_id: scopeId,
                                                post_type: postsType,
                                                updated: helpers.getUnixTimeStamp(),
                                                status: req.body.status
                                            }, {
                                                where: {
                                                    id: postId
                                                }
                                            }).then(function (post) {
                                                // Loop through the media Ids Array and Creates Posts
                                                var mediaIdsLoop = Promise.method(function (condition, action, value) {
                                                    if (!condition(value)) return value;
                                                    return action(value).then(mediaIdsLoop.bind(null, condition, action));
                                                });
                                                mediaIdsLoop(function (count) {
                                                    return count < mediaArrayLength
                                                }, function (count) {
                                                    //updating the post_id in user_file_uploads table
                                                    var tableUserFileUploads = objAllTables.user_file_uploads.user_file_uploads();
                                                    return tableUserFileUploads.update({
                                                        parent_id: postId,
                                                        album_id: albumId,
                                                        parent_type: 'POST',
                                                        updated: helpers.getUnixTimeStamp()
                                                    }, {
                                                        where: {
                                                            id: mediaIdArray[count]
                                                        }
                                                    }).then(function (update) {
                                                        return ++count;
                                                    });
                                                }, 0)
                                                    .then(function (post) {
                                                        res.send({
                                                            meta: {status: 200, message: 'Sucess'},
                                                            data: post
                                                        });
                                                    });
                                            });
                                        });
                                }
                            });
                        }
                    }
                    else
                        res.send({meta: {status: 403, message: 'permission denied'}});
                    //}
                    //else {
                    //    res.send({ meta: { status: 401, message: 'validation errors' }, errors: errors });
                    //}
                } else {
                    res.send({meta: {status: 401, message: 'User is not logged in or invalid token'}});
                }
            })
            .error(function (err) {
                res.send(err);
            });
    }

    function error(errors) {
        if (errors instanceof Error) {
            // This means an exception was thrown from a validator
            res.send({meta: {status: 401, message: 'An error ocuured in validator'}, errors: errors});
        } else {
            res.send({meta: {status: 401, message: 'validation errors'}, errors: errors});
        }
    }
};

exports.delete = function (req, res) {

    //######################### Validations (Rules) #########################
    var constraints = {
        "params.id": {
            presence: true,
            numericality: {
                noStrings: false
            }
        }
    };

    validate.async(req, constraints).then(success, error);

    //######################### Success #########################
    function success() {

        helpers.getActiveSession(req)
            .then(function (sessionUser) {

                if (sessionUser.type == 'Recognized') {

                    //check permission
                    if (sessionUser.permissions.Post.delete != 1) {
                        res.send(403, {meta: {status: 403, message: 'permission denied'}});
                        throw new Error('break chain');
                    }

                    //check owner ship
                    var posts = objAllTables.posts.posts();

                    return posts.findOne({
                        where: {id: req.params.id, status: 'ACTIVE'},
                        attributes: ['uid', 'post_type', 'parent_id']
                    })
                        //security checks
                        .then(function (post) {
                            if (post == null) {
                                res.send(404, {meta: {status: 404, message: 'Not Found'}});
                                throw new Error('break chain');
                            }
                            else if (post.uid != sessionUser.uid) {
                                res.send(401, {
                                    meta: {
                                        status: 401,
                                        message: 'Unauthorized - session user doesn\'t own the post'
                                    }
                                });
                                throw new Error('break chain');
                            }
                            else if (post.post_type == 'GOAL_CREATED' || post.post_type == 'LINK_GOAL' || post.post_type == 'USER_FOLLOWED' || post.post_type == 'GOAL_FOLLOWED' || post.post_type == 'GOAL_ACHEIVED') {
                                res.send(403, {
                                    meta: {
                                        status: 403,
                                        message: 'permission denied - this post can\'t be deleted'
                                    }
                                });
                                throw new Error('break chain');
                            }
                            else {
                                return post;
                            }
                        })
                        //delete post
                        .then(function (post) {
                            if (post.post_type == 'ALBUM') {
                                var queryDelete = 'CALL sp_DeleteAlbum({0});'.format(post.dataValues.parent_id);
                                var sequelize = db.sequelizeConn();
                                sequelize.query(queryDelete)
                                    .then(function (response) {
                                        if (response[0].TRUE == 1) {
                                            res.send(200, {meta: {status: 200, message: 'success'}});
                                        }
                                        else {
                                            res.send(500, {
                                                meta: {
                                                    status: 500,
                                                    message: 'could not delete. an error occured in stored procedure'
                                                }
                                            });
                                        }
                                    });
                            }
                            else {
                                var queryDeleted = 'CALL sp_DeletePostAndChild({0});'.format(req.params.id);
                                var sequelize = db.sequelizeConn();
                                sequelize.query(queryDeleted).then(function (response) {
                                    if (response[0].TRUE == 1) {
                                        res.send(200, {meta: {status: 200, message: 'success'}});
                                    }
                                    else {
                                        res.send(500, {
                                            meta: {
                                                status: 500,
                                                message: 'could not delete. an error occured in stored procedure'
                                            }
                                        });
                                    }
                                });
                            }
                        });
                }
                else {
                    res.send(401, {meta: {status: 401, message: 'user is not logged in or invalid token'}});
                }
            })
            .error(function (err) {
                res.send(500, {meta: {status: 500, message: 'unknown error - error'}, details: err});
            })
            .catch(function (err) {
                if (err.message != 'break chain')
                    res.send(500, {meta: {status: 500, message: 'unknown error - catch'}, details: err});
            });
    }

    //######################### Validations Failed #########################
    function error(errors) {
        if (errors instanceof Error) {
            // This means an exception was thrown from a validator
            res.send(401, {meta: {status: 401, message: 'An error ocuured in validator'}, errors: errors});
        } else {
            res.send(401, {meta: {status: 401, message: 'validation errors'}, errors: errors});
        }
    }
};

exports.getById = function (req, res) {

    //######################### Validations (Rules) #########################
    var constraints = {
        "params.id": {
            presence: true,
            numericality: {
                noStrings: false
            }
        }
    };

    //######################### Validations (Attributes) #########################

    validate.async(req, constraints).then(success, error);

    function success() {

        helpers.getActiveSession(req)
            .then(function (sessionUser) {
                if (sessionUser.type == 'Recognized' || sessionUser.type == 'UnRecognized') {

                    var id = parseInt(req.params.id);
                    var type = null;

                    var sequelize = db.sequelizeConn();

                    var posts = objAllTables.posts.posts();
                    return posts.findOne({
                        where: {
                            id: id,
                            status: 'ACTIVE',
                            $and: [sequelize.literal('CheckPrivacy_Post({0}, {1}) = 1'.format(sessionUser.uid, req.params.id))]
                        }
                    })
                        .then(function (post) {
                            if (post != null) {

                                type = post.dataValues.post_type;
                                var user_activity = objAllTables.user_activity.user_activity();
                                if (type == 'CONTRIBUTION' || type == 'PROGRESS_UPDATED') {
                                    return user_activity.findOne({where: {source_id: id, activity_type: ['CONTRIBUTION', 'PROGRESS_UPDATED'], status: 'ACTIVE'}})
                                        .then(function (result) {
                                            return result;
                                        });
                                }
                                else {
                                    return user_activity.findOne({where: {post_id: id, status: 'ACTIVE'}})
                                        .then(function (result) {
                                            return result;
                                        });
                                }
                            }
                            else
                                return null;
                        })
                        //render post according to its type
                        .then(function (result) {
                            //if null
                            if (result == null) {
                                res.send(404, {meta: {status: 404, message: 'not found'}});
                            }
                            //if its a modal post, then
                            // else if (req.params.modal == 'true' && type == 'STATUS_UPDATE') {

                            //     return helpers.getPost(id, false, sessionUser.uid)
                            //     .then(function (post) {
                            //         return post;
                            //     })
                            //     .then(function (post) {
                            //         return helpers.getPostComments(id, sessionUser.uid, 0, 10)
                            //         .then(function (comments) {

                            //             post.comments = comments == null ? [] : comments;
                            //             return post;
                            //         });
                            //     })
                            //     .then(function (post) {
                            //         res.send({ meta: { status: 200, message: 'success' }, data: post });
                            //     });

                            // }
                            else if (type == 'STATUS_UPDATE') {
                                var commentLimit = 10;
                                if (typeof req.params.comment_limit != 'undefined' && !isNaN(req.params.comment_limit))
                                    commentLimit = parseInt(req.params.comment_limit);

                                return helpers.getPost(id, false, sessionUser.uid)
                                    .then(function (post) {
                                        return post;
                                    })
                                    .then(function (post) {
                                        return helpers.getPostComments(id, sessionUser.uid, 0, commentLimit)
                                            .then(function (comments) {

                                                post.comments = comments == null ? [] : comments;
                                                return post;
                                            });
                                    })
                                    .then(function (post) {
                                        res.send(200, {
                                            meta: {status: 200, message: 'success'},
                                            data: {feed_type: "STATUS_UPDATE", post: post}
                                        });
                                    }).then(function(){
                                        helpers.increment_update_PostStats(id ,'views');
                                    });

                            }
                            //if its a feed
                            else {
                                var Results = [];
                                Results.push(result.dataValues);

                                var feed = require('../controllers/feed.old');
                                return feed.renderObjects(Results, sessionUser)
                                    .then(function (data) {
                                        //send response
                                        res.send({meta: {status: 200, message: 'success'}, data: data[0]});

                                        //Count Views
                                        utilityFile.viewsCount(sessionUser.uid, id, "POST", req);
                                        helpers.increment_update_PostStats(id ,'views');
                                    });
                            }

                        });
                }
                else {
                    res.send(401, {meta: {status: 401, message: 'invalid token'}});
                }
            })
            .error(function (err) {
                res.send(500, {meta: {status: 500, message: 'unexpected error'}, details: err});
            });
    }

    function error(errors) {
        if (errors instanceof Error) {
            // This means an exception was thrown from a validator
            res.send(401, {meta: {status: 401, message: 'An error ocuured in validator'}, errors: errors});
        } else {
            res.send(401, {meta: {status: 401, message: 'validation errors'}, errors: errors});
        }
    }

};

//get all posts of a PROGRESS, or a MILESTONE
exports.getPostByParentId = function (req, res) {

    //######################### Validations (Rules) #########################
    var constraints = {
        "params.id": {
            presence: true
        }
    };

    ////######################### Validations (Attributes) #########################
    //var attributes = {
    //    id: id
    //};


    validate.async(req, constraints).then(success, error);


    function success() {
        helpers.GetActiveSession_ORM(req)
            .then(function (SessionUser) {
                if (SessionUser != null) {
                    var id = req.params.id;


                    helpers.getPosts(req.params.id, 'UPDATE_PROGRESS', true, true, SessionUser.uid)
                        .then(function (posts) {
                            res.send({meta: {status: 200, message: 'success'}, data: posts});
                            helpers.increment_update_PostStats(id ,'views');
                        });
                }
                else {
                    res.send({meta: {status: 401, message: 'User is not logged in or invalid token'}});
                }
            })
            .error(function (err) {
                res.send({meta: {status: 500, message: 'unexpected error'}});
            });
    }

    function error(errors) {
        if (errors instanceof Error) {
            // This means an exception was thrown from a validator
            res.send({meta: {status: 401, message: 'An error ocuured in validator'}, errors: errors});
        } else {
            res.send({meta: {status: 401, message: 'validation errors'}, errors: errors});
        }
    }
};

//#####################################################################
//######################## Motivations on Post ########################
//#####################################################################

exports.deleteMotivation = function (req, res) {

    //######################### Validations (Rules) #########################
    var constraints = {
        "params.id": {
            presence: true,
            numericality: {
                noStrings: false
            }
        }
    };
    validate.async(req, constraints).then(success, error);

    function success() {
        helpers.GetActiveSession_ORM(req).then(function (sessionUser) {
            //session is active, user has been authenticated
            if (sessionUser != null) {
                if (sessionUser.permissions.Motivate.delete == 1) {
                    var sequelize = db.sequelizeConn();
                    sequelize.query('CALL sp_DeleteMotivationPost({0}, {1});'.format(sessionUser.uid, req.params.id))
                        .then(function (response) {
                            if (response[0].TRUE == 1) {
                                res.send(200, { meta: { status: 200, message: 'success' } });
                                helpers.decrement_update_PostStats(req.params.id, 'motivations');
                            }
                            else {
                                res.send(500, { meta: { status: 500, message: 'could not delete. an error occured in stored procedure' } });
                            }
                        });
                }
                else
                    res.send(403,{meta: {status: 403, message: 'permission denied'}});
            }
            //user is not logged in, or provided incorrect or expired token
            else {
                res.send(401,{meta: {status: 401, message: 'user is not logged or invalid token'}});
            }
        }).catch(function (err) {
            res.send(500,{meta: {status: 500, message: 'internal error'}, details: err});

        }).error(function (err) {
            res.send(500,{meta: { status: 500, message: 'internal error' }, details: err });
        });

    }

    function error(errors) {
        if (errors instanceof Error) {
            // This means an exception was thrown from a validator
            res.send(401,{meta: {status: 401, message: 'An error ocuured in validator'}, errors: errors});
        } else {
            res.send(401,{meta: {status: 401, message: 'validation errors'}, errors: errors});
        }
    }
};

exports.addMotivation = function (req, res) {
    //######################### Validations (Rules) #########################
    var constraints = {
        "params.id": {
            presence: true,
            numericality: {
                noStrings: false
            }
        }
    };

    //######################### Validations (Attributes) #########################

    validate.async(req, constraints).then(success, error);

    function success() {
        helpers.GetActiveSession_ORM(req)
            .then(function (sessionUser) {
                //session is active, user has been authenticated
                if (sessionUser != null) {
                    //var postId = parseInt(req.params.id);

                    if (sessionUser.permissions.Motivate.create == 1) {

                        var sequelize = db.sequelizeConn();

                        var posts = objAllTables.posts.posts();
                        posts.findOne({
                            where: {
                                id: req.params.id,
                                status: {$ne: 'DELETED'},
                                $and: [sequelize.literal('CheckPrivacy_Post({0}, {1}) = 1'.format(sessionUser.uid, req.params.id))]
                            }
                        })
                            .then(function (post) {

                                var data = {};

                                if (post != null) {
                                    var Motivations = objAllTables.post_motivate.post_motivate();
                                    return Motivations.findOrCreate({
                                        where: {
                                            uid: sessionUser.uid,
                                            post_id: req.params.id,
                                        },
                                        defaults: {
                                            created: helpers.getUnixTimeStamp(),
                                            status: 'ACTIVE'
                                        }
                                    }).spread(function (motivation, created) {

                                        if (created == false) {
                                            data.motivationId = motivation['dataValues']._id;
                                            data.postId = req.params.id;
                                            data.uid = sessionUser.uid;

                                            if (motivation['dataValues'].status == 'ACTIVE') {
                                                throw new Error('abort-promise');
                                            }
                                            else if (motivation['dataValues'].status == 'INACTIVE') {
                                                return Motivations.update({
                                                    status: 'ACTIVE', created: helpers.getUnixTimeStamp()
                                                }, {
                                                    where: {
                                                        uid: sessionUser.uid,
                                                        post_id: req.params.id
                                                    }
                                                })
                                                    .then(function () {
                                                        res.send(200, {
                                                            meta: {
                                                                status: 200,
                                                                message: 'Motivation status updated'
                                                            }
                                                        });
                                                        return data;
                                                    });
                                            }
                                        }
                                        else {
                                            data.motivationId = motivation['dataValues']._id;
                                            data.postId = req.params.id;
                                            data.uid = sessionUser.uid;
                                            res.send(200, {meta: {status: 200, message: 'Motivation created'}});
                                            return data;
                                        }
                                    })
                                        //######################### Record Activity (start) #########################
                                        .then(function (data) {
                                            //record activity and generate feed
                                            var feedController = require('../controllers/feed');

                                            //uid, activity_type, source_id, parent_id, parent_type, post_id)
                                            feedController.createActivity(sessionUser.uid, 'MOTIVATE_ON_POST', data.motivationId, data.postId, 'POST', null);
                                            //######################### Record Activity (end) #########################

                                            helpers.increment_update_PostStats(data.postId, 'motivations');
                                        })
                                        .catch(function (err) {
                                            if (err = "abort-promise") {
                                                res.send(401, {
                                                    meta: {
                                                        status: 401,
                                                        message: 'Motivation Already exist'
                                                    }
                                                });
                                            } else {
                                                res.send(500, {meta: {status: 500, message: 'Error'}, details: err});
                                            }
                                        }); //adding or updating motivation (end of "then")

                                }
                                else
                                    res.send(404, {meta: {status: 404, message: 'Post not found '}});
                            });
                    }
                    else
                        res.send({meta: {status: 403, message: 'permission denied'}});
                }
                //user is not logged in, or provided incorrect or expired token
                else {
                    res.send({meta: {status: 401, message: 'user is not logged or invalid token'}});
                }
            }).error(function (err) {
                res.send({meta: {status: 500, message: 'internal error'}, details: err});
            });

    }

    function error(errors) {
        if (errors instanceof Error) {
            // This means an exception was thrown from a validator
            res.send({meta: {status: 401, message: 'An error ocuured in validator'}, errors: errors});
        } else {
            res.send({meta: {status: 401, message: 'validation errors'}, errors: errors});
        }
    }

};

//#####################################################################
//############################# Share Post ############################
//#####################################################################

exports.sharePost = function (req, res) {

    //######################### Validations (Rules) #########################
    var constraints = {
        "params.id": {
            presence: true,
            numericality: {
                noStrings: false
            }
        },
        "body": {
            presence: true
        },
        "body.scope_id": {
            presence: true,
            numericality: {
                onlyInteger: true,
                greaterThan: 0,
                lessThanOrEqualTo: 5
            }
        }
    };

    //######################### Validations (Attributes) #########################
    //var attributes = {
    //    id: postId
    //};

    validate.async(req, constraints).then(success, error);


    function success() {
        helpers.getActiveSession(req).then(function (sessionUser) {
            //session is active, user has been authenticated
            if (sessionUser.type == 'Recognized') {
                var data = {};
                var postId = req.params.id;
                var text = req.body.text || '';
                var shareType = 'SHARE_POST';
                
                var errors = [];

                if (+req.body.scope_id == 4 && (typeof req.body.users == 'undefined' || req.body.users == null || Array.isArray(req.body.users) == false)) {
                    errors.push(helpers.generateErrorObject(1001, 'scope_id', 'specific user must be an array'));
                }
                else if (+req.body.scope_id == 4 && req.body.users.length == 0) {
                    errors.push(helpers.generateErrorObject(1001, 'users', 'specific user array must be greater than 0'));
                }
                if (errors.length == 0) {

                var sharedPosts = objAllTables.posts.posts();
                return sharedPosts.findOne({
                    where: {id: postId, status: 'ACTIVE'},
                    attributes: ['parent_id', 'post_type']
                })
                    .then(function (post) {
                        if (post != null && post.dataValues.post_type == 'SHARE_POST') {
                            shareType = 'SHARE_POST';
                            postId = post.dataValues.parent_id;
                        }
                        else if (post != null && post.dataValues.post_type == 'SHARE_GOAL') {
                            shareType = 'SHARE_GOAL';
                            postId = post.dataValues.parent_id;
                        }
                        //######################## Create Post (start) #########################
                        var posts = require('../controllers/posts');
                        //uid, text, media_id, fetched_url_id, scope_id, post_type, parent_id, req
                        return posts.createPost(sessionUser.uid, text, null, null, req.body.scope_id, shareType, postId, req)
                            .then(function (postObj) {
                                data.post = postObj.post;
                                return data;
                            })
                            .then(function (data) {
                                return helpers.getPost(data.post.id, true, sessionUser.uid)
                                    .then(function (post) {
                                        return helpers.GetGoalMini(postId).then(function(goalObj){
                                            data.post = post;
                                            if(goalObj != null)
                                                data.goal = goalObj;
                                            res.send({ meta: {status: 200, message: 'Success'}, data: data });
                                            return data;
                                        });
                                    });
                            }).then(function (data) {

                                //######################### Record Activity (start) #########################
                                //record activity and generate feed
                                var feedController = require('../controllers/feed');
                                feedController.createActivity(sessionUser.uid, shareType, postId, '', '', data.post.id, true, true);

                                helpers.increment_update_PostStats(data.post.parent_id, 'shares');
                                //######################### Record Activity (end) #########################*!/

                            });

                    });
            }else {
                res.send(401, {meta: {status: 401, message: 'validation errors'}, errors: errors});
            }
           } else {
                res.send(401, { meta: { status: 401, message: 'user is not logged in or invalid token' } });
            }

        }).error(function (err) {
            res.send({meta: {status: 401, message: err}});
        });
    }

    function error(errors) {
        if (errors instanceof Error) {
            // This means an exception was thrown from a validator
            res.send(401, {meta: {status: 401, message: 'An error ocuured in validator'}, errors: errors});
        } else {
            res.send(401, {meta: {status: 401, message: 'validation errors'}, errors: errors});
        }
    }

};

//#####################################################################
//################################ Test ###############################
//#####################################################################

exports.testAlbumId = function (req, res) {
    return new Promise(function (resolve) {
        return helpers.getPostAlbumObject(req.body.albumid, req.body.imageslimit)
            .then(function (result) {
                resolve(result);
            })
    })
        .then(function (mediaObj) {
            res.send(mediaObj);
        })

};

exports.testMentioned = function (req, res) {
    console.log("ALERT");
    /*
     var finalArray=[];
     var text = "@[12332:wasiq] hello Pakistan! @[16:mohsin] hello @[46:mateen]";
     utilityFile.getMentionedUserId(text,47)
     .then(function(result){
     for(var i =0;i<result.mentionUser.length;i++){
     if(result['mentionUser'][i].validated == true )
     {
     finalArray.push({uid:result['mentionUser'][i].uid ,finalName:result['mentionUser'][i].finalName});
     }
     }
     console.log("Result hai",finalArray);
     console.log(result.updatedtext);
     console.log(result.simple);
     console.log(result.oldtext);

     });
     */

    /*var mentioned_post = objAllTables.mentioned_post.mentioned_post();
     var values={
     id:8,
     uid:16,
     mentioned_uid:55,
     post_id:124,
     status:'ACTIVE',
     mentioned_name:"wasiq",
     created:20160209

     }

     mentioned_post.upsert(values)
     .then(function (res) {

     console.log(res);
     })

     var sequelize = db.sequelizeConn();

     return sequelize.transaction(function (t) {

     // chain all your queries here. make sure you return them.
     return mentioned_post.create({
     uid: 16,
     mentioned_uid: 55,
     post_id: 124,
     status: 'ACTIVE',
     mentioned_name: "wasiq",
     created: 20160209
     }, { transaction: t }).then(function (user) {

     var user_block = objAllTables.user_block.user_block();
     return user_block.update({
     uid: 1,
     blocked_uid: 31,
     status: 'INACTIVE'
     }, { transaction: t });
     });

     }).then(function (result) {
     console.log(result);
     // Transaction has been committed
     // result is whatever the result of the promise chain returned to the transaction callback
     }).catch(function (err) {
     // Transaction has been rolled back
     // err is whatever rejected the promise chain returned to the transaction callback
     });

     */

    /*
     var upsert_workarounds = {
     find_mutate: function find_mutate(id, data) {
     return models.site.findById(id)
     .then(function insert_or_update_instance(instance) {
     if (instance !== null) {
     return instance.update(data);
     }
     else {
     return models.site.create(data);
     }
     });
     }
     }*/
    var helpers = require('../helpers/helpers');
    helpers.mentionedUserListComment(20, 744)
        .then(function (mentionUserArray) {

        });

    mentionedUser(16, 124)
        .then(function (mention_id) {
            console.log(mention_id);
        })


};


function mentionedUser(actor_uid, post_id) {
    var mentioned_uid = [];
    var mentioned_post = objAllTables.mentioned_post.mentioned_post();
    return mentioned_post.findAll({
        where: {uid: actor_uid, post_id: post_id, status: 'ACTIVE'},
        attributes: ['mentioned_uid']
    }).then(function (mentionIds) {
        if (mentionIds != null) {
            for (var k = 0; k < mentionIds.length; k++) {
                mentioned_uid.push(mentionIds[k]['dataValues'].mentioned_uid);
            }
            return mentioned_uid;
        } else {
            return null;
        }
    });
}
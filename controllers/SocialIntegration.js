//#############################################################
//##################### Requiring Files #######################
//#############################################################

//npm
var Promise = require("bluebird");
var validate = require("validate.js");
var request = require('request');
var uuid = require('node-uuid');
var https = require('https');
var qs = require('querystring');
//classes
var helpers = require('../helpers/helpers');
var Utils = require('../helpers/Utils');
var db = require('../helpers/db');
var socialIntegrationConfig = require('../config/social_integration_config');
var config = require('../config');

//instances
var objAllTables = require('../models/alltables').allTables;
var sequelize = db.sequelizeConn();


//#############################################################
//#################### Social Integration #####################
//#############################################################

//----------------------- Google ------------------------------
exports.google = function(req,res){
        helpers.getActiveSession(req).then(function(sessionUser){
           if(sessionUser.type == 'Recognized' || sessionUser.type == 'UnRecognized'){
               sendGoogleApi(req,res).then(function(result){
                   if(result.profile.error){
                       res.send(500, { meta : { status : 500, message : result.profile.error.message }, details: result.profile.error.errors } );
                       res.end();
                       return;
                   }
                   if(typeof result.profile.feed == 'undefined'){
                       res.send(500, { meta : { status : 500, message : 'emails cannot be fetched, try again later' }} );
                       res.end();
                       return;
                   }
                   var usersContact = sendUserContacts(result.profile,sessionUser.uid);
                   if(usersContact.length > 0){
                       insertUsers(usersContact, sessionUser.uid, res);
                       return;
                   }
                   else{
                       res.send(200 , { meta : { status : 200 , message : 'No Contacts'},data : [] } );
                       return;
                   }
               });
           }
           else{
               res.send(401 , { meta : { status : 401 , message : 'user not logged in'} } );
           }
        });
}

function sendGoogleApi(req,res){
    var accessTokenUrl = 'https://accounts.google.com/o/oauth2/token';
    var peopleApiUrl = 'https://www.googleapis.com/plus/v1/people/me/openIdConnect';
    var params = {
        code: req.body.code,
        client_id: req.body.clientId,
        client_secret: socialIntegrationConfig.google.clientSecret,
        redirect_uri: req.body.redirectUri,
        grant_type: 'authorization_code',
    };
    // Step 1. Exchange authorization code for access token.
    return new Promise(function(resolve){
        request.post( accessTokenUrl,{form : params , json :true} , function(err, response, token){
            var accessToken = token.access_token;
            var headers = { Authorization: 'Bearer ' + accessToken };
            // Step 2. Retrieve profile information about the current user.
            request.get( { url: peopleApiUrl, headers: headers,json: true }, function(err, response, data){
                    if(data.error ? true : false == true){
                        resolve({profile:data});
                    }
                request.get( { url :  socialIntegrationConfig.google.api.contacts, headers: headers, json: true } , function(err, response, profile){
                        Utils.fileLog(profile);
                        resolve({profile:profile});
                });
            });
        });
    });
}

function sendUserContacts(profile,uid){
    var usersContact = [];
    var len = profile.feed.entry.length;
    for(var i = 0; i < len; i++){
        var usersData = {};
        if(profile.feed.entry[i].gd$email == null){
            continue;
        }
        if(typeof profile.feed.entry[i].gd$name == 'undefined'){
            usersData.uid = uid;
            usersData.email = profile.feed.entry[i].gd$email[0].address;
            usersData.name = profile.feed.entry[i].title.$t;
        }
        else{
            usersData.uid = uid;
            usersData.email = profile.feed.entry[i].gd$email[0].address;
            usersData.name = profile.feed.entry[i].gd$name.gd$fullName.$t;
        }
        usersData.created = helpers.getUnixTimeStamp();
        usersContact.push(usersData);
    }
    return usersContact;
}

//----------------------- Yahoo ------------------------------
exports.yahoo = function(req,res){
    helpers.getActiveSession(req).then(function(sessionUser){
            if(sessionUser.type == 'Recognized' || sessionUser.type == 'UnRecognized') {
                sendYahooApi(req, res).then(function (result) {
                        if (result.profile.error ? true : false == true) {
                            res.send(500, {meta: {status: 500, message: 'error in connecting yahoo API'}, details: result.profile.error.description });
                            res.end();
                            return;
                        }
                        var usersContact = getContactsEmailAndName(result.profile.contacts.contact, sessionUser.uid);
                        if (usersContact.length > 0) {
                            insertUsers(usersContact, sessionUser.uid, res);
                        }
                        else {
                            res.send(200, {meta: {status: 200, message: 'No Contacts', data : [] }});
                        }
                });
            }
            else{
                res.send(401 , { meta : { status : 401 , message : 'user not logged in'} } );
            }
    });
}

function sendYahooApi(req,res){
    var accessTokenUrl = 'https://api.login.yahoo.com/oauth2/get_token';
    var clientId = req.body.clientId;
    var clientSecret = socialIntegrationConfig.yahoo.clientSecret;
    var formData = {
        code: req.body.code,
        redirect_uri: req.body.redirectUri,
        grant_type: 'authorization_code'
    };
    var headers = { Authorization: 'Basic ' + new Buffer(clientId + ':' + clientSecret).toString('base64') };

    return new Promise(function(resolve){
        // Step 1. Exchange authorization code for access token.
        request.post({ url: accessTokenUrl, form: formData, headers: headers, json: true }, function(err, response, body) {
            var socialApiUrl = 'https://social.yahooapis.com/v1/user/' + body.xoauth_yahoo_guid + '/contacts?format=json';
            var headers = { Authorization: 'Bearer ' + body.access_token };

            // Step 2. Retrieve profile information about the current user.
            request.get({ url: socialApiUrl, headers: headers, json: true }, function(err, response, body) {
                    Utils.fileLog(body);
                    resolve({profile:body});
            });
        });
    });
}

function getContactsEmailAndName(contacts,uid){
    var usersContacts = [];
    for(var i = 0; i < contacts.length; i++){
        var users = {};
        users.uid = uid;
        var fieldLength = contacts[i].fields.length;
        for(var j=0; j < fieldLength; j++){
            if(contacts[i].fields[j].type == 'name'){
                var name = contacts[i].fields[j].value.givenName+' '+contacts[i].fields[j].value.familyName;
                users.name = name;
            }
            if(contacts[i].fields[j].type == 'email'){
                var email = contacts[i].fields[j].value;
                users.email = email;
            }
        }
        if(typeof users.email === 'undefined'){
            continue;
        }
        if(typeof users.name == 'undefined'){
            users.name = '';
        }
        users.created = helpers.getUnixTimeStamp();
        usersContacts.push(users);
    }
    return usersContacts;
}

//--------------------- Microsoft ----------------------------
exports.hotmail = function(req,res){
    helpers.getActiveSession(req).then(function(sessionUser){
        if(sessionUser.type == 'Recognized' || sessionUser.type == 'UnRecognized'){
            sendHotmailApi(req,res).then(function(result) {
                if (result.profile.error ? true : false == true) {
                    res.send(500, {meta: {status: 500, message: 'error in connecting Hotmail API'},details: result.profile.error.message});
                    res.end();
                    return;
                }
                var usersContact = getUserContacts(result.profile, sessionUser.uid);
                if(usersContact.length > 0){
                    insertUsers(usersContact, sessionUser.uid, res);
                    return;
                }
                else{
                    res.send(200 , { meta : { status : 200 , message : 'No Contacts'},data : [] } );
                    return;
                }
            });
        }
        else{
            res.send(401 , { meta : { status : 401 , message : 'user not logged in'} } );
        }
    });
}

function sendHotmailApi(req,res){
    var accessTokenUrl = 'https://login.live.com/oauth20_token.srf';
    var params = {
        code: req.body.code,
        client_id: req.body.clientId,
        client_secret: socialIntegrationConfig.microsoft.clientSecret,
        redirect_uri: req.body.redirectUri,
        grant_type: 'authorization_code'
    };
    return new Promise(function(resolve){
        // Step 1. Exchange authorization code for access token.
        request.post(accessTokenUrl, { form: params, json: true }, function(err, response, accessToken){
            var profileUrl = 'https://apis.live.net/v5.0/me/contacts?access_token=' + accessToken.access_token;
            // Step 2. Retrieve profile information about the current user.
            request.get({ url: profileUrl , json:true}, function(err, response, profile) {
                    Utils.fileLog(profile);
                    resolve({profile:profile});
            });
        });
    });
}

function getUserContacts(contact,uid){
    var usersData = [];
    var data = contact.data;
    console.log(data);
    var len = data.length;
    for(var i = 0; i < len; i++){
        var users = {};
        if(typeof  data[i].emails.preferred == 'undefined' || data[i].emails.preferred == null){
            continue;
        }
        if(typeof  data[i].name == 'undefined'){
            users.uid = uid;
            users.name = "";
            users.email = data[i].emails.preferred;
        }
        else{
            users.uid = uid;
            users.name = data[i].name;
            users.email = data[i].emails.preferred;
        }
        users.created = helpers.getUnixTimeStamp();
        usersData.push(users);
    }
    return usersData;
}
//----------------------- iCloud -----------------------------
exports.icloud = function(req,res) {

    var constraints = {
        "body.appleid": {
            presence: true
        },
        "body.password" : {
            presence: true
        }
    };
    validate.async(req, constraints).then(success, error);

    function success() {
        helpers.getActiveSession(req).then(function (SessionUser) {
            if (SessionUser.uid != null) {
                icloudApi(req, SessionUser.uid).then(function (result) {
                    insertUsers(result.data, SessionUser.uid, res);
                })
            }
            else {
                res.send(200, {meta: {status: 200, message: 'user not logged in'}});
            }
        });
    }
    function error(errors){
        if (errors instanceof Error) {
            res.send(500, {meta: {status: 500, message: 'internal error'}, details: errors});
        }
        else{
            res.send(401, {meta: {status: 401, message: 'validation'} });
        }
    }
}

function icloudApi(req , uid){
    return new Promise(function(resolve){
        function iCloud(appleId, password) {

            this.urls = {
                "version" : "https://www.icloud.com/system/version.json",
                "validate": "/setup/ws/1/validate?clientBuildNumber={0}&clientId={1}",
                "login": "/setup/ws/1/login?clientBuildNumber={0}&clientId={1}"
            }

            this.appleId            = appleId;
            this.password           = password;

            this.clientBuildNumber  = '1P24';
            this.clientId           = uuid.v1().toString().toUpperCase();

            // console.log('Generated UUID: ' + this.clientId);

            this.cookie = null;
            this.instance = null;

            this.validate();
        }

        iCloud.prototype = {
            validate: function() {
                var me = this;

                var endpoint = this.urls.login
                    .replace('{0}', this.clientBuildNumber)
                    .replace('{1}', this.clientId);

                // console.log(endpoint);

                var options = {
                    host: "p12-setup.icloud.com",
                    path: endpoint,
                    method: 'POST',
                    headers: {
                        'Origin': 'https://www.icloud.com',
                        'Referer': 'https://www.icloud.com',
                        'User-Agent': 'Mozilla/5.0 (Windows NT 6.3; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/35.0.1916.114 Safari/537.36'
                    }
                };

                var data = JSON.stringify({
                    apple_id: this.appleId,
                    password: this.password,
                    extended_login: false
                });

                var request = https.request(options, function(res) {

                    if (res.headers['set-cookie']) me.cookie = res.headers['set-cookie'];

                    var buffer = '';

                    res.on('data', function(data) {
                        buffer += data;
                    });

                    res.on('end', function() {

                        me.instance = JSON.parse(buffer);
                        //console.log(me.instance);
                        var dsid = me.instance.dsInfo.dsid;
                        var getContactListUrl = '/co/startup?clientBuildNumber={1}&clientId={2}&clientVersion=2.1&dsid={3}&locale=zh_TW&order=last%2Cfirst'
                            .replace('{1}', me.clientBuildNumber)
                            .replace('{2}', me.clientId)
                            .replace('{3}', dsid); // &id={4}

                        var options2 = {
                            host: me.instance.webservices.contacts.url.replace('https://', '').replace(':443', ''),
                            path: getContactListUrl,
                            method: 'GET',
                            headers: {
                                'Origin': 'https://www.icloud.com',
                                'Referer': 'https://www.icloud.com',
                                'Cookie': me.cookie.join('; '),
                                'User-Agent': 'Mozilla/5.0 (Windows NT 6.3; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/35.0.1916.114 Safari/537.36'
                            }
                        };

                        var req2 = https.request(options2, function(res) {

                            var buf2 = '';
                            res.on('data', function(data) {
                                buf2 += data;
                            });

                            res.on('end', function() {
                                var contacts = JSON.parse(buf2).contacts;
                                //console.log(contacts)
                                var usersList = [];
                                for (var i = 0; i < contacts.length; i ++ ) {
                                    var users = {};
                                    if(typeof contacts[i].emailAddresses == 'undefined'){
                                        continue;
                                    }
                                    else{
                                        console.log(contacts[i].emailAddresses[0].field);
                                        users.uid = uid;
                                        users.name = contacts[i].firstName + ' ' + contacts[i].lastName;
                                        users.email =  contacts[i].emailAddresses[0].field;
                                        users.created = helpers.getUnixTimeStamp();
                                        usersList.push(users);
                                    }
                                    //  console.log(contacts[i].lastName + ' ' + contacts[i].firstName
                                    //      + ', email(' + contacts[i].emailAddresses[0].label + '): ' + contacts[i].emailAddresses[0].field );

                                }
                                resolve( { data : usersList} );
                            });
                        });
                        req2.end();
                    });
                });

                request.write(data);
                request.end();
            }
        };
        new iCloud(req.body.appleid, req.body.password);
    });
}

//#############################################################
//################### Invite/Find Friend ######################
//#############################################################

function insertUsers(usersContact,uid,res){

    var createTempTable = 'CREATE TEMPORARY TABLE IF NOT EXISTS contact_tmp LIKE contacts';

    var insertIntoContacts = 'INSERT INTO contacts (name, email, uid, created) \
                    SELECT filtered.name as name, filtered.contact_email AS `email`, {0} as uid, created\
                    FROM (SELECT c.email as `contact_email`, u.uid, c.name, c.created FROM contact_tmp c LEFT JOIN contacts u ON (c.email = u.email AND c.uid = u.uid) WHERE c.uid = {0} ) as filtered \
                    WHERE ISNULL(filtered.uid) = TRUE;'.format(uid);

    var dropTempTable = 'DROP TABLE contact_tmp';

    //start sequelize Transaction
    return sequelize.transaction(function (t) {
        return sequelize.query(createTempTable, {transaction: t}).then(function(result){
            return sequelize.queryInterface.bulkInsert('contact_tmp', usersContact, {transaction: t}).then(function(result){
                return sequelize.query(insertIntoContacts, {transaction: t}).then(function(result){
                    return sequelize.query(dropTempTable, {transaction: t}).then(function(result){
                        res.send(200, { meta : {status:200,message:'OK'}} );
                    });
                });
            });
        });
    });
}

// ----------- FACEBOOK ------------------
exports.facebook = function(req,res){

    var facebookAPIDetection = 0;
    var fields = ['id', 'email', 'first_name', 'last_name', 'link', 'name','gender'];
    var accessTokenUrl = 'https://graph.facebook.com/v2.5/oauth/access_token';
    var graphApiUrl = 'https://graph.facebook.com/v2.5/me?fields=' + fields.join(',');

    var params = {
        code: req.body.code,
        client_id: req.body.clientId,
        client_secret: socialIntegrationConfig.facebook.clientSecret,
        redirect_uri: req.body.redirectUri
    };
    // Step 1. Exchange authorization code for access token.
    request.get({ url: accessTokenUrl, qs: params, json: true }, function(err, response, accessToken) {
        if (response.statusCode !== 200) {
            return res.send(500 , { meta : {status : 500, message: accessToken.error.message} });
        }

        // Step 2. Retrieve profile information about the current user.
        request.get({ url: graphApiUrl, qs: accessToken, json: true }, function(err, response, profile) {
            if (response.statusCode !== 200) {
                return res.send(500 , { meta : {status : 500, message: profile.error.message} });
            }
            //Check If User ID is in database
            var Users = objAllTables.users.users();
            Users.findOne( { where : {fb_uid : profile.id } }).then(function(result){
                helpers.getActiveSession(req).then(function(sessionUser){
                    if(sessionUser.type == 'Recognized'){
                        if(result != null){
                            return res.send(401, {meta: {status: 401, message: 'user already used'}});
                        }
                        else{
                            updateSocailAccount(sessionUser.uid , 'facebook' , profile.id).then(function(response){
                                if(response == true){
                                    res.send(200 , {meta : {status : 200, message : 'OK'} });
                                    res.end();
                                    return;
                                }
                                else{
                                    res.send(401 , {meta : {status : 401, message : 'social network id cannot update'} });
                                    res.end();
                                    return;
                                }
                            });
                        }
                    }
                    else {
                        var id = parseInt(profile.id);
                        var hashedFacebookID = hashUseridAndApiDetection(id, facebookAPIDetection);
                        var dataToSend = {social_id: hashedFacebookID, name: profile.name, email: profile.email, gender: profile.gender, username: ''};
                        return res.send(200, {meta: {status: 200, message: 'success'}, data: dataToSend});
                    }
                });
            });
        });
    });
};

exports.facebookFriends = function(req,res){
    var accessTokenUrl = 'https://graph.facebook.com/v2.5/oauth/access_token';
    var graphApiUrl = 'https://graph.facebook.com/v2.2/me/friends';

    var params = {
        code: req.body.code,
        client_id: req.body.clientId,
        client_secret: socialIntegrationConfig.facebook.clientSecret,
        redirect_uri: req.body.redirectUri
    };

    // Step 1. Exchange authorization code for access token.
    request.get({ url: accessTokenUrl, qs: params, json: true }, function(err, response, accessToken) {
        if (response.statusCode !== 200) {
            return res.send(500, {meta: {status: 500, message: accessToken.error.message}});
        }

        // Step 2. Retrieve profile friends.
        request.get({url: graphApiUrl, qs: accessToken, json: true}, function (err, response, profile) {
            if (response.statusCode !== 200) {
                return res.send(500, {meta: {status: 500, message: profile.error.message}});
            }
            helpers.getActiveSession(req).then(function(sessionUser){
                if(sessionUser.type == 'Recognized') {
                    var friendsID = [];
                    var data = profile.data;
                    data.map(function (makeArrayOfIDs) {
                        friendsID.push(makeArrayOfIDs.id);
                    });

                    var findFacebookFriendsQuery = "SELECT users.uid, CONCAT_WS(' ', users.first_name, users.middle_name, users.last_name) as name, profile_image_id,\
                                            (SELECT if(count(uid)>0,1,0) FROM user_followers WHERE uid = {0} AND follows_uid = users.uid AND status='ACTIVE') AS isFollowing \
                                            FROM users\
                                            WHERE users.fb_uid IN ( {1} )".format(sessionUser.uid, friendsID.join(','));
                    sequelize.query(findFacebookFriendsQuery).then(function (result) {
                        var users = [];
                        Promise.each(result[0], function (_user) {
                            var user = _user;
                            return new Promise(function (resolve) {
                                if (user.profile_image_id != null) {
                                    return helpers.getMediaObject(user.profile_image_id).then(function (mediaObj) {
                                        user.profile = helpers.getMediaObject_Fix(mediaObj, 'PROFILE', ['small']);
                                        ;
                                        resolve(user);
                                    });
                                }
                                else {
                                    user.profile = helpers.getMediaObject_Fix(null, 'PROFILE', ['small']);
                                    resolve(user);
                                }
                            })
                        }).then(function (friendsProfile) {
                            users.push(friendsProfile);
                        }).then(function () {
                            res.send({meta: {status: 200, message: 'success'}, data: users[0]});
                        });
                    });
                }
                else{
                    res.send(401 , { meta : {status: 401, message : 'user not recognized'} } );
                }
            });
        });
    });

};

//---------------------------------- TWITTER -------------------------------------
exports.twitter = function(req,res){
    var twitterAPIDetection = 1;
    var requestTokenUrl = 'https://api.twitter.com/oauth/request_token';
    var accessTokenUrl = 'https://api.twitter.com/oauth/access_token';
    var profileUrl = 'https://api.twitter.com/1.1/users/show.json?screen_name=';

    // Part 1 of 2: Initial request from Satellizer.
    if (!req.body.oauth_token || !req.body.oauth_verifier) {
        var requestTokenOauth = {
            consumer_key: socialIntegrationConfig.twitter.twitterKey,
            consumer_secret: socialIntegrationConfig.twitter.twitterSecret,
            callback: req.body.redirectUri
        };

        // Step 1. Obtain request token for the authorization popup.
        request.post({ url: requestTokenUrl, oauth: requestTokenOauth }, function(err, response, body) {
            var oauthToken = qs.parse(body);
            // Step 2. Send OAuth token back to open the authorization screen.
            res.send(oauthToken);
        });
    }
    else {
        // Part 2 of 2: Second request after Authorize app is clicked.
        var accessTokenOauth = {
            consumer_key: socialIntegrationConfig.twitter.twitterKey,
            consumer_secret: socialIntegrationConfig.twitter.twitterSecret,
            token: req.body.oauth_token,
            verifier: req.body.oauth_verifier
        };

        // Step 3. Exchange oauth token and oauth verifier for access token.
        request.post({url: accessTokenUrl, oauth: accessTokenOauth}, function (err, response, accessToken) {
            accessToken = qs.parse(accessToken);

            var profileOauth = {
                consumer_key: socialIntegrationConfig.twitter.twitterKey,
                consumer_secret: socialIntegrationConfig.twitter.twitterSecret,
                oauth_token: accessToken.oauth_token
            };

            // Step 4. Retrieve profile information about the current user.
            request.get({ url: profileUrl + accessToken.screen_name, oauth: profileOauth, json: true }, function (err, response, profile) {
                var Users = objAllTables.users.users();
                var id = profile.id;
                Users.findOne({where: {tw_uid: '{0}'.format(id)}}).then(function (result) {
                    helpers.getActiveSession(req).then(function (sessionUser) {
                        if (sessionUser.type == 'Recognized') {
                            if(result != null){
                                return res.send(401, {meta: {status: 401, message: 'user already used'}});
                            }
                            else {
                                updateSocailAccount(sessionUser.uid, 'twitter', profile.id).then(function (result) {
                                    if (result == true) {
                                        res.send(200, {meta: {status: 200, message: 'OK'}});
                                        res.end();
                                        return;
                                    }
                                    else {
                                        res.send(401, {meta: {status: 401,message: 'social network id cannot update'}});
                                        res.end();
                                        return;
                                    }
                                });
                            }
                        }
                        else {
                            var hashedTwitterID = hashUseridAndApiDetection(id, twitterAPIDetection);
                            var dataToSend = { social_id: hashedTwitterID, name: profile.name, email: profile.email, gender: profile.gender, username: profile.screen_name };
                            return res.send(200, {meta: {status: 200, message: 'success'}, data: dataToSend});
                        }

                    });
                });
            });
        });
    }
};

exports.twitterFriends = function(req,res){
    var twitterAPIDetection = 1;
    var requestTokenUrl = 'https://api.twitter.com/oauth/request_token';
    var accessTokenUrl = 'https://api.twitter.com/oauth/access_token';
    var friendsUrl = 'https://api.twitter.com/1.1/friends/list.json?screen_name=';

    // Part 1 of 2: Initial request from Satellizer.
    if (!req.body.oauth_token || !req.body.oauth_verifier) {
        var requestTokenOauth = {
            consumer_key: socialIntegrationConfig.twitter.twitterKey,
            consumer_secret: socialIntegrationConfig.twitter.twitterSecret,
            callback: req.body.redirectUri
        };

        // Step 1. Obtain request token for the authorization popup.
        request.post({ url: requestTokenUrl, oauth: requestTokenOauth }, function(err, response, body) {
            var oauthToken = qs.parse(body);
            // Step 2. Send OAuth token back to open the authorization screen.
            res.send(oauthToken);
        });
    }
    else {
        // Part 2 of 2: Second request after Authorize app is clicked.
        var accessTokenOauth = {
            consumer_key: socialIntegrationConfig.twitter.twitterKey,
            consumer_secret: socialIntegrationConfig.twitter.twitterSecret,
            token: req.body.oauth_token,
            verifier: req.body.oauth_verifier
        };

        // Step 3. Exchange oauth token and oauth verifier for access token.
        request.post({url: accessTokenUrl, oauth: accessTokenOauth}, function (err, response, accessToken) {
            accessToken = qs.parse(accessToken);

            var profileOauth = {
                consumer_key: socialIntegrationConfig.twitter.twitterKey,
                consumer_secret: socialIntegrationConfig.twitter.twitterSecret,
                oauth_token: accessToken.oauth_token
            };

            // Step 4. Retrieve profile information about the current user.
            request.get({url: friendsUrl + accessToken.screen_name,oauth: profileOauth,json: true
            }, function (err, response, profile) {
                helpers.getActiveSession(req).then(function(sessionUser){
                    //if(sessionUser.type == 'Recognized') {

                        var usersList = profile.users;
                        var friendsID = [];
                        usersList.map(function(list){
                            friendsID.push(list.id);
                        });
                        var findTwitterFriendsQuery = "SELECT users.uid, CONCAT_WS(' ', users.first_name, users.middle_name, users.last_name) as name, profile_image_id,\
                                            (SELECT if(count(uid)>0,1,0) FROM user_followers WHERE uid = {0} AND follows_uid = users.uid AND status='ACTIVE') AS isFollowing \
                                            FROM users\
                                            WHERE users.tw_uid IN ( {1} )".format(sessionUser.uid, friendsID.join(','));
                        sequelize.query(findTwitterFriendsQuery).then(function (result) {
                            var users = [];
                            Promise.each(result[0], function (_user) {
                                var user = _user;
                                return new Promise(function (resolve) {
                                    if (user.profile_image_id != null) {
                                        return helpers.getMediaObject(user.profile_image_id).then(function (mediaObj) {
                                            user.profile = helpers.getMediaObject_Fix(mediaObj, 'PROFILE', ['small']);
                                            resolve(user);
                                        });
                                    }
                                    else {
                                        user.profile = helpers.getMediaObject_Fix(null, 'PROFILE', ['small']);
                                        resolve(user);
                                    }
                                })
                            }).then(function (friendsProfile) {
                                users.push(friendsProfile);
                            }).then(function () {
                                res.send({meta: {status: 200, message: 'success'}, data: users[0]});
                            });
                        });
                   // }
                   // else{
                    //    res.send(401 , { meta : {status:401, message : 'user not recognized'} } );
                   // }
                });
            });
        });
    }
};

function updateSocailAccount(uid, socialNetwork, networkID){
    var Users  = objAllTables.users.users();
    if(socialNetwork == 'facebook'){
        return Users.update( {fb_uid : ''+networkID},{ where : {uid : uid, status : 'ACTIVE'} } ).then(function(result){
            return true;
        });
    }
    else if(socialNetwork == 'twitter'){
        return Users.update( {tw_uid : ''+networkID},{ where : {uid : uid, status : 'ACTIVE'} }).then(function(result){
            return true;
        });
    }
    else{
        throw new Error('invalid social network provided');
    }
}

function hashUseridAndApiDetection(id, detect){
    var Hashids = require("hashids"), hashids = new Hashids(config.encryption.salt, config.encryption.size);
    return hashids.encode(id,detect);
}

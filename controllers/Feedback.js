/**
 * Created by Mubeen on 4/25/2016.
 */

var validate = require("validate.js");
var Promise = require("bluebird");
var utils = require('../helpers/Utils');
var helpers = require('../helpers/helpers');

//instances
var clasAllTables = require('../models/alltables');
var objAllTables = clasAllTables.allTables;

exports.feedback = function(req,res){

    var constraints = {
        "body.text" : {
            presence: true
        },
        "body.email" :{
            presence: false,
            email: true
        }
    }

    validate.async(req, constraints).then(success, error);

    function success(){
        helpers.getActiveSession(req).then(function(sessionUser){
            var feedbackObject = {};
            feedbackObject.created = helpers.getUnixTimeStamp();

            if(sessionUser.type == 'Recognized'){
                feedbackObject.name = sessionUser.name;
                feedbackObject.email = sessionUser.user_email;
                feedbackObject.uid = sessionUser.uid;
                feedbackObject.text = req.body.text;
            }
            else{
                if(typeof req.body.name == 'undefined' || req.body.name == ''){
                    res.send(401, {meta : {status:401, message: 'no name found'}});
                    res.end();
                    return;
                }
                if(typeof req.body.email != 'undefined')
                    feedbackObject.email = req.body.email;

                feedbackObject.text = req.body.text;
                feedbackObject.name = req.body.name;
            }

            var feedback = objAllTables.feedbacks.feedbacks();
            feedback.create(feedbackObject).then(function(result){
                if(result != null){
                    if(feedbackObject.email ?true:true==false) {
                        var emailNotification = require('./EmailNotifications.js');
                        var email = {type: 'Thankyou_For_Your_Feedback',to_email: feedbackObject.email,to_name: feedbackObject.name };
                        emailNotification.emailNotifications_Direct(email);
                    }
                    var emailReceived = {type: 'FEEDBACK_RECEIVED',feedback:feedbackObject.text};
                    emailNotification.emailNotifications_Direct(emailReceived);
                    res.send(200 , { meta : {status:200, message: 'OK'} } );
                }
                else{
                    res.send(401 , { meta : {status:401, message: 'cannot insert data'} } );
                }
            }).error(function(err){
                res.send(500 , { meta : {status:500, message: 'internal server error'} } );
            });

        }).error(function(err){
            res.send(500 , { meta : {status:500, message: 'internal server error'} } );
        });
    }

    function error(errors){
        if (errors instanceof Error) {
            res.send(401, { meta: { status: 401, message: 'An error occurred in validator' }, errors: errors });
        } else {
            res.send(401, { meta: { status: 401, message: 'validation errors' }, errors: errors });
        }
    }
};


exports.getFeedbacks = function(req,res){
    var pagination = utils.pagination(req);
    var limit = pagination.limit;
    var offset = pagination.offset;
    var feedbacks = objAllTables.feedbacks.feedbacks();
    feedbacks.findAll( { limit : limit, offset : offset}).then(function(result){
        res.send(200, { meta : { status:200 , message : 'success', data : result } } );
    }).error(function(errors){
        res.send(500, { meta : { status:500 , message : 'internal error', data : errors } } );
    });
};
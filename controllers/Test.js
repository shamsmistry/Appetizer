//npm
var Promise = require("bluebird");

//classes
var db = require('../helpers/db');
var utils = require('../helpers/Utils');

var clasAllTables = require('../models/alltables');
var objAllTables = clasAllTables.allTables;

var _ = require('lodash');


//Testing
var jade = require('jade');


exports.testContributionTemplate = function (req, res) {
    var html = jade.renderFile('./templates/email/test.jade', {
        owner_name: 'Ahmer',
        contribution: ' He likes this new lifestyle. He feels healthy.',
        contributor_name: 'Shaharyar',
        contributor_name_profile_link: 'http://stackoverflow.com/questions/5697863/dynamic-links-with-jade',
        contribution_string: " has contributed on goal ",
        contribution_on_goal_name: "Help my father become a vegetarian. ",
        contribution_on_goal_link: "https://github.com/",
        contribution_image_link: 'https://i1.linkagoal.com/resources/uploads/31544/thumb/medium/FEg1R9k2Qbb_AtIApmLKsycT.jpg',
        email_type: "contribution_on_goal_with_image"
    });
    res.send(200, html);
};

exports.testMilestoneCompletedTemplate = function (req, res) {
    var html = jade.renderFile('./templates/email/test.jade', {
        owner_name: 'Ahmer',
        milestone: " Speak with the development team and plan the whole trip",
        milestone_created_by: 'Shaharyar',
        milestone_created_by_profile_link: "http://stackoverflow.com/questions/5697863/dynamic-links-with-jade",
        milestone_string: " has achieved a milestone on the goal you are connected with ",
        milestone_status: "Milestone Achieved",
        goal_name: " Go to French Beach with Linkagoal Team, hopefully next week :) ",
        goal_name_link: "https://www.linkagoal.com/dashboard",
        milestone_image_link: 'https://marketing-image-production.s3.amazonaws.com/uploads/4761ed9986a4196642b16dc3a021e37e065e878191f5a87dd4b37bc7c42deb99d1282a3fc2b1e23662b814d7bd80a25f0c8cee00480b49f0429770dcc27f89fe.png',
    });
    res.send(200, html);
};

exports.testGoalLinkedTemplate = function (req, res) {
    var html = jade.renderFile('./templates/email/test.jade', {
        owner_name: 'Ahmer',
        goal_linked_by: 'Shaharyar',
        goal_name: "Have a re-union with my buddies which I haven't seen in a while! #buddygoals ",
        goal_linker_profile_link: "http://stackoverflow.com/questions/5697863/dynamic-links-with-jade",
        linked_goal_name: "Go on lunch with my buddy! #buddygoals",
        linked_goal_link: "https://github.com/",
        goal_linked_string: " has linked your goal  ",
        goal_name_link: "https://www.linkagoal.com/dashboard",
        goal_image_link: 'https://i1.linkagoal.com/resources/uploads/31544/thumb/medium/FEg1R9k2Qbb_AtIApmLKsycT.jpg',
        email_type: "goal_linked_with_image"
    });
    res.send(200, html);
};


//API
exports.getUser = function (req, res) {

    /*var fields = req.params.fields.split(',');

     var result = users.parseExpression(fields);

     res.send({a: 'OK', b: result});*/

    //console.log(utils.encode_Hashids(1));

    // var sendEmail = {
    //         actor_user : 13,
    //         from : 'shaharyar.ahmed@hotmail.com',
    //         recipients: { email: ['zeeshan.qureshi@gmail.com', 'shaharyar.ahmed@skillorbit.com'], invite_url: ['inviteIds', 'skillorbit']}, 
    //         type: 'INVITE'
    //     };
    // var email = require('./EmailNotifications.js');
    // email.emailNotifications(sendEmail);


    utils.sendVerificationEmail(13, 'shaharyar.ahmed@skillorbit.com', 'Shaharyar');
};
//emit toast notification
exports.emitToastNotification = function (req, res) {
    var helpers = require('../helpers/helpers');
    var finaldata = [];
    var created = helpers.getUnixTimeStamp();
    for (var i = 0; i < users_ToastNotifications.length; i++) {
        finaldata.push({
            to_id: users_ToastNotifications[i],
            activity_id: activity_id,
            created: created
        });
    }

    console.log('####################### calling utility server');

    return utils.requestServer(process.env.SOCKET_SERVER_PUBLIC_IP, process.env.SOCKET_SERVER_PORT, '/emit/notification', 'POST', finaldata, '1.0.0')
        .then(function (result) {
            console.log('####################### got response from file server');
            console.log('####################### then result', result);

        });

};


exports.user1 = function (req, res) {

    console.log("ASDADADS");
    var Users = objAllTables.users.users();

    //GET User Object
    /*Users.findOne( {where : { status : 'ACTIVE' , uid : 2},
     attributes: ['uid', 'username', 'user_email', 'account_verified', 'first_name', 'middle_name', 'last_name', 'bio', 'gender', 'dob', 'dob_show', 'profile_image_id', 'cover_image_id', 'default_image_id', 'default_cover_image_id', 'last_login', 'status', 'created', 'user_location', 'web_url', 'onboarding_web']
     })
     .then(function(result){
     res.send(200 , result);
     });
     */
    var UserFollowers = objAllTables.user_followers.user_followers();
    //
    //Users.hasMany(UserFollowers, {foreignKey : 'uid'});
    //UserFollowers.belongsTo(Users,{foreignKey : 'uid'});
    //
    //
    //Users.findAll( {where : { status : 'ACTIVE'},
    //    include: [{ model:UserFollowers, where: {follows_uid : 2} }] })
    //    .then(function(result){
    //        res.send(200 , result);
    //});

    //Followings List

    Users.hasMany(UserFollowers, {foreignKey: 'uid'});
    Users.hasMany(UserFollowers, {foreignKey: 'follows_uid'});
    // UserFollowers.belongsTo(Users,{foreignKey : 'uid'});
    //  UserFollowers.belongsTo(Users,{foreignKey : 'uid'});


    Users.findAll({
        where: {status: 'ACTIVE'},
        include: [{model: UserFollowers, where: {uid: 2}}]
    })
        .then(function (result) {
            res.send(200, result);
        });


}

var jade = require('jade');
var anchorme = require('../node_modules/anchorme.js/src/anchorme.js')
exports.user = function (req, res) {
    //var anchorme = require('anchorme.js')
    var result = anchorme.js("learn abc in one day www.englishspeaking.com");
    //var result = "learn abc in one day www.englishspeaking.com";

    console.time('jade-rendering');
    var html = jade.renderFile('templates/email/Progress Update On Followed Goal Email.jade', { actor_name: "Mubeen Ahmed", actor_url:"https://linkagoal.com/mubeen_ahm", actor_img: "https://cdn.linkagoal.com/resources/uploads/27525/thumb/medium/PQJzC_saAnBUMr7HSV7YBUkC.jpg"
        ,progress_update:result , progress_update_url:"https://linkagoal.com/activity/123", progress_update_img: "https://i1.linkagoal.com/resources/uploads/31544/thumb/medium/FEg1R9k2Qbb_AtIApmLKsycT.jpg" ,
        username:"ahmer.saeed",
        first_name: "Ahmer Saeed",goal_name:"Learn English"} )
    console.timeEnd('jade-rendering');

    res.send(200, html)
}

function template(locals) {
    var buf = [];
    var jade_mixins = {};
    var jade_interp;
    var locals_for_with = locals || {};
    (function(actor_img, actor_name, actor_url, first_name, goal_name, goal_url, progress_update, progress_update_img, progress_update_url, username) {
        if (progress_update_img) {
            buf.push("<a" + jade.attr("href", "" + progress_update_url + "", true, false) + ' style="text-decoration:none;"><img alt="Linkagoal"' + jade.attr("src", "" + progress_update_img + "", true, false) + ' width="540" height="" border="0" style="display: block; width: 100%; height: auto; max-width: 540px; max-height: 304px;"/></a>');
        }
        buf.push('</tr></table></td></tr><tr><td width="600" style="padding-top:2px;padding-left:30px;padding-right:30px;padding-bottom:40px;background-color:#ffffff;"><table cellspacing="0" cellpadding="0" border="0" style="border-collapse:collapse;"><tr><td width="540" valign="middle" align="center" style="padding-top:10px;padding-bottom:10px;text-align:center;font-size:14px;color:#ffffff;background-color:#1bbc9b;font-family: \'Geomanist-Regular\',\'Helvetica Neue\', Helvetica, \'Segoe UI\', \'Lucida Grande\', Arial, sans-serif;"><a' + jade.attr("href", "" + progress_update_url + "", true, false) + ' style="color:#ffffff;text-decoration:none;font-family: \'Geomanist-Regular\',\'Helvetica Neue\', Helvetica, \'Segoe UI\', \'Lucida Grande\', Arial, sans-serif;">View Update</a></td></tr></table></td></tr></table></td></tr><!-- Content--></table></td></tr><!-- Footer--><tr><td width="600"><table border="0" cellpadding="0" cellspacing="0" align="center" width="100%" role="module" data-type="footer" class="module footer"><tr><td style="padding: 15px 30px 15px 30px;" bgcolor="#e5e8e5"><table border="0" cellpadding="0" cellspacing="0" style="table-layout: fixed;"><!-- App link section--><tr><td width="540" valign="middle" align="center" style="color: #6e6e6e; padding-top: 15px; text-align: center !important;font-family:helvetica, arial, sans-serif;font-size:15px;font-family:\'Geomanist-Regular\',\'Helvetica Neue\', Helvetica, \'Segoe UI\', \'Lucida Grande\', ' +
            'Arial, sans-serif;font-size:14px;"><table cellspacing="0" cellpadding="0" border="0" style="border-collapse:collapse;margin:auto;"><tr><td align="right" style="color: #6e6e6e; text-align: right !important;font-family:helvetica, arial, sans-serif;font-size:15px;font-family:\'Geomanist-Regular\',\'Helvetica Neue\', Helvetica, \'Segoe UI\', \'Lucida Grande\', Arial, sans-serif;font-size:14px;" valign="middle">Download our Mobile App</td><td align="left" style="text-align:left;" valign="middle"><a href="https://itunes.apple.com/us/app/linkagoal-share-your-life/id959763295?mt=8" style="text-decoration:none;padding-right: 10px;display:inline-block;"><img width="28" height="28" alt="Linkagoal ios app" src="https://marketing-image-production.s3.amazonaws.com/uploads/51e972a53c7e63ab8086af8191e39bfdb2c444a6f5aae2e5228485822cbc188cb9f8e53842667eca4ada27abc2fb389e0b0278fda9ce261fe133680ebcbbc2cf.png" style="border-style:none; width: 28px; height: 28px;"/></a><a href="https://play.google.com/store/apps/details?id=com.linkagoal.app&amp;hl=en" style="text-decoration:none;display:inline-block;"><img width="28" height="28" alt="Linkagoal android app" src="https://marketing-image-production.s3.amazonaws.com/uploads/204c7c32c769b43acf855d3dbd3795166fcab0ef61c372af6690858cd886133a14a8629c5eff168f04c225517bc96ff9f3af107fcf5ea46b3a6840d7edb92908.png" ' +
            'style="border-style:none; width: 28px; height: 28px;"/></a></td></tr></table></td></tr><tr></tr></table></td></tr></table><td style="padding-top: 10px; padding-bottom: 20px; text-align: center;font-family:helvetica, arial, sans-serif;font-size:15px;font-family:\'Geomanist-Regular\',\'Helvetica Neue\', Helvetica, \'Segoe UI\', \'Lucida Grande\', Arial, sans-serif;font-size:10px;color: #888888 !important; line-height: 16px;">440 North Wolfe Rd, Sunnyvale, CA, 94085  <a' + jade.attr("href", "https://www.linkagoal.com/login?next=https://www.linkagoal.com/" + username + "/settings/notifications", true, false) + " style=\"text-decoration:none;font-family:'Geomanist-Regular','Helvetica Neue', Helvetica, 'Segoe UI', 'Lucida Grande', Arial, sans-serif;font-size:10px;color: #1bb99a; text-decoration: none;\" class=\"ftreg ft12\">Email Settings</a></td></td></tr></table></td></tr></table></body></html>");
    }).call(this, "actor_img" in locals_for_with ? locals_for_with.actor_img : typeof actor_img !== "undefined" ? actor_img : undefined, "actor_name" in locals_for_with ? locals_for_with.actor_name : typeof actor_name !== "undefined" ? actor_name : undefined, "actor_url" in locals_for_with ? locals_for_with.actor_url : typeof actor_url !== "undefined" ? actor_url : undefined, "first_name" in locals_for_with ? locals_for_with.first_name : typeof first_name !== "undefined" ? first_name : undefined, "goal_name" in locals_for_with ? locals_for_with.goal_name : typeof goal_name !== "undefined" ? goal_name : undefined, "goal_url" in locals_for_with ? locals_for_with.goal_url : typeof goal_url !== "undefined" ? goal_url : undefined, "progress_update" in locals_for_with ? locals_for_with.progress_update : typeof progress_update !== "undefined" ? progress_update : undefined, "progress_update_img" in locals_for_with ? locals_for_with.progress_update_img : typeof progress_update_img !== "undefined" ? progress_update_img : undefined, "progress_update_url" in locals_for_with ? locals_for_with.progress_update_url : typeof progress_update_url !== "undefined" ? progress_update_url : undefined, "username" in locals_for_with ? locals_for_with.username : typeof username !== "undefined" ? username : undefined);
    return buf.join("");
}
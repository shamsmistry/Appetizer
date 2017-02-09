//#############################################################
//##################### Requiring Files #######################
//#############################################################

//npm
var validator = require('validator');
var chalk = require('chalk');
var _ = require('lodash');
var jade = require('jade');

//libs
var emailConfig = require('../config/email_config');
var sendGrid = require('../lib/SendGrid');

//others
var helpers = require('../helpers/helpers');
var config = require('../config');
var classAllTables = require('../models/alltables');

//instances
var objAllTables = classAllTables.allTables;

//global variable
var templates = emailConfig.allTemplates;

//models
var models = require('../models');
var User = require('../models/User');
var Goal = require('../models/Goal');
var Post = require('../models/Post');
var Milestone = require('../models/Milestone');

//#############################################################
//###################### Public Methods #######################
//#############################################################

exports.emailNotifications = function (notification_info) {

    //############################## Documentation ############################## 
    //object to be received
    //initialNotificationObj = {
    //    To_uid: [],
    //    actor_user: 1,
    //    type: 'PROGRESS_UPDATE',
    //    data: {
    //        source_id: 1
    //    }
    //};
    //############################## Documentation ############################## 

    if (notification_info.type == 'CONTRIBUTION') {

        if (notification_info.To_uid.owners.length > 0) {

            var notification_info_clone = _.cloneDeep(notification_info);
            notification_info_clone.relation = 'OWNER';

            emailNotifications_ObjectRendering(notification_info_clone, notification_info_clone.type, notification_info_clone.To_uid.owners).then(function (data) {
                Contribution_SendEmails(templates.CONTRIBUTION.id, data.body, data);
            });
        }

        if (notification_info.To_uid.followers.length > 0) {

            var notification_info_clone = _.cloneDeep(notification_info);
            notification_info_clone.relation = 'FOLLOWER';

            emailNotifications_ObjectRendering(notification_info_clone, notification_info_clone.type, notification_info_clone.To_uid.followers).then(function (data) {
                Contribution_SendEmails(templates.CONTRIBUTION.id, data.body, data);
            });
        }

        if (notification_info.To_uid.linkers.length > 0) {

            var notification_info_clone = _.cloneDeep(notification_info);
            notification_info_clone.relation = 'LINKER';

            emailNotifications_ObjectRendering(notification_info_clone, notification_info_clone.type, notification_info_clone.To_uid.linkers).then(function (data) {
                Contribution_SendEmails(templates.CONTRIBUTION.id, data.body, data);
            });
        }
    }
    else if (notification_info.type == 'LINK_GOAL') {

        emailNotifications_ObjectRendering(notification_info, notification_info.type, notification_info.To_uid).then(function (data) {
            LinkGoal_SendEmails(templates.LINK_GOAL.id, data.body, data);
        });

    }
    else if (notification_info.type == 'PROGRESS_UPDATED') {

        if (notification_info.To_uid.followers.length > 0) {
            notification_info.relation = 'FOLLOWER';
            emailNotifications_ObjectRendering(notification_info, notification_info.type, notification_info.To_uid.followers).then(function (data) {
                ProgressUpdated_SendEmails(templates.PROGRESS_UPDATED.id, data.body, data);
            });
        }

        if (notification_info.To_uid.linkers.length > 0) {
            notification_info.relation = 'LINKER';
            emailNotifications_ObjectRendering(notification_info, notification_info.type, notification_info.To_uid.linkers).then(function (data) {
                ProgressUpdated_SendEmails(templates.PROGRESS_UPDATED.id, data.body, data);
            });
        }
    }
    else if (notification_info.type == 'MILESTONE_CREATED') {

        emailNotifications_ObjectRendering(notification_info, notification_info.type, notification_info.To_uid).then(function (data) {
            MilestoneCreated_SendEmails(templates.MILESTONE_CREATED.id, data.body, data);
        });

    }
    else if (notification_info.type == 'MILESTONE_COMPLETED') {

        emailNotifications_ObjectRendering(notification_info, notification_info.type, notification_info.To_uid).then(function (data) {
            MilestoneCompleted_SendEmails(templates.MILESTONE_COMPLETED.id, data.body, data);
        });

    }
    else if (notification_info.type == 'GOAL_FOLLOWED') {
        emailNotifications_ObjectRendering(notification_info, notification_info.type, notification_info.To_uid).then(function (data) {
            GoalFollowed_SendEmails(templates.GOAL_FOLLOWED.id, data);
        });
    }
    else if (notification_info.type == 'USER_FOLLOWED') {
        emailNotifications_ObjectRendering(notification_info, notification_info.type, notification_info.To_uid).then(function (data) {
            UserFollowed_SendEmails(templates.USER_FOLLOWED.id, data);
        });
    }

    // return emailNotifications_ObjectRendering(notification_info)
    //     .then(function (data) {

    //         console.log(chalk.yellow('============================================ ( start )'));
    //         console.log(chalk.yellow('Engagement Email - SENDING TO - for type: ' + notification_info.type));
    //         console.log(data.to_email);
    //         console.log(chalk.yellow('============================================ ( end )'));

    //         if (notification_info.type == 'CONTRIBUTION') {
    //             Contribution_SendEmails(templates.CONTRIBUTION.id, result.body, data);
    //         }
    //         else if (notification_info.type == 'PROGRESS_UPDATED') {
    //             ProgressUpdated_SendEmails(templates.PROGRESS_UPDATED.id, result.body, data);
    //         }
    //         else if (notification_info.type == 'GOAL_FOLLOWED') {
    //             GoalFollowed_SendEmails(templates.GOAL_FOLLOWED.id, result.body, data);
    //         }
    //         else if (notification_info.type == 'USER_FOLLOWED') {
    //             UserFollowed_SendEmails(templates.USER_FOLLOWED.id, result.body, data)
    //         }
    //         else if (notification_info.type == 'MILESTONE_CREATED') {
    //             MilestoneCreated_SendEmails(templates.MILESTONE_CREATED.id, result.body, data)
    //         }
    //         else if (notification_info.type == 'MILESTONE_COMPLETED') {
    //             MilestoneCompleted_SendEmails(templates.MILESTONE_COMPLETED.id, result.body, data)
    //         }
    //         else if (notification_info.type == 'LINK_GOAL') {
    //             LinkGoal_SendEmails(templates.LINK_GOAL.id, result.body, data)
    //         }
    //         else if (notification_info.type == 'MOTIVATE_ON_GOAL') {
    //             MotivationOnGoals_SendEmails(templates.MOTIVATE_ON_GOAL.id, result.body, data)
    //         }
    //         else if (notification_info.type == 'INVITE') {
    //             Invite_SendEmails(templates.INVITE.id, result.body, data, notification_info)
    //         }
    //     }).catch(function (err) {
    //         if (err.message == "email not found") {
    //             return false;
    //         } else {
    //             throw err;
    //         }
    //     });
}

exports.emailNotifications_Personal = function (notification_info) {

    //############################## Documentation ############################## 
    /*
     (object to be received)
     {
     uid: [],
     type: 'WELCOME',
     data: {
     ..if any
     }
     }
     */
    //############################## Documentation ############################## 

    return getEmailById(notification_info.to_uid)
        .then(function (recipients) {
            if (notification_info.type == 'WELCOME') {
                Welcome_SendEmails(templates.WELCOME.id, recipients);
            }
            else if (notification_info.type == 'VERIFICATION_EMAIL') {
                EmailVerification_SendEmails(templates.VERIFICATION_EMAIL.id, notification_info.data);
            }
            else if (notification_info.type == 'DEACTIVATION_EMAIL') {
                AccountDeactivation_SendEmails(templates.DEACTIVATION_EMAIL.id, recipients);
            }
            else if (notification_info.type == 'RESET_PASSWORD') {
                ResetPassword_SendEmails(templates.RESET_PASSWORD.id, recipients, notification_info.data);
            }
            else if (notification_info.type == 'PASSWORD_CHANGE_EMAIL') {
                PasswordChanged_SendEmails(templates.PASSWORD_CHANGE_EMAIL.id, recipients);
            }
        });
}

exports.emailNotifications_Direct = function (notification_info) {
    if (notification_info.type == 'Thankyou_For_Your_Feedback') {
        Thankyou_For_Your_Feedback(templates.Thankyou_For_Your_Feedback.id, notification_info);
    }
    else if (notification_info.type == 'FEEDBACK_RECEIVED') {
        FEEDBACK_RECEIVED(templates.FEEDBACK_RECEIVED.id, notification_info);
    }
    else if (notification_info.type == 'UGLY_WORDS') {
        UGLY_WORDS(null, notification_info);
    }
}

function Thankyou_For_Your_Feedback(template_id, recipients) {
    var emailObj =
        {
            to: recipients.to_email,
            subject: 'Thank You For Your Feedback',
            from: emailConfig.emailFrom.from,
            textBody: 'null',
            htmlBody: '<h1></h1>',
            enable: '1',
            templateId: template_id,
            substitutions: {
                '%first_name%': [recipients.to_name]
            }
        }

    return new Promise(function (resolveEmail) {
        var isEmailSent = sendGrid.sendEmail(emailObj);
        resolveEmail(isEmailSent);
    })
        .then(function (emailResult) {
            console.log(emailResult);
        });
}

function FEEDBACK_RECEIVED(template_id, recipients) {
    var emailObj =
        {
            to: [emailConfig.emailFrom.feedback],
            subject: 'Feedback Received',
            from: emailConfig.emailFrom.from,
            textBody: 'null',
            htmlBody: '<h1></h1>',
            enable: '1',
            templateId: template_id,
            substitutions: {
                '%feedback%': [recipients.feedback]
            }
        }
    return new Promise(function (resolveEmail) {
        var isEmailSent = sendGrid.sendEmail(emailObj);
        resolveEmail(isEmailSent);
    })
        .then(function (emailResult) {
            console.log(emailResult);
        });
}

function UGLY_WORDS(template_id, recipients) {
    var emailObj =
        {
            to: [emailConfig.emailFrom.feedback],
            subject: 'UGLY_WORDS',
            from: emailConfig.emailFrom.from,
            textBody: 'null',
            htmlBody: '<h1></h1>',
            enable: '1',
            templateId: template_id,
            substitutions: {
                '%feedback%': [recipients.feedback]
            }
        }
    return new Promise(function (resolveEmail) {
        var isEmailSent = sendGrid.sendEmail(emailObj);
        resolveEmail(isEmailSent);
    })
        .then(function (emailResult) {
            console.log(emailResult);
        });
}

//#############################################################
//####################### Email Senders #######################
//#############################################################

//####################### Engagement Emails #######################

function Contribution_SendEmails(template_id, body, data) {

    var emailObj =
        {
            to: data.to_email,
            subject: data.substitutions.post.user.name + ' contributed on goal "' + data.substitutions.goal.name + '"',
            from: emailConfig.emailFrom.from,
            fromname: data.substitutions.post.user.name + ' (Linkagoal)',
            textBody: 'null',
            //htmlBody: emailReplacement(body, data.substitutions),
            htmlBody: body,
            enable: '1',
            templateId: template_id,
            substitutions: {
                '%first_name%': data.to_name
            }
        }

    return new Promise(function (resolveEmail) {
        var isEmailSent = sendGrid.sendEmail(emailObj);
        resolveEmail(isEmailSent);
    })
        .then(function (emailResult) {
            console.log('email sent results: ', emailResult);
        });
}

function ProgressUpdated_SendEmails(template_id, body, data) {

    var emailObj =
        {
            to: data.to_email,
            subject: data.substitutions.post.user.name + ' updated progress on "' + data.substitutions.goal.name + '"',
            from: emailConfig.emailFrom.from,
            fromname: data.substitutions.post.user.name + ' (Linkagoal)',
            textBody: 'null',
            htmlBody: body,
            // htmlBody: emailReplacement(body, data.substitutions),
            enable: '1',
            templateId: template_id,
            substitutions: {
                '%first_name%': data.to_name
            }
        }

    return new Promise(function (resolveEmail) {
        var isEmailSent = sendGrid.sendEmail(emailObj);
        resolveEmail(isEmailSent);
    })
        .then(function (emailResult) {
            console.log(emailResult);
        });
}

function GoalFollowed_SendEmails(template_id, data) {
    var emailObj =
        {
            to: data.to_email,
            subject: data.substitutions.user.name + ' followed your goal "' + data.substitutions.goal.name + '"',
            from: emailConfig.emailFrom.from,
            fromname: data.substitutions.user.name + ' (Linkagoal)',
            textBody: 'null',
            //htmlBody: emailReplacement(body, data.substitutions),
            htmlBody: "<h7> </h7>",
            enable: '1',
            templateId: template_id,
            substitutions: {
                '%first_name%': data.to_name,
                '%username%': data.to_username,
                '%actor_name%': [data.substitutions.user.name],
                '%actor_url%': [new Array(config.baseUrl.domain, data.substitutions.user.username).toURL()],
                '%actor_username%': [data.substitutions.user.username],
                '%actor_bio%': [data.substitutions.user.bio || ''],
                '%actor_img%': [data.substitutions.user.profile.small],
                '%goal_name%': [data.substitutions.goal.name],
                '%goal_url%': [new Array(config.baseUrl.domain, data.substitutions.user.username, 'goal', data.substitutions.goal.id, data.substitutions.goal.link).toURL()]
            }
        }
    return new Promise(function (resolveEmail) {
        var isEmailSent = sendGrid.sendEmail(emailObj);
        resolveEmail(isEmailSent);
    })
        .then(function (emailResult) {
            console.log(emailResult);
        });
}

function UserFollowed_SendEmails(template_id, data) {
    var emailObj =
        {
            to: data.to_email,
            subject: data.substitutions.user.name + ' followed you',
            from: emailConfig.emailFrom.from,
            fromname: data.substitutions.user.name + ' (Linkagoal)',
            textBody: 'null',
            htmlBody: "<h7> </h7>",
            enable: '1',
            templateId: template_id,
            substitutions: {
                '%first_name%': data.to_name,
                '%username%': data.to_username,
                '%actor_name%': [data.substitutions.user.name],
                '%actor_url%': [new Array(config.baseUrl.domain, data.substitutions.user.username).toURL()],
                '%actor_username%': [data.substitutions.user.username],
                '%actor_bio%': [data.substitutions.user.bio || ''],
                '%actor_img%': [data.substitutions.user.profile.small]
            }
        }
    return new Promise(function (resolveEmail) {
        var isEmailSent = sendGrid.sendEmail(emailObj);
        resolveEmail(isEmailSent);
    })
        .then(function (emailResult) {
            console.log(emailResult);
        });
}

function MilestoneCreated_SendEmails(template_id, body, data) {

    var emailObj =
        {
            to: data.to_email,
            subject: data.substitutions.goal.user.name + ' created a new milestone on "' + data.substitutions.goal.name + '"',
            from: emailConfig.emailFrom.from,
            fromname: data.substitutions.goal.user.name + ' (Linkagoal)',
            textBody: 'null',
            htmlBody: body,
            //htmlBody: emailReplacement(body, data.substitutions),
            enable: '1',
            templateId: template_id,
            substitutions: {
                '%first_name%': data.to_name
            }
        }

    return new Promise(function (resolveEmail) {
        var isEmailSent = sendGrid.sendEmail(emailObj);
        resolveEmail(isEmailSent);
    })
        .then(function (emailResult) {
            console.log(emailResult);
        });
}

function MilestoneCompleted_SendEmails(template_id, body, data) {

    var emailObj =
        {
            to: data.to_email,
            subject: data.substitutions.goal.user.name + ' completed a milestone on "' + data.substitutions.goal.name + '"',
            from: emailConfig.emailFrom.from,
            fromname: data.substitutions.goal.user.name + ' (Linkagoal)',
            textBody: 'null',
            htmlBody: body,
            //htmlBody: emailReplacement(body, data.substitutions),
            enable: '1',
            templateId: template_id,
            substitutions: {
                '%first_name%': data.to_name
            }
        }

    return new Promise(function (resolveEmail) {
        var isEmailSent = sendGrid.sendEmail(emailObj);
        resolveEmail(isEmailSent);
    })
        .then(function (emailResult) {
            console.log(emailResult);
        });
}

function LinkGoal_SendEmails(template_id, body, data) {
    var emailObj =
        {
            to: data.to_email,
            subject: data.substitutions.goal1.user.name + ' linked with your goal "' + data.substitutions.goal2.name + '"',
            from: emailConfig.emailFrom.from,
            fromname: data.substitutions.goal1.user.name + ' (Linkagoal)',
            textBody: 'null',
            htmlBody: body,
            //htmlBody: emailReplacement(body, data.substitutions),
            enable: '1',
            templateId: template_id,
            substitutions: {
                '%first_name%': data.to_name
            }
        }

    return new Promise(function (resolveEmail) {
        var isEmailSent = sendGrid.sendEmail(emailObj);
        resolveEmail(isEmailSent);
    })
        .then(function (emailResult) {
            console.log(emailResult);
        });
}

function MotivationOnGoals_SendEmails(template_id, body, data) {
    var emailObj =
        {
            to: data.to_email,
            subject: data.substitutions.actor_name + ' motivated your goal "' + data.substitutions.goal_name + '"',
            from: emailConfig.emailFrom.from,
            fromname: data.substitutions.actor_name + ' (Linkagoal)',
            textBody: 'null',
            htmlBody: emailReplacement(body, data.substitutions),
            enable: '1',
            templateId: template_id,
            substitutions: {
                '%first_name%': data.to_name
            }
        }

    return new Promise(function (resolveEmail) {
        var isEmailSent = sendGrid.sendEmail(emailObj);
        resolveEmail(isEmailSent);
    })
        .then(function (emailResult) {
            console.log(emailResult);
        });
}

//####################### Personal Emails #######################

function Welcome_SendEmails(template_id, recipients) {

    var emailObj =
        {
            to: recipients.to_email,
            subject: 'Welcome to linkagoal',
            from: emailConfig.emailFrom.from,
            textBody: 'null',
            htmlBody: '<h1></h1>',
            enable: '1',
            templateId: template_id,
            substitutions: {
                '%first_name%': recipients.to_name
            }
        }

    return new Promise(function (resolveEmail) {
        var isEmailSent = sendGrid.sendEmail(emailObj);
        resolveEmail(isEmailSent);
    })
        .then(function (emailResult) {
            console.log(emailResult);
        });
}

function EmailVerification_SendEmails(template_id, data) {

    var emailObj =
        {
            to: [data.useremail],
            subject: 'Verification email',
            from: emailConfig.emailFrom.from,
            textBody: 'null',
            htmlBody: '<h1></h1>',
            enable: '1',
            templateId: template_id,
            substitutions: {
                '%first_name%': [data.name],
                '%verify_email_link%': [data.verify_email_link]
            }
        }

    return new Promise(function (resolveEmail) {
        var isEmailSent = sendGrid.sendEmail(emailObj);
        resolveEmail(isEmailSent);
    })
        .then(function (emailResult) {
            console.log(emailResult);
        });
}

function AccountDeactivation_SendEmails(template_id, recipients) {

    var emailObj =
        {
            to: recipients.to_email,
            subject: 'Account Deactivated',
            from: emailConfig.emailFrom.from,
            textBody: 'null',
            htmlBody: '<h1></h1>',
            enable: '1',
            templateId: template_id,
            substitutions: {
                '%first_name%': recipients.to_name
            }
        }

    return new Promise(function (resolveEmail) {
        var isEmailSent = sendGrid.sendEmail(emailObj);
        resolveEmail(isEmailSent);
    })
        .then(function (emailResult) {
            console.log(emailResult);
        });
}

function ResetPassword_SendEmails(template_id, recipients, data) {

    var emailObj =
        {
            to: recipients.to_email,
            subject: 'Please Reset Your Password',
            from: emailConfig.emailFrom.from,
            textBody: 'null',
            htmlBody: '<h1></h1>',
            enable: '1',
            templateId: template_id,
            substitutions: {
                '%first_name%': recipients.to_name,
                '%reset_password_link%': [data.reset_password_link]
            }
        }

    return new Promise(function (resolveEmail) {
        var isEmailSent = sendGrid.sendEmail(emailObj);
        resolveEmail(isEmailSent);
    })
        .then(function (emailResult) {
            console.log(emailResult);
        });
}

function PasswordChanged_SendEmails(template_id, recipients) {

    var emailObj =
        {
            to: recipients.to_email,
            subject: 'Your Password has been Changed',
            from: emailConfig.emailFrom.from,
            textBody: 'null',
            htmlBody: '<h1></h1>',
            enable: '1',
            templateId: template_id,
            substitutions: {
                '%first_name%': recipients.to_name
            }
        }

    return new Promise(function (resolveEmail) {
        var isEmailSent = sendGrid.sendEmail(emailObj);
        resolveEmail(isEmailSent);
    })
        .then(function (emailResult) {
            console.log(emailResult);
        });
}

//####################### Invitation Emails #######################

function Invite_SendEmails(template_id, body, data, invite_list) {

    var emailObj =
        {
            to: invite_list.recipients.email,
            subject: data.substitutions.actor_name,
            //from: invite_list.from,
            from: emailConfig.emailFrom.from,
            fromname: data.substitutions.actor_name + ' (Linkagoal)',
            textBody: 'null',
            htmlBody: emailReplacement(body, data.substitutions),
            enable: '1',
            templateId: template_id,
            substitutions: {
                '%invitation_link%': [invite_list.recipients.invite_url]
            }
        }

    console.log(chalk.yellow('Invite_SendEmails:'));
    console.log(invite_list.recipients);
    console.log(chalk.yellow('============================================ ( end )'));

    return new Promise(function (resolveEmail) {
        var isEmailSent = sendGrid.sendEmail(emailObj);
        resolveEmail(isEmailSent);
    })
        .then(function (emailResult) {
            console.log('INVITE email', emailResult);
        });
}

//#######################################################################
//####################### Email Object Generators #######################
//#######################################################################

function getSubstitutions(type, data) {

    var _users = [];
    var _user_uid = [];

    var _posts = [];
    var _post_id = [];

    var _goals = [];
    var _goal_id = [];

    var _milestones = [];
    var _milestone_id = [];

    var substitutions = {};    //final object to be returned

    var input = {
        goal: {
            basic: ['name', 'link'],
            user: {
                basic: ['name', 'username', 'link', 'bio'],
                profile: ['small', 'medium'],
            },
            cover: ['medium', 'large', 'xlarge'],
        },
        user: {
            basic: ['name', 'username', 'email', 'link', 'bio'],
            profile: ['small', 'medium'],
        },
        post: {
            basic: ['text'],
            user: {
                basic: ['name', 'username', 'email', 'link', 'bio'],
                profile: ['small', 'medium'],
            },
            embeddedUrl: true
        },
        milestone: {
            basic: ['text', 'status']
        }
    };

    //data fetching
    return new Promise(function (resolve, reject) {
        //parsing input
        if (['PROGRESS_UPDATED', 'CONTRIBUTION'].indexOf(type) > -1) {
            _goal_id.push(data.data.goal_id);
            _post_id.push(data.data.post_id);   //actor user will be from POST object
            //delete input.goal.user;             //no need of GOAL owner in this case
        }
        else if (['USER_FOLLOWED'].indexOf(type) > -1) {
            _user_uid.push(data.actor_user);
        }
        else if (['GOAL_FOLLOWED'].indexOf(type) > -1) {
            _user_uid.push(data.actor_user);
            //_user_uid.push(data.actor_uid);
            _goal_id.push(data.data.goal_id);
            delete input.goal.user;             //no need of GOAL owner in this case
        }
        else if (['MILESTONE_CREATED', 'MILESTONE_COMPLETED'].indexOf(type) > -1) {
            _goal_id.push(data.data.goal_id);    //actor user will be from GOAL object
            _milestone_id.push(data.data.milestone_id);
            _post_id.push(data.data.post_id);
            delete input.post.user;             //no need of POST owner in this case            
        }
        else if (['LINK_GOAL'].indexOf(type) > -1) {
            _goal_id.push(data.data.to_goal_id);
            _goal_id.push(data.data.from_goal_id);   //actor user will be from GOAL object
        }
        resolve(null);
    }).then(function () {
        //get USERS
        if (!_.isEmpty(_user_uid) && _.isObject(input.user)) {
            return User.getList(input.user, _user_uid).then(function (users) {
                _users = users;
                return;
            })
        } else {
            return;
        }
    }).then(function () {
        //get POSTS
        if (!_.isEmpty(_post_id) && _.isObject(input.post)) {
            return Post.getList(input.post, _post_id).then(function (posts) {
                _posts = posts
                return;
            })
        } else {
            return;
        }
    }).then(function () {
        //get GOALS
        if (!_.isEmpty(_goal_id) && _.isObject(input.goal)) {
            return Goal.getList(input.goal, _goal_id).then(function (goals) {
                _goals = goals
                return;
            })
        } else {
            return;
        }
    }).then(function () {
        //get MILESTONES
        if (!_.isEmpty(_milestone_id) && _.isObject(input.milestone)) {
            return Milestone.getList(input.milestone, _milestone_id).then(function (milestones) {
                _milestones = milestones
                return;
            })
        } else {
            return;
        }
    }).then(function () {
        //compilation
        if (['PROGRESS_UPDATED', 'CONTRIBUTION'].indexOf(type) > -1) {
            substitutions.post = _.head(_.filter(_posts, function (o) {
                return o.id == data.data.post_id;
            }));

            substitutions.goal = _.head(_.filter(_goals, function (o) {
                return o.id == data.data.goal_id;
            }));
        }
        else if (['USER_FOLLOWED'].indexOf(type) > -1) {
            substitutions.user = _.head(_.filter(_users, function (o) {
                return o.id == data.actor_uid;
            }));
        }
        else if (['GOAL_FOLLOWED'].indexOf(type) > -1) {
            substitutions.user = _.head(_.filter(_users, function (o) {
                return o.id == data.actor_uid;
            }));

            substitutions.goal = _.head(_.filter(_goals, function (o) {
                return o.id == data.data.goal_id;
            }));
        }
        else if (['MILESTONE_CREATED', 'MILESTONE_COMPLETED'].indexOf(type) > -1) {
            substitutions.goal = _.head(_.filter(_goals, function (o) {
                return o.id == data.data.goal_id;
            }));

            substitutions.milestone = _.head(_.filter(_milestones, function (o) {
                return o.id == data.data.milestone_id;
            }));

            substitutions.post = _.head(_.filter(_posts, function (o) {
                return o.id == data.data.post_id;
            }));
        }
        else if (['LINK_GOAL'].indexOf(type) > -1) {
            substitutions.goal1 = _.head(_.filter(_goals, function (o) {
                return o.id == data.data.from_goal_id;
            }));

            substitutions.goal2 = _.head(_.filter(_goals, function (o) {
                return o.id == data.data.to_goal_id;
            }));
        }
        return;
    }).then(function () {
        return substitutions;
    });
}

function ProgressUpdated_GetSubstitutions(actor_uid, goal_id, post_id) {
    var substitutions = {};

    return helpers.getUserMini(actor_uid, actor_uid, false)
        .then(function (user) {
            substitutions.actor_name = user.name;
            substitutions.actor_username = user.username;
            substitutions.actor_img = user.profile.small;
            substitutions.actor_link = new Array(config.baseUrl.domain, user.link).toURL();

            return substitutions;
        })
        .then(function () {
            return helpers.GetGoalMini(goal_id)
                .then(function (goal) {

                    substitutions.goal_name = goal.name;
                    substitutions.goal_link = new Array(config.baseUrl.domain, goal.link).toURL();
                    substitutions.goal_img = goal.cover.medium;

                    return substitutions;
                });

        })
        .then(function () {
            return helpers.getPost(post_id, false, actor_uid)
                .then(function (post) {
                    substitutions.post_text = post.text;
                    substitutions.post_link = new Array(config.baseUrl.domain, post.link).toURL();
                });
        })
        .then(function () {
            return substitutions;
        });
}

function Contribution_GetSubstitutions(actor_uid, goal_id, post_id) {

    var substitutions = {};

    //adding notifying user object
    return helpers.getUserMini(actor_uid, actor_uid, false)
        .then(function (user) {

            substitutions.actor_name = user.name;
            substitutions.actor_img = user.profile.small;
            substitutions.actor_link = new Array(config.baseUrl.domain, user.link).toURL();
            substitutions.actor_username = user.username;

            return substitutions;
        })
        //adding goal
        .then(function () {
            return helpers.GetGoalMini(goal_id)
                .then(function (goal) {

                    substitutions.goal_name = goal.name;
                    substitutions.goal_link = new Array(config.baseUrl.domain, goal.link).toURL();
                    substitutions.goal_img = goal.cover.medium;

                    return substitutions;
                });

        })
        //adding contribution
        .then(function () {
            return helpers.getPost(post_id, false, actor_uid)
                .then(function (post) {

                    substitutions.post_text = post.text;
                    substitutions.post_link = new Array(config.baseUrl.domain, post.link).toURL();

                    return substitutions;
                });

        })
        .then(function () {

            //return final object
            return substitutions;
        });
}

function GoalFollowed_GetSustitutions(actor_uid, goal_id, post_id) {

    var substitutions = {};

    //adding notifying user object
    return helpers.getUserMini(actor_uid, actor_uid, false)
        .then(function (user) {

            substitutions.actor_name = user.name;
            substitutions.actor_img = user.profile.small;
            substitutions.actor_link = new Array(config.baseUrl.domain, user.link).toURL();
            substitutions.actor_username = user.username;

            return substitutions;
        })
        //adding goal
        .then(function () {
            return helpers.GetGoalMini(goal_id)
                .then(function (goal) {

                    substitutions.goal_name = goal.name;
                    substitutions.goal_link = new Array(config.baseUrl.domain, goal.link).toURL();
                    substitutions.goal_img = goal.cover.medium;

                    return substitutions;
                });
        })
        .then(function () {

            //return final object
            return substitutions;
        });
}

function UserFollowed_GetSubstitutions(actor_uid, post_id) {
    var substitutions = {};

    //adding notifying user object
    return helpers.getUserMini(actor_uid, actor_uid, false)
        .then(function (user) {

            substitutions.actor_name = user.name;
            substitutions.actor_img = user.profile.small;
            substitutions.actor_link = new Array(config.baseUrl.domain, user.link).toURL();
            substitutions.actor_username = user.username;


            return substitutions;
        })
        .then(function () {
            return substitutions;
        });
}

function MilestoneCreated_GetSubstitution(actor_uid, goal_id, post_id, milestone_id) {
    var substitutions = {};

    //adding notifying user object
    return helpers.getUserMini(actor_uid, actor_uid, false)
        .then(function (user) {

            substitutions.actor_name = user.name;
            substitutions.actor_username = user.username;
            substitutions.actor_img = user.profile.small;
            substitutions.actor_link = new Array(config.baseUrl.domain, user.link).toURL();

            return substitutions;
        })
        //adding goal
        .then(function () {
            return helpers.GetGoalMini(goal_id)
                .then(function (goal) {

                    substitutions.goal_name = goal.name;
                    substitutions.goal_link = new Array(config.baseUrl.domain, goal.link).toURL();
                    substitutions.goal_img = goal.cover.medium;

                    return substitutions;
                });

        })
        //adding milestone
        .then(function () {
            return helpers.getCreatedMilestoneWithPost(milestone_id, -1)
                .then(function (milestone) {

                    substitutions.milestone = milestone.text;
                    substitutions.milestone_link = milestone.link;

                    substitutions.post_link = new Array(config.baseUrl.domain, milestone.link).toURL();

                    return substitutions;
                });
        })
        .then(function () {

            //return final object
            return substitutions;
        });
}

function MilestoneCompleted_GetSubstitution(actor_uid, goal_id, post_id, milestone_id) {
    var substitutions = {};

    //adding notifying user object
    return helpers.getUserMini(actor_uid, actor_uid, false)
        .then(function (user) {

            substitutions.actor_name = user.name;
            substitutions.actor_username = user.username;
            substitutions.actor_img = user.profile.small;
            substitutions.actor_link = new Array(config.baseUrl.domain, user.link).toURL();


            return substitutions;
        })
        //adding goal
        .then(function () {
            return helpers.GetGoalMini(goal_id)
                .then(function (goal) {

                    substitutions.goal_name = goal.name;
                    substitutions.goal_link = new Array(config.baseUrl.domain, goal.link).toURL();
                    substitutions.goal_img = goal.cover.medium;

                    return substitutions;
                });

        })
        //adding milestone
        .then(function () {
            return helpers.getCompletedMilestoneWithPost(milestone_id, -1)
                .then(function (milestone) {

                    substitutions.milestone = milestone.text;
                    substitutions.milestone_link = milestone.link;

                    substitutions.post_text = milestone.post.text;
                    substitutions.post_link = new Array(config.baseUrl.domain, 'activity/' + milestone.post.id).toURL();
                    return substitutions;
                });

        })
        .then(function () {

            //return final object
            return substitutions;
        });
}

function LinkGoal_GetSubstitution(actor_uid, to_goal_id, from_goal_id, post_id) {

    var substitutions = {};

    //adding notifying user object
    return helpers.getUserMini(actor_uid, actor_uid, false)
        .then(function (user) {

            substitutions.actor_name = user.name;
            substitutions.actor_username = user.username;
            substitutions.actor_img = user.profile.small;
            substitutions.actor_link = new Array(config.baseUrl.domain, user.link).toURL();

            return substitutions;
        })
        //adding goal
        .then(function () {
            return helpers.GetGoalMini(from_goal_id)
                .then(function (goal) {

                    substitutions.goal1_name = goal.name;
                    substitutions.goal1_link = new Array(config.baseUrl.domain, goal.link).toURL();
                    substitutions.goal1_img = goal.cover.medium;

                    return substitutions;
                });

        })


        .then(function () {
            return helpers.GetGoalMini(to_goal_id)
                .then(function (goal) {

                    substitutions.goal2_name = goal.name;
                    substitutions.goal2_link = new Array(config.baseUrl.domain, goal.link).toURL();
                    substitutions.goal2_img = goal.cover.medium;

                    return substitutions;
                });

        });
}

function MotivationOnGoals_GetSubstitution(actor_uid, goal_id) {

    var substitutions = {};

    //adding notifying user object
    return helpers.getUserMini(actor_uid, actor_uid, false)
        .then(function (user) {

            substitutions.actor_name = user.name;
            substitutions.actor_username = user.username;
            substitutions.actor_img = user.profile.small;
            substitutions.actor_link = new Array(config.baseUrl.domain, user.link).toURL();

            return substitutions;
        })
        //adding goal
        .then(function () {
            return helpers.GetGoalMini(goal_id)
                .then(function (goal) {

                    substitutions.goal_name = goal.name;
                    substitutions.goal_link = new Array(config.baseUrl.domain, goal.link).toURL();
                    substitutions.goal_img = goal.cover.medium;

                    return substitutions;
                });

        });


}

function Invite_GetSubstitutions(actor_uid) {
    var substitutions = {};

    //adding notifying user object
    return helpers.getUserMini(actor_uid, actor_uid, false)
        .then(function (user) {

            substitutions.actor_name = user.name;
            substitutions.actor_img = user.profile.small;
            substitutions.actor_link = new Array(config.baseUrl.domain, user.link).toURL();
            substitutions.actor_username = user.username;

            return substitutions;
        })
        .then(function () {
            return substitutions;
        });
}

//######################################################################
//####################### Email Object Reusables #######################
//######################################################################

function emailNotifications_ObjectRendering(_info, _type, _uids) {

    //############################## Documentation ############################## 
    //object to be received
    /*
     initialNotificationObj = {
     To_uid: [],
     actor_user: 1,
     activity_type: 'PROGRESS_UPDATE',
     data: {
     source_id: 1
     }
     };

     //final object to be returned
     finalNotificationObj = {
     to_email: [],
     to_name: [],
     type: 'PROGRESS_UPDATE',
     substitutions: { }
     };
     */
    //############################## Documentation ############################## 

    var notification_obj = {};

    //var users = models.users();
    return models.users.findAll({
        where: { uid: _uids },
        attributes: ['uid', 'username', 'user_email', 'first_name', 'middle_name', 'last_name']
    })
        //creating arrays to send emails
        .then(function (userEmailIds) {
            if (userEmailIds.length > 0) {

                notification_obj.to_email = [];
                notification_obj.to_name = [];
                notification_obj.to_username = [];

                for (var i = 0; i < userEmailIds.length; i++) {

                    //creating name
                    var name;
                    if (!validator.isNull(userEmailIds[i].dataValues.first_name)) {
                        name = userEmailIds[i].dataValues.first_name;
                    }
                    if (!validator.isNull(userEmailIds[i].dataValues.middle_name)) {
                        name += ' ' + userEmailIds[i].dataValues.middle_name;
                    }
                    if (!validator.isNull(userEmailIds[i].dataValues.last_name)) {
                        name += ' ' + userEmailIds[i].dataValues.last_name;
                    }

                    //push into arrays
                    notification_obj.to_name.push(name);
                    notification_obj.to_username.push(userEmailIds[i].dataValues.username);
                    notification_obj.to_email.push(userEmailIds[i].dataValues.user_email);
                }

                return notification_obj;

            }
            else {
                throw new Error("email not found");
            }
        }).then(function () { //creating "data" for email

            return getSubstitutions(_type, _info).then(function (substitutions) {

                if (_type == 'CONTRIBUTION') {
                    substitutions.relation = _info.relation;
                    substitutions.base_url = process.env.WEB_SERVER_URL;
                    notification_obj.substitutions = substitutions;
                    notification_obj.body = jade.renderFile('./templates/email/CONTRIBUTION.jade', substitutions);
                    return notification_obj;
                }
                else if (_type == 'LINK_GOAL') {
                    substitutions.relation = _info.relation;
                    substitutions.base_url = process.env.WEB_SERVER_URL;
                    notification_obj.substitutions = substitutions;
                    notification_obj.body = jade.renderFile('./templates/email/LINK_GOAL.jade', substitutions);
                    return notification_obj;
                }
                else if (_type == 'PROGRESS_UPDATED') {
                    substitutions.relation = _info.relation;
                    substitutions.base_url = process.env.WEB_SERVER_URL;
                    notification_obj.substitutions = substitutions;
                    notification_obj.body = jade.renderFile('./templates/email/PROGRESS_UPDATED.jade', substitutions);
                    return notification_obj;
                }
                else if (_type == 'MILESTONE_CREATED' || _type == 'MILESTONE_COMPLETED') {
                    substitutions.relation = _info.relation;
                    substitutions.base_url = process.env.WEB_SERVER_URL;
                    notification_obj.substitutions = substitutions;
                    if (_type == 'MILESTONE_CREATED')
                        notification_obj.body = jade.renderFile('./templates/email/MILESTONE_CREATED.jade', substitutions);
                    else
                        notification_obj.body = jade.renderFile('./templates/email/MILESTONE_COMPLETED.jade', substitutions);
                    return notification_obj;
                }
                else if (_type == 'GOAL_FOLLOWED') {
                    notification_obj.substitutions = substitutions;
                    return notification_obj;
                }
                else if (_type == 'USER_FOLLOWED') {
                    notification_obj.substitutions = substitutions;
                    return notification_obj;
                }

            });

        });

}

function emailNotifications_ObjectRendering_old(notification_info) {

    //############################## Documentation ############################## 
    //object to be received
    /*
     initialNotificationObj = {
     To_uid: [],
     actor_user: 1,
     activity_type: 'PROGRESS_UPDATE',
     data: {
     source_id: 1
     }
     };

     //final object to be returned
     finalNotificationObj = {
     to_email: [],
     to_name: [],
     type: 'PROGRESS_UPDATE',
     substitutions: { }
     };
     */
    //############################## Documentation ############################## 

    var notification_obj = {};

    var users = objAllTables.users.users();
    return users.findAll({
        where: { uid: notification_info.To_uid },
        attributes: ['uid', 'user_email', 'first_name', 'middle_name', 'last_name']
    })
        //creating arrays to send emails
        .then(function (userEmailIds) {
            if (userEmailIds.length > 0) {

                notification_obj.to_email = [];
                notification_obj.to_name = [];

                for (var i = 0; i < userEmailIds.length; i++) {

                    //creating name
                    var name;
                    if (!validator.isNull(userEmailIds[i].dataValues.first_name)) {
                        name = userEmailIds[i].dataValues.first_name;
                    }
                    if (!validator.isNull(userEmailIds[i].dataValues.middle_name)) {
                        name += ' ' + userEmailIds[i].dataValues.middle_name;
                    }
                    if (!validator.isNull(userEmailIds[i].dataValues.last_name)) {
                        name += ' ' + userEmailIds[i].dataValues.last_name;
                    }

                    //push into arrays
                    notification_obj.to_name.push(name);
                    notification_obj.to_email.push(userEmailIds[i].dataValues.user_email);
                }

                return notification_obj;

            }
            else {
                throw new Error("email not found");
            }
        })
        //creating "data" for email
        .then(function () {

            if (notification_info.type == 'CONTRIBUTION') {

                notification_obj.type = notification_info.type;

                return Contribution_GetSubstitutions(notification_info.actor_user, notification_info.data.goal_id, notification_info.data.post_id)
                    .then(function (substitutions) {
                        notification_obj.substitutions = substitutions;

                        return notification_obj;
                    });
            }
            else if (notification_info.type == 'PROGRESS_UPDATED') {

                notification_obj.type = notification_info.type;

                return ProgressUpdated_GetSubstitutions(notification_info.actor_user, notification_info.data.goal_id, notification_info.data.post_id)
                    .then(function (substitutions) {
                        notification_obj.substitutions = substitutions;
                        return notification_obj;
                    });
            }
            else if (notification_info.type == 'GOAL_FOLLOWED') {

                notification_obj.type = notification_info.type;

                return GoalFollowed_GetSustitutions(notification_info.actor_user, notification_info.data.goal_id, notification_info.data.post_id)
                    .then(function (substitutions) {
                        notification_obj.substitutions = substitutions;
                        return notification_obj;
                    });

            }
            else if (notification_info.type == 'USER_FOLLOWED') {

                notification_obj.type = notification_info.type;

                return UserFollowed_GetSubstitutions(notification_info.actor_user, notification_info.data.post_id)
                    .then(function (substitutions) {
                        notification_obj.substitutions = substitutions;
                        return notification_obj;
                    });

            }
            else if (notification_info.type == 'MILESTONE_CREATED') {

                notification_obj.type = notification_info.type;

                return MilestoneCreated_GetSubstitution(notification_info.actor_user, notification_info.data.goal_id, notification_info.data.post_id, notification_info.data.milestone_id)
                    .then(function (substitutions) {
                        notification_obj.substitutions = substitutions;
                        return notification_obj;
                    });

            }
            else if (notification_info.type == 'MILESTONE_COMPLETED') {

                notification_obj.type = notification_info.type;

                return MilestoneCompleted_GetSubstitution(notification_info.actor_user, notification_info.data.goal_id, notification_info.data.post_id, notification_info.data.milestone_id)
                    .then(function (substitutions) {
                        notification_obj.substitutions = substitutions;
                        return notification_obj;
                    });

            }
            else if (notification_info.type == 'LINK_GOAL') {

                notification_obj.type = notification_info.type;

                return LinkGoal_GetSubstitution(notification_info.actor_user, notification_info.data.to_goal_id, notification_info.data.from_goal_id, notification_info.data.post_id)
                    .then(function (substitutions) {
                        notification_obj.substitutions = substitutions;
                        return notification_obj;
                    });

            }
            else if (notification_info.type == 'MOTIVATE_ON_GOAL') {

                notification_obj.type = notification_info.type;

                return MotivationOnGoals_GetSubstitution(notification_info.actor_user, notification_info.data.goal_id)
                    .then(function (substitutions) {
                        notification_obj.substitutions = substitutions;
                        return notification_obj;
                    });

            }
            else if (notification_info.type == 'INVITE') {

                notification_obj.type = notification_info.type;

                return Invite_GetSubstitutions(notification_info.actor_user)
                    .then(function (substitutions) {
                        notification_obj.substitutions = substitutions;
                        return notification_obj;
                    });

            }
            else {

                notification_obj.type = notification_info.type;

                return notification_obj;
            }
        });

}

function getEmailById(to_uid) {

    var recipients = {};

    var users = objAllTables.users.users();

    return users.findAll({
        where: { uid: to_uid },
        attributes: ['uid', 'user_email', 'first_name']
    })
        //creating arrays to send emails
        .then(function (userEmailIds) {

            recipients.to_email = [];
            recipients.to_name = [];

            for (var i = 0; i < userEmailIds.length; i++) {

                //creating name
                var name = userEmailIds[i].dataValues.first_name;

                //push into arrays
                recipients.to_name.push(name);
                recipients.to_email.push(userEmailIds[i].dataValues.user_email);
            }
            ;

            return recipients;

        });
}

function emailReplacement(body, subs) {

    for (var key in subs) {
        var regex = new RegExp("%" + key + "%", 'g');
        body = body.replace(regex, subs[key]);
    }

    return body;
}

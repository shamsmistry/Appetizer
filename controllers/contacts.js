var clasAllTables = require('../models/alltables');
var helpers = require('../helpers/helpers');
var validator = require('validator');
var Promise = require("bluebird");
var db = require('../helpers/db');
var objAllTables = clasAllTables.allTables;
var validate = require("validate.js");
var sequelize = db.sequelizeConn();
var Utils = require('../helpers/Utils');
var config = require('../config');
var _ = require('lodash');

var spamTime = (2 * 60); // 2min

exports.get = function(req, res) {

    helpers.GetActiveSession_ORM(req)
        .then(function(SessionUser) {
            if (SessionUser != null) {
                var ContactsTbl = objAllTables.contacts.contacts();
                var UsersTbl = objAllTables.users.users();
                var pagination = Utils.pagination(req);

                ContactsTbl.hook('afterFind', function(contacts) {
                    return sequelize.Promise.resolve(Promise.each(contacts, function(_contact) {
                        if (_contact.get('user') != null) {
                            return helpers.getUserMini(_contact.dataValues.user.uid, SessionUser.uid, true).then(function(u) {
                                delete _contact.dataValues.invited;
                                _contact.setDataValue('user', u);
                            })
                        } else {
                            delete _contact.dataValues.user;
                        }
                    }))
                })

                ContactsTbl.belongsTo(UsersTbl, { foreignKey: 'email', constraints: false, targetKey: 'user_email', });
                ContactsTbl.findAll({
                        attributes: ['id', 'name', 'email', 'invited', [sequelize.literal('(`contacts`.`updated` >= (UNIX_TIMESTAMP() - {0}))'.format(spamTime)), 'just_invited']],
                        include: [{
                            model: UsersTbl,
                            attributes: ['uid']
                        }],
                        where: { uid: SessionUser.uid },
                        group: ['email'],
                        offset: pagination.offset,
                        limit: pagination.limit,
                        order: 'id DESC'
                    })
                    .then(function(result) {
                        res.send({ meta: { status: 200, message: 'OK' }, data: (result == null) ? [] : result });
                    });
            } else {
                res.send({ meta: { status: 401, message: 'Unauthorized' } });
            }
        })
        .error(function(err) {
            res.send({ meta: { status: 500, message: 'unexpected error' }, details: err });
        });
}

exports.invite = function(req, res) {
    var emails = Utils.validateEmailList(req.body.emails);
    helpers.GetActiveSession_ORM(req).then(function(SessionUser) {
        if (SessionUser != null) {
            var ContactsTbl = objAllTables.contacts.contacts();
            add(emails, SessionUser.uid).then(function(result) {
                //Invite Now
                getOrGenerateInvite(SessionUser.uid).then(function(new_invitation) {
                    invitation_id = new_invitation[0].dataValues.invitation_id;
                    var contacts = objAllTables.contacts.contacts();
                    var UsersTbl = objAllTables.users.users();

                    ContactsTbl.belongsTo(UsersTbl, { as: 'users', foreignKey: 'email', constraints: false, targetKey: 'user_email', });

                    ContactsTbl.findAll({
                        attributes: ['email'],
                        include: [{
                            model: UsersTbl,
                            as: 'users',
                            attributes: ['uid'],
                        }],
                        where: { uid: SessionUser.uid, email: emails, updated: { $lt: helpers.getUnixTimeStamp() - spamTime } },
                        group: ['email']
                    }).then(function(contacts) {

                        if (!_.isEmpty(contacts)) {
                            var EmailsToInvite = [],
                                found = 0,
                                invited = 0;
                            _(contacts).forEach(function(c) {
                                if (c.get('users') == null) {
                                    EmailsToInvite.push(c.get('email').toLowerCase())
                                    invited++;
                                } else {
                                    found++;
                                }
                            })

                            var invite_url = new Array(config.baseUrl.domain, 'register?invitation_id=' + invitation_id).toURL();
                            var emailOptions = {
                                To_uid: SessionUser.uid,
                                actor_user: SessionUser.uid,
                                from: SessionUser.user_email,
                                recipients: { email: EmailsToInvite, invite_url: invite_url },
                                type: 'INVITE'
                            };
                            var email = require('../controllers/EmailNotifications.js');
                            email.emailNotifications(emailOptions);

                            ContactsTbl.update({ invited: 1, updated: helpers.getUnixTimeStamp(), invite_counter: sequelize.literal('invite_counter + 1') }, { where: { email: EmailsToInvite, uid: SessionUser.uid } }).then(function(result) {
                                res.send(200, { meta: { status: 200, message: 'OK' }, data: { invited: invited, found: found } });
                            })
                        } else {
                            res.send(200, { meta: { status: 200, message: 'OK' }, data: { invited: 0, found: 0 } });
                        }
                    });
                })
            })
        } else {
            res.send(401, { meta: { status: 401, message: 'Unauthorized' } });
        }
    })
}

/**
 * [add Added New Emails address to contact and do not insert duplicated record]
 * @param {[Array]} emails [Array of Email addresses]
 * @param {[Integer]} suid   [Session User id]
 * @return {[sequelize.Promise]}     [Return sequelize inserted data]
 */
function add(emails, suid) {
    var ContactsTbl = objAllTables.contacts.contacts();

    return ContactsTbl.findAll({ where: { email: emails, uid: suid }, group: ['email'] }).then(function(result) {
        var foundedEmails = [];
        _(result).forEach(function(value) {
            foundedEmails.push(value.get('email').toLowerCase())
        });
        var Insertion = [];
        newEmails = _.uniqBy(_.differenceBy(emails, foundedEmails))
        _(newEmails).forEach(function(v) {
            Insertion.push({ name: "", email: v, uid: suid, invited: 0, invite_counter: 0, created: helpers.getUnixTimeStamp(), updated: 0 })
        })
        return ContactsTbl.bulkCreate(Insertion);
    })
}

/**
 * [getOrGenerateInvite Generate New Invite id or retrive old id]
 * @param  {[Integrer]} uid [Session Userid]
 * @return {[sequelize.Promise]}     [Return sequelize inserted data or fetched]
 */
function getOrGenerateInvite(uid) {
    var invitation_id = Utils.encode_Hashids([uid, helpers.getUnixTimeStamp()]);
    var invitationsTbl = objAllTables.invitations.invitations();

    return invitationsTbl.findOrCreate({
        where: { uid: uid },
        defaults: {
            invitation_id: invitation_id,
            platform: 'OTHER',
            status: 'ACTIVE',
            created: helpers.getUnixTimeStamp()
        }
    })
}

exports.create = function(req, res) {

    var data = req.body.data;
    //######################### Validations (Rules) #########################
    var constraints = {
        data: {
            presence: true
        }
    };

    //######################### Validations (Attributes) #########################
    var attributes = {
        data: data

    };

    validate.async(attributes, constraints).then(success, error);

    function success() {
        helpers.GetActiveSession_ORM(req)
            .then(function(SessionUser) {
                if (SessionUser != null) {
                    var data = '' + req.body.data;
                    var json = JSON.parse(data);
                    var contacts = objAllTables.contacts.contacts();

                    for (var i = 0; i < json.length; i++) {
                        contacts.create({
                                name: json[i].name,
                                email: json[i].email,
                                uid: SessionUser.uid

                            })
                            .then(function(data) {
                                res.send({ meta: { status: 200, message: 'Success' } });
                            });
                    }


                } else {
                    res.send({ meta: { status: 401, message: 'User is not logged in or invalid token' } });
                }
            })
            .error(function(err) {
                res.send({ meta: { status: 500, message: 'unexpected error' }, details: err });
            });
    }

    function error(errors) {
        if (errors instanceof Error) {
            // This means an exception was thrown from a validator
            res.send({ meta: { status: 401, message: 'An error ocuured in validator' }, errors: errors });
        } else {
            res.send({ meta: { status: 401, message: 'validation errors' }, errors: errors });
        }
    }
}

exports.delete = function(req, res) {

    helpers.GetActiveSession_ORM(req)
        .then(function(SessionUser) {
            if (SessionUser != null) {
                var contacts = objAllTables.contacts.contacts();
                contacts.destroy({ where: { uid: SessionUser.uid } })
                    .then(function() {
                        res.send({ meta: { status: 200, message: 'Contacts deleted successfully' } });
                    });
            } else {
                res.send({ meta: { status: 401, message: 'User is not logged in or invalid token' } });
            }
        })
        .error(function(err) {
            res.send({ meta: { status: 500, message: 'unexpected error' }, details: err });
        });
}

exports.deleteByIds = function(req, res) {

    var data = req.body.data;
    //######################### Validations (Rules) #########################
    var constraints = {
        data: {
            presence: true
        }
    };

    //######################### Validations (Attributes) #########################
    var attributes = {
        data: data

    };

    validate.async(attributes, constraints).then(success, error);

    function success() {
        helpers.GetActiveSession_ORM(req)
            .then(function(SessionUser) {
                if (SessionUser != null) {
                    var data = '' + req.body.data;
                    var json = JSON.parse(data);

                    var contacts = objAllTables.contacts.contacts();

                    for (var i = 0; i < json.length; i++) {
                        contacts.destroy({ where: { id: json[i].id } })
                            .then(function() {
                                res.send({ meta: { status: 200, message: 'Contacts Deleted' } });
                            });
                    }


                } else {
                    res.send({ meta: { status: 401, message: 'User is not logged in or invalid token' } });
                }
            })
            .error(function(err) {
                res.send({ meta: { status: 500, message: 'unexpected error' }, details: err });
            });
    }

    function error(errors) {
        if (errors instanceof Error) {
            // This means an exception was thrown from a validator
            res.send({ meta: { status: 401, message: 'An error ocuured in validator' }, errors: errors });
        } else {
            res.send({ meta: { status: 401, message: 'validation errors' }, errors: errors });
        }
    }
}

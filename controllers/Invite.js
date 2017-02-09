var Promise = require('bluebird');

//classes
var db = require('../helpers/db');
var utils = require('../helpers/Utils');
var helpers = require('../helpers/helpers');
var clasAllTables = require('../models/alltables');
var config = require('../config');

//instances
var objAllTables = clasAllTables.allTables;
var sequelize = db.sequelizeConn();

exports.getInviter = function(req, res) {
    var Invitations = objAllTables.invitations.invitations();
    var Users = objAllTables.users.users();
    var invitation_id = req.params.invitation_id;

    Invitations.belongsTo(Users, { foreignKey: 'uid' });

    Invitations.findOne({ attributes: [], include: [{ attributes: ['username', 'uid', [sequelize.fn("concat", sequelize.col("first_name"), ' ', sequelize.col("last_name")), 'name']], model: Users }], where: { invitation_id: invitation_id } }).then(function(result) {
        if (result !== null) {
            res.send(200, { meta: { status: 200, message: 'OK' }, data: result.user })
        } else {
            res.send(401, { meta: { status: 401, message: 'Not Found' }, data: [] })
        }
    })
};

exports.generate_invite_link = function(req, res) {

    helpers.getActiveSession(req).then(function(sessionUser) {
        if (sessionUser.type == 'Recognized') {
            getOrGenerateInvite(sessionUser.uid).then(function(new_invitation) {
                res.send(200, { meta: { status: 200, message: 'OK' }, invitation_id: invitation_id })
            });
        } else {
            res.send(401, { meta: { status: 401, message: 'Unauthorized' } })
        }
    });
};

function getOrGenerateInvite(uid) {
    var invitation_id = utils.encode_Hashids([sessionUser.uid, helpers.getUnixTimeStamp()]);
    var platform = req.body.platform.toUpperCase() || 'OTHER';
    var invitationsTbl = objAllTables.invitations.invitations();

    return invitationsTbl.findOrCreate({
        where: { uid: uid },
        defaults: {
            invitation_id: invitation_id,
            platform: platform,
            status: 'ACTIVE',
            created: helpers.getUnixTimeStamp()
        }
    })
}

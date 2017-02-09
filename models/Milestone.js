//###############################################################
//######################### Require #############################
//###############################################################
var valid = require('../helpers/valid');
var config = require('../config');
var models = require('../models');
var Promise = require("bluebird");
var _ = require('lodash');
//###############################################################
//######################## Constructor ##########################
//###############################################################

Milestone = function (id, session_uid) {

    if (_.isInteger(id))
        this.id = id;
    else
        throw new Error('INVALID_TYPE, only integer is allowed');

    if (session_uid != null)
        this.session_uid = session_uid;
}

module.exports = Milestone;

//###############################################################
//######################## Properties ###########################
//###############################################################

Milestone.prototype.pagination = {
    offset: 0,
    limit: 5
}

//###############################################################
//###################### Static Methods #########################
//###############################################################

/**
 * [getList This function is use to get multiple milestones by IDs]
 * @param  {[Object]} input         [parameteric call]
 * @param  {[Array]} milestone_ids  [Milestone Ids]
 * @param  {[Int]} session_uid      [Session ID]
 * @return {[Promise]}              [description]
 */
Milestone.getList = function (input, milestone_ids, session_uid) {

    var milestones = { id: milestone_ids };

    if (session_uid != null)
        milestones.session_uid = session_uid;

    return queryExecutor(input, milestones);
}

//###############################################################
//###################### Public Methods #########################
//###############################################################

Milestone.prototype.get = function (input) {
    return queryExecutor(input, this);
}


//###############################################################
//##################### Private Functions #######################
//###############################################################

//render function for raw data
function render(_this, rawData) {

    var milestones = [];

    if (!Array.isArray(rawData))
        rawData = new Array(rawData);

    return Promise.map(rawData, function (_milestone) {
        //create instance(s) depend on data
        var milestone = rawData.length == 1 ? _this : new Milestone(_milestone.id);

        milestone = _.pick(_milestone, ['id', 'text', 'seq_number', 'finished_at', 'status', 'created']);

        if (_milestone.user) 
            milestone.user = _milestone.user;

        milestones.push(milestone);

        return;
    }).then(function () {
        return milestones;
    });
}

//executes sequelize query and merge media into it
function queryExecutor(input, that) {
    var _query = queryGenerator(input, that);

    //execute milestone query
    return models.milestone.findAll(_query).then(function (_milestoneRaw) {

        //if no milestones was found
        if (_.isEmpty(_milestoneRaw))
            return [];

        return _milestoneRaw;
    }).then(function (_milestoneRaw) {
        if (_.isObject(input.user)) {
            var uids = _.compact(_.uniq(_.map(_milestoneRaw, _.iteratee('uid'))));
            return User.getList(input.user, uids, that.session_uid).then(function(users){
                _.forEach(_milestoneRaw, function (value, key) {
                    value.user = _.head(_.filter(users, function (o) { return o.uid == value.uid; }));
                });
                return _milestoneRaw;
            })
        } else {
            return _milestoneRaw;
        }
    }).then(function (_milestoneRaw) {        
        return render(that, _milestoneRaw);
    });

}

//generates sequelize query
function queryGenerator(input, that) {

    //parse input
    var _queryModels = inputParser(input, that);

    //add "get milestone" condition into query
    if (that.id != null)
        _queryModels.milestone.where.id = that.id;

    //create sequelize query
    var _query = {
        where: _queryModels.milestone.where,
        attributes: _queryModels.milestone.attributes,
        include: _.values(_.omit(_queryModels, 'milestone')),
    };

    return _query;
}

//parses json input - parametric query
function inputParser(input, that) {

    var query_models = {};

    for (var key in input) {
        if (!input.hasOwnProperty(key)) {
            //The current property is not a direct property of input
            continue;
        }

        else if (input[key] instanceof Array) {
            if (key == 'basic') {
                query_models.milestone = {
                    where: { $or: [{status: 'ACTIVE'}, {status: 'COMPLETED'}] },
                    attributes: ['id', 'text', 'goal_id', 'seq_number', 'finished_at', 'created']
                };
            }
        }

        else if (typeof input[key] !== 'null' && typeof input[key] === 'object') { //for nested input

            if (key == 'user') {
                query_models.milestone.attributes.push('uid');
            } else {
                var obj = inputParser(input[key], that);
                query_models = _.assign(query_models, obj);
            }
        }
    }

    return query_models;
}

//###############################################################
//########################### Test ##############################
//###############################################################

Milestone.prototype.final = function () {

    var input = {
        basic: ['id', 'text', 'goal_id', 'seq_number', 'finished_at', 'created'],
        user: {
            basic: ['text', 'username', 'email', 'link'],
            profile: ['small', 'medium'],
        }
    };

    return queryExecutor(input);
}

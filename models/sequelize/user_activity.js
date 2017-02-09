
module.exports = function (sequelize, DataTypes) {

    var user_activity = sequelize.define(
        'user_activity',
        {
            //mapping coulumns i-e DataTypess, null checks etc
            id: {autoIncrement: true, type: DataTypes.INTEGER(11), allowNull: false, primaryKey: true},
            uid: {type: DataTypes.INTEGER(11), allowNull: false},
            activity_type: {
                type: DataTypes.ENUM('ALBUM', 'GOAL_CREATED', 'PROGRESS_UPDATED', 'CONTRIBUTION', 'GOAL_ACHIEVED', 'GOAL_FOLLOWED', 'USER_FOLLOWED', 'MILESTONE_CREATED', 'MILESTONE_COMPLETED', 'COMMENT', 'REPLY_ON_POSTCOMMENT', 'STATUS_UPDATE', 'MOTIVATE_ON_GOAL', 'MOTIVATE_ON_POST', 'SHARE_GOAL', 'SHARE_POST', 'GOAL_TIMELINE_UPDATED', 'GOAL_IMAGE_UPDATED', 'GOAL_DESCRIPTION_UPDATED', 'GOAL_NAME_UPDATED', 'GOAL_INTEREST_UPDATED', 'PROFILE_PICTURE_UPDATED', 'PROFILE_COVER_UPDATED', 'LINK_GOAL'),
                allowNull: false
            },
            source_id: {type: DataTypes.INTEGER(11), allowNull: false},
            parent_id: {type: DataTypes.INTEGER(11), allowNull: true},
            parent_type: {type: DataTypes.ENUM('GOAL', 'POST', 'ALBUM'), allowNull: true},
            post_id: {type: DataTypes.INTEGER(11), allowNull: true},
            status: {type: DataTypes.ENUM('ACTIVE', 'DELETED'), allowNull: true},    //allow null is "true" here because db has a defulat value 'ACTIVE'
            created: { type: DataTypes.INTEGER(11), allowNull: true }
        },
        {
            timestamps: false,
            paranoid: true,
            freezeTableName: true,
            tableName: 'user_activity',
            classMethods: {
                associate: function (models) {
                    user_activity.belongsTo(models.users, {foreignKey: 'uid'});
                    user_activity.hasOne(models.user_feed, {foreignKey: 'activity_id'})
                }
            }
        }
    );
    return user_activity;
};
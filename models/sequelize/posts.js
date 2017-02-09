
module.exports = function (sequelize, DataTypes) {

    var posts = sequelize.define(
        'posts',
        {
            //mapping coulumns i-e datatypes, null checks etc
            id: {type: DataTypes.INTEGER(11), allowNull: false, primaryKey: true, autoIncrement : true},
            uid: {type: DataTypes.INTEGER(11), allowNull: false},
            textSearchable:{type:DataTypes.TEXT,allowNull:true},
            text:{type:DataTypes.TEXT,allowNull:false},
            media_id: {type: DataTypes.INTEGER(11), allowNull: true},
            fetched_url_id: {type: DataTypes.INTEGER(11), allowNull: true},
            scope_id: {type: DataTypes.INTEGER(11), allowNull: true},
            post_type: {type: DataTypes.ENUM('ALBUM','GOAL_CREATED','PROGRESS_UPDATED','CONTRIBUTION','GOAL_ACHIEVED','GOAL_FOLLOWED','USER_FOLLOWED','MILESTONE_CREATED','MILESTONE_COMPLETED','STATUS_UPDATE','SHARE_GOAL','SHARE_POST','GOAL_TIMELINE_UPDATED','GOAL_IMAGE_UPDATED','GOAL_DESCRIPTION_UPDATED','GOAL_NAME_UPDATED','GOAL_INTEREST_UPDATED','PROFILE_PICTURE_UPDATED','PROFILE_COVER_UPDATED','LINK_GOAL'), allowNull: false , defaultValue : 'STATUS_UPDATE'},
            created: {type: DataTypes.INTEGER(11), allowNull: false},
            updated: {type: DataTypes.INTEGER(11), allowNull: true},
            status: {type: DataTypes.ENUM('ACTIVE', 'DELETED','FLAG','USERDEACTIVATED'), allowNull: false},
            parent_id: {type: DataTypes.INTEGER(11), allowNull: true},
            location_id: {type: DataTypes.INTEGER(11), allowNull: true},
            user_defined_location_id: {type: DataTypes.INTEGER(11), allowNull: true},

            //derived attributes
            isFollower: {type: DataTypes.VIRTUAL},
            isMotivate: {type: DataTypes.VIRTUAL}
        },
        {
            timestamps: false,
            paranoid: true,
            freezeTableName: true,

            // define the table's name
            tableName: 'posts',
            classMethods: {
                associate: function(models) {
                    posts.hasOne(models.post_stats, { foreignKey: 'post_id'} );
                    posts.belongsTo(models.user_defined_location, { targetKey: 'id', foreignKey : 'user_defined_location_id'});
                    posts.belongsTo(models.fetched_url, { targetKey: 'id', foreignKey : 'fetched_url_id'});
                }
            }
        }
    );
    return posts;
}
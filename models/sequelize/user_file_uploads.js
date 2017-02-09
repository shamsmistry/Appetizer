/**
 * Created by Ahmer Saeed on 9/23/2015.
 */

//mapping database table default_category

module.exports = function (sequelize,DataTypes) {

    var user_file_uploads = sequelize.define(
        'user_file_uploads',
        {
            //mapping coulumns i-e datatypes, null checks etc
            id: {type: DataTypes.INTEGER(11), allowNull: false, primaryKey: true, autoIncrement: true},
            uid: {type: DataTypes.INTEGER(11), allowNull: false},
            parent_id: {type: DataTypes.INTEGER(11), allowNull: true},
            album_id: {type: DataTypes.INTEGER(11), allowNull: true},
            parent_type: {
                type: DataTypes.ENUM('USERPROFILE', 'USERCOVER', 'GOAL', 'PROGRESS', 'CONTRIBUTE', 'COMMENT', 'POST', 'DEFAULTUSERPROFILE', 'DEFAULTUSERCOVER', 'DEFAULTGOAL', 'LIBRARY', 'CATEGORY', 'SUBCATEGORY', 'BANNER'), // PROGRESS belongs to Milestone Completed
                allowNull: true
            },
            media_url: {type: DataTypes.STRING, allowNull: true},
            filetype: {type: DataTypes.ENUM('AUDIO', 'VIDEO', 'IMAGE'), allowNull: true},
            extension: {type: DataTypes.STRING(55), allowNull: true},
            width: {type: DataTypes.INTEGER(11), allowNull: true},
            height: {type: DataTypes.INTEGER(11), allowNull: true},
            videothumbextension: {type: DataTypes.STRING(55), allowNull: true},
            path: {type: DataTypes.STRING, allowNull: true},
            duration: {type: DataTypes.INTEGER(11), allowNull: true},
            status: {
                type: DataTypes.ENUM('ACTIVE', 'INACTIVE', 'USERDEACTIVATED'),
                allowNull: true,
                defaultValue: 'ACTIVE'
            },
            created: { type: DataTypes.INTEGER(11), allowNull: true },
            post_id: { type: DataTypes.INTEGER(11), allowNull: true }
        },
        {
            timestamps: false,
            paranoid: true,
            freezeTableName: true,
            // define the table's name
            tableName: 'user_file_uploads',
            classMethods: {
                associate: function (models) {
                    user_file_uploads.hasMany(models.images_thumbs, {foreignKey: 'image_id'});
                }
            }
        }
    );
    return user_file_uploads;
};
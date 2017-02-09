/**
 * Created by Wasiq on 7/11/2016.
 */
//mapping database table default_category

module.exports = function (sequelize, DataTypes) {

    var images_thumbs = sequelize.define(
        'images_thumbs',
        {
            //mapping coulumns i-e datatypes, null checks etc
            id: {type: DataTypes.INTEGER(11), allowNull: false, primaryKey: true, autoIncrement: true},
            image_id: {type: DataTypes.INTEGER(11), allowNull: false},
            path: {type: DataTypes.STRING, allowNull: true},
            width: {type: DataTypes.INTEGER(11), allowNull: true},
            height: {type: DataTypes.INTEGER(11), allowNull: true},
            sizetype: {type: DataTypes.ENUM('SMALL', 'MEDIUM', 'LARGE', 'XLARGE','SQUARE','_1','_2','_3','_4'), allowNull: true},
            thumbtype: {type: DataTypes.ENUM('IMAGETHUMB', 'VIDEOTHUMB'), allowNull: true},
            status: {type: DataTypes.ENUM('ACTIVE', 'INACTIVE'), allowNull: true, defaultValue: 'ACTIVE'},
            created: {type: DataTypes.INTEGER(11), allowNull: true}
        },
        {
            timestamps: false,
            paranoid: true,
            freezeTableName: true,
            tableName: 'images_thumbs'

        }
    );
    return images_thumbs;
};
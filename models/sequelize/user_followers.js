/**
 * Created by Wasiq Muhammad on 10/9/2015.
 */

module.exports = function (sequelize, DataTypes) {

    var user_followers = sequelize.define(
        'user_followers',
        {
            //mapping coulumns i-e datatypes, null checks etc
            _id: {autoIncrement: true, type: DataTypes.BIGINT(20), allowNull: false, primaryKey: true},
            uid: {type: DataTypes.INTEGER(11), allowNull: false},
            follows_uid: {type: DataTypes.INTEGER(11), allowNull: false},
            status: {type: DataTypes.ENUM('ACTIVE', 'INACTIVE', 'USERDEACTIVATED'), allowNull: false},
            created: {type: DataTypes.INTEGER(11), allowNull: false},

        },
        {
            timestamps: false,
            paranoid: true,
            freezeTableName: true,
            tableName: 'user_followers',
            classMethods: {
                associate: function(models) {
                    user_followers.belongsTo( models.users, { foreignKey: 'uid' } );
                }
            }
        }
    );
    return user_followers;
};
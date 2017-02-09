/**
 * Created by Mudassir on 12/17/2015.
 */

module.exports = function (sequelize, DataTypes) {

    var user_mute = sequelize.define(
        'user_mute',
        {
            //mapping coulumns i-e datatypes, null checks etc
            id: {type: DataTypes.INTEGER(11), allowNull: false,autoIncrement: true,primaryKey: true},
            uid: {type: DataTypes.INTEGER(11), allowNull: false },
            mute_uid: {type: DataTypes.INTEGER(11), allowNull: false },
            status: {type: DataTypes.ENUM('ACTIVE','INACTIVE','USERDEACTIVATED'), allowNull: false, defaultValue : 'ACTIVE'},
            created: {type: DataTypes.INTEGER(11), allowNull: false},
            updated: {type: DataTypes.INTEGER(11), allowNull: false}
        },
        {
            timestamps: false,
            paranoid: true,
            freezeTableName: true,
            tableName: 'user_mute',
            classMethods: {
                associate: function(models) {
                    user_mute.belongsTo(models.users, { foreignKey: 'uid'} );
                }
            }
        }
    );
    return user_mute;
};
/**
 * Created by Ahmer Saeed on 10/7/2015.
 */
//mapping database table user_password_verification

module.exports = function (sequelize, DataTypes) {

    var user_password_verification = sequelize.define(
        'user_password_verification',
        {
            //mapping coulumns i-e datatypes, null checks etc
            id: {type: DataTypes.INTEGER(11), allowNull: false, primaryKey: true, autoIncrement: true},
            uid: {type: DataTypes.INTEGER(11), allowNull: true},
            verification_key: {type: DataTypes.STRING(255), allowNull: true},
            expirytime: {type: DataTypes.STRING(55), allowNull: true},
            status: {type: DataTypes.ENUM('ACTIVE', 'INACTIVE', 'CLICKED'), allowNull: false},
            created: {type: DataTypes.INTEGER(11), allowNull: true}
        },
        {
            timestamps: false,
            paranoid: true,
            freezeTableName: true,
            // define the table's name
            tableName: 'user_password_verification',
            classMethods: {
                associate: function(models) {
                    user_password_verification.belongsTo(models.users, { foreignKey: 'uid'} );
                }
            }
        }
    );
    return user_password_verification;
};
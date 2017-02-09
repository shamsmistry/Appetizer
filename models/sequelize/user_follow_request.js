
//mapping database table default_category

module.exports = function (sequelize, DataTypes) {

    var user_follow_request = sequelize.define(
        'user_follow_request',
        {
            //mapping coulumns i-e datatypes, null checks etc
            id: {type: DataTypes.INTEGER(11), allowNull: false, primaryKey: true, autoIncrement : true},
            uid: {type: DataTypes.INTEGER(11), allowNull: false},
            uid_requester: {type: DataTypes.INTEGER(11), allowNull: false},
            seen: {type: DataTypes.INTEGER(1), allowNull: true},    //its false in database with a default value
            status: {type: DataTypes.ENUM('ACCEPTED','ACTIVE', 'REJECTED','CANCELLED'), allowNull: true , defaultValue : 'ACTIVE'},
            created: {type: DataTypes.INTEGER(11), allowNull: false},
            updated: {type: DataTypes.INTEGER(11), allowNull: true},


        },
        {
            timestamps: false,
            paranoid: true,
            freezeTableName: true,

            // define the table's name
            tableName: 'user_follow_request',
            classMethods: {
                associate: function(models) {
                    user_follow_request.belongsTo(models.users, { foreignKey: 'uid'} );
                }
            }
        }
    );
    return user_follow_request;
};
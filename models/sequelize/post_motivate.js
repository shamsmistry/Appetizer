
module.exports = function (sequelize, DataTypes) {

    var post_motivate = sequelize.define(
        'post_motivate',
        {
            //mapping coulumns i-e datatypes, null checks etc
            _id: {autoIncrement: true, type: DataTypes.INTEGER(11), allowNull: false, primaryKey: true},
            post_id: {type: DataTypes.INTEGER(11), allowNull: false},
            uid: {type: DataTypes.INTEGER(11), allowNull: false},
            status: {type: DataTypes.ENUM('ACTIVE', 'INACTIVE','USERDEACTIVATED'), allowNull: false},
            created: {type: DataTypes.INTEGER(11), allowNull: false},
        },
        {
            timestamps: false,
            paranoid: true,
            freezeTableName: true,
            tableName: 'post_motivate'
        }
    );
    return post_motivate;
};
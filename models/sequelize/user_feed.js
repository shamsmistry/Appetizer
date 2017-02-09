module.exports = function (sequelize, DataTypes) {
    var user_feed = sequelize.define(
        'user_feed',
        {
            id: {autoIncrement: true, type: DataTypes.INTEGER(11), allowNull: false, primaryKey: true},
            uid: {type: DataTypes.INTEGER(11), allowNull: false},
            activity_id: {type: DataTypes.INTEGER(11), allowNull: false},
            status: {type: DataTypes.ENUM('ACTIVE','DELETED','HIDDEN','USERDEACTIVATED'), allowNull: true},
            created: {type: DataTypes.INTEGER(11), allowNull: true},
            updated: {type: DataTypes.INTEGER(11), allowNull: true}
        },
        {
            timestamps: false,
            paranoid: true,
            freezeTableName: true,
            tableName: 'user_feed'
        }
    );
    return user_feed;
};
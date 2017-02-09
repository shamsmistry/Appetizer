module.exports = function (sequelize, DataTypes) {

    var mentioned_comment = sequelize.define(
        'mentioned_comment',
        {
            //mapping coulumns i-e datatypes, null checks etc
            id: {type: DataTypes.INTEGER(11), allowNull: false,autoIncrement: true,primaryKey: true},
            uid: {type: DataTypes.INTEGER(11), allowNull: false },
            mentioned_uid: {type: DataTypes.INTEGER(11), allowNull: false },
            post_id: {type: DataTypes.INTEGER(11), allowNull: false },
            status: {type: DataTypes.ENUM('ACTIVE', 'INACTIVE'), allowNull: true},
            mentioned_name : {type: DataTypes.STRING(255), allowNull: false },
            created: {type: DataTypes.INTEGER(11), allowNull: false},
            updated: {type: DataTypes.INTEGER(11), allowNull: true},
            comment_id: {type: DataTypes.INTEGER(11), allowNull: false}
        },
        {
            timestamps: false,
            paranoid: true,
            freezeTableName: true,
            tableName: 'mentioned_comment'
        }
    );
    return mentioned_comment;
};
module.exports = function (sequelize, DataTypes) {

    var mentioned_post = sequelize.define(
        'mentioned_post',
        {
            //mapping coulumns i-e datatypes, null checks etc
            id: {type: DataTypes.INTEGER(11), allowNull: false,autoIncrement: true,primaryKey: true},
            uid: {type: DataTypes.INTEGER(11), allowNull: false },
            mentioned_uid: {type: DataTypes.INTEGER(11), allowNull: false },
            post_id: {type: DataTypes.INTEGER(11), allowNull: false },
            status: {type: DataTypes.ENUM('ACTIVE', 'INACTIVE'), allowNull: true},   //its false in database with a default value
            mentioned_name : {type: DataTypes.STRING(255), allowNull: false },
            created: {type: DataTypes.INTEGER(11), allowNull: false},
            updated: {type: DataTypes.INTEGER(11), allowNull: true}
        },
        {
            timestamps: false,
            paranoid: true,
            freezeTableName: true,
            tableName: 'mentioned_post'
        }
    );
    return mentioned_post;
};
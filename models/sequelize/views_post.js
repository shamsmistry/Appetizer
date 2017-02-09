
module.exports = function (sequelize, DataTypes) {

    var views_post = sequelize.define(
        'views_post',
        {
            id: {type: DataTypes.INTEGER(11), allowNull: false, autoIncrement: true, primaryKey: true},
            uid: {type: DataTypes.INTEGER(11), allowNull: false},
            post_id: {type: DataTypes.INTEGER(11), allowNull: false},
            location_id: {type: DataTypes.INTEGER(11), allowNull: true},
            created: {type: DataTypes.INTEGER(11), allowNull: false}
        },
        {
            timestamps: false,
            paranoid: true,
            freezeTableName: true,
            tableName: 'views_post'
        }
    );
    return views_post;
};
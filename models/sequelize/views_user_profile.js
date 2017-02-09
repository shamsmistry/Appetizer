
module.exports = function (sequelize, DataTypes) {

    var views_user_profile = sequelize.define(
        'views_user_profile',
        {
            id: {type: DataTypes.INTEGER(11), allowNull: false, autoIncrement: true, primaryKey: true},
            uid: {type: DataTypes.INTEGER(11), allowNull: false},
            uid_profile: {type: DataTypes.INTEGER(11), allowNull: false},
            location_id: {type: DataTypes.INTEGER(11), allowNull: true},
            created: {type: DataTypes.INTEGER(11), allowNull: false}
        },
        {
            timestamps: false,
            paranoid: true,
            freezeTableName: true,
            tableName: 'views_user_profile',
            classMethods: {
                associate: function(models) {
                    views_user_profile.belongsTo(models.users, { foreignKey: 'uid'} );
                }
            }

        }
    );
    return views_user_profile;
};

module.exports = function (sequelize, DataTypes) {

    var views_goal = sequelize.define(
        'views_goal',
        {
            id: {type: DataTypes.INTEGER(11), allowNull: false, autoIncrement: true, primaryKey: true},
            uid: {type: DataTypes.INTEGER(11), allowNull: false},
            goal_id: {type: DataTypes.INTEGER(11), allowNull: false},
            location_id: {type: DataTypes.INTEGER(11), allowNull: true},
            created: {type: DataTypes.INTEGER(11), allowNull: false}
        },
        {
            timestamps: false,
            paranoid: true,
            freezeTableName: true,
            tableName: 'views_goal',
            classMethods: {
                associate: function (models) {
                    views_goal.belongsTo(models.goals, {foreignKey: 'goal_id'});
                    views_goal.belongsTo(models.users, {foreignKey: 'uid'});
                }
            }
        }
    );
    return views_goal;
};
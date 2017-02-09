
module.exports = function (sequelize , DataTypes) {

    var hot_new_goals = sequelize.define(
        'hot_new_goals',
        {
            //mapping coulumns i-e datatypes, null checks etc
            _id: {autoIncrement: true, type: DataTypes.INTEGER(11), allowNull: false, primaryKey: true},
            goal_id: {type: DataTypes.INTEGER(11), allowNull: false},
            status: {type: DataTypes.ENUM('ACTIVE', 'INACTIVE', 'USERDEACTIVATED'), allowNull: false},
            created_at: {type: DataTypes.INTEGER(11), allowNull: true}

        },
        {
            timestamps: false,
            paranoid: true,
            freezeTableName: true,
            tableName: 'hot_new_goals',
            classMethods: {
                associate: function (models) {
                    hot_new_goals.belongsTo(models.goals, {foreignKey: 'goal_id'});
                }
            }
        }
    );
    return hot_new_goals;
};
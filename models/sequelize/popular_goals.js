
module.exports = function (sequelize, DataTypes) {

    var popular_goals = sequelize.define(
        'popular_goals',
        {
            //mapping coulumns i-e datatypes, null checks etc
            _id: {autoIncrement: true, type: DataTypes.INTEGER(11), allowNull: false, primaryKey: true},
            uid: {type: DataTypes.INTEGER(11), allowNull: false},
            goal_id: {type: DataTypes.INTEGER(11), allowNull: false},
            status: {type: DataTypes.ENUM('ACTIVE', 'INACTIVE', 'USERDEACTIVATED'), allowNull: false},
            created_at: {type: DataTypes.INTEGER(11), allowNull: true},

        },
        {
            timestamps: false,
            paranoid: true,
            freezeTableName: true,
            tableName: 'popular_goals',
            classMethods: {
                associate: function (models) {
                    popular_goals.belongsTo(models.goals, {foreignKey: 'goal_id'});
                }
            }
        }
    );
    return popular_goals;
};



module.exports = function (sequelize, DataTypes) {

    var goal_motivate = sequelize.define(
        'goal_motivate',
        {
            //mapping coulumns i-e datatypes, null checks etc
            _id: {autoIncrement: true, type: DataTypes.INTEGER(11), allowNull: false, primaryKey: true},
            goal_id: {type: DataTypes.INTEGER(11), allowNull: false},
            uid: {type: DataTypes.INTEGER(11), allowNull: false},
            status: {type: DataTypes.ENUM('ACTIVE', 'INACTIVE','USERDEACTIVATED'), allowNull: false},
            created: {type: DataTypes.INTEGER(11), allowNull: false},
        },
        {
            timestamps: false,
            paranoid: true,
            freezeTableName: true,
            tableName: 'goal_motivate',
            classMethods: {
                associate: function (models) {
                    goal_motivate.belongsTo(models.goals, {foreignKey: 'goal_id'});
                }
            }
        }
    );
    return goal_motivate;
};
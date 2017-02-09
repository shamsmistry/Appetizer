
module.exports = function (sequelize,DataTypes) {

    var goal_linked = sequelize.define(
        'goal_linked',
        {
            _id: {autoIncrement: true, type: DataTypes.BIGINT(20), allowNull: false, primaryKey: true},
            from_goal_id: {type: DataTypes.INTEGER(11), allowNull: false},
            to_goal_id: {type: DataTypes.INTEGER(11), allowNull: false},
            uid: {type: DataTypes.INTEGER(11), allowNull: false},
            status: {type: DataTypes.ENUM('ACTIVE', 'INACTIVE','USERDEACTIVATED'), allowNull: false},
            created: {type: DataTypes.INTEGER(11), allowNull: false},
            updated: {type: DataTypes.INTEGER(11), allowNull: true},
        },
        {
            timestamps: false,
            paranoid: true,
            freezeTableName: true,
            tableName: 'goal_linked',
            classMethods: {
                associate: function (models) {
                   // goal_linked.belongsTo(models.goals, {foreignKey: 'goal_id'});
                    goal_linked.belongsTo(models.users, {foreignKey: 'uid'});
                }
            }
        }
    );
    return goal_linked;
};
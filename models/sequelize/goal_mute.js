
module.exports = function (sequelize, DataTypes) {

    var goal_mute = sequelize.define(
        'goal_mute',
        {
            //mapping coulumns i-e datatypes, null checks etc
            id: {autoIncrement: true, type: DataTypes.INTEGER(11), allowNull: false, primaryKey: true},
            uid: {type: DataTypes.INTEGER(11), allowNull: false},
            goal_id: {type: DataTypes.INTEGER(11), allowNull: false},
            status: {type: DataTypes.ENUM('ACTIVE', 'COMPLETED', 'DELETED','USERDEACTIVATED'), allowNull: false},
            created: {type: DataTypes.INTEGER(11), allowNull: false},
        },
        {
            timestamps: false,
            paranoid: true,
            freezeTableName: true,
            tableName: 'goal_mute',
            classMethods: {
                associate: function (models) {
                    goal_mute.belongsTo(models.goals, {foreignKey: 'goal_id'});
                    goal_mute.belongsTo(models.users, {foreignKey: 'uid'});
                }
            }
        }
    );
    return goal_mute;
};
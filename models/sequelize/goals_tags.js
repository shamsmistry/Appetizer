
module.exports = function (sequelize, DataTypes) {

    var goals_tags = sequelize.define(
        'goals_tags',
        {
            //mapping coulumns i-e datatypes, null checks etc
            _id: {autoIncrement: true, type: DataTypes.INTEGER(11), allowNull: false, primaryKey: true},
            goal_id: {type: DataTypes.INTEGER(11), allowNull: false},
            tag_id: {type: DataTypes.INTEGER(11), allowNull: false},
            status: {type: DataTypes.ENUM('ACTIVE', 'INACTIVE', 'USERDEACTIVATED'), allowNull: false},
            gen_by: {type: DataTypes.ENUM('USER', 'SYSTEM'), allowNull: false},
            created: {type: DataTypes.INTEGER(11), allowNull: false}
        },
        {
            timestamps: false,
            paranoid: true,
            freezeTableName: true,
            tableName: 'goals_tags',
            classMethods: {
                associate: function (models) {
                    goals_tags.belongsTo(models.goals, {foreignKey: 'goal_id'});
                    goals_tags.belongsTo(models.tags, {foreignKey: 'tag_id'});
                }
            }
        }
    );
    return goals_tags;
};